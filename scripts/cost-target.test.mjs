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

  it("bills phase A's ingest at the streaming API's row minimum, and erasure as one pass a night over the year", () => {
    // COST-EXPOSURE.md §8: the row is ~120 bytes and the API phase A ships
    // on bills 1 KB of it; and a DELETE is a pass over every partition an
    // account's answers touch — the whole table — so the night runs one
    // statement for the day's deleted accounts and the model prices that
    // pass, not one per account.
    const t = target(1_000_000, 100);
    const ingest = t.lines["BigQuery — ingest (the streaming API phase A ships on: 1 KB minimum a row; A.8 is the Storage Write API)"];
    const erasure = t.lines["BigQuery — erasures (one DELETE a night over the year's table for the day's deleted accounts)"];
    expect(ingest).toBeGreaterThan(0);
    expect(t.facts.ingestBilledGiBMo / t.facts.ingestGiBMo).toBeCloseTo(T.rowMinBilledBytes / T.rowBytes, 6);
    expect(t.facts.ingestWriteApiMo, "the Storage Write API is the cheaper line the runbook's A.8 moves to").toBeLessThan(ingest);
    expect(erasure).toBeGreaterThan(0);
    expect(t.facts.erasureTiBPass).toBeCloseTo((1_000_000 * 100 * T.rowBytes * T.logRetentionDays) / 1024 ** 4, 6);
    expect(erasure).toBeCloseTo(t.facts.erasureTiBPass * PRICES.bqQueryPerTiB * 30 * T.erasurePassesPerNight, 6);
  });

  it("prices outside Firestore are stated as constants the document can name", () => {
    expect(PRICES.bqWritePerGiB).toBeGreaterThan(0);
    expect(PRICES.bqQueryPerTiB).toBeGreaterThan(0);
    expect(PRICES.redisPerGiBHour).toBeGreaterThan(0);
  });
});
