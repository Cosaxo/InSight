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
//   5. the mirror of rule 1: a publication nothing reads. That is what a
//      half-finished conversion leaves behind, and 17 of them had piled
//      up by D137 because no rule was asking and rule 4 counts reads.
//   8. an import binding a spec module never uses. `no-unused-vars` is
//      off for this layer and rightly so, but its reason is about
//      DECLARATIONS: an import cannot be a publication. 33 dead React
//      imports and six named bindings were behind that off.
//   7. a spec module whose components nothing can REACH — neither
//      exported nor published, so no import and no JSX tag can resolve
//      them. Rule 5 asks whether a publication has a reader; this asks
//      whether there is a publication at all. Two files sat inert from
//      the port until it was added.
//
// Rules 1-3 keep the convention SURVIVABLE and rule 5 keeps it HONEST —
// what is on the bridge is what is still crossing it. Rule 4 is the one
// that gets the tree out of it — see "the migration ratchet" below.
//
// The scanning itself lives in ./spec-globals.mjs, shared with
// eslint.config.js so no-undef can be ON for the spec layer.
//
// Run: node scripts/check-spec-globals.mjs   (wired into CI's lint job)

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { collectSpecGlobals, stripComments } from "./spec-globals.mjs";

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
//
// stripComments FIRST, for the reason spec-globals.mjs applies it to every
// other file it scans: this is a substring test, so a commented-out
// `import './spec/sheet-escape.js';` satisfied it. Five modules in the v17
// block are pure side effects — sheet-escape, sheet-drag, scroll-memory,
// edge-fade, subnav-thumb — so that line is the WHOLE of their wiring. They
// assign no global, so rule 1 cannot see them; rule 4's count is unaffected;
// eslint and tsc see nothing. Escape would stop closing bottom sheets on a
// device with the tree green.
//
// …and the question is whether the file LOADS, not whether one particular
// file names it. A module the ESM graph already pulls in — imported by
// another spec file, the way world-feed.jsx imports world-feed-math.js — is
// loaded whatever spec-index.js says, and converted modules are increasingly
// this shape (D39). Accepting that is what lets the comment trick go: before
// stripComments, the only way to keep such a file out of the entry chunk was
// to name it in a COMMENT and rely on the substring match, which is a
// reference that loads nothing and would have gone on passing if the real
// import were deleted too.
const indexSrc = stripComments(readFileSync(join(root, "src/v2/spec-index.js"), "utf8"));
const specFiles = readdirSync(specDir).filter((f) => /\.(jsx?|tsx?)$/.test(f));
const importedBySibling = new Set();
for (const f of specFiles) {
  const src = stripComments(readFileSync(join(specDir, f), "utf8"));
  for (const m of src.matchAll(/from\s+['"]\.\/([^'"]+)['"]|import\s+['"]\.\/([^'"]+)['"]/g)) {
    importedBySibling.add(m[1] || m[2]);
  }
}
for (const f of specFiles) {
  if (indexSrc.includes(`./spec/${f}`) || importedBySibling.has(f)) continue;
  failed = true;
  console.error(
    `✗ src/v2/spec/${f} is loaded by nothing — neither spec-index.js nor an`
    + " import from another spec file. Its globals never load.",
  );
}

