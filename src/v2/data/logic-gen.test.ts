// Unit tests for the procedural matrix generator. Runs in plain node.
//
// The generator's whole value is a guarantee the old hardcoded bank gave
// for free (a human checked 12 puzzles once): every generated item must be
// solvable, unambiguous at the option level, renderable by Prim, and on
// the declared difficulty ramp — for EVERY seed, because every attempt is
// a fresh form. So the core blocks sweep hundreds of seeds, and the
// family validators re-derive each rule's structure from the cells
// themselves (dot sums, Latin properties, ring counts) rather than
// trusting the construction path that produced them.
import { describe, expect, it } from "vitest";
import {
  buildCells9,
  canon,
  generateForm,
  mixSeed,
  mulberry32,
  version,
  type Cell,
  type Form,
  type Layer,
  type Shape,
} from "./logic-gen";

// 200 seeds in CI; LOGIC_SWEEP_SEEDS=5000 reruns the D53-sized sweep on demand
// (the number D53 and D394 quoted was measured that way, not at 200).
const N_SEEDS = Number(process.env.LOGIC_SWEEP_SEEDS) || 200;
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => (i + 1) * 2654435761 % 4294967296);
const forms: Form[] = SEEDS.map((s) => generateForm(s));

describe("PRNG stability", () => {
  it("mulberry32 first outputs are pinned (a refactor must not reshuffle every historic seed)", () => {
    const r = mulberry32(1);
    expect([r(), r(), r()].map((v) => v.toFixed(8))).toEqual([
      "0.62707394",
      "0.00273572",
      "0.52744704",
    ]);
    expect(mixSeed(42, 3)).toBe(1457683673);
  });
});

describe("form shape and determinism", () => {
  it("same seed → identical form; the version is stamped", () => {
    expect(generateForm(12345)).toEqual(generateForm(12345));
    expect(generateForm(12345).version).toBe(version);
  });

  it("different seeds → different puzzles (spot pair)", () => {
    const a = generateForm(1).items.map((i) => i.cells.map(canon).join("|")).join("¶");
    const b = generateForm(2).items.map((i) => i.cells.map(canon).join("|")).join("¶");
    expect(a).not.toBe(b);
  });

  it("25 items, 8 visible cells, 6 options each; diffs non-decreasing", () => {
    for (const f of forms) {
      expect(f.items).toHaveLength(25);
      for (const item of f.items) {
        expect(item.cells).toHaveLength(8);
        expect(item.opts).toHaveLength(6);
      }
      const diffs = f.items.map((i) => i.diff);
      for (let i = 1; i < diffs.length; i++) expect(diffs[i]).toBeGreaterThanOrEqual(diffs[i - 1]);
    }
  });
});

