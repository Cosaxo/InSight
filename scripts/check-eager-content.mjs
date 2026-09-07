#!/usr/bin/env node
// check:eager-content — question content may not be in first paint.
//
// WHY THIS EXISTS. On 2026-09-05 the farm lane could not merge because
// `check:bundle`'s eager budget was full, and the reason it was full is
// that `src/v2/spec/daily-questions.js` — the archive that lane APPENDS TO
// EVERY DAY — was fetched before the app could paint. So writing a question
// made the app slower to open, and enough questions made a content lane
// unmergeable. The ceiling was raised twice while that was true; raising it
// again would have been the third time. The owner's words are the rule this
// script encodes: an iPhone should not download all the questions, the way
// YouTube does not download all the videos.
//
// WHAT IT CHECKS, and why it is a source walk rather than a bundle read.
// `check:bundle` reads dist/index.html, so it sees a content module only
// when the bundler gives it a chunk of its own. daily-split.jsx is inlined
// into the ENTRY chunk, and its static `import { DAILYQ }` held the archive
// in first paint even after the spec-index side-effect line was gone — a
// chunk-name check cannot see that edge. This walks STATIC imports from the
// real entry instead, which is the property itself: what the browser must
// fetch before it can paint. A `import()` is not an edge, which is the
// point — that is how a surface loads content when it is reached.
//
// THE ALLOWLIST IS A RATCHET, not an exemption. Every entry is a demo
// archive that is still eager because a first-paint surface still imports
// it statically. The list may only SHRINK: a module that stops being eager
// fails this gate too, asking for its line to come out. That is
// check:globals rule 4's shape, and it exists for the same reason — a
// baseline nobody is asked to lower is a baseline that never moves.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(root, "src/v2/main.jsx");

// Modules whose payload is question or demo CONTENT rather than code.
// A file lands here because shipping it costs bytes proportional to how
// much content exists, which is the thing that must never be a first-paint
// cost. Keep it explicit: a pattern over filenames would quietly adopt or
// miss files as the tree moves.
const CONTENT = new Set([
  "src/v2/spec/daily-questions.js",
  "src/v2/spec/world-feed-data.js",
  "src/v2/spec/duels-data.js",
  "src/v2/spec/sample-data.js",
  "src/v2/spec/pick-data.js",
  "src/v2/spec/learn-data.js",
  "src/v2/spec/test-feed-data.js",
  "src/v2/spec/archetype-data.js",
  "src/v2/spec/paths-data.js",
]);
// Any JSON seed under content/ is content by construction — the banks
// themselves. duel-questions.json rides duels-data.js today.
const CONTENT_DIR = "content/";

// Eager today, and only because a first-paint surface still imports it.
// Each line is a debt with a name. Removing the last one deletes this list.
const ALLOW = new Map([
  ["src/v2/spec/sample-data.js",
    "the demo crowd; scenes.js, map-anchors.js and relmap-lenses.jsx are all eager and import it"],
  ["src/v2/spec/duels-data.js",
    "group-daily.jsx is eager and imports it (and it pulls content/duel-questions.json with it)"],
  ["content/duel-questions.json",
    "rides duels-data.js above"],
  ["src/v2/spec/world-feed-data.js",
    "world-feed.jsx is eager; the feed lane's continuum twins live here, so this is the second lane behind the same wall"],
  ["src/v2/spec/test-feed-data.js",
    "vote-cuts.js and world-feed-report.js sit in its chunk and are reached from the eager feed"],
  ["src/v2/spec/archetype-data.js",
    "data/live.ts imports it for the archetype match (D253)"],
]);

const EXT = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".json"];
function resolveSpec(spec, from) {
  if (!spec.startsWith(".")) return null; // bare specifier: a package
  const base = resolve(dirname(from), spec);
  // Tried in the order a bundler would: the path as written, then each
  // extension, then an index file. `readFileSync` rather than a stat call
  // because a directory throws here, which is exactly the "keep looking"
  // signal — `./spec` must not resolve to the directory.
  for (const cand of [base, ...EXT.map((e) => base + e), ...EXT.map((e) => join(base, "index" + e))]) {
    try {
      const st = existsSync(cand) && readFileSync(cand);
      if (st !== false && st !== undefined) return cand;
    } catch { /* a directory: keep looking */ }
  }
  return null;
}

