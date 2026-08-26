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
import { numberingProblems } from "./decision-numbering.mjs";

const rec = (num, line, kind = "record") => ({ num, line, kind });

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

describe("a hole is caught, which is a renumber that shifted some and not others", () => {
  it("names the missing number", () => {
    const out = numberingProblems([rec(295, 1), rec(297, 2), rec(298, 3)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("no record claims D296");
    expect(out[0]).toContain("D295-D298");
  });

  it("names EVERY missing number, not just the first", () => {
    expect(numberingProblems([rec(1, 1), rec(5, 2)])[0]).toContain("D2, D3, D4");
  });

  it("explains that no gap is legitimate here", () => {
    // Records are amended, never deleted — so unlike most sequence checks
    // this one has no "deliberately retired" case to excuse.
    expect(numberingProblems([rec(1, 1), rec(3, 2)])[0]).toMatch(/never deleted/);
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

  it("does not let an amendment FILL a hole either", () => {
    // The mirror of the case above, and the one that would hide a real
    // fault: if amendments counted toward the sequence, a stray
    // `## D296 amendment` would silence a genuinely missing D296.
    const out = numberingProblems([rec(295, 1), rec(296, 2, "amendment"), rec(297, 3)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("no record claims D296");
  });
});
