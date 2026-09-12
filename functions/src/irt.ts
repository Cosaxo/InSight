// Item response theory — the arithmetic that turns "which items were right"
// into an ability, for the OMIB logic test (D472, docs/OMIB-PLAN.md §2).
//
// WHY NOT A COUNT. Two people who each solve 18 of 25 did not do the same
// thing if one's 18 were harder, and two different forms have different
// totals of difficulty, so a count is not comparable between takers. The
// bank publishes, per item, a difficulty `b` and a discrimination `a`
// estimated on 2,572 people; this module is what those numbers are FOR.
//
// THE MODEL is the two-parameter logistic: at ability θ, item i is solved
// with probability 1 / (1 + exp(−a_i (θ − b_i))).
//
// THE ESTIMATE is EAP — the posterior mean under a standard-normal prior,
// on a fixed grid — and NOT maximum likelihood, because MLE is infinite for
// a perfect or a zero score, which a 25-item form on a phone will meet
// daily. EAP is finite everywhere, is the standard for short and adaptive
// forms, and gives a per-person standard error for free: the posterior SD.
// That SE is what the result's "likely range" becomes — a real interval,
// wider for a taker whose items were badly matched to them.
//
// Pure, dependency-free, deterministic. Pinned by irt.test.ts against
// hand-computed cases and the edge forms.

export interface ItemParams {
  /** discrimination */
  a: number;
  /** difficulty, on the calibration sample's scale (mean 0, SD 1) */
  b: number;
}

/** P(correct | θ) under the 2PL. */
export const p2pl = (theta: number, a: number, b: number): number =>
  1 / (1 + Math.exp(-a * (theta - b)));

// The grid: −5 … +5 at 0.05. The bank's most negative b is −8.98, but the
// N(0, 1) prior keeps the posterior where a person can be, and a grid this
// wide holds every posterior a 25-item form can produce to well inside its
// tails (the prior at ±5 is e^−12.5 of its peak).
export const THETA_MIN = -5;
export const THETA_MAX = 5;
export const THETA_STEP = 0.05;
const GRID: number[] = [];
for (let g = 0; ; g++) {
  const t = THETA_MIN + g * THETA_STEP;
  if (t > THETA_MAX + 1e-9) break;
  GRID.push(Math.round(t * 1000) / 1000);
}
export const THETA_GRID: readonly number[] = GRID;

export interface Eap {
  theta: number;
  se: number;
}

/**
 * EAP ability from a form's responses. `u[i]` is 1 for a correct answer to
 * `items[i]`, 0 otherwise. Items and responses must align; an empty form
 * returns the prior (θ 0, SE 1), which is also the honest answer.
 */
export function eap(items: readonly ItemParams[], u: readonly (0 | 1)[]): Eap {
  if (items.length !== u.length) throw new Error(`eap: ${items.length} items, ${u.length} responses`);
  // Work in logs and subtract the maximum before exponentiating: a 25-item
  // likelihood at the wrong end of the grid underflows a double otherwise.
  const logw = THETA_GRID.map((t) => {
    let ll = -0.5 * t * t; // log of the (unnormalised) N(0,1) prior
    for (let i = 0; i < items.length; i++) {
      const p = p2pl(t, items[i].a, items[i].b);
      ll += u[i] ? Math.log(p) : Math.log(1 - p);
    }
    return ll;
  });
  const top = Math.max(...logw);
  const w = logw.map((v) => Math.exp(v - top));
  const z = w.reduce((s, x) => s + x, 0);
  const theta = THETA_GRID.reduce((s, t, g) => s + t * w[g], 0) / z;
  const variance = THETA_GRID.reduce((s, t, g) => s + (t - theta) * (t - theta) * w[g], 0) / z;
  return { theta: round(theta), se: round(Math.sqrt(variance)) };
}

/** Fisher information of a form at θ — what the SE is the inverse root of, asymptotically. */
export const information = (items: readonly ItemParams[], theta: number): number =>
  items.reduce((s, it) => {
    const p = p2pl(theta, it.a, it.b);
    return s + it.a * it.a * p * (1 - p);
  }, 0);

/**
 * Φ — the standard normal CDF. Abramowitz & Stegun 7.1.26, absolute error
 * under 1.5e−7: three decimal places of a percentile, which is two more
 * than are ever printed. The share of the CALIBRATION population below θ;
 * docs/OMIB-PLAN.md §4 is explicit about whom that is.
 */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + (x < 0 ? -erf : erf));
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
