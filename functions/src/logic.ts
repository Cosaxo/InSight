// Verified logic attempts (D57 — the recorded reversal of D31's
// device-local deferral).
//
// The design in one line: the client is never the answer authority.
//
//   logicStartV2    mints the seed SERVER-side, stores it in a per-uid
//                   attempt doc clients cannot read, and returns the
//                   puzzles with the answer index — and the seed —
//                   withheld. Given only cells and options, the sole way
//                   to find the answer is to solve the puzzle, which is
//                   the thing being tested. (Recovering the seed from the
//                   puzzle content means brute-forcing 2^32 generations
//                   inside the attempt deadline — the deadline is what
//                   makes that not a plan.)
//   logicSubmitV2   takes raw pick indexes, regenerates the form from the
//                   stored {seed, gv}, scores inside the deadline, writes
//                   the canonical result to testResults.logic (a key the
//                   rules refuse to let clients mutate — the fcmTokens
//                   pattern), and folds the FIRST scored attempt per
//                   account — provided it took the time a sitting takes
//                   (D402's effort floor) — into a score histogram,
//                   published exactly and on every attempt — the same
//                   discipline as the question aggregates, which since
//                   D98 means no floor and no cadence.
//
// What this deliberately does NOT try to do: stop a solver from asking a
// person or a model for help. Unproctored testing cannot prevent
// solve-by-proxy; the per-item cap (enforced in aggregate by the attempt
// deadline) bounds it, and the honest claim is "verified" — scored by the
// server on a form the client could not have seen in advance — not
// "proctored".
//
// The generator import is the byte-identical synced copy of
// src/v2/data/logic-gen.ts — see its header and scripts/check-logic-sync.mjs.

import { type Transaction } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { utcDayKeyOf } from "./pure";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";
import { generateForm, version as GEN_VERSION, type Cell } from "./logic-gen";
import {
  OMIB_FORM_ITEMS, OMIB_BANK_VERSION, OMIB_ERA, omibClientItems, validOmibPicks, validOmibCell,
  omibNextItem, replayAdaptive, scoreOmib,
  foldThetaNorms, foldItemStats, measuredPctileTheta, modelPctileTheta, isOmibEra,
  type Norms, type OmibClientItem, type OmibItem, type OmibScore, type OmibSelection,
} from "./omib";
import { db as firestore } from "./db";

const REGION = FUNCTIONS_REGION;

// ── administration constants ──
// The per-item cap mirrors the overlay's ITEM_CAP (90s, D56); the server
// enforces the TOTAL: items × cap + slack for network and render. Slack is
// one extra item's worth — generous, because a refusal here surfaces to an
// honest finisher as a swallowed attempt.
export const LOGIC_ITEMS = 25;
export const LOGIC_ITEM_CAP_MS = 90_000;
export const LOGIC_DEADLINE_MS = LOGIC_ITEMS * LOGIC_ITEM_CAP_MS + LOGIC_ITEM_CAP_MS;

// Items per generator era: an attempt opened before a form-length change
// and submitted after it must be validated and scored against ITS form,
// not the current one (D61) — the deadline bounds that window to minutes,
// but a refusal there would swallow an honest finisher's attempt.
export function logicItemsFor(gv: number): number {
  return gv >= 3 ? 25 : 12;
}
// Starting an attempt previews a fresh form, so unfinished restarts
// are a preview channel — bounded per UTC day rather than closed, because
// a crashed app must be able to start again.
export const LOGIC_MAX_STARTS_PER_DAY = 3;
// One verified score is THE score for a while: re-verification opens after
// this many days. (First scored attempt feeds the norms histogram either
// way — the D32 "first attempt counts" rule, for the same reason: retakes
// measure practice, not the population.)
export const LOGIC_REVERIFY_DAYS = 30;
// An attempt finished faster than this per item is scored but never
// COUNTED (D402): twenty-five matrices cannot be read, let alone solved,
// in under two seconds each, so such an attempt is a click-through — and
// a click-through folded into the norms is a phantom low scorer lifting
// every later percentile. The account's flag stays unset, so its next
// verified attempt is still its first counted one.
export const LOGIC_MIN_MS_PER_ITEM = 2_000;
// The likely range round a score, in items: one standard error of
// measurement. Spearman–Brown puts a 25-item form's reliability near 0.87,
// which with the modelled raw-score spread is ≈ 1.8 items, rounded up. The
// client (src/v2/data/logic-score.ts) carries the same constant and the
// same arithmetic for practice results, pinned equal in both suites.
export const LOGIC_SEM_ITEMS = 2;

