// @vitest-environment jsdom
//
// The lens store and its feed pool, in LIVE mode — the branches the demo
// suite structurally cannot reach because `window.LIVE` is undefined there.
//
// WHY THIS EXISTS. LENS_FEED_QS used to be built once at module scope, and
// LIVE.enabled flips only after the async boot — so the pool a live session
// wove into its feed was always the DEMO pool, which excludes each lens's
// seeded prefix as "already answered". Live mode starts every lens at zero,
// so those questions (about 20 of the 48) were simply unreachable from the
// feed: a feed-only user could never take `moral` past 4 of 8, while the
// blank state promised "this fills in as its questions come round in the
// feed". Nothing failed — tsc, eslint, check:globals and both smoke suites
// were green throughout, which is exactly the failure shape this repo keeps
// writing tests for.
//
// Expectations are re-derived from IS_LENSES here (seed arithmetic and all)
// rather than read back from the store, for the same reason logic-gen's
// family tests re-derive rules from the cells: an expectation computed by
// the code under test is not an expectation.
import { afterEach, describe, expect, it } from "vitest";
import "../spec/lens-defs.js";

interface LensQuestion {
  q: string;
  d: string;
  invert?: boolean;
}
interface LensDef {
  id: string;
  tier: 1 | 2;
  seed?: number;
  questions: LensQuestion[];
}
interface FeedCard {
  id: string;
  lens: string;
  qi: number;
  tier: 1 | 2;
  cat: string;
  type: string;
  prompt: string;
  selfOnly?: boolean;
  options: { label: string; count: number }[];
}
const W = window as unknown as {
  IS_LENSES: LensDef[];
  LENSES: {
    liveOn(): boolean;
    reset(): void;
    answer(id: string, i: number, val: number): void;
    answers(id: string): Record<number, number>;
    done(id: string): number;
    subscribe(fn: () => void): () => void;
  };
  LENS_FEED_QS: () => FeedCard[];
  LIVE?: { enabled: boolean };
};

const byId = (l: LensDef) => l.id;
// The demo pool's exclusion rule, re-derived: Math.round(seed × questions)
// items are pre-answered in demo mode and never enter the feed.
const demoSeedCount = (l: LensDef) => Math.round((l.seed || 0) * l.questions.length);
const idsFrom = (from: (l: LensDef) => number) =>
  W.IS_LENSES.flatMap((l) =>
    l.questions.slice(from(l)).map((_, i) => `lq-${l.id}-${from(l) + i}`),
  ).sort();

afterEach(() => {
  delete W.LIVE;
  W.LENSES.reset();
  localStorage.clear();
});

describe("LENS_FEED_QS follows liveness", () => {
  it("demo pool excludes exactly the seeded prefix", () => {
    expect(W.LENSES.liveOn()).toBe(false);
    const ids = W.LENS_FEED_QS().map((c) => c.id).sort();
    expect(ids).toEqual(idsFrom(demoSeedCount));
    // …and the exclusion is real: at least one lens seeds a nonzero prefix,
    // or this case would pass with the seed arithmetic deleted.
    expect(W.IS_LENSES.some((l) => demoSeedCount(l) > 0)).toBe(true);
  });

  it("live pool carries every question — the seeded prefix included", () => {
    W.LIVE = { enabled: true };
    expect(W.LENSES.liveOn()).toBe(true);
    const ids = W.LENS_FEED_QS().map((c) => c.id).sort();
    expect(ids).toEqual(idsFrom(() => 0));
    // The specific card the frozen snapshot could never serve: moral's
    // first question, inside the demo seed prefix.
    expect(ids).toContain("lq-moral-0");
    expect(idsFrom(demoSeedCount)).not.toContain("lq-moral-0");
  });

  it("every card's qi round-trips to the question its prompt shows", () => {
    W.LIVE = { enabled: true };
    const defs = new Map(W.IS_LENSES.map((l) => [byId(l), l]));
    for (const card of W.LENS_FEED_QS()) {
      const def = defs.get(card.lens);
      expect(def, card.id).toBeTruthy();
      expect(card.prompt, card.id).toBe(def!.questions[card.qi].q);
      expect(card.tier, card.id).toBe(def!.tier);
    }
  });

  it("is memoised per liveness and rebuilt on the flip — not a snapshot", () => {
    const demoA = W.LENS_FEED_QS();
    expect(W.LENS_FEED_QS()).toBe(demoA); // same mode → cached array
    W.LIVE = { enabled: true };
    const liveA = W.LENS_FEED_QS();
    expect(liveA).not.toBe(demoA);
    expect(liveA.length).toBeGreaterThan(demoA.length);
    delete W.LIVE;
    // flipping back rebuilds the demo pool — contents, not identity, are
    // the contract
    expect(W.LENS_FEED_QS().map((c) => c.id).sort()).toEqual(
      demoA.map((c) => c.id).sort(),
    );
  });
});
