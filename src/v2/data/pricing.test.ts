// @vitest-environment jsdom
// pricing.ts is the typed face of the COMMITTED rate card (PAID-PLAN §6,
// D288 §3) — these cases pin the module's own promises, not the file's
// numbers (check:pricing referees those): the posted line is base × idx
// and nothing else, non-EUR prints as ≈ because the fx table is a dated
// convenience, an unknown currency falls back to the contract's own EUR,
// and the preference dies with the account like every insight.* key.
import { beforeEach, describe, expect, it } from "vitest";
import { PRICING, answersFor, applyLive, cur, demandWord, fmt, fmtExact, menuEur, rate, setCur } from "./pricing";

beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new Event("insight:local-purge"));
});

describe("the posted line", () => {
  it("is base × the committed idx — no other arithmetic", () => {
    expect(rate("city")).toBe(Math.round(PRICING.base * PRICING.cohorts.city.idx * 1000) / 1000);
  });

  it("the menu (D371) is a preset per reach, and the line decides what it buys", () => {
    // Each menu price is one of the composer's chips — check:pricing
    // referees the file, this pins the module reading it — and the
    // answers it buys are answersFor at the line in force: the same
    // arithmetic the composer prints, so a row and its composer agree.
    for (const scope of ["city", "country", "world"] as const) {
      expect(PRICING.budgets).toContain(menuEur(scope));
      expect(answersFor(scope, menuEur(scope))).toBe(Math.floor(menuEur(scope) / rate(scope)));
    }
    expect(menuEur("city")).toBeLessThanOrEqual(menuEur("country"));
    expect(menuEur("country")).toBeLessThanOrEqual(menuEur("world"));
    // Crowding lifts the line and the same price buys fewer: the menu
    // figure does not move, the count under it does.
    const before = answersFor("country", menuEur("country"));
    expect(applyLive({
      generated: "2026-09-05",
      cohorts: {
        city: { idx: 1, booked: Array(14).fill(0), nextOpen: null },
        country: { idx: 2, booked: Array(14).fill(1), nextOpen: null },
        world: { idx: 1, booked: Array(14).fill(0), nextOpen: null },
      },
      estimates: {},
    })).toBe(true);
    expect(menuEur("country")).toBe(PRICING.menu.country);
    expect(answersFor("country", menuEur("country"))).toBe(Math.floor(before / 2));
  });

  it("maps the crowding to the three demand words (D368)", () => {
    // The word reads the idx back through the card's own step: nobody
    // else in rotation is quiet, about one other is steady, two or more
    // is contested. Pinned at the committed floor and at two lifted
    // lines, so the edges are the case rather than today's ledger.
    expect(demandWord("world")).toBe("quiet");
    const lifted = (idx: number) => applyLive({
      generated: "2026-09-05",
      cohorts: {
        city: { idx, booked: Array(14).fill(1), nextOpen: null },
        country: { idx: PRICING.floorX, booked: Array(14).fill(0), nextOpen: null },
        world: { idx: PRICING.floorX, booked: Array(14).fill(0), nextOpen: null },
      },
      estimates: {},
    });
    lifted(PRICING.floorX + PRICING.crowdStep * 1); // one other
    expect(demandWord("city")).toBe("steady");
    lifted(PRICING.floorX + PRICING.crowdStep * 2.4); // more than two
    expect(demandWord("city")).toBe("contested");
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

  it("a lifted line's per-answer price keeps its cents in the exact form", () => {
    // At the floor the line is a round figure (€0.02); the first sale
    // lifts it to one the rate-card rounding would move. The live half
    // laid over the card (D366) is how that happens.
    expect(applyLive({
      generated: "2026-09-05",
      cohorts: {
        city: { idx: 1.75, booked: Array(14).fill(1), nextOpen: null },
        country: { idx: 1, booked: Array(14).fill(0), nextOpen: null },
        world: { idx: 1, booked: Array(14).fill(0), nextOpen: null },
      },
      estimates: {},
    })).toBe(true);
    expect(rate("city")).toBe(0.035);
    expect(fmtExact(0.035), "the exact form dropped a cent").toBe("€0.04");
    expect(fmt(0.035)).toBe("€0.04");
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