describe("answer key integrity (every seed, every item)", () => {
  it("opts[a] is the constructed answer; visible cells match the construction", () => {
    for (const [si, f] of forms.entries()) {
      for (const [ii, item] of f.items.entries()) {
        const { cells9 } = buildCells9(SEEDS[si], ii);
        expect(canon(item.opts[item.a]), `seed ${SEEDS[si]} item ${ii}`).toBe(canon(cells9[8]));
        expect(item.cells.map(canon)).toEqual(cells9.slice(0, 8).map(canon));
      }
    }
  });

  it("no distractor equals the answer, and all six options are pairwise distinct", () => {
    for (const f of forms) {
      for (const item of f.items) {
        const keys = item.opts.map(canon);
        expect(new Set(keys).size, `seed ${f.seed}`).toBe(6);
        // …as PICTURES, not just as canons (v4): two bars at one
        // orientation draw as one bar, two marks at one place as one
        // mark, and bar order never shows — so an option whose picture
        // matches another's is an ambiguity canon cannot see
        expect(new Set(item.opts.map(picture)).size, `seed ${f.seed} (${item.rules[0]})`).toBe(6);
      }
    }
  });

  it("the answer position varies — every slot 0..5 occurs across seeds", () => {
    const seen = new Set(forms.flatMap((f) => f.items.map((i) => i.a)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

});

// ── the banded template (v3 frozen, v4 live) ──
// The WEIGHT ramp is the calibration the percentile curve is derived
// against, so it is pinned verbatim; the family occupying a slot is drawn
// from that slot's same-weight band, so the sequence varies per attempt.
// The pools are pinned literally here on purpose: moving a family between
// bands (or changing a weight) is a recalibration and must show up as a
// test edit. Eleven of twenty-five slots sit at weight 3.5+ — the
// tail-heavy shape D61 chose for top-end discrimination. v4 (D394) keeps
// the ramp and adds the orientation/position families to the bands from
// 2.5 up; v3's pools are pinned beside it because a v3 seed must keep
// drawing from v3's pools forever.
const RAMP_25 = [1, 1, 1.5, 1.5, 2, 2, 2, 2.5, 2.5, 2.5, 3, 3, 3, 3, 3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4.5, 4.5, 4.5];
type Pools = { P1: string[]; P15: string[]; P2: string[]; P25: string[]; P3: string[]; P35: string[]; P4: string[]; P45: string[] };
const POOLS_V3: Pools = {
  P1: ["sizeRamp", "dotCount"],
  P15: ["shapeCycle", "sizeCycle"],
  P2: ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"],
  P25: ["overlay", "outerRowInnerCycle", "innerGrow"],
  P3: ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots"],
  P35: ["decompose", "dist2", "overlayXor", "ringLatin"],
  P4: ["latinShapeSizeFill", "outerLatinInnerLatin", "ringGrowFill", "innerGrowCycle", "fillRampShapeCycle"],
  P45: ["dist2Latin", "xorLatin", "ringLatinShape", "dist2Xor"],
};
const POOLS_V4: Pools = {
  P1: ["sizeRamp", "dotCount"],
  P15: ["shapeCycle", "sizeCycle"],
  P2: ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"],
  P25: ["overlay", "outerRowInnerCycle", "innerGrow", "barRotate"],
  P3: ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots", "markOrbit", "latinPos"],
  P35: ["decompose", "dist2", "overlayXor", "ringLatin", "barLatin"],
  P4: [
    "latinShapeSizeFill", "outerLatinInnerLatin", "ringGrowFill", "innerGrowCycle", "fillRampShapeCycle",
    "barXor3", "orbitShapeLatin", "markOrbitGrow",
  ],
  P45: ["dist2Latin", "xorLatin", "ringLatinShape", "dist2Xor", "posLatinBarLatin", "orbitXor", "barXorLatin"],
};
const bandAt = (P: Pools): string[][] => [
  P.P1, P.P1, P.P15, P.P15, P.P2, P.P2, P.P2, P.P25, P.P25, P.P25,
  P.P3, P.P3, P.P3, P.P3, P.P35, P.P35, P.P35, P.P35, P.P4, P.P4, P.P4, P.P4, P.P45, P.P45, P.P45,
];
const templateSuite = (label: string, P: Pools, era: Form[]) =>
  describe(`the banded template (${label})`, () => {
    const BAND_AT = bandAt(P);

    it("every form carries the fixed weight ramp — the curve's anchor does not move", () => {
      for (const f of era) expect(f.items.map((i) => i.diff)).toEqual(RAMP_25);
    });

    it("each slot's family comes from its own weight band; no family repeats in a form", () => {
      for (const f of era) {
        const fams = f.items.map((i) => i.rules[0]);
        fams.forEach((fam, i) => expect(BAND_AT[i], `seed ${f.seed} slot ${i}`).toContain(fam));
        expect(new Set(fams).size, `seed ${f.seed}`).toBe(25);
      }
    });

    it("the draws actually vary: every family of every band appears across seeds", () => {
      const seen = new Set(era.flatMap((f) => f.items.map((i) => i.rules[0])));
      for (const fam of new Set(BAND_AT.flat())) {
        expect(seen.has(fam), `family ${fam} never drawn in 200 seeds`).toBe(true);
      }
    });
  });
templateSuite("v4, the live era", POOLS_V4, forms);
templateSuite("v3, frozen", POOLS_V3, SEEDS.map((sd) => generateForm(sd, 3)));

describe("renderability (stays inside Prim's vocabulary)", () => {
  it("every layer of every cell and option is drawable", () => {
    const okLayer = (l: { s: string; z?: number; f?: string; n?: number; r?: number; p?: number }) => {
      if (l.s === ".") return typeof l.n === "number" && l.n >= 1 && l.n <= 6;
      // v4: a bar carries only an orientation, a mark only a place
      if (l.s === "b") return Number.isInteger(l.r) && (l.r as number) >= 0 && (l.r as number) <= 3 && l.z === undefined && l.f === undefined;
      if (l.s === "m") return Number.isInteger(l.p) && (l.p as number) >= 0 && (l.p as number) <= 7 && l.z === undefined && l.f === undefined;
      return (
        ["c", "q", "d", "t"].includes(l.s) &&
        [1, 1.4, 2, 3].includes(l.z as number) &&
        ["n", "s"].includes(l.f as string)
      );
    };
    for (const f of forms) {
      for (const item of f.items) {
        for (const cell of [...item.cells, ...item.opts]) {
          expect(cell.length).toBeGreaterThan(0);
          for (const l of cell) expect(okLayer(l), `seed ${f.seed}: ${canon(cell)}`).toBe(true);
        }
      }
    }
  });
});

// ── family semantics, re-derived from the cells (not the construction) ──
const rows9 = (cells9: Cell[]) => [cells9.slice(0, 3), cells9.slice(3, 6), cells9.slice(6, 9)];
const cols9 = (cells9: Cell[]) =>
  [0, 1, 2].map((c) => [cells9[c], cells9[3 + c], cells9[6 + c]]);
const dots = (cell: Cell) => cell.find((l) => l.s === ".")?.n ?? 0;
// One fill-state signature per cell: outline / solid / ring-motif.
const fillState = (cell: Cell) =>
  cell.length > 1 ? "ring" : cell[0].f === "s" ? "solid" : "outline";
// v4 readers (D394): the bar and the mark of a cell, and modular arithmetic
// for the attributes that wrap.
const isBaseLayer = (l: Layer) => l.s !== "." && l.s !== "b" && l.s !== "m";
const barOf = (c: Cell) => c.find((l) => l.s === "b");
const markOf = (c: Cell) => c.find((l) => l.s === "m");
const barR = (c: Cell) => barOf(c)?.r as number;
const markP = (c: Cell) => markOf(c)?.p as number;
const mod = (v: number, m: number) => ((v % m) + m) % m;
// the three line elements as bits (1 = —, 2 = |, 4 = /), plus a bit for
// the fourth orientation so a stray one cannot alias an element
const barMask = (c: Cell) =>
  c.filter((l) => l.s === "b").reduce((m, l) => m | (l.r === 0 ? 1 : l.r === 2 ? 2 : l.r === 1 ? 4 : 8), 0);
const oneBase = (c: Cell, z = 3) => {
  expect(isBaseLayer(c[0])).toBe(true);
  expect(c[0].z).toBe(z);
  expect(c[0].f).toBe("n");
};
// What a cell LOOKS like: bar order never shows, and a doubled bar or mark
// draws as one — so this is the identity the option list must keep
// distinct, over and above canon.
const picture = (c: Cell): string => {
  const bars = [...new Set(c.filter((l) => l.s === "b").map((l) => l.r))].sort((a, b) => (a as number) - (b as number));
  const marks = [...new Set(c.filter((l) => l.s === "m").map((l) => l.p))].sort((a, b) => (a as number) - (b as number));
  const rest = c.filter((l) => l.s !== "b" && l.s !== "m");
  return canon(rest) + "|b" + bars.join(",") + "|m" + marks.join(",");
};

describe("family semantics", () => {
  const each = (family: string, check: (cells9: Cell[], seed: number) => void) => {
    it(family, () => {
      let covered = 0;
      for (const seed of SEEDS.slice(0, 60)) {
        for (let i = 0; i < 25; i++) {
          const built = buildCells9(seed, i);
          if (built.family !== family) continue;
          covered++;
          check(built.cells9, seed);
        }
      }
      expect(covered).toBeGreaterThan(0);
    });
  };

  each("sizeRamp", (cells9) => {
    for (const row of rows9(cells9)) {
      const zs = row.map((c) => c[0].z as number);
      const shapes = new Set(row.map((c) => c[0].s));
      expect(shapes.size).toBe(1);
      const asc = zs[1] > zs[0];
      for (let i = 1; i < 3; i++) expect(asc ? zs[i] > zs[i - 1] : zs[i] < zs[i - 1]).toBe(true);
    }
  });

  each("dotCount", (cells9) => {
    for (const row of rows9(cells9)) {
      expect(dots(row[1])).toBe(dots(row[0]) + 1);
      expect(dots(row[2])).toBe(dots(row[0]) + 2);
    }
  });

  each("dotAdd", (cells9) => {
    for (const row of rows9(cells9)) {
      expect(dots(row[2])).toBe(dots(row[0]) + dots(row[1]));
    }
  });

  each("shapeCycle", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
    }
  });

  each("fillRamp", (cells9) => {
    for (const row of rows9(cells9)) {
      expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
      expect(new Set(row.map(fillState)).size).toBe(3);
    }
  });

  each("sizeFillAlt", (cells9) => {
    const all = cells9.flat().filter((l) => l.s !== ".");
    expect(new Set(all.map((l) => l.s)).size).toBe(1);
    const [f0, f1, f2] = rows9(cells9).map((row) => new Set(row.map((c) => c[0].f)));
    expect(f0.size).toBe(1);
    expect(f1.size).toBe(1);
    expect(f0).toEqual(f2);
    expect(f0).not.toEqual(f1);
  });

  each("overlay", (cells9) => {
    for (const row of rows9(cells9)) {
      expect(canon(row[2])).toBe(canon([row[0][0], row[1][0]]));
    }
  });

  each("outerRowInnerCycle", (cells9) => {
    for (const row of rows9(cells9)) expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
    for (const col of cols9(cells9)) expect(new Set(col.map((c) => c[1].s)).size).toBe(1);
  });

  each("latinShapeFill", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
      expect(new Set(line.map(fillState)).size).toBe(3);
    }
  });

  each("latinSizeShape", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
      expect(new Set(line.map((c) => c[0].z)).size).toBe(3);
    }
  });

  each("ringGrow", (cells9) => {
    for (const row of rows9(cells9)) {
      const ks = row.map((c) => c.length).sort((a, b) => a - b);
      expect(ks).toEqual([1, 2, 3]);
      for (const cell of row) expect(new Set(cell.map((l) => l.s)).size).toBe(1);
    }
  });

  each("decompose", (cells9) => {
    for (const row of rows9(cells9)) {
      // col2 is col0's outer; col1 is col0's inner, grown and solid
      expect(row[2]).toHaveLength(1);
      expect(row[2][0].s).toBe(row[0][0].s);
      expect(row[1][0].s).toBe(row[0][1].s);
      expect(row[1][0].f).toBe("s");
    }
  });

  each("dist2", (cells9) => {
    const hasInner = (c: Cell) => c.some((l) => l.s !== "." && l.z === 1);
    const hasDots = (c: Cell) => c.some((l) => l.s === ".");
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.filter(hasInner)).toHaveLength(2);
      expect(line.filter(hasDots)).toHaveLength(2);
    }
  });

  each("dist2", (cells9) => {
    // The two overlay elements' absence patterns must differ, or they read
    // as ONE rule — the degenerate case the construction's retry guards
    // against (measured 0 in 2,466 items, but a guard is not a proof).
    const hasA = (c: Cell) => c.some((l) => l.s !== "." && l.z === 1);
    const hasB = (c: Cell) => c.some((l) => l.s === ".");
    const holeA = rows9(cells9).map((row) => row.findIndex((c) => !hasA(c)));
    const holeB = rows9(cells9).map((row) => row.findIndex((c) => !hasB(c)));
    expect(holeA.join()).not.toBe(holeB.join());
  });

  each("sizeCycle", (cells9) => {
    for (const row of rows9(cells9)) expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].z)).size).toBe(3);
    }
    for (const cell of cells9) expect(cell[0].f).toBe("n");
  });

  each("dotSub", (cells9) => {
    for (const row of rows9(cells9)) {
      expect(dots(row[2])).toBe(dots(row[0]) - dots(row[1]));
      expect(dots(row[2])).toBeGreaterThan(0);
    }
  });

  each("innerGrow", (cells9) => {
    for (const row of rows9(cells9)) {
      const s = row[0][0].s;
      for (const cell of row) for (const l of cell) expect(l.s).toBe(s);
      expect(row[0].map((l) => [l.z, l.f])).toEqual([[3, "n"]]);
      expect(row[1].map((l) => [l.z, l.f])).toEqual([[3, "n"], [1, "s"]]);
      expect(row[2].map((l) => [l.z, l.f])).toEqual([[3, "n"], [2, "s"]]);
    }
  });

  each("latinDots", (cells9) => {
    const trio = [...new Set(cells9.map(dots))].sort((a, b) => a - b);
    expect(trio).toHaveLength(3);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.map(dots).sort((a, b) => a - b)).toEqual(trio);
    }
  });

  each("overlayXor", (cells9) => {
    const mask = (c: Cell) =>
      (c.some((l) => l.s !== "." && l.z === 1) ? 1 : 0) | (c.some((l) => l.s === ".") ? 2 : 0);
    const base0 = cells9[0].find((l) => l.s !== "." && l.z === 3);
    for (const cell of cells9) {
      const b = cell.find((l) => l.s !== "." && l.z === 3);
      expect(b?.s).toBe(base0?.s);
      expect(b?.f).toBe("n");
    }
    const rows = rows9(cells9);
    for (const row of rows) expect(mask(row[2])).toBe(mask(row[0]) ^ mask(row[1]));
    // at least one visible row's two operands overlap: on that row XOR
    // visibly differs from union/intersection/copy, so the GRID pins the
    // rule — not the option list
    expect(rows.some((row) => (mask(row[0]) & mask(row[1])) !== 0)).toBe(true);
  });

  // ── the D61 families ──
  const ringCount = (c: Cell) => c.length;
  const allOutlineNested = (c: Cell) => {
    expect(new Set(c.map((l) => l.s)).size).toBe(1);
    expect(c[0].z).toBe(3);
    for (let i = 1; i < c.length; i++) expect(c[i].z as number).toBeLessThan(c[i - 1].z as number);
  };

  each("ringLatin", (cells9) => {
    for (const row of rows9(cells9)) expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.map(ringCount).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    }
    for (const cell of cells9) {
      allOutlineNested(cell);
      for (const l of cell) expect(l.f).toBe("n");
    }
  });

  each("latinShapeSizeFill", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
      expect(new Set(line.map((c) => c[0].z)).size).toBe(3);
    }
    const [f0, f1, f2] = rows9(cells9).map((row) => new Set(row.map((c) => c[0].f)));
    expect(f0.size).toBe(1);
    expect(f1.size).toBe(1);
    expect(f0).toEqual(f2);
    expect(f0).not.toEqual(f1);
  });

  each("outerLatinInnerLatin", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
      expect(new Set(line.map((c) => c[1].s)).size).toBe(3);
    }
    for (const cell of cells9) {
      expect(cell[0].z).toBe(3);
      expect(cell[0].f).toBe("n");
      expect(cell[1].z).toBe(1);
      expect(cell[1].f).toBe("s");
    }
  });

  each("ringGrowFill", (cells9) => {
    const rows = rows9(cells9);
    for (const row of rows) {
      expect(new Set(row.flatMap((c) => c.map((l) => l.s))).size).toBe(1);
      expect(row.map(ringCount).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    }
    // count uniform per column (the progression), innermost fill per row,
    // alternating; every non-innermost layer stays an outline
    for (const col of cols9(cells9)) expect(new Set(col.map(ringCount)).size).toBe(1);
    const innermostF = rows.map((row) => new Set(row.map((c) => c[c.length - 1].f)));
    expect(innermostF[0].size).toBe(1);
    expect(innermostF[1].size).toBe(1);
    expect(innermostF[0]).toEqual(innermostF[2]);
    expect(innermostF[0]).not.toEqual(innermostF[1]);
    for (const cell of cells9) for (const l of cell.slice(0, -1)) expect(l.f).toBe("n");
  });

  each("innerGrowCycle", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
    }
    for (const [i, cell] of cells9.entries()) {
      const col = i % 3;
      expect(cell[0].z).toBe(3);
      expect(cell[0].f).toBe("n");
      if (col === 0) expect(cell).toHaveLength(1);
      else {
        expect(cell).toHaveLength(2);
        expect(cell[1].s).toBe(cell[0].s);
        expect(cell[1].f).toBe("s");
        expect(cell[1].z).toBe(col === 1 ? 1 : 2);
      }
    }
  });

  each("fillRampShapeCycle", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
    }
    // fill state uniform per column, all three states across the columns
    const colStates = cols9(cells9).map((col) => new Set(col.map(fillState)));
    for (const st of colStates) expect(st.size).toBe(1);
    expect(new Set(colStates.map((st) => [...st][0])).size).toBe(3);
    for (const cell of cells9) expect(new Set(cell.map((l) => l.s)).size).toBe(1);
  });

  const baseOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 3);
  const hasInner = (c: Cell) => c.some((l) => l.s !== "." && l.z === 1);
  const hasDots = (c: Cell) => c.some((l) => l.s === ".");

  each("dist2Latin", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => baseOf(c)?.s)).size).toBe(3);
      expect(line.filter(hasInner)).toHaveLength(2);
      expect(line.filter(hasDots)).toHaveLength(2);
    }
    const holeA = rows9(cells9).map((row) => row.findIndex((c) => !hasInner(c)));
    const holeB = rows9(cells9).map((row) => row.findIndex((c) => !hasDots(c)));
    expect(holeA.join()).not.toBe(holeB.join());
  });

  each("xorLatin", (cells9) => {
    const mask = (c: Cell) => (hasInner(c) ? 1 : 0) | (hasDots(c) ? 2 : 0);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => baseOf(c)?.s)).size).toBe(3);
    }
    const rows = rows9(cells9);
    for (const row of rows) expect(mask(row[2])).toBe(mask(row[0]) ^ mask(row[1]));
    expect(rows.some((row) => (mask(row[0]) & mask(row[1])) !== 0)).toBe(true);
  });

  each("ringLatinShape", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
      expect(line.map(ringCount).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    }
    for (const cell of cells9) {
      allOutlineNested(cell);
      for (const l of cell) expect(l.f).toBe("n");
    }
  });

  each("dist2Xor", (cells9) => {
    // element A (the inner shape) is distributed two-per-line…
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.filter(hasInner)).toHaveLength(2);
    }
    // …while the dots follow row-wise XOR, with the pin row present
    const rows = rows9(cells9);
    const b = (c: Cell) => (hasDots(c) ? 1 : 0);
    for (const row of rows) expect(b(row[2])).toBe(b(row[0]) ^ b(row[1]));
    expect(rows.some((row) => b(row[0]) === 1 && b(row[1]) === 1)).toBe(true);
    // one uniform base under everything
    const b0 = baseOf(cells9[0]);
    for (const cell of cells9) {
      expect(baseOf(cell)?.s).toBe(b0?.s);
      expect(baseOf(cell)?.f).toBe("n");
    }
  });

  // ── the v4 families (D394): orientation and position ──
  // The two new attributes are arithmetic, so a progression is checked
  // as one constant difference along every row, read off the cells, and
  // a distribution as one trio held by every line.
  each("barRotate", (cells9) => {
    const rows = rows9(cells9);
    const steps = rows.map((row) => mod(barR(row[1]) - barR(row[0]), 4));
    expect(new Set(steps).size).toBe(1); // one turn, every row
    expect([1, 3]).toContain(steps[0]); // ±45°
    for (const row of rows) {
      expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
      expect(mod(barR(row[2]) - barR(row[1]), 4)).toBe(steps[0]);
      for (const cell of row) {
        expect(cell).toHaveLength(2);
        oneBase(cell);
        expect(["c", "q", "d"]).toContain(cell[0].s); // a bar never sits in a triangle
      }
    }
    expect(new Set(rows.map((row) => barR(row[0]))).size).toBe(3); // no two rows alike
  });

  each("markOrbit", (cells9) => {
    const rows = rows9(cells9);
    const steps = rows.map((row) => mod(markP(row[1]) - markP(row[0]), 8));
    expect(new Set(steps).size).toBe(1);
    expect([1, 2, 3, 5, 6, 7]).toContain(steps[0]); // one to three places, either way
    for (const row of rows) {
      expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
      expect(mod(markP(row[2]) - markP(row[1]), 8)).toBe(steps[0]);
      for (const cell of row) {
        expect(cell).toHaveLength(2);
        oneBase(cell);
      }
    }
    expect(new Set(rows.map((row) => markP(row[0]))).size).toBe(3);
  });

  each("latinPos", (cells9) => {
    const trio = [...new Set(cells9.map(markP))].sort((a, b) => a - b);
    expect(trio).toHaveLength(3);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.map(markP).sort((a, b) => a - b)).toEqual(trio);
    }
    for (const cell of cells9) {
      expect(cell).toHaveLength(2);
      oneBase(cell);
      expect(cell[0].s).toBe(cells9[0][0].s);
    }
  });

  each("barLatin", (cells9) => {
    const trio = [...new Set(cells9.map(barR))].sort((a, b) => a - b);
    expect(trio).toHaveLength(3);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.map(barR).sort((a, b) => a - b)).toEqual(trio);
    }
    for (const row of rows9(cells9)) expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
    for (const cell of cells9) {
      expect(cell).toHaveLength(2);
      oneBase(cell);
      expect(["c", "q", "d"]).toContain(cell[0].s);
    }
  });

  // a pin row: the operands overlap AND each holds a bar the other lacks,
  // so XOR differs from union, intersection and both differences on it
  const xorPinned = (row: Cell[]) => {
    const a = barMask(row[0]), b = barMask(row[1]);
    return (a & b) !== 0 && (a & ~b) !== 0 && (b & ~a) !== 0;
  };
  const barsWellFormed = (cell: Cell) => {
    const rs = cell.filter((l) => l.s === "b").map((l) => l.r as number);
    expect(rs.every((r) => [0, 1, 2].includes(r))).toBe(true); // three elements; never the fourth orientation
    expect(rs).toEqual([...rs].sort((a, b) => a - b)); // one canon per picture
    expect(new Set(rs).size).toBe(rs.length); // a doubled bar draws as one
    for (const l of cell.slice(1)) expect(l.s).toBe("b");
  };

  each("barXor3", (cells9) => {
    for (const cell of cells9) {
      oneBase(cell);
      expect(cell[0].s).toBe(cells9[0][0].s);
      barsWellFormed(cell);
    }
    const rows = rows9(cells9);
    for (const row of rows) expect(barMask(row[2])).toBe(barMask(row[0]) ^ barMask(row[1]));
    expect(xorPinned(rows[0])).toBe(true);
    expect(xorPinned(rows[2])).toBe(true);
  });

  each("orbitShapeLatin", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
    }
    const rows = rows9(cells9);
    const steps = rows.map((row) => mod(markP(row[1]) - markP(row[0]), 8));
    expect(new Set(steps).size).toBe(1);
    for (const row of rows) expect(mod(markP(row[2]) - markP(row[1]), 8)).toBe(steps[0]);
    for (const cell of cells9) {
      expect(cell).toHaveLength(2);
      oneBase(cell);
    }
  });

  each("markOrbitGrow", (cells9) => {
    const rows = rows9(cells9);
    const steps = rows.map((row) => mod(markP(row[1]) - markP(row[0]), 8));
    expect(new Set(steps).size).toBe(1);
    for (const row of rows) {
      expect(new Set(row.map((c) => c[0].s)).size).toBe(1);
      const zs = row.map((c) => c[0].z as number);
      expect(zs).toEqual(zs[0] < zs[1] ? [1, 2, 3] : [3, 2, 1]);
      expect(mod(markP(row[2]) - markP(row[1]), 8)).toBe(steps[0]);
      for (const cell of row) {
        expect(cell).toHaveLength(2);
        expect(cell[0].f).toBe("n");
        expect(markOf(cell)).toBeTruthy();
      }
    }
    for (const col of cols9(cells9)) expect(new Set(col.map((c) => c[0].z)).size).toBe(1);
  });

  each("posLatinBarLatin", (cells9) => {
    const pTrio = [...new Set(cells9.map(markP))].sort((a, b) => a - b);
    const rTrio = [...new Set(cells9.map(barR))].sort((a, b) => a - b);
    expect(pTrio).toHaveLength(3);
    expect(rTrio).toHaveLength(3);
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(line.map(markP).sort((a, b) => a - b)).toEqual(pTrio);
      expect(line.map(barR).sort((a, b) => a - b)).toEqual(rTrio);
    }
    // opposite diagonals: every (place, orientation) pair occurs once, so
    // neither attribute can be read off the other
    expect(new Set(cells9.map((c) => `${markP(c)}:${barR(c)}`)).size).toBe(9);
    for (const cell of cells9) {
      expect(cell).toHaveLength(3);
      oneBase(cell);
      expect(cell[0].s).toBe(cells9[0][0].s);
      expect(cell[1].s).toBe("b");
      expect(cell[2].s).toBe("m");
    }
  });

  each("orbitXor", (cells9) => {
    const rows = rows9(cells9);
    const steps = rows.map((row) => mod(markP(row[1]) - markP(row[0]), 8));
    expect(new Set(steps).size).toBe(1);
    for (const row of rows) expect(mod(markP(row[2]) - markP(row[1]), 8)).toBe(steps[0]);
    const b = (c: Cell) => (hasDots(c) ? 1 : 0);
    for (const row of rows) expect(b(row[2])).toBe(b(row[0]) ^ b(row[1]));
    expect(b(rows[0][0]) === 1 && b(rows[0][1]) === 1).toBe(true); // the pin row
    for (const cell of cells9) {
      oneBase(cell);
      expect(cell[0].s).toBe(cells9[0][0].s);
      expect(cell[1].s).toBe("m");
      expect(cell.length).toBeLessThanOrEqual(3);
      if (cell.length === 3) expect(cell[2]).toEqual({ s: ".", n: 2 });
    }
  });

  each("barXorLatin", (cells9) => {
    for (const line of [...rows9(cells9), ...cols9(cells9)]) {
      expect(new Set(line.map((c) => c[0].s)).size).toBe(3);
    }
    const rows = rows9(cells9);
    for (const row of rows) expect(barMask(row[2])).toBe(barMask(row[0]) ^ barMask(row[1]));
    expect(xorPinned(rows[0])).toBe(true);
    expect(xorPinned(rows[2])).toBe(true);
    for (const cell of cells9) {
      oneBase(cell);
      barsWellFormed(cell);
    }
  });
});

