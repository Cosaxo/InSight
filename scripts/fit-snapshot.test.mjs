// Pins the fit snapshot (fit-snapshot.mjs; D363, the read half of
// D325's bridge crossing). The block is committed to
// content/scorecard.json, so every case here is about what a theory run
// would quote off `main`: the derived numbers, the states that publish
// as zero or null rather than as NaN or an absent key, and the rule that
// the raw loading vectors never make the trip.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fitSnapshot, readMinBasis, FIT_SOURCE, ITEMS_NOTE } from "./fit-snapshot.mjs";

// A decoded `v2_patterns/loadings` document, in the shape the REST
// reader hands over (see decode() in question-scorecard.mjs). Question
// keys are deliberately out of order — the block must sort them.
const DOC = () => ({
  k: 8,
  lastDay: "2026-09-02",
  folded: 4821,
  at: "2026-09-03T03:14:07.123456Z",
  q: {
    "feed-b": { v: [0.3, 0.4, 0, 0, 0, 0, 0, 0], n: 12, sum: 4 },
    "daily-a": { v: [0.6, 0.8, 0, 0, 0, 0, 0, 0], n: 40, sum: -10 },
    // Seeded, never folded — the zero-basis state the fit really writes.
    "feed-c": { v: [0, 0, 0, 0, 0, 0, 0, 0], n: 0, sum: 0 },
  },
  quality: {
    day: "2026-09-02",
    n: 17,
    bits: 1.2345,
    floor: 8,
    perQ: { "daily-a": { n: 9, bits: 0.9012 }, "feed-b": { n: 8, bits: 1.4 } },
    series: [
      { day: "2026-09-01", n: 11, bits: 1.1 },
      { day: "2026-09-02", n: 17, bits: 1.2345 },
    ],
    note: "prequential-online log-loss of the nightly fit itself",
  },
  displacement: {
    space: "loading",
    n: 3,
    moved: 2,
    mean: 0.0108,
    p50: 0.0012,
    p90: 0.0311,
    max: 0.0311,
    perQ: { "daily-a": 0.0311, "feed-b": 0.0012 },
  },
});

