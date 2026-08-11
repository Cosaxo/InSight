// The arithmetic behind four Mirror surfaces (D99). All of it is a fold
// over `v2_question_aggs.by`, and all of it is silent when wrong — a
// divergence ranked by the wrong number still renders a plausible screen,
// which is why these cases assert the ORDERING and the edges rather than
// only the happy path.

import { describe, expect, it } from "vitest";
import {
  MAP_ANCHOR_DIM, agreement, byOf, cellFor, divergence, mixFor, pctFor,
  sliceSplit, typicality,
} from "./cohort";

// Two age bands and two genders over a 2-option question. Overall 12/8.
const BY = {
  ageBand: {
    "25-34": { "0": 9, "1": 1 },   // strongly option 0
    "35-44": { "0": 3, "1": 7 },   // leans option 1
  },
  gender: {
    Woman: { "0": 6, "1": 4 },
    Man: { "0": 6, "1": 4 },       // identical to Woman — zero divergence
  },
};
const OVERALL = [12, 8];

describe("pctFor", () => {
  it("sums to exactly 100 and puts the drift on the largest share", () => {
    // Three thirds round to 33/33/33 and lose a point. A split that does
    // not sum to 100 is visible on a stacked bar as a gap.
    expect(pctFor([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pctFor([12, 8]).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is all zeroes for an empty cell rather than NaN", () => {
    expect(pctFor([0, 0])).toEqual([0, 0]);
    expect(pctFor([])).toEqual([]);
  });
});

describe("cellFor", () => {
  it("is dense to the option count, filling absent options with zero", () => {
    // An option nobody picked has no key in the map. Sparse output would
    // render as a missing column rather than an empty one.
    expect(cellFor(BY, "ageBand", "25-34", 3)).toEqual([9, 1, 0]);
  });

  it("is null for a cell that is not there at all", () => {
    // Null, not [] — since D98 an absent cell means nobody, and the
    // caller must be able to say "nobody" rather than draw a flat bar.
    expect(cellFor(BY, "ageBand", "45-54", 2)).toBeNull();
    expect(cellFor(BY, "profession", "Carpenter", 2)).toBeNull();
    expect(cellFor(undefined, "ageBand", "25-34", 2)).toBeNull();
  });
});

describe("mixFor", () => {
  it("orders buckets biggest first and drops empty ones", () => {
    const mix = mixFor({ ageBand: { a: { "0": 2 }, b: { "0": 9 }, c: {} } }, "ageBand", 2);
    expect(mix.map((m) => m.bucket)).toEqual(["b", "a"]);
    expect(mix[0].n).toBe(9);
  });

  it("is empty for a dimension nobody has filled in", () => {
    expect(mixFor(BY, "education", 2)).toEqual([]);
  });
});

describe("sliceSplit", () => {
  it("gives one slice's percentages", () => {
    expect(sliceSplit(BY, "ageBand", "25-34", 2)).toEqual([90, 10]);
  });

  it("is null for a slice with no answers, not a row of zeroes", () => {
    expect(sliceSplit(BY, "ageBand", "45-54", 2)).toBeNull();
  });
});

describe("divergence", () => {
  it("ranks slices by their single largest gap from everyone", () => {
    // Overall is 60/40. 25-34 sits at 90/10 (gap 30); 35-44 at 30/70
    // (gap 30) — a tie broken by size, both n=10, then by insertion.
    const d = divergence(BY, "ageBand", OVERALL, 2);
    expect(d[0].gap).toBe(30);
    expect(d.map((x) => x.bucket).sort()).toEqual(["25-34", "35-44"]);
  });

  it("scores a slice that matches everyone at zero", () => {
    const d = divergence(BY, "gender", OVERALL, 2);
    expect(d.every((x) => x.gap === 0)).toBe(true);
  });

  it("ranks by the LARGEST single gap, not the summed distance", () => {
    // The reason this matters: a slice that is +20 on one option is one
    // disagreement. Summing |diff| would score it 40 (it must come back
    // somewhere) and rank it above a slice that is +25 on one option —
    // exactly backwards for a lens whose job is "where do they differ".
    const by = {
      d: {
        wide: { "0": 25, "1": 75 },   // vs 50/50 → gap 25
        split: { "0": 30, "1": 70 },  // vs 50/50 → gap 20
      },
    };
    const d = divergence(by, "d", [50, 50], 2);
    expect(d.map((x) => x.bucket)).toEqual(["wide", "split"]);
  });

  it("honours minN, and defaults to keeping everything", () => {
    // The floor here is about LEGIBILITY, not disclosure: a one-answer
    // bucket is always 100/0 and would top every ranking forever.
    const by = { d: { tiny: { "0": 1 }, big: { "0": 6, "1": 4 } } };
    expect(divergence(by, "d", [7, 4], 2).length).toBe(2);
    expect(divergence(by, "d", [7, 4], 2, 5).map((x) => x.bucket)).toEqual(["big"]);
  });
});

describe("typicality — the Map's headline claim", () => {
  it("says how many of your cohort answered as you did", () => {
    const t = typicality(BY, "ageBand", "25-34", 0, 2);
    expect(t).toEqual({ share: 90, mode: 0, withMajority: true, n: 10 });
  });

  it("knows when you went against your own cohort", () => {
    const t = typicality(BY, "ageBand", "35-44", 0, 2);
    expect(t!.withMajority).toBe(false);
    expect(t!.mode).toBe(1);
    expect(t!.share).toBe(30);
  });

  it("counts YOU in your own cohort", () => {
    // Deliberate, and the reason is consistency rather than convenience:
    // the aggregate folded your answer like everyone else's, so
    // subtracting yourself here would make the Map disagree with the
    // who-voted sheet beside it about the same group.
    const t = typicality({ d: { b: { "0": 1 } } }, "d", "b", 0, 2);
    expect(t).toEqual({ share: 100, mode: 0, withMajority: true, n: 1 });
  });

  it("is null when the cohort has no answers — never a zero", () => {
    // "Nobody your age has answered this" and "0% of people your age
    // agreed" are different sentences and only one is true.
    expect(typicality(BY, "ageBand", "45-54", 0, 2)).toBeNull();
    expect(typicality({ d: { b: {} } }, "d", "b", 0, 2)).toBeNull();
  });

  it("reports the cohort's mode even when you did not answer", () => {
    const t = typicality(BY, "ageBand", "35-44", -1, 2);
    expect(t!.mode).toBe(1);
    expect(t!.share).toBe(0);
    expect(t!.withMajority).toBe(false);
  });
});

describe("MAP_ANCHOR_DIM", () => {
  it("maps exactly the two anchors that ARE breakdown dims", () => {
    // The other six cannot be answered at all: `job` is profession, kept
    // out of the dims on purpose (D8), and the five test anchors are
    // results with no cohort aggregate anywhere. A key appearing here for
    // one of those would make MapStats fabricate again.
    expect(Object.keys(MAP_ANCHOR_DIM).sort()).toEqual(["age", "edu"]);
    expect(MAP_ANCHOR_DIM.job).toBeUndefined();
    expect(MAP_ANCHOR_DIM.big5).toBeUndefined();
  });
});

describe("agreement — the likeness behind Kindred", () => {
  it("counts only questions both answered", () => {
    const mine = { q1: 0, q2: 1, q3: 0 };
    const theirs = { q1: 0, q2: 0, q4: 1 };
    expect(agreement(mine, theirs)).toEqual({ shared: 2, same: 1, pct: 50 });
  });

  it("is zero rather than NaN with no overlap", () => {
    expect(agreement({ q1: 0 }, { q2: 0 })).toEqual({ shared: 0, same: 0, pct: 0 });
    expect(agreement({}, {})).toEqual({ shared: 0, same: 0, pct: 0 });
  });

  it("is symmetric", () => {
    const a = { q1: 0, q2: 1 };
    const b = { q1: 0, q2: 0 };
    expect(agreement(a, b)).toEqual(agreement(b, a));
  });
});

describe("byOf", () => {
  it("unwraps the breakdown and tolerates every absent shape", () => {
    expect(byOf({ by: BY })).toBe(BY);
    expect(byOf({ counts: {} })).toBeUndefined();
    expect(byOf(null)).toBeUndefined();
    expect(byOf(undefined)).toBeUndefined();
  });
});
