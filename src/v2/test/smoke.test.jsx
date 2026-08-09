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
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IS_DATA } from "../spec/sample-data.js";
import { FRIENDS } from "../spec/follows.js";

// 15s per test, not the 5s default: every case here mounts the FULL app in
// jsdom, and the v15 revision roughly doubled the spec layer's feed weight —
// the slowest cases sat at ~4.8s before it and tip over under suite load.
vi.setConfig({ testTimeout: 15000 });

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
  const specIndex = await import("../spec-index.js");
  // …except the world feed, which main.jsx loads after first paint. Await
  // it here or every case below would silently stop covering the largest
  // module in the layer — the feed renders on the daily tab, so dropping it
  // costs coverage without failing anything.
  await specIndex.loadWorldFeed();
  // …and the six no-button overlays, for the same reason. Every case in the
  // cross-link describe below opens one of these, and the openers await this
  // same memoised promise — so strictly this line only removes a wait from
  // the first such case. It is here rather than implied because a suite that
  // depends on a load nobody in it names is a suite that breaks confusingly
  // the day the openers stop awaiting.
  await specIndex.loadOverlays();
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

  // The world feed loads after first paint (loadWorldFeed, spec-index.js),
  // which gives the daily tab a SECOND renderable shape nothing used to
  // exercise: the frame before the chunk lands. daily-split guards on
  // `window.WorldFeed` and renders no feed node without it — these two cases
  // pin both halves of that, because each is invisible to the other.
  it("renders the daily tab before the world feed chunk has landed", () => {
    const WorldFeed = window.WorldFeed;
    const ConsequenceBeat = window.ConsequenceBeat;
    delete window.WorldFeed;
    delete window.ConsequenceBeat;
    try {
      const expectNoBoundary = mountApp();
      expect(
        screen.queryByRole("button", { name: /add a topic/i }),
        "the feed rendered without its module — the guard is not the one being tested",
      ).toBeNull();
      expectNoBoundary("daily, feed not yet loaded");
    } finally {
      window.WorldFeed = WorldFeed;
      window.ConsequenceBeat = ConsequenceBeat;
    }
  });

  it("renders the world feed once its chunk has landed", () => {
    // The other half, and the one that stops the deferral quietly becoming a
    // deletion: if loadWorldFeed stopped resolving, or dropped a module, the
    // case above would still pass and the feed would simply never appear.
    mountApp();
    expect(
      screen.queryByRole("button", { name: /add a topic/i }),
      "the feed did not render after loadWorldFeed resolved",
    ).not.toBeNull();
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

  it("lists the seeded friends in the search overlay (demo keeps them)", () => {
    // The control for smoke-live's "shows no sample people" case: the same
    // rows must still render with LIVE off, or the live assertion would
    // pass against an overlay that had lost its people section for any
    // reason at all.
    mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    const seed = FRIENDS.list()
      .map((id) => (IS_DATA.people || []).find((p) => p.id === id))
      .find((p) => p && p.name && !p.anon);
    expect(seed, "sample data has no named seed friend to assert on").toBeTruthy();
    expect(screen.getByText(seed.name)).toBeTruthy();
  });
});

