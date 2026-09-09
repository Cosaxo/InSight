// The cohort prior's arithmetic (D432), pinned without a device:
//
//   1. No group, no move — the prior IS the world, and says so with an
//      empty row list so the caller can fall back to the row exactly.
//   2. A cell is shrunk toward the world by twenty pseudo-answers, so a
//      handful of unanimous answers is a lean and not a certainty.
//   3. Groups combine as naïve Bayes: two that agree are surer than
//      either; one that is even changes nothing.
//   4. An opt-out or an empty anchor is not a group; a city speaks
//      instead of its country when its cell can carry itself, and the
//      country speaks instead of a thin city.
//   5. Shares stay off 0 and 1 (finite log-ratios) and sum to one, for
//      two options and for more.
import { describe, expect, it } from "vitest";
import { PRIOR_CLAMP, PRIOR_SHRINK, cohortPrior, priorBuckets } from "./cohortPrior";
import type { ByMap } from "./cohort";

const by = (cells: Record<string, Record<string, [number, number]>>): ByMap =>
  Object.fromEntries(Object.entries(cells).map(([dim, buckets]) => [
    dim,
    Object.fromEntries(Object.entries(buckets).map(([b, [c0, c1]]) => [b, { "0": c0, "1": c1 }])),
  ]));
const coin = [0.5, 0.5];
const total = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("the cohort prior", () => {
  it("is the world when no group can speak, with an empty row list", () => {
    expect(cohortPrior(undefined, { ageBand: "25-34" }, coin)).toEqual({ shares: coin, world: coin, rows: [] });
    expect(cohortPrior(by({ ageBand: { "35-44": [80, 20] } }), { ageBand: "25-34" }, coin).rows).toEqual([]);
    expect(cohortPrior(by({ ageBand: { "25-34": [80, 20] } }), {}, coin).rows).toEqual([]);
    // an empty cell is no basis either
    expect(cohortPrior(by({ ageBand: { "25-34": [0, 0] } }), { ageBand: "25-34" }, coin).rows).toEqual([]);
  });

  it("shrinks a cell toward the world by PRIOR_SHRINK pseudo-answers", () => {
    const p = cohortPrior(by({ ageBand: { "25-34": [5, 0] } }), { ageBand: "25-34" }, coin);
    // (5 + 20·0.5) / (5 + 20)
    expect(p.rows).toEqual([{ dim: "ageBand", bucket: "25-34", n: 5, shares: [0.6, 0.4] }]);
    expect(p.shares[0]).toBeCloseTo(0.6, 6);
    const big = cohortPrior(by({ ageBand: { "25-34": [100, 0] } }), { ageBand: "25-34" }, coin);
    expect(big.shares[0]).toBeCloseTo(110 / 120, 6);
    // and past the clamp, unanimity is very sure rather than certain
    const huge = cohortPrior(by({ ageBand: { "25-34": [5000, 0] } }), { ageBand: "25-34" }, coin);
    expect(huge.shares[0]).toBeCloseTo(1 - PRIOR_CLAMP, 6);
    expect(PRIOR_SHRINK).toBe(20);
  });

  it("combines groups as naïve Bayes — two that agree are surer than either, an even one changes nothing", () => {
    const one = cohortPrior(by({ ageBand: { "25-34": [80, 20] } }), { ageBand: "25-34" }, coin);
    const two = cohortPrior(
      by({ ageBand: { "25-34": [80, 20] }, gender: { female: [80, 20] } }),
      { ageBand: "25-34", gender: "female" },
      coin,
    );
    // each cell shrinks to (80+10)/120 = 0.75; odds 3 × 3 = 9 → 0.9
    expect(one.shares[0]).toBeCloseTo(0.75, 6);
    expect(two.shares[0]).toBeCloseTo(0.9, 6);
    const even = cohortPrior(
      by({ ageBand: { "25-34": [80, 20] }, gender: { female: [40, 40] } }),
      { ageBand: "25-34", gender: "female" },
      coin,
    );
    expect(even.shares[0]).toBeCloseTo(0.75, 6);
    expect(even.rows.map((r) => r.dim)).toEqual(["ageBand", "gender"]);
    // and it starts from the WORLD's split, not from a coin
    const skewed = cohortPrior(by({ gender: { female: [40, 40] } }), { gender: "female" }, [0.8, 0.2]);
    // the cell is even but the shrink pulls it toward 0.8: (40+16)/100 = 0.56;
    // ratio 0.56/0.8 against 0.44/0.2 → below the world's 0.8
    expect(skewed.shares[0]).toBeLessThan(0.8);
    expect(skewed.shares[0]).toBeGreaterThan(0.5);
  });

  it("an opt-out or an empty anchor is not a group, and city and country are one nesting", () => {
    const map = by({
      gender: { "Prefer not to say": [90, 10], Other: [90, 10] },
      city: { "Oslo, NO": [30, 0], "Bergen, NO": [3, 0] },
      country: { NO: [0, 300] },
    });
    expect(priorBuckets(map, { gender: "Prefer not to say", ageBand: " " })).toEqual([]);
    expect(priorBuckets(map, { gender: "Other" })).toEqual([]);
    // Oslo's cell holds thirty: the city speaks, the country is skipped
    expect(priorBuckets(map, { city: "Oslo, NO", country: "NO" })).toEqual([{ dim: "city", bucket: "Oslo, NO" }]);
    // Bergen's holds three: the country speaks instead
    expect(priorBuckets(map, { city: "Bergen, NO", country: "NO" })).toEqual([{ dim: "country", bucket: "NO" }]);
    // a city with no cell at all on this question falls to its country too
    expect(priorBuckets(map, { city: "Tromsø, NO", country: "NO" })).toEqual([{ dim: "country", bucket: "NO" }]);
    // and the two lean opposite ways, so which speaks is the whole answer
    expect(cohortPrior(map, { city: "Oslo, NO", country: "NO" }, coin).shares[0]).toBeGreaterThan(0.5);
    expect(cohortPrior(map, { city: "Bergen, NO", country: "NO" }, coin).shares[0]).toBeLessThan(0.5);
  });

  it("keeps every share off 0 and 1 and summing to one, for two options and for more", () => {
    const sure = cohortPrior(
      by({ ageBand: { "25-34": [1000, 0] }, gender: { female: [1000, 0] }, country: { NO: [1000, 0] } }),
      { ageBand: "25-34", gender: "female", country: "NO" },
      coin,
    );
    expect(sure.shares[0]).toBeLessThanOrEqual(1 - PRIOR_CLAMP);
    expect(sure.shares[1]).toBeGreaterThanOrEqual(PRIOR_CLAMP);
    expect(total(sure.shares)).toBeCloseTo(1, 9);
    // three options: the cell favours the middle one
    const three: ByMap = { ageBand: { "25-34": { "0": 10, "1": 80, "2": 10 } } };
    const p = cohortPrior(three, { ageBand: "25-34" }, [1 / 3, 1 / 3, 1 / 3]);
    expect(p.shares[1]).toBeGreaterThan(p.shares[0]);
    expect(p.shares[0]).toBeCloseTo(p.shares[2], 9);
    expect(total(p.shares)).toBeCloseTo(1, 9);
    // a degenerate world is uniform rather than a division by zero
    expect(cohortPrior(undefined, {}, [0, 0]).world).toEqual([0.5, 0.5]);
  });
});
