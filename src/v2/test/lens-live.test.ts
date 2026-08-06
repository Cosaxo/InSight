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
    done(id: string): number;
    subscribe(fn: () => void): () => void;
  };
  LENS_FEED_QS: () => FeedCard[];
  LIVE?: { enabled: boolean };
};

const LS_KEY = "insight.lenses.v1";

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

  it("live cards carry selfOnly, demo cards do not (D49)", () => {
    // The flag is what tells world-feed the card's counts are authored
    // rather than measured — no aggregate exists for lens answers, which
    // stay on-device. Demo mode is all authored numbers anyway, so the
    // flag would be noise there; it must appear on every live card, or the
    // one it misses renders a fabricated split inside a live session.
    for (const card of W.LENS_FEED_QS()) {
      expect(card.selfOnly, card.id).toBeUndefined();
    }
    W.LIVE = { enabled: true };
    for (const card of W.LENS_FEED_QS()) {
      expect(card.selfOnly, card.id).toBe(true);
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

describe("the local purge drops the in-memory store (D49)", () => {
  // live.ts's purgeLocalTrace() removes every insight.* key on account
  // deletion and uid change, then dispatches insight:local-purge — the
  // uid-change path has no reload behind it, so the store must drop its
  // in-memory copy too. Before the listener existed, the copy survived
  // and the NEXT answer()'s save() wrote the previous account's lens
  // answers straight back under the new uid. vote.test.ts pins that the
  // announcement fires; these pin what the store does with it.
  const announcePurge = () => {
    localStorage.removeItem(LS_KEY); // what purgeLocalTrace just did…
    window.dispatchEvent(new Event("insight:local-purge")); // …and then says
  };

  it("empties the store without re-creating the purged key", () => {
    W.LIVE = { enabled: true };
    W.LENSES.answer("moral", 0, 4);
    expect(W.LENSES.done("moral")).toBe(1);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).ans.moral).toBeTruthy();
    announcePurge();
    expect(W.LENSES.done("moral")).toBe(0);
    // no save() in the listener: writing the key back, even empty, works
    // against "remove every local trace"
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it("the next answer starts a fresh record — the resurrection bug", () => {
    W.LIVE = { enabled: true };
    W.LENSES.answer("moral", 0, 4);
    announcePurge();
    // the new account answers ONE risk question; before the listener, this
    // save() brought the old account's moral answers back beside it
    W.LENSES.answer("risk", 0, 2);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).ans).toEqual({ risk: { 0: 2 } });
    expect(W.LENSES.done("moral")).toBe(0);
  });

  it("notifies subscribers, so mounted lens UI re-renders empty", () => {
    let calls = 0;
    const unsub = W.LENSES.subscribe(() => { calls += 1; });
    try {
      announcePurge();
      expect(calls).toBe(1);
    } finally {
      unsub();
    }
  });
});
