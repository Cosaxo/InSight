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

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(root, "dist", "assets");
const INDEX_HTML = join(root, "dist", "index.html");

// Current largest chunk is the entry, 723.4 KB. The spec layer used to load
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
// the bundle that ships. Re-measured rather than adjusted by eye; see D64.
//
// WHAT 735 ACTUALLY CATCHES, measured the way the 850 table was, by moving
// one group at a time out of loadOverlays() into the eager list and
// rebuilding:
//
//   | eager again              |  entry | 735 |
//   | ------------------------ | -----: | --- |
//   | nothing (today)          |  723.4 | ok  |
//   | city-overlay             |  729.1 | ok  |
//   | logic-test               |  752.9 | RED |
//   | test-overlay             |  782.1 | RED |
//   | person + city + suggest  |  821.1 | RED |
//   | the whole group          |  941.4 | RED |
//
// The 850 row of the old table said "nothing (today) 837 KB". The entry
// chunk is 723.4 KB now — D39 and D40 took ~116 KB out of it — so the
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
//   no DSN   1577.2 KB across 40 chunks   ← what CI weighed
//   with DSN 2058.4 KB across 44 chunks   ← what ships (+481.2 KB)
//
// 2058.4 against a 1600 ceiling: the shipping bundle has been 450 KB over
// budget for as long as Sentry has been in it, and the gate could not see it.
// ci.yml now sets a dummy DSN so the build under test is the shipping graph,
// and the ceiling moves to 2100 to sit just above what that actually weighs.
// This is a loosening ONLY in the sense that the number went up; the set of
// bytes it now covers is strictly larger, and 481 KB of it was never covered
// before. (A parenthetical here used to read "156 KB of the Sentry group is
// @sentry/react's Spotlight dev integration, shipping in a production build
// — worth removing". Withdrawn 2026-08-11: that was a chunk NAME read as
// chunk contents. `spotlight-*.js` is Sentry core — captureException, the
// client, the logger, v10.60.0 — which rolldown named after one of the
// smaller modules inside it, and all three esm entries import it. The
// Spotlight integration itself is 1.9 KB of unminified source. There is no
// 156 KB win there, and the sentence had been sitting here inviting
// someone to go looking for one.)
//
// Sentry does not touch first paint either way: it is dynamically imported
// and appears in no modulepreload link, which the eager-graph figures in D64
// confirm (1211.2 KB with and without). This ceiling is about package size.
//
// The Mirror tab (~168 KB) is what is left of the obvious candidates, and it
// is a harder one: it renders on the first frame for anyone who opens the
// app on that tab, so it needs a guard the overlays did not.
//
// 2100 → 2120 (2026-08-10): the 42 KB of headroom the 2026-08-06 reset left
// was spent by real product, not drift — D85 grew the four tests to 5 items
// per dimension plus a 20-item cognitive bank (test content ships in the
// bundle), and D86 added the answer-edit path and the feed's answered
// expander (~2 KB). CI weighed the merged tree at 2102. Same posture as the
// last move: the ceiling sits just above what the app actually weighs, so
// the next growth has to come explain itself here too.
//
// 2120 → 2140 (2026-08-11): D98 and D99 came to explain themselves.
// Measured on this tree with CI's own command, one commit apart:
//
//   main @ the D98 merge      2119.6 KB   ← 0.4 KB under the ceiling
//   + D99's lens row          2131.0 KB   ← +11.4 KB, and over
//
// The first row is the one to read twice. 2120 was set to sit just above
// 2102, and D98's privacy reversal — the collection-group read path,
// data/voters.ts, LiveVotersPanel — spent 17.6 KB of that 18 KB before D99
// added a byte. Two features landed in the gap between a ceiling and the
// thing it measures; the second is merely the one that tripped it.
//
// AND THE USUAL ANSWER DOES NOT WORK HERE. Every previous squeeze on this
// file was met by deferring a module group past first paint. That is worth
// exactly nothing against the total, which counts every chunk: splitting
// relocates bytes and moves this number by zero. Verified rather than
// reasoned about — the lens row is ~9 KB of the entry chunk, and making it
// lazy leaves the total at 2131. Only deleting code moves this ceiling,
// and D98 and D99 are code the app was asked for.
//
// So 2140 — and note the headroom each raise has left: 41.6 KB (08-06),
// 18 KB (08-10), 9 KB now. That trend is the real finding. Three
// consecutive raises means this ceiling is tracking the bundle rather than
// constraining it, and the next growth should not be a fourth. The
// candidates are the ones D64 named and nobody has taken: the Mirror tab
// (~168 KB, first frame for anyone who opens on that tab, so it needs a
// guard the overlays did not) and an audit of how much of Sentry's ~470 KB
// is actually reachable.
//
// MAX_CHUNK_KB stays at 735 and is now the tighter of the two: the entry
// chunk is 732.0 KB, so 3 KB of headroom. The next eager kilobyte fails
// there rather than here, and has to defer instead of argue. That is the
// ratchet working, and it is deliberately not being moved to match.
//
// NEITHER NUMBER MOVED FOR D100 OR D101, and this is the note saying so
// because the entry above predicted the opposite. Two features (the
// Mirror's Answers depth and Scores; the follow graph and Circle) took
// the tree to 743 KB entry / 2147 KB total — over both. What the
// paragraph above said would happen is what happened: the per-chunk
// ceiling caught it first, and the 3 KB of headroom left there is what
// forced a deferral instead of an argument. Three of them, in order of
// how much they bought:
//
//   Circle body → React.lazy from mirror-tab      743 → 738
//   data/circle → dynamic import inside live.ts   738 → 738  (nothing)
//   the lens row → React.lazy from LiveCohortBody 738 → 727
//
// The middle one is worth keeping in the record precisely because it
// bought nothing measurable: live.ts is eager, so moving circle.ts out
// of its static graph looked like the obvious win and the bundler had
// already hoisted those bytes somewhere they were not being counted
// against the entry. It stays because a dynamic import there is still
// the right shape, not because it paid.
//
// AND THE TOTAL CAME DOWN, from a trim this file asked for by name. The
// entry above ended "an audit of how much of Sentry's ~470 KB is
// actually reachable". The answer was 28 KB of it is not:
// src/lib/sentry.ts imported @sentry/react and used exactly one symbol
// from it (`init`), while @sentry/capacitor depends on @sentry/browser
// DIRECTLY and lists @sentry/react as one of three framework peers. The
// React package's real additions — Sentry's ErrorBoundary, the
// Profiler, router instrumentation — were never wired to anything.
// Swapping the import took the total 2147 → 2119.
//
// So the fourth raise did not happen, and the headroom went the other
// way for the first time since this file was written: entry 727.0 KB
// (8 KB under), total 2119 KB (21 KB under). Both features shipped and
// first paint got SMALLER than it was before either of them.
// ── THE THIRD NUMBER, and why two were not enough (D109) ────────────
//
// Neither ceiling above is the cost of a cold start, and between them sits
// a hole big enough to walk two consecutive changes through — which is
// exactly what happened.
//
// The per-chunk ceiling is improved by moving bytes OUT of the entry into a
// chunk that `index.html` preloads anyway; first paint fetches, parses and
// evaluates both, so the relocation is worth zero. The total is the other
// error in the other direction: it counts Sentry (~435 KB), the world-feed
// group and the overlay group, none of which first paint touches, so it
// cannot say whether the eager set grew.
//
// Measured across D107 and D108, which is what put this here:
//
//   | tree        | entry chunk | EAGER GRAPH | total JS |
//   | ----------- | ----------: | ----------: | -------: |
//   | before D107 |    728.5 KB |   1271.1 KB |  2118 KB |
//   | after D108  |    685.2 KB |   1270.2 KB |  2116 KB |
//
// 43 KB off the gated number; 0.9 KB off first paint. `duo-daily` went
// 21.0 → 41.0 KB and `LiveTakesPanel` 11.4 → 33.7 KB, both preloaded. Two
// commits banked a win the app did not get, and both gates said OK.
//
// src/v2/README.md has recorded the special case since the `sample-data.js`
// conversion ("became its own chunk that first paint still preloads"). This
// is the general form, held by a number instead of by a paragraph.
//
// WHAT IT MEASURES. The entry `<script type="module">` plus every
// `<link rel="modulepreload">` Vite emits into `dist/index.html` — which is
// precisely the set the browser fetches before it can paint, and precisely
// what a static import graph decides. Deferred chunks (`loadWorldFeed`,
// `loadOverlays`, `React.lazy`, Sentry) are absent from that list and stay
// absent, which is the point: this is the number D25 and D38 were actually
// moving, and neither could see it.
//
// WHAT IT CATCHES that the other two do not, measured the same way the 735
// table was — by making a deferred group eager again and rebuilding. The
// first draft of this table was REASONED rather than measured and got it
// wrong, which is worth leaving in the record:
//
//   | eager again          |  entry |  total | eager  | 735 | 2140 |  955 |
//   | -------------------- | -----: | -----: | -----: | --- | ---- | ---- |
//   | nothing (today)      |  685.2 |   2118 |  944.0 | ok  | ok   | ok   |
//   | the world-feed group |  863.0 |   2117 | 1087.0 | RED | ok   | RED  |
//   | Sentry               |  685.2 |   2117 | 1394.0 | ok  | ok   | RED  |
//   | Firestore (pre-D109) |  685.2 |   2116 | 1270.2 | ok  | ok   | RED  |
//
// The feed row was the one this table was first written for, and it does NOT
// make the case: rolldown merges world-feed back into the ENTRY chunk, so 735
// catches it first and this constant adds nothing. Predicting otherwise and
// writing it down as a measurement is the error this repo keeps a probe-first
// rule for; the first draft of this table did exactly that.
//
// THE OTHER TWO ROWS ARE THE ARGUMENT, and they are the same shape.
//
// Sentry: make sentry.ts's two dynamic imports static — one plausible edit,
// no new dependency — and 450 KB joins first paint. It lands in a SIBLING
// chunk (`live-*.js`, 474 KB) rather than the entry, so the per-chunk ceiling
// sees 474 < 735 and passes; the total does not move at all, because those
// bytes were already counted as a lazy chunk. Both old gates say OK to a
// first paint that got 48% heavier.
//
// Firestore: that row is not hypothetical — it is the tree as it stood
// before D109, and it stood that way for months. `data/live.ts` imported
// `firebase/firestore` statically, live.ts is eager, and 292 KB of SDK was
// preloaded on every cold start including builds with no Firebase config at
// all. The entry chunk never held a byte of it, so 735 was never going to
// notice, and the total counted it either way.
//
// A CEILING, not a ratchet, like its two neighbours — and it comes DOWN with
// a win for the reason MAX_CHUNK_KB did at 940 → 850: at 1280 the Firestore
// SDK could silently return to the eager graph and this script would print
// OK. 955 leaves ~11 KB, the same headroom the last raise of the total left.
const MAX_CHUNK_KB = 735;
const MAX_TOTAL_JS_KB = 2140;
const MAX_EAGER_KB = 955;

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

