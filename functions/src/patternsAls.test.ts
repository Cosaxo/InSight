// The candidate engine's contract (D383), pinned the way patternsFit's is:
//
//   1. THE CORPUS — bin, ord and one-hot items compile from the bank by
//      one rule, and each kind encodes and centres the way its header
//      says.
//   2. RECOVERY UNDER THE APP'S RULE — a two-factor crowd where every
//      person answers every question ONCE (D5) comes back out as that
//      structure. This is the case the online engine cannot pass
//      (docs/ALGORITHM-REFLECTION.md §1.2, table E) and the reason the
//      candidate exists.
//   3. DETERMINISM — the same maps and the same prior reproduce the same
//      model bit for bit.
//   4. ALIGNMENT — a rotated copy of a model is carried back onto it, and
//      too few shared rows refuse the rotation rather than invent one.
//   5. THE SCORECARD — one step ahead, the same currency as the online
//      fit's, coin for an item the model has never seen.
//   6. THE CROSSOVER RULE — a win needs the floor on both sides and a
//      strictly better skill; a streak resets on any night it does not win.
import { describe, expect, it } from "vitest";
import {
  ALS_MIN_SD,
  ORDINAL_TYPES,
  PATTERNS_CROSSOVER_NIGHTS,
  alsFit,
  alsScoreDay,
  binRows,
  candidateWon,
  compileItems,
  emptyAls,
  encodeFor,
  indexItems,
  itemEligible,
  mergeScores,
  nextCrossoverStreak,
  procrustes,
  publishableAls,
  residualFor,
  ridgeTheta,
  rotateModel,
  symmetricEigen,
  type AnswerMap,
} from "./patternsAls";
import { PATTERNS_K, PATTERNS_QUALITY_FLOOR, loadingCosine, skillOf, type PatternsQuality } from "./patternsFit";

const K = PATTERNS_K;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** patternsFit.test.ts's world — two factors, ±1 traits, five two-option
 * questions each, 85% trait-following — under the app's own rule: each
 * person answers each question exactly once. */
function createOnlyCrowd(people: number, seed = 7): { uid: string; a: AnswerMap; traits: number[] }[] {
  const rand = lcg(seed);
  const out: { uid: string; a: AnswerMap; traits: number[] }[] = [];
  for (let u = 0; u < people; u++) {
    const traits = [rand() < 0.5 ? 1 : -1, rand() < 0.5 ? 1 : -1];
    const a: AnswerMap = {};
    for (let i = 0; i < 5; i++) {
      for (const [prefix, f] of [["a", 0], ["b", 1]] as const) {
        const side = rand() < 0.85 ? traits[f] : -traits[f];
        a[`${prefix}${i}`] = side === 1 ? 0 : 1; // option 0 encodes +1
      }
    }
    out.push({ uid: `u${String(u).padStart(4, "0")}`, a, traits });
  }
  return out;
}

const TWO_FACTOR_BANK = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, surface: "daily", type: "binary", options: ["x", "y"] })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, surface: "daily", type: "binary", options: ["x", "y"] })),
];

