// The gate that decides when the reading game exists at all (D195).
//
// Two things are worth pinning here, and both are the difference between
// a game and a scoreboard nobody should believe: the pool has to be deep
// enough to produce a record, and a question with no published breakdown
// must be DROPPED rather than zero-filled.
import { describe, expect, it } from "vitest";
import { READ_MIN_POOL, readSourcesFrom, readsReady } from "./gamesReady";
import { COHORT_DIMS } from "./cohort";
import type { AggDoc, LiveQuestion } from "./deck";

const BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

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

  it("carries the same counts the card behind it draws", () => {
    const [src] = readSourcesFrom([q("a")], () => agg(2));
    expect(src.counts).toEqual([60, 40]);
    expect(src.options).toEqual(["Yes", "No"]);
  });

  it("drops an aggregate that exists but has no `by` at all", () => {
    expect(readSourcesFrom([q("a")], () => ({ counts: { "0": 5 }, total: 5 }))).toHaveLength(0);
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
