// The one rounding rule (data/pct.ts), swept rather than sampled.
//
// This module exists because two surfaces were rounding with two copies of
// the same four lines, and those lines were wrong in a way neither surface's
// hand-picked cases could see. So the tests here are exhaustive where the
// space allows and a fixed-seed sweep where it does not — the previous
// arrangement's failure was not a missing case, it was a method that could
// only ever check the cases someone had already thought of.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sharePcts } from "./pct";

/** Every count vector of `len` options with each count in 0..max. */
function* vectors(len: number, max: number): Generator<number[]> {
  const v = new Array<number>(len).fill(0);
  for (;;) {
    if (v.some((c) => c > 0)) yield v.slice();
    let i = len - 1;
    while (i >= 0 && v[i] === max) { v[i] = 0; i -= 1; }
    if (i < 0) return;
    v[i] += 1;
  }
}

/** A fixed-seed generator, so a failure here is reproducible. */
function* sampled(len: number, max: number, n: number): Generator<number[]> {
  let seed = 12345;
  const next = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let t = 0; t < n; t++) {
    const v = Array.from({ length: len }, () => Math.floor(next() * (max + 1)));
    if (v.some((c) => c > 0)) yield v;
  }
}

describe("sharePcts — the invariants, over the whole space", () => {
  it("sums to exactly 100 for every vector of 2 to 5 options", () => {
    // A split that does not sum to 100 is visible on a stacked bar as a gap
    // or an overrun. Exhaustive to 5 options and counts 0..12: 402,216
    // vectors, which runs in well under a second.
    let checked = 0;
    for (let len = 2; len <= 5; len++) {
      for (const v of vectors(len, 12)) {
        const p = sharePcts(v);
        const sum = p.reduce((a, b) => a + b, 0);
        if (sum !== 100) expect(`${JSON.stringify(v)} summed to ${sum}`).toBe("100");
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(400_000);
  });

  it("never renders a smaller count at a larger percentage", () => {
    // THE regression. The retired rule pushed the whole residue onto the
    // largest bucket, and with many options that residue is several points:
    // pctFor([3,3,4,4,4,4,4,4,4,4]) gave [8,8,7,11,…], an option with four
    // votes drawn shorter than one with three. Over 840,000 sampled vectors
    // of 6 to 12 options it did this 13,307 times (1.58%).
    //
    // Six to twelve options is not a stress test — it is the live shapes: a
    // 10-point rating, a 12-bucket dial, a 4x3 field.
    const bad: string[] = [];
    for (let len = 6; len <= 12; len++) {
      for (const v of sampled(len, 12, 12_000)) {
        const p = sharePcts(v);
        for (let i = 0; i < len && bad.length < 3; i++) {
          for (let j = 0; j < len; j++) {
            if (v[i] > v[j] && p[i] < p[j]) {
              bad.push(`${JSON.stringify(v)} -> ${JSON.stringify(p)}`);
              break;
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("leaves the top percentage on the top count", () => {
    // world-feed-math.test.js states this as "rounding must never hand the
    // card's headline to a side that did not win" and pinned it with four
    // vectors. Under the retired rule it failed on 8,646 of the same 840,000
    // — [5,7,1,9,1,7,10] printed the 10-vote winner at 22% and a 9-vote
    // option at 23%. Unique maxima only: with two counts tied there is no
    // winner for rounding to move away from.
    const bad: string[] = [];
    for (let len = 2; len <= 12; len++) {
      for (const v of sampled(len, 12, 8_000)) {
        const mx = Math.max(...v);
        if (v.filter((c) => c === mx).length !== 1) continue;
        const p = sharePcts(v);
        if (p[v.indexOf(mx)] !== Math.max(...p) && bad.length < 3) {
          bad.push(`${JSON.stringify(v)} -> ${JSON.stringify(p)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("stays within a point of the exact share", () => {
    // What largest-remainder buys beyond the two rules above: every result
    // is floor(exact) or floor(exact)+1. The retired rule had no such bound
    // — the bucket carrying the residue could be several points out, which
    // is the same fact as the two failures above, seen from the input side.
    //
    // Accumulated and asserted ONCE, like its two siblings, and that is not
    // a style point: the first draft called expect() in the innermost loop,
    // which is ~300,000 assertion objects for the same walk. It ran in 2.9s
    // here against vitest's 5s default and timed out on CI's slower runner
    // — a test that was always going to cross, not a flake. Same vectors,
    // same bound, ~20x faster.
    const bad: string[] = [];
    for (let len = 2; len <= 12; len++) {
      for (const v of sampled(len, 12, 4_000)) {
        const total = v.reduce((a, b) => a + b, 0);
        const p = sharePcts(v);
        for (let i = 0; i < len && bad.length < 3; i++) {
          const exact = (v[i] * 100) / total;
          if (Math.abs(p[i] - exact) >= 1) {
            bad.push(`${JSON.stringify(v)} idx ${i} -> ${p[i]}, exact ${exact.toFixed(3)}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("sharePcts — the cases with a history", () => {
  it("keeps the shapes this app has always drawn", () => {
    // [1,1,1] is the one every reader checks first, and it was pinned long
    // before this module existed. The lower-index tie-break is what keeps it
    // at [34,33,33] rather than [33,34,33].
    expect(sharePcts([1, 1, 1])).toEqual([34, 33, 33]);
    // "62, not 63" — cohort.test.ts's case, and the reason headlineFor goes
    // through this rather than dividing locally. 5/8 rounds to 63, but the
    // bar beside it reads 62.
    expect(sharePcts([1, 5, 2])).toEqual([13, 62, 25]);
    expect(sharePcts([1, 1, 4])).toEqual([17, 17, 66]);
    expect(sharePcts([1, 4, 4])).toEqual([11, 45, 44]);
    expect(sharePcts([10, 3, 3])).toEqual([62, 19, 19]);
    expect(sharePcts([7, 11, 13, 17])).toEqual([15, 23, 27, 35]);
  });

  it("answers the two cases the retired rule got wrong", () => {
    // Pinned as VALUES, not just as properties, so a revert to the old rule
    // fails here with something a reader can compare.
    // Was [8,8,7,11,11,11,11,11,11,11] — four votes at 7%, three at 8%.
    expect(sharePcts([3, 3, 4, 4, 4, 4, 4, 4, 4, 4]))
      .toEqual([8, 8, 11, 11, 11, 11, 10, 10, 10, 10]);
    // Was [13,18,3,23,3,18,22] — the 10-vote winner below the 9-vote option.
    const headline = sharePcts([5, 7, 1, 9, 1, 7, 10]);
    expect(headline[6]).toBeGreaterThan(headline[3]);
  });

  it("costs equal counts a point where the old rule cost the winner one", () => {
    // Recorded rather than hidden. Three ones and a three: this rule leaves
    // the winner exact and separates the ones, the old rule kept the ones
    // together and shaved the winner. Neither is free; only one of them can
    // also invert.
    expect(sharePcts([1, 1, 1, 3])).toEqual([17, 17, 16, 50]);
  });

  it("is all zeroes for an empty cell rather than NaN", () => {
    expect(sharePcts([0, 0])).toEqual([0, 0]);
    expect(sharePcts([])).toEqual([]);
    expect(sharePcts([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("handles the degenerate shapes without special-casing them", () => {
    expect(sharePcts([5])).toEqual([100]);
    expect(sharePcts([0, 7, 0])).toEqual([0, 100, 0]);
    // Large and lopsided: the small share must not round away to nothing
    // silently — it is 0 because it IS under half a point, and the split
    // still sums to 100.
    const big = sharePcts([9999, 1]);
    expect(big).toEqual([100, 0]);
    expect(big.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

// ONE rule means one implementation, and the way this repo lost that the
// first time was not a decision — it was a copy. `pct.ts` was written to
// replace the four lines below, and four copies of them were still running
// afterwards: three in the feed's own cut panels and one in the CALL
// surface, that one under a comment calling it "the same repair every other
// split in this app makes". None of them was reachable by a test of this
// module, because a copy is not a caller.
//
// So this case reads the tree rather than the module. It is the cheapest
// thing that notices the fifth copy, and the fifth copy is the failure mode
// this file exists to prevent.
describe("nothing recomputes the retired rule", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

  /** Every source file under src/, excluding this module's own prose. */
  function sources(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) sources(full, out);
      else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(full);
    }
    return out;
  }

  // The DUMP, not the subtraction. The first version of this scan looked
  // for `+= 100 - x.reduce(` and therefore only caught the rule written on
  // one line: `map-group-stats.js` computes the residue into `drift` first
  // and dumped it on the next line, and the scan sold as "no file under
  // src/ may recompute the residue dump" walked straight past it. What is
  // unmistakable is the TARGET — the largest bucket, found by
  // `indexOf(Math.max(…))`, receiving a `+=`. Checked against the two
  // legitimate remainder computations in the tree, which this does not
  // match: `daily-questions.js` hands its remainder out in fractional
  // order (largest remainder, correct), and `world-feed.jsx` prints the
  // leftover share as a tail figure without moving anything.
  const RESIDUE_DUMP = /\w+\[\s*\w+\.indexOf\(\s*Math\.max\(/;

  // Files that may keep it, each for a reason someone wrote down.
  //
  // The demo Map's per-anchor curves are invented numbers with a 1% floor
  // per bucket, so the shared rule is not a drop-in — it would redistribute
  // that floor and change a prototype drawing nobody reads as data. The
  // live branch three lines above it already calls `sharePcts`. Excluded
  // ON PURPOSE and named here, rather than excluded by a regex that could
  // not see it, which is the difference this case exists to hold.
  const KEEPS_IT = {
    "src/v2/spec/map-group-stats.js": "demo-only curves with a per-bucket floor; the live branch uses sharePcts",
  };

  it("has no second copy of round-then-dump-the-residue anywhere in src/", () => {
    const offenders = sources(join(root, "src"))
      // pct.ts QUOTES the retired rule in the comment explaining why it is
      // retired, and this file quotes it again above. Both are the record.
      .filter((f) => !/pct\.(ts|test\.ts)$/.test(f))
      .filter((f) => !(relative(root, f) in KEEPS_IT))
      .filter((f) => RESIDUE_DUMP.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });

  it("would catch the copy it used to miss", () => {
    // The vacuity guard for the exclusion above: if the scan stopped
    // matching the named-intermediate spelling, the entry in KEEPS_IT would
    // be excluding nothing and the next copy written that way would pass.
    for (const [rel, why] of Object.entries(KEEPS_IT)) {
      expect(RESIDUE_DUMP.test(readFileSync(join(root, rel), "utf8")), why).toBe(true);
    }
  });
});
