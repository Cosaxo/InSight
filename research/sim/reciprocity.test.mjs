// reciprocity.test.mjs — G7 §9's sizing, small and seeded.
import { describe, it, expect } from "vitest";
import { reliability, requiredPairs, reciprocityPower, roundRobinAttenuation } from "./reciprocity.mjs";

describe("G7 §9 — the reciprocity sizing line", () => {
  it("reliability at two replicates and equal variances is two thirds", () => {
    expect(reliability(1, 1, 2)).toBeCloseTo(2 / 3, 10);
  });

  it("the rule gives about eight hundred pairs at r = 0.1 with terms known, and about eighteen hundred at reliability two thirds", () => {
    const exact = requiredPairs({ r: 0.1 });
    const attenuated = requiredPairs({ r: 0.1, R: 2 / 3 });
    expect(exact).toBeGreaterThan(740);
    expect(exact).toBeLessThan(840);
    expect(attenuated).toBeGreaterThan(1650);
    expect(attenuated).toBeLessThan(1900);
  });

  it("the observed correlation is attenuated by the reliability, and power at the derived n is near the nominal 0.8", () => {
    const n = requiredPairs({ r: 0.1, R: 2 / 3 });
    const res = reciprocityPower({ nPairs: n, r: 0.1, reps: 2, nSim: 300, seed: 3 });
    expect(Math.abs(res.meanObservedR - res.predictedObservedR)).toBeLessThan(0.01);
    expect(res.power).toBeGreaterThan(0.68);
    expect(res.power).toBeLessThan(0.92);
  });

  it("at a fifth of the derived n the test is nearly powerless", () => {
    const res = reciprocityPower({ nPairs: 350, r: 0.1, reps: 2, nSim: 300, seed: 5 });
    expect(res.power).toBeLessThan(0.4);
  });

  it("removing member terms by centring in round-robin groups costs beyond the reliability", () => {
    const res = roundRobinAttenuation({ groupSize: 6, nGroups: 40, r: 0.3, reps: 2, nSim: 40, seed: 9 });
    // raw responses carry the members' generalized reciprocity noise; centred
    // ones are attenuated by reliability and by the centring's own error
    expect(res.observedCentred).toBeLessThan(res.predictedFromReliability);
    expect(res.observedCentred).toBeGreaterThan(0.5 * res.predictedFromReliability);
  });
});
