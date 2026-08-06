// Unit tests for the pure deck-shaping logic extracted from live.ts.
// Runs in plain node (no browser, no firebase, no mocks): every function
// under test takes explicit inputs.

import { describe, expect, it } from "vitest";
import {
  buildS,
  computeDeckIds,
  countsFor,
  dayIndex,
  dayLabel,
  DECK_DAYS,
  DECK_EPOCH,
  splitBanks,
  duelQFor,
  gHash,
  isTooSmall,
  OPTION_COLORS,
  utcDayIndex,
} from "./deck";
import type { QuestionDoc, VoteContext } from "./deck";

function qd(id: string, over: Partial<QuestionDoc> = {}): QuestionDoc & { id: string } {
  return {
    id,
    surface: "daily",
    seq: 0,
    type: "vote",
    prompt: "Prompt " + id,
    options: ["A", "B", "C"],
    topic: null,
    test: null,
    active: true,
    ...over,
  };
}

const noVote: VoteContext = { agg: undefined, mine: undefined, pending: false };

// 2026-07-15 is a Wednesday (local-time constructor keeps tests
// timezone-agnostic: dayLabel/dayIndex are local-clock functions).
const WED = new Date(2026, 6, 15, 12, 30);

describe("countsFor (own-vote subtraction)", () => {
  const options = ["A", "B", "C"];

  it("subtracts the viewer's own vote once it is folded in (not pending)", () => {
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "0",
      pending: false,
    });
    expect(out).toEqual([4, 2, 0]);
  });

  it("does NOT subtract an optimistic (pending) vote", () => {
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "0",
      pending: true,
    });
    expect(out).toEqual([5, 2, 0]);
  });

  it("never lets a count go below zero", () => {
    const out = countsFor(options, {
      agg: { counts: { "1": 0 } },
      mine: "1",
      pending: false,
    });
    expect(out).toEqual([0, 0, 0]);
  });

  it("only subtracts from the option the viewer chose", () => {
    const out = countsFor(options, {
      agg: { counts: { "0": 3, "1": 3, "2": 3 } },
      mine: "2",
      pending: false,
    });
    expect(out).toEqual([3, 3, 2]);
  });

  it("handles a missing agg and missing counts as all zeros", () => {
    expect(countsFor(options, noVote)).toEqual([0, 0, 0]);
    expect(countsFor(options, { agg: {}, mine: undefined, pending: false })).toEqual([0, 0, 0]);
  });
});

describe("isTooSmall", () => {
  it("defaults to true when the agg doc or flag is missing", () => {
    expect(isTooSmall(undefined)).toBe(true);
    expect(isTooSmall({})).toBe(true);
  });

  it("is true only until the agg explicitly says tooSmall === false", () => {
    expect(isTooSmall({ tooSmall: true })).toBe(true);
    expect(isTooSmall({ tooSmall: false })).toBe(false);
  });
});

describe("buildS", () => {
  it("shapes a question into the UI's S form", () => {
    const q = qd("q1", { topic: "culture", test: "big5" });
    const s = buildS(q, 0, {
      agg: { counts: { "0": 4, "2": 1 }, tooSmall: false },
      mine: "0",
      pending: false,
    }, WED);
    expect(s).toEqual({
      id: "q1",
      cat: "culture",
      text: "Prompt q1",
      dayLabel: "Today",
      options: [
        { id: "0", label: "A", count: 3, color: OPTION_COLORS[0] },
        { id: "1", label: "B", count: 0, color: OPTION_COLORS[1] },
        { id: "2", label: "C", count: 1, color: OPTION_COLORS[2] },
      ],
      comments: [],
      friends: [],
      live: true,
      tooSmall: false,
      test: "big5",
    });
  });

  it("keeps a pending optimistic vote in the counts", () => {
    const q = qd("q1");
    const s = buildS(q, 0, {
      agg: { counts: { "1": 7 } },
      mine: "1",
      pending: true,
    }, WED);
    expect(s.options.map((o) => o.count)).toEqual([0, 7, 0]);
  });

  it("marks tooSmall when the agg is absent", () => {
    const s = buildS(qd("q1"), 0, noVote, WED);
    expect(s.tooSmall).toBe(true);
  });

  it("cycles the option palette past its length", () => {
    const q = qd("q1", { options: ["a", "b", "c", "d", "e", "f", "g"] });
    const s = buildS(q, 0, noVote, WED);
    expect(s.options[5].color).toBe(OPTION_COLORS[0]);
    expect(s.options[6].color).toBe(OPTION_COLORS[1]);
  });

  it("labels cards by how many days back they sit", () => {
    expect(buildS(qd("q"), 1, noVote, WED).dayLabel).toBe("Yesterday");
    expect(buildS(qd("q"), 2, noVote, WED).dayLabel).toBe("Mon");
  });
});

