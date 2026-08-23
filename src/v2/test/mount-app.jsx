// The shared harness for the spec layer's mount suites (`smoke-*.test.jsx`).
//
// WHY THE SUITES EXIST. The layer talks through global scope
// (src/v2/README.md), so a missing or renamed global is not a compile error;
// it is a ReferenceError at RENDER time, on whichever screen happens to touch
// it. Two shipped that way — `ReactDOM` at six createPortal sites and a bare
// `sign` in the profile editor — and `check:globals` was written afterwards to
// catch the static half. These catch the half a scanner cannot: a name that
// exists but is undefined by the time the component reads it, and any other
// throw on first paint.
//
// WHY THEY ASSERT ON THE BOUNDARY, NOT ON A THROWN ERROR. app-shell wraps both
// tabs and every overlay in `ErrorBoundary` — deliberately, so one bad
// component costs a card rather than the app. That means `render()` returns
// happily while the screen underneath is the "This view hit a snag." card. A
// test that only checked for an exception would have passed on both of the
// bugs above. So each case asserts the boundary did NOT trip, by its
// componentDidCatch log and by its fallback copy.
//
// SCOPE, ACROSS THE FIVE FILES. First paint of every surface reachable without
// inventing data: both tabs, the two overlays the header opens, and the six the
// app opens through its `window.*` cross-link API. These are smoke tests — they
// prove the screens mount, not that they are correct. Interaction and
// assertion-on-content is the next layer, and the deferred React Compiler
// findings in src/v2/README.md are the work queue for it.
//
// WHY THIS FILE EXISTS AT ALL (D108). All of the above used to live in one
// `smoke.test.jsx` holding 32 cases. Vitest schedules a FILE to a worker, so a
// single file is a hard serial floor however many cores the runner has: that
// one was 90.2s of a 92.2s `test:unit` wall clock, with the other fifty files
// finishing inside it. Splitting it needed the setup to be shared rather than
// copied five times — hence this module. It is `.jsx`, not `.test.jsx`, so
// vitest's include pattern does not collect it as a suite of its own.

import { afterEach, beforeAll, expect, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NAV from "../data/nav";

// 15s per test, not the 5s default: every case mounts the FULL app in jsdom,
// and the v15 revision roughly doubled the spec layer's feed weight — the
// slowest cases sat at ~4.8s before it and tip over under suite load. Exported
// rather than applied here so each suite's `vi.setConfig` stays visible in the
// file it governs, with one source for the number.
export const SMOKE_TIMEOUT_MS = 15000;

// The boundary's own log line (app-shell.jsx, componentDidCatch). Matching on
// this rather than on any console.error keeps the assertion deterministic —
// React's dev build logs plenty of other things.
const BOUNDARY_LOG = "[InSight] boundary caught:";
// …and the copy it renders in place of the crashed subtree.
const BOUNDARY_COPY = /This view hit a snag/i;

let App;
let errorSpy;

// Registers the beforeAll/afterEach every mount suite needs. Called at the top
// level of each `smoke-*.test.jsx`, which is where vitest expects hooks to be
// declared.
export function registerSmokeHooks() {
  beforeAll(async () => {
    // spec-index loads all ~85 modules for their side effects, in the order the
    // standalone's script tags had. `App` only exists afterwards.
    const specIndex = await import("../spec-index.js");
    // …except the world feed, which main.jsx loads after first paint. Await it
    // here or every case would silently stop covering the largest module in the
    // layer — the feed renders on the daily tab, so dropping it costs coverage
    // without failing anything.
    await specIndex.loadWorldFeed();
    // …and the six no-button overlays, for the same reason. Every cross-link
    // case opens one of these, and the openers await this same memoised promise
    // — so strictly this line only removes a wait from the first such case. It
    // is here rather than implied because a suite that depends on a load nobody
    // in it names is a suite that breaks confusingly the day the openers stop
    // awaiting. It is in the SHARED hook rather than in the one file that needs
    // it because the module cache is per worker, and after the split no file
    // can assume another already paid for this.
    await specIndex.loadOverlays();
    // …and the Map (v28 §5), which the Mirror's landing stop lazy-loads.
    // Awaiting it here mirrors main.jsx's prewarm: the chunk is in the
    // module cache before any case clicks Mirror, so the lazy body resolves
    // in a microtask instead of a network beat. Cases that assert on Map
    // DOM still flush that microtask (see awaitNode below).
    await specIndex.loadMapTab();
    App = globalThis.App;
  });

  afterEach(() => {
    cleanup();
    errorSpy?.mockRestore();
  });
}

// The loaded root, for the one case that asserts on it directly.
export const getApp = () => App;

// Mount the app and hand back a checker. Every case ends by calling it,
// including after whatever clicking it did.
export function mountApp() {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  return function expectNoBoundary(where) {
    const caught = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes(BOUNDARY_LOG),
    );
    // Surface the real error, not just "expected 0 to be 1" — the whole point
    // is to name the undefined global on the first read.
    expect(caught.map((c) => String(c[1])).join(" · "), `${where}: ErrorBoundary caught`).toBe("");
    expect(screen.queryByText(BOUNDARY_COPY), `${where}: boundary fallback rendered`).toBeNull();
  };
}

