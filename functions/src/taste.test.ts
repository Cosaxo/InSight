// Unit tests for the taste fold (taste.ts, D303 phase 1 / D308).
//
// Injected store, hand-built topic map — the patterns.test.ts shape —
// because the fold's promises are about COUNTING, and counting bugs are
// silent: a profile that over- or under-counts still renders, still
// pages, and only shows as a feed that leans slightly wrong. Each
// promise is one case: feed answers count by topic, one per person per
// question per day, other surfaces never enter, the catch-up window
// bounds the scan, and the cursor makes a retry a no-op.

import { describe, expect, it } from "vitest";
import { runTasteFold, type TasteProfile, type TasteStore } from "./taste";

const TOPICS = new Map([
  ["feed-f1", "food"],
  ["feed-f2", "food"],
  ["feed-s1", "sport"],
]);

// 2026-08-26 12:00 UTC — "yesterday" is 2026-08-25.
const NOW = Date.UTC(2026, 7, 26, 12);

interface FakeStore extends TasteStore {
  profiles: Map<string, TasteProfile>;
  lastDay: string;
  ledger: Record<string, Array<{ uid: string; qid: string }>>;
  askedDays: string[];
}

function fakeStore(over: Partial<Pick<FakeStore, "profiles" | "lastDay" | "ledger">> = {}): FakeStore {
  const s: FakeStore = {
    profiles: over.profiles ?? new Map(),
    lastDay: over.lastDay ?? "",
    ledger: over.ledger ?? {},
    askedDays: [],
    ledgerDay(day) {
      s.askedDays.push(day);
      return Promise.resolve(s.ledger[day] ?? []);
    },
    getLastDay: () => Promise.resolve(s.lastDay),
    getProfiles: (uids) =>
      Promise.resolve(new Map(uids.flatMap((u) => {
        const p = s.profiles.get(u);
        return p ? [[u, structuredClone(p)] as [string, TasteProfile]] : [];
      }))),
    putProfiles: (profiles) => {
      for (const [u, p] of profiles) s.profiles.set(u, p);
      return Promise.resolve();
    },
    putLastDay: (day) => {
      s.lastDay = day;
      return Promise.resolve();
    },
  };
  return s;
}

describe("runTasteFold", () => {
  it("counts feed answers by topic, per person", async () => {
    const store = fakeStore({
      lastDay: "2026-08-24",
      ledger: {
        "2026-08-25": [
          { uid: "a", qid: "feed-f1" },
          { uid: "a", qid: "feed-f2" },
          { uid: "a", qid: "feed-s1" },
          { uid: "b", qid: "feed-f1" },
        ],
      },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(store.profiles.get("a")).toEqual({ t: { food: 2, sport: 1 }, n: 3 });
    expect(store.profiles.get("b")).toEqual({ t: { food: 1 }, n: 1 });
    expect(summary).toEqual({ days: 1, counted: 4, people: 2 });
    expect(store.lastDay).toBe("2026-08-25");
  });

  it("counts a person-question pair once per day — a same-day edit is one act of interest", async () => {
    const store = fakeStore({
      lastDay: "2026-08-24",
      ledger: {
        // The create and the D86 edit, byte-identical in the ledger's
        // shape. Read as two, one person's changed mind counts as two
        // acts of interest — the patterns fold's dedupe lesson, at the
        // strength a heuristic needs.
        "2026-08-25": [
          { uid: "a", qid: "feed-f1" },
          { uid: "a", qid: "feed-f1" },
        ],
      },
    });
    await runTasteFold(store, NOW, TOPICS);
    expect(store.profiles.get("a")).toEqual({ t: { food: 1 }, n: 1 });
  });

  it("never counts a qid outside the feed's topic map", async () => {
    const store = fakeStore({
      lastDay: "2026-08-24",
      ledger: {
        "2026-08-25": [
          { uid: "a", qid: "daily-012" },
          { uid: "a", qid: "learn-cell1" },
          { uid: "a", qid: "duel-group-g1" },
        ],
      },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(store.profiles.size).toBe(0);
    expect(summary.counted).toBe(0);
    // The cursor still advances: a day of non-feed answers is a folded
    // day, not a skipped one.
    expect(store.lastDay).toBe("2026-08-25");
  });

  it("accumulates onto an existing profile rather than replacing it", async () => {
    const store = fakeStore({
      lastDay: "2026-08-24",
      profiles: new Map([["a", { t: { food: 5 }, n: 5 }]]),
      ledger: { "2026-08-25": [{ uid: "a", qid: "feed-s1" }] },
    });
    await runTasteFold(store, NOW, TOPICS);
    expect(store.profiles.get("a")).toEqual({ t: { food: 5, sport: 1 }, n: 6 });
  });

  it("catches up the owed days, oldest first, bounded by the window", async () => {
    const store = fakeStore({
      // Never folded: only the last TASTE_CATCHUP_DAYS are owed —
      // 2026-08-19 through 2026-08-25 — and nothing earlier is read.
      lastDay: "",
      ledger: {
        "2026-08-19": [{ uid: "a", qid: "feed-f1" }],
        "2026-08-25": [{ uid: "a", qid: "feed-f2" }],
      },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(store.askedDays[0]).toBe("2026-08-19");
    expect(store.askedDays).toHaveLength(7);
    expect(store.askedDays).not.toContain("2026-08-18");
    expect(summary.days).toBe(7);
    expect(store.profiles.get("a")).toEqual({ t: { food: 2 }, n: 2 });
  });

  it("is a no-op when yesterday is already folded — the retry contract", async () => {
    const store = fakeStore({
      lastDay: "2026-08-25",
      ledger: { "2026-08-25": [{ uid: "a", qid: "feed-f1" }] },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(summary).toEqual({ days: 0, counted: 0, people: 0 });
    expect(store.askedDays).toEqual([]);
    expect(store.profiles.size).toBe(0);
  });
});
