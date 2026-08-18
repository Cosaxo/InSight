// The Compare folds (D193): two profiles laid over each other.
//
// Every number here is one the lens prints to a user's face — "You ↔ Oslo,
// 88% aligned, mean gap across 5 axes" — so the cases pin the arithmetic
// exactly, and pin the REFUSALS as refusals: an instrument only one side
// has must be absent from the read rather than drawn against an invented
// middle, and an axis below its floor must not exist at all.

import { describe, expect, it } from "vitest";
import {
  cohortAxisMap,
  compareRead,
  myAxisMap,
  peopleAxisMap,
  MIN_COMPARE_AXES,
} from "./compare";
import { testItemMeta, type TestDefs } from "./similarity";

// Two miniature instruments in IS_TESTS' shape — similarity.test.ts's
// fixture widened to three axes, because MIN_COMPARE_AXES is three and a
// two-axis instrument could never produce a card to assert about.
const DEFS: TestDefs = {
  big5: {
    title: "Big Five",
    dims: [
      { id: "O", label: "Openness" },
      { id: "C", label: "Conscientiousness" },
      { id: "E", label: "Extraversion" },
    ],
    questions: [
      { q: "New ideas beat familiar ones.", d: "O" },
      { q: "I stick with what works.", d: "O", invert: true },
      { q: "I keep appointments.", d: "C" },
      { q: "Plans are for other people.", d: "C", invert: true },
      { q: "I talk to strangers.", d: "E" },
      { q: "Parties drain me.", d: "E", invert: true },
    ],
  },
  // FOUR axes, one more than big5, and that is load-bearing: `overall`
  // is a POOLED mean rather than the mean of the card figures, and two
  // three-axis instruments could never tell the two apart.
  values: {
    title: "Values",
    dims: [
      { id: "future", label: "Future" },
      { id: "circle", label: "Circle" },
      { id: "beauty", label: "Beauty" },
      { id: "moral", label: "Ethics" },
    ],
    questions: [
      { q: "Tomorrow will be better.", d: "future" },
      { q: "Charity begins at home.", d: "circle" },
      { q: "Beauty is worth the detour.", d: "beauty" },
      { q: "Right and wrong do not move.", d: "moral" },
    ],
  },
};

const LIKERT5 = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const BANK = [
  { id: "b0", prompt: "New ideas beat familiar ones.", test: "big5", options: LIKERT5 },
  { id: "b1", prompt: "I stick with what works.", test: "big5", options: LIKERT5 },
  { id: "b2", prompt: "I keep appointments.", test: "big5", options: LIKERT5 },
  { id: "b3", prompt: "Plans are for other people.", test: "big5", options: LIKERT5 },
  { id: "b4", prompt: "I talk to strangers.", test: "big5", options: LIKERT5 },
  { id: "b5", prompt: "Parties drain me.", test: "big5", options: LIKERT5 },
  { id: "v0", prompt: "Tomorrow will be better.", test: "values", options: LIKERT5 },
  { id: "v1", prompt: "Charity begins at home.", test: "values", options: LIKERT5 },
  { id: "v2", prompt: "Beauty is worth the detour.", test: "values", options: LIKERT5 },
  { id: "v3", prompt: "Right and wrong do not move.", test: "values", options: LIKERT5 },
];
const ITEMS = testItemMeta(BANK, DEFS);

/** A dense 5-option cell with `n` answers all on one option. */
const allOn = (idx: number, n: number) =>
  Array.from({ length: 5 }, (_, i) => (i === idx ? n : 0));

/** A stored `testResults` entry, as parseTestResults hands one back. */
const axes = (o: Record<string, number>) => o;

const ORDER = ["big5", "values"];

describe("myAxisMap — a completed test wins, own answers fill the rest", () => {
  it("takes the stored result where there is one", () => {
    const mine = myAxisMap({ big5: axes({ O: 70, C: 60, E: 50 }) }, ITEMS, DEFS, {});
    expect(mine.big5).toEqual({ O: 70, C: 60, E: 50 });
    // Nothing answered and nothing stored for values — absent, not 50.
    expect(mine.values).toBeUndefined();
  });

  it("folds your own feed answers for an instrument you have not finished", () => {
    // Middle on every item: 2 forward, 4−2 inverted — the same 2 either
    // way, so every axis lands on exactly 50 and the fixture cannot be
    // read as accidentally depending on the invert flags.
    const votes = Object.fromEntries(BANK.map((q) => [q.id, 2]));
    const mine = myAxisMap(null, ITEMS, DEFS, votes);
    expect(mine.big5).toEqual({ O: 50, C: 50, E: 50 });
    expect(mine.values).toEqual({ future: 50, circle: 50, beauty: 50, moral: 50 });
  });

  it("prefers the stored result even when both exist", () => {
    const votes = Object.fromEntries(BANK.map((q) => [q.id, 2]));
    const mine = myAxisMap({ big5: axes({ O: 91, C: 91, E: 91 }) }, ITEMS, DEFS, votes);
    expect(mine.big5.O).toBe(91);
    // …and the unfinished one still fills from the same answers.
    expect(mine.values).toEqual({ future: 50, circle: 50, beauty: 50, moral: 50 });
  });
});

