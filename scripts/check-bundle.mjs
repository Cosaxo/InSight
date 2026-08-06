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

// Current largest chunk is the entry, 721.4 KB. The spec layer used to load
// in one piece, and this comment used to say check-spec-globals required that —
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
// 850 → 735, and 1600 → 2100 (2026-08-06). BOTH ceilings had stopped
// measuring what their comments claimed, in opposite directions — the
// per-chunk one had gone slack, the total one was never being applied to
// the bundle that ships. Re-measured rather than adjusted by eye; see D58.
//
// WHAT 735 ACTUALLY CATCHES, measured the way the 850 table was, by moving
// one group at a time out of loadOverlays() into the eager list and
// rebuilding:
//
//   | eager again              |  entry | 735 |
//   | ------------------------ | -----: | --- |
//   | nothing (today)          |  721.4 | ok  |
//   | city-overlay             |  727.1 | ok  |
//   | logic-test               |  746.2 | RED |
//   | test-overlay             |  780.0 | RED |
//   | person + city + suggest  |  819.0 | RED |
//   | the whole group          |  934.7 | RED |
//
// The 850 row of the old table said "nothing (today) 837 KB". The entry
// chunk is 721.4 KB now — D39 and D40 took ~116 KB out of it — so the
// ceiling had drifted to 128 KB of headroom and three of its own four rows
// had gone green: at 850 the entire overlay group could return to eager
// and this script would still print OK. A ceiling set once and never
// re-measured stops being a ratchet and becomes a decoration.
//
// The city-overlay caveat survives the re-measurement, and it is the same
// caveat: 5.7 KB of growth is under any headroom worth having, so this is a
// ceiling on the group and on every module large enough to matter, not a
// per-module assertion. Nothing else in the tree checks eager-vs-lazy at
// all — the mount tests pass either way.
//
// THE TOTAL, and why it goes UP while the other comes DOWN. This script had
// never once weighed a release build. ci.yml's typecheck-build job calls
// itself "the same gate a release goes through" and runs `npm run build`
// with no environment, but src/lib/sentry.ts reads
// `import.meta.env.VITE_SENTRY_DSN` and Vite replaces that with a literal at
// build time — unset, the whole `import("@sentry/capacitor")` branch is
// provably dead and rolldown drops it. So CI has been weighing a bundle with
// no Sentry in it, while ios-release.yml:132 sets the DSN (and does not run
// this script). Measured both ways off the same tree:
//
//   no DSN   1569.0 KB across 40 chunks   ← what CI weighed
//   with DSN 2050.3 KB across 44 chunks   ← what ships (+481.3 KB)
//
// 2050.3 against a 1600 ceiling: the shipping bundle has been 450 KB over
// budget for as long as Sentry has been in it, and the gate could not see it.
// ci.yml now sets a dummy DSN so the build under test is the shipping graph,
// and the ceiling moves to 2100 to sit just above what that actually weighs.
// This is a loosening ONLY in the sense that the number went up; the set of
// bytes it now covers is strictly larger, and 481 KB of it was never covered
// before. (156 KB of the Sentry group is @sentry/react's Spotlight dev
// integration, shipping in a production build — worth removing, but that is
// a change to what we ship, not to what measures it.)
//
// Sentry does not touch first paint either way: it is dynamically imported
// and appears in no modulepreload link, which the eager-graph figures in D58
// confirm (1207.7 KB with and without). This ceiling is about package size.
//
// The Mirror tab (~168 KB) is what is left of the obvious candidates, and it
// is a harder one: it renders on the first frame for anyone who opens the
// app on that tab, so it needs a guard the overlays did not.
const MAX_CHUNK_KB = 735;
const MAX_TOTAL_JS_KB = 2100;

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
