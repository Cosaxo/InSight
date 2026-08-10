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
  await import("../spec/scenes.js");
  return window.SCENES;
}
async function subtopics() {
  await import("../spec/world-subtopics.js");
  return window.SUBTOPICS;
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
