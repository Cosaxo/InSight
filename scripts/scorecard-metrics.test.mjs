// Pins the split-quality arithmetic (scorecard-metrics.mjs; D33 as
// amended 2026-08-06). The ordinal cases each encode a failure the
// categorical formula measured wrong — every "vs the old number"
// assertion here fails if someone routes scale/rating back through
// evennessOf.
import { describe, it, expect } from "vitest";
import { evennessOf, ordinalSplit, splitQualityOf, rollupProduction } from "./scorecard-metrics.mjs";

describe("categorical evenness (unchanged bar)", () => {
  it("scores the canonical cases", () => {
    expect(evennessOf([0.5, 0.5], 2)).toBe(1);
    expect(evennessOf([0.52, 0.48], 2)).toBeCloseTo(0.96, 5);
    expect(evennessOf([1, 0], 2)).toBe(0);
    expect(evennessOf([0.25, 0.25, 0.25, 0.25], 4)).toBe(1);
  });

  it("routes every non-ordinal type, present and future, through evennessOf", () => {
    const sh = [0.7, 0.3];
    for (const type of ["binary", "choice", "dilemma", "vote", "duel", "somenewtype"]) {
      expect(splitQualityOf(type, sh, 2)).toBe(evennessOf(sh, 2));
    }
  });
});

describe("ordinal split (scale/rating)", () => {
  it("calls the motivating consensus what it is: everyone answering 5–8", () => {
    // The amendment's headline case. Categorical evenness reads this
    // rating as a 0.778 "strong split"; it is a consensus just above
    // the middle, and the axis-aware score says so.
    const sh = [0, 0, 0, 0, 0.2, 0.3, 0.3, 0.2, 0, 0];
    expect(evennessOf(sh, 10)).toBeCloseTo(0.778, 3); // the old, wrong read
    expect(ordinalSplit(sh)).toBeCloseTo(0.213, 3);
    expect(splitQualityOf("rating", sh, 10)).toBeCloseTo(0.213, 3);
  });

  it("scores a one-sided scale by its axis, not its slot spread", () => {
    // 65% agree / 15% disagree — the UI headline calls this "65% agree",
    // the categorical formula called it 0.75.
    const sh = [0.05, 0.1, 0.2, 0.4, 0.25];
    expect(evennessOf(sh, 5)).toBeCloseTo(0.75, 5);
    expect(splitQualityOf("scale", sh, 5)).toBeCloseTo(0.375, 5);
  });

  it("gives a genuinely polarized scale full marks", () => {
    expect(ordinalSplit([0.3, 0.15, 0.1, 0.15, 0.3])).toBe(1);
  });

  it("treats uniform as fully split on both ordinal sizes", () => {
    expect(ordinalSplit(Array(5).fill(0.2))).toBe(1);
    expect(ordinalSplit(Array(10).fill(0.1))).toBe(1);
  });

  it("scores unanimity at zero — including unanimity on the middle", () => {
    expect(ordinalSplit([0, 0, 1, 0, 0])).toBe(0); // all Neutral
    expect(ordinalSplit([0, 0, 0, 0, 1])).toBe(0); // all Strongly agree
    expect(ordinalSplit([1, 0, 0, 0, 0])).toBe(0); // all Strongly disagree
  });

  it("keeps a tight straddle of the midpoint low: balanced but not spread", () => {
    // Everyone answers 5 or 6 on a 10-point rating — perfectly balanced
    // sides, no dispersion: a consensus on "middle", not a split.
    const sh = [0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 0];
    expect(ordinalSplit(sh)).toBeCloseTo(0.222, 3);
  });
});

describe("production rollup (D94)", () => {
  const row = (qid, over = {}) => ({
    qid, served: true, signal: "scored", total: 40, evenness: 0.6, grade: "strong", ...over,
  });
  const prov = {
    daily: {
      "000": { source: "editorial", batch: "prototype" },
      "090": { source: "farm", batch: "2026-08-12" },
      "091": { source: "farm", batch: "2026-08-12" },
    },
    feed: { f01: { source: "editorial", batch: "prototype" } },
  };

  it("cuts scored rows by source and by vintage", () => {
    const out = rollupProduction(
      [
        row("daily-000", { evenness: 0.4, grade: "middling" }),
        row("daily-090"),
        row("daily-091", { evenness: 0.1, grade: "landslide", total: 25 }),
        row("feed-f01"),
      ],
      prov,
    );
    expect(out.bySource.editorial).toMatchObject({ questions: 2, scored: 2, strong: 1 });
    expect(out.bySource.farm).toMatchObject({ questions: 2, scored: 2, strong: 1, landslides: 1 });
    expect(out.bySource.farm.avgEvenness).toBeCloseTo(0.35, 5);
    expect(out.byVintage["farm:2026-08-12"].questions).toBe(2);
    expect(out.byVintage["editorial:prototype"].questions).toBe(2);
  });

  it("keeps unserved and below-floor rows out of the scored figures but in the counts", () => {
    const out = rollupProduction(
      [row("daily-000", { served: false, signal: "unserved", total: 0, evenness: null })],
      prov,
    );
    expect(out.bySource.editorial).toMatchObject({ questions: 1, served: 0, scored: 0, answers: 0 });
    expect(out.bySource.editorial.avgEvenness).toBeNull();
  });

  it("lands a missing row under `unknown` rather than dropping it", () => {
    // Visible, not silent — check:quality holds the join exact, so a row
    // here means the gate is red too; the rollup still tells the truth.
    const out = rollupProduction([row("daily-999")], prov);
    expect(out.bySource.unknown.questions).toBe(1);
    expect(out.byVintage["unknown:unbatched"].questions).toBe(1);
  });

  it("ignores qids from surfaces provenance does not cover", () => {
    const out = rollupProduction([row("learn-cell1"), row("duel-duo-000")], prov);
    expect(Object.keys(out.bySource)).toEqual([]);
  });
});
