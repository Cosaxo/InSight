// @vitest-environment jsdom
//
// The feed's sitting — the boundary arithmetic, and nothing else.
//
// WHY THIS FILE EXISTS. The store answers one question ("has enough time
// passed that this counts as coming back?") and everything downstream —
// whether your just-answered card is still on screen, whether the feed
// rotated, whether you are back at the top — is that answer spent. It is
// also the one piece of this change with no render in it, which means a
// mount suite can only ever observe it through three layers of feed. The
// boundary belongs here, where a case can name the millisecond.
//
// THE SHAPE THE CASES ARE WRITTEN AGAINST: `leave()` stamps, `enter()`
// decides. That split is the whole design — being away is what ends a
// sitting, and only the way back can measure how long it lasted — so the
// cases drive both and never assert on internals.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as SITTING from "./feedSitting";

const LS = "insight.feedSitting.v1";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* jsdom has one */ }
  SITTING.__resetForTests();
});
afterEach(() => {
  try { localStorage.clear(); } catch { /* … */ }
  SITTING.__resetForTests();
});

describe("the away threshold", () => {
  it("is a minute, the same number the store calls leaving", () => {
    // Borrowed from live.ts's IDLE_DETACH_MS rather than invented. Two
    // surfaces answering "did they actually leave?" with two numbers is
    // how they drift apart, and the drift is invisible — each is correct
    // on its own terms.
    expect(SITTING.AWAY_MS).toBe(60_000);
  });

  it("keeps the sitting across a hop shorter than that", () => {
    // The tab swap: Mirror and back. The feed unmounts and remounts, and
    // nothing about the feed may move — this is the case the owner's
    // "for long enough" is drawn against.
    const before = SITTING.sitting();
    SITTING.leave(1_000);
    expect(SITTING.enter(1_000 + SITTING.AWAY_MS - 1)).toBe(false);
    expect(SITTING.sitting()).toBe(before);
  });

  it("starts a new one at the threshold exactly", () => {
    // `>=`, and the boundary is pinned because an off-by-one here is a
    // feed that refreshes at 61 seconds and nobody can tell.
    const before = SITTING.sitting();
    SITTING.leave(1_000);
    expect(SITTING.enter(1_000 + SITTING.AWAY_MS)).toBe(true);
    expect(SITTING.sitting()).toBe(before + 1);
  });

  it("does not start one on a return nobody left", () => {
    // `enter()` twice with no `leave()` between is the ordinary case: a
    // mount, then a visibilitychange to visible a moment later. The
    // second must be inert, or every foreground event would rotate the
    // feed under a reader who never went anywhere.
    SITTING.leave(0);
    expect(SITTING.enter(SITTING.AWAY_MS)).toBe(true);
    expect(SITTING.enter(SITTING.AWAY_MS * 10)).toBe(false);
  });

  it("measures from the FIRST leave, not the last", () => {
    // A tab swap unmounts the feed (stamp), and hiding the app fires a
    // moment later. Re-stamping would restart the minute every time the
    // phone did something while the reader was away, so a pocket-long
    // absence with a few wake-ups in it would never end the sitting.
    SITTING.leave(1_000);
    SITTING.leave(50_000);
    expect(SITTING.enter(1_000 + SITTING.AWAY_MS)).toBe(true);
  });
});

