#!/usr/bin/env node
// Builds the app's OMIB bank out of the published archive, and gates it.
//
// WHY THIS SCRIPT EXISTS. The Open Matrices Item Bank (D473) ships its 220
// items twice over: as rendered SVG, and as a spreadsheet whose last column
// holds the thing the app actually needs — the 9x20 bit CODE (nine cells,
// twenty construction elements, one bit each) that the bank's own renderer
// draws from. The spreadsheet is the source here; a bank of codes is what lets
// the overlay compose items out of twenty primitives instead of shipping 220
// pictures.
//
// THE ARTWORK IS THE CROSS-CHECK, and that is the point of reading it at all.
// Every element in every SVG is drawn from the fixed table in the bank's own
// `Web Version/javascript/drawing.js`, so recovering a code from a picture is
// string equality on path data, not image recognition — which makes the two
// sources INDEPENDENT. All 220 agree on all eight visible cells, and all 220
// put the published answer in the ninth. That is what says we are reading the
// bank the way its authors wrote it, and it keeps saying so on every run:
// anything the table does not name is a hard error, never a skipped shape.
//
// THE ARTWORK CARRIES NO ANSWER. All 226 published SVGs render eight cells and
// omit the ninth, so a picture never gives the solution away. The answers live
// only in the spreadsheet, and this script keeps them in a
// SEPARATE output (`content/omib-key.json`) so that "the key never reaches a
// device" stays a property something can check, the way D57 made it one for the
// generator. Note the honest limit, recorded at D473: the authors publish that
// spreadsheet themselves, so the key is public on the internet whatever this
// repository does.
//
// --check re-derives everything from source and fails on any disagreement with
// the committed JSON — the `check:logic-sync` shape, for the same reason. A
// drifted bank would score items the app never rendered.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "content", "omib-source");
const ITEMS_OUT = join(ROOT, "content", "omib.json");
const KEY_OUT = join(ROOT, "content", "omib-key.json");
// The deployable copy. functions/tsconfig compiles only its own src/, so a
// cross-package import cannot reach the deploy bundle — the same reason
// logic-gen.ts exists twice (check:logic-sync). Generated rather than copied
// because the server needs the KEY beside the items, and content/ keeps them
// in two files on purpose; --check holds this byte-for-byte, the v2content.ts
// discipline.
const FN_OUT = join(ROOT, "functions", "src", "omib-bank.ts");

// ── the element vocabulary ────────────────────────────────────────────────
// drawing.js's tables, verbatim. Index is the element id, 0..19: five families
// of four. The path strings are copied character for character on purpose —
// they are the join key, so "tidying" one silently unmaps an element.
const CORNER = ["0,0 25,0 0,25", "25,100 0,100 0,75", "100,75 100,100 75,100", "75,0 100,0 100,25"];
const LINE = ["12.5,50 50,12.5", "12.5,50 50,87.5", "50,87.5 87.5,50", "50,12.5 87.5,50"];
const BOX = [
  "37.5,0 62.5,0 62.5,12.5 37.5,12.5", "0,37.5 0,62.5 12.5,62.5 12.5,37.5",
  "37.5,87.5 62.5,87.5 62.5,100 37.5,100", "87.5,37.5 87.5,62.5 100,62.5 100,37.5",
];
const ARROW = ["50,12.5 37.5,25 62.5,25", "12.5,50 25,37.5 25,62.5", "50,87.5 37.5,75 62.5,75", "87.5,50 75,37.5 75,62.5"];

export const ELEMENTS = 20;
// The bank writes a cell as twenty characters, element 0 FIRST. Read with
// parseInt that puts element i at bit (19 - i), so every mask is built through
// this helper rather than by shifting — the one place the convention lives.
const maskOf = (ids) => ids.reduce((m, i) => m | (1 << (ELEMENTS - 1 - i)), 0);
const POLYGON_TO_ID = new Map();
CORNER.forEach((p, i) => POLYGON_TO_ID.set(p, 0 + i));
LINE.forEach((p, i) => POLYGON_TO_ID.set(p, 4 + i));
BOX.forEach((p, i) => POLYGON_TO_ID.set(p, 8 + i));
ARROW.forEach((p, i) => POLYGON_TO_ID.set(p, 16 + i));

