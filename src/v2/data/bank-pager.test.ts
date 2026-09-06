// Unit tests for the bank pager's arithmetic (bankPager.ts — D320 for
// learn, D321 for the feed tail).
//
// The paging rules are pure and tested here without any I/O; the wiring
// (fetch shapes, state append, cache persist) is bank-cache.test.ts's,
// which exercises the same functions through a booted live.ts. What this
// file pins is the arithmetic that decides WHAT a device fetches —
// because a wrong need-list is silent in production: too little reads as
// "learn feels thin", too much reads as nothing at all while it quietly
// re-inflates the install fetch the paging exists to remove.

import { afterEach, describe, expect, it } from "vitest";
import {
  FEED_PAGE,
  LEARN_PAGE,
  TASTE_MIN_TOTAL,
  TASTE_TOPIC_MIN,
  pageNeedList,
  pageSizesByInterest,
  feedTopicTotal,
  pageTotals,
  publishFeedTotals,
  resetFeedTotals,
  topUpPages,
  type PageOrderDoc,
} from "./bankPager";

const order = (topics: Record<string, string[]>): PageOrderDoc => ({
  topics: Object.fromEntries(
    Object.entries(topics).map(([f, qids]) => [f, { qids, total: qids.length }]),
  ),
});

const ids = (field: string, n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => `learn-${field}${from + i}`);

describe("pageNeedList", () => {
  it("takes the first LEARN_PAGE per field the cache does not hold", () => {
    const o = order({ cell: ids("cell", LEARN_PAGE + 10), solar: ids("sol", 3) });
    const need = pageNeedList(o, new Set(), null, [], LEARN_PAGE);
    expect(need).toHaveLength(LEARN_PAGE + 3);
    expect(need.filter((q) => q.startsWith("learn-cell"))).toHaveLength(LEARN_PAGE);
    expect(need.filter((q) => q.startsWith("learn-sol"))).toHaveLength(3);
  });

  it("skips cached qids WITHOUT spending the page on them", () => {
    // The cache is the seen-set: a page is LEARN_PAGE *fresh* cards, so a
    // device that ANSWERED the order's head must be handed the next
    // LEARN_PAGE behind it, not a page minus what it has already met.
    // (Answered — in the history — is the case; a card held UNANSWERED is
    // runway, and the case below is about that.)
    const o = order({ cell: ids("cell", LEARN_PAGE * 2) });
    const cached = new Set(ids("cell", 5));
    const need = pageNeedList(o, cached, null, ids("cell", 5), LEARN_PAGE);
    expect(need).toHaveLength(LEARN_PAGE);
    expect(need[0]).toBe(`learn-cell5`);
  });

  it("fills a topic TO a page, not BY a page: cards held unanswered are runway the boot does not re-buy (D389)", () => {
    // The accumulation D350 named: a boot that took a fresh page whatever
    // the device already held unanswered handed a daily booter a page per
    // topic per day. `held` is what is in memory and unanswered; the boot
    // tops it up to the page and no further.
    const o = order({ cell: ids("cell", LEARN_PAGE * 3), solar: ids("sol", LEARN_PAGE) });
    const cached = new Set([...ids("cell", 5), ...ids("sol", LEARN_PAGE)]);
    // five held unanswered in cell, a whole page held in solar
    const held = new Set([...ids("cell", 5), ...ids("sol", LEARN_PAGE)]);
    const need = pageNeedList(o, cached, null, [], LEARN_PAGE, held);
    expect(need.filter((q) => q.startsWith("learn-cell"))).toHaveLength(LEARN_PAGE - 5);
    expect(need[0]).toBe("learn-cell5");
    expect(need.filter((q) => q.startsWith("learn-sol"))).toHaveLength(0);
    // …and a held card the order no longer places is not runway: the
    // order dropped it, so the order will never serve it.
    const stale = new Set([...held, "learn-gone1", "learn-gone2"]);
    expect(pageNeedList(o, cached, null, [], LEARN_PAGE, stale)).toEqual(need);
    // held over the page (an order that shrank its page) asks for nothing
    const over = new Set(ids("cell", LEARN_PAGE + 3));
    expect(pageNeedList(o, new Set(over), null, [], LEARN_PAGE, over).filter((q) => q.startsWith("learn-cell"))).toEqual([]);
  });

  it("pages only the followed fields when the device narrowed", () => {
    const o = order({ cell: ids("cell", 4), solar: ids("sol", 4) });
    const need = pageNeedList(o, new Set(), ["cell"], [], LEARN_PAGE);
    expect(need).toEqual(ids("cell", 4));
  });

  it("heals history by id, order or no order, followed or not", () => {
    // A mastered card the cache lost must come back whatever else is
    // true: the map reads mastered cards out of the pool. No order doc
    // (a project the fold never ran on) and a narrowed follow list must
    // not stop the heal.
    const history = ["learn-cap9", "learn-cell0"];
    expect(pageNeedList(null, new Set(), ["cell"], history, LEARN_PAGE)).toEqual(history);
    // …and a healed id is not re-listed by its field's page.
    const o = order({ cell: ids("cell", 2) });
    const need = pageNeedList(o, new Set(), null, ["learn-cell0"], LEARN_PAGE);
    expect(need.filter((q) => q === "learn-cell0")).toHaveLength(1);
  });

  it("asks for nothing when the cache already holds the world", () => {
    const o = order({ cell: ids("cell", 3) });
    const cached = new Set([...ids("cell", 3), "learn-cap1"]);
    expect(pageNeedList(o, cached, null, ["learn-cap1"], LEARN_PAGE)).toEqual([]);
  });
});

