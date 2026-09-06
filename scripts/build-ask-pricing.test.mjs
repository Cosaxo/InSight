// build-ask-pricing.test.mjs — the adapter between the pricing card and
// the web ask door.
//
// What is worth pinning is not that the fields get copied. It is the two
// figures the page prints that live in OTHER files and must not be
// guessed: the refund window (on the card since D376, one number the
// server's WINDOW_DAYS and every door read — the substitution this script
// once guarded against, a lookback one day shorter, has no field left to
// be made with) and the paid-card density (SPONSOR_EVERY, where the feed
// places the cards, D377). Both are read, never defaulted, and the script
// refuses a card that cannot say them. And the menu (D376): each price a
// row prints is one of the chips the composer offers, so a row opens the
// composer on a budget the buyer sees pressed.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAskPricing, paidEvery, ROOT, SOURCE, TARGET, PLACES_SOURCE } from "./build-ask-pricing.mjs";

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** A card in the committed file's shape, with values that are all
 *  distinct so a field landing in the wrong slot cannot pass. */
const CARD = {
  generated: "2026-09-05",
  base: 0.02,
  floorX: 1,
  crowdStep: 0.5,
  crowdFree: 3,
  floorWeek: 500,
  capEur: 50,
  minEur: 5,
  windowDays: 29,
  budgets: [5, 10, 25, 50],
  menu: { city: 10, country: 25, world: 50 },
  fx: { NOK: 11.6, USD: 1.08 },
  cohorts: {
    city: { idx: 1.1, booked: Array(14).fill(1), crowd: Array(14).fill(1), nextOpen: null },
    country: { idx: 1.7, booked: Array(14).fill(1), crowd: Array(14).fill(3), nextOpen: null },
    world: { idx: 2.5, booked: Array(14).fill(0), crowd: Array(14).fill(0), nextOpen: null },
  },
  estimates: {},
};
const SPONSORED = "export const SPONSOR_EVERY = 6;\n";

describe("the two figures that live elsewhere", () => {
  it("takes the refund window from the card and refuses a card without one", () => {
    expect(buildAskPricing(CARD, SPONSORED).refundDays).toBe(29);
    expect(buildAskPricing({ ...CARD, windowDays: 45 }, SPONSORED).refundDays).toBe(45);
    const { windowDays: _w, ...without } = CARD;
    void _w;
    expect(() => buildAskPricing(without, SPONSORED)).toThrow(/windowDays/);
    expect(() => buildAskPricing({ ...CARD, windowDays: 0 }, SPONSORED)).toThrow(/windowDays/);
  });

  it("reads the paid-card density off the module that places the cards, and refuses rather than guesses", () => {
    expect(buildAskPricing(CARD, SPONSORED).paidEvery).toBe(6);
    expect(paidEvery("// noise\nexport const SPONSOR_EVERY = 4;\nmore")).toBe(4);
    expect(() => paidEvery("export const SPONSOR_SLOT = 1;")).toThrow(/SPONSOR_EVERY/);
    expect(() => paidEvery("")).toThrow(/will not guess/);
  });
});

describe("the renames and the reshapes", () => {
  it("maps every name the page reads onto the committed one", () => {
    const P = buildAskPricing(CARD, SPONSORED);
    expect(P.perAnswerBaseEur).toBe(CARD.base);
    expect(P.floorIndex).toBe(CARD.floorX);
    expect(P.crowdStep).toBe(CARD.crowdStep);
    expect(P.crowdFree).toBe(CARD.crowdFree);
    expect(P.minEur).toBe(CARD.minEur);
    expect(P.capEur).toBe(CARD.capEur);
    expect(P.budgets).toEqual(CARD.budgets);
    expect(P.menu).toEqual(CARD.menu);
    expect(P.source).toBe(SOURCE);
    expect(P.committed).toBe(CARD.generated);
    // the retired half: no ceiling (D373), no ad base (D375), no lookback
    expect(P).not.toHaveProperty("ceilingIndex");
    expect(P).not.toHaveProperty("adBaseEur");
    expect(P).not.toHaveProperty("windowEqualsTrailing");
  });

  it("turns the cohorts OBJECT into the ruler's ordered array, each with its crowd strip", () => {
    // The page reads `[{label, index, crowd}]` in ruler order; the card is
    // an object keyed by scope. Order is the load-bearing half — the
    // ruler maps a drag position to an index, so a reordering silently
    // sells the wrong audience. The strip is what the room sentence is
    // read from (D377), the same strip the multiplier is folded from.
    expect(buildAskPricing(CARD, SPONSORED).cohorts).toEqual([
      { key: "city", label: "Your city", index: 1.1, crowd: Array(14).fill(1) },
      { key: "country", label: "Your country", index: 1.7, crowd: Array(14).fill(3) },
      { key: "world", label: "Everyone", index: 2.5, crowd: Array(14).fill(0) },
    ]);
    // a card from before the strip derives it from the booked days
    const legacy = { ...CARD, cohorts: { ...CARD.cohorts, city: { idx: 1.1, booked: [1, 0, ...Array(12).fill(0)] } } };
    expect(buildAskPricing(legacy, SPONSORED).cohorts[0].crowd).toEqual([1, 0, ...Array(12).fill(0)]);
  });

  it("holds each menu price to the chips, so a row opens on a budget the buyer sees pressed", () => {
    expect(() => buildAskPricing({ ...CARD, menu: { ...CARD.menu, country: 20 } }, SPONSORED)).toThrow(/country/);
    expect(() => buildAskPricing({ ...CARD, budgets: [] }, SPONSORED)).toThrow(/budget presets/);
  });

  it("gives fx a symbol and a placement, and EUR the rate it has by definition", () => {
    const { fx } = buildAskPricing(CARD, SPONSORED);
    expect(fx.EUR).toEqual({ sym: "€", rate: 1, pre: true });
    expect(fx.NOK).toEqual({ sym: "kr", rate: 11.6, pre: false });
    // USD is in the card and deliberately not offered by the door.
    expect(fx.USD).toBeUndefined();
  });

  it("refuses a card missing a cohort, a strip, a rate or the free places rather than printing NaN", () => {
    const noWorld = { ...CARD, cohorts: { city: CARD.cohorts.city, country: CARD.cohorts.country } };
    expect(() => buildAskPricing(noWorld, SPONSORED)).toThrow(/world/);
    expect(() => buildAskPricing({ ...CARD, fx: {} }, SPONSORED)).toThrow(/NOK/);
    const { crowdFree: _f, ...noFree } = CARD;
    void _f;
    expect(() => buildAskPricing(noFree, SPONSORED)).toThrow(/crowdFree/);
  });
});

describe("against the committed tree", () => {
  it("the generated resource is in sync with the card and the feed's density", () => {
    // `check:ask-pricing` is this assertion on the deploy path; this is
    // the same one where a contributor sees it first.
    const built = `${JSON.stringify(buildAskPricing(JSON.parse(read(SOURCE)), read(PLACES_SOURCE)), null, 1)}\n`;
    expect(read(TARGET)).toBe(built);
  });

  it("draws the window the card carries and the density the feed places", () => {
    const P = JSON.parse(read(TARGET));
    expect(P.refundDays).toBe(JSON.parse(read(SOURCE)).windowDays);
    expect(P.paidEvery).toBe(paidEvery(read(PLACES_SOURCE)));
  });
});
