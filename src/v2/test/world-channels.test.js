// @vitest-environment jsdom
//
// The chip row's always-on set, per build (D96). In the demo, the subject
// topics (sport, food, …) reach the feed through the communities that pull
// them; a live build offers no communities, so the same list would have
// left most of the seeded bank unreachable — no chip, no follow, no search
// result could surface it. A live build therefore runs every subject
// always-on, minus the two format channels its bank mapper cannot stock.
//
// The flag is read at module scope (before the live boot attaches), so each
// case re-imports against a stubbed env — the follow-seeds pattern.

import { beforeEach, describe, expect, it, vi } from "vitest";
// The bank source itself, imported the way content-parity.test.jsx reads
// its own: vite resolves the JSON, so no path juggling and no fs.
import feedBank from "../../../content/feed-questions.json";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function feedData() {
  await import("../spec/world-feed-data.js");
  return { channels: window.WORLD_CHANNELS, topics: window.WORLD_TOPICS };
}

describe("the always-on channel set, per build (D96)", () => {
  it("demo: formats only — subjects arrive through communities", async () => {
    const { channels } = await feedData();
    expect(channels).toEqual(["dilemma", "event", "people", "bigq", "places", "fav"]);
  });

  it("live: every subject runs always-on; only the stockless format stays out", async () => {
    vi.stubEnv("VITE_V2_LIVE", "true");
    const { channels, topics } = await feedData();
    expect(channels).toContain("sport");
    expect(channels).toContain("culture");
    // `fav` carries real stock since D14 went live — the bank mapper emits
    // pick cards from the seeded catalog questions, so its chip filters
    // something and must be present.
    expect(channels).toContain("fav");
    // `places` alone is still a dead chip: rate cards remain demo-only.
    expect(channels).not.toContain("places");
    // Derived from the topic list, so a subject added later is reachable
    // by default rather than dark until someone remembers this list.
    expect(channels).toEqual(topics.filter((t) => t.id !== "places").map((t) => t.id));
  });

  // D96 part 3's actual claim, checked against the bank instead of against
  // the topic list it is derived from. "51 of the 73 seeded questions were
  // reachable by nothing" is an arithmetic statement about content, and the
  // list above cannot fail if content grows a topic that WORLD_TOPICS does
  // not carry — the question just goes dark again, silently, exactly as it
  // did before.
  //
  // It is also what makes the feed's topic sheet non-empty on a real
  // device: that section lists the stocked channels, so "every bank topic
  // is a channel" and "every channel the bank stocks has a row" are the
  // same sentence read from either end. The mount tests cannot check it —
  // this flag is read at module scope and the suites are demo builds — so
  // the invariant lives here, with the flag it depends on.
  it("live: every topic the feed bank actually uses is one of those channels", async () => {
    vi.stubEnv("VITE_V2_LIVE", "true");
    const { channels } = await feedData();
    const used = [...new Set(feedBank.questions.map((q) => q.cat))].sort();
    expect(used.length, "the feed bank carries no topics — the check is asserting on nothing")
      .toBeGreaterThan(0);
    expect(used.filter((t) => !channels.includes(t))).toEqual([]);
  });
});
