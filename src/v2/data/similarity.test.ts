// The similarity folds (D112): place score profiles, person score
// matching, and the ranking that puts scores first. Every case here is a
// claim the constellation fields make to a user's face — "closer = more
// like you", "this city averages 62 on Openness" — so the arithmetic is
// pinned the way cohort.ts's folds are: exact numbers, absent-vs-zero
// distinguished, and refusals asserted as refusals rather than zeros.

import { describe, expect, it } from "vitest";
import { agreementOf, divisiveness } from "./cohort";
import {
  angleHash,
  axisScores,
  flattenAxes,
  MIN_PLACE_AXES,
  myAxisScores,
  myFlatAxes,
  parseTestResults,
  pickKindredQids,
  placeProfiles,
  rankKindred,
  scoreMatch,
  testItemMeta,
  voteIndices,
  type KindredPerson,
  type ParsedResults,
  type TestDefs,
} from "./similarity";

// Two miniature instruments in IS_TESTS' exact shape — small enough to
// hand-compute, wide enough to exercise inverts and cross-test flattening.
const DEFS: TestDefs = {
  big5: {
    title: "Big Five",
    dims: [
      { id: "O", label: "Openness" },
      { id: "C", label: "Conscientiousness" },
    ],
    questions: [
      { q: "New ideas beat familiar ones.", d: "O" },
      { q: "I stick with what works.", d: "O", invert: true },
      { q: "I keep appointments.", d: "C" },
    ],
  },
  values: {
    title: "Values",
    dims: [{ id: "future", label: "Future" }],
    questions: [{ q: "Tomorrow will be better.", d: "future" }],
  },
};

const LIKERT5 = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const BANK = [
  { id: "test-big5-00", prompt: "New ideas beat familiar ones.", test: "big5", options: LIKERT5 },
  { id: "test-big5-01", prompt: "I stick with what works.", test: "big5", options: LIKERT5 },
  { id: "test-big5-02", prompt: "I keep appointments.", test: "big5", options: LIKERT5 },
  { id: "test-values-00", prompt: "Tomorrow will be better.", test: "values", options: LIKERT5 },
];

const ITEMS = testItemMeta(BANK, DEFS);

describe("testItemMeta — the prompt-text join", () => {
  it("joins on prompt and carries the invert flag", () => {
    expect(ITEMS).toHaveLength(4);
    const inv = ITEMS.find((i) => i.qid === "test-big5-01");
    expect(inv).toMatchObject({ test: "big5", dim: "O", invert: true });
    const straight = ITEMS.find((i) => i.qid === "test-big5-00");
    expect(straight).toMatchObject({ dim: "O", invert: false });
  });

  it("drops a drifted prompt rather than scoring it as-keyed", () => {
    // A bank item whose wording no longer matches the definitions could be
    // a reworded invert — scoring it straight would poison the axis. The
    // gate that keeps the sources aligned is content-parity; this is the
    // failure mode if it ever lapses.
    const drifted = testItemMeta(
      [{ id: "x", prompt: "Reworded beyond recognition.", test: "big5", options: LIKERT5 }],
      DEFS,
    );
    expect(drifted).toHaveLength(0);
  });

  it("keeps lens items (test: null) and odd shapes out", () => {
    const out = testItemMeta(
      [
        { id: "lq-moral-0", prompt: "New ideas beat familiar ones.", test: null, options: LIKERT5 },
        { id: "test-big5-00", prompt: "New ideas beat familiar ones.", test: "big5", options: ["Yes", "No"] },
      ],
      DEFS,
    );
    expect(out).toHaveLength(0);
  });
});