// ── the ambiguity sweep — no distractor may satisfy the rule ──
//
// The one guarantee the retired hand-authored bank had that "pairwise
// distinct options" does not restore: every wrong answer must be WRONG.
// Each family gets a completion predicate modelling a careful solver —
// the family's line rules plus the visible grid's uniformities (size,
// fill, layer count) and its categorical vocabulary (shapes seen in the
// grid). The answer must satisfy its predicate (that calibrates the
// predicate itself); no other option may.
//
// The predicates were tuned empirically before landing here (2026-08-06
// review, 60,000 items): three iterations, each round's false positives
// being a constraint humans obviously use that the model missed —
// fillRamp's size uniformity, dist2's exact element identity, ringGrow's
// outline-only vocabulary. Endpoint: 0 ambiguous options with 0 answer
// failures. If a NEW family lands and its answers fail here, the predicate
// is missing that family's grammar — extend the model, don't weaken the
// sweep.
const first = (c: Cell) => c[0];
const fs = fillState;
const shapesIn = (cells: Cell[]) =>
  new Set(cells.flat().filter(isBaseLayer).map((l) => l.s));

type Pred = (V: Cell[], C: Cell) => boolean;
const SATISFIES: Record<string, Pred> = {
  sizeRamp: (V, C) =>
    C.length === 1 && C[0].s !== "." && C[0].f === "n"
    && C[0].s === first(V[6]).s
    && C[0].z === 2 * (first(V[7]).z as number) - (first(V[6]).z as number),
  dotCount: (V, C) =>
    C.length === 1 && dots(C) === 2 * dots(V[7]) - dots(V[6]) && dots(C) > 0,
  shapeCycle: (V, C) =>
    C.length === 1 && C[0].s !== "." && C[0].f === "n" && C[0].z === 3
    && shapesIn(V).has(C[0].s)
    && C[0].s !== first(V[6]).s && C[0].s !== first(V[7]).s
    && C[0].s !== first(V[2]).s && C[0].s !== first(V[5]).s,
  fillRamp: (V, C) => {
    const s = C.find((l) => l.s !== ".")?.s;
    if (!s || s !== first(V[6]).s || C.some((l) => l.s !== s)) return false;
    if (C[0].z !== 3) return false; // the grid is size-uniform at z3
    return fs(C) === fs(V[2]) && fs(C) === fs(V[5]); // column-uniform state
  },
  sizeFillAlt: (V, C) =>
    C.length === 1 && C[0].s !== "."
    && C[0].s === first(V[0]).s && C[0].f === first(V[0]).f
    && C[0].z === 2 * (first(V[7]).z as number) - (first(V[6]).z as number),
  dotAdd: (V, C) => C.length === 1 && dots(C) > 0 && dots(C) === dots(V[6]) + dots(V[7]),
  overlay: (V, C) => canon(C) === canon([first(V[6]), first(V[7])]),
  outerRowInnerCycle: (V, C) =>
    C.length === 2
    && C[0].s === V[6][0].s && C[0].z === 3 && C[0].f === "n"
    && C[1].s === V[2][1].s && C[1].z === 1 && C[1].f === "s",
  latinShapeFill: (V, C) => {
    const s = C.find((l) => l.s !== ".")?.s;
    if (!s || !shapesIn(V).has(s) || C.some((l) => l.s !== s)) return false;
    if ([V[6], V[7], V[2], V[5]].some((c) => c[0].s === s)) return false;
    return [V[6], V[7], V[2], V[5]].every((c) => fs(c) !== fs(C));
  },
  latinSizeShape: (V, C) =>
    C.length === 1 && C[0].s !== "." && C[0].f === "n"
    && shapesIn(V).has(C[0].s)
    && [V[6], V[7], V[2], V[5]].every((c) => first(c).s !== C[0].s)
    && [V[6], V[7], V[2], V[5]].every((c) => first(c).z !== C[0].z),
  ringGrow: (V, C) => {
    const s = C[0]?.s;
    if (!s || s === "." || C.some((l) => l.s !== s)) return false;
    if (s !== V[6][0].s) return false;
    if (C.some((l) => l.f !== "n")) return false; // every visible layer is outline
    if (C[0].z !== 3) return false; // the outermost ring is z3 everywhere
    for (let i = 1; i < C.length; i++) if ((C[i].z as number) >= (C[i - 1].z as number)) return false;
    return C.length === 2 * V[7].length - V[6].length;
  },
  decompose: (V, C) =>
    C.length === 1 && C[0].s === V[6][0].s && C[0].z === 3 && C[0].f === "n",
  dist2: (V, C) => {
    // exact elements, read off the grid: a candidate with a different base
    // or inner shape, or a flipped fill, is a never-seen element
    const baseOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 3);
    const aOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 1);
    const bOf = (c: Cell) => c.find((l) => l.s === ".");
    const gridBase = baseOf(V[0]);
    const gridA = V.map(aOf).find(Boolean);
    const gridB = V.map(bOf).find(Boolean);
    const b = baseOf(C);
    if (!b || !gridBase || b.s !== gridBase.s || b.f !== "n") return false;
    let hasA = 0, hasB = 0;
    for (const l of C) {
      if (l === b) continue;
      if (l.s === ".") { if (!gridB || l.n !== gridB.n) return false; hasB = 1; }
      else { if (!gridA || l.s !== gridA.s || l.z !== gridA.z || l.f !== gridA.f) return false; hasA = 1; }
    }
    const n = (c: Cell, fn: (c: Cell) => unknown) => (fn(c) ? 1 : 0);
    const wantA = 2 - n(V[6], aOf) - n(V[7], aOf);
    const wantB = 2 - n(V[6], bOf) - n(V[7], bOf);
    if (wantA !== 2 - n(V[2], aOf) - n(V[5], aOf)) return false;
    if (wantB !== 2 - n(V[2], bOf) - n(V[5], bOf)) return false;
    return hasA === wantA && hasB === wantB;
  },
  sizeCycle: (V, C) =>
    C.length === 1 && C[0].s !== "." && C[0].f === "n"
    && C[0].s === first(V[6]).s
    && [1, 2, 3].includes(C[0].z as number)
    && [V[6], V[7], V[2], V[5]].every((c) => first(c).z !== C[0].z),
  dotSub: (V, C) => C.length === 1 && dots(C) > 0 && dots(C) === dots(V[6]) - dots(V[7]),
  innerGrow: (V, C) => {
    const s = first(V[6]).s;
    if (!C.length || C[0].s !== s || C[0].z !== 3 || C[0].f !== "n") return false;
    const ref = V[2]; // the column's state, read from row 0
    if (ref.length === 1) return C.length === 1;
    return C.length === 2 && C[1].s === s && C[1].z === ref[1].z && C[1].f === "s";
  },
  latinDots: (V, C) => {
    if (C.length !== 1 || dots(C) === 0) return false;
    const trio = new Set(V.map(dots)); // rows 0–1 are fully visible → all three counts
    return trio.has(dots(C)) && [V[6], V[7], V[2], V[5]].every((c) => dots(c) !== dots(C));
  },
  overlayXor: (V, C) => {
    // exact elements only (the dist2 discipline): a candidate with a
    // different base, inner shape, dot count or fill is a never-seen glyph
    const baseOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 3);
    const aOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 1);
    const bOf = (c: Cell) => c.find((l) => l.s === ".");
    const gBase = baseOf(V[0]);
    const gA = V.map(aOf).find(Boolean);
    const gB = V.map(bOf).find(Boolean);
    const b = baseOf(C);
    if (!b || !gBase || b.s !== gBase.s || b.f !== "n") return false;
    for (const l of C) {
      if (l === b) continue;
      if (l.s === ".") {
        if (!gB || l.n !== gB.n) return false;
      } else if (!gA || l.s !== gA.s || l.z !== gA.z || l.f !== gA.f) return false;
    }
    const has = (c: Cell, fn: (c: Cell) => unknown) => (fn(c) ? 1 : 0);
    return (
      has(C, aOf) === (has(V[6], aOf) ^ has(V[7], aOf))
      && has(C, bOf) === (has(V[6], bOf) ^ has(V[7], bOf))
    );
  },

  // ── the D61 families ──
  ringLatin: (V, C) => {
    const s = C[0]?.s;
    if (!s || s === "." || C.some((l) => l.s !== s)) return false;
    if (s !== V[6][0].s) return false; // the row's fixed shape
    if (C.some((l) => l.f !== "n")) return false;
    // exact ring geometry, not just a count: every visible cell nests
    // consecutive sizes (3,2,1), so a skipped-ring candidate is a glyph
    // the grid never taught — the same exact-vocabulary constraint D53
    // added for dist2's elements
    for (let i = 0; i < C.length; i++) if (C[i].z !== [3, 2, 1][i]) return false;
    return [V[6], V[7], V[2], V[5]].every((c) => c.length !== C.length);
  },
  latinShapeSizeFill: (V, C) =>
    C.length === 1 && C[0].s !== "."
    && shapesIn(V).has(C[0].s)
    && C[0].f === first(V[6]).f // the row's fill
    && [V[6], V[7], V[2], V[5]].every((c) => first(c).s !== C[0].s)
    && [V[6], V[7], V[2], V[5]].every((c) => first(c).z !== C[0].z),
  outerLatinInnerLatin: (V, C) => {
    if (C.length !== 2) return false;
    const [o, i] = C;
    if (o.s === "." || o.z !== 3 || o.f !== "n") return false;
    if (i.s === "." || i.z !== 1 || i.f !== "s") return false;
    const lines = [V[6], V[7], V[2], V[5]];
    return lines.every((c) => c[0].s !== o.s) && lines.every((c) => c[1].s !== i.s);
  },
  ringGrowFill: (V, C) => {
    const s = C[0]?.s;
    if (!s || s === "." || C.some((l) => l.s !== s)) return false;
    if (s !== V[6][0].s) return false;
    for (let i = 0; i < C.length; i++) if (C[i].z !== [3, 2, 1][i]) return false; // exact geometry
    if (C.length !== 2 * V[7].length - V[6].length) return false; // the column progression
    if (C.slice(0, -1).some((l) => l.f !== "n")) return false;
    return C[C.length - 1].f === V[6][V[6].length - 1].f; // the row's innermost fill
  },
  innerGrowCycle: (V, C) => {
    if (C.length !== 2) return false;
    const [o, core] = C;
    if (o.s === "." || o.z !== 3 || o.f !== "n") return false;
    if (core.s !== o.s || core.f !== "s") return false;
    const ref = V[2]; // the column's core state, read from row 0
    if (ref.length !== 2 || core.z !== ref[1].z) return false;
    return [V[6], V[7], V[2], V[5]].every((c) => c[0].s !== o.s);
  },
  fillRampShapeCycle: (V, C) => {
    const s = C.find((l) => l.s !== ".")?.s;
    if (!s || C.some((l) => l.s !== s)) return false;
    if (C[0].z !== 3) return false;
    if (fs(C) !== fs(V[2]) || fs(C) !== fs(V[5])) return false; // column state
    return [V[6], V[7], V[2], V[5]].every((c) => c[0].s !== s);
  },
  dist2Latin: (V, C) => {
    const baseOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 3);
    const aOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 1);
    const bOf = (c: Cell) => c.find((l) => l.s === ".");
    const gA = V.map(aOf).find(Boolean);
    const gB = V.map(bOf).find(Boolean);
    const b0 = baseOf(C);
    if (!b0 || b0.f !== "n") return false;
    if (!new Set(V.map((c) => baseOf(c)?.s)).has(b0.s)) return false;
    if ([V[6], V[7], V[2], V[5]].some((c) => baseOf(c)?.s === b0.s)) return false;
    for (const l of C) {
      if (l === b0) continue;
      if (l.s === ".") { if (!gB || l.n !== gB.n) return false; }
      else if (!gA || l.s !== gA.s || l.z !== gA.z || l.f !== gA.f) return false;
    }
    const n = (c: Cell, fn: (c: Cell) => unknown) => (fn(c) ? 1 : 0);
    const wantA = 2 - n(V[6], aOf) - n(V[7], aOf);
    const wantB = 2 - n(V[6], bOf) - n(V[7], bOf);
    if (wantA !== 2 - n(V[2], aOf) - n(V[5], aOf)) return false;
    if (wantB !== 2 - n(V[2], bOf) - n(V[5], bOf)) return false;
    return n(C, aOf) === wantA && n(C, bOf) === wantB;
  },
  xorLatin: (V, C) => {
    const baseOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 3);
    const aOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 1);
    const bOf = (c: Cell) => c.find((l) => l.s === ".");
    const gA = V.map(aOf).find(Boolean);
    const gB = V.map(bOf).find(Boolean);
    const b0 = baseOf(C);
    if (!b0 || b0.f !== "n") return false;
    if (!new Set(V.map((c) => baseOf(c)?.s)).has(b0.s)) return false;
    if ([V[6], V[7], V[2], V[5]].some((c) => baseOf(c)?.s === b0.s)) return false;
    for (const l of C) {
      if (l === b0) continue;
      if (l.s === ".") { if (!gB || l.n !== gB.n) return false; }
      else if (!gA || l.s !== gA.s || l.z !== gA.z || l.f !== gA.f) return false;
    }
    const has = (c: Cell, fn: (c: Cell) => unknown) => (fn(c) ? 1 : 0);
    return (
      has(C, aOf) === (has(V[6], aOf) ^ has(V[7], aOf))
      && has(C, bOf) === (has(V[6], bOf) ^ has(V[7], bOf))
    );
  },
  ringLatinShape: (V, C) => {
    const s = C[0]?.s;
    if (!s || s === "." || C.some((l) => l.s !== s)) return false;
    if (C.some((l) => l.f !== "n")) return false;
    for (let i = 0; i < C.length; i++) if (C[i].z !== [3, 2, 1][i]) return false; // exact geometry
    const lines = [V[6], V[7], V[2], V[5]];
    return lines.every((c) => c[0].s !== s) && lines.every((c) => c.length !== C.length);
  },
  dist2Xor: (V, C) => {
    const baseOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 3);
    const aOf = (c: Cell) => c.find((l) => l.s !== "." && l.z === 1);
    const bOf = (c: Cell) => c.find((l) => l.s === ".");
    const gBase = baseOf(V[0]);
    const gA = V.map(aOf).find(Boolean);
    const gB = V.map(bOf).find(Boolean);
    const b0 = baseOf(C);
    if (!b0 || !gBase || b0.s !== gBase.s || b0.f !== "n") return false;
    for (const l of C) {
      if (l === b0) continue;
      if (l.s === ".") { if (!gB || l.n !== gB.n) return false; }
      else if (!gA || l.s !== gA.s || l.z !== gA.z || l.f !== gA.f) return false;
    }
    const n = (c: Cell, fn: (c: Cell) => unknown) => (fn(c) ? 1 : 0);
    const wantA = 2 - n(V[6], aOf) - n(V[7], aOf);
    if (wantA !== 2 - n(V[2], aOf) - n(V[5], aOf)) return false;
    const wantB = n(V[6], bOf) ^ n(V[7], bOf);
    return n(C, aOf) === wantA && n(C, bOf) === wantB;
  },
};
{

  // ── the v4 families (D394) ──
  // Exact vocabulary throughout, the D53 discipline: a candidate whose
  // base is not the grid's (shape, size, fill), or whose bar or mark sits
  // where no visible cell put one, is a glyph the grid never taught. A
  // progression completes to one value (2·b − a, mod 4 or mod 8); a
  // distribution to the one member of the grid's trio its row and column
  // still lack.
  const baseIs = (C: Cell, s: string, z = 3) =>
    C.length > 0 && isBaseLayer(C[0]) && C[0].s === s && C[0].z === z && C[0].f === "n";
  const lines = (V: Cell[]) => [V[6], V[7], V[2], V[5]];
  const latinBase = (V: Cell[], C: Cell) =>
    C.length > 0 && isBaseLayer(C[0]) && C[0].z === 3 && C[0].f === "n"
    && shapesIn(V).has(C[0].s as Shape) && lines(V).every((c) => c[0].s !== C[0].s);
  const orbitDone = (V: Cell[], l: Layer | undefined) =>
    !!l && l.s === "m" && l.p === mod(2 * markP(V[7]) - markP(V[6]), 8);
  const turnDone = (V: Cell[], l: Layer | undefined) =>
    !!l && l.s === "b" && l.r === mod(2 * barR(V[7]) - barR(V[6]), 4);
  const barsSeen = (V: Cell[], C: Cell) => {
    const seen = new Set(V.flatMap((c) => c.filter((l) => l.s === "b").map((l) => l.r)));
    return C.slice(1).every((l) => l.s === "b" && seen.has(l.r));
  };
  SATISFIES.barRotate = (V, C) => C.length === 2 && baseIs(C, V[6][0].s) && turnDone(V, C[1]);
  SATISFIES.markOrbit = (V, C) => C.length === 2 && baseIs(C, V[6][0].s) && orbitDone(V, C[1]);
  SATISFIES.latinPos = (V, C) => {
    if (C.length !== 2 || !baseIs(C, V[0][0].s) || C[1].s !== "m") return false;
    const trio = new Set(V.map(markP)); // rows 0–1 fully visible → all three places
    return trio.has(C[1].p as number) && lines(V).every((c) => markP(c) !== C[1].p);
  };
  SATISFIES.barLatin = (V, C) => {
    if (C.length !== 2 || !baseIs(C, V[6][0].s) || C[1].s !== "b") return false;
    const trio = new Set(V.map(barR));
    return trio.has(C[1].r as number) && lines(V).every((c) => barR(c) !== C[1].r);
  };
  SATISFIES.barXor3 = (V, C) =>
    baseIs(C, V[0][0].s) && barsSeen(V, C) && barMask(C) === (barMask(V[6]) ^ barMask(V[7]));
  SATISFIES.orbitShapeLatin = (V, C) => C.length === 2 && latinBase(V, C) && orbitDone(V, C[1]);
  SATISFIES.markOrbitGrow = (V, C) =>
    C.length === 2 && isBaseLayer(C[0]) && C[0].s === V[6][0].s && C[0].f === "n"
    && C[0].z === 2 * (V[7][0].z as number) - (V[6][0].z as number)
    && orbitDone(V, C[1]);
  SATISFIES.posLatinBarLatin = (V, C) => {
    if (C.length !== 3 || !baseIs(C, V[0][0].s) || C[1].s !== "b" || C[2].s !== "m") return false;
    return new Set(V.map(barR)).has(C[1].r as number) && lines(V).every((c) => barR(c) !== C[1].r)
      && new Set(V.map(markP)).has(C[2].p as number) && lines(V).every((c) => markP(c) !== C[2].p);
  };
  SATISFIES.orbitXor = (V, C) => {
    if (C.length < 2 || C.length > 3 || !baseIs(C, V[0][0].s) || !orbitDone(V, C[1])) return false;
    const gB = V.map((c) => c.find((l) => l.s === ".")).find(Boolean);
    if (C.length === 3 && (C[2].s !== "." || !gB || C[2].n !== gB.n)) return false;
    const has = (c: Cell) => (c.some((l) => l.s === ".") ? 1 : 0);
    return has(C) === (has(V[6]) ^ has(V[7]));
  };
  SATISFIES.barXorLatin = (V, C) =>
    latinBase(V, C) && barsSeen(V, C) && barMask(C) === (barMask(V[6]) ^ barMask(V[7]));
}