describe("the corpus", () => {
  it("compiles bin, ord and one-hot items by one rule", () => {
    const bank = [
      { id: "d-bin", surface: "daily", type: "binary", options: ["a", "b"] },
      { id: "d-scale", surface: "daily", type: "scale", options: ["1", "2", "3", "4", "5"] },
      { id: "d-rating", surface: "daily", type: "rating", options: Array.from({ length: 10 }, (_, i) => String(i + 1)) },
      { id: "d-choice", surface: "daily", type: "choice", options: ["a", "b", "c"] },
      { id: "f-core", surface: "feed", type: "vote", options: ["a", "b"], core: true },
      { id: "f-dial", surface: "feed", type: "dial", options: Array.from({ length: 12 }, (_, i) => String(i)), core: true },
      { id: "f-tail", surface: "feed", type: "vote", options: ["a", "b"] },
      { id: "t-item", surface: "test", type: "scale", options: ["1", "2", "3", "4", "5"] },
      { id: "l-card", surface: "learn", type: "choice", options: ["a", "b", "c", "d"] },
      { id: "p-pick", surface: "feed", type: "catalog", options: [], core: true },
      { id: "g-duel", surface: "group", type: "binary", options: ["a", "b"] },
    ];
    const items = compileItems(bank);
    expect(items.map((s) => `${s.key}:${s.kind}`)).toEqual([
      "d-bin:bin", "d-scale:ord", "d-rating:ord",
      "d-choice~0:opt", "d-choice~1:opt", "d-choice~2:opt",
      "f-core:bin", "f-dial:ord", "t-item:ord",
    ]);
    expect(itemEligible(bank[6]), "the tail stays out").toBe(false);
    expect(itemEligible(bank[8]), "learn is knowledge, not disposition").toBe(false);
    expect(itemEligible(bank[9]), "a pick has no option share").toBe(false);
    expect(itemEligible(bank[10]), "sealed surfaces never fold").toBe(false);
    expect([...ORDINAL_TYPES].sort()).toEqual(["dial", "rating", "scale"]);
  });

  it("encodes each kind the way its header says, and centres by the item's own mean", () => {
    const [bin, ord, opt0, opt1] = compileItems([
      { id: "b", surface: "daily", type: "binary", options: ["a", "b"] },
      { id: "o", surface: "daily", type: "scale", options: ["1", "2", "3", "4", "5"] },
      { id: "c", surface: "daily", type: "choice", options: ["a", "b"].concat(["c"]) },
    ]).filter((s) => s.key !== "c~2");
    expect(encodeFor(bin, 0)).toBe(1);
    expect(encodeFor(bin, 1)).toBe(-1);
    expect(encodeFor(ord, 3)).toBe(3);
    expect(encodeFor(opt0, 0)).toBe(1);
    expect(encodeFor(opt0, 2)).toBe(-1);
    expect(encodeFor(opt1, 1)).toBe(1);
    // residuals: bin/opt against the ±1 mean, ord standardised
    expect(residualFor({ kind: "bin", qid: "b", nOptions: 2 }, { n: 4, sum: 2 }, 0)).toBeCloseTo(0.5, 12);
    expect(residualFor({ kind: "opt", qid: "c", opt: 1, nOptions: 3 }, { n: 4, sum: -2 }, 1)).toBeCloseTo(1.5, 12);
    expect(residualFor({ kind: "ord", qid: "o", nOptions: 5 }, { n: 10, sum: 20, sd: 1.5 }, 3.5)).toBeCloseTo(1, 12);
    // an ordinal everyone answered the same way carries nothing yet
    expect(residualFor({ kind: "ord", qid: "o", nOptions: 5 }, { n: 10, sum: 20, sd: ALS_MIN_SD / 2 }, 4)).toBeNull();
    expect(residualFor({ kind: "bin", qid: "b", nOptions: 2 }, { n: 0, sum: 0 }, 0)).toBeNull();
  });
});

