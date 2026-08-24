// The digest's pass logic, against an injected store (the patterns.test.ts
// precedent). What matters here and is pinned:
//
//   1. Idempotence — a retried schedule re-folds nothing (lastDay), the
//      per-uid state only advances, and a crash-replay recomputes the
//      same day doc (the firstTime guard) rather than double-counting.
//   2. Honest absence — an empty day writes a ZERO doc (folded, nobody
//      came); a cohort whose day was never folded reads `of: null`, not 0.
//   3. The dedup — a same-day edit's second ledger entry collapses to one
//      vote; events still counts both.
//   4. Cohort returns key on firstDay, streaks break only from
//      STREAK_BROKEN_MIN and only on return.
//   5. Surface derivation — bank qids directly, pulse composites by
//      stripping the day suffix, everything unknown as "other", never a
//      guess.
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions", () => ({
  logger: { info() {}, warn() {}, error() {} },
}));

import {
  DIGEST_CATCHUP_DAYS,
  STREAK_BROKEN_MIN,
  dayGap,
  dayOffset,
  runEngagementDigest,
  surfaceOfQid,
  utcDay,
  type DigestEntry,
  type DigestState,
  type EngagementDay,
  type EngagementStore,
} from "./engagement";
import { V2_QUESTIONS } from "./v2content";

const NOW = Date.UTC(2026, 7, 23, 3, 0, 0); // the 02:23 schedule's morning
const Y = utcDay(NOW, -1);

// Every surface is "feed" unless a test says otherwise — the real
// surfaceOfQid is pinned separately, against the compiled bank.
const FEED = () => "feed";

function memoryStore(ledger: Record<string, DigestEntry[]>) {
  const state = {
    lastDay: "",
    users: new Map<string, DigestState>(),
    days: new Map<string, EngagementDay>(),
    putDayCalls: 0,
  };
  const store: EngagementStore = {
    async ledgerDay(day) { return ledger[day] ?? []; },
    async getLastDay() { return state.lastDay; },
    async putLastDay(day) { state.lastDay = day; },
    async getStates(uids) {
      const out = new Map<string, DigestState>();
      for (const uid of uids) { const s = state.users.get(uid); if (s) out.set(uid, { ...s }); }
      return out;
    },
    async putStates(states) { for (const [uid, s] of states) state.users.set(uid, s); },
    async getDay(day) { return state.days.get(day) ?? null; },
    async putDay(doc) { state.days.set(doc.day, doc); state.putDayCalls++; },
  };
  return { store, state };
}

const e = (uid: string, qid: string): DigestEntry => ({ uid, qid });

