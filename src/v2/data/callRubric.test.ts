// The tier-A grading arithmetic (D194). This module decides whether a real
// person's sealed prediction was right, so every case here is a boundary
// where "correct" and "plausible" part company — and the one property the
// whole design turns on is that an undecidable case returns NULL rather
// than something reasonable-looking.
//
// It is the SOURCE copy of a module that also ships inside the deploy
// (functions/src/callRubric.ts, held byte-identical by `npm run
// check:calls`). Testing it here rather than twice is deliberate: two
// copies of a test would drift the way two copies of a constant do, and
// the gate is what makes one test cover both.
import { describe, expect, it } from "vitest";
import {
  CALL_NO,
  CALL_TESTS,
  CALL_YES,
  describeRubric,
  evalRubric,
  rubricFault,
  snapshotFor,
  type CallRubric,
} from "./callRubric";

const top = (threshold: number, qid = "q"): CallRubric => ({ kind: "agg", qid, test: "topShareAtLeast", threshold });
const turnout = (threshold: number, qid = "q"): CallRubric => ({ kind: "agg", qid, test: "turnoutAtLeast", threshold });
const slices = (qid = "q"): CallRubric => ({ kind: "agg", qid, test: "slicesDisagree", dim: "ageBand", buckets: ["18-24", "55-64"] });

describe("topShareAtLeast", () => {
  it("compares the LEADER's share against the threshold, at the boundary", () => {
    const at = snapshotFor(top(60), { total: 100, counts: { "0": 60, "1": 40 } });
    expect(evalRubric(top(60), at)).toBe(CALL_YES);
    const under = snapshotFor(top(60), { total: 100, counts: { "0": 59, "1": 41 } });
    expect(evalRubric(top(60), under)).toBe(CALL_NO);
  });

  it("is a share of ALL answers, not of the top two", () => {
    // 45/30/25: a clear leader, and nowhere near 60% of everyone. A
    // reading that normalised against the runner-up would say YES.
    const snap = snapshotFor(top(60), { total: 100, counts: { "0": 45, "1": 30, "2": 25 } });
    expect(evalRubric(top(60), snap)).toBe(CALL_NO);
  });

  it("refuses to grade a tie for the lead", () => {
    // Not "the lower index wins". A tied top is a question with no
    // leading option, and picking one to keep the arithmetic flowing is
    // exactly the plausible-looking answer this design refuses.
    const snap = snapshotFor(top(40), { total: 100, counts: { "0": 50, "1": 50 } });
    expect(evalRubric(top(40), snap)).toBeNull();
  });
});

describe("turnoutAtLeast", () => {
  it("reads the aggregate's total, at the boundary", () => {
    expect(evalRubric(turnout(1000), snapshotFor(turnout(1000), { total: 1000, counts: { "0": 1000 } }))).toBe(CALL_YES);
    expect(evalRubric(turnout(1000), snapshotFor(turnout(1000), { total: 999, counts: { "0": 999 } }))).toBe(CALL_NO);
  });

  it("derives the total when the aggregate carries only counts", () => {
    const snap = snapshotFor(turnout(5), { counts: { "0": 3, "1": 2 } });
    expect(snap?.total).toBe(5);
    expect(evalRubric(turnout(5), snap)).toBe(CALL_YES);
  });
});

describe("slicesDisagree", () => {
  const by = (a: Record<string, number>, b: Record<string, number>) => ({
    ageBand: { "18-24": a, "55-64": b },
  });

  it("is about the two slices' LEADERS, not their sizes", () => {
    const disagree = snapshotFor(slices(), { total: 40, counts: { "0": 20, "1": 20 }, by: by({ "0": 9, "1": 2 }, { "0": 1, "1": 8 }) });
    expect(evalRubric(slices(), disagree)).toBe(CALL_YES);
    const agree = snapshotFor(slices(), { total: 40, counts: { "0": 20, "1": 20 }, by: by({ "0": 9, "1": 2 }, { "0": 8, "1": 1 }) });
    expect(evalRubric(slices(), agree)).toBe(CALL_NO);
  });

  it("a slice with no answers is NOT AN AGREEMENT", () => {
    // The case that would quietly mark half the players wrong: an absent
    // cell folded as zero-zero reads as "same leader" to any implementation
    // that does not stop first.
    const snap = snapshotFor(slices(), { total: 40, counts: { "0": 20, "1": 20 }, by: { ageBand: { "18-24": { "0": 9 } } } });
    expect(snap).toBeNull();
    expect(evalRubric(slices(), snap)).toBeNull();
  });

  it("a tie inside one slice is undecidable, not a disagreement", () => {
    const snap = snapshotFor(slices(), { total: 40, counts: { "0": 20, "1": 20 }, by: by({ "0": 5, "1": 5 }, { "0": 8, "1": 1 }) });
    expect(evalRubric(slices(), snap)).toBeNull();
  });

  it("narrows the snapshot to the two named cells and nothing else", () => {
    // The outcome document has to stay small enough to fetch with every
    // other call's, so `inputs` carries the cells the rubric read rather
    // than the whole breakdown.
    const snap = snapshotFor(slices(), {
      total: 40,
      counts: { "0": 20, "1": 20 },
      by: { ageBand: { "18-24": { "0": 9 }, "55-64": { "1": 8 }, "25-34": { "0": 99 } }, gender: { Woman: { "0": 5 } } },
    });
    expect(Object.keys(snap!.cells!).sort()).toEqual(["18-24", "55-64"]);
  });
});

