// @vitest-environment jsdom
//
// THE DAILY'S OTHER TWO MODES RENDERED IN NO TEST AT ALL.
//
// The daily tab is a three-stop axis — World · Circle · 1v1 (daily-split's
// `modeAxis`) — and every mount suite stops at World. Nothing in
// src/v2/test walks the ruler sideways, so `GroupDailyBody` (500 lines)
// and `DuoBody` (448) were at 4% and 10% of statements, which is their
// module preamble and nothing else. Measured off
// `--coverage.include='src/v2/spec/**'`; the repo's coverage config
// excludes spec/ on purpose, which is also why the hole was invisible.
//
// These are the DEMO bodies — what a demo build and the screenshots
// workflow draw. In live mode the same two slots hold `LiveDuelPanel`
// behind a React.lazy, which has its own suite; that is the reason the
// gap is easy to miss and not a reason it is cheap. The demo path is the
// one a reader meets before signing in.
//
// SO THE ASSERTIONS ARE ON CONTENT, NOT ON THE BOUNDARY ALONE. A body
// that failed to mount at all leaves the World stop underneath, and an
// `expectNoBoundary` would pass happily against it — the same vacuous
// shape mount-app.jsx's cross-link rule exists to close. Each case names
// something only its own mode draws, then checks the boundary.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

// TWO rulers carry this aria-label — the docked one in the header and the
// body's own — so `getByRole` finds both and throws. The dock is the one a
// thumb reaches, and `switchMode` is the same handler on either.
const dockRuler = () => {
  const el = document.querySelector(".h-dockruler");
  if (!el) throw new Error("the daily's dock ruler is not mounted");
  return el;
};

// `switchMode` slides the body out, then swaps the mode 160ms later — the
// same beat the swipe gesture makes. Reduced motion would skip it, but
// setup-dom's matchMedia answers a frozen "no" on purpose, so the wait is
// real. Bounded well past the 160 rather than exactly on it: this runs
// under full-suite load.
async function switchTo(label) {
  fireEvent.click(within(dockRuler()).getByRole("tab", { name: label }));
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  expect(
    within(dockRuler()).getByRole("tab", { name: label }).getAttribute("aria-selected"),
    `the ruler never moved to ${label}`,
  ).toBe("true");
}

describe("the daily's Circle and 1v1 modes, in demo", () => {
  it("Circle draws the group rail and a revealed group verdict", async () => {
    const expectNoBoundary = mountApp();
    await switchTo("Circle");
    // The rail — the demo's seeded groups, by name. `getAllByText` because
    // the current group appears twice: once as a rail chip, once as the
    // card's own heading.
    expect(screen.getAllByText("The Crew").length, "the group rail drew no groups").toBeGreaterThan(0);
    // …and the card body past it. The last reveal is what a played round
    // resolves to (D437: who the room named, or where it lands between
    // two poles), so it only exists if the card rendered its reveal arm
    // rather than a shell.
    expect(
      document.body.textContent,
      "Circle drew its rail but no revealed card underneath",
    ).toMatch(/· revealed|closed at the deadline/);
    expect(
      document.body.textContent,
      "the revealed round has no verdict line",
    ).toMatch(/ is the | are the | share |The group lands on/);
    expectNoBoundary("daily · circle");
  });

  it("1v1 draws the partner rail and both halves of a reveal", async () => {
    const expectNoBoundary = mountApp();
    await switchTo("1v1");
    expect(screen.getAllByText("Henrik").length, "the partner rail drew no partners").toBeGreaterThan(0);
    // The 1v1 card's whole point is the pair of readings, and they are
    // drawn as two runs on one axis (D437) — asserting on one would pass
    // on a card that lost the other.
    expect(screen.getAllByLabelText(/How well you read Henrik, one mark per round/).length,
      "the 1v1 card is missing your reading of them").toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/How well Henrik reads you, one mark per round/).length,
      "the 1v1 card is missing their reading of you").toBeGreaterThan(0);
    // The record comes from the duel store rather than from the card — a
    // partner with no run would draw a card with no reveal above the ask.
    expect(document.body.textContent, "no revealed round on the 1v1 card").toMatch(/Round \d+\s*·\s*revealed/);
    expectNoBoundary("daily · 1v1");
  });

  // …AND IT DOES NOT DEPEND ON A GLOBAL BEING THERE FIRST. This arm used
  // to be `h(window.DuoBody || 'div')` — resolved at render time, from a
  // name `loadOverlays()` publishes and `main.jsx` deliberately schedules
  // no re-render after. `spec-index.js` called it "dead code the installed
  // app cannot execute", and it is not: `liveDuels` is `LIVE.enabled`,
  // which live.ts's own `demoInProd` defines as FALSE on a live build
  // whose boot has not attached — "the UI is showing demo content to a
  // real user". So an offline cold start on a shipped app took this arm,
  // drew an empty div, and stayed empty for the session even once the
  // chunk landed. The group arm one line up has always degraded into the
  // ErrorBoundary instead, which is at least visible.
  it("1v1 draws without the overlay group's global ever being published", async () => {
    // The state a cold start is in before `loadOverlays()` resolves — and
    // the state it never leaves if that fetch fails.
    const published = window.DuoBody;
    delete window.DuoBody;
    try {
      const expectNoBoundary = mountApp();
      await switchTo("1v1");
      expect(screen.getAllByText("Henrik").length,
        "the 1v1 body drew nothing without window.DuoBody — the empty-div frame").toBeGreaterThan(0);
      expect(document.body.textContent).toMatch(/Round \d+\s*·\s*revealed/);
      expectNoBoundary("daily · 1v1 without the global");
    } finally {
      if (published) window.DuoBody = published;
    }
  });
});