describe("runEngagementDigest", () => {
  it("folds every owed day up to yesterday, zero docs included", async () => {
    const { store, state } = memoryStore({ [Y]: [e("u1", "q1")] });
    const res = await runEngagementDigest(store, NOW, FEED);
    expect(res.days).toBe(DIGEST_CATCHUP_DAYS);
    expect(state.lastDay).toBe(Y);
    // the six empty catch-up days are folded, not skipped — absent ≠ zero
    const empty = state.days.get(utcDay(NOW, -3))!;
    expect(empty).toMatchObject({ actives: 0, firstTime: 0, votes: 0, events: 0 });
    expect(state.days.get(Y)).toMatchObject({ actives: 1, firstTime: 1, votes: 1 });
  });

  it("re-run is a no-op once yesterday is folded", async () => {
    const { store, state } = memoryStore({ [Y]: [e("u1", "q1")] });
    await runEngagementDigest(store, NOW, FEED);
    const calls = state.putDayCalls;
    const res = await runEngagementDigest(store, NOW, FEED);
    expect(res.days).toBe(0);
    expect(state.putDayCalls).toBe(calls);
  });

  it("dedupes same-day (uid, qid) pairs into one vote and keeps both events", async () => {
    const { store, state } = memoryStore({
      [Y]: [e("u1", "q1"), e("u1", "q1"), e("u1", "q2"), e("u2", "q1")],
    });
    await runEngagementDigest(store, NOW, FEED);
    expect(state.days.get(Y)).toMatchObject({
      actives: 2, votes: 3, events: 4, bySurface: { feed: 3 },
    });
  });

  it("keys cohort returns on firstDay and reads unknown denominators as null", async () => {
    const d1 = dayOffset(Y, -1);
    const { store, state } = memoryStore({
      [d1]: [e("new1", "q1"), e("new2", "q1")], // two first-timers
      [Y]: [e("new1", "q2"), e("old1", "q1")], // one returns next day
    });
    // old1 has history from before the window — firstDay far in the past
    state.users.set("old1", { firstDay: "2026-01-01", lastDay: dayOffset(Y, -3), activeDays: 9, streak: 1 });
    await runEngagementDigest(store, NOW, FEED);
    const doc = state.days.get(Y)!;
    expect(doc.returned.d1).toEqual({ returned: 1, of: 2 });
    // the d7 cohort day sits outside the catch-up window — never folded
    expect(doc.returned.d7).toEqual({ returned: 0, of: null });
    expect(doc.firstTime).toBe(0);
  });

  it("advances the state pair and counts a broken streak only on return, only from the floor", async () => {
    const { store, state } = memoryStore({ [Y]: [e("habit", "q1"), e("dabbler", "q1")] });
    const gone = dayOffset(Y, -3);
    state.users.set("habit", { firstDay: "2026-08-01", lastDay: gone, activeDays: 5, streak: STREAK_BROKEN_MIN });
    state.users.set("dabbler", { firstDay: "2026-08-01", lastDay: gone, activeDays: 2, streak: STREAK_BROKEN_MIN - 1 });
    await runEngagementDigest(store, NOW, FEED);
    expect(state.days.get(Y)!.streaksBroken).toBe(1);
    expect(state.users.get("habit")).toMatchObject({ lastDay: Y, activeDays: 6, streak: 1 });
  });

  it("grows an unbroken streak by one per consecutive day", async () => {
    const d1 = dayOffset(Y, -1);
    const { store, state } = memoryStore({
      [d1]: [e("u1", "q1")],
      [Y]: [e("u1", "q2")],
    });
    await runEngagementDigest(store, NOW, FEED);
    expect(state.users.get("u1")).toMatchObject({ streak: 2, activeDays: 2, firstDay: d1 });
    expect(state.days.get(Y)!.streaksBroken).toBe(0);
  });

  it("recomputes an identical day after a crash between states and lastDay", async () => {
    const ledger = { [Y]: [e("u1", "q1"), e("u2", "q1")] };
    const { store, state } = memoryStore(ledger);
    await runEngagementDigest(store, NOW, FEED);
    const before = state.days.get(Y)!;
    const users = new Map([...state.users].map(([k, v]) => [k, { ...v }]));
    // the crash: states advanced, cursor not — the replay re-folds the day
    state.lastDay = dayOffset(Y, -1);
    await runEngagementDigest(store, NOW, FEED);
    expect(state.days.get(Y)).toMatchObject({
      actives: before.actives,
      firstTime: before.firstTime, // the firstDay === day guard
      votes: before.votes,
    });
    // and the monotonic guard left every state untouched
    expect(state.users).toEqual(users);
  });

  it("bounds the catch-up window", async () => {
    const { store, state } = memoryStore({});
    state.lastDay = utcDay(NOW, -20);
    const res = await runEngagementDigest(store, NOW, FEED);
    expect(res.days).toBe(DIGEST_CATCHUP_DAYS);
    expect(state.days.has(utcDay(NOW, -8))).toBe(false);
    expect(state.days.has(utcDay(NOW, -DIGEST_CATCHUP_DAYS))).toBe(true);
  });

  it("ignores entries with no uid (pre-D28 rows)", async () => {
    const { store, state } = memoryStore({ [Y]: [e("", "q1"), e("u1", "q1")] });
    await runEngagementDigest(store, NOW, FEED);
    expect(state.days.get(Y)).toMatchObject({ actives: 1, votes: 1, events: 2 });
  });
});

describe("surfaceOfQid", () => {
  const daily = V2_QUESTIONS.find((q) => q.surface === "daily")!;
  const pulse = V2_QUESTIONS.find((q) => q.surface === "pulse");

  it("reads bank qids directly", () => {
    expect(surfaceOfQid(daily.id)).toBe("daily");
  });

  it("strips a pulse composite's day suffix", () => {
    if (!pulse) return; // roster is content; absent in a stripped bank
    expect(surfaceOfQid(`${pulse.id}_2026-08-22`)).toBe("pulse");
  });

  it("answers 'other' for anything unknown rather than guessing", () => {
    expect(surfaceOfQid("retired-question-000")).toBe("other");
    expect(surfaceOfQid("retired-question-000_2026-08-22")).toBe("other");
  });
});

describe("day arithmetic", () => {
  it("offsets across month boundaries in UTC", () => {
    expect(dayOffset("2026-08-01", -1)).toBe("2026-07-31");
    expect(dayOffset("2026-08-23", -30)).toBe("2026-07-24");
  });
  it("gaps are whole UTC days", () => {
    expect(dayGap("2026-08-20", "2026-08-23")).toBe(3);
    expect(dayGap("2026-08-22", "2026-08-23")).toBe(1);
  });
});

