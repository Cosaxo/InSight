// @vitest-environment jsdom
//
// The norms seam (D157): what a result card is allowed to say about other
// people, and what it has to refuse.
//
// Two properties matter more than the arithmetic, and both are about the
// live build:
//
//   1. NO AUTHORED NUMBER SURVIVES INTO A LIVE READING. `IS_TEST_AVG` is
//      five constants per instrument and it used to BE the "most people"
//      ring on every axis of every card. A live build with a thin
//      population must return an empty map — not the constants, and not a
//      50 — so the card draws no reference mark rather than a plausible
//      one. That failure would be invisible on screen (a hollow ring in
//      the middle looks exactly like a real average), which is why it is
//      pinned here.
//
//   2. A FLOOR IS A FLOOR. An axis under NORM_MIN_ANSWERS, or spread over
//      one item, is not a population average and does not get published as
//      one.
//
// jsdom because the module graph reaches spec files that touch `window`.
import { afterEach, describe, expect, it } from "vitest";
import LIVE from "./live";
import {
  NORM_MIN_ANSWERS,
  NORM_MIN_PEOPLE,
  axisRank,
  hasNorm,
  resetNormCache,
  sampleAxes,
  testAvg,
  testNorm,
} from "./testNorms";
import { CORE_TEST_KINDS, parseTestResults, type KindredPerson } from "./similarity";
// @ts-expect-error TS7016 — untyped spec module
import { IS_TESTS } from "../spec/test-definitions.js";
import { agreementOf } from "./cohort";

// The store is the singleton every consumer imports, so these cases drive
// it the way NearLiveBody.test.tsx does: swap the members, restore them
// after. Cast through `unknown` because the fixtures below are the narrow
// slices the folds actually read (a bank item's id/prompt/test, an
// aggregate's counts) rather than whole QuestionDocs.
type Store = {
  enabled: boolean;
  aggFor: (qid: string) => unknown;
  testFeedItems: () => unknown[];
  kindredPeople: () => unknown[];
};
const L = LIVE as unknown as Store;
const real = {
  enabled: L.enabled,
  aggFor: L.aggFor,
  testFeedItems: L.testFeedItems,
  kindredPeople: L.kindredPeople,
};

afterEach(() => {
  Object.assign(L, real);
  resetNormCache();
});

// The Big Five definition's own items, so the prompt-text join
// (`testItemMeta`) matches the way it does against the seeded bank —
// hard-coding prompts here would test a bank that does not exist.
const BIG5 = (IS_TESTS as { big5: { questions: Array<{ q: string; d: string; invert?: boolean }> } }).big5;
// Straight items only: a reversed one scores 4 − i, so a fixture that
// answers "strongly agree" everywhere would land the axis at 67 rather
// than 100 and the expectations below would be about the fixture's mix of
// item polarities instead of about the floors.
const itemsFor = (dim: string, n: number) =>
  BIG5.questions.filter((q) => q.d === dim && !q.invert).slice(0, n);

/** A bank of core test items, as `testFeedItems` hands them over. */
function bank(dim: string, n: number) {
  return itemsFor(dim, n).map((q, i) => ({
    id: `t-${dim}-${i}`,
    prompt: q.q,
    test: "big5",
    surface: "test",
    options: ["", "", "", "", ""],
  }));
}

/** Published counts for those items — `answers` answers each, all on `opt`. */
function aggs(dim: string, n: number, opt: number, answers: number) {
  const byQid: Record<string, { counts: Record<string, number>; total: number }> = {};
  bank(dim, n).forEach((q) => {
    byQid[q.id] = { counts: { [String(opt)]: answers }, total: answers };
  });
  return byQid;
}

function live(items: ReturnType<typeof bank>, byQid: Record<string, unknown>) {
  L.enabled = true;
  L.testFeedItems = () => items;
  L.aggFor = (qid: string) => (byQid[qid] as never) ?? null;
  resetNormCache();
}

const person = (dims: Record<string, number>, uid: string): KindredPerson => ({
  uid,
  name: uid,
  city: "",
  like: agreementOf(0, 0),
  results: parseTestResults(
    { big5: { title: "Big Five", taken: "x", dims: Object.entries(dims).map(([id, value]) => ({ id, label: id, value })) } },
    CORE_TEST_KINDS,
  ),
});

describe("the demo build keeps the authored baseline", () => {
  it("hands back IS_TEST_AVG and says where it came from", () => {
    L.enabled = false;
    resetNormCache();
    const norm = testNorm("big5");
    expect(norm.src).toBe("authored");
    // The exact constants, so a future edit to them cannot silently pass
    // through as a measurement.
    expect(norm.avg).toEqual({ O: 60, C: 58, E: 52, A: 65, N: 48 });
  });
});