// ── the eager graph ─────────────────────────────────────────────────
//
// Vite writes the entry as a <script type="module"> and every STATIC
// dependency of it as a <link rel="modulepreload">. Dynamic chunks are not
// in that list — they are preloaded at runtime by the __vitePreload helper —
// so parsing this file is the same question as "what does first paint
// fetch", asked of the artifact rather than of the source.
let html;
try {
  html = readFileSync(INDEX_HTML, "utf8");
} catch {
  console.error(
    `check-bundle: no ${INDEX_HTML}.\nRun \`npm run build\` first.`,
  );
  process.exit(1);
}

const eagerNames = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g),
].map((m) => m[1]);

// Same rule as the empty-directory guard above, and it earns its keep here:
// these two regexes read a generated file, so a change to Vite's emit shape
// (an unquoted attribute, a different attribute order, a relative base) turns
// this budget into a silent zero rather than an error.
if (!eagerNames.length) {
  console.error(
    "check-bundle: dist/index.html names no entry script or modulepreload —\n"
    + "the emit shape changed and the eager-graph budget is measuring nothing.",
  );
  process.exit(1);
}

const byName = new Map(sized.map((x) => [x.f, x.kb]));
const eager = [...new Set(eagerNames)].map((f) => {
  const kb = byName.get(f);
  // A name in index.html with no file in assets/ means the two artifacts
  // disagree; counting it as 0 would understate the budget.
  if (kb === undefined) {
    console.error(`check-bundle: dist/index.html references ${f}, which is not in dist/assets.`);
    process.exit(1);
  }
  return { f, kb };
}).sort((a, b) => b.kb - a.kb);
const eagerKb = eager.reduce((n, s) => n + s.kb, 0);

