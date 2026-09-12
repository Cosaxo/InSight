// @vitest-environment jsdom
//
// THE DAILY'S OTHER TWO MODES RENDERED IN NO TEST AT ALL.
//
// The daily tab is a three-stop axis — World · Groups · 1v1s (daily-split's
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

// ── an invite link lands on the screen that can act on it ──────────────
//
// A tapped invite stashes its code and nudges the daily tab. The daily
// then chose a mode for a tapped reveal, for a circle notification and
// for an in-app invitation — and not for this, the one case where the
// room is not one this account is already in. So an invitee who got as
// far as the daily tab stood on World with the code sitting unread in
// session storage, and the panel that consumes it lives in Circle.
//
// ASSERTED ON THE BODY AND ON THE RULER, because the two disagreed. The
// daily's mode lives in this component's state (which the body reads) and
// in the shell's `dailyMode` (which both rulers read), and the four
// consumers set state directly without telling the shell. The body moved
// and the ruler did not.
describe("a tapped invite link opens the screen that consumes it", () => {
  it("lands on Circle with no tap, and leaves the code for the panel", async () => {
    sessionStorage.setItem("insight.pendingJoin", "ABCD2345");
    const expectNoBoundary = mountApp();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    // The body: the demo's seeded groups, which only Circle draws.
    expect(
      screen.getAllByText("The Crew").length,
      "the daily stayed on World with an invite code waiting — the join form is in Circle",
    ).toBeGreaterThan(0);
    // …and the ruler agrees with it.
    expect(
      within(dockRuler()).getByRole("tab", { name: "Groups" }).getAttribute("aria-selected"),
      "the body moved to Circle and the ruler still says World — the two copies of the mode disagree",
    ).toBe("true");
    // PEEKED, not taken: the panel's own read is read-and-clear, so a
    // daily that consumed it would navigate to a screen with nothing on
    // it — the invite swallowed one step later than before.
    expect(
      sessionStorage.getItem("insight.pendingJoin"),
      "the daily consumed the code on its way past",
    ).toBe("ABCD2345");
    expectNoBoundary("daily · circle via invite");
    sessionStorage.removeItem("insight.pendingJoin");
  });

  it("lands ONCE — a reader who walks back to World is left there", async () => {
    // THE BUG THIS CAUGHT IN ITS OWN REVIEW. `consumePending` runs on
    // mount AND on every live-store change, and the peek deliberately does
    // not clear — the panel it lands on is what consumes the code. Without
    // a one-shot the two together drag the reader back: measured here, a
    // user who walked from Circle to World was returned to Circle by the
    // next tick, and in a demo build nothing ever reads the code, so that
    // was forever.
    // A DIFFERENT code from the case above, and that is part of the
    // assertion: the one-shot is keyed by the code, not by "have we ever
    // landed", so a second invite still takes the reader to the join
    // form. Re-using the first code here would pass by not landing at
    // all, which is the opposite of what this is about.
    sessionStorage.setItem("insight.pendingJoin", "WXYZ7654");
    const expectNoBoundary = mountApp();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(
      within(dockRuler()).getByRole("tab", { name: "Groups" }).getAttribute("aria-selected"),
      "a second, different invite did not land — the one-shot is keyed too broadly",
    ).toBe("true");

    await switchTo("World");
    await act(async () => {
      window.dispatchEvent(new Event("insight-live-update"));
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(
      within(dockRuler()).getByRole("tab", { name: "World" }).getAttribute("aria-selected"),
      "the unread invite dragged the reader back to Circle after they had left it",
    ).toBe("true");
    expectNoBoundary("daily · world after an invite landing");
    sessionStorage.removeItem("insight.pendingJoin");
  });

  it("leaves the daily on World when no code is waiting", async () => {
    // The control. Without it the case above passes on a daily that
    // always opens on Circle.
    sessionStorage.removeItem("insight.pendingJoin");
    const expectNoBoundary = mountApp();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(
      within(dockRuler()).getByRole("tab", { name: "World" }).getAttribute("aria-selected"),
      "the daily opened on Circle with nothing asking it to",
    ).toBe("true");
    expect(screen.queryAllByText("The Crew").length, "Circle's rail drew on the World stop").toBe(0);
    expectNoBoundary("daily · world");
  });
});

describe("the daily's Circle and 1v1 modes, in demo", () => {
  it("Circle draws the group rail and a revealed group verdict", async () => {
    const expectNoBoundary = mountApp();
    await switchTo("Groups");
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
    await switchTo("1v1s");
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
      await switchTo("1v1s");
      expect(screen.getAllByText("Henrik").length,
        "the 1v1 body drew nothing without window.DuoBody — the empty-div frame").toBeGreaterThan(0);
      expect(document.body.textContent).toMatch(/Round \d+\s*·\s*revealed/);
      expectNoBoundary("daily · 1v1 without the global");
    } finally {
      if (published) window.DuoBody = published;
    }
  });
});