describe("a live build measures or refuses", () => {
  it("refuses every axis when the bank has no aggregates at all", () => {
    live(bank("O", 5), {});
    expect(testNorm("big5").src).toBe("measured");
    expect(testAvg("big5")).toEqual({});
    expect(hasNorm("big5")).toBe(false);
  });

  it("never falls back to the authored constants when it refuses", () => {
    // The whole point of the seam. A caller reading `testAvg` on a young
    // install gets nothing to draw — not 60, which is what shipped.
    live(bank("O", 5), {});
    expect(testAvg("big5").O).toBeUndefined();
  });

  it("scores an axis with enough answers behind enough items", () => {
    const items = bank("O", 3);
    // Option 4 on a non-inverted item is full agreement → 100.
    live(items, aggs("O", 3, 4, NORM_MIN_ANSWERS));
    const norm = testNorm("big5");
    expect(norm.avg.O).toBe(100);
    expect(norm.n.O).toBe(NORM_MIN_ANSWERS * 3);
    // Only the axis that was answered. C, E, A and N have no cells, so
    // they have no baseline — a partially measured instrument does not
    // borrow constants for the rest.
    expect(Object.keys(norm.avg)).toEqual(["O"]);
  });

  it("refuses an axis under the answer floor", () => {
    const items = bank("O", 3);
    live(items, aggs("O", 3, 2, 1));
    expect(testAvg("big5").O).toBeUndefined();
  });

  it("refuses an axis carried by a single item", () => {
    // Well over the answer floor, on one question. That is that
    // question's mean, not the axis's.
    const items = bank("O", 1);
    live(items, aggs("O", 1, 2, NORM_MIN_ANSWERS * 10));
    expect(testAvg("big5").O).toBeUndefined();
  });

  it("re-reads when the aggregate coverage changes", () => {
    // The memo keys on coverage, so a late `loadSimilarity` must not be
    // served the cold answer for the rest of the session.
    const items = bank("O", 3);
    live(items, {});
    expect(hasNorm("big5")).toBe(false);
    const filled = aggs("O", 3, 4, NORM_MIN_ANSWERS);
    L.aggFor = (qid: string) => (filled[qid] as never) ?? null;
    expect(testAvg("big5").O).toBe(100);
  });
});

describe("axisRank counts people instead of assuming a spread", () => {
  const crowd = (n: number, value: number, tag: string) =>
    Array.from({ length: n }, (_, i) => person({ O: value }, `${tag}${i}`));

  it("refuses below the people floor", () => {
    L.enabled = true;
    L.kindredPeople = () => crowd(NORM_MIN_PEOPLE - 1, 30, "a");
    expect(axisRank("big5", "O", 90)).toBeNull();
  });

  it("states the basis it counted over", () => {
    L.enabled = true;
    L.kindredPeople = () => crowd(NORM_MIN_PEOPLE, 30, "a");
    const rank = axisRank("big5", "O", 90);
    expect(rank).toEqual({ outOfTen: 9, people: NORM_MIN_PEOPLE, above: true });
  });

  it("reads the low side as a low-side share, not its complement", () => {
    // 8 of 20 below you → you are under the median, and the sentence is
    // "lower than 6 in 10", not "higher than 4 in 10".
    L.enabled = true;
    L.kindredPeople = () => [...crowd(8, 10, "lo"), ...crowd(12, 90, "hi")];
    const rank = axisRank("big5", "O", 50);
    expect(rank?.above).toBe(false);
    expect(rank?.outOfTen).toBe(6);
  });

  it("never claims 10 in 10 or 0 in 10", () => {
    L.enabled = true;
    L.kindredPeople = () => crowd(20, 10, "a");
    expect(axisRank("big5", "O", 99)?.outOfTen).toBe(9);
    L.kindredPeople = () => crowd(20, 99, "a");
    expect(axisRank("big5", "O", 1)?.outOfTen).toBe(9);
  });

  it("is empty in a demo build — the sample is a live cache", () => {
    L.enabled = false;
    L.kindredPeople = () => crowd(50, 30, "a");
    expect(sampleAxes("big5")).toEqual([]);
    expect(axisRank("big5", "O", 90)).toBeNull();
  });

  it("ignores people with no readable value on the axis", () => {
    L.enabled = true;
    L.kindredPeople = () => [
      ...crowd(NORM_MIN_PEOPLE, 10, "a"),
      ...Array.from({ length: 40 }, (_, i) => person({ C: 50 }, `c${i}`)),
    ];
    expect(axisRank("big5", "O", 90)?.people).toBe(NORM_MIN_PEOPLE);
  });
});
