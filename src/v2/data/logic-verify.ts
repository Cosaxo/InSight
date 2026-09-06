// Client transport for verified logic attempts (D57).
//
// A verified attempt inverts the practice flow's trust: the server mints
// the seed, keeps it, and returns puzzles with the answer index withheld —
// the client's only way to a score is submitting raw picks back for
// server-side marking. This module is that round trip and nothing else;
// the overlay imports it directly (the D53 pattern — no window global, and
// window.LIVE's pinned member surface stays untouched).
//
// What leaves the device, exactly: the start call (bare, authenticated),
// and the submit call carrying one pick index per item — 25 of them for a
// generated form since D61, and this line said "twelve" long after that,
// which is the v1/v2 count. Phrased against the form rather than as a
// number, because `logic-gen.ts` owns it. The server stores the
// scored result on the owner-only profile doc and folds the first scored
// attempt per account into an anonymous score histogram. Per-item timings
// never leave the device — the server records only the attempt duration it
// observed itself.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { getDb } from "../../lib/firebase";
import type { Cell } from "./logic-gen";
import { FUNCTIONS_REGION } from "../../lib/region";

export interface VerifiedItem {
  cells: Cell[];
  opts: Cell[];
  diff: number;
}

export interface VerifiedStart {
  items: VerifiedItem[];
  capMs: number;
  deadlineMs: number;
}

export interface VerifiedScore {
  marks: boolean[];
  score: number;
  pctile: number;
  /** the likely range round pctile — the score ± one standard error,
   *  ranked the same way the score was (D402) */
  band?: [number, number];
  /** what the percentile IS: the modelled curve, or a measured rank among
   *  `n` verified first attempts once the histogram clears the D60 floor */
  source?: "model" | "measured";
  n?: number;
  durationMs: number;
  /** disclosed only after scoring — no longer an answer key (D57) */
  seed: number;
  gv: number;
}

export async function startVerified(): Promise<VerifiedStart> {
  const db = await getDb();
  if (!getAuth(db.app).currentUser) throw new Error("still signing in — try again in a moment");
  const res = await httpsCallable(getFunctions(db.app, FUNCTIONS_REGION), "logicStartV2")({});
  return res.data as VerifiedStart;
}

export async function submitVerified(picks: number[]): Promise<VerifiedScore> {
  const db = await getDb();
  const res = await httpsCallable(getFunctions(db.app, FUNCTIONS_REGION), "logicSubmitV2")({ picks });
  return res.data as VerifiedScore;
}

// The failure modes worth distinguishing to a user, in their words. The
// server's failed-precondition messages (cooldown, rate limit) are written
// to be shown; everything else collapses to one honest line.
export function verifyErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code || "";
  if (code.includes("failed-precondition") && e?.message) return e.message;
  if (code.includes("deadline-exceeded")) return "the attempt ran out of time";
  if (code.includes("unauthenticated")) return "still signing in — try again in a moment";
  return "couldn't reach the server — nothing was counted";
}
