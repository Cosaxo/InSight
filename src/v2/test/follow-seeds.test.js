// @vitest-environment jsdom
//
// The follow stores' first-run seeds, per build. The demo seeds exist so
// the prototype never opens onto an empty room: sample-data's `joined`
// groups become followed scenes, and one subtopic leaf is followed from
// day one. On a release device the same seeds became subscriptions the
// user never chose — Tennis, Swimming and Writing on the feed chips and
// the profile orbit — which is the D66 class again, as preferences
// instead of people.
//
// Both stores gate on the BUILD flag (VITE_V2_LIVE), not on
// window.LIVE.enabled, for the reason learn-progress.js records: the
// default can be derived before the live boot has attached, and a live
// build must not seed demo follows in that window either. The flag is a
// module-scope read, so each case re-imports the store against a stubbed
// env — the takes.test.ts harness pattern.

import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.unstubAllEnvs();
});

async function scenes() {
  // The named export, not window.SCENES (D108). vi.resetModules() above
  // means each call re-evaluates the module against the stubbed env, and a
  // fresh evaluation returns a fresh binding — which is the whole harness.
  return (await import("../spec/scenes.js")).SCENES;
}
async function friends() {
  // Same harness: the seed is decided at module scope off the build flag,
  // so the store has to be re-imported against the stubbed env.
  return (await import("../spec/follows.js")).FRIENDS;
}
async function subtopics() {
  // The named export, not window.SUBTOPICS — the mirror went with the
  // module's move off the eager list, since search-overlay.jsx (its last
  // global reader) imports the binding now too.
  const m = await import("../spec/world-subtopics.js");
  // …and the leaf STOCK is installed by the loaders rather than at module
  // scope, which is what the deferral is. offers() below reads the pool, so
  // the helper has to do what loadWorldFeed() does.
  m.installSubtopicStock();
  return m.SUBTOPICS;
}

describe("a live build starts with zero follows", () => {
  it("seeds no scenes", async () => {
    vi.stubEnv("VITE_V2_LIVE", "true");
    const SC = await scenes();
    expect(SC.list()).toEqual([]);
    expect(SC.mine()).toEqual([]);
  });

  it("seeds no subtopic leaves", async () => {
    vi.stubEnv("VITE_V2_LIVE", "true");
    const ST = await subtopics();
    expect(ST.has("sub_tennis")).toBe(false);
  });

  it("seeds no FRIENDS — the store that seeds people, and the one that never had the gate", async () => {
    // The two above seed preferences; this one seeds PEOPLE, which is the
    // worse half of the same defect. Consumers resolve the ids against
    // IS_DATA.people, so a seeded roster put twelve invented friends into
    // the Search overlay's Friends section — name, avatar, "sister ·
    // since birth · 86% match" — and invented standings into learn's
    // reveals, for a real user on a release build whose boot had not
    // attached. Those surfaces gate on `LIVE.enabled`, which is false in
    // exactly that window (`demoInProd` IS a live build that has not
    // attached, and its declaration says D1 requires suppressing the
    // seeded fake people there).
    vi.stubEnv("VITE_V2_LIVE", "true");
    const F = await friends();
    expect(F.list()).toEqual([]);
  });

  it("still seeds the demo build a circle — the gate is the build, not the feature", async () => {
    // The control. Every surface that reads this store needs a population
    // in the prototype: duels' members, learn-social's standings, the
    // search overlay's people section. A sweep that emptied it everywhere
    // would disable the demo rather than fix the release build.
    const F = await friends();
    expect(F.list().length).toBe(12);
  });

  it("still remembers what a live user actually follows", async () => {
    // The gate is on the SEED, not the store: a real follow persists and
    // survives a reload, or the fix would have disabled the feature to
    // hide its default.
    vi.stubEnv("VITE_V2_LIVE", "true");
    const SC = await scenes();
    SC.follow("chess");
    expect(SC.has("chess")).toBe(true);
    vi.resetModules();
    const SC2 = await scenes();
    expect(SC2.has("chess")).toBe(true);
    expect(SC2.list()).toEqual(["chess"]);
  });
});

describe("the demo build keeps its furniture", () => {
  it("seeds the sample-data joined scenes and the day-one leaf", async () => {
    // The control: without it the cases above pass for a store that lost
    // its seed everywhere, which would be a different bug wearing the
    // same green tick.
    const SC = await scenes();
    expect(SC.list().length).toBeGreaterThan(0);
    const ST = await subtopics();
    expect(ST.has("sub_tennis")).toBe(true);
  });
});

// D96 — the seed gate's sibling: what a surface may ADVERTISE. The seeds
// above decide what a build starts following; offers() decides what the add
// sheet, the suggestion card and search may propose. Runtime rather than the
// build flag for scenes, because offers are read at render time — after
// live.ts has attached — which is also what lets these cases drive the gate
// through the singleton instead of re-importing the world.
describe("what the follow surfaces may advertise (D96)", () => {
  it("scenes: everything in the demo, nothing once the session is live", async () => {
    const SC = await scenes();
    const LIVE = (await import("../data/live")).default;
    expect(SC.offers().map((g) => g.id)).toEqual(SC.defs().map((g) => g.id));
    const d = Object.getOwnPropertyDescriptor(LIVE, "enabled");
    Object.defineProperty(LIVE, "enabled", { value: true, writable: true, configurable: true });
    try {
      expect(SC.offers()).toEqual([]);
      // …while the dictionary underneath stays whole: existing follows and
      // scene-tagged cards still resolve their labels through defs().
      expect(SC.defs().length).toBeGreaterThan(0);
    } finally {
      if (d) Object.defineProperty(LIVE, "enabled", d);
      else delete LIVE.enabled;
    }
  });

  it("scenes: the demoInProd fallback refuses too", async () => {
    // A real user in a live build whose boot did not attach is still a real
    // user — enabled stays false there, so the gate's other half carries it.
    vi.stubEnv("VITE_V2_LIVE", "true");
    const SC = await scenes();
    const LIVE = (await import("../data/live")).default;
    expect(LIVE.enabled).toBe(false);
    expect(LIVE.demoInProd).toBe(true);
    expect(SC.offers()).toEqual([]);
  });

  it("subtopics: only stocked leaves are offered", async () => {
    const ST = await subtopics();
    // The demo pool stocks all three leaves once the stock is installed
    // (the helper above calls it, as loadWorldFeed does).
    expect(ST.offers().map((s) => s.id)).toEqual(["sub_tennis", "sub_football", "sub_running"]);
    const pool = window.WORLD_FEED_QS;
    // What a live boot leaves behind: the bank replaces the pool and tags
    // nothing with `sub` yet — so there is nothing honest to offer.
    window.WORLD_FEED_QS = [];
    try {
      expect(ST.offers()).toEqual([]);
      expect(ST.all().length).toBe(18); // the dictionary stays whole (18 since the 2026-09-11 births)
    } finally {
      window.WORLD_FEED_QS = pool;
    }
  });
});
