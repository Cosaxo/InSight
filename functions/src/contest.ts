// Arranged competition (D390 — the first axis built under its paper's
// requirements, research/axiom-theory/paper-08-arranged-competition.md).
//
// The design in one line: the system builds the encounter instead of
// observing one, and records every decision it made in building it.
//
// A CONTEST is two people, one domain, one sitting each on the SAME
// server-minted form, scored server-side the way the verified logic test
// is (D57 — the client is never the answer authority), settled when both
// have played or the window closes. The domain in this first build is the
// keyed logic instrument, because it is the one domain that yields a
// GRADED per-person score rather than only a win/loss — the paper's §4.1
// arithmetic says a graded score cuts the encounters a reading needs by
// roughly an order of magnitude — and because the solo verified test at
// fixed difficulty is exactly the "fixed-difficulty anchor contest" the
// paper's §3.1 needs to pin a comparison network to an absolute scale.
//
// The ASSIGNED arm only (§5's measurement arm): the matcher picks the
// opponent and the stake is drawn from a schedule the player did not
// choose. Stakes are POINTS — never money — which keeps "verified entrants
// for staked play" and every gambling regime out of scope; a chosen-stake,
// chosen-opponent arm (§4.4) is a later build, and every record carries
// its arm so the two are never pooled.
//
// What every contest records, and why (paper 8 §6, G1, G2, G7):
//   · the matcher's rule, the pool it drew from and the realised
//     probability of THIS pairing — the observation attempt's decision
//     and probability (G2's atom), without which the pairing propensity
//     cannot enter an estimator;
//   · whether the pairing was BLIND to the logic score (a uniform draw,
//     the exploration floor) or read it (a band draw) — G1's roles: a
//     coupling between contest performance and the logic score is
//     estimated on the blind share only;
//   · the stake level and points, drawn at offer time, before acceptance,
//     so the player cannot raise it after a loss (§4.4's forbidden move);
//   · offer, acceptance, decline and expiry per side — the offer is
//     randomized, acceptance is chosen, so the intention-to-treat on the
//     OFFER is what is identified (§6);
//   · both graded scores and durations, sealed from each other until
//     settlement (game timing, the duel discipline; not privacy).
//
// The answer key (the seed) lives in v2_contest_attempts, a collection
// nobody may read — the same deny v2_logic_attempts carries. The contest
// document discloses the seed only once scored, as the logic test does.

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { generateForm, version as GEN_VERSION, mulberry32 } from "./logic-gen";
import { LOGIC_ITEM_CAP_MS, validLogicPicks, type LogicClientItem } from "./logic";
import { db as firestore } from "./db";

const REGION = FUNCTIONS_REGION;

// ── administration constants ──
// Twelve items from the generated form (its first twelve, so the form a
// seed yields is the same one the solo test would show): 12 × 90 s plus one
// item of slack is under twenty minutes, which is a sitting a person will
// accept an offer for. The solo instrument's 25 stays the anchor.
export const CONTEST_ITEMS = 12;
export const CONTEST_ITEM_CAP_MS = LOGIC_ITEM_CAP_MS;
export const CONTEST_DEADLINE_MS = CONTEST_ITEMS * CONTEST_ITEM_CAP_MS + CONTEST_ITEM_CAP_MS;
// Both accepted → both play inside this window; a side that has not
// played when it closes forfeits (an outcome, recorded as one — §6's
// dropout discipline), and the other side's score stands.
export const CONTEST_WINDOW_MS = 24 * 3_600_000;
// An offer nobody answered expires; expiry is recorded, not deleted,
// because a declined or ignored offer is the offer arm's own datum.
export const OFFER_TTL_MS = 24 * 3_600_000;
// Two stake levels, points. The contrast between them is §4.1's stakes
// slope; the level is drawn per contest with equal probability.
export const STAKE_POINTS = [10, 50] as const;
export const START_POINTS = 500;
// §6: the bound is on CUMULATIVE exposure per person per window, not on
// the single contest — a ceiling per contest does not bound a loss
// trajectory. No offer is made to a player whose exposure inside the
// window would exceed the cap with the largest stake.
export const EXPOSURE_CAP_POINTS = 200;
export const EXPOSURE_WINDOW_MS = 7 * 86_400_000;
// The exploration floor: this share of pairings is drawn uniformly from
// the eligible pool, ignoring ratings. Those are the BLIND records for
// any coupling against the logic score (G1's roles), and they are also
// §6's mismatched-side budget in its first form — every contest records
// whether it was one, so the per-person budget can be read and, later,
// enforced.
export const BLIND_SHARE = 0.25;
// A band draw pairs within this many percentile points of the player's
// rating (the verified logic percentile, in this first build).
export const BAND = 20;
export const MAX_OFFERS_PER_SWEEP = 500;

