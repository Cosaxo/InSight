// Unit tests for the taste fold (taste.ts, D317 phase 1 / D322).
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
  ledger: Record<string, Array<{ uid: string; qid: string; fromIdx?: number }>>;
  askedDays: string[];
  /** Make the next cursor write throw — the crash this fold has to survive. */
  breakCursorOnce: boolean;
}

function fakeStore(over: Partial<Pick<FakeStore, "profiles" | "lastDay" | "ledger">> = {}): FakeStore {
  const s: FakeStore = {
    profiles: over.profiles ?? new Map(),
    lastDay: over.lastDay ?? "",
    ledger: over.ledger ?? {},
    askedDays: [],
    breakCursorOnce: false,
    ledgerDay(day) {
      s.askedDays.push(day);
      return Promise.resolve(s.ledger[day] ?? []);
    },
    getLastDay: () => Promise.resolve(s.lastDay),
    // PROJECTED, field by field, exactly as firestoreTasteStore does.
    //
    // This fake used to hand the whole object back and store the whole
    // object — so a field the REAL store drops on the way out or in
    // round-tripped here for free. That is how the retry guard shipped
    // dead: `d` was written by the fold, kept by this map, read back by
    // this map, and named in neither of the real store's projections.
    // A fake that carries more than its subject proves nothing about it.
    getProfiles: (uids) =>
      Promise.resolve(new Map(uids.flatMap((u) => {
        const p = s.profiles.get(u);
        return p
          ? [[u, { t: structuredClone(p.t), n: p.n, ...(p.d ? { d: p.d } : {}) }] as [string, TasteProfile]]
          : [];
      }))),
    putProfiles: (profiles) => {
      for (const [u, p] of profiles) {
        s.profiles.set(u, { t: structuredClone(p.t), n: p.n, ...(p.d ? { d: p.d } : {}) });
      }
      return Promise.resolve();
    },
    putLastDay: (day) => {
      if (s.breakCursorOnce) {
        s.breakCursorOnce = false;
        return Promise.reject(new Error("cursor write lost"));
      }
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
    expect(store.profiles.get("a")).toEqual({ t: { food: 2, sport: 1 }, n: 3, d: "2026-08-25" });
    expect(store.profiles.get("b")).toEqual({ t: { food: 1 }, n: 1, d: "2026-08-25" });
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
    expect(store.profiles.get("a")).toEqual({ t: { food: 1 }, n: 1, d: "2026-08-25" });
  });

  it("an edit made on a LATER day is not a second act of interest", async () => {
    // The within-day set could not see this: an edit has no day window, so
    // changing your mind the next day added a second count to the topic
    // and a person who edited a lot read as a person who cared a lot.
    // `fromIdx` is present only on an edit's ledger entry, which is what
    // makes it visible across days without any per-person state.
    const store = fakeStore({
      lastDay: "2026-08-23",
      ledger: {
        "2026-08-24": [{ uid: "a", qid: "feed-s1" }],
        "2026-08-25": [{ uid: "a", qid: "feed-s1", fromIdx: 0 }],
      },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(summary.counted, "the edit is the same answer, not a second one").toBe(1);
    expect(store.profiles.get("a")!.n).toBe(1);
  });

  it("still counts a first answer on every day it sees one", async () => {
    // The contrast, or the case above would pass on a fold that counted
    // nothing at all across days.
    const store = fakeStore({
      lastDay: "2026-08-23",
      ledger: {
        "2026-08-24": [{ uid: "a", qid: "feed-s1" }],
        "2026-08-25": [{ uid: "a", qid: "feed-f1" }],
      },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(summary.counted).toBe(2);
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
    expect(store.profiles.get("a")).toEqual({ t: { food: 5, sport: 1 }, n: 6, d: "2026-08-25" });
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
    // The stamp names the LAST day folded, not the first.
    expect(store.profiles.get("a")).toEqual({ t: { food: 2 }, n: 2, d: "2026-08-25" });
  });

  // THE RETRY, for real. The case below covers the easy half — nothing
  // owed, nothing read — and the docstring used to claim the hard half
  // too: "the cursor is advanced only after the profiles are written, so
  // a retried schedule re-folds nothing it already committed." Cursor-last
  // is exactly what makes a retry re-fold what WAS committed, because `t`
  // and `n` are accumulators.
  it("a crash between the profiles and the cursor does not count the day twice", async () => {
    const store = fakeStore({
      lastDay: "2026-08-24",
      ledger: { "2026-08-25": [{ uid: "a", qid: "feed-f1" }] },
    });
    store.breakCursorOnce = true;
    await expect(runTasteFold(store, NOW, TOPICS)).rejects.toThrow("cursor write lost");
    // The profile landed; the cursor did not.
    expect(store.profiles.get("a")).toEqual({ t: { food: 1 }, n: 1, d: "2026-08-25" });
    expect(store.lastDay).toBe("2026-08-24");

    // The retry re-reads the same day and must ADD NOTHING.
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(
      store.profiles.get("a"),
      "one answer was folded twice — the profile is an accumulator and the "
      + "day was re-read after a crash that left the cursor behind",
    ).toEqual({ t: { food: 1 }, n: 1, d: "2026-08-25" });
    expect(summary.counted).toBe(0);
    expect(summary.people).toBe(0);
    // …and the cursor catches up, so the day is not re-read forever.
    expect(store.lastDay).toBe("2026-08-25");
  });

  it("folds a person the crashed attempt never reached", async () => {
    // The other half: a partial write. `b` was not stamped, so the retry
    // must fold `b` while leaving `a` alone.
    const store = fakeStore({
      lastDay: "2026-08-24",
      profiles: new Map([["a", { t: { food: 1 }, n: 1, d: "2026-08-25" }]]),
      ledger: {
        "2026-08-25": [
          { uid: "a", qid: "feed-f1" },
          { uid: "b", qid: "feed-f1" },
        ],
      },
    });
    const summary = await runTasteFold(store, NOW, TOPICS);
    expect(store.profiles.get("a")).toEqual({ t: { food: 1 }, n: 1, d: "2026-08-25" });
    expect(store.profiles.get("b")).toEqual({ t: { food: 1 }, n: 1, d: "2026-08-25" });
    expect(summary).toEqual({ days: 1, counted: 1, people: 1 });
  });

  it("a profile written before the stamp existed folds once, not never", async () => {
    // Every profile in production predates `d`. An absent stamp has to
    // mean "fold it" — the old behaviour, once — or the fix would freeze
    // every existing profile at the value it has today.
    const store = fakeStore({
      lastDay: "2026-08-24",
      profiles: new Map([["a", { t: { food: 5 }, n: 5 }]]),
      ledger: { "2026-08-25": [{ uid: "a", qid: "feed-s1" }] },
    });
    await runTasteFold(store, NOW, TOPICS);
    expect(store.profiles.get("a")).toEqual({ t: { food: 5, sport: 1 }, n: 6, d: "2026-08-25" });
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
