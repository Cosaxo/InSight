// @vitest-environment jsdom
//
// Mount suite 5 of 5 — the overlays with no button, and the retired Thinking
// test. The shared harness, and the reasoning for all five files, is in
// ./mount-app.jsx.
//
// WHY THE CROSS-LINK OVERLAYS ARE HERE AT ALL. Six of them have no header
// button: `test`, `relmap`, `logic` and `suggest` are opened by other
// components calling `window.openTest()` / `window.openOverlay('relmap')` / …,
// and `person` and `city` by name lookup into the sample data. Nothing mounted
// them, which made them the largest block of this layer that no test executed —
// ~130 KB of the shipped bundle, including the two biggest single components
// after the feed (relmap.jsx and test-overlay.jsx).
//
// The retired-test block rides in the same file because it reaches the app the
// same way (openTest) and because its picker cases and the cross-link cases
// would otherwise pay for two separate app loads to walk the same screen.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { IS_DATA } from "../spec/sample-data.js";
import {
  expectOpened, mountApp, openVia, registerSmokeHooks, SMOKE_TIMEOUT_MS,
} from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

describe("the overlays with no button — opened through window.*", () => {
  it("opens the test flow on its picker", async () => {
    const expectNoBoundary = mountApp();
    // No argument = the selection screen rather than a specific test, which is
    // the one state reachable without inventing a test kind.
    await openVia("openTest");
    expectOpened(/Take a\s*test/i, "test overlay");
    expectNoBoundary("test overlay");
  });

  it("opens the relationship map", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openOverlay", "relmap");
    expectOpened(/Relationship map/i, "relmap overlay");
    expectNoBoundary("relmap overlay");
  });

  it("opens the logic test", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openLogicTest");
    // `ov === 'logic'` renders only `window.LogicOverlay && <…>`, so a module
    // that stopped registering would render nothing at all and the boundary
    // would stay clean. This is the assertion that notices.
    expectOpened(/Logic/, "logic overlay");
    expectNoBoundary("logic overlay");
  });

  it("logic test: a fresh start renders a generated puzzle with six answers", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openLogicTest");
    expectOpened(/Logic/, "logic overlay");
    // With no saved result the overlay opens straight into item 1 of a freshly
    // generated form — this executes the whole generator path (seed →
    // LOGIC_GEN.generateForm → Prim) in jsdom, which no other test renders.
    screen.getByLabelText(/3 by 3 puzzle grid/i);
    expect(screen.getAllByLabelText(/^Answer \d of 6$/)).toHaveLength(6);
    expectNoBoundary("logic fresh start");
  });

  it("logic test: a v1 saved result (no seed, no diffs) still renders the result screen", async () => {
    // The pre-generator payload shape: marks and a timestamp, nothing else — no
    // v, seed, gv, diffs or times. loadResult back-fills the percentile and the
    // lenses fall back per-field; this pins that old devices keep their result
    // screen after the rebuild.
    localStorage.setItem(
      "insight.logicTest.v1",
      JSON.stringify({
        marks: [true, true, true, false, true, false, true, false, false, true, false, false],
        when: 1,
      }),
    );
    try {
      const expectNoBoundary = mountApp();
      await openVia("openLogicTest");
      expectOpened(/Logic/, "logic overlay (v1 result)");
      screen.getByText(/Sharper than \d+% of players/i);
      expectNoBoundary("logic v1 result screen");
    } finally {
      localStorage.removeItem("insight.logicTest.v1");
    }
  });

  it("opens the question suggestion overlay", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openSuggestions");
    expectOpened(/suggest a\s*question/i, "suggest overlay");
    expectNoBoundary("suggest overlay");
  });

  it("opens a person's profile", async () => {
    const expectNoBoundary = mountApp();
    // Named from the fixture rather than hardcoded: openPerson looks the record
    // up in IS_DATA, so a hardcoded name would start silently finding nobody the
    // day the sample data is edited — and the overlay would never open, which is
    // the vacuous pass these suites guard against.
    const who = (IS_DATA.people || []).find((p) => p.name && !p.anon);
    expect(who, "sample data has no named person to open").toBeTruthy();
    await openVia("openPerson", who);
    // The heading is anonName(p), which is the plain name for a non-anon record
    // — hence the find() above rather than [0], so this assertion stays true if
    // the fixture's first entry ever becomes anonymous.
    expectOpened(new RegExp(who.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "person overlay");
    expectNoBoundary("person overlay");
  });

  it("opens a city's profile", async () => {
    const expectNoBoundary = mountApp();
    const city = (IS_DATA.cities || [])[0];
    expect(city, "sample data has no cities to open").toBeTruthy();
    await openVia("openCity", city.name);
    expectOpened(new RegExp(city.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "city overlay");
    expectNoBoundary("city overlay");
  });

  // ── the other half: the chunk that never arrives ────────────────────
  //
  // Everything above runs with loadOverlays() already resolved, so it only ever
  // exercises the happy path. These five components ship in a chunk that loads
  // after first paint, and app-shell reads each off `window` rather than as a
  // bare identifier precisely so a failed load degrades to a blank instead of a
  // ReferenceError that takes the whole shell down.
  //
  // Nothing else in this repo can catch that. `check:globals` and eslint's
  // no-undef are name-level and see a legitimately-defined global either way;
  // the cases above pass with bare identifiers because by then the module is
  // loaded. Deleting the global is the only way to render the frame a broken
  // chunk produces.
  //
  // Mutation-checked: restoring any of these five to a bare identifier in
  // app-shell.jsx fails exactly its own row here on the boundary assertion, and
  // passes again on revert.
  describe("a failed overlay chunk degrades rather than crashing", () => {
    const GUARDED = [
      ["TestOverlay", "openTest", []],
      ["SuggestOverlay", "openSuggestions", []],
      ["LogicOverlay", "openLogicTest", []],
      ["PersonOverlay", "openPerson", () => [(IS_DATA.people || []).find((p) => p.name && !p.anon)]],
      ["CityOverlay", "openCity", () => [(IS_DATA.cities || [])[0]?.name]],
    ];

    for (const [global, opener, argsFor] of GUARDED) {
      it(`${opener} with ${global} missing renders nothing and does not trip the boundary`, async () => {
        const saved = window[global];
        expect(saved, `${global} was never registered — the deferred load is broken`).toBeTruthy();
        delete window[global];
        try {
          const expectNoBoundary = mountApp();
          await openVia(opener, ...(typeof argsFor === "function" ? argsFor() : argsFor));
          expectNoBoundary(`${opener} with ${global} missing`);
        } finally {
          window[global] = saved;
        }
      });
    }
  });
});

