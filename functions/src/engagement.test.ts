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
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ESM: no __dirname. The batch-cap case at the foot of this file reads
// engagement.ts's own source, because the write sites live inside the
// Firestore store, behind an interface every case here replaces.
const here = dirname(fileURLToPath(import.meta.url));

vi.mock("firebase-functions", () => ({
  logger: { info() {}, warn() {}, error() {} },
}));

import {
  DIGEST_CATCHUP_DAYS,
  STREAK_BROKEN_MIN,
  dayGap,
  dayOffset,
  firestoreAttentionStore,
  firestoreEngagementStore,
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
    const d30 = dayOffset(Y, -30);
    const { store, state } = memoryStore({
      [d1]: [e("new1", "q1"), e("new2", "q1")], // two first-timers
      // THREE actives, and the third is the whole point. With only new1
      // (in the d1 cohort) and old1 (in none), the d1 predicate and its
      // NEGATION both select exactly one account, so `=== ` could be
      // inverted with every test green — measured. `mid1` belongs to a
      // different cohort, so the two readings now differ: 1 against 2.
      [Y]: [e("new1", "q2"), e("old1", "q1"), e("mid1", "q1")],
    });
    // old1 has history from before the window — firstDay far in the past
    state.users.set("old1", { firstDay: "2026-01-01", lastDay: dayOffset(Y, -3), activeDays: 9, streak: 1 });
    // mid1 first appeared thirty days ago — the d30 cohort, which nothing
    // asserted at all before.
    state.users.set("mid1", { firstDay: d30, lastDay: d30, activeDays: 1, streak: 1 });
    await runEngagementDigest(store, NOW, FEED);
    const doc = state.days.get(Y)!;
    expect(doc.returned.d1).toEqual({ returned: 1, of: 2 });
    // the d7 cohort day sits outside the catch-up window — never folded
    expect(doc.returned.d7).toEqual({ returned: 0, of: null });
    // …and d30 counts its own returner. Inverting this line publishes the
    // COMPLEMENT of the cohort on a world-readable document — routinely
    // more accounts than the `of` denominator, which reads as a retention
    // rate above 100%.
    expect(doc.returned.d30).toEqual({ returned: 1, of: null });
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

  it("breaks the streak at a gap of exactly two — one missed day", async () => {
    // The boundary, and the case the suite had no instance of: every
    // broken-streak fixture above uses gap 3, where `gap >= 2` and
    // `gap >= 3` agree, so the threshold could be moved up one with the
    // suite green. Gap 2 is a habit user who missed a single day, which is
    // the commonest instance of the churn signal this day document exists
    // to publish — under the mutation that whole population silently stops
    // being counted.
    const { store, state } = memoryStore({ [Y]: [e("habit", "q1")] });
    state.users.set("habit", {
      firstDay: "2026-08-01", lastDay: dayOffset(Y, -2),
      activeDays: 5, streak: STREAK_BROKEN_MIN,
    });
    await runEngagementDigest(store, NOW, FEED);
    expect(state.days.get(Y)!.streaksBroken).toBe(1);
    expect(state.users.get("habit")).toMatchObject({ lastDay: Y, streak: 1 });
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

  // A day doc EXISTING is not a day having been digested. Both other
  // folds create docs — attn-only or people-only — for days this digest
  // has not reached, and those carry no `firstTime`. cohortOf returned it
  // straight, so `undefined` reached returned.dN.of; Firestore refuses
  // undefined as a value, so putDay threw and took the whole nightly run
  // with it — before putLastDay, and before runAttentionFold and
  // runRollupFold, which digestEngagementV2 awaits after it. lastDay
  // never advances, so it repeats identically every night until the
  // poisoned day slides out of the catch-up window.
  it("reads a cohort day that was folded but never digested as null, not undefined", async () => {
    const { store, state } = memoryStore({ [Y]: [e("u1", "q1")] });
    // What runAttentionFold's merge leaves behind for a day the digest has
    // not folded: the key it writes, and none of the digest's own.
    //
    // The d30 cohort day, deliberately — it lies outside the catch-up
    // window, so it is read through getDay rather than found in the
    // this-run cache. A d1 day is re-folded by this very run and answers
    // from `writtenNow` with a real firstTime, which is why it cannot
    // show the bug.
    const cohortDay = new Date(Date.parse(`${Y}T00:00:00Z`) - 30 * 86400000)
      .toISOString().slice(0, 10);
    state.days.set(cohortDay, {
      day: cohortDay,
      attn: { devices: 3 },
    } as unknown as EngagementDay);

    // The memory twin gains Firestore's one relevant refusal, because that
    // is the mechanism: without it the undefined lands silently and the
    // case cannot see the bug it exists for.
    const inner = store.putDay.bind(store);
    store.putDay = async (docToWrite) => {
      const undef = (o: unknown, path: string): string[] => {
        if (o === undefined) return [path];
        if (o && typeof o === "object" && !Array.isArray(o)) {
          return Object.entries(o).flatMap(([k, v]) => undef(v, path ? `${path}.${k}` : k));
        }
        return [];
      };
      const bad = undef(docToWrite, "");
      if (bad.length) throw new Error(`Cannot use "undefined" as a Firestore value (found in field "${bad[0]}")`);
      return inner(docToWrite);
    };

    await runEngagementDigest(store, NOW, FEED);

    expect(state.lastDay, "the digest aborted before putLastDay").toBe(Y);
    expect(state.days.get(Y)!.returned.d30.of).toBeNull();
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
  BUCKET_MIDPOINTS, MIN_SHARD_RATE, QIDS_PER_DAY_CAP, QID_KEY_MAX, SHARD_FOLD_CAP,
  ROLLUP_CHUNK, SHARD_CHUNK,
  foldShards, runAttentionFold,
  type AttentionShardDoc, type AttentionStore, type AttnDelta,
} from "./engagement";

function attnStore(shards: AttentionShardDoc[]) {
  const state = {
    shards: [...shards],
    applied: [] as Array<{ day: string; delta: AttnDelta; ids: string[] }>,
    days: new Map<string, {
      devices: number;
      s: Record<string, { reach: number; est: number }>;
      // The QUESTION keys the document holds, which is what the day cap
      // is about. The fake used to track devices and surfaces only, so a
      // day document could grow without bound here and nothing noticed.
      q: Set<string>;
    }>(),
  };
  const store: AttentionStore = {
    async shardPage(cap) { return state.shards.slice(0, cap); },
    async dayQids(day) { return state.days.get(day)?.q ?? new Set<string>(); },
    // the memory twin of the batched set-merge + delete: additive, and it
    // removes exactly the ids it was handed
    async applyAttention(day, delta, ids) {
      state.applied.push({ day, delta, ids });
      state.shards = state.shards.filter((s) => !ids.includes(s.id));
      const doc = state.days.get(day) ?? { devices: 0, s: {}, q: new Set<string>() };
      for (const qid of Object.keys(delta.q)) doc.q.add(qid);
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

  // The two KEY fences. The rules bound `qids` to 120 entries and cannot
  // go further — rules cannot iterate a map — so a key's length and the
  // union across shards were the fold's to bound, and it bounded neither.
  // Every client-chosen key became a field name on the shared,
  // world-readable day document: seven rules-legal shards of 119
  // 1200-character keys push it past Firestore's 1 MiB entity limit, and
  // then the day can never be written again, the shards are never
  // deleted, and the rollup fold behind the awaited attention fold stops
  // running too. One free account, seven writes, manual recovery only.
  it("refuses a qid key too long to be a question id, and counts it as overflow", () => {
    const q = (qids: Record<string, unknown>): AttentionShardDoc =>
      ({ id: "a", day: "2026-08-22", rate: 1, s: {}, qids } as AttentionShardDoc);
    const long = "x".repeat(QID_KEY_MAX + 1);
    const out = foldShards([q({ "feed-f01": { s: 2 }, [long]: { s: 2 } })]);
    const d = out.get("2026-08-22")!;
    expect(Object.keys(d.q)).toEqual(["feed-f01"]);
    // Reported, not silently dropped — the same cell the client's own cap
    // spills into.
    expect(d.qOther).toBe(1);
    // A key exactly at the bound is a legal id and is kept.
    const ok = foldShards([q({ ["y".repeat(QID_KEY_MAX)]: { s: 2 } })]);
    expect(Object.keys(ok.get("2026-08-22")!.q)).toHaveLength(1);
  });

  it("caps the day's distinct qids and spills the rest, once per shard", () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i < QIDS_PER_DAY_CAP + 50; i++) many[`feed-${i}`] = { s: 2 };
    const out = foldShards([
      { id: "a", day: "2026-08-22", rate: 1, s: {}, qids: many } as AttentionShardDoc,
    ]);
    const d = out.get("2026-08-22")!;
    expect(Object.keys(d.q)).toHaveLength(QIDS_PER_DAY_CAP);
    // ONE device read "…and more", not fifty. Overflow counts per shard,
    // like the client's `_other` cell, or qOther would report a crowd
    // that does not exist.
    expect(d.qOther).toBe(1);
  });

  it("a qid already in the map keeps counting past the cap", () => {
    // Truncating a question halfway through a day would be worse than
    // either fence: its reach would be a fraction of its real one and
    // nothing would say so.
    const first: Record<string, unknown> = {};
    for (let i = 0; i < QIDS_PER_DAY_CAP; i++) first[`feed-${i}`] = { s: 2 };
    const out = foldShards([
      { id: "a", day: "2026-08-22", rate: 1, s: {}, qids: first } as AttentionShardDoc,
      { id: "b", day: "2026-08-22", rate: 1, s: {}, qids: { "feed-0": { s: 2 }, "feed-new": { s: 2 } } } as AttentionShardDoc,
    ]);
    const d = out.get("2026-08-22")!;
    expect(d.q["feed-0"].s!.reach).toBe(2);
    expect(d.q["feed-new"]).toBeUndefined();
    expect(d.qOther).toBe(1);
  });

  it("scales a sampled shard by 1/rate", () => {
    const out = foldShards([sh("a", "2026-08-22", { feedSeen: 1 }, 0.1)]);
    const d = out.get("2026-08-22")!;
    expect(d.devices).toBe(10);
    expect(d.s.feedSeen).toEqual({ reach: 10, est: 15 }); // 1.5 × 10
  });

  it("refuses to believe a rate below the floor — the weight is 1/rate", () => {
    // The hole this closes: the rules bounded `rate` from above only, so
    // `rate: 1e-12` was a legal create and one shard would have added
    // ~1e12 devices, and ~1e12 to a question's seen count, to a
    // world-readable document. The floor is honoured in both places; this
    // is the reader's half.
    const out = foldShards([
      sh("a", "2026-08-22", { feedSeen: 1 }, 1e-12),
      sh("b", "2026-08-22", { feedSeen: 1 }, 0),
      sh("c", "2026-08-22", { feedSeen: 1 }, -0.5),
    ]);
    const d = out.get("2026-08-22")!;
    // One device each, the same answer an absent or junk rate has always
    // had — not a rescale to the floor, which would still believe a
    // liar, only by three orders of magnitude less.
    expect(d.devices).toBe(3);
    expect(d.s.feedSeen).toEqual({ reach: 3, est: 4.5 }); // 1.5 × 3 devices
  });

  it("still honours the smallest rate that is not a lie", () => {
    const out = foldShards([sh("a", "2026-08-22", { feedSeen: 1 }, MIN_SHARD_RATE)]);
    expect(out.get("2026-08-22")!.devices).toBe(1 / MIN_SHARD_RATE);
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

  // THE CAP IS ABOUT THE DAY DOCUMENT, and for a long time it was not.
  // `foldShards` builds one delta per CHUNK of 300 shards, every one of
  // them merged into the same document, and the 1,500 test looked only at
  // the delta in hand — so each chunk started from zero and the document
  // grew without any bound at all. Past ~2,500 keys it exceeds Firestore's
  // 40,000 index entries, the batch fails, the shards are never deleted so
  // they return on every page forever, and the rollup fold awaited after
  // this stops running with it.
  it("refuses a question key that names a prototype member", () => {
    // `delta.q` is a plain object and its keys come from any anonymous
    // device: the rules bound that map by count and never by name. Against
    // the fold as it shipped, one shard carrying `constructor` put
    // `{reach, est}` on the global `Object` — process-wide, outliving the
    // invocation on a warm instance — and the shard's own tally for that
    // key went nowhere.
    const before = JSON.stringify((Object as unknown as Record<string, unknown>).s);
    const out = foldShards([
      { id: "s1", day: "2026-08-22", rate: 1, s: { opens: 1 },
        qids: { constructor: { s: 1 }, "feed-002": { s: 1 } } } as AttentionShardDoc,
    ]);
    const d = out.get("2026-08-22")!;
    expect(Object.keys(d.q), "a prototype name reached the map").toEqual(["feed-002"]);
    expect((Object as unknown as Record<string, unknown>).s, "the global Object was written")
      .toBe(undefined);
    expect(before).toBe(undefined);
    // …and it spills like the other two fences: a refused key is one
    // device reading "…and more", never a silent drop.
    expect(d.qOther).toBeGreaterThan(0);
    // the real question beside it is untouched
    expect(d.q["feed-002"]).toMatchObject({ s: { reach: 1 } });
  });

  it("fences the DAY's question keys, not each chunk's", async () => {
    // Two chunks' worth of shards, each carrying keys nothing else does.
    const cap = QIDS_PER_DAY_CAP;
    const shards: AttentionShardDoc[] = [];
    for (let i = 0; i < 2 * SHARD_CHUNK; i++) {
      const qids: Record<string, unknown> = {};
      for (let k = 0; k < 4; k++) qids[`q-${i}-${k}`] = { s: 1 };
      shards.push({ id: `s${i}`, day: "2026-08-22", rate: 1, s: { opens: 1 }, qids });
    }
    const { store, state } = attnStore(shards);
    await runAttentionFold(store);
    const day = state.days.get("2026-08-22")!;
    expect(day.q.size, "the day document grew past its own cap").toBeLessThanOrEqual(cap);
    // …and the fence did not simply refuse everything: the first chunk's
    // keys are there, and the overflow is counted as "…and more" rather
    // than dropped.
    expect(day.q.size).toBe(cap);
    expect(state.applied.some((a) => a.delta.qOther > 0), "overflow was dropped, not spilled").toBe(true);
  });

  it("carries the fence across NIGHTS, not just across chunks", async () => {
    // The shards are deleted as they fold, so tomorrow starts with an
    // empty page and a full budget while the document keeps everything.
    // Seeding from the document is the only thing that makes the cap true
    // over time.
    const { store, state } = attnStore([]);
    state.days.set("2026-08-22", {
      devices: 0,
      s: {},
      q: new Set(Array.from({ length: QIDS_PER_DAY_CAP }, (_, i) => `old-${i}`)),
    });
    state.shards = [{ id: "s1", day: "2026-08-22", rate: 1, s: { opens: 1 }, qids: { "brand-new": { s: 1 } } }];
    await runAttentionFold(store);
    const day = state.days.get("2026-08-22")!;
    expect(day.q.has("brand-new"), "a full day accepted another key").toBe(false);
    expect(day.q.size).toBe(QIDS_PER_DAY_CAP);
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

  // The cap bounds the NIGHT's work; it must not also be the read size.
  // This read `shardPage(cap)` in one go, so a full night materialised
  // 20,000 shard objects at once — ~1.4 GB measured with rules-legal
  // maximal shards, on a 256 MiB function. And because the fold is the
  // only thing that deletes shards, an OOM here means the backlog never
  // drains: the same failure, identically, every night.
  it("reads in bounded pages rather than materialising the whole cap", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => sh(`s${i}`, "2026-08-22", { opens: 1 }));
    const { store, state } = attnStore(many);
    const asked: number[] = [];
    const inner = store.shardPage.bind(store);
    store.shardPage = async (cap) => { asked.push(cap); return inner(cap); };

    const res = await runAttentionFold(store);

    expect(res).toMatchObject({ shards: 2500, days: 1, capped: false });
    expect(state.shards, "every shard should have been folded and deleted").toHaveLength(0);
    expect(state.days.get("2026-08-22")!.devices).toBe(2500);
    // The property: no single read asks for the whole cap.
    expect(Math.max(...asked)).toBeLessThan(SHARD_FOLD_CAP);
    expect(asked.length, "2500 shards should take several pages").toBeGreaterThan(1);
    // …and the write batches still land on their own boundaries, not on
    // wherever a read page happened to end.
    expect(new Set(state.applied.slice(0, -1).map((a) => a.ids.length))).toEqual(new Set([300]));
  });

  // A shard with an unfoldable day is never deleted, so it is returned by
  // every page. Paging the read has to terminate anyway.
  it("terminates on a full page of unfoldable shards instead of re-reading them forever", async () => {
    const many = Array.from({ length: 1200 }, (_, i) => sh(`w${i}`, "yesterday-ish", { opens: 1 }));
    const { store, state } = attnStore(many);
    let reads = 0;
    const inner = store.shardPage.bind(store);
    store.shardPage = async (cap) => { reads++; return inner(cap); };

    const res = await runAttentionFold(store);

    expect(reads, "a page that folds nothing must end the loop").toBeLessThan(3);
    expect(state.applied).toHaveLength(0);
    expect(state.shards).toHaveLength(1200);
    // Counted by id, so the shards seen twice across pages are not
    // counted twice.
    expect(res.shards).toBeLessThanOrEqual(1200);
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
  ROLLUP_FOLD_CAP, advanceFgWindow, runRollupFold,
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

  it("fades at EXACTLY two buckets down, which is what the rule says", () => {
    // The three cases above all sit well clear of the boundary — the
    // first drops 3.33 buckets — so the `<=` could be narrowed to `<`
    // with the whole suite green. Measured. Buckets are integers 0-4, so
    // an exact two-bucket drop is a common, reachable window, and the
    // docstring defines the rule as "the newest three average two buckets
    // under the window's first three". At `<` the constant 2 quietly
    // means "more than 2" and `fading` — a published per-day count —
    // stops firing for the case the sentence names.
    expect(advanceFgWindow([4, 4, 4, 2, 2], 2).fading).toBe(true);
    // …and a hair under two does not fade, so the bound is pinned from
    // both sides rather than the direction alone. [4,4,4,3,2,2]: the
    // newest three average 2.33, which is 1.67 down, not 2.
    expect(advanceFgWindow([4, 4, 4, 3, 2], 2).fading).toBe(false);
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

describe("the _state document is shared, so the digest must MERGE it", () => {
  // TWO writers, one document. `runEngagementDigest` owns four named
  // fields on v2_users/{uid}/engagement/_state (firstDay, lastDay,
  // activeDays, streak); `runRollupFold` owns a fifth, `fg7` — the
  // trailing seven-day foreground window that R3/D272's fade signal is
  // computed from, and it writes that one with { merge: true }.
  //
  // Both run in the SAME nightly invocation of digestEngagementV2, digest
  // first. A replacing write from the digest therefore deletes fg7 every
  // night, minutes before the fold reads it back: advanceFgWindow gets
  // `undefined`, restarts the window at length 1, and its own rule needs
  // six readings before it will report fading. So the fade signal could
  // never fire — not rarely, never — while the per-uid read and write that
  // compute it were billed every night regardless.
  //
  // Asserted on the ADAPTER, because that is where the bug was and the
  // pure passes above cannot see it: the injected memoryStore models a
  // whole-object replace, which is exactly what the real store was doing.
  // AN EMPTY MAP IS AN INSTRUCTION TO DELETE, and this one erased a day.
  //
  // `applyAttention` writes the day document with { merge: true } and
  // guards `q` and `qOther` as emit-when-set — and wrote `s`
  // unconditionally, one line above both of them. Firestore puts an
  // explicitly-written empty map in the UPDATE MASK (the SDK says so in
  // those words: "Add a field path for an explicitly updated empty map"),
  // so `s: {}` does not merge into the existing counters, it REPLACES
  // them. `v2_engagement_daily/{day}.attn.s` is opens, slow boots,
  // errors, tab and lens visits, answers by surface, reveals, notification
  // opens — and it cannot be recomputed, because the same batch deletes
  // the shards it was folded from.
  //
  // Reachable without an attacker: the client writes `s` unconditionally
  // too (src/v2/data/engagement.ts), and `onHidden()` calls `ensureToday()`
  // without `note()`, so a phone backgrounded just after UTC midnight and
  // not reopened flushes a shard whose `s` is `{}`. A LATE shard — which
  // runAttentionFold's own header calls the normal case — folds on a later
  // night, after the day's real counters are already in the document.
  //
  // ASSERTED ON THE ADAPTER, for the same reason the case below is: the
  // injected fake models applyAttention ADDITIVELY, so an empty delta is a
  // no-op in the fake and a wipe in the real store. That is the gap
  // taste.ts and patterns.ts each carry a written note about.
  it("applyAttention omits an empty s rather than writing it, which would erase the day", async () => {
    type AttnWrite = { day: string; attn: Record<string, unknown> };
    const calls: Array<{ path: string; data: AttnWrite; opts: unknown }> = [];
    const batch = {
      set(ref: { path: string }, data: unknown, opts?: unknown) {
        calls.push({ path: ref.path, data: data as AttnWrite, opts });
      },
      delete() {},
      async commit() {},
    };
    const doc = (path: string) => ({
      path,
      collection: (c: string) => ({ doc: (d: string) => doc(`${path}/${c}/${d}`) }),
    });
    const db = {
      batch: () => batch,
      collection: (c: string) => ({ doc: (d: string) => doc(`${c}/${d}`) }),
    } as unknown as Parameters<typeof firestoreAttentionStore>[0];

    const store = firestoreAttentionStore(db);
    await store.applyAttention("2026-09-05", { devices: 1, s: {}, q: {}, qOther: 0 }, ["shard1"]);

    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toEqual({ merge: true });
    expect(
      Object.prototype.hasOwnProperty.call(calls[0].data.attn, "s"),
      "an empty s was written, which Firestore treats as a delete of the whole map — a day's per-surface counters, unrecoverable",
    ).toBe(false);
    // The control: the rest of the write still happens, so the guard did
    // not simply stop the fold from recording anything.
    expect(calls[0].data.day).toBe("2026-09-05");
    expect(calls[0].data.attn.devices).toBeTruthy();
  });

  it("applyAttention still writes s when there is something in it — the control", async () => {
    type AttnWrite2 = { attn: Record<string, unknown> };
    const calls: Array<{ data: AttnWrite2 }> = [];
    const batch = {
      set(_ref: unknown, data: unknown) { calls.push({ data: data as AttnWrite2 }); },
      delete() {},
      async commit() {},
    };
    const doc = (path: string) => ({ path, collection: (c: string) => ({ doc: (d: string) => doc(`${path}/${c}/${d}`) }) });
    const db = {
      batch: () => batch,
      collection: (c: string) => ({ doc: (d: string) => doc(`${c}/${d}`) }),
    } as unknown as Parameters<typeof firestoreAttentionStore>[0];

    const store = firestoreAttentionStore(db);
    await store.applyAttention("2026-09-05", { devices: 1, s: { opens: 3 }, q: {}, qOther: 0 }, ["shard1"]);
    expect(calls[0].data.attn.s, "the guard removed a real counter map").toBeTruthy();
  });

  it("putStates merges rather than replacing, so fg7 survives the night", async () => {
    const calls: Array<{ path: string; data: unknown; opts: unknown }> = [];
    const batch = {
      set(ref: { path: string }, data: unknown, opts?: unknown) {
        calls.push({ path: ref.path, data, opts });
      },
      async commit() {},
    };
    const doc = (path: string) => ({
      path,
      collection: (c: string) => ({ doc: (d: string) => doc(`${path}/${c}/${d}`) }),
    });
    const db = {
      batch: () => batch,
      collection: (c: string) => ({ doc: (d: string) => doc(`${c}/${d}`) }),
    } as unknown as Parameters<typeof firestoreEngagementStore>[0];

    const store = firestoreEngagementStore(db);
    await store.putStates(new Map<string, DigestState>([
      ["u1", { firstDay: "2026-08-01", lastDay: "2026-08-23", activeDays: 5, streak: 2 }],
    ]));

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("v2_users/u1/engagement/_state");
    expect(
      calls[0].opts,
      "the digest replaced _state instead of merging it, which deletes the fg7 window runRollupFold writes to the same document minutes later",
    ).toEqual({ merge: true });
  });

  // THREE writers, one document — the same shape one level up.
  // v2_engagement_daily/{day} carries the digest's own fields plus two
  // sections it does not own: `attn` (runAttentionFold) and `people`
  // (runRollupFold), both written with { merge: true }.
  //
  // Reachable, and not only by a crash replay: the rules admit an
  // attention shard dated up to two days AHEAD of request.time (clock
  // skew), and the fold takes whatever shards exist for any day. So
  // tonight's fold can create an attn-only doc for tomorrow — and
  // tomorrow's digest, reaching that day for the first time, replaced it.
  // The shards are deleted as they are folded, by the channel's own
  // promise, so what a replacing write drops cannot be recomputed.
  it("putDay merges, so an attn or people section folded earlier survives", async () => {
    const calls: Array<{ path: string; data: unknown; opts: unknown }> = [];
    const db = {
      collection: (c: string) => ({
        doc: (d: string) => ({
          async set(data: unknown, opts?: unknown) { calls.push({ path: `${c}/${d}`, data, opts }); },
        }),
      }),
    } as unknown as Parameters<typeof firestoreEngagementStore>[0];

    const store = firestoreEngagementStore(db);
    await store.putDay({
      day: "2026-08-25", actives: 3, firstTime: 1, votes: 4, events: 5,
      bySurface: { daily: 3 },
      returned: {
        d1: { of: 2, came: 1 }, d7: { of: 0, came: 0 }, d30: { of: 0, came: 0 },
      },
      streaksBroken: 0,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("v2_engagement_daily/2026-08-25");
    expect(
      calls[0].opts,
      "the digest replaced the day doc, which deletes the attn and people sections the other two folds merge into the same document",
    ).toEqual({ merge: true });
  });
});

describe("a _state document is not proof the digest has seen an account", () => {
  // runRollupFold writes `{ fg7 }` with merge onto the SAME document the
  // digest owns, for any account that used the app without answering. So
  // the doc exists while the digest has never folded that uid — and
  // getStates gated on `snap.exists` alone, handing back `firstDay: ""`.
  //
  // An empty firstDay equals no cohort day and never counts as a
  // first-timer, and `""` is copied forward on every later day, so that
  // account could never appear in `firstTime` and never match a d1/d7/d30
  // cohort again. It is exactly the population rung 2 was built to see:
  // people who browse before they commit.
  it("ignores a _state that carries only the rollup window", async () => {
    const snapOf = (data: Record<string, unknown>) => ({
      exists: true,
      get: (k: string) => data[k],
    });
    const db = {
      collection: () => ({
        doc: () => ({ collection: () => ({ doc: () => ({}) }) }),
      }),
      getAll: async () => [
        // the browser: runRollupFold's write, and nothing else
        snapOf({ fg7: [2, 0, 1] }),
        // the control — a real digest state, which must still come back
        snapOf({ firstDay: "2026-08-01", lastDay: "2026-08-20", activeDays: 4, streak: 2 }),
      ],
    } as unknown as Parameters<typeof firestoreEngagementStore>[0];

    const out = await firestoreEngagementStore(db).getStates(["browser", "answerer"]);

    expect(
      out.has("browser"),
      "an fg7-only document was read as digest state, which pins firstDay to \"\" forever",
    ).toBe(false);
    expect(out.get("answerer")).toMatchObject({ firstDay: "2026-08-01", activeDays: 4 });
  });

  it("KEEPS the history of an account the bug already damaged", async () => {
    // The account this whole fix is about does not look like the browser
    // above once it has answered a few times: the old path copied
    // `firstDay: ""` forward while correctly accumulating lastDay,
    // activeDays and streak. A getStates that tests `firstDay` drops all
    // four, and the fold's `!state` branch then re-stamps the account as
    // born today — a forty-day streak reset to one, and `firstTime`
    // inflated by that whole population on the first night after deploy,
    // which is the DENOMINATOR the published d1/d7/d30 curve is read
    // against. `lastDay` is the honest test.
    const snapOf = (data: Record<string, unknown>) => ({ exists: true, get: (k: string) => data[k] });
    const db = {
      collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({}) }) }) }),
      getAll: async () => [
        snapOf({ fg7: [2, 0, 1], firstDay: "", lastDay: "2026-08-20", activeDays: 40, streak: 12 }),
      ],
    } as unknown as Parameters<typeof firestoreEngagementStore>[0];

    const out = await firestoreEngagementStore(db).getStates(["damaged"]);
    expect(out.has("damaged"), "a digested account was dropped for having no cohort day").toBe(true);
    expect(out.get("damaged")).toMatchObject({
      firstDay: "", lastDay: "2026-08-20", activeDays: 40, streak: 12,
    });
  });
});

describe("the cohort day an account never got", () => {
  // The other half of the same fix: getStates hands the fold a state with
  // no `firstDay`, and the fold adopts today as one — counting the account
  // as a first-timer exactly once, and keeping everything else.
  it("adopts today, counts the account once, and keeps its streak", async () => {
    const { store, state } = memoryStore({ [Y]: [e("damaged", "q1")] });
    // The damaged shape, as the old getStates left it: no cohort day, a
    // real record. `lastDay` is the day before Y, so the streak extends.
    state.users.set("damaged", {
      firstDay: "", lastDay: utcDay(NOW, -2), activeDays: 40, streak: 12,
    });
    state.lastDay = utcDay(NOW, -2);
    await runEngagementDigest(store, NOW, FEED);
    const wrote = state.users.get("damaged")!;
    expect(wrote.firstDay, "today was not adopted as the cohort day").toBe(Y);
    expect(wrote.activeDays, "the account's history was discarded").toBe(41);
    expect(wrote.streak, "a live streak was reset").toBe(13);
    expect(
      state.days.get(Y)!.firstTime,
      "the adoption was not counted, or was counted more than once",
    ).toBe(1);
  });
});

describe("the digest's ledger read (D399)", () => {
  // The pager that lived here — projected uid + qid + at, its own page
  // loop, and the "at"-in-the-projection lesson its test carried — is
  // `readLedgerDay` in ledger.ts since D399, where ledger.test.ts pins
  // the projection against the entry type. What the adapter owes now is
  // smaller and worth one case: it hands the day to the reader it was
  // built with, which in production is the night's shared memo.
  it("ledgerDay is the reader the store was built with (D399: one read a night, three folds)", async () => {
    const asked: string[] = [];
    const reader = async (day: string) => { asked.push(day); return [{ uid: "u1", qid: "daily-000" }]; };
    const db = {
      // firestoreEngagementStore takes a metaRef off its first collection
      // before returning; ledgerDay never touches it.
      collection: () => ({ doc: () => ({}) }),
    } as unknown as Parameters<typeof firestoreEngagementStore>[0];
    const rows = await firestoreEngagementStore(db, reader).ledgerDay("2026-08-25");
    expect(asked).toEqual(["2026-08-25"]);
    expect(rows).toEqual([{ uid: "u1", qid: "daily-000" }]);
  });
});

// The 500-op batch cap, held against the two chunk sizes that feed it.
//
// Firestore refuses a batch over 500 writes, and a scheduled function
// that throws at 2am is a silent nightly outage. Both constants carry the
// arithmetic in a comment; only one of them was defended by anything, and
// only by accident — raising SHARD_CHUNK is caught by two cases asserting
// literal chunk SIZES, not the cap, and raising ROLLUP_CHUNK to 400 (801
// ops) left all 462 tests green.
// The two fences on `v2_engagement_daily`, held to the platform limits
// they were chosen for.
//
// WHY THIS EXISTS. `QID_KEY_MAX` is the only thing between one free
// anonymous account and a permanent nightly outage: every key in a
// client-written shard's `qids` map becomes a FIELD NAME on the shared,
// world-readable day document, `firestore.rules` bounds that map by count
// only and says so, and `runAttentionFold` is awaited unguarded — so a day
// document pushed past 1 MiB can never be written again, the offending
// shards are never deleted, and the rollup fold and heartbeat behind it
// stop with it.
//
// It was defended by nothing. Both cases above build their fixtures FROM
// the constant (`"x".repeat(QID_KEY_MAX + 1)`), so they pass at any value:
// measured, 64 -> 1200 left the whole functions suite and every script
// test green, and grep found no other reference in the tree. That is the
// same shape as the batch cap below, whose own header says a scheduled
// function that throws at 2am is a silent nightly outage — this one does
// not even throw.
//
// The numbers are the ones the constant's own comment argues from, and
// they are Firestore's, not ours.
describe("the day document's fences stay under the platform limits", () => {
  const ENTITY_BYTES = 1024 * 1024;      // Firestore's 1 MiB entity limit
  const INDEX_ENTRIES = 40_000;          // …and its per-document index entries
  // One qid holds up to 4 kinds x 2 numbers = 8 leaves, each indexed
  // ascending AND descending.
  const ENTRIES_PER_QID = 8 * 2;

  it("a full day of the longest legal keys stays inside the entity limit", () => {
    // The fence's own claim: "at 64 characters that is also ~225 KB,
    // comfortably inside 1 MiB". Held at a quarter of the limit rather
    // than at the limit, because the keys are not the only thing in the
    // document — the per-day scalars and the `s` map share it.
    const keyBytes = QIDS_PER_DAY_CAP * QID_KEY_MAX;
    expect(keyBytes).toBeLessThanOrEqual(ENTITY_BYTES / 4);
  });

  it("…and inside the index-entry ceiling, which is the binding one", () => {
    // `v2_engagement_daily` carries no field exemptions, so every leaf is
    // indexed both ways. 40,000 / 16 = 2,500 is the ceiling; 1,500 is the
    // fence.
    expect(QIDS_PER_DAY_CAP * ENTRIES_PER_QID).toBeLessThanOrEqual(INDEX_ENTRIES);
  });

  it("the attack the fence was written for cannot reach the limit", () => {
    // Seven rules-legal shards of 119 keys each — the case the constant's
    // comment records as measured on the emulator. At 1200 characters it
    // pushed the document past 1 MiB; the fence has to make that
    // arithmetically impossible, not merely unlikely.
    const RULES_KEYS_PER_SHARD = 120;    // firestore.rules: qids.size() <= 120
    const SHARDS = 7;
    expect(SHARDS * RULES_KEYS_PER_SHARD * QID_KEY_MAX).toBeLessThan(ENTITY_BYTES);
  });

  it("a question id the bank actually ships still fits", () => {
    // The other direction, so the fence cannot be "fixed" by lowering it
    // until it refuses real ids. The longest bank id is 18 characters and
    // a bought question is `paidq-` plus a booking id, ~43.
    expect(QID_KEY_MAX).toBeGreaterThanOrEqual("test-attachment-00".length);
    expect(QID_KEY_MAX).toBeGreaterThanOrEqual("paidq-".length + 36);
  });
});

describe("the batch arithmetic stays under Firestore's 500-op cap", () => {
  const CAP = 500;

  it("applyRollups: 1 day-doc set + one mark and one state per row", () => {
    // `fgWindows.size` equals `rows.length` — one rollup per person per
    // day — so the batch is exactly 2n + 1.
    expect(2 * ROLLUP_CHUNK + 1).toBeLessThanOrEqual(CAP);
  });

  it("the shard fold: 1 day-doc set + one delete per shard", () => {
    expect(1 * SHARD_CHUNK + 1).toBeLessThanOrEqual(CAP);
  });

  it("…and the shape those formulas assume has not changed", () => {
    // An arithmetic pin is only as good as its model of the batch. If a
    // THIRD write per row is added, `2n + 1` quietly stops being the
    // count and this file goes on saying the cap is safe. So the write
    // sites are counted too, off the source.
    const src = readFileSync(resolve(here, "engagement.ts"), "utf8");
    const body = src.slice(
      src.indexOf("async applyRollups("),
      src.indexOf("await batch.commit();", src.indexOf("async applyRollups(")),
    );
    expect(body, "applyRollups moved or was renamed — this case is vacuous").not.toBe("");
    const writes = [...body.matchAll(/batch\.(set|update|delete|create)\(/g)].map((m) => m[1]);
    expect(
      writes,
      "applyRollups' batch gained or lost a write. The 2n + 1 formula above "
      + "is now wrong, and it is the only thing keeping this batch under "
      + "the 500-op cap.",
    ).toEqual(["set", "update", "set"]);
  });
});
