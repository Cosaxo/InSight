// patternsFit.ts — the Patterns fold's arithmetic (v28 §2, trial per
// D166 §1, gated by D167): per-question LOADING VECTORS from a streaming
// fit over the vote log, so the Map and the Oracle can read real
// co-occurrence structure instead of the prototype's 560 invented people.
//
// THE MODEL, plainly. Each eligible question q keeps K numbers L[q]; each
// person keeps K private numbers θ (v2_users/{uid}/patterns, readable by
// nobody). An answer is encoded ±1 and centred by the question's own
// running marginal, and each observation takes one damped SGD step on
// both vectors:
//
//   r = x − mean(x_q)                      // what the answer says BEYOND
//                                          // the question's popularity
//   e = r − θ·L[q]
//   θ    += ηu · (e·L[q] − λ·θ)
//   L[q] += ηq(n) · (e·θ − λ·L[q])
//
// This is the "streaming/incremental fit over the vote log" the
// prototype's own header names (design/standalone-v28/question-map.js) —
// the online form of the truncated factorisation its power-iteration SVD
// computes in one shot — and it recovers the same reading: sim(i,j) is a
// cosine over the two loading vectors, position seeds from the first two
// components, hub-ness is ‖L‖. O(K) per observation, no pairwise state
// anywhere, so it stays honest at a million questions (the plan's own
// complexity contract). One deliberate departure from the prototype: its
// SVD centres by the MAJORITY share after orienting to it, which injects
// a skew axis into factor 1 (the residual mean is 1−2p, not 0); centring
// by the running mean of the encoded answer is the correct form and is
// what ships.
//
// WHY the marginal counters live here and not in the agg docs: the fit
// must centre by the mean of exactly the answers IT has folded, or a
// backlog replay would centre early answers by a future marginal. The
// counts duplicate nothing secret — the same marginals publish per
// question in v2_question_aggs from the first answer.
//
// Pure on purpose (the pure.ts contract): no firebase imports, no I/O,
// no ambient randomness — the loading seed is a hash of the qid, so a
// re-run from the same log reproduces the same model bit for bit.

export const PATTERNS_K = 8;
/** The user step. Flat: a person's vector should keep moving with them. */
export const PATTERNS_ETA_USER = 0.15;
/** The question step decays with folds — early answers rough the vector
 * in, later ones refine it. */
export const patternsEtaQ = (nFolds: number): number => 0.5 / (20 + nFolds);
/** L2 damping — keeps a rarely-answered question's vector from wandering
 * off on a handful of extreme steps. */
export const PATTERNS_LAMBDA = 0.02;

export interface PatternsLoading {
  /** The loading vector, K floats. */
  v: number[];
  /** Answers folded into it — the reading's basis, published with it so
   * a client can refuse to draw a question nobody has answered. */
  n: number;
  /** Running sum of encoded answers (±1) — sum/n is the marginal the
   * centring uses. */
  sum: number;
}

export interface PatternsModel {
  k: number;
  q: Record<string, PatternsLoading>;
}

export interface PatternsUserState {
  v: number[];
  n: number;
}

export interface PatternsObservation {
  qid: string;
  /** The encoded answer: +1 for option 0, −1 for option 1. */
  x: number;
  /**
   * The encoded answer this one REPLACES, when the person had already been
   * folded on this question and has since edited it (D86). Absent on a
   * first answer, which is the ordinary case.
   *
   * It exists because `n` and `sum` are counts of PEOPLE and an edit is
   * not a second person. Folding one as a first answer put the same person
   * in `n` twice and left both of their answers in `sum` — so someone who
   * said 0 and changed their mind to 1 contributed nothing to the marginal
   * instead of +1, and inflated the basis at the same time.
   */
  prev?: number;
}

/** Two-option answers encode symmetrically; anything else is ineligible
 * (the prototype's own pool rule — everything in the engine is one bit). */
