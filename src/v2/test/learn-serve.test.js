// @vitest-environment jsdom
//
// The learn scheduler's serve seam (D95). LEARN_FEED.cards used to hand
// plan()'s slow/warm fallbacks straight to the feed — cards already
// answered, re-served before answering them again could count. Combined
// with the feed's persisted vote mirror they rendered on a device as
// "already answered": frozen mid-streak, check-ins unreachable. These
// cases pin the contract from both ends — due() says exactly when a
// re-serve counts, and cards() serves fresh or due, never the rest.
//
// The GAP / CHECKIN_D figures are learn-progress.js's constants, restated
// here on purpose: if the scheduler's spacing moves, this suite should ask
// whether the serve rule still holds, not follow the constant silently.
//
// Module-scope stores read their localStorage at import, so each case
// seeds the key first and re-imports against it — the follow-seeds pattern.

import { beforeEach, describe, expect, it, vi } from "vitest";

const LS = "insight.learn.v3";
const GAP = 4; // cards that must pass before a repeat counts
const CHECKIN_D = 12; // days before a known card comes back once

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

async function learn(state) {
  localStorage.setItem(LS, JSON.stringify(state));
  // The named export, not window.LEARN (D109). vi.resetModules() above means
  // each call re-evaluates the module against the seeded key, and a fresh
  // evaluation returns a fresh binding — which is the whole harness.
  //
  // The explicit `learn-data.js` import that used to sit above this line is
  // gone, and its absence is the D109 win rather than a tidy-up: this harness
  // had to name the content module first because learn-progress.js read
  // window.LEARN_CARDS at module scope. It imports it now, so the ordering is
  // the module graph's problem and no longer a step a caller can forget.
  const { LEARN } = await import("../spec/learn-progress.js");
  await import("../spec/learn-feed.js");
  return { L: LEARN, LF: window.LEARN_FEED };
}

const learning = (pos, k = 0) => ({ s: "learning", k, seen: 1, miss: 1, pos, at: 0 });
const known = (pos, at) => ({ s: "known", k: 3, seen: 1, miss: 0, pos, at });

describe("LEARN.due — when a re-serve counts (D95)", () => {
  it("a card never seen is fresh, not due", async () => {
    const { L } = await learn({ c: {}, lvl: {}, pos: 0, order: [] });
    expect(L.due("cell1")).toBe(false);
  });

  it("a missed card is due only once the gap has passed", async () => {
    const inside = await learn({ c: { cell1: learning(0) }, lvl: {}, pos: GAP - 1, order: [] });
    expect(inside.L.due("cell1")).toBe(false);
    vi.resetModules();
    localStorage.clear();
    const past = await learn({ c: { cell1: learning(0) }, lvl: {}, pos: GAP, order: [] });
    expect(past.L.due("cell1")).toBe(true);
  });

  it("a known card is due only at its check-in — old enough AND far enough", async () => {
    const old = Date.now() - (CHECKIN_D + 1) * 864e5;
    const both = await learn({ c: { cell1: known(0, old) }, lvl: {}, pos: 12, order: ["cell1"] });
    expect(both.L.due("cell1")).toBe(true);
    vi.resetModules();
    localStorage.clear();
    const near = await learn({ c: { cell1: known(0, old) }, lvl: {}, pos: 11, order: ["cell1"] });
    expect(near.L.due("cell1")).toBe(false);
    vi.resetModules();
    localStorage.clear();
    const recent = await learn({ c: { cell1: known(0, Date.now()) }, lvl: {}, pos: 12, order: ["cell1"] });
    expect(recent.L.due("cell1")).toBe(false);
  });
});

describe("LEARN_FEED.cards serves fresh or due, never a frozen replay (D95)", () => {
  it("keeps an answered card inside its gap out of the stream", async () => {
    const { LF } = await learn({ c: { cell1: learning(0) }, lvl: {}, pos: 1, order: [] });
    const ids = LF.cards(30).map((q) => q.learn);
    expect(ids).not.toContain("cell1");
    // …while the pool still serves its fresh cards — the filter is on the
    // replay, not the stream.
    expect(ids.length).toBeGreaterThan(0);
  });

  it("re-serves the due repeat, at the head of the stream", async () => {
    const { LF } = await learn({ c: { cell1: learning(0, 1) }, lvl: {}, pos: GAP, order: [] });
    const qs = LF.cards(8);
    expect(qs[0].learn).toBe("cell1");
    // …in the feed's own question shape, so the card renders answerable.
    expect(qs[0]).toMatchObject({ id: "lrn-cell1", type: "know", f: "cell" });
  });
});
