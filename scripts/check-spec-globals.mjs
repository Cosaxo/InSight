#!/usr/bin/env node
// check-spec-globals.mjs — static safety net for the spec layer's
// global-scope module system.
//
// The ported spec modules (src/v2/spec) communicate by assigning to
// globalThis/window and looking names up at render time; the import
// web in spec-index.js is order-semantic and there is no compiler to
// notice a name that nothing defines anymore. This script closes the
// failure modes hand-edits keep re-opening:
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
// Rules 1-3 keep the convention SURVIVABLE. Rule 4 is the one that gets
// the tree out of it — see "the migration ratchet" below.
//
// The scanning itself lives in ./spec-globals.mjs, shared with
// eslint.config.js so no-undef can be ON for the spec layer.
//
// Run: node scripts/check-spec-globals.mjs   (wired into CI's lint job)

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { collectSpecGlobals } from "./spec-globals.mjs";

const { defined, definedBy, referenced, files, specDir, root } = collectSpecGlobals();

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

// ── 4. the migration ratchet ────────────────────────────────────
//
// WHAT THIS COUNTS. Every site where a file reads a name that ANOTHER
// file in the scanned set assigns to global scope — `window.LIVE`,
// `<Chip/>`, `h(Chip, …)`, `globalThis.DUELS`. That is the coupling
// itself, not a proxy for it. It opened at 799 sites across 57 files;
// the baseline below is the current line, and src/v2/README.md quotes
// the live total (checked at the foot of this script).
//
// WHY IT EXISTS. src/v2/README.md has carried a "Migration path
// (Phase 2+)" section since the port landed, saying modules move off the
// global bridge "incrementally". Nothing measured whether that was
// happening, so the honest answer after 38 decision records is that it
// was not. A migration with no meter does not run; it gets described.
//
// Rules 1-3 above make the convention survivable and therefore make it
// comfortable — each one absorbs a class of bug that would otherwise
// have argued for leaving. This rule is the counterweight: the number
// may not go up, so new code cannot add coupling, and every module
// converted to real ESM shows up as a drop in a diff.
//
// HOW A CONVERSION LOWERS IT, mechanically — no bookkeeping required.
// The scanner already suppresses a JSX reference when the file declares
// the name locally, and an `import { Chip }` is a local declaration. So
// converting a provider to a real module and its consumer to a real
// import takes that consumer's sites to zero on their own. The
// suggested order is providers with no dependencies of their own —
// primitives.jsx went first (D39, 799 → 755); sample-data.js,
// daily-questions.js, world-catalogs.js and follows.js are next, and
// src/v2/README.md carries the per-file consumer counts.
//
// PER FILE, NOT A TOTAL, for the reason check-a11y.mjs is: a total lets
// a conversion in one file pay for new coupling in another and reports
// green.
//
// Deliberately NOT a hard error at some target number. There is no
// deadline here and inventing one would be the kind of figure this repo
// keeps having to correct. The contract is only the direction.
const COUPLING_BASELINE = {
  "src/v2/main.jsx": 1,
  "src/v2/spec/app-shell.jsx": 51,
  "src/v2/spec/archetype-data.js": 2,
  "src/v2/spec/city-overlay.jsx": 2,
  "src/v2/spec/compare-breakdown.jsx": 4,
  "src/v2/spec/daily-questions.js": 3,
  "src/v2/spec/daily-split.jsx": 85,
  "src/v2/spec/demographics.jsx": 3,
  "src/v2/spec/duels-data.js": 6,
  "src/v2/spec/duo-daily.jsx": 13,
  "src/v2/spec/feed-read.js": 2,
  "src/v2/spec/group-daily.jsx": 6,
  "src/v2/spec/group-mirror.jsx": 17,
  "src/v2/spec/group-role-map.jsx": 5,
  "src/v2/spec/learn-bits.jsx": 1,
  "src/v2/spec/learn-data.js": 1,
  "src/v2/spec/learn-feed.js": 1,
  "src/v2/spec/learn-progress.js": 8,
  "src/v2/spec/learn-social.js": 6,
  "src/v2/spec/lens-cards.jsx": 5,
  "src/v2/spec/lens-defs.js": 2,
  "src/v2/spec/logic-test.jsx": 1,
  "src/v2/spec/map-anchors.js": 2,
  "src/v2/spec/map-bottom-card.jsx": 9,
  "src/v2/spec/map-branches.js": 3,
  "src/v2/spec/map-learn-card.jsx": 5,
  "src/v2/spec/map-people.jsx": 8,
  "src/v2/spec/map-tab.jsx": 34,
  "src/v2/spec/mirror-answers.jsx": 3,
  "src/v2/spec/mirror-field-pops.jsx": 33,
  "src/v2/spec/mirror-field.jsx": 4,
  "src/v2/spec/mirror-tab.jsx": 17,
  "src/v2/spec/passive-meter.jsx": 14,
  "src/v2/spec/passive-progress.js": 5,
  "src/v2/spec/person-mindmap.jsx": 11,
  "src/v2/spec/person-overlay.jsx": 14,
  "src/v2/spec/place-stats.jsx": 3,
  "src/v2/spec/profile-general.jsx": 25,
  "src/v2/spec/profile-overlay.jsx": 30,
  "src/v2/spec/profile-test-viz.jsx": 3,
  "src/v2/spec/relmap-lenses.jsx": 1,
  "src/v2/spec/relmap-panels.jsx": 3,
  "src/v2/spec/relmap.jsx": 4,
  "src/v2/spec/result-card.jsx": 31,
  "src/v2/spec/search-overlay.jsx": 11,
  "src/v2/spec/segment-explorer.jsx": 1,
  "src/v2/spec/suggestions.jsx": 3,
  "src/v2/spec/test-definitions.js": 7,
  "src/v2/spec/test-feed-data.js": 2,
  "src/v2/spec/test-overlay.jsx": 30,
  "src/v2/spec/test-viz.jsx": 2,
  "src/v2/spec/type-marks.jsx": 5,
  "src/v2/spec/vote-cuts.js": 1,
  "src/v2/spec/world-feed-data.js": 9,
  "src/v2/spec/world-feed.jsx": 165,
  "src/v2/spec/world-subtopics.js": 3,
};

