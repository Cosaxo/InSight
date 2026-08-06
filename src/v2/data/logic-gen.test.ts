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