describe("pageSizesByInterest", () => {
  const profile = (t: Record<string, number>) => ({
    t,
    n: Object.values(t).reduce((a, b) => a + b, 0),
  });

  it("keeps the flat page for a missing or under-floor profile", () => {
    // A new device's feed must be identical to the pre-profile feed —
    // three answers "knowing" you is the over-eager personalization the
    // floor refuses.
    expect(pageSizesByInterest(null, FEED_PAGE)).toBe(FEED_PAGE);
    expect(pageSizesByInterest(profile({ food: TASTE_MIN_TOTAL - 1 }), FEED_PAGE)).toBe(FEED_PAGE);
  });

  it("gives answered topics the full page and cold topics a smaller, never-zero one", () => {
    const sizes = pageSizesByInterest(
      profile({ food: 9, sport: TASTE_TOPIC_MIN, music: 1 }),
      FEED_PAGE,
    );
    expect(typeof sizes).toBe("function");
    const f = sizes as (t: string) => number;
    expect(f("food")).toBe(FEED_PAGE);
    expect(f("sport")).toBe(FEED_PAGE);
    // Under the per-topic floor, and never seen at all, both read as
    // cold — smaller but NEVER zero (D96: every topic stays on, and a
    // cold topic must stay discoverable or the profile can never grow).
    expect(f("music")).toBeGreaterThan(0);
    expect(f("music")).toBeLessThan(FEED_PAGE);
    expect(f("never-answered")).toBe(f("music"));
  });

  it("feeds pageNeedList per topic", () => {
    const o = order({ hot: ids("hot", FEED_PAGE * 2), cold: ids("cold", FEED_PAGE * 2) });
    const sizes = pageSizesByInterest(profile({ hot: 20 }), FEED_PAGE) as (t: string) => number;
    const need = pageNeedList(o, new Set(), null, [], sizes);
    expect(need.filter((q) => q.startsWith("learn-hot"))).toHaveLength(FEED_PAGE);
    expect(need.filter((q) => q.startsWith("learn-cold"))).toHaveLength(sizes("cold"));
  });
});

describe("pageTotals", () => {
  it("projects per-field bank counts off the order", () => {
    const o = order({ cell: ids("cell", 7), solar: ids("sol", 2) });
    expect(pageTotals(o)).toEqual({ cell: 7, solar: 2 });
    expect(pageTotals(null)).toEqual({});
  });

  it("takes the fold's membership count over the home list where it has one", () => {
    // `qids` is home placement — what to page. The sheets count what a
    // shelf CARRIES, which on the feed is larger by every straddler, and
    // the client cannot compute the difference from its own pool. So a
    // published `carry` wins outright; reading `qids.length` here would
    // put the straddler under-count straight back.
    const o = order({ tech: ids("tech", 19) });
    o.topics.tech.carry = 24;
    expect(pageTotals(o)).toEqual({ tech: 24 });
  });

  it("falls back to the home list for an order published before carry existed", () => {
    const o = order({ cell: ids("cell", 7) });
    delete o.topics.cell.carry;
    expect(pageTotals(o)).toEqual({ cell: 7 });
  });

  it("keeps a carry of zero, which is a shelf with nothing on it", () => {
    // Not `carry || qids.length`: a topic whose questions were all killed
    // carries none, and falling through to a stale home list would
    // advertise a room the fold has just emptied.
    const o = order({ places: ids("pl", 3) });
    o.topics.places.carry = 0;
    expect(pageTotals(o)).toEqual({ places: 0 });
  });
});

describe("feedTopicTotal", () => {
  afterEach(() => { resetFeedTotals(); });

  it("is null until a live build publishes, so the caller counts its pool", () => {
    expect(feedTopicTotal("food")).toBeNull();
  });

  it("answers zero for a topic the published order does not carry", () => {
    // Distinct from the null above, and the distinction is the whole
    // point: no order means "ask the pool", a published order that omits
    // a topic means "the bank has none" — a room not to advertise.
    publishFeedTotals({ food: 26 });
    expect(feedTopicTotal("food")).toBe(26);
    expect(feedTopicTotal("places")).toBe(0);
  });

  it("treats an empty map as NO ORDER rather than a bank of nothing", () => {
    // pageTotals returns {} when no order loaded, the pager publishes
    // unconditionally, and `{}` is truthy — the exact shape that once made
    // every Learn field sheet read "0 cards" while cards were served.
    publishFeedTotals({});
    expect(feedTopicTotal("food")).toBeNull();
    publishFeedTotals(null);
    expect(feedTopicTotal("food")).toBeNull();
  });
});

describe("topUpPages", () => {
  it("fetches the need and hands back rows and totals", async () => {
    const o = order({ cell: ids("cell", 2) });
    const fetched: string[][] = [];
    const out = await topUpPages(
      {
        order: () => Promise.resolve(o),
        fetchByIds: (qids) => {
          fetched.push([...qids]);
          return Promise.resolve(qids.map((id) => ({ id })));
        },
      },
      new Set(),
      null,
      [],
      LEARN_PAGE,
    );
    expect(fetched).toEqual([[...ids("cell", 2)]]);
    expect(out.rows.map((r) => r.id)).toEqual(ids("cell", 2));
    expect(out.totals).toEqual({ cell: 2 });
  });

  it("never calls fetchByIds for an empty need", async () => {
    // An empty `in` constraint is a Firestore error, not a no-op — the
    // guard is load-bearing, not tidy.
    let called = 0;
    const out = await topUpPages(
      {
        order: () => Promise.resolve(null),
        fetchByIds: () => {
          called += 1;
          return Promise.resolve([]);
        },
      },
      new Set(),
      null,
      [],
      LEARN_PAGE,
    );
    expect(called).toBe(0);
    expect(out.rows).toEqual([]);
  });
});
