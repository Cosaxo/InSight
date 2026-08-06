// scorecard-metrics.mjs — the "splits, not landslides" bar as a number,
// per question type (D33, amended 2026-08-06). Extracted from
// question-scorecard.mjs so the arithmetic is testable on its own; the
// scorecard imports from here and nothing else redefines it.
//
// Two formulas because the types measure different things:
//
// CATEGORICAL (binary / choice / dilemma / vote / duel): options are
// unordered, so "split" means no option dominates —
//   evenness = 1 − (maxShare − 1/n) / (1 − 1/n)
// 1.0 = perfectly even, 0.0 = unanimous.
//
// ORDINAL (scale / rating): slots are positions on one axis, and there
// maxShare mismeasures both failure modes. A rating where everyone
// answers 5–8 spreads over enough slots to keep maxShare low — shares
// (0,0,0,0,.2,.3,.3,.2,0,0) score 0.778 under the categorical formula,
// a "strong split" that is actually a consensus; and a scale at 65%
// agree / 15% disagree scores 0.75 while the UI's own headline calls it
// "65% agree". What "divides people" means on an axis is that BOTH
// sides are populated, AWAY from the middle:
//   ordinalSplit = sideBalance × spread
//   sideBalance  = 1 − |low − high| / (low + high)   (0 if nobody took a side)
//   spread       = min(1, Σ shareᵢ·|i − mid| / ((n−1)/4))
// with mid = (n−1)/2; slots below mid are "low", above are "high", and
// an exact-middle slot (scale's Neutral) sits on neither side. (n−1)/4
// is half the maximum possible mean distance, so a distribution as
// dispersed as uniform — or more — counts as fully spread rather than
// being graded on tail-heaviness. 1.0 = a real two-sided split; 0.0 =
// unanimity, including unanimity on the middle: all-Neutral scores 0,
// because a crowd that agrees to shrug is still a crowd that agrees.
//
// Both clamp to [0, 1]; both take shares (fractions summing to 1), not
// counts — the k-floor already did the privacy work upstream.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const evennessOf = (shares, n) => {
  const maxShare = Math.max(...shares);
  return clamp01(1 - (maxShare - 1 / n) / (1 - 1 / n));
};

export const ordinalSplit = (shares) => {
  const n = shares.length;
  const mid = (n - 1) / 2;
  let low = 0;
  let high = 0;
  let dist = 0;
  shares.forEach((s, i) => {
    if (i < mid) low += s;
    else if (i > mid) high += s;
    dist += s * Math.abs(i - mid);
  });
  const sided = low + high;
  const sideBalance = sided > 0 ? 1 - Math.abs(low - high) / sided : 0;
  const spread = Math.min(1, dist / ((n - 1) / 4));
  return clamp01(sideBalance * spread);
};

// The router the scorecard calls: ordinal types by name, categorical
// otherwise — feed types (vote/duel) and any future type default to the
// categorical bar, which is the safe reading for unordered options.
export const splitQualityOf = (type, shares, n) =>
  type === "scale" || type === "rating" ? ordinalSplit(shares) : evennessOf(shares, n);