describe("axisScores — a cohort's mean, personal-scorer normalised", () => {
  it("folds counts per answer, flipping inverted items", () => {
    // Item 00 (straight): 2 answers at "Strongly agree" (idx 4) → norm 8.
    // Item 01 (invert):   2 answers at "Strongly disagree" (idx 0) → 4-0=4 each, norm 8.
    // O axis: 16 / (4 × 4 answers) = 1.0 → 100.
    const cells: Record<string, number[]> = {
      "test-big5-00": [0, 0, 0, 0, 2],
      "test-big5-01": [2, 0, 0, 0, 0],
    };
    const out = axisScores("big5", DEFS.big5, ITEMS, (qid) => cells[qid] || null);
    expect(out).toEqual([
      { dim: "O", label: "Openness", value: 100, n: 4, items: 2 },
    ]);
  });

  it("omits an axis nobody answered rather than inventing a 50", () => {
    // The personal scorer's neutral default is about resuming a sit-down
    // test; a cohort with no data is absence, and absence is not a middle
    // opinion.
    const out = axisScores("big5", DEFS.big5, ITEMS, (qid) =>
      qid === "test-big5-02" ? [0, 1, 2, 1, 0] : null);
    expect(out.map((a) => a.dim)).toEqual(["C"]);
    expect(out[0].value).toBe(50); // mean idx 2 of 0..4 → 50, from real answers
  });

  it("weights per answer, so a two-answer item cannot outvote two hundred", () => {
    const cells: Record<string, number[]> = {
      "test-big5-00": [0, 0, 0, 0, 200], // 200 × norm 4
      "test-big5-01": [0, 0, 2, 0, 0],   // 2 × norm 2 (invert of idx 2 = 2)
    };
    const out = axisScores("big5", DEFS.big5, ITEMS, (qid) => cells[qid] || null);
    // (800 + 4) / (4 × 202) = 0.995… → 100 after rounding.
    expect(out[0]).toMatchObject({ value: 100, n: 202, items: 2 });
  });

  it("matches the personal scorer exactly for a single person (myAxisScores)", () => {
    // scoreTest: norm = invert ? 4-v : v, axis mean / 4 × 100, rounded.
    // Answers: item00 = 3, item01 = 1 (invert → 3), item02 = 0.
    const votes = { "test-big5-00": 3, "test-big5-01": 1, "test-big5-02": 0 };
    const out = myAxisScores("big5", DEFS.big5, ITEMS, votes);
    expect(out).toEqual([
      { dim: "O", label: "Openness", value: 75, n: 2, items: 2 },
      { dim: "C", label: "Conscientiousness", value: 0, n: 1, items: 1 },
    ]);
  });
});

describe("parseTestResults — the defensive read of a public field", () => {
  it("keeps valid axes and clamps the absurd", () => {
    const parsed = parseTestResults({
      big5: { dims: [
        { id: "O", value: 78.4 },
        { id: "C", value: 4e9 },
        { id: "E", value: -3 },
        { id: "N", value: "not a number" },
      ] },
    }, ["big5"]);
    expect(parsed).toEqual({ big5: { O: 78, C: 100, E: 0 } });
  });

  it("returns null when nothing usable survives", () => {
    expect(parseTestResults(null, ["big5"])).toBeNull();
    expect(parseTestResults("junk", ["big5"])).toBeNull();
    expect(parseTestResults({ big5: { dims: "junk" } }, ["big5"])).toBeNull();
    expect(parseTestResults({ hostile: { dims: [{ id: "x", value: 50 }] } }, ["big5"])).toBeNull();
  });

  it("bounds a thousand-entry dims array instead of walking it", () => {
    const dims = Array.from({ length: 1000 }, (_, i) => ({ id: `d${i}`, value: 50 }));
    const parsed = parseTestResults({ big5: { dims } }, ["big5"]);
    expect(Object.keys(parsed?.big5 || {}).length).toBeLessThanOrEqual(12);
  });
});

