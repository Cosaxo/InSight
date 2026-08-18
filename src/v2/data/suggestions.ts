// The client half of "Suggest a question" (docs/NEXT-FUNCTIONALITY.md §6,
// D138). The spec-layer board renders; this module is its only wire to
// the backend: submit through the callable, read back your own rows.
//
// The voters.ts posture, for the same reasons:
//   1. ONE query, on demand, never a listener — the board is opened, not
//      watched, and a closed overlay must cost nothing (D124/D129).
//   2. Session-cached; refreshed after a submit and on account change.
//   3. Firebase arrives through lib/firebase's memoised dynamic import
//      (D110) — this module is imported by the eager suggestions store,
//      so a static SDK import here would put Firestore back in the
//      first-paint graph. Nothing below runs at module scope.
//
// The write path is the callable and only the callable: App Check, the
// daily budget and the sold-inventory tripwire live server-side, and
// firestore.rules refuses direct writes so there is nothing to fall back
// to. A refusal is returned as `{ ok: false }` with the server's own
// message — the composer shows it verbatim, because the messages were
// written to be shown (suggestions.ts, functions/).

import { getFirestoreApi, getFunctionsApi, getDb, subscribeToAuth } from "../../lib/firebase";
import { FUNCTIONS_REGION } from "../../lib/region";

export interface MySuggestion {
  id: string;
  prompt: string;
  type: string;
  options: string[];
  topicHint: string | null;
  audienceHint: string | null;
  cadenceHint: string | null;
  status: "review" | "picked" | "declined";
  note: string | null;
  atMs: number | null;
}

export type SubmitResult = { ok: true; id: string } | { ok: false; code: string; message: string };

export interface SuggestionPayload {
  prompt: string;
  type: string;
  options: string[];
  topicHint?: string | null;
  audienceHint?: string | null;
  cadenceHint?: string | null;
  credit?: boolean;
}

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
      // A different account's rows must never render under this one.
      rows = null;
      notify();
    }
  });
}

// ── the session cache ───────────────────────────────────────────────────
let rows: MySuggestion[] | null = null;
let loading: Promise<MySuggestion[]> | null = null;
const listeners = new Set<() => void>();
function notify(): void {
  listeners.forEach((f) => f());
}

export function subscribeMine(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The cached rows, or null when nothing has loaded yet. Synchronous on
 * purpose: the store's render path reads this; loadMine() fills it. */
export function myRows(): MySuggestion[] | null {
  return rows;
}

function parseRow(id: string, d: Record<string, unknown>): MySuggestion {
  const status = d.status === "picked" || d.status === "declined" ? d.status : "review";
  const at = d.at as { toMillis?: () => number } | null | undefined;
  return {
    id,
    prompt: String(d.prompt ?? ""),
    type: String(d.type ?? "binary"),
    options: Array.isArray(d.options) ? d.options.map((o) => String(o)) : [],
    topicHint: d.topicHint ? String(d.topicHint) : null,
    audienceHint: d.audienceHint ? String(d.audienceHint) : null,
    cadenceHint: d.cadenceHint ? String(d.cadenceHint) : null,
    status,
    note: d.note ? String(d.note) : null,
    atMs: typeof at?.toMillis === "function" ? at.toMillis() : null,
  };
}

/** Load this account's suggestions — one bounded query, deduped while in
 * flight, newest first. The mine-only filter is not a nicety: the rules
 * grant reads as `uid == request.auth.uid`, so an unfiltered query is
 * refused wholesale (the D65 shape). */
export function loadMine(force = false): Promise<MySuggestion[]> {
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
        query(collection(db, "v2_suggestions"), where("uid", "==", uid)),
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

/** Submit through suggestQuestionV2. On success the row is appended to
 * the cache optimistically (status "review", stamped now) and a refresh
 * is kicked so the server's copy replaces it. */
export async function submitSuggestion(p: SuggestionPayload): Promise<SubmitResult> {
  wireAuth();
  try {
    const db = await getDb();
    const { getFunctions, httpsCallable } = await getFunctionsApi();
    const fns = getFunctions(db.app, FUNCTIONS_REGION);
    const res = await httpsCallable(fns, "suggestQuestionV2")(p);
    const id = (res.data as { id?: string } | null)?.id ?? "";
    rows = [
      {
        id,
        prompt: p.prompt,
        type: p.type,
        options: p.options,
        topicHint: p.topicHint ?? null,
        audienceHint: p.audienceHint ?? null,
        cadenceHint: p.cadenceHint ?? null,
        status: "review",
        note: null,
        atMs: Date.now(),
      },
      ...(rows ?? []),
    ];
    notify();
    void loadMine(true).catch(() => {});
    return { ok: true, id };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return {
      ok: false,
      code: String(err?.code ?? "unknown").replace(/^functions\//, ""),
      message: String(err?.message ?? "That didn't go through — try again."),
    };
  }
}

/** The purge hook (D51): a signed-out or wiped device must not render the
 * previous account's queue. */
export function clearSuggestionCache(): void {
  rows = null;
  notify();
}
