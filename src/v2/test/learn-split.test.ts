// @vitest-environment jsdom
//
// The LEARN_SPLIT source seam (D32). One function decides whether a learn
// reveal shows measured crowd data or the authored estimate, and D1 rides
// on it choosing correctly: an authored number rendered as a measurement
// is fabricated activity. These cases pin the three states — demo,
// live-but-cold (no published agg / below the floor), live-with-data —
// and that the measured path normalises the k-floored counts to exactly
// 100 the way every other split in the app does.
import { afterEach, describe, expect, it } from "vitest";
import "../spec/learn-data.js";

interface LearnCard {
  id: string;
  c: number;
  p: number;
  a: string[];
}
const W = window as unknown as {
  LEARN_CARDS: LearnCard[];
  LEARN_SPLIT: (card: LearnCard) => number[];
  LEARN_SPLIT_SRC: (card: LearnCard) => string;
  LIVE?: unknown;
};

const card = W.LEARN_CARDS[0]; // cell1 — correct index 0, 4 options

afterEach(() => {
  delete W.LIVE;
});

describe("LEARN_SPLIT source seam (D32)", () => {
  it("demo mode: the authored model, reported as an estimate", () => {
    expect(W.LEARN_SPLIT_SRC(card)).toBe("estimate");
    const split = W.LEARN_SPLIT(card);
    expect(split[card.c]).toBe(card.p);
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("live with a published agg: the measured split, normalised to 100", () => {
    W.LIVE = {
      enabled: true,
      learnAgg: () => ({ tooSmall: false, total: 9, counts: { "0": 6, "1": 3 } }),
    };
    expect(W.LEARN_SPLIT_SRC(card)).toBe("measured");
    const split = W.LEARN_SPLIT(card);
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
    // 6/9 and 3/9 → floors 66/33, remainder point to the first option
    expect(split).toEqual([67, 33, 0, 0]);
  });

  it("live but below the floor, unfetched, or empty: back to the labeled estimate", () => {
    W.LIVE = { enabled: true, learnAgg: () => ({ tooSmall: true }) };
    expect(W.LEARN_SPLIT_SRC(card)).toBe("estimate");
    expect(W.LEARN_SPLIT(card)[card.c]).toBe(card.p);

    W.LIVE = { enabled: true, learnAgg: () => null };
    expect(W.LEARN_SPLIT_SRC(card)).toBe("estimate");

    // a published-shape doc with zeroed counts must not divide by zero
    W.LIVE = { enabled: true, learnAgg: () => ({ tooSmall: false, counts: {} }) };
    expect(W.LEARN_SPLIT_SRC(card)).toBe("estimate");
  });
});
