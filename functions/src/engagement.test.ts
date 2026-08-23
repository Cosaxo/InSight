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
