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

  it("installs the subtopic leaf stock, once, and refuses it on a live session", async () => {
    // The awkward one. This stock reaches the pool by `push` — it MUTATES
    // the array rather than replacing it — so on a live session a later
    // republish would not undo it: `buildFeedGlobals` hands over an array
    // and this would be writing into that same array.
    const LIVE = (await import("../data/live.ts")).default;
    const subs = await import("../spec/world-subtopics.js");

    subs.installSubtopicStock();
    const pool = window.WORLD_FEED_QS;
    expect(pool.some((q) => q.sub === "sub_tennis")).toBe(true);
    // the retag that travels with the stock
    const var04 = pool.find((q) => q.id === "f04");
    expect(var04 && var04.sub).toBe("sub_football");
    const after = pool.length;
    subs.installSubtopicStock();
    expect(pool.length).toBe(after);

    // …and against a live pool it does nothing at all, in place or otherwise.
    //
    // The fresh module comes FIRST and the live fixture second, deliberately.
    // world-subtopics.js imports `demoPoolOpen` from world-feed-data.js,
    // whose own module scope assigns the base demo pool — so a fixture set
    // before that evaluation would be overwritten by the import rather than
    // by the thing under test. (In the app that assignment cannot land late:
    // world-feed-data is eager, so it has run before any loader, and the
    // import here is a cache hit. Its note says why it stays that way.)
    vi.resetModules();
    const fresh = await import("../spec/world-subtopics.js");
    // The store from the SAME fresh graph. `vi.resetModules()` gives
    // world-subtopics a new world-feed-data, which imports a new data/live —
    // so flipping `enabled` on the instance captured above would set it on a
    // module the guard is not reading, and the case would pass for nothing.
    const freshLive = (await import("../data/live.ts")).default;
    const live = [{ id: "feed-000", cat: "life", type: "vote", live: true, options: [] }];
    window.WORLD_FEED_QS = live;
    const wasEnabled = freshLive.enabled;
    freshLive.enabled = true;
    try {
      fresh.installSubtopicStock();
      expect(window.WORLD_FEED_QS).toBe(live);
      expect(live.length).toBe(1);
    } finally {
      freshLive.enabled = wasEnabled;
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
