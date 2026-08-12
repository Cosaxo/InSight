// @vitest-environment jsdom
//
// Mount suite 2 of 5 — the feed's "add a topic" sheet. The shared harness, and
// the reasoning for all five files, is in ./mount-app.jsx.
//
// Its own file because these three are the slowest cases in the set: each opens
// the sheet on a fully mounted app, and one of them then drives a mute all the
// way back out to the chip row.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

describe("the add-a-topic sheet", () => {
  // The demo half of D96's pair — smoke-live asserts the same surfaces refuse.
  // Without this control, the offers() gate could return [] in every build and
  // both suites would stay green.
  it("keeps its demo furniture: topics and communities", () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /add a topic/i }));
    expect(screen.getByText("Topics")).not.toBeNull();
    expect(screen.getByText("Communities")).not.toBeNull();
    // one full community row — name, members and vibe are the demo's to show
    expect(screen.getByText(/old presses, new poems/)).not.toBeNull();
    expectNoBoundary("demo add sheet");
  });

  // The other half of D96, found on a device the day after it shipped. Refusing
  // to advertise the fabricated communities was right and left the sheet
  // holding nothing but the Learn dial in a live build, which the owner read on
  // a device exactly as it looks — "interests seem to have been removed, only
  // the sample data of fake amounts of users" (2026-08-12). The channel list is
  // what fills it, and it lives in the shared render path — so the demo suite is
  // where the MECHANISM binds. (The live channel set is a build flag read at
  // module scope, and this suite is a demo build; the live set, and the fact
  // that the bank's topics are all in it, are world-channels.test.js's.)
  it("lists the channels that stock the feed, with counted meta", () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /add a topic/i }));
    expect(screen.getByText("Your topics"), "the sheet listed no topics at all").not.toBeNull();
    const mutes = screen.getAllByRole("button", { name: /^Mute / });
    expect(mutes.length, "no channel row carried a mute").toBeGreaterThan(0);
    // Counted out of the pool, never claimed about a population — the
    // distinction D96 exists to hold. "N questions · M answered" is arithmetic
    // over WORLD_FEED_QS; "N people" was not.
    expect(document.body.textContent).toMatch(/\d+ questions · \d+ answered/);
    // …and never a stockless room, which is the same rule SUBTOPICS.offers()
    // applies to leaves.
    expect(screen.queryByText(/^0 questions/), "a stockless channel was listed").toBeNull();
    expectNoBoundary("add sheet, channel list");
  });

  it("muting a channel from the sheet turns its chip off", () => {
    // The wiring half: the sheet's toggle IS the chip row's toggle, so a mute
    // here has to move the state the rail draws from. Without this the list
    // could render perfectly and control nothing.
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /add a topic/i }));
    const mute = screen.getAllByRole("button", { name: /^Mute / })[0];
    const topic = mute.getAttribute("aria-label").replace(/^Mute /, "");
    fireEvent.click(mute);
    expect(
      screen.getByRole("button", { name: "Unmute " + topic }),
      "the row did not flip to Unmute",
    ).not.toBeNull();
    // the chip row's own button for the same topic, now off
    expect(
      screen.getByRole("button", { name: topic.toLowerCase() }).getAttribute("aria-pressed"),
      "the chip stayed on after the sheet muted it",
    ).toBe("false");
    expectNoBoundary("add sheet, mute");
  });
});
