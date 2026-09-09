// The gate that decides when the reading game exists at all (D196).
//
// Two things are worth pinning here, and both are the difference between
// a game and a scoreboard nobody should believe: the pool has to be deep
// enough to produce a record, and a question with no published breakdown
// must be DROPPED rather than zero-filled.
import { describe, expect, it } from "vitest";
import { READ_MIN_POOL, readSourcesFrom, readsReady } from "./gamesReady";
import { readsFrom } from "./foresight";
import { COHORT_DIMS } from "./cohort";
import type { AggDoc, LiveQuestion } from "./deck";

const BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

/** The same question with the card's own option counts set explicitly —
 * what the viewer sees, which is the published count minus their vote. */
function qWith(id: string, counts: readonly number[]): LiveQuestion {
  const base = q(id);
  return { ...base, options: base.options.map((o, i) => ({ ...o, count: counts[i] })) };
}

function q(id: string): LiveQuestion {
  return {
    id, cat: "culture", text: `Question ${id}`, dayLabel: "Today",
    options: [
      { id: "0", label: "Yes", count: 60, color: "" },
      { id: "1", label: "No", count: 40, color: "" },
    ],
    comments: [], friends: [], live: true, noCountsYet: false, coreCorpus: true,
  };
}

/** A breakdown with `n` decisive age bands — each well past READ_MIN_N and
 * well past READ_MIN_LEAD, so every one is a fair read. */
function agg(bands: number): AggDoc {
  const cells: Record<string, Record<string, number>> = {};
  for (let i = 0; i < bands; i++) cells[BANDS[i % BANDS.length]] = { "0": 30, "1": 4 };
  return { counts: { "0": 60, "1": 40 }, total: 100, by: { ageBand: cells } };
}

describe("readSourcesFrom", () => {
  it("drops a question with no published breakdown rather than zero-filling it", () => {
    // A zero-filled source is a question the game could ASK and never
    // score — the exact shape D1 refuses everywhere else.
    const src = readSourcesFrom([q("a"), q("b")], (id) => (id === "a" ? agg(2) : null));
    expect(src.map((s) => s.id)).toEqual(["a"]);
  });

  it("carries the PUBLISHED counts, not the card's — they are different populations", () => {
    // The card's counts have the viewer's own vote subtracted (countsFor
    // in ./deck, so the UI can add its own +1 for "you"); a published `by`
    // cell does not. Taking one from each compares an overall without you
    // against slices with you in them. The fixture below made both 60/40,
    // which is why this assertion used to pass either way.
    const [src] = readSourcesFrom([qWith("a", [58, 40])], () => agg(2));
    expect(src.counts, "the card's numbers reached the engine").toEqual([60, 40]);
    expect(src.options).toEqual(["Yes", "No"]);
  });

  it("drops an aggregate whose cells are not option indexes at all", () => {
    // A catalog or rank aggregate has a `by` and no `counts`. Zero-filling
    // it would offer a question the game can ask and never score — the
    // same refusal as the no-aggregate case above.
    expect(readSourcesFrom([q("a")], () => ({ total: 9, by: { ageBand: { "25-34": { pikachu: 9 } } } })))
      .toHaveLength(0);
  });

  it("drops an aggregate that exists but has no `by` at all", () => {
    expect(readSourcesFrom([q("a")], () => ({ counts: { "0": 5 }, total: 5 }))).toHaveLength(0);
  });
});

describe("the read game does not call the crowd disagreeing with itself a surprise", () => {
  // THE COMPOSITION, which neither half's own tests reach. One bucket
  // holding exactly the people in the whole crowd cannot be a surprise
  // against them — and it was, on the ordinary case where the viewer has
  // voted and the trigger has folded it in.
  //
  // Nine answers, 4/5, the viewer on the winning side. The card draws
  // [4, 4] — its own vote subtracted — so the card's top is option 0 by
  // the tie rule while the published top is option 1. Every threshold is
  // cleared deliberately: n = 9 over READ_MIN_N 8, and 56-44 = 12 points
  // exactly meets READ_MIN_LEAD, so the read is offered and its verdict
  // is what is under test.
  const SAME_PEOPLE: AggDoc = {
    counts: { "0": 4, "1": 5 },
    total: 9,
    by: { ageBand: { "25-34": { "0": 4, "1": 5 } } },
  };

  it("is not a surprise when the slice IS the whole crowd", () => {
    const src = readSourcesFrom([qWith("a", [4, 4])], () => SAME_PEOPLE);
    const [read] = readsFrom(src, ["ageBand"]);
    expect(read, "the read was refused before it could be judged").toBeTruthy();
    expect(read.n).toBe(9);
    expect(read.slicePct, "the slice and the overall must be the same numbers")
      .toEqual(read.overallPct);
    expect(read.surprise).toBe(false);
  });

  it("…and a slice that really does go the other way still is", () => {
    // THE CONTROL. Without it, an engine that never reports a surprise
    // passes the case above and the whole game stops meaning anything.
    const split: AggDoc = {
      counts: { "0": 4, "1": 5 },
      total: 9,
      by: { ageBand: { "25-34": { "0": 9, "1": 1 } } },
    };
    const src = readSourcesFrom([qWith("a", [4, 4])], () => split);
    const [read] = readsFrom(src, ["ageBand"]);
    expect(read).toBeTruthy();
    expect(read.answerIdx).toBe(0);
    expect(read.surprise).toBe(true);
  });
});

describe("readsReady", () => {
  it("is closed while the corpus is thin, however fair each individual read is", () => {
    // Two questions × two decisive bands is four fair reads. Every one of
    // them is scoreable — and four of them is not a game, which is the
    // whole point of having a second threshold above the per-read one.
    const src = readSourcesFrom([q("a"), q("b")], () => agg(2));
    const { ready, pool } = readsReady(src, COHORT_DIMS);
    expect(pool.length).toBe(4);
    expect(ready).toBe(false);
  });

  it("opens exactly at the threshold, not around it", () => {
    const src = readSourcesFrom([q("a"), q("b")], () => agg(6));
    const { pool } = readsReady(src, COHORT_DIMS);
    expect(pool.length).toBe(12);
    expect(readsReady(src, COHORT_DIMS, pool.length).ready).toBe(true);
    expect(readsReady(src, COHORT_DIMS, pool.length + 1).ready).toBe(false);
  });

  it("is closed on an empty corpus, which is the state at launch", () => {
    expect(readsReady([], COHORT_DIMS).ready).toBe(false);
  });

  it("uses READ_MIN_POOL by default", () => {
    expect(READ_MIN_POOL).toBeGreaterThan(1);
    const plenty = readSourcesFrom(
      Array.from({ length: 10 }, (_, i) => q(`q${i}`)),
      () => agg(6),
    );
    expect(readsReady(plenty, COHORT_DIMS).pool.length).toBeGreaterThanOrEqual(READ_MIN_POOL);
    expect(readsReady(plenty, COHORT_DIMS).ready).toBe(true);
  });
});