describe("the ambiguity sweep (every seed, every item, every option)", () => {
  it("the answer satisfies its family's rule; no distractor does", () => {
    let checked = 0;
    for (const [si, f] of forms.entries()) {
      for (const [ii, item] of f.items.entries()) {
        const { family, cells9 } = buildCells9(SEEDS[si], ii);
        const pred = SATISFIES[family];
        expect(pred, `no predicate for family ${family} — extend SATISFIES`).toBeTruthy();
        const V = cells9.slice(0, 8);
        expect(pred(V, item.opts[item.a]), `seed ${f.seed} item ${ii} (${family}): the ANSWER fails the model — fix the predicate, not the sweep`).toBe(true);
        for (const [oi, opt] of item.opts.entries()) {
          if (oi === item.a) continue;
          checked++;
          expect(pred(V, opt), `seed ${f.seed} item ${ii} (${family}) option ${oi} is AMBIGUOUS: ${canon(opt)}`).toBe(false);
        }
      }
    }
    expect(checked).toBe(forms.length * 25 * 5);
  });

  it("no form repeats a puzzle", () => {
    for (const [si, f] of forms.entries()) {
      const keys = new Set(
        f.items.map((_, ii) => buildCells9(SEEDS[si], ii).cells9.map(canon).join("|")),
      );
      expect(keys.size, `seed ${f.seed}`).toBe(25);
    }
  });

  it("the answer slot is uniform-ish, not merely present", () => {
    // "every slot occurs" passes a badly biased shuffle; a loose band
    // around uniform (16.7%) catches a broken Fisher–Yates. Measured
    // 16.3–17.0% over 60k items; the band is generous.
    const counts = [0, 0, 0, 0, 0, 0];
    for (const f of forms) for (const item of f.items) counts[item.a]++;
    const total = forms.length * 25;
    for (const [slot, c] of counts.entries()) {
      const share = c / total;
      expect(share, `slot ${slot} at ${(share * 100).toFixed(1)}%`).toBeGreaterThan(0.10);
      expect(share, `slot ${slot} at ${(share * 100).toFixed(1)}%`).toBeLessThan(0.25);
    }
  });
});

