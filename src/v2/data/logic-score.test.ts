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
  loadResult,
  logicPctile,
  logicSecs,
  saveResult,
  type LogicResult,
} from "./logic-score";

beforeEach(() => localStorage.clear());

describe("logicPctile (the modelled curve — D50)", () => {
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
    // pin surprises you, the reasoning lives in logic-score.ts and D50 —
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
    expect(loadResult()).toEqual(r);
  });

  it("back-fills the percentile on a v1 payload (marks + when, nothing else)", () => {
    localStorage.setItem(LKEY, JSON.stringify({ marks: [true, true, false, false], when: 1 }));
    const r = loadResult();
    expect(r?.pctile).toBe(logicPctile(0.5));
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
