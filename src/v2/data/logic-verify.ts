// Client transport for logic attempts on the OMIB bank (D57, D471, D473).
//
// Two round trips, one shape. A VERIFIED attempt inverts the practice flow's
// trust: the server mints the seed, keeps it, and returns the 25 items as
// construction codes with the ninth cell empty — the client's only way to a
// score is submitting its constructed cells back for server-side marking.
// A PRACTICE attempt (D472, the owner's "use the same screen for practice")
// is the same screen against the same bank, but stateless: the server mints
// a seed and hands it back with the items, the client returns it with the
// cells, and the server scores that seed's form and holds nothing — no
// attempt document, no cooldown, no fold. The one bank cannot be scored on a
// device, because the device never has the key (build-omib.test.mjs holds
// src/ to never naming it), so practice sends its picks too now; the
// result-screen copy says so.
//
// What leaves the device, exactly: a bare start call, and a submit carrying
// twenty-five 20-character strings of 0 and 1 — one constructed cell per
// item. Per-item timings never leave the device — the server records only
// the attempt duration it observed itself (verified) or nothing (practice).
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

export interface VerifiedStart {
  items: VerifiedItem[];
  capMs: number;
  deadlineMs: number;
}

export interface PracticeStart {
  /** the seed the form was drawn from — returned with the picks, held nowhere */
  seed: number;
  items: VerifiedItem[];
  capMs: number;
}

/** One score shape for both modes — what the server says the attempt was. */
export interface VerifiedScore {
  marks: boolean[];
  score: number;
  /** the ability estimate on the calibration sample's scale (D471) */
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
  /** server-observed attempt duration — verified only */
  durationMs?: number;
  /** disclosed only after scoring — reconstructs the form, never a key alone */
  seed: number;
  gv: number;
  bank: "omib";
  /** the published difficulty of each item in form order, disclosed after scoring */
  diffs: number[];
  practice?: true;
}

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

export async function startPractice(): Promise<PracticeStart> {
  const res = await httpsCallable(await fns(), "logicPracticeV2")({});
  return res.data as PracticeStart;
}

export async function submitPractice(seed: number, picks: string[]): Promise<VerifiedScore> {
  const res = await httpsCallable(await fns(), "logicPracticeV2")({ seed, picks });
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
  if (code.includes("unauthenticated") || /signing in/.test(e?.message || "")) return "still signing in — try again in a moment";
  return "couldn't reach the server — nothing was counted";
}
