// The nightly trait sweep (D330), against a recording fake.
//
// Two of these cases are the record's load-bearing claims rather than
// ordinary coverage, and they are why the fake records WRITES rather than
// just returning results:
//
//   * "moves every one of a person's answers when their type changes, in
//     one run" is the retroactivity headline — the property the rejected
//     anchors-stamp design cannot have at all.
//   * "writes nothing but cubes" is D330's custody rule. The sweep holds
//     every account's type in memory for the length of a run, and the
//     record promises none of it is persisted. A promise like that is
//     worth exactly what the test behind it is worth.
import { describe, expect, it } from "vitest";
import { runTraitsSweep, type TraitAnswer, type TraitsStore } from "./traits";
import { traitBucketsFor, type TraitCube } from "./traitsFit";
import { TRAIT_AVG, TRAIT_ARCH, UNTESTED, RULE_STRONG } from "./traitsContent";

/** A profile whose Big Five sits RULE_STRONG above the baseline on every
 *  axis — a stable, definitely-typed person. */
const HIGH = {
  big5: {
    dims: Object.keys(TRAIT_AVG.big5).map((id) => ({
      id, value: Math.min(100, (TRAIT_AVG.big5[id] ?? 50) + RULE_STRONG),
    })),
  },
};
/** …and its mirror image, which must match a DIFFERENT archetype. */
const LOW = {
  big5: {
    dims: Object.keys(TRAIT_AVG.big5).map((id) => ({
      id, value: Math.max(0, (TRAIT_AVG.big5[id] ?? 50) - RULE_STRONG),
    })),
  },
};

interface Write { qid: string; cube: TraitCube; total: number }

function fakeStore(
  profiles: Record<string, unknown>,
  answers: Record<string, TraitAnswer[]>,
) {
  const writes: Write[] = [];
  /** Every path the run touched, so a write outside the cube collection
   *  is visible rather than merely absent from the assertions. */
  const paths: string[] = [];
  const store: TraitsStore = {
    async allTraitBuckets() {
      const m = new Map<string, Record<string, string>>();
      for (const uid of Object.keys(profiles)) m.set(uid, traitBucketsFor(profiles[uid]));
      return m;
    },
    async answersForQuestion(qid) {
      return answers[qid] ?? [];
    },
    async putCube(qid, cube, total) {
      writes.push({ qid, cube, total });
      paths.push(`v2_question_traits/${qid}`);
    },
  };
  return { store, writes, paths };
}

const cellOf = (w: Write, dim: string, bucket: string) => (w.cube[dim] || {})[bucket];