// ── which bank a NEW attempt is minted on (D473, docs/OMIB-PLAN.md §8) ──
// "generator" is D31's procedural bank scored by count; "omib" is the Open
// Matrices Item Bank scored by θ. The bank is a property of the ATTEMPT,
// stamped at start and honoured at submit whatever this constant says by
// then — so an attempt straddling the flip scores on the bank it was
// minted on, and both paths are testable without touching this line.
// Phase 1 shipped the OMIB path DARK on "generator", because the overlay of
// the day sent six-way indexes and would have rendered nothing on a code.
// Phase 2 (D475) is the screen that answers a code, and flips this with it —
// the same PR, so no deployed tree ever serves codes to a client that cannot
// draw them. (The practice callable that stood below until D477 was
// OMIB-only regardless; the owner retired practice the day it shipped.)
export type LogicBank = "generator" | "omib";
export const LOGIC_BANK = "omib" as LogicBank;

// ── how a NEW OMIB attempt picks its items (D476, docs/OMIB-PLAN.md §3.3) ──
// "stratified" mints the whole form at start from the seed, scored at one
// submit; "adaptive" serves one item at a time, each chosen for the taker's
// current θ̂, through logicNextV2. Like the bank, the selection is a
// property of the ATTEMPT — stamped at start, honoured to the end — so a
// flip mid-attempt changes nothing for the person holding a form.
//
// DARK ON PURPOSE, and not for want of a screen: the client walks the
// adaptive path already, logic-submit.test.ts proves the callable through
// the fake transaction, and the emulator's verified leg walks whichever
// selection a start declares — so a flip is proved there before it
// deploys. What the flip waits on is the §6 report: it reads per-item
// solve rates off the stratified ledger to say whether the bank's published
// difficulties hold for this app's takers, and adaptive administration
// meets every item near its taker's 50 % point, which makes those rates say
// nothing about b. So the stratified era has to run long enough to answer
// the question first — hundreds of counted attempts — and the flip is the
// owner's, on the r figure, recorded when it happens (OWNER-LIST.md).
export const OMIB_SELECTION = "stratified" as OmibSelection;

// The percentile curves, byte-for-byte the client's logicPctileFor
// (src/v2/data/logic-score.ts) — one per form length, landmarks asserted
// equal in logic.test.ts so the copies cannot drift apart silently. The
// 12-item parameters are D53's; the 25-item parameters are D61's
// re-derivation for the tail-heavy ramp. Both are only the bootstrap
// below the D60 measured floor.
const CURVES: Record<number, { mid: number; slope: number }> = {
  12: { mid: 62, slope: 14 },
  25: { mid: 54, slope: 12 },
};
export const logicPctileFor = (frac: number, items: number): number => {
  // Unknown lengths fall back by era: anything shorter than the v3 form
  // is legacy 12-item-era material (v1 back-fills reach here with the odd
  // truncated payload), and only 25+ means the tail-heavy ramp.
  const c = CURVES[items] || (items >= 25 ? CURVES[25] : CURVES[12]);
  return Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-((frac * 100) - c.mid) / c.slope)))));
};
export const logicPctile = (frac: number): number => logicPctileFor(frac, 12);


// ── the attempt doc (v2_logic_attempts/{uid} — one per account) ──
export interface LogicAttempt {
  seed: number;
  /** generator version, or OMIB_BANK_VERSION when `bank` is "omib" */
  gv: number;
  /** absent on documents from before D473 — those are the generator's */
  bank?: LogicBank;
  /** OMIB only; absent before D476 = stratified */
  mode?: OmibSelection;
  /** adaptive only: the cells committed so far, in the order served — the
   *  form is replayed from these and the seed, so nothing else is held */
  picks?: string[];
  status: "open" | "scored";
  startedAtMs: number;
  deadlineMs: number;
  /** UTC day the start counter refers to */
  dayKey: string;
  startsToday: number;
  /** true once ANY attempt by this account has fed the norms histogram */
  normsCounted?: boolean;
  scoredAtMs?: number;
  score?: number;
  durationMs?: number;
}

// ── pure decision logic (unit-tested without an emulator) ──

export type StartVerdict = { ok: true } | { ok: false; code: string; msg: string };

export function canStartLogic(prev: LogicAttempt | null, nowMs: number): StartVerdict {
  if (prev) {
    if (
      prev.status === "scored"
      && prev.scoredAtMs != null
      && nowMs - prev.scoredAtMs < LOGIC_REVERIFY_DAYS * 86_400_000
    ) {
      return { ok: false, code: "cooldown", msg: "verified recently — try again later" };
    }
    if (prev.dayKey === utcDayKeyOf(nowMs) && prev.startsToday >= LOGIC_MAX_STARTS_PER_DAY) {
      return { ok: false, code: "rate-limited", msg: "too many starts today" };
    }
  }
  return { ok: true };
}

export function nextStartsToday(prev: LogicAttempt | null, nowMs: number): number {
  return prev && prev.dayKey === utcDayKeyOf(nowMs) ? prev.startsToday + 1 : 1;
}

