// @vitest-environment jsdom
//
// Mount suite 3 of 5 — the mirror tab and the two overlays the header opens.
// The shared harness, and the reasoning for all five files, is in
// ./mount-app.jsx.
//
// Three of these are deliberate DEMO CONTROLS for assertions in
// smoke-live.test.jsx: with LIVE off the same surfaces must still render, or
// the live half would pass for a section that broke for any reason at all.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { IS_DATA } from "../spec/sample-data.js";
import { FRIENDS } from "../spec/follows.js";
import { mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

describe("the mirror tab and the header's overlays", () => {
  it("renders the mirror tab without tripping the boundary", () => {
    const expectNoBoundary = mountApp();
    // The tabbar labels are user-facing copy ('daily' · 'mirror'); the internal
    // ids are 'track' · 'mirror'. Click the label.
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror");
    // The Mirror is where the live ReferenceError of 2026-07 landed, so be
    // explicit that we actually left the daily tab rather than silently
    // asserting on it twice.
    expect(screen.getByRole("button", { name: /^mirror$/i }).className).toContain("is-active");
    // D103 rides along here rather than mounting the Mirror a second time
    // (~15s under suite load, which is the timeout): compare's assessment list
    // is the surface that read the retired test's RESULT rather than the test,
    // and "cognitive style" was its subtitle.
    expect(document.body.textContent, "a thinking-style reading survived on the Mirror")
      .not.toMatch(/cognitive style/);
  });

  it("renders the World stop's Explore lens, and 'like me' fills a slice", () => {
    // The v18 Explore redesign reads IS_TEST_RESULTS to build its slice axes
    // and rebuilds them behind a module-level cache — a screen no other case
    // executes, because it sits behind a lens-tab tap. Both halves asserted,
    // per the no-button-overlay rule: copy only Explore renders, then the
    // boundary.
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    // Two rulers carry a 'World' tab (the daily's nav is one) — scope to the
    // Mirror's own tablist rather than hoping the other is unmounted.
    const ruler = screen.getByRole("tablist", { name: /how far the mirror reaches/i });
    fireEvent.click(within(ruler).getByRole("tab", { name: /^world$/i }));
    fireEvent.click(screen.getByRole("tab", { name: /^explore$/i }));
    expect(screen.getByText(/pick a slice/i), "Explore did not render its subtitle").toBeTruthy();
    // 'like me' derives a slice from the demo test results — the tap walks
    // sxLikeMe → sxDims → the cache, which is where an undefined global or a
    // renamed member would first throw.
    fireEvent.click(screen.getByRole("button", { name: /like me/i }));
    expectNoBoundary("mirror world · explore lens");
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

  it("keeps the demo scenes field in the demo profile", () => {
    // The control for smoke-live's "none of the demo scenes field" case: with
    // LIVE off the section must still render, or the live assertion passes for
    // a section that broke for any reason at all.
    mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(screen.getByText(/Scenes you follow/i)).toBeTruthy();
  });

  it("lists the seeded friends in the search overlay (demo keeps them)", () => {
    // The control for smoke-live's "shows no sample people" case: the same rows
    // must still render with LIVE off, or the live assertion would pass against
    // an overlay that had lost its people section for any reason at all.
    mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    const seed = FRIENDS.list()
      .map((id) => (IS_DATA.people || []).find((p) => p.id === id))
      .find((p) => p && p.name && !p.anon);
    expect(seed, "sample data has no named seed friend to assert on").toBeTruthy();
    expect(screen.getByText(seed.name)).toBeTruthy();
  });
});
