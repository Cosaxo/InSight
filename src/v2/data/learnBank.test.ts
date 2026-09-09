import { afterEach, describe, expect, it, vi } from "vitest";
import {
  learnCards, learnFieldTotal, publishLearnBank, publishLearnTotals,
  resetLearnBank, subscribeLearnBank,
} from "./learnBank";

const card = (id: string, f = "cell") => ({
  id, f, q: `Q ${id}`, a: ["A", "B", "C", "D"], c: 0, t: 1, p: 55, k: `k ${id}`,
});

const DEMO = [card("cell1"), card("cell2")];
const LIVE = [card("cell1"), card("cell2"), card("cell3")];

afterEach(() => {
  resetLearnBank();
});

describe("learnCards", () => {
  it("hands back the caller's demo sample until a live build publishes", () => {
    expect(learnCards(DEMO)).toBe(DEMO);
  });

  it("hands back the live bank once published", () => {
    publishLearnBank(LIVE);
    expect(learnCards(DEMO)).toBe(LIVE);
  });

  // The arm that decides what a project seeded before D284 does. Those
  // documents carry no `c`, so `publishLearnBank` drops every one of them
  // and publishes an empty array — and empty must mean EMPTY. `|| demo`
  // would put sixty demo cards on a real device instead, each with no
  // aggregate behind it and a "% got this right" line drawn from nothing.
  it("serves an empty live bank as empty, never as the sample", () => {
    publishLearnBank([]);
    expect(learnCards(DEMO)).toEqual([]);
  });

  it("goes back to the sample on reset", () => {
    publishLearnBank(LIVE);
    resetLearnBank();
    expect(learnCards(DEMO)).toBe(DEMO);
  });
});

describe("subscribeLearnBank", () => {
  // The part testFeed does not need. The feed asks for its pool on every
  // rebuild; the learn engine indexes once at module scope, long before a
  // live boot has fetched anything, so it has to be woken.
  it("tells its listeners when a bank lands", () => {
    const seen: number[] = [];
    const off = subscribeLearnBank(() => seen.push(learnCards(DEMO).length));
    publishLearnBank(LIVE);
    expect(seen).toEqual([3]);
    off();
    publishLearnBank([card("cell9")]);
    expect(seen, "an unsubscribed listener was still called").toEqual([3]);
  });

  it("tells them on reset too, so a fixture can put the sample back", () => {
    const seen: number[] = [];
    publishLearnBank(LIVE);
    subscribeLearnBank(() => seen.push(learnCards(DEMO).length));
    resetLearnBank();
    expect(seen).toEqual([2]);
  });

  it("does not let one throwing listener swallow the change for the others", () => {
    const ok = vi.fn();
    subscribeLearnBank(() => { throw new Error("dead listener"); });
    subscribeLearnBank(ok);
    expect(() => publishLearnBank(LIVE)).not.toThrow();
    expect(ok).toHaveBeenCalled();
  });
});

// The per-field card counts, and what "no order published" has to look
// like to the sheet that draws them.
//
// `pageTotals` builds its map from the published order and returns `{}`
// when there is no order at all — a fresh project, the first night after
// a deploy, a failed fold — and the pager publishes whatever it got. `{}`
// is truthy, so every field answered 0, and the caller's `?? pool.length`
// fallback never fired because `0 ?? x` is 0. Every Learn field sheet read
// "0 cards" while cards were being served: a zero standing in for "no
// data", which is what D1 refuses.
describe("learnFieldTotal", () => {
  afterEach(() => { resetLearnBank(); });

  it("answers null before anything is published", () => {
    expect(learnFieldTotal("cell")).toBeNull();
  });

  it("answers null for an EMPTY map — that is no order, not a bank of nothing", () => {
    publishLearnTotals({});
    expect(
      learnFieldTotal("cell"),
      "an empty totals map answered 0, so the sheet printed \"0 cards\" over a served pool",
    ).toBeNull();
  });

  it("answers null when handed null", () => {
    publishLearnTotals(null);
    expect(learnFieldTotal("cell")).toBeNull();
  });

  it("answers the count for a field the order carries, and 0 for one it does not", () => {
    // 0 is right HERE: an order that exists and does not name a field is
    // a field with no cards, which is a fact rather than an absence.
    publishLearnTotals({ cell: 12 });
    expect(learnFieldTotal("cell")).toBe(12);
    expect(learnFieldTotal("genetics")).toBe(0);
  });

  it("is cleared by the reset the fixtures use", () => {
    publishLearnTotals({ cell: 12 });
    resetLearnBank();
    expect(learnFieldTotal("cell")).toBeNull();
  });
});
