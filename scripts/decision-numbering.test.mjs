// decision-numbering.test.mjs — pins doc-index's rule 10.
//
// This gate is the one that fails silently by construction: a duplicate
// decision number is not a crash, a wrong render or a bad link. It is two
// rows in an index that both say "D297", which reads as correct until
// somebody follows a citation. The rule exists because THREE renumbers
// happened in two days and each was hand work; this file exists because a
// gate against a silent fault is itself a silent fault when it stops
// working.

import { describe, it, expect } from "vitest";
import { numberingProblems, unclaimedNumbers } from "./decision-numbering.mjs";

const rec = (num, line, kind = "record") => ({ num, line, kind });
const cited = (pairs) => new Map(pairs.map(([t, from]) => [t, new Set(from)]));
// unclaimedNumbers reports {num, citers}; most cases only care about which
// numbers came back.
const nums = (out) => out.map((u) => u.num);

describe("a sound sequence is silent", () => {
  it("says nothing about D1..D5 in order", () => {
    expect(numberingProblems([rec(1, 10), rec(2, 20), rec(3, 30), rec(4, 40), rec(5, 50)])).toEqual([]);
  });

  it("does not require the records to be in FILE order", () => {
    // DECISIONS.md is not strictly numeric — doc-index's own comment says
    // D7 sits above D6, D4 and D5. The rule is about the SET of numbers
    // claimed, not where each heading landed.
    expect(numberingProblems([rec(7, 10), rec(6, 90), rec(4, 120), rec(5, 130)])).toEqual([]);
  });

  it("is silent on an empty file rather than inventing a hole", () => {
    expect(numberingProblems([])).toEqual([]);
    expect(numberingProblems(undefined)).toEqual([]);
  });

  it("does not demand the sequence start at 1", () => {
    // It holds what it can see. A file whose lowest record is D290 has no
    // hole below D290 — the rule cannot know whether D1 ever existed, and
    // guessing would fail every partial fixture including these.
    expect(numberingProblems([rec(290, 1), rec(291, 2), rec(292, 3)])).toEqual([]);
  });
});