// Elements 12..15 are the only ones drawn as primitives rather than polygons:
// a filled square, an outlined square, a filled circle, an outlined circle.
const shapeId = (tag, attrs) => {
  const outlined = /fill="none"/.test(attrs);
  if (tag === "rect") return outlined ? 13 : 12;
  if (tag === "circle") return outlined ? 15 : 14;
  return null;
};

/** The five families, as masks over the 20 bits. A rule acts inside one. */
export const FAMILY_MASKS = {
  corner: maskOf([0, 1, 2, 3]), line: maskOf([4, 5, 6, 7]), box: maskOf([8, 9, 10, 11]),
  shape: maskOf([12, 13, 14, 15]), arrow: maskOf([16, 17, 18, 19]),
};
const MASK20 = (1 << ELEMENTS) - 1;

// ── recovering one item's code from its artwork ───────────────────────────
const CELL_RE = /<svg\b[^>]*id="[^"]*_mat(\d)"[^>]*>([\s\S]*?)<\/svg>/g;
const EL_RE = /<(polygon|rect|circle)\b([^>]*)>/g;

export function codeFromSvg(src, label) {
  const clean = src.replace(/data-v-[0-9a-f]+=""\s*/g, "");
  const cells = new Map();
  for (const m of clean.matchAll(CELL_RE)) {
    const n = Number(m[1]);
    const bits = Array(ELEMENTS).fill("0");
    for (const [, tag, attrs] of m[2].matchAll(EL_RE)) {
      let id;
      if (tag === "polygon") {
        const pts = /points="([^"]*)"/.exec(attrs);
        if (!pts) throw new Error(`${label} cell ${n}: polygon with no points`);
        id = POLYGON_TO_ID.get(pts[1].trim());
        if (id === undefined) throw new Error(`${label} cell ${n}: unknown polygon ${pts[1]}`);
      } else {
        id = shapeId(tag, attrs);
        if (id === null) throw new Error(`${label} cell ${n}: unknown <${tag}>`);
      }
      bits[id] = "1";
    }
    cells.set(n, bits.join(""));
  }
  // Eight, never nine: the goal cell is not drawn. If a future revision of the
  // bank ships it, that is a change worth stopping on rather than absorbing —
  // it would mean the artwork now carries the answer.
  const seen = [...cells.keys()].sort((a, b) => a - b);
  if (seen.length !== 8 || seen.some((v, i) => v !== i + 1)) {
    throw new Error(`${label}: found cells [${seen}], expected 1..8`);
  }
  const out = [];
  for (let i = 1; i <= 8; i++) out.push(cells.get(i));
  out.push("0".repeat(ELEMENTS)); // the goal cell, empty by construction
  return out.join(",");
}

// ── the rule semantics, used only to VERIFY ───────────────────────────────
// The app does not need these to score — it has the published answers. They
// exist so the extraction can be checked against something independent: if the
// codes are right, applying the bank's own rules to cells 7 and 8 reproduces
// the published solution. 218 of 220 do; see PINNED_DERIVABLE.
const rotateWithin = (v, mask, step) => {
  const idx = [];
  for (let i = 0; i < ELEMENTS; i++) if (mask >> i & 1) idx.push(i);
  let out = 0;
  idx.forEach((bit, k) => { if (v >> bit & 1) out |= 1 << idx[(k + step) % idx.length]; });
  return out;
};
const OPS = [
  (a, b) => a | b,                        // addition
  (a, b) => a & ~b & MASK20,              // subtraction
  (a, b) => a ^ b,                        // disjunctive union
  (a, b) => a & b,                        // intersection
  (a, b, m) => rotateWithin(b, m, 1),
  (a, b, m) => rotateWithin(b, m, 2),
  (a, b, m) => rotateWithin(b, m, 3),
  (a, b) => b,                            // carried unchanged
  (a, b, m) => m & ~(a | b) & MASK20,     // completeness
];

/** Is this item's published answer reproducible from its code, family by family? */
export function derivable(code, solution) {
  const cells = code.split(",").map((c) => parseInt(c, 2));
  const [a, b] = [cells[6], cells[7]];
  const want = parseInt(solution, 2);
  return Object.values(FAMILY_MASKS).every((m) =>
    OPS.some((op) => (op(a & m, b & m, m) & m) === (want & m)));
}

// 218 of 220. The two that resist (one on `arrow`, one on `line`) use a rule
// shape this small op set does not model; they are NOT excluded from the bank,
// because the app scores from the published answer and never from a derivation.
// The number is pinned so that a change in the extraction cannot hide inside a
// "close enough" ratio.
export const PINNED_DERIVABLE = 218;

