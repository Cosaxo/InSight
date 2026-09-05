// build-ask-pricing.test.mjs — the adapter between the pricing card and
// the web ask door.
//
// What is worth pinning is not that the fields get copied. It is the one
// substitution that would read as correct in review and quietly shorten a
// payment promise: the design's `refundDays` is `WINDOW_DAYS` from
// `functions/src/paid.ts` (29), and `content/pricing.json`'s nearest
// field is `trailingDays` (28), a different quantity entirely. A page
// wired to the wrong one promises 28 days while the closer refunds
// against 29.
//
// Three cases below exist only for that: the value is read from the
// function, a card whose `trailingDays` moves does NOT move it, and the
// script refuses rather than guesses when the constant cannot be found.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAskPricing, windowDays, ROOT, SOURCE, TARGET, WINDOW_SOURCE } from "./build-ask-pricing.mjs";

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** A card in the committed file's shape, with values that are all
 *  distinct so a field landing in the wrong slot cannot pass. */
const CARD = {
  generated: "2026-08-24",
  base: 0.16,
  floorX: 0.9,
  ceilX: 2.5,
  capEur: 320,
  adBase: 300,
  fx: { NOK: 11.6, USD: 1.08 },
  trailingDays: 28,
  cohorts: { city: { idx: 1.1 }, country: { idx: 1.7 }, world: { idx: 2.5 } },
};
const PAID = "export const WINDOW_DAYS = 29;\n";

describe("the refund window", () => {
  it("comes from WINDOW_DAYS, not from the card", () => {
    expect(buildAskPricing(CARD, PAID).refundDays).toBe(29);
  });

  it("does not follow trailingDays when the card's lookback moves", () => {
    // The failure this whole script exists to prevent, stated as a
    // property: retuning the demand lookback is a pricing change and must
    // not touch what the page promises a buyer.
    const retuned = { ...CARD, trailingDays: 14 };
    expect(buildAskPricing(retuned, PAID).refundDays).toBe(29);
    expect(buildAskPricing(retuned, "export const WINDOW_DAYS = 45;\n").refundDays).toBe(45);
  });

  it("says so when the two quantities coincide, because the distinction stops being observable", () => {
    expect(buildAskPricing(CARD, PAID).windowEqualsTrailing).toBe(false);
    expect(buildAskPricing({ ...CARD, trailingDays: 29 }, PAID).windowEqualsTrailing).toBe(true);
  });

  it("refuses rather than guesses when the constant cannot be read", () => {
    // A rename or a reformat in paid.ts must fail loudly. The dangerous
    // alternative — falling back to the card — is the bug itself.
    expect(() => windowDays("export const WINDOW = 29;")).toThrow(/WINDOW_DAYS/);
    expect(() => windowDays("")).toThrow(/never fall back/);
    expect(windowDays("// noise\nexport const WINDOW_DAYS = 7;\nmore")).toBe(7);
  });
});

describe("the eight renames", () => {
  it("maps every name the design reads onto the committed one", () => {
    const P = buildAskPricing(CARD, PAID);
    expect(P.perAnswerBaseEur).toBe(CARD.base);
    expect(P.adBaseEur).toBe(CARD.adBase);
    expect(P.floorIndex).toBe(CARD.floorX);
    expect(P.ceilingIndex).toBe(CARD.ceilX);
    expect(P.capEur).toBe(CARD.capEur);
    expect(P.source).toBe(SOURCE);
    expect(P.committed).toBe(CARD.generated);
  });

  it("turns the cohorts OBJECT into the ruler's ordered array", () => {
    // The design reads `[{label, index}]` in ruler order; the card is an
    // object keyed by scope. Order is the load-bearing half — the ruler
    // maps a drag position to an index, so a reordering silently sells
    // the wrong audience.
    expect(buildAskPricing(CARD, PAID).cohorts).toEqual([
      { key: "city", label: "Your city", index: 1.1 },
      { key: "country", label: "Your country", index: 1.7 },
      { key: "world", label: "Everyone", index: 2.5 },
    ]);
  });

  it("gives fx a symbol and a placement, and EUR the rate it has by definition", () => {
    const { fx } = buildAskPricing(CARD, PAID);
    expect(fx.EUR).toEqual({ sym: "€", rate: 1, pre: true });
    expect(fx.NOK).toEqual({ sym: "kr", rate: 11.6, pre: false });
    // USD is in the card and deliberately not offered by the door.
    expect(fx.USD).toBeUndefined();
  });

  it("refuses a card missing a cohort or a rate rather than printing NaN", () => {
    const noWorld = { ...CARD, cohorts: { city: { idx: 1.1 }, country: { idx: 1.7 } } };
    expect(() => buildAskPricing(noWorld, PAID)).toThrow(/world/);
    expect(() => buildAskPricing({ ...CARD, fx: {} }, PAID)).toThrow(/NOK/);
  });
});

describe("against the committed tree", () => {
  it("the generated resource is in sync with the card and the function", () => {
    // `check:ask-pricing` is this assertion on the deploy path; this is
    // the same one where a contributor sees it first.
    const built = `${JSON.stringify(buildAskPricing(JSON.parse(read(SOURCE)), read(WINDOW_SOURCE)), null, 1)}\n`;
    expect(read(TARGET)).toBe(built);
  });

  it("draws the window paid.ts actually serves", () => {
    const P = JSON.parse(read(TARGET));
    expect(P.refundDays).toBe(windowDays(read(WINDOW_SOURCE)));
    expect(P.refundDays).not.toBe(JSON.parse(read(SOURCE)).trailingDays);
  });
});