export function encodeAnswer(optionIdx: number): number {
  return optionIdx === 0 ? 1 : -1;
}

// FNV-1a, the prototype's own deterministic hash (h01 in
// patterns-core.js) — a seed the fit can reproduce from the qid alone.
function h01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 8) % 100000) / 100000;
}

/** A question's starting vector: small, deterministic, direction spread
 * by hash — zero would trap the whole model at the origin (every step
 * multiplies through θ·L), and randomness would make the fit
 * unreproducible from its log. */
export function seedLoading(qid: string, k: number = PATTERNS_K): number[] {
  return Array.from({ length: k }, (_, i) => (h01(`ld${i}:${qid}`) * 2 - 1) * 0.05);
}

export function emptyModel(k: number = PATTERNS_K): PatternsModel {
  return { k, q: {} };
}

export function emptyUser(k: number = PATTERNS_K): PatternsUserState {
  return { v: Array.from({ length: k }, () => 0), n: 0 };
}

// ── the fit's own scorecard (D325) ───────────────────────────────────
//
// The standing prequential benchmark the theory layer asked for and the
// bridge ruled worth-building (axiom-theory bridge/VERDICTS.md,
// 2026-08-26; adopted at D325): before each observation folds, the model
// as it stands guesses it, and the surprisal is the fit's own predictive
// power on record — the number any candidate engine must beat on the
// same log, and the baseline the portfolio metric is defined against.
// Prequential-ONLINE: the person's vector updates within the day as the
// fold proceeds, so each guess is the current model's, exactly as the
// request words it. It scores THE FIT, not the device Oracle — that
// solves its own ridge over the published loadings and keeps its own
// meter; the published doc says so in a `note` field so nobody reads
// one number as the other.

/** One day's tally: pooled and per-question totals (divide by n for the
 * mean). Accumulated by foldUserDay when the caller passes one in. */
export interface PatternsDayScore {
  n: number;
  bits: number;
  perQ: Record<string, { n: number; bits: number }>;
}

export const emptyDayScore = (): PatternsDayScore => ({ n: 0, bits: 0, perQ: {} });

/** The Oracle's own link and clamps (patternsMap.ts oracleGuess /
 * surprisalBits), mirrored on purpose: expected encoded answer x̂ read
 * as P(option 0) = (1 + x̂)/2, clamped to [0.05, 0.95], surprisal in
 * bits. Same currency as the Oracle meter, so the two numbers compare —
 * while measuring different models (the note above). */
export function prequentialBits(xhat: number, x: number): number {
  const p0 = Math.max(0.05, Math.min(0.95, (1 + xhat) / 2));
  const p = x === 1 ? p0 : 1 - p0;
  return -Math.log2(Math.max(1e-6, p));
}

/**
 * Fold one person's day of observations into the model and their own
 * state. Mutates and returns both (the pure.ts fold convention, so the
 * sweep can keep everything in one pass). Observations are folded in the
 * caller's order; the sweep sorts by qid so a re-run reproduces the run.
 *
 * `score`, when passed, is a pure observer (D325): it accumulates each
 * observation's one-step-ahead surprisal and must never change what the
 * fold computes — the determinism test pins the model bit-for-bit with
 * and without it.
 */
