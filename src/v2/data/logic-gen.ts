// Procedural generator for the Logic overlay's matrix puzzles.
//
// The test used to be 12 hardcoded puzzles with a constant answer key
// (`a: 2,4,3,1,4,2,3,1,3,4,0,3`) shipped in the bundle — the same items in
// the same order with the same option positions on every attempt, so one
// memorized (or shared) key beat it permanently. This module replaces the
// bank with a generator: each attempt draws a fresh 12-item form from a
// seed, with fresh shapes, directions, rule parameters and shuffled option
// positions. What ships is the rule machinery, not an answer key. (Any
// client-side test is inspectable by a determined user; what this closes
// is memorization and the shipped constant, which was the actual hole.)
//
// The 12 rule families mirror the retired hand-authored bank motif for
// motif (size ramps, dot arithmetic, shape cycling, fill deepening, figure
// overlay/decomposition, Latin squares, concentric growth) plus one
// distribution-of-two family in the hard tail. That parity is the
// difficulty calibration: the ramp template ends where the old bank's
// declared easy→hard ramp did, so logicPctile's curve (midpoint 62%) keeps
// meaning what it meant. Diffs are Carpenter-ordered family weights.
//
// Deliberately NOT random per item: the family SEQUENCE. A fixed ramp
// template keeps every attempt comparable (same "k of 12" meaning) while
// the parameters inside each item vary. Item 12 alternates between the two
// hardest families by seed.
//
// Everything here is pure and deterministic per seed — vitest covers
// determinism, option-key integrity, distractor uniqueness, renderability,
// per-family semantics and the ambiguity sweep (no distractor may satisfy
// the rule a solver perceives). The overlay (src/v2/spec/logic-test.jsx)
// imports this directly — it left the window.LOGIC_GEN bridge with D52 —
// and results stay on-device (no backend — D31).

// ── the glyph vocabulary (must stay inside what Prim renders) ──
export type Shape = "c" | "q" | "d" | "t";
export type Fill = "n" | "s";
export interface Layer {
  s: Shape | ".";
  z?: number;
  f?: Fill;
  n?: number;
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
  JSON.stringify(cell.map((l) => (l.s === "." ? [".", l.n] : [l.s, l.z, l.f])));

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
};

// ── the ramp template ──
// Fixed family order on Carpenter-ordered weights (non-decreasing — the
// ramp monotonicity test pins it). Slot 12 alternates between the two
// hardest families by seed.
const TEMPLATE: { family: string; diff: number }[] = [
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

const familyAt = (seed: number, i: number): string =>
  TEMPLATE[i].family ||
  (mulberry32(mixSeed(seed, 0x51071))() < 0.5 ? "decompose" : "dist2");

// Construction cells for one item, family stream only — the test suite's
// entrance for verifying the answer and the family semantics without
// replaying option draws.
export function buildCells9(seed: number, i: number): { family: string; cells9: Cell[]; mutants: Cell[] } {
  const family = familyAt(seed, i);
  const rng = mulberry32(mixSeed(seed, i + 1));
  return { family, ...FAMILIES[family](rng) };
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
  const which = rng();
  if (which < 0.45) {
    l.s = SHAPES.filter((s) => s !== l.s)[pickIdx(rng, 3)];
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

export const version = 1;

export function generateForm(seed: number): Form {
  const s = seed >>> 0;
  const items: Item[] = TEMPLATE.map((slot, i) => {
    const { family, cells9, mutants } = buildCells9(s, i);
    const optRng = mulberry32(mixSeed(s, (i + 1) ^ 0xabcdef));
    const { opts, a } = buildOptions(optRng, cells9, mutants);
    return { cells: cells9.slice(0, 8), opts, a, diff: slot.diff, rules: [family] };
  });
  return { seed: s, version, items };
}

// No window publication: logic-test.jsx imports { generateForm, version }
// directly (D52). The global this module used to publish had exactly one
// consumer, and a real import is one fewer name the spec-globals ratchet
// has to carry.