// ── types ──
export type ContestStatus = "offered" | "declined" | "expired" | "open" | "scored";
export interface ContestMatch {
  rule: "band" | "blind" | "band-empty";
  /** how many candidates the rule could have drawn from */
  pool: number;
  band: number;
  /** the realised probability of THIS partner under the rule: 1 / pool */
  p: number;
  /** true where the draw did not read the logic score */
  blind: boolean;
}
export interface ContestStake { level: 0 | 1; points: number }
export interface ContestSide { acceptedAtMs?: number; declinedAtMs?: number; done?: boolean }
export type Outcome = "a" | "b" | "tie" | "forfeit-a" | "forfeit-b" | "none";
export interface ContestResult { outcome: Outcome; transfer: number; settledAtMs: number }
export interface ContestDoc {
  v: 1;
  domain: "logic";
  arm: "assigned";
  gv: number;
  items: number;
  a: string;
  b: string;
  aName: string;
  bName: string;
  stake: ContestStake;
  match: ContestMatch;
  /** G1's role for couplings against the logic score */
  role: "prior-informed" | "blind";
  status: ContestStatus;
  offeredAtMs: number;
  offerExpiresAtMs: number;
  sideA: ContestSide;
  sideB: ContestSide;
  openedAtMs?: number;
  windowEndsMs?: number;
  scoreA?: number;
  scoreB?: number;
  durationA?: number;
  durationB?: number;
  result?: ContestResult;
  /** disclosed only once scored — the answer key until then */
  seed?: number;
}
export interface AttemptSide {
  startedAtMs?: number;
  deadlineMs?: number;
  scoredAtMs?: number;
  score?: number;
  durationMs?: number;
}
export interface ContestAttemptDoc {
  cid: string;
  seed: number;
  gv: number;
  items: number;
  a: AttemptSide;
  b: AttemptSide;
}
export interface ExposureEntry { atMs: number; points: number }
export interface ContestSummary {
  optIn?: { v: number; atMs: number; offMs?: number };
  points: number;
  n: number;
  w: number;
  l: number;
  t: number;
  /** the verified logic percentile the matcher reads; null until verified */
  rating: number | null;
  openCid: string | null;
  exposure: ExposureEntry[];
}
export interface ContestPlayer {
  uid: string;
  name: string;
  summary: ContestSummary;
}

// ── pure decision logic (unit-tested without an emulator) ──

export const emptySummary = (rating: number | null = null): ContestSummary => ({
  points: START_POINTS, n: 0, w: 0, l: 0, t: 0, rating, openCid: null, exposure: [],
});

export function exposureWithin(exposure: ExposureEntry[] | undefined, nowMs: number): number {
  return (exposure || [])
    .filter((e) => e.atMs > nowMs - EXPOSURE_WINDOW_MS)
    .reduce((s, e) => s + e.points, 0);
}

/** Who may be offered a contest right now. */
export function isEligible(p: ContestPlayer, nowMs: number): boolean {
  const s = p.summary;
  return !!s.optIn && s.optIn.offMs == null
    && s.rating != null
    && !s.openCid
    && exposureWithin(s.exposure, nowMs) + Math.max(...STAKE_POINTS) <= EXPOSURE_CAP_POINTS;
}