// ── the spreadsheet ───────────────────────────────────────────────────────
// Read as TSV rather than .xlsx so this script stays Node-stdlib-only: it is a
// gate, and gates here do not grow a dependency (the `check-deploy-targets`
// discipline). The .xlsx is committed beside it as the provenance.
const RULE_COLUMNS = {
  add: "Addition", sub: "Subtraction", xor: "Disjuncitve Union",
  and: "Intersection", rot: "Rotation", comp: "Completeness",
};

function readItemData() {
  const lines = readFileSync(join(SRC, "item-data.tsv"), "utf8").trim().split("\n");
  const head = lines[0].split("\t");
  const col = (name) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`item-data.tsv has no column ${name}`);
    return i;
  };
  // `b` and `a` are the IRT parameters; one item of the 220 was published
  // without them and keeps nulls rather than being dropped or defaulted.
  const num = (v) => (v === "" || v === "---" || v === undefined ? null : Number(v));
  return lines.slice(1).map((line) => {
    const f = line.split("\t");
    const rules = {};
    for (const [key, header] of Object.entries(RULE_COLUMNS)) rules[key] = f[col(header)] === "1";
    return {
      n: Number(f[col("Item")]),
      set: Number(f[col("Set")]),
      rules,
      ruleCount: Number(f[col("Rules")]),
      p: num(f[col("mean")]),
      rDrop: num(f[col("r.drop")]),
      b: num(f[col("b")]),
      a: num(f[col("a")]),
      solution: String(f[col("Item Solution")]).padStart(ELEMENTS, "0"),
      code: String(f[col("Complete Item Code")]),
    };
  });
}

// ── build ─────────────────────────────────────────────────────────────────
function build() {
  const svgDir = join(SRC, "Figural Matrices");
  const codes = new Map();
  for (const file of readdirSync(svgDir).filter((f) => f.endsWith(".svg"))) {
    const name = file.slice(0, -4);
    codes.set(name, codeFromSvg(readFileSync(join(svgDir, file), "utf8"), name));
  }

  const rows = readItemData();
  const items = [];
  const key = {};
  let derived = 0;
  for (const r of rows) {
    const name = `Item_${r.n}`;
    const fromArt = codes.get(name);
    if (!fromArt) throw new Error(`${name}: in the spreadsheet, not in the artwork`);
    const cells = r.code.split(",");
    if (cells.length !== 9 || cells.some((c) => c.length !== ELEMENTS || /[^01]/.test(c))) {
      throw new Error(`${name}: code is not nine groups of ${ELEMENTS} bits`);
    }
    if (r.solution.length !== ELEMENTS || /[^01]/.test(r.solution)) {
      throw new Error(`${name}: solution is not ${ELEMENTS} bits — ${r.solution}`);
    }
    // The two independent sources must agree, on every visible cell and on the
    // answer. A disagreement means one of them changed under us.
    const art = fromArt.split(",");
    for (let i = 0; i < 8; i++) {
      if (art[i] !== cells[i]) throw new Error(`${name} cell ${i + 1}: artwork ${art[i]} vs spreadsheet ${cells[i]}`);
    }
    if (cells[8] !== r.solution) throw new Error(`${name}: code's goal cell ${cells[8]} is not the published answer ${r.solution}`);
    // What the app stores renders the EIGHT visible cells and nothing else, so
    // the bank a client is served can never contain what it is being asked for.
    const code = [...cells.slice(0, 8), "0".repeat(ELEMENTS)].join(",");
    if (derivable(r.code, r.solution)) derived += 1;
    items.push({
      id: `omib-${r.n}`, n: r.n, set: r.set, code,
      rules: r.rules, ruleCount: r.ruleCount,
      p: r.p, rDrop: r.rDrop, b: r.b, a: r.a,
    });
    key[`omib-${r.n}`] = r.solution;
  }

  // The six anchors are published alongside the 220 and carry no parameters;
  // they are kept as codes only, for a future linking study.
  const anchors = {};
  for (const [name, code] of codes) if (name.startsWith("Anchor_")) anchors[name.toLowerCase()] = code;

  return { items, key, anchors, derived };
}

