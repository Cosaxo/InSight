// The pure half of the follow graph (D101). The fetches need Firebase;
// the ranking and the fold do not, and both are the kind of thing that
// renders a perfectly plausible screen when it is wrong — a Circle
// ordered by the wrong key still shows real names next to real
// percentages.

import { describe, expect, it } from "vitest";
import {
  capFollows, circleSplit, rankMembers, FOLLOW_CAP,
  type Member, type MemberAnswers,
} from "./circle";

const m = (uid: string, name: string, pct: number, shared: number, over: Partial<Member> = {}): Member => ({
  uid, name, mutual: false,
  like: { pct, shared, same: Math.round((pct / 100) * shared) },
  // No score by default, so the cases below keep testing the AGREEMENT
  // ordering they were written for. The score arm has its own describe.
  score: null,
  ...over,
});

/** A score match with only the fields the ranking reads. */
const sc = (match: number, axes = 5, tests = 1) => ({ match, axes, tests });

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

describe("rankMembers · score first, agreement as the fallback (D112's order)", () => {
  it("puts anyone you share a test with above anyone you do not", () => {
    // The ordering rankKindred has used since D112, finally applied here.
    // NOT a comparison of the two numbers: an 80% score match is a
    // whole-profile distance and a 100% agreement can be one lucky shared
    // question, so they are ranked in tiers rather than interleaved.
    const scored = m("s", "Scored", 10, 3, { score: sc(80) });
    const agreed = m("a", "Agreed", 100, 40);
    expect(rankMembers([agreed, scored]).map((x) => x.uid)).toEqual(["s", "a"]);
  });

  it("orders two scored members by match, then by axes covered", () => {
    const near = m("n", "Near", 0, 0, { score: sc(90) });
    const far = m("f", "Far", 0, 0, { score: sc(60) });
    expect(rankMembers([far, near]).map((x) => x.uid)).toEqual(["n", "f"]);
    // Same match, more axes behind it wins — the score arm's version of
    // the overlap tiebreak the agreement arm needs.
    const thin = m("t", "Thin", 0, 0, { score: sc(90, 5) });
    const wide = m("w", "Wide", 0, 0, { score: sc(90, 22) });
    expect(rankMembers([thin, wide]).map((x) => x.uid)).toEqual(["w", "t"]);
  });

  it("still ranks a circle where nobody has taken a test", () => {
    // The fallback has to be load-bearing, not decorative: a new account
    // that has answered questions but sat no instrument must still get an
    // ordered circle rather than an arbitrary one.
    const out = rankMembers([m("a", "Ada", 40, 10), m("b", "Bo", 90, 10)]);
    expect(out.map((x) => x.uid)).toEqual(["b", "a"]);
  });
});

describe("circleSplit", () => {
  const members = [m("a", "Ada", 0, 0), m("b", "Bo", 0, 0), m("c", "Cy", 0, 0)];
  // The answers arrive as their own map now — a separate, deferred read
  // from the member list (see MemberAnswers).
  const answers: MemberAnswers = {
    a: { q1: 0, q2: 1 },
    b: { q1: 0 },
    c: { q1: 1, q2: 1 },
  };

  it("counts the members who answered, densely", () => {
    expect(circleSplit(members, answers, "q1", 3)).toEqual({ qid: "q1", counts: [2, 1, 0], n: 3 });
  });

  it("counts only the members who answered THIS question", () => {
    // n is the answerers, never the circle's size. Conflating them would
    // overstate every consensus by however many people stayed silent.
    expect(circleSplit(members, answers, "q2", 2)).toEqual({ qid: "q2", counts: [0, 2], n: 2 });
  });

  it("is all zeroes for a question nobody in the circle answered", () => {
    expect(circleSplit(members, answers, "q9", 2)).toEqual({ qid: "q9", counts: [0, 0], n: 0 });
  });

  it("is all zeroes before the deferred answer read has run", () => {
    // The state the stop now opens in: members known, answers not fetched.
    // It must render as "nothing to split on yet" rather than throwing or
    // inventing a consensus out of an empty map.
    expect(circleSplit(members, {}, "q1", 3)).toEqual({ qid: "q1", counts: [0, 0, 0], n: 0 });
  });

  it("ignores a member whose answer read failed", () => {
    // loadCircleAnswers drops an unreadable account from the map rather
    // than failing the stop, so a member with no entry must simply not
    // count — the same handling as "did not answer".
    expect(circleSplit(members, { a: { q1: 0 } }, "q1", 2))
      .toEqual({ qid: "q1", counts: [1, 0], n: 1 });
  });

  it("drops an option index the question does not have", () => {
    // A stale answer to a question whose options were edited would
    // otherwise write past the end of the array and produce a sparse
    // row that renders as a missing bar.
    expect(circleSplit([m("x", "X", 0, 0)], { x: { q1: 7 } }, "q1", 2))
      .toEqual({ qid: "q1", counts: [0, 0], n: 0 });
  });

  it("does NOT include the viewer — the opposite of typicality, on purpose", () => {
    // The Map counts you in your own age band because the aggregate
    // folded your answer too. Here the question is "what do the people I
    // follow think", and a circle of one must not reflect your own
    // answer back at you as its consensus. The fold takes members only,
    // so this is a property of the signature: there is no viewer to pass.
    expect(circleSplit([m("a", "Ada", 0, 0)], { a: { q1: 1 } }, "q1", 2))
      .toEqual({ qid: "q1", counts: [0, 1], n: 1 });
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
