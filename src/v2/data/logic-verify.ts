// Client transport for the logic test on the OMIB bank (D57, D473, D475,
// D476, D477).
//
// One kind of attempt. The server is never told anything it could be lied
// to about: it mints the seed, keeps it, and hands out the items with the
// ninth cell empty — the client's only way to a score is sending its
// constructed cells back for server-side marking. There is no practice
// attempt (D477, the owner: the test is taken like an IQ test; the practice
// mode D474 put on the same screen lasted a day), so every start is the
// verified one, and the server's cooldown and daily start limit are the
// only answer to "again".
//
// Two shapes of form. A STRATIFIED one is two round trips: the start hands
// out all 25 items, the submit sends 25 cells back. An ADAPTIVE one (D476,
// dark behind the server's OMIB_SELECTION until the §6 report clears its
// bar) is a round trip per item: the start hands out the first item alone,
// each pick goes back through `nextVerified` and the next item comes out —
// or, on the twenty-fifth, the result. The start says which (`mode`), and
// the client never decides: a form is whatever the server serves.
//
// What leaves the device, exactly: a bare start call, and either one submit
// carrying twenty-five 20-character strings of 0 and 1 — one constructed
// cell per item — or twenty-five calls carrying one such cell each with its
// index. Per-item timings never leave the device — the server records only
// the attempt duration it observed itself.
//
// This module imports nothing from the bank: the client renders whatever
// codes it is served, through src/v2/data/omib-shapes.ts.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { getDb } from "../../lib/firebase";
import { FUNCTIONS_REGION } from "../../lib/region";

/** An item as served: nine comma-separated 20-bit cells, the ninth all zeros. */
export interface VerifiedItem {
  code: string;
}

/** How the form is served: whole at start, or one item per answer (D476). */
export type Selection = "stratified" | "adaptive";

export interface VerifiedStart {
  mode: Selection;
  /** the whole form (stratified) or its first item (adaptive) */
  items: VerifiedItem[];
  /** how many items the form has, whichever way they arrive */
  total: number;
  capMs: number;
  deadlineMs: number;
}

/** What an adaptive pick comes back with when the form is not finished: the next item. */
export interface NextItem {
  items: VerifiedItem[];
  /** how many picks the server now holds — the index the next pick must carry */
  index: number;
  total: number;
}

/** The score — what the server says the attempt was. */
export interface VerifiedScore {
  marks: boolean[];
  score: number;
  /** the ability estimate on the calibration sample's scale (D473) */
  theta: number;
  /** its standard error — the person's own likely range, not a constant */
  se: number;
  pctile: number;
  /** pctile at θ̂ ∓ se, ranked the same way the number was */
  band?: [number, number];
  /** "model": Φ(θ̂) against the calibration sample; "measured": a rank
   *  among `n` verified first attempts once the histogram clears the floor */
  source?: "model" | "measured";
  n?: number;
  /** server-observed attempt duration */
  durationMs?: number;
  /** disclosed only after scoring — reconstructs the form, never a key alone */
  seed: number;
  gv: number;
  bank: "omib";
  /** how the form was served — reconstructable from the seed alone, or from the seed and the picks */
  mode?: Selection;
  /** the published difficulty of each item in form order, disclosed after scoring */
  diffs: number[];
}

/** The result, once the twenty-fifth pick has been scored — distinguished from a next item by its marks. */
export const isScore = (x: NextItem | VerifiedScore): x is VerifiedScore => "marks" in x;

async function fns() {
  const db = await getDb();
  if (!getAuth(db.app).currentUser) throw new Error("still signing in — try again in a moment");
  return getFunctions(db.app, FUNCTIONS_REGION);
}

export async function startVerified(): Promise<VerifiedStart> {
  const res = await httpsCallable(await fns(), "logicStartV2")({});
  return res.data as VerifiedStart;
}

export async function submitVerified(picks: string[]): Promise<VerifiedScore> {
  const res = await httpsCallable(await fns(), "logicSubmitV2")({ picks });
  return res.data as VerifiedScore;
}

/** One pick of an adaptive attempt: the cell for item `index`, in for the next item or the result. */
export async function nextVerified(index: number, pick: string): Promise<NextItem | VerifiedScore> {
  const res = await httpsCallable(await fns(), "logicNextV2")({ index, pick });
  return res.data as NextItem | VerifiedScore;
}

// The failure modes worth distinguishing to a user, in their words. The
// server's failed-precondition messages (cooldown, rate limit) are written
// to be shown; everything else collapses to one honest line.
export function verifyErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code || "";
  if (code.includes("failed-precondition") && e?.message) return e.message;
  if (code.includes("deadline-exceeded")) return "the attempt ran out of time";
  if (code.includes("unauthenticated") || /signing in/.test(e?.message || "")) return "still signing in — try again in a moment";
  return "couldn't reach the server — nothing was counted";
}