for (const s of sized.slice(0, 5)) {
  console.log(`  ${s.kb.toFixed(0).padStart(5)} KB  ${s.f}`);
}
console.log(`  ${totalKb.toFixed(0).padStart(5)} KB  total across ${sized.length} chunks`);
console.log(`  ${eagerKb.toFixed(0).padStart(5)} KB  eager graph — entry + ${eager.length - 1} modulepreload(s)`);

let failed = false;
for (const s of over) {
  console.error(`\nOVER per-chunk budget: ${s.f} is ${s.kb.toFixed(0)} KB (max ${MAX_CHUNK_KB} KB)`);
  failed = true;
}
if (totalKb > MAX_TOTAL_JS_KB) {
  console.error(`\nOVER total budget: ${totalKb.toFixed(0)} KB (max ${MAX_TOTAL_JS_KB} KB)`);
  failed = true;
}
if (eagerKb > MAX_EAGER_KB) {
  console.error(`\nOVER eager-graph budget: ${eagerKb.toFixed(0)} KB (max ${MAX_EAGER_KB} KB)`);
  console.error("  the set first paint must fetch before it can paint:");
  for (const s of eager.slice(0, 8)) {
    console.error(`    ${s.kb.toFixed(0).padStart(5)} KB  ${s.f}`);
  }
  console.error(
    "\n  Splitting does NOT help here — a new chunk the entry still imports\n"
    + "  statically is preloaded and still counted. Defer it (a dynamic import\n"
    + "  behind loadWorldFeed/loadOverlays/React.lazy) or delete it.",
  );
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
