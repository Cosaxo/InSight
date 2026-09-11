// @vitest-environment jsdom
//
// THE ONE MIRROR STOP THAT DREW A SAMPLE PERSON WITH NO LABEL.
//
// `demoInProd` is a LIVE build whose boot did not attach — an offline cold
// start, or a misconfigured project. The store's own comment says what
// that requires: "The UI is showing demo content to a real user; D1
// requires labeling it and suppressing the seeded fake people."
//
// Every population stop does it: the City stop wears "Preview · sample
// people — reconnecting…". The You stop wore nothing, because
// MirrorPreviewTag returned null for it — written that way, and correct
// WHILE THE STORE IS ATTACHED, since the anchors are then the reader's
// own. On the mock fallback they are not: `map-anchors.js` falls to
// `demoList()` on `!LIVE.enabled`, and `enabled` is false here too, so the
// stop drew the sample persona — her age, her anchor ring, her match
// percentage over her answers — as the reader's own profile.
//
// Two decisions closed this hole before, D66 and D72, and both keyed on
// `LIVE.enabled` alone. `demoInProd` is the branch neither reached, which
// is the general shape worth remembering: a guard written as "not live"
// does not mean "demo build" on a live build that failed to connect.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { mountApp, openHeaderOverlay, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

/** Put the store on the mock fallback: a live build that did not attach. */
function stickOnFallback() {
  Object.defineProperty(window.LIVE, "demoInProd", { value: true, configurable: true });
}

// The store is module state shared across cases, so the override outlives
// the case that set it — and the control below then passes for the wrong
// reason. (It failed for exactly that reason on the first run, which is
// the only reason this hook exists.)
afterEach(() => {
  if (window.LIVE) delete window.LIVE.demoInProd;
});

async function openMirror(stop) {
  fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
  if (stop) {
    const ruler = screen.getByRole("tablist", { name: /how far the mirror reaches/i });
    fireEvent.click(within(ruler).getByRole("tab", { name: stop }));
  }
  await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
}

// …AND THE SAME BRANCH, ONE OVERLAY OVER. The general shape this file's
// header names — "a guard written as 'not live' does not mean 'demo build'
// on a live build that failed to connect" — had a third site, and it is
// the one reachable soonest: the header's Search button is on screen from
// first paint, so this is one tap from a cold start rather than several
// taps into the Mirror.
//
// `app-shell.jsx` passed `samplePeople={!liveOn}`. `search-overlay.jsx`
// states the contract that broke in as many words: "In a live build the
// section renders empty instead (samplePeople is false there), and a real
// user reading an invented sister into their search is the D1 fabrication
// this store predates."
describe("the search overlay on a live build that did not attach", () => {
  it("offers no invented people", async () => {
    await mountApp();
    stickOnFallback();
    await openHeaderOverlay("search");
    const text = document.body.textContent || "";
    expect(text, "a seeded relationship was offered to a real account")
      .not.toMatch(/\bsister\b|\bsince birth\b/i);
    expect(text, "an invented match percentage was drawn for a real account")
      .not.toMatch(/\d+% match/);
  });

  it("…and still offers them on a real demo build", async () => {
    // The control, and it is the half that makes the fix a narrowing rather
    // than a deletion: with no `demoInProd` override the mount IS the demo
    // build, and the sample section is what that build is for.
    await mountApp();
    await openHeaderOverlay("search");
    expect(document.body.textContent, "the demo build lost its sample people")
      .toMatch(/\d+% match/);
  });
});

describe("the Mirror's preview tag on a live build that did not attach", () => {
  it("labels the You stop, which drew the sample persona unlabelled", async () => {
    await mountApp();
    stickOnFallback();
    await openMirror(null);
    // The stop is really the You stop — otherwise this passes against
    // whatever else happens to be on screen, which is the vacuous shape
    // mount-app's own rule exists to close.
    const ruler = screen.getByRole("tablist", { name: /how far the mirror reaches/i });
    expect(within(ruler).getByRole("tab", { name: /^you$/i }).getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent,
      "a sample profile was drawn as the reader's own, with no label").toMatch(/sample profile/i);
  });

  it("says nothing there once the store is attached — the control", async () => {
    // The exclusion is right in an ordinary demo build and in live mode:
    // a "sample" badge over the reader's real anchors is its own lie, and
    // "never draws it" would pass the case above.
    await mountApp();
    await openMirror(null);
    expect(document.body.textContent).not.toMatch(/sample profile/i);
  });
});
