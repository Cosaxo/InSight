// @vitest-environment jsdom
//
// Pins for the Logic test's scoring model — extracted to logic-score.ts
// precisely so these values COULD be pinned: logic-gen's ramp template is
// calibrated against this curve's midpoint ("logicPctile's curve (midpoint
// 62%) keeps meaning what it meant"), and until the 2026-08-06 review no
// test could reach it inside the overlay's IIFE.
//
// jsdom, because loadResult/saveResult speak to localStorage.
import { beforeEach, describe, expect, it } from "vitest";
import {
  FIELD_MED,
  LKEY,
  LOGIC_SEM_ITEMS,
  loadResult,
  logicBandFor,
  logicPctile,
  logicPctileFor,
  logicSecs,
  saveResult,
  type LogicResult,
} from "./logic-score";

beforeEach(() => localStorage.clear());

describe("logicPctile (the modelled curve — D53)", () => {
  it("pins the landmarks: floor, chance, midpoint, ceiling", () => {
    expect(logicPctile(0)).toBe(1); // clamped floor
    // pure guessing expects 2 of 12 with six options — the floor a random
    // clicker reads must stay low
    expect(logicPctile(2 / 12)).toBe(4);
    expect(logicPctile(6 / 12)).toBe(30);
    expect(logicPctile(0.62)).toBe(50); // the load-bearing midpoint
    expect(logicPctile(8 / 12)).toBe(58);
    // The 94 ceiling is deliberate: a perfect score is the test's ceiling,
    // and a ceiling cannot distinguish top-6% from top-1% ability. If this
    // pin surprises you, the reasoning lives in logic-score.ts and D53 —
    // change both or neither.
    expect(logicPctile(1)).toBe(94);
  });

  it("is monotone and clamped to 1..99 over the whole domain", () => {
    let prev = 0;
    for (let k = 0; k <= 12; k++) {
      const p = logicPctile(k / 12);
      expect(p).toBeGreaterThanOrEqual(Math.max(1, prev));
      expect(p).toBeLessThanOrEqual(99);
      prev = p;
    }
  });
});

describe("persistence", () => {
  it("round-trips a v2 result", () => {
    const r: LogicResult = {
      v: 2, seed: 7, gv: 1,
      marks: [true, false, true], times: [1000, 2000, 1500],
      diffs: [1, 2, 3], pctile: 30, when: 5,
    };
    saveResult(r);
    // …plus the likely range a practice result is back-filled with (D394)
    expect(loadResult()).toEqual({ ...r, band: logicBandFor(2, 3) });
  });

  it("back-fills the percentile on a v1 payload (marks + when, nothing else)", () => {
    localStorage.setItem(LKEY, JSON.stringify({ marks: [true, true, false, false], when: 1 }));
    const r = loadResult();
    expect(r?.pctile).toBe(logicPctile(0.5));
  });

  it("back-fills the likely range on a practice result, never on a verified one (D394)", () => {
    // a practice result saved before the range existed reads as a fresh
    // one would…
    localStorage.setItem(LKEY, JSON.stringify({ v: 2, marks: Array.from({ length: 25 }, (_, i) => i < 13), pctile: 46, when: 1 }));
    expect(loadResult()?.band).toEqual(logicBandFor(13, 25));
    // …while a verified result's range is the server's to compute: an old
    // one has none, and a client-computed one would rest on the curve
    // where the number may rest on the count
    localStorage.setItem(LKEY, JSON.stringify({ v: 2, verified: true, marks: [true, false], pctile: 46, when: 1 }));
    expect(loadResult()?.band).toBeUndefined();
    // …and a stored range is kept as stored
    localStorage.setItem(LKEY, JSON.stringify({ v: 2, verified: true, marks: [true], pctile: 50, band: [40, 60], when: 1 }));
    expect(loadResult()?.band).toEqual([40, 60]);
  });

  it("treats corrupt or empty storage as no result", () => {
    expect(loadResult()).toBeNull();
    localStorage.setItem(LKEY, "{not json");
    expect(loadResult()).toBeNull();
    localStorage.setItem(LKEY, JSON.stringify({ marks: [] }));
    expect(loadResult()).toBeNull();
  });
});

describe("logicSecs", () => {
  it("means the recorded times in seconds", () => {
    expect(logicSecs({ marks: [true], times: [1000, 3000], pctile: 1, when: 1 })).toBe(2);
  });

  it("falls back to the modelled median when timing predates recording", () => {
    // a v1 result has no times — reading it as 0s/puzzle would plot
    // "instant" on the Pace lens; the honest fallback is the model's median
    expect(logicSecs({ marks: [true], pctile: 1, when: 1 })).toBe(FIELD_MED);
    expect(logicSecs(null)).toBe(FIELD_MED);
  });
});

describe("logicPctileFor (the 25-item curve — D61)", () => {
  it("pins the landmarks: chance→4, half→42, midpoint→50, 20/25→90, perfect→98", () => {
    // The server copy (functions/src/logic.ts) pins these same values in
    // logic.test.ts — if either side moves alone, one suite fails.
    expect(logicPctileFor(1 / 6, 25)).toBe(4);
    expect(logicPctileFor(0.5, 25)).toBe(42);
    expect(logicPctileFor(0.54, 25)).toBe(50);
    expect(logicPctileFor(20 / 25, 25)).toBe(90);
    expect(logicPctileFor(1, 25)).toBe(98);
    expect(logicPctileFor(0, 25)).toBe(1);
  });

  it("legacy lengths keep the 12-item curve — a v1 back-fill must not re-rank", () => {
    expect(logicPctileFor(0.5, 12)).toBe(logicPctile(0.5));
    expect(logicPctileFor(0.5, 4)).toBe(logicPctile(0.5)); // truncated legacy payloads
  });
});

describe("logicBandFor (the likely range — D394)", () => {
  it("reads the curve at the score ± one standard error, clamped to the form", () => {
    expect(LOGIC_SEM_ITEMS, "the range's width moved — functions/src/logic.ts pins the same constant").toBe(2);
    expect(logicBandFor(13, 25)).toEqual([logicPctileFor(11 / 25, 25), logicPctileFor(15 / 25, 25)]);
    // the range straddles the number it qualifies
    const [lo, hi] = logicBandFor(13, 25);
    expect(lo).toBeLessThan(logicPctileFor(13 / 25, 25));
    expect(hi).toBeGreaterThan(logicPctileFor(13 / 25, 25));
    // at the ceiling the top of the range IS the ceiling: 25 + 2 clamps to 25
    expect(logicBandFor(25, 25)).toEqual([logicPctileFor(23 / 25, 25), 98]);
    // at the floor the bottom clamps to 0 of 25
    expect(logicBandFor(0, 25)).toEqual([1, logicPctileFor(2 / 25, 25)]);
    // a legacy 12-item result reads through its own curve
    expect(logicBandFor(6, 12)).toEqual([logicPctile(4 / 12), logicPctile(8 / 12)]);
  });
});
