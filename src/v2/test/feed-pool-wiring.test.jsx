// @vitest-environment jsdom
//
// That `loadWorldFeed()` actually performs the join — the half a unit test
// of `joinDemoPicks` cannot see. What can go wrong here is the CALL: a
// missed await, the wrong export threaded through, the two imports ordered
// the other way. None of that is visible from inside the function, and all
// of it presents as a demo feed with no catalogue cards, which looks like a
// demo feed.
//
// ITS OWN FILE, deliberately. This walks the real eager graph and then the
// real feed group, so it has to run against a pristine module registry —
// feed-pool.test.jsx resets modules between its cases and imports
// world-feed-data without place-stats, which leaves a pool the app never
// has (13 rate cards short). One import of spec-index, one loader, no
// beforeEach.
//
// The loadOverlays half of this used to sit at the bottom of this file and
// could not fail: by the time it ran, the case above had already called
// loadWorldFeed() in the same module registry, and the stock install is
// idempotent behind a module-level flag. It is its own file now
// (overlays-wiring.test.jsx) for exactly the reason this one is — vitest
// gives each file a pristine registry, which is the only place "alone"
// means alone.

import { describe, expect, it } from "vitest";

describe("loadWorldFeed assembles the whole demo pool", () => {
  it("joins every deferred set and leaves none of them eager", async () => {
    const specIndex = await import("../spec-index.js");

    // Before the feed group: world-feed-data's own module scope has run, so
    // the pool exists — and holds nothing but its own literal. All four
    // demo sets that used to reach it by writing at module scope are now
    // handed over by a loader, so their absence HERE is the deferral seen
    // from outside. Each id names the module that would be back in the
    // first-paint graph if its assertion failed.
    const eager = window.WORLD_FEED_QS || [];
    expect(eager.length).toBeGreaterThan(0);
    expect(eager.some((q) => q.id === "pk01"), "pick-data ran eagerly (48 KB)").toBe(false);
    expect(eager.some((q) => q.id === "c02"), "world-catalogs ran eagerly").toBe(false);
    expect(eager.some((q) => q.sub === "sub_tennis"), "world-subtopics ran eagerly").toBe(false);
    expect(eager.some((q) => q.type === "rate"), "place-stats ran eagerly").toBe(false);

    await specIndex.loadWorldFeed();

    const pool = window.WORLD_FEED_QS || [];
    const shape = {
      n: pool.length,
      rate: pool.filter((q) => q.type === "rate").length,
      pick: pool.filter((q) => q.type === "pick").length,
      sub: pool.filter((q) => q.sub).length,
    };
    expect(pool.some((q) => q.id === "pk01"), `pick-data's cards missing: ${JSON.stringify(shape)}`).toBe(true);
    expect(pool.some((q) => q.id === "c02"), `world-catalogs' cards missing: ${JSON.stringify(shape)}`).toBe(true);
    expect(pool.some((q) => q.sub === "sub_tennis"), `the subtopic stock missing: ${JSON.stringify(shape)}`).toBe(true);
    expect(shape.rate, `place-stats' rate cards missing: ${JSON.stringify(shape)}`).toBeGreaterThan(0);
    // …and the demo Mirror's Scores lens, which is the .jsx half: it reads
    // this global at render, and its group is the one main.jsx re-renders
    // the root after — which is why it rides here rather than loadOverlays.
    expect(typeof window.PlaceStatsCard, "place-stats.jsx did not publish PlaceStatsCard").toBe("function");
  });
});
