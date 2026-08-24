// @vitest-environment jsdom
//
// The device half of the engagement ladder: rung 1's anonymous tally
// (R2/D270), the per-question map (R4/D271), rung 2's person rollup
// (R3/D272). What is pinned and why:
//
//   1. INERT UNARMED — a demo build, a ui unit test or a jsdom mount
//      tallies nothing and writes nothing, with no test-mode flag.
//   2. Two writes per finished day at most, both create-only shapes:
//      the shard bucketed and sampled, the rollup unsampled and
//      RETAINED (not lost) when no session exists to own it yet.
//   3. The two-channel rule at the doc level: the rollup never carries a
//      question id; the qids map rides only the shard, capped with an
//      overflow cell so it can never outgrow the rules' size cap.
//   4. Sessions: the 30-minute gap starts a new one, quiet is decided at
//      close and lands on the session's START day, foreground time
//      accumulates visible→hidden.
//   5. The purge listener drops to fresh-boot without writing back; the
//      full cycle is purge-wipe.test.ts's.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  arm, bucketize, bucketizeMinutes, daypartOf, flushPast, markDepthEnd,
  note, noteAnswer, noteQid, utcDay,
  LS_KEY, MAX_SHARD_AGE_DAYS, QIDS_CAP, QID_OTHER, SESSION_GAP_MS, S_KEYS,
  _engagementForTest,
  type AttentionShard, type EngagementRollup, type SKey,
} from "./engagement";

const D1 = Date.UTC(2026, 7, 22, 10, 0, 0); // 2026-08-22, mid-day UTC
const D2 = Date.UTC(2026, 7, 23, 10, 0, 0);

