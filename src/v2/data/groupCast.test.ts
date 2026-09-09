// groupCast — the Groups stop's folds (D432). Pure arithmetic over reveal
// documents, so every claim the stop prints about a person can be checked
// here against the reveal it came from.
import { describe, expect, it } from "vitest";
import { groupScores, namedCount, roleVotes } from "./groupCast";
import type { BankEntryLike } from "./roles";

const ME = "u_me";
const HEIST = { id: "heist", label: "Bank Heist", hue: 25 };
const ISLAND = { id: "island", label: "Desert Island", hue: 150 };

const bank: Record<string, BankEntryLike> = {
  r1: { kind: "pick", prompt: "Who plans it?", role: { id: "inside", label: "the mastermind", seat: "engine" }, scen: HEIST },
  r2: { kind: "pick", prompt: "Who talks us out?", role: { id: "mouth", label: "the smooth talker", seat: "heart" }, scen: HEIST },
  r3: { kind: "pick", prompt: "Who finds water?", role: { id: "water", label: "the survivor", seat: "hands" }, scen: ISLAND },
  old: { kind: "pick", prompt: "Who'd survive longest?" },
  s1: { kind: "rate", prompt: "This group's energy?", poles: ["Calm", "Chaos"], options: ["Calm", "Mostly calm", "In between", "Mostly chaos", "Chaos"] },
};
const lookup = (qid: string) => bank[qid] || null;

/** A role vote's reveal: who named whom (by pickUid), in that order. */
const vote = (day: string, round: number, qid: string, picks: Record<string, string>, late: string[] = []) => ({
  day, round, qid,
  votes: Object.fromEntries(Object.entries(picks).map(([voter, who]) => [voter, {
    optionIdx: 0, pickUid: who, ...(late.includes(voter) ? { late: true } : {}),
  }])),
});
/** A rating's reveal: who stood on which step. */
const rate = (day: string, round: number, steps: Record<string, number>, late: string[] = []) => ({
  day, round, qid: "s1",
  votes: Object.fromEntries(Object.entries(steps).map(([uid, step]) => [uid, {
    optionIdx: step, ...(late.includes(uid) ? { late: true } : {}),
  }])),
});

describe("roleVotes — who the room named", () => {
  it("keeps the latest vote per role, latest first, with the card's holder", () => {
    const rv = roleVotes([
      vote("2026-09-02", 2, "r2", { [ME]: "a", a: "b" }),          // one each: a tie
      vote("2026-09-01", 1, "r1", { [ME]: "a", a: ME, b: "a" }),
      vote("2026-09-03", 4, "r1", { [ME]: "b", a: "b", b: "b" }),   // the mastermind again: b takes it
    ], lookup, ME);
    expect(rv.roles.map((r) => r.key)).toEqual(["inside", "mouth"]);
    const inside = rv.roles[0];
    expect(inside.holders).toEqual(["b"]);
    expect(inside.votes).toEqual({ b: 3 });
    expect(inside.round).toBe(4);
    expect(inside.mine).toBe("b");
    expect(inside.pack).toEqual(HEIST);
    expect(inside.seat).toBe("engine");
    // a tie shares the role — nobody is "the" holder
    const mouth = rv.roles[1];
    expect(mouth.holders.sort()).toEqual(["a", "b"]);
    expect(mouth.contested).toBe(false);
    expect(mouth.second).toBeNull();
  });

  it("counts a vote for yourself — the card's rule, so the Mirror and the reveal agree", () => {
    // a: 2 (own + b) · ME: 1 — a holds it on the card, so a holds it here
    const rv = roleVotes([vote("2026-09-01", 1, "r1", { [ME]: "a", a: "a", b: ME })], lookup, ME);
    expect(rv.roles[0].holders).toEqual(["a"]);
    expect(rv.roles[0].by).toEqual({ a: [ME, "a"], [ME]: ["b"] });
  });

  it("marks a role contested when a runner-up with two or more is within one vote", () => {
    const rv = roleVotes([vote("2026-09-01", 1, "r1", { [ME]: "a", a: "b", b: "a", c: "b", d: "a" })], lookup, ME);
    // a: 3 · b: 2
    expect(rv.roles[0].holders).toEqual(["a"]);
    expect(rv.roles[0].second).toBe("b");
    expect(rv.roles[0].contested).toBe(true);
    // …but not when the runner-up stands alone (one vote)
    const solo = roleVotes([vote("2026-09-01", 1, "r1", { [ME]: "a", a: "b", b: "a" })], lookup, ME);
    expect(solo.roles[0].contested).toBe(false);
  });

  it("counts no late vote, no vote off the question, and no vote without a snapshot", () => {
    const r = vote("2026-09-01", 1, "r1", { [ME]: "a", a: "b", b: "a", c: "a" }, ["c"]);
    (r.votes as Record<string, { optionIdx: number; pickUid?: string; qid?: string }>).b.qid = "r2"; // b answered a different question
    (r.votes as Record<string, { optionIdx: number; pickUid?: string }>).a.pickUid = "";           // a's client predates the snapshot
    const rv = roleVotes([r], lookup, ME);
    expect(rv.roles[0].votes).toEqual({ a: 1 });
    expect(rv.roles[0].total).toBe(1);
    expect(rv.roles[0].mine).toBe("a");
  });

  it("says nothing of mine when I answered late", () => {
    const rv = roleVotes([vote("2026-09-01", 1, "r1", { [ME]: "a", a: "b", b: "a" }, [ME])], lookup, ME);
    expect(rv.roles[0].mine).toBeNull();
    expect(rv.roles[0].total).toBe(2);
  });

  it("ignores a question the bank cannot name as a role vote, and reads nothing without a bank", () => {
    const hist = [
      vote("2026-09-01", 1, "old", { [ME]: "a", a: "b" }),   // a pick with no role: no row
      vote("2026-09-02", 2, "nope", { [ME]: "a", a: "b" }),  // not in the bank
      vote("2026-09-03", 3, "r3", { [ME]: "a", a: "b" }),
    ];
    expect(roleVotes(hist, lookup, ME).roles.map((r) => r.key)).toEqual(["water"]);
    expect(roleVotes(hist, undefined, ME).roles).toEqual([]);
  });

  it("lists the packs in the order their first row appears", () => {
    const rv = roleVotes([
      vote("2026-09-01", 1, "r1", { [ME]: "a", a: "b" }),
      vote("2026-09-02", 2, "r3", { [ME]: "a", a: "b" }),
      vote("2026-09-03", 3, "r2", { [ME]: "a", a: "b" }),
    ], lookup, ME);
    expect(rv.packs.map((p) => p.id)).toEqual(["heist", "island"]);
  });
});

