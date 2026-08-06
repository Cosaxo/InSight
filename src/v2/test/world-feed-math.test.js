// The World feed's arithmetic, which had no test at all while it was buried
// in a 2,500-line component.
//
// WHAT EARNS A TEST HERE. Not the gradient helpers' exact CSS — that is
// presentation, and pinning the string would just make a restyle fail a
// suite. What is pinned is the two properties those helpers are relied on
// FOR (a valid background-image layer, and determinism per seed), plus every
// function that produces a number a user reads as fact.
//
// `wfPcts` is the reason this file exists. It is the split on every feed
// card and it does two non-obvious things:
//
//   1. It ADDS the viewer's own vote. data/live.ts deliberately excludes it
//      from the stored counts ("the UI adds its own +1 for you, so including
//      it here would double-count"), so the +1 here is the other half of
//      that contract. Breaking either half silently shifts every percentage.
//   2. It forces the rounded parts to sum to exactly 100 by pushing the
//      rounding residue onto the largest bucket — because three-way splits
//      round to 99 or 101 more often than not, and a split that does not sum
//      to 100 reads as a bug in the product's central claim.

import { describe, expect, it } from "vitest";

import {
  wfCatArt, wfFmt, wfHash, wfKnowBias, wfKnowRate, wfPcts, wfPickGroup,
  wfRateAvg, wfRateBg, wfTileArt, wfTint,
} from "../spec/world-feed-math.js";

describe("wfPcts — the split a user reads", () => {
  it("counts the viewer's own vote, which the store leaves out", () => {
    // live.ts hands over counts EXCLUDING you; mineIdx is where you go.
    expect(wfPcts([3, 3], 0).total).toBe(7);
    expect(wfPcts([3, 3], -1).total).toBe(6); // no vote yet — nothing added
    // and it lands in the right bucket
    expect(wfPcts([0, 0], 0).p).toEqual([100, 0]);
    expect(wfPcts([0, 0], 1).p).toEqual([0, 100]);
  });

  it("always sums to exactly 100, including the thirds that do not divide", () => {
    const cases = [
      [[1, 1, 1], -1],   // 33.3 each → 99 before correction
      [[1, 1, 1], 0],
      [[2, 1], -1],      // 66.67 / 33.33
      [[1, 1, 1, 1, 1, 1], -1],
      [[7, 11, 13, 17], 2],
      [[999, 1], 1],
      [[1], 0],
    ];
    for (const [counts, mine] of cases) {
      const { p } = wfPcts(counts, mine);
      expect(p.reduce((a, b) => a + b, 0), `${JSON.stringify(counts)} @${mine}`).toBe(100);
    }
  });

  it("puts the rounding residue on the LARGEST bucket, not an arbitrary one", () => {
    // These cases are chosen because they distinguish max from min. A first
    // draft used [1,1,1] and [10,3,3]: the first is symmetric so the two
    // rules pick the same bucket, and in the second the residue is too small
    // to change the winner — so swapping Math.max for Math.min passed the
    // whole suite. Verified by making that swap and watching these fail.
    expect(wfPcts([1, 1, 4], -1).p).toEqual([17, 17, 66]);   // min would give [16,17,67]
    expect(wfPcts([1, 4, 4], -1).p).toEqual([11, 45, 44]);   // min would give [12,44,44]
    expect(wfPcts([1, 1, 1, 3], -1).p).toEqual([17, 17, 17, 49]);

    // …and the general property those pin: whichever bucket absorbed the
    // residue, a maximal bucket stays maximal. Rounding must never hand the
    // card's headline to a side that did not win.
    for (const counts of [[1, 1, 4], [1, 4, 4], [10, 3, 3], [7, 11, 13, 17]]) {
      const { p } = wfPcts(counts, -1);
      const winner = counts.indexOf(Math.max(...counts));
      expect(p[winner], JSON.stringify(counts)).toBe(Math.max(...p));
    }
  });

  it("returns the raw total alongside, since cards print it", () => {
    expect(wfPcts([4, 5, 6], -1).total).toBe(15);
  });
});

describe("wfHash — the determinism everything else leans on", () => {
  it("is stable for a given string and lands in [0,1)", () => {
    for (const s of ["", "q-1", "q-1|age|x", "é中", "a".repeat(300)]) {
      const v = wfHash(s);
      expect(v, s).toBeGreaterThanOrEqual(0);
      expect(v, s).toBeLessThan(1);
      expect(wfHash(s), s).toBe(v); // same input, same answer, always
    }
  });

  it("separates neighbouring seeds", () => {
    // Not a distribution claim — just that one-character differences do not
    // collide, which is what the per-card texture and per-group drift need.
    const seen = new Set(Array.from({ length: 200 }, (_, i) => wfHash(`q-${i}`)));
    expect(seen.size).toBe(200);
  });
});