// ── the attention fold (R2/D270) ────────────────────────────────────────
import {
  BUCKET_MIDPOINTS, SHARD_FOLD_CAP, foldShards, runAttentionFold,
  type AttentionShardDoc, type AttentionStore, type AttnDelta,
} from "./engagement";

function attnStore(shards: AttentionShardDoc[]) {
  const state = {
    shards: [...shards],
    applied: [] as Array<{ day: string; delta: AttnDelta; ids: string[] }>,
    days: new Map<string, { devices: number; s: Record<string, { reach: number; est: number }> }>(),
  };
  const store: AttentionStore = {
    async shardPage(cap) { return state.shards.slice(0, cap); },
    // the memory twin of the batched set-merge + delete: additive, and it
    // removes exactly the ids it was handed
    async applyAttention(day, delta, ids) {
      state.applied.push({ day, delta, ids });
      state.shards = state.shards.filter((s) => !ids.includes(s.id));
      const doc = state.days.get(day) ?? { devices: 0, s: {} };
      doc.devices += delta.devices;
      for (const [k, c] of Object.entries(delta.s)) {
        const cur = doc.s[k] ?? { reach: 0, est: 0 };
        cur.reach += c.reach;
        cur.est += c.est;
        doc.s[k] = cur;
      }
      state.days.set(day, doc);
      await Promise.resolve();
    },
  };
  return { store, state };
}

const sh = (id: string, day: string, s: Record<string, unknown>, rate: unknown = 1): AttentionShardDoc =>
  ({ id, day, rate, s });

describe("foldShards", () => {
  it("sums bucket midpoints into est and devices-that-used into reach", () => {
    const out = foldShards([
      sh("a", "2026-08-22", { feedSeen: 2, opens: 1 }), // 4 + 1.5
      sh("b", "2026-08-22", { feedSeen: 4, lensPeople: 0 }), // 12; zero bucket = no reach
    ]);
    const d = out.get("2026-08-22")!;
    expect(d.devices).toBe(2);
    expect(d.s.feedSeen).toEqual({ reach: 2, est: BUCKET_MIDPOINTS[2] + BUCKET_MIDPOINTS[4] });
    expect(d.s.opens).toEqual({ reach: 1, est: 1.5 });
    expect(d.s.lensPeople).toBeUndefined();
  });

  it("clamps what the rules deliberately left to the reader: garbage buckets, junk rates, junk maps", () => {
    const out = foldShards([
      sh("a", "2026-08-22", { feedSeen: 137, opens: -3, errors: "lots" }, 42), // rate>1 → 1
      sh("b", "2026-08-22", "not a map" as unknown as Record<string, unknown>),
      sh("c", "not-a-day", { feedSeen: 1 }),
    ]);
    const d = out.get("2026-08-22")!;
    expect(d.devices).toBe(2);
    expect(d.s.feedSeen).toEqual({ reach: 1, est: BUCKET_MIDPOINTS[4] }); // 137 → bucket 4
    expect(d.s.opens).toBeUndefined(); // negative → 0
    expect(d.s.errors).toBeUndefined(); // non-number → 0
    expect(out.has("not-a-day")).toBe(false);
  });

  it("scales a sampled shard by 1/rate", () => {
    const out = foldShards([sh("a", "2026-08-22", { feedSeen: 1 }, 0.1)]);
    const d = out.get("2026-08-22")!;
    expect(d.devices).toBe(10);
    expect(d.s.feedSeen).toEqual({ reach: 10, est: 15 }); // 1.5 × 10
  });
});

