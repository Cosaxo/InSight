// The fit's contract, pinned four ways:
//
//   1. DETERMINISM — the same log reproduces the same model bit for bit.
//      The seed is a hash of the qid and the clock never enters, so a
//      backlog replay after an incident cannot produce a second truth.
//   2. RECOVERY — answers generated from a known two-factor structure
//      come back out of the fit as that structure: same-factor question
//      pairs land materially closer (|cosine|) than cross-factor pairs.
//      This is the whole point of the module; a fit that cannot pass it
//      is publishing noise with eight decimal places.
//   3. HONESTY MECHANICS — a question's first answer carries no signal
//      (r = 0 by construction), the basis count n rides every published
//      loading, and the marginal is the fit's own running mean.
//   4. THE SCORECARD (D325) — the prequential score is one step ahead
//      (the model as it stood before each observation), a pure observer
//      of the fold, floored per question in what it publishes; the
//      displacement summary is publish-to-publish, unaligned, and exact.
import { describe, expect, it } from "vitest";
import {
  PATTERNS_K,
  PATTERNS_ETA_USER,
  PATTERNS_LAMBDA,
  patternsEtaQ,
  PATTERNS_MIN_BASIS,
  PATTERNS_QUALITY_DAYS,
  PATTERNS_QUALITY_FLOOR,
  displacementSummary,
  emptyDayScore,
  emptyModel,
  emptyUser,
  encodeAnswer,
  foldUserDay,
  loadingCosine,
  prequentialBits,
  publishableLoadings,
  publishableQuality,
  readyPool,
  seedLoading,
  seedsSummary,
  skillOf,
  type PatternsModel,
  type PatternsObservation,
} from "./patternsFit";

// A tiny deterministic LCG for the synthetic population — the fit itself
// uses no randomness; the TEST needs a reproducible crowd.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A synthetic world with two latent factors: questions a0..a4 load on
 * factor A, b0..b4 on factor B. Each person has a ±1 trait per factor and
 * answers each question with their trait's side 85% of the time. */
function syntheticDays(people: number, days: number) {
  const rand = lcg(7);
  const qs = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, f: 0 })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, f: 1 })),
  ];
  const traits = Array.from({ length: people }, () => [rand() < 0.5 ? 1 : -1, rand() < 0.5 ? 1 : -1]);
  // each day every person answers two random questions
  const byDay: { uid: number; obs: PatternsObservation[] }[][] = [];
  for (let d = 0; d < days; d++) {
    const day: { uid: number; obs: PatternsObservation[] }[] = [];
    for (let u = 0; u < people; u++) {
      const obs: PatternsObservation[] = [];
      for (let a = 0; a < 2; a++) {
        const q = qs[Math.floor(rand() * qs.length)];
        const side = rand() < 0.85 ? traits[u][q.f] : -traits[u][q.f];
        obs.push({ qid: q.id, x: side });
      }
      obs.sort((x, y) => (x.qid < y.qid ? -1 : 1));
      day.push({ uid: u, obs });
    }
    byDay.push(day);
  }
  return { qs, byDay };
}

function runFit(people: number, days: number, score?: ReturnType<typeof emptyDayScore>): PatternsModel {
  const { byDay } = syntheticDays(people, days);
  const model = emptyModel();
  const users = new Map<number, ReturnType<typeof emptyUser>>();
  for (const day of byDay) {
    for (const { uid, obs } of day) {
      const u = users.get(uid) ?? emptyUser();
      foldUserDay(model, u, obs, score);
      users.set(uid, u);
    }
  }
  return model;
}

