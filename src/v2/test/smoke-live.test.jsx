// @vitest-environment jsdom
//
// The demo smoke test's other half: the same screens, mounted with
// `window.LIVE` present and enabled.
//
// WHY A SECOND FILE. `smoke.test.jsx` runs with LIVE undefined, so every
// `if (window.LIVE && window.LIVE.enabled)` branch in the spec layer is
// unreached by the suite. Two of those branches are load-bearing product
// decisions rather than cosmetics:
//
//   D9  live mode drops the Mirror's City stop, because Near IS your city
//       there and two stops resolving to one cohort is how a scale starts
//       lying about what it measures.
//   D11 the feed's argument surfaces — named takes, counter-arguments,
//       "minds moved", crossfire, friend dots — are unreachable from a live
//       card, and a card below the k-floor shows neither the share numeral
//       NOR the fill, because a fill height IS the share in a different
//       alphabet.
//
// D11 records that this was "verified rather than assumed" by forcing a demo
// question live in a browser and looking. That was true once, by hand. The
// cases below make it true on every run.
//
// Same assertion style as the demo file, and for the same reason: app-shell
// wraps every tab and overlay in ErrorBoundary, so a crashed screen still
// returns cleanly from render(). Assert on the boundary, never on a throw.

import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// 15s per test, not the 5s default: every case here mounts the FULL app in
// jsdom, and the v15 revision roughly doubled the spec layer's feed weight —
// the slowest cases sat at ~4.8s before it and tip over under suite load.
vi.setConfig({ testTimeout: 15000 });
import { FEED_OPTIONS, fixtureSurfaceMismatch, installLive } from "./live-fixture";

const BOUNDARY_LOG = "[InSight] boundary caught:";
const BOUNDARY_COPY = /This view hit a snag/i;

let App;
let errorSpy;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  // The feed is lazy since loadWorldFeed() (spec-index.js) and every D11
  // case below asserts on a feed CARD, so without this they would assert on
  // a tab that never rendered one — the vacuous pass this file's own
  // comments were written about.
  await specIndex.loadWorldFeed();
  App = globalThis.App;
});

afterEach(() => {
  cleanup();
  errorSpy?.mockRestore();
  live?.restore();
  live = undefined;
});

function mountLive(opts) {
  live = installLive(opts);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  return function expectNoBoundary(where) {
    const caught = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes(BOUNDARY_LOG),
    );
    expect(caught.map((c) => String(c[1])).join(" · "), `${where}: ErrorBoundary caught`).toBe("");
    expect(screen.queryByText(BOUNDARY_COPY), `${where}: boundary fallback rendered`).toBeNull();
  };
}

describe("the fixture tracks the real store", () => {
  it("has exactly the members data/live.ts publishes", () => {
    // If this fails, live.ts gained or lost a member and the fixture did
    // not follow — which would leave the cases below asserting against
    // `undefined` while still passing. data/vote.test.ts pins the same list
    // against the REAL object; this pins it against the stand-in.
    live = installLive();
    const { live: liveDiff, social } = fixtureSurfaceMismatch(live);
    expect({ liveDiff, social }).toEqual({ liveDiff: [], social: [] });
  });
});

describe("spec layer mounts in live mode", () => {
  it("renders the daily tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    expectNoBoundary("daily/live");
  });

  it("renders the mirror tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live");
    expect(screen.getByRole("button", { name: /^mirror$/i }).className).toContain("is-active");
  });

  it("opens the profile overlay without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expectNoBoundary("profile/live");
  });

  it("opens the search overlay without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    expectNoBoundary("search/live");
  });

  it("renders a below-the-floor deck without tripping the boundary", () => {
    // The k-floored path is a different render: aggFor returns
    // `{ tooSmall: true }` with no counts at all, so anything reading
    // `agg.counts[i]` without a guard throws here and nowhere else.
    const expectNoBoundary = mountLive({ tooSmall: true });
    expectNoBoundary("daily/live/tooSmall");
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live/tooSmall");
  });

  it("renders the demoInProd fallback without tripping the boundary", () => {
    // A live build that could not attach and fell back to mock data. Its own
    // branch again — and the one where D11 suppresses the most.
    const expectNoBoundary = mountLive({ demoInProd: true });
    expectNoBoundary("daily/demoInProd");
  });

  it("renders a profile that has not picked a city", () => {
    // D9: a pre-D9 profile holds free text that does not parse, so myCity is
    // "" and Near must ask the user to re-pick rather than guessing or
    // blanking. Exercised because "" is the branch, not the happy path.
    const expectNoBoundary = mountLive({ myCity: "" });
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live/no-city");
  });
});

