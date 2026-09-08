// reciprocity.mjs — G7 §9's sizing line, as a Monte Carlo.
//
// The claim: to tell a dyadic reciprocity correlation r from zero at the
// conventional resolution takes pairs of the order of (z_a + z_b)^2 / r^2
// with the relationship terms known exactly, and that number divided by
// the squared reliability of the estimated terms when they are not —
// reliability being var(g) / (var(g) + var(e)/reps). At r = 0.1, equal
// variances and two replicates per direction the paper says about eight
// hundred pairs become about eighteen hundred. This file draws the pairs
// and counts rejections.

import { makeRng, correlation, zQuantile, mean } from "./lib/rng.mjs";

export const reliability = (sigmaG2, sigmaE2, reps) => sigmaG2 / (sigmaG2 + sigmaE2 / reps);

/** Pairs needed for a correlation r (attenuated by reliability R) at two-sided alpha and power. */
export function requiredPairs({ r, R = 1, alpha = 0.05, power = 0.8 }) {
  const zA = zQuantile(1 - alpha / 2);
  const zB = zQuantile(power);
  return Math.ceil(((zA + zB) / Math.atanh(R * r)) ** 2 + 3);
}

/**
 * Power of the test of r = 0 on the correlation between the two directed
 * relationship terms, each estimated as the mean of `reps` noisy readings.
 * Member terms are assumed removed exactly, which is what the paper's
 * arithmetic assumes; `roundRobinAttenuation` prices what removing them
 * actually costs.
 */
export function reciprocityPower({ nPairs, r, sigmaG = 1, sigmaE = 1, reps = 2, alpha = 0.05, nSim = 400, seed = 7 }) {
  const rng = makeRng(seed);
  const zA = zQuantile(1 - alpha / 2);
  let rejections = 0;
  const observed = [];
  for (let s = 0; s < nSim; s += 1) {
    const x = new Float64Array(nPairs);
    const y = new Float64Array(nPairs);
    for (let p = 0; p < nPairs; p += 1) {
      const [g1, g2] = rng.bivariate(r);
      let e1 = 0;
      let e2 = 0;
      for (let k = 0; k < reps; k += 1) {
        e1 += rng.normal();
        e2 += rng.normal();
      }
      x[p] = sigmaG * g1 + (sigmaE * e1) / reps;
      y[p] = sigmaG * g2 + (sigmaE * e2) / reps;
    }
    const rho = correlation(Array.from(x), Array.from(y));
    observed.push(rho);
    const z = Math.atanh(rho) * Math.sqrt(nPairs - 3);
    if (Math.abs(z) > zA) rejections += 1;
  }
  const R = reliability(sigmaG ** 2, sigmaE ** 2, reps);
  return { nPairs, r, reps, R, power: rejections / nSim, meanObservedR: mean(observed), predictedObservedR: R * r, nSim };
}

/**
 * The same correlation when the relationship terms are estimated inside
 * round-robin groups by two-way centring (y_ij − mean_i· − mean_·j + mean_··,
 * the diagonal missing), with sender and receiver terms present. What this
 * prices is the extra attenuation the member-term removal adds on top of
 * reliability, which the paper's line does not carry.
 */
export function roundRobinAttenuation({ groupSize = 6, nGroups = 60, r = 0.3, sigmaA = 1, sigmaB = 1, sigmaG = 1, sigmaE = 1, reps = 2, nSim = 100, seed = 11 }) {
  const rng = makeRng(seed);
  const observed = [];
  const naive = [];
  for (let s = 0; s < nSim; s += 1) {
    const xs = [];
    const ys = [];
    const xn = [];
    const yn = [];
    for (let g = 0; g < nGroups; g += 1) {
      const k = groupSize;
      const a = Array.from({ length: k }, () => sigmaA * rng.normal());
      const b = Array.from({ length: k }, () => sigmaB * rng.normal());
      const G = Array.from({ length: k }, () => new Float64Array(k));
      for (let i = 0; i < k; i += 1) {
        for (let j = i + 1; j < k; j += 1) {
          const [g1, g2] = rng.bivariate(r);
          G[i][j] = sigmaG * g1;
          G[j][i] = sigmaG * g2;
        }
      }
      const Y = Array.from({ length: k }, () => new Float64Array(k));
      for (let i = 0; i < k; i += 1) {
        for (let j = 0; j < k; j += 1) {
          if (i === j) continue;
          let e = 0;
          for (let t = 0; t < reps; t += 1) e += rng.normal();
          Y[i][j] = a[i] + b[j] + G[i][j] + (sigmaE * e) / reps;
        }
      }
      const rowMean = Y.map((row, i) => Array.from(row).filter((_, j) => j !== i).reduce((p, q) => p + q, 0) / (k - 1));
      const colMean = Array.from({ length: k }, (_, j) => Y.map((row, i) => (i === j ? 0 : row[j])).reduce((p, q) => p + q, 0) / (k - 1));
      const grand = rowMean.reduce((p, q) => p + q, 0) / k;
      for (let i = 0; i < k; i += 1) {
        for (let j = i + 1; j < k; j += 1) {
          xs.push(Y[i][j] - rowMean[i] - colMean[j] + grand);
          ys.push(Y[j][i] - rowMean[j] - colMean[i] + grand);
          // the naive reading: raw responses, member terms not removed
          xn.push(Y[i][j]);
          yn.push(Y[j][i]);
        }
      }
    }
    observed.push(correlation(xs, ys));
    naive.push(correlation(xn, yn));
  }
  const R = reliability(sigmaG ** 2, sigmaE ** 2, reps);
  return { groupSize, nGroups, r, R, predictedFromReliability: R * r, observedCentred: mean(observed), observedRaw: mean(naive), nSim };
}
