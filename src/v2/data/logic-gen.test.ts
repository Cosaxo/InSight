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

  it("slot 12 alternates between the two hard families across seeds", () => {
    const tails = new Set(forms.map((f) => f.items[11].rules[0]));
    expect(tails).toEqual(new Set(["decompose", "dist2"]));
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
});
