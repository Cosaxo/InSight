// @vitest-environment jsdom
// The live half of the rate card (D366): the published document laid over
// the committed constants when the door opens. Its own file rather than
// pricing.test.ts's, because these cases mock lib/firebase and the
// arithmetic cases there must keep running against the real module.
//
// What is pinned: the overlay refuses a document not in shape WHOLE,
// clamps a published idx into the committed floor and ceiling, re-renders
// every price-printing subscriber when it lands, reads once per session,
// and leaves the committed card in force — and says so — when the read
// fails or nothing has been published.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const S = vi.hoisted(() => ({
  exists: false,
  data: {} as Record<string, unknown>,
  throws: false,
  reads: 0,
}));

vi.mock("../../lib/firebase", () => ({
  getDb: async () => ({}),
  getFirestoreApi: async () => ({
    doc: () => ({}),
    getDoc: async () => {
      S.reads += 1;
      if (S.throws) throw new Error("unavailable");
      return { exists: () => S.exists, data: () => S.data };
    },
  }),
}));

let pricing: typeof import("./pricing");
const committed = () => JSON.parse(JSON.stringify(pricing.PRICING)) as typeof pricing.PRICING;

const liveDoc = (over: Record<string, unknown> = {}) => ({
  generated: "2026-09-05",
  cohorts: {
    // 1.6 is 1.2 others at the committed step of 0.5 → "steady".
    city: { idx: 1.6, booked: Array(14).fill(1), nextOpen: null },
    country: { idx: 0.9, booked: Array(14).fill(0), nextOpen: null },
    world: { idx: 1.1, booked: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], nextOpen: "2026-09-09" },
  },
  estimates: { city: { perDay: 42, campaigns: 1, days: 29 } },
  ...over,
});

beforeEach(async () => {
  S.exists = false;
  S.data = {};
  S.throws = false;
  S.reads = 0;
  vi.resetModules();
  pricing = await import("./pricing");
});

afterEach(() => { S.throws = false; });