describe("a revision moves the marginal without adding a person", () => {
  // `n` and `sum` are counts of PEOPLE. An edit is the same person saying
  // something else, so it is -old/+new on the sum and nothing at all on
  // the count — the same delta the aggregate counts take on an edit, for
  // the same reason. Theta still steps: that consequence is recorded as
  // considered and accepted where the edit trigger lives.
  const obs = (qid: string, x: number, prev?: number) =>
    (prev === undefined ? [{ qid, x }] : [{ qid, x, prev }]);

  it("leaves n alone and moves sum by the delta", () => {
    const model: PatternsModel = { k: PATTERNS_K, q: {} };
    const user = emptyUser(PATTERNS_K);
    foldUserDay(model, user, obs("q", -1));
    expect(model.q.q.n).toBe(1);
    expect(model.q.q.sum).toBe(-1);
    foldUserDay(model, user, obs("q", 1, -1));
    expect(model.q.q.n, "the population did not grow").toBe(1);
    expect(model.q.q.sum, "-old/+new, so the marginal is now +1").toBe(1);
    expect(user.n, "the person did not answer a second question either").toBe(1);
  });

  it("does not score a revision as a fresh prediction", () => {
    // The day's scorecard is a prequential score over answers the model
    // had not seen. Scoring an edit counts the same person twice there
    // too — the same error one level up.
    const model: PatternsModel = { k: PATTERNS_K, q: {} };
    const user = emptyUser(PATTERNS_K);
    const first = emptyDayScore();
    foldUserDay(model, user, obs("q", -1), first);
    expect(first.n).toBe(1);
    const second = emptyDayScore();
    foldUserDay(model, user, obs("q", 1, -1), second);
    expect(second.n).toBe(0);
    expect(second.perQ.q).toBeUndefined();
  });

  it("folds an edit whose first answer was never folded as a FIRST answer", () => {
    // The 0/0. A revision leaves `n` alone by design, so a revision on a
    // question this model has never folded an answer to computed
    // `sum / n` as 0/0 — NaN into the loading vector, NaN into the
    // person's theta, and from there into every other question they
    // answer on any later night. Firestore stores NaN as a valid double
    // and nothing downstream checks, so it would have published.
    //
    // Reachable on the first run after a deploy, where every question
    // starts at n = 0, and in the case the clamp below was written for.
    const model: PatternsModel = { k: PATTERNS_K, q: {} };
    const user = emptyUser(PATTERNS_K);
    foldUserDay(model, user, [{ qid: "q", x: 1, prev: -1 }]);
    const L = model.q.q;
    expect(L.n, "nothing to revise, so it counts as the person it is").toBe(1);
    expect(L.sum).toBe(1);
    expect(L.v.every((n) => Number.isFinite(n)), "the loading went NaN").toBe(true);
    expect(user.v.every((n) => Number.isFinite(n)), "the person's theta went NaN").toBe(true);
    expect(user.n).toBe(1);
  });

  it("clamps a marginal a revision would push past ±1", () => {
    // Only reachable when the FIRST answer was never folded — a create
    // outside the catch-up window, or one that predates the question
    // becoming eligible — where the subtraction removes something never
    // added. Every answer is ±1, so |sum| ≤ n is an invariant, not a
    // preference.
    const model: PatternsModel = { k: PATTERNS_K, q: {} };
    const user = emptyUser(PATTERNS_K);
    foldUserDay(model, user, obs("q", 1));          // n 1, sum +1
    foldUserDay(model, user, obs("q", 1, -1));      // +1 -(-1) = +2 → 3, clamped
    expect(model.q.q.n).toBe(1);
    expect(model.q.q.sum).toBe(1);
    expect(Math.abs(model.q.q.sum) <= model.q.q.n).toBe(true);
  });
});

