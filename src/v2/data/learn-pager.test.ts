// Unit tests for the learn pager's arithmetic (learnPager.ts, D306).
//
// The paging rules are pure and tested here without any I/O; the wiring
// (fetch shapes, state append, cache persist) is bank-cache.test.ts's,
// which exercises the same functions through a booted live.ts. What this
// file pins is the arithmetic that decides WHAT a device fetches —
// because a wrong need-list is silent in production: too little reads as
// "learn feels thin", too much reads as nothing at all while it quietly
// re-inflates the install fetch the paging exists to remove.

import { describe, expect, it } from "vitest";
import {
  LEARN_PAGE,
  learnNeedList,
  learnTotals,
  topUpLearn,
  type LearnOrderDoc,
} from "./learnPager";

const order = (topics: Record<string, string[]>): LearnOrderDoc => ({
  topics: Object.fromEntries(
    Object.entries(topics).map(([f, qids]) => [f, { qids, total: qids.length }]),
  ),
});

const ids = (field: string, n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => `learn-${field}${from + i}`);

describe("learnNeedList", () => {
  it("takes the first LEARN_PAGE per field the cache does not hold", () => {
    const o = order({ cell: ids("cell", LEARN_PAGE + 10), solar: ids("sol", 3) });
    const need = learnNeedList(o, new Set(), null);
    expect(need).toHaveLength(LEARN_PAGE + 3);
    expect(need.filter((q) => q.startsWith("learn-cell"))).toHaveLength(LEARN_PAGE);
    expect(need.filter((q) => q.startsWith("learn-sol"))).toHaveLength(3);
  });

  it("skips cached qids WITHOUT spending the page on them", () => {
    // The cache is the seen-set: a page is LEARN_PAGE *fresh* cards, so a
    // device that answered the order's head must be handed the next
    // LEARN_PAGE behind it, not a page minus what it has already met.
    const o = order({ cell: ids("cell", LEARN_PAGE * 2) });
    const cached = new Set(ids("cell", 5));
    const need = learnNeedList(o, cached, null);
    expect(need).toHaveLength(LEARN_PAGE);
    expect(need[0]).toBe(`learn-cell5`);
  });

  it("pages only the followed fields when the device narrowed", () => {
    const o = order({ cell: ids("cell", 4), solar: ids("sol", 4) });
    const need = learnNeedList(o, new Set(), ["cell"]);
    expect(need).toEqual(ids("cell", 4));
  });

  it("heals history by id, order or no order, followed or not", () => {
    // A mastered card the cache lost must come back whatever else is
    // true: the map reads mastered cards out of the pool. No order doc
    // (a project the fold never ran on) and a narrowed follow list must
    // not stop the heal.
    const history = ["learn-cap9", "learn-cell0"];
    expect(learnNeedList(null, new Set(), ["cell"], history)).toEqual(history);
    // …and a healed id is not re-listed by its field's page.
    const o = order({ cell: ids("cell", 2) });
    const need = learnNeedList(o, new Set(), null, ["learn-cell0"]);
    expect(need.filter((q) => q === "learn-cell0")).toHaveLength(1);
  });

  it("asks for nothing when the cache already holds the world", () => {
    const o = order({ cell: ids("cell", 3) });
    const cached = new Set([...ids("cell", 3), "learn-cap1"]);
    expect(learnNeedList(o, cached, null, ["learn-cap1"])).toEqual([]);
  });
});

describe("learnTotals", () => {
  it("projects per-field bank counts off the order", () => {
    const o = order({ cell: ids("cell", 7), solar: ids("sol", 2) });
    expect(learnTotals(o)).toEqual({ cell: 7, solar: 2 });
    expect(learnTotals(null)).toEqual({});
  });
});

describe("topUpLearn", () => {
  it("fetches the need and hands back rows and totals", async () => {
    const o = order({ cell: ids("cell", 2) });
    const fetched: string[][] = [];
    const out = await topUpLearn(
      {
        order: () => Promise.resolve(o),
        fetchByIds: (qids) => {
          fetched.push([...qids]);
          return Promise.resolve(qids.map((id) => ({ id })));
        },
      },
      new Set(),
      null,
    );
    expect(fetched).toEqual([[...ids("cell", 2)]]);
    expect(out.rows.map((r) => r.id)).toEqual(ids("cell", 2));
    expect(out.totals).toEqual({ cell: 2 });
  });

  it("never calls fetchByIds for an empty need", async () => {
    // An empty `in` constraint is a Firestore error, not a no-op — the
    // guard is load-bearing, not tidy.
    let called = 0;
    const out = await topUpLearn(
      {
        order: () => Promise.resolve(null),
        fetchByIds: () => {
          called += 1;
          return Promise.resolve([]);
        },
      },
      new Set(),
      null,
    );
    expect(called).toBe(0);
    expect(out.rows).toEqual([]);
  });
});