export function foldUserDay(
  model: PatternsModel,
  user: PatternsUserState,
  obs: readonly PatternsObservation[],
  score?: PatternsDayScore,
): { model: PatternsModel; user: PatternsUserState } {
  const k = model.k;
  for (const o of obs) {
    let L = model.q[o.qid];
    if (!L) {
      L = { v: seedLoading(o.qid, k), n: 0, sum: 0 };
      model.q[o.qid] = L;
    }
    // θ·L before anything moves — the SGD error below reuses it (the
    // counters don't touch the vectors, so the value is identical), and
    // the prequential guess must read the model as it stood BEFORE this
    // answer arrived: yesterday's marginal, unstepped vectors. One
    // step ahead or it isn't held out.
    let dot = 0;
    for (let i = 0; i < k; i++) dot += user.v[i] * L.v[i];
    // A REVISION NEEDS SOMETHING TO REVISE. With `L.n === 0` this model has
    // never folded an answer to this question, so the value the branch
    // below would subtract was never added — and worse, it would leave
    // `n` at zero while `sum` is computed, making `L.sum / L.n` a 0/0 NaN
    // that spreads: into this loading's vector, into the person's theta,
    // and from there into every other question they answer on any later
    // night. Firestore stores NaN as a valid double and nothing downstream
    // checks, so it would publish.
    //
    // Reachable in exactly the case the clamp below was written for — a
    // create outside the seven-day catch-up, or one that predates the
    // question becoming eligible — and on the first run after a deploy,
    // where every question starts at n = 0. The clamp does not cover it:
    // `L.sum > L.n` is satisfied at zero and leaves the division standing.
    //
    // So an edit whose first answer this model never saw folds as a first
    // answer: one person, their current answer, counted once. That is the
    // honest reading of what the model actually knows about them.
    const revision = o.prev !== undefined && L.n > 0;
    // A revision is not a held-out prediction. The person's answer to this
    // question was already scored the day it first arrived; scoring the
    // edit would count them twice in the day's own scorecard too, which is
    // the same error one level up.
    if (score && !revision) {
      const mPrev = L.n > 0 ? L.sum / L.n : 0;
      const bits = prequentialBits(mPrev + dot, o.x);
      score.n += 1;
      score.bits += bits;
      const t = (score.perQ[o.qid] ??= { n: 0, bits: 0 });
      t.n += 1;
      t.bits += bits;
    }
    // marginal first, then centre — the mean INCLUDES this answer, so a
    // question's very first answer carries no signal beyond existing
    // (r = 0), which is right: one vote says nothing about co-variation.
    //
    // A REVISION MOVES THE MARGINAL WITHOUT ADDING A PERSON: -old/+new,
    // `n` untouched. The same delta the aggregate counts take on an edit,
    // and for the same reason — the population did not grow, one member of
    // it changed their mind. Theta still steps below, which is the edit's
    // consequence v2.ts records as considered and accepted; it was only
    // the counts that were never meant to move twice.
    if (revision) {
      L.sum += o.x - (o.prev as number);
      // The invariant, as a clamp rather than an assumption: every answer
      // is ±1, so |sum| can never exceed n. It could only be breached by a
      // revision whose FIRST answer this model never folded — a create
      // that fell outside the catch-up window, or landed before the
      // question became eligible — where the subtraction removes something
      // that was never added. Rare, undetectable from the ledger alone,
      // and bounded here instead of left to skew a marginal past 1.
      if (L.sum > L.n) L.sum = L.n;
      else if (L.sum < -L.n) L.sum = -L.n;
    } else {
      L.n += 1;
      L.sum += o.x;
    }
    const m = L.sum / L.n;
    const r = o.x - m;
    const e = r - dot;
    const eq = patternsEtaQ(L.n);
    for (let i = 0; i < k; i++) {
      const ui = user.v[i];
      const li = L.v[i];
      user.v[i] = ui + PATTERNS_ETA_USER * (e * li - PATTERNS_LAMBDA * ui);
      L.v[i] = li + eq * (e * ui - PATTERNS_LAMBDA * li);
    }
    if (!revision) user.n += 1;
  }
  return { model, user };
}

/** Cosine over two loading vectors — the sim(i,j) the Map reads. Exported
 * for the tests, which use it to assert the fit recovers structure; the
 * client keeps its own copy on the device (step 4c). */
export function loadingCosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na * nb);
  return d > 0 ? dot / d : 0;
}

