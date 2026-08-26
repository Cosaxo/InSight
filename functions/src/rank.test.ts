// Unit tests for the nightly published serving order (rank.ts, D313).
//
// Everything here runs against the injected store and a hand-built bank —
// the patterns.test.ts shape — because the fold's promises are about
// ORDER, and order bugs are silent in production: a wrong sort serves
// questions, draws no error, and only shows up as a feed that feels off.
// So each promise the module makes is one case here: volume ranks, seq
// breaks ties, landslides sink (and only real ones), the serving window
// and the kill switch hold, and the two surfaces never mix.

import { describe, expect, it } from "vitest";
import type { V2SeedQuestion } from "./v2content";
import {
  RANK_DEAD_MIN,
  computeRank,
  isLandslide,
  runBankRank,
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

  it("does not sink a lopsided split below the volume floor", () => {
    // The floor is the difference between "everyone agrees" and "three
    // people agreed so far": a young question's 3-0 must not read as dead.
    expect(isLandslide(agg(RANK_DEAD_MIN - 1, { "0": RANK_DEAD_MIN - 1 }))).toBe(false);
    expect(isLandslide(agg(RANK_DEAD_MIN, { "0": RANK_DEAD_MIN }))).toBe(true);
    expect(isLandslide(undefined)).toBe(false);
  });

  it("excludes the killed and the out-of-window, both boundaries inclusive", () => {
    const bank = [
      q("feed-live", "feed", "now", 0),
      q("feed-killed", "feed", "now", 1, { active: false }),
      q("feed-closed", "feed", "now", 2, { from: "2026-08-01", until: "2026-08-25" }),
      q("feed-closes-today", "feed", "now", 3, { from: "2026-08-01", until: TODAY }),
      q("feed-future", "feed", "now", 4, { from: "2026-08-27" }),
    ];
    const { feed } = computeRank(bank, new Map(), TODAY);
    expect(feed.topics.now.qids).toEqual(["feed-live", "feed-closes-today"]);
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
      },
      Date.UTC(2026, 7, 26, 12),
      bank,
    );
    // The daily is positional (D313) — its qid must not even be asked for.
    expect(asked).toEqual([["feed-a", "learn-cell1"]]);
    expect(put.map((p) => p.surface).sort()).toEqual(["feed", "learn"]);
    const feed = put.find((p) => p.surface === "feed")!.doc;
    expect(feed.day).toBe("2026-08-26");
    expect(feed.topics.food).toEqual({ qids: ["feed-a"], total: 7 });
    expect(summary).toEqual({ surfaces: 2, topics: 2, ranked: 2 });
  });
});