describe("scoreMatch — one hundred minus the average gap", () => {
  it("is the sentence it claims to be", () => {
    const m = scoreMatch(
      { "big5:O": 70, "big5:C": 50, "values:future": 40 },
      { "big5:O": 80, "big5:C": 50, "values:future": 10 },
      3,
    );
    // gaps 10, 0, 30 → mean 13.33 → 87. This is the PRINTED number and
    // D277 §2 did not move it: the sentence on the card is still exactly
    // this arithmetic.
    expect(m).toMatchObject({ match: 87, axes: 3, tests: 2 });
    // …and the sort key beside it, which nobody is shown:
    // (40 + 6×17) / (3 + 6) = 15.78 → 84.22.
    expect(m!.raw).toBeCloseTo(84.22, 2);
  });

  it("refuses below minAxes rather than matching on a coin toss", () => {
    expect(scoreMatch({ "big5:O": 70 }, { "big5:O": 70 }, 3)).toBeNull();
  });
});

describe("rankKindred — scores first, agreement as the fallback", () => {
  const person = (uid: string, over: Partial<KindredPerson>): KindredPerson => ({
    uid, name: uid, city: "Oslo, NO",
    like: agreementOf(2, 4),
    results: null,
    ...over,
  });
  const MINE = { big5: { O: 70, C: 50, E: 40, A: 60, N: 45 } };

  it("puts every scored person above every unscored one", () => {
    const out = rankKindred([
      person("agree99", { like: agreementOf(10, 10) }),
      person("scored", { results: { big5: { O: 0, C: 100, E: 90, A: 10, N: 95 } } }),
    ], MINE);
    // The scored person's match is poor (gaps 70,50,50,50,50 → mean 54 →
    // 46) and still ranks first: "primarily by test scores" is an
    // ordering rule, not a tie-break.
    expect(out.map((p) => p.uid)).toEqual(["scored", "agree99"]);
    expect(out[0].score?.match).toBe(46);
  });

  it("filters by frozen city when asked", () => {
    const out = rankKindred([
      person("oslo", {}),
      person("bergen", { city: "Bergen, NO" }),
    ], MINE, { city: "Oslo, NO", minShared: 1 });
    expect(out.map((p) => p.uid)).toEqual(["oslo"]);
  });

  it("holds unscored people to minShared, but never the scored", () => {
    const out = rankKindred([
      person("thin", { like: agreementOf(1, 1) }),
      person("thinScored", {
        like: agreementOf(0, 0),
        results: { big5: { O: 70, C: 50, E: 40, A: 60, N: 45 } },
      }),
    ], MINE, { minShared: 2 });
    // One shared answer is a coin flip — out. A whole shared instrument
    // is five axes of signal — in, even with no shared answers at all.
    expect(out.map((p) => p.uid)).toEqual(["thinScored"]);
    expect(out[0].score?.match).toBe(100);
  });

  it("needs a whole shared instrument for a score — one axis is not enough", () => {
    const out = rankKindred([
      person("partial", { results: { values: { future: 50 } } }),
    ], MINE, { minShared: 1 });
    // I have big5 only, they have values only: no shared instrument, so
    // they rank on agreement with score null.
    expect(out[0].score).toBeNull();
  });
});

