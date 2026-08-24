// The pure half of the follow graph (D101). The fetches need Firebase;
// the ranking and the fold do not, and both are the kind of thing that
// renders a perfectly plausible screen when it is wrong — a Circle
// ordered by the wrong key still shows real names next to real
// percentages.

import { describe, expect, it } from "vitest";
import { capFollows, circleSplit, rankMembers, FOLLOW_CAP, type Member } from "./circle";
import { agreementOf } from "./cohort";

const m = (uid: string, name: string, pct: number, shared: number, over: Partial<Member> = {}): Member => ({
  uid, name, mutual: false,
  like: agreementOf(Math.round((pct / 100) * shared), shared),
  answers: {},
  ...over,
});

describe("rankMembers", () => {
  it("puts the most alike first", () => {
    const out = rankMembers([m("a", "Ada", 40, 10), m("b", "Bo", 90, 10)]);
    expect(out.map((x) => x.uid)).toEqual(["b", "a"]);
  });

  it("breaks a tie on OVERLAP, which is the bug this app would ship", () => {
    // One shared question that happened to match scores 100%. Without the
    // second key that person heads the list forever, above someone who
    // matched on forty of fifty — and it looks completely right until the
    // day somebody answers a single question.
    const lucky = m("lucky", "Lucky", 100, 1);
    const real = m("real", "Real", 100, 40);
    expect(rankMembers([lucky, real]).map((x) => x.uid)).toEqual(["real", "lucky"]);
  });

  it("is stable and does not depend on input order", () => {
    const a = m("a", "Ada", 50, 4);
    const b = m("b", "Bo", 50, 4);
    expect(rankMembers([a, b]).map((x) => x.uid))
      .toEqual(rankMembers([b, a]).map((x) => x.uid));
  });

  it("sorts unnamed accounts last rather than first", () => {
    // "" sorts before every letter, so a plain localeCompare would put
    // every anonymous account at the top of the circle.
    const out = rankMembers([m("z", "", 50, 4), m("a", "Ada", 50, 4)]);
    expect(out.map((x) => x.uid)).toEqual(["a", "z"]);
  });
});

describe("circleSplit", () => {
  const members = [
    m("a", "Ada", 0, 0, { answers: { q1: 0, q2: 1 } }),
    m("b", "Bo", 0, 0, { answers: { q1: 0 } }),
    m("c", "Cy", 0, 0, { answers: { q1: 1, q2: 1 } }),
  ];

  it("counts the members who answered, densely", () => {
    expect(circleSplit(members, "q1", 3)).toEqual({ qid: "q1", counts: [2, 1, 0], n: 3 });
  });

  it("counts only the members who answered THIS question", () => {
    // n is the answerers, never the circle's size. Conflating them would
    // overstate every consensus by however many people stayed silent.
    expect(circleSplit(members, "q2", 2)).toEqual({ qid: "q2", counts: [0, 2], n: 2 });
  });

  it("is all zeroes for a question nobody in the circle answered", () => {
    expect(circleSplit(members, "q9", 2)).toEqual({ qid: "q9", counts: [0, 0], n: 0 });
  });

  it("drops an option index the question does not have", () => {
    // A stale answer to a question whose options were edited would
    // otherwise write past the end of the array and produce a sparse
    // row that renders as a missing bar.
    const stale = [m("x", "X", 0, 0, { answers: { q1: 7 } })];
    expect(circleSplit(stale, "q1", 2)).toEqual({ qid: "q1", counts: [0, 0], n: 0 });
  });

  it("does NOT include the viewer — the opposite of typicality, on purpose", () => {
    // The Map counts you in your own age band because the aggregate
    // folded your answer too. Here the question is "what do the people I
    // follow think", and a circle of one must not reflect your own
    // answer back at you as its consensus. The fold takes members only,
    // so this is a property of the signature: there is no viewer to pass.
    const one = [m("a", "Ada", 0, 0, { answers: { q1: 1 } })];
    expect(circleSplit(one, "q1", 2)).toEqual({ qid: "q1", counts: [0, 1], n: 1 });
  });
});

describe("capFollows", () => {
  it("bounds the fan-out — one answer query per member is the cost", () => {
    const many = Array.from({ length: FOLLOW_CAP + 10 }, (_, i) => `u${i}`);
    expect(capFollows(many).length).toBe(FOLLOW_CAP);
    expect(capFollows(many)[0]).toBe("u0");
  });

  it("leaves a short list alone", () => {
    expect(capFollows(["a", "b"])).toEqual(["a", "b"]);
    expect(capFollows([])).toEqual([]);
  });
});
