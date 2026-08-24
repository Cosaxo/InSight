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

import { describe, expect, it } from "vitest";

describe("loadWorldFeed assembles the whole demo pool", () => {
  it("joins the deferred picks without dropping the eager rate cards", async () => {
    const specIndex = await import("../spec-index.js");

    // Before the feed group: world-feed-data's own module scope has run,
    // so the pool exists and already carries place-stats.js's rate cards
    // (still concatenated eagerly — the eager place-stats.jsx imports that
    // module by name, so deferring it would buy nothing).
    const eager = window.WORLD_FEED_QS || [];
    const eagerShape = {
      n: eager.length,
      rate: eager.filter((q) => q.type === "rate").length,
      pick: eager.filter((q) => q.type === "pick").length,
    };
    expect(eagerShape.rate, `the eager rate cards went missing: ${JSON.stringify(eagerShape)}`).toBeGreaterThan(0);
    // …and NOT pick-data's 25, which is the deferral seen from outside.
    // world-catalogs.js contributes its own couple at module scope, so
    // this is a count rather than a presence test.
    expect(eager.some((q) => q.id === "pk01"), "pick-data ran eagerly — the 48 KB module is back in the first-paint graph").toBe(false);
    expect(eager.some((q) => q.id === "c02"), "world-catalogs ran eagerly — its module-scope append is back").toBe(false);

    await specIndex.loadWorldFeed();

    const pool = window.WORLD_FEED_QS || [];
    const shape = {
      n: pool.length,
      rate: pool.filter((q) => q.type === "rate").length,
      pick: pool.filter((q) => q.type === "pick").length,
    };
    expect(pool.some((q) => q.id === "pk01"), `loadWorldFeed did not join pick-data's cards: ${JSON.stringify(shape)}`).toBe(true);
    expect(pool.some((q) => q.id === "c02"), `loadWorldFeed did not join world-catalogs' cards: ${JSON.stringify(shape)}`).toBe(true);
    expect(shape.rate, `the eager half was lost on the way: ${JSON.stringify(shape)}`).toBe(eagerShape.rate);
    expect(shape.pick).toBeGreaterThan(eagerShape.pick);
  });
});