describe("runTraitsSweep", () => {
  it("folds each question's answers into every dim, cell by cell", async () => {
    const { store, writes } = fakeStore(
      { a: HIGH, b: LOW, c: {} },
      { "daily-000": [
        { uid: "a", optionIdx: 0 },
        { uid: "b", optionIdx: 1 },
        { uid: "c", optionIdx: 1 },
      ] },
    );
    const sum = await runTraitsSweep(store, new Set(["daily-000"]));
    expect(sum).toEqual({ people: 3, questions: 1, folded: 3 });
    const w = writes[0];
    expect(w.total).toBe(3);
    // The untyped person is in `untested` on every dim, and the two typed
    // ones are in different archetypes (the fixture would be worthless if
    // they collided).
    const typedA = Object.keys(w.cube.big5).find((k) => k !== UNTESTED && cellOf(w, "big5", k)["0"]);
    const typedB = Object.keys(w.cube.big5).find((k) => k !== UNTESTED && cellOf(w, "big5", k)["1"]);
    expect(typedA).toBeTruthy();
    expect(typedB).toBeTruthy();
    expect(typedA).not.toBe(typedB);
    expect(cellOf(w, "big5", UNTESTED)).toEqual({ "1": 1 });
    // The axis dims band the two apart at the extremes.
    const firstAxis = `big5_${Object.keys(TRAIT_AVG.big5)[0]}`;
    expect(cellOf(w, firstAxis, "b4")).toEqual({ "0": 1 });
    expect(cellOf(w, firstAxis, "b0")).toEqual({ "1": 1 });
  });

  it("sums to the answer count on every dim — the census property the sheet's header rests on", async () => {
    const { store, writes } = fakeStore(
      { a: HIGH, b: LOW, c: {}, d: { political: { dims: [{ id: "econ", value: 95 }] } } },
      { q: [
        { uid: "a", optionIdx: 0 }, { uid: "b", optionIdx: 1 },
        { uid: "c", optionIdx: 0 }, { uid: "d", optionIdx: 2 },
      ] },
    );
    await runTraitsSweep(store, new Set(["q"]));
    const w = writes[0];
    for (const dim of Object.keys(w.cube)) {
      let n = 0;
      for (const b of Object.keys(w.cube[dim])) {
        for (const k of Object.keys(w.cube[dim][b])) n += w.cube[dim][b][k];
      }
      expect(n, `dim ${dim}`).toBe(4);
    }
  });

  it("MOVES ALL of a person's answers when their type changes, in one run", async () => {
    // The retroactivity headline. The same person, the same answers,
    // written long before they were typed: run once untyped, then again
    // with a result, and every answer they ever gave has moved — with no
    // delta bookkeeping, no migration and no per-answer stamp. This is
    // the property the rejected anchors design cannot have at all.
    const profiles: Record<string, unknown> = { a: {}, b: HIGH };
    const answers = {
      q1: [{ uid: "a", optionIdx: 0 }, { uid: "b", optionIdx: 0 }],
      q2: [{ uid: "a", optionIdx: 1 }],
    };
    const first = fakeStore(profiles, answers);
    await runTraitsSweep(first.store, new Set(["q1", "q2"]));
    expect(cellOf(first.writes[0], "big5", UNTESTED)).toEqual({ "0": 1 });
    expect(cellOf(first.writes[1], "big5", UNTESTED)).toEqual({ "1": 1 });

    profiles.a = LOW; // they take the test on day 90
    const second = fakeStore(profiles, answers);
    await runTraitsSweep(second.store, new Set(["q1", "q2"]));
    const typed = Object.keys(second.writes[1].cube.big5).find((k) => k !== UNTESTED);
    expect(typed, "the old answer never left untested").toBeTruthy();
    expect(TRAIT_ARCH.big5.some((x) => x.name === typed)).toBe(true);
    // …and nothing of theirs is left behind in untested, on either question.
    expect(cellOf(second.writes[1], "big5", UNTESTED)).toBeUndefined();
    expect(cellOf(second.writes[0], "big5", UNTESTED)).toBeUndefined();
  });

  it("writes NOTHING but cubes — no per-person type is persisted anywhere", async () => {
    // D330's custody rule, as a test rather than a claim.
    const { store, paths } = fakeStore(
      { a: HIGH, b: LOW },
      { q: [{ uid: "a", optionIdx: 0 }, { uid: "b", optionIdx: 1 }] },
    );
    await runTraitsSweep(store, new Set(["q"]));
    expect(paths).toEqual(["v2_question_traits/q"]);
    expect(paths.every((p) => p.startsWith("v2_question_traits/"))).toBe(true);
  });

  it("writes no cube for a question nobody has answered", async () => {
    // An absent document is "no reading yet" (D1); an empty one would put
    // a row of zeros on screen, which is a different claim.
    const { store, writes } = fakeStore({ a: HIGH }, { q: [] });
    const sum = await runTraitsSweep(store, new Set(["q"]));
    expect(writes).toEqual([]);
    expect(sum).toEqual({ people: 1, questions: 0, folded: 0 });
  });

  it("folds an answer from an account with no profile as untested rather than dropping it", async () => {
    // Dropping it would break the census identity the header bar rests
    // on; untested keeps the sums honest.
    const { store, writes } = fakeStore({}, { q: [{ uid: "ghost", optionIdx: 0 }] });
    await runTraitsSweep(store, new Set(["q"]));
    expect(writes[0].total).toBe(1);
    expect(cellOf(writes[0], "big5", UNTESTED)).toEqual({ "0": 1 });
  });

  it("does nothing, and does not throw, on an empty eligible set", async () => {
    const { store, writes } = fakeStore({ a: HIGH }, {});
    const sum = await runTraitsSweep(store, new Set());
    expect(writes).toEqual([]);
    expect(sum.questions).toBe(0);
  });
});

describe("TRAITS_QIDS — the eligible set is core, and only core", () => {
  it("takes the daily and core feed, and refuses every other surface", async () => {
    const { TRAITS_QIDS } = await import("./traits");
    const { V2_QUESTIONS } = await import("./v2content");
    expect(TRAITS_QIDS.size).toBeGreaterThan(0);
    for (const q of V2_QUESTIONS) {
      const want = q.surface === "daily" || (q.surface === "feed" && q.core === true);
      expect(TRAITS_QIDS.has(q.id), `${q.id} (${q.surface})`).toBe(want);
    }
    // Named explicitly, because each is excluded for its own reason: a
    // duel answer is sealed, a learn answer is a first attempt, and a
    // test answer is an INPUT to the types this cuts by.
    for (const s of ["group", "duo", "test", "learn", "pulse", "call"]) {
      const q = V2_QUESTIONS.find((x) => x.surface === s);
      if (q) expect(TRAITS_QIDS.has(q.id), `${s} must not be eligible`).toBe(false);
    }
  });
});
