// @vitest-environment jsdom
//
// Mount suite 5 of 5 — the overlays with no button, and the retired Thinking
// test. The shared harness, and the reasoning for all five files, is in
// ./mount-app.jsx.
//
// WHY THE CROSS-LINK OVERLAYS ARE HERE AT ALL. Five of them have no header
// button: `relmap`, `logic` and `suggest` are opened by other components
// calling `NAV.openOverlay('relmap')` / …, and `person` and `city` by name
// lookup into the sample data. Nothing mounted them, which made them the
// largest block of this layer that no test executed — ~130 KB of the shipped
// bundle, including the biggest single component after the feed (relmap.jsx).
//
// SIX until D121, when `test` and the overlay behind it were deleted: the four
// core instruments fill from the feed and have no sit-down flow. Every case
// below that reached a surface through the picker now reaches it through the
// profile, which is where those surfaces live.

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { IS_DATA } from "../spec/sample-data.js";
import { openHeaderOverlay,
  expectOpened, mountApp, openVia, registerSmokeHooks, SMOKE_TIMEOUT_MS,
} from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

describe("the overlays with no button — opened through the nav registry", () => {
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

  it("opens the ask-a-question door", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openSuggestions");
    // "ask a question" since D288 §1 retired the community board — the
    // door is the paid path alone, and the title says what the room is.
    expectOpened(/ask a\s*question/i, "suggest overlay");
    expectNoBoundary("suggest overlay");
  });

  // The door's honesty arithmetic (D288 §3, D167): everything it prints
  // comes from the COMMITTED content/pricing.json, and the committed card
  // is the empty-ledger fold — every idx at floor, every day open, no
  // completed campaign. So the board must say "tomorrow" three times and
  // never the design's mocked demand, and the composer must state the
  // no-forecast line and a contract sheet without the estimate clause.
  // This is the only test that executes the composer path at all.
  it("the composer prints the committed card and withholds every forecast", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openSuggestions");
    expect(screen.getAllByText(/next open tomorrow/i)).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/contested|12 Sep/);
    // The menu (D376): each row prints its price per reach and what that
    // buys at the committed line — €0.02 with nobody else asking — over
    // the one window. The per-answer line is one tap in, not on the row.
    expect(screen.getByText(/up to 500 answers · 29 days/)).toBeTruthy();
    expect(screen.getByText(/up to 1 250 answers · 29 days/)).toBeTruthy();
    expect(screen.getByText(/up to 2 500 answers · 29 days/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/per answer/i);
    // into the composer — the accessible name needs the "+", because the
    // header's compose icon answers to the bare phrase too
    fireEvent.click(screen.getByRole("button", { name: /^\+ Ask a question$/i }));
    fireEvent.change(screen.getByPlaceholderText(/Sunrise or sunset/i), { target: { value: "Ferry or bridge?" } });
    fireEvent.change(screen.getByPlaceholderText("Option 1"), { target: { value: "Ferry" } });
    fireEvent.change(screen.getByPlaceholderText("Option 2"), { target: { value: "Bridge" } });
    expect(screen.getByText(/No campaign measured here yet — no forecast/)).toBeTruthy();
    // The budget (D372): the presets off the card, the smallest chosen,
    // and the line saying what it buys — a ceiling, not a forecast.
    expect(screen.getByRole("button", { name: "€5", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "€50", pressed: false })).toBeTruthy();
    expect(screen.getByText(/up to 250 answers · only what arrives is billed/)).toBeTruthy();
    // The buyer's link (D378): optional, and the composer says where it
    // will show — as the bare domain, after the answer.
    fireEvent.change(screen.getByPlaceholderText(/your-site\.no/), { target: { value: "https://www.harboursauna.no/winter" } });
    expect(screen.getByText(/shows as harboursauna\.no ↗ after the answer/)).toBeTruthy();
    expect(screen.getByText(/after answering: harboursauna\.no ↗/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Price it for/ }));
    expect(screen.getByText(/harboursauna\.no · after the answer/)).toBeTruthy();
    // the contract sheet: the rate without the mechanism's multiplier
    // (D372 put the law behind a tap), the budget as the cap, the
    // functional channel (D313 retired "arranged directly" the day the
    // loop stopped being a human), and no make-good clause — the refund
    // is the promise the closer actually keeps, and the old free-extension
    // line must stay out
    expect(screen.getByText(/per answer · locked at approval/)).toBeTruthy();
    expect(screen.getByText(/€5 up front · up to 250 answers · unserved answers refund at close/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/×1 · |×0\.9|Your cap/);
    expect(screen.getByText(/Checked automatically before anything is charged\./)).toBeTruthy();
    expect(screen.getByText(/refunds automatically at close/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Arranged directly|no self-serve yet/);
    expect(document.body.textContent).not.toMatch(/under 80% of the estimate|extends free/);
    expectNoBoundary("the composer and its contract sheet");
  });

  // Picking a menu row (D376) opens the composer on that reach at that
  // price — the row's chip pressed, the ceiling it buys restated — with
  // the other chips still there to adjust.
  it("a menu row opens the composer at its own price", async () => {
    const expectNoBoundary = mountApp();
    await openVia("openSuggestions");
    fireEvent.click(screen.getByRole("button", { name: /up to 1 250 answers · 29 days/ }));
    expect(screen.getByRole("button", { name: "€25", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "€5", pressed: false })).toBeTruthy();
    expect(screen.getByText(/up to 1 250 answers · only what arrives is billed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Price it for/ }).textContent).not.toMatch(/Everyone/);
    expectNoBoundary("the composer opened from a menu row");
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
  // exercises the happy path. These four components ship in a chunk that loads
  // after first paint, and app-shell reads each off `window` rather than as a
  // bare identifier precisely so a failed load degrades to a blank instead of a
  // ReferenceError that takes the whole shell down.
  //
  // FOUR, and the table below is the list — it said five while holding four,
  // which is the drift that matters most in a table that is itself the
  // coverage claim. The two overlays in that chunk NOT here are the two
  // app-shell renders as bare identifiers: relmap, whose own note gives the
  // reason, and search. Neither can be reached with its name unbound —
  // openOverlay awaits the chunk and returns on failure, so `ov` never
  // becomes theirs — and neither can gain the guard cheaply: `window.X &&
  // <window.X>` is two shared-global references where a bare tag is one, so
  // check:globals rule 4 refuses it as new coupling. Measured, not assumed:
  // guarding the search site takes app-shell.jsx from 39 to 40 and fails the
  // ratchet. The day either name becomes a real import, the guard comes with
  // it and this table grows a row.
  //
  // Nothing else in this repo can catch that. `check:globals` and eslint's
  // no-undef are name-level and see a legitimately-defined global either way;
  // the cases above pass with bare identifiers because by then the module is
  // loaded. Deleting the global is the only way to render the frame a broken
  // chunk produces.
  //
  // Mutation-checked: restoring any of these four to a bare identifier in
  // app-shell.jsx fails exactly its own row here on the boundary assertion, and
  // passes again on revert.
  // The overlay chunk landing is not the only thing a search hit needs. The
  // expanded row renders the FEED's card, and the feed is a different
  // deferred chunk — main.jsx starts both loaders without either awaiting
  // the other, and a failed chunk is never retried. Unguarded, the tap
  // rendered undefined as an element type and the boundary took the whole
  // search overlay. This is the one case in the file where the missing name
  // belongs to a chunk other than the one under test.
  it("expands a search hit with the feed chunk missing — a collapsed row, not a snag", async () => {
    const WorldFeed = window.WorldFeed;
    expect(WorldFeed, "the feed never registered — this case would prove nothing").toBeTruthy();
    delete window.WorldFeed;
    try {
      const expectNoBoundary = mountApp();
      await openVia("openOverlay", "search");
      const field = screen.getByPlaceholderText(/questions, topics, people/i);
      await act(async () => {
        fireEvent.change(field, { target: { value: "a" } });
      });
      const hit = document.querySelector("button.search-hit");
      expect(hit, "no search hit to tap — the query matched nothing").toBeTruthy();
      await act(async () => {
        fireEvent.click(hit);
      });
      expectNoBoundary("search hit, feed chunk missing");
    } finally {
      window.WorldFeed = WorldFeed;
    }
  });

  describe("a failed overlay chunk degrades rather than crashing", () => {
    const GUARDED = [
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
  // The picker case that stood first here went with the picker (D121). Its
  // claim did not: the profile's sub-tab row is the surface that offers the
  // instruments now, and the case below it already walks that row.

  it("is off the profile's sub-tab row", async () => {
    const expectNoBoundary = mountApp();
    await openHeaderOverlay("profile");
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
    //
    // Through the profile's sub-tab row since D121 — the picker this used to
    // read is gone, and the row is where the four instruments are offered now.
    const expectNoBoundary = mountApp();
    await openHeaderOverlay("profile");
    for (const label of ["Big 5", "Politics", "Values", "Social"]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(`^${label}$`) }),
        `the profile lost its ${label} tab along with Thinking`,
      ).not.toBeNull();
    }
    const { IS_TESTS } = await import("../spec/test-definitions.js");
    expect(Object.keys(IS_TESTS)).toEqual([
      "big5",
      "political",
      "values",
      "attachment",
    ]);
    expectNoBoundary("profile with the four surviving tests");
  });
});

// D344 put Account & privacy behind a gear in the profile's corner — and
// the gear is live-only, because the panel it opens states facts about a
// real account and renders nothing in demo. A gear whose sheet can only
// ever open empty is D167's rule one control down, so the button itself
// must be absent, not just inert. The live half — the gear exists and its
// sheet holds the panel — is in smoke-live; what a demo mount can prove
// is the absence.
describe("the profile's account gear (D344)", () => {
  it("is not offered in a demo build", async () => {
    const expectNoBoundary = mountApp();
    await openHeaderOverlay("profile");
    expect(
      screen.queryByRole("button", { name: "Account & privacy" }),
      "a demo profile offers the gear, whose sheet can only open empty",
    ).toBeNull();
    expectNoBoundary("profile without the account gear");
  });
});
