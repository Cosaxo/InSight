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
// The operator's admin script is the collection's only pen
// (scripts/record-purchase.mjs; firestore.rules pins `write: if false`),
// and the room's whole honesty story is that it reads the buyer's own
// rows plus the same public aggregates everyone reads.
//
// The split's reads: one v2_question_aggs getDoc per purchase, fetched
// with the list and cached with it. A buyer has a handful of contracts;
// for everyone else the list is empty and this module reads nothing.

import { getFirestoreApi, getDb, subscribeToAuth } from "../../lib/firebase";

export interface PurchaseReport { label: string; ready: boolean; note?: string }
export interface Purchase {
  id: string;
  kind: "question" | "subscription";
  qid: string;
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
let loading: Promise<Purchase[]> | null = null;
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
      rows = null;
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
  const kind = d.kind === "subscription" ? "subscription" : "question";
  const state = d.state === "closed" ? "closed" : d.state === "lapsed" ? "lapsed" : "running";
  return {
    id,
    kind,
    qid: str(d.qid),
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

/** Load this account's purchases + each bought question's public counts. */
export function loadMine(force = false): Promise<Purchase[]> {
  wireAuth();
  if (rows && !force) return Promise.resolve(rows);
  if (loading) return loading;
  loading = (async () => {
    try {
      if (!uid) {
        // First call can beat the auth emission; one turn of the
        // microtask queue is enough for the cached-credential path, and
        // a genuinely signed-out session correctly loads nothing.
        await new Promise((r) => setTimeout(r, 0));
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
      rows = next;
      notify();
      return next;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export function subscribePurchases(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
