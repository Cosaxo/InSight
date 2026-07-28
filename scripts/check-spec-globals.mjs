#!/usr/bin/env node
// check-spec-globals.mjs — static safety net for the spec layer's
// global-scope module system.
//
// The ported spec modules (src/v2/spec) communicate by assigning to
// globalThis/window and looking names up at render time; the import
// web in spec-index.js is order-semantic and there is no compiler to
// notice a name that nothing defines anymore. This script closes the
// two failure modes hand-edits keep re-opening:
//
//   1. a `window.Foo` / `globalThis.Foo` reference whose assignment
//      was renamed or deleted (renders as a silent blank at runtime);
//   2. a file in src/v2/spec that spec-index.js no longer imports
//      (its globals silently vanish from the bundle).
//
// Run: node scripts/check-spec-globals.mjs   (wired into CI's lint job)

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
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

for (const file of files) {
  const src = readFileSync(file, "utf8");
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
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    REF_RE.lastIndex = 0;
    let m;
    while ((m = REF_RE.exec(line))) {
      const name = m[1];
      if (RUNTIME_ALLOWLIST.has(name)) continue;
      if (!referenced.has(name)) referenced.set(name, []);
      referenced.get(name).push(`${file.slice(root.length + 1)}:${i + 1}`);
    }
  });
}

let failed = false;

// 1. dangling references
for (const [name, sites] of [...referenced].sort()) {
  if (defined.has(name)) continue;
  failed = true;
  console.error(`✗ window.${name} is referenced but never assigned:`);
  for (const s of sites.slice(0, 4)) console.error(`    ${s}`);
  if (sites.length > 4) console.error(`    …and ${sites.length - 4} more`);
}

// 2. spec files spec-index.js forgot
const indexSrc = readFileSync(join(root, "src/v2/spec-index.js"), "utf8");
for (const f of readdirSync(specDir)) {
  if (!/\.(jsx?|tsx?)$/.test(f)) continue;
  if (!indexSrc.includes(`./spec/${f}`)) {
    failed = true;
    console.error(`✗ src/v2/spec/${f} is not imported by spec-index.js — its globals never load`);
  }
}

if (failed) {
  console.error("\nspec-globals check FAILED (see docs at the top of this script).");
  process.exit(1);
}
console.log(`spec-globals check OK — ${defined.size} globals defined, ${referenced.size} names referenced, ${files.length} files scanned.`);
