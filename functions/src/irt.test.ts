// irt.ts pinned: the 2PL, EAP on the edge forms, and Φ against its table.
// Everything here is arithmetic a reviewer can check by hand, which is the
// point — the score every "sharper than X%" sentence will rest on should be
// falsifiable from this file alone.
import { describe, it, expect } from "vitest";
import { p2pl, eap, information, normalCdf, THETA_GRID, THETA_MIN, THETA_MAX, THETA_STEP } from "./irt";

const item = (a: number, b: number) => ({ a, b });

describe("the 2PL", () => {
  it("is one half at the item's difficulty, whatever the discrimination", () => {
    for (const a of [0.5, 1, 2.5, 5]) expect(p2pl(1.3, a, 1.3)).toBeCloseTo(0.5, 12);
  });
  it("rises with θ, and faster for a sharper item", () => {
    expect(p2pl(1, 1, 0)).toBeCloseTo(1 / (1 + Math.exp(-1)), 12);
    expect(p2pl(1, 3, 0)).toBeGreaterThan(p2pl(1, 1, 0));
    expect(p2pl(-1, 3, 0)).toBeLessThan(p2pl(-1, 1, 0));
  });
});

describe("the grid", () => {
  it("runs −5 … +5 at 0.05, 201 points, endpoints included", () => {
    expect(THETA_GRID).toHaveLength(201);
    expect(THETA_GRID[0]).toBe(THETA_MIN);
    expect(THETA_GRID.at(-1)).toBe(THETA_MAX);
    expect(THETA_GRID[100]).toBe(0);
    expect(THETA_GRID[1] - THETA_GRID[0]).toBeCloseTo(THETA_STEP, 12);
  });
});

describe("EAP", () => {
  it("with no items returns the prior — θ 0, SE 1 — the honest answer to no evidence", () => {
    const r = eap([], []);
    expect(r.theta).toBeCloseTo(0, 2);
    expect(r.se).toBeCloseTo(1, 1); // the discretised N(0,1) on a ±5 grid
  });

  it("is FINITE on a perfect score and on a zero score, where MLE is not", () => {
    const form = Array.from({ length: 25 }, (_, i) => item(2, -2 + (i * 4) / 24));
    const allRight = eap(form, form.map(() => 1));
    const allWrong = eap(form, form.map(() => 0));
    expect(Number.isFinite(allRight.theta)).toBe(true);
    expect(Number.isFinite(allWrong.theta)).toBe(true);
    expect(allRight.theta).toBeGreaterThan(2); // above the hardest item, pulled back by the prior
    expect(allWrong.theta).toBeLessThan(-2);
    expect(allRight.theta).toBeLessThan(THETA_MAX);
    expect(allWrong.theta).toBeGreaterThan(THETA_MIN);
  });

  it("is symmetric: mirrored items and responses give a mirrored θ", () => {
    const form = [item(1.5, -1), item(2, 0.5), item(1, 2)];
    const up = eap(form, [1, 1, 0]);
    const down = eap(form.map((it) => item(it.a, -it.b)), [0, 0, 1]);
    expect(up.theta).toBeCloseTo(-down.theta, 3);
    expect(up.se).toBeCloseTo(down.se, 3);
  });

  it("with EQUAL discriminations the count is sufficient — which item you solved cannot matter (Rasch)", () => {
    // The likelihood's θ-dependence is exp(θ·r) / Π(1 + exp(a(θ − b_i)))
    // when every a is equal: the pattern enters only through r. So solving
    // only the easiest and solving only the hardest give the SAME θ̂. Pinned
    // because it looks like a bug and is a theorem — and because it is why
    // the next case needs the a's to differ.
    const form = [item(2, -1.5), item(2, 0), item(2, 1.5)];
    const easyOnly = eap(form, [1, 0, 0]);
    const hardOnly = eap(form, [0, 0, 1]);
    expect(hardOnly.theta).toBeCloseTo(easyOnly.theta, 6);
    expect(hardOnly.se).toBeCloseTo(easyOnly.se, 6);
    expect(easyOnly.theta).toBeLessThan(0); // one of three is a low reading
    // the true mirror: "solved only the easiest" ↔ "failed only the hardest"
    expect(eap(form, [1, 1, 0]).theta).toBeCloseTo(-easyOnly.theta, 3);
  });

  it("it is DISCRIMINATION that makes which item you solved count — the sharper item moves θ more", () => {
    // Same difficulty for both; one item twice as sharp. Solving only the
    // sharp one says more about θ than solving only the dull one — and the
    // bank's a runs 0.5 to 5.2, which is what makes "which 18" a question
    // with an answer (docs/OMIB-PLAN.md §2.2).
    const form = [item(1, 0), item(3, 0)];
    const dullOnly = eap(form, [1, 0]);
    const sharpOnly = eap(form, [0, 1]);
    expect(sharpOnly.theta).toBeGreaterThan(dullOnly.theta);
    expect(sharpOnly.theta).toBeGreaterThan(0);
    expect(dullOnly.theta).toBeLessThan(0);
    // and the two-item mirrored case is symmetric: "one of two" is exactly 0
    const two = [item(2, -1.5), item(2, 1.5)];
    expect(eap(two, [1, 0]).theta).toBeCloseTo(0, 3);
    expect(eap(two, [0, 1]).theta).toBeCloseTo(0, 3);
  });

  it("gets more certain as items accrue, and the SE tracks the information", () => {
    const one = eap([item(2, 0)], [1]);
    const many = eap(Array.from({ length: 12 }, () => item(2, 0)), Array.from({ length: 12 }, () => 1 as const));
    expect(many.se).toBeLessThan(one.se);
    // near the middle of a well-targeted form, SE ≈ 1/sqrt(information + prior precision)
    const form = Array.from({ length: 25 }, (_, i) => item(2, -1.5 + (i * 3) / 24));
    const u = form.map((it) => (it.b < 0.2 ? 1 : 0) as 0 | 1);
    const r = eap(form, u);
    const approx = 1 / Math.sqrt(information(form, r.theta) + 1);
    expect(Math.abs(r.se - approx)).toBeLessThan(0.06);
  });

  it("one item, answered right, at b = 0: θ̂ lands near +0.5 with a wide SE", () => {
    // Hand check: prior N(0,1) × a single logistic factor. The posterior
    // mean is modestly positive and most of the prior's spread remains.
    const r = eap([item(1, 0)], [1]);
    expect(r.theta).toBeGreaterThan(0.3);
    expect(r.theta).toBeLessThan(0.7);
    expect(r.se).toBeGreaterThan(0.8);
    expect(r.se).toBeLessThan(1);
  });

  it("refuses a form whose items and responses do not align", () => {
    expect(() => eap([item(1, 0)], [1, 0])).toThrow(/1 items, 2 responses/);
  });
});

describe("Φ", () => {
  it("matches the table to three decimals", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.8413, 4);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-2.5758)).toBeCloseTo(0.005, 3);
    expect(normalCdf(4)).toBeGreaterThan(0.99996);
  });
  it("is symmetric about zero", () => {
    for (const x of [0.3, 1.2, 2.7]) expect(normalCdf(x) + normalCdf(-x)).toBeCloseTo(1, 7);
  });
});
