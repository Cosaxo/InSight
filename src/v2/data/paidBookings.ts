// The client half of the self-serve paid-question loop (paid.ts, D313).
// Three jobs: open a booking through the callable, read back this
// account's own rows so the door can show review → approved → live, and
// turn an approved row into a Stripe Checkout URL.
//
// The suggestions.ts posture, for the same reasons:
//   1. ONE bounded query, on demand, never a listener — the door is
//      opened, not watched. The mine-only filter is not a nicety: the
//      rules grant reads as `uid == request.auth.uid`, so an unfiltered
//      query is refused wholesale (the D65 shape). The door POLLS
//      loadMine(true) briefly while a row sits in "review" — the
//      automated check usually settles in seconds, and a bounded burst
//      of small reads beats a standing listener on a sheet most
//      sessions never open.
//   2. Session-cached; reset on account change.
//   3. Firebase arrives through lib/firebase's memoised dynamic import
//      (D110) — nothing below runs at module scope.
//
// The write path is the callable and only the callable: App Check, the
// booking budget and the review ordering live server-side, and
// firestore.rules refuses direct writes so there is nothing to fall
// back to. Payment never touches this module beyond carrying the URL —
// commerce runs on Stripe's page, on the web, exactly where
// NEXT-FUNCTIONALITY §6 put it.

import { getFirestoreApi, getFunctionsApi, getDb, subscribeToAuth } from "../../lib/firebase";
import { FUNCTIONS_REGION } from "../../lib/region";

export interface BookingQuote {
  ratePerAnswer: number;
  capEur: number;
  cap: number;
  windowDays: number;
  /** the ad lane's flat window figure (D315) — 0 on question quotes */
  flatEur: number;
}

export interface MyBooking {
  id: string;
  kind: "question" | "ad";
  /** the ad half (D315) — empty strings on question bookings */
  advertiser: string;
  headline: string;
  body: string;
  prompt: string;
  type: string;
  options: string[];
  topic: string | null;
  scope: "city" | "country" | "world";
  dims: Record<string, string>;
  wearName: boolean;
  status: "review" | "approved" | "declined" | "live";
  /** the decline's reason, written to be shown (the review's own words) */
  note: string | null;
  quote: BookingQuote | null;
  /** the served window once live — named `win` client-side because the
   * spec scanner reads any `.window.x` chain as a global reference */
  win: { start: string; until: string } | null;
  qid: string | null;
  atMs: number | null;
}

export interface BookingPayload {
  kind: "question" | "ad";
  prompt: string;
  type: string;
  options: string[];
  topic: string | null;
  advertiser: string;
  headline: string;
  body: string;
  scope: "city" | "country" | "world";
  dims: Record<string, string>;
  wearName: boolean;
}

export type BookingResult = { ok: true; id: string } | { ok: false; code: string; message: string };
export type CheckoutResult = { ok: true; url: string } | { ok: false; code: string; message: string };

// ── auth: one lazy subscription, cached uid ─────────────────────────────
let uid: string | null = null;
let authWired = false;
function wireAuth(): void {
  if (authWired) return;
  authWired = true;
  subscribeToAuth((u) => {
    const next = u?.uid ?? null;
    if (next !== uid) {
      uid = next;
      // A different account's bookings must never render under this one.
      rows = null;
      notify();
    }
  });
}

// ── the session cache ───────────────────────────────────────────────────
let rows: MyBooking[] | null = null;
let loading: Promise<MyBooking[]> | null = null;
const listeners = new Set<() => void>();
function notify(): void {
  listeners.forEach((f) => f());
}

export function subscribeBookings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The cached rows, or null when nothing has loaded yet. Synchronous on
 * purpose: the store's render path reads this; loadMine() fills it. */
