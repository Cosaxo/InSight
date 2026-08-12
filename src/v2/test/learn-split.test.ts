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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Named imports from an untyped .js spec module (D109) — the suppressions are
// scoped to exactly that (TS7016), the purge-wipe precedent.
// @ts-expect-error TS7016 — untyped spec module
import { LEARN_CARDS, LEARN_SPLIT as splitAny, LEARN_SPLIT_SRC } from "../spec/learn-data.js";

interface LearnCard {
  id: string;
  c: number;
  p: number;
  a: string[];
}
// `W` survives for `LIVE` alone: learnMeasured() reads it off window at CALL
// time, which is the seam these cases drive.
const W = window as unknown as { LIVE?: unknown };

const card = (LEARN_CARDS as LearnCard[])[0]; // cell1 — correct index 0, 4 options

// The module is untyped, so its export arrives as `any` and every
// `.reduce((a, b) => …)` below would infer implicit-any parameters. Named once
// here rather than annotated at each call site.
const LEARN_SPLIT: (c: LearnCard) => number[] = splitAny;

afterEach(() => {
  delete W.LIVE;
});

describe("LEARN_SPLIT source seam (D32)", () => {
  it("demo mode: the authored model, reported as an estimate", () => {
    expect(LEARN_SPLIT_SRC(card)).toBe("estimate");
    const split = LEARN_SPLIT(card);
    expect(split[card.c]).toBe(card.p);
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("live with a published agg: the measured split, normalised to 100", () => {
    W.LIVE = {
      enabled: true,
      learnAgg: () => ({ tooSmall: false, total: 9, counts: { "0": 6, "1": 3 } }),
    };
    expect(LEARN_SPLIT_SRC(card)).toBe("measured");
    const split = LEARN_SPLIT(card);
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
    // 6/9 and 3/9 → floors 66/33, remainder point to the first option
    expect(split).toEqual([67, 33, 0, 0]);
  });

  it("live but below the floor, unfetched, or empty: back to the labeled estimate", () => {
    W.LIVE = { enabled: true, learnAgg: () => ({ tooSmall: true }) };
    expect(LEARN_SPLIT_SRC(card)).toBe("estimate");
    expect(LEARN_SPLIT(card)[card.c]).toBe(card.p);

    W.LIVE = { enabled: true, learnAgg: () => null };
    expect(LEARN_SPLIT_SRC(card)).toBe("estimate");

    // a published-shape doc with zeroed counts must not divide by zero
    W.LIVE = { enabled: true, learnAgg: () => ({ tooSmall: false, counts: {} }) };
    expect(LEARN_SPLIT_SRC(card)).toBe("estimate");
  });
});

describe("the knows-best row is demo furniture (D89)", () => {
  // The reveal's estimate/measured label above covers the SPLIT; the
  // "<group> knows this best" row under it is ranked on hash noise over the
  // demo cut groups and has no live counterpart, so live mode must refuse
  // it at the source (the D72 shape) rather than headline "BEd knows this
  // best" to a real user.
  it("renderKnowInsight opens with the live gate, before any ranking", () => {
    // A last-hop source pin, same style as LiveCohortBody's floor pin:
    // mounting the whole feed to reveal a learn card would exercise the
    // fixture more than the gate, and the behaviour IS this one line.
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("renderKnowInsight(q, T) {");
    expect(start, "renderKnowInsight moved — repoint this pin").toBeGreaterThan(-1);
    const beforeRanking = src.slice(start, src.indexOf("WF_CUTS", start));
    // The imported LIVE binding (D39 meter), not the window surface.
    expect(beforeRanking).toMatch(/if \(LIVE\.enabled\) return null;/);
  });
});

describe("the LIVE reconcile leaves lrn- votes alone (D95)", () => {
  // Behaviourally this needs a live snapshot notify while a know reveal is
  // on screen — the one piece learn-reserve.test.jsx's demo harness cannot
  // drive — so it gets the same last-hop pin as D89 above. A learn answer
  // is never in myVotes, and the WF_LS mirror deliberately drops lrn- keys
  // (D95), so without the skip "absent from both store and mirror" is true
  // of every know reveal on screen and each notify would wipe the one the
  // user is watching.
  it("the rollback loop skips lrn- ids before testing absence", () => {
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("this._unsubLive");
    expect(start, "the LIVE reconcile moved — repoint this pin").toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("this._unsubSubs", start));
    expect(block).toMatch(/if \(id\.indexOf\('lrn-'\) === 0\) continue;/);
  });
});
