// The trait web's contract (v28 §13):
//
//   1. A row exists only when BOTH its dimensions resolve — one taken
//      test yields nothing, which is what lets the card refuse to render
//      under four rows instead of drawing a web with no threads.
//   2. The shared rail flips b when the usual pull is opposite, so
//      "following the pattern" always lands the dots together.
//   3. A break needs a wide gap AND a dimension away from the middle —
//      two mid-scale scores 24 apart are noise, not character.
//   4. Rows sort strongest tension first, because the headline is the
//      biggest break and the list should agree with it.
import { describe, expect, it } from "vitest";
import { TRAIT_LINKS, traitRows, type TraitDimRef } from "./traitLinks";

const dim = (v: number): TraitDimRef => ({ v, label: "x", color: "#888" });

/** a dimOf over a values table keyed "test.dim" — absent means untaken */
const from = (vals: Record<string, number>) =>
  (test: string, d: string): TraitDimRef | null =>
    `${test}.${d}` in vals ? dim(vals[`${test}.${d}`]) : null;

describe("traitRows", () => {
  it("yields a row only when both sides resolve", () => {
    // big5 alone: every link crosses tests, so nothing resolves
    const onlyBig5 = from({ "big5.O": 80, "big5.C": 60, "big5.E": 40, "big5.A": 70, "big5.N": 30 });
    expect(traitRows(onlyBig5)).toEqual([]);
    // add one attachment dim: exactly the links it completes appear
    const two = from({ "big5.E": 40, "big5.A": 70, "attachment.warm": 80 });
    expect(traitRows(two).map((r) => r.id).sort()).toEqual(["big5Aattachmentwarm", "big5Eattachmentwarm"]);
  });

  it("flips b on the rail when the usual pull is opposite", () => {
    // big5.O 80 vs political.auth 20, sign −1: following the pattern —
    // high openness, low authority — lands both dots at 80
    const rows = traitRows(from({ "big5.O": 80, "political.auth": 20 }));
    expect(rows).toHaveLength(1);
    expect(rows[0].pa).toBe(80);
    expect(rows[0].pb).toBe(80);
    expect(rows[0].gap).toBe(0);
    expect(rows[0].state).toBe("holds");
  });

  it("calls a break only past both thresholds", () => {
    // wide gap, both mid-scale: 62 vs 38 is 24 apart but neither is a
    // trait (max 12 off 50 — exactly at the line, not past it… 62 is 12
    // off, which MEETS ≥12, so push inside the line instead)
    const noise = traitRows(from({ "big5.O": 61, "political.foreign": 39 }));
    expect(noise[0].gap).toBe(22); // under the gap line — holds
    expect(noise[0].state).toBe("holds");
    // wide gap AND a real trait: breaks
    const real = traitRows(from({ "big5.O": 90, "political.foreign": 40 }));
    expect(real[0].state).toBe("break");
    // narrow gap, strong trait: holds — the pattern is being followed
    const held = traitRows(from({ "big5.O": 90, "political.foreign": 85 }));
    expect(held[0].state).toBe("holds");
  });

  it("sorts strongest tension first and carries the authored words", () => {
    const rows = traitRows(from({
      "big5.O": 90, "political.foreign": 40, // gap 50
      "big5.E": 55, "attachment.play": 50,   // gap 5
    }));
    expect(rows.map((r) => r.gap)).toEqual([50, 5]);
    const link = TRAIT_LINKS.find((l) => l[0] === "big5" && l[1] === "O" && l[2] === "political" && l[3] === "foreign")!;
    expect(rows[0].rule).toBe(link[5]);
    expect(rows[0].breakLine).toBe(link[6]);
  });
});