// ── 5. publications nothing reads ───────────────────────────────
//
// Rule 1 catches a reference whose assignment went away. This is the
// mirror: an assignment whose references went away. It is the residue a
// CONVERSION leaves — D39 says "convert on touch", and the honest shape of
// that is to export the name and leave `globalThis.X = X` beneath for the
// consumers that have not moved yet, so the two live side by side until the
// last consumer does move. Nothing then went back for the line.
//
// D137 swept 17 of them: seven ui/Live* panels every consumer already
// imported, MirrorLensRow under a comment promising sites that had all
// already gone, ELEMENTS_CATALOG whose siblings never published at all, and
// six components published out of the file that was their only user. None
// could break — a name nobody reads cannot render wrong — which is exactly
// why they sat: no gate here was asking, and rule 4 does not count them
// (it counts READS, and there were none).
//
// They are not free. Each one is a claim that the global bridge is load-
// bearing for that name, so it reads as coupling when someone plans a
// conversion, it keeps the value alive for the bundler, and — the reason
// this is a rule and not a cleanup — it is indistinguishable by eye from
// the publication that IS still carrying a consumer.
//
// THE ESCAPE HATCH, in the check-purge-listeners shape: a name published
// for a reader this scanner cannot see (the native shell, index.html, a
// devtools handle) goes below WITH its reason. A stale entry fails too —
// listing a name that is read in-tree, or one nothing defines any more —
// so the list cannot outlive its subjects. It is empty today, and that is
// the preferred state: an entry here is a name this rule stops checking.
const PUBLISHED_FOR_OUTSIDE = {};

for (const [name, why] of Object.entries(PUBLISHED_FOR_OUTSIDE)) {
  if (!defined.has(name)) {
    failed = true;
    console.error(
      `✗ PUBLISHED_FOR_OUTSIDE lists ${name} ("${why}") but nothing assigns it`
      + " any more — drop the entry with the publication.",
    );
  } else if (referenced.has(name)) {
    failed = true;
    console.error(
      `✗ PUBLISHED_FOR_OUTSIDE lists ${name} as read only from outside the`
      + " scanned set, but it is read inside it — drop the entry, rule 5"
      + " covers it.",
    );
  }
}

// RULE 5 ASKS A BROADER QUESTION THAN RULE 1, and it has to.
//
// `referenced` holds `window.X` reads and JSX tags — the two shapes rule 1
// and rule 3 need. But the convention's third shape is a BARE CROSS-MODULE
// CALL (`mfLayout(…)` in a file that never imported it, resolving through
// global scope at render time), and that is a real consumer this scanner
// cannot see. Asking rule 5 "is it in `referenced`?" would therefore report
// live wiring as dead — 138 findings against the 117 that are actually
// unmentioned, measured when this was written.
//
// So rule 5 asks the conservative question instead: **does the name appear
// anywhere at all outside the file that publishes it?** A word-boundary
// match, over every scanned file, including strings — deliberately
// over-generous, because the cost of a false positive here is deleting live
// wiring and the cost of a false negative is one line of residue.
const mentionedElsewhere = new Set();
{
  // Over the whole of src/, not just the scanned set. `files` is spec + ui +
  // data, which leaves out src/v2/test — and a mount test reaching a global
  // (`openVia` does, through `window[name]`) is a consumer like any other.
  // Eight names separated the two sets when this was written.
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const at = join(dir, e.name);
    if (e.isDirectory()) return walk(at);
    return /\.(js|jsx|ts|tsx)$/.test(e.name) ? [at] : [];
  });
  const sources = walk(join(root, "src")).map((f) => [f.slice(root.length + 1), readFileSync(f, "utf8")]);
  for (const name of defined) {
    const owners = definedBy.get(name) || new Set();
    const word = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    for (const [rel, src] of sources) {
      if (owners.has(rel)) continue;
      if (word.test(src)) { mentionedElsewhere.add(name); break; }
    }
  }
}

for (const name of [...defined].sort()) {
  if (mentionedElsewhere.has(name) || PUBLISHED_FOR_OUTSIDE[name]) continue;
  failed = true;
  const where = [...(definedBy.get(name) || [])].join(", ");
  console.error(
    `✗ window.${name} is published but read by nothing (${where}).`
    + "\n    If a consumer imports it, delete the assignment — the export is"
    + "\n    the whole wiring. If it is used only inside its own file, delete"
    + "\n    the assignment too; the declaration already resolves lexically."
    + "\n    If it is dead, delete the code. If something outside this scanner"
    + "\n    reads it, add it to PUBLISHED_FOR_OUTSIDE with the reason.",
  );
}

