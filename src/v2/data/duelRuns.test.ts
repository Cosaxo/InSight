import { describe, expect, it } from "vitest";
import { duoRuns, namedBy, revealTally, roleTally } from "./duelRuns";

const day = (d: string, votes: Record<string, { optionIdx?: number; guessIdx?: number; qid?: string }>, qid = "q1") =>
  ({ day: d, qid, votes });

describe("duoRuns", () => {
  it("scores a guess against what the other actually picked", () => {
    const runs = duoRuns([
      day("2026-08-10", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 0 } }),
    ], "me", "you");
    // I guessed 1, they picked 1 → called it. They guessed 0, I picked 0 → called it.
    expect(runs).toEqual({ read: [true], by: [true] });
  });

  it("sorts a dayless reveal FIRST, which is what the comparator does", () => {
    // The docstring said "last" and the code has always said first:
    // `String(a.day || "")` makes a missing day the empty string, which
    // precedes every date key. No case passed one, so the sentence and
    // the comparator drifted apart unnoticed. This is the pin.
    //
    // It matters at the reading end: the run is drawn oldest-LEFT, and a
    // dayless reveal is the live listener's copy of the newest round
    // before the caller stamps it — so the newest round renders at the
    // oldest end. Asserted rather than fixed: which end it belongs at is
    // a product question for a function nothing currently calls.
    const runs = duoRuns([
      day("2026-08-10", { me: { optionIdx: 0, guessIdx: 0 }, you: { optionIdx: 1, guessIdx: 1 } }),
      { qid: "q1", votes: { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 0 } } },
    ], "me", "you");
    // The dayless one (a hit) comes out at index 0, ahead of the dated
    // miss — first, not last.
    expect(runs.read).toEqual([true, false]);
    expect(runs.by).toEqual([true, false]);
  });

  it("records a miss as a miss rather than dropping the day", () => {
    const runs = duoRuns([
      day("2026-08-10", { me: { optionIdx: 0, guessIdx: 0 }, you: { optionIdx: 1, guessIdx: 1 } }),
    ], "me", "you");
    expect(runs).toEqual({ read: [false], by: [false] });
  });

  it("draws oldest first however the history arrives", () => {
    // revealHistory() returns newest first; the run is read left-to-right
    // as time, so the order has to be restored here rather than assumed.
    const runs = duoRuns([
      day("2026-08-12", { me: { optionIdx: 0, guessIdx: 0 }, you: { optionIdx: 1, guessIdx: 1 } }),
      day("2026-08-10", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 0 } }),
    ], "me", "you");
    expect(runs.read).toEqual([true, false]);
  });

  it("drops a day the two were asked different questions", () => {
    // D71's split. Their guessIdx is about another prompt entirely — the
    // indexes would still compare equal and print a read that never happened.
    const runs = duoRuns([
      day("2026-08-10", {
        me: { optionIdx: 0, guessIdx: 1 },
        you: { optionIdx: 1, guessIdx: 0, qid: "q-other" },
      }),
    ], "me", "you");
    expect(runs).toEqual({ read: [], by: [] });
  });

  it("drops a day either side did not guess, so the two rows stay aligned", () => {
    const runs = duoRuns([
      day("2026-08-09", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1 } }),
      day("2026-08-10", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 0 } }),
    ], "me", "you");
    expect(runs.read.length).toBe(1);
    expect(runs.by.length).toBe(1);
  });

  it("ignores a day one of them is missing from", () => {
    const runs = duoRuns([day("2026-08-10", { me: { optionIdx: 0, guessIdx: 1 } })], "me", "you");
    expect(runs).toEqual({ read: [], by: [] });
  });

  it("returns empty runs rather than throwing when the partner is unknown", () => {
    // A solo duo — nobody has accepted yet, so there is no `them` to fold.
    expect(duoRuns([day("2026-08-10", { me: { optionIdx: 0, guessIdx: 1 } })], "me", "")).toEqual({ read: [], by: [] });
  });
});

