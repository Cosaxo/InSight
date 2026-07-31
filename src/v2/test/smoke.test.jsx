// @vitest-environment jsdom
//
// Mount tests for the spec layer — the ~19.5k lines of ported JSX that
// nothing else in this repo executes.
//
// WHY THIS EXISTS. The layer talks through global scope (src/v2/README.md),
// so a missing or renamed global is not a compile error; it is a
// ReferenceError at RENDER time, on whichever screen happens to touch it.
// Two shipped that way — `ReactDOM` at six createPortal sites and a bare
// `sign` in the profile editor — and `check:globals` was written afterwards
// to catch the static half. This catches the half a scanner cannot: a name
// that exists but is undefined by the time the component reads it, and any
// other throw on first paint.
//
// WHY IT ASSERTS ON THE BOUNDARY, NOT ON A THROWN ERROR. app-shell wraps
// both tabs and every overlay in `ErrorBoundary` — deliberately, so one bad
// component costs a card rather than the app. That means `render()` returns
// happily while the screen underneath is the "This view hit a snag." card. A
// test that only checked for an exception would have passed on both of the
// bugs above. So each case asserts the boundary did NOT trip, by its
// componentDidCatch log and by its fallback copy.
//
// SCOPE. First paint of every surface reachable without inventing data:
// both tabs, the two overlays the header opens, and the six the app opens
// through its `window.*` cross-link API. This is a smoke test — it proves
// the screens mount, not that they are correct. Interaction and
// assertion-on-content is the next layer, and the 27 deferred React
// Compiler findings in src/v2/README.md are the work queue for it.
//
// WHY THE CROSS-LINK OVERLAYS ARE HERE. Four of them have no header button:
// `test`, `relmap`, `logic` and `suggest` are opened by other components
// calling `window.openTest()` / `window.openOverlay('relmap')` / …, and
// `person` and `city` by name lookup into the sample data. Nothing mounted
// them, which made them the largest block of this layer that no test
// executed — ~130 KB of the shipped bundle, including the two biggest
// single components after the feed (relmap.jsx and test-overlay.jsx).
//
// AND WHY EACH ONE ASSERTS IT ACTUALLY OPENED. `expectNoBoundary` passes
// vacuously if the overlay never mounts — `window.openTest` is installed by
// an effect, so a rename or a teardown bug makes the call a silent no-op
// and the boundary check then asserts on the tab underneath. That is the
// same trap src/v2/README.md records three panel-test drafts falling into.
// So every case below pairs the boundary check with copy only that overlay
// renders, and BOTH halves were mutation-checked (see the file's history):
// breaking the component trips the boundary, and skipping the open() call
// fails the copy assertion.

import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The boundary's own log line (app-shell.jsx, componentDidCatch). Matching
// on this rather than on any console.error keeps the assertion deterministic
// — React's dev build logs plenty of other things.
const BOUNDARY_LOG = "[InSight] boundary caught:";
// …and the copy it renders in place of the crashed subtree.
const BOUNDARY_COPY = /This view hit a snag/i;

let App;
let errorSpy;

beforeAll(async () => {
  // spec-index loads all ~85 modules for their side effects, in the order
  // the standalone's script tags had. `App` only exists afterwards.
  await import("../spec-index.js");
  App = globalThis.App;
});

afterEach(() => {
  cleanup();
  errorSpy?.mockRestore();
});

// Mount the app and hand back a checker. Every case ends by calling it,
// including after whatever clicking it did.
function mountApp() {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  return function expectNoBoundary(where) {
    const caught = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes(BOUNDARY_LOG),
    );
    // Surface the real error, not just "expected 0 to be 1" — the whole
    // point is to name the undefined global on the first read.
    expect(caught.map((c) => String(c[1])).join(" · "), `${where}: ErrorBoundary caught`).toBe("");
    expect(screen.queryByText(BOUNDARY_COPY), `${where}: boundary fallback rendered`).toBeNull();
  };
}