// STATIC edges only. `import(` is deliberately not matched — a dynamic
// import is exactly how a surface should reach its content.
//
// THE CLAUSE IS BOUNDED BY `[^;"']`, AND THAT IS THE WHOLE GATE. It was
// `[\s\S]*?`, which is lazy but not stopped by anything, so on
//
//     import "./spec/daily-questions.js";
//     import React from "react";
//
// the optional `… from ` group expanded ACROSS both statements to reach
// the second line's ` from `, swallowed the side-effect import and
// captured "react" instead. A bare `import "…"` was therefore invisible
// whenever any later import in the same file had a `from` — which
// `src/v2/main.jsx`, the entry this walk starts from, has always been.
// Measured: prepending that exact line to main.jsx left this gate
// printing OK with the module count unmoved, which is precisely the
// D382–D384 regression it exists to refuse.
//
// An import clause — `type { T }`, `* as ns`, `d, { x }`, a multi-line
// braced list — can contain a newline but never a quote or a semicolon,
// so those two characters are exactly the statement boundary. Verified
// identical to the old form on every other import shape in the tree.
const STATIC_RE = /(?:^|\n)\s*(?:import\s+(?:[^;"']*?\s+from\s+)?|export\s+(?:\*|\{[\s\S]*?\})\s+from\s+)["']([^"']+)["']/g;

const seen = new Set();
const parent = new Map();
const stack = [ENTRY];
seen.add(ENTRY);
while (stack.length) {
  const file = stack.pop();
  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  if (file.endsWith(".json")) continue;
  for (const m of src.matchAll(STATIC_RE)) {
    const next = resolveSpec(m[1], file);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    parent.set(next, file);
    stack.push(next);
  }
}

const rel = (f) => relative(root, f).split("\\").join("/");
const isContent = (r) => CONTENT.has(r) || r.startsWith(CONTENT_DIR);
const eagerContent = [...seen].map(rel).filter(isContent).sort();

let failed = false;

// Rule 1 — no content in first paint that is not a named, reasoned debt.
const unlisted = eagerContent.filter((r) => !ALLOW.has(r));
if (unlisted.length) {
  failed = true;
  console.error("\ncheck:eager-content: question content reached first paint:\n");
  for (const r of unlisted) {
    console.error(`  ${r}`);
    let p = parent.get(join(root, r));
    const chain = [];
    while (p && chain.length < 6) { chain.push(rel(p)); if (rel(p) === "src/v2/main.jsx") break; p = parent.get(p); }
    console.error(`      imported by: ${chain.join(" <- ")}`);
  }
  console.error(
    "\n  A phone fetches this before it can paint, and it grows every time a\n"
    + "  question is written — so the bank's size becomes the app's start-up\n"
    + "  cost and a content lane ends up behind the eager budget. Make the\n"
    + "  import dynamic (`await import(...)`) in the surface that needs it, or\n"
    + "  split the part that is not content into its own module — the way\n"
    + "  daily-cats.js carries the taxonomy so map-branches.js does not carry\n"
    + "  the archive. Do NOT raise check:bundle's ceiling to fit it.",
  );
}

// Rule 2 — the ratchet. A listed module that is no longer eager must lose
// its line, or the list stops describing the tree.
const stale = [...ALLOW.keys()].filter((r) => !eagerContent.includes(r)).sort();
if (stale.length) {
  failed = true;
  console.error("\ncheck:eager-content: these left first paint — delete their allowlist lines:\n");
  for (const r of stale) console.error(`  ${r}`);
  console.error("\n  (scripts/check-eager-content.mjs, ALLOW). The list may only shrink.");
}

if (failed) process.exit(1);
console.log(
  `check:eager-content OK — ${seen.size} modules in the static first-paint graph, `
  + `${eagerContent.length} of them content, all ${ALLOW.size} named as debt`,
);
