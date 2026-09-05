// pricingFold.test.ts — the demand fold and the live overlay (D366, D368).
//
// What these pin is the ARITHMETIC the door prints and the server
// invoices by: the floor plus a step per campaign in the cohort's
// rotation, averaged over the fortnight ahead, with no ceiling; the
// booked and crowd strips as real windows; estimates only from campaigns
// with a measured rate, basis carried. And the overlay's refusals — a
// malformed live doc is ignored whole, never half-applied, and an idx
// under the floor is held to it, because the floor is the mechanism.
import { describe, expect, it } from "vitest";
import { ESTIMATE_MIN_DAYS, FORWARD_DAYS, foldPricing, mergeLivePricing, servedDays, type PurchaseRow } from "./pricingFold";
import type { PricingCard } from "./pricing";

const card: PricingCard = {
  generated: "2026-09-05", currency: "EUR", base: 0.02, floorX: 1, crowdStep: 0.5,
  floorWeek: 500, capEur: 50, minEur: 5, budgets: [5, 10, 20, 50], adBase: 320, fx: { NOK: 11.6 },
  cohorts: {
    city: { idx: 1, booked: Array(14).fill(0), crowd: Array(14).fill(0), nextOpen: null },
    country: { idx: 1, booked: Array(14).fill(0), crowd: Array(14).fill(0), nextOpen: null },
    world: { idx: 1, booked: Array(14).fill(0), crowd: Array(14).fill(0), nextOpen: null },
  },
  estimates: {},
};

const TODAY = "2026-09-05";
const day = (off: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + off * 86400000).toISOString().slice(0, 10);
const row = (p: Partial<PurchaseRow> & { from: number; to: number }): PurchaseRow => ({
  kind: "question", scope: "city", state: "running",
  window: { start: day(p.from), until: day(p.to) },
  ...(p.kind ? { kind: p.kind } : {}),
  ...(p.scope ? { scope: p.scope } : {}),
  ...(p.state ? { state: p.state } : {}),
  ...(p.closed ? { closed: p.closed } : {}),
  ...(p.progress ? { progress: p.progress } : {}),
});

describe("foldPricing — an empty ledger", () => {
  it("prints the floor, an open fortnight, an empty crowd, and no forecast — every cohort", () => {
    const live = foldPricing(card, [], TODAY);
    expect(live.generated).toBe(TODAY);
    for (const scope of ["city", "country", "world"] as const) {
      expect(live.cohorts[scope].idx).toBe(1);
      expect(live.cohorts[scope].booked).toEqual(Array(FORWARD_DAYS).fill(0));
      expect(live.cohorts[scope].crowd).toEqual(Array(FORWARD_DAYS).fill(0));
      expect(live.cohorts[scope].nextOpen).toBeNull();
    }
    expect(live.estimates).toEqual({});
  });

  it("refuses a day key it cannot fold for", () => {
    expect(() => foldPricing(card, [], "today")).toThrow(/YYYY-MM-DD/);
  });
});