describe("spec layer mounts", () => {
  it("exposes App on globalThis once spec-index has loaded", () => {
    // If this fails, spec-index.js lost an entry or app-shell stopped
    // registering — everything below would fail confusingly instead.
    expect(typeof App).toBe("function");
  });

  it("renders the daily tab (the default) without tripping the boundary", () => {
    const expectNoBoundary = mountApp();
    expectNoBoundary("daily");
  });

  it("renders the mirror tab without tripping the boundary", () => {
    const expectNoBoundary = mountApp();
    // The tabbar labels are user-facing copy ('daily' · 'mirror'); the
    // internal ids are 'track' · 'mirror'. Click the label.
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror");
    // The Mirror is where the live ReferenceError of 2026-07 landed, so be
    // explicit that we actually left the daily tab rather than silently
    // asserting on it twice.
    expect(screen.getByRole("button", { name: /^mirror$/i }).className).toContain("is-active");
  });

  it("opens the profile overlay without tripping the boundary", () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expectNoBoundary("profile overlay");
  });

  it("opens the search overlay without tripping the boundary", () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    expectNoBoundary("search overlay");
  });
});

// ── the cross-link overlays ────────────────────────────────────────────
//
// These open through globals app-shell installs in an effect rather than
// through a button, so the call has to run inside act(): it sets state from
// outside React's event system, and without act() the assertion below runs
// against the frame before the overlay rendered.
function openVia(name, ...args) {
  expect(typeof window[name], `window.${name} is not installed`).toBe("function");
  act(() => { window[name](...args); });
}

// Copy only the opened overlay renders. textContent, not getByText, because
// every one of these headings is split across element boundaries
// ("Take a <em>test</em>"), which getByText's default matcher will not join.
function expectOpened(re, where) {
  expect(document.body.textContent, `${where}: overlay never opened`).toMatch(re);
}

describe("the overlays with no button — opened through window.*", () => {
  it("opens the test flow on its picker", () => {
    const expectNoBoundary = mountApp();
    // No argument = the selection screen rather than a specific test, which
    // is the one state reachable without inventing a test kind.
    openVia("openTest");
    expectOpened(/Take a\s*test/i, "test overlay");
    expectNoBoundary("test overlay");
  });

  it("opens the relationship map", () => {
    const expectNoBoundary = mountApp();
    openVia("openOverlay", "relmap");
    expectOpened(/Relationship map/i, "relmap overlay");
    expectNoBoundary("relmap overlay");
  });

  it("opens the logic test", () => {
    const expectNoBoundary = mountApp();
    openVia("openLogicTest");
    // `ov === 'logic'` renders only `window.LogicOverlay && <…>`, so a
    // module that stopped registering would render nothing at all and the
    // boundary would stay clean. This is the assertion that notices.
    expectOpened(/Logic/, "logic overlay");
    expectNoBoundary("logic overlay");
  });

  it("opens the question suggestion overlay", () => {
    const expectNoBoundary = mountApp();
    openVia("openSuggestions");
    expectOpened(/suggest a\s*question/i, "suggest overlay");
    expectNoBoundary("suggest overlay");
  });

  it("opens a person's profile", () => {
    const expectNoBoundary = mountApp();
    // Named from the fixture rather than hardcoded: openPerson looks the
    // record up in window.IS_DATA, so a hardcoded name would start silently
    // finding nobody the day the sample data is edited — and the overlay
    // would never open, which is the vacuous pass this file guards against.
    const who = (window.IS_DATA.people || []).find((p) => p.name && !p.anon);
    expect(who, "sample data has no named person to open").toBeTruthy();
    openVia("openPerson", who);
    // The heading is anonName(p), which is the plain name for a non-anon
    // record — hence the find() above rather than [0], so this assertion
    // stays true if the fixture's first entry ever becomes anonymous.
    expectOpened(new RegExp(who.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "person overlay");
    expectNoBoundary("person overlay");
  });

  it("opens a city's profile", () => {
    const expectNoBoundary = mountApp();
    const city = (window.IS_DATA.cities || [])[0];
    expect(city, "sample data has no cities to open").toBeTruthy();
    openVia("openCity", city.name);
    expectOpened(new RegExp(city.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "city overlay");
    expectNoBoundary("city overlay");
  });
});
