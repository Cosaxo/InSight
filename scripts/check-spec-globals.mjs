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
//      (its globals silently vanish from the bundle);
//   3. a capitalised JSX tag — <Foo/> — that nothing defines. This is
//      the spec layer's DOMINANT cross-module reference style and was
//      invisible to both this script (which only matched window.X) and
//      eslint (no-undef was off for these files). It found a live
//      ReferenceError on the Mirror tab the day it was added.
//
// The scanning itself lives in ./spec-globals.mjs, shared with
// eslint.config.js so no-undef can be ON for the spec layer.
//
// Run: node scripts/check-spec-globals.mjs   (wired into CI's lint job)

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { collectSpecGlobals } from "./spec-globals.mjs";

const { defined, referenced, files, specDir, root } = collectSpecGlobals();

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