/**
 * A fresh attempt document and what the client may see of it, for the bank
 * named. Pure: the callable supplies the seed and the clock. The gv stamped
 * is the bank's own version, so `{seed, gv, bank}` reconstructs the form
 * forever (D31's rule, both banks).
 */
export function mintAttempt(
  prev: LogicAttempt | null,
  nowMs: number,
  seed: number,
  bank: LogicBank,
  selection: OmibSelection = OMIB_SELECTION,
): { attempt: LogicAttempt; items: LogicClientItem[] | OmibClientItem[] } {
  const attempt: LogicAttempt = {
    seed,
    gv: bank === "omib" ? OMIB_BANK_VERSION : GEN_VERSION,
    bank,
    ...(bank === "omib" ? { mode: selection } : {}),
    status: "open",
    startedAtMs: nowMs,
    deadlineMs: nowMs + LOGIC_DEADLINE_MS,
    dayKey: utcDayKeyOf(nowMs),
    startsToday: nextStartsToday(prev, nowMs),
    normsCounted: prev?.normsCounted === true,
  };
  // An adaptive attempt hands out its first item only: the rest do not
  // exist until the answers that choose them do.
  const items = bank !== "omib" ? clientItems(seed, GEN_VERSION)
    : selection === "adaptive" ? [{ code: omibNextItem(seed, []).code }]
    : omibClientItems(seed);
  return { attempt, items };
}

// Picks: one per item, -1 = expired/unanswered, else an option index.
export function validLogicPicks(x: unknown, items: number = LOGIC_ITEMS): x is number[] {
  return Array.isArray(x)
    && x.length === items
    && x.every((v) => typeof v === "number" && Number.isInteger(v) && v >= -1 && v <= 5);
}

export function scoreLogicPicks(
  seed: number,
  gv: number,
  picks: number[],
): { marks: boolean[]; score: number; families: string[] } {
  const form = generateForm(seed, gv);
  const marks = form.items.map((item, i) => picks[i] === item.a);
  // The families ride along for the difficulty fold (D62) — server-side
  // knowledge only until scoring, and derivable by anyone from the seed
  // the response discloses afterwards, so this hands the client nothing
  // it could not already compute.
  return { marks, score: marks.filter(Boolean).length, families: form.items.map((it) => it.rules[0]) };
}

// What the client is allowed to see at start time: renderable cells and
// options plus the (public, fixed-ramp) weight. NOT `a`, NOT `rules` —
// the family names would tell a coached solver which rule to hunt for,
// which is exactly the advance knowledge D56 removed.
export interface LogicClientItem {
  cells: Cell[];
  opts: Cell[];
  diff: number;
}

export function clientItems(seed: number, gv: number): LogicClientItem[] {
  return generateForm(seed, gv).items.map((it) => ({
    cells: it.cells,
    opts: it.opts,
    diff: it.diff,
  }));
}

// ── norms histogram fold (pure; the callable wraps it in a transaction) ──
// Flat b0..b25 buckets + n + the era it counts: the form length (`items` —
// a histogram of 12-item scores must never mix with 25-item ones, so a
// length change starts a fresh era, D61) and, since D402, the generator
// version (`gv` — v4's forms are 25 items like v3's but draw from a wider
// vocabulary, so a score out of 25 means something different under each,
// and a version change starts a fresh era too). The private doc is the working
// copy; the public mirror is rewritten on every attempt with the same
// exact numbers (D98 — the floor and the cadence that used to gate it
// are gone, along with the step-attribution argument behind them).
export type LogicNorms = Record<string, number>;

export function foldNorms(prev: LogicNorms | null, score: number): LogicNorms {
  const next: LogicNorms = { ...(prev || {}) };
  next.n = (next.n || 0) + 1;
  const key = `b${score}`;
  next[key] = (next[key] || 0) + 1;
  return next;
}

// ── the difficulty fold (D62) ──
// The Carpenter weights are priors; this is the measurement that will
// eventually correct them. Per FAMILY: how often it appeared and how often
// it was solved; per SLOT: how often it was solved (every slot appears
// once per attempt, so `n` is its exposure count). Verified FIRST attempts
// only — the same D32 rule the histogram uses, for the same reason:
// retakes measure practice. Counts only: no uid, no anchors, and no
// timings (per-item timings never leave the device — the D57 promise
// holds; difficulty is learned from solve rates alone).
export function foldDifficultyStats(
  prev: LogicNorms | null,
  families: string[],
  marks: boolean[],
): LogicNorms {
  const next: LogicNorms = { ...(prev || {}) };
  next.n = (next.n || 0) + 1;
  families.forEach((fam, i) => {
    next[`f_${fam}_seen`] = (next[`f_${fam}_seen`] || 0) + 1;
    if (marks[i]) {
      next[`f_${fam}_solved`] = (next[`f_${fam}_solved`] || 0) + 1;
      next[`s_${i}_solved`] = (next[`s_${i}_solved`] || 0) + 1;
    }
  });
  return next;
}