describe("parseLive — the shape the door will print", () => {
  it("takes a well-formed document, every cohort held to the committed floor and to no ceiling (D368)", () => {
    const p = pricing.parseLive(liveDoc({ cohorts: { ...liveDoc().cohorts,
      city: { idx: 9, booked: Array(14).fill(1), crowd: Array(14).fill(16), nextOpen: null },
      country: { idx: 0.2, booked: Array(14).fill(0), nextOpen: null },
    } }));
    expect(p).not.toBeNull();
    expect(p!.cohorts.city.idx).toBe(9);
    expect(p!.cohorts.city.crowd).toEqual(Array(14).fill(16));
    expect(p!.cohorts.country.idx).toBe(pricing.PRICING.floorX);
    // no crowd strip on a doc from before D368: derived from `booked`
    expect(p!.cohorts.world.crowd).toEqual([1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(p!.cohorts.world.nextOpen).toBe("2026-09-09");
    expect(p!.estimates.city).toEqual({ perDay: 42, campaigns: 1, days: 29 });
  });

  it("refuses a malformed crowd strip, whole", () => {
    expect(pricing.parseLive(liveDoc({ cohorts: { ...liveDoc().cohorts, city: { idx: 1, booked: Array(14).fill(0), crowd: [0, 1], nextOpen: null } } }))).toBeNull();
  });

  it("refuses junk, a missing cohort, a short strip and a non-day, whole", () => {
    expect(pricing.parseLive(null)).toBeNull();
    expect(pricing.parseLive("card")).toBeNull();
    expect(pricing.parseLive({ generated: "2026-09-05" })).toBeNull();
    const { world: _w, ...two } = liveDoc().cohorts;
    void _w;
    expect(pricing.parseLive(liveDoc({ cohorts: two }))).toBeNull();
    expect(pricing.parseLive(liveDoc({ cohorts: { ...liveDoc().cohorts, city: { idx: 1, booked: [1, 0], nextOpen: null } } }))).toBeNull();
    expect(pricing.parseLive(liveDoc({ generated: "today" }))).toBeNull();
  });

  it("drops an estimate without its basis and keeps the rest", () => {
    const p = pricing.parseLive(liveDoc({ estimates: { city: { perDay: 42, campaigns: 0, days: 29 }, world: { perDay: 7, campaigns: 2, days: 58 } } }));
    expect(p!.estimates.city).toBeUndefined();
    expect(p!.estimates.world).toEqual({ perDay: 7, campaigns: 2, days: 58 });
  });

  it("carries how many of an estimate's campaigns are still running, when it fits (D367)", () => {
    const p = pricing.parseLive(liveDoc({ estimates: {
      city: { perDay: 42, campaigns: 2, days: 40, running: 1 },
      world: { perDay: 7, campaigns: 2, days: 58, running: 9 },
    } }));
    expect(p!.estimates.city).toEqual({ perDay: 42, campaigns: 2, days: 40, running: 1 });
    expect(p!.estimates.world).toEqual({ perDay: 7, campaigns: 2, days: 58 });
  });
});

describe("answersFor — what a budget buys at the line in force (D367)", () => {
  it("is the budget over the rate, floored — a ceiling, never a forecast", () => {
    const r = pricing.rate("city");
    expect(pricing.answersFor("city", 100)).toBe(Math.floor(100 / r));
    pricing.applyLive(liveDoc()); // city ×1.6: the same money buys fewer
    expect(pricing.answersFor("city", 100)).toBe(Math.floor(100 / pricing.rate("city")));
    expect(pricing.answersFor("city", 100)).toBeLessThan(Math.floor(100 / r));
  });
});

describe("applyLive — the card in force moves, and every printed price with it", () => {
  it("overlays cohorts, estimates and the date; the constants stay the committed file's", () => {
    const before = committed();
    expect(pricing.isLive()).toBe(false);
    expect(pricing.applyLive(liveDoc())).toBe(true);
    expect(pricing.isLive()).toBe(true);
    expect(pricing.PRICING.generated).toBe("2026-09-05");
    expect(pricing.PRICING.cohorts.city.idx).toBe(1.6);
    expect(pricing.rate("city")).toBe(Math.round(before.base * 1.6 * 1000) / 1000);
    expect(pricing.demandWord("city")).toBe("steady");
    expect(pricing.PRICING.base).toBe(before.base);
    expect(pricing.PRICING.capEur).toBe(before.capEur);
    expect(pricing.PRICING.fx).toEqual(before.fx);
  });

  it("notifies the price subscribers — the same list the currency switch uses", () => {
    const f = vi.fn();
    pricing.subscribeCur(f);
    pricing.applyLive(liveDoc());
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("leaves the card exactly as it was on a document it refuses", () => {
    const before = committed();
    expect(pricing.applyLive({ generated: "2026-09-05" })).toBe(false);
    expect(pricing.PRICING).toEqual(before);
    expect(pricing.isLive()).toBe(false);
  });
});

describe("loadLiveCard — one read when the door opens", () => {
  it("applies a published card and reads once per session after that", async () => {
    S.exists = true;
    S.data = liveDoc();
    expect(await pricing.loadLiveCard()).toBe(true);
    expect(pricing.PRICING.cohorts.city.idx).toBe(1.6);
    expect(await pricing.loadLiveCard()).toBe(true);
    expect(S.reads, "a second open must not read again").toBe(1);
  });

  it("keeps the committed card when nothing has been published, and says so", async () => {
    const before = committed();
    expect(await pricing.loadLiveCard()).toBe(false);
    expect(pricing.PRICING).toEqual(before);
    expect(pricing.isLive()).toBe(false);
  });

  it("keeps the committed card when the read fails, and may try again next time", async () => {
    S.throws = true;
    const before = committed();
    expect(await pricing.loadLiveCard()).toBe(false);
    expect(pricing.PRICING).toEqual(before);
    S.throws = false;
    S.exists = true;
    S.data = liveDoc();
    expect(await pricing.loadLiveCard()).toBe(true);
    expect(S.reads).toBe(2);
  });

  it("collapses concurrent opens into one read", async () => {
    S.exists = true;
    S.data = liveDoc();
    await Promise.all([pricing.loadLiveCard(), pricing.loadLiveCard(), pricing.loadLiveCard()]);
    expect(S.reads).toBe(1);
  });
});