export function myBookings(): MyBooking[] | null {
  return rows;
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function parseRow(id: string, d: Record<string, unknown>): MyBooking {
  const status = d.status === "approved" || d.status === "declined" || d.status === "live" ? d.status : "review";
  const at = d.createdAt as { toMillis?: () => number } | null | undefined;
  const q = (d.quote || null) as Record<string, unknown> | null;
  const w = (d.window || null) as Record<string, unknown> | null;
  const dims: Record<string, string> = {};
  if (d.dims && typeof d.dims === "object") {
    for (const [k, v] of Object.entries(d.dims as Record<string, unknown>)) dims[k] = str(v);
  }
  return {
    id,
    kind: d.kind === "ad" ? "ad" : "question",
    advertiser: str(d.advertiser),
    headline: str(d.headline),
    body: str(d.body),
    prompt: str(d.prompt),
    type: str(d.type, "binary"),
    options: Array.isArray(d.options) ? d.options.map((o) => str(o)) : [],
    topic: d.topic == null ? null : str(d.topic),
    scope: d.scope === "city" || d.scope === "country" ? d.scope : "world",
    dims,
    wearName: d.wearName === true,
    status,
    note: d.note ? str(d.note) : null,
    quote: q
      ? { ratePerAnswer: num(q.ratePerAnswer), capEur: num(q.capEur), cap: num(q.cap), windowDays: num(q.windowDays), flatEur: num(q.flatEur) }
      : null,
    win: w && w.start ? { start: str(w.start), until: str(w.until) } : null,
    qid: d.qid ? str(d.qid) : null,
    atMs: typeof at?.toMillis === "function" ? at.toMillis() : null,
  };
}

/** Load this account's bookings — one bounded query, deduped while in
 * flight, newest first. */
export function loadBookings(force = false): Promise<MyBooking[]> {
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
      const { collection, getDocs, query, where } = await getFirestoreApi();
      const snap = await getDocs(
        query(collection(db, "v2_paid_bookings"), where("uid", "==", uid)),
      );
      const next = snap.docs
        .map((d) => parseRow(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => (b.atMs ?? 0) - (a.atMs ?? 0));
      rows = next;
      notify();
      return next;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

async function call<T>(name: string, data: unknown): Promise<T> {
  const db = await getDb();
  const { getFunctions, httpsCallable } = await getFunctionsApi();
  const fns = getFunctions(db.app, FUNCTIONS_REGION);
  const res = await httpsCallable(fns, name)(data);
  return res.data as T;
}

const asRefusal = (e: unknown): { ok: false; code: string; message: string } => {
  const err = e as { code?: string; message?: string };
  return {
    ok: false,
    code: String(err?.code ?? "unknown").replace(/^functions\//, ""),
    message: String(err?.message ?? "That didn't go through — try again."),
  };
};

/** Open a booking through bookPaidQuestionV2. On success the row is
 * appended optimistically (status "review", stamped now) and a refresh is
 * kicked so the server's copy — and shortly the verdict — replaces it. */
export async function submitBooking(p: BookingPayload): Promise<BookingResult> {
  wireAuth();
  try {
    const res = await call<{ id?: string }>("bookPaidQuestionV2", p);
    const id = res?.id ?? "";
    rows = [
      { ...p, id, status: "review", note: null, quote: null, win: null, qid: null, atMs: Date.now() },
      ...(rows ?? []),
    ];
    notify();
    void loadBookings(true).catch(() => {});
    return { ok: true, id };
  } catch (e) {
    return asRefusal(e);
  }
}

/** Turn an approved booking into a checkout URL (createPaidCheckoutV2).
 * The caller opens it — this module never navigates. */
export async function requestCheckout(id: string): Promise<CheckoutResult> {
  try {
    const res = await call<{ url?: string }>("createPaidCheckoutV2", { id });
    const url = res?.url ?? "";
    if (!url) return { ok: false, code: "internal", message: "No checkout link came back — try again." };
    return { ok: true, url };
  } catch (e) {
    return asRefusal(e);
  }
}

/** The purge hook (D51): a signed-out or wiped device must not render the
 * previous account's bookings. */
export function clearBookingCache(): void {
  rows = null;
  notify();
}
