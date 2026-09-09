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
import { act, fireEvent, screen, within } from "@testing-library/react";
import { IS_DATA } from "../spec/sample-data.js";
import { FRIENDS } from "../spec/follows.js";
import { openHeaderOverlay, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

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

    // …and Compare, on the same mount rather than a sixth mountApp().
    //
    // WHY IT IS HERE AT ALL. spec/compare-breakdown.jsx is 334 lines that
    // rendered in NO test. In live mode the Compare body is
    // ui/LiveCompareLens.tsx, which has its own suite; this is the DEMO
    // path — what the screenshots workflow and every demo build draw — and
    // it sat behind a lens tab nothing tapped.
    //
    // It is also exactly the shape src/v2/README.md says no other gate can
    // see: mirror-field-pops.jsx reaches it as `window.CompareBreakdown` at
    // render time, and the component publishes `CBAlignGlyph` on the same
    // line it publishes itself. A rename passes tsc, eslint and
    // check:globals and throws when the tab is tapped.
    //
    // Copy first, then the boundary, per the no-button-overlay rule: an
    // `expectNoBoundary` alone would pass against the stop underneath if
    // the tap stopped opening anything.
    fireEvent.click(screen.getByRole("tab", { name: /^compare$/i }));
    expect(
      screen.getByText(/aligned overall/i),
      "the Compare lens did not render — its tap opened nothing",
    ).toBeTruthy();
    expectNoBoundary("mirror world · compare lens");
  });

  it("draws the embedded relationship map on the Circle stop", async () => {
    // D200 moved relmap.jsx off the eager graph, which turned this picture
    // from a synchronous `typeof RelationshipMap === 'function'` read into an
    // awaited import. Nothing executed the Circle stop before, so the move
    // could have swapped the map for the generic field canvas with every gate
    // green — the same silent swap the old spec-index comment was protecting
    // against, arriving through the fix for it.
    //
    // Demo only, and that is the point rather than a limitation: a live build
    // takes LiveCircleBody (D101) and never renders this component at all,
    // which is WHY the module can be deferred.
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    const ruler = screen.getByRole("tablist", { name: /how far the mirror reaches/i });
    fireEvent.click(within(ruler).getByRole("tab", { name: /^circle$/i }));
    // An awaited act, for the reason openVia's is awaited: the import resolves
    // in a microtask, and a synchronous assertion would read the frame before
    // the map arrived — passing against the fallback it is here to rule out.
    await act(async () => {});
    // The map's own header, which renders only when the embedded map does.
    expect(document.body.textContent, "the Circle stop drew no relationship map")
      .toMatch(/across \d+ circles/i);
    // …and the field canvas it replaces is absent. Without this half the case
    // would pass on a screen showing both, which is not a state the layout has.
    expect(document.body.textContent, "the generic field canvas drew as well")
      .not.toMatch(/closer to you = more alike/i);
    expectNoBoundary("mirror circle · embedded relationship map");
  });

  it("opens the profile overlay without tripping the boundary", async () => {
    const expectNoBoundary = mountApp();
    await openHeaderOverlay("profile");
    expectNoBoundary("profile overlay");
  });

  it("opens the search overlay without tripping the boundary", async () => {
    const expectNoBoundary = mountApp();
    await openHeaderOverlay("search");
    expectNoBoundary("search overlay");
  });

  it("keeps the demo scenes field in the demo profile", async () => {
    // The control for smoke-live's "none of the demo scenes field" case: with
    // LIVE off the section must still render, or the live assertion passes for
    // a section that broke for any reason at all.
    mountApp();
    await openHeaderOverlay("profile");
    expect(screen.getByText(/Scenes you follow/i)).toBeTruthy();
  });

  it("lists the seeded friends in the search overlay (demo keeps them)", async () => {
    // The control for smoke-live's "shows no sample people" case: the same rows
    // must still render with LIVE off, or the live assertion would pass against
    // an overlay that had lost its people section for any reason at all.
    mountApp();
    await openHeaderOverlay("search");
    const seed = FRIENDS.list()
      .map((id) => (IS_DATA.people || []).find((p) => p.id === id))
      .find((p) => p && p.name && !p.anon);
    expect(seed, "sample data has no named seed friend to assert on").toBeTruthy();
    expect(screen.getByText(seed.name)).toBeTruthy();
  });
});
