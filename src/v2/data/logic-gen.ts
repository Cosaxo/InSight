// Procedural generator for the Logic overlay's matrix puzzles.
//
// The test used to be 12 hardcoded puzzles with a constant answer key
// (`a: 2,4,3,1,4,2,3,1,3,4,0,3`) shipped in the bundle — the same items in
// the same order with the same option positions on every attempt, so one
// memorized (or shared) key beat it permanently. This module replaces the
// bank with a generator: each attempt draws a fresh form from a seed —
// 25 items since v3 (D61), over a wider vocabulary since v4 (D394); 12 in
// the frozen v1/v2 paths — with fresh
// shapes, directions, rule parameters and shuffled option positions. What
// ships is the rule machinery, not an answer key. (Any client-side test is
// inspectable by a determined user; what this closes is memorization and
// the shipped constant, which was the actual hole.)
//
// The rule families mirror the retired hand-authored bank motif for
// motif (size ramps, dot arithmetic, shape cycling, fill deepening, figure
// overlay/decomposition, Latin squares, concentric growth) plus
// distribution-of-two and figure-XOR families in the hard tail. That
// parity is the difficulty calibration: the ramp template ends where the
// old bank's declared easy→hard ramp did, so the percentile curve keeps
// meaning what it meant. Diffs are Carpenter-ordered family weights.
//
// ONE CURVE PER RAMP LENGTH, not one curve. This named "logicPctile's
// curve (midpoint 62%)" flat, which was true of the twelve-slot era and
// has not been since v3: logic-score.ts carries {12: mid 62} and
// {25: mid 54}, and `logicPctileFor` picks by item count. `logicPctile`
// itself is now the twelve-item alias, so quoting its midpoint as the
// app's was naming the legacy half. No behaviour rests on the sentence —
// the length-aware reader has always been the one in the path.
//
// Deliberately NOT random per item: the WEIGHT sequence. The slot weights
// are fixed per generator version (each version's ramp is the calibration
// its percentile curve is derived against), but since v2 each slot draws
// its family from a same-weight band (D56) — a repeat taker no longer
// knows that item 3 is a shape cycle, only that it carries weight 1.5.
// v3 (D61) lengthens the ramp to 25 slots and extends it upward with two
// new bands: weight-4 two-rule compositions and a weight-4.5 tail of
// triple-rule and dual-law items, Carpenter's hardest classes. v4 (D394)
// keeps that ramp and widens what a cell can say: a bar with an
// orientation and a mark with a place — the two spatial attributes matrix
// tests turn on and this vocabulary never had — and ten families over
// them join the bands from 2.5 up, so a solver who has learned "each
// row holds each value once" still meets rules that are not that. Every
// retired plan stays generable: generateForm(seed, 1|2|3) reproduces
// those eras' forms exactly, because a saved result's seed+gv must
// reconstruct its form forever (D31).
//
// Everything here is pure and deterministic per seed — vitest covers
// determinism, option-key integrity, distractor uniqueness, renderability,
// per-family semantics and the ambiguity sweep (no distractor may satisfy
// the rule a solver perceives). The overlay (src/v2/spec/logic-test.jsx)
// imports this directly — it left the window.LOGIC_GEN bridge with D53.
// Practice attempts stay on-device; verified attempts (D57) are seeded and
// scored server-side by functions/src/logic.ts, which is why this module
// exists in TWO byte-identical copies: src/v2/data/logic-gen.ts (this one)
// and functions/src/logic-gen.ts. The module is dependency-free on
// purpose — that is what makes the copy possible — and
// scripts/check-logic-sync.mjs fails CI (and the deploy path) the moment
// the copies disagree, because a drifted server copy would score forms the
// client never showed.

// ── the glyph vocabulary (must stay inside what Prim renders) ──
export type Shape = "c" | "q" | "d" | "t";
export type Fill = "n" | "s";
export interface Layer {
  /** a shape; "." a dot cluster; "b" a bar and "m" a mark (v4, D394) */
  s: Shape | "." | "b" | "m";
  z?: number;
  f?: Fill;
  n?: number;
  /** bar orientation in 45° steps — 0 —, 1 /, 2 |, 3 \. A bar is
   *  undirected, so orientation is arithmetic mod 4 (v4) */
  r?: number;
  /** mark position: one of eight places in the cell's margin, clockwise
   *  from the top — 0 top · 2 right · 4 bottom · 6 left (v4) */
  p?: number;
}
export type Cell = Layer[];
export interface Item {
  cells: Cell[]; // 8 row-major entries; bottom-right is the missing one
  opts: Cell[]; // 6 candidate tiles
  a: number; // index of the correct tile in opts
  diff: number; // family weight — the ramp position, saved with results
  rules: string[]; // family id(s), for debugging and future lenses
}
export interface Form {
  seed: number;
  version: number;
  items: Item[];
}

const SHAPES: Shape[] = ["c", "q", "d", "t"];
const SIZE = [1, 2, 3]; // z values the retired bank used for size ramps
const RING_INNER = 1.4; // the ring motif's solid core, verbatim from ring()

