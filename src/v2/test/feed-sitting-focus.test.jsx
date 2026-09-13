// @vitest-environment jsdom
//
// THE SECOND FEED. `search-overlay.jsx` renders WorldFeed a second time
// with `focus`, as a single-question card inside the overlay — and that
// overlay LAYERS OVER the daily tab rather than replacing it, so both
// instances are alive at once while the real feed is still on screen.
//
// D479's sitting store is module-global and its `leave()` is
// first-write-wins (`if (lastLeft == null)`). So closing the search card
// stamped "the reader left" while the reader was still reading, the real
// feed's own later `leave()` then did nothing because the stamp was
// taken, and the next `enter()` measured from that stale moment. A tab
// hop of a few seconds came back as a NEW sitting: the mix rotates, the
// just-answered card leaves its place, the scroll offset goes — which is
// the exact failure the sitting store was written to prevent.
//
// Mounted directly rather than through the app shell, like
// feed-closing-ring.test.jsx: the subject is the component's lifecycle,
// not a screen.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { resetSitting } from "./mount-app";
import * as SITTING from "../data/feedSitting";

let WorldFeed;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

afterEach(() => { cleanup(); resetSitting(); vi.restoreAllMocks(); });

// THE CLOCK HAS TO BE THE SAME ONE. The component calls `SITTING.leave()`
// with no argument, so it stamps `Date.now()` — the real wall clock. A
// case that hands the store synthetic timestamps and lets the component
// use the real one is comparing numbers thirteen digits apart, and the
// comparison then answers "not a new sitting" for a reason that has
// nothing to do with the subject. Both cases below passed that way before
// this was added, including on the unfixed component. Stubbing `Date.now`
// rather than installing fake timers, because the feed's mount schedules
// real work on setTimeout and this is not about that.
const at = (t) => { vi.spyOn(Date, "now").mockReturnValue(t); };

describe("the sitting belongs to the feed, not to every mount of it", () => {
  // `focus={[]}` rather than a question fixture, and that is exact rather
  // than lazy: the guard under test is on the PROP, the component's own
  // focused branch is taken for any non-null value, and it renders from
  // the array — so an empty one exercises the whole lifecycle this is
  // about (mount, unmount) and renders nothing that could fail for an
  // unrelated reason.
  const openSearchCard = () =>
    render(<WorldFeed focus={[]} cats={{}} onToggle={() => {}} beats={false} opts={{}} />);

  it("closing the search card does not stamp the reader as having left", () => {
    at(0);
    SITTING.__resetForTests(0);
    SITTING.enter();                        // the real feed, being read

    at(2_000);
    const card = openSearchCard();          // a question opened from search
    card.unmount();                         // …and closed again, seconds later

    at(120_000);
    SITTING.leave();                        // much later: they leave the tab

    at(125_000);                            // and come back five seconds on
    expect(
      SITTING.enter(),
      "a five-second tab hop was read as a new sitting — the feed rotated under the reader",
    ).toBe(false);
  });

  it("the feed's OWN unmount still ends the sitting — the control", () => {
    // Without this the case above would pass on a component that had
    // stopped stamping at all, which would break the store instead of
    // fixing it.
    at(0);
    SITTING.__resetForTests(0);
    SITTING.enter();
    at(2_000);
    const feed = render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} opts={{}} />);
    feed.unmount();                         // a real tab swap
    at(125_000);                            // back two minutes later
    expect(
      SITTING.enter(),
      "the feed's own unmount no longer ends a sitting",
    ).toBe(true);
  });
});