describe("splitBanks (per-surface allowlists)", () => {
  it("a learn card lands in the learn bank and nowhere else (D32 fencing)", () => {
    // A learn card leaking into daily/feed would render as an opinion vote
    // with a secretly right answer; the allowlists make that structurally
    // impossible, and this case is what notices if one of them widens.
    const banks = splitBanks([
      qd("daily-000"),
      qd("feed-f01", { surface: "feed" }),
      qd("test-big5-00", { surface: "test" }),
      qd("group-gu0", { surface: "group" }),
      qd("group-gp0", { surface: "group", type: "pick", topic: "pick", options: [] }),
      qd("duo-000", { surface: "duo" }),
      qd("learn-cell1", { surface: "learn", options: ["a", "b", "c", "d"] }),
      qd("feed-f03", { surface: "feed", type: "rank" }), // D12: never in the live feed
      qd("daily-bad", { options: [] }), // unplayable — dropped
    ]);
    expect(banks.learn.map((x) => x.id)).toEqual(["learn-cell1"]);
    expect(banks.daily.map((x) => x.id)).toEqual(["daily-000"]);
    expect(banks.feed.map((x) => x.id)).toEqual(["feed-f01", "test-big5-00"]);
    expect(banks.duel.map((x) => x.id)).toEqual(["group-gu0", "group-gp0", "duo-000"]);
  });
});

describe("computeDeckIds (deck rotation)", () => {
  const ids = ["q0", "q1", "q2", "q3", "q4"];
  // All cases address days relative to the epoch — the rotation's whole
  // point (D30) is that absolute day numbers never touch the modulus.
  const E = DECK_EPOCH;

  it("wraps negative (today - epoch - back) values back into range", () => {
    // epoch+2 with n=5: backs 3 and 4 go negative and must wrap to 4, 3
    expect(computeDeckIds(ids, E + 2)).toEqual(["q2", "q1", "q0", "q4", "q3"]);
    // the epoch day itself: every back > 0 is negative
    expect(computeDeckIds(["a", "b", "c"], E)).toEqual(["a", "c", "b"]);
  });

  it("cycles with period n", () => {
    expect(computeDeckIds(ids, E + 10 + ids.length)).toEqual(computeDeckIds(ids, E + 10));
    expect(computeDeckIds(ids, E + 11)).not.toEqual(computeDeckIds(ids, E + 10));
  });

  it("is stable for the same day", () => {
    expect(computeDeckIds(ids, E + 123)).toEqual(computeDeckIds(ids, E + 123));
  });

  it("advances one card per day (yesterday's today is today's back-1)", () => {
    const yesterday = computeDeckIds(ids, E + 99);
    const today = computeDeckIds(ids, E + 100);
    expect(today.slice(1)).toEqual(yesterday.slice(0, -1));
  });

  it("growing the bank preserves every already-served day's mapping (D30)", () => {
    // The reseed scenario: 40 days after epoch, the bank grows 65 → 77.
    // Every day already served (0..40 back, well past the 7-day pager)
    // must keep its question; only unserved future days may differ.
    const before = Array.from({ length: 65 }, (_, i) => "daily-" + i);
    const after = before.concat(Array.from({ length: 12 }, (_, i) => "new-" + i));
    const today = E + 40;
    expect(computeDeckIds(after, today, 41)).toEqual(computeDeckIds(before, today, 41));
  });

  it("caps the deck at DECK_DAYS and floors it at the bank size", () => {
    const big = Array.from({ length: 12 }, (_, i) => "q" + i);
    expect(computeDeckIds(big, E + 3)).toHaveLength(DECK_DAYS);
    expect(computeDeckIds(["only", "two"], E + 3)).toEqual(["two", "only"]);
    expect(computeDeckIds([], E + 3)).toEqual([]);
  });
});

