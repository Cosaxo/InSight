// @vitest-environment jsdom
//
// The demo feed pool's assembly, now that half of it is deferred.
//
// WHY THIS FILE EXISTS. `pick-data.js` — 48 KB of catalogue demo stock —
// was eager for one reason: `world-feed-data.js` concatenated
// `window.PICK_QS` at MODULE SCOPE, so the pool could not be built until
// that module had run. The concat is `joinDemoPicks()` now, called from
// `loadWorldFeed()`, and pick-data rides the feed's own chunk.
//
// Both directions of that move are silent when broken, which is the whole
// argument for pinning them here rather than trusting the mount suites:
//
//   - never called, or called with the wrong array → the DEMO feed loses
//     its pick cards, and a demo feed without them looks like a demo feed.
//   - called in a LIVE session → demo catalogue cards are appended on top
//     of the published pool. The old module-scope concat could not do
//     this: it ran before `initLive` and `buildFeedGlobals` overwrote it.
//     This one runs after (`main.jsx`: `initLive().finally(… loadWorldFeed)`),
//     so the guard is the only thing standing between a live feed and
//     "Favourite Pokémon?".

import { describe, expect, it, beforeEach, vi } from "vitest";

describe("joinDemoPicks — the deferred half of the demo pool", () => {
  // Modules only. The window globals are deliberately left alone: the
  // eager graph sets several of them once (place-stats.js's
  // PLACE_RATE_QS among them), and deleting those makes a re-imported
  // world-feed-data build a pool the real app never has.
  beforeEach(() => { vi.resetModules(); });

  it("joins the catalogue picks into the pool, once", async () => {
    const { joinDemoPicks } = await import("../spec/world-feed-data.js");
    const { PICK_QS } = await import("../spec/pick-data.js");

    // The pool exists from world-feed-data's own module scope and does NOT
    // yet carry a pick card — that is the deferral, seen from inside.
    expect(Array.isArray(window.WORLD_FEED_QS)).toBe(true);
    expect(window.WORLD_FEED_QS.some((q) => q.type === "pick")).toBe(false);

    const { WF_CATALOG_QS } = await import("../spec/world-catalogs.js");
    expect(PICK_QS.length).toBeGreaterThan(0);
    expect(WF_CATALOG_QS.length).toBeGreaterThan(0);
    joinDemoPicks(PICK_QS, WF_CATALOG_QS);
    expect(window.WORLD_FEED_QS.some((q) => q.id === "pk01")).toBe(true);
    expect(window.WORLD_FEED_QS.some((q) => q.id === "c02")).toBe(true);
    const after = window.WORLD_FEED_QS.length;

    // loadWorldFeed is memoised, but a retry must not double the pool.
    joinDemoPicks(PICK_QS, WF_CATALOG_QS);
    expect(window.WORLD_FEED_QS.length).toBe(after);
  });

  it("REFUSES on a live session — the guard the deferral rests on", async () => {
    const LIVE = (await import("../data/live.ts")).default;
    const { joinDemoPicks } = await import("../spec/world-feed-data.js");
    const { PICK_QS } = await import("../spec/pick-data.js");

    // What `buildFeedGlobals()` leaves behind, in miniature: the pool is
    // the bank, and nothing demo-shaped may be appended to it.
    const live = [{ id: "feed-000", cat: "life", type: "vote", live: true, options: [] }];
    window.WORLD_FEED_QS = live;
    const wasEnabled = LIVE.enabled;
    LIVE.enabled = true;
    try {
      joinDemoPicks(PICK_QS);
      expect(window.WORLD_FEED_QS).toEqual(live);
      expect(window.WORLD_FEED_QS.some((q) => q.type === "pick")).toBe(false);
    } finally {
      LIVE.enabled = wasEnabled;
    }
  });

  it("survives an absent or empty array rather than minting an empty pool", async () => {
    const { joinDemoPicks } = await import("../spec/world-feed-data.js");
    const before = window.WORLD_FEED_QS.length;
    joinDemoPicks(undefined);
    joinDemoPicks([], undefined);
    expect(window.WORLD_FEED_QS.length).toBe(before);
  });
});