describe("recovery under the app's own rule", () => {
  it("finds the two-factor structure when every person answers every question once", () => {
    const crowd = createOnlyCrowd(300);
    const index = indexItems(compileItems(TWO_FACTOR_BANK));
    const model = alsFit(null, crowd.map(({ uid, a }) => ({ uid, a })), index);
    const cos = (i: string, j: string) => Math.abs(loadingCosine(model.rows[i].v, model.rows[j].v));
    let same = 0, sameN = 0, cross = 0, crossN = 0;
    const ids = Object.keys(model.rows).sort();
    for (const i of ids) for (const j of ids) {
      if (i >= j) continue;
      if (i[0] === j[0]) { same += cos(i, j); sameN++; } else { cross += cos(i, j); crossN++; }
    }
    // The online engine measures 0.406 against 0.229 on this crowd — the
    // seeds' own geometry. A working solver separates the factors.
    expect(same / sameN).toBeGreaterThan(cross / crossN + 0.3);
    expect(same / sameN).toBeGreaterThan(0.5);
    // basis and mean ride every row, as counts recomputed from the maps
    for (const id of ids) {
      expect(model.rows[id].n).toBe(300);
      expect(Math.abs(model.rows[id].sum)).toBeLessThanOrEqual(300);
      expect(model.items[id]).toEqual({ kind: "bin", qid: id, nOptions: 2 });
    }
    // and no row runs away: norms are clamped at 1
    for (const id of ids) expect(Math.hypot(...model.rows[id].v)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("re-solves from the same maps and the same prior bit for bit", () => {
    const crowd = createOnlyCrowd(120).map(({ uid, a }) => ({ uid, a }));
    const index = indexItems(compileItems(TWO_FACTOR_BANK));
    const first = alsFit(null, crowd, index);
    expect(JSON.stringify(alsFit(null, crowd, index))).toBe(JSON.stringify(first));
    // …and the order people arrive in does not matter: the fit sorts
    const shuffled = [...crowd].reverse();
    expect(JSON.stringify(alsFit(null, shuffled, index))).toBe(JSON.stringify(first));
    // a warm start from the PUBLISHED (4 dp) rows lands where a warm start
    // from the unrounded ones does: the rounding is a perturbation under
    // the step, not a different model. (Not where the cold solve landed —
    // a warm start continues the optimisation, which is the point of it.)
    const warmExact = alsFit(first, crowd, index);
    const warmRounded = alsFit({ ...first, rows: publishableAls(first) }, crowd, index);
    for (const id of Object.keys(first.rows)) {
      expect(Math.abs(loadingCosine(warmExact.rows[id].v, warmRounded.rows[id].v))).toBeGreaterThan(0.999);
    }
  });

  it("standardises an ordinal item and one-hots a pick, so both reach the same solve", () => {
    // a crowd whose scale answer and pick both follow one trait
    const rand = lcg(11);
    const bank = [
      { id: "s", surface: "test", type: "scale", options: ["1", "2", "3", "4", "5"] },
      { id: "c", surface: "daily", type: "choice", options: ["a", "b", "c"] },
      { id: "b", surface: "daily", type: "binary", options: ["x", "y"] },
    ];
    const index = indexItems(compileItems(bank));
    // a strong trait, because this case is about the encodings reaching
    // one solve — recovery strength is the case above's
    const crowd = Array.from({ length: 400 }, (_, u) => {
      const t = rand() < 0.5 ? 1 : -1;
      const noise = () => (rand() < 0.95 ? t : -t);
      return {
        uid: `u${String(u).padStart(4, "0")}`,
        a: { s: noise() === 1 ? 4 : 0, c: noise() === 1 ? 0 : 1 + (rand() < 0.5 ? 0 : 1), b: noise() === 1 ? 0 : 1 },
      };
    });
    const model = alsFit(null, crowd, index);
    expect(Object.keys(model.rows).sort()).toEqual(["b", "c~0", "c~1", "c~2", "s"]);
    expect(model.rows.s.sd).toBeGreaterThan(0.5);
    expect(model.items.s.kind).toBe("ord");
    expect(model.items["c~0"]).toEqual({ kind: "opt", qid: "c", opt: 0, nOptions: 3 });
    // the scale item, the trait-following option and the two-option
    // question all load the same way
    expect(Math.abs(loadingCosine(model.rows.s.v, model.rows.b.v))).toBeGreaterThan(0.75);
    expect(Math.abs(loadingCosine(model.rows["c~0"].v, model.rows.b.v))).toBeGreaterThan(0.75);
    // publication keeps sd at 4 dp and sums as integers
    const pub = publishableAls(model);
    expect(pub.s.sd).toBe(Math.round((model.rows.s.sd as number) * 10000) / 10000);
    expect(Number.isInteger(pub.s.sum)).toBe(true);
    // the Map's rows are the two-option ones alone
    expect(Object.keys(binRows(pub, model.items))).toEqual(["b"]);
  });
});

describe("alignment", () => {
  /** A deterministic K×K rotation: Gram–Schmidt over a fixed matrix. */
  function rotation(seed: number): number[][] {
    const rand = lcg(seed);
    const M = Array.from({ length: K }, () => Array.from({ length: K }, () => rand() * 2 - 1));
    const Q: number[][] = [];
    for (let i = 0; i < K; i++) {
      const v = [...M[i]];
      for (const q of Q) {
        const d = v.reduce((a, x, j) => a + x * q[j], 0);
        for (let j = 0; j < K; j++) v[j] -= d * q[j];
      }
      const n = Math.hypot(...v);
      Q.push(v.map((x) => x / n));
    }
    return Q; // rows orthonormal → orthogonal matrix
  }

  it("the eigen-solver diagonalises a symmetric matrix", () => {
    const rand = lcg(3);
    const B = Array.from({ length: K }, () => Array.from({ length: K }, () => rand() - 0.5));
    const S = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => B[i].reduce((a, x, l) => a + x * B[j][l], 0)));
    const { values, vectors } = symmetricEigen(S);
    // S V = V Λ, column by column
    for (let c = 0; c < K; c++) {
      for (let i = 0; i < K; i++) {
        const sv = S[i].reduce((a, x, l) => a + x * vectors[l][c], 0);
        expect(sv).toBeCloseTo(values[c] * vectors[i][c], 8);
      }
    }
  });

  it("carries a rotated model back onto the original, and refuses on too few shared rows", () => {
    const crowd = createOnlyCrowd(200).map(({ uid, a }) => ({ uid, a }));
    const index = indexItems(compileItems(TWO_FACTOR_BANK));
    const model = alsFit(null, crowd, index);
    const R = rotation(5);
    const turned = rotateModel(model, R);
    // rotation preserves every norm
    for (const id of Object.keys(model.rows)) {
      expect(Math.hypot(...turned.rows[id].v)).toBeCloseTo(Math.hypot(...model.rows[id].v), 9);
    }
    const back = rotateModel(turned, procrustes(
      Object.fromEntries(Object.entries(turned.rows).map(([k, r]) => [k, r.v])),
      Object.fromEntries(Object.entries(model.rows).map(([k, r]) => [k, r.v])),
      K,
    ));
    for (const id of Object.keys(model.rows)) {
      for (let i = 0; i < K; i++) expect(back.rows[id].v[i]).toBeCloseTo(model.rows[id].v[i], 6);
    }
    // fewer shared rows than dimensions: identity, not an invented turn
    const few = Object.fromEntries(Object.entries(model.rows).slice(0, 3).map(([k, r]) => [k, r.v]));
    const I = procrustes(few, few, K);
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) expect(I[i][j]).toBe(i === j ? 1 : 0);
  });
});