// ── the cross-link overlays ────────────────────────────────────────────
//
// These open through globals app-shell installs in an effect rather than
// through a button, so the call has to run inside act(): it sets state from
// outside React's event system, and without act() the assertion runs against
// the frame before the overlay rendered.
export async function openVia(name, ...args) {
  // The REGISTRY since D248, not `window.*` — app-shell registers its doors
  // into data/nav rather than publishing them, so this asserts the door
  // exists there. Same guarantee, and it still fails loudly if the shell
  // stopped registering: `can()` is false and the expect below names it.
  expect(NAV.can(name), `nav door "${name}" is not registered`).toBe(true);
  // AWAITED act, because these openers are async: each awaits loadOverlays()
  // before setting the state that mounts its overlay (spec-index.js,
  // app-shell's openDeferred). A bare synchronous `act(() => …)` returns before
  // the promise settles, so every assertion would run against the frame BEFORE
  // the overlay rendered — which is the vacuous pass these suites exist to
  // prevent, wearing a new shape.
  await act(async () => { await NAV[name](...args); });
}

// Copy only the opened overlay renders. textContent, not getByText, because
// every one of these headings is split across element boundaries ("Take a
// <em>test</em>"), which getByText's default matcher will not join.
//
// AND WHY EVERY CROSS-LINK CASE NEEDS ONE. `expectNoBoundary` passes vacuously
// if the overlay never mounts — `window.openTest` is installed by an effect, so
// a rename or a teardown bug makes the call a silent no-op and the boundary
// check then asserts on the tab underneath. That is the same trap
// src/v2/README.md records three panel-test drafts falling into. Both halves
// were mutation-checked (see the file's history): breaking the component trips
// the boundary, and skipping the open() call fails the copy assertion.
export function expectOpened(re, where) {
  expect(document.body.textContent, `${where}: overlay never opened`).toMatch(re);
}

// ── lazy tab bodies ────────────────────────────────────────────────────
//
// A React.lazy body (the patterns tab) arrives on its own chunk, so the
// click alone renders nothing. A fixed sleep is a race — it lost one under
// full-suite load — so wait for the copy itself, bounded the way growFeed
// is: a body that never arrives should fail an assertion, not hang a suite.
export async function awaitText(re, max = 50) {
  for (let i = 0; i < max && !re.test(document.body.textContent); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
}

// Same wait, keyed on a selector instead of copy — for lazy bodies whose
// arrival is an element rather than a sentence (the Map's canvas).
export async function awaitNode(selector, max = 50) {
  for (let i = 0; i < max && !document.querySelector(selector); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
  return document.querySelector(selector);
}

/**
 * Open the profile or search overlay from the header, and wait for it.
 *
 * ASYNC, and that is the app rather than the harness. Both overlays moved
 * into the after-first-paint chunk at D223, so the header button awaits
 * `loadOverlays()` before setting the state that mounts one — a click no
 * longer paints in the same tick. Fourteen call sites asserted
 * synchronously against a DOM that had not been written yet; one helper is
 * what stops the fifteenth doing it again.
 *
 * Returns the dialog node, which is what most callers actually wanted.
 */
export async function openHeaderOverlay(name) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}$`, "i") }));
  return awaitNode('[role="dialog"]');
}

// ── the feed's mounted window ──────────────────────────────────────────
//
// The feed mounts a window that grows as its tail comes into range (D136),
// so a card past the first page is simply not in the DOM yet. In a browser
// the growth is driven by scroll; in jsdom there is no layout, so
// `scrollHeight - scrollTop - clientHeight` is 0 and the componentDidUpdate
// top-up fires on its own — after a 60ms debounce a synchronous test never
// waits for.
//
// So: any case whose SUBJECT is a card rather than the window has to let the
// window finish first. This awaits growth until the feed stops adding cards,
// which is the honest thing to wait for — a fixed sleep would be a race, and
// a fixed number of pages would need editing every time a fixture's card
// count changed.
//
// Bounded, because a bug that made the window grow forever should fail a
// test rather than hang a suite.
export async function growFeed(max = 40) {
  let last = -1;
  for (let i = 0; i < max; i++) {
    // The DOM's own size, not a card-class count: the feed's cards carry a
    // dozen different classes by type (and a wrong selector here would make
    // this return on its first pass and look like it had worked, which is
    // exactly what the first draft did).
    const n = document.body.innerHTML.length;
    if (n === last) return;
    last = n;
    // Real timers: the debounce is a setTimeout and these suites do not
    // install fake ones. 80 > the 60ms debounce, with room for the render.
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
  }
}
