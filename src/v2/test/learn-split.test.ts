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
import { LEARN_CARDS, LEARN_ORDER as orderAny, LEARN_SPLIT as splitAny, LEARN_SPLIT_SRC } from "../spec/learn-data.js";

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
const LEARN_ORDER: (c: LearnCard) => number[] = orderAny;

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

describe("LEARN_ORDER breaks the positional tell", () => {
  const cards = LEARN_CARDS as LearnCard[];

  it("returns a permutation of the card's own option indices, stably", () => {
    for (const c of cards) {
      const order = LEARN_ORDER(c);
      expect(order.slice().sort(), `${c.id} is not a permutation`).toEqual(
        c.a.map((_, i) => i),
      );
      expect(LEARN_ORDER(c), `${c.id} is not stable`).toEqual(order);
    }
  });

  it("no display slot is the answer across the bank", () => {
    // The defect this exists for: the bank's first 96 cards all authored the
    // correct answer at index 0, so before the permutation the first button
    // was right 96 times out of 96 and Learn scored reading position. Cards
    // written since vary `c` too, but the permutation is the guarantee and
    // this case is what holds it — a bank drifting back to one authored index
    // must stay harmless rather than become a tell again. Bounded rather
    // than pinned to today's counts — the guarantee is "no slot pays", not a
    // particular histogram, and a bank that grows moves the numbers.
    const slots = new Map<number, number>();
    for (const c of cards) {
      const slot = LEARN_ORDER(c).indexOf(c.c);
      slots.set(slot, (slots.get(slot) ?? 0) + 1);
    }
    const worst = Math.max(...slots.values());
    expect(
      worst / cards.length,
      `the best single guess wins ${worst}/${cards.length} — a positional strategy pays again`,
    ).toBeLessThan(0.5);
  });

  it("keeps the authored index as the recorded one", () => {
    // The half a permutation could get wrong in the direction that matters:
    // renderKnow must hand setKnow the AUTHORED index, never the slot, or
    // every stored answer and every learn-<id> aggregate cell is re-keyed
    // against a bank nobody edited. Source-pinned like the D89/D95 cases
    // below — learn-reserve.test.jsx drives the behaviour (it clicks the
    // button by its correct-answer LABEL and asserts the streak credits),
    // and this names the line that has to stay true for that to keep working.
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("LEARN_ORDER(card).map(");
    expect(start, "renderKnow no longer maps a display order — repoint this pin").toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("</button>", start));
    expect(block).toMatch(/onClick=\{\(\) => this\.setKnow\(q, ai\)\}/);
    expect(block).toMatch(/const isC = !!r && ai === r\.correct;/);
    expect(block).toMatch(/const pct = r \? r\.split\[ai\] : 0;/);
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
