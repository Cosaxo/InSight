// pricingFold.test.ts — the demand fold and the live overlay (D366).
//
// What these pin is the ARITHMETIC the door prints and the server
// invoices by: occupied ÷ available slot-days over the trailing window
// plus the forward fortnight, mapped linearly into the card's clamps;
// the booked strip as real windows; estimates only from completed
// campaigns with their basis. And the overlay's refusals — a malformed
// live doc is ignored whole, never half-applied, and an idx outside the
// clamps is clamped, because the clamps are the mechanism.
import { describe, expect, it } from "vitest";
import { ESTIMATE_MIN_DAYS, FORWARD_DAYS, foldPricing, mergeLivePricing, servedDays, type PurchaseRow } from "./pricingFold";
import type { PricingCard } from "./pricing";

const card: PricingCard = {
  generated: "2026-08-24", currency: "EUR", base: 0.16, floorX: 0.9, ceilX: 2.5,
  floorWeek: 500, capEur: 320, minEur: 20, budgets: [50, 100, 200, 320], adBase: 320, fx: { NOK: 11.6 }, trailingDays: 28,
  cohorts: {
    city: { idx: 0.9, booked: Array(14).fill(0), nextOpen: null },
    country: { idx: 0.9, booked: Array(14).fill(0), nextOpen: null },
    world: { idx: 0.9, booked: Array(14).fill(0), nextOpen: null },
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
  it("prints the floor, an open fortnight, and no forecast — every cohort", () => {
    const live = foldPricing(card, [], TODAY);
    expect(live.generated).toBe(TODAY);
    for (const scope of ["city", "country", "world"] as const) {
      expect(live.cohorts[scope].idx).toBe(0.9);
      expect(live.cohorts[scope].booked).toEqual(Array(FORWARD_DAYS).fill(0));
      expect(live.cohorts[scope].nextOpen).toBeNull();
    }
    expect(live.estimates).toEqual({});
  });

  it("refuses a day key it cannot fold for", () => {
    expect(() => foldPricing(card, [], "today")).toThrow(/YYYY-MM-DD/);
  });
});

describe("foldPricing — the index moves the moment a window is sold", () => {
  it("a 29-day window starting tomorrow books the whole fortnight and lifts the idx off the floor", () => {
    // The self-serve window (paid.ts WINDOW_DAYS): starts tomorrow, runs
    // 29 inclusive days. Nothing of it is in the trailing window yet —
    // which is exactly why a trailing-only index called this "quiet".
    const live = foldPricing(card, [row({ from: 1, to: 29 })], TODAY);
    const c = live.cohorts.city;
    expect(c.booked).toEqual(Array(FORWARD_DAYS).fill(1));
    expect(c.nextOpen).toBeNull(); // the shape cannot say sold out; `booked` does
    // (0 trailing + 14 ahead) / (28 + 14) = 1/3 of the way from floor to ceiling
    expect(c.idx).toBe(Math.round((0.9 + (14 / 42) * 1.6) * 100) / 100); // 1.43
    // …and the other cohorts did not move: the slot is per scope.
    expect(live.cohorts.country.idx).toBe(0.9);
    expect(live.cohorts.world.idx).toBe(0.9);
  });

  it("counts trailing occupancy from any state — a closed campaign still had its days", () => {
    // Ran the last 28 days in full, closed this morning: every trailing
    // day occupied, nothing ahead.
    const live = foldPricing(card, [row({ from: -28, to: -1, state: "closed" })], TODAY);
    expect(live.cohorts.city.idx).toBe(Math.round((0.9 + (28 / 42) * 1.6) * 100) / 100); // 1.97
    expect(live.cohorts.city.booked).toEqual(Array(FORWARD_DAYS).fill(0));
  });

  it("reaches the ceiling with the trailing window and the fortnight both full, and never past it", () => {
    const live = foldPricing(card, [row({ from: -40, to: 40 })], TODAY);
    expect(live.cohorts.city.idx).toBe(2.5);
  });

  it("counts a day once however many campaigns share it — one slot per day per cohort", () => {
    const one = foldPricing(card, [row({ from: 1, to: 14 })], TODAY);
    const three = foldPricing(card, [
      row({ from: 1, to: 14 }), row({ from: 1, to: 14 }), row({ from: 1, to: 14, kind: "ad" }),
    ], TODAY);
    expect(three.cohorts.city.idx).toBe(one.cohorts.city.idx);
  });

  it("an ad occupies the slot like a question (D315); a subscription moves nothing", () => {
    const ad = foldPricing(card, [row({ from: 1, to: 14, kind: "ad" })], TODAY);
    expect(ad.cohorts.city.idx).toBeGreaterThan(0.9);
    const sub = foldPricing(card, [row({ from: 1, to: 14, kind: "subscription" })], TODAY);
    expect(sub.cohorts.city.idx).toBe(0.9);
    expect(sub.cohorts.city.booked).toEqual(Array(FORWARD_DAYS).fill(0));
  });

  it("books ahead from RUNNING campaigns only, and names the first open day", () => {
    // A window that starts in four days (an ad queued behind another,
    // D315): tomorrow is booked by nothing, so nextOpen is null — and a
    // window that covers tomorrow makes nextOpen the first day after it.
    const later = foldPricing(card, [row({ from: 4, to: 30 })], TODAY);
    expect(later.cohorts.city.booked.slice(0, 3)).toEqual([0, 0, 0]);
    expect(later.cohorts.city.booked[3]).toBe(1);
    expect(later.cohorts.city.nextOpen).toBeNull();

    const soon = foldPricing(card, [row({ from: 1, to: 3 })], TODAY);
    expect(soon.cohorts.city.booked.slice(0, 4)).toEqual([1, 1, 1, 0]);
    expect(soon.cohorts.city.nextOpen).toBe(day(4));

    // A closed campaign with a future window (an operator's mistake, or a
    // refund) does not hold days it will not run.
    const dead = foldPricing(card, [row({ from: 1, to: 3, state: "closed" })], TODAY);
    expect(dead.cohorts.city.booked.slice(0, 3)).toEqual([0, 0, 0]);
  });

  it("ignores a row with no window rather than throwing on it", () => {
    const live = foldPricing(card, [{ kind: "question", scope: "city", state: "running" }], TODAY);
    expect(live.cohorts.city.idx).toBe(0.9);
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

  it("clamps a published idx into the card's own floor and ceiling", () => {
    const wild = { ...live, cohorts: { ...live.cohorts,
      city: { ...live.cohorts.city, idx: 9 },
      country: { ...live.cohorts.country, idx: 0.1 },
    } };
    const merged = mergeLivePricing(card, wild);
    expect(merged.cohorts.city.idx).toBe(2.5);
    expect(merged.cohorts.country.idx).toBe(0.9);
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