const coupling = {};
for (const [name, sites] of referenced) {
  const owner = definedBy.get(name);
  // No owner means the name is not defined anywhere in the scanned set —
  // rule 1 has already reported it, and counting it here would double the
  // report and inflate the meter with names that are bugs, not coupling.
  if (!owner) continue;
  for (const site of sites) {
    const file = site.slice(0, site.lastIndexOf(":"));
    if (file === owner) continue; // a file reading its own global is not coupling
    coupling[file] = (coupling[file] || 0) + 1;
  }
}

const couplingTotal = Object.values(coupling).reduce((a, b) => a + b, 0);
const couplingBase = Object.values(COUPLING_BASELINE).reduce((a, b) => a + b, 0);
const added = [];
const removed = [];
for (const file of new Set([...Object.keys(COUPLING_BASELINE), ...Object.keys(coupling)])) {
  const was = COUPLING_BASELINE[file] || 0;
  const now = coupling[file] || 0;
  if (now > was) added.push({ file, was, now });
  else if (now < was) removed.push({ file, was, now });
}

const nextLiteral = () =>
  "const COUPLING_BASELINE = {\n"
  + Object.keys(coupling).sort().map((f) => `  ${JSON.stringify(f)}: ${coupling[f]},`).join("\n")
  + "\n};";

if (added.length) {
  failed = true;
  console.error("\n✗ these files gained shared-global coupling:\n");
  for (const a of added) console.error(`    ${a.file}: ${a.was} → ${a.now}`);
  console.error(
    "\n  New cross-module references go through ESM imports, not global scope.\n"
    + "  If the name you need is not exported yet, export it and leave the\n"
    + "  `globalThis.X = X` line beneath for the consumers that have not moved.\n"
    + "  Do NOT raise the baseline to make this pass — it only moves down.",
  );
}

if (!added.length && removed.length) {
  // Same shape as check-a11y's: a pass here would leave the old number
  // behind, and the next regression would fit under it silently.
  failed = true;
  console.error("\n✓ coupling removed — now lower the baseline in this script.\n");
  for (const r of removed) console.error(`    ${r.file}: ${r.was} → ${r.now}`);
  console.error(`\n  total ${couplingBase} → ${couplingTotal}. Replace COUPLING_BASELINE with:\n`);
  console.error(nextLiteral());
}

// The figure src/v2/README.md quotes for this ratchet, held equal to the
// tree here rather than by intention — same argument as check-a11y.mjs's
// figures block, and for the same repeatedly-demonstrated reason. It lives
// in THIS script because this script owns the number; recomputing it in
// check-figures.mjs would be a second implementation of the count, which is
// the drift it exists to prevent.
if (!failed) {
  const SPEC_README = "src/v2/README.md";
  const prose = readFileSync(join(root, SPEC_README), "utf8");
  const claim = prose.match(/The count today is \*\*(\d+) across (\d+)\s*\n?files\*\*/);
  if (!claim) {
    failed = true;
    console.error(
      `\n✗ ${SPEC_README}: could not find the "The count today is **N across M files**"\n`
      + "  sentence. If the figure is no longer quoted there, delete this block\n"
      + "  with it — a gate reading for a sentence nobody writes cannot be satisfied.",
    );
  } else if (Number(claim[1]) !== couplingTotal || Number(claim[2]) !== Object.keys(coupling).length) {
    failed = true;
    console.error(
      `\n✗ ${SPEC_README} states ${claim[1]} across ${claim[2]} files; the tree has `
      + `${couplingTotal} across ${Object.keys(coupling).length}.\n`
      + `  Correct the sentence to: "The count today is **${couplingTotal} across `
      + `${Object.keys(coupling).length} files**".\n`
      + "  Not a coupling regression — the ratchet itself is fine.",
    );
  }
}

if (failed) {
  console.error("\nspec-globals check FAILED (see docs at the top of this script).");
  process.exit(1);
}
console.log(
  `spec-globals check OK — ${defined.size} globals defined, ${referenced.size} names referenced, `
  + `${files.length} files scanned.`,
);
console.log(
  `  shared-global coupling: ${couplingTotal} cross-module references across `
  + `${Object.keys(coupling).length} files (baseline ${couplingBase} — this only moves down).`,
);