// ── the measured percentile (D60) ──
// Once the histogram holds enough verified first attempts, the percentile
// stops being a curve and becomes a count: the share of counted players
// this score strictly beats. Ties are not beaten — the claim stays "share
// of players this score beats", exactly the wording logic-score.ts pinned
// for the modelled curve this replaces. Below the floor the model keeps
// the job: an empirical percentile over a handful of players whipsaws by
// tens of points per submission, which is noise wearing a number.
//
// The floor's arithmetic (D60): at n = 100 the worst-case standard error
// of an empirical percentile is sqrt(0.5·0.5/100) ≈ 5 points — comparable
// to the modelled curve's own honesty margin. This is a STATISTICAL
// stability floor and survives D98 untouched: it is about whether a
// percentile means anything, not about who may read it. One constant;
// lowering it is a recorded decision, not a tweak.
export const LOGIC_NORMS_MIN_N = 100;

export function measuredPctile(
  norms: LogicNorms | null,
  score: number,
): { pctile: number; n: number } | null {
  const n = norms?.n || 0;
  if (n < LOGIC_NORMS_MIN_N) return null;
  let below = 0;
  for (let s = 0; s < score; s++) below += norms?.[`b${s}`] || 0;
  // Clamped to the model's [1, 99] range: "top 0%" and "sharper than 100%
  // of players" are display absurdities at any n, and the two sources must
  // not disagree about what numbers are possible. Inside the clamp the
  // measurement speaks for itself — a perfect score among many perfects
  // reads exactly as low as it deserves to, and the model's 94 ceiling
  // (D53) does not apply: that cap existed because a CURVE cannot rank
  // perfect scores, and a count can.
  return { pctile: Math.max(1, Math.min(99, Math.round((100 * below) / n))), n };
}

// ── the callables ──

const attemptRef = (uid: string) => firestore().collection("v2_logic_attempts").doc(uid);

export const logicStartV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const now = Date.now();
    const seed = randomBytes(4).readUInt32BE(0);

    const minted = await firestore().runTransaction(async (tx: Transaction) => {
      const ref = attemptRef(uid);
      const snap = await tx.get(ref);
      const prev = snap.exists ? (snap.data() as LogicAttempt) : null;
      const verdict = canStartLogic(prev, now);
      if (!verdict.ok) throw new HttpsError("failed-precondition", verdict.msg, { code: verdict.code });
      const m = mintAttempt(prev, now, seed, LOGIC_BANK);
      tx.set(ref, m.attempt);
      return m;
    });

    logger.info(`[logicStartV2] uid=${uid} attempt opened on ${LOGIC_BANK}${minted.attempt.mode ? ` (${minted.attempt.mode})` : ""}`);
    return {
      items: minted.items,
      capMs: LOGIC_ITEM_CAP_MS,
      deadlineMs: LOGIC_DEADLINE_MS,
      // The selection and the form's length travel with an OMIB start, so
      // the client knows whether the items it holds are the whole form or
      // the first of twenty-five it will be handed one at a time.
      ...(minted.attempt.bank === "omib" ? { mode: minted.attempt.mode, total: OMIB_FORM_ITEMS } : {}),
    };
  },
);

/**
 * How one submitted score is RANKED and whether it FOLDS — the decisions
 * that decide what every "sharper than X% of N verified players" sentence
 * rests on, and the likely range printed beside it.
 *
 * PURE, and extracted because none of it ran: the callable it lived in is
 * reached only through the emulator, and that leg starts an attempt and
 * submits immediately. All four mutated green across the functions suite
 * AND all three e2e suites — the era check widened so a 12-item histogram
 * ranks a 25-item score, the curve pinned to 12 items for a 25-item form,
 * the first-attempt gate dropped so every re-verification re-folds into
 * the published norms, and the fold made unconditional.
 *
 * THE ERA STAMP IS THE LOAD-BEARING PART. A histogram from another era —
 * another form length, or since D402 another generator version — ranks
 * nothing and folds nothing — the first current-era submit starts the
 * count fresh — because a score out of 25 has no meaning against a
 * distribution of scores out of 12, and a v3 score out of 25 was earned
 * on a narrower vocabulary than a v4 one. An attempt opened under the
 * previous version and submitted after a deploy is scored against its own
 * form and its own curve, and folds nowhere.
 *
 * D32's rule, one line down: a re-verification is measured but never
 * counted, so no account can push the population toward itself by taking
 * the test again. `alreadyCounted` is the attempt's own carry of that
 * flag, and `logicStartV2` is what carries it forward across attempts.
 * D402's effort floor sits beside it: a click-through is measured too,
 * and counted never.
 *
 * The BAND is the score read at ±LOGIC_SEM_ITEMS through whatever ranked
 * it — the count when the reading is measured, the curve when it is the
 * model's — so the range and the number always rest on the same thing.
 *
 * `prevNorms` comes back out so the caller can fold the difficulty stats
 * against the same era-checked population, in lockstep.
 */
