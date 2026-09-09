// The client half of the buyer's room (PAID-PLAN §7, D288; the runbook's
// phase 2). One job: read back this account's own purchase records, plus
// each bought question's PUBLIC aggregate for the card's live split.
//
// The suggestions.ts posture, for the same reasons:
//   1. ONE bounded query, on demand, never a listener — the room is
//      opened, not watched, and a closed overlay must cost nothing.
//      The mine-only filter is not a nicety: the rules grant reads as
//      `uid == request.auth.uid`, so an unfiltered query is refused
//      wholesale (the D65 shape).
//   2. Session-cached; reset on account change.
//   3. Firebase arrives through lib/firebase's memoised dynamic import
//      (D110) — nothing below runs at module scope.
//
// There is NO write path here at all — not a callable, not a fallback.
// The collection's pens are server-side (the Stripe payment webhook for
// self-serve sales — paid.ts, D313 — and scripts/record-purchase.mjs for
// hand contracts; firestore.rules pins `write: if false`), and the
// room's whole honesty story is that it reads the buyer's own rows plus
// the same public aggregates everyone reads.
//
// The split's reads: one v2_question_aggs getDoc per purchase, fetched
// with the list and cached with it. A buyer has a handful of contracts;
// for everyone else the list is empty and this module reads nothing.

import { getFirestoreApi, getDb, subscribeToAuth } from "../../lib/firebase";

export interface PurchaseReport { label: string; ready: boolean; note?: string }
export interface Purchase {
  id: string;
  kind: "question" | "subscription" | "ad";
  qid: string;
  /** the ad sale's half (D315) — empty strings on question rows. An ad
   * has a flat price and no meter: nothing here to count. */
  advertiser: string;
  headline: string;
  adBody: string;
  priceEur: number;
  prompt: string;
  options: string[];
  scope: "city" | "country" | "world";
  place: string | null;
  dims: string[];
  /** the contract's window — named `win` client-side because the spec
   * scanner reads any `.window.x` chain as a global reference */
  win: { start: string; until: string };
  cadence: string;
  budget: { cap: number; capEur: number; ratePerAnswer: number };
  state: "running" | "closed" | "lapsed";
  reports: PurchaseReport[];
  /** the bought question's public option counts, by option index — the
   * same aggregate every signed-in user reads; null until it has any */
  counts: number[] | null;
}

let uid: string | null = null;
let authWired = false;
let rows: Purchase[] | null = null;
// Whether the last attempt to read them FAILED, which is a third state
// and not the same as "not loaded yet". `rows` stays null on a throw, and
// the room that reads it drew "Reading your contracts…" forever — a
// spinner with nothing behind it, no error and no way back. Settling
// `rows` to [] instead would trade the hang for a lie ("Nothing bought
// from this account yet", to a buyer whose read simply failed), so the
// distinction is kept rather than collapsed.
let failed = false;
let loading: Promise<Purchase[]> | null = null;
// The account this store's in-flight read belongs to, as a counter rather
// than a uid: an A -> B -> A round trip inside one flight would compare
// equal on the uid and commit anyway. Bumped on every account change; a
// flight whose generation has moved on commits nothing, fails nothing, and
// does not clear the in-flight slot the NEXT flight now owns.
//
// The bug it closes: `rows` was cleared on the account change and the
// still-running closure then assigned the previous account's rows over the
// top, unconditionally. Nothing else clears `rows` and this store registers
// no purge listener, so the wrong account's data stayed for the session —
// and the account panel is itself the sign-out screen and starts the load
// on its own mount, so the window is one round trip after opening exactly
// the screen where the switch happens.
let gen = 0;