describe("wfFmt — vote counts", () => {
  it("abbreviates at a thousand and not before", () => {
    expect(wfFmt(0)).toBe("0");
    expect(wfFmt(999)).toBe("999");
    expect(wfFmt(1000)).toBe("1K");
    expect(wfFmt(1100)).toBe("1.1K");
    expect(wfFmt(12345)).toBe("12.3K");
    expect(wfFmt(2000)).toBe("2K"); // the .0 is trimmed, not printed
  });
});

describe("the deterministic drifts stay inside their stated bounds", () => {
  it("wfKnowRate clamps to 4..97 whatever the input", () => {
    for (const p of [-50, 0, 1, 50, 99, 150]) {
      for (const key of ["a", "b", "c", "d", "e"]) {
        const v = wfKnowRate("q", key, p, 0);
        expect(v).toBeGreaterThanOrEqual(4);
        expect(v).toBeLessThanOrEqual(97);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("wfRateAvg clamps to 1.2..9.9, the 1-10 scale's usable range", () => {
    for (const avg of [-5, 0, 1, 5.5, 10, 99]) {
      for (const key of ["a", "b", "c"]) {
        const v = wfRateAvg("q", key, avg);
        expect(v).toBeGreaterThanOrEqual(1.2);
        expect(v).toBeLessThanOrEqual(9.9);
      }
    }
  });

  it("wfKnowBias applies a direction to education only, and centres on zero", () => {
    // The whole point of the exception: pure noise produced headlines like
    // "Trade school beats Doctorate", so edu gets a monotonic ramp.
    const ramp = [0, 1, 2, 3, 4].map((i) => wfKnowBias("edu", null, 5, i));
    expect(ramp).toEqual([...ramp].sort((a, b) => a - b));
    expect(ramp[0]).toBeLessThan(0);
    expect(ramp[4]).toBeGreaterThan(0);
    expect(ramp.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);

    // every other dimension, and edu-with-an-axis, stay unbiased
    expect(wfKnowBias("age", null, 5, 0)).toBe(0);
    expect(wfKnowBias("edu", "some-axis", 5, 0)).toBe(0);
    expect(wfKnowBias("edu", null, 1, 0)).toBe(0); // n === 1 would divide by zero
  });
});

describe("wfPickGroup — a group's ranking of the same counts", () => {
  const ranked = [
    { id: "a", count: 100 }, { id: "b", count: 40 },
    { id: "c", count: 38 }, { id: "d", count: 5 },
  ];

  it("returns shares in descending order that never exceed the head share", () => {
    const out = wfPickGroup("q1", "age:25-34", ranked, 0.62);
    expect(out.map((r) => r.share)).toEqual([...out.map((r) => r.share)].sort((a, b) => b - a));
    expect(out.reduce((a, r) => a + r.share, 0)).toBeCloseTo(0.62, 10);
    expect(out).toHaveLength(ranked.length);
  });

  it("is deterministic per (question, group) and differs between groups", () => {
    const a1 = wfPickGroup("q1", "g1", ranked, 0.6).map((r) => r.it.id);
    const a2 = wfPickGroup("q1", "g1", ranked, 0.6).map((r) => r.it.id);
    expect(a2).toEqual(a1);
    // Different groups reweight differently — that difference IS the feature.
    const groups = ["g1", "g2", "g3", "g4", "g5", "g6"].map(
      (g) => wfPickGroup("q1", g, ranked, 0.6).map((r) => r.it.id).join(","),
    );
    expect(new Set(groups).size).toBeGreaterThan(1);
  });

  it("survives an empty ranking rather than dividing by zero", () => {
    expect(wfPickGroup("q1", "g1", [], 0.6)).toEqual([]);
  });
});

describe("the texture helpers", () => {
  // Deliberately NOT pinning the exact gradient strings — that is styling.
  // Pinned instead: they are valid background-image layers (a bare colour
  // computes to `none`, which the comment in wfTileArt records as a real
  // bug once), and they are stable per seed.
  it("always produce a gradient layer, never a bare colour", () => {
    for (let i = 0; i < 40; i++) {
      for (const fn of [wfTileArt, wfCatArt]) {
        const css = fn("oklch(0.52 0.14 40)", `seed-${i}`);
        expect(css, `${fn.name}(seed-${i})`).toMatch(/gradient\(/);
      }
    }
  });

  it("are stable for a seed", () => {
    expect(wfTileArt("red", "s")).toBe(wfTileArt("red", "s"));
    expect(wfCatArt("red", "s")).toBe(wfCatArt("red", "s"));
  });

  it("wfTint weakens monotonically with rank and never inverts", () => {
    const pct = (css) => Number(/\s([\d.]+)%/.exec(css)[1]);
    const strengths = [0, 1, 2, 3].map((r) => pct(wfTint("red", r, 4)));
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
    expect(strengths[0]).toBeGreaterThan(strengths[3]);
    // a rank past the end clamps rather than going negative
    expect(pct(wfTint("red", 99, 4))).toBe(strengths[3]);
  });

  it("wfRateBg strengthens with the score", () => {
    const pct = (css) => Number(/\s([\d.]+)%/.exec(css)[1]);
    expect(pct(wfRateBg("red", 1))).toBeLessThan(pct(wfRateBg("red", 9)));
  });
});