export function rankAndFold(a: {
  items: number;
  /** the generator version the attempt's form was drawn under */
  gv: number;
  score: number;
  /** the server-observed duration — the effort floor reads it */
  durationMs: number;
  stored: LogicNorms | null;
  alreadyCounted: boolean;
}): {
  pctile: number;
  /** the likely range: the score ± LOGIC_SEM_ITEMS, ranked the same way */
  band: [number, number];
  source: "measured" | "model";
  countsNorms: boolean;
  norms: LogicNorms | null;
  /** How many verified players the measured reading rests on — null when
   * the reading is the model's, which rests on nobody. The published
   * sentence is "sharper than X% of N", so the N travels with the X. */
  n: number | null;
} {
  const sameEra = a.stored != null && a.stored.items === LOGIC_ITEMS && a.stored.gv === GEN_VERSION;
  const prevNorms = sameEra ? a.stored : null;
  const isCurrentEra = a.items === LOGIC_ITEMS && a.gv === GEN_VERSION;
  const measured = isCurrentEra ? measuredPctile(prevNorms, a.score) : null;
  const effort = a.durationMs >= a.items * LOGIC_MIN_MS_PER_ITEM;
  const countsNorms = !a.alreadyCounted && isCurrentEra && effort;
  // measuredPctile depends on the score only through the buckets below
  // it, so if it ranked the score it ranks every score on the same n
  const rank = (score: number) =>
    (measured ? measuredPctile(prevNorms, score)?.pctile : undefined) ?? logicPctileFor(score / a.items, a.items);
  return {
    pctile: rank(a.score),
    band: [rank(Math.max(0, a.score - LOGIC_SEM_ITEMS)), rank(Math.min(a.items, a.score + LOGIC_SEM_ITEMS))],
    source: measured ? "measured" : "model",
    countsNorms,
    norms: countsNorms ? { ...foldNorms(prevNorms, a.score), items: LOGIC_ITEMS, gv: GEN_VERSION } : null,
    n: measured ? measured.n : null,
  };
}

/**
 * rankAndFold for the OMIB bank: the same four decisions — era, first
 * attempt, effort floor, measured-or-model — over θ instead of a count.
 * The band is θ̂ ± its own SE read through whatever ranked θ̂, so the range
 * and the number rest on the same thing, and the range is the person's
 * rather than a constant (D402's ±2 items was a modelled stand-in for
 * exactly this). Below the floor the model is Φ(θ̂) against the calibration
 * sample — a real population, named in the sentence that prints it
 * (docs/OMIB-PLAN.md §4).
 */
export function rankAndFoldTheta(a: {
  theta: number;
  se: number;
  durationMs: number;
  stored: Norms | null;
  alreadyCounted: boolean;
}): {
  pctile: number;
  band: [number, number];
  source: "measured" | "model";
  countsNorms: boolean;
  norms: Norms | null;
  n: number | null;
} {
  const prevNorms = isOmibEra(a.stored) ? a.stored : null;
  const measured = measuredPctileTheta(prevNorms, a.theta, LOGIC_NORMS_MIN_N);
  const effort = a.durationMs >= OMIB_FORM_ITEMS * LOGIC_MIN_MS_PER_ITEM;
  const countsNorms = !a.alreadyCounted && effort;
  const rank = (t: number) =>
    (measured ? measuredPctileTheta(prevNorms, t, LOGIC_NORMS_MIN_N)?.pctile : undefined) ?? modelPctileTheta(t);
  return {
    pctile: rank(a.theta),
    band: [rank(a.theta - a.se), rank(a.theta + a.se)],
    source: measured ? "measured" : "model",
    countsNorms,
    norms: countsNorms ? { ...foldThetaNorms(prevNorms, a.theta), ...OMIB_ERA } : null,
    n: measured ? measured.n : null,
  };
}

/**
 * The OMIB submit, inside logicSubmitV2's transaction. The same shape as the
 * generator's body below — validate, score, read the norms PRE-fold, rank,
 * fold the ledger under the same gate, write the attempt, the profile's
 * verified result, the norms and their mirror — over the bank's own pure
 * functions. Kept as its own body rather than interleaved conditionals so
 * the generator path, which is what production runs until the flip, stays
 * byte-for-byte what it was.
 */
async function submitOmib(
  tx: Transaction,
  db: ReturnType<typeof firestore>,
  uid: string,
  ref: ReturnType<typeof attemptRef>,
  attempt: LogicAttempt,
  picks: unknown,
  now: number,
) {
  if (attempt.mode === "adaptive") {
    throw new HttpsError("failed-precondition", "an adaptive attempt is scored item by item — through logicNextV2");
  }
  if (!validOmibPicks(picks)) {
    throw new HttpsError("invalid-argument", `picks must be ${OMIB_FORM_ITEMS} twenty-character cells of 0 and 1`);
  }
  return finishOmib(tx, db, uid, ref, attempt, scoreOmib("stratified", attempt.seed, picks), now);
}