describe("what a new sitting clears", () => {
  it("drops the answered snapshot, so the pile leaves the stream", () => {
    const sunk = SITTING.sunkMap();
    sunk.set("q1", true);
    SITTING.leave(0);
    SITTING.enter(SITTING.AWAY_MS);
    expect(SITTING.sunkMap().size).toBe(0);
  });

  it("keeps it across a short hop, which is the point of having it", () => {
    // This is the half that was broken before the store existed: the map
    // was a field on the component, the tab swap unmounted the component,
    // and a card answered two seconds ago had already moved behind the
    // Answered expander by the time you looked back.
    SITTING.sunkMap().set("q1", false);
    SITTING.leave(0);
    SITTING.enter(1_000);
    expect(SITTING.sunkMap().get("q1")).toBe(false);
  });

  it("re-takes the deferral snapshot, so 'later' starts", () => {
    // `heldAtBuild` samples once per sitting: an id deferred BEFORE the
    // sitting stays filtered out of the stream, an id deferred DURING it
    // keeps its place as the slim "later · undo" row. A new sitting is
    // when "later" starts.
    expect(SITTING.heldAtBuild(() => ({ a: 1 }))).toEqual({ a: 1 });
    // Same sitting: the second build re-uses the snapshot rather than
    // re-reading the store, which is what keeps the row on screen.
    expect(SITTING.heldAtBuild(() => ({ a: 1, b: 2 }))).toEqual({ a: 1 });
    SITTING.leave(0);
    SITTING.enter(SITTING.AWAY_MS);
    expect(SITTING.heldAtBuild(() => ({ a: 1, b: 2 }))).toEqual({ a: 1, b: 2 });
  });

  it("copies the deferral map rather than holding the caller's", () => {
    // The caller hands `this.state.deferred`, which React replaces on
    // every setState. Holding the reference would make the snapshot track
    // the live store — which is the bug the snapshot exists to stop, and
    // it shipped once already (see world-feed.jsx's note).
    const live: Record<string, number> = { a: 1 };
    const snap = SITTING.heldAtBuild(() => live);
    live.b = 2;
    expect(snap).toEqual({ a: 1 });
  });

  it("tells a subscriber, so a feed already on screen can redraw", () => {
    // The visibilitychange path has had no state change to schedule a
    // render, so without a signal the rotation it just earned would sit
    // unread until the next tap.
    let beats = 0;
    const off = SITTING.subscribe(() => { beats += 1; });
    SITTING.leave(0);
    SITTING.enter(SITTING.AWAY_MS);
    expect(beats).toBe(1);
    off();
    SITTING.leave(SITTING.AWAY_MS);
    SITTING.enter(SITTING.AWAY_MS * 3);
    expect(beats, "unsubscribed and still notified").toBe(1);
  });
});

describe("across a relaunch", () => {
  /** A cold launch: a module instance that has never run before, reading
   * whatever the last one left in the store. `resetModules` is what makes
   * the initialiser run again — the thing a relaunch does and a mount
   * does not. */
  const relaunch = async () => {
    vi.resetModules();
    return import("./feedSitting");
  };

  it("reserves the next launch's number rather than spending this one", async () => {
    // READ-THEN-RESERVE. A device with nothing stored reads 0, and 0 is
    // the identity rotation — so the first feed anybody ever sees is the
    // bank's own order. What is written back is the NEXT launch's number.
    localStorage.clear();
    const fresh = await relaunch();
    expect(fresh.sitting(), "a fresh install did not open on the bank's own order").toBe(0);
    expect(localStorage.getItem(LS)).toBe("1");
  });

  it("comes back on a different number after the app is closed", async () => {
    // The other half of the owner's sentence — "or close the app" — and
    // it needs no lifecycle hook: a relaunch is the only thing that
    // evaluates the module twice. Two fresh instances, the second
    // reading what the first reserved.
    localStorage.clear();
    const first = await relaunch();
    const second = await relaunch();
    expect(second.sitting()).toBe(first.sitting() + 1);
  });

  it("survives a store holding something that is not a number", async () => {
    localStorage.setItem(LS, "not a number");
    const fresh = await relaunch();
    expect(fresh.sitting()).toBe(0);
  });

  it("refuses a negative counter rather than rotating backwards", async () => {
    // `wfStreamMix` clamps too, so this is belt and braces — but a
    // negative here would also write a negative back, and the store is
    // the thing that has to stay monotonic across launches.
    localStorage.setItem(LS, "-5");
    const fresh = await relaunch();
    expect(fresh.sitting()).toBe(0);
  });
});