describe("fitSnapshot", () => {
  it("folds a published doc into the whole committed block", () => {
    expect(fitSnapshot(DOC(), { basis: 8 })).toEqual({
      source: FIT_SOURCE,
      publishedAt: "2026-09-03T03:14:07.123456Z",
      lastDay: "2026-09-02",
      k: 8,
      folded: 4821,
      questions: 3,
      // ns are 40, 12 and 0 → sorted [0, 12, 40]; two clear the floor.
      basis: { floor: 8, ready: 2, n: { min: 0, p50: 12, max: 40 } },
      quality: {
        day: "2026-09-02",
        n: 17,
        bits: 1.2345,
        floor: 8,
        questionsAboveFloor: 2,
        series: [
          { day: "2026-09-01", n: 11, bits: 1.1 },
          { day: "2026-09-02", n: 17, bits: 1.2345 },
        ],
        note: "prequential-online log-loss of the nightly fit itself",
      },
      displacement: {
        space: "loading",
        n: 3,
        moved: 2,
        mean: 0.0108,
        p50: 0.0012,
        p90: 0.0311,
        max: 0.0311,
        perQ: { "daily-a": 0.0311, "feed-b": 0.0012 },
      },
      items: {
        note: ITEMS_NOTE,
        perQ: {
          "daily-a": { n: 40, disc: 1, mean: -0.25 },
          "feed-b": { n: 12, disc: 0.5, mean: 0.3333 },
          "feed-c": { n: 0, disc: 0, mean: null },
        },
      },
    });
  });

  it("returns null when the fit has not published", () => {
    expect(fitSnapshot(null, { basis: 8 })).toBe(null);
    expect(fitSnapshot(undefined, { basis: 8 })).toBe(null);
  });

  it("carries nulls, not gaps, for a doc predating D325", () => {
    const doc = DOC();
    delete doc.quality;
    delete doc.displacement;
    const block = fitSnapshot(doc, { basis: 8 });
    // Present-and-null, so a reader can tell "not published" from
    // "reader forgot to look".
    expect(Object.keys(block)).toContain("quality");
    expect(Object.keys(block)).toContain("displacement");
    expect(block.quality).toBe(null);
    expect(block.displacement).toBe(null);
    // …and the rest of the block is untouched.
    expect(block.questions).toBe(3);
    expect(block.basis).toEqual({ floor: 8, ready: 2, n: { min: 0, p50: 12, max: 40 } });
    expect(block.items.perQ["daily-a"]).toEqual({ n: 40, disc: 1, mean: -0.25 });
  });

  it("is zero-safe on an empty question map", () => {
    const block = fitSnapshot({ k: 8, lastDay: "2026-09-02", folded: 0, at: "x", q: {} }, { basis: 8 });
    expect(block.questions).toBe(0);
    expect(block.basis).toEqual({ floor: 8, ready: 0, n: { min: 0, p50: 0, max: 0 } });
    expect(block.items.perQ).toEqual({});
    // A missing `q` is the same state, not a crash.
    expect(fitSnapshot({ k: 8 }, { basis: 8 }).basis.n).toEqual({ min: 0, p50: 0, max: 0 });
  });

  it("refuses the marginal at n = 0 and still states the discrimination", () => {
    const block = fitSnapshot(
      { q: { z: { v: [0.6, 0.8], n: 0, sum: 0 } } },
      { basis: 8 },
    );
    expect(block.items.perQ.z.mean).toBe(null); // never NaN on the artifact
    expect(block.items.perQ.z.disc).toBe(1);
  });

  it("passes the bounded series and mover list through as published", () => {
    const doc = DOC();
    doc.quality.series = Array.from({ length: 90 }, (_, i) => ({ day: `d${i}`, n: i, bits: i / 10 }));
    doc.displacement.perQ = Object.fromEntries(
      Array.from({ length: 63 }, (_, i) => [`q${i}`, 0.001 * (i + 1)]),
    );
    const block = fitSnapshot(doc, { basis: 8 });
    // The doc bounds both (PATTERNS_QUALITY_DAYS; movers only) — this
    // reader must not truncate a second time.
    expect(block.quality.series).toHaveLength(90);
    expect(block.quality.series[89]).toEqual({ day: "d89", n: 89, bits: 8.9 });
    expect(Object.keys(block.displacement.perQ)).toHaveLength(63);
  });

  it("keys the item profile by qid in sorted order", () => {
    const block = fitSnapshot(DOC(), { basis: 8 });
    expect(Object.keys(block.items.perQ)).toEqual(["daily-a", "feed-b", "feed-c"]);
  });

  it("never carries the raw loading vectors", () => {
    const block = fitSnapshot(DOC(), { basis: 8 });
    const keys = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); }
      }
    };
    walk(block);
    expect(keys.has("v")).toBe(false);
    // Belt: the vectors' own numbers must not appear under another name.
    expect(JSON.stringify(block)).not.toContain("0.8");
  });
});

describe("readMinBasis", () => {
  it("cross-reads the real functions/src/patternsFit.ts", () => {
    const src = readFileSync(new URL("../functions/src/patternsFit.ts", import.meta.url), "utf8");
    expect(readMinBasis(src)).toBe(8);
  });

  it("throws rather than defaulting when the constant is gone", () => {
    // A silent default would report `ready` against a floor nobody set —
    // the DECK_EPOCH cross-read's own reasoning.
    expect(() => readMinBasis("export const SOMETHING_ELSE = 8;")).toThrow(/PATTERNS_MIN_BASIS/);
    expect(() => readMinBasis(null)).toThrow(/PATTERNS_MIN_BASIS/);
  });
});
