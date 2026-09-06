// @vitest-environment jsdom
//
// LEARN_CROWD_PCT — the crowd's rate as a number a surface may DRAW with
// no sentence beside it (D393).
//
// The Map placed every mastered fact at `card.p / 100`: the bank's authored
// difficulty hint, in live builds too. D133 stopped the cards printing that
// number and D149 stopped the live reveal drawing it, but the leaf's
// DISTANCE from You — the map's one encoded score — still read it, so how
// far every fact sat from the centre of a live Map was an author's guess.
// These cases pin the seam the placement reads now: measured at two or
// more people, null under that and null cold (the D72 fallback radius),
// the authored figure only where the build is the demo.
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error TS7016 — untyped spec module (the learn-split precedent)
import { LEARN_CARDS, LEARN_CROWD_MIN, LEARN_CROWD_PCT as pctAny } from "../spec/learn-data.js";
import LIVE from "../data/live";

interface LearnCard { id: string; c: number; p: number; a: string[] }
const LEARN_CROWD_PCT: (c: LearnCard) => number | null = pctAny;
const card = (LEARN_CARDS as LearnCard[])[0]; // correct index 0

// The stand-in installs its members ONTO the imported store singleton, as
// learn-split.test.ts does and for the same reason: learn-data.js imports
// the binding (D354), so an object on `window.LIVE` would reach nobody.
type Store = Record<string, unknown>;
const store = LIVE as unknown as Store;
const realDescriptors = new Map<string, PropertyDescriptor | undefined>();
function restoreLive() {
  for (const [k, d] of realDescriptors) {
    if (d) Object.defineProperty(store, k, d);
    else delete store[k];
  }
  realDescriptors.clear();
}
function installLive(members: Store) {
  restoreLive();
  for (const [k, v] of Object.entries(members)) {
    realDescriptors.set(k, Object.getOwnPropertyDescriptor(store, k));
    Object.defineProperty(store, k, { value: v, configurable: true, writable: true, enumerable: true });
  }
}
afterEach(restoreLive);

/** a live store whose aggregate for the card holds `n` first tries, all correct */
const liveWith = (n: number) => installLive({
  enabled: true,
  learnAgg: () => ({ tooSmall: false, total: n, counts: { "0": n } }),
  learnMine: () => null,
  learnAggLoading: () => false,
});

describe("LEARN_CROWD_PCT (D393)", () => {
  it("demo: the authored figure — the invented crowd is the content there", () => {
    expect(LEARN_CROWD_PCT(card)).toBe(card.p);
  });

  it("live: the measured rate once the floor is met", () => {
    liveWith(LEARN_CROWD_MIN);
    expect(LEARN_CROWD_PCT(card)).toBe(100);
    installLive({
      enabled: true,
      learnAgg: () => ({ tooSmall: false, total: 4, counts: { "0": 3, "1": 1 } }),
      learnMine: () => null,
      learnAggLoading: () => false,
    });
    expect(LEARN_CROWD_PCT(card)).toBe(75);
  });

  it("live: null under the floor — one first try is the reader's own", () => {
    expect(LEARN_CROWD_MIN).toBe(2);
    liveWith(1);
    expect(LEARN_CROWD_PCT(card), "one answer was handed back as a crowd rate").toBeNull();
  });

  it("live and cold: null, never the authored hint", () => {
    for (const learnAgg of [() => null, () => ({ tooSmall: true }), () => ({ tooSmall: false, counts: {} })]) {
      installLive({ enabled: true, learnAgg, learnMine: () => null, learnAggLoading: () => false });
      expect(LEARN_CROWD_PCT(card), "the authored difficulty hint leaked into a live build").toBeNull();
    }
    // …and while the read is still in the air
    installLive({ enabled: true, learnAgg: () => null, learnMine: () => null, learnAggLoading: () => true });
    expect(LEARN_CROWD_PCT(card)).toBeNull();
  });
});
