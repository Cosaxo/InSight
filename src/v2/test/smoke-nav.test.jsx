// @vitest-environment jsdom
//
// Mount suite 4 of 5 — the v17 nav and the surfaces that own their own drag.
// The shared harness, and the reasoning for all five files, is in
// ./mount-app.jsx.

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { OWNS_X } from "../spec/swipe-back.js";
import { openHeaderOverlay, awaitNode, awaitText, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

// ── the v17 nav (D43) ──────────────────────────────────────────────────
//
// The daily's mode switcher stopped being a pill portalled into the header and
// became a ruler in flow, and the shell now writes `data-view` for
// scroll-memory.js to key on. Both are invisible to every other gate: the ruler
// is a tab list either way, so check:globals and tsc see no difference, and
// `data-view` is a string nothing type-checks.
//
// What each case would catch, stated so nobody trims one as redundant:
//   - the ruler case fails if DailySplit stops receiving `ruler`, or if the
//     portal path comes back and empties the in-flow row;
//   - the mode case fails if the shell's `mode` prop and DailySplit's own state
//     stop tracking each other (they are two-way: componentDidUpdate follows
//     the prop, onMode reports the ruler's own taps back up);
//   - the data-view case fails if scroll memory's key stops moving, which would
//     leave every view restoring to the last one's position.
describe("the daily's ruler is the nav (v17)", () => {
  // TWO rulers carry this label at once — the in-flow one and the compact copy
  // the header holds ready to dock — so a plain byRole finds both. The in-flow
  // one is the one outside .app-header.
  const rulers = () => screen.queryAllByRole("tablist", { name: /how far this answer reaches/i });
  const ruler = () => rulers().find((r) => !r.closest(".app-header")) || null;

  it("renders the daily's three stops in flow, not in the header slot", () => {
    const expectNoBoundary = mountApp();
    const row = ruler();
    expect(row, "the daily ruler did not render in flow").not.toBeNull();
    // The header holds its own copy, hidden until the in-flow one scrolls away
    // — that pair IS the dock, so both halves have to be present.
    expect(
      rulers().some((r) => r.closest(".app-header")),
      "the header has no docked ruler to crossfade to",
    ).toBe(true);
    expect(document.querySelector("#daily-mode-slot"), "the pill slot is still rendered").toBeNull();
    expect(document.querySelector(".app-header .h-title"), "the wordmark is missing").not.toBeNull();
    for (const label of ["World", "Circle", "1v1"]) {
      expect(
        [...row.querySelectorAll('[role="tab"]')].some((b) => b.textContent.trim() === label),
        `the ruler is missing its ${label} stop`,
      ).toBe(true);
    }
    expectNoBoundary("daily ruler");
  });

  it("a ruler stop switches the mode and the shell follows it", () => {
    const expectNoBoundary = mountApp();
    const stop = (label) =>
      [...ruler().querySelectorAll('[role="tab"]')].find((b) => b.textContent.trim() === label);
    expect(stop("World").getAttribute("aria-selected")).toBe("true");
    act(() => { fireEvent.click(stop("1v1")); });
    // The shell owns `dailyMode` now and writes it into data-view, so this
    // asserts the round trip rather than DailySplit's private state.
    expect(document.querySelector(".app").getAttribute("data-view")).toBe("track:duo");
    expectNoBoundary("daily ruler, 1v1");
  });

  it("data-view names the view scroll memory keys on", () => {
    mountApp();
    const view = () => document.querySelector(".app").getAttribute("data-view");
    expect(view()).toBe("track:world");
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expect(view()).toBe("mirror:you");
  });
});

// ── the patterns tab (v28 §1, ON TRIAL per D166 §1) ───────────────────
//
// The tab body is a React.lazy chunk, so the click alone renders nothing —
// the await lets the import resolve before asserting. What the demo owes
// here is the HONEST state: the trial ships live data only, so a demo
// mount must say so rather than draw the prototype's invented crowd.
describe("the tab bar says which tab you are on", () => {
  it("marks exactly one tab current, and moves the mark when you switch", () => {
    // The app's PRIMARY navigation was the only ruler in the tree with no
    // current-tab semantics: `is-active` is a CSS class and the glyph takes
    // a prop, and a screen reader sees neither. Eight other rulers use
    // role="tab"/aria-selected and seven secondary pickers use
    // aria-current — this one told nobody where they were.
    //
    // `page` rather than `true` because these are destinations, not tabs
    // over a single panel: there is no tablist here, and claiming one would
    // promise arrow-key navigation the bar does not implement.
    const expectNoBoundary = mountApp();
    const tabs = () => [...document.querySelectorAll(".tabbar .tab-btn")];
    const current = () => tabs().filter((b) => b.getAttribute("aria-current") === "page");

    expect(tabs().length, "the tab bar did not render").toBeGreaterThan(1);
    expect(current().length, "no tab, or more than one, is marked current").toBe(1);
    // The default tab is the daily, in the middle.
    expect(current()[0].textContent).toContain("daily");

    const mirror = tabs().find((b) => b.textContent.includes("mirror"));
    act(() => { fireEvent.click(mirror); });
    expect(current().length, "switching tabs left the mark on two of them").toBe(1);
    expect(current()[0].textContent, "the mark did not follow the tab").toContain("mirror");
    // …and the tab you left is not still claiming to be current.
    expect(
      tabs().find((b) => b.textContent.includes("daily")).getAttribute("aria-current"),
    ).toBeNull();
    expectNoBoundary("tab bar aria-current");
  });
});

describe("the patterns tab (trial)", () => {
  it("mounts lazily from the tab bar and shows the honest demo state", async () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^patterns$/i }));
    await awaitText(/only from real answers/i);
    expect(document.querySelector(".app").getAttribute("data-view")).toBe("patterns");
    expect(document.body.textContent).toMatch(/only from real answers/i);
    expectNoBoundary("patterns/demo");
  });

  it("the daily's near-end exit goes to patterns through goNav", async () => {
    const expectNoBoundary = mountApp();
    act(() => { window.goNav("patterns"); });
    await awaitText(/only from real answers/i);
    expect(document.querySelector(".app").getAttribute("data-tab")).toBe("patterns");
    expectNoBoundary("patterns via goNav");
  });
});