describe("determinism", () => {
  it("the same log reproduces the same model bit for bit", () => {
    const a = runFit(60, 30);
    const b = runFit(60, 30);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("the seed comes from the qid alone", () => {
    expect(seedLoading("feed-f01")).toEqual(seedLoading("feed-f01"));
    expect(seedLoading("feed-f01")).not.toEqual(seedLoading("feed-f02"));
    for (const v of seedLoading("daily-000")) expect(Math.abs(v)).toBeLessThanOrEqual(0.05);
  });
});

describe("recovery", () => {
  it("finds the two-factor structure the crowd was generated from", () => {
    const model = runFit(120, 60);
    const cos = (i: string, j: string) => Math.abs(loadingCosine(model.q[i].v, model.q[j].v));
    let same = 0, sameN = 0, cross = 0, crossN = 0;
    const ids = ["a0", "a1", "a2", "a3", "a4", "b0", "b1", "b2", "b3", "b4"];
    for (const i of ids) for (const j of ids) {
      if (i >= j) continue;
      if (i[0] === j[0]) { same += cos(i, j); sameN++; }
      else { cross += cos(i, j); crossN++; }
    }
    const sameAvg = same / sameN;
    const crossAvg = cross / crossN;
    // Materially closer, not marginally: the generated structure is
    // strong (85% trait-following), so a working fit separates cleanly.
    expect(sameAvg).toBeGreaterThan(crossAvg + 0.2);
    expect(sameAvg).toBeGreaterThan(0.5);
  });
});

describe("honesty mechanics", () => {
  it("a question's first answer carries no signal beyond existing", () => {
    const model = emptyModel();
    const user = emptyUser();
    user.v = user.v.map((_, i) => (i === 0 ? 1 : 0)); // a person with a strong trait
    foldUserDay(model, user, [{ qid: "q-new", x: 1 }]);
    // r = x − mean = 0 on the first fold, so the loading stays at its
    // seed apart from the λ damping — no step toward the person.
    const seeded = seedLoading("q-new");
    for (let i = 0; i < PATTERNS_K; i++) {
      expect(Math.abs(model.q["q-new"].v[i] - seeded[i])).toBeLessThan(0.001);
    }
    expect(model.q["q-new"].n).toBe(1);
  });

  it("publishes each loading with its basis, rounded", () => {
    const model = runFit(20, 5);
    const pub = publishableLoadings(model);
    for (const [qid, row] of Object.entries(pub)) {
      expect(row.n).toBe(model.q[qid].n);
      expect(row.v).toHaveLength(PATTERNS_K);
      for (const v of row.v) expect(v).toBe(Math.round(v * 10000) / 10000);
    }
  });

  it("encodes the two options symmetrically", () => {
    expect(encodeAnswer(0)).toBe(1);
    expect(encodeAnswer(1)).toBe(-1);
  });

  it("counts only the loadings a basis makes drawable (D265)", () => {
    // The mount gate's crowd number. Publication has no floor and should
    // not get one — every vector publishes with its own n — but the count
    // the client opens a TAB on must not include the n=1 rows, which by
    // the case above carry no signal beyond existing.
    const model = emptyModel();
    const user = emptyUser();
    for (let d = 0; d < PATTERNS_MIN_BASIS; d++) {
      // q-often on every day, q-once on the first only
      const obs: PatternsObservation[] = [{ qid: "q-often", x: d % 2 ? 1 : -1 }];
      if (d === 0) obs.push({ qid: "q-once", x: 1 });
      foldUserDay(model, user, obs);
    }
    expect(model.q["q-often"].n).toBe(PATTERNS_MIN_BASIS);
    expect(model.q["q-once"].n).toBe(1);
    expect(Object.keys(publishableLoadings(model))).toHaveLength(2);
    expect(readyPool(model)).toBe(1);
    // One short of the floor is not drawable, at any floor.
    expect(readyPool(model, PATTERNS_MIN_BASIS + 1)).toBe(0);
    expect(readyPool(model, 1)).toBe(2);
  });
});

// ── the scorecard (D325) ──────────────────────────────────────────────
describe("the prequential score", () => {
  it("a never-seen question against a fresh person is a coin — exactly one bit", () => {
    const model = emptyModel();
    const score = emptyDayScore();
    foldUserDay(model, emptyUser(), [{ qid: "q-new", x: 1 }], score);
    // …and so is the marginal-only baseline: nothing beats nothing here
    expect(score).toEqual({ n: 1, bits: 1, baseBits: 1, perQ: { "q-new": { n: 1, bits: 1, baseBits: 1 } } });
  });

  // ── the baseline (D393) ──────────────────────────────────────────────
  //
  // A fit whose vectors carry nothing scores exactly what the marginal
  // alone scores. Until this row existed the scorecard published 0.93
  // bits with nothing beside it, and the shipped fit's 0.93 WAS the
  // marginal's 0.93 in every app-shaped scenario the probe ran
  // (docs/ALGORITHM-REFLECTION.md §1). Skill is the difference, as a share.
  it("publishes the marginal-only score beside the fit's, and skill as their gap", () => {
    // fresh people: θ is zero, so every guess is the marginal's guess and
    // the skill is exactly 0
    const model = emptyModel();
    const score = emptyDayScore();
    for (let i = 0; i < 6; i++) foldUserDay(model, emptyUser(), [{ qid: "q", x: i % 3 === 0 ? -1 : 1 }], score);
    expect(score.bits).toBeCloseTo(score.baseBits, 12);
    const q = publishableQuality([{ day: "2026-09-05", score }], []);
    expect(q.baselineBits).toBe(q.bits);
    expect(q.skill).toBe(0);
    expect(q.series[0]).toEqual({ day: "2026-09-05", n: 6, bits: q.bits, baselineBits: q.bits });
    expect(q.note).toContain("baselineBits");
  });

  it("scores positive skill for a person whose vector predicts the answer", () => {
    const model = emptyModel();
    // a crowd splits the question evenly, so the marginal says nothing…
    for (let i = 0; i < 8; i++) foldUserDay(model, emptyUser(), [{ qid: "q", x: i % 2 ? 1 : -1 }]);
    // …and a person whose θ points along the loading, in the answer's
    // direction, is called better than the coin
    const L = model.q.q.v;
    const user = { v: L.map((x) => x * 40), n: 5 };
    const score = emptyDayScore();
    foldUserDay(model, user, [{ qid: "q", x: 1 }], score);
    expect(score.bits).toBeLessThan(score.baseBits);
    expect(skillOf(score.bits, score.baseBits)).toBeGreaterThan(0);
    // …and the perQ row carries the same pair, floored like the rest
    const q = publishableQuality([{ day: "d", score }], [], 1);
    expect(q.perQ.q.baselineBits).toBeGreaterThan(q.perQ.q.bits);
  });

  it("refuses a skill on an empty day", () => {
    expect(skillOf(0, 0)).toBe(0);
    const q = publishableQuality([{ day: "d", score: emptyDayScore() }], []);
    expect(q.skill).toBe(0);
    expect(q.baselineBits).toBe(0);
  });

  it("reads the distance from the seeds: a fresh model sits on them, a learned one does not", () => {
    const model = emptyModel();
    for (let i = 0; i < 20; i++) foldUserDay(model, emptyUser(), [{ qid: `q${i % 4}`, x: 1 }]);
    const fresh = seedsSummary(model);
    expect(fresh.n).toBe(4);
    // zero θ moves a loading by damping only, which scales it and never
    // rotates it — so every vector is still its seed, pointing the same way
    expect(fresh.meanCos).toBeCloseTo(1, 3);
    expect(fresh.share90).toBe(1);
    expect(fresh.seedNorm).toBeCloseTo(0.05 * Math.sqrt(PATTERNS_K / 3), 4);
    expect(fresh.meanNorm).toBeLessThanOrEqual(fresh.seedNorm + 1e-6);
    // rotate two of the four by hand: the summary says so
    model.q.q0.v = Array.from({ length: PATTERNS_K }, (_, i) => (i === 0 ? 1 : 0));
    model.q.q1.v = Array.from({ length: PATTERNS_K }, (_, i) => (i === 1 ? 1 : 0));
    const moved = seedsSummary(model);
    expect(moved.share90).toBe(0.5);
    expect(moved.meanCos).toBeLessThan(fresh.meanCos);
    expect(moved.meanNorm).toBeGreaterThan(fresh.meanNorm);
    // and an empty model reports zeros rather than dividing by nothing
    expect(seedsSummary(emptyModel())).toEqual({ n: 0, meanCos: 0, share90: 0, meanNorm: 0, seedNorm: fresh.seedNorm });
  });

  it("reads the marginal one step ahead: with the crowd is cheap, against it is dear", () => {
    const model = emptyModel();
    // five people take option 0 — the marginal goes to +1 while the
    // loading stays near its seed (a zero θ moves nothing but damping)
    for (let i = 0; i < 5; i++) foldUserDay(model, emptyUser(), [{ qid: "q", x: 1 }]);
    const withCrowd = emptyDayScore();
    foldUserDay(model, emptyUser(), [{ qid: "q", x: 1 }], withCrowd);
    const against = emptyDayScore();
    foldUserDay(model, emptyUser(), [{ qid: "q", x: -1 }], against);
    expect(withCrowd.bits).toBeLessThan(1);
    expect(against.bits).toBeGreaterThan(1);
    // …and the clamp bounds what one observation can claim, either way
    expect(against.bits).toBeCloseTo(-Math.log2(0.05), 9);
  });

  it("mirrors the Oracle's link and clamps", () => {
    expect(prequentialBits(0, 1)).toBe(1);
    expect(prequentialBits(0, -1)).toBe(1);
    expect(prequentialBits(1, 1)).toBeCloseTo(-Math.log2(0.95), 12);
    expect(prequentialBits(1, -1)).toBeCloseTo(-Math.log2(0.05), 12);
    expect(prequentialBits(99, -1)).toBe(prequentialBits(1.1, -1));
    // THE LOWER CLAMP, which none of the lines above reaches: every one of
    // them drives `xhat` non-negative, so `p0` never falls to the floor and
    // `0.05` could be raised to `0.4` with the whole suite green —
    // measured. The upper clamp IS caught. D325 says the published bits go
    // "through the device Oracle's own link and clamps … so the number and
    // the Oracle meter speak one currency", and the client pins both
    // literally (patternsMap.test.ts); this side pinned one.
    expect(prequentialBits(-1, -1)).toBeCloseTo(-Math.log2(0.95), 12);
    expect(prequentialBits(-1, 1)).toBeCloseTo(-Math.log2(0.05), 12);
    expect(prequentialBits(-99, 1)).toBe(prequentialBits(-1.1, 1));
  });

  it("keeps the fit's tuning constants at the values its reasoning names", () => {
    // All four survived a mutation sweep with 611 tests green: they are
    // used only through the fit, and every case asserts the fit's SHAPE —
    // that it converges, that it is a pure observer — which stays true at
    // any step size. A model that quietly retunes itself between deploys
    // is one whose published quality series compares two different
    // engines, and D325 keeps that series as "the number any candidate
    // engine must beat".
    expect(PATTERNS_K, "the model's width moved").toBe(8);
    expect(PATTERNS_ETA_USER, "the user step moved — it is flat on purpose").toBe(0.15);
    expect(PATTERNS_LAMBDA, "the L2 damping moved").toBe(0.02);
    // The question step decays with folds; both ends of that curve, so the
    // shape is pinned rather than one point on it.
    expect(patternsEtaQ(0)).toBeCloseTo(0.5 / 20, 12);
    expect(patternsEtaQ(20)).toBeCloseTo(0.5 / 40, 12);
  });

  it("reproduces the seed hash bit for bit, not merely deterministically", () => {
    // `seedLoading` is asserted equal to itself, different from another
    // qid, and bounded — all true of ANY spreading hash, so the FNV-1a
    // loop bound could be widened and every case stayed green. Measured,
    // and it is not an equivalent mutation: the values really change.
    // That matters because the file claims the model "comes out bit for
    // bit the same", which is a claim about reproducing across deploys,
    // not within one run.
    expect(seedLoading("pin-probe")).toEqual([
      0.027610000000000003, 0.019282999999999995, 0.013005999999999997,
      -0.042217000000000005, 0.021072000000000004, -0.029632000000000006,
      0.0005830000000000002, -0.021341,
    ]);
  });

  it("is a pure observer — the model comes out bit for bit the same", () => {
    const plain = runFit(30, 10);
    const observed = runFit(30, 10, emptyDayScore());
    expect(JSON.stringify(observed)).toBe(JSON.stringify(plain));
  });

  it("splits the pooled tally per question without losing a bit", () => {
    const score = emptyDayScore();
    runFit(30, 10, score);
    const perQ = Object.values(score.perQ);
    expect(perQ.reduce((a, t) => a + t.n, 0)).toBe(score.n);
    expect(perQ.reduce((a, t) => a + t.bits, 0)).toBeCloseTo(score.bits, 9);
  });
});

describe("what the quality block publishes", () => {
  it("floors the per-question day, pools everything, and bounds the series", () => {
    const day = emptyDayScore();
    for (let i = 0; i < PATTERNS_QUALITY_FLOOR; i++) {
      day.n += 1;
      day.bits += 1;
      day.baseBits += 1;
      const t = (day.perQ["q-big"] ??= { n: 0, bits: 0, baseBits: 0 });
      t.n += 1;
      t.bits += 1;
      t.baseBits += 1;
    }
    // one answer on q-small: ITS mean is one person's surprisal, so it
    // reaches the pooled number and nothing else (the verdict's floor)
    day.n += 1;
    day.bits += 4;
    day.baseBits += 4;
    day.perQ["q-small"] = { n: 1, bits: 4, baseBits: 4 };
    const prior = Array.from({ length: PATTERNS_QUALITY_DAYS }, (_, i) => ({ day: `d${i}`, n: 1, bits: 1 }));
    const q = publishableQuality([{ day: "2026-08-26", score: day }], prior);
    expect(Object.keys(q.perQ)).toEqual(["q-big"]);
    expect(q.perQ["q-big"]).toEqual({ n: PATTERNS_QUALITY_FLOOR, bits: 1, baselineBits: 1 });
    expect(q.floor).toBe(PATTERNS_QUALITY_FLOOR);
    expect(q.day).toBe("2026-08-26");
    expect(q.n).toBe(PATTERNS_QUALITY_FLOOR + 1);
    expect(q.bits).toBeCloseTo((PATTERNS_QUALITY_FLOOR + 4) / (PATTERNS_QUALITY_FLOOR + 1), 3);
    // the series holds its bound: the oldest row fell off the front
    expect(q.series).toHaveLength(PATTERNS_QUALITY_DAYS);
    expect(q.series[0]?.day).toBe("d1");
    expect(q.series[q.series.length - 1]?.day).toBe("2026-08-26");
  });

  it("a day with nothing eligible publishes its zero out loud", () => {
    const q = publishableQuality([{ day: "2026-08-25", score: emptyDayScore() }], []);
    expect(q.series).toEqual([{ day: "2026-08-25", n: 0, bits: 0, baselineBits: 0 }]);
    expect(q.n).toBe(0);
    expect(q.perQ).toEqual({});
  });
});

describe("the displacement summary", () => {
  it("measures publish-to-publish movement exactly, movers only in perQ, zeros in the stats", () => {
    const model: PatternsModel = {
      k: 2,
      q: {
        "q-moved": { v: [0.34, 0], n: 5, sum: 1 },
        "q-still": { v: [0.1, 0.2], n: 5, sum: 1 },
        "q-new": { v: [1, 1], n: 1, sum: 1 },
      },
    };
    const d = displacementSummary({ "q-moved": [0.3, 0.03], "q-still": [0.1, 0.2] }, model);
    expect(d.space).toBe("loading");
    // q-new has no previous publish to compare against; the two that do
    // are both counted, the untouched one as a zero the stats keep
    expect(d.n).toBe(2);
    expect(d.moved).toBe(1);
    expect(d.perQ).toEqual({ "q-moved": 0.05 }); // √(0.04² + 0.03²), no alignment
    expect(d.max).toBe(0.05);
    expect(d.mean).toBe(0.025);
    expect(d.p50).toBe(0); // nearest rank: the median question sat still
    expect(d.p90).toBe(0.05);
  });

  it("a nudge under the publication's own precision is not a move", () => {
    const model: PatternsModel = { k: 1, q: { q1: { v: [0.10004], n: 3, sum: 1 } } };
    const d = displacementSummary({ q1: [0.1] }, model);
    // 0.10004 publishes as 0.1000 — a returning reader sees no change
    expect(d.moved).toBe(0);
    expect(d.max).toBe(0);
    expect(d.n).toBe(1);
  });

  it("the first publish has no basis to compare, and says so", () => {
    expect(displacementSummary({}, emptyModel())).toEqual({
      space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {},
    });
  });
});
