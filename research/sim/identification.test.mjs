// identification.test.mjs — G7 §3's table and §4's graph results, exactly.
import { describe, it, expect } from "vitest";
import { identify, DESIGNS, runIdentificationTable, pairingGraphNullSpace, GRAPHS, oneRelationPerUnit, roundRobin } from "./identification.mjs";

const byKey = Object.fromEntries(runIdentificationTable().map((r) => [r.key, r]));

describe("G7 §3 — the identification table, as a rank per design", () => {
  it("one relation per unit: rank 2 — a total variance and a cross covariance, nothing apart", () => {
    const r = byKey.oneRelationPerUnit;
    expect(r.rank).toBe(2);
    expect(r.identified).toEqual([]);
  });

  it("round-robin once: member terms and both reciprocities identified; relationship and error only as a sum", () => {
    const r = byKey.roundRobinOnce;
    expect(r.identified).toEqual(["sender", "receiver", "genRecip", "dyadRecip"]);
    expect(r.unidentified).toEqual(["relationship", "error"]);
    expect(r.described).toEqual(["relationship − error"]);
  });

  it("round-robin replicated in separate sittings: everything identified", () => {
    const r = byKey.roundRobinReplicated;
    expect(r.unidentified).toEqual([]);
  });

  it("both directions in one sitting: the dyadic covariance is confounded with the sitting term", () => {
    const r = byKey.sharedSitting;
    expect(r.unidentified).toEqual(expect.arrayContaining(["dyadRecip", "sitting"]));
    expect(r.identified).toEqual(expect.arrayContaining(["sender", "receiver", "genRecip"]));
  });

  it("one direction only: the dyadic covariance is absent as an estimand; member terms identified", () => {
    const r = byKey.oneDirectionRing;
    expect(r.unidentified).toEqual(expect.arrayContaining(["dyadRecip"]));
    expect(r.identified).toEqual(expect.arrayContaining(["sender", "receiver", "genRecip"]));
  });

  it("a context term on triples in no other context is confounded; on quads it is identified; on crossed triples it is identified", () => {
    expect(byKey.contextTriples.unidentified).toContain("context");
    expect(byKey.contextQuads.identified).toContain("context");
    expect(byKey.contextFano.identified).toContain("context");
  });

  it("the sum that stays identified on the once design is relationship + error, not either", () => {
    // A combination c'theta is identified iff c is orthogonal to the null
    // space; (1,1) on (relationship, error) is orthogonal to (1,−1).
    const r = byKey.roundRobinOnce;
    const [c] = r.nulls;
    const iRel = r.names.indexOf("relationship");
    const iErr = r.names.indexOf("error");
    expect(Math.abs(c[iRel] + c[iErr])).toBeLessThan(1e-6);
  });

  it("every design in the table carries a claim, and the table runs", () => {
    for (const d of DESIGNS) expect(d.claim.length).toBeGreaterThan(20);
    expect(Object.keys(byKey).length).toBe(DESIGNS.length);
  });

  it("is a rank, not a sample: rerunning a design gives the same answer", () => {
    const a = identify(roundRobin(2, 4, 1));
    const b = identify(roundRobin(2, 4, 1));
    expect(a.rank).toBe(b.rank);
    expect(a.identified).toEqual(b.identified);
    expect(identify(oneRelationPerUnit(3)).rank).toBe(2);
  });
});

describe("G7 §4 — what a pairing graph lets a symmetric observation attribute", () => {
  for (const g of GRAPHS) {
    it(`${g.key}: differences leave one constant per component`, () => {
      const r = pairingGraphNullSpace(g.units, g.edges, "difference");
      expect(r.nullDimension).toBe(g.components ?? 1);
    });
    it(`${g.key}: sums leave ${g.bipartite ? "one alternating constant per bipartite component" : "nothing on a component with an odd cycle"}`, () => {
      const r = pairingGraphNullSpace(g.units, g.edges, "sum");
      expect(r.nullDimension).toBe(g.bipartite ? (g.components ?? 1) : 0);
    });
  }
});