const L = (s: Shape, z: number, f: Fill): Layer => ({ s, z, f });
const D = (n: number): Layer => ({ s: ".", n });
// v4's two spatial layers (D394). A bar is a short line through the
// centre of the cell at one of four orientations; a mark is a small solid
// dot in the cell's margin at one of eight places. Both wrap, which is
// what lets "turn 45° each column" and "move two places clockwise" be
// rules rather than lists.
const ORIENTATIONS = 4;
const POSITIONS = 8;
const B = (r: number): Layer => ({ s: "b", r: ((r % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS });
const M = (p: number): Layer => ({ s: "m", p: ((p % POSITIONS) + POSITIONS) % POSITIONS });
// The bases a bar can sit inside: a bar of half-length 15 fits the z3
// circle, square and diamond; a triangle's lower half is too narrow.
const BAR_BASES: Shape[] = ["c", "q", "d"];
// The three line elements of the bar-subtraction families, as bits:
// 1 = — (orientation 0), 2 = | (orientation 2), 4 = / (orientation 1).
// Emitted in ascending orientation so a picture has ONE canon — perturb()
// keeps that order too, because two options that draw alike would be an
// ambiguity the sweep cannot see.
const barsOf = (m: number): Layer[] => {
  const out: Layer[] = [];
  if (m & 1) out.push(B(0));
  if (m & 4) out.push(B(1));
  if (m & 2) out.push(B(2));
  return out;
};
const sortBars = (cell: Cell): void => {
  const idx = cell.map((l, i) => (l.s === "b" ? i : -1)).filter((i) => i >= 0);
  const sorted = idx.map((i) => cell[i]).sort((a, b) => (a.r as number) - (b.r as number));
  idx.forEach((i, k) => { cell[i] = sorted[k]; });
};
// Operand pairs whose XOR the grid can pin: the two masks overlap AND each
// holds an element the other lacks, so on that row XOR differs from union,
// intersection and both one-sided differences at once. Over three
// elements that is every ordered pair of distinct members of {3, 5, 6}.
const XOR3_PINS: [number, number][] = [[3, 6], [6, 3], [3, 5], [5, 3], [5, 6], [6, 5]];
// …and every ordered pair of distinct masks, for the row the pin does not
// constrain (the XOR is nonempty by construction).
const XOR3_PAIRS: [number, number][] = [];
for (let s0 = 0; s0 < 8; s0++) for (let s1 = 0; s1 < 8; s1++) if (s0 !== s1) XOR3_PAIRS.push([s0, s1]);

// ── seeded PRNG ──
// mulberry32, same construction the spec layer already uses for its demo
// crowds. Inlined (no deps); first outputs are pinned in logic-gen.test.ts
// so a refactor cannot quietly change every historic seed's form.
export type Rng = () => number;
export function mulberry32(a: number): Rng {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Per-item stream split: family construction and option assembly draw from
// SEPARATE streams, so tests can rebuild the 9 construction cells without
// replaying option draws (and an option-side change can never shift the
// puzzle a seed produces).
export const mixSeed = (seed: number, salt: number): number =>
  (Math.imul((seed ^ salt) >>> 0, 0x9e3779b1) ^ (salt << 7)) >>> 0;

const pickIdx = (rng: Rng, n: number) => Math.floor(rng() * n) % n;
function shuffled<T>(rng: Rng, arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIdx(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const pick3 = (rng: Rng): Shape[] => shuffled(rng, SHAPES).slice(0, 3);
const rotate = <T,>(arr: T[], by: number): T[] =>
  arr.map((_, i) => arr[(i + by) % arr.length]);

// Canonical form for equality: layer order is preserved (later layers draw
// on top, so reordering can change the picture) and only the fields Prim
// reads participate.
export const canon = (cell: Cell): string =>
  JSON.stringify(
    cell.map((l) =>
      l.s === "." ? [".", l.n] : l.s === "b" ? ["b", l.r] : l.s === "m" ? ["m", l.p] : [l.s, l.z, l.f],
    ),
  );

// ── rule families ──
// Each returns the full 9-cell construction (row-major; index 8 is the
// answer) plus family-authored wrong answers: the "wrong rule" and
// "incomplete correlate" corruptions a generic mutator can't phrase.
type FamilyBuild = { cells9: Cell[]; mutants: Cell[] };
type Family = (rng: Rng) => FamilyBuild;

const grid = (fig: (r: number, c: number) => Cell): Cell[] => {
  const out: Cell[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(fig(r, c));
  return out;
};

const FAMILIES: Record<string, Family> = {
  // size grows (or shrinks) across each row; a different shape per row
  sizeRamp(rng) {
    const rows = pick3(rng);
    const asc = rng() < 0.5;
    const cells9 = grid((r, c) => [L(rows[r], SIZE[asc ? c : 2 - c], "n")]);
    const s = rows[2];
    return {
      cells9,
      mutants: [
        [L(s, SIZE[asc ? 1 : 0], "n")], // progression one step short
        [L(s, SIZE[asc ? 2 : 0], "s")], // right size, wrong fill
        [L(rows[0], SIZE[asc ? 2 : 0], "n")], // wrong row's shape
        [L(rows[1], SIZE[asc ? 2 : 0], "n")],
      ],
    };
  },

  // dot count = row base + column (bases a permutation of 1..3, max 5)
  dotCount(rng) {
    const base = shuffled(rng, [1, 2, 3]);
    const cells9 = grid((r, c) => [D(base[r] + c)]);
    const k = base[2] + 2;
    return {
      cells9,
      mutants: [[D(k - 1)], [D(k + 1)], [D(base[0] + 2)], [D(base[1] + 2)]].filter(
        (m) => (m[0].n as number) >= 1 && (m[0].n as number) <= 6,
      ),
    };
  },

  // shapes cycle along a diagonal (Latin square over one attribute)
  shapeCycle(rng) {
    const shapes = pick3(rng);
    const dir = rng() < 0.5 ? 1 : 2;
    const cells9 = grid((r, c) => [L(shapes[(r + dir * c) % 3], 3, "n")]);
    const right = shapes[(2 + dir * 2) % 3];
    const wrong = shapes.filter((s) => s !== right);
    return {
      cells9,
      mutants: [
        [L(wrong[0], 3, "n")],
        [L(wrong[1], 3, "n")],
        [L(right, 3, "s")],
        [L(right, 2, "n")],
      ],
    };
  },

  // fill deepens across: outline → ring → solid (direction varies)
  fillRamp(rng) {
    const rows = pick3(rng);
    const asc = rng() < 0.5;
    const states: ((s: Shape) => Cell)[] = [
      (s) => [L(s, 3, "n")],
      (s) => [L(s, 3, "n"), L(s, RING_INNER, "s")],
      (s) => [L(s, 3, "s")],
    ];
    const at = (c: number) => states[asc ? c : 2 - c];
    const cells9 = grid((r, c) => at(c)(rows[r]));
    const s = rows[2];
    return {
      cells9,
      mutants: [
        at(1)(s), // one state short
        at(0)(s),
        at(2)(rows[0]), // right state, wrong shape
        at(2)(rows[1]),
      ],
    };
  },

  // size ramps across, fill alternates by row, one shape throughout
  sizeFillAlt(rng) {
    const s = SHAPES[pickIdx(rng, 4)];
    const asc = rng() < 0.5;
    const fills: Fill[] = rng() < 0.5 ? ["s", "n", "s"] : ["n", "s", "n"];
    const cells9 = grid((r, c) => [L(s, SIZE[asc ? c : 2 - c], fills[r])]);
    const zEnd = SIZE[asc ? 2 : 0];
    const flip: Fill = fills[2] === "s" ? "n" : "s";
    return {
      cells9,
      mutants: [
        [L(s, zEnd, flip)], // row-alternation broken
        [L(s, SIZE[asc ? 1 : 1], fills[2])], // ramp broken
        [L(s === "q" ? "d" : "q", zEnd, fills[2])],
      ],
    };
  },

  // third column's dots are the sum of the first two
  dotAdd(rng) {
    const a = shuffled(rng, [1, 2, 3]);
    const b = shuffled(rng, [1, 2, 3]);
    const cells9 = grid((r, c) => [D(c === 0 ? a[r] : c === 1 ? b[r] : a[r] + b[r])]);
    const k = a[2] + b[2];
    return {
      cells9,
      mutants: [[D(k - 1)], [D(k + 1)], [D(a[2])], [D(b[2])]].filter(
        (m) => (m[0].n as number) >= 1 && (m[0].n as number) <= 6,
      ),
    };
  },

  // third column overlays the first two (figure addition)
  overlay(rng) {
    const outer = pick3(rng);
    const inner = rotate(outer, 1 + pickIdx(rng, 2));
    const O = (r: number) => L(outer[r], 3, "n");
    const I = (r: number) => L(inner[r], 1, "s");
    const cells9 = grid((r, c) => (c === 0 ? [O(r)] : c === 1 ? [I(r)] : [O(r), I(r)]));
    return {
      cells9,
      mutants: [
        [O(2)], // outer alone — the sum forgotten
        [I(2)],
        [O(2), I(0)], // right outer, wrong row's inner
        [O(0), I(2)],
        [O(2), { ...I(2), f: "n" }], // inner lost its fill
      ],
    };
  },

  // outer shape fixed per row, inner cycles per column
  outerRowInnerCycle(rng) {
    const outer = pick3(rng);
    const inner = pick3(rng);
    const cells9 = grid((r, c) => [L(outer[r], 3, "n"), L(inner[c], 1, "s")]);
    return {
      cells9,
      mutants: [
        [L(outer[2], 3, "n"), L(inner[0], 1, "s")], // wrong column's inner
        [L(outer[2], 3, "n"), L(inner[1], 1, "s")],
        [L(outer[0], 3, "n"), L(inner[2], 1, "s")], // wrong row's outer
        [L(outer[2], 3, "n"), L(inner[2], 1, "n")], // inner lost its fill
        [L(outer[2], 3, "s"), L(inner[2], 1, "s")],
      ],
    };
  },

  // every row and column holds each shape once AND each fill-state once
  latinShapeFill(rng) {
    const shapes = pick3(rng);
    const states: ((s: Shape) => Cell)[] = shuffled(rng, [0, 1, 2]).map(
      (i) =>
        [
          (s: Shape) => [L(s, 3, "n")],
          (s: Shape) => [L(s, 3, "s")],
          (s: Shape) => [L(s, 3, "n"), L(s, RING_INNER, "s")],
        ][i],
    );
    const dirS = rng() < 0.5 ? 1 : 2;
    const dirF = 3 - dirS; // opposite diagonals, so the attributes decorrelate
    const cells9 = grid((r, c) => states[(r + dirF * c) % 3](shapes[(r + dirS * c) % 3]));
    const sRight = shapes[(2 + dirS * 2) % 3];
    const fRight = (2 + dirF * 2) % 3;
    return {
      cells9,
      mutants: [
        states[(fRight + 1) % 3](sRight), // right shape, wrong state
        states[(fRight + 2) % 3](sRight),
        states[fRight](shapes[(sRight === shapes[0] ? 1 : 0)]), // wrong shape
      ],
    };
  },

  // sizes form a Latin square; shapes cycle on the other diagonal
  latinSizeShape(rng) {
    const shapes = pick3(rng);
    const zPerm = shuffled(rng, [0, 1, 2]);
    const dirS = rng() < 0.5 ? 1 : 2;
    const dirZ = 3 - dirS;
    const cells9 = grid((r, c) => [
      L(shapes[(r + dirS * c) % 3], SIZE[zPerm[(r + dirZ * c) % 3]], "n"),
    ]);
    const sRight = shapes[(2 + dirS * 2) % 3];
    const zRight = SIZE[zPerm[(2 + dirZ * 2) % 3]];
    const zWrong = SIZE.filter((z) => z !== zRight);
    return {
      cells9,
      mutants: [
        [L(sRight, zWrong[0], "n")],
        [L(sRight, zWrong[1], "n")],
        [L(shapes.find((s) => s !== sRight) as Shape, zRight, "n")],
        [L(sRight, zRight, "s")],
      ],
    };
  },

  // one more concentric outline each column
  ringGrow(rng) {
    const rows = pick3(rng);
    const asc = rng() < 0.5;
    const nested = (s: Shape, k: number): Cell =>
      Array.from({ length: k }, (_, i) => L(s, SIZE[2 - i], "n"));
    const at = (c: number) => (asc ? c + 1 : 3 - c);
    const cells9 = grid((r, c) => nested(rows[r], at(c)));
    const s = rows[2];
    const kEnd = at(2);
    return {
      cells9,
      mutants: [
        nested(s, Math.max(1, kEnd - 1)),
        nested(s, Math.min(3, kEnd + 1)),
        nested(rows[0], kEnd),
        kEnd >= 2 ? [L(s, 3, "n"), L(s, 1, "n")] : nested(rows[1], kEnd), // skipped a ring
      ],
    };
  },

  // col 0 = outer+inner · col 1 = the inner alone, grown solid · col 2 = the outer alone
  decompose(rng) {
    const outer = pick3(rng);
    const inner = rotate(outer, 1 + pickIdx(rng, 2));
    const cells9 = grid((r, c) =>
      c === 0
        ? [L(outer[r], 3, "n"), L(inner[r], 1, "s")]
        : c === 1
          ? [L(inner[r], 3, "s")]
          : [L(outer[r], 3, "n")],
    );
    return {
      cells9,
      mutants: [
        [L(inner[2], 3, "s")], // the inner again, not the outer
        [L(outer[2], 3, "s")], // outer but solid
        [L(outer[2], 3, "n"), L(inner[2], 1, "s")], // the undecomposed pair
        [L(outer[0], 3, "n")], // wrong row's outer
      ],
    };
  },

  // distribution of two: each overlay element appears in exactly two cells
  // of every row and column (its absences form a permutation matrix)
  dist2(rng) {
    const base = SHAPES[pickIdx(rng, 4)];
    const innerShape = SHAPES.filter((s) => s !== base)[pickIdx(rng, 3)];
    const holeA = shuffled(rng, [0, 1, 2]); // column with no A, per row
    let holeB = shuffled(rng, [0, 1, 2]);
    // distinct absence patterns, or the two elements read as one rule
    for (let guard = 0; guard < 8 && holeB.every((v, i) => v === holeA[i]); guard++) {
      holeB = shuffled(rng, [0, 1, 2]);
    }
    const A = L(innerShape, 1, "s");
    const B = D(2);
    const cellAt = (r: number, c: number): Cell => {
      const out: Cell = [L(base, 3, "n")];
      if (holeA[r] !== c) out.push(A);
      if (holeB[r] !== c) out.push(B);
      return out;
    };
    const cells9 = grid(cellAt);
    const hasA = holeA[2] !== 2;
    const hasB = holeB[2] !== 2;
    const build = (a: boolean, b: boolean): Cell => {
      const out: Cell = [L(base, 3, "n")];
      if (a) out.push(A);
      if (b) out.push(B);
      return out;
    };
    return {
      cells9,
      mutants: [
        build(!hasA, hasB), // one element miscounted
        build(hasA, !hasB),
        build(!hasA, !hasB), // both
      ],
    };
  },

  // ── families added with the banded template (D56) ──

  // sizes form a Latin square along a diagonal; a fixed shape per row
  sizeCycle(rng) {
    const rows = pick3(rng);
    const dir = rng() < 0.5 ? 1 : 2;
    const zAt = (r: number, c: number) => SIZE[(r + dir * c) % 3];
    const cells9 = grid((r, c) => [L(rows[r], zAt(r, c), "n")]);
    const zRight = zAt(2, 2);
    const zWrong = SIZE.filter((z) => z !== zRight);
    return {
      cells9,
      mutants: [
        [L(rows[2], zWrong[0], "n")],
        [L(rows[2], zWrong[1], "n")],
        [L(rows[0], zRight, "n")], // right size, wrong row's shape
        [L(rows[2], zRight, "s")], // right size, filled in
      ],
    };
  },

  // third column's dots are the first column's minus the second's
  dotSub(rng) {
    const a = shuffled(rng, [4, 5, 6]);
    const b = shuffled(rng, [1, 2, 3]);
    const cells9 = grid((r, c) => [D(c === 0 ? a[r] : c === 1 ? b[r] : a[r] - b[r])]);
    const k = a[2] - b[2]; // 1..5 by construction
    return {
      cells9,
      mutants: [[D(k - 1)], [D(k + 1)], [D(a[2])], [D(b[2])]].filter(
        (m) => (m[0].n as number) >= 1 && (m[0].n as number) <= 6 && m[0].n !== k,
      ),
    };
  },

  // a solid core appears and grows inside a fixed outline, across columns
  innerGrow(rng) {
    const rows = pick3(rng);
    const at = (s: Shape, c: number): Cell =>
      c === 0 ? [L(s, 3, "n")] : [L(s, 3, "n"), L(s, c === 1 ? 1 : 2, "s")];
    const cells9 = grid((r, c) => at(rows[r], c));
    const s = rows[2];
    return {
      cells9,
      mutants: [
        [L(s, 3, "n"), L(s, 1, "s")], // core one step small
        [L(s, 3, "n")], // core missing
        at(rows[0], 2), // right state, wrong row's shape
        [L(s, 3, "n"), L(s, 2, "n")], // core lost its fill
      ],
    };
  },

  // dot counts form a Latin square: every row and column holds the trio once
  latinDots(rng) {
    const trio = shuffled(rng, [1, 2, 3, 4, 5, 6]).slice(0, 3);
    const dir = rng() < 0.5 ? 1 : 2;
    const cells9 = grid((r, c) => [D(trio[(r + dir * c) % 3])]);
    const k = trio[(2 + dir * 2) % 3];
    const near = [k - 1, k + 1].filter((n) => n >= 1 && n <= 6 && !trio.includes(n));
    return {
      cells9,
      mutants: [...trio.filter((n) => n !== k), ...near].map((n) => [D(n)]),
    };
  },

  // figure XOR: col 2 holds each overlay element present in exactly one of
  // col 0 / col 1 — Carpenter's figure addition-and-subtraction tail
  overlayXor(rng) {
    const base = SHAPES[pickIdx(rng, 4)];
    const innerShape = SHAPES.filter((s) => s !== base)[pickIdx(rng, 3)];
    // element masks: bit 1 = inner solid shape, bit 2 = the dot pair
    const cellOf = (m: number): Cell => {
      const out: Cell = [L(base, 3, "n")];
      if (m & 1) out.push(L(innerShape, 1, "s"));
      if (m & 2) out.push(D(2));
      return out;
    };
    // Pairs whose sets intersect AND differ. On such a row the visible XOR
    // differs from union, intersection and both plain copies at once, so
    // the grid itself pins the rule — without one, a union reading would be
    // defensible and the union distractor AMBIGUOUS (the D53 cardinal sin).
    // Row 0 pins the rule; row 2 draws from the same pairs so the union
    // corruption below is always distinct from the answer.
    const PIN: [number, number][] = [[1, 3], [3, 1], [2, 3], [3, 2]];
    const rowPin = PIN[pickIdx(rng, 4)];
    const ansPool = PIN.filter((p) => p !== rowPin); // distinct pairs → no duplicate row
    const rowAns = ansPool[pickIdx(rng, ansPool.length)];
    // row 1: any remaining ordered pair of distinct masks (XOR visibly nonempty)
    const ALL: [number, number][] = [];
    for (let s0 = 0; s0 < 4; s0++) {
      for (let s1 = 0; s1 < 4; s1++) if (s0 !== s1) ALL.push([s0, s1]);
    }
    const mid = shuffled(rng, ALL).find(
      (p) => (p[0] !== rowPin[0] || p[1] !== rowPin[1]) && (p[0] !== rowAns[0] || p[1] !== rowAns[1]),
    ) as [number, number];
    const S = [rowPin, mid, rowAns];
    const cells9 = grid((r, c) => cellOf(c === 0 ? S[r][0] : c === 1 ? S[r][1] : S[r][0] ^ S[r][1]));
    return {
      cells9,
      mutants: [
        cellOf(rowAns[0] | rowAns[1]), // union — the sum, not the difference
        cellOf(rowAns[0] & rowAns[1]), // intersection — what both share
        cellOf(0), // the base alone — both elements forgotten
      ],
    };
  },

  // ── families added with the 25-item ramp (D61) ──
  // The w4 band is two simultaneous rules; w4.5 is three, or two elements
  // obeying two DIFFERENT laws — Carpenter's hardest classes.

  // ring counts form a Latin square; a fixed shape per row (harder than
  // ringGrow's column progression: distribution-of-three on a low-salience
  // attribute)
  ringLatin(rng) {
    const rows = pick3(rng);
    const dir = rng() < 0.5 ? 1 : 2;
    const nested = (s: Shape, k: number): Cell =>
      Array.from({ length: k }, (_, i) => L(s, SIZE[2 - i], "n"));
    const kAt = (r: number, c: number) => ((r + dir * c) % 3) + 1;
    const cells9 = grid((r, c) => nested(rows[r], kAt(r, c)));
    const k = kAt(2, 2);
    const wrong = [1, 2, 3].filter((v) => v !== k);
    return {
      cells9,
      mutants: [
        nested(rows[2], wrong[0]),
        nested(rows[2], wrong[1]),
        nested(rows[0], k), // right count, wrong row's shape
      ],
    };
  },

  // shapes AND sizes form Latin squares on opposite diagonals while the
  // fill alternates by row — latinSizeShape plus a third rule
  latinShapeSizeFill(rng) {
    const shapes = pick3(rng);
    const zPerm = shuffled(rng, [0, 1, 2]);
    const dirS = rng() < 0.5 ? 1 : 2;
    const dirZ = 3 - dirS;
    const fills: Fill[] = rng() < 0.5 ? ["s", "n", "s"] : ["n", "s", "n"];
    const cells9 = grid((r, c) => [
      L(shapes[(r + dirS * c) % 3], SIZE[zPerm[(r + dirZ * c) % 3]], fills[r]),
    ]);
    const sRight = shapes[(2 + dirS * 2) % 3];
    const zRight = SIZE[zPerm[(2 + dirZ * 2) % 3]];
    const zWrong = SIZE.filter((z) => z !== zRight);
    const flip: Fill = fills[2] === "s" ? "n" : "s";
    return {
      cells9,
      mutants: [
        [L(sRight, zRight, flip)], // everything right, row-alternation broken
        [L(sRight, zWrong[0], fills[2])],
        [L(sRight, zWrong[1], fills[2])],
        [L(shapes.find((s) => s !== sRight) as Shape, zRight, fills[2])],
      ],
    };
  },

  // outer and inner shapes each form a Latin square, on opposite diagonals
  outerLatinInnerLatin(rng) {
    const outer = pick3(rng);
    const inner = pick3(rng);
    const dirO = rng() < 0.5 ? 1 : 2;
    const dirI = 3 - dirO;
    const cells9 = grid((r, c) => [
      L(outer[(r + dirO * c) % 3], 3, "n"),
      L(inner[(r + dirI * c) % 3], 1, "s"),
    ]);
    const oRight = outer[(2 + dirO * 2) % 3];
    const iRight = inner[(2 + dirI * 2) % 3];
    const oWrong = outer.filter((s) => s !== oRight);
    const iWrong = inner.filter((s) => s !== iRight);
    return {
      cells9,
      mutants: [
        [L(oRight, 3, "n"), L(iWrong[0], 1, "s")],
        [L(oRight, 3, "n"), L(iWrong[1], 1, "s")],
        [L(oWrong[0], 3, "n"), L(iRight, 1, "s")],
        [L(oRight, 3, "n"), L(iRight, 1, "n")], // inner lost its fill
      ],
    };
  },

  // ring count grows by column while the innermost layer's fill alternates
  // by row — ringGrow plus a second rule
  ringGrowFill(rng) {
    const rows = pick3(rng);
    const asc = rng() < 0.5;
    const fills: Fill[] = rng() < 0.5 ? ["s", "n", "s"] : ["n", "s", "n"];
    const nested = (s: Shape, k: number, f: Fill): Cell =>
      Array.from({ length: k }, (_, i) => L(s, SIZE[2 - i], i === k - 1 ? f : "n"));
    const at = (c: number) => (asc ? c + 1 : 3 - c);
    const cells9 = grid((r, c) => nested(rows[r], at(c), fills[r]));
    const s = rows[2];
    const kEnd = at(2);
    const flip: Fill = fills[2] === "s" ? "n" : "s";
    return {
      cells9,
      mutants: [
        nested(s, kEnd, flip), // right rings, alternation broken
        nested(s, Math.max(1, kEnd - 1), fills[2]),
        nested(s, Math.min(3, kEnd + 1), fills[2]),
        nested(rows[0], kEnd, fills[2]),
      ],
    };
  },

  // outer shapes form a Latin square while a solid core appears and grows
  // across columns — two rules across two layers
  innerGrowCycle(rng) {
    const shapes = pick3(rng);
    const dir = rng() < 0.5 ? 1 : 2;
    const at = (s: Shape, c: number): Cell =>
      c === 0 ? [L(s, 3, "n")] : [L(s, 3, "n"), L(s, c === 1 ? 1 : 2, "s")];
    const cells9 = grid((r, c) => at(shapes[(r + dir * c) % 3], c));
    const sRight = shapes[(2 + dir * 2) % 3];
    const sWrong = shapes.filter((s) => s !== sRight);
    return {
      cells9,
      mutants: [
        [L(sRight, 3, "n"), L(sRight, 1, "s")], // core one step small
        [L(sRight, 3, "n")], // core missing
        at(sWrong[0], 2),
        at(sWrong[1], 2),
      ],
    };
  },

  // the fill state deepens by column while the shape cycles a Latin square
  fillRampShapeCycle(rng) {
    const shapes = pick3(rng);
    const dir = rng() < 0.5 ? 1 : 2;
    const asc = rng() < 0.5;
    const states: ((s: Shape) => Cell)[] = [
      (s) => [L(s, 3, "n")],
      (s) => [L(s, 3, "n"), L(s, RING_INNER, "s")],
      (s) => [L(s, 3, "s")],
    ];
    const at = (c: number) => states[asc ? c : 2 - c];
    const cells9 = grid((r, c) => at(c)(shapes[(r + dir * c) % 3]));
    const sRight = shapes[(2 + dir * 2) % 3];
    const sWrong = shapes.filter((s) => s !== sRight);
    return {
      cells9,
      mutants: [
        at(1)(sRight), // one state short
        at(0)(sRight),
        at(2)(sWrong[0]),
        at(2)(sWrong[1]),
      ],
    };
  },

  // distribution of two over a Latin base: each overlay element appears in
  // exactly two cells of every row and column while the base shape cycles —
  // three simultaneous rules
  dist2Latin(rng) {
    const bases = pick3(rng);
    const innerShape = SHAPES.find((s) => !bases.includes(s)) as Shape;
    const dirB = rng() < 0.5 ? 1 : 2;
    const holeA = shuffled(rng, [0, 1, 2]);
    let holeB = shuffled(rng, [0, 1, 2]);
    for (let guard = 0; guard < 8 && holeB.every((v, i) => v === holeA[i]); guard++) {
      holeB = shuffled(rng, [0, 1, 2]);
    }
    const cellAt = (r: number, c: number): Cell => {
      const out: Cell = [L(bases[(r + dirB * c) % 3], 3, "n")];
      if (holeA[r] !== c) out.push(L(innerShape, 1, "s"));
      if (holeB[r] !== c) out.push(D(2));
      return out;
    };
    const cells9 = grid(cellAt);
    const bRight = bases[(2 + dirB * 2) % 3];
    const bWrong = bases.filter((s) => s !== bRight);
    const hasA = holeA[2] !== 2;
    const hasB = holeB[2] !== 2;
    const build = (base: Shape, a: boolean, b: boolean): Cell => {
      const out: Cell = [L(base, 3, "n")];
      if (a) out.push(L(innerShape, 1, "s"));
      if (b) out.push(D(2));
      return out;
    };
    return {
      cells9,
      mutants: [
        build(bRight, !hasA, hasB), // one element miscounted
        build(bRight, hasA, !hasB),
        build(bWrong[0], hasA, hasB), // right elements, wrong base
        build(bWrong[1], hasA, hasB),
      ],
    };
  },

  // row-wise figure XOR over a Latin base — overlayXor plus a third rule
  xorLatin(rng) {
    const bases = pick3(rng);
    const innerShape = SHAPES.find((s) => !bases.includes(s)) as Shape;
    const dirB = rng() < 0.5 ? 1 : 2;
    const el = (m: number): Layer[] => {
      const out: Layer[] = [];
      if (m & 1) out.push(L(innerShape, 1, "s"));
      if (m & 2) out.push(D(2));
      return out;
    };
    // same pin discipline as overlayXor: row 0's operands intersect AND
    // differ, so the grid itself refutes the union reading
    const PIN: [number, number][] = [[1, 3], [3, 1], [2, 3], [3, 2]];
    const rowPin = PIN[pickIdx(rng, 4)];
    const ansPool = PIN.filter((p) => p !== rowPin);
    const rowAns = ansPool[pickIdx(rng, ansPool.length)];
    const ALL: [number, number][] = [];
    for (let s0 = 0; s0 < 4; s0++) {
      for (let s1 = 0; s1 < 4; s1++) if (s0 !== s1) ALL.push([s0, s1]);
    }
    const mid = shuffled(rng, ALL).find(
      (p) => (p[0] !== rowPin[0] || p[1] !== rowPin[1]) && (p[0] !== rowAns[0] || p[1] !== rowAns[1]),
    ) as [number, number];
    const S = [rowPin, mid, rowAns];
    const maskAt = (r: number, c: number) =>
      c === 0 ? S[r][0] : c === 1 ? S[r][1] : S[r][0] ^ S[r][1];
    const cells9 = grid((r, c) => [L(bases[(r + dirB * c) % 3], 3, "n"), ...el(maskAt(r, c))]);
    const bRight = bases[(2 + dirB * 2) % 3];
    const bWrong = bases.filter((s) => s !== bRight);
    const xor = rowAns[0] ^ rowAns[1];
    const withBase = (base: Shape, m: number): Cell => [L(base, 3, "n"), ...el(m)];
    return {
      cells9,
      mutants: [
        withBase(bRight, rowAns[0] | rowAns[1]), // union, not difference
        withBase(bRight, rowAns[0] & rowAns[1]),
        withBase(bWrong[0], xor), // right elements, wrong base
        withBase(bWrong[1], xor),
      ],
    };
  },

  // ring counts AND shapes form Latin squares on opposite diagonals — a
  // double distribution over one high- and one low-salience attribute
  ringLatinShape(rng) {
    const shapes = pick3(rng);
    const dirS = rng() < 0.5 ? 1 : 2;
    const dirK = 3 - dirS;
    const nested = (s: Shape, k: number): Cell =>
      Array.from({ length: k }, (_, i) => L(s, SIZE[2 - i], "n"));
    const cells9 = grid((r, c) =>
      nested(shapes[(r + dirS * c) % 3], ((r + dirK * c) % 3) + 1),
    );
    const sRight = shapes[(2 + dirS * 2) % 3];
    const kRight = ((2 + dirK * 2) % 3) + 1;
    const sWrong = shapes.filter((s) => s !== sRight);
    const kWrong = [1, 2, 3].filter((k) => k !== kRight);
    return {
      cells9,
      mutants: [
        nested(sRight, kWrong[0]),
        nested(sRight, kWrong[1]),
        nested(sWrong[0], kRight),
        nested(sWrong[1], kRight),
      ],
    };
  },

  // two elements, two different laws: the inner shape is distributed two-
  // per-line (its absences a permutation matrix), while the dots follow
  // row-wise XOR — the solver must find BOTH before the cell resolves
  dist2Xor(rng) {
    const base = SHAPES[pickIdx(rng, 4)];
    const innerShape = SHAPES.filter((s) => s !== base)[pickIdx(rng, 3)];
    const holeA = shuffled(rng, [0, 1, 2]);
    // row 0 is (1,1): both operands hold dots and the result does not,
    // which pins XOR against a union reading the way overlayXor's pin
    // rows do; the other rows draw freely.
    const pairs: [number, number][] = [[1, 0], [0, 1], [1, 1], [0, 0]];
    const S: [number, number][] = [[1, 1], pairs[pickIdx(rng, 4)], pairs[pickIdx(rng, 4)]];
    const bAt = (r: number, c: number) =>
      c === 0 ? S[r][0] : c === 1 ? S[r][1] : S[r][0] ^ S[r][1];
    const cellAt = (r: number, c: number): Cell => {
      const out: Cell = [L(base, 3, "n")];
      if (holeA[r] !== c) out.push(L(innerShape, 1, "s"));
      if (bAt(r, c)) out.push(D(2));
      return out;
    };
    const cells9 = grid(cellAt);
    const hasA = holeA[2] !== 2;
    const hasB = bAt(2, 2) === 1;
    const build = (a: boolean, b: boolean): Cell => {
      const out: Cell = [L(base, 3, "n")];
      if (a) out.push(L(innerShape, 1, "s"));
      if (b) out.push(D(2));
      return out;
    };
    return {
      cells9,
      mutants: [
        build(!hasA, hasB), // the distributed element miscounted
        build(hasA, !hasB), // the dots' parity flipped
        build(!hasA, !hasB),
      ],
    };
  },

  // ── families added with v4 (D394): orientation and position ──
  // Two attributes the vocabulary never had — where a bar points, where a
  // mark sits — and the rule kinds only they can carry: a rotation, an
  // orbit, a distribution over places, and figure subtraction over LINE
  // elements, which overlap into crosses and stars instead of sitting
  // side by side. Both attributes are arithmetic (mod 4, mod 8), so a
  // progression completes from two visible cells (2·b − a) the way a size
  // ramp does, and no direction ambiguity can arise: two turns of ±45°
  // land on one orientation, and an orbit's way round is read off the
  // first two columns. Every start is drawn distinct per row, so no two
  // rows read alike and the only consistent reading is the rule.

  // a bar inside a fixed base turns 45° per column; each row starts at
  // its own orientation
  barRotate(rng) {
    const rows = shuffled(rng, BAR_BASES);
    const step = rng() < 0.5 ? 1 : -1;
    const start = shuffled(rng, [0, 1, 2, 3]).slice(0, 3);
    const cells9 = grid((r, c) => [L(rows[r], 3, "n"), B(start[r] + c * step)]);
    const base = L(rows[2], 3, "n");
    const ans = B(start[2] + 2 * step);
    return {
      cells9,
      mutants: [
        [base, B(start[2] + step)], // one turn short
        [base, B(start[2] + 3 * step)], // one turn over
        [base, B(start[2])], // no turn at all
        [L(rows[0], 3, "n"), ans], // right bar, wrong row's base
        [L(rows[1], 3, "n"), ans],
      ],
    };
  },

  // a mark in the margin of a fixed base moves a fixed number of places
  // round the cell per column — one, two or three, either way — and each
  // row starts at its own place
  markOrbit(rng) {
    const rows = pick3(rng);
    const step = (1 + pickIdx(rng, 3)) * (rng() < 0.5 ? 1 : -1);
    const start = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    const cells9 = grid((r, c) => [L(rows[r], 3, "n"), M(start[r] + c * step)]);
    const base = L(rows[2], 3, "n");
    const ans = M(start[2] + 2 * step);
    return {
      cells9,
      mutants: [
        [base, M(start[2] + step)], // one move short
        [base, M(start[2] + 3 * step)], // one move over
        [base, M(start[2] - 2 * step)], // the other way round (dedups when ±2 steps coincide)
        [base, M(start[2])], // no move
        [L(rows[0], 3, "n"), ans], // right place, wrong row's base
        [base], // the mark forgotten
      ],
    };
  },

  // distribution of three over PLACE: a mark sits at one of three places
  // round a fixed base, each place once per row and once per column
  latinPos(rng) {
    const base = SHAPES[pickIdx(rng, 4)];
    const trio = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    const dir = rng() < 0.5 ? 1 : 2;
    const at = (p: number): Cell => [L(base, 3, "n"), M(p)];
    const cells9 = grid((r, c) => at(trio[(r + dir * c) % 3]));
    const pRight = trio[(2 + dir * 2) % 3];
    const wrong = trio.filter((p) => p !== pRight);
    // the nearest place the grid never used — three of eight are taken,
    // so one of these is always free
    const near = [1, -1, 2, -2, 3, -3, 4].map((d) => M(pRight + d).p as number).find((p) => !trio.includes(p)) as number;
    return {
      cells9,
      mutants: [
        at(wrong[0]), // a place this row or column already holds
        at(wrong[1]),
        at(near), // a place the grid never taught
        [L(base, 3, "n")], // the mark forgotten
        [L(base, 3, "s"), M(pRight)], // right place, base filled in
      ],
    };
  },

  // distribution of three over ORIENTATION: a bar inside a fixed-per-row
  // base takes three of the four orientations, each once per row and once
  // per column — ringLatin's low-salience twin
  barLatin(rng) {
    const rows = shuffled(rng, BAR_BASES);
    const trio = shuffled(rng, [0, 1, 2, 3]).slice(0, 3);
    const dir = rng() < 0.5 ? 1 : 2;
    const cells9 = grid((r, c) => [L(rows[r], 3, "n"), B(trio[(r + dir * c) % 3])]);
    const base = L(rows[2], 3, "n");
    const rRight = trio[(2 + dir * 2) % 3];
    const wrong = trio.filter((r) => r !== rRight);
    const unseen = [0, 1, 2, 3].find((r) => !trio.includes(r)) as number;
    return {
      cells9,
      mutants: [
        [base, B(wrong[0])], // an orientation this row or column already holds
        [base, B(wrong[1])],
        [base, B(unseen)], // the fourth orientation, never in the grid
        [L(rows[0], 3, "n"), B(rRight)], // right bar, wrong row's base
        [base], // the bar forgotten
      ],
    };
  },

  // figure subtraction over LINES: three bar orientations are the
  // elements, and column 2 holds each bar present in exactly one of
  // columns 0 and 1. Overlapping bars fuse into crosses and stars, so the
  // operands are gestalts rather than a checklist — Carpenter's hardest
  // single motif in the form it usually takes.
  barXor3(rng) {
    const base = BAR_BASES[pickIdx(rng, 3)];
    const cellOf = (m: number): Cell => [L(base, 3, "n"), ...barsOf(m)];
    // Pin pairs: operands that overlap AND each hold a bar the other
    // lacks. On such a row XOR differs from union, intersection and both
    // one-sided differences at once, so the grid refutes every rival
    // reading by itself. Rows 0 and 2 both draw pins (distinct), so the
    // corruptions below are always wrong answers, never ambiguous ones.
    const rowPin = XOR3_PINS[pickIdx(rng, XOR3_PINS.length)];
    const ansPool = XOR3_PINS.filter((p) => p !== rowPin);
    const rowAns = ansPool[pickIdx(rng, ansPool.length)];
    const mid = shuffled(rng, XOR3_PAIRS).find(
      (p) => (p[0] !== rowPin[0] || p[1] !== rowPin[1]) && (p[0] !== rowAns[0] || p[1] !== rowAns[1]),
    ) as [number, number];
    const S = [rowPin, mid, rowAns];
    const cells9 = grid((r, c) => cellOf(c === 0 ? S[r][0] : c === 1 ? S[r][1] : S[r][0] ^ S[r][1]));
    const [a, b] = rowAns;
    return {
      cells9,
      mutants: [
        cellOf(a | b), // union — the shared bar kept
        cellOf(a & b), // intersection — only the shared bar
        cellOf(a & ~b), // one-sided difference
        cellOf(b & ~a),
        cellOf(0), // the base alone
      ],
    };
  },

  // a mark orbits while the base shape cycles a Latin square — a
  // progression on one layer over a distribution on the other
  orbitShapeLatin(rng) {
    const shapes = pick3(rng);
    const dir = rng() < 0.5 ? 1 : 2;
    const step = (1 + pickIdx(rng, 3)) * (rng() < 0.5 ? 1 : -1);
    const start = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    const cells9 = grid((r, c) => [L(shapes[(r + dir * c) % 3], 3, "n"), M(start[r] + c * step)]);
    const sRight = shapes[(2 + dir * 2) % 3];
    const sWrong = shapes.filter((s) => s !== sRight);
    const ans = M(start[2] + 2 * step);
    return {
      cells9,
      mutants: [
        [L(sRight, 3, "n"), M(start[2] + step)], // right shape, one move short
        [L(sRight, 3, "n"), M(start[2] + 3 * step)], // one move over
        [L(sWrong[0], 3, "n"), ans], // right place, wrong shape
        [L(sWrong[1], 3, "n"), ans],
        [L(sRight, 3, "n")], // the mark forgotten
      ],
    };
  },

  // two progressions at once: the base grows across the columns while its
  // mark moves round the cell — a fixed shape per row
  markOrbitGrow(rng) {
    const rows = pick3(rng);
    const asc = rng() < 0.5;
    const step = (1 + pickIdx(rng, 3)) * (rng() < 0.5 ? 1 : -1);
    const start = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    const zAt = (c: number) => SIZE[asc ? c : 2 - c];
    const cells9 = grid((r, c) => [L(rows[r], zAt(c), "n"), M(start[r] + c * step)]);
    const s = rows[2];
    const zEnd = zAt(2);
    const ans = M(start[2] + 2 * step);
    return {
      cells9,
      mutants: [
        [L(s, zEnd, "n"), M(start[2] + step)], // right size, one move short
        [L(s, zEnd, "n"), M(start[2] + 3 * step)],
        [L(s, zAt(1), "n"), ans], // right place, size one step short
        [L(rows[0], zEnd, "n"), ans], // wrong row's shape
        [L(s, zEnd, "n")], // the mark forgotten
      ],
    };
  },

  // double distribution over the two new attributes: the mark's place and
  // the bar's orientation each form a Latin square, on opposite diagonals,
  // round one fixed base
  posLatinBarLatin(rng) {
    const base = BAR_BASES[pickIdx(rng, 3)];
    const pTrio = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    const rTrio = shuffled(rng, [0, 1, 2, 3]).slice(0, 3);
    const dirP = rng() < 0.5 ? 1 : 2;
    const dirR = 3 - dirP;
    const at = (p: number, r: number): Cell => [L(base, 3, "n"), B(r), M(p)];
    const cells9 = grid((r, c) => at(pTrio[(r + dirP * c) % 3], rTrio[(r + dirR * c) % 3]));
    const pRight = pTrio[(2 + dirP * 2) % 3];
    const rRight = rTrio[(2 + dirR * 2) % 3];
    const pWrong = pTrio.filter((p) => p !== pRight);
    const rWrong = rTrio.filter((r) => r !== rRight);
    return {
      cells9,
      mutants: [
        at(pWrong[0], rRight), // right bar, a place already used
        at(pWrong[1], rRight),
        at(pRight, rWrong[0]), // right place, an orientation already used
        at(pRight, rWrong[1]),
        [L(base, 3, "n"), B(rRight)], // the mark forgotten
      ],
    };
  },

  // two elements under two laws: the mark orbits (a progression) while
  // the dots follow row-wise XOR — dist2Xor's shape over the new
  // attribute, so neither law can be read off the other
  orbitXor(rng) {
    const base = SHAPES[pickIdx(rng, 4)];
    const step = (1 + pickIdx(rng, 3)) * (rng() < 0.5 ? 1 : -1);
    const start = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    // row 0 is (1,1): both operands hold dots and the result does not —
    // the pin against a union reading, as in dist2Xor
    const pairs: [number, number][] = [[1, 0], [0, 1], [1, 1], [0, 0]];
    const S: [number, number][] = [[1, 1], pairs[pickIdx(rng, 4)], pairs[pickIdx(rng, 4)]];
    const bAt = (r: number, c: number) => (c === 0 ? S[r][0] : c === 1 ? S[r][1] : S[r][0] ^ S[r][1]);
    const build = (p: number, b: boolean): Cell => {
      const out: Cell = [L(base, 3, "n"), M(p)];
      if (b) out.push(D(2));
      return out;
    };
    const cells9 = grid((r, c) => build(start[r] + c * step, bAt(r, c) === 1));
    const pAns = start[2] + 2 * step;
    const hasB = bAt(2, 2) === 1;
    return {
      cells9,
      mutants: [
        build(start[2] + step, hasB), // one move short
        build(start[2] + 3 * step, hasB), // one move over
        build(pAns, !hasB), // the dots' parity flipped
        build(start[2] - 2 * step, hasB), // the other way round
        build(start[2] + step, !hasB), // both wrong
      ],
    };
  },

  // three-element line subtraction over a Latin base — barXor3 plus a
  // third rule, xorLatin's shape
  barXorLatin(rng) {
    const bases = shuffled(rng, BAR_BASES);
    const dirB = rng() < 0.5 ? 1 : 2;
    const rowPin = XOR3_PINS[pickIdx(rng, XOR3_PINS.length)];
    const ansPool = XOR3_PINS.filter((p) => p !== rowPin);
    const rowAns = ansPool[pickIdx(rng, ansPool.length)];
    const mid = shuffled(rng, XOR3_PAIRS).find(
      (p) => (p[0] !== rowPin[0] || p[1] !== rowPin[1]) && (p[0] !== rowAns[0] || p[1] !== rowAns[1]),
    ) as [number, number];
    const S = [rowPin, mid, rowAns];
    const maskAt = (r: number, c: number) => (c === 0 ? S[r][0] : c === 1 ? S[r][1] : S[r][0] ^ S[r][1]);
    const cells9 = grid((r, c) => [L(bases[(r + dirB * c) % 3], 3, "n"), ...barsOf(maskAt(r, c))]);
    const bRight = bases[(2 + dirB * 2) % 3];
    const bWrong = bases.filter((s) => s !== bRight);
    const [a, b] = rowAns;
    const withBase = (base: Shape, m: number): Cell => [L(base, 3, "n"), ...barsOf(m)];
    return {
      cells9,
      mutants: [
        withBase(bRight, a | b), // union, not difference
        withBase(bRight, a & b), // intersection
        withBase(bWrong[0], a ^ b), // right bars, wrong base
        withBase(bWrong[1], a ^ b),
        withBase(bRight, a & ~b), // one-sided difference
      ],
    };
  },
};

// ── the ramp template ──
// The slot WEIGHTS are fixed per generator version — non-decreasing
// Carpenter-ordered values, pinned by the ramp monotonicity test and, per
// era, by the golden blocks in logic-gen.test.ts. They are the difficulty
// calibration D31 anchored the percentile curve to, so they do not move
// when families do.
//
// This said "the twelve slot weights … identical across generator
// versions", which the paragraph at the head of this file already
// contradicted: v1 and v2 both run twelve slots ending at 3.5, and v3
// (D61) runs twenty-five ending at 4.5. A reader taking it at its word
// would have thought a ramp change was safe across eras.
//
// v1 (frozen): one fixed family per slot; slot 12 alternated between the
// two hardest families by seed. Kept generable forever — a saved result's
// {seed, gv} must reconstruct the exact form it was earned on (D31), and
// the golden test pins this path against drift.
const TEMPLATE_V1: { family: string; diff: number }[] = [
  { family: "sizeRamp", diff: 1 },
  { family: "dotCount", diff: 1 },
  { family: "shapeCycle", diff: 1.5 },
  { family: "fillRamp", diff: 2 },
  { family: "sizeFillAlt", diff: 2 },
  { family: "dotAdd", diff: 2 },
  { family: "overlay", diff: 2.5 },
  { family: "outerRowInnerCycle", diff: 2.5 },
  { family: "latinShapeFill", diff: 3 },
  { family: "latinSizeShape", diff: 3 },
  { family: "ringGrow", diff: 3 },
  { family: "", diff: 3.5 }, // resolved per seed: decompose | dist2
];

const familyAtV1 = (seed: number, i: number): string =>
  TEMPLATE_V1[i].family ||
  (mulberry32(mixSeed(seed, 0x51071))() < 0.5 ? "decompose" : "dist2");

// v2 (D56): each slot draws its family from a same-weight band, without
// replacement inside the band — no family repeats within a form, and the
// SEQUENCE stops being knowable in advance (v1's fixed order was the one
// piece of a fresh form a repeat taker still knew). Weight parity is what
// keeps "k of 12" comparable across attempts, exactly as it kept v1
// comparable to the retired hand-authored bank.
const BANDS_V2: { diff: number; slots: number; pool: string[] }[] = [
  { diff: 1, slots: 2, pool: ["sizeRamp", "dotCount"] },
  { diff: 1.5, slots: 1, pool: ["shapeCycle", "sizeCycle"] },
  { diff: 2, slots: 3, pool: ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"] },
  { diff: 2.5, slots: 2, pool: ["overlay", "outerRowInnerCycle", "innerGrow"] },
  { diff: 3, slots: 3, pool: ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots"] },
  { diff: 3.5, slots: 1, pool: ["decompose", "dist2", "overlayXor"] },
];

function planV2(seed: number): { family: string; diff: number }[] {
  const out: { family: string; diff: number }[] = [];
  BANDS_V2.forEach((band, b) => {
    // One stream per band (salts clear of the per-item construction and
    // option salts), so adding a family to one band never reshuffles the
    // draws of another.
    const rng = mulberry32(mixSeed(seed, 0xb0a0 + b));
    for (const family of shuffled(rng, band.pool).slice(0, band.slots)) {
      out.push({ family, diff: band.diff });
    }
  });
  return out;
}

// v3 (D61): 25 slots, tail-heavy — eleven of them at weight 3.5 or above,
// against v2's one. The two new bands hold the compositions: w4 is two
// simultaneous rules, w4.5 is three (or two elements under two different
// laws). Band salts are v3-distinct (0xc300+) so pool edits here can
// never reshuffle a v2 seed's draws.
const BANDS_V3: { diff: number; slots: number; pool: string[] }[] = [
  { diff: 1, slots: 2, pool: ["sizeRamp", "dotCount"] },
  { diff: 1.5, slots: 2, pool: ["shapeCycle", "sizeCycle"] },
  { diff: 2, slots: 3, pool: ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"] },
  { diff: 2.5, slots: 3, pool: ["overlay", "outerRowInnerCycle", "innerGrow"] },
  { diff: 3, slots: 4, pool: ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots"] },
  { diff: 3.5, slots: 4, pool: ["decompose", "dist2", "overlayXor", "ringLatin"] },
  {
    diff: 4,
    slots: 4,
    pool: ["latinShapeSizeFill", "outerLatinInnerLatin", "ringGrowFill", "innerGrowCycle", "fillRampShapeCycle"],
  },
  { diff: 4.5, slots: 3, pool: ["dist2Latin", "xorLatin", "ringLatinShape", "dist2Xor"] },
];

function planV3(seed: number): { family: string; diff: number }[] {
  const out: { family: string; diff: number }[] = [];
  BANDS_V3.forEach((band, b) => {
    const rng = mulberry32(mixSeed(seed, 0xc300 + b));
    for (const family of shuffled(rng, band.pool).slice(0, band.slots)) {
      out.push({ family, diff: band.diff });
    }
  });
  return out;
}

// v4 (D394): the same 25-slot ramp and the same weights — the calibration
// D61's curve rests on — with the two attributes the vocabulary never had
// (orientation, position) and the rule kinds only they carry joining every
// band from 2.5 up: a turn, an orbit, distributions over place and
// orientation, and figure subtraction over line elements. Band salts are
// v4-distinct (0xd400+), so a v3 seed's draws can never move.
const BANDS_V4: { diff: number; slots: number; pool: string[] }[] = [
  { diff: 1, slots: 2, pool: ["sizeRamp", "dotCount"] },
  { diff: 1.5, slots: 2, pool: ["shapeCycle", "sizeCycle"] },
  { diff: 2, slots: 3, pool: ["fillRamp", "sizeFillAlt", "dotAdd", "dotSub"] },
  { diff: 2.5, slots: 3, pool: ["overlay", "outerRowInnerCycle", "innerGrow", "barRotate"] },
  { diff: 3, slots: 4, pool: ["latinShapeFill", "latinSizeShape", "ringGrow", "latinDots", "markOrbit", "latinPos"] },
  { diff: 3.5, slots: 4, pool: ["decompose", "dist2", "overlayXor", "ringLatin", "barLatin"] },
  {
    diff: 4,
    slots: 4,
    pool: [
      "latinShapeSizeFill", "outerLatinInnerLatin", "ringGrowFill", "innerGrowCycle", "fillRampShapeCycle",
      "barXor3", "orbitShapeLatin", "markOrbitGrow",
    ],
  },
  {
    diff: 4.5,
    slots: 3,
    pool: ["dist2Latin", "xorLatin", "ringLatinShape", "dist2Xor", "posLatinBarLatin", "orbitXor", "barXorLatin"],
  },
];

function planV4(seed: number): { family: string; diff: number }[] {
  const out: { family: string; diff: number }[] = [];
  BANDS_V4.forEach((band, b) => {
    const rng = mulberry32(mixSeed(seed, 0xd400 + b));
    for (const family of shuffled(rng, band.pool).slice(0, band.slots)) {
      out.push({ family, diff: band.diff });
    }
  });
  return out;
}

const planAt = (seed: number, gv: number): { family: string; diff: number }[] => {
  if (gv === 1) return TEMPLATE_V1.map((slot, i) => ({ family: familyAtV1(seed, i), diff: slot.diff }));
  if (gv === 2) return planV2(seed);
  if (gv === 3) return planV3(seed);
  if (gv === 4) return planV4(seed);
  // An unknown version must fail loudly: silently reinterpreting a seed is
  // the exact failure mode the gv field exists to prevent (D31).
  throw new Error(`logic-gen: unknown generator version ${gv}`);
};

// ── construction, per form ──
// Every item's cells come from its own family stream (salt i + 1), so an
// option-side change can never move a puzzle. Since v4 (D394) a form also
// never repeats a grid: two families can construct the same nine cells
// when their streams happen to draw the same base, element and holes —
// dist2 and dist2Xor, dist2 and overlayXor, dist2Latin and xorLatin all
// can, and a 5,000-seed sweep found one such form at v3 — and a repeat
// hands the solver a puzzle they have just seen. A colliding item
// re-draws from a salted stream until its grid is new to the form; v1–v3
// keep their frozen constructions, collisions included.
type Built = { family: string; cells9: Cell[]; mutants: Cell[] };
const gridKey = (cells9: Cell[]) => cells9.map(canon).join("|");
function buildAll(seed: number, gv: number): Built[] {
  const seen = new Set<string>();
  return planAt(seed, gv).map((slot, i) => {
    const family = slot.family;
    let built = FAMILIES[family](mulberry32(mixSeed(seed, i + 1)));
    if (gv >= 4) {
      for (let attempt = 1; seen.has(gridKey(built.cells9)); attempt++) {
        // 0x4000 + (i << 6) + attempt stays clear of every other salt
        if (attempt > 32) throw new Error("logic-gen: construction space exhausted");
        built = FAMILIES[family](mulberry32(mixSeed(seed, 0x4000 + (i << 6) + attempt)));
      }
      seen.add(gridKey(built.cells9));
    }
    return { family, ...built };
  });
}
// One-entry memo: generateForm asks for a form's items in order, and so
// does the test suite — a repeated (seed, gv) costs nothing, a new one
// rebuilds the form's constructions once.
let memoKey = "";
let memo: Built[] = [];
const builtFor = (seed: number, gv: number): Built[] => {
  const k = `${seed}:${gv}`;
  if (k !== memoKey) {
    memo = buildAll(seed, gv);
    memoKey = k;
  }
  return memo;
};

// Construction cells for one item, family stream only — the test suite's
// entrance for verifying the answer and the family semantics without
// replaying option draws.
export function buildCells9(seed: number, i: number, gv: number = version): Built {
  return builtFor(seed >>> 0, gv)[i];
}

// A generic corruption of the answer: one legal attribute flipped on one
// layer. Used to top up the option pool when family mutants collide.
function perturb(answer: Cell, rng: Rng): Cell {
  const cell = answer.map((l) => ({ ...l }));
  const l = cell[pickIdx(rng, cell.length)];
  if (l.s === ".") {
    // Any wrong count is a plausible distractor — ±1 alone starves the
    // pool on dot-arithmetic items, whose family mutants already occupy
    // the neighbouring counts.
    const others = [1, 2, 3, 4, 5, 6].filter((v) => v !== l.n);
    l.n = others[pickIdx(rng, others.length)];
    return cell;
  }
  // v4 layers. A bar or mark moves to a place this cell does not already
  // show: two bars at one orientation draw as one, and an option that
  // LOOKS like another is the ambiguity the sweep cannot see. Neither
  // branch runs for a v1–v3 cell, so those eras' draws are untouched.
  if (l.s === "b") {
    const used = new Set(cell.filter((x) => x.s === "b").map((x) => x.r));
    const free = [0, 1, 2, 3].filter((v) => !used.has(v)); // never empty: three bars at most
    l.r = free[pickIdx(rng, free.length)];
    sortBars(cell);
    return cell;
  }
  if (l.s === "m") {
    const used = new Set(cell.filter((x) => x.s === "m").map((x) => x.p));
    const free = [0, 1, 2, 3, 4, 5, 6, 7].filter((v) => !used.has(v));
    l.p = free[pickIdx(rng, free.length)];
    return cell;
  }
  const which = rng();
  const barred = cell.some((x) => x.s === "b");
  if (which < 0.45 || barred) {
    // A bar's base only ever changes shape, and only to another bar base:
    // solid ink would hide the bars, a smaller base cannot hold one, and a
    // triangle's lower half is too narrow.
    const pool = barred ? BAR_BASES : SHAPES;
    l.s = pool.filter((s) => s !== l.s)[pickIdx(rng, pool.length - 1)];
  } else if (which < 0.7 && SIZE.includes(l.z as number)) {
    l.z = SIZE.filter((z) => z !== l.z)[pickIdx(rng, 2)];
  } else {
    l.f = l.f === "s" ? "n" : "s";
  }
  return cell;
}

function buildOptions(
  rng: Rng,
  cells9: Cell[],
  mutants: Cell[],
): { opts: Cell[]; a: number } {
  const answer = cells9[8];
  const aKey = canon(answer);
  const seen = new Set([aKey]);
  const pool: Cell[] = [];
  const add = (c: Cell) => {
    const k = canon(c);
    if (!seen.has(k)) {
      seen.add(k);
      pool.push(c);
    }
  };
  // Family-authored wrong-rule/incomplete-correlate corruptions first,
  // then repetitions of neighbouring visible cells — the two error shapes
  // real solvers actually make — then generic perturbations to fill.
  shuffled(rng, mutants).forEach(add);
  [cells9[7], cells9[5], cells9[6]].forEach(add);
  let guard = 0;
  while (pool.length < 5) {
    add(perturb(answer, rng));
    if (++guard > 200) throw new Error("logic-gen: distractor space exhausted");
  }
  const opts = shuffled(rng, [answer, ...pool.slice(0, 5)]);
  return { opts, a: opts.indexOf(answer) };
}

export const version = 4;

// gv defaults to the current version; pass a stored result's gv to rebuild
// the exact form its score was earned on (D31 — reconstructable forever).
export function generateForm(seed: number, gv: number = version): Form {
  const s = seed >>> 0;
  const items: Item[] = planAt(s, gv).map((slot, i) => {
    const { family, cells9, mutants } = buildCells9(s, i, gv);
    const optRng = mulberry32(mixSeed(s, (i + 1) ^ 0xabcdef));
    const { opts, a } = buildOptions(optRng, cells9, mutants);
    return { cells: cells9.slice(0, 8), opts, a, diff: slot.diff, rules: [family] };
  });
  return { seed: s, version: gv, items };
}

// No window publication: logic-test.jsx imports { generateForm, version }
// directly (D53). The global this module used to publish had exactly one
// consumer, and a real import is one fewer name the spec-globals ratchet
// has to carry.