describe("the live gates hold in the DOM, not just in the source", () => {
  // D9. The Mirror's axis is seven stops in demo mode and six in live mode,
  // because Near IS your city there. Both directions are asserted: a test
  // that only checked the live side would pass against an axis that had lost
  // the stop everywhere.
  // The stops are role="tab" on one tablist, not loose buttons — query them
  // as the axis they are, so a same-named control elsewhere on the screen
  // cannot satisfy or break this.
  const stopLabels = () =>
    screen.getAllByRole("tab").map((el) => el.getAttribute("aria-label"));

  it("drops the Mirror's City stop in live mode and keeps it in demo", () => {
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    const liveAxis = stopLabels();
    expect(liveAxis, "live mode still offers a City stop").not.toContain("City");
    // Near and Country are the stops City resolves between. Asserting they
    // survive is what stops the line above passing because the axis broke —
    // the first draft of this test looked for buttons and "found" no City by
    // finding nothing at all.
    expect(liveAxis).toContain("Near");
    expect(liveAxis).toContain("Country");

    cleanup();
    live.restore();
    live = undefined;
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expect(
      stopLabels(),
      "demo mode lost the City stop — the live gate is now unconditional",
    ).toContain("City");
  });

  // D11. The engage block — takes, counter-arguments, minds-moved, friend
  // dots — is what renderEngage returns BELOW its `if (q.live)` early
  // return. A live card gets the k-floored who-voted button and nothing
  // else.
  //
  // Two things this test needs that the first draft of it did not have, both
  // found by watching it pass against a deliberately broken gate:
  //
  //   1. renderEngage only renders once the card is ANSWERED, and then only
  //      after the reveal animation clears `state.beat`. Asserting on an
  //      unvoted card asserts on a block that was never going to be there.
  //   2. The assertion has to be the takes BUTTON, not the word "takes".
  //      Its aria-label is `${n} takes`, and with WORLD_FEED_COMMENTS empty
  //      n is 0 — so the gate leaking shows up as a "0 takes" control, which
  //      no text search for a seeded string would ever find.
  const voteFeedCardAndSettle = async () => {
    fireEvent.click(screen.getByRole("button", { name: FEED_OPTIONS[0] }));
    // The reveal animation clears `beat` from its own onDone; until it does,
    // the engage row is not mounted for either branch.
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
  };

  it("gives a live card the who-voted button and no takes button", async () => {
    mountLive();
    await voteFeedCardAndSettle();
    expect(
      screen.queryByRole("button", { name: /who voted/i }),
      "the live engage row did not render at all — this test is now vacuous",
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /\btakes$/i }),
      "a live card rendered the takes button — D11's gate is open",
    ).toBeNull();
  });

  // The control for the case above. Without it, that assertion passes for
  // any reason the engage row fails to render — a broken fixture included —
  // and stops being a statement about the gate at all.
  const voteFirstDemoCard = async () => {
    const opt = screen.queryAllByRole("button", { name: /^(Yes|No|Agree|Disagree)$/i })[0];
    expect(opt, "no demo feed card to vote on").toBeDefined();
    fireEvent.click(opt);
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
  };

  it("still renders the takes button on a demo card", async () => {
    render(<App />);
    await voteFirstDemoCard();
    expect(
      screen.queryByRole("button", { name: /\btakes$/i }),
      "demo mode lost the takes button — the live gate is now unconditional",
    ).not.toBeNull();
  });

  // The third branch, and the one most easily left untested: a real user in
  // a live build whose boot did not attach. The feed falls back to demo
  // cards, so `q.live` is false on all of them and the ONLY thing keeping
  // seeded takes and fake named people off a real user's screen is
  // renderEngage's demoInProd check. The whole row goes, who-voted included.
  it("suppresses the entire engage row in the demoInProd fallback", async () => {
    mountLive({ demoInProd: true });
    await voteFirstDemoCard();
    expect(
      screen.queryByRole("button", { name: /\btakes$/i }),
      "demoInProd showed seeded takes to a real user",
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /who voted/i }),
      "demoInProd showed a who-voted panel built from mock data",
    ).toBeNull();
  });

  it("renders no seeded take data in live mode at all", () => {
    // D11's second layer, underneath the render gate: live.ts sets
    // WORLD_FEED_COMMENTS to {}, so even a removed gate would have nothing
    // to draw. Asserting the layer exists, not just that the gate does.
    mountLive();
    expect(window.WORLD_FEED_COMMENTS).toEqual({});
  });
});
