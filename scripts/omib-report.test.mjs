// omib-report.test.mjs — the §6 report against ledgers whose truth is known.
//
// A synthetic population answers the real bank under its own 2PL, folded
// into the exact key shapes functions/src/logic.ts writes (i_<n>_seen /
// _solved / _blank, t0 … t39) — so the report is proved on the case where
// the calibration DID transfer (the answers were generated from the
// published parameters) and on the case where it did not (generated from
// a scrambled difficulty), plus the floors. The fold is re-stated here
// rather than imported: the functions package is TypeScript, and the key
// shape is pinned in its own suite (logic-submit.test.ts) besides.
import { describe, it, expect } from "vitest";
import {
  omibScorecard, renderScorecard, loadBank, pearson, spearman,
  OMIB_REPORT_MIN_N, OMIB_REPORT_FIT_BAR, OMIB_ERA,
} from "./omib-report.mjs";

const bank = loadBank();
const p2pl = (theta, a, b) => 1 / (1 + Math.exp(-a * (theta - b)));

// A small seeded generator — Park–Miller — so every run is the same run.
const lcg = (seed) => {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};
const normal = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

/**
 * `n` first attempts: θ ~ N(mean, 1); each meets 25 items drawn at random
 * within the 2·6·9·6·2 pyramid; answers under the 2PL on `bOf(item)`, with
 * a small chance of running out of time (a blank, scored as a miss).
 */
function synthesize({ n, thetaMean = -0.4, bOf = (it) => it.b, blankRate = 0.03, seed = 7 }) {
  const rng = lcg(seed);
  const byRules = {};
  for (const it of bank) (byRules[it.rules] ||= []).push(it);
  const slots = { 1: 2, 2: 6, 3: 9, 4: 6, 5: 2 };
  const ledger = { ...OMIB_ERA, n: 0 };
  const histogram = { ...OMIB_ERA, n: 0 };
  for (let t = 0; t < n; t++) {
    const theta = thetaMean + normal(rng);
    ledger.n++;
    for (const [rules, k] of Object.entries(slots)) {
      const pool = byRules[rules].slice();
      for (let j = 0; j < k; j++) {
        const it = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        ledger[`i_${it.n}_seen`] = (ledger[`i_${it.n}_seen`] || 0) + 1;
        if (rng() < blankRate) ledger[`i_${it.n}_blank`] = (ledger[`i_${it.n}_blank`] || 0) + 1;
        else if (rng() < p2pl(theta, it.a, bOf(it))) ledger[`i_${it.n}_solved`] = (ledger[`i_${it.n}_solved`] || 0) + 1;
      }
    }
    // θ̂ as EAP would read it: shrunk toward the prior, with its own error
    const hat = 0.85 * theta + 0.35 * normal(rng);
    const bin = Math.max(0, Math.min(39, Math.floor((hat + 5) / 0.25)));
    histogram.n++;
    histogram[`t${bin}`] = (histogram[`t${bin}`] || 0) + 1;
  }
  return { ledger, histogram };
}

describe("the arithmetic", () => {
  it("pearson and spearman on a known line", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 9);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 9);
    expect(spearman([1, 2, 3, 4], [10, 100, 1000, 10000])).toBeCloseTo(1, 9);
    expect(spearman([1, 2, 2, 4], [4, 3, 3, 1])).toBeCloseTo(-1, 9);
    expect(Number.isNaN(pearson([1, 2], [1, 2]))).toBe(true);
  });

  it("reads the bank's public parameters and never a key", () => {
    expect(bank.length).toBeGreaterThanOrEqual(218);
    for (const it of bank) {
      expect(Object.keys(it).sort()).toEqual(["a", "b", "n", "rules"]);
      expect([1, 2, 3, 4, 5]).toContain(it.rules);
    }
  });
});