describe("placeProfiles — cities and countries get real score profiles", () => {
  // Two cities on one item, one city on a second — the union must carry
  // all buckets, and per-place folds must not leak across keys.
  const AGGS: Record<string, { by?: Record<string, Record<string, Record<string, number>>> }> = {
    "test-big5-00": { by: { city: {
      "Oslo, NO": { "4": 2 },            // idx4 ×2 → O = 100
      "Bergen, NO": { "0": 1 },          // idx0 → O = 0
    } } },
    "test-big5-02": { by: { city: {
      "Oslo, NO": { "2": 4 },            // C = 50
    } } },
    "test-values-00": { by: { city: {
      "Oslo, NO": { "0": 1, "4": 1 },    // future = 50
      "Trondheim, NO": { "3": 2 },       // future = 75
    } } },
  };
  const aggOf = (qid: string) => AGGS[qid] || null;

  it("profiles every bucket and scores only above MIN_PLACE_AXES", () => {
    const my = { "big5:O": 80, "big5:C": 60, "values:future": 50 };
    const out = placeProfiles(ITEMS, DEFS, aggOf, "city", my);
    const oslo = out.find((p) => p.key === "Oslo, NO");
    // Oslo has 3 shared axes → scored: gaps |100-80|, |50-60|, |50-50| →
    // mean 10 → 90 printed; (30 + 6×17) / (3 + 6) = 14.67 → 85.33 to sort on.
    expect(oslo?.score).toMatchObject({ match: 90, axes: 3, tests: 2 });
    expect(oslo!.score!.raw).toBeCloseTo(85.33, 2);
    expect(oslo?.byTest.big5).toEqual([
      { dim: "O", label: "Openness", value: 100, n: 2, items: 1 },
      { dim: "C", label: "Conscientiousness", value: 50, n: 4, items: 1 },
    ]);
    // Bergen and Trondheim each share one axis — profiled, not scored.
    expect(out.find((p) => p.key === "Bergen, NO")?.score).toBeNull();
    expect(out.find((p) => p.key === "Trondheim, NO")?.score).toBeNull();
    // Scored first, then thin places by size — nobody vanishes.
    expect(out[0].key).toBe("Oslo, NO");
    expect(out).toHaveLength(3);
    expect(MIN_PLACE_AXES).toBe(3);
  });

  it("applies the bucket filter (a country's own cities only)", () => {
    const out = placeProfiles(ITEMS, DEFS, aggOf, "city", null, (k) => k.endsWith(", NO"));
    expect(out.map((p) => p.key).sort()).toEqual(["Bergen, NO", "Oslo, NO", "Trondheim, NO"]);
    const foreign = placeProfiles(ITEMS, DEFS, aggOf, "city", null, (k) => k.endsWith(", SE"));
    expect(foreign).toHaveLength(0);
  });

  it("computes with no viewer at all — profiles are the product, likeness is the extra", () => {
    const out = placeProfiles(ITEMS, DEFS, aggOf, "city", null);
    expect(out.every((p) => p.score === null)).toBe(true);
    expect(out[0].n).toBeGreaterThan(0);
  });

  // ── the D169 rewrite, pinned against what it replaced ──────────────
  //
  // placeProfiles was inverted from bucket-major to item-major so it
  // visits only the cells that exist (see the comment there for the
  // measurement). The cases above are hand-computed and would still pass
  // against a fold that agreed on three cities and diverged on the
  // fourth, so the refactor gets the guard a refactor actually wants: the
  // OLD implementation, kept here verbatim, run beside the new one on
  // randomised aggregates. If they ever disagree — on values, on which
  // buckets survive, on ordering — this fails naming the seed.
  const legacyPlaceProfiles = (
    items: typeof ITEMS_META,
    defs: TestDefs,
    of: (qid: string) => { by?: Record<string, Record<string, Record<string, number>>> } | null,
    dim: "city" | "country",
    myFlat: Record<string, number> | null,
    filter?: (key: string) => boolean,
  ) => {
    const buckets = new Set<string>();
    for (const it of items) {
      const byDim = of(it.qid)?.by?.[dim];
      if (!byDim) continue;
      for (const key of Object.keys(byDim)) {
        if (!filter || filter(key)) buckets.add(key);
      }
    }
    const out = [];
    for (const key of buckets) {
      const cellOf = (qid: string): number[] | null => {
        const cell = of(qid)?.by?.[dim]?.[key];
        if (!cell) return null;
        return Array.from({ length: 5 }, (_, i) => cell[String(i)] || 0);
      };
      const byTest: Record<string, ReturnType<typeof axisScores>> = {};
      const flat: Record<string, number> = {};
      let n = 0;
      for (const kind of Object.keys(defs)) {
        const axes = axisScores(kind, defs[kind], items, cellOf);
        if (!axes.length) continue;
        byTest[kind] = axes;
        for (const a of axes) {
          flat[`${kind}:${a.dim}`] = a.value;
          n += a.n;
        }
      }
      if (!n) continue;
      out.push({ key, byTest, n, score: myFlat ? scoreMatch(myFlat, flat, MIN_PLACE_AXES) : null });
    }
    return out.sort((a, b) => {
      if (!!a.score !== !!b.score) return a.score ? -1 : 1;
      if (a.score && b.score) return b.score.match - a.score.match || b.n - a.n;
      return b.n - a.n || a.key.localeCompare(b.key);
    });
  };

  const ITEMS_META = ITEMS;

  it("is identical to the pre-D169 fold on randomised aggregates", () => {
    // Deterministic PRNG — a failure has to be reproducible from the seed
    // printed in the message, not from "it went red once on CI".
    let seed = 0x2f6e2b1;
    const rnd = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let round = 0; round < 40; round++) {
      const nCities = 1 + Math.floor(rnd() * 12);
      const aggs: Record<string, { by?: Record<string, Record<string, Record<string, number>>> }> = {};
      for (const it of ITEMS_META) {
        // A third of items carry no aggregate at all, and a bucket may be
        // all-zero or sparse — the three states the fold treats
        // differently (absent, empty, partial).
        if (rnd() < 0.33) continue;
        const city: Record<string, Record<string, number>> = {};
        for (let c = 0; c < nCities; c++) {
          if (rnd() < 0.4) continue;
          const cell: Record<string, number> = {};
          for (let i = 0; i < 5; i++) if (rnd() < 0.6) cell[String(i)] = Math.floor(rnd() * 9);
          city[`City${c}, NO`] = cell;
        }
        aggs[it.qid] = { by: { city } };
      }
      const of = (qid: string) => aggs[qid] || null;
      const my = rnd() < 0.5
        ? null
        : { "big5:O": Math.floor(rnd() * 101), "big5:C": Math.floor(rnd() * 101),
          "values:future": Math.floor(rnd() * 101) };
      const filter = rnd() < 0.25 ? (k: string) => k.endsWith("0, NO") : undefined;
      expect(
        placeProfiles(ITEMS_META, DEFS, of, "city", my, filter),
        `round ${round} (seed 0x2f6e2b1)`,
      ).toEqual(legacyPlaceProfiles(ITEMS_META, DEFS, of, "city", my, filter));
    }
  });

  // The one input shape the randomised rounds CANNOT reach: their items
  // come from testItemMeta, which only ever emits tests present in
  // `defs`. It is also the only place the two WALKS differ — the rewrite
  // skips such an item outright, where the old fold let it put its bucket
  // keys into the union and then scored nothing from them.
  //
  // The outputs agree anyway, and it is worth being exact about why:
  // the emit loop iterates `Object.keys(defs)`, so a bucket carrying only
  // an unknown instrument produces no axes, totals zero and is dropped at
  // the `if (!n)`. Verified by deleting the `defs[it.test]` guard and
  // watching this still pass — it is an optimisation, NOT load-bearing,
  // and a future reader should not preserve it thinking otherwise.
  it("drops a bucket reachable only from an item whose test is not in defs", () => {
    const stray = [...ITEMS_META, { qid: "q_stray", test: "not_an_instrument", dim: "X", invert: false }];
    const withStray: typeof AGGS = {
      ...AGGS,
      q_stray: { by: { city: { "Nowhere, XX": { "4": 9 } } } },
    };
    const of = (qid: string) => withStray[qid] || null;
    const mine = { "big5:O": 50, "big5:C": 50, "values:future": 50 };
    const out = placeProfiles(stray, DEFS, of, "city", mine);
    expect(out).toEqual(legacyPlaceProfiles(stray, DEFS, of, "city", mine));
    // …and that agreement is not two empty lists: the real cities profile,
    // and the stray item's city is absent from both.
    expect(out.map((p) => p.key)).toContain("Oslo, NO");
    expect(out.map((p) => p.key)).not.toContain("Nowhere, XX");
  });
});