/**
 * The end of an OMIB attempt, whichever selection served it: rank, fold,
 * write the attempt, the profile's verified result, the norms and their
 * mirrors, and return the result. The scorer ran before this; what differs
 * by selection is only which ledger the item counts fold into.
 */
async function finishOmib(
  tx: Transaction,
  db: ReturnType<typeof firestore>,
  uid: string,
  ref: ReturnType<typeof attemptRef>,
  attempt: LogicAttempt,
  scored: OmibScore,
  now: number,
) {
  const { marks, attempted, score, theta, se, itemIds, diffs } = scored;
  const mode: OmibSelection = attempt.mode === "adaptive" ? "adaptive" : "stratified";
  const durationMs = now - attempt.startedAtMs;

  const privRef = db.collection("v2_logic_norms_private").doc("global");
  const privSnap = await tx.get(privRef);
  const stored = privSnap.exists ? (privSnap.data() as Norms) : null;
  const { pctile, band, source, countsNorms, norms, n: measuredN } = rankAndFoldTheta({
    theta,
    se,
    durationMs,
    stored,
    alreadyCounted: attempt.normsCounted === true,
  });
  // The ledger is per ITEM for this bank (docs/OMIB-PLAN.md §3.2), on the
  // same document the generator kept its families on; the era stamp is
  // what keeps the two from ever folding into each other. AND PER
  // SELECTION (D476): a stratified attempt's counts are the §6 report's
  // instrument — an item's solve rate against its published b — and an
  // adaptive attempt's are not, because adaptive administration meets every
  // item near its taker's 50 % point. So the two fold into different
  // documents: `families` stays the stratified ledger the report reads,
  // and `adaptive` is exposure accounting for the day the flip happens.
  const ledgerRef = db.collection("v2_logic_norms_private").doc(mode === "adaptive" ? "adaptive" : "families");
  let ledger: Norms | null = null;
  if (countsNorms) {
    const snap = await tx.get(ledgerRef);
    const prev = snap.exists && isOmibEra(snap.data() as Norms) ? (snap.data() as Norms) : null;
    ledger = { ...foldItemStats(prev, itemIds, marks, attempted), ...OMIB_ERA, mode };
  }

  tx.set(ref, {
    ...attempt,
    status: "scored",
    normsCounted: attempt.normsCounted === true || countsNorms,
    scoredAtMs: now,
    score,
    durationMs,
  });
  // v: 3 is the OMIB era of the verified record; `bank` says so in words and
  // `theta`/`se` are the measurement. `gv` is the bank's own version, so a
  // reader that reconstructs the form does it on the right bank — and
  // `mode` says how: from the seed alone, or from the seed and the picks.
  tx.set(
    db.collection("v2_users").doc(uid),
    {
      testResults: {
        logic: {
          v: 3,
          verified: true,
          bank: "omib",
          mode,
          seed: attempt.seed,
          gv: OMIB_BANK_VERSION,
          marks,
          theta,
          se,
          pctile,
          band,
          durationMs,
          source,
          ...(measuredN != null ? { n: measuredN } : {}),
          when: now,
        },
      },
    },
    { mergeFields: ["testResults.logic"] },
  );
  if (norms) {
    tx.set(privRef, norms);
    tx.set(db.collection("v2_logic_norms").doc("global"), { ...norms, updatedAtMs: now });
  }
  if (ledger) {
    tx.set(ledgerRef, ledger);
    tx.set(db.collection("v2_logic_norms").doc(ledgerRef.id), { ...ledger, updatedAtMs: now });
  }
  return {
    marks,
    score,
    theta,
    se,
    pctile,
    band,
    durationMs,
    source,
    ...(measuredN != null ? { n: measuredN } : {}),
    seed: attempt.seed,
    gv: OMIB_BANK_VERSION,
    bank: "omib" as const,
    mode,
    // Disclosed only now, like the seed: the published difficulty of each
    // item in form order, so the Answers lens can rank its rows on the real
    // ramp. Public parameters; nothing here that scores anything.
    diffs,
  };
}

