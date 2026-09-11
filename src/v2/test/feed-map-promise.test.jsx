// @vitest-environment jsdom
//
// THREE BUTTONS IN THE FEED PROMISE THE MAP, AND WENT SOMEWHERE ELSE.
//
// Master a knowledge card and it says "Saved to your map." beside a
// **See it**. Answer a feed question that ripples and it says "added to
// Values →". All three called `NAV.goTab('mirror')`.
//
// `mirror` is the TAB, not a stop on it. `goTab` sets the Mirror's stop
// only for the five ids in `MIRROR_POP_IDS` (app-shell.jsx) — 'mirror' is
// not one of them, so the shell switches tabs and leaves the stop at
// whatever you were last looking at. Six of the seven stops are not the
// Map. So the reader who had been on World, or Circle, or Near got that
// stop back, with no map on screen and nothing saying why — and the
// learn button's cue (`window.MAP_OPEN_GROUP`) was left set, to fire
// later on some unrelated visit.
//
// The two sibling call sites in the tree already pass 'you'
// (daily-split.jsx's post-vote link, profile-general.jsx's card) and land
// correctly. The feed's three were the outliers.
//
// WHAT THIS FILE DRIVES, said plainly: the SHELL half is executed — that
// 'mirror' does not reach the Map while 'you' does is what makes the old
// call sites wrong, and it is asserted here on a mounted app. The click
// itself is not driven: "See it" needs a knowledge card mastered over a
// streak, and the ripple links are demo-path (renderFoot sits below
// renderEngage's `q.live` return). The call sites are held by a source
// ratchet instead, which is the same instrument room-qids.test.ts uses on
// nearbyRoomV2 and for the same reason — the alternative is no hold at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
// The module's own text, through vite rather than through `fs`: these
// files lint against a browser global set, so `process.cwd()` is not
// available here the way it is in the typed suites.
import worldFeedSrc from "../spec/world-feed.jsx?raw";
import { installLive } from "./live-fixture";
import { getApp, registerSmokeHooks } from "./mount-app";
import NAV from "../data/nav";

registerSmokeHooks();

let live;

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  cleanup();
  live?.restore();
  live = undefined;
  vi.restoreAllMocks();
});

const mpop = () => document.querySelector("[data-mpop]")?.getAttribute("data-mpop");
/** A nav key, pressed the way the shell presses it. */
const go = (id) => act(() => { NAV.goTab(id); });

describe("the Mirror tab is not the Map", () => {
  it("keeps the stop you were last on when asked for the tab, and opens the Map when asked for the Map", () => {
    live = installLive();
    const App = getApp();
    render(<App />);
    // Somewhere that is not the Map, the way a reader arrives at the feed.
    go("world");
    expect(mpop(), "the World stop did not open").toBe("world");
    go("track");

    // THE OLD BEHAVIOUR OF ALL THREE BUTTONS. Not a bug in the shell —
    // 'mirror' means "the Mirror, where you left it", which is right for a
    // caller that means the tab. It is the wrong word for a caller that
    // just promised a map.
    go("mirror");
    expect(
      mpop(),
      "goTab('mirror') reached the Map — then the call sites below never mattered",
    ).toBe("world");

    // …and the word the promise needs.
    go("track");
    go("you");
    expect(mpop(), "goTab('you') did not open the Map").toBe("you");
  });
});

describe("the feed's map promises name the Map", () => {
  const src = worldFeedSrc;

  it("has no button left asking for the tab", () => {
    // Deliberately the whole file rather than three line numbers: the next
    // "→ your map" link is likelier to be written next to one of these
    // than to replace it.
    const stragglers = src.split("\n")
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => l.includes("NAV.goTab('mirror')"));
    expect(
      stragglers.map(([n]) => n),
      "a feed button promising the Map switches to the Mirror tab instead, landing on whichever stop the reader was last on",
    ).toEqual([]);
  });

  it("still has the three that do", () => {
    // The control. An absence passes just as well when the buttons were
    // deleted, and one of them is the only route from a mastered fact to
    // the constellation it was saved into.
    expect(src.split("NAV.goTab('you')").length - 1, "the map links are gone entirely").toBe(2);
    // The third is the Learn card's "See it", and since #388 it is not a
    // goTab at all: it hands the typed Map cue (data/mapCue.ts) to the
    // shell, whose onMapCue does the whole walk — closeAll, the You stop,
    // the tab switch — where the window mailbox only ever reached a Map
    // mounting fresh after the write. Held here in its new shape, and the
    // mailbox held absent, so neither can quietly come back.
    expect(src).toMatch(/cueMap\(\{ group: 'g-know' \}\)/);
    expect(src, "the MAP_OPEN_GROUP mailbox is back").not.toMatch(/MAP_OPEN_GROUP =/);
  });
});