describe("myFlatAxes — instruments first, own answers fill the gaps", () => {
  it("prefers a completed result and folds votes for the missing kind", () => {
    const flat = myFlatAxes(
      { big5: { O: 70, C: 55 } },
      ITEMS,
      DEFS,
      { "test-values-00": 4, "test-big5-00": 0 }, // big5 vote must NOT override the result
    );
    expect(flat).toEqual({ "big5:O": 70, "big5:C": 55, "values:future": 100 });
  });

  it("is null with neither — the field says so instead of centring a ghost", () => {
    expect(myFlatAxes(null, ITEMS, DEFS, {})).toBeNull();
  });
});

// D132. The bug this pins was not in the arithmetic — every fold above was
// right — it was in the one line that hands the store's vote map to it.
// `LIVE.myVotes()` is `{ qid: "2" }`, the scorers ask `Number.isInteger`,
// and `Number.isInteger("2")` is false: the profile told a user who had
// answered thirty questions "0 of 30 answered", on every instrument,
// permanently. The conversion existed and was correct in ONE of the two
// call sites, which is why it read as fine.
describe("voteIndices — the store's strings, as the folds want them", () => {
  it("coerces the shape LIVE.myVotes() actually returns", () => {
    expect(voteIndices({ a: "0", b: "2", c: "4" })).toEqual({ a: 0, b: 2, c: 4 });
  });

  it("passes numbers through, so a converted caller may convert twice", () => {
    expect(voteIndices({ a: 3 })).toEqual({ a: 3 });
  });

  it("drops what is not an answer rather than coercing it to one", () => {
    // "" → Number("") is 0, which would score as a strong disagree; the
    // rest are out of the 0..4 agreement axis the instruments are written
    // on, and a dial/field answer keyed by qid is exactly how one arrives.
    expect(voteIndices({ blank: "", high: "5", neg: "-1", frac: "1.5", junk: "abc" }))
      .toEqual({});
  });

  it("folds a string-valued map to the same scores as a numeric one", () => {
    const strings = myAxisScores("big5", DEFS.big5, ITEMS,
      voteIndices({ "test-big5-00": "4", "test-big5-01": "0", "test-big5-02": "3" }));
    const numbers = myAxisScores("big5", DEFS.big5, ITEMS,
      { "test-big5-00": 4, "test-big5-01": 0, "test-big5-02": 3 });
    expect(strings).toEqual(numbers);
    // …and that is not two empty arrays agreeing with each other.
    expect(strings.length).toBe(2);
  });
});

