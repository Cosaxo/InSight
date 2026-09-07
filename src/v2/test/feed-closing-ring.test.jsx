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
import { cleanup, render, screen } from "@testing-library/react";
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

  // A GUARD, NOT A REPRODUCTION — said plainly because the difference
  // matters. Which card wears the ring is chosen by a hash over the card
  // id, and on this fixture that hash does not pick the paid card: the
  // case passes with the filter and without it. What it holds is the rule
  // going forward, on the arrangement where a paid card is in the pool.
  // The defect itself was established by reading the two sites — a
  // sponsored card emits its end date with no start (live.ts says why),
  // and the window reader returns null unless it has both ends, which was
  // verified by running it — so the paid card fell into the pool that the
  // window check exists to keep it out of.
  it("never lands it on a paid card, which states a real window of its own", async () => {
    // renderClock's own note: the invented ring and a real deadline "must
    // never appear on the same card, or the invented one borrows the
    // credibility of the real one". The window check is what keeps them
    // apart, and it could not see a paid card: a sponsored question emits
    // its end date WITHOUT a start on purpose (the PAID band composes its
    // own label from the one value), and the window reader needs both
    // ends, so it answered "no window" and the card joined the pool.
    // The audience has to match or the card is never served — the same
    // arrangement feed-paid-answered.test.jsx uses.
    live = installLive({ feedCards: 8, sponsored: true, anchors: { city: "Oslo, NO" } });
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => screen.queryAllByText("PAID").length > 0, "the paid band");
    // The card is whatever ancestor holds both the disclosure and the
    // prompt — walked rather than named, because the feed's card element
    // has no stable class and naming one would make this case a test of
    // the markup instead of the rule.
    const marks = screen.getAllByText("PAID");
    expect(marks.length, "no paid card in the feed — this case tests nothing").toBeGreaterThan(0);
    // THE CARD IS THREE ANCESTORS UP from the disclosure button, measured
    // on this fixture: at three the subtree is the card (19 elements, no
    // ring), at four it is the whole feed (146 elements, and the feed's one
    // ring is in it). Walked rather than selected because the card element
    // carries no class or attribute to name — naming one would make this a
    // test of the markup rather than of the rule.
    for (const mark of marks) {
      let card = mark;
      for (let up = 0; up < 3 && card.parentElement; up++) card = card.parentElement;
      expect(
        card.querySelectorAll('svg[viewBox="0 0 20 20"] circle[r="7"]').length,
        "a paid card wore the invented closing ring beside its real window",
      ).toBe(0);
    }
    // …and the feed still drew one somewhere, or the line above passes for
    // a feed that stopped drawing the ring at all.
    expect(rings(), "the feed drew no closing ring, so the case above proves nothing").toBe(1);
  });
});