describe("snapshotFor", () => {
  it("returns nothing for an aggregate that cannot answer", () => {
    expect(snapshotFor(top(60), null)).toBeNull();
    expect(snapshotFor(top(60), undefined)).toBeNull();
    // Present but empty: nobody has answered the target yet. "Not yet" and
    // "no" are different claims and this is where they separate.
    expect(snapshotFor(top(60), { total: 0, counts: {} })).toBeNull();
  });

  it("copies rather than aliases the aggregate's maps", () => {
    const agg = { total: 10, counts: { "0": 10 } };
    const snap = snapshotFor(top(60), agg)!;
    agg.counts["0"] = 1;
    expect(snap.counts["0"]).toBe(10);
  });
});

describe("evalRubric", () => {
  it("refuses a snapshot taken of a different question", () => {
    // The join that makes re-grading meaningful: a published `inputs` from
    // one call must not silently grade another.
    const snap = snapshotFor(top(60, "q"), { total: 100, counts: { "0": 90 } });
    expect(evalRubric(top(60, "other"), snap)).toBeNull();
  });

  it("refuses an unknown test rather than defaulting to one", () => {
    const bogus = { kind: "agg", qid: "q", test: "vibes", threshold: 60 } as unknown as CallRubric;
    expect(evalRubric(bogus, { qid: "q", total: 100, counts: { "0": 90 } })).toBeNull();
  });
});

describe("rubricFault", () => {
  it("passes the three admitted shapes", () => {
    expect(rubricFault(top(60))).toBeNull();
    expect(rubricFault(turnout(1000))).toBeNull();
    expect(rubricFault(slices())).toBeNull();
  });

  it("names what is wrong, for every way a rubric can be unwritable", () => {
    expect(rubricFault(null)).toMatch(/missing/);
    expect(rubricFault({ kind: "fetch", qid: "q", test: "topShareAtLeast", threshold: 60 })).toMatch(/tier B/);
    expect(rubricFault({ kind: "agg", test: "topShareAtLeast", threshold: 60 })).toMatch(/qid/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "vibes" })).toMatch(/not one of/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "topShareAtLeast" })).toMatch(/1\.\.100/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "topShareAtLeast", threshold: 101 })).toMatch(/1\.\.100/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "turnoutAtLeast", threshold: 2.5 })).toMatch(/whole-number/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "slicesDisagree", buckets: ["a", "b"] })).toMatch(/dim/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "slicesDisagree", dim: "ageBand", buckets: ["a"] })).toMatch(/two buckets/);
    expect(rubricFault({ kind: "agg", qid: "q", test: "slicesDisagree", dim: "ageBand", buckets: ["a", "a"] })).toMatch(/itself/);
  });
});

describe("describeRubric", () => {
  it("says the basis in words, and names the question to go and read", () => {
    // The basis has to sit beside the claim, and a reader's next move is
    // to open the target — so the qid is in the sentence.
    expect(describeRubric(top(60, "daily-000"))).toContain("daily-000");
    expect(describeRubric(top(60, "daily-000"))).toContain("60%");
    expect(describeRubric(turnout(1000, "feed-f11"))).toContain("1000 answers");
    expect(describeRubric(slices("feed-f54"))).toContain("18-24");
  });
});

describe("the admitted tests", () => {
  it("are exactly the three every consumer knows about", () => {
    // A fourth added here without a card branch and a gate case would
    // ship a call the app can grade and cannot explain.
    expect([...CALL_TESTS]).toEqual(["topShareAtLeast", "turnoutAtLeast", "slicesDisagree"]);
  });
});
