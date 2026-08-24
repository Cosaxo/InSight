import { afterEach, describe, expect, it, vi } from "vitest";
import { learnCards, publishLearnBank, resetLearnBank, subscribeLearnBank } from "./learnBank";

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

  // The arm that decides what a project seeded before D283 does. Those
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