const banner = (what) => ({
  _source: "Open Matrices Item Bank (Koch, Spinath, Greiff & Becker 2022), https://osf.io/4km79/",
  _licence: "GPLv3, per the bank's paper. The archive itself ships no licence file — see D473.",
  _generated: "npm run build:omib — do not hand-edit; npm run check:omib fails on drift.",
  _what: what,
});

// What the server needs of each item, and nothing it does not: the code
// (eight visible cells, ninth empty), the calibration, the rule count for
// stratifying a form, and — in a separate export — the answer. No `p`, no
// `rDrop`, no set: the server stratifies and scores, and reads nothing else.
function functionsModule(items, key) {
  const rows = items.map((i) =>
    `  { n: ${i.n}, code: ${JSON.stringify(i.code)}, a: ${i.a === null ? "null" : i.a}, b: ${i.b === null ? "null" : i.b}, rules: ${i.ruleCount} },`,
  );
  const keys = items.map((i) => `  ${i.n}: ${JSON.stringify(key[i.id])},`);
  return [
    "// GENERATED from content/omib.json and content/omib-key.json by",
    "// scripts/build-omib.mjs — do not hand-edit. Regenerate with `npm run",
    "// build:omib`; `npm run check:omib` compares this file byte-for-byte",
    "// against what content/ generates, in CI, so a hand edit here (or a",
    "// content/ change without a regen) fails the gate.",
    "//",
    "// The Open Matrices Item Bank (Koch, Spinath, Greiff & Becker 2022,",
    "// https://osf.io/4km79/, GPLv3 per the paper — D473) as the server needs",
    "// it: per item the 9x20 construction code (eight visible cells, the ninth",
    "// all zeros), the published 2PL calibration (`a` discrimination, `b`",
    "// difficulty — one item carries neither), and the rule count a form is",
    "// stratified on. OMIB_KEY is the answer key, item number → the 20-bit",
    "// solution. THIS FILE IS SERVER-SIDE ONLY: functions/ is never shipped to a",
    "// client, and scripts/build-omib.test.mjs holds src/ to never naming the",
    "// key. The honest limit stands (D473): the bank's authors publish this key",
    "// themselves.",
    "",
    "export const OMIB_BANK_VERSION = 1;",
    "",
    "export interface OmibItem {",
    "  /** the bank's own item number, 1..220 */",
    "  n: number;",
    "  /** nine comma-separated 20-bit cells, element 0 first; the ninth is zeros */",
    "  code: string;",
    "  a: number | null;",
    "  b: number | null;",
    "  /** rules applied row-wise, 1..5 */",
    "  rules: number;",
    "}",
    "",
    "export const OMIB_ITEMS: readonly OmibItem[] = [",
    ...rows,
    "];",
    "",
    "/** item number → the 20-bit solution. Never sent to a client. */",
    "export const OMIB_KEY: Readonly<Record<number, string>> = {",
    ...keys,
    "};",
    "",
  ].join("\n");
}

function main() {
  const { items, key, anchors, derived } = build();
  if (derived !== PINNED_DERIVABLE) {
    throw new Error(`rule derivation reproduced ${derived}/${items.length} answers, pinned at ${PINNED_DERIVABLE}`);
  }

  const itemsDoc = { ...banner("220 items: the 9x20 construction code and the published parameters. No answers."), items, anchors };
  const keyDoc = { ...banner("the answer key. Server-side only — this file must never reach a client bundle."), key };

  const check = process.argv.includes("--check");
  for (const [path, next] of [
    [ITEMS_OUT, `${JSON.stringify(itemsDoc, null, 2)}\n`],
    [KEY_OUT, `${JSON.stringify(keyDoc, null, 2)}\n`],
    [FN_OUT, functionsModule(items, key)],
  ]) {
    if (check) {
      const have = readFileSync(path, "utf8");
      if (have !== next) throw new Error(`${path} is out of date — run \`npm run build:omib\``);
    } else {
      writeFileSync(path, next);
    }
  }
  const withIrt = items.filter((i) => i.b !== null).length;
  console.log(
    `check-omib OK — ${items.length} items (${withIrt} with IRT parameters), ` +
    `${Object.keys(anchors).length} anchors, ${derived} answers re-derived from the codes; functions/src/omib-bank.ts ${check ? "in sync" : "written"}.`,
  );
}

// Guarded so the test suite can import the pure pieces (the vocabulary map, the
// derivation) without the build running as a side effect.
if (process.argv[1] && process.argv[1].endsWith("build-omib.mjs")) main();
