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
  // Known-dead optional features: referenced behind typeof/truthiness
  // guards, defining module never ported from the prototype. The guard
  // hides the feature at runtime. Delete from here when either the
  // module is ported or the dead lens is removed.
  "GroupLevelBreakdown",
]);

const files = [];
for (const dir of [specDir, uiDir]) {
  for (const f of readdirSync(dir)) {
    if (/\.(jsx?|tsx?)$/.test(f)) files.push(join(dir, f));
  }
}
files.push(join(root, "src/v2/main.jsx"));
files.push(join(root, "src/v2/spec-index.js"));
files.push(join(root, "src/v2/data/live.ts"));

const defined = new Set();
const referenced = new Map(); // name -> [file:line]

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
  for (const re of DEFINE_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (re === DEFINE_RES[1]) {
        // Object.assign(globalThis, { A, B: x }) — take the keys.
        for (const part of m[1].split(",")) {
          const key = part.split(":")[0].trim();
          if (/^[A-Za-z_$][\w$]*$/.test(key)) defined.add(key);
        }
      } else {
        defined.add(m[1]);
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
  ]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      for (const part of m[1].split(",")) {
        const key = part.split(":").pop().trim().replace(/^\.\.\./, "");
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
  });
}


export function collectSpecGlobals() {
  return { defined, referenced, files, specDir, root, RUNTIME_ALLOWLIST };
}