describe("the scorecard, one step ahead", () => {
  it("guesses the coin for an item the model has never seen, and beats the marginal where it has learned", () => {
    const index = indexItems(compileItems(TWO_FACTOR_BANK));
    const fitted = createOnlyCrowd(300, 7);
    const model = alsFit(null, fitted.map(({ uid, a }) => ({ uid, a })), index);
    // a fresh crowd: their history is everything but b0, and b0 is the
    // observation scored — the device's own posture
    const fresh = createOnlyCrowd(150, 99);
    const history = new Map<string, AnswerMap>();
    const obs: { uid: string; qid: string; x: number }[] = [];
    for (const p of fresh) {
      const { b0, ...rest } = p.a;
      history.set(p.uid, rest);
      obs.push({ uid: p.uid, qid: "b0", x: b0 === 0 ? 1 : -1 });
    }
    // the marginal both engines guess from: the fitted crowd's counts
    const start = new Map([["b0", { n: model.rows.b0.n, sum: model.rows.b0.sum }]]);
    const scored = alsScoreDay(model, index, history, obs, start, 2);
    expect(scored.n).toBe(150);
    expect(scored.bits).toBeLessThan(scored.baseBits);
    expect(skillOf(scored.bits, scored.baseBits)).toBeGreaterThan(0.1);
    expect(scored.perQ.b0.n).toBe(150);
    // no model at all: every guess is the marginal's — the running one,
    // which the first person meets as a coin and the rest as the crowd so far
    const coin = alsScoreDay(null, index, history, obs, new Map(), 2);
    expect(coin.n).toBe(150);
    expect(coin.bits).toBe(coin.baseBits);
    expect(skillOf(coin.bits, coin.baseBits)).toBe(0);
    // an item the model has no row for scores the marginal alone
    const unseen = alsScoreDay(model, index, history, [{ uid: fresh[0].uid, qid: "zz", x: 1 }], new Map(), 2);
    expect(unseen.bits).toBe(1);
    expect(unseen.baseBits).toBe(1);
    // the marginal runs WITHIN the day, the online fold's own way: the
    // second person to answer a fresh question faces the first's answer,
    // and a revision moves the marginal without being scored
    const walk = alsScoreDay(null, index, new Map(), [
      { uid: "p", qid: "zz", x: 1 },
      { uid: "q", qid: "zz", x: 1 },
      { uid: "p", qid: "zz", x: -1, prev: 1 },
      { uid: "r", qid: "zz", x: -1 },
    ], new Map(), 2);
    expect(walk.n, "the revision is not a held-out prediction").toBe(3);
    // p: coin (1 bit); q: marginal +1, agrees → the clamp's cheap side;
    // r: after the revision the marginal is 0 again → coin
    expect(walk.bits).toBeCloseTo(1 + -Math.log2(0.95) + 1, 9);
    // tallies merge by addition, per question too
    const merged = mergeScores(scored, coin);
    expect(merged.n).toBe(300);
    expect(merged.perQ.b0.bits).toBeCloseTo(scored.perQ.b0.bits + coin.perQ.b0.bits, 9);
  });

  it("the ridge solve is the device's: shrunk toward zero, more so at a higher λ", () => {
    const obs = [{ L: [1, 0, 0, 0, 0, 0, 0, 0], r: 1 }];
    const loose = ridgeTheta(obs, K, 0.5);
    const tight = ridgeTheta(obs, K, 4);
    expect(loose[0]).toBeCloseTo(1 / 1.5, 12);
    expect(tight[0]).toBeCloseTo(1 / 5, 12);
    expect(loose.slice(1).every((x) => x === 0)).toBe(true);
    expect(emptyAls().rows).toEqual({});
  });
});