// ── 6. a publication whose consumers all import (D280) ──────────
//
// THE ONE RULE 5 CANNOT ASK, and the gap that shipped a D1 violation.
//
// Rule 5 is deliberately over-generous: it asks whether the name appears
// ANYWHERE outside its publisher, because the convention's third shape is a
// bare cross-module call this scanner cannot see, and reporting live wiring
// as dead is the expensive mistake. That generosity has a blind spot with a
// name: a publisher writing `window.X` while every consumer has converted to
// `import { X }`. The name is mentioned all over the tree, so rule 5 is
// satisfied — and the publication reaches nobody, because an ESM binding
// cannot be reassigned from outside its own module.
//
// That is not a hypothetical. D249 converted `world-feed.jsx`'s read of
// `window.TEST_FEED_QS` into a static import of the DEMO array while
// `live.ts` went on publishing the LIVE pool to the window. Rule 5 saw the
// name in four files and said nothing; the app served hash-invented vote
// counts on a live device for a build. Every other gate was green too,
// because both halves type-check perfectly and neither throws.
//
// The question this rule asks is narrow enough to be safe, and the fourth
// clause is what makes it so: is the name published to global scope,
// EXPORTED BY A DIFFERENT FILE, imported from that file somewhere, and read
// through `window.`/`globalThis.` by nobody outside the publisher?
//
// All four together mean two different values are wired to two different
// sets of consumers under one name, which is the whole of the defect. Drop
// the third clause and the rule also reports the harmless case — a module
// that exports a name AND publishes its own copy of it, where the two are
// the same binding and the publication is only residue. Nine of those are
// in the tree today; they are D137's class and rule 5's business, not this
// one's, and folding them in here would bury the finding that matters
// under eight that do not.
//
// Any one window reader anywhere makes this silent, and so does a name
// nothing imports — that one is rule 5's.
//
// The fix, when it fires, is not to put the bridge read back: it is to give
// the live half somewhere to land, which is what data/testFeed.ts is.
{
  const IMPORT_RE = /import\s*(?:type\s*)?\{([^}]*)\}\s*from/g;
  const EXPORT_RE = /export\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g;
  const importedNames = new Set();
  const exportedBy = new Map();
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const at = join(dir, e.name);
    if (e.isDirectory()) return walk(at);
    return /\.(js|jsx|ts|tsx)$/.test(e.name) ? [at] : [];
  });
  for (const f of walk(join(root, "src"))) {
    const src = stripComments(readFileSync(f, "utf8"));
    for (const m of src.matchAll(IMPORT_RE)) {
      for (const spec of m[1].split(",")) {
        // `X`, `X as Y`, `type X` — the imported name is the first word.
        const first = spec.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (first) importedNames.add(first);
      }
    }
    for (const m of src.matchAll(EXPORT_RE)) {
      const rel = f.slice(root.length + 1);
      if (!exportedBy.has(m[1])) exportedBy.set(m[1], new Set());
      exportedBy.get(m[1]).add(rel);
    }
  }
  for (const name of [...defined].sort()) {
    if (!importedNames.has(name) || PUBLISHED_FOR_OUTSIDE[name]) continue;
    const owners = definedBy.get(name) || new Set();
    // The clause that separates the defect from the residue: somebody OTHER
    // than the publisher exports this name, so the import and the
    // publication cannot be the same binding.
    const exporters = [...(exportedBy.get(name) || [])].filter((f) => !owners.has(f));
    if (!exporters.length) continue;
    const readers = (referenced.get(name) || [])
      .filter((site) => !owners.has(String(site).split(":")[0]));
    if (readers.length) continue;
    failed = true;
    console.error(
      `✗ window.${name} is published by ${[...owners].join(", ")} and exported`
      + ` by ${exporters.join(", ")}, and every`
      + "\n    consumer reaches it by ESM import instead — so the publication"
      + "\n    lands on a name nothing reads and the importers see whatever"
      + "\n    their own module last assigned. An imported binding cannot be"
      + "\n    reassigned from outside its module (D280). Either give the"
      + "\n    publisher's value a named home the importers call, or delete"
      + "\n    the assignment if the export is already the whole wiring.",
    );
  }
}