describe("duelQFor (duel question rotation)", () => {
  const bank = [
    qd("g0", { surface: "group" }),
    qd("g1", { surface: "group" }),
    qd("g2", { surface: "group" }),
    qd("g3", { surface: "group", topic: "pick" }),
    qd("d0", { surface: "duo" }),
    qd("d1", { surface: "duo" }),
  ];
  const group = { id: "grp_abc", mode: "group" };
  const DAY = 20661; // an arbitrary fixed utc day index

  it("is deterministic for a fixed (group, bank, day)", () => {
    expect(duelQFor(group, bank, DAY)).toEqual(duelQFor(group, bank, DAY));
    // and mirrors the documented formula over the surface-filtered bank
    const groupBank = bank.filter((q) => q.surface === "group");
    const expected = groupBank[(gHash(group.id) + DAY) % groupBank.length];
    expect(duelQFor(group, bank, DAY)!.id).toBe(expected.id);
  });

  it("rotates across days with the bank's period", () => {
    const groupBankLen = bank.filter((q) => q.surface === "group").length;
    const seen = new Set(
      Array.from({ length: groupBankLen }, (_, d) => duelQFor(group, bank, DAY + d)!.id),
    );
    expect(seen.size).toBe(groupBankLen); // each day a different question…
    expect(duelQFor(group, bank, DAY + groupBankLen)!.id)
      .toBe(duelQFor(group, bank, DAY)!.id); // …then the cycle repeats
  });

  it("treats dayOffset exactly like moving the day, including negatives", () => {
    expect(duelQFor(group, bank, DAY, 1)!.id).toBe(duelQFor(group, bank, DAY + 1)!.id);
    // bank.length * 1000 keeps the modulus argument non-negative
    expect(duelQFor(group, bank, DAY, -2)!.id).toBe(duelQFor(group, bank, DAY - 2)!.id);
  });

  it("selects the question from the group id alone — member order is irrelevant", () => {
    const a = { id: "grp_abc", mode: "group", memberUids: ["u1", "u2", "u3"] };
    const b = { id: "grp_abc", mode: "group", memberUids: ["u3", "u1", "u2"] };
    expect(duelQFor(a, bank, DAY)!.id).toBe(duelQFor(b, bank, DAY)!.id);
  });

  it("gives 'pick' questions member names as options, in memberUids order", () => {
    const g = {
      id: "grp_abc",
      mode: "group",
      memberUids: ["u1", "u2", "u3"],
      memberNames: { u1: "Ana", u3: "Cleo" },
    };
    // find the day this group lands on the pick question g3
    let day = DAY;
    while (duelQFor(g, bank, day)!.id !== "g3") day++;
    const q = duelQFor(g, bank, day)!;
    expect(q.kind).toBe("pick");
    expect(q.options).toEqual(["Ana", "Member 2", "Cleo"]); // name fallback
    const reordered = duelQFor({ ...g, memberUids: ["u3", "u2", "u1"] }, bank, day)!;
    expect(reordered.options).toEqual(["Cleo", "Member 2", "Ana"]); // follows uid order
  });

  it("filters the bank by mode ('duo' vs anything else = 'group')", () => {
    const duo = { id: "grp_abc", mode: "duo" };
    expect(duelQFor(duo, bank, DAY)!.id).toMatch(/^d/);
    expect(duelQFor(group, bank, DAY)!.id).toMatch(/^g/);
    expect(duelQFor({ id: "grp_abc" }, bank, DAY)!.id).toMatch(/^g/); // no mode → group
  });

  it("returns null on an empty (or wrong-surface) bank", () => {
    expect(duelQFor(group, [], DAY)).toBeNull();
    expect(duelQFor({ id: "x", mode: "duo" }, [qd("g0", { surface: "group" })], DAY)).toBeNull();
  });

  it("defaults kind to 'classic' when the question has no topic", () => {
    const only = [qd("g0", { surface: "group", topic: null })];
    expect(duelQFor(group, only, DAY)!.kind).toBe("classic");
  });
});