// ── gv 1 reconstruction ──
// D31 commits to {seed, gv} rebuilding the exact form a score was earned
// on, FOREVER. These goldens were captured from the generator as it stood
// before the banded template landed (2026-08-06) — if this block fails,
// the v1 path has drifted and historic results no longer mean what they
// say. Seed 3 pins the dist2 tail; 7 and 424242 pin decompose. Seed 7
// also pins every visible cell and the full option order — the whole
// construction-and-assembly path, not just the answers.
const GOLDEN_V1: {
  seed: number;
  families: string[];
  a: number[];
  answers: string[];
  cells?: string[];
  opts?: string[];
}[] = [
  {"seed":7,"families":["sizeRamp","dotCount","shapeCycle","fillRamp","sizeFillAlt","dotAdd","overlay","outerRowInnerCycle","latinShapeFill","latinSizeShape","ringGrow","decompose"],"a":[2,1,3,0,5,2,5,4,3,2,3,0],"answers":["[[\"q\",3,\"n\"]]","[[\".\",4]]","[[\"d\",3,\"n\"]]","[[\"q\",3,\"n\"]]","[[\"d\",3,\"n\"]]","[[\".\",6]]","[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]","[[\"c\",3,\"n\"]]","[[\"c\",3,\"n\"]]","[[\"q\",3,\"n\"]]"],"cells":["[[\"c\",1,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"q\",2,\"n\"]]","[[\".\",3]]|[[\".\",4]]|[[\".\",5]]|[[\".\",1]]|[[\".\",2]]|[[\".\",3]]|[[\".\",2]]|[[\".\",3]]","[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"]]","[[\"c\",3,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1.4,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]","[[\"d\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",1,\"s\"]]|[[\"d\",2,\"s\"]]|[[\"d\",3,\"s\"]]|[[\"d\",1,\"n\"]]|[[\"d\",2,\"n\"]]","[[\".\",1]]|[[\".\",1]]|[[\".\",2]]|[[\".\",2]]|[[\".\",2]]|[[\".\",4]]|[[\".\",3]]|[[\".\",3]]","[[\"t\",3,\"n\"]]|[[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"c\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]","[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"s\"]]|[[\"q\",3,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1.4,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"s\"]]","[[\"c\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"d\",2,\"n\"]]","[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"q\",3,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"s\"]]"],"opts":["[[\"q\",2,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"d\",3,\"n\"]]","[[\".\",5]]|[[\".\",4]]|[[\".\",1]]|[[\".\",3]]|[[\".\",2]]|[[\".\",6]]","[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"s\"]]","[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"q\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]","[[\"d\",3,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"]]","[[\".\",5]]|[[\".\",4]]|[[\".\",6]]|[[\".\",2]]|[[\".\",1]]|[[\".\",3]]","[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"s\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"n\"]]","[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]|[[\"t\",3,\"s\"]]|[[\"q\",3,\"s\"]]","[[\"c\",2,\"n\"]]|[[\"c\",3,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",2,\"n\"]]","[[\"c\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]","[[\"q\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"s\"]]"]},
  {"seed":424242,"families":["sizeRamp","dotCount","shapeCycle","fillRamp","sizeFillAlt","dotAdd","overlay","outerRowInnerCycle","latinShapeFill","latinSizeShape","ringGrow","decompose"],"a":[4,4,4,2,1,1,2,5,2,3,4,2],"answers":["[[\"d\",1,\"n\"]]","[[\".\",4]]","[[\"q\",3,\"n\"]]","[[\"t\",3,\"n\"]]","[[\"c\",3,\"s\"]]","[[\".\",4]]","[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]","[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]","[[\"c\",2,\"n\"]]","[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]","[[\"q\",3,\"n\"]]"]},
  {"seed":3,"families":["sizeRamp","dotCount","shapeCycle","fillRamp","sizeFillAlt","dotAdd","overlay","outerRowInnerCycle","latinShapeFill","latinSizeShape","ringGrow","dist2"],"a":[0,5,3,1,5,1,1,5,2,0,0,4],"answers":["[[\"c\",3,\"n\"]]","[[\".\",4]]","[[\"c\",3,\"n\"]]","[[\"q\",3,\"n\"]]","[[\"d\",3,\"s\"]]","[[\".\",4]]","[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]","[[\"c\",3,\"n\"]]","[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]"]},
];

describe("gv 1 reconstruction (a stored {seed, gv} rebuilds its exact form forever)", () => {
  it("generateForm(seed, 1) reproduces the frozen v1 generator", () => {
    for (const g of GOLDEN_V1) {
      const f = generateForm(g.seed, 1);
      expect(f.version).toBe(1);
      expect(f.items.map((i) => i.rules[0]), `seed ${g.seed}`).toEqual(g.families);
      expect(f.items.map((i) => i.a), `seed ${g.seed}`).toEqual(g.a);
      expect(f.items.map((i) => canon(i.opts[i.a])), `seed ${g.seed}`).toEqual(g.answers);
      if (g.cells) expect(f.items.map((i) => i.cells.map(canon).join("|"))).toEqual(g.cells);
      if (g.opts) expect(f.items.map((i) => i.opts.map(canon).join("|"))).toEqual(g.opts);
    }
  });

  it("v1 forms still hold the fixed weight ramp and pass buildCells9 dispatch", () => {
    const f = generateForm(99, 1);
    expect(f.items.map((i) => i.diff)).toEqual([1, 1, 1.5, 2, 2, 2, 2.5, 2.5, 3, 3, 3, 3.5]);
    for (const [ii, item] of f.items.entries()) {
      expect(canon(item.opts[item.a])).toBe(canon(buildCells9(99, ii, 1).cells9[8]));
    }
  });

  it("an unknown gv throws instead of silently reinterpreting the seed", () => {
    expect(() => generateForm(1, version + 1)).toThrow(/unknown generator version/);
  });
});

// ── gv 2 reconstruction ──
// Same commitment, next era: {seed, gv: 2} rebuilds the 12-item banded
// form its score was earned on, forever. Captured from the generator as
// it stood before the 25-item v3 template landed (2026-08-06). Seed 11
// pins every visible cell and the full option order; 555555 pins a form
// whose draws include the v2-era tail families.
const GOLDEN_V2: {
  seed: number;
  families: string[];
  a: number[];
  answers: string[];
  cells?: string[];
  opts?: string[];
}[] = [
  {"seed": 11, "families": ["sizeRamp", "dotCount", "sizeCycle", "fillRamp", "dotAdd", "dotSub", "overlay", "outerRowInnerCycle", "latinShapeFill", "latinSizeShape", "ringGrow", "dist2"], "a": [1, 0, 4, 3, 2, 1, 3, 3, 0, 4, 2, 3], "answers": ["[[\"d\",3,\"n\"]]", "[[\".\",3]]", "[[\"q\",2,\"n\"]]", "[[\"t\",3,\"n\"]]", "[[\".\",3]]", "[[\".\",2]]", "[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]", "[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]", "[[\"t\",1,\"n\"]]", "[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]", "[[\"q\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]"], "opts": ["[[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"d\",3,\"s\"]]|[[\"d\",2,\"n\"]]|[[\"c\",3,\"n\"]]", "[[\".\",3]]|[[\".\",5]]|[[\".\",2]]|[[\".\",4]]|[[\".\",1]]|[[\".\",6]]", "[[\"q\",3,\"n\"]]|[[\"q\",2,\"s\"]]|[[\"c\",2,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"t\",1,\"n\"]]", "[[\"t\",2,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"q\",3,\"n\"]]", "[[\".\",2]]|[[\".\",5]]|[[\".\",3]]|[[\".\",6]]|[[\".\",1]]|[[\".\",4]]", "[[\".\",6]]|[[\".\",2]]|[[\".\",1]]|[[\".\",5]]|[[\".\",4]]|[[\".\",3]]", "[[\"t\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"n\"]]|[[\"q\",1,\"s\"]]", "[[\"c\",3,\"s\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]", "[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"d\",3,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]", "[[\"t\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"c\",2,\"n\"]]", "[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"n\"]]|[[\"c\",3,\"n\"]]", "[[\"q\",3,\"n\"],[\"q\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"]]"], "cells": ["[[\"c\",1,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"d\",2,\"n\"]]", "[[\".\",3]]|[[\".\",4]]|[[\".\",5]]|[[\".\",2]]|[[\".\",3]]|[[\".\",4]]|[[\".\",1]]|[[\".\",2]]", "[[\"c\",1,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",1,\"n\"]]", "[[\"c\",3,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1.4,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]", "[[\".\",2]]|[[\".\",1]]|[[\".\",3]]|[[\".\",3]]|[[\".\",3]]|[[\".\",6]]|[[\".\",1]]|[[\".\",2]]", "[[\".\",4]]|[[\".\",1]]|[[\".\",3]]|[[\".\",6]]|[[\".\",2]]|[[\".\",4]]|[[\".\",5]]|[[\".\",3]]", "[[\"d\",3,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"d\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"q\",1,\"s\"]]", "[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]", "[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"s\"]]|[[\"d\",3,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1.4,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"s\"]]", "[[\"t\",2,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",2,\"n\"]]", "[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]", "[[\"q\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"n\"],[\".\",2]]|[[\"q\",3,\"n\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"q\",3,\"n\"],[\".\",2]]"]},
  {"seed": 555555, "families": ["dotCount", "sizeRamp", "shapeCycle", "dotSub", "fillRamp", "sizeFillAlt", "outerRowInnerCycle", "innerGrow", "ringGrow", "latinDots", "latinSizeShape", "overlayXor"], "a": [1, 3, 4, 4, 2, 1, 1, 3, 5, 5, 2, 1], "answers": ["[[\".\",5]]", "[[\"q\",1,\"n\"]]", "[[\"c\",3,\"n\"]]", "[[\".\",3]]", "[[\"q\",3,\"n\"]]", "[[\"d\",1,\"s\"]]", "[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]", "[[\"d\",3,\"n\"]]", "[[\".\",6]]", "[[\"t\",1,\"n\"]]", "[[\"t\",3,\"n\"],[\".\",2]]"]},
];

describe("gv 2 reconstruction (a stored {seed, gv} rebuilds its exact form forever)", () => {
  it("generateForm(seed, 2) reproduces the frozen v2 generator", () => {
    for (const g of GOLDEN_V2) {
      const f = generateForm(g.seed, 2);
      expect(f.version).toBe(2);
      expect(f.items).toHaveLength(12);
      expect(f.items.map((i) => i.rules[0]), `seed ${g.seed}`).toEqual(g.families);
      expect(f.items.map((i) => i.a), `seed ${g.seed}`).toEqual(g.a);
      expect(f.items.map((i) => canon(i.opts[i.a])), `seed ${g.seed}`).toEqual(g.answers);
      if (g.cells) expect(f.items.map((i) => i.cells.map(canon).join("|"))).toEqual(g.cells);
      if (g.opts) expect(f.items.map((i) => i.opts.map(canon).join("|"))).toEqual(g.opts);
    }
  });

  it("v2 forms keep their own 12-slot weight ramp", () => {
    const f = generateForm(424242, 2);
    expect(f.items.map((i) => i.diff)).toEqual([1, 1, 1.5, 2, 2, 2, 2.5, 2.5, 3, 3, 3, 3.5]);
  });
});

// ── gv 3 reconstruction ──
// THE ONE ERA THAT IS ACTUALLY BEING PLAYED, and it had no golden. v1 and
// v2 are frozen and pinned above; `version` is 3, so every score earned
// from now on stores `gv: 3` and every reconstruction of one runs this
// path — the path with nothing holding it still. Measured before this
// block existed: two v3-only changes (the band salt, and one v3 family's
// construction) left check:logic-sync, the functions suite and the client
// suite all green. A change there scores a player against a form they
// never saw, which is the failure check:logic-sync exists to prevent, in
// the time dimension instead of the copy dimension.
//
// Captured from the generator as it stands, which is what a golden IS: it
// does not claim the construction is right, it claims it will not move
// under anyone who did not mean to move it. Seed 17 pins every visible
// cell and the full option order — the whole construction-and-assembly
// path — and the other two pin the families and answers of forms whose
// draws reach different tails.
const GOLDEN_V3: {
  seed: number;
  families: string[];
  a: number[];
  answers: string[];
  cells?: string[];
  opts?: string[];
}[] = [
  {"seed": 17, "families": ["sizeRamp", "dotCount", "sizeCycle", "shapeCycle", "sizeFillAlt", "dotSub", "dotAdd", "overlay", "outerRowInnerCycle", "innerGrow", "ringGrow", "latinShapeFill", "latinDots", "latinSizeShape", "dist2", "decompose", "overlayXor", "ringLatin", "fillRampShapeCycle", "ringGrowFill", "latinShapeSizeFill", "innerGrowCycle", "dist2Latin", "ringLatinShape", "xorLatin"], "a": [0, 2, 5, 2, 0, 4, 4, 2, 3, 2, 0, 0, 1, 5, 4, 4, 2, 2, 1, 1, 0, 5, 5, 2, 2], "answers": ["[[\"t\",1,\"n\"]]", "[[\".\",3]]", "[[\"t\",2,\"n\"]]", "[[\"q\",3,\"n\"]]", "[[\"t\",3,\"n\"]]", "[[\".\",3]]", "[[\".\",5]]", "[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]", "[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]", "[[\"d\",3,\"s\"]]", "[[\".\",6]]", "[[\"q\",2,\"n\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"d\",3,\"n\"]]", "[[\"t\",3,\"n\"],[\".\",2]]", "[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]", "[[\"t\",3,\"n\"]]", "[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"s\"]]", "[[\"q\",1,\"n\"]]", "[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]", "[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]", "[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]", "[[\"t\",3,\"n\"],[\".\",2]]"], "cells": ["[[\"c\",3,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",2,\"n\"]]", "[[\".\",2]]|[[\".\",3]]|[[\".\",4]]|[[\".\",3]]|[[\".\",4]]|[[\".\",5]]|[[\".\",1]]|[[\".\",2]]", "[[\"d\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"n\"]]", "[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"n\"]]", "[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"t\",2,\"s\"]]|[[\"t\",3,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]", "[[\".\",5]]|[[\".\",3]]|[[\".\",2]]|[[\".\",6]]|[[\".\",2]]|[[\".\",4]]|[[\".\",4]]|[[\".\",1]]", "[[\".\",3]]|[[\".\",2]]|[[\".\",5]]|[[\".\",1]]|[[\".\",1]]|[[\".\",2]]|[[\".\",2]]|[[\".\",3]]", "[[\"t\",3,\"n\"]]|[[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"c\",1,\"s\"]]", "[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]", "[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]", "[[\"t\",3,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]|[[\"q\",3,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]", "[[\".\",2]]|[[\".\",6]]|[[\".\",3]]|[[\".\",6]]|[[\".\",3]]|[[\".\",2]]|[[\".\",3]]|[[\".\",2]]", "[[\"t\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"t\",1,\"n\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]", "[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"q\",3,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"s\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]", "[[\"q\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"t\",3,\"n\"]]", "[[\"q\",3,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1.4,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]", "[[\"q\",3,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"d\",3,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]", "[[\"t\",1,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"d\",1,\"s\"]]|[[\"t\",2,\"s\"]]|[[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"]]", "[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"c\",3,\"n\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\".\",2]]", "[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]|[[\"d\",3,\"n\"]]", "[[\"c\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"],[\".\",2]]|[[\"d\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"q\",1,\"s\"],[\".\",2]]|[[\"c\",3,\"n\"],[\".\",2]]|[[\"d\",3,\"n\"],[\"q\",1,\"s\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]"], "opts": ["[[\"t\",1,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"s\"]]", "[[\".\",1]]|[[\".\",2]]|[[\".\",3]]|[[\".\",6]]|[[\".\",5]]|[[\".\",4]]", "[[\"q\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",2,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]", "[[\"c\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"d\",3,\"n\"]]", "[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"c\",3,\"n\"]]", "[[\".\",4]]|[[\".\",6]]|[[\".\",5]]|[[\".\",2]]|[[\".\",3]]|[[\".\",1]]", "[[\".\",3]]|[[\".\",6]]|[[\".\",1]]|[[\".\",2]]|[[\".\",5]]|[[\".\",4]]", "[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"n\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"n\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"s\"],[\"c\",1,\"s\"]]", "[[\"c\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]", "[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]", "[[\"d\",3,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]|[[\"d\",3,\"n\"]]", "[[\".\",1]]|[[\".\",6]]|[[\".\",3]]|[[\".\",5]]|[[\".\",4]]|[[\".\",2]]", "[[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",2,\"s\"]]|[[\"t\",2,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"q\",2,\"n\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"]]", "[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"s\"]]|[[\"d\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"t\",3,\"s\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\".\",1]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",5]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"]]", "[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"d\",3,\"n\"]]", "[[\"q\",3,\"n\"],[\"q\",1.4,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]|[[\"t\",3,\"s\"]]", "[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]", "[[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",1,\"s\"]]|[[\"q\",2,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"t\",3,\"n\"]]", "[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]", "[[\"t\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"q\",3,\"n\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]", "[[\"t\",3,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]", "[[\"d\",3,\"n\"],[\".\",2]]|[[\"c\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]"]},
  {"seed": 8675309, "families": ["sizeRamp", "dotCount", "shapeCycle", "sizeCycle", "sizeFillAlt", "fillRamp", "dotSub", "innerGrow", "overlay", "outerRowInnerCycle", "latinDots", "latinShapeFill", "latinSizeShape", "ringGrow", "ringLatin", "dist2", "overlayXor", "decompose", "ringGrowFill", "outerLatinInnerLatin", "fillRampShapeCycle", "innerGrowCycle", "ringLatinShape", "dist2Latin", "dist2Xor"], "a": [3, 3, 2, 0, 0, 4, 2, 1, 0, 0, 3, 5, 3, 0, 0, 4, 2, 0, 3, 2, 4, 5, 5, 1, 1], "answers": ["[[\"d\",1,\"n\"]]", "[[\".\",4]]", "[[\"q\",3,\"n\"]]", "[[\"c\",1,\"n\"]]", "[[\"q\",1,\"n\"]]", "[[\"c\",3,\"n\"]]", "[[\".\",5]]", "[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]", "[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]", "[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\".\",2]]", "[[\"t\",3,\"s\"]]", "[[\"q\",1,\"n\"]]", "[[\"c\",3,\"n\"]]", "[[\"t\",3,\"n\"]]", "[[\"q\",3,\"n\"],[\".\",2]]", "[[\"c\",3,\"n\"],[\".\",2]]", "[[\"q\",3,\"n\"]]", "[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"s\"]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]", "[[\"c\",3,\"s\"]]", "[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]", "[[\"q\",3,\"n\"]]", "[[\"q\",3,\"n\"],[\".\",2]]", "[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]"]},
  {"seed": 1, "families": ["dotCount", "sizeRamp", "shapeCycle", "sizeCycle", "sizeFillAlt", "fillRamp", "dotSub", "overlay", "outerRowInnerCycle", "innerGrow", "ringGrow", "latinShapeFill", "latinSizeShape", "latinDots", "dist2", "overlayXor", "decompose", "ringLatin", "innerGrowCycle", "ringGrowFill", "fillRampShapeCycle", "latinShapeSizeFill", "ringLatinShape", "xorLatin", "dist2Latin"], "a": [3, 4, 2, 1, 5, 4, 3, 5, 0, 1, 4, 3, 0, 0, 1, 4, 4, 3, 1, 3, 2, 0, 2, 3, 2], "answers": ["[[\".\",4]]", "[[\"d\",1,\"n\"]]", "[[\"d\",3,\"n\"]]", "[[\"t\",1,\"n\"]]", "[[\"q\",3,\"s\"]]", "[[\"t\",3,\"s\"]]", "[[\".\",5]]", "[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]", "[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]", "[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]", "[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]", "[[\"d\",3,\"n\"],[\"d\",1.4,\"s\"]]", "[[\"d\",3,\"n\"]]", "[[\".\",2]]", "[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]", "[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]", "[[\"t\",3,\"n\"]]", "[[\"c\",3,\"n\"]]", "[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]", "[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"s\"]]", "[[\"c\",3,\"s\"]]", "[[\"t\",2,\"n\"]]", "[[\"q\",3,\"n\"]]", "[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]", "[[\"c\",3,\"n\"]]"]},
];

