// @vitest-environment jsdom
//
// THE ONE LINE BETWEEN A RELEASE BUILD AND 128 INVENTED QUESTIONS.
//
// `world-feed-data.js` carries the demo pool and writes it to
// `window.WORLD_FEED_QS` at module scope. While the file was EAGER that
// write was harmless: it ran before `initLive`, so `buildFeedGlobals`
// (data/live.ts) overwrote it with the real feed a moment later. The file
// now arrives through `loadWorldFeed()`, which `main.jsx` runs in
// `initLive().finally(…)` — AFTER the live boot — so the write happens last
// and an unguarded one replaces the published feed with demo stock carrying
// fabricated vote counts.
//
// `demoPoolOpen()` is that guard, and it had no test: removing
// `if (demoPoolOpen())` left the whole unit suite green. That is D280's
// failure verbatim — a name written by the typed layer, read by the spec
// layer, and fabricated counts shipped to a release build for a day —
// which is the one this tree has already paid for once.
//
// ITS OWN FILE, for the reason feed-pool-wiring.test.jsx gives at its own
// top: the guard is read at MODULE SCOPE, so the store has to be live
// before the import, and vitest gives each file a pristine registry — which
// is the only place "before the import" means before it.

import { afterAll, describe, expect, it } from "vitest";
import { installLive } from "./live-fixture";

const live = installLive();

afterAll(() => { live.restore(); });

describe("the demo feed pool is not written over a live one", () => {
  it("leaves the published feed alone when the store is live", async () => {
    // What buildFeedGlobals leaves behind, in miniature: a real card, on
    // the global the demo pool writes to.
    window.WORLD_FEED_QS = [{ id: "live-card-1", prompt: "A published question", live: true }];

    // Module scope runs here, and the guard with it.
    await import("../spec/world-feed-data.js");

    const pool = window.WORLD_FEED_QS || [];
    expect(pool.map((q) => q.id), "the demo pool overwrote the published feed").toEqual(["live-card-1"]);
    // Named rather than counted: the pool's size is the feed lane's own
    // write surface and moves every day, but `f01` is demo stock and must
    // never be in a live pool whatever the size.
    expect(pool.some((q) => q.id === "f01"), "a demo card reached a live feed pool").toBe(false);
  });
});