describe("foldPricing — the index is crowding, with no ceiling (D368)", () => {
  it("one campaign across the fortnight is one step off the floor, and the strips say so", () => {
    // The self-serve window (paid.ts WINDOW_DAYS): starts tomorrow, runs
    // 29 inclusive days — in the rotation on every day the fold looks at.
    const live = foldPricing(card, [row({ from: 1, to: 29 })], TODAY);
    const c = live.cohorts.city;
    expect(c.idx).toBe(1.5);
    expect(c.booked).toEqual(Array(FORWARD_DAYS).fill(1));
    expect(c.crowd).toEqual(Array(FORWARD_DAYS).fill(1));
    expect(c.nextOpen).toBeNull(); // the shape cannot say sold out; `booked` does
    // …and the other cohorts did not move: the slot is per scope.
    expect(live.cohorts.country.idx).toBe(1);
    expect(live.cohorts.world.idx).toBe(1);
  });

  it("each campaign sharing the rotation adds a step — two, five, no cap", () => {
    const two = foldPricing(card, [row({ from: 1, to: 29 }), row({ from: 1, to: 29 })], TODAY);
    expect(two.cohorts.city.idx).toBe(2);
    expect(two.cohorts.city.crowd).toEqual(Array(FORWARD_DAYS).fill(2));
    const five = foldPricing(card, Array.from({ length: 5 }, () => row({ from: -3, to: 40 })), TODAY);
    expect(five.cohorts.city.idx).toBe(3.5);
    const twenty = foldPricing(card, Array.from({ length: 20 }, () => row({ from: -3, to: 40 })), TODAY);
    expect(twenty.cohorts.city.idx).toBe(11);
  });

  it("averages over the fortnight — a campaign covering half of it is half a step", () => {
    const live = foldPricing(card, [row({ from: 1, to: 7 })], TODAY);
    expect(live.cohorts.city.idx).toBe(1.25);
    expect(live.cohorts.city.crowd.slice(0, 8)).toEqual([1, 1, 1, 1, 1, 1, 1, 0]);
    expect(live.cohorts.city.nextOpen).toBe(day(8));
  });

  it("counts the days ahead only — a campaign that ended is in nobody's rotation", () => {
    // Ran the last 28 days in full and closed this morning: not a
    // competitor for anyone booking now, whatever it did last month.
    const live = foldPricing(card, [row({ from: -28, to: -1, state: "closed" })], TODAY);
    expect(live.cohorts.city.idx).toBe(1);
    expect(live.cohorts.city.booked).toEqual(Array(FORWARD_DAYS).fill(0));
    // A closed campaign with a future window (an operator's mistake, or a
    // refund) does not hold days it will not run.
    const dead = foldPricing(card, [row({ from: 1, to: 3, state: "closed" })], TODAY);
    expect(dead.cohorts.city.idx).toBe(1);
    expect(dead.cohorts.city.booked.slice(0, 3)).toEqual([0, 0, 0]);
  });

  it("an ad crowds the rotation like a question (D315); a subscription moves nothing", () => {
    const ad = foldPricing(card, [row({ from: 1, to: 29, kind: "ad" })], TODAY);
    expect(ad.cohorts.city.idx).toBe(1.5);
    const sub = foldPricing(card, [row({ from: 1, to: 29, kind: "subscription" })], TODAY);
    expect(sub.cohorts.city.idx).toBe(1);
    expect(sub.cohorts.city.booked).toEqual(Array(FORWARD_DAYS).fill(0));
  });

  it("names the first open day from the booked strip", () => {
    // A window that starts in four days (an ad queued behind another,
    // D315): tomorrow is open, so nextOpen is null — and a window that
    // covers tomorrow makes nextOpen the first day after it.
    const later = foldPricing(card, [row({ from: 4, to: 30 })], TODAY);
    expect(later.cohorts.city.booked.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(later.cohorts.city.nextOpen).toBeNull();
    const soon = foldPricing(card, [row({ from: 1, to: 3 })], TODAY);
    expect(soon.cohorts.city.booked.slice(0, 4)).toEqual([1, 1, 1, 0]);
    expect(soon.cohorts.city.nextOpen).toBe(day(4));
  });

  it("a card with no step is a flat card — the floor whatever the crowd", () => {
    const flat = { ...card, crowdStep: 0 };
    const live = foldPricing(flat, [row({ from: 1, to: 29 }), row({ from: 1, to: 29 })], TODAY);
    expect(live.cohorts.city.idx).toBe(1);
    expect(live.cohorts.city.crowd).toEqual(Array(FORWARD_DAYS).fill(2));
  });

  it("ignores a row with no window rather than throwing on it", () => {
    const live = foldPricing(card, [{ kind: "question", scope: "city", state: "running" }], TODAY);
    expect(live.cohorts.city.idx).toBe(1);
  });
});

describe("foldPricing — estimates only from campaigns with a measured rate (D288 §3, D367)", () => {
  it("withholds a forecast while no campaign has a measured rate", () => {
    // Running ten days but with no aggregate attached: the caller did
    // not read it, so the fold must not guess.
    const live = foldPricing(card, [row({ from: -10, to: 18 })], TODAY);
    expect(live.estimates.city).toBeUndefined();
  });

  it("counts a running campaign once it has served a week, and says it is running", () => {
    // Started eight days ago: 9 inclusive days served, 180 answers so far.
    const live = foldPricing(card, [row({ from: -8, to: 20, progress: { answers: 180 } })], TODAY);
    expect(live.estimates.city).toEqual({ perDay: 20, campaigns: 1, days: 9, running: 1 });
    // …but not before the week is up, however many answers it has.
    const young = foldPricing(card, [row({ from: -3, to: 25, progress: { answers: 400 } })], TODAY);
    expect(young.estimates.city).toBeUndefined();
    expect(ESTIMATE_MIN_DAYS).toBe(7);
  });

  it("mixes a closed campaign and a running one into one basis", () => {
    const live = foldPricing(card, [
      row({ from: -40, to: -12, state: "closed", closed: { answers: 2900 } }), // 29 days
      row({ from: -13, to: 15, progress: { answers: 700 } }), // 14 served days
    ], TODAY);
    expect(live.estimates.city).toEqual({ perDay: Math.round(3600 / 43), campaigns: 2, days: 43, running: 1 });
  });

  it("servedDays counts inclusive days up to today and never past the window", () => {
    expect(servedDays(row({ from: 1, to: 29 }), TODAY)).toBe(0); // not started
    expect(servedDays(row({ from: 0, to: 28 }), TODAY)).toBe(1); // started today
    expect(servedDays(row({ from: -6, to: 22 }), TODAY)).toBe(7); // a week
    expect(servedDays(row({ from: -40, to: -12 }), TODAY)).toBe(29); // ended: the whole window
    expect(servedDays({ kind: "question" }, TODAY)).toBe(0); // no window
  });

  it("folds closed question campaigns off the closer's answer total, basis carried", () => {
    const live = foldPricing(card, [
      row({ from: -40, to: -12, state: "closed", closed: { answers: 2900 } }), // 29 days
      row({ from: -70, to: -42, state: "closed", closed: { answers: 1450 } }), // 29 days
      row({ from: -20, to: 8 }), // still running: not a basis
      row({ from: -40, to: -12, state: "closed", kind: "ad" }), // an ad predicts no answers
    ], TODAY);
    expect(live.estimates.city).toEqual({ perDay: Math.round(4350 / 58), campaigns: 2, days: 58 });
    expect(live.estimates.country).toBeUndefined();
  });

  it("skips a closed row the closer never counted — no `closed.answers`, no basis", () => {
    const live = foldPricing(card, [row({ from: -40, to: -12, state: "closed" })], TODAY);
    expect(live.estimates.city).toBeUndefined();
  });
});

describe("mergeLivePricing — the committed card under a published live half", () => {
  const live = foldPricing(card, [row({ from: 1, to: 29 })], TODAY);

  it("lays the live cohorts, estimates and date over the committed constants", () => {
    const merged = mergeLivePricing(card, live);
    expect(merged.generated).toBe(TODAY);
    expect(merged.cohorts.city.idx).toBe(live.cohorts.city.idx);
    expect(merged.base).toBe(card.base);
    expect(merged.capEur).toBe(card.capEur);
    expect(merged.fx).toEqual(card.fx);
  });

  it("returns the committed card untouched for nothing, junk, or a half-shaped doc", () => {
    expect(mergeLivePricing(card, null)).toBe(card);
    expect(mergeLivePricing(card, undefined)).toBe(card);
    expect(mergeLivePricing(card, "x")).toBe(card);
    expect(mergeLivePricing(card, { generated: TODAY })).toBe(card);
    // one cohort missing — refused WHOLE, not two applied and one stale
    const { world: _w, ...twoOnly } = live.cohorts;
    void _w;
    expect(mergeLivePricing(card, { ...live, cohorts: twoOnly })).toBe(card);
    // a strip of the wrong length is not the door's strip
    const shortStrip = { ...live, cohorts: { ...live.cohorts, city: { ...live.cohorts.city, booked: [0, 1] } } };
    expect(mergeLivePricing(card, shortStrip)).toBe(card);
    // a date that is not a day
    expect(mergeLivePricing(card, { ...live, generated: "yesterday" })).toBe(card);
  });

  it("holds a published idx to the card's floor, and to nothing above it (D368)", () => {
    const wild = { ...live, cohorts: { ...live.cohorts,
      city: { ...live.cohorts.city, idx: 9 },
      country: { ...live.cohorts.country, idx: 0.1 },
    } };
    const merged = mergeLivePricing(card, wild);
    expect(merged.cohorts.city.idx).toBe(9);
    expect(merged.cohorts.country.idx).toBe(1);
  });

  it("takes the crowd strip when it fits, derives it from `booked` when absent, refuses it when malformed", () => {
    const merged = mergeLivePricing(card, live);
    expect(merged.cohorts.city.crowd).toEqual(Array(FORWARD_DAYS).fill(1));
    const { crowd: _c, ...noCrowd } = live.cohorts.city;
    void _c;
    const derived = mergeLivePricing(card, { ...live, cohorts: { ...live.cohorts, city: noCrowd } });
    expect(derived.cohorts.city.crowd).toEqual(Array(FORWARD_DAYS).fill(1));
    const bad = mergeLivePricing(card, { ...live, cohorts: { ...live.cohorts, city: { ...live.cohorts.city, crowd: [1, -1] } } });
    expect(bad).toBe(card);
  });

  it("drops an estimate that arrives without its basis, and keeps the rest", () => {
    const merged = mergeLivePricing(card, { ...live, estimates: {
      city: { perDay: 40, campaigns: 0, days: 29 },
      world: { perDay: 400, campaigns: 3, days: 87 },
    } });
    expect(merged.estimates.city).toBeUndefined();
    expect(merged.estimates.world).toEqual({ perDay: 400, campaigns: 3, days: 87 });
  });

  it("keeps a running count that fits its basis and drops one that does not (D367)", () => {
    const merged = mergeLivePricing(card, { ...live, estimates: {
      city: { perDay: 40, campaigns: 2, days: 40, running: 1 },
      world: { perDay: 400, campaigns: 3, days: 87, running: 5 },
    } });
    expect(merged.estimates.city).toEqual({ perDay: 40, campaigns: 2, days: 40, running: 1 });
    expect(merged.estimates.world).toEqual({ perDay: 400, campaigns: 3, days: 87 });
  });
});
