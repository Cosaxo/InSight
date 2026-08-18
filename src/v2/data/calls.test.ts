// What the CALL card shows, and — the case worth the whole feature — what
// it says when the device disagrees with the grade it was handed (D194).
import { describe, expect, it } from "vitest";
import {
  callPcts,
  cardsFrom,
  daysUntil,
  pickCall,
  recheck,
  stateOf,
  type CallCard,
} from "./calls";
import { CALL_VOID, type CallRubric } from "./callRubric";

const RUBRIC: CallRubric = { kind: "agg", qid: "feed-f01", test: "topShareAtLeast", threshold: 60 };

function card(over: Partial<CallCard> = {}): CallCard {
  return {
    id: "call-c01",
    prompt: "Will it be lopsided?",
    options: ["It will", "It stays close"],
    resolvesAt: "2026-10-01",
    rubric: RUBRIC,
    counts: [30, 20],
    mine: null,
    outcome: null,
    ...over,
  };
}

describe("stateOf", () => {
  it("is `unread` until the grades have been fetched, whatever else is true", () => {
    // The load-bearing one. `undefined` means nothing has been read, and an
    // apparently-open call may already be graded — offering the tap would
    // be offering a write the rules are about to refuse.
    expect(stateOf(card({ outcome: undefined }))).toBe("unread");
    expect(stateOf(card({ outcome: undefined, mine: 0 }))).toBe("unread");
  });

  it("separates fetched-and-ungraded from not-fetched", () => {
    expect(stateOf(card({ outcome: null }))).toBe("open");
    expect(stateOf(card({ outcome: null, mine: 1 }))).toBe("sealed");
  });

  it("scores a graded call against your own pick", () => {
    expect(stateOf(card({ mine: 0, outcome: { outcomeIdx: 0 } }))).toBe("right");
    expect(stateOf(card({ mine: 1, outcome: { outcomeIdx: 0 } }))).toBe("wrong");
    expect(stateOf(card({ mine: null, outcome: { outcomeIdx: 0 } }))).toBe("missed");
  });

  it("scores nobody on a void, including someone who happened to pick the right side", () => {
    expect(stateOf(card({ mine: 0, outcome: { outcomeIdx: CALL_VOID } }))).toBe("void");
    expect(stateOf(card({ mine: null, outcome: { outcomeIdx: CALL_VOID } }))).toBe("void");
  });
});

describe("recheck — the device re-running the grade", () => {
  const inputs = { qid: "feed-f01", total: 100, counts: { "0": 70, "1": 30 } };

  it("agrees when the published inputs reproduce the published outcome", () => {
    expect(recheck(card({ mine: 0, outcome: { outcomeIdx: 0, inputs } }))).toBe(true);
  });

  it("DISAGREES loudly rather than deferring to the server", () => {
    // 70% clears a 60% threshold, so the grade should have been YES (0).
    // A published NO over those same numbers is the app contradicting its
    // own arithmetic, and this is what makes the card able to say so.
    expect(recheck(card({ mine: 0, outcome: { outcomeIdx: 1, inputs } }))).toBe(false);
  });

  it("has nothing to say about a void, or an outcome published without its inputs", () => {
    expect(recheck(card({ outcome: { outcomeIdx: CALL_VOID, inputs } }))).toBeNull();
    expect(recheck(card({ outcome: { outcomeIdx: 0 } }))).toBeNull();
    expect(recheck(card({ outcome: null }))).toBeNull();
  });

  it("refuses inputs taken of a different question rather than grading against them", () => {
    const wrong = { qid: "feed-OTHER", total: 100, counts: { "0": 70, "1": 30 } };
    expect(recheck(card({ outcome: { outcomeIdx: 0, inputs: wrong } }))).toBeNull();
  });
});

describe("pickCall", () => {
  it("offers the soonest open call first — the only state with something to do", () => {
    const picked = pickCall([
      card({ id: "b", resolvesAt: "2026-12-01" }),
      card({ id: "a", resolvesAt: "2026-10-01" }),
      card({ id: "s", resolvesAt: "2026-09-01", mine: 0 }),
    ]);
    expect(picked?.id).toBe("a");
  });

  it("shows a fresh verdict when there is nothing left to call", () => {
    const picked = pickCall([
      card({ id: "old", resolvesAt: "2026-01-01", mine: 0, outcome: { outcomeIdx: 0 } }),
      card({ id: "new", resolvesAt: "2026-06-01", mine: 1, outcome: { outcomeIdx: 0 } }),
      card({ id: "sealed", resolvesAt: "2026-12-01", mine: 0, outcome: null }),
    ]);
    // Your most recently decided call, not the pending one: a verdict you
    // have one visit to notice outranks a wait.
    expect(picked?.id).toBe("new");
  });

  it("falls back to a sealed call, then to anything graded", () => {
    expect(pickCall([card({ id: "s", mine: 0, outcome: null })])?.id).toBe("s");
    expect(pickCall([card({ id: "v", mine: null, outcome: { outcomeIdx: CALL_VOID } })])?.id).toBe("v");
  });

  it("returns nothing while every call is unread, so the card draws nothing", () => {
    expect(pickCall([card({ outcome: undefined }), card({ id: "x", outcome: undefined })])).toBeNull();
    expect(pickCall([])).toBeNull();
  });
});

describe("callPcts", () => {
  it("is null before anyone has called it — never a row of zeroes", () => {
    expect(callPcts([0, 0])).toBeNull();
  });
  it("sums to exactly 100, with the remainder on the leader", () => {
    const ps = callPcts([1, 1, 1])!;
    expect(ps.reduce((a, b) => a + b, 0)).toBe(100);
    expect(ps).toEqual([34, 33, 33]);
  });
});

describe("daysUntil", () => {
  it("counts whole days forward, and goes negative once past", () => {
    const now = Date.parse("2026-09-24T12:00:00Z");
    expect(daysUntil("2026-10-01", now)).toBe(7);
    expect(daysUntil("2026-09-24", now)).toBe(0);
    expect(daysUntil("2026-09-01", now)).toBeLessThan(0);
  });
});

describe("cardsFrom", () => {
  const bank = [{
    id: "call-c01", surface: "call", seq: 0, type: "call",
    prompt: "P", options: ["Yes", "No"], topic: null, test: null, active: true,
    resolvesAt: "2026-10-01", rubric: RUBRIC, counts: [3, 1],
  }];

  it("carries your own vote and the grade through", () => {
    const [c] = cardsFrom(bank, { "call-c01": "1" }, { "call-c01": { outcomeIdx: 0 } });
    expect(c.mine).toBe(1);
    expect(c.outcome?.outcomeIdx).toBe(0);
  });

  it("marks every card unread when the outcomes have not been fetched", () => {
    const [c] = cardsFrom(bank, {}, null);
    expect(c.outcome).toBeUndefined();
  });

  it("marks a call the fetch did not find as fetched-and-ungraded", () => {
    const [c] = cardsFrom(bank, {}, {});
    expect(c.outcome).toBeNull();
  });

  it("drops a bank entry with no rubric rather than rendering an ungradable call", () => {
    const broken = [{ ...bank[0], rubric: undefined }];
    expect(cardsFrom(broken, {}, {})).toHaveLength(0);
  });
});