export const logicSubmitV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const picks = (request.data as { picks?: unknown } | null)?.picks;
    const now = Date.now();
    const db = firestore();

    const out = await db.runTransaction(async (tx: Transaction) => {
      const ref = attemptRef(uid);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("failed-precondition", "no open attempt");
      const attempt = snap.data() as LogicAttempt;
      if (attempt.status !== "open") throw new HttpsError("failed-precondition", "already scored");
      if (now > attempt.deadlineMs) throw new HttpsError("deadline-exceeded", "attempt expired");

      // The bank the attempt was minted on decides how it is scored — never
      // LOGIC_BANK, which may have flipped since it opened.
      if (attempt.bank === "omib") return submitOmib(tx, db, uid, ref, attempt, picks, now);

      // Validated against the ATTEMPT's form length: an attempt opened just
      // before a form-length deploy still scores against its own era.
      const items = logicItemsFor(attempt.gv);
      if (!validLogicPicks(picks, items)) {
        throw new HttpsError("invalid-argument", `picks must be ${items} integers in -1..5`);
      }

      const { marks, score, families } = scoreLogicPicks(attempt.seed, attempt.gv, picks);
      const durationMs = now - attempt.startedAtMs;

      // The histogram is read on EVERY submit now (still before any write,
      // as transactions require): it is the fold target for a first
      // attempt (D32's rule) and, since D60, the percentile's comparison
      // population. Read PRE-fold on purpose — "sharper than X% of N
      // verified players" compares against the players counted before this
      // one, so a submitter is never a member of their own field, and a
      // re-verifier (who never folds) is measured against the same kind of
      // population as everyone else.
      const privRef = db.collection("v2_logic_norms_private").doc("global");
      const privSnap = await tx.get(privRef);
      const stored = privSnap.exists ? (privSnap.data() as LogicNorms) : null;
      const { pctile, band, source, countsNorms, norms, n: measuredN } = rankAndFold({
        items,
        gv: attempt.gv,
        score,
        durationMs,
        stored,
        alreadyCounted: attempt.normsCounted === true,
      });
      // The difficulty stats advance in lockstep with the histogram (same
      // first-attempt gate, same era stamp) — reads still precede every
      // write, as transactions require.
      const famRef = db.collection("v2_logic_norms_private").doc("families");
      let famStats: LogicNorms | null = null;
      if (countsNorms) {
        const famSnap = await tx.get(famRef);
        const famStored = famSnap.exists ? (famSnap.data() as LogicNorms) : null;
        const famPrev =
          famStored != null && famStored.items === LOGIC_ITEMS && famStored.gv === GEN_VERSION ? famStored : null;
        famStats = { ...foldDifficultyStats(famPrev, families, marks), items: LOGIC_ITEMS, gv: GEN_VERSION };
      }

      tx.set(ref, {
        ...attempt,
        status: "scored",
        // Set only when this attempt actually fed the histogram: an attempt
        // from a retired era or under the effort floor (D402) leaves the
        // flag as it was, so the account's next verified attempt is still
        // its first counted one. (Before D402 this read `true`
        // unconditionally, which marked a straddling 12-item attempt as
        // counted without ever folding it.)
        normsCounted: attempt.normsCounted === true || countsNorms,
        scoredAtMs: now,
        score,
        durationMs,
      });
      // The canonical verified result. Server-written (admin SDK bypasses
      // rules); the rules deny clients this key, so it cannot be forged.
      // No per-item times: the client's timings are unverifiable claims,
      // so the verified record carries only the server-observed duration.
      // `n` travels only when the percentile is measured — it is the size
      // of the population the claim is about, meaningless for the model.
      tx.set(
        db.collection("v2_users").doc(uid),
        {
          testResults: {
            logic: {
              v: 2,
              verified: true,
              seed: attempt.seed,
              gv: attempt.gv,
              marks,
              pctile,
              band,
              durationMs,
              source,
              ...(measuredN != null ? { n: measuredN } : {}),
              when: now,
            },
          },
        },
        // THE SUBTREE, WHOLE. `{merge:true}` merges nested maps leaf by
        // leaf, so a key omitted here was left STANDING from the previous
        // verified attempt — and `n` is omitted by design whenever the
        // percentile is modelled rather than measured. An account that
        // verified under an earlier generator era and re-verified after a
        // bump (which resets the norms, so the percentile falls back to
        // the model until a hundred fresh attempts fold) kept an `n`
        // counted from a population that no longer exists, beside
        // `source: "model"` — the exact thing the comment above forbids,
        // on a world-readable profile and in the data export.
        //
        // `mergeFields` names the one path this write owns: the subtree
        // is replaced, the rest of the profile is untouched, and the fix
        // is the CLASS rather than the key — the next optional field
        // omitted here cannot go stale either.
        { mergeFields: ["testResults.logic"] },
      );
      if (norms) {
        tx.set(privRef, norms);
        // Published on every attempt (D98 — no cadence, nothing withheld).
        tx.set(db.collection("v2_logic_norms").doc("global"), { ...norms, updatedAtMs: now });
      }
      if (famStats) {
        tx.set(famRef, famStats);
        tx.set(db.collection("v2_logic_norms").doc("families"), { ...famStats, updatedAtMs: now });
      }
      // The seed is disclosed only NOW — the attempt is scored and cannot
      // be resubmitted, so it is no longer an answer key; handing it back
      // keeps the client's saved result reconstructable, the D31 property
      // practice results have always had.
      return {
        marks,
        score,
        pctile,
        band,
        durationMs,
        source,
        ...(measuredN != null ? { n: measuredN } : {}),
        seed: attempt.seed,
        gv: attempt.gv,
      };
    });

    logger.info(`[logicSubmitV2] uid=${uid} scored ${out.score}/${"bank" in out ? OMIB_FORM_ITEMS : LOGIC_ITEMS}`);
    return out;
  },
);

