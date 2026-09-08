// concordance.test.mjs — G6 §3's claims about its own statistic, small and seeded.
import { describe, it, expect } from "vitest";
import { makeRng } from "./lib/rng.mjs";
import { concordanceOn, unitJackknife, pairBootstrap, simulatePopulation, euclid, criterion, disagreement, monotone, coverageExperiment, seScaling, shrinkageExperiment } from "./concordance.mjs";

describe("G6 §3 — distance validity as a concordance", () => {
  const pop = simulatePopulation({ n: 50, noise: 1, rng: makeRng(21) });
  const dis = disagreement(pop);

  it("is invariant to any monotone change of the metric, exactly", () => {
    const base = concordanceOn(50, euclid(pop.z), dis);
    for (const f of [(x) => x * x * x, (x) => Math.log1p(x), (x) => 7 * x + 1, Math.sqrt]) {
      expect(concordanceOn(50, monotone(euclid(pop.z), f), dis)).toBe(base);
    }
  });

  it("is one half at no information, whatever the target's marginal", () => {
    const rng = makeRng(22);
    const junk = Array.from({ length: 50 }, () => [rng.normal(), rng.normal()]);
    const C = concordanceOn(50, euclid(junk), dis);
    expect(Math.abs(C - 0.5)).toBeLessThan(0.05);
  });

  it("the criterion's distance predicts the target at least as well as an unvalidated metric", () => {
    expect(concordanceOn(50, criterion(pop), dis)).toBeGreaterThan(concordanceOn(50, euclid(pop.z), dis));
  });

  it("the pair-independent interval is far tighter than the unit jackknife on one draw", () => {
    const j = unitJackknife(30, euclid(pop.z), dis);
    const b = pairBootstrap(30, euclid(pop.z), dis, { B: 40, rng: makeRng(23) });
    expect(j.se / b.se).toBeGreaterThan(1.5);
  });

  it("the unit jackknife covers near nominally and the pair bootstrap does not", () => {
    const res = coverageExperiment({ n: 24, reps: 40, seed: 24, B: 40 });
    expect(res.jackknifeCoverage).toBeGreaterThanOrEqual(0.8);
    expect(res.pairBootstrapCoverage).toBeLessThan(res.jackknifeCoverage);
    expect(res.pairBootstrapCoverage).toBeLessThan(0.8);
  });

  it("the statistic's spread falls with the square root of units, not with pairs", () => {
    const rows = seScaling({ ns: [16, 64], reps: 40, seed: 25 });
    const ratio = rows[0].sd / rows[1].sd; // units ×4: n^-1/2 predicts 2, pairs^-1/2 predicts ~4
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(3.0);
  });

  it("shrunken point summaries and posterior-expected distances are both computed, and neither reaches the true space", () => {
    const res = shrinkageExperiment({ n: 30, reps: 6, seed: 26 });
    expect(res.trueZ.mean).toBeGreaterThan(res.noisy.mean);
    expect(res.shrunkPoint.mean).toBeGreaterThan(0.5);
    expect(res.expectedPosterior.mean).toBeGreaterThan(0.5);
  });
});
