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
    // …and the card body past it. The verdict line is what a revealed
    // group duel resolves to, so it only exists if the card rendered its
    // reveal arm rather than a shell.
    expect(
      document.body.textContent,
      "Circle drew its rail but no revealed card underneath",
    ).toMatch(/Group verdict/);
    expectNoBoundary("daily · circle");
  });

  it("1v1 draws the partner rail and both halves of a reveal", async () => {
    const expectNoBoundary = mountApp();
    await switchTo("1v1");
    expect(screen.getAllByText("Henrik").length, "the partner rail drew no partners").toBeGreaterThan(0);
    // The 1v1 card's whole point is the pair of readings, and they are
    // drawn by two different arms of the same card — asserting on one
    // would pass on a card that lost the other.
    const body = document.body.textContent;
    expect(body, "the 1v1 card is missing your reading of them").toMatch(/you read Henrik/);
    expect(body, "the 1v1 card is missing their reading of you").toMatch(/Henrik read you/);
    // The streak, which comes from the duel store rather than from the
    // card — a partner with no run would draw a card with no line here.
    expect(body, "no run length on the 1v1 card").toMatch(/\d+-day run/);
    expectNoBoundary("daily · 1v1");
  });
});
