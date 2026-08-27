// @vitest-environment jsdom
// pricing.ts is the typed face of the COMMITTED rate card (PAID-PLAN §6,
// D288 §3) — these cases pin the module's own promises, not the file's
// numbers (check:pricing referees those): the posted line is base × idx
// and nothing else, non-EUR prints as ≈ because the fx table is a dated
// convenience, an unknown currency falls back to the contract's own EUR,
// and the preference dies with the account like every insight.* key.
import { beforeEach, describe, expect, it } from "vitest";
import { PRICING, adFlat, cur, demandWord, fmt, fmtExact, rate, setCur } from "./pricing";

beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new Event("insight:local-purge"));
});

describe("the posted line", () => {
  it("is base × the committed idx — no other arithmetic", () => {
    expect(rate("city")).toBe(Math.round(PRICING.base * PRICING.cohorts.city.idx * 1000) / 1000);
  });

  it("maps the idx bands to the three demand words", () => {
    // With every idx at the committed floor the word is quiet; the words
    // move only when the committed file does — this pins the mapping's
    // edges, not today's ledger.
    const t = (PRICING.cohorts.world.idx - PRICING.floorX) / (PRICING.ceilX - PRICING.floorX);
    const expected = t < 1 / 3 ? "quiet" : t < 2 / 3 ? "steady" : "contested";
    expect(demandWord("world")).toBe(expected);
  });
});

describe("formatting", () => {
  it("prints EUR plainly — the contract's own unit carries no ≈", () => {
    expect(fmt(640)).toBe("€640");
  });

  it("marks every converted figure ≈ — the fx table is dated, not the contract", () => {
    setCur("NOK");
    expect(fmt(1)).toMatch(/^≈ /);
    expect(fmt(1)).toContain("kr");
  });

  it("rounds to rate-card shapes, never false precision", () => {
    expect(fmt(6400)).toBe("€6 400");
    expect(fmt(191)).toBe("€190");
    expect(fmt(0.16)).toBe("€0.16");
  });

  it("has an EXACT form, for the control that charges the figure", () => {
    // `fmt`'s rounding is right for a price list and a lie on a Pay
    // button: Stripe charges Math.round(eur × 100) cents in EUR, so an
    // ad's flat €288 printed "Pay €290", and at other legal index values
    // the error runs the other way — €323.20 printed as €320, a buyer
    // charged MORE than the control they pressed.
    expect(fmt(288)).toBe("€290");
    expect(fmtExact(288)).toBe("€288");
    expect(fmtExact(323.2)).toBe("€323.20");
    expect(fmtExact(6400)).toBe("€6 400");
    expect(fmtExact(0.16)).toBe("€0.16");
    // Exact means exact to the cent Stripe takes, rounding the same way.
    expect(fmtExact(19.005)).toBe("€19.01");
  });

  it("prints EUR on the exact form whatever currency is chosen", () => {
    // The charge is in euro however the rest of the sheet is displayed,
    // so converting here would put an approximation on the one number
    // that is not one.
    setCur("NOK");
    expect(fmt(288)).toMatch(/^≈/);
    expect(fmtExact(288)).toBe("€288");
  });

  it("today's committed ad price is a figure `fmt` would move", () => {
    // Not a number this file owns (check:pricing referees the card) — it
    // is why the case above is not hypothetical: the shipped flat price
    // is exactly the shape the rounding distorts.
    const flat = adFlat("city");
    expect(flat).toBeGreaterThan(100);
    expect(fmtExact(flat), "the committed ad price no longer needs the exact form")
      .not.toBe(fmt(flat));
  });

  it("refuses an unknown currency and stays on EUR", () => {
    setCur("XXX");
    expect(cur()).toBe("EUR");
  });
});

describe("the preference", () => {
  it("persists, and dies with the account (the D51 purge)", () => {
    setCur("USD");
    expect(cur()).toBe("USD");
    localStorage.clear(); // what purgeLocalTrace does to the key…
    window.dispatchEvent(new Event("insight:local-purge")); // …and the announcement
    expect(cur()).toBe("EUR");
  });
});