describe("dayLabel", () => {
  it("names today and yesterday specially", () => {
    expect(dayLabel(0, WED)).toBe("Today");
    expect(dayLabel(1, WED)).toBe("Yesterday");
  });

  it("uses the weekday name from 2 days back", () => {
    expect(dayLabel(2, WED)).toBe("Mon"); // Jul 13 2026
    expect(dayLabel(3, WED)).toBe("Sun");
    expect(dayLabel(6, WED)).toBe("Thu"); // Jul 9 2026
  });

  it("crosses month boundaries", () => {
    const wedJul1 = new Date(2026, 6, 1, 9, 0);
    expect(dayLabel(2, wedJul1)).toBe("Mon"); // Jun 29 2026
  });

  it("does not mutate the date it is given", () => {
    const now = new Date(2026, 6, 15);
    const before = now.getTime();
    dayLabel(5, now);
    expect(now.getTime()).toBe(before);
  });
});

describe("day indices and gHash", () => {
  it("utcDayIndex floors ms to whole UTC days", () => {
    expect(utcDayIndex(0)).toBe(0);
    expect(utcDayIndex(86400000 - 1)).toBe(0);
    expect(utcDayIndex(86400000 * 20000 + 123)).toBe(20000);
  });

  it("dayIndex is stable within a local day and steps by 1 across midnight", () => {
    const morning = dayIndex(new Date(2026, 6, 15, 0, 0, 1));
    const night = dayIndex(new Date(2026, 6, 15, 23, 59, 59));
    expect(night).toBe(morning);
    expect(dayIndex(new Date(2026, 6, 16, 0, 0, 1))).toBe(morning + 1);
  });

  it("gHash is deterministic and bounded to [0, 997)", () => {
    expect(gHash("grp_abc")).toBe(gHash("grp_abc"));
    for (const s of ["", "a", "grp_abc", "some-much-longer-group-identifier"]) {
      const h = gHash(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(997);
    }
  });
});

describe("retiring a served question must not re-map the pager", () => {
  // computeDeckIds indexes positionally, so removing any element BELOW the
  // current window shifts every visible day: six answered history cards
  // render as unanswered and today's card silently swaps. The trigger is the
  // intended ops workflow — QUESTION-FARM has the scorecard propose
  // `active: false` for high-volume landslides, i.e. questions already
  // served — so live.ts keeps retired dailies in the array as tombstones and
  // filters them at display instead.
  const bank = (n: number) => Array.from({ length: n }, (_, i) => `daily-${String(i).padStart(3, "0")}`);

  it("keeps every visible day when a retired question is kept as a tombstone", () => {
    const ids = bank(90);
    const today = DECK_EPOCH + 30;
    const before = computeDeckIds(ids, today);
    // Retired in place: the array keeps its length, the element stays.
    const after = computeDeckIds(ids, today);
    expect(after).toEqual(before);
  });

  it("…and REMOVING it instead moves every one of them", () => {
    // The behaviour this replaced, pinned so the reason the tombstone exists
    // cannot be forgotten and the filter quietly moved back.
    const ids = bank(90);
    const today = DECK_EPOCH + 30;
    const before = computeDeckIds(ids, today);
    const pruned = ids.filter((id) => id !== "daily-012");
    const after = computeDeckIds(pruned, today);
    const moved = before.filter((id, i) => after[i] !== id).length;
    expect(moved, "removing an element left the pager unchanged").toBe(before.length);
  });

  it("appending is still safe, which is why D30's invariant missed this", () => {
    const ids = bank(90);
    const today = DECK_EPOCH + 30;
    const before = computeDeckIds(ids, today);
    expect(computeDeckIds([...ids, "daily-090"], today)).toEqual(before);
  });
});