const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function wireAuth(): void {
  if (authWired) return;
  authWired = true;
  subscribeToAuth((u) => {
    const next = u?.uid ?? null;
    if (next !== uid) {
      uid = next;
      // A different account's contracts must never render under this one.
      // `gen` is what makes that true for a read ALREADY IN FLIGHT; clearing
      // `rows` alone left the old closure to write them straight back.
      gen += 1;
      loading = null;
      rows = null;
      failed = false;
      notify();
    }
  });
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

function parseRow(id: string, d: Record<string, unknown>): Purchase {
  const w = (d.window || {}) as Record<string, unknown>;
  const b = (d.budget || {}) as Record<string, unknown>;
  const scope = ["city", "country", "world"].includes(str(d.scope)) ? (str(d.scope) as Purchase["scope"]) : "world";
  const kind = d.kind === "subscription" ? "subscription" : d.kind === "ad" ? "ad" : "question";
  const state = d.state === "closed" ? "closed" : d.state === "lapsed" ? "lapsed" : "running";
  return {
    id,
    kind,
    qid: str(d.qid),
    advertiser: str(d.advertiser),
    headline: str(d.headline),
    adBody: str(d.body),
    priceEur: num(d.priceEur),
    prompt: str(d.prompt),
    options: Array.isArray(d.options) ? d.options.map((o) => str(o)) : [],
    scope,
    place: d.place == null ? null : str(d.place),
    dims: Array.isArray(d.dims) ? d.dims.map((x) => str(x)) : [],
    win: { start: str(w.start), until: str(w.until) },
    cadence: str(d.cadence, "once"),
    budget: { cap: num(b.cap), capEur: num(b.capEur), ratePerAnswer: num(b.ratePerAnswer) },
    state,
    reports: Array.isArray(d.reports)
      ? d.reports.map((r) => {
        const x = (r || {}) as Record<string, unknown>;
        return { label: str(x.label), ready: !!x.ready, note: x.note == null ? undefined : str(x.note) };
      })
      : [],
    counts: null,
  };
}

/** The cached list, without fetching. Null = never loaded this session. */
export function mine(): Purchase[] | null {
  wireAuth();
  return rows;
}

/**
 * Did the last read fail? Only meaningful while `mine()` is still null —
 * a successful load clears it, and so does a change of account.
 */
export function mineFailed(): boolean {
  return failed;
}

/** Load this account's purchases + each bought question's public counts. */
export function loadMine(force = false): Promise<Purchase[]> {
  wireAuth();
  if (rows && !force) return Promise.resolve(rows);
  if (loading) return loading;
  loading = (async () => {
    // Captured AFTER the wait below, not here: the first auth emission is a
    // change from null and bumps `gen`, and a first load must not disown
    // itself over the uid it was waiting for.
    let myGen = gen;
    try {
      if (!uid) {
        // First call can beat the auth emission; one turn of the
        // microtask queue is enough for the cached-credential path, and
        // a genuinely signed-out session correctly loads nothing.
        await new Promise((r) => setTimeout(r, 0));
        myGen = gen;
        if (!uid) return rows ?? [];
      }
      const db = await getDb();
      const { collection, doc, getDoc, getDocs, query, where } = await getFirestoreApi();
      const snap = await getDocs(
        query(collection(db, "v2_purchases"), where("uid", "==", uid)),
      );
      const next = snap.docs.map((d) => parseRow(d.id, d.data() as Record<string, unknown>));
      // the public split, one agg read per bought question — the same
      // document any signed-in user reads for the same number
      await Promise.all(next.map(async (p) => {
        if (p.kind !== "question" || !p.qid) return;
        try {
          const agg = await getDoc(doc(db, "v2_question_aggs", p.qid));
          const counts = (agg.exists() ? (agg.data() || {}).counts : null) as Record<string, unknown> | null;
          if (counts) {
            p.counts = p.options.map((_, i) => num(counts[String(i)]));
          }
        } catch { /* the card draws its window and budget; the split says it hasn't landed */ }
      }));
      next.sort((a, b) => (b.win.start || "").localeCompare(a.win.start || ""));
      // The account changed under this read. Commit nothing: `rows` is the
      // new account's null, and the caller gets whatever that account has.
      if (myGen !== gen) return rows ?? [];
      rows = next;
      failed = false;
      notify();
      return next;
    } catch (err) {
      // Record the failure and tell the room, then rethrow: a caller that
      // awaits this still learns the read did not happen, and the room
      // stops claiming one is in flight.
      // A stale flight's rejection must not pin "Couldn't read your
      // contracts" on the account that replaced it.
      if (myGen !== gen) throw err;
      failed = true;
      notify();
      throw err;
    } finally {
      // Only if this flight still owns the slot. Unconditional, it would
      // wipe the NEXT flight's promise out of `loading` and defeat the
      // in-flight dedupe for the rest of the session — one bounded query
      // becoming three.
      if (myGen === gen) loading = null;
    }
  })();
  return loading;
}

export function subscribePurchases(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
