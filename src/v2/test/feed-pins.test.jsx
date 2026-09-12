// @vitest-environment jsdom
//
// WHAT LEADS THE FEED (2026-09-12), which is the owner's whole report:
//
//   "the dial ... and the double axis question should not be pinned to the
//    top, they should appear like any other question ... the only exception
//    is if you have pinned [it]"
//
// Two claims, and a mount is the only thing that can hold either. The
// ordering lives in a 2,400-line class component's `render` — `.jsx`
// arithmetic covered by nothing but a mount, which is the D11/D42 lesson
// this tree keeps relearning — and the pin's effect is a card's POSITION,
// which no store read can see.
//
// Mounted directly rather than through the app shell, like
// feed-fresh-head.test.jsx next door: the subject is the feed's own order,
// not the chrome around it.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FEED_OPTIONS, FEED_PROMPT, installLive } from "./live-fixture";
import { growUntil, resetSitting } from "./mount-app";
import PULSE from "../data/pulse";

vi.setConfig({ testTimeout: 15000 });

const WF_LS = "insight.feedVotes.v1";
const PINS_LS = "insight.pulsePins.v1";

let WorldFeed;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

beforeEach(() => {
  localStorage.removeItem(PINS_LS);
});

afterEach(() => {
  cleanup();
  resetSitting();
  live?.restore();
  live = undefined;
  localStorage.removeItem(WF_LS);
  localStorage.removeItem(PINS_LS);
});

// EVERY CARD IN THE STREAM, in document order, whatever draws it.
//
// `.wf-card` alone is renderCard's cards — a pulse draws through PulseCard
// and a story through PathsCard, so a selector that asked only for that
// would report a head with the pulses silently missing from it, which is
// the opposite of what these cases are about.
const CARDS = '.wf-card, [data-screen-label="Daily pulse"]';
const cards = () => [...document.querySelectorAll(CARDS)];
/** Each card's id: the qid renderCard stamps for the attention tally, or
 * the pulse's own prompt, which is the only thing PulseCard puts in the
 * DOM that names which pulse it is. */
const idsOf = () => cards().map((el) => el._wfQid
  ?? (el.textContent.includes("What pace was today?") ? "pulse-pace"
    : el.textContent.includes("How did you sleep?") ? "pulse-sleep" : "pulse-?"));

/**
 * One stream, so the mix preserves the pool's own order and a card's
 * position is a fact rather than a round-robin artefact.
 *
 * The dial sits at index 5 and the field at 6, both deliberately deep: the
 * pin that was removed moved ONE continuum card to index 1 of `hot`, so a
 * fixture with them at 1 and 2 would pass against the code that was
 * deleted. The pulses form a second stream of their own (the fixture
 * serves two), which is why the assertions below count continuum cards
 * rather than exact offsets.
 */
function poolWithContinuum() {
  const vote = (i) => ({
    id: `wf-${i}`, cat: "culture", type: "vote", prompt: `Plain question ${i}`,
    options: [{ label: "Yes", count: 12 }, { label: "No", count: 9 }], live: true,
  });
  const pool = [0, 1, 2, 3, 4].map(vote);
  pool.push({
    id: "wf-dial", cat: "culture", type: "dial", prompt: "How many tabs?",
    options: [], lo: 0, hi: 50, unit: "tabs", n: 40, live: true,
  });
  pool.push({
    id: "wf-field", cat: "culture", type: "field", prompt: "Place it",
    options: [], ax: ["overhyped", "underrated"], ay: ["dull", "exciting"], n: 40, live: true,
  });
  pool.push(vote(7), vote(8));
  window.WORLD_FEED_QS = pool;
}

describe("no question type leads the feed on its own account", () => {
  it("leaves a dial and a double-axis card where the mix put them", async () => {
    // THE CASE THE SCREENSHOTS WERE. What stood in world-feed.jsx forced
    // one dial-or-field into index 1 of `hot` on every build — so the feed
    // opened on a slider or a plane every single visit, and the two cards
    // in the bank that could take that slot were the only two most
    // readers ever met there.
    live = installLive({ feedCards: 1 });
    poolWithContinuum();
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    // Grown to the FIELD, not to the dial: the dial arrives first, and a
    // window that stopped there would compare its position against a
    // card that is not mounted yet (-1).
    await growUntil(() => idsOf().includes("wf-field"), "the double-axis card");

    const ids = idsOf();
    expect(ids.indexOf("wf-dial"), "a dial was pulled to the head of the feed").toBeGreaterThan(2);
    // …and it is in the same RELATIVE order the pool gave it: the plain
    // questions that preceded it still precede it.
    expect(ids.indexOf("wf-0")).toBeLessThan(ids.indexOf("wf-dial"));
    expect(ids.indexOf("wf-dial")).toBeLessThan(ids.indexOf("wf-field"));
  });

  it("opens on an ordinary card, not on a continuum one", async () => {
    live = installLive({ feedCards: 1 });
    poolWithContinuum();
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => cards().length > 2, "the first page");

    // The head belongs to the mix. Under the pin, the second card was a
    // dial or a field with certainty; under no pin, neither of the two
    // can be in the first two places at all, because the pool puts five
    // plain questions and a pulse ahead of them.
    expect(idsOf().slice(0, 2)).not.toContain("wf-dial");
    expect(idsOf().slice(0, 2)).not.toContain("wf-field");
  });
});

