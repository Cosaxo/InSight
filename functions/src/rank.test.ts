// Unit tests for the nightly published serving order (rank.ts, D316).
//
// Everything here runs against the injected store and a hand-built bank —
// the patterns.test.ts shape — because the fold's promises are about
// ORDER, and order bugs are silent in production: a wrong sort serves
// questions, draws no error, and only shows up as a feed that feels off.
// So each promise the module makes is one case here: volume ranks, seq
// breaks ties, landslides sink (and only real ones), the serving window
// and the kill switch hold, and the two surfaces never mix.

import { describe, expect, it } from "vitest";
import { V2_QUESTIONS, type V2SeedQuestion } from "./v2content";
import {
  RANK_DEAD_MIN,
  RANK_DEAD_SHARE,
  computeRank,
  dailyShape,
  isLandslide,
  runBankRank,
  type DailyShapeDoc,
  type RankAgg,
  type RankDoc,
  type RankSurface,
} from "./rank";

const q = (
  id: string,
  surface: string,
  topic: string,
  seq: number,
  over: Partial<V2SeedQuestion> = {},
): V2SeedQuestion => ({
  id,
  surface,
  seq,
  type: "vote",
  domain: null,
  prompt: `Prompt ${id}`,
  options: ["A", "B"],
  topic,
  axis: null,
  test: null,
  ...over,
});

const agg = (total: number, counts: Record<string, number>): RankAgg => ({ total, counts });

const TODAY = "2026-08-26";

