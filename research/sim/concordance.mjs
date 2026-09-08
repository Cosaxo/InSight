// concordance.mjs — G6 §3's distance-validity statistic, and the claims
// the paper makes about it: invariance to monotone change of the metric,
// one half at no information, a ceiling set by the target's noise, an
// interval that must resample UNITS and not pairs, a contraction of
// distances by posterior shrinkage, and a resolution that counts units.
//
// The statistic: over pairs of units both observed on a target, the
// probability that of two pairs drawn at random the nearer pair (in the
// space) is the one that disagrees less (on the target), ties split.

import { makeRng, mean, sd } from "./lib/rng.mjs";

export function pairsOf(n, exclude = null) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    if (exclude && exclude.has(i)) continue;
    for (let j = i + 1; j < n; j += 1) {
      if (exclude && exclude.has(j)) continue;
      out.push([i, j]);
    }
  }
  return out;
}

/** Exact concordance over all pair-pairs when affordable, else a sampled one. */
export function concordance(dist, dis, { maxExact = 2500, samples = 200000, rng = makeRng(1) } = {}) {
  const P = dist.length;
  if (P < 2) return 0.5;
  let conc = 0;
  let ties = 0;
  let total = 0;
  const score = (p, q) => {
    const dd = dist[p] - dist[q];
    const ss = dis[p] - dis[q];
    if (dd === 0 || ss === 0) ties += 1;
    else if ((dd < 0) === (ss < 0)) conc += 1;
    total += 1;
  };
  if (P <= maxExact) {
    for (let p = 0; p < P; p += 1) for (let q = p + 1; q < P; q += 1) score(p, q);
  } else {
    for (let s = 0; s < samples; s += 1) {
      const p = rng.int(P);
      let q = rng.int(P - 1);
      if (q >= p) q += 1;
      score(p, q);
    }
  }
  return (conc + 0.5 * ties) / total;
}

/** The statistic on a population given per-pair distance and disagreement functions. */
export function concordanceOn(n, distFn, disFn, opts = {}) {
  const pairs = pairsOf(n, opts.exclude);
  const dist = pairs.map(([i, j]) => distFn(i, j));
  const dis = pairs.map(([i, j]) => disFn(i, j));
  return concordance(dist, dis, opts);
}

/** Leave-one-unit-out jackknife: the interval G6 says is the honest one. */
export function unitJackknife(n, distFn, disFn, opts = {}) {
  const C = concordanceOn(n, distFn, disFn, opts);
  const loo = [];
  for (let u = 0; u < n; u += 1) loo.push(concordanceOn(n, distFn, disFn, { ...opts, exclude: new Set([u]) }));
  const m = mean(loo);
  const se = Math.sqrt(((n - 1) / n) * loo.reduce((s, x) => s + (x - m) ** 2, 0));
  return { C, se, kernelVariance: n * se * se };
}

/** Bootstrap over PAIRS as if independent: the interval G6 says is too tight. */
export function pairBootstrap(n, distFn, disFn, { B = 100, rng = makeRng(2), ...opts } = {}) {
  const pairs = pairsOf(n);
  const dist = pairs.map(([i, j]) => distFn(i, j));
  const dis = pairs.map(([i, j]) => disFn(i, j));
  const P = pairs.length;
  const stats = [];
  for (let b = 0; b < B; b += 1) {
    const idx = Array.from({ length: P }, () => rng.int(P));
    stats.push(concordance(idx.map((k) => dist[k]), idx.map((k) => dis[k]), opts));
  }
  return { se: sd(stats) };
}

// ── A population to test it on ──
//
// Units have a latent position z in d dimensions; a target responds as
// w·z plus noise. The criterion distance between two units is the distance
// between their predictive means, |w·(z_p − z_q)|; the Euclidean distance
// in z is a metric validated for nothing in particular; a noisy placement
// z̃ carries per-unit measurement error that shrinks toward the origin
// when it becomes a posterior mean ẑ.

export function simulatePopulation({ n, d = 3, noise = 1, rng = makeRng(3), obsPerUnit = () => 4, obsNoise = 1, w = null }) {
  const W = w || Array.from({ length: d }, (_, k) => (k === 0 ? 1 : 0.5 / (k + 1)));
  const wn = Math.sqrt(W.reduce((s, x) => s + x * x, 0));
  const wv = W.map((x) => x / wn);
  const z = Array.from({ length: n }, () => Array.from({ length: d }, () => rng.normal()));
  const y = z.map((zi) => zi.reduce((s, x, k) => s + wv[k] * x, 0) + noise * rng.normal());
  const k = Array.from({ length: n }, obsPerUnit);
  const ztilde = z.map((zi, i) => zi.map((x) => x + (obsNoise / Math.sqrt(k[i])) * rng.normal()));
  // prior N(0,1) per dimension; k_i observations of variance obsNoise^2
  const shrink = k.map((ki) => ki / obsNoise ** 2 / (1 + ki / obsNoise ** 2));
  const zhat = ztilde.map((zi, i) => zi.map((x) => x * shrink[i]));
  const postVar = k.map((ki) => 1 / (1 + ki / obsNoise ** 2));
  return { n, d, w: wv, z, y, k, ztilde, zhat, postVar, noise };
}

export const euclid = (X) => (i, j) => Math.sqrt(X[i].reduce((s, x, k) => s + (x - X[j][k]) ** 2, 0));
export const criterion = (pop) => (i, j) => Math.abs(pop.w.reduce((s, wk, k) => s + wk * (pop.z[i][k] - pop.z[j][k]), 0));
export const disagreement = (pop) => (i, j) => Math.abs(pop.y[i] - pop.y[j]);
export const monotone = (distFn, f) => (i, j) => f(distFn(i, j));

