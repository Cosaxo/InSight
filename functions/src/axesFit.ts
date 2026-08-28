// axesFit.ts — the trait-axis projection's arithmetic (AXES-PLAN §2,
// AXES-RUNBOOK 1.1): per-person instrument scores folded from public test
// answers, each axis regressed on the per-person θ the patterns fit
// already writes, published as DIRECTIONS in the same K-space the
// questions live in. "Project, don't refit" — the core fit never changes;
// the loadings doc gains an `axes:` block and every reader inherits it.
//
// WHY THIS IS A GENUINE CROSS-SOURCE READING and not the fit rediscovering
// its own inputs: PATTERNS_QIDS admits two-option daily/core-feed votes
// only — no instrument item can enter the latent space by any path (the
// no-tautology pin in patterns.test.ts holds this as a test, per
// AXES-RUNBOOK 1.1). So a trait axis that projects cleanly is telling you
// the opinion space and the instrument agree about people, measured on
// disjoint items.
//
// Pure on purpose (the patternsFit.ts contract): no firebase imports, no
// I/O, deterministic — same inputs, same block, bit for bit.

/** Answers an axis needs from ONE person before their score counts.
 * Mirrors data/passiveProfile.ts MIN_AXIS_ITEMS, for its reason: one
 * 5-point answer lands an axis on an extreme more often than not; two is
 * the smallest number that can disagree with itself. */
export const AXES_MIN_AXIS_ITEMS = 2;

/** People an axis needs before its direction publishes. The same figure
 * and the same argument as PATTERNS_MIN_BASIS one level up: a direction
 * regressed on fewer people than the Oracle would guess for is not yet a
 * reading of anything. Below it the row is ABSENT, not faked (D1). */
export const AXES_MIN_N = 8;

export interface AxesItemMeta {
  qid: string;
  test: string;
  dim: string;
  invert?: boolean;
}

export interface AxisRow {
  /** Unit direction in the fit's K-space, 4 dp (publishableLoadings'
   * precision argument). */
  v: number[];
  /** People behind the regression — the row's basis, published with it. */
  n: number;
  /** |corr(score, θ·v̂)| in [0,1], 4 dp — the fit quality the client's
   * draw floor reads (AXES-RUNBOOK 1.5). */
  fit: number;
  /** The dim's human label, published so the Map never needs a second
   * source to name what it draws. */
  label: string;
}

/** key (`test.dim`) → row. An axis nobody measured has no key — absent,
 * never zeroed. */
export type PublishedAxes = Record<string, AxisRow>;

/**
 * One person's per-axis instrument scores from their own test answers —
 * the axisScores arithmetic (data/similarity.ts) run server-side over
 * one-hot votes: value = mean(direction-corrected optionIdx)/4 × 100.
 * Unrounded, unlike the client's display copy: these feed a regression.
 *
 * Answers are one doc per (person, question) by the create-only rule, so
 * there is nothing to dedupe; a non-integer or out-of-range optionIdx is
 * dropped the way the client's scorer drops it.
 */
export function traitScores(
  answers: ReadonlyArray<{ qid: string; optionIdx: number }>,
  meta: ReadonlyArray<AxesItemMeta>,
): Map<string, { value: number; items: number }> {
  const byQid = new Map<string, AxesItemMeta>(meta.map((m) => [m.qid, m]));
  const acc = new Map<string, { norm: number; n: number; items: number }>();
  for (const a of answers) {
    const m = byQid.get(a.qid);
    if (!m) continue;
    const v = a.optionIdx;
    if (!Number.isInteger(v) || v < 0 || v > 4) continue;
    const key = `${m.test}.${m.dim}`;
    const e = acc.get(key) ?? { norm: 0, n: 0, items: 0 };
    e.norm += m.invert ? 4 - v : v;
    e.n += 1;
    e.items += 1;
    acc.set(key, e);
  }
  const out = new Map<string, { value: number; items: number }>();
  for (const [key, e] of acc) {
    if (e.items < AXES_MIN_AXIS_ITEMS) continue;
    out.set(key, { value: (e.norm / (4 * e.n)) * 100, items: e.items });
  }
  return out;
}

/**
 * Regress each measured axis on θ across the population and return the
 * publishable block.
 *
 * The direction is the per-component covariance of the axis score with θ,
 * normalised to unit length — the least-squares direction up to scale,
 * which is all a DRAWN direction needs. The quality is the correlation
 * between the score and the projection of θ onto that direction: 1 means
 * the axis lies flat in the plane the questions span, 0 means the
 * instrument measures something the opinion space cannot see — which is a
 * finding, not a failure, and the row publishes either way once enough
 * people are behind it. What the row does NOT publish is anything
 * per-person: n people enter, one direction leaves.
 */
export function fitAxes(
  persons: ReadonlyArray<{ theta: readonly number[]; scores: ReadonlyMap<string, number> }>,
  k: number,
  labels: ReadonlyMap<string, string>,
): PublishedAxes {
  const keys = new Set<string>();
  for (const p of persons) for (const key of p.scores.keys()) keys.add(key);

  const out: PublishedAxes = {};
  for (const key of [...keys].sort()) {
    const pairs = persons.filter(
      (p) => p.theta.length === k && p.scores.has(key),
    );
    const n = pairs.length;
    if (n < AXES_MIN_N) continue;

    const meanTheta = Array.from({ length: k }, () => 0);
    let meanS = 0;
    for (const p of pairs) {
      meanS += p.scores.get(key) as number;
      for (let i = 0; i < k; i++) meanTheta[i] += p.theta[i];
    }
    meanS /= n;
    for (let i = 0; i < k; i++) meanTheta[i] /= n;

    // cov(score, θ) per component — the unnormalised direction.
    const cov = Array.from({ length: k }, () => 0);
    let varS = 0;
    for (const p of pairs) {
      const ds = (p.scores.get(key) as number) - meanS;
      varS += ds * ds;
      for (let i = 0; i < k; i++) cov[i] += ds * (p.theta[i] - meanTheta[i]);
    }
    let norm = 0;
    for (let i = 0; i < k; i++) norm += cov[i] * cov[i];
    norm = Math.sqrt(norm);
    // A score with no variance, or no lean at all, has no direction to
    // draw — the row stays absent rather than publishing a zero vector
    // that would render as a dot claiming to be an axis.
    if (!(norm > 0) || !(varS > 0)) continue;
    const v = cov.map((c) => c / norm);

    // fit = |corr(s, θ·v̂)| — second pass over the same pairs, exact.
    let varP = 0;
    let covSP = 0;
    for (const p of pairs) {
      let proj = 0;
      for (let i = 0; i < k; i++) proj += (p.theta[i] - meanTheta[i]) * v[i];
      varP += proj * proj;
      covSP += proj * ((p.scores.get(key) as number) - meanS);
    }
    const fit = varP > 0 ? Math.abs(covSP) / Math.sqrt(varS * varP) : 0;

    out[key] = {
      v: v.map((x) => Math.round(x * 10000) / 10000),
      n,
      fit: Math.round(fit * 10000) / 10000,
      label: labels.get(key) ?? key,
    };
  }
  return out;
}