// ── the v17 nav (D43) ──────────────────────────────────────────────────
//
// The daily's mode switcher stopped being a pill portalled into the header
// and became a ruler in flow, and the shell now writes `data-view` for
// scroll-memory.js to key on. Both are invisible to every other gate here:
// the ruler is a tab list either way, so check:globals and tsc see no
// difference, and `data-view` is a string nothing type-checks.
//
// What each case would catch, stated so nobody trims one as redundant:
//   - the ruler case fails if DailySplit stops receiving `ruler`, or if the
//     portal path comes back and empties the in-flow row;
//   - the mode case fails if the shell's `mode` prop and DailySplit's own
//     state stop tracking each other (they are two-way: componentDidUpdate
//     follows the prop, onMode reports the ruler's own taps back up);
//   - the data-view case fails if scroll memory's key stops moving, which
//     would leave every view restoring to the last one's position.
describe("the daily's ruler is the nav (v17)", () => {
  // TWO rulers carry this label at once — the in-flow one and the compact
  // copy the header holds ready to dock — so a plain byRole finds both. The
  // in-flow one is the one outside .app-header.
  const rulers = () => screen.queryAllByRole("tablist", { name: /how far this answer reaches/i });
  const ruler = () => rulers().find((r) => !r.closest(".app-header")) || null;

  it("renders the daily's three stops in flow, not in the header slot", () => {
    const expectNoBoundary = mountApp();
    const row = ruler();
    expect(row, "the daily ruler did not render in flow").not.toBeNull();
    // The header holds its own copy, hidden until the in-flow one scrolls
    // away — that pair IS the dock, so both halves have to be present.
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

// ── the cross-link overlays ────────────────────────────────────────────
//
// These open through globals app-shell installs in an effect rather than
// through a button, so the call has to run inside act(): it sets state from
// outside React's event system, and without act() the assertion below runs
// against the frame before the overlay rendered.
async function openVia(name, ...args) {
  expect(typeof window[name], `window.${name} is not installed`).toBe("function");
  // AWAITED act, because these openers are async now: each awaits
  // loadOverlays() before setting the state that mounts its overlay
  // (spec-index.js, app-shell's openDeferred). A bare synchronous
  // `act(() => …)` returns before the promise settles, so every assertion
  // below would run against the frame BEFORE the overlay rendered — which
  // is the vacuous pass this file exists to prevent, wearing a new shape.
  await act(async () => { await window[name](...args); });
}

// Copy only the opened overlay renders. textContent, not getByText, because
// every one of these headings is split across element boundaries
// ("Take a <em>test</em>"), which getByText's default matcher will not join.
function expectOpened(re, where) {
  expect(document.body.textContent, `${where}: overlay never opened`).toMatch(re);
}

describe("the overlays with no button — opened through window.*", () => {
  it("opens the test flow on its picker", async () => {
    const expectNoBoundary = mountApp();
    // No argument = the selection screen rather than a specific test, which
    // is the one state reachable without inventing a test kind.
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
    // `ov === 'logic'` renders only `window.LogicOverlay && <…>`, so a
    // module that stopped registering would render nothing at all and the
    // boundary would stay clean. This is the assertion that notices.
    expectOpened(/Logic/, "logic overlay");
    expectNoBoundary("logic overlay");
  });

  it("logic test: a fresh start renders a generated puzzle with six answers", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openLogicTest");
    expectOpened(/Logic/, "logic overlay");
    // With no saved result the overlay opens straight into item 1 of a
    // freshly generated form — this executes the whole generator path
    // (seed → LOGIC_GEN.generateForm → Prim) in jsdom, which no other
    // test renders.
    screen.getByLabelText(/3 by 3 puzzle grid/i);
    expect(screen.getAllByLabelText(/^Answer \d of 6$/)).toHaveLength(6);
    expectNoBoundary("logic fresh start");
  });

  it("logic test: a v1 saved result (no seed, no diffs) still renders the result screen", async () => {
    // The pre-generator payload shape: marks and a timestamp, nothing
    // else — no v, seed, gv, diffs or times. loadResult back-fills the
    // percentile and the lenses fall back per-field; this pins that old
    // devices keep their result screen after the rebuild.
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
    // Named from the fixture rather than hardcoded: openPerson looks the
    // record up in IS_DATA, so a hardcoded name would start silently
    // finding nobody the day the sample data is edited — and the overlay
    // would never open, which is the vacuous pass this file guards against.
    const who = (IS_DATA.people || []).find((p) => p.name && !p.anon);
    expect(who, "sample data has no named person to open").toBeTruthy();
    await openVia("openPerson", who);
    // The heading is anonName(p), which is the plain name for a non-anon
    // record — hence the find() above rather than [0], so this assertion
    // stays true if the fixture's first entry ever becomes anonymous.
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
  // Everything above runs with loadOverlays() already resolved, so it only
  // ever exercises the happy path. These five components ship in a chunk
  // that loads after first paint, and app-shell reads each off `window`
  // rather than as a bare identifier precisely so a failed load degrades to
  // a blank instead of a ReferenceError that takes the whole shell down.
  //
  // Nothing else in this repo can catch that. `check:globals` and eslint's
  // no-undef are name-level and see a legitimately-defined global either
  // way; the cases above pass with bare identifiers because by then the
  // module is loaded. Deleting the global is the only way to render the
  // frame a broken chunk produces.
  //
  // Mutation-checked: restoring any of these five to a bare identifier in
  // app-shell.jsx fails exactly its own row here on the boundary assertion,
  // and passes again on revert.
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
