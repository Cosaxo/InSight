// Unit tests for the hot-mode feed ordering (feed-order.ts, D37). The
// properties that matter: partitions are STABLE (the round-robin mix
// survives inside each tier — a reshuffle would defeat the interleave's
// whole point), precedence is fresh → circle-adjacent → rest → answered,
// and the affinity derivation reads only revealed-duel qids.
import { describe, expect, it } from "vitest";
import { affinityFrom, DUEL_CAT, orderFeed, RECENT_N } from "./feed-order";

const card = (id: string, cat?: string) => ({ id, cat });

describe("orderFeed", () => {
  it("partitions fresh → affinity → rest → answered, stably", () => {
    const mixed = [
      card("a", "sport"),
      card("b", "food"), // answered
      card("c", "music"), // fresh
      card("d", "food"), // affinity (food)
      card("e", "tech"),
      card("f", "food"), // affinity, later than d — must stay after d
    ];
    const out = orderFeed(mixed, {
      answered: new Set(["b"]),
      recentIds: new Set(["c"]),
      affinity: new Set(["food"]),
    });
    expect(out.map((q) => q.id)).toEqual(["c", "d", "f", "a", "e", "b"]);
  });

  it("answered wins over fresh and affinity — a card you took never resurfaces above new ones", () => {
    const out = orderFeed([card("x", "food"), card("y")], {
      answered: new Set(["x"]),
      recentIds: new Set(["x"]),
      affinity: new Set(["food"]),
    });
    expect(out.map((q) => q.id)).toEqual(["y", "x"]);
  });

  it("with no signals it is the identity — the round-robin mix unchanged", () => {
    const mixed = [card("a"), card("b"), card("c")];
    const out = orderFeed(mixed, {
      answered: new Set(),
      recentIds: new Set(),
      affinity: new Set(),
    });
    expect(out.map((q) => q.id)).toEqual(["a", "b", "c"]);
  });
});

describe("affinityFrom", () => {
  it("maps revealed duel qids to their authored feed topics", () => {
    const cats = affinityFrom([
      { qid: "group-gd3", day: "2026-08-01" }, // food
      { qid: "duo-007" }, // music
      { qid: "group-nope" }, // unknown qid — ignored
      { day: "2026-07-31" }, // no qid — ignored
    ]);
    expect([...cats].sort()).toEqual(["food", "music"]);
  });

  it("covers every duel question — an untagged duel would silently never boost", () => {
    // 24 group + 20 duo, all tagged in content/duel-questions.json.
    expect(Object.keys(DUEL_CAT)).toHaveLength(44);
  });

  it("exports a small RECENT_N — freshness is a doorway, not a takeover", () => {
    expect(RECENT_N).toBeLessThanOrEqual(12);
  });
});
