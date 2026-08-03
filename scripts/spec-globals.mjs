// Shared scanner for the spec layer's shared-global convention.
//
// Two consumers, one source of truth:
//   - scripts/check-spec-globals.mjs  reports dangling refs / unimported files
//   - eslint.config.js                seeds no-undef with the names that are
//                                     genuinely defined, so the rule can be ON
//                                     for the spec layer instead of disabled
//
// Before this split, eslint had no way to know which bare identifiers were
// legitimate globals, so no-undef was off for ~18.5kLOC — which is how two
// ReferenceErrors (ReactDOM at six portal sites, a bare `sign`) and a dead
// <GroupLevelTab> shipped without anything noticing.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specDir = join(root, "src/v2/spec");
const uiDir = join(root, "src/v2/ui");
// The typed data layer publishes globals too (live.ts's window.LIVE,
// back.ts's window.registerBackHandler). This used to name live.ts alone,
// which meant the SECOND data module to publish one was invisible here —
// its consumer read as a dangling reference and the check failed with the
// blame pointing at the consumer. Scanning the directory fixes the class.
const dataDir = join(root, "src/v2/data");

// Browser / runtime globals the spec layer legitimately reads off
// window without defining. Extend deliberately, not casually.
const RUNTIME_ALLOWLIST = new Set([
  // DOM / BOM
  "innerWidth", "innerHeight", "location", "navigator", "history",
  "localStorage", "sessionStorage", "matchMedia", "getSelection",
  "requestAnimationFrame", "cancelAnimationFrame", "setTimeout",
  "clearTimeout", "setInterval", "clearInterval", "addEventListener",
  "removeEventListener", "dispatchEvent", "scrollTo", "scrollY",
  "open", "alert", "confirm", "prompt", "getComputedStyle",
  "devicePixelRatio", "visualViewport", "crypto", "performance",
  "ResizeObserver", "IntersectionObserver", "MutationObserver",
  "parent", "postMessage", "focus", "blur", "close",
  // build-time / SDK globals defined outside the spec layer
  "Capacitor", "__APP_BUILD__",
  // This list held one more entry until 2026-07-31: GroupLevelBreakdown,
  // a lens referenced behind `window.X &&` whose defining module was
  // never ported. The guard meant it could not crash, so it sat here as
  // "known-dead" instead of being removed — which is how a dangling
  // reference gets to look like a feature flag. The branch is gone now.
  // Prefer that outcome to a new entry: anything parked here is a name
  // the checker has agreed to stop checking.
]);

const files = [];
for (const dir of [specDir, uiDir]) {
  for (const f of readdirSync(dir)) {
    if (/\.(jsx?|tsx?)$/.test(f)) files.push(join(dir, f));
  }
}
// Tests are excluded: they import what they exercise rather than reading it
// off the global scope, so scanning them would add references with no
// matching definition.
for (const f of readdirSync(dataDir)) {
  if (/\.(jsx?|tsx?)$/.test(f) && !/\.test\.[jt]sx?$/.test(f)) {
    files.push(join(dataDir, f));
  }
}
files.push(join(root, "src/v2/main.jsx"));
files.push(join(root, "src/v2/spec-index.js"));

const defined = new Set();
const referenced = new Map(); // name -> [file:line]
// name -> the set of root-relative files that assign it. A Set rather than
// a single owner because multi-writer globals are a real pattern here, not
// a bug: `WORLD_FEED_QS` is created by world-feed-data.js and appended to
// by world-catalogs.js and world-subtopics.js, then replaced wholesale by
// data/live.ts in live mode.
//
// It was a single "first assignment wins" map until 2026-08-03, and that
// mis-attributed exactly this case — readdir order made world-catalogs.js
// the owner, so world-feed-data.js's five reads of the global IT creates
// were counted as coupling to a file that only appends to it. Rule 4 asks
// "does this file assign the name?", which is the question that has an
// answer when several files do.
const definedBy = new Map();

