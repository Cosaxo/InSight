// @vitest-environment jsdom
//
// The anonymous feature tally (R2/D253). What is pinned and why:
//
//   1. INERT UNARMED — the whole reason no test-mode flag exists: a demo
//      build, a ui unit test or a jsdom mount must tally nothing and
//      write nothing.
//   2. One shard per finished day, bucketed — exact counts never leave
//      the device, today never flushes (create-only needs the day over),
//      and a too-old tally is dropped rather than sent into a rules
//      window that would refuse it.
//   3. The sampling coin is per-day and decides at the first note; an
//      unsampled day tallies NOTHING (nothing half-collected to explain).
//   4. The purge listener drops to fresh-boot without writing the key
//      back (the D51 resurrection); the full seed→purge→remutate cycle
//      is purge-wipe.test.ts's, alongside the other module stores.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  arm, bucketize, flushPast, note, noteAnswer, utcDay,
  LS_KEY, MAX_SHARD_AGE_DAYS, S_KEYS,
  _engagementForTest,
  type AttentionShard, type SKey,
} from "./engagement";

const D1 = Date.UTC(2026, 7, 22, 10, 0, 0); // 2026-08-22, mid-day UTC
const D2 = Date.UTC(2026, 7, 23, 10, 0, 0);

function harness(startMs = D1, coin = 0) {
  const h = {
    now: startMs,
    // The coin is drawn at the day's FIRST note — which is arm()'s own
    // "opens" — so an unsampled harness must start unsampled.
    coin, // < rate → sampled
    written: [] as AttentionShard[],
    failWrites: false,
  };
  arm({
    write: async (shard) => {
      if (h.failWrites) throw new Error("refused");
      h.written.push(shard);
    },
    build: 24,
    nowMs: () => h.now,
    rand: () => h.coin,
  });
  return h;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  _engagementForTest().reset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("inertness", () => {
  it("unarmed, note() tallies nothing and writes nothing", () => {
    note("feedSeen");
    vi.advanceTimersByTime(10_000);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(_engagementForTest().days).toEqual({});
  });

  it("an unknown key is ignored, armed or not", () => {
    harness();
    note("definitelyNotAKey" as SKey);
    const day = utcDay(D1);
    expect(_engagementForTest().days[day]?.s).toEqual({ opens: 1 }); // arm()'s own open only
  });
});

describe("tallying", () => {
  it("counts exact ints locally and coalesces the save", () => {
    harness();
    note("feedSeen");
    note("feedSeen");
    note("feedPass");
    expect(localStorage.getItem(LS_KEY)).toBeNull(); // not yet — coalesced
    vi.advanceTimersByTime(2100);
    const stored = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(stored.days[utcDay(D1)].s).toMatchObject({ feedSeen: 2, feedPass: 1, opens: 1 });
  });

  it("an unsampled day tallies nothing at all", () => {
    harness(D1, 1); // 1 < SHARD_SAMPLE_RATE(1) is false → unsampled
    note("feedSeen");
    expect(_engagementForTest().days[utcDay(D1)]).toMatchObject({ sampled: false, s: {} });
  });

  it("noteAnswer maps every answering surface, duel halves merged", () => {
    harness();
    for (const s of ["daily", "feed", "test", "learn", "pulse", "call", "group", "duo"]) noteAnswer(s);
    noteAnswer("mystery"); // unknown surface → ignored
    expect(_engagementForTest().days[utcDay(D1)].s).toMatchObject({
      ansDaily: 1, ansFeed: 1, ansTest: 1, ansLearn: 1, ansPulse: 1, ansCall: 1, ansDuel: 2,
    });
  });
});

describe("the flush", () => {
  it("flushes a finished day as one bucketed shard and clears it locally", async () => {
    const h = harness();
    for (let i = 0; i < 4; i++) note("feedSeen"); // 4 → bucket 2 (3–5)
    note("ansDaily"); // 1 → bucket 1
    h.now = D2; // the day rolls over
    note("tabDaily"); // first note of the new day kicks the flush
    await vi.runOnlyPendingTimersAsync();
    expect(h.written).toHaveLength(1);
    expect(h.written[0]).toMatchObject({
      day: utcDay(D1), build: 24, platform: "web", sampled: true, rate: 1,
      s: { feedSeen: 2, ansDaily: 1, opens: 1 },
    });
    // no uid, no qids — the two-channel rule at the shard itself
    expect(Object.keys(h.written[0])).not.toContain("uid");
    expect(Object.keys(h.written[0])).not.toContain("qids");
    const stored = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(stored.days[utcDay(D1)]).toBeUndefined();
    expect(stored.days[utcDay(D2)].s).toMatchObject({ tabDaily: 1 });
  });

  it("today never flushes — the shard is create-only for a FINISHED day", async () => {
    const h = harness();
    note("feedSeen");
    await flushPast();
    expect(h.written).toHaveLength(0);
  });

  it("drops a tally older than the rules window instead of writing a doomed shard", async () => {
    const h = harness();
    note("feedSeen");
    h.now = D1 + (MAX_SHARD_AGE_DAYS + 2) * 86400000;
    await flushPast();
    expect(h.written).toHaveLength(0);
    expect(_engagementForTest().days[utcDay(D1)]).toBeUndefined();
  });

  it("a refused write is not retried — the SDK queue owns delivery, this owns not double-counting", async () => {
    const h = harness();
    note("feedSeen");
    h.failWrites = true;
    h.now = D2;
    await flushPast();
    await vi.runOnlyPendingTimersAsync();
    expect(_engagementForTest().days[utcDay(D1)]).toBeUndefined(); // cleared regardless
  });

  it("an unsampled finished day flushes nothing", async () => {
    const h = harness(D1, 1); // the day exists, unsampled, from arm()'s open
    note("feedSeen");
    h.coin = 0;
    h.now = D2;
    await flushPast();
    expect(h.written).toHaveLength(0);
  });
});

describe("the purge listener (D51)", () => {
  it("drops to fresh-boot and does not write the key back", () => {
    harness();
    note("feedPass");
    _engagementForTest().saveNow();
    expect(localStorage.getItem(LS_KEY)).toContain("feedPass");
    // exactly what purgeLocalTrace does: keys removed, then the event
    localStorage.removeItem(LS_KEY);
    window.dispatchEvent(new Event("insight:local-purge"));
    vi.advanceTimersByTime(5000);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    // the next account's first tally persists only its own data
    note("feedSeen");
    _engagementForTest().saveNow();
    expect(localStorage.getItem(LS_KEY)).toContain("feedSeen");
    expect(localStorage.getItem(LS_KEY)).not.toContain("feedPass");
  });
});

describe("bucketize", () => {
  it("maps the ATTENTION.md scale exactly, boundaries included", () => {
    const table: Array<[number, number]> = [
      [0, 0], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [10, 3], [11, 4], [137, 4],
    ];
    for (const [n, b] of table) expect(bucketize(n), `bucketize(${n})`).toBe(b);
  });
});

describe("the key list", () => {
  it("is the shard vocabulary the rules arm whitelists — additions land in both or neither", () => {
    // Not a figure quote: the rules arm's hasOnly list is hand-held to
    // this export, and this pin is what a drifted edit fails against.
    expect(S_KEYS).toHaveLength(30);
    expect(new Set(S_KEYS).size).toBe(S_KEYS.length);
  });
});