describe("the crossover rule", () => {
  const q = (n: number, skill: number): PatternsQuality => ({
    day: "d", n, bits: 1 - skill, baselineBits: 1, skill, perQ: {}, floor: PATTERNS_QUALITY_FLOOR, series: [], note: "",
  });

  it("a win needs the floor on both sides, a strictly better skill, and a candidate better than the coin", () => {
    expect(candidateWon(q(20, 0), q(20, 0.1), PATTERNS_QUALITY_FLOOR)).toBe(true);
    expect(candidateWon(q(20, 0.1), q(20, 0.1), PATTERNS_QUALITY_FLOOR), "a tie is not a win").toBe(false);
    expect(candidateWon(q(20, 0.2), q(20, 0.1), PATTERNS_QUALITY_FLOOR)).toBe(false);
    // an engine a hair under the marginal does not hand a streak to a
    // candidate that only ties it
    expect(candidateWon(q(20, -0.01), q(20, 0), PATTERNS_QUALITY_FLOOR), "the coin beats nobody").toBe(false);
    expect(candidateWon(q(20, -0.2), q(20, 0.05), PATTERNS_QUALITY_FLOOR)).toBe(true);
    expect(candidateWon(q(PATTERNS_QUALITY_FLOOR - 1, 0), q(20, 0.5), PATTERNS_QUALITY_FLOOR), "thin engine day").toBe(false);
    expect(candidateWon(q(20, 0), q(PATTERNS_QUALITY_FLOOR - 1, 0.5), PATTERNS_QUALITY_FLOOR), "thin candidate day").toBe(false);
    expect(candidateWon(undefined, q(20, 0.5), PATTERNS_QUALITY_FLOOR)).toBe(false);
    expect(candidateWon(q(20, 0), undefined, PATTERNS_QUALITY_FLOOR)).toBe(false);
  });

  it("a streak grows by one on a win and falls to zero on anything else", () => {
    expect(nextCrossoverStreak(0, true)).toBe(1);
    expect(nextCrossoverStreak(PATTERNS_CROSSOVER_NIGHTS - 1, true)).toBe(PATTERNS_CROSSOVER_NIGHTS);
    expect(nextCrossoverStreak(9, false)).toBe(0);
    expect(PATTERNS_CROSSOVER_NIGHTS).toBe(14);
  });
});
