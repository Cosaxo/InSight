// The fit's contract, pinned three ways:
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
import { describe, expect, it } from "vitest";
import {
  PATTERNS_K,
  PATTERNS_MIN_BASIS,
  emptyModel,
  emptyUser,
  encodeAnswer,
  foldUserDay,
  loadingCosine,
  publishableLoadings,
  readyPool,
  seedLoading,
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

function runFit(people: number, days: number): PatternsModel {
  const { byDay } = syntheticDays(people, days);
  const model = emptyModel();
  const users = new Map<number, ReturnType<typeof emptyUser>>();
  for (const day of byDay) {
    for (const { uid, obs } of day) {
      const u = users.get(uid) ?? emptyUser();
      foldUserDay(model, u, obs);
      users.set(uid, u);
    }
  }
  return model;
}

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