// ── the adaptive attempt's per-item call (D476, docs/OMIB-PLAN.md §3.3) ──
//
// One call per item: the pick for item `index` goes in, the next item comes
// out — or, on the twenty-fifth, the result, scored and folded exactly as a
// stratified submit is. The attempt document carries the picks so far and
// nothing else new: the items served are replayed from the seed and the
// picks, so the document never holds a list a reader could take for a key,
// and NO PER-ITEM TIMING is written — the server could now observe one
// arrival per item, and the D57 promise (per-item timings never leave the
// device; the server records only the attempt's duration) is kept by not
// recording what it sees.
//
// Idempotent on a repeat: the same index with the same pick is a client
// that did not hear the answer, and gets the same answer again — the next
// item, or, after the last one, the result already written to the profile.
// A different pick at an index already taken, or a skipped index, is a
// client out of step and is refused.
const nextOut = (next: OmibItem | null, index: number) => ({
  items: next ? [{ code: next.code }] : [],
  index,
  total: OMIB_FORM_ITEMS,
});

export const logicNextV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const data = (request.data ?? {}) as { index?: unknown; pick?: unknown };
    const index = data.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= OMIB_FORM_ITEMS) {
      throw new HttpsError("invalid-argument", `index must be an integer in 0..${OMIB_FORM_ITEMS - 1}`);
    }
    const pick = data.pick;
    if (!validOmibCell(pick)) throw new HttpsError("invalid-argument", "pick must be one twenty-character cell of 0 and 1");
    const now = Date.now();
    const db = firestore();

    const out = await db.runTransaction(async (tx: Transaction) => {
      const ref = attemptRef(uid);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("failed-precondition", "no open attempt");
      const attempt = snap.data() as LogicAttempt;
      if (attempt.bank !== "omib" || attempt.mode !== "adaptive") {
        throw new HttpsError("failed-precondition", "not an adaptive attempt");
      }
      const picks = attempt.picks ?? [];
      if (attempt.status === "scored") {
        // The final call was scored and its answer lost on the way back:
        // the result is on the profile, so hand it over rather than tell a
        // finisher their attempt is gone.
        if (index === OMIB_FORM_ITEMS - 1 && picks[index] === pick) return storedOmibResult(tx, db, uid, attempt);
        throw new HttpsError("failed-precondition", "already scored");
      }
      if (now > attempt.deadlineMs) throw new HttpsError("deadline-exceeded", "attempt expired");
      if (index === picks.length - 1 && picks[index] === pick) {
        return nextOut(replayAdaptive(attempt.seed, picks).next, picks.length);
      }
      if (index !== picks.length) {
        throw new HttpsError("failed-precondition", `expected the pick for item ${picks.length + 1}`);
      }
      const all = [...picks, pick];
      if (all.length < OMIB_FORM_ITEMS) {
        tx.set(ref, { ...attempt, picks: all });
        return nextOut(replayAdaptive(attempt.seed, all).next, all.length);
      }
      const held = { ...attempt, picks: all };
      return finishOmib(tx, db, uid, ref, held, scoreOmib("adaptive", attempt.seed, all), now);
    });

    if ("marks" in out) logger.info(`[logicNextV2] uid=${uid} scored ${out.score}/${OMIB_FORM_ITEMS} (adaptive)`);
    return out;
  },
);

/** The scored attempt's result, as the profile holds it, for a final call answered twice. */
async function storedOmibResult(
  tx: Transaction,
  db: ReturnType<typeof firestore>,
  uid: string,
  attempt: LogicAttempt,
) {
  const snap = await tx.get(db.collection("v2_users").doc(uid));
  const r = (snap.data()?.testResults as { logic?: Record<string, unknown> } | undefined)?.logic;
  if (!r || r.seed !== attempt.seed || r.bank !== "omib") throw new HttpsError("failed-precondition", "already scored");
  const { marks, score, diffs } = scoreOmib("adaptive", attempt.seed, attempt.picks ?? []);
  return {
    marks,
    score,
    theta: r.theta as number,
    se: r.se as number,
    pctile: r.pctile as number,
    band: r.band as [number, number],
    durationMs: r.durationMs as number,
    source: r.source as "measured" | "model",
    ...(typeof r.n === "number" ? { n: r.n } : {}),
    seed: attempt.seed,
    gv: OMIB_BANK_VERSION,
    bank: "omib" as const,
    mode: "adaptive" as const,
    diffs,
  };
}