describe("angleHash — stable layout, no wall clock", () => {
  it("is deterministic and in [0, 1)", () => {
    expect(angleHash("u_abc")).toBe(angleHash("u_abc"));
    for (const id of ["a", "b", "Oslo, NO", "test-big5-00", ""]) {
      const h = angleHash(id);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it("flattenAxes namespaces by test so same-named dims cannot collide", () => {
    expect(flattenAxes({ a: { x: 1 }, b: { x: 2 } })).toEqual({ "a:x": 1, "b:x": 2 });
  });
});

// ── the width bias, and the property that catches it (D277 §2) ───────
//
// Nothing in this file compared two candidates measured over DIFFERENT
// numbers of axes, which is why `100 − gap/axes` could rank them against
// each other for as long as it did. A mean of three draws is far noisier
// than a mean of twenty-two, and the top of a ranked list is where noise
// collects — so the "most like you" slot went, structurally, to whoever
// you shared fewest axes with.
describe("rankKindred — a thin comparison must not win on noise", () => {
  const MINE = {
    big5: { O: 50, C: 50, E: 50, A: 50, N: 50 },
    values: { future: 50, order: 50, care: 50, self: 50, norms: 50, risk: 50 },
  };
  const p = (uid: string, results: KindredPerson["results"]): KindredPerson => ({
    uid, name: uid, city: "Oslo, NO", like: agreementOf(2, 4), results,
  });

  it("prefers the wider comparison when the average gap is identical", () => {
    // Both are 10 points off on every shared axis, so `match` is the same
    // 90 for each and cannot separate them. One is measured over five
    // axes, the other over eleven; the eleven-axis reading is the better
    // evidenced one and must go first.
    const five = p("five", { big5: { O: 60, C: 60, E: 60, A: 60, N: 60 } });
    const eleven = p("eleven", {
      big5: { O: 60, C: 60, E: 60, A: 60, N: 60 },
      values: { future: 60, order: 60, care: 60, self: 60, norms: 60, risk: 60 },
    });
    const out = rankKindred([five, eleven], MINE);
    expect(out[0].score!.match).toBe(out[1].score!.match); // the printed number ties…
    expect(out.map((x) => x.uid)).toEqual(["eleven", "five"]); // …the order does not.
  });

  it("still prefers the closer person at equal width", () => {
    // The shrinkage must not invert the metric — it discounts width, not
    // agreement. Same five axes, one strictly nearer on every one.
    const near = p("near", { big5: { O: 52, C: 52, E: 52, A: 52, N: 52 } });
    const far = p("far", { big5: { O: 70, C: 70, E: 70, A: 70, N: 70 } });
    expect(rankKindred([far, near], MINE).map((x) => x.uid)).toEqual(["near", "far"]);
  });

  it("is monotone: strictly closer on every shared axis ranks higher", () => {
    // The general form of the case above, over every width the four
    // instruments can produce. A regression that reintroduced the raw mean
    // would still pass this; a regression that inverted the prior's sign
    // would not, and that is the failure mode a hand-tuned constant has.
    for (let axes = 5; axes <= 11; axes++) {
      const mk = (offset: number): ParsedResults => {
        const big5: Record<string, number> = {};
        const values: Record<string, number> = {};
        for (let i = 0; i < axes; i++) {
          const key = ["O", "C", "E", "A", "N"][i] ?? ["future", "order", "care", "self", "norms", "risk"][i - 5];
          (i < 5 ? big5 : values)[key] = 50 + offset;
        }
        return Object.keys(values).length ? { big5, values } : { big5 };
      };
      const out = rankKindred([p("far", mk(20)), p("near", mk(5))], MINE);
      expect(out.map((x) => x.uid), `axes=${axes}`).toEqual(["near", "far"]);
    }
  });

  it("does not let rounding hand the top slot to whoever sorts first by uid", () => {
    // `match` collapses a pool onto ~20 integers, so ties were common and
    // were broken by `uid.localeCompare` — alphabetically. `raw` is
    // unrounded, so two candidates that merely round together still order
    // by their actual distance.
    // gaps 3 and 4 over five axes → means 0.6 and 0.8 → both round to 99.
    const a = p("zzz", { big5: { O: 50, C: 50, E: 50, A: 50, N: 53 } });
    const b = p("aaa", { big5: { O: 50, C: 50, E: 50, A: 50, N: 54 } });
    const out = rankKindred([b, a], MINE);
    expect(out[0].score!.match).toBe(99);
    expect(out[1].score!.match).toBe(99); // the printed number cannot separate them…
    expect(out[0].uid).toBe("zzz"); // …and the nearer one still wins, not the alphabetical one.
  });
});

// ── which twelve questions the pool is built from (D277 §2) ──────────
//
// loadKindred had no test at all: grepping it across src/ finds only
// mocks and call-count assertions, which is how a `.slice(0, 12)` could
// sit under a comment describing a completely different selection for as
// long as it did.
describe("pickKindredQids — chosen, not inherited", () => {
  const flat = () => 0;

  it("does not depend on the order the votes were inserted", () => {
    // The actual defect: Object.keys order froze at the first cold boot,
    // and the warm and cold boot paths produce opposite orders — so the
    // same account ranked strangers differently on a second device.
    const a: Record<string, string> = { "daily-003": "1", "daily-001": "0", "daily-002": "2" };
    const b: Record<string, string> = { "daily-002": "2", "daily-003": "1", "daily-001": "0" };
    expect(pickKindredQids(a, flat, 3)).toEqual(pickKindredQids(b, flat, 3));
  });

  it("prefers a 50/50 question over a 95/5 one", () => {
    // Agreeing on a question almost everyone answers the same way is
    // nearly no evidence about two people. `divisiveness` has measured
    // that since D99 and had never picked anything.
    const votes = { split: "0", lopsided: "1" };
    const score = (qid: string) => divisiveness(qid === "split" ? [50, 50] : [95, 5]);
    expect(pickKindredQids(votes, score, 1)).toEqual(["split"]);
  });

  it("drops catalog and rank answers, which return rows the fold discards", () => {
    // Both live on a surface the voter query accepts, so each one spent a
    // slot on a collection-group read whose every row was then thrown away
    // for want of a numeric optionIdx.
    const votes = { "feed-vote": "2", "feed-catalog": "1041", "feed-rank": "2,0,1", "feed-empty": "" };
    // The VALUE filter reaches the joined order and the empty string. It
    // cannot reach the catalog pick: 1041 is a dex number, and stringified
    // it is indistinguishable from an option index.
    expect(pickKindredQids(votes, flat, 9)).not.toContain("feed-rank");
    expect(pickKindredQids(votes, flat, 9)).not.toContain("feed-empty");
    // …so the bank answers instead. This gap used to be written down here
    // rather than closed, and it cost real slots: divisivenessOf returns -1
    // for every question on a young account, so ties break alphabetically
    // and a catalog qid wins a slot outright — then buys a collection-group
    // read whose every row voters.ts discards. Twice over, since
    // loadCityKindred picks from the same map.
    const bankSays = (qid: string) => qid !== "feed-catalog";
    expect(pickKindredQids(votes, flat, 9, bankSays)).toEqual(["feed-vote"]);
  });

  it("keeps a qid the caller cannot resolve, rather than shrinking the pool", () => {
    // The banks are what the device has cached, so a question answered
    // before a refresh can be missing from all of them. Dropping it would
    // be a worse failure than the one the predicate exists to fix.
    const votes = { "daily-001": "1", "daily-002": "0" };
    expect(pickKindredQids(votes, flat, 9, () => true)).toEqual(["daily-001", "daily-002"]);
    // …and the default is exactly that, so the pure callers are unchanged.
    expect(pickKindredQids(votes, flat, 9)).toEqual(["daily-001", "daily-002"]);
  });

  it("never spends a slot on a sealed duel answer", () => {
    const votes = { "g_grp1_2026-08-24": "0", "daily-001": "1" };
    expect(pickKindredQids(votes, flat, 9)).toEqual(["daily-001"]);
  });

  it("fills the quota for an account whose aggregates have not landed", () => {
    // scoreOf returns -1 for an unmeasured question. A measured one must
    // outrank it, and an account with none must still get its twelve.
    const votes = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`q${i}`, "1"]));
    expect(pickKindredQids(votes, () => -1, 12)).toHaveLength(12);
    const oneKnown = (qid: string) => (qid === "q19" ? 0.9 : -1);
    expect(pickKindredQids(votes, oneKnown, 12)[0]).toBe("q19");
  });

  it("is stable across two reads of the same aggregates", () => {
    const votes = { a: "1", b: "1", c: "1" };
    const score = () => 0.5; // every question equally divisive
    expect(pickKindredQids(votes, score, 2)).toEqual(pickKindredQids(votes, score, 2));
  });
});
