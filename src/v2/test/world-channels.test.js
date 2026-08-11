// @vitest-environment jsdom
//
// The chip row's always-on set, per build (D95). In the demo, the subject
// topics (sport, food, …) reach the feed through the communities that pull
// them; a live build offers no communities, so the same list would have
// left most of the seeded bank unreachable — no chip, no follow, no search
// result could surface it. A live build therefore runs every subject
// always-on, minus the two format channels its bank mapper cannot stock.
//
// The flag is read at module scope (before the live boot attaches), so each
// case re-imports against a stubbed env — the follow-seeds pattern.

import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function feedData() {
  await import("../spec/world-feed-data.js");
  return { channels: window.WORLD_CHANNELS, topics: window.WORLD_TOPICS };
}

describe("the always-on channel set, per build (D95)", () => {
  it("demo: formats only — subjects arrive through communities", async () => {
    const { channels } = await feedData();
    expect(channels).toEqual(["dilemma", "event", "people", "bigq", "places", "fav"]);
  });

  it("live: every subject runs always-on; the two stockless formats stay out", async () => {
    vi.stubEnv("VITE_V2_LIVE", "true");
    const { channels, topics } = await feedData();
    expect(channels).toContain("sport");
    expect(channels).toContain("culture");
    // data/live.ts's bank mapper emits plain votes only, so these two
    // would be dead chips filtering nothing.
    expect(channels).not.toContain("places");
    expect(channels).not.toContain("fav");
    // Derived from the topic list, so a subject added later is reachable
    // by default rather than dark until someone remembers this list.
    expect(channels).toEqual(topics.filter((t) => t.id !== "places" && t.id !== "fav").map((t) => t.id));
  });
});
