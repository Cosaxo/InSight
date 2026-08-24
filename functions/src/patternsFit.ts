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

/**
 * Fold one person's day of observations into the model and their own
 * state. Mutates and returns both (the pure.ts fold convention, so the
 * sweep can keep everything in one pass). Observations are folded in the
 * caller's order; the sweep sorts by qid so a re-run reproduces the run.
 */
export function foldUserDay(
  model: PatternsModel,
  user: PatternsUserState,
  obs: readonly PatternsObservation[],
): { model: PatternsModel; user: PatternsUserState } {
  const k = model.k;
  for (const o of obs) {
    let L = model.q[o.qid];
    if (!L) {
      L = { v: seedLoading(o.qid, k), n: 0, sum: 0 };
      model.q[o.qid] = L;
    }
    // marginal first, then centre — the mean INCLUDES this answer, so a
    // question's very first answer carries no signal beyond existing
    // (r = 0), which is right: one vote says nothing about co-variation.
    L.n += 1;
    L.sum += o.x;
    const m = L.sum / L.n;
    const r = o.x - m;
    let dot = 0;
    for (let i = 0; i < k; i++) dot += user.v[i] * L.v[i];
    const e = r - dot;
    const eq = patternsEtaQ(L.n);
    for (let i = 0; i < k; i++) {
      const ui = user.v[i];
      const li = L.v[i];
      user.v[i] = ui + PATTERNS_ETA_USER * (e * li - PATTERNS_LAMBDA * ui);
      L.v[i] = li + eq * (e * ui - PATTERNS_LAMBDA * li);
    }
    user.n += 1;
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