describe("gv 3 reconstruction (the live era — a stored {seed, gv} rebuilds its exact form forever)", () => {
  it("generateForm(seed, 3) reproduces the shipped v3 generator", () => {
    for (const g of GOLDEN_V3) {
      const f = generateForm(g.seed, 3);
      expect(f.version).toBe(3);
      expect(f.items).toHaveLength(25);
      expect(f.items.map((i) => i.rules[0]), `seed ${g.seed}`).toEqual(g.families);
      expect(f.items.map((i) => i.a), `seed ${g.seed}`).toEqual(g.a);
      expect(f.items.map((i) => canon(i.opts[i.a])), `seed ${g.seed}`).toEqual(g.answers);
      if (g.cells) expect(f.items.map((i) => i.cells.map(canon).join("|")), `seed ${g.seed} cells`).toEqual(g.cells);
      if (g.opts) expect(f.items.map((i) => i.opts.map(canon).join("|")), `seed ${g.seed} opts`).toEqual(g.opts);
    }
  });

  it("v3 carries its own 25-slot ramp, and it is NOT v1/v2's twelve", () => {
    // The twin of the v1 and v2 ramp cases above, and the one that keeps
    // logic-gen.ts honest about them: its comment said the slot weights
    // were "identical across generator versions", which stopped being
    // true when this template landed.
    const f = generateForm(99, 3);
    expect(f.items.map((i) => i.diff)).toEqual([
      1, 1, 1.5, 1.5, 2, 2, 2, 2.5, 2.5, 2.5, 3, 3, 3, 3,
      3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4.5, 4.5, 4.5,
    ]);
    expect(f.items.map((i) => i.diff)).not.toEqual(generateForm(99, 1).items.map((i) => i.diff));
  });

  it("every v3 item's marked answer is the cell buildCells9 dispatches for it", () => {
    // The assembly half: the answer stored against a slot has to be the
    // ninth cell the builder produces for that slot, or a reconstruction
    // draws one form and scores another. v1 has this case; v3 did not.
    const f = generateForm(17, 3);
    for (const [ii, item] of f.items.entries()) {
      expect(canon(item.opts[item.a]), `item ${ii}`).toBe(canon(buildCells9(17, ii, 3).cells9[8]));
    }
  });
});