describe("computeRank", () => {
  it("orders a topic by volume, ties broken by seq", () => {
    const bank = [
      q("feed-a", "feed", "food", 0),
      q("feed-b", "feed", "food", 1),
      q("feed-c", "feed", "food", 2),
    ];
    const aggs = new Map([
      ["feed-b", agg(50, { "0": 30, "1": 20 })],
      ["feed-c", agg(50, { "0": 25, "1": 25 })],
      // feed-a unanswered: no agg doc at all, which is most of a fresh
      // lane's output — it must rank by seq at the tail, not crash.
    ]);
    const { feed } = computeRank(bank, aggs, TODAY);
    expect(feed.topics.food.qids).toEqual(["feed-b", "feed-c", "feed-a"]);
    expect(feed.topics.food.total).toBe(100);
  });

  it("sinks a landslide to the tail of its topic — behind even the unanswered", () => {
    const bank = [
      q("feed-dead", "feed", "food", 0),
      q("feed-live", "feed", "food", 1),
      q("feed-new", "feed", "food", 2),
    ];
    const aggs = new Map([
      // 95% on one option over 100 answers: the scorecard's landslide.
      // Highest volume in the topic, which is exactly why volume alone
      // is not the order — a question everyone answers the same way is
      // done asking.
      ["feed-dead", agg(100, { "0": 95, "1": 5 })],
      ["feed-live", agg(40, { "0": 22, "1": 18 })],
    ]);
    const { feed } = computeRank(bank, aggs, TODAY);
    expect(feed.topics.food.qids).toEqual(["feed-live", "feed-new", "feed-dead"]);
  });

  it("holds the share threshold itself, which nothing else does", () => {
    // RANK_DEAD_SHARE is imported by no other file and by no script, and
    // the suite only constrained it to (0.55, 0.95] — 0.9 could become
    // 0.95 with all 567 tests green. That matters because this number is
    // not free-floating: it is the one an operator compares against the
    // scorecard's landslide, and the two already disagree (see the
    // constant's own docblock). A threshold nothing pins is a threshold
    // that drifts further.
    expect(RANK_DEAD_SHARE).toBe(0.9);
    // …and the boundary it names, from both sides, so the comparison is
    // `>=` rather than `>`.
    expect(isLandslide(agg(100, { "0": 90, "1": 10 }))).toBe(true);
    expect(isLandslide(agg(100, { "0": 89, "1": 11 }))).toBe(false);
  });

  it("does not sink a lopsided split below the volume floor", () => {
    // The floor is the difference between "everyone agrees" and "three
    // people agreed so far": a young question's 3-0 must not read as dead.
    expect(isLandslide(agg(RANK_DEAD_MIN - 1, { "0": RANK_DEAD_MIN - 1 }))).toBe(false);
    expect(isLandslide(agg(RANK_DEAD_MIN, { "0": RANK_DEAD_MIN }))).toBe(true);
    expect(isLandslide(undefined)).toBe(false);
    // THE FLOOR ITSELF, stated relative to nothing. The two lines above
    // both derive their fixtures FROM the constant, so the pin moves with
    // it: measured, 20 -> 2 leaves the whole functions suite green, and at
    // 2 a question with two answers agreeing reads as dead and sinks to
    // the tail of its topic in the published order — which is the exact
    // "three people agreed so far" reading this case exists to prevent.
    // The share half of the same predicate is pinned literally in the case
    // above, under a comment saying a threshold nothing pins is one that
    // drifts. This is the other half.
    expect(RANK_DEAD_MIN,
      "the volume floor moved — re-read rank.ts's reasoning and change this line deliberately").toBe(20);
  });

  it("excludes the killed and the out-of-window, both boundaries inclusive", () => {
    const bank = [
      q("feed-live", "feed", "now", 0),
      q("feed-killed", "feed", "now", 1, { active: false }),
      q("feed-closed", "feed", "now", 2, { from: "2026-08-01", until: "2026-08-25" }),
      q("feed-closes-today", "feed", "now", 3, { from: "2026-08-01", until: TODAY }),
      q("feed-future", "feed", "now", 4, { from: "2026-08-27" }),
      // THE OTHER BOUNDARY, which this case has always been named for and
      // never sent. `until: TODAY` above pins `>=`; nothing pinned `<=`,
      // so it could be narrowed to `<` with the whole suite green —
      // measured. Under that, a question is missing from the published
      // order for the whole of its first day.
      //
      // Who that is: measured on the compiled bank, thirteen feed
      // questions carry `from`, and they are exactly D231's current-events
      // lane. One of them runs for three days, so a third of its life
      // would be spent invisible — silently, because the order publishes
      // fine and simply does not contain it.
      q("feed-opens-today", "feed", "now", 5, { from: TODAY }),
    ];
    const { feed } = computeRank(bank, new Map(), TODAY);
    expect(feed.topics.now.qids).toEqual(["feed-live", "feed-closes-today", "feed-opens-today"]);
  });

  it("keeps surfaces apart and ranks only feed and learn", () => {
    const bank = [
      q("feed-a", "feed", "food", 0),
      q("learn-cell1", "learn", "cell", 0),
      q("daily-001", "daily", "food", 0),
      q("group-g1", "group", "food", 0),
    ];
    const out = computeRank(bank, new Map(), TODAY);
    expect(Object.keys(out).sort()).toEqual(["feed", "learn"]);
    expect(out.feed.topics.food.qids).toEqual(["feed-a"]);
    expect(out.learn.topics.cell.qids).toEqual(["learn-cell1"]);
  });

  it("counts a straddler on every shelf it can be met through, not just its home", () => {
    // The defect this exists for: the topic sheet used to count the
    // device's PAGE, so a fresh install read "Dilemmas · 1 question"
    // over a bank of 26. The count it needs is membership, and `qids`
    // is home placement — so `carry` has to differ from `qids.length`
    // here or the sheet is back to under-reporting straddlers.
    const bank = [
      q("feed-a", "feed", "food", 0),
      q("feed-b", "feed", "food", 1, { also: ["tech"] }),
      q("feed-c", "feed", "tech", 2),
    ];
    const feed = computeRank(bank, new Map(), TODAY).feed;
    expect(feed.topics.food.qids).toEqual(["feed-a", "feed-b"]);
    expect(feed.topics.food.carry).toBe(2);
    // tech pages one and carries two — the number the sheet draws.
    expect(feed.topics.tech.qids).toEqual(["feed-c"]);
    expect(feed.topics.tech.carry).toBe(2);
  });

  it("gives an also-only topic an entry that pages nothing and counts honestly", () => {
    // No question calls `movies` home, so the home walk never makes it a
    // key — and a reader who filters on membership can still meet one
    // there. An absent key would draw the shelf as empty.
    const bank = [q("feed-a", "feed", "food", 0, { also: ["movies"] })];
    const feed = computeRank(bank, new Map(), TODAY).feed;
    expect(feed.topics.movies).toEqual({ qids: [], total: 0, carry: 1 });
  });

  it("does not double-count a question that names its own home in also", () => {
    const bank = [q("feed-a", "feed", "food", 0, { also: ["food", "tech"] })];
    const feed = computeRank(bank, new Map(), TODAY).feed;
    expect(feed.topics.food.carry).toBe(1);
    expect(feed.topics.tech.carry).toBe(1);
  });

  it("counts carry over the SERVED roster — a killed or out-of-window question is on no shelf", () => {
    const bank = [
      q("feed-live", "feed", "food", 0, { also: ["tech"] }),
      q("feed-dead", "feed", "food", 1, { active: false, also: ["tech"] }),
      q("feed-later", "feed", "food", 2, { from: "2099-01-01", also: ["tech"] }),
    ];
    const feed = computeRank(bank, new Map(), TODAY).feed;
    expect(feed.topics.food.carry).toBe(1);
    expect(feed.topics.tech.carry).toBe(1);
  });

  it("files a topic-less entry under a name a client can ask for", () => {
    const bank = [q("feed-x", "feed", "food", 0, { topic: null })];
    const { feed } = computeRank(bank, new Map(), TODAY);
    expect(feed.topics.untopiced.qids).toEqual(["feed-x"]);
  });
});

