// axesFit.test.ts — the projection arithmetic, pinned where it can be
// silently wrong. A direction with the wrong sign, an inverted item
// scored forwards, or a floor that stopped flooring all still render as
// a plausible line on the Map — so each is one case here.
import { describe, expect, it } from "vitest";
import {
  AXES_MIN_AXIS_ITEMS,
  AXES_MIN_N,
  fitAxes,
  traitScores,
  type AxesItemMeta,
} from "./axesFit";

const META: AxesItemMeta[] = [
  { qid: "t-o-0", test: "big5", dim: "O" },
  { qid: "t-o-1", test: "big5", dim: "O", invert: true },
  { qid: "t-c-0", test: "big5", dim: "C" },
];

describe("traitScores", () => {
  it("scores agreement forward and an inverted item backward", () => {
    // Strongly agree (4) on the forward item, strongly disagree (0) on
    // the inverted one — both say "open", so the axis reads 100.
    const s = traitScores(
      [{ qid: "t-o-0", optionIdx: 4 }, { qid: "t-o-1", optionIdx: 0 }],
      META,
    );
    expect(s.get("big5.O")?.value).toBe(100);
  });

  it("holds the per-person floor: one answer is a coin flip, not a score", () => {
    const s = traitScores([{ qid: "t-o-0", optionIdx: 4 }], META);
    expect(AXES_MIN_AXIS_ITEMS).toBe(2);
    expect(s.has("big5.O")).toBe(false);
  });

  it("drops out-of-range votes and unknown qids the way the client scorer does", () => {
    const s = traitScores(
      [
        { qid: "t-o-0", optionIdx: 9 },
        { qid: "t-o-1", optionIdx: -1 },
        { qid: "not-a-test-item", optionIdx: 2 },
        { qid: "t-c-0", optionIdx: 2 },
      ],
      META,
    );
    expect(s.size).toBe(0);
  });
});

describe("fitAxes", () => {
  const K = 4;
  const person = (t: number[], score: number) => ({
    theta: t,
    scores: new Map([["big5.O", score]]),
  });

  it("recovers the component the score varies along, with fit near 1", () => {
    const persons = Array.from({ length: 10 }, (_, i) =>
      person([i, 0.5, -0.2, 0], i * 10),
    );
    const axes = fitAxes(persons, K, new Map([["big5.O", "Openness"]]));
    const row = axes["big5.O"];
    expect(row.n).toBe(10);
    expect(row.fit).toBeGreaterThan(0.99);
    expect(row.v[0]).toBeGreaterThan(0.99);
    expect(row.label).toBe("Openness");
    // and the direction is unit length, 4 dp
    const len = Math.sqrt(row.v.reduce((s, x) => s + x * x, 0));
    expect(len).toBeCloseTo(1, 3);
  });

  it("points the OTHER way when the score falls along the component", () => {
    const persons = Array.from({ length: 10 }, (_, i) =>
      person([i, 0, 0, 0], 100 - i * 10),
    );
    expect(fitAxes(persons, K, new Map())["big5.O"].v[0]).toBeLessThan(-0.99);
  });

  it("stays absent below the population floor — never a thin row", () => {
    const persons = Array.from({ length: AXES_MIN_N - 1 }, (_, i) =>
      person([i, 0, 0, 0], i * 10),
    );
    expect(fitAxes(persons, K, new Map())).toEqual({});
  });

  it("stays absent when the score has no lean — a zero vector is not an axis", () => {
    const flat = Array.from({ length: 12 }, (_, i) => person([i, 0, 0, 0], 50));
    expect(fitAxes(flat, K, new Map())).toEqual({});
  });

  it("ignores a person whose θ is the wrong length rather than mis-multiplying", () => {
    const persons = [
      ...Array.from({ length: AXES_MIN_N }, (_, i) => person([i, 0, 0, 0], i * 10)),
      { theta: [1, 2], scores: new Map([["big5.O", 90]]) },
    ];
    expect(fitAxes(persons, K, new Map())["big5.O"].n).toBe(AXES_MIN_N);
  });
});