export function drawStake(rng: () => number): ContestStake {
  const level: 0 | 1 = rng() < 0.5 ? 0 : 1;
  return { level, points: STAKE_POINTS[level] };
}

/**
 * The matcher. Walks the pool in a random order; for each unpaired player
 * decides blind (uniform over everyone left) or band (uniform within
 * ±BAND rating points), draws a partner, and records the rule, the pool it
 * drew from and 1/pool as the realised probability. A band with nobody in
 * it falls back to a uniform draw and says so (`band-empty`) — that draw
 * did not read the score either, so it is blind for the role, but it is
 * not the exploration floor's draw and the record keeps the two apart.
 */
export function pairPlayers(
  players: ContestPlayer[],
  rng: () => number,
  nowMs: number,
  max: number = MAX_OFFERS_PER_SWEEP,
): { pairs: Array<{ a: ContestPlayer; b: ContestPlayer; match: ContestMatch; stake: ContestStake }>; unpaired: ContestPlayer[] } {
  const pool = players.filter((p) => isEligible(p, nowMs));
  // Fisher–Yates with the seeded rng, so a test can replay a sweep.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const pairs: Array<{ a: ContestPlayer; b: ContestPlayer; match: ContestMatch; stake: ContestStake }> = [];
  const left = [...pool];
  while (left.length >= 2 && pairs.length < max) {
    const x = left.shift()!;
    const blindDraw = rng() < BLIND_SHARE;
    let rule: ContestMatch["rule"] = blindDraw ? "blind" : "band";
    let candidates = blindDraw
      ? left
      : left.filter((y) => Math.abs((y.summary.rating ?? 0) - (x.summary.rating ?? 0)) <= BAND);
    if (!blindDraw && candidates.length === 0) {
      rule = "band-empty";
      candidates = left;
    }
    const y = candidates[Math.floor(rng() * candidates.length)];
    left.splice(left.indexOf(y), 1);
    pairs.push({
      a: x,
      b: y,
      match: { rule, pool: candidates.length, band: BAND, p: 1 / candidates.length, blind: rule !== "band" },
      stake: drawStake(rng),
    });
  }
  return { pairs, unpaired: left };
}

export function newContest(
  a: ContestPlayer,
  b: ContestPlayer,
  match: ContestMatch,
  stake: ContestStake,
  nowMs: number,
): ContestDoc {
  return {
    v: 1,
    domain: "logic",
    arm: "assigned",
    gv: GEN_VERSION,
    items: CONTEST_ITEMS,
    a: a.uid,
    b: b.uid,
    aName: a.name,
    bName: b.name,
    stake,
    match,
    role: match.blind ? "blind" : "prior-informed",
    status: "offered",
    offeredAtMs: nowMs,
    offerExpiresAtMs: nowMs + OFFER_TTL_MS,
    sideA: {},
    sideB: {},
  };
}

export const sideOf = (c: ContestDoc, uid: string): "a" | "b" | null => (c.a === uid ? "a" : c.b === uid ? "b" : null);

export type Verdict<T> = { ok: true; value: T } | { ok: false; code: string; msg: string };

/** Accept or decline an offer. Both accepted opens the window. */
export function respond(c: ContestDoc, uid: string, accept: boolean, nowMs: number): Verdict<ContestDoc> {
  const side = sideOf(c, uid);
  if (!side) return { ok: false, code: "not-participant", msg: "not your contest" };
  if (c.status !== "offered") return { ok: false, code: "not-offered", msg: "this offer is no longer open" };
  if (nowMs > c.offerExpiresAtMs) return { ok: false, code: "expired", msg: "this offer has expired" };
  const key = side === "a" ? "sideA" : "sideB";
  if (c[key].acceptedAtMs != null || c[key].declinedAtMs != null) {
    return { ok: false, code: "answered", msg: "you already answered this offer" };
  }
  const next: ContestDoc = { ...c, [key]: { ...c[key], ...(accept ? { acceptedAtMs: nowMs } : { declinedAtMs: nowMs }) } };
  if (!accept) next.status = "declined";
  else if (next.sideA.acceptedAtMs != null && next.sideB.acceptedAtMs != null) {
    next.status = "open";
    next.openedAtMs = nowMs;
    next.windowEndsMs = nowMs + CONTEST_WINDOW_MS;
  }
  return { ok: true, value: next };
}