/**
 * The basis a loading needs before the fit will count it as drawable.
 *
 * Publication itself has no floor and should not get one: a vector with
 * `n: 1` publishes, carries its own basis, and every client-side reader
 * already refuses it on that basis (the Oracle's `nextAsk(minBasis)`, the
 * Map's own `n` on each node). What this number decides is narrower — how
 * many questions the fit will CLAIM to have fitted when the client asks
 * whether there is enough here to open a tab on (D265).
 *
 * 8, the same figure the Oracle refuses to guess below, because it is the
 * same question one level up: a vector fitted on fewer answers than this
 * is not yet a reading of anything.
 */
export const PATTERNS_MIN_BASIS = 8;

/**
 * How many published questions carry that basis — the crowd half of the
 * Patterns tab's mount gate (D265), published onto `v2_meta/app` beside
 * the floor it was counted at.
 *
 * The floor travels with the count on purpose. The client holds its own
 * opinion of what a believable basis is, and a fit that ever counted on
 * a looser one is publishing a weaker claim than the gate is about; the
 * client can see that and stay shut, instead of trusting a bare number
 * whose meaning changed in another deployable.
 */
export function readyPool(
  model: PatternsModel,
  basis: number = PATTERNS_MIN_BASIS,
): number {
  let n = 0;
  for (const L of Object.values(model.q)) if (L.n >= basis) n += 1;
  return n;
}

/** The publication: loadings rounded to 4 dp (a float32's useful precision
 * here, and it keeps the one public doc small), each with its basis. */
export function publishableLoadings(
  model: PatternsModel,
): Record<string, { v: number[]; n: number }> {
  const out: Record<string, { v: number[]; n: number }> = {};
  for (const [qid, L] of Object.entries(model.q)) {
    out[qid] = { v: L.v.map((x) => Math.round(x * 10000) / 10000), n: L.n };
  }
  return out;
}

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/**
 * The per-question floor on the published daily score (D325 — the
 * bridge verdict's own condition, not a deferral). Pooled bits publish
 * from the first observation like every aggregate (D98); a QUESTION's
 * daily mean publishes only from this many observations, because at
 * n = 1 the "mean" IS one person's surprisal — and surprisal is the one
 * number on this doc that cannot be recomputed from public data: it
 * reads θ·L, a projection of a vector nobody may read (the
 * v2_users/{uid}/patterns deny). Below the floor a day's answers still
 * count toward the pooled number and toward nothing else.
 *
 * 8 because it is the repo's standing believable-basis figure
 * (PATTERNS_MIN_BASIS, D265), the same question one level over: a daily
 * mean over fewer people than a loading needs to be drawable is not yet
 * a reading of the question.
 */
export const PATTERNS_QUALITY_FLOOR = 8;

/** How many pooled day-rows the published series keeps. 90 — the
 * agg-events ledger's own TTL (D28): the series never remembers longer
 * than the log it scores, and the doc stays bounded by construction
 * (~40 bytes a row, ≤ ~4 KB total). */
export const PATTERNS_QUALITY_DAYS = 90;

/** The clause the bridge verdict requires the publication itself to
 * carry, so the number cannot be read as the Oracle's. */
export const PATTERNS_QUALITY_NOTE =
  "prequential-online log-loss of the nightly fit itself, scored one step" +
  " ahead as each day folds; the device Oracle's ridge solve is a separate" +
  " model with its own meter";

export interface PatternsQualityDay {
  day: string;
  /** Observations scored that day — the row's basis; 0 says "no eligible
   * answers" out loud rather than going silent. */
  n: number;
  /** Mean surprisal bits per observation (0 when n is 0 — refuse on n,
   * the app's own idiom). */
  bits: number;
}

export interface PatternsQuality {
  /** The newest day this run scored — the headline row's basis. */
  day: string;
  n: number;
  bits: number;
  /** Daily per-question means, floored (PATTERNS_QUALITY_FLOOR) — the
   * floor rides along so the reader knows what absence means. */
  perQ: Record<string, { n: number; bits: number }>;
  floor: number;
  /** Pooled rows, oldest first, bounded to PATTERNS_QUALITY_DAYS. */
  series: PatternsQualityDay[];
  note: string;
}

