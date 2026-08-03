// Bundle budget. Run after `npm run build`.
//
// The bundle ships inside a native package, so the cost is parse and eval
// on a cold start rather than network — but nothing was watching it move,
// and Rollup's own warning has been firing on every build for long enough
// to become background noise.
//
// Asserts BOTH a per-chunk ceiling and a total: a per-chunk limit alone is
// dodged by splitting one large chunk into two merely-large ones, and a
// total alone permits a single monolith.

import { readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(root, "dist", "assets");

// Current largest chunk is ~850 KB. The spec layer used to load in one
// piece, and this comment used to say check-spec-globals required that —
// it does not. Rule 2 substring-matches the './spec/…' strings in
// spec-index.js, which a dynamic import satisfies exactly as a static one
// does, so the file can defer a module and still account for it (D25).
//
// The world feed is the first module group to use that: ~85 KB that first
// paint does not need. MAX_CHUNK_KB came down from 1024 with it, which is
// the point of lowering a ceiling after a win — at 1024 the feed could
// silently return to the entry chunk and nothing would say so.
//
// Still ceilings rather than targets. The total will barely move for any of
// this work, because splitting relocates bytes rather than removing them —
// which is why MAX_TOTAL_JS_KB is unchanged and why the per-chunk limit is
// the one that measures it.
//
// 900 → 940 with the v15 2026-07-31 revision (D27): the spec layer gained
// eleven modules (~68 KB minified into the entry — the Learn stack,
// VOTECUTS, subtopics, catalogues, map groups), and each stays eager for a
// load-order or subscription reason recorded there. The deferred world-feed
// group absorbed the rest of that revision's growth (feed chunk 85 → 107 KB)
// without touching first paint.
//
// 940 → 850 with the no-button overlay group (D38, 2026-08-03): test,
// person, city, suggest and logic now load after first paint like the feed,
// taking the entry chunk 922 → 837 KB. The ceiling comes down WITH the win
// for the reason the last one did — at 940 the whole group could silently
// return to the entry chunk and nothing would say so.
//
// WHAT 850 ACTUALLY CATCHES, measured rather than asserted, by re-adding the
// static imports one group at a time and rebuilding:
//
//   | eager again              | entry  | 850 |
//   | ------------------------ | -----: | --- |
//   | nothing (today)          | 837 KB | ok  |
//   | test-overlay             | 854 KB | RED |
//   | person + city + suggest  | 887 KB | RED |
//   | the whole group          | 922 KB | RED |
//
// So it catches the group and every single module large enough to matter.
// It does NOT catch the smallest one (city-overlay) returning to eager on
// its own — that is under the 13 KB of headroom, and closing the gap means
// zero headroom, which reds the tree on any legitimate growth instead. The
// honest statement is that this is a ceiling on the group, not a per-module
// assertion; nothing else in the tree checks eager-vs-lazy at all, since the
// mount tests pass either way.
//
// The Mirror tab (~168 KB) is what is left of the obvious candidates, and it
// is a harder one: it renders on the first frame for anyone who opens the
// app on that tab, so it needs a guard the overlays did not.
const MAX_CHUNK_KB = 850;
const MAX_TOTAL_JS_KB = 1600;

let files;
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
} catch {
  console.error(
    `check-bundle: no build output at ${ASSETS}.\nRun \`npm run build\` first.`,
  );
  process.exit(1);
}

// A budget that silently passes on zero files is worse than no budget.
if (!files.length) {
  console.error(`check-bundle: found no .js files in ${ASSETS} — did the build change its output layout?`);
  process.exit(1);
}

const sized = files
  .map((f) => ({ f, kb: statSync(join(ASSETS, f)).size / 1024 }))
  .sort((a, b) => b.kb - a.kb);

const totalKb = sized.reduce((n, s) => n + s.kb, 0);
const over = sized.filter((s) => s.kb > MAX_CHUNK_KB);

for (const s of sized.slice(0, 5)) {
  console.log(`  ${s.kb.toFixed(0).padStart(5)} KB  ${s.f}`);
}
console.log(`  ${totalKb.toFixed(0).padStart(5)} KB  total across ${sized.length} chunks`);

let failed = false;
for (const s of over) {
  console.error(`\nOVER per-chunk budget: ${s.f} is ${s.kb.toFixed(0)} KB (max ${MAX_CHUNK_KB} KB)`);
  failed = true;
}
if (totalKb > MAX_TOTAL_JS_KB) {
  console.error(`\nOVER total budget: ${totalKb.toFixed(0)} KB (max ${MAX_TOTAL_JS_KB} KB)`);
  failed = true;
}

if (failed) {
  console.error(
    "\nEither trim what was added, or raise the ceiling in this script —\n"
    + "deliberately, with a note saying why the app got bigger.",
  );
  process.exit(1);
}

console.log("bundle budget OK");