/** Open (or resume) a side's sitting. The deadline never passes the window's end. */
export function startSide(
  attempt: AttemptSide,
  nowMs: number,
  windowEndsMs: number,
): Verdict<{ side: AttemptSide; resumed: boolean }> {
  if (attempt.scoredAtMs != null) return { ok: false, code: "scored", msg: "you already played this contest" };
  if (nowMs > windowEndsMs) return { ok: false, code: "window-closed", msg: "the window for this contest has closed" };
  if (attempt.startedAtMs != null) {
    if (nowMs > (attempt.deadlineMs ?? 0)) return { ok: false, code: "deadline", msg: "your sitting has expired" };
    return { ok: true, value: { side: attempt, resumed: true } };
  }
  return {
    ok: true,
    value: {
      side: { startedAtMs: nowMs, deadlineMs: Math.min(nowMs + CONTEST_DEADLINE_MS, windowEndsMs) },
      resumed: false,
    },
  };
}

export function scoreContestPicks(seed: number, gv: number, picks: number[], items: number = CONTEST_ITEMS) {
  const form = generateForm(seed, gv).items.slice(0, items);
  const marks = form.map((item, i) => picks[i] === item.a);
  return { marks, score: marks.filter(Boolean).length };
}

export function contestClientItems(seed: number, gv: number, items: number = CONTEST_ITEMS): LogicClientItem[] {
  return generateForm(seed, gv).items.slice(0, items).map((it) => ({ cells: it.cells, opts: it.opts, diff: it.diff }));
}

/**
 * Whether a contest can be settled now, and how. Both scored → the higher
 * score wins, a tie transfers nothing. One scored and the window closed →
 * the other side forfeits the stake. Neither scored and the window closed
 * → nothing moves. The transfer is capped by the loser's balance, so a
 * stake is a stake and never a debt.
 */
export function settle(
  c: ContestDoc,
  att: ContestAttemptDoc,
  balances: { a: number; b: number },
  nowMs: number,
): ContestResult | null {
  const aDone = att.a.scoredAtMs != null;
  const bDone = att.b.scoredAtMs != null;
  const closed = c.windowEndsMs != null && nowMs > c.windowEndsMs;
  const cap = (loser: "a" | "b") => Math.max(0, Math.min(c.stake.points, balances[loser]));
  if (aDone && bDone) {
    const sa = att.a.score ?? 0;
    const sb = att.b.score ?? 0;
    if (sa === sb) return { outcome: "tie", transfer: 0, settledAtMs: nowMs };
    return sa > sb
      ? { outcome: "a", transfer: cap("b"), settledAtMs: nowMs }
      : { outcome: "b", transfer: cap("a"), settledAtMs: nowMs };
  }
  if (!closed) return null;
  if (aDone) return { outcome: "forfeit-b", transfer: cap("b"), settledAtMs: nowMs };
  if (bDone) return { outcome: "forfeit-a", transfer: cap("a"), settledAtMs: nowMs };
  return { outcome: "none", transfer: 0, settledAtMs: nowMs };
}

export const winnerOf = (r: ContestResult): "a" | "b" | null =>
  r.outcome === "a" || r.outcome === "forfeit-b" ? "a" : r.outcome === "b" || r.outcome === "forfeit-a" ? "b" : null;

/** Fold a settled contest into both players' summaries. */
export function applyResult(
  sumA: ContestSummary,
  sumB: ContestSummary,
  r: ContestResult,
): { a: ContestSummary; b: ContestSummary } {
  const w = winnerOf(r);
  const played = r.outcome !== "none";
  const next = (s: ContestSummary, me: "a" | "b"): ContestSummary => ({
    ...s,
    points: s.points + (w === null ? 0 : w === me ? r.transfer : -r.transfer),
    n: s.n + (played ? 1 : 0),
    w: s.w + (w === me ? 1 : 0),
    l: s.l + (w !== null && w !== me ? 1 : 0),
    t: s.t + (r.outcome === "tie" ? 1 : 0),
    openCid: null,
  });
  return { a: next(sumA, "a"), b: next(sumB, "b") };
}