describe("cohortAxisMap — a population out of its own counts", () => {
  it("folds every axis and reports what it folded over", () => {
    const fold = cohortAxisMap(DEFS, ITEMS, () => allOn(2, 20), 30, 2);
    expect(fold.axes.big5).toEqual({ O: 50, C: 50, E: 50 });
    // values' four axes are one item each, so minItems refuses all four.
    expect(fold.axes.values).toBeUndefined();
    // Per axis, not one total — the header rests only on what it draws.
    expect(fold.n.big5).toEqual({ O: 40, C: 40, E: 40 });
    expect(fold.n.values).toBeUndefined();
  });

  it("refuses an axis below the answer floor rather than thinning it", () => {
    const fold = cohortAxisMap(DEFS, ITEMS, () => allOn(2, 4), 30, 2);
    // 2 items × 4 answers = 8 per axis, under 30.
    expect(fold.axes.big5).toBeUndefined();
    expect(fold.n).toEqual({});
  });

  it("refuses a one-item axis however many answers it has", () => {
    // Only the first O item answered, a thousand times.
    const fold = cohortAxisMap(DEFS, ITEMS, (qid) => (qid === "b0" ? allOn(4, 1000) : null), 30, 2);
    expect(fold.axes.big5).toBeUndefined();
  });

  it("lets a caller drop the sample floor for a population that is not a sample", () => {
    // A circle's own members: two answers is a real mean of two people.
    const fold = cohortAxisMap(DEFS, ITEMS, () => allOn(2, 1), 2, 2);
    expect(fold.axes.big5).toEqual({ O: 50, C: 50, E: 50 });
  });
});

describe("peopleAxisMap — a set out of its members' own results", () => {
  it("averages per axis and counts the people behind it", () => {
    const fold = peopleAxisMap(DEFS, [
      { big5: axes({ O: 60, C: 40, E: 50 }) },
      { big5: axes({ O: 80, C: 60, E: 50 }) },
      null,
    ]);
    expect(fold.axes.big5).toEqual({ O: 70, C: 50, E: 50 });
    expect(fold.people).toBe(2);
  });

  it("counts a half-finished member toward the instrument they finished", () => {
    const fold = peopleAxisMap(DEFS, [
      { big5: axes({ O: 60, C: 60, E: 60 }) },
      { values: axes({ future: 20, circle: 20, beauty: 20 }) },
    ]);
    // Requiring a matching set would have made two half-profiles read as
    // no profile at all.
    expect(fold.axes.big5).toEqual({ O: 60, C: 60, E: 60 });
    expect(fold.axes.values).toEqual({ future: 20, circle: 20, beauty: 20 });
    expect(fold.people).toBe(2);
  });

  it("is empty for a set where nobody has taken anything", () => {
    const fold = peopleAxisMap(DEFS, [null, null]);
    expect(fold.axes).toEqual({});
    expect(fold.people).toBe(0);
  });
});

