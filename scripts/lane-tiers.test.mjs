// lane-tiers.test.mjs — pins the three-tier allocator's shape (D350), the
// arithmetic every content regulator now shares. The lanes' own tests pin
// their budgets and their bank reads; this file pins what the tiers do with
// a budget once they have one.
import { describe, it, expect } from "vitest";
import { allocateTiers, demandWeights, laneSignal, tierReason, BATCH_TOPIC_SHARE } from "./lane-tiers.mjs";

const rows = (n, stock) => Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(2, "0")}`, stock }));
const total = (a) => a.reduce((n, r) => n + r.write, 0);
const by = (a) => Object.fromEntries(a.map((r) => [r.id, r]));

describe("allocateTiers — unit mode", () => {
  it("keeps the batch-mix ceiling in the LEVELLING tier, not only in demand", () => {
    // The ceiling is a claim about the finished batch, so which tier
    // happens to be spending must not decide whether it applies. It used
    // to be computed inside the demand block, and levelling said "no
    // ceiling" in as many words — so a row demand had just stopped at the
    // cap took the remainder one level unit at a time.
    //
    // Budget 4, share 0.5, so the cap is 2 and two rows can both sit at it
    // with the budget fully spent: binding the ceiling costs nothing here,
    // which is what makes this the case that shows the defect rather than
    // an unsatisfiable one. Before: a:3 (over), b:1. After: a:2, b:2.
    const rows = [{ id: "a", stock: 0 }, { id: "b", stock: 5 }];
    const r = allocateTiers({ rows, budget: 4, floor: 0, demand: { a: 10 }, shareCap: 0.5 });
    const cap = Math.ceil(4 * 0.5);
    for (const row of r.allocation) {
      expect(row.write, `${row.id} took ${row.write} against a ceiling of ${cap}`).toBeLessThanOrEqual(cap);
    }
    // …and the suite's standing property still holds: the budget is spent
    // whole. A hard cap with no fallback would strand a unit here.
    expect(r.spent, "the ceiling stranded budget instead of only shaping it").toBe(4);
  });

  it("spends the whole budget and never stops for stock", () => {
    for (const stock of [0, 10, 24, 240]) {
      const { spent, allocation } = allocateTiers({ rows: rows(10, stock), budget: 12, floor: 24 });
      expect(spent).toBe(12);
      expect(total(allocation)).toBe(12);
    }
  });

  it("fills the floor first, thinnest first, one per row per pass", () => {
    const r = [{ id: "fat", stock: 23 }, { id: "thin", stock: 0 }, { id: "mid", stock: 20 }];
    const { allocation, split } = allocateTiers({ rows: r, budget: 6, floor: 24 });
    expect(split.floor).toBe(6);
    expect(allocation.map((x) => x.id)).toEqual(["thin", "mid", "fat"]);
    const b = by(allocation);
    expect(b.fat.write).toBe(1); // its whole room under the floor, and no more from the floor tier
    expect(b.thin.write).toBeGreaterThanOrEqual(b.mid.write);
  });

  it("the floor never takes a row past its room; the rest levels", () => {
    const r = [{ id: "a", stock: 23 }, { id: "b", stock: 22 }];
    const { allocation, split } = allocateTiers({ rows: r, budget: 10, floor: 24 });
    const b = by(allocation);
    expect(b.a.floor).toBe(1);
    expect(b.b.floor).toBe(2);
    expect(split).toEqual({ floor: 3, demand: 0, level: 7 });
  });

  it("assumes the open PR covers the floor deficit first", () => {
    const r = [{ id: "a", stock: 20 }];
    const { split } = allocateTiers({ rows: r, budget: 6, floor: 24, open: 3 });
    expect(split.floor).toBe(1);
    expect(split.level).toBe(5);
  });

  it("levels evenly above the floor with no signal", () => {
    const { allocation, split } = allocateTiers({ rows: rows(10, 30), budget: 25, floor: 24 });
    expect(split.level).toBe(25);
    const writes = allocation.map((r) => r.write);
    expect(Math.max(...writes) - Math.min(...writes)).toBeLessThanOrEqual(1);
    expect(allocation).toHaveLength(10);
  });

  it("hands the demand share out D'Hondt-style, leaders first, zero weight gets nothing", () => {
    const demand = { r00: 0.6, r01: 0.3, r02: 0.1, r03: 0 };
    const { allocation, split } = allocateTiers({ rows: rows(4, 24), budget: 10, floor: 24, demand });
    expect(split.demand).toBe(10);
    const b = by(allocation);
    expect(b.r00.write).toBe(6);
    expect(b.r01.write).toBe(3);
    expect(b.r02.write).toBe(1);
    expect(b.r03).toBeUndefined();
  });

  it("a small budget lands on the leaders rather than one each down the tail", () => {
    const demand = { r00: 0.5, r01: 0.3, r02: 0.1, r03: 0.05, r04: 0.05 };
    const { allocation } = allocateTiers({ rows: rows(5, 24), budget: 2, floor: 24, demand });
    expect(allocation.map((r) => r.id).sort()).toEqual(["r00", "r01"]);
  });

  it("never lets one row take more than the batch-mix ceiling", () => {
    const demand = { r00: 1, r01: 0.0001, r02: 0 };
    const { allocation } = allocateTiers({ rows: rows(3, 24), budget: 12, floor: 24, demand });
    const cap = Math.ceil(12 * BATCH_TOPIC_SHARE);
    for (const r of allocation) expect(r.write).toBeLessThanOrEqual(cap);
    expect(total(allocation)).toBe(12);
  });

  it("floor before demand before levelling", () => {
    const r = [{ id: "hot", stock: 24 }, { id: "cold", stock: 21 }];
    const { allocation, split } = allocateTiers({ rows: r, budget: 12, floor: 24, demand: { hot: 1, cold: 0 } });
    const b = by(allocation);
    expect(b.cold.floor).toBe(3);
    expect(b.hot.demand).toBe(Math.ceil(12 * BATCH_TOPIC_SHARE));
    expect(split.level).toBe(12 - 3 - b.hot.demand);
  });

  it("is reproducible and survives an empty row list", () => {
    const demand = Object.fromEntries(rows(10, 0).map((r, i) => [r.id, (i + 1) / 55]));
    const a = allocateTiers({ rows: rows(10, 26), budget: 12, floor: 24, demand });
    const b = allocateTiers({ rows: rows(10, 26), budget: 12, floor: 24, demand });
    expect(a).toEqual(b);
    expect(allocateTiers({ rows: [], budget: 12, floor: 24 }).spent).toBe(0);
  });
});

describe("allocateTiers — chunk mode", () => {
  it("touches at most ⌊budget ÷ chunk⌋ rows and splits the budget evenly", () => {
    const { allocation } = allocateTiers({ rows: rows(12, 8), budget: 10, floor: 24, chunk: 4 });
    expect(allocation).toHaveLength(2);
    expect(allocation.map((r) => r.write)).toEqual([5, 5]);
  });

  it("chooses the thinnest under-floor rows first, then demand, then thinnest", () => {
    const r = [
      { id: "deep", stock: 30 },
      { id: "thin", stock: 4 },
      { id: "mid", stock: 12 },
      ...rows(9, 24),
    ];
    const { allocation } = allocateTiers({ rows: r, budget: 10, floor: 24, chunk: 4 });
    expect(allocation.map((x) => x.id)).toEqual(["thin", "mid"]);
    for (const a of allocation) expect(a.floor).toBeGreaterThanOrEqual(4);
  });

  it("above the floor, the demand tier picks distinct rows in weight order", () => {
    const demand = { r00: 0.1, r01: 0.7, r02: 0.2 };
    const { allocation } = allocateTiers({ rows: rows(3, 24), budget: 10, floor: 24, chunk: 4, demand });
    expect(allocation.map((x) => x.id)).toEqual(["r01", "r02"]);
    expect(allocation.every((x) => x.demand === x.write)).toBe(true);
  });

  it("a levelled bank keeps getting the full budget, thinnest rows first", () => {
    const r = [...rows(11, 30), { id: "shallow", stock: 25 }];
    const { allocation, split } = allocateTiers({ rows: r, budget: 10, floor: 24, chunk: 4 });
    expect(split.level).toBe(10);
    expect(allocation[0].id).toBe("shallow"); // chosen first, printed first
    expect(allocation.map((x) => x.write)).toEqual([5, 5]);
  });

  it("a budget under one chunk still goes somewhere", () => {
    const { allocation, spent } = allocateTiers({ rows: rows(3, 8), budget: 3, floor: 24, chunk: 4 });
    expect(spent).toBe(3);
    expect(allocation).toHaveLength(1);
  });
});

describe("demandWeights", () => {
  it("is popularity × depth, and a small devoted row outranks a big diluted one", () => {
    const w = demandWeights([
      { id: "wide", stock: 40, answers: 200 },
      { id: "devoted", stock: 4, answers: 120 },
    ]);
    expect(w.devoted).toBeGreaterThan(w.wide);
  });

  it("returns null when nothing credited can steer", () => {
    expect(demandWeights([{ id: "a", stock: 5, answers: 0 }])).toBeNull();
    expect(demandWeights([{ id: "a", stock: 0, answers: 9 }])).toBeNull();
  });
});

describe("laneSignal", () => {
  const r = rows(3, 20);
  const fresh = () => new Date().toISOString();
  const sig = (scorecard, answers, now) =>
    laneSignal({ scorecard, rows: r, answersOf: (id) => answers[id], minAnswers: 100, staleDays: 30, now });

  it("is blind with no scorecard, an undated one, or a stale one", () => {
    expect(sig(null, {}).mode).toBe("blind");
    expect(sig({}, { r00: 500 }).mode).toBe("blind");
    const at = Date.parse("2026-01-01T00:00:00Z");
    expect(sig({ generatedAt: "2026-01-01T00:00:00Z" }, { r00: 500 }, at + 31 * 86400000).mode).toBe("blind");
    expect(sig({ generatedAt: "2026-01-01T00:00:00Z" }, { r00: 500 }, at + 30 * 86400000).mode).toBe("demand");
  });

  it("is blind under minAnswers and names the threshold", () => {
    const s = sig({ generatedAt: fresh() }, { r00: 50, r01: 49 });
    expect(s.mode).toBe("blind");
    expect(s.note).toContain("under 100");
  });

  it("names the leaders in demand mode", () => {
    const s = sig({ generatedAt: fresh() }, { r00: 600, r01: 300, r02: 100 });
    expect(s.mode).toBe("demand");
    expect(s.note).toContain("demand leads r00");
    expect(s.weights.r00).toBeGreaterThan(s.weights.r01);
  });
});

describe("tierReason", () => {
  it("says where the budget went", () => {
    const line = tierReason({ split: { floor: 3, demand: 4, level: 5 }, deficit: 3, floor: 24, cap: 12 });
    expect(line).toContain("3 to the 24/topic floor");
    expect(line).toContain("4 by demand share");
    expect(line).toContain("5 levelling");
    expect(line).toContain("capped at 12/run");
  });
});