/** Exposure is booked when the window opens: that is when the stake is at risk. */
export function bookExposure(s: ContestSummary, stake: ContestStake, cid: string, nowMs: number): ContestSummary {
  return {
    ...s,
    openCid: cid,
    exposure: [...(s.exposure || []).filter((e) => e.atMs > nowMs - EXPOSURE_WINDOW_MS), { atMs: nowMs, points: stake.points }],
  };
}

/** The outcome as one side saw it, for the per-user index. */
export function outcomeFor(r: ContestResult, me: "a" | "b"): "win" | "loss" | "tie" | "forfeited" | "walkover" | "none" {
  if (r.outcome === "tie") return "tie";
  if (r.outcome === "none") return "none";
  if (r.outcome === `forfeit-${me}`) return "forfeited";
  if (r.outcome.startsWith("forfeit")) return "walkover";
  return r.outcome === me ? "win" : "loss";
}

// ── the first reading: the stakes contrast, per person (paper 8 §4.1) ──
// A person's mean score at the high stake minus at the low, with the
// standard error the two samples support. Null until each level has two
// contests, because a contrast on one draw per level is a coin. This is
// the pure fold; publication is a later record.
export interface StakeRecord { level: 0 | 1; score: number; items: number }
export function stakesContrast(records: StakeRecord[]): { low: { n: number; mean: number }; high: { n: number; mean: number }; contrast: number; se: number } | null {
  const by = (lvl: 0 | 1) => records.filter((r) => r.level === lvl).map((r) => r.score / r.items);
  const lo = by(0);
  const hi = by(1);
  if (lo.length < 2 || hi.length < 2) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const varOf = (xs: number[]) => {
    const m = mean(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  };
  return {
    low: { n: lo.length, mean: mean(lo) },
    high: { n: hi.length, mean: mean(hi) },
    contrast: mean(hi) - mean(lo),
    se: Math.sqrt(varOf(hi) / hi.length + varOf(lo) / lo.length),
  };
}

// ── Firestore glue ──

const contestRef = (db: Firestore, cid: string) => db.collection("v2_contests").doc(cid);
const attemptRef = (db: Firestore, cid: string) => db.collection("v2_contest_attempts").doc(cid);
const userRef = (db: Firestore, uid: string) => db.collection("v2_users").doc(uid);
const indexRef = (db: Firestore, uid: string, cid: string) => userRef(db, uid).collection("contests").doc(cid);

function summaryOf(user: FirebaseFirestore.DocumentData | undefined): ContestSummary {
  const s = (user?.contest as Partial<ContestSummary> | undefined) || {};
  const rating = typeof user?.testResults?.logic?.pctile === "number" ? (user.testResults.logic.pctile as number) : null;
  return { ...emptySummary(rating), ...s, rating: rating ?? s.rating ?? null };
}

/** The per-user index row: what this person's client lists, no seed, no opponent's score before settlement. */
function indexRow(c: ContestDoc, me: "a" | "b", cid: string) {
  const mine = me === "a" ? c.sideA : c.sideB;
  return {
    cid,
    status: c.status,
    opponent: me === "a" ? c.b : c.a,
    opponentName: me === "a" ? c.bName : c.aName,
    stake: c.stake,
    offeredAtMs: c.offeredAtMs,
    offerExpiresAtMs: c.offerExpiresAtMs,
    windowEndsMs: c.windowEndsMs ?? null,
    mine,
    opponentDone: (me === "a" ? c.sideB : c.sideA).done === true,
    result: c.result ? { outcome: outcomeFor(c.result, me), transfer: c.result.transfer, settledAtMs: c.result.settledAtMs } : null,
    myScore: c.status === "scored" ? (me === "a" ? c.scoreA ?? null : c.scoreB ?? null) : null,
    theirScore: c.status === "scored" ? (me === "a" ? c.scoreB ?? null : c.scoreA ?? null) : null,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// A transaction and a batch both `set`, but their overloads are not one
// callable union in the SDK's types; a tiny adapter keeps one writer for
// both paths rather than two copies of the index write.
type Writer = { set(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData, opts: { merge: true }): unknown };
function writeIndex(w: Writer, db: Firestore, cid: string, c: ContestDoc) {
  w.set(indexRef(db, c.a, cid), indexRow(c, "a", cid), { merge: true });
  w.set(indexRef(db, c.b, cid), indexRow(c, "b", cid), { merge: true });
}

/** Settle inside a transaction that has already read everything it writes. */
function settleInTx(
  tx: Transaction,
  db: Firestore,
  cid: string,
  c: ContestDoc,
  att: ContestAttemptDoc,
  sums: { a: ContestSummary; b: ContestSummary },
  nowMs: number,
): ContestDoc | null {
  const r = settle(c, att, { a: sums.a.points, b: sums.b.points }, nowMs);
  if (!r) return null;
  const next: ContestDoc = {
    ...c,
    status: "scored",
    result: r,
    seed: att.seed,
    scoreA: att.a.score ?? null as unknown as number,
    scoreB: att.b.score ?? null as unknown as number,
    durationA: att.a.durationMs ?? null as unknown as number,
    durationB: att.b.durationMs ?? null as unknown as number,
    sideA: { ...c.sideA, done: att.a.scoredAtMs != null },
    sideB: { ...c.sideB, done: att.b.scoredAtMs != null },
  };
  const folded = applyResult(sums.a, sums.b, r);
  tx.set(contestRef(db, cid), next);
  tx.set(userRef(db, c.a), { contest: folded.a }, { merge: true });
  tx.set(userRef(db, c.b), { contest: folded.b }, { merge: true });
  writeIndex(tx, db, cid, next);
  return next;
}

// ── the callables ──

/**
 * Consent to compete at randomized points stakes — specific, and separate
 * from everything else the account has agreed to (paper 8 §6). The server
 * writes it so the whole `contest` map stays server-owned; withdrawing
 * keeps the record (offMs) rather than erasing it, because "consented from
 * X to Y" is what an offer made at Z is checked against.
 */
export const contestOptInV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const on = (request.data as { on?: unknown } | null)?.on === true;
    const now = Date.now();
    const db = firestore();
    const out = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef(db, uid));
      const s = summaryOf(snap.data());
      const optIn = on
        ? { v: 1, atMs: s.optIn?.offMs == null && s.optIn ? s.optIn.atMs : now }
        : { v: 1, atMs: s.optIn?.atMs ?? now, offMs: now };
      const next: ContestSummary = { ...s, optIn };
      tx.set(userRef(db, uid), { contest: next }, { merge: true });
      return next;
    });
    logger.info(`[contestOptInV2] uid=${uid} on=${on}`);
    return { optIn: out.optIn, points: out.points, rating: out.rating, eligible: isEligible({ uid, name: "", summary: out }, now) };
  },
);

