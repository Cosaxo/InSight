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
// both tabs, and the two overlays the header opens. This is a smoke test —
// it proves the screens mount, not that they are correct. Interaction and
// assertion-on-content is the next layer, and the 27 deferred React
// Compiler findings in src/v2/README.md are the work queue for it.

import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