describe("a pulse is a question in the feed", () => {
  it("rides the stream rather than sitting above it", async () => {
    // The pulses used to be rendered by daily-split.jsx as a stack ABOVE
    // the feed. Mounted alone like this, the feed is the only thing on
    // screen — so a pulse card in the document is a pulse card IN the
    // feed, and its position among the world cards is the claim.
    live = installLive({ feedCards: 6 });
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => idsOf().includes("pulse-pace"), "the pace pulse");

    const ids = idsOf();
    expect(ids).toContain("pulse-pace");
    expect(ids).toContain("pulse-sleep");
    // Not at the head: nothing is pinned, so a pulse takes its place like
    // anything else. (The mix deals one card per stream per pass, so the
    // first world card precedes the first pulse.)
    expect(ids.indexOf("feed-fixture-0")).toBeLessThan(ids.indexOf("pulse-pace"));
  });

  it("offers every pulse the bank holds, on any day", async () => {
    // The cadence retired: `sleep` defaulted to Sundays, so six days in
    // seven it was not offered at all. A weekday is set deliberately —
    // an every-day claim is only worth something on a day the old rule
    // would have refused.
    vi.setSystemTime(new Date("2026-09-09T12:00:00Z")); // a Wednesday
    try {
      live = installLive({ feedCards: 6 });
      render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
      await growUntil(() => idsOf().includes("pulse-sleep"), "the sleep pulse on a Wednesday");
      expect(idsOf()).toContain("pulse-sleep");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the pin is the reader's own, and the only thing that leads", () => {
  it("puts a pinned pulse at the head of the feed", async () => {
    // The owner's exception, and the whole of it: *"they can be pinned
    // that means that the user wants to track that so it shows up
    // somewhere near the top of the feed"*.
    live = installLive({ feedCards: 6 });
    PULSE.setPinned("pulse-sleep", true);
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => cards().length > 2, "the first page");

    expect(idsOf()[0], "the pinned pulse did not lead the feed").toBe("pulse-sleep");
  });

  it("keeps the pin order when two are pinned", async () => {
    // Oldest pin first, because the head of a feed is a queue: deriving
    // the order from the pool would let two pinned cards swap places
    // whenever the mix moved underneath them.
    live = installLive({ feedCards: 6 });
    PULSE.setPinned("pulse-sleep", true);
    PULSE.setPinned("pulse-pace", true);
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => cards().length > 2, "the first page");

    expect(idsOf().slice(0, 2)).toEqual(["pulse-sleep", "pulse-pace"]);
  });

  it("gives the head back when the pin is dropped", async () => {
    // The difference between this pin and the one that was removed: this
    // one empties. A pin nobody set leads nothing, which is the default
    // and is what both screenshots were about.
    live = installLive({ feedCards: 6 });
    PULSE.setPinned("pulse-sleep", true);
    PULSE.setPinned("pulse-sleep", false);
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => cards().length > 2, "the first page");

    expect(idsOf()[0]).not.toBe("pulse-sleep");
  });

  it("does not lead with a pinned pulse the topic filter has muted", async () => {
    // A mute is a veto everywhere else in the feed (wfFeedMatch), and a
    // pin must not be the one thing that outranks it — "less of this"
    // would stop meaning anything if it did. The pin holds a card that is
    // IN the list, so a muted pulse simply is not there to hold.
    live = installLive({ feedCards: 6 });
    PULSE.setPinned("pulse-sleep", true);
    render(<WorldFeed cats={{ pulse: false }} onToggle={() => {}} beats={false} />);
    await growUntil(() => cards().length > 2, "the first page");

    const ids = idsOf();
    expect(ids).not.toContain("pulse-sleep");
    expect(ids).not.toContain("pulse-pace");
  });
});