describe("the verdict", () => {
  it("says TRANSFERRED when the answers came from the published parameters", () => {
    const sc = omibScorecard({ ...synthesize({ n: 400 }), bank });
    expect(sc.era).toEqual({ ledger: true, histogram: true, adaptive: null });
    expect(sc.n).toBe(400);
    expect(sc.fitR).toBeGreaterThanOrEqual(0.9);
    expect(OMIB_REPORT_FIT_BAR).toBe(0.8);
    expect(sc.verdict).toBe("transferred");
    expect(sc.itemsInCorrelation).toBeGreaterThan(200);
    // THE PLAN'S FIRST BAR, kept as the finding that retired it: these
    // answers were generated from the published parameters, and r(b, rate)
    // still reads short of −0.8 — under a noise-free ceiling that is itself
    // only −0.83 here, because discrimination varies across items.
    expect(sc.r).toBeGreaterThan(-0.8);
    expect(sc.r).toBeLessThan(-0.7);
    expect(sc.rCeiling).toBeLessThan(-0.8);
    expect(sc.rCeiling).toBeGreaterThan(-0.9);
    expect(sc.r).toBeGreaterThan(sc.rCeiling);
    expect(sc.rho).toBeLessThan(-0.85);
    // the population reads where it was put — shrunk, as EAP reads it
    expect(sc.theta.n).toBe(400);
    expect(sc.theta.mean).toBeGreaterThan(-0.6);
    expect(sc.theta.mean).toBeLessThan(-0.15);
    expect(sc.theta.shareBelowZero).toBeGreaterThan(0.55);
    // the clock's share, as generated
    expect(sc.blankShare).toBeGreaterThan(0.015);
    expect(sc.blankShare).toBeLessThan(0.05);
    // the model at this population is close to what was observed
    expect(sc.fit.mad).toBeLessThan(0.12);
    expect(sc.fit.worst).toHaveLength(5);
    const page = renderScorecard(sc);
    expect(page).toContain("**Verdict: transferred**");
    expect(page).toContain("at or beyond the 0.8 bar");
    expect(page).toContain("noise-free ceiling of -0.8");
    expect(page).toContain("exposure, stratified");
    expect(page).toContain("exposure, adaptive** — no ledger yet");
  });

  it("says DID NOT TRANSFER when the answers came from a scrambled difficulty", () => {
    // each item answered as if it had another item's b — the published
    // order no longer predicts anything
    const shuffled = bank.map((it) => it.b);
    const rng = lcg(11);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const at = new Map(bank.map((it, i) => [it.n, shuffled[i]]));
    const sc = omibScorecard({ ...synthesize({ n: 400, bOf: (it) => at.get(it.n) }), bank });
    expect(sc.n).toBe(400);
    expect(sc.fitR).toBeLessThan(0.3);
    expect(sc.r).toBeGreaterThan(-0.4);
    expect(sc.fit.mad).toBeGreaterThan(0.15);
    expect(sc.verdict).toBe("did not transfer");
    expect(renderScorecard(sc)).toContain("**Verdict: did not transfer**");
    expect(renderScorecard(sc)).toContain("short of the 0.8 bar");
  });

  it("says TOO EARLY below the floor, and still shows what it has", () => {
    const sc = omibScorecard({ ...synthesize({ n: 20 }), bank });
    expect(sc.n).toBe(20);
    expect(sc.verdict).toBe("too early");
    expect(OMIB_REPORT_MIN_N).toBe(300);
    expect(sc.itemsSeen).toBeGreaterThan(150);
    expect(renderScorecard(sc)).toContain("20 first attempts counted of the 300");
    // WHY 300: at a hundred, a calibration that DID transfer reads under
    // the bar — a verdict there would be a false "did not"
    const hundred = omibScorecard({ ...synthesize({ n: 100 }), bank });
    expect(hundred.verdict).toBe("too early");
    expect(hundred.fitR).toBeLessThan(OMIB_REPORT_FIT_BAR);
    expect(hundred.fitR).toBeGreaterThan(0.6);
    const floor = omibScorecard({ ...synthesize({ n: 300 }), bank });
    expect(floor.verdict).toBe("transferred");
    expect(floor.fitR).toBeGreaterThan(0.85);
  });

  it("refuses ANOTHER ERA — a generator ledger, or a histogram from before the bank", () => {
    const { ledger, histogram } = synthesize({ n: 150 });
    const generator = { items: 25, gv: 4, n: 150, f_add_seen: 150 };
    expect(omibScorecard({ ledger: generator, histogram, bank }).verdict).toBe("another era");
    expect(omibScorecard({ ledger, histogram: { ...histogram, gv: 2 }, bank }).verdict).toBe("another era");
    expect(omibScorecard({ ledger: null, histogram: null, bank }).verdict).toBe("another era");
    const page = renderScorecard(omibScorecard({ ledger: null, histogram: null, bank }));
    expect(page).toContain("**Verdict: another era**");
  });

  it("reads the adaptive ledger for exposure only — it never enters the correlation", () => {
    const base = synthesize({ n: 200 });
    // an adaptive ledger in which every item was solved exactly half the time it was seen
    const adaptive = { ...OMIB_ERA, mode: "adaptive", n: 300 };
    for (const it of bank) { adaptive[`i_${it.n}_seen`] = 30; adaptive[`i_${it.n}_solved`] = 15; }
    const withA = omibScorecard({ ...base, adaptive, bank });
    const without = omibScorecard({ ...base, bank });
    expect(withA.r).toBe(without.r);
    expect(withA.fitR).toBe(without.fitR);
    expect(withA.verdict).toBe(without.verdict);
    expect(withA.era.adaptive).toBe(true);
    expect(withA.exposure.adaptive.n).toBe(300);
    expect(withA.exposure.adaptive.unseen).toBe(0);
    expect(withA.exposure.stratified.n).toBe(200);
    expect(renderScorecard(withA)).toContain("exposure, adaptive** — n 300");
  });

  it("is deterministic and never NaN-crashes on an empty era-stamped ledger", () => {
    const empty = omibScorecard({ ledger: { ...OMIB_ERA, n: 0 }, histogram: { ...OMIB_ERA, n: 0 }, bank });
    expect(empty.verdict).toBe("too early");
    expect(empty.r).toBeNull();
    expect(empty.fitR).toBeNull();
    expect(empty.theta.n).toBe(0);
    expect(() => renderScorecard(empty)).not.toThrow();
    const a = omibScorecard({ ...synthesize({ n: 120 }), bank });
    const b = omibScorecard({ ...synthesize({ n: 120 }), bank });
    expect(a).toEqual(b);
  });
});