describe("a duplicate is caught, which is what a missed renumber leaves", () => {
  it("names both lines, so the fix does not need a search", () => {
    const out = numberingProblems([rec(295, 100), rec(296, 200), rec(296, 300)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("D296 is claimed twice");
    expect(out[0]).toContain("line 200");
    expect(out[0]).toContain("docs/DECISIONS.md:300");
  });

  it("says WHY it matters, because the reader may not see it", () => {
    // "D296 is claimed twice" reads like a formatting nit. The consequence
    // is that every citation of D296 in the tree is now ambiguous, and the
    // next author picks the number after the highest and orphans one.
    expect(numberingProblems([rec(1, 1), rec(1, 2)])[0]).toMatch(/ambiguous/);
  });

  it("reports each duplicate, not just the first", () => {
    const out = numberingProblems([rec(1, 1), rec(1, 2), rec(2, 3), rec(2, 4)]);
    expect(out).toHaveLength(2);
  });

  it("reports a triple twice — every extra claimant is one to fix", () => {
    expect(numberingProblems([rec(9, 1), rec(9, 2), rec(9, 3)])).toHaveLength(2);
  });
});

describe("a hole is REPORTED, never refused — merge order is not a gate", () => {
  // This block used to assert the opposite, and the reversal is the point.
  // Three pull requests open at once claimed D387, D388 and D389; each
  // one's own head has holes where the other two sit, so every one of them
  // was red until the others merged. That made decision numbers imply a
  // merge ORDER — a coupling nobody chose, which arrived when D385 retired
  // the shepherd that used to move colliding numbers at merge time.
  it("says nothing about a gap another branch is holding", () => {
    expect(numberingProblems([rec(386, 1), rec(389, 2)])).toEqual([]);
  });

  it("still NAMES the gap, so a genuinely lost record stays visible", () => {
    expect(nums(unclaimedNumbers([rec(295, 1), rec(297, 2), rec(298, 3)]))).toEqual([296]);
    expect(nums(unclaimedNumbers([rec(1, 1), rec(5, 2)]))).toEqual([2, 3, 4]);
  });

  it("reports nothing when the sequence is whole", () => {
    expect(unclaimedNumbers([rec(1, 1), rec(2, 2), rec(3, 3)])).toEqual([]);
    expect(unclaimedNumbers([])).toEqual([]);
    expect(unclaimedNumbers(undefined)).toEqual([]);
  });

  it("counts only records, so an amendment neither fills nor makes a gap", () => {
    const out = unclaimedNumbers([rec(295, 1), rec(296, 2, "amendment"), rec(297, 3)]);
    expect(nums(out)).toEqual([296]);
  });
});

describe("a citation into a hole is the SAME fact, so it is reported too", () => {
  // This block was written as a failure and lasted one run. A partial
  // renumber's other half is a reference left behind, pointing at a number
  // no record claims — which reads like a fault. Then the first run refused
  // the record introducing it: D400 cites D387, D388 and D389, the three
  // pull requests holding them. A hole and a citation into that hole are
  // one fact seen twice — this head does not have that number, because
  // another head does — so failing on the second while excusing the first
  // just puts merge order back under a different name.
  it("does not fail, however the citations fall", () => {
    expect(numberingProblems([rec(300, 1), rec(301, 2)])).toEqual([]);
  });

  it("names the citers on the hole they point into", () => {
    const out = unclaimedNumbers([rec(300, 1), rec(302, 2)], cited([[301, [302]]]));
    expect(out).toEqual([{ num: 301, citers: [302] }]);
  });

  it("lists every citer of the same number, sorted", () => {
    const out = unclaimedNumbers([rec(300, 1), rec(302, 2)], cited([[301, [302, 300]]]));
    expect(out[0].citers).toEqual([300, 302]);
  });

  it("leaves citers empty for a hole nothing points at", () => {
    const out = unclaimedNumbers([rec(1, 1), rec(3, 2)], cited([[1, [3]]]));
    expect(out).toEqual([{ num: 2, citers: [] }]);
  });

  it("reports a citation ABOVE the last record, which no gap would reach", () => {
    // The one case the hole scan alone cannot see: a typo'd D400 in a tree
    // ending at D390 is past the end of the sequence, so without the
    // citation map it falls off and nothing ever mentions it.
    const out = unclaimedNumbers([rec(389, 1), rec(390, 2)], cited([[400, [390]]]));
    expect(out).toEqual([{ num: 400, citers: [390] }]);
  });

  it("says nothing when every citation lands on a record", () => {
    expect(unclaimedNumbers([rec(1, 1), rec(2, 2)], cited([[1, [2]]]))).toEqual([]);
  });

  it("works with no citation map, because the unit cases call it that way", () => {
    expect(nums(unclaimedNumbers([rec(1, 1), rec(3, 2)]))).toEqual([2]);
  });
});

describe("amendments claim no number, which is the whole reason for `kind`", () => {
  it("lets an amendment share its parent's number", () => {
    // D7 and `D7 amendment (2026-08-03)` both say D7. Only one claims it.
    // Counting the amendment would make every amended record a duplicate —
    // and DECISIONS.md has many, so this is not an edge case, it is most of
    // the file's follow-ons.
    expect(numberingProblems([rec(7, 10), rec(7, 20, "amendment"), rec(8, 30)])).toEqual([]);
  });

  it("treats an adoption the same way", () => {
    expect(numberingProblems([rec(7, 10), rec(7, 20, "adoption")])).toEqual([]);
  });

  it("does not let an amendment CLAIM a number a record still needs", () => {
    // The mirror of the case above. An amendment sharing D296 must not make
    // the tree look as though D296 is claimed — the reporting case in the
    // hole block asserts the same thing from the other side.
    const out = unclaimedNumbers([rec(295, 1), rec(296, 2, "amendment"), rec(297, 3)]);
    expect(nums(out)).toEqual([296]);
  });
});
