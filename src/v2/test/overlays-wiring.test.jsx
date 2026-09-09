// @vitest-environment jsdom
//
// That `loadOverlays()` stocks the subtopic leaves BY ITSELF.
//
// ITS OWN FILE, and that is the whole assertion. This case lived at the
// bottom of feed-pool-wiring.test.jsx, where the case above it had already
// called `loadWorldFeed()` in the same module registry — and
// `installSubtopicStock()` is idempotent behind a module-level flag, so the
// stock was always already in by the time this looked. It passed with the
// install deleted from `loadOverlays`, measured: the whole suite stayed
// green at 152 files and 2234 tests.
//
// What that would cost: main.jsx starts the two groups concurrently and
// neither may wait on the other, and the feed group is retryable — a
// failure of it is survivable. So with the install gone, a session where
// the feed chunk is still in flight or failed opens search's discover
// sheet on zero subtopic leaves, which looks exactly like an empty sheet.
//
// Vitest gives each test file its own module registry, which is the only
// place "alone" means alone.

import { describe, expect, it } from "vitest";

describe("loadOverlays carries the subtopic stock too", () => {
  it("the discover sheet's leaves are stocked without the feed group", async () => {
    // search-overlay.jsx reads `SUBTOPICS.offers()`, which is "only the
    // stocked leaves" and reads the pool to decide. The stock is installed
    // by a loader now, so the overlays group has to install it as well —
    // main.jsx starts the two concurrently and neither may wait on the
    // other. Asserted through loadOverlays ALONE — this file loads nothing
    // else, which is what makes "alone" true.
    const specIndex = await import("../spec-index.js");
    await specIndex.loadOverlays();
    const { SUBTOPICS } = await import("../spec/world-subtopics.js");
    expect(
      SUBTOPICS.offers().map((s) => s.id),
      "loadOverlays left the leaves unstocked — search's discover sheet would offer nothing",
    ).toEqual(["sub_tennis", "sub_football", "sub_running"]);
  });
});
