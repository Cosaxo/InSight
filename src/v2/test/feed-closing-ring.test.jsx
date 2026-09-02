// @vitest-environment jsdom
//
// THE GRACE NOTE A CROSSROADS STORY WOULD SWALLOW (D341).
//
// One card near the top of the feed wears a ring draining with the day.
// It is decoration with a job — it says the feed has a rhythm — and the
// card that wears it is picked by a hash over the candidate list, with
// `clockable[1]` as the fallback when no hash lands.
//
// A story cannot wear it. The ring is renderCard's to draw and PathsCard
// never would, so a pick that lands on a story does not draw the ring
// somewhere else — it draws it NOWHERE. The whole feed loses the beat, and
// nothing errors, nothing logs, nothing looks broken. That silence is why
// the one guard against it (`&& q.type !== 'path'`) went untested through
// D341 and everything since.
//
// THREE FRESH WORLD CARDS is the arrangement that separates the two
// spellings, and it was found by measurement rather than reasoning: with
// the guard the ring is drawn at one, two, three, four and nine cards;
// without it, two and three draw NO ring at all, because the story takes
// the fallback slot. Four and nine still draw one, which is exactly why a
// case at the default size would have proved nothing.
//
// Mounted directly rather than through the app shell, like
// feed-fresh-head.test.jsx: the subject is what the feed serves.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { installLive, PATH_TITLE } from "./live-fixture";
import { growUntil } from "./mount-app";

vi.setConfig({ testTimeout: 15000 });

// The ring is renderClock's 20×20 svg, two concentric r=7 circles — the
// track and the drain. Counted in pairs, so this is a count of rings.
const rings = () =>
  document.querySelectorAll('svg[viewBox="0 0 20 20"] circle[r="7"]').length / 2;

let WorldFeed;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

afterEach(() => {
  cleanup();
  live?.restore();
  live = undefined;
  localStorage.removeItem("insight.feedVotes.v1");
});

describe("the closing ring, on a feed whose second card is a story", () => {
  it("still lands on a card that can draw it", async () => {
    live = installLive({ feedCards: 3 });
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => rings() > 0, "the closing ring");
    // The story has to actually BE in this feed, or the arrangement the
    // case is named for does not exist and the ring above proves nothing
    // about the guard.
    expect(
      document.body.textContent.includes(PATH_TITLE),
      "no story in the feed — this case no longer tests what it says",
    ).toBe(true);
    // One, not several: the ring is a grace note, and a feed wearing three
    // of them is a different bug in the same line.
    expect(rings(), "the feed drew more than one closing ring").toBe(1);
  });
});