describe("compareRead — the two profiles, laid over each other", () => {
  it("is 100 minus the mean gap, per instrument and pooled", () => {
    const read = compareRead(DEFS, ORDER,
      { big5: axes({ O: 70, C: 60, E: 50 }) },
      { big5: axes({ O: 50, C: 50, E: 50 }) });
    expect(read.cards).toHaveLength(1);
    // gaps 20, 10, 0 → mean 10 → 90.
    expect(read.cards[0].align).toBe(90);
    expect(read.cards[0].axes).toBe(3);
    expect(read.overall).toBe(90);
    expect(read.axes).toBe(3);
  });

  it("weights an instrument by its shared axes, not by being an instrument", () => {
    // big5: three axes, gaps 30,30,30 → 70. values: FOUR axes, gaps
    // 0,0,0,0 → 100.
    const read = compareRead(DEFS, ORDER,
      {
        big5: axes({ O: 80, C: 80, E: 80 }),
        values: axes({ future: 40, circle: 40, beauty: 40, moral: 40 }),
      },
      {
        big5: axes({ O: 50, C: 50, E: 50 }),
        values: axes({ future: 40, circle: 40, beauty: 40, moral: 40 }),
      });
    expect(read.cards.map((c) => c.align)).toEqual([70, 100]);
    // The prototype averages the two card figures, which is 85. This is
    // `scoreMatch` over the UNION — (30×3 + 0×4) / 7 = 12.857 → 87 — so
    // the header figure is the same KIND of number as the "92% aligned
    // with your scores" on a constellation place card, and one sentence
    // explains both.
    expect(read.overall).toBe(87);
    expect(read.axes).toBe(7);
  });

  it("leaves out an instrument only one of you has", () => {
    const read = compareRead(DEFS, ORDER,
      { big5: axes({ O: 70, C: 60, E: 50 }), values: axes({ future: 50, circle: 50, beauty: 50, moral: 50 }) },
      { big5: axes({ O: 50, C: 50, E: 50 }) });
    // Not drawn against a neutral 50 — absent.
    expect(read.cards.map((c) => c.kind)).toEqual(["big5"]);
  });

  it("refuses an instrument you overlap on fewer than MIN_COMPARE_AXES", () => {
    expect(MIN_COMPARE_AXES).toBe(3);
    const read = compareRead(DEFS, ORDER,
      { big5: axes({ O: 70, C: 60, E: 50 }) },
      // They have E, which you also have — one shared axis.
      { big5: axes({ E: 50 }) });
    expect(read.cards).toEqual([]);
    expect(read.overall).toBeNull();
  });

  it("draws the cards in the order the surface asked for", () => {
    const both = {
      big5: axes({ O: 50, C: 50, E: 50 }),
      values: axes({ future: 50, circle: 50, beauty: 50, moral: 50 }),
    };
    expect(compareRead(DEFS, ["values", "big5"], both, both).cards.map((c) => c.kind))
      .toEqual(["values", "big5"]);
  });

  it("puts your axes in the instrument's own order, whatever the stored one was", () => {
    const read = compareRead(DEFS, ORDER,
      // A stored result whose key order is JSON's, not the instrument's.
      { big5: axes({ E: 10, O: 20, C: 30 }) },
      { big5: axes({ O: 50, C: 50, E: 50 }) });
    expect(read.cards[0].dims.map((d) => d.id)).toEqual(["O", "C", "E"]);
    // …and it carries the instrument's labels, so the rose and the pole
    // rows read the way the results page does.
    expect(read.cards[0].dims.map((d) => d.label)).toEqual(["Openness", "Conscientiousness", "Extraversion"]);
  });

  it("refuses when the overlap alone is under the floor", () => {
    const read = compareRead(DEFS, ORDER,
      { big5: axes({ O: 70, C: 60, E: 50 }) },
      // No E on their side: the overlap is two, so there is no card at
      // all rather than a percentage computed from two axes.
      { big5: axes({ O: 50, C: 50 }) });
    expect(read.cards).toEqual([]);
  });

  it("carries only the axes both of you have", () => {
    // THE PHANTOM MARK. `CBRoseGap` washes the span between you as
    // `themV[d.id] ?? 50`, so an axis of yours with no counterpart would
    // be drawn as though they sat at fifty — a mark about people who have
    // said nothing. It is a live case, not a theoretical one:
    // `cohortAxisMap` drops one axis below its floor while its siblings
    // clear all the time.
    const read = compareRead(DEFS, ORDER,
      { values: axes({ future: 40, circle: 40, beauty: 40, moral: 40 }) },
      { values: axes({ future: 50, circle: 50, beauty: 50 }) });
    expect(read.cards[0].dims.map((d) => d.id)).toEqual(["future", "circle", "beauty"]);
    // Every slice of the rose has a dot, which is the invariant.
    expect(read.cards[0].dims).toHaveLength(read.cards[0].axes);
    expect(Object.keys(read.cards[0].theirs)).toHaveLength(3);
  });

  it("counts the answers behind the axes it DREW, not the whole fold", () => {
    // minItems 1 here on purpose: this fixture's values axes are one item
    // each, and the case needs a population with BOTH instruments measured
    // — which is the ordinary state of a real one, where every axis has
    // five items.
    const fold = cohortAxisMap(DEFS, ITEMS, () => allOn(2, 20), 2, 1);
    // The population has both instruments measured…
    expect(Object.keys(fold.axes).sort()).toEqual(["big5", "values"]);
    // …and this viewer has only finished one, so only its axes are drawn.
    const read = compareRead(DEFS, ORDER,
      { big5: axes({ O: 70, C: 60, E: 50 }) }, fold.axes, fold.n);
    expect(read.cards.map((c) => c.kind)).toEqual(["big5"]);
    // big5's three axes at 2 items × 20 answers each. The values axes'
    // answers are real and are not in this figure, because the header it
    // feeds says "across 3 axes".
    expect(read.answers).toBe(120);
    expect(read.axes).toBe(3);
  });
});
