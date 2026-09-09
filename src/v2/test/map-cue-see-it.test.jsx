// @vitest-environment jsdom
//
// The Learn card's "See it" cross-link, both ends of it.
//
// WHY IT EXISTS. The button used to set `window.MAP_OPEN_GROUP = 'g-know'`
// and call NAV.goTab('mirror'); map-tab read the mailbox in its openGroup
// initializer. That is a name on the spec layer's global bridge, and a
// name off the bridge is a name no gate watches: check:globals' rules see
// writer and reader while both exist, and see nothing at all once the
// write is gone — a "See it" that quietly stopped handing the Map a group
// would still render, still switch tabs, and no check would go red. The
// mailbox also only ever reached a Map mounting FRESH after the write, so
// a reader already sitting on the You stop got the tab and no landing.
//
// So the cue is data/mapCue's take-once (D207) and these two cases are the
// readers that would otherwise silently blank: the feed half asserts the
// tap leaves exactly the cue the Map takes, and the shell half asserts the
// walk a caller of cueMap gets for free (app-shell's onMapCue) — which is
// why the handler carries no NAV.goTab of its own. Nothing pinned that
// second half before this file.
//
// The feed is mounted directly, as learn-reserve.test.jsx does: the
// subject is one card's button, not the chrome around it.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LEARN as L } from "../spec/learn-progress.js";
import { cueMap, takeMapCue } from "../data/mapCue";
import { awaitNode, growUntil, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });

// registerSmokeHooks loads spec-index AND the deferred chunks — the feed
// case needs loadWorldFeed(), the shell case needs the rest.
registerSmokeHooks();

// …and the feed body itself, which spec-index publishes. Registered after
// the hook above, so it runs after that beforeAll has loaded the chunk.
let WorldFeed;
beforeAll(() => { WorldFeed = window.WorldFeed; });

afterEach(() => {
  cleanup();
  // A cue nobody took would leak into the next case, and take-once means
  // the leak would look like a pass.
  takeMapCue();
});

describe("Learn's “See it” hands the Map a group through the typed cue", () => {
  it("leaves { group: 'g-know' } for map-tab to take, and writes no window mailbox", async () => {
    // A clean scheduler state, so the card the feed serves first is a
    // FRESH one — and a fresh card answered right is mastered in one tap
    // (learn-progress: no prior state → s = 'known'), which is the only
    // branch that renders "See it".
    L.reset();
    const card = L.plan(1)[0];
    expect(card, "the learn bank served nothing").toBeTruthy();
    expect(L.stateOf(card.id), "the planned card is not fresh").toBeNull();

    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    // The learn card is interleaved past the feed's first mounted page
    // (D136) — grow until IT arrives, never until the demo feed settles.
    await growUntil(
      () => !!screen.queryByRole("button", { name: card.a[card.c] }),
      `the learn card ${card.id}`,
    );
    fireEvent.click(screen.getByRole("button", { name: card.a[card.c] }));
    expect(L.stateOf(card.id).s, "the tap did not master the card").toBe("known");
    expect(screen.getByText("Saved to your map."), "the mastered branch did not render").toBeTruthy();

    // Nothing pending before the tap: the assertion below is about THIS click.
    expect(takeMapCue()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See it" }));
    expect(takeMapCue()).toEqual({ group: "g-know" });
    // …and the retired mailbox stays retired. A reverted handler would set
    // it and leave the cue empty — both halves of that fail here.
    expect(window.MAP_OPEN_GROUP, "the window mailbox is back").toBeUndefined();
  });
});

describe("the shell answers a cue with the walk (app-shell's onMapCue)", () => {
  // The Map draws nothing until its pane measures (`if (!view)` in
  // map-tab.jsx), and jsdom measures every pane at zero — so the group
  // assertion below needs the pane map-body-renders.test.jsx gives it, by
  // the same route: shadow the inherited getters for this file only, and
  // unshadow them after, because deleting an own descriptor that jsdom
  // had moved down would strip the getters from every later suite in
  // this worker.
  const PANE = { width: 480, height: 720 };
  let restore = null;
  beforeAll(() => {
    const saved = ["clientWidth", "clientHeight"].map((k) =>
      [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]);
    restore = () => {
      for (const [k, d] of saved) {
        if (d) Object.defineProperty(HTMLElement.prototype, k, d);
        else delete HTMLElement.prototype[k];
      }
    };
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return PANE.width; } });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return PANE.height; } });
  });
  afterAll(() => { if (restore) restore(); restore = null; });

  it("cueMap lands on the Mirror's You stop with the Map open on the group, the caller navigating nothing", async () => {
    const expectNoBoundary = mountApp();
    const tabs = () => [...document.querySelectorAll(".tabbar .tab-btn")];
    const current = () => tabs().filter((b) => b.getAttribute("aria-current") === "page");
    expect(current()[0].textContent, "the app did not start on daily").toContain("daily");

    // Outside React's event system, so act() — same reason openVia() has one.
    act(() => { cueMap({ group: "g-know" }); });

    expect(current().length, "no tab, or more than one, is marked current").toBe(1);
    expect(current()[0].textContent, "a Map cue did not walk to the Mirror").toContain("mirror");
    // …and to the You stop, which is the only stop that hosts the Map.
    // The tab alone would pass with onMapCue's setTweak('mirrorPop', 'you')
    // deleted, and the Map would then never mount to take the cue.
    expect(document.querySelector(".app[data-mpop], [data-mpop]")?.getAttribute("data-mpop"), "the walk did not land on the You stop").toBe("you");

    // The Map's own half: it mounts through the Mirror's slot and takes the
    // cue in its openGroup initializer. Nothing pinned that before this
    // case — deleting takeMapCue() from map-tab.jsx left every suite green.
    // `.is-ingroup` is set past the early return, so a Map that mounted
    // and measured but took no cue fails here, not at the root.
    const root = await awaitNode(".mmt-root.is-ingroup");
    expect(root, "the Map did not open on the cued group").toBeTruthy();
    expect(
      root.querySelector(".mmt-center-glabel")?.textContent,
      "the open group is not Knowledge (map-groups.js: g-know)",
    ).toBe("Knowledge");
    expectNoBoundary("map cue");
  });
});