describe("the sitting — what a hop keeps and an absence refreshes", () => {
  // THE HALF A MOUNT CAN SEE. The boundary arithmetic is pinned in
  // data/feedSitting.test.ts, where a case can name the millisecond; what
  // is held here is the thing the owner actually described — whether the
  // card you just answered is still where you left it.
  //
  // The tab swap is a real unmount: app-shell keys `.tab-swap` by tab, so
  // going to Mirror and back tears the whole daily tab down. `cleanup()`
  // then `render()` is that, exactly.
  //
  // `vi.setSystemTime` WITHOUT `vi.useFakeTimers()`, the same way
  // smoke-live drives the clock: `growUntil` waits on real timers, which
  // fake ones would hang.
  /**
   * Answer the first card BY TAPPING IT, which is the only way that works
   * inside one mount.
   *
   * Writing the store and the mirror directly is enough across a remount
   * — the feed seeds `state.votes` from the mirror at mount — and is
   * enough for nothing at all without one: `wfAnsweredOf` consults the
   * server ONLY for the continuum and catalogue types, so a `vote` card's
   * answered-ness is `state.votes` and a fixture that wrote around it
   * would leave the feed correctly reporting the card unanswered.
   */
  const answerFirstCard = () => {
    const opts = screen.getAllByRole("button", { name: new RegExp(`^${FEED_OPTIONS[0]}`) });
    fireEvent.click(opts[0]);
  };
  const answeredExpander = () => [...document.querySelectorAll("button")]
    .find((b) => /^Answered · /.test(b.textContent || ""));
  /** The app backgrounding and returning, which is not an unmount. jsdom's
   * `visibilityState` is a getter, so it is redefined rather than set. */
  const setVisibility = (state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
  };
  const hide = () => setVisibility("hidden");
  const show = () => setVisibility("visible");

  it("keeps a card you just answered in place across a quick hop", async () => {
    // The bug this fixes, in one sentence: answer a card, glance at the
    // Mirror, come back — and the card you were reading the reveal of has
    // already gone behind the Answered expander. The snapshot that was
    // supposed to prevent that was a field on a component the tab swap
    // unmounts.
    const T = new Date("2026-09-12T12:00:00Z").getTime();
    vi.setSystemTime(new Date(T));
    try {
      live = installLive({ feedCards: 6 });
      render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
      await growUntil(() => !!screen.queryByText(FEED_PROMPT), "the first card");
      answerFirstCard();

      cleanup();                                  // to the Mirror…
      vi.setSystemTime(new Date(T + 5_000));      // …and back, five seconds later
      render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
      // Waited on a NEIGHBOUR of the card under test, not on a card
      // count. `wf-card` is applied only once `componentDidMount` has
      // built the entrance observer, so the very first render of a mount
      // carries none of them — and a wait satisfied by the two pulse
      // cards (which draw through PulseCard and need no observer) would
      // look at a head the world cards had not joined yet.
      await growUntil(() => idsOf().includes("feed-fixture-1"), "the world cards");

      expect(idsOf(), "the answered card left the stream on a five-second hop")
        .toContain("feed-fixture-0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes a feed left on screen, when the app comes back", async () => {
    // THE CASE A MOUNT HOOK CANNOT SEE, and the one that found a real bug
    // in the wiring: backgrounding the app while the feed is on screen
    // never unmounts anything, so a phone left in a pocket for an hour
    // comes back to the sitting it left unless the visibility event says
    // otherwise. No `cleanup()` here for exactly that reason — the
    // component stays mounted throughout, and the only thing that moves
    // is the clock and the event.
    //
    // What it caught: the redraw was guarded on `this._mounted`, which
    // this file only ever WRITES (to false, on unmount) and which is
    // `undefined` while the component is alive. A live feed read as gone,
    // so the answered card stayed in the stream and no rotation was drawn
    // until the next tap. Every other case here remounts, so this is the
    // only one that could fail.
    const T = new Date("2026-09-12T12:00:00Z").getTime();
    vi.setSystemTime(new Date(T));
    try {
      live = installLive({ feedCards: 6 });
      render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
      await growUntil(() => !!screen.queryByText(FEED_PROMPT), "the first card");
      answerFirstCard();

      hide();
      vi.setSystemTime(new Date(T + 61_000));
      await act(async () => { show(); });

      // ASSERTED WITH NO FURTHER INTERACTION, and that is the whole
      // design of the case. Anything that grows the window — a scroll, a
      // tap, `growUntil` — sets state and so schedules the render on its
      // own, which would hide a missing `forceUpdate` completely: the
      // sitting has already been ended by `enter()`, so the next render
      // from any cause draws the refreshed feed. The bug is that there is
      // no next render, and only a bare `act` flush can see it.
      expect(answeredExpander(), "the feed never redrew after the app came back").toBeTruthy();
      expect(idsOf(), "the feed never noticed the app had been away")
        .not.toContain("feed-fixture-0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears it out once you have actually been away", async () => {
    // The other direction, and the half that makes the first one safe to
    // want: a sitting that never ended would pile answered cards in the
    // stream forever.
    const T = new Date("2026-09-12T12:00:00Z").getTime();
    vi.setSystemTime(new Date(T));
    try {
      live = installLive({ feedCards: 6 });
      render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
      await growUntil(() => !!screen.queryByText(FEED_PROMPT), "the first card");
      answerFirstCard();

      cleanup();
      vi.setSystemTime(new Date(T + 61_000));     // a minute and a second
      render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
      await growUntil(() => !!answeredExpander(), "the Answered expander");

      expect(idsOf(), "the answered card was still in the stream a minute later")
        .not.toContain("feed-fixture-0");
      expect(answeredExpander().textContent).toMatch(/Answered · 1/);
    } finally {
      vi.useRealTimers();
    }
  });
});