const DEFINE_RES = [
  /(?:globalThis|window)\.([A-Za-z_$][\w$]*)\s*=[^=]/g,
  /Object\.assign\(\s*(?:globalThis|window)\s*,\s*\{([^}]*)\}/g,
];
const REF_RE = /(?:globalThis|window)\.([A-Za-z_$][\w$]*)/g;
// <Foo> / <Foo.Bar> / <Foo /> — capitalised leading segment only, which is
// how JSX distinguishes a component from an html element.
//
// The leading group excludes an identifier character, `)`, `]` or `.`
// before the `<`, so TypeScript generics (Array<Foo>, useState<Bar>,
// Map<K,V>) are not mistaken for tags. Only applied to files that can
// contain JSX at all — a .ts file has no tags, only generics.
const JSX_RE = /(?:^|[^\w$)\].])<([A-Z][\w$]*)\b/g;
// `h(Foo, …)` — the same reference as `<Foo …>`, written through a
// createElement alias. Found by converting primitives.jsx (D39):
// daily-split.jsx renders `h(Sheet, {…})`, which rule 3 could not see
// because it is not a tag and rule 1 could not see because it is not
// `window.X`. Only `no-undef` was watching it, and no-undef counts
// nothing.
//
// That is a hole in the ratchet as well as in the checker: a new bare
// reference written this way would not have moved the number. Capitalised
// first argument only, exactly like JSX — a lowercase `h(x)` is an
// ordinary call, and `h` itself is a local number in five other files
// (never called, so it cannot match). Same `local` treatment as a tag:
// an imported or locally declared component is not a global reference.
const CREATE_EL_RE = /(?:^|[^\w$.])h\(\s*([A-Z][\w$]*)/g;

// Comments must not count as definitions or references: a commented-out
// `window.Foo = …` would otherwise satisfy a real dangling reference, and a
// `<Foo/>` inside a doc comment would raise a phantom one.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

for (const file of files) {
  const src = stripComments(readFileSync(file, "utf8"));
  const rel = file.slice(root.length + 1);
  const own = (name) => {
    defined.add(name);
    if (!definedBy.has(name)) definedBy.set(name, new Set());
    definedBy.get(name).add(rel);
  };
  for (const re of DEFINE_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (re === DEFINE_RES[1]) {
        // Object.assign(globalThis, { A, B: x }) — take the keys.
        for (const part of m[1].split(",")) {
          const key = part.split(":")[0].trim();
          if (/^[A-Za-z_$][\w$]*$/.test(key)) own(key);
        }
      } else {
        own(m[1]);
      }
    }
  }
  // Names this file defines locally — a component declared and used in the
  // same file resolves lexically and is not a global reference at all.
  // Covers function/class/const declarations, imports, and destructured
  // locals (`const { Card, Row } = window.PRIMS`).
  const localNames = new Set();
  for (const re of [
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Z][\w$]*)/g,
    /(?:^|\n)\s*(?:export\s+)?class\s+([A-Z][\w$]*)/g,
    /(?:const|let|var)\s+([A-Z][\w$]*)\s*[=:]/g,
    /import\s+(?:\*\s+as\s+)?([A-Z][\w$]*)/g,
    /import\s*\{([^}]*)\}/g,
    /(?:const|let|var)\s*\{([^}]*)\}\s*=/g,
    // The whole declarator list, because the third pattern above only sees
    // the FIRST one: `const st = this.state, h = React.createElement, F =
    // React.Fragment;` declares F locally, and without this line F reads as
    // an undefined global. Found by the h(Foo, …) rule, which is what first
    // made daily-split.jsx's `h(F, …)` visible at all.
    /(?:const|let|var)\s+([^;\n]+)/g,
  ]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      for (const part of m[1].split(",")) {
        // Initialiser first, then any `key: alias` rename — in that order,
        // so `F = React.Fragment` yields F rather than the tail of its
        // value, and `{ Card: C }` still yields C.
        const key = part.split("=")[0].split(":").pop().trim().replace(/^\.\.\./, "");
        if (/^[A-Za-z_$][\w$]*$/.test(key)) localNames.add(key);
      }
    }
  }

  const canHaveJsx = /\.(jsx|tsx)$/.test(file);
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const at = `${file.slice(root.length + 1)}:${i + 1}`;
    // `local` applies to JSX tags only. An explicit `window.X` is a global
    // reference whatever else the file declares — suppressing it because a
    // same-named local exists would silently stop checking it.
    const note = (name, { local } = {}) => {
      if (RUNTIME_ALLOWLIST.has(name)) return;
      if (local && localNames.has(name)) return;
      if (!referenced.has(name)) referenced.set(name, []);
      referenced.get(name).push(at);
    };
    REF_RE.lastIndex = 0;
    let m;
    while ((m = REF_RE.exec(line))) note(m[1]);
    // A capitalised JSX tag resolves through the shared global scope at
    // render time, exactly like window.X — and renaming a component while
    // missing one call site was caught by NOTHING before this rule: the
    // checker only matched window.X, and eslint's no-undef is off for
    // these files.
    if (canHaveJsx) {
      JSX_RE.lastIndex = 0;
      while ((m = JSX_RE.exec(line))) note(m[1], { local: true });
    }
    // Not gated on canHaveJsx: a .js module can call createElement too, and
    // there are no generics there to confuse it with.
    CREATE_EL_RE.lastIndex = 0;
    while ((m = CREATE_EL_RE.exec(line))) note(m[1], { local: true });
  });
}


export function collectSpecGlobals() {
  return { defined, definedBy, referenced, files, specDir, root, RUNTIME_ALLOWLIST };
}