export const contestRespondV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const data = (request.data as { cid?: unknown; accept?: unknown } | null) || {};
    const cid = typeof data.cid === "string" ? data.cid : "";
    if (!cid) throw new HttpsError("invalid-argument", "cid required");
    const accept = data.accept === true;
    const now = Date.now();
    const db = firestore();
    const out = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(contestRef(db, cid));
      if (!snap.exists) throw new HttpsError("not-found", "no such contest");
      const c = snap.data() as ContestDoc;
      const v = respond(c, uid, accept, now);
      if (!v.ok) throw new HttpsError("failed-precondition", v.msg, { code: v.code });
      const next = v.value;
      if (next.status === "open") {
        // Both accepted: book the stake as exposure on both sides and mark
        // both as in a contest, so neither is offered another until this
        // one settles.
        const [ua, ub] = await Promise.all([tx.get(userRef(db, c.a)), tx.get(userRef(db, c.b))]);
        const sa = bookExposure(summaryOf(ua.data()), c.stake, cid, now);
        const sb = bookExposure(summaryOf(ub.data()), c.stake, cid, now);
        tx.set(userRef(db, c.a), { contest: sa }, { merge: true });
        tx.set(userRef(db, c.b), { contest: sb }, { merge: true });
      }
      tx.set(contestRef(db, cid), next);
      writeIndex(tx, db, cid, next);
      return next;
    });
    logger.info(`[contestRespondV2] uid=${uid} cid=${cid} accept=${accept} status=${out.status}`);
    return { status: out.status, windowEndsMs: out.windowEndsMs ?? null };
  },
);