/**
 * Assemble the published quality block from this run's day tallies and
 * the series the doc already carries. `scored` must be non-empty and in
 * fold order, oldest first (runPatternsFit returns before publishing
 * when no day is owed).
 */
export function publishableQuality(
  scored: readonly { day: string; score: PatternsDayScore }[],
  priorSeries: readonly PatternsQualityDay[],
  floor: number = PATTERNS_QUALITY_FLOOR,
): PatternsQuality {
  const rows = scored.map(({ day, score }) => ({
    day,
    n: score.n,
    bits: score.n > 0 ? round4(score.bits / score.n) : 0,
  }));
  const series = [...priorSeries, ...rows].slice(-PATTERNS_QUALITY_DAYS);
  const head = rows[rows.length - 1];
  const headScore = scored[scored.length - 1].score;
  const perQ: PatternsQuality["perQ"] = {};
  for (const [qid, t] of Object.entries(headScore.perQ)) {
    if (t.n >= floor) perQ[qid] = { n: t.n, bits: round4(t.bits / t.n) };
  }
  return { day: head.day, n: head.n, bits: head.bits, perQ, floor, series, note: PATTERNS_QUALITY_NOTE };
}

/**
 * How far each question's published loading moved between the previous
 * publish and this one (D325 — the map lane's request, corrected by its
 * verdict): plain L2 in LOADING space over the published (4 dp) vectors,
 * with NO rotation alignment — the fit is one persistent model folded
 * forward, consecutive publishes share one continuous basis, and a
 * Procrustes step would subtract real movement from the very number
 * being measured. `space` states the frame because drawn-plane
 * displacement is a different number (the client's spring pass and
 * declutter are nonlinear) and this summary deliberately is not it.
 *
 * Summary statistics run over EVERY question present in both publishes,
 * zeros included — the teleport a returning reader experiences is a
 * property of the whole map, not of the questions that moved — while
 * `perQ` lists only the movers, so the doc doesn't carry a page of
 * zeros. Nearest-rank percentiles: exact, deterministic, no
 * interpolation to argue about.
 */
export interface PatternsDisplacement {
  space: "loading";
  /** Questions present in both publishes — the summary's basis. */
  n: number;
  /** Of them, how many moved at the publication's own 4 dp precision. */
  moved: number;
  mean: number;
  p50: number;
  p90: number;
  max: number;
  /** The movers only: qid → L2 displacement, 4 dp. */
  perQ: Record<string, number>;
}

export function displacementSummary(
  prev: Record<string, readonly number[]>,
  model: PatternsModel,
): PatternsDisplacement {
  const pub = publishableLoadings(model);
  const ds: number[] = [];
  const perQ: Record<string, number> = {};
  for (const [qid, prevV] of Object.entries(prev)) {
    const cur = pub[qid];
    if (!cur) continue; // the model only grows today; belt for a retired qid
    let s = 0;
    for (let i = 0; i < cur.v.length; i++) {
      // both sides at publication precision, so an untouched question is
      // exactly zero rather than rounding noise
      const d = cur.v[i] - round4(prevV[i] ?? 0);
      s += d * d;
    }
    const dist = round4(Math.sqrt(s));
    ds.push(dist);
    if (dist > 0) perQ[qid] = dist;
  }
  ds.sort((a, b) => a - b);
  const rank = (q: number): number => (ds.length ? ds[Math.min(ds.length - 1, Math.max(0, Math.ceil(q * ds.length) - 1))] : 0);
  const mean = ds.length ? round4(ds.reduce((a, b) => a + b, 0) / ds.length) : 0;
  return {
    space: "loading",
    n: ds.length,
    moved: Object.keys(perQ).length,
    mean,
    p50: rank(0.5),
    p90: rank(0.9),
    max: ds.length ? ds[ds.length - 1] : 0,
    perQ,
  };
}
