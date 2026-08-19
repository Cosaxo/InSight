// The Map arithmetic's contract:
//
//   1. sim is a shrunk cosine — no pair reads as a perfect proxy, and an
//      anti-correlation is as strong a TIE as a correlation (the web
//      ranks by |sim|; the sign only decides solid vs dotted).
//   2. The plane is deterministic given the loadings — same vectors, same
//      picture — and every point lands inside the box with the declutter
//      gap respected against total overlap.
//   3. The Oracle's device-side estimate recovers a planted trait, its
//      guess is clamped so nothing fakes certainty, and surprisal charges
//      the ACTUAL answer against the sealed posterior.
import { describe, expect, it } from "vitest";
import {
  PATTERNS_SIM_SHRINK,
  edgesOf,
  estimateTheta,
  mapGeometry,
  nearOf,
  oracleGuess,
  planeOf,
  simOf,
  surprisalBits,
  type MapNode,
} from "./patternsMap";

const K = 8;
const vec = (...head: number[]): number[] =>
  Array.from({ length: K }, (_, i) => head[i] ?? 0);

const POOL: MapNode[] = [
  { id: "a", L: vec(1, 0), n: 40 },
  { id: "a2", L: vec(0.9, 0.1), n: 35 },
  { id: "anti", L: vec(-1, 0), n: 30 },
  { id: "b", L: vec(0, 1), n: 25 },
  { id: "b2", L: vec(0.1, 0.9), n: 20 },
  { id: "weak", L: vec(0.05, 0.05, 0.02), n: 5 },
];

describe("sim and the web", () => {
  const { U, hub } = mapGeometry(POOL);

  it("is a shrunk cosine, symmetric, clamped", () => {
    expect(simOf(U, 0, 1)).toBeCloseTo(simOf(U, 1, 0), 10);
    expect(simOf(U, 0, 0)).toBeCloseTo(PATTERNS_SIM_SHRINK, 5);
    expect(simOf(U, 0, 2)).toBeCloseTo(-PATTERNS_SIM_SHRINK, 5);
    expect(Math.abs(simOf(U, 0, 3))).toBeLessThan(0.05);
  });

  it("ranks an anti-correlation as a tie, not a stranger", () => {
    const near = nearOf(U, 0, 2);
    const ids = near.map((x) => POOL[x.j].id);
    expect(ids).toContain("anti");
    expect(near.find((x) => POOL[x.j].id === "anti")!.r).toBeLessThan(0);
  });

  it("hubs are norms, normalised to the strongest", () => {
    expect(Math.max(...hub)).toBe(1);
    expect(hub[POOL.findIndex((q) => q.id === "weak")]).toBeLessThan(0.2);
  });

  it("dedupes the web and sorts it strongest first", () => {
    const edges = edgesOf(U, 3);
    const keys = edges.map((e) => `${e.i}:${e.j}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < edges.length; i++) {
      expect(Math.abs(edges[i - 1].r)).toBeGreaterThanOrEqual(Math.abs(edges[i].r));
    }
  });
});

describe("the plane", () => {
  const { U } = mapGeometry(POOL);
  const edges = edgesOf(U, 3);

  it("is deterministic and stays inside the box", () => {
    const a = planeOf(POOL, edges);
    const b = planeOf(POOL, edges);
    expect(a).toEqual(b);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(16 * 0.6 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(344 - 16 * 0.6 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(16 * 0.6 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(330 - 16 * 0.6 + 1e-9);
    }
  });

  it("keeps no two dots on top of each other", () => {
    const pts = planeOf(POOL, edges);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      expect(d).toBeGreaterThan(2);
    }
  });
});

describe("the Oracle's arithmetic", () => {
  it("recovers a planted trait from the viewer's own answers", () => {
    // a person who consistently answers +1 on factor-0 questions
    const obs = [
      { L: vec(1, 0), r: 0.8 },
      { L: vec(0.9, 0.1), r: 0.7 },
      { L: vec(-1, 0), r: -0.75 },
    ];
    const theta = estimateTheta(obs, K);
    expect(theta[0]).toBeGreaterThan(0.3);
    // and the guess on a new factor-0 question leans option 0
    const g = oracleGuess(theta, vec(1, 0), 0);
    expect(g.pred).toBe(0);
    expect(g.p0).toBeGreaterThan(0.6);
  });

  it("clamps — nothing fakes certainty, in either direction", () => {
    const sure = oracleGuess(vec(50), vec(1), 0.9);
    expect(sure.p0).toBe(0.95);
    const anti = oracleGuess(vec(-50), vec(1), -0.9);
    expect(anti.p0).toBe(0.05);
  });

  it("charges surprisal against the actual answer", () => {
    expect(surprisalBits(0.95, 0)).toBeCloseTo(-Math.log2(0.95), 6);
    expect(surprisalBits(0.95, 1)).toBeCloseTo(-Math.log2(0.05), 6);
    expect(surprisalBits(0.95, 1)).toBeGreaterThan(surprisalBits(0.95, 0));
  });

  it("an empty history guesses the marginal alone", () => {
    const theta = estimateTheta([], K);
    for (const t of theta) expect(t).toBe(0);
    const g = oracleGuess(theta, vec(1, 0), 0.4);
    expect(g.p0).toBeCloseTo(0.7, 6);
  });
});
