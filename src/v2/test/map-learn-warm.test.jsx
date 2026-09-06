// @vitest-environment jsdom
//
// THE MAP ASKS FOR ITS KNOWLEDGE LEAVES' CROWD RATES IN ONE BATCH (D393).
//
// A mastered fact's distance from You is the crowd's rate on it — measured
// since D393, where it used to be the bank's authored difficulty hint in
// live builds too. Measuring it means reading the card's aggregate, and
// the store's `learnAgg` is a read-through cache that kicks one getDoc per
// miss (D125's finding). So the node builder has to warm the cache in bulk
// BEFORE it reads per card, in the same pass — an effect would run after
// the render that had already paid one read per fact.
//
// These cases pin the shape rather than the arithmetic (learn-crowd-pct
// holds that): the batch is asked for, it names every mastered card, and
// it is asked for before any single read — on a live build, and never on
// the demo, whose authored figure is the content.
//
// The fixture is map-recency-live's: built ON the real store, with only
// what makes this a live build overridden, and the three learn members
// replaced by recorders so nothing here reaches Firestore.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.setConfig({ testTimeout: 20000 });

const STUB = vi.hoisted(() => ({ live: null }));
vi.mock("../data/live", async (importOriginal) => {
  const real = await importOriginal();
  return { get default() { return STUB.live ?? real.default; } };
});

const PANE = { width: 480, height: 720 };
let restore = null;
function measurable(on) {
  if (on) {
    const saved = ["clientWidth", "clientHeight"].map((k) =>
      [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]);
    restore = () => { for (const [k, d] of saved) { if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete HTMLElement.prototype[k]; } };
    for (const [k, v] of [["clientWidth", PANE.width], ["clientHeight", PANE.height]]) {
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get() { return v; } });
    }
  } else if (restore) { restore(); restore = null; }
}

let MapTab;
let LEARN;
let realLive;
let realStore;

beforeAll(async () => {
  measurable(true);
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  await specIndex.loadMapTab();
  MapTab = (await import("../spec/map-tab.jsx")).MapTab;
  LEARN = (await import("../spec/learn-progress.js")).LEARN;
  realLive = window.LIVE;
  realStore = (await import("../data/live")).default;
});
afterAll(() => measurable(false));
afterEach(() => { window.LIVE = realLive; STUB.live = null; cleanup(); });

/** A live store whose learn reads are recorders: the batch resolves to
 *  nothing and the single read is a cold miss, so what the Map ASKED for
 *  is the whole observation. */
function installLive() {
  const loadLearnAggs = vi.fn(async () => {});
  const learnAgg = vi.fn(() => null);
  const live = Object.create(realStore);
  for (const [k, v] of Object.entries({
    enabled: true, ready: true,
    dailyBank: () => [],
    confirmedVotes: () => ({}),
    myVotes: () => ({}),
    aggFor: () => null,
    loadLearnAggs,
    learnAgg,
    learnAggLoading: () => false,
    learnMine: () => null,
  })) Object.defineProperty(live, k, { value: v, configurable: true, enumerable: true });
  STUB.live = live;
  window.LIVE = STUB.live;
  window.dispatchEvent(new Event("insight-live-update"));
  return { loadLearnAggs, learnAgg };
}

describe("the Map warms its knowledge leaves' crowd rates in bulk", () => {
  it("asks for every mastered card in one batch, before any single read", () => {
    const { loadLearnAggs, learnAgg } = installLive();
    const mastered = LEARN.mastered().map((m) => m.card.id);
    expect(mastered.length, "nothing is mastered, so this case is vacuous").toBeGreaterThan(0);
    const { container } = render(<MapTab></MapTab>);
    expect(container.querySelectorAll(".is-known").length,
      "no learn dots were drawn, so the leaves were never placed").toBeGreaterThan(0);
    expect(loadLearnAggs, "the leaves were placed without warming the cache — one read per fact").toHaveBeenCalled();
    expect([...loadLearnAggs.mock.calls[0][0]].sort()).toEqual([...mastered].sort());
    // The batch claims its ids as pending before the loop reads them, so
    // the ORDER is the property: every per-card read comes after it.
    expect(learnAgg, "the leaves never read the crowd rate at all").toHaveBeenCalled();
    const batchAt = loadLearnAggs.mock.invocationCallOrder[0];
    for (const at of learnAgg.mock.invocationCallOrder) {
      expect(at, "a single read went out before the batch had claimed its ids").toBeGreaterThan(batchAt);
    }
  });

  it("asks once per mount — the rebuild the batch causes does not re-ask", async () => {
    const { loadLearnAggs } = installLive();
    render(<MapTab></MapTab>);
    // let the resolved batch bump the builder and re-run it
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(loadLearnAggs).toHaveBeenCalledTimes(1);
  });

  it("never asks on the demo build, whose authored figure is the content", () => {
    const loadLearnAggs = vi.spyOn(realStore, "loadLearnAggs");
    try {
      render(<MapTab></MapTab>);
      expect(loadLearnAggs).not.toHaveBeenCalled();
    } finally {
      loadLearnAggs.mockRestore();
    }
  });
});