export const contestStartV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const cid = (request.data as { cid?: unknown } | null)?.cid;
    if (typeof cid !== "string" || !cid) throw new HttpsError("invalid-argument", "cid required");
    const now = Date.now();
    const db = firestore();
    const out = await db.runTransaction(async (tx: Transaction) => {
      const [cs, as] = await Promise.all([tx.get(contestRef(db, cid)), tx.get(attemptRef(db, cid))]);
      if (!cs.exists || !as.exists) throw new HttpsError("not-found", "no such contest");
      const c = cs.data() as ContestDoc;
      const att = as.data() as ContestAttemptDoc;
      const side = sideOf(c, uid);
      if (!side) throw new HttpsError("permission-denied", "not your contest");
      if (c.status !== "open") throw new HttpsError("failed-precondition", "this contest is not open", { code: "not-open" });
      const v = startSide(att[side], now, c.windowEndsMs ?? 0);
      if (!v.ok) throw new HttpsError("failed-precondition", v.msg, { code: v.code });
      if (!v.value.resumed) tx.set(attemptRef(db, cid), { [side]: v.value.side }, { merge: true });
      return { att, side: v.value.side, resumed: v.value.resumed };
    });
    logger.info(`[contestStartV2] uid=${uid} cid=${cid} resumed=${out.resumed}`);
    return {
      items: contestClientItems(out.att.seed, out.att.gv, out.att.items),
      capMs: CONTEST_ITEM_CAP_MS,
      deadlineMs: out.side.deadlineMs,
      resumed: out.resumed,
    };
  },
);

export const contestSubmitV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const data = (request.data as { cid?: unknown; picks?: unknown } | null) || {};
    const cid = typeof data.cid === "string" ? data.cid : "";
    if (!cid) throw new HttpsError("invalid-argument", "cid required");
    const now = Date.now();
    const db = firestore();
    const out = await db.runTransaction(async (tx: Transaction) => {
      const [cs, as] = await Promise.all([tx.get(contestRef(db, cid)), tx.get(attemptRef(db, cid))]);
      if (!cs.exists || !as.exists) throw new HttpsError("not-found", "no such contest");
      const c = cs.data() as ContestDoc;
      const att = as.data() as ContestAttemptDoc;
      const side = sideOf(c, uid);
      if (!side) throw new HttpsError("permission-denied", "not your contest");
      if (c.status !== "open") throw new HttpsError("failed-precondition", "this contest is not open", { code: "not-open" });
      const mine = att[side];
      if (mine.startedAtMs == null) throw new HttpsError("failed-precondition", "start the contest first", { code: "not-started" });
      if (mine.scoredAtMs != null) throw new HttpsError("failed-precondition", "already scored", { code: "scored" });
      if (now > (mine.deadlineMs ?? 0)) throw new HttpsError("deadline-exceeded", "your sitting has expired");
      if (!validLogicPicks(data.picks, att.items)) {
        throw new HttpsError("invalid-argument", `picks must be ${att.items} integers in -1..5`);
      }
      const { marks, score } = scoreContestPicks(att.seed, att.gv, data.picks, att.items);
      const scored: AttemptSide = { ...mine, scoredAtMs: now, score, durationMs: now - mine.startedAtMs };
      const nextAtt: ContestAttemptDoc = { ...att, [side]: scored };
      // Everything a settlement writes is read here, before any write.
      const [ua, ub] = await Promise.all([tx.get(userRef(db, c.a)), tx.get(userRef(db, c.b))]);
      const sums = { a: summaryOf(ua.data()), b: summaryOf(ub.data()) };
      tx.set(attemptRef(db, cid), { [side]: scored }, { merge: true });
      const settled = settleInTx(tx, db, cid, c, nextAtt, sums, now);
      if (!settled) {
        const next: ContestDoc = { ...c, [side === "a" ? "sideA" : "sideB"]: { ...(side === "a" ? c.sideA : c.sideB), done: true } };
        tx.set(contestRef(db, cid), next);
        writeIndex(tx, db, cid, next);
      }
      return { marks, score, settled: settled != null, result: settled?.result ?? null };
    });
    logger.info(`[contestSubmitV2] uid=${uid} cid=${cid} score=${out.score} settled=${out.settled}`);
    return out;
  },
);

