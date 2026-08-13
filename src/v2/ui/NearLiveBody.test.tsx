// @vitest-environment jsdom
//
// NearLiveBody is the Mirror's Near stop since D111: the Right-now radius
// counter (D84) and nothing else. The card's cases moved here verbatim
// from LiveCohortBody.test.tsx when the stop split — the claims are the
// card's, not the host's, and the host changed.
//
// What is NEW here is the frame: Near no longer needs, asks for, or shows
// a city, and its copy points at the City stop for everything D111 moved
// there. The presence pitch's honesty cases stay word-for-word, because
// the cell this card fronts is one of the three denies D98 kept.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  near: {
    supported: () => true as boolean,
    on: () => false as boolean,
    count: () => null as number | null,
    tooFew: () => false as boolean,
    updatedAt: () => 0 as number,
    lastError: () => null as string | null,
    enable: vi.fn(async () => ({ ok: true } as { ok: boolean; reason?: string })),
    disable: vi.fn(async () => {}),
    refresh: () => {},
  },
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: NearLiveBody } = await import("./NearLiveBody");

beforeEach(() => {
  LIVE.near.supported = () => true;
  LIVE.near.on = () => false;
  LIVE.near.count = () => null;
  LIVE.near.tooFew = () => false;
  LIVE.near.lastError = () => null;
  LIVE.near.updatedAt = () => 0;
  LIVE.near.refresh = () => {};
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("NearLiveBody · the stop is presence, not place (D111)", () => {
  it("renders the counter with no city anywhere in sight", () => {
    render(<NearLiveBody />);
    expect(screen.getByText(/Right now, around you/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Turn on/i })).toBeTruthy();
    // No city ask, no city name — the stop that needs one is City.
    expect(screen.queryByText(/needs your city/i)).toBeNull();
    expect(screen.queryByText(/Choose your city/i)).toBeNull();
  });

  it("points at the City stop for answers and kindred", () => {
    // The stop shed the city cohort at D111; a user who came here for it
    // must leave with a direction, not a shrug.
    render(<NearLiveBody />);
    expect(screen.getByText("City", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText(/one to the right/i)).toBeTruthy();
  });

  it("says where the cohort went even on a device with no location", () => {
    // supported() false drops the card entirely (nothing to pitch), and
    // the pointer is then the whole body — it must not vanish with it.
    LIVE.near.supported = () => false;
    render(<NearLiveBody />);
    expect(screen.queryByText(/Right now, around you/i)).toBeNull();
    expect(screen.getByText(/can.t share a location/i)).toBeTruthy();
    expect(screen.getByText("City", { selector: "strong" })).toBeTruthy();
  });
});

describe("the Right now card (D84 — moved with the stop)", () => {
  it("pitches honestly while off: a count, never who, kilometre-sized", () => {
    render(<NearLiveBody />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/a count, never\s+who/i);
    expect(text).toMatch(/kilometre-sized grid square/i);
    // No 500 m claim anywhere: the coarse permission cannot measure it,
    // and the copy must not promise a radius the sensor cannot hold.
    expect(text).not.toMatch(/500\s?m/i);
  });

  it("says just-you at zero, counts people above it, and 'a few' when floored", () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 0;
    render(<NearLiveBody />);
    expect(screen.getByText(/Just you right now/i)).toBeTruthy();
    cleanup();

    LIVE.near.count = () => 3;
    render(<NearLiveBody />);
    expect(screen.getByText(/3 people with InSight within a couple of kilometres/i)).toBeTruthy();
    cleanup();

    // The restored-floor era (D81 revert): the server answers tooFew for
    // 1-4 and the card says so without a number.
    LIVE.near.count = () => null;
    LIVE.near.tooFew = () => true;
    render(<NearLiveBody />);
    expect(screen.getByText(/A few people are around you/i)).toBeTruthy();
  });

  it("turn-on runs enable and a refusal lands as a sentence, not a dead card", async () => {
    LIVE.near.enable = vi.fn(async () => ({ ok: false, reason: "denied" }));
    render(<NearLiveBody />);
    fireEvent.click(screen.getByRole("button", { name: /Turn on/i }));
    expect(LIVE.near.enable).toHaveBeenCalled();
    expect(await screen.findByText(/Near stays off until you allow location/i)).toBeTruthy();
  });

  it("turn-off calls disable — the doc-delete promise rides on it", async () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 2;
    LIVE.near.disable = vi.fn(async () => {});
    render(<NearLiveBody />);
    fireEvent.click(screen.getByRole("button", { name: /Turn off/i }));
    expect(LIVE.near.disable).toHaveBeenCalled();
  });
});

// ── the stall (reported from a device: "Near seems to never connect") ──
//
// The switch goes on, the first beat fails, and every beat after it is four
// minutes apart — so the card sat on "Counting…" for the rest of the
// session. The store had the reason the whole time (LIVE.near.lastError(),
// set on every failed beat) and the card read it NOWHERE: the only consumer
// of that member in the tree was this file's mock. These cases pin that the
// reason reaches the screen and that there is a way out of it that does not
// involve restarting the app.
describe("a beat that fails says so, and offers a way out", () => {
  it("a permission revoked mid-run replaces 'Counting…' with the reason", () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => null;
    LIVE.near.lastError = () => "denied";
    render(<NearLiveBody />);
    expect(screen.queryByText(/Counting/i), "the card is still counting a count that failed").toBeNull();
    expect(screen.getByText(/switched off for InSight/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeTruthy();
  });

  it("keeps a count that arrived earlier and dates it, rather than dropping it", () => {
    // A failed beat does not invalidate the last good one — it makes it
    // old. Blanking the number would throw away the only true thing on the
    // card; showing it undated would claim it is current.
    LIVE.near.on = () => true;
    LIVE.near.count = () => 4;
    LIVE.near.updatedAt = () => Date.now() - 9 * 60_000;
    LIVE.near.lastError = () => "timeout";
    render(<NearLiveBody />);
    expect(screen.getByText(/4 people with InSight/i)).toBeTruthy();
    expect(screen.getByText(/9 min ago/i)).toBeTruthy();
  });

  it("Try again runs another beat", async () => {
    LIVE.near.on = () => true;
    LIVE.near.lastError = () => "unavailable";
    LIVE.near.refresh = vi.fn(() => {});
    render(<NearLiveBody />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(LIVE.near.refresh).toHaveBeenCalled();
  });

  it("says nothing about a failure while the counter is off", () => {
    // lastError outlives a turn-off only if stopPresence missed it; either
    // way an error read off a switched-off counter is last session's, and
    // the card must not put it under a pitch that has not been accepted.
    LIVE.near.on = () => false;
    LIVE.near.lastError = () => "denied";
    render(<NearLiveBody />);
    expect(screen.queryByText(/switched off for InSight/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Try again/i })).toBeNull();
  });
});
