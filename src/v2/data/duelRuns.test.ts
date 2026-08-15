import { describe, expect, it } from "vitest";
import { duoRuns, revealTally } from "./duelRuns";

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