// ── the fifth test, retired (D103) ──
//
// What stood here drove `cognitive` end to end: the picker offered it, the
// profile sub-tab drew its card, and a 20-item walk landed on a scored result.
// The owner retired the whole assessment on 2026-08-12, so those cases went
// with the feature — and the inverse is worth exactly what they were, because a
// HALF-removal fails in the shape the harness header describes rather than in a
// name error. A row left in IS_TESTS, an entry left in SUBTABS or a `cognitive`
// anchor left in map-anchors draws a header with nothing under it: no
// ReferenceError for check:globals to catch, no undefined tag, no boundary trip.
//
// Mutation-checked like the block it replaces: restoring `cognitive` to
// IS_TESTS fails the picker case, and restoring the SUBTABS entry fails the
// profile one. The fourth case is the one that would otherwise go unnoticed —
// removing a test by deleting only its registry key leaves every OTHER test
// intact by construction, so nothing here would fail if the removal had also
// taken Social with it.
describe("the retired Thinking test is gone from every surface", () => {
  it("is off the test picker, in both states", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openTest");
    // Both aria-labels the picker can mint for a test (test-overlay.jsx):
    // "<title> result" with a saved result, "Start <title> — about N minutes"
    // without. The demo persona used to carry a cognitive result, so the first
    // is the one a stale registry entry would surface.
    expect(
      screen.queryByLabelText(/^Thinking result$/),
      "the picker still offers the retired test",
    ).toBeNull();
    expect(
      screen.queryByLabelText(/^Start Thinking/),
      "the picker still offers the retired test to take",
    ).toBeNull();
    expectNoBoundary("test picker without the cognitive test");
  });

  it("is off the profile's sub-tab row", async () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(
      screen.queryByRole("button", { name: /^Thinking$/ }),
      "the profile still has a Thinking tab",
    ).toBeNull();
    // RP_TESTS' kicker for the retired test — the string that proves a result
    // card drew, and therefore that one still can.
    expect(document.body.textContent).not.toMatch(/Thinking · Four modes/);
    expectNoBoundary("profile without the Thinking tab");
  });

  it("leaves the other four whole", async () => {
    // The control, and the one case a careless removal fails: deleting a
    // registry key is easy to over-apply, and every assertion above passes just
    // as well on an app with no tests at all.
    const expectNoBoundary = mountApp();
    await openVia("openTest");
    for (const title of ["Big Five", "Politics", "Values", "Social"]) {
      expect(
        screen.queryByLabelText(new RegExp(`^(${title} result|Start ${title} )`)),
        `the picker lost ${title} along with Thinking`,
      ).not.toBeNull();
    }
    const { IS_TESTS } = await import("../spec/test-definitions.js");
    expect(Object.keys(IS_TESTS)).toEqual([
      "big5",
      "political",
      "values",
      "attachment",
    ]);
    expectNoBoundary("test picker with the four surviving tests");
  });
});