describe("runAttentionFold", () => {
  it("groups by day and deletes exactly what it folded", async () => {
    const { store, state } = attnStore([
      sh("a", "2026-08-21", { opens: 1 }),
      sh("b", "2026-08-22", { opens: 1 }),
      sh("c", "2026-08-22", { opens: 2 }),
    ]);
    const res = await runAttentionFold(store);
    expect(res).toMatchObject({ shards: 3, days: 2, capped: false });
    expect(state.shards).toHaveLength(0);
    expect(state.days.get("2026-08-22")!.devices).toBe(2);
    expect(state.days.get("2026-08-21")!.s.opens).toEqual({ reach: 1, est: 1.5 });
  });

  it("every applied chunk deletes its own shards — the crash-safe unit is the batch", async () => {
    const many = Array.from({ length: 700 }, (_, i) => sh(`s${i}`, "2026-08-22", { opens: 1 }));
    const { store, state } = attnStore(many);
    await runAttentionFold(store);
    expect(state.applied.map((a) => a.ids.length)).toEqual([300, 300, 100]);
    for (const a of state.applied) {
      // each batch's delta was computed from ITS shards alone, so a crash
      // between batches can never double-count a survivor
      expect(a.delta.devices).toBe(a.ids.length);
    }
    expect(state.days.get("2026-08-22")!.devices).toBe(700);
  });

  it("respects the cap, reports it, and leaves the rest for tomorrow", async () => {
    const many = Array.from({ length: 30 }, (_, i) => sh(`s${i}`, "2026-08-22", { opens: 1 }));
    const { store, state } = attnStore(many);
    const res = await runAttentionFold(store, 10);
    expect(res).toMatchObject({ shards: 10, capped: true });
    expect(state.shards).toHaveLength(20);
  });

  it("a malformed day is skipped, never guessed at, never deleted blind", async () => {
    const { store, state } = attnStore([sh("weird", "yesterday-ish", { opens: 1 })]);
    const res = await runAttentionFold(store);
    expect(res.shards).toBe(1);
    expect(state.applied).toHaveLength(0);
    expect(state.shards).toHaveLength(1);
  });

  it("the cap constant is sane against the batch arithmetic", () => {
    expect(SHARD_FOLD_CAP).toBeGreaterThan(0);
  });
});

// ── the qids map in the shard fold (R4/D271) ────────────────────────────
describe("foldShards · qids", () => {
  it("folds per-question kinds and keeps the overflow cell apart", () => {
    const out = foldShards([
      { id: "a", day: "2026-08-22", rate: 1, s: {},
        qids: { "feed-001": { s: 2, a: 1 }, _other: { s: 4 } } } as AttentionShardDoc & { qids: unknown },
      { id: "b", day: "2026-08-22", rate: 1, s: {},
        qids: { "feed-001": { s: 1, p: 3 } } } as AttentionShardDoc & { qids: unknown },
    ]);
    const d = out.get("2026-08-22")!;
    expect(d.q["feed-001"].s).toEqual({ reach: 2, est: BUCKET_MIDPOINTS[2] + BUCKET_MIDPOINTS[1] });
    expect(d.q["feed-001"].a).toEqual({ reach: 1, est: BUCKET_MIDPOINTS[1] });
    expect(d.q["feed-001"].p).toEqual({ reach: 1, est: BUCKET_MIDPOINTS[3] });
    expect(d.q._other).toBeUndefined();
    expect(d.qOther).toBe(1); // truncation, reported apart, never a phantom qid
  });

  it("clamps garbage kinds and shapes", () => {
    const out = foldShards([
      { id: "a", day: "2026-08-22", rate: 1, s: {},
        qids: { "feed-001": { s: 999, z: 3, a: "lots" }, "feed-002": "junk" } } as AttentionShardDoc & { qids: unknown },
    ]);
    const d = out.get("2026-08-22")!;
    expect(d.q["feed-001"].s).toEqual({ reach: 1, est: BUCKET_MIDPOINTS[4] });
    expect(d.q["feed-001"].z).toBeUndefined();
    expect(d.q["feed-001"].a).toBeUndefined();
    expect(d.q["feed-002"]).toBeUndefined();
  });
});

// ── the rollup fold (R3/D272) ───────────────────────────────────────────
import {
  ROLLUP_FOLD_CAP, advanceFgWindow, foldRollups, runRollupFold,
  type PeopleDelta, type RollupRow, type RollupStore,
} from "./engagement";