function harness(startMs = D1, coin = 0, uid = true) {
  const h = {
    now: startMs,
    // Drawn at the day's FIRST note — which is arm()'s own open — so an
    // unsampled harness must start unsampled.
    coin,
    uid,
    written: [] as AttentionShard[],
    rollups: [] as EngagementRollup[],
    failWrites: false,
  };
  arm({
    write: async (shard) => {
      if (h.failWrites) throw new Error("refused");
      h.written.push(shard);
    },
    writeRollup: async (rollup) => {
      if (!h.uid) throw new Error("no session");
      h.rollups.push(rollup);
    },
    hasUid: () => h.uid,
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
  it("unarmed, nothing tallies and nothing writes", () => {
    note("feedSeen");
    noteQid("feed-001", "s");
    markDepthEnd();
    vi.advanceTimersByTime(10_000);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(_engagementForTest().days).toEqual({});
  });

  it("an unknown key is ignored, armed or not", () => {
    harness();
    note("definitelyNotAKey" as SKey);
    const t = _engagementForTest().days[utcDay(D1)];
    expect(t.s).toEqual({ opens: 1 }); // arm()'s own open only
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

  it("an unsampled day tallies no shard counters — but the person channel still runs", () => {
    harness(D1, 1); // 1 < SHARD_SAMPLE_RATE(1) is false → unsampled
    note("feedSeen");
    noteQid("feed-001", "s");
    const t = _engagementForTest().days[utcDay(D1)];
    expect(t.sampled).toBe(false);
    expect(t.s).toEqual({});
    expect(t.q).toEqual({});
    // the rollup side is not sampled: the session and the feed count exist
    expect(t.r).toMatchObject({ sessions: 1, feedSeen: 1 });
  });

  it("noteAnswer maps surfaces, feeds the rollup count, and un-quiets the session", () => {
    harness();
    for (const s of ["daily", "feed", "test", "learn", "pulse", "call", "group", "duo"]) noteAnswer(s);
    noteAnswer("mystery");
    const t = _engagementForTest().days[utcDay(D1)];
    expect(t.s).toMatchObject({
      ansDaily: 1, ansFeed: 1, ansTest: 1, ansLearn: 1, ansPulse: 1, ansCall: 1, ansDuel: 2,
    });
    expect(t.r.answers).toBe(8);
  });

  it("mirror stops and lens taps also count into the person channel", () => {
    harness();
    note("stopCity");
    note("stopWorld");
    note("lensPeople");
    const t = _engagementForTest().days[utcDay(D1)];
    expect(t.r).toMatchObject({ stops: 2, lenses: 1 });
  });
});

describe("the qids map (R4/D271)", () => {
  it("counts per question, per kind, sampled only", () => {
    harness();
    noteQid("feed-001", "s");
    noteQid("feed-001", "s");
    noteQid("feed-001", "a");
    noteQid("feed-002", "p");
    const t = _engagementForTest().days[utcDay(D1)];
    expect(t.q["feed-001"]).toEqual({ s: 2, a: 1 });
    expect(t.q["feed-002"]).toEqual({ p: 1 });
  });

  it("overflows into the reserved cell so the shard can never outgrow the rules cap", () => {
    harness();
    for (let i = 0; i < QIDS_CAP + 30; i++) noteQid(`feed-${i}`, "s");
    const t = _engagementForTest().days[utcDay(D1)];
    const keys = Object.keys(t.q);
    expect(keys.length).toBeLessThanOrEqual(QIDS_CAP);
    expect(t.q[QID_OTHER]?.s).toBe(31); // the 120th distinct qid onward
  });
});

describe("the flush", () => {
  it("flushes a finished day as one bucketed shard and one rollup, then clears it", async () => {
    const h = harness();
    for (let i = 0; i < 4; i++) note("feedSeen");
    noteAnswer("daily");
    noteQid("feed-001", "s");
    noteQid("feed-001", "a");
    h.now = D2;
    note("tabDaily"); // first note of the new day kicks the flush
    await vi.runOnlyPendingTimersAsync();

    expect(h.written).toHaveLength(1);
    expect(h.written[0]).toMatchObject({
      day: utcDay(D1), build: 24, platform: "web", sampled: true, rate: 1,
      s: { feedSeen: 2, ansDaily: 1, opens: 1 },
      qids: { "feed-001": { s: 1, a: 1 } },
    });
    expect(Object.keys(h.written[0])).not.toContain("uid");

    expect(h.rollups).toHaveLength(1);
    const r = h.rollups[0];
    expect(r).toMatchObject({
      day: utcDay(D1), sessions: 1, answers: 1, feedB: bucketize(4),
      folded: false, build: 24, platform: "web",
    });
    // the two-channel rule at the doc: no question id may ride the rollup
    expect(Object.keys(r)).not.toContain("qids");
    expect(r.expireAt.getTime()).toBeGreaterThan(Date.parse(`${utcDay(D1)}T00:00:00Z`));

    const stored = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(stored.days[utcDay(D1)]).toBeUndefined();
  });

  it("today never flushes — both docs are create-only for a FINISHED day", async () => {
    const h = harness();
    note("feedSeen");
    await flushPast();
    expect(h.written).toHaveLength(0);
    expect(h.rollups).toHaveLength(0);
  });

  it("retains the rollup when no session exists yet, and sends it once one does", async () => {
    const h = harness(D1, 0, false); // no uid yet
    note("feedSeen");
    h.now = D2;
    await flushPast();
    expect(h.written).toHaveLength(1); // the anonymous shard needs no uid
    expect(h.rollups).toHaveLength(0);
    const kept = _engagementForTest().days[utcDay(D1)];
    expect(kept.r.feedSeen).toBe(1);
    expect(kept.sampled).toBe(false); // never re-sharded

    h.uid = true;
    await flushPast();
    expect(h.rollups).toHaveLength(1);
    expect(_engagementForTest().days[utcDay(D1)]).toBeUndefined();
  });

  it("drops a tally older than the rules window instead of writing doomed docs", async () => {
    const h = harness();
    note("feedSeen");
    h.now = D1 + (MAX_SHARD_AGE_DAYS + 2) * 86400000;
    await flushPast();
    expect(h.written).toHaveLength(0);
    expect(h.rollups).toHaveLength(0);
    expect(_engagementForTest().days[utcDay(D1)]).toBeUndefined();
  });

  it("a refused shard write is not retried — the SDK queue owns delivery", async () => {
    const h = harness();
    note("feedSeen");
    h.failWrites = true;
    h.now = D2;
    await flushPast();
    await vi.runOnlyPendingTimersAsync();
    expect(_engagementForTest().days[utcDay(D1)]).toBeUndefined();
  });
});

describe("sessions (R3/D272)", () => {
  it("a short hide continues the session; a gap starts a new one and settles quiet", () => {
    const h = harness();
    const t = () => _engagementForTest().days[utcDay(h.now)];
    expect(t().r.sessions).toBe(1);

    _engagementForTest().visibility(true); // hide 5 min — same session
    h.now += 5 * 60_000;
    _engagementForTest().visibility(false);
    expect(t().r.sessions).toBe(1);

    _engagementForTest().visibility(true); // hide past the gap
    h.now += SESSION_GAP_MS + 60_000;
    _engagementForTest().visibility(false);
    expect(t().r.sessions).toBe(2);
    // session 1 closed with no answer → quiet, on its own day
    expect(t().r.quiet).toBe(1);

    noteAnswer("daily");
    _engagementForTest().visibility(true);
    h.now += SESSION_GAP_MS + 60_000;
    _engagementForTest().visibility(false);
    expect(t().r.sessions).toBe(3);
    expect(t().r.quiet).toBe(1); // session 2 answered — not quiet
  });

  it("accumulates foreground time visible→hidden and buckets it at flush", async () => {
    const h = harness();
    h.now += 7 * 60_000; // 7 foreground minutes
    _engagementForTest().visibility(true);
    expect(_engagementForTest().days[utcDay(D1)].r.fgMs).toBe(7 * 60_000);
    h.now = D2;
    _engagementForTest().visibility(false);
    await flushPast();
    expect(h.rollups[0].fgMin).toBe(bucketizeMinutes(7));
  });

  it("stamps the session's local daypart and the depth-end bit", async () => {
    const h = harness();
    markDepthEnd();
    const t = _engagementForTest().days[utcDay(D1)];
    expect(t.r.dayparts.reduce((a, b) => a + b, 0)).toBe(1);
    expect(t.r.dayparts[daypartOf(D1)]).toBe(1);
    expect(t.r.depthEnd).toBe(1);
    h.now = D2;
    await flushPast();
    expect(h.rollups[0].depthEnd).toBe(1);
  });
});

describe("the purge listener (D51)", () => {
  it("drops to fresh-boot and does not write the key back", () => {
    harness();
    note("feedPass");
    _engagementForTest().saveNow();
    expect(localStorage.getItem(LS_KEY)).toContain("feedPass");
    localStorage.removeItem(LS_KEY);
    window.dispatchEvent(new Event("insight:local-purge"));
    vi.advanceTimersByTime(5000);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    note("feedSeen");
    _engagementForTest().saveNow();
    expect(localStorage.getItem(LS_KEY)).toContain("feedSeen");
    expect(localStorage.getItem(LS_KEY)).not.toContain("feedPass");
  });
});

describe("buckets", () => {
  it("counts map the ATTENTION.md scale exactly, boundaries included", () => {
    const table: Array<[number, number]> = [
      [0, 0], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [10, 3], [11, 4], [137, 4],
    ];
    for (const [n, b] of table) expect(bucketize(n), `bucketize(${n})`).toBe(b);
  });
  it("minutes map their own scale", () => {
    const table: Array<[number, number]> = [
      [0, 0], [0.9, 0], [1, 1], [4.9, 1], [5, 2], [14, 2], [15, 3], [44, 3], [45, 4], [300, 4],
    ];
    for (const [m, b] of table) expect(bucketizeMinutes(m), `bucketizeMinutes(${m})`).toBe(b);
  });
});

describe("the key list", () => {
  it("is the shard vocabulary the rules arm whitelists — additions land in both or neither", () => {
    // 31 since tabPatterns joined with the D265 remount.
    expect(S_KEYS).toHaveLength(31);
    expect(new Set(S_KEYS).size).toBe(S_KEYS.length);
  });
});
