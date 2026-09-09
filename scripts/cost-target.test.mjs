// cost-target.test.mjs — holds scripts/cost-target.mjs to what
// docs/SCALE-ARCHITECTURE.md claims of it: the target structure's bill is
// linear in users at a fixed answer rate, it is a multiple cheaper than the
// shipped structure at every load the owner named, its lines sum to its
// total, and the shipped failure sizes are computed from the tree (the
// nightly pass's memory) and a measured constant rather than remembered.
// Not a pin on any dollar figure — prices move, and the document re-prints
// its tables from the script rather than quoting them.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOADS, PRICES, T, ALS_SWEEPS, BREAKDOWN_DIMS, NIGHTLY_MIB, shipped, target } from "./cost-target.mjs";
import { B } from "./cost-arith.mjs";

describe("cost-target reads its constants from the tree", () => {
  it("the nightly pass's memory and the dims are read, not remembered", () => {
    const ops = readFileSync(new URL("../functions/src/ops.ts", import.meta.url), "utf8");
    const m = /export const NIGHTLY = \{ memory: "(\d+)GiB"/.exec(ops);
    expect(m, "ops.ts no longer declares NIGHTLY where cost-target looks").toBeTruthy();
    expect(NIGHTLY_MIB).toBe(Number(m[1]) * 1024);
    expect(BREAKDOWN_DIMS).toBeGreaterThanOrEqual(8);
    expect(ALS_SWEEPS).toBeGreaterThanOrEqual(1);
  });

  it("leaves cost-arith's shipped model untouched after pricing a load", () => {
    const was = B.worldAnswers;
    shipped(1_000_000, 300);
    expect(B.worldAnswers).toBe(was);
  });
});

describe("the target structure's arithmetic", () => {
  it("every line is a non-negative dollar figure and the lines sum to the total", () => {
    for (const [dau, answers] of LOADS) {
      const t = target(dau, answers);
      const sum = Object.values(t.lines).reduce((a, b) => a + b, 0);
      for (const [k, v] of Object.entries(t.lines)) expect(v, k).toBeGreaterThanOrEqual(0);
      expect(t.perMonth).toBeCloseTo(sum, 6);
    }
  });

  it("is close to linear in users at a fixed answer rate (fixed instances aside)", () => {
    const one = target(1_000_000, 100).perMonth;
    const ten = target(10_000_000, 100).perMonth;
    expect(ten / one).toBeGreaterThan(6);
    expect(ten / one).toBeLessThan(11);
  });

  it("is a multiple cheaper than the shipped structure at every load past today's", () => {
    for (const [dau, answers] of LOADS) {
      if (dau < 1_000_000) continue;
      expect(shipped(dau, answers).perMonth / target(dau, answers).perMonth, `${dau} × ${answers}`).toBeGreaterThan(5);
    }
  });

  it("the shipped pass dies below a hundred thousand users at a hundred answers a day, and the target does not hold the day", () => {
    const s = shipped(1_000_000, 100);
    expect(s.passDiesAtDau).toBeLessThan(100_000);
    expect(s.indexWallDau).toBeLessThan(1_000_000);
    // the target's per-night memory is bytes scanned by BigQuery, not
    // entries held: the fact the script prints is TiB scanned
    expect(target(10_000_000, 300).facts.scanTiBDay).toBeGreaterThan(0);
  });

  it("the batch dial moves the trigger and write lines and nothing else", () => {
    const was = T.answersPerBatch;
    try {
      T.answersPerBatch = 3;
      const tight = target(1_000_000, 100);
      T.answersPerBatch = 45;
      const loose = target(1_000_000, 100);
      expect(tight.facts.invocationsPerDay).toBeGreaterThan(loose.facts.invocationsPerDay * 10);
      expect(tight.lines["Redis — live counters (sized for the peak and the keyspace)"])
        .toBe(loose.lines["Redis — live counters (sized for the peak and the keyspace)"]);
    } finally {
      T.answersPerBatch = was;
    }
  });

  it("prices outside Firestore are stated as constants the document can name", () => {
    expect(PRICES.bqWritePerGiB).toBeGreaterThan(0);
    expect(PRICES.bqQueryPerTiB).toBeGreaterThan(0);
    expect(PRICES.redisPerGiBHour).toBeGreaterThan(0);
  });
});