// ── gesture ownership (the 2026-08 iPhone bugs) ────────────────────────
//
// swipe-back.test.js proves the MECHANISM: a touch sequence starting inside
// anything OWNS_X matches never reaches the axis gestures. These cases pin the
// WIRING — that the live DOM actually matches the list. Both bugs shipped with
// every name-level gate green: the ruler scrubbed with its own pointer handlers
// and the Map panned with its own, but the same touches still fed swipe-back,
// and releasing a rightward gesture jumped tabs.
describe("the surfaces that own their drag are excluded from the axis swipes", () => {
  // One mount for both surfaces: the mirror's default stop is You, which IS the
  // Map, so the ruler and the pan canvas are on screen together.
  it("the mirror ruler and the Map's pan surface are covered by OWNS_X", async () => {
    mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    const rail = screen.getByRole("tablist", { name: /how far the mirror reaches/i });
    expect(
      rail.closest(OWNS_X),
      "the ruler lost its data-nopan — releasing a rightward scrub will land on the daily",
    ).not.toBeNull();
    // The canvas renders even before its first fit (the null-view branch), so
    // this holds in jsdom's zero-size panes — but the Map is a lazy body
    // since v28 §5, so its arrival is awaited rather than assumed.
    const canvas = await awaitNode(".mmt-canvas");
    expect(canvas, "the Map's canvas did not mount on the You stop").not.toBeNull();
    expect(
      canvas.closest(OWNS_X),
      "the Map's pan canvas fell out of OWNS_X — panning it will pull the tab sideways",
    ).not.toBeNull();
  });

  // The daily feed's dial — the fourth bug of the same family, reported off a
  // device: answering a dial ("When does old age begin?") slid the mode axis
  // under it, and past 1v1 that slide leaves the tab. touchAction:'none' is
  // what everyone reaches for and it is not enough — it stops the BROWSER
  // scrolling, not the touch events reaching daily-split's listener on the
  // scroller above.
  //
  // Asserted over every role=slider in the feed rather than the one id,
  // because the rule is about the KIND of control: a drag surface that answers
  // a question owns its horizontal motion. A future slider that forgets the
  // mark fails here without anyone remembering to extend the list.
  it("a drag-to-answer dial owns its drag — every feed slider is in OWNS_X", () => {
    mountApp();
    const dials = [...document.querySelectorAll('[role="slider"]')];
    expect(dials.length, "no dial rendered in the daily feed — the case is now vacuous").toBeGreaterThan(0);
    for (const d of dials) {
      expect(
        d.closest(OWNS_X),
        `a dial (${d.getAttribute("aria-label")}) fell out of OWNS_X — dragging it will slide the mode axis`,
      ).not.toBeNull();
    }
  });

  // The third 2026-08 iPhone bug, same family of "the DOM position lies":
  // .wf-scrim positions absolutely, so a sheet rendered mid-page anchors to
  // whatever containing block it sits in. The lens ⓘ rendered its sheet deep
  // inside the profile's scrolling body — the scrim grew as tall as the content
  // and the sheet landed at the bottom of the SCROLL, off-screen. The fix
  // portals it to the app frame; this pins the portal.
  it("the lens ⓘ sheet mounts on the app frame, not in the scrolling page", async () => {
    const expectNoBoundary = mountApp();
    await openHeaderOverlay("profile");
    fireEvent.click(screen.getByRole("button", { name: /^lenses$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /^what .* measures$/i })[0]);
    const scrim = document.querySelector(".wf-scrim");
    expect(scrim, "the ⓘ did not open its explain sheet").not.toBeNull();
    expect(
      scrim.parentElement,
      "the explain sheet rendered in place — it will surface at the bottom of the scroll, not the screen",
    ).toBe(document.querySelector(".app"));
    expectNoBoundary("profile → lenses → explain sheet");
  });
});