describe("revealTally", () => {
  it("groups voters under the option they picked, in option order", () => {
    const rows = revealTally({
      qid: "q1",
      votes: { a: { optionIdx: 1 }, b: { optionIdx: 0 }, c: { optionIdx: 1 } },
    }, 2);
    expect(rows).toEqual([
      { optionIdx: 0, uids: ["b"] },
      { optionIdx: 1, uids: ["a", "c"] },
    ]);
  });

  it("draws no row for an option nobody chose", () => {
    const rows = revealTally({ qid: "q1", votes: { a: { optionIdx: 0 } } }, 3);
    expect(rows).toEqual([{ optionIdx: 0, uids: ["a"] }]);
  });

  it("leaves out a member who answered a different question", () => {
    // Their answer is not in this question's counts. The card names them
    // separately; folding them in here would inflate a bar with a vote
    // that was cast about something else.
    const rows = revealTally({
      qid: "q1",
      votes: { a: { optionIdx: 0 }, b: { optionIdx: 0, qid: "q-other" } },
    }, 2);
    expect(rows).toEqual([{ optionIdx: 0, uids: ["a"] }]);
  });

  it("still shows a vote whose index is past the options it was handed", () => {
    // A "pick" question's options ARE the members, so the caller's
    // optionCount can lag a member who joined since. Dropping the row would
    // silently lose somebody's answer; the caller labels it "Option N".
    const rows = revealTally({ qid: "q1", votes: { a: { optionIdx: 4 } } }, 2);
    expect(rows).toEqual([{ optionIdx: 4, uids: ["a"] }]);
  });
});

// ── rounds (D426) ────────────────────────────────────────────────────
describe("duoRuns — rounds within a day, and a late answer", () => {
  it("orders two rounds from one day by round, whatever order they arrive in", () => {
    const runs = duoRuns([
      { ...day("2026-09-08", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 1 } }), round: 8 },
      { ...day("2026-09-08", { me: { optionIdx: 0, guessIdx: 0 }, you: { optionIdx: 1, guessIdx: 0 } }), round: 7 },
    ], "me", "you");
    // round 7: I guessed 0, they picked 1 → miss; they guessed 0, I picked 0 → hit
    // round 8: I guessed 1, they picked 1 → hit; they guessed 1, I picked 0 → miss
    expect(runs.read).toEqual([false, true]);
    expect(runs.by).toEqual([true, false]);
  });

  it("drops a round either side answered late — not blind, so not a read", () => {
    const runs = duoRuns([
      day("2026-09-07", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 0 } }),
      { ...day("2026-09-08", { me: { optionIdx: 0, guessIdx: 1 }, you: { optionIdx: 1, guessIdx: 0, late: true } as never }), round: 2 },
    ], "me", "you");
    expect(runs.read).toEqual([true]);
    expect(runs.by).toEqual([true]);
  });
});

describe("roleTally — who a role vote names", () => {
  it("folds by the snapshot, so two indexes naming one member are one row and no tie", () => {
    // Roster [a, b, c, d]: a votes index 3 (d); c leaves; b votes index 2,
    // which is d now. By index that is a tie between d and d; by who it is
    // d, 2–0 — what the Mirror's Votes lens says, and what the card must.
    const reveal = {
      day: "2026-09-09", qid: "r1",
      votes: { a: { optionIdx: 3, pickUid: "d" }, b: { optionIdx: 2, pickUid: "d" } },
    };
    expect(revealTally(reveal, 3).map((r) => r.uids.length)).toEqual([1, 1]);
    expect(roleTally(reveal, ["a", "b", "d"])).toEqual([{ optionIdx: 2, uid: "d", uids: ["a", "b"] }]);
  });

  it("places a snapshot-less vote by the reveal's own roster, never the live one, and keeps a late answer out", () => {
    expect(namedBy({ optionIdx: 1 }, ["a", "b"])).toBe("b");
    expect(namedBy({ optionIdx: 5 }, ["a", "b"])).toBeNull();
    expect(namedBy({ optionIdx: 1, pickUid: "z" }, ["a", "b"])).toBe("z");
    const reveal = {
      day: "2026-09-09", qid: "r1",
      votes: { a: { optionIdx: 1 }, b: { optionIdx: 7 }, c: { optionIdx: 1, late: true } },
    };
    expect(roleTally(reveal, ["a", "b"])).toEqual([
      { optionIdx: 1, uid: "b", uids: ["a"] },
      { optionIdx: 7, uid: null, uids: ["b"] },
    ]);
  });
});