// ── the sweep: expire, settle, offer ──

export async function runContestSweep(db: Firestore, nowMs: number = Date.now(), rng: () => number = mulberry32(randomBytes(4).readUInt32BE(0))) {
  const summary = { expired: 0, settled: 0, offered: 0, eligible: 0 };

  // 1. offers past their TTL, and open contests past their window
  const stale = await db.collection("v2_contests").where("status", "in", ["offered", "open"]).limit(2000).get();
  for (const d of stale.docs) {
    const c = d.data() as ContestDoc;
    if (c.status === "offered" && nowMs > c.offerExpiresAtMs) {
      const next: ContestDoc = { ...c, status: "expired" };
      const batch = db.batch();
      batch.set(d.ref, next);
      writeIndex(batch, db, d.id, next);
      await batch.commit();
      summary.expired += 1;
    } else if (c.status === "open" && c.windowEndsMs != null && nowMs > c.windowEndsMs) {
      await db.runTransaction(async (tx: Transaction) => {
        const [cs, as, ua, ub] = await Promise.all([tx.get(d.ref), tx.get(attemptRef(db, d.id)), tx.get(userRef(db, c.a)), tx.get(userRef(db, c.b))]);
        const cur = cs.data() as ContestDoc;
        if (cur.status !== "open") return;
        const att = as.data() as ContestAttemptDoc;
        if (settleInTx(tx, db, d.id, cur, att, { a: summaryOf(ua.data()), b: summaryOf(ub.data()) }, nowMs)) summary.settled += 1;
      });
    }
  }

  // 2. new offers to everyone opted in and eligible
  const opted = await db.collection("v2_users").where("contest.optIn.v", "==", 1).limit(5000).get();
  const players: ContestPlayer[] = opted.docs.map((u) => ({
    uid: u.id,
    name: (u.get("displayName") as string) || "",
    summary: summaryOf(u.data()),
  }));
  const { pairs } = pairPlayers(players, rng, nowMs);
  summary.eligible = players.filter((p) => isEligible(p, nowMs)).length;
  let batch = db.batch();
  let inBatch = 0;
  for (const { a, b, match, stake } of pairs) {
    const cid = db.collection("v2_contests").doc().id;
    const c = newContest(a, b, match, stake, nowMs);
    const seed = randomBytes(4).readUInt32BE(0);
    batch.set(contestRef(db, cid), c);
    batch.set(attemptRef(db, cid), { cid, seed, gv: GEN_VERSION, items: CONTEST_ITEMS, a: {}, b: {} } as ContestAttemptDoc);
    writeIndex(batch, db, cid, c);
    inBatch += 4;
    summary.offered += 1;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch) await batch.commit();
  return summary;
}

export const contestSweepV2 = onSchedule(
  // Daily, mid-morning UTC, so an offer lands in a European day and its
  // 24-hour window closes before the next sweep. Cost: one query over the
  // opted-in profiles and four writes per offer.
  { schedule: "5 9 * * *", region: REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const s = await runContestSweep(firestore());
    logger.info(`[contestSweepV2] expired=${s.expired} settled=${s.settled} eligible=${s.eligible} offered=${s.offered}`);
  },
);