describe("groupScores — how the group rates itself", () => {
  it("folds the five steps into a mean, a score and the nearest label, you apart from the marks", () => {
    const [s] = groupScores([rate("2026-09-04", 4, { [ME]: 4, a: 2, b: 3, c: 3 })], lookup, ME);
    expect(s.counts).toEqual([0, 0, 1, 2, 1]);
    expect(s.total).toBe(4);
    expect(s.mean).toBe(3);
    expect(s.score).toBe(75);
    expect(s.label).toBe("Mostly chaos");
    expect(s.mine).toBe(4);
    expect(s.marks).toEqual([{ uid: "a", step: 2 }, { uid: "b", step: 3 }, { uid: "c", step: 3 }]);
    expect(s.poles).toEqual(["Calm", "Chaos"]);
    expect(s.round).toBe(4);
  });

  it("keeps the latest answer to a rating asked twice, and leaves a late answer out", () => {
    const rows = groupScores([
      rate("2026-09-08", 8, { [ME]: 0, a: 0 }, [ME]),
      rate("2026-09-04", 4, { [ME]: 4, a: 4 }),
    ], lookup, ME);
    expect(rows).toHaveLength(1);
    expect(rows[0].round).toBe(8);
    expect(rows[0].mine).toBeNull();
    expect(rows[0].total).toBe(1);
    expect(rows[0].score).toBe(0);
  });

  it("is empty for a role vote, an unrated room, and without a bank", () => {
    expect(groupScores([vote("2026-09-01", 1, "r1", { [ME]: "a" })], lookup, ME)).toEqual([]);
    expect(groupScores([], lookup, ME)).toEqual([]);
    expect(groupScores([rate("2026-09-04", 4, { [ME]: 4, a: 4 })], undefined, ME)).toEqual([]);
  });
});

describe("namedCount — the room named you N of M votes", () => {
  it("counts the others' votes only, across every role vote — not just the latest per role", () => {
    const n = namedCount([
      vote("2026-09-01", 1, "r1", { [ME]: "a", a: ME, b: ME }),        // 2 of 2
      vote("2026-09-03", 3, "r1", { [ME]: "b", a: "b", b: "b" }),      // 0 of 2 — the same role, still counted
      vote("2026-09-02", 2, "s1", { [ME]: "a", a: ME }),               // a rating: not a vote on anyone
    ], ME, lookup);
    expect(n).toEqual({ mine: 2, all: 4 });
  });

  it("is zero without a bank or a viewer", () => {
    const hist = [vote("2026-09-01", 1, "r1", { [ME]: "a", a: ME })];
    expect(namedCount(hist, ME, undefined)).toEqual({ mine: 0, all: 0 });
    expect(namedCount(hist, null, lookup)).toEqual({ mine: 0, all: 0 });
  });
});
