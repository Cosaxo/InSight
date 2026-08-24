// @vitest-environment jsdom
//
// Mount suite 2 of 5 — the feed's "add a topic" sheet. The shared harness, and
// the reasoning for all five files, is in ./mount-app.jsx.
//
// Its own file because these three are the slowest cases in the set: each opens
// the sheet on a fully mounted app, and one of them then drives a mute all the
// way back out to the chip row.

import { describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";
// The ask another screen makes of this sheet (D190).
import { requestTopicSheet } from "../data/topicSheet.ts";

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

// ── the Learn rows (D279) ────────────────────────────────────────────
//
// Every field is followed on a fresh install now, which showed a reader
// four times the bank — and made this sheet's Learn section the only place
// the list can be narrowed again. `LEARN.unfollow` existed before D279 and
// nothing in the app called it, so the follow list was one-way and a
// default of everything would have been a trap rather than a fix.
describe("the topic sheet's Learn rows", () => {
  it("lists every field you follow, each with the way back out", () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /add a topic/i }));
    const unfollows = screen.getAllByRole("button", { name: /^Unfollow / });
    expect(unfollows.length, "no field offered a way out — the list is one-way again").toBeGreaterThan(1);
    // The rows are the FIELDS, not the subjects: "Cell biology", not
    // "Biology". The subject rides in the meta line beside the card count.
    expect(screen.getByRole("button", { name: "Unfollow Cell biology" })).toBeTruthy();
    expectNoBoundary("add sheet, learn rows");
  });

  it("drops the field from the list when you unfollow it", () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /add a topic/i }));
    fireEvent.click(screen.getByRole("button", { name: "Unfollow Cell biology" }));
    expect(
      screen.queryByRole("button", { name: "Unfollow Cell biology" }),
      "the row stayed after unfollowing",
    ).toBeNull();
    // …and it comes back as something you can follow again, which is the
    // half that makes this reversible rather than a one-way door pointed
    // the other way.
    expect(screen.getByText("Cell biology")).toBeTruthy();
    expectNoBoundary("add sheet, learn unfollow");
  });
});

// ── opened from somewhere else (D190) ────────────────────────────────
//
// The profile's scenes card offers "Pick topics →" when you follow nothing.
// It used to jump to the daily feed and stop there, which leaves the reader
// in the room and not at the list — reported from a device as exactly that.
// The button asks; this sheet answers.
//
// Asserted through the MECHANISM rather than through that button, because
// the button's own arm needs an account following no scenes and a live
// build, and what breaks in a rename is this wiring: a request nothing
// listens for fails silently and looks identical.
describe("the topic list opens on request", () => {
  it("opens the sheet for a feed that is already mounted", () => {
    const expectNoBoundary = mountApp();
    expect(screen.queryByText("Your topics"), "the sheet was open before the ask").toBeNull();
    // act(), because this sets state from outside React's event system —
    // the same reason the cross-link openers are wrapped.
    act(() => { requestTopicSheet(); });
    expect(screen.getByText("Your topics"), "the request reached nothing").not.toBeNull();
    expectNoBoundary("add sheet, opened on request");
  });

  it("keeps the tab bar on screen: the sheet lifts by the bar's height", () => {
    // The other half of D190's door (D211). Landing here from the profile
    // is only an arrival if the app's own navigation survives it: the
    // sheet used to scrim the tab bar over, and on a device that read as
    // the bottom navigation going missing. The lift is measured off the
    // bar, so it is stubbed here — jsdom lays nothing out and reports 0,
    // which is exactly the no-op the mechanism must not regress to.
    const expectNoBoundary = mountApp();
    const bar = document.querySelector(".tabbar");
    Object.defineProperty(bar, "offsetHeight", { value: 66, configurable: true });
    act(() => { requestTopicSheet(); });
    expect(screen.getByText("Your topics")).not.toBeNull();
    const scrim = document.querySelector(".wf-scrim");
    expect(scrim.style.bottom, "the scrim still covers the tab bar").toBe("66px");
    expectNoBoundary("add sheet, lifted clear of the tab bar");
  });

  // D278 — the return value the profile's door reads, and the reason the
  // door stopped being a jump. `requestTopicSheet` answers whether the ask
  // was TAKEN, not whether anything was listening: a mounted feed consumes
  // it synchronously, so the one-shot is already spent when the call
  // returns. Both arms matter — a false negative sends the reader to the
  // feed for a list that was already open, and a false positive leaves
  // them on the profile with nothing having happened.
  it("says it was answered when a mounted feed takes the request", () => {
    const expectNoBoundary = mountApp();
    let answered;
    act(() => { answered = requestTopicSheet(); });
    expect(answered, "a mounted feed took the request and said it had not").toBe(true);
    expect(screen.getByText("Your topics")).not.toBeNull();
    expectNoBoundary("add sheet, request answered");
  });

  it("says it was not, when nothing is mounted to take it", () => {
    // The arm the profile's jump still exists for: opened over the Mirror,
    // there is no feed behind the panel and the request has to travel with
    // the navigation, exactly as D190 built it.
    cleanup();
    expect(requestTopicSheet(), "a request nobody heard reported itself as answered").toBe(false);
    // …and it is still pending, so the next feed to mount opens the sheet.
    const expectNoBoundary = mountApp();
    expect(screen.getByText("Your topics"), "the unanswered request was swallowed").not.toBeNull();
    expectNoBoundary("add sheet, request carried to the next mount");
  });

  it("consumes the request, so the sheet does not reopen by itself", () => {
    // A flag that stays set is a sheet that comes back the next time
    // anything mounts — which is the failure this one-shot shape exists to
    // avoid (links.ts's consumeJoinCode, same reasoning). The second mount
    // is the whole case: it asks for nothing and must get nothing.
    mountApp();
    act(() => { requestTopicSheet(); });
    expect(screen.getByText("Your topics")).not.toBeNull();
    cleanup();
    const expectNoBoundary = mountApp();
    expect(screen.queryByText("Your topics"), "the request outlived its use").toBeNull();
    expectNoBoundary("add sheet, request consumed");
  });
});