// ── 7. a spec module nothing can reach ──────────────────────────
//
// THE RULE BEFORE RULE 5. Rule 5 asks whether a published name has a
// reader. This asks the question underneath it: is the module on the
// bridge at all? A spec module has exactly two ways out — an `export`,
// or an assignment to `window`/`globalThis` that a bare JSX tag can
// resolve at render time. A file that does neither and still defines
// components is a file no screen can render, and every other gate is
// green on it: it parses, it lints, tsc never sees it, spec-index.js
// imports it so rule 2 is satisfied, and it publishes nothing so rules
// 1, 3, 5 and 6 have no name to hold.
//
// It was not hypothetical. `spec/test-viz.jsx` and
// `spec/profile-test-viz.jsx` came across in the port and were never
// wired — five components, 325 lines, unreachable from the first
// commit. The cost was not bytes (rolldown tree-shakes them; measured
// at 0 KB of the eager graph either way) but belief: VISION-2026-08-24
// §6 row 3 recorded a colour change to one of them as BUILT, applied at
// D287 against a screen that does not exist. Both files are gone; the
// app's saved-result surface is `spec/result-card.jsx` with
// `spec/result-rose.jsx`'s rose.
//
// SCOPE, narrow on purpose. Only files that DEFINE A COMPONENT — a
// capitalised function or arrow binding — are candidates. The spec layer
// is full of legitimate side-effect modules that export nothing and
// publish nothing because their whole job is a listener attached at
// import time (`sheet-drag.js`, `scroll-memory.js`, `edge-fade.js`,
// `sheet-escape.js`, `subnav-thumb.js` — five of them today). Those
// define no components, so they are not candidates, and the rule needs
// no allowlist to leave them alone.
//
// If this fires, the answer is almost never a new exemption. See
// RUNTIME_ALLOWLIST's own note in spec-globals.mjs: a name parked as
// known-dead is how dead code starts looking like a feature flag.
{
  const COMPONENT_RE =
    /^(?:function\s+([A-Z][\w$]*)|const\s+([A-Z][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/gm;
  for (const file of readdirSync(specDir).sort()) {
    if (!/\.(js|jsx)$/.test(file)) continue;
    const src = stripComments(readFileSync(join(specDir, file), "utf8"));
    if (/^\s*export\s/m.test(src)) continue;
    if (/(?:globalThis|window)\.[A-Za-z_$][\w$]*\s*=[^=]/.test(src)) continue;
    if (/Object\.assign\(\s*(?:globalThis|window)\s*,/.test(src)) continue;
    if (/\(\s*(?:globalThis|window)\s+as\s+[^)]*\)\.[A-Za-z_$][\w$]*\s*=[^=]/.test(src)) continue;
    COMPONENT_RE.lastIndex = 0;
    const components = [...src.matchAll(COMPONENT_RE)].map((m) => m[1] || m[2]);
    if (!components.length) continue;
    failed = true;
    console.error(
      `✗ src/v2/spec/${file} defines ${components.join(", ")} and neither exports`
      + "\n    nor publishes anything, so nothing can render them: an import has no"
      + "\n    binding to take and a JSX tag has no global to resolve. Either wire it"
      + "\n    (export it, or publish it the way its neighbours do) or delete it."
      + "\n    A side-effect module is exempt by defining no component, not by an"
      + "\n    allowlist entry.",
    );
  }
}

// ── 8. an import binding nothing in the file uses ───────────────
//
// THE HALF `no-unused-vars` CANNOT DO. eslint.config.js turns that rule OFF
// for the spec layer, and the reason it gives is correct: a module here
// "exports" by defining a global the linter never sees consumed, so every
// top-level declaration reads as unused. But that argument is about
// DECLARATIONS. An import binding cannot be a publication — it is a name
// this file asked another module for — so "declared and never mentioned"
// is unambiguous for imports and only for imports.
//
// The blind spot was real: 33 files carried `import React from 'react'`
// with no `React.` anywhere (the automatic JSX runtime has needed no such
// import since the port), and six named bindings across two files were
// imported and never referenced. Nothing could see any of it — tsc does not
// read .jsx here, eslint was told not to, and rules 1-3 above look for
// references, not for their absence.
//
// THE FIX IS NOT ALWAYS DELETION, which is why this reports the binding and
// not the line. spec-index.js's order is semantic, and a file's own import
// can pull a module in EARLIER than spec-index reaches it — daily-split.jsx
// does exactly that for test-definitions.js and passive-progress.js, nine
// entries ahead. There the answer is a side-effect import: drop the binding,
// keep the edge.
{
  // The comma after the default binding is OPTIONAL, and leaving it required
  // was a hole in this rule's first version: `import PLACES from '…'` — a
  // bare default with no clause after it — matched the pattern with both
  // groups empty, so the rule read the line, found no names, and passed.
  // Found by an adversarial re-check of the rule itself, on a live instance.
  const IMPORT_RE =
    /^import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"][^'"]+['"];?$/gm;
  for (const file of readdirSync(specDir).sort()) {
    if (!/\.(js|jsx)$/.test(file)) continue;
    const src = stripComments(readFileSync(join(specDir, file), "utf8"));
    IMPORT_RE.lastIndex = 0;
    for (const m of src.matchAll(IMPORT_RE)) {
      const names = [];
      if (m[1]) names.push(m[1]);
      if (m[2]) {
        for (const part of m[2].split(",")) {
          const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
          if (name) names.push(name);
        }
      }
      const body = src.replace(m[0], "");
      for (const name of names) {
        if (new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(body)) continue;
        failed = true;
        console.error(
          `✗ src/v2/spec/${file} imports ${name} and never uses it.`
          + "\n    Delete the binding. If the IMPORT is what pulls that module in"
          + "\n    ahead of spec-index.js's own line for it, keep the edge as a"
          + "\n    side-effect import (`import './x.js';`) — the order is semantic.",
        );
      }
    }
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
  "src/v2/spec/app-shell.jsx": 14,
  "src/v2/spec/daily-split.jsx": 6,
  "src/v2/spec/map-tab.jsx": 2,
  "src/v2/spec/mirror-field-pops.jsx": 1,
  "src/v2/spec/search-overlay.jsx": 3,
  "src/v2/spec/segment-explorer.jsx": 1,
  // test-definitions.js is the one reader of `window.LIVE` left after D354,
  // and its four sites stay on purpose: the module also loads under plain
  // node (scripts/report-lib.mjs), where data/live.ts cannot follow it.
  "src/v2/spec/test-definitions.js": 4,
  "src/v2/spec/world-feed.jsx": 1,
};

const coupling = {};
for (const [name, sites] of referenced) {
  const assigners = definedBy.get(name);
  // Not assigned anywhere in the scanned set means the name is not coupling
  // but a bug — rule 1 has already reported it, and counting it here would
  // double the report and inflate the meter with dangling references.
  if (!assigners) continue;
  for (const site of sites) {
    const file = site.slice(0, site.lastIndexOf(":"));
    // A file reading a global it assigns itself is not coupled to anyone.
    // `assigners` is a SET because several files legitimately write the same
    // name (WORLD_FEED_QS: created by one, appended by two, replaced by
    // live.ts) — with a single owner, the writers that were not picked had
    // their own reads counted as coupling to a file they do not depend on.
    if (assigners.has(file)) continue;
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