// ── gv 4 reconstruction ──
// The live era since D394. Same commitment as the three blocks above: a
// {seed, gv: 4} rebuilds its exact form forever, so the orientation and
// position families, their pin discipline and the option assembly are
// held still here. Captured from the generator as it landed; seed 17
// pins every visible cell and the full option order; seeds 1 and 50 pin
// the families and answers of forms whose draws reach different tails —
// between the three every one of the ten v4 families appears at least once.
const GOLDEN_V4: {
  seed: number;
  families: string[];
  a: number[];
  answers: string[];
  cells?: string[];
  opts?: string[];
}[] = [
  {"seed":17,"families":["sizeRamp","dotCount","sizeCycle","shapeCycle","sizeFillAlt","dotSub","dotAdd","innerGrow","overlay","outerRowInnerCycle","markOrbit","latinDots","latinSizeShape","latinPos","ringLatin","overlayXor","dist2","decompose","latinShapeSizeFill","barXor3","innerGrowCycle","markOrbitGrow","dist2Xor","dist2Latin","ringLatinShape"],"a":[0,2,5,2,0,4,4,5,3,3,1,5,3,5,4,0,3,3,1,2,0,0,3,2,2],"answers":["[[\"t\",1,\"n\"]]","[[\".\",3]]","[[\"t\",2,\"n\"]]","[[\"q\",3,\"n\"]]","[[\"t\",3,\"n\"]]","[[\".\",3]]","[[\".\",5]]","[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]","[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"m\",0]]","[[\".\",5]]","[[\"t\",2,\"n\"]]","[[\"c\",3,\"n\"],[\"m\",2]]","[[\"c\",3,\"n\"]]","[[\"c\",3,\"n\"],[\".\",2]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]","[[\"t\",3,\"n\"]]","[[\"q\",2,\"n\"]]","[[\"d\",3,\"n\"],[\"b\",0],[\"b\",1]]","[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]","[[\"d\",3,\"n\"],[\"m\",3]]","[[\"d\",3,\"n\"]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"t\",3,\"n\"]]"],"cells":["[[\"c\",3,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",2,\"n\"]]","[[\".\",2]]|[[\".\",3]]|[[\".\",4]]|[[\".\",3]]|[[\".\",4]]|[[\".\",5]]|[[\".\",1]]|[[\".\",2]]","[[\"d\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"n\"]]","[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"n\"]]","[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"t\",2,\"s\"]]|[[\"t\",3,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]","[[\".\",5]]|[[\".\",3]]|[[\".\",2]]|[[\".\",6]]|[[\".\",2]]|[[\".\",4]]|[[\".\",4]]|[[\".\",1]]","[[\".\",3]]|[[\".\",2]]|[[\".\",5]]|[[\".\",1]]|[[\".\",1]]|[[\".\",2]]|[[\".\",2]]|[[\".\",3]]","[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"c\",3,\"n\"]]|[[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"d\",1,\"s\"]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"c\",3,\"n\"],[\"m\",6]]|[[\"c\",3,\"n\"],[\"m\",0]]|[[\"c\",3,\"n\"],[\"m\",2]]|[[\"d\",3,\"n\"],[\"m\",2]]|[[\"d\",3,\"n\"],[\"m\",4]]|[[\"d\",3,\"n\"],[\"m\",6]]|[[\"q\",3,\"n\"],[\"m\",4]]|[[\"q\",3,\"n\"],[\"m\",6]]","[[\".\",2]]|[[\".\",5]]|[[\".\",6]]|[[\".\",5]]|[[\".\",6]]|[[\".\",2]]|[[\".\",6]]|[[\".\",2]]","[[\"q\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"q\",1,\"n\"]]","[[\"c\",3,\"n\"],[\"m\",2]]|[[\"c\",3,\"n\"],[\"m\",1]]|[[\"c\",3,\"n\"],[\"m\",3]]|[[\"c\",3,\"n\"],[\"m\",3]]|[[\"c\",3,\"n\"],[\"m\",2]]|[[\"c\",3,\"n\"],[\"m\",1]]|[[\"c\",3,\"n\"],[\"m\",1]]|[[\"c\",3,\"n\"],[\"m\",3]]","[[\"q\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"],[\"q\",1,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",2,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]","[[\"c\",3,\"n\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"q\",3,\"s\"]]","[[\"q\",3,\"n\"]]|[[\"c\",2,\"n\"]]|[[\"t\",1,\"n\"]]|[[\"t\",2,\"s\"]]|[[\"q\",1,\"s\"]]|[[\"c\",3,\"s\"]]|[[\"c\",1,\"n\"]]|[[\"t\",3,\"n\"]]","[[\"d\",3,\"n\"],[\"b\",0],[\"b\",1]]|[[\"d\",3,\"n\"],[\"b\",1],[\"b\",2]]|[[\"d\",3,\"n\"],[\"b\",0],[\"b\",2]]|[[\"d\",3,\"n\"],[\"b\",1]]|[[\"d\",3,\"n\"],[\"b\",2]]|[[\"d\",3,\"n\"],[\"b\",1],[\"b\",2]]|[[\"d\",3,\"n\"],[\"b\",1],[\"b\",2]]|[[\"d\",3,\"n\"],[\"b\",0],[\"b\",2]]","[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]|[[\"d\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]","[[\"c\",1,\"n\"],[\"m\",2]]|[[\"c\",2,\"n\"],[\"m\",5]]|[[\"c\",3,\"n\"],[\"m\",0]]|[[\"q\",1,\"n\"],[\"m\",6]]|[[\"q\",2,\"n\"],[\"m\",1]]|[[\"q\",3,\"n\"],[\"m\",4]]|[[\"d\",1,\"n\"],[\"m\",5]]|[[\"d\",2,\"n\"],[\"m\",0]]","[[\"d\",3,\"n\"],[\".\",2]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"d\",3,\"n\"],[\".\",2]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]","[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"d\",3,\"n\"],[\".\",2]]|[[\"d\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"q\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"d\",3,\"n\"],[\".\",2]]","[[\"c\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]|[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]"],"opts":["[[\"t\",1,\"n\"]]|[[\"c\",1,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"d\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",1,\"s\"]]","[[\".\",1]]|[[\".\",2]]|[[\".\",3]]|[[\".\",6]]|[[\".\",5]]|[[\".\",4]]","[[\"q\",1,\"n\"]]|[[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",2,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"t\",2,\"n\"]]","[[\"c\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",3,\"s\"]]|[[\"d\",3,\"n\"]]","[[\"t\",3,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"t\",1,\"n\"]]|[[\"c\",3,\"n\"]]","[[\".\",4]]|[[\".\",6]]|[[\".\",5]]|[[\".\",2]]|[[\".\",3]]|[[\".\",1]]","[[\".\",3]]|[[\".\",6]]|[[\".\",1]]|[[\".\",2]]|[[\".\",5]]|[[\".\",4]]","[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]","[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"d\",1,\"n\"]]","[[\"c\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"q\",1,\"n\"]]|[[\"c\",3,\"s\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"m\",4]]|[[\"q\",3,\"n\"],[\"m\",0]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"m\",0]]|[[\"q\",3,\"n\"],[\"m\",6]]|[[\"q\",3,\"n\"],[\"m\",2]]","[[\".\",1]]|[[\".\",4]]|[[\".\",2]]|[[\".\",6]]|[[\".\",3]]|[[\".\",5]]","[[\"t\",1,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"t\",2,\"s\"]]|[[\"q\",1,\"n\"]]","[[\"c\",3,\"n\"],[\"m\",4]]|[[\"c\",3,\"n\"],[\"m\",3]]|[[\"c\",3,\"s\"],[\"m\",2]]|[[\"c\",3,\"n\"],[\"m\",1]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"m\",2]]","[[\"c\",3,\"s\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]","[[\"c\",3,\"n\"],[\".\",2]]|[[\"c\",3,\"n\"]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]|[[\"c\",3,\"n\"],[\"t\",1,\"s\"]]|[[\"c\",3,\"n\"],[\".\",5]]|[[\"c\",2,\"n\"],[\".\",2]]","[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"c\",3,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]","[[\"q\",3,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"s\"]]|[[\"d\",3,\"n\"]]","[[\"t\",3,\"n\"]]|[[\"q\",2,\"n\"]]|[[\"t\",2,\"n\"]]|[[\"q\",3,\"n\"]]|[[\"q\",2,\"s\"]]|[[\"q\",1,\"n\"]]","[[\"d\",3,\"n\"],[\"b\",2]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"b\",0],[\"b\",1]]|[[\"d\",3,\"n\"],[\"b\",0],[\"b\",1],[\"b\",2]]|[[\"d\",3,\"n\"],[\"b\",0]]|[[\"d\",3,\"n\"],[\"b\",1]]","[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]|[[\"q\",3,\"n\"],[\"q\",1,\"s\"]]|[[\"q\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"d\",2,\"s\"]]|[[\"t\",3,\"n\"],[\"t\",1,\"s\"]]","[[\"d\",3,\"n\"],[\"m\",3]]|[[\"d\",2,\"n\"],[\"m\",3]]|[[\"d\",3,\"n\"],[\"m\",6]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"m\",0]]|[[\"c\",3,\"n\"],[\"m\",3]]","[[\"d\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]|[[\"d\",1,\"n\"]]|[[\"d\",3,\"n\"],[\".\",2]]|[[\"d\",3,\"n\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"q\",3,\"n\"]]","[[\"t\",3,\"n\"]]|[[\"d\",3,\"n\"],[\".\",2]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"q\",3,\"n\"],[\"c\",1,\"s\"]]|[[\"t\",3,\"n\"],[\"c\",1,\"s\"],[\".\",2]]","[[\"d\",3,\"n\"]]|[[\"c\",3,\"n\"]]|[[\"t\",3,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"],[\"t\",1,\"n\"]]|[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]|[[\"c\",3,\"n\"],[\"c\",2,\"n\"]]"]},
  {"seed":1,"families":["sizeRamp","dotCount","sizeCycle","shapeCycle","dotAdd","sizeFillAlt","dotSub","outerRowInnerCycle","innerGrow","overlay","ringGrow","latinPos","latinDots","latinShapeFill","dist2","barLatin","ringLatin","overlayXor","orbitShapeLatin","ringGrowFill","fillRampShapeCycle","barXor3","ringLatinShape","dist2Latin","xorLatin"],"a":[2,0,0,2,0,4,3,5,0,2,4,5,3,3,1,1,0,5,2,3,2,0,2,3,2],"answers":["[[\"c\",3,\"n\"]]","[[\".\",3]]","[[\"q\",1,\"n\"]]","[[\"q\",3,\"n\"]]","[[\".\",4]]","[[\"d\",1,\"n\"]]","[[\".\",5]]","[[\"c\",3,\"n\"],[\"q\",1,\"s\"]]","[[\"q\",3,\"n\"],[\"q\",2,\"s\"]]","[[\"q\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"c\",3,\"n\"],[\"c\",2,\"n\"],[\"c\",1,\"n\"]]","[[\"t\",3,\"n\"],[\"m\",4]]","[[\".\",6]]","[[\"t\",3,\"n\"],[\"t\",1.4,\"s\"]]","[[\"c\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"d\",3,\"n\"],[\"b\",0]]","[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]","[[\"d\",3,\"n\"],[\"c\",1,\"s\"]]","[[\"d\",3,\"n\"],[\"m\",0]]","[[\"d\",3,\"n\"],[\"d\",2,\"n\"],[\"d\",1,\"s\"]]","[[\"c\",3,\"s\"]]","[[\"c\",3,\"n\"],[\"b\",0],[\"b\",2]]","[[\"q\",3,\"n\"]]","[[\"c\",3,\"n\"],[\"t\",1,\"s\"],[\".\",2]]","[[\"c\",3,\"n\"],[\".\",2]]"]},
  {"seed":50,"families":["sizeRamp","dotCount","shapeCycle","sizeCycle","dotAdd","dotSub","sizeFillAlt","barRotate","overlay","outerRowInnerCycle","latinSizeShape","latinShapeFill","markOrbit","latinDots","ringLatin","overlayXor","dist2","barLatin","markOrbitGrow","latinShapeSizeFill","innerGrowCycle","orbitShapeLatin","posLatinBarLatin","barXorLatin","orbitXor"],"a":[1,0,5,5,5,4,0,1,0,0,3,4,0,3,3,5,3,4,2,2,5,1,3,1,3],"answers":["[[\"c\",1,\"n\"]]","[[\".\",5]]","[[\"t\",3,\"n\"]]","[[\"c\",2,\"n\"]]","[[\".\",4]]","[[\".\",2]]","[[\"d\",3,\"n\"]]","[[\"d\",3,\"n\"],[\"b\",2]]","[[\"d\",3,\"n\"],[\"t\",1,\"s\"]]","[[\"t\",3,\"n\"],[\"d\",1,\"s\"]]","[[\"d\",1,\"n\"]]","[[\"c\",3,\"n\"],[\"c\",1.4,\"s\"]]","[[\"t\",3,\"n\"],[\"m\",1]]","[[\".\",6]]","[[\"t\",3,\"n\"],[\"t\",2,\"n\"]]","[[\"d\",3,\"n\"],[\"q\",1,\"s\"]]","[[\"q\",3,\"n\"],[\".\",2]]","[[\"d\",3,\"n\"],[\"b\",0]]","[[\"q\",1,\"n\"],[\"m\",7]]","[[\"q\",2,\"n\"]]","[[\"t\",3,\"n\"],[\"t\",2,\"s\"]]","[[\"c\",3,\"n\"],[\"m\",1]]","[[\"d\",3,\"n\"],[\"b\",3],[\"m\",2]]","[[\"q\",3,\"n\"],[\"b\",1],[\"b\",2]]","[[\"t\",3,\"n\"],[\"m\",2]]"]},
];

describe("gv 4 reconstruction (the live era — a stored {seed, gv} rebuilds its exact form forever)", () => {
  it("generateForm(seed, 4) reproduces the shipped v4 generator", () => {
    for (const g of GOLDEN_V4) {
      const f = generateForm(g.seed, 4);
      expect(f.version).toBe(4);
      expect(f.items).toHaveLength(25);
      expect(f.items.map((i) => i.rules[0]), `seed ${g.seed}`).toEqual(g.families);
      expect(f.items.map((i) => i.a), `seed ${g.seed}`).toEqual(g.a);
      expect(f.items.map((i) => canon(i.opts[i.a])), `seed ${g.seed}`).toEqual(g.answers);
      if (g.cells) expect(f.items.map((i) => i.cells.map(canon).join("|")), `seed ${g.seed} cells`).toEqual(g.cells);
      if (g.opts) expect(f.items.map((i) => i.opts.map(canon).join("|")), `seed ${g.seed} opts`).toEqual(g.opts);
    }
  });

  it("the three goldens between them reach every v4 family", () => {
    const seen = new Set(GOLDEN_V4.flatMap((g) => g.families));
    for (const fam of [
      "barRotate", "markOrbit", "latinPos", "barLatin", "barXor3",
      "orbitShapeLatin", "markOrbitGrow", "posLatinBarLatin", "orbitXor", "barXorLatin",
    ]) expect(seen.has(fam), `${fam} is pinned by no golden`).toBe(true);
  });

  it("v4 is the default era, and a v3 seed still draws from v3's pools", () => {
    // The default-version form is the one the overlay serves; a saved v3
    // result must keep rebuilding under v3's template, not v4's.
    expect(generateForm(17).version).toBe(4);
    expect(generateForm(17).items.map((i) => i.rules[0])).toEqual(GOLDEN_V4[0].families);
    expect(generateForm(17, 3).items.map((i) => i.rules[0])).toEqual(GOLDEN_V3[0].families);
    expect(generateForm(17, 3).items.map((i) => i.rules[0])).not.toEqual(GOLDEN_V4[0].families);
  });
});
