// Client transport for arranged contests (D390 — paper 8's assigned arm,
// logic domain, points stakes).
//
// The same trust shape as the verified logic test (logic-verify.ts): the
// server mints the seed, keeps it, and returns twelve puzzles with the
// answer index withheld; the client's only way to a score is submitting
// raw picks back for server-side marking. What this module adds is the
// offer loop around one sitting — consent, the offer's answer, start,
// submit — and a reader for the per-person index the server maintains at
// v2_users/{me}/contests, which is the only thing a client lists (the
// contest documents themselves are read by id once settled, and are
// public then).
//
// No surface imports this yet: the offer card, the sitting and the result
// are a visual request (docs/VISUAL-REQUESTS.md § 2) and are drawn after
// the design, not before. The transport is here so that build is wiring.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb } from "../../lib/firebase";
import type { Cell } from "./logic-gen";
import { FUNCTIONS_REGION } from "../../lib/region";

export interface ContestItem {
  cells: Cell[];
  opts: Cell[];
  diff: number;
}

export interface ContestStake { level: 0 | 1; points: number }

export type ContestStatus = "offered" | "declined" | "expired" | "open" | "scored";

/** One row of v2_users/{me}/contests — what the client lists. */
export interface ContestRow {
  cid: string;
  status: ContestStatus;
  opponent: string;
  opponentName: string;
  stake: ContestStake;
  offeredAtMs: number;
  offerExpiresAtMs: number;
  windowEndsMs: number | null;
  mine: { acceptedAtMs?: number; declinedAtMs?: number; done?: boolean };
  opponentDone: boolean;
  result: { outcome: "win" | "loss" | "tie" | "forfeited" | "walkover" | "none"; transfer: number; settledAtMs: number } | null;
  myScore: number | null;
  theirScore: number | null;
}

export interface ContestStart {
  items: ContestItem[];
  capMs: number;
  deadlineMs: number;
  resumed: boolean;
}

export interface ContestSubmit {
  marks: boolean[];
  score: number;
  settled: boolean;
  result: { outcome: string; transfer: number; settledAtMs: number } | null;
}

async function call<T>(name: string, data: unknown): Promise<T> {
  const db = await getDb();
  if (!getAuth(db.app).currentUser) throw new Error("still signing in — try again in a moment");
  const res = await httpsCallable(getFunctions(db.app, FUNCTIONS_REGION), name)(data);
  return res.data as T;
}

/** The specific consent: to be offered contests at randomized points stakes. */
export const setContestOptIn = (on: boolean) =>
  call<{ optIn: { v: number; atMs: number; offMs?: number }; points: number; rating: number | null; eligible: boolean }>("contestOptInV2", { on });

export const respondToContest = (cid: string, accept: boolean) =>
  call<{ status: ContestStatus; windowEndsMs: number | null }>("contestRespondV2", { cid, accept });

export const startContest = (cid: string) => call<ContestStart>("contestStartV2", { cid });

export const submitContest = (cid: string, picks: number[]) => call<ContestSubmit>("contestSubmitV2", { cid, picks });

/** The signed-in person's contest rows, newest offer first. One bounded read. */
export async function fetchMyContests(max = 20): Promise<ContestRow[]> {
  const db = await getDb();
  const me = getAuth(db.app).currentUser;
  if (!me) return [];
  const q = query(collection(db, "v2_users", me.uid, "contests"), orderBy("offeredAtMs", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ContestRow);
}

/** A settled contest, by id — public once scored (D98), the two sides' own while open. */
export async function fetchContest(cid: string): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const snap = await getDoc(doc(db, "v2_contests", cid));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}