function rollupStore(rows: RollupRow[], fg: Record<string, number[]> = {}) {
  const state = {
    rows: [...rows],
    fg: new Map(Object.entries(fg)),
    applied: [] as Array<{ day: string; delta: PeopleDelta; marked: string[] }>,
    days: new Map<string, PeopleDelta>(),
  };
  const store: RollupStore = {
    async rollupPage(cap) { return state.rows.slice(0, cap); },
    async getFgStates(uids) {
      const out = new Map<string, number[]>();
      for (const uid of uids) { const w = state.fg.get(uid); if (w) out.set(uid, w); }
      return out;
    },
    // the memory twin of the batch: increments, marks, windows — atomic
    async applyRollups(day, delta, rows2, fgWindows) {
      state.applied.push({ day, delta, marked: rows2.map((r) => `${r.uid}/${r.day}`) });
      state.rows = state.rows.filter((r) => !rows2.some((m) => m.uid === r.uid && m.day === r.day));
      for (const [uid, w] of fgWindows) state.fg.set(uid, w);
      const doc = state.days.get(day) ?? {
        rollups: 0, sessions: 0, quiet: 0, answers: 0, depthEnd: 0,
        dayparts: [0, 0, 0, 0], fgBuckets: [0, 0, 0, 0, 0], fading: 0,
      };
      doc.rollups += delta.rollups; doc.sessions += delta.sessions;
      doc.quiet += delta.quiet; doc.answers += delta.answers;
      doc.depthEnd += delta.depthEnd; doc.fading += delta.fading;
      for (let i = 0; i < 4; i++) doc.dayparts[i] += delta.dayparts[i];
      for (let i = 0; i < 5; i++) doc.fgBuckets[i] += delta.fgBuckets[i];
      state.days.set(day, doc);
      await Promise.resolve();
    },
  };
  return { store, state };
}

const rr = (uid: string, day: string, over: Partial<RollupRow> = {}): RollupRow => ({
  uid, day, sessions: 2, fgMin: 2, quiet: 1, answers: 3, depthEnd: 0,
  dayparts: [0, 1, 1, 0], ...over,
});

describe("advanceFgWindow", () => {
  it("keeps the last seven and clamps junk", () => {
    const { fg7 } = advanceFgWindow([9, -1, 2, 3, 4, 0, 1], 3);
    expect(fg7).toEqual([0, 2, 3, 4, 0, 1, 3]);
  });
  it("fades only on a sunk window, and only with enough history", () => {
    expect(advanceFgWindow([4, 4, 4, 1, 1], 0).fading).toBe(true); // 6th reading sinks it
    expect(advanceFgWindow([4, 4, 4, 4], 0).fading).toBe(false); // five readings — too soon
    expect(advanceFgWindow([1, 1, 1, 1, 1], 1).fading).toBe(false); // low is not sinking
  });
});

describe("runRollupFold", () => {
  it("folds a day, marks exactly what it folded, and advances the windows", async () => {
    const { store, state } = rollupStore([
      rr("u1", "2026-08-22"), rr("u2", "2026-08-22", { quiet: 0, fgMin: 4 }),
    ]);
    const res = await runRollupFold(store);
    expect(res).toMatchObject({ rollups: 2, days: 1, capped: false });
    expect(state.rows).toHaveLength(0);
    const d = state.days.get("2026-08-22")!;
    expect(d).toMatchObject({ rollups: 2, sessions: 4, quiet: 1, answers: 6 });
    expect(d.fgBuckets[2]).toBe(1);
    expect(d.fgBuckets[4]).toBe(1);
    expect(d.dayparts).toEqual([0, 2, 2, 0]);
    expect(state.fg.get("u1")).toEqual([2]);
  });

  it("counts a fading window into the day it folded on", async () => {
    const { store, state } = rollupStore(
      [rr("sinker", "2026-08-22", { fgMin: 0 })],
      { sinker: [4, 4, 4, 1, 1] },
    );
    await runRollupFold(store);
    expect(state.days.get("2026-08-22")!.fading).toBe(1);
    expect(state.fg.get("sinker")).toEqual([4, 4, 4, 1, 1, 0]);
  });

  it("advances one uid's window in day order across late rollups", async () => {
    const { store, state } = rollupStore([
      rr("u1", "2026-08-22", { fgMin: 3 }),
      rr("u1", "2026-08-20", { fgMin: 1 }),
    ]);
    await runRollupFold(store);
    // oldest day folded first, so the window reads 20th then 22nd
    expect(state.fg.get("u1")).toEqual([1, 3]);
    expect(state.applied.map((a) => a.day)).toEqual(["2026-08-20", "2026-08-22"]);
  });

  it("respects the cap, skips junk rows, and clamps values", async () => {
    const junk = [
      rr("", "2026-08-22"), // no uid — unreachable ref, skipped
      rr("u1", "someday"), // malformed day, skipped
      rr("u2", "2026-08-22", { sessions: 99999, dayparts: "junk" }),
    ];
    const { store, state } = rollupStore(junk);
    const res = await runRollupFold(store, ROLLUP_FOLD_CAP);
    expect(res.rollups).toBe(3); // the page saw them; the fold declined two
    const d = state.days.get("2026-08-22")!;
    expect(d.rollups).toBe(1);
    expect(d.sessions).toBe(300); // clamped to the rules' own bound
    expect(d.dayparts).toEqual([0, 0, 0, 0]);
  });
});
