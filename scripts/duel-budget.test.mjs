// duel-budget.test.mjs — pins the duel regulator's arithmetic.
//
// The first property is the one the lane is being scheduled for, the same one
// feed-budget.test.mjs pins and for the same reason: the regulator must find
// work in the bank as it actually ships. The learn lane's flat rule could not
// (every field sat exactly on the floor it was measured against) and that bug
// was invisible for as long as nothing fired the lane; this lane gets its
// Routine in the same change, so the test that would have caught it comes
// first.
//
// The second is the romantic pool: it ships dark (`active: false`, the D40
// posture) and still counts at full weight, because its entries light up in
// one operator step. A future edit that "fixes" the dark pool out of the
// deficit should fail here rather than pass review.
import { describe, it, expect } from "vitest";
import { duelBudget, duelSignal, loadDuelPools, targetFor, RUN_CAP, POOL_TARGET, DARK_POOL_TARGET, OPEN_MAX } from "./duel-budget.mjs";

const level = (questions) =>
  ["group", "oneVsOne", "romantic"].map((id) => ({ id, questions }));

describe("duelBudget", () => {
  it("finds work in the bank as it actually ships", () => {
    const { budget, allocation } = duelBudget({ pools: loadDuelPools() });
    expect(budget).toBeGreaterThan(0);
    expect(allocation.length).toBeGreaterThan(0);
  });

  it("counts all three pools, the dark one included", () => {
    const pools = loadDuelPools();
    expect(pools.map((p) => p.id)).toEqual(["group", "oneVsOne", "romantic"]);
    for (const p of pools) expect(p.questions).toBeGreaterThan(0);
  });

  it("grants the full cap to pools far from target", () => {
    expect(duelBudget({ pools: level(0) }).budget).toBe(RUN_CAP);
  });

  it("throttles to zero once every pool is at target", () => {
    expect(duelBudget({ pools: level(POOL_TARGET) }).budget).toBe(0);
    expect(duelBudget({ pools: level(POOL_TARGET + 9) }).budget).toBe(0);
  });

  it("writes only the gap when the pools are nearly full", () => {
    const pools = [
      { id: "group", questions: POOL_TARGET },
      { id: "oneVsOne", questions: POOL_TARGET - 2 },
      { id: "romantic", questions: POOL_TARGET },
    ];
    expect(duelBudget({ pools }).budget).toBe(2);
  });

  it("subtracts the open PR from the budget, not just from a ceiling", () => {
    expect(duelBudget({ pools: level(0), open: 1 }).budget).toBe(OPEN_MAX - 1);
    expect(duelBudget({ pools: level(0), open: OPEN_MAX - 1 }).budget).toBe(1);
  });

  it("stops entirely when the open PR is unreviewable", () => {
    expect(duelBudget({ pools: level(0), open: OPEN_MAX }).budget).toBe(0);
    expect(duelBudget({ pools: level(0), open: OPEN_MAX + 3 }).budget).toBe(0);
  });

  it("fills the thinnest pool first", () => {
    const pools = [
      { id: "group", questions: POOL_TARGET - 1 },
      { id: "oneVsOne", questions: POOL_TARGET - 8 },
      { id: "romantic", questions: 0 },
    ];
    const { allocation } = duelBudget({ pools });
    expect(allocation[0].pool).toBe("romantic");
    expect(allocation[0].write).toBeGreaterThanOrEqual(allocation[allocation.length - 1].write);
  });

  it("never allocates a pool past the target", () => {
    const pools = [
      { id: "group", questions: POOL_TARGET - 1 },
      { id: "oneVsOne", questions: 0 },
      { id: "romantic", questions: POOL_TARGET },
    ];
    const { allocation } = duelBudget({ pools });
    for (const a of allocation) expect(a.questions + a.write).toBeLessThanOrEqual(POOL_TARGET);
  });

  it("reaches the target in a bounded number of runs at a steady gate", () => {
    // The regulator's steady state: generation converges on the target and
    // then stops — it does not idle at a cap forever.
    let pools = loadDuelPools();
    let runs = 0;
    for (; runs < 100; runs++) {
      const { budget, allocation } = duelBudget({ pools });
      if (budget === 0) break;
      const written = new Map(allocation.map((a) => [a.pool, a.write]));
      pools = pools.map((p) => ({ ...p, questions: p.questions + (written.get(p.id) ?? 0) }));
    }
    expect(runs).toBeLessThan(100);
    expect(pools.every((p) => p.questions >= targetFor(p))).toBe(true);
  });

  it("the dark pool is levelled to its own target, and lights up to the live one", () => {
    // The romantic pool ships dark (every entry `active: false`, D40), and
    // stocking 400 questions for a surface nobody plays yet is inventory,
    // not runway. Read off the bank rather than assumed: the shipped pool
    // IS dark today, and the day it is lit its target moves by itself.
    const pools = loadDuelPools();
    const romantic = pools.find((p) => p.id === "romantic");
    expect(romantic.dark).toBe(true);
    expect(targetFor(romantic)).toBe(DARK_POOL_TARGET);
    expect(targetFor({ ...romantic, dark: false })).toBe(POOL_TARGET);
    expect(pools.filter((p) => p.id !== "romantic").every((p) => !p.dark)).toBe(true);
    // A run with the live pools full and the dark one at its own target
    // writes nothing — 48 is enough for a switch, and the burst is the
    // live pools'.
    expect(duelBudget({ pools: [
      { id: "group", questions: POOL_TARGET },
      { id: "oneVsOne", questions: POOL_TARGET },
      { id: "romantic", questions: DARK_POOL_TARGET, dark: true },
    ] }).budget).toBe(0);
  });

  it("keeps the constants in the relation the design argues", () => {
    // POOL_TARGET is a pair at eight rounds a day for seven weeks without a
    // repeat (ROUNDS-PLAN §6.1; 8 × 49), the horizon the day's 48 gave a
    // daily player — and the dark pool keeps that older figure, twice the
    // shipped group cycle. OPEN_MAX equals RUN_CAP because the lane is
    // single-gate and carries one batch at a time. If a relation changes,
    // the reasoning in the header has to change with it — this failing is
    // that reminder.
    expect(POOL_TARGET).toBeGreaterThanOrEqual(8 * 49);
    expect(DARK_POOL_TARGET).toBe(2 * 24);
    expect(OPEN_MAX).toBe(RUN_CAP);
  });
});

describe("duelSignal", () => {
  it("is blind with no scorecard and blind at zero scored", () => {
    expect(duelSignal(null).mode).toBe("blind");
    expect(duelSignal({ duel: { coverage: { scored: 0 } } }).mode).toBe("blind");
  });

  it("reads the guess-match signal once duels score", () => {
    const s = duelSignal({
      duel: { coverage: { scored: 5 }, deadDuels: [{ id: "000" }], noisyDuels: [] },
    });
    expect(s.mode).toBe("signal");
    expect(s.note).toContain("1 dead");
  });
});
