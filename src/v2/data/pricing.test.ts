// @vitest-environment jsdom
// pricing.ts is the typed face of the COMMITTED rate card (PAID-PLAN §6,
// D288 §3) — these cases pin the module's own promises, not the file's
// numbers (check:pricing referees those): the posted line is base × idx
// and nothing else, non-EUR prints as ≈ because the fx table is a dated
// convenience, an unknown currency falls back to the contract's own EUR,
// and the preference dies with the account like every insight.* key.
import { beforeEach, describe, expect, it } from "vitest";
import { PRICING, cur, demandWord, fmt, rate, setCur } from "./pricing";

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