describe("runBankRank", () => {
  it("asks for exactly the ranked surfaces' aggs and publishes one doc per surface", async () => {
    const bank = [
      q("feed-a", "feed", "food", 0),
      q("learn-cell1", "learn", "cell", 0),
      q("daily-001", "daily", "food", 0),
    ];
    const asked: string[][] = [];
    const put: Array<{ surface: RankSurface; doc: RankDoc }> = [];
    const shapes: DailyShapeDoc[] = [];
    const summary = await runBankRank(
      {
        aggsFor: (qids) => {
          asked.push(qids);
          return Promise.resolve(new Map([["feed-a", agg(7, { "0": 4, "1": 3 })]]));
        },
        putOrder: (surface, doc) => {
          put.push({ surface, doc });
          return Promise.resolve();
        },
        putDailyShape: (doc) => {
          shapes.push(doc);
          return Promise.resolve();
        },
      },
      Date.UTC(2026, 7, 26, 12),
      bank,
    );
    // The daily is positional (D316) — its qid must not even be asked for.
    expect(asked).toEqual([["feed-a", "learn-cell1"]]);
    expect(put.map((p) => p.surface).sort()).toEqual(["feed", "learn"]);
    const feed = put.find((p) => p.surface === "feed")!.doc;
    expect(feed.day).toBe("2026-08-26");
    expect(feed.topics.food).toEqual({ qids: ["feed-a"], total: 7, carry: 1 });
    expect(summary).toEqual({ surfaces: 2, topics: 2, ranked: 2, dailyN: 1 });
    // The daily's SHAPE does ride the same run (D371) — a length, never an
    // order, and still without asking for its aggregate above.
    expect(shapes).toEqual([{ n: 1, maxSeq: 0, rates: {} }]);
  });

  describe("dailyShape (D371)", () => {
    const dq = (over: Partial<V2SeedQuestion>): V2SeedQuestion => ({
      id: "x", surface: "daily", seq: 0, type: "binary", domain: null,
      prompt: "p", options: ["a", "b"], topic: null, axis: null, test: null,
      ...over,
    });

    it("counts the daily bank the way splitBanks does, and reports the max seq", () => {
      expect(dailyShape([
        dq({ id: "daily-000", seq: 0 }),
        dq({ id: "daily-001", seq: 1 }),
        dq({ id: "feed-000", surface: "feed", seq: 0 }),
      ])).toEqual({ n: 2, maxSeq: 1, rates: {} });
    });

    it("KEEPS retired dailies, because the positions around them must not move", () => {
      // The tombstone rule (live.ts): a daily that drops out of the count
      // shifts every visible day for every device. `active: false` is a
      // display decision, never a bank one.
      expect(dailyShape([
        dq({ id: "daily-000", seq: 0 }),
        dq({ id: "daily-001", seq: 1, active: false }),
        dq({ id: "daily-002", seq: 2 }),
      ])).toEqual({ n: 3, maxSeq: 2, rates: {} });
    });

    it("drops unplayable docs, which is what makes n disagree with maxSeq", () => {
      // A console-edited doc with no options is dropped by splitBanks, so
      // the client's n is 2 while the seq space still reaches 2. The
      // mismatch is exactly the signal the device checks before trusting
      // seq as a position — it must be reported, not smoothed over.
      const shape = dailyShape([
        dq({ id: "daily-000", seq: 0 }),
        dq({ id: "daily-001", seq: 1, options: [] }),
        dq({ id: "daily-002", seq: 2 }),
      ]);
      expect(shape).toEqual({ n: 2, maxSeq: 2, rates: {} });
      expect(shape.maxSeq).not.toBe(shape.n - 1);
    });

    it("collects the Scores pool per scope, in seq order, active only (D372)", () => {
      const shape = dailyShape([
        dq({ id: "daily-000", seq: 0, type: "rating", rates: "city" }),
        dq({ id: "daily-001", seq: 1, type: "rating", rates: "world" }),
        // Retired: the lens must not offer it, and the fold is where that
        // is cheapest to decide.
        dq({ id: "daily-002", seq: 2, type: "rating", rates: "city", active: false }),
        // A rating that names no place — 5 of them in the shipped bank —
        // rates nothing and belongs to no scope.
        dq({ id: "daily-003", seq: 3, type: "rating" }),
        // Not a rating at all.
        dq({ id: "daily-004", seq: 4, type: "binary", rates: "city" }),
        dq({ id: "daily-005", seq: 5, type: "rating", rates: "city" }),
      ]);
      expect(shape.rates).toEqual({
        city: ["daily-000", "daily-005"],
        world: ["daily-001"],
      });
    });

    it("the shipped bank's pool matches the lens's own predicate", () => {
      // The count the device would draw from, against the bank as shipped
      // — the number D371 left as the linear term this record removes.
      const { rates } = dailyShape(V2_QUESTIONS);
      const total = Object.values(rates).reduce((n, ids) => n + ids.length, 0);
      expect(total).toBeGreaterThan(0);
      for (const ids of Object.values(rates)) {
        expect(new Set(ids).size, "a question is in a scope twice").toBe(ids.length);
      }
      // Every id is a real daily in the same bank — a pool naming a
      // question that does not exist would spend a read per boot forever.
      const ids = new Set(V2_QUESTIONS.map((q) => q.id));
      for (const list of Object.values(rates)) {
        for (const id of list) expect(ids.has(id), `${id} is not in the bank`).toBe(true);
      }
    });

    it("is dense on the shipped bank, which is the fast path's precondition", () => {
      const shape = dailyShape(V2_QUESTIONS);
      expect(shape.n).toBeGreaterThan(0);
      expect(shape.maxSeq).toBe(shape.n - 1);
    });
  });
});