/** Expected distance under posterior draws, precomputed per pair by Monte Carlo. */
export function expectedPosteriorDistance(pop, { draws = 24, rng = makeRng(4) } = {}) {
  const { n, d, zhat, postVar } = pop;
  const table = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let acc = 0;
      for (let t = 0; t < draws; t += 1) {
        let s = 0;
        for (let k = 0; k < d; k += 1) {
          const a = zhat[i][k] + Math.sqrt(postVar[i]) * rng.normal();
          const b = zhat[j][k] + Math.sqrt(postVar[j]) * rng.normal();
          s += (a - b) ** 2;
        }
        acc += Math.sqrt(s);
      }
      table[i][j] = acc / draws;
      table[j][i] = table[i][j];
    }
  }
  return (i, j) => table[i][j];
}

// ── The experiments the report runs ──

/** The population concordance of a space, read on a large draw. */
export function populationConcordance({ space = "euclid", n = 1500, noise = 1, seed = 5, samples = 400000 }) {
  const rng = makeRng(seed);
  const pop = simulatePopulation({ n, noise, rng });
  const distFn = space === "criterion" ? criterion(pop) : euclid(pop.z);
  return concordanceOn(n, distFn, disagreement(pop), { maxExact: 0, samples, rng });
}

/** Coverage of the two intervals against the population value. */
export function coverageExperiment({ n = 30, reps = 60, noise = 1, seed = 6, truth = null, B = 60 }) {
  const rng = makeRng(seed);
  const C0 = truth ?? populationConcordance({ n: 1500, noise, seed: seed + 100 });
  let jackHit = 0;
  let bootHit = 0;
  const Cs = [];
  const jackSEs = [];
  const bootSEs = [];
  for (let r = 0; r < reps; r += 1) {
    const pop = simulatePopulation({ n, noise, rng });
    const distFn = euclid(pop.z);
    const disFn = disagreement(pop);
    const j = unitJackknife(n, distFn, disFn);
    const b = pairBootstrap(n, distFn, disFn, { B, rng });
    Cs.push(j.C);
    jackSEs.push(j.se);
    bootSEs.push(b.se);
    if (Math.abs(j.C - C0) <= 1.96 * j.se) jackHit += 1;
    if (Math.abs(j.C - C0) <= 1.96 * b.se) bootHit += 1;
  }
  return { n, reps, truth: C0, meanC: mean(Cs), empiricalSD: sd(Cs), meanJackknifeSE: mean(jackSEs), meanPairBootstrapSE: mean(bootSEs), jackknifeCoverage: jackHit / reps, pairBootstrapCoverage: bootHit / reps };
}

/** How the statistic's spread falls with n: units (n^-1/2) or pairs (n^-1)? */
export function seScaling({ ns = [16, 32, 64, 128], reps = 40, noise = 1, seed = 8 }) {
  const rng = makeRng(seed);
  return ns.map((n) => {
    const Cs = [];
    for (let r = 0; r < reps; r += 1) {
      const pop = simulatePopulation({ n, noise, rng });
      Cs.push(concordanceOn(n, euclid(pop.z), disagreement(pop), { rng }));
    }
    return { n, pairs: (n * (n - 1)) / 2, sd: sd(Cs) };
  });
}

/** The ceiling: the criterion's own concordance as the target's noise grows. */
export function ceilingCurve({ noises = [0, 0.25, 0.5, 1, 2], n = 400, seed = 9 }) {
  return noises.map((noise) => {
    const rng = makeRng(seed);
    const pop = simulatePopulation({ n, noise, rng });
    return {
      noise,
      criterion: concordanceOn(n, criterion(pop), disagreement(pop), { maxExact: 0, samples: 200000, rng }),
      euclid: concordanceOn(n, euclid(pop.z), disagreement(pop), { maxExact: 0, samples: 200000, rng }),
    };
  });
}

/** Shrunken point summaries against the alternatives, averaged over draws. */
export function shrinkageExperiment({ n = 60, reps = 30, noise = 1, seed = 10, obsNoise = 1.5 }) {
  const rng = makeRng(seed);
  const acc = { trueZ: [], noisy: [], shrunkPoint: [], expectedPosterior: [] };
  for (let r = 0; r < reps; r += 1) {
    const pop = simulatePopulation({ n, noise, rng, obsNoise, obsPerUnit: () => 1 + rng.int(8) });
    const dis = disagreement(pop);
    acc.trueZ.push(concordanceOn(n, euclid(pop.z), dis));
    acc.noisy.push(concordanceOn(n, euclid(pop.ztilde), dis));
    acc.shrunkPoint.push(concordanceOn(n, euclid(pop.zhat), dis));
    acc.expectedPosterior.push(concordanceOn(n, expectedPosteriorDistance(pop, { rng }), dis));
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { mean: mean(v), sd: sd(v) }]));
}

/** Units needed to resolve a difference between two spaces on the same pairs. */
export function sizingDifference({ n = 80, reps = 40, noise = 1, seed = 12, deltas = [0.05, 0.02, 0.01] }) {
  const rng = makeRng(seed);
  const diffs = [];
  for (let r = 0; r < reps; r += 1) {
    const pop = simulatePopulation({ n, noise, rng, obsNoise: 1.5, obsPerUnit: () => 3 });
    const dis = disagreement(pop);
    diffs.push(concordanceOn(n, euclid(pop.z), dis) - concordanceOn(n, euclid(pop.ztilde), dis));
  }
  const s = sd(diffs);
  // sd falls as n^-1/2 (units), so the n that puts 2.8·sd at delta is n·(2.8·sd/delta)^2
  return { n, meanDifference: mean(diffs), sdDifference: s, unitsNeeded: deltas.map((delta) => ({ delta, units: Math.ceil(n * (2.8 * s / delta) ** 2) })) };
}
