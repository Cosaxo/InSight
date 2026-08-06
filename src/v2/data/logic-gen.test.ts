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
} from "./logic-gen";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i + 1) * 2654435761 % 4294967296);
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

  it("12 items, 8 visible cells, 6 options each; diffs non-decreasing", () => {
    for (const f of forms) {
      expect(f.items).toHaveLength(12);
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
      }
    }
  });

  it("the answer position varies — every slot 0..5 occurs across seeds", () => {
    const seen = new Set(forms.flatMap((f) => f.items.map((i) => i.a)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

});

// ── the banded template (v2, D54) ──
// The WEIGHT ramp is the calibration D31 anchored the percentile curve to,
// so it is pinned verbatim; the family occupying a slot is drawn from that
// slot's same-weight band, so the sequence varies per attempt. The pools
// are pinned literally here on purpose: moving a family between bands (or
// changing a weight) is a recalibration and must show up as a test edit.
describe("the banded template (v2)", () => {
  const RAMP = [1, 1, 1.5, 2, 2, 2, 2.5, 2.5, 3, 3, 3, 3.5];
  const BAND_AT: string[][] = [
    ["sizeRamp", "dotCount"],
    ["sizeRamp", "dotCount"],
    ["shapeCycle", "sizeCycle"],
    ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"],
    ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"],
    ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"],
    ["overlay", "outerRowInnerCycle", "innerGrow"],
    ["overlay", "outerRowInnerCycle", "innerGrow"],
    ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots"],
    ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots"],
    ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots"],
    ["decompose", "dist2", "overlayXor"],
  ];

  it("every form carries the fixed weight ramp — the curve's anchor does not move", () => {
    for (const f of forms) expect(f.items.map((i) => i.diff)).toEqual(RAMP);
  });

  it("each slot's family comes from its own weight band; no family repeats in a form", () => {
    for (const f of forms) {
      const fams = f.items.map((i) => i.rules[0]);
      fams.forEach((fam, i) => expect(BAND_AT[i], `seed ${f.seed} slot ${i}`).toContain(fam));
      expect(new Set(fams).size, `seed ${f.seed}`).toBe(12);
    }
  });

  it("the draws actually vary: every family of every band appears across seeds", () => {
    const seen = new Set(forms.flatMap((f) => f.items.map((i) => i.rules[0])));
    for (const fam of new Set(BAND_AT.flat())) {
      expect(seen.has(fam), `family ${fam} never drawn in 200 seeds`).toBe(true);
    }
  });
});

describe("renderability (stays inside Prim's vocabulary)", () => {
  it("every layer of every cell and option is drawable", () => {
    const okLayer = (l: { s: string; z?: number; f?: string; n?: number }) => {
      if (l.s === ".") return typeof l.n === "number" && l.n >= 1 && l.n <= 6;
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

describe("family semantics", () => {
  const each = (family: string, check: (cells9: Cell[], seed: number) => void) => {
    it(family, () => {
      let covered = 0;
      for (const seed of SEEDS.slice(0, 60)) {
        for (let i = 0; i < 12; i++) {
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
  new Set(cells.flat().filter((l) => l.s !== ".").map((l) => l.s));

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
};

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
    expect(checked).toBe(forms.length * 12 * 5);
  });

  it("no form repeats a puzzle", () => {
    for (const [si, f] of forms.entries()) {
      const keys = new Set(
        f.items.map((_, ii) => buildCells9(SEEDS[si], ii).cells9.map(canon).join("|")),
      );
      expect(keys.size, `seed ${f.seed}`).toBe(12);
    }
  });

  it("the answer slot is uniform-ish, not merely present", () => {
    // "every slot occurs" passes a badly biased shuffle; a loose band
    // around uniform (16.7%) catches a broken Fisher–Yates. Measured
    // 16.3–17.0% over 60k items; the band is generous.
    const counts = [0, 0, 0, 0, 0, 0];
    for (const f of forms) for (const item of f.items) counts[item.a]++;
    const total = forms.length * 12;
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
    expect(() => generateForm(1, 3)).toThrow(/unknown generator version/);
  });
});
