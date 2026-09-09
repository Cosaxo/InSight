// One rounding rule, for every split this app draws.
//
// WHY IT IS ITS OWN MODULE. Two surfaces compute percentages from counts —
// the Mirror's `pctFor` (data/cohort.ts) and the feed's `wfPcts`
// (spec/world-feed-math.js) — and `pctFor`'s own comment already said why
// they must agree: "two surfaces rounding differently on the same numbers is
// how a 51/49 becomes a 51/48 one screen over". They agreed by both carrying
// the same four lines, which is the arrangement `check:logic-sync` and
// `check:calls` exist to police elsewhere. One implementation needs no gate.
//
// WHAT CHANGED, AND WHY IT HAD TO. Both copies used to round each share and
// then push the WHOLE residue onto the largest bucket:
//
//     const p = counts.map((c) => Math.round((c / total) * 100));
//     p[p.indexOf(Math.max(...p))] += 100 - p.reduce((a, b) => a + b, 0);
//
// That sums to 100 and reads as obviously right. It is not, and the reason is
// that the residue is not always one point: with many options each rounding
// error is small but they accumulate, and the correction lands on ONE bucket
// however large it has grown. Measured over 840,000 sampled count vectors of
// 6 to 12 options (the live shapes: a 10-point rating, a 12-bucket dial, a
// 4x3 field):
//
//   * 13,307 of them (1.58%) printed a SMALLER count at a LARGER percentage.
//     `pctFor([3,3,4,4,4,4,4,4,4,4])` gave `[8,8,7,11,...]` — an option with
//     four votes drawn shorter than one with three.
//   * 8,646 of them handed the largest percentage to a bucket that did not
//     have the most votes. `[5,7,1,9,1,7,10]` printed the 10-vote winner at
//     22% and a 9-vote option at 23%. world-feed-math.test.js states that
//     exact invariant — "a maximal bucket stays maximal. Rounding must never
//     hand the card's headline to a side that did not win" — and pinned it
//     with four hand-picked vectors, all of which happen to pass.
//
// LARGEST REMAINDER (Hamilton) instead: floor every share, then hand the
// remaining points out to the largest fractional remainders. Zero inversions
// and zero misplaced maxima over the same 840,000 vectors, and it is not luck
// — it follows from every result being either floor(exact) or floor(exact)+1,
// with the +1 handed out in remainder order. If c[i] > c[j] then exact[i] >
// exact[j], so p[i] >= p[j] always.
//
// THE COST, stated because it is real: equal counts can render one point
// apart. `[1,1,1,3]` gives `[17,17,16,50]` where the old rule gave
// `[17,17,17,49]`. Both distort somebody — the old rule shaved the winner by
// a full point — and Hamilton's total deviation from the exact shares is
// smaller (1.33 vs 1.99 there). The reason to prefer it anyway is that
// unequal rendering of equal counts is a rounding artifact, while a smaller
// count drawn larger is a claim about the data that is false.

/**
 * Integer percentages that sum to exactly 100, largest remainder first.
 *
 * Never renders a smaller count at a larger percentage, and never moves the
 * largest share off the largest count. Empty or all-zero input is all zeroes
 * rather than NaN — an unanswered question draws no bar, not a broken one.
 */
export function sharePcts(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);

  // INTEGER arithmetic, deliberately: `c * 100` before the division, and the
  // remainder as `c * 100 - floor * total` rather than a fractional part.
  // Counts are always whole votes, so this is exact — no share can land on
  // 24.999999999999996 and floor to 24. Doing it in floats worked for every
  // case tried and is the kind of thing that fails on one question in the
  // bank, three months from now, with no way to see why.
  const scaled = counts.map((c) => c * 100);
  const out = scaled.map((s) => Math.floor(s / total));
  const remainder = scaled.map((s, i) => s - out[i] * total);

  // Between 0 and counts.length - 1, always: each floor gives away less than
  // one point, and the exact shares sum to exactly 100.
  let rest = 100 - out.reduce((a, b) => a + b, 0);

  // Ties go to the lower index. Some rule is needed and this one is
  // deterministic, which is what keeps two devices drawing the same bar —
  // and it is what makes `[1,1,1]` come out `[34,33,33]` rather than
  // `[33,34,33]`, the shape this app has always drawn.
  const order = remainder
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r || a.i - b.i);

  for (let k = 0; k < order.length && rest > 0; k++, rest--) {
    out[order[k].i] += 1;
  }
  return out;
}
