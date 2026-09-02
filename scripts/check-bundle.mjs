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
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LIVE_MARKERS, missingLiveMarkers } from "./live-build-markers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(root, "dist", "assets");
const INDEX_HTML = join(root, "dist", "index.html");

// ── WHICH BUNDLE THIS IS, AND WHY THE SCRIPT REFUSES TO GUESS ───────
//
// Every ceiling below describes the bundle that SHIPS, and for a long
// time none of them measured it. `ios-release.yml` is the only workflow
// that sets VITE_V2_LIVE=true, and it never ran this script; `ci.yml` ran
// this script on a build with the flag unset. So the gated bundle was one
// nobody installs and the installed one was ungated — for every build
// through 14 (D144).
//
// The gap is not academic and not small: with the flag set the same tree
// builds 67 chunks instead of 63, +12 KB of total JS, and **+9 KB in the
// eager graph** — the number whose entire job is to keep a 293 KB
// Firestore SDK and the Sentry SDK out of first paint. (Sentry was 445 KB
// everywhere this file quotes it; it is ~100 KB since its dynamic import
// stopped binding module namespaces, which is what let rolldown shake out
// Replay, Feedback and browserTracing. The historical figures below are
// left as measured — they are what those builds weighed.) Measured at
// build 14: 2232/972 live against 2220/963 demo, against ceilings of
// 2230/966. The live bundle was over BOTH and CI said OK, four times.
//
// CAPACITOR_BUILD is NOT what moves it, which is worth writing down
// because it is the variable that looks responsible. It only waives
// vite.config.ts's reCAPTCHA-key guard (a native client attests through
// DeviceCheck and never reads the key) and defines nothing, so it cannot
// change a byte of output. VITE_V2_LIVE alone reproduces the entire
// delta — verified by building with each in isolation.
//
// Hence this guard rather than a second set of "native" ceilings. A
// second set would have been the obvious fix and the wrong one: it leaves
// the two profiles both gated and both plausible, so the next person
// still has to know which command produced which numbers. Refusing to
// grade the wrong artifact is the property that cannot rot.
const DEMO = process.argv.includes("--demo");

// ── THE SECOND LOAD-BEARING VARIABLE, which this file documented and did
//    not guard (found by build 20's pre-flight) ───────────────────────
//
// The header above says it twice: without a DSN the Sentry group is
// provably dead, rolldown drops it, and the TOTAL comes out light by its
// whole size (~450 KB when this was written, ~100 KB now).
// That was written as advice to whoever runs the command, and VITE_V2_LIVE
// got a hard guard while this one got a paragraph. So the exact failure
// this script exists to refuse — grading a bundle nobody installs and
// calling it the shipping one — was still reachable, one variable over:
// build with VITE_V2_LIVE=true and no DSN and the final line below prints
// `SHIPPING bundle (VITE_V2_LIVE=true)` over a total that is missing a
// fifth of the app. Measured on this tree at build 20, same command, DSN
// the only difference: 1877 KB across 76 chunks against 2331 KB across 79.
//
// It is NOT a hard refusal, and that is the difference from VITE_V2_LIVE.
// A Sentry-less release is a supported build — `ios-release.yml` passes
// `secrets.VITE_SENTRY_DSN` straight through and documents it as optional,
// "without it the release ships with no crash reporting", survivable and
// deliberately not gated. Failing here would turn that documented choice
// into a broken release path, which is a worse bug than the one being
// fixed.
//
// So: grade what is still measurable and decline to grade what is not.
// The per-chunk and eager ceilings are unaffected — Sentry is dynamically
// imported, appears in no modulepreload link (D64 measured first paint
// identical with and without it), and its chunk is 435 KB against a 735 KB
// per-chunk limit. Only MAX_TOTAL_JS_KB counts those bytes, so only
// MAX_TOTAL_JS_KB is withheld.
//
// WHICH IS DECIDED FROM dist/, and D198 is why that is not a detail. This
// guard first read `process.env.VITE_SENTRY_DSN` — the environment of the
// process running the CHECK, not of the one that ran the BUILD — and the
// two are the same only because ios-release.yml happens to put the build
// and this script in one `run:` block. Split them, as the script's own
// error message tells you to ("set any non-empty DSN at BUILD time and
// re-run"), and it reported `Sentry OUT` over a bundle with all 453 KB of
// Sentry in it, withholding the total ceiling from the artifact the
// ceiling exists for. Measured at build 21: 2349 KB graded as ungradable,
// against a ceiling with 8 KB of headroom.
//
// That is this file's own founding bug, one variable further out. The
// header above says it: refusing to grade the wrong artifact is the
// property that cannot rot — and an artifact claim read off the
// environment is exactly the kind that rots. check:web-firebase, its
// neighbour in that same workflow step, already asserts against `dist/`
// for this reason, "because a stale dist/ from a reordered step answers
// that differently". SENTRY_IN is computed where the chunks are, below.
//
// AND SO IS LIVE_IN, for exactly the same reason and one variable over.
// This guard read `process.env.VITE_V2_LIVE` until 2026-08-26 — the
// environment of the process running the CHECK, not of the one that ran
// the BUILD. `VITE_V2_LIVE=true npm run check:bundle` over a dist/ built
// without the flag printed `SHIPPING bundle (VITE_V2_LIVE=true)` and
// graded demo numbers against the shipping ceilings, which is the founding
// bug of this file with the Sentry half fixed and the V2 half left in.
// The refusal now lives beside the chunks, below.

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
// no Sentry in it, while ios-release.yml's build step sets VITE_SENTRY_DSN
// (and does not run this script). Measured both ways off the same tree:
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
//
// 2140 → 2170 (2026-08-12): the fourth raise, and it is the D98/D99
// shape again — measured with CI's own command, one merge apart:
//
//   main @ the D112 merge     2136 KB   ← 4 KB under the ceiling
//   + D113/D114 continuum     2160 KB   ← +24 KB, and over
//
// D111/D112 (kindred by scores, place profiles) spent the 21 KB the
// Sentry trim had won before this branch added a byte; the continuum
// forms (dial/field renderers, their live stats, the demo questions)
// are merely the feature that tripped it. Deferral buys nothing here
// twice over: the total counts every chunk, AND the new bytes already
// live in the deferred world-feed chunk (129 → 145 KB) — first paint
// never sees them. The eager graph did not move (951 KB, 4 under its
// own ceiling), so this raise is lazy weight only. 2170 leaves 10 KB,
// the usual posture. The D64 candidates stand un-taken — the Mirror
// tab guard, and whatever of Sentry's remaining ~440 KB an audit can
// still find — and the fifth raise should have to walk past them again.
// ── THE THIRD NUMBER, and why two were not enough (D110) ────────────
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
// Measured across D108 and D109, which is what put this here:
//
//   | tree        | entry chunk | EAGER GRAPH | total JS |
//   | ----------- | ----------: | ----------: | -------: |
//   | before D108 |    728.5 KB |   1271.1 KB |  2118 KB |
//   | after D109  |    685.2 KB |   1270.2 KB |  2116 KB |
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
//   | Firestore (pre-D110) |  685.2 |   2116 | 1270.2 | ok  | ok   | RED  |
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
// before D110, and it stood that way for months. `data/live.ts` imported
// `firebase/firestore` statically, live.ts is eager, and 292 KB of SDK was
// preloaded on every cold start including builds with no Firebase config at
// all. The entry chunk never held a byte of it, so 735 was never going to
// notice, and the total counted it either way.
//
// A CEILING, not a ratchet, like its two neighbours — and it comes DOWN with
// a win for the reason MAX_CHUNK_KB did at 940 → 850: at 1280 the Firestore
// SDK could silently return to the eager graph and this script would print
// OK. 955 leaves ~11 KB, the same headroom the last raise of the total left.
// 2170 → 2176 (2026-08-13): D128's stated topic preferences — the
// interests store and its panel, ~2 KB of real product.
//
// Raised rather than deferred, and the deferral was TRIED first: the
// panel is now React.lazy from LivePrivacyPanel, which is right on the
// merits (it renders inside the account screen, which nothing on the
// first frame opens) and moved this number by zero. That is the property
// the 2026-08-11 entry above recorded and it holds again — the total
// counts every chunk, so splitting relocates bytes and only deleting
// code moves it. The deferral stays because the ENTRY chunk is the
// ceiling with 10 KB of headroom, not because it paid here.
//
// 2176 → 2180 (2026-08-13): D134's sign-in wall — a screen the app did
// not have. Measured against origin/main, both built WITH a Sentry DSN so
// the numbers are the ones CI reads: total 2175 → 2179 (+4 KB, one new
// chunk), eager 954 → 955.
//
// Same shape as the entry above, including the part that keeps being
// re-learned: the deferral was tried FIRST, and it moved this number by
// zero. Statically imported, the screen costs +3 KB eager (953 → 956 on a
// local build); behind React.lazy it costs +1, which is the whole reason
// MAX_EAGER_KB below is still green. The total did not care either way,
// because it counts every chunk — splitting relocates bytes, only
// deleting code moves the total. Raised rather than trimmed because the
// bytes are a login screen, and shrinking one to fit a budget costs a
// user something and saves nobody anything.
//
// TWO THINGS FOR WHOEVER TOUCHES THIS NEXT, both found the hard way on
// the run that failed (CI run 379):
//
//   1. `npm run build` LOCALLY DOES NOT BUILD WHAT CI BUILDS. Without a
//      `VITE_SENTRY_DSN` there is no 435 KB `prod-*.js` chunk, so the
//      local total came out at 1725 KB against a 2176 ceiling — 451 KB of
//      false headroom. This gate passed locally and failed on the PR, and
//      that is not flakiness, it is two different bundles. The EAGER
//      number is trustworthy either way (Sentry is deferred and absent
//      from the preload list — the row in the table above). Trust a local
//      run for the eager graph; export a dummy DSN before trusting it for
//      the total.
//   2. MAX_EAGER_KB now has NO headroom — CI measures exactly 955. The
//      ~11 KB the note above records is spent. The next thing added to
//      the first-paint graph fails this gate, which is the gate working,
//      and the answer is a dynamic import rather than a raise: the whole
//      argument for this constant is that 1280 would let the Firestore
//      SDK back into first paint silently.
//
// 2180 → 2182 (2026-08-13): D135's cohort hero and the field's way out of
// an empty Overview — 2179 → 2181, all of it inside the already-lazy
// cohort and similarity chunks, so the eager graph did not move (955,
// still at its ceiling).
//
// Two raises in one day is worth a word, because the pattern is the thing
// to watch rather than the 6 KB: both were UI a user asked for, both were
// measured against origin/main with a DSN, and neither touched first
// paint. The ceiling that is actually defending anything here is
// MAX_EAGER_KB — it has no headroom and cannot be raised without giving
// back the Firestore-SDK guarantee. This one is a drift alarm, and an
// alarm that fires on every intentional change is one nobody reads, so if
// a third raise lands this week the question to ask is whether the total
// wants a wider band, not whether the app should be smaller.
// 2182 → 2184 (2026-08-14): Crossroads (D136) — a branching-story card, its
// store and two stories in the bank. All of it lands in the already-lazy
// world-feed chunk, so the eager graph did not move (955, still exactly at
// its ceiling).
//
// It tried to move it, which is the part worth recording. The first draft
// folded each story's ending counts in `buildFeedGlobals` and parked them on
// `state`, and data/live.ts is in the first-paint graph — ~1 KB of eager
// weight for a card that cannot render until the feed chunk lands. This gate
// caught it and the note above answered it: MAX_EAGER_KB is not raiseable,
// because it is the constant keeping the Firestore SDK out of first paint.
// The fold moved into `LIVE.pathQs()` and now runs on call, which is both
// smaller and better placed — one caller, once per feed render.
//
// So this raise is the total only, and the total is the drift alarm rather
// than the guarantee. Third raise in two days, which the note above says is
// the point at which to ask whether the band is too narrow rather than
// whether the app is too big. Recording the question rather than answering
// it: all three were features asked for, all three left first paint alone,
// and the alarm has now fired three times without once being the thing that
// found a problem. The eager gate found this one.
//
// 2184 → 2230 (2026-08-14, build 14's pre-flight): D137–D141 together —
// the suggestion board and its server, the pulse card and its trends
// chart, the type-mix card, and the height band. Measured the way the
// entry above says to, `VITE_SENTRY_DSN` set so the numbers are CI's:
// total 2184 → 2220 (+36 KB), eager 955 → 963.
//
// THIS IS THE FOURTH FIRING, AND IT IS THE ONE THE ENTRY ABOVE ASKED THE
// NEXT PERSON TO ANSWER. Its own test was "if a third raise lands this
// week, ask whether the total wants a wider band rather than whether the
// app should be smaller", and it recorded the question instead of
// answering it. Four for four now: every firing has been a feature that
// was asked for, every one left first paint alone, and the alarm has
// still never been the thing that found a problem. So this raise takes
// the 10 KB headroom convention the 2170 entry set and doubles the step
// to ~10 KB above the measured 2220 rather than the +1 the last three
// took — an alarm re-armed one kilobyte from the wall fires on the next
// feature, which is the failure mode the entry above named.
//
// WHAT IS NOT BEING RAISED, because it is the half that guarantees
// something: MAX_EAGER_KB. It measured 963 against 966 on the same
// build — D138's board is behind the overlay loader, D139's trends chart
// is React.lazy behind the card's own tap, and D141's type-mix card
// renders on a Mirror lens tab, which exists only while that tab is
// open. First paint did not move, and the Firestore-SDK guarantee the
// eager constant exists for is intact. A raise here would have been the
// thing to refuse.
//
// 2230 → 2245 (2026-08-14): NOT growth, and reading it as growth is the
// mistake this entry exists to prevent. The guard at the top of this file
// changed what these numbers DESCRIBE — from the demo bundle to the
// shipping one — and the shipping one measures 2233 on the same commit
// the demo measures 2220. Nothing was added; the ruler moved onto the
// right object. D144 has the arithmetic.
//
// The ~12 KB band is sized for a hazard rather than picked. `ci.yml`
// builds with a dummy Sentry DSN and no Firebase config; `ios-release.yml`
// builds with the real DSN and the real `VITE_FIREBASE_*`, worth +1 KB of
// total (2232 → 2233, both measured). Set this at the CI figure and the
// RELEASE build fails a gate CI had just passed — on a macOS runner, after
// the archive, at the most expensive moment available. The band covers the
// config delta because it has to.
//
// 2245 → 2265 (2026-08-14): D149-D152 — the takes' side badges and side
// filter, the who-voted sheet's Friends cut, Learn's real per-option
// counts, Near's anonymous field, the account-creation questions and the
// People lens rebuilt to the prototype's shape. Measured the way the
// guard above now insists: `VITE_V2_LIVE=true` with a DSN, 2255 against
// the 2245 ceiling.
//
// Fifth firing, same shape as the four before it: features that were
// asked for, and the alarm has still never been the thing that found a
// problem. The band is the 10 KB convention the 2230 entry set, taken
// above the measured 2255.
//
// WHAT IS NOT BEING RAISED, again, is MAX_EAGER_KB — 969 against 978 on
// this same build, with room left. Every one of those surfaces is behind
// a tap or a stop: the profile-setup screen is a dynamic import from
// main.jsx (D151 records why the obvious gate component would not fit),
// the Near field and the Circle/Groups fields are React.lazy, and the
// People lens rides the lens chunk that already existed.
//
// It went DOWN on the way, which is the part worth recording. The rebuild
// landed a fraction over the eager ceiling, and the fix was not to trim
// the feature but to find weight that should never have been eager:
// LiveTakesPanel was statically imported by daily-split.jsx and
// LiveDuelPanel — both the daily tab — so ~40 KB of takes thread was
// preloaded for a surface that renders behind a "Takes" tap or under a
// revealed duel. Both are React.lazy now. That is the trade this gate is
// for: the total is a drift alarm, the eager graph is the guarantee, and
// paying for a feature out of first paint is the wrong pocket.
//
// 2265 → 2285 (2026-08-14): D156 — the live 1v1 and Group panel rebuilt to
// the v25 prototype's shape (the sticky rail, the initial marks, the reveal
// bars, the answer→guess morph, the day dots and the pair's read-runs),
// plus ui/marks + ui/duelMarks + data/duelRuns. Measured the way the guard
// insists: 2273 against the 2265 ceiling, so the band is the usual ~10 KB
// taken above the measurement.
//
// Sixth firing, same shape as the five before it, and the same non-finding:
// the alarm has still never caught a problem, only growth that was asked
// for. It stays anyway — an alarm that only ever fires on real growth is
// one you can still read.
//
// THE EAGER GRAPH WENT DOWN AGAIN, and by more than the total went up: 970
// → 955, because the rebuild's first move was to stop importing
// ui/LiveDuelPanel from spec-index.js and reach it by React.lazy from
// daily-split.jsx instead. The panel is two of the daily tab's three modes
// and none of its first paint — World is what opens — so the whole live
// duel surface, and with it ui/LiveTakesPanel's last eager importer, left
// the entry graph. The feature is bigger and the boot is 15 KB lighter,
// which is the trade the previous entry describes, run deliberately this
// time rather than under a failing gate.
const MAX_CHUNK_KB = 735;
// 2285 → 2292 (2026-08-16): D177's room tabs — Near's Answers · People ·
// Compare, its shape functions and the store's room loader. Measured with
// a DSN, so these are the numbers CI reads: total 2283 → 2289, eager
// 966 → 969.
//
// The deferral was tried FIRST and it worked, which is why only the total
// moved: the three bodies are React.lazy behind their own chunk (77 chunks,
// up from 74), so the entry paid 3 KB for the tab row alone and the fold
// arrives on the tap that asks for it. That is the split doing exactly what
// the 2026-08-13 entries record it cannot do for the TOTAL — every chunk is
// counted, so splitting relocates bytes and only deleting code moves this
// number. The 6 KB is real product.
//
// The pattern the entry above says to watch is worth re-reading here: this
// is the fifth raise, and MAX_EAGER_KB is still the ceiling that defends
// anything (9 KB left after this one, and it did not have to move). If a
// sixth lands soon the question is whether the total wants a wider band
// rather than whether the app should be smaller.
// 2292 → 2334 (2026-08-16): D178's profile photo. Measured with a DSN:
// total 2289 → 2328 (+39), eager 969 → 974 (+5), 78 chunks up from 77.
//
// THE 39 KB IS ALMOST ALL `firebase/storage`, and that is the reason this
// raise is a different animal from the five before it — those were product
// code and this is a vendor SDK. It sits behind a dynamic import reached
// only by the upload path (`data/live.ts` setAvatar/removeAvatar), which
// is why the EAGER graph moved 5 KB rather than 38: drawing a face needs
// no SDK at all, only an `<img>` and a URL, so an account that never sets
// a photo never loads a byte of it. The +5 is the Avatar component, the
// profile control and `data/avatar.ts`.
//
// The entry above asked whether a sixth raise means the total wants a
// wider band rather than a higher ceiling. Answering it here rather than
// deferring again: the total is a DRIFT ALARM, and this is exactly the
// drift it should fire on — a whole SDK arriving is worth a human look,
// which is what it got. What it should NOT do is fire on the lazy-loading
// that made the eager cost 5 KB instead of 38, and it does not, because it
// counts every chunk by design. So the band stays as it is and the ceiling
// moves; the constant below is the one doing real work.
//
// MAX_EAGER_KB now has 4 KB of headroom (974 against 978). That is the
// number to watch — it is the one defending first paint, and the next
// thing added to the entry graph will very likely need a dynamic import
// rather than a raise.
//
// 2334 → 2340 (2026-08-17): D193's Compare. Measured with a DSN on this
// tree, both ways: total 2331 → 2336 (+5), eager 964 → 965 (+1), 82
// chunks up from 79.
//
// SEVENTH RAISE, and the smallest of them — worth a line anyway, because
// the entry two above asked what a sixth would mean and the answer holds
// here too: the total is a DRIFT ALARM, and 5 KB of new product code
// (`ui/LiveCompareLens.tsx`, `data/compare.ts`) is the boring end of what
// it should notice. The eager graph, which is the constant defending
// anything, moved 1 KB.
//
// THE THREE NEW CHUNKS ARE A SPLIT, NOT NEW WEIGHT, and it is the
// counter-intuitive half worth writing down: `spec/compare-breakdown.jsx`
// was inside the entry chunk (spec-index imports it eagerly), and a lazy
// importer appearing is what made rolldown pull it out into a shared 14 KB
// chunk of its own. So bytes moved OUT of the entry graph, which is why
// +5 KB of source cost first paint +1. That relocation is exactly what
// the 2026-08-13 entries say the TOTAL cannot see, and correctly: it
// counts every chunk, so only the genuinely new code shows up here.

// 2340 → 2357 (2026-08-18): D194's Foresight CALL card, D195's sponsored
// slot and D197's ad card, landing on top of the entry above rather than
// instead of it — both branches raised this constant in the same window and
// the merge is where the two deltas meet.
//
// MEASURED ON THE MERGE, not added up — and the two numbers differ, which
// is the point. Each side measured its own delta against a 2331 KB base
// (Compare +5, this branch +11), so the arithmetic says 2347. The merged
// tree builds **2349 KB / 966 KB eager**, across 82 chunks. The extra two
// kilobytes are the bundler re-splitting once both lazy importers exist —
// exactly what the entry above documents happening to
// `compare-breakdown.jsx` — and they are why a ceiling set by adding two
// branches' deltas would have been wrong on the day it was written.
//
// The eager graph — the constant that defends first paint — is the half
// worth watching, and it moved 1 KB per side: everything this branch adds is
// reached through `world-feed.jsx`, already past first paint behind
// `loadWorldFeed()` (D25).
//
// Headroom left: 8 KB on the total, 12 on the eager.
//
// 2357 → 2372 at build 22 (D202 · D203 · D204), and this one is genuine
// growth rather than a re-split: three features landed, none of which
// relocates bytes that were already there.
//
//   · D202, the type-mix system switch — a chip row, a persisted key and
//     a wider name column. Smallest of the three.
//   · D203, the pulse roster — `data/pulse.ts` roughly doubled (a roster,
//     a cadence store, a second fetch path) and `PulseCard` gained the
//     rhythm control. Both are EAGER, which is why the eager line moved
//     with the total here and did not for the world-feed work above.
//   · D204, Roles — `data/roles.ts`, `ui/LiveRolesPanel.tsx` and two new
//     archetype tables. The panel is behind React.lazy from an eager
//     importer (`profile-overlay.jsx`), so it is five of the extra chunks
//     and almost none of the extra eager bytes.
//
// MEASURED ON THE MERGE, not on the branch, and the two differ enough to
// be worth recording. On its own branch this work built 2364 KB / 974 KB
// eager across 87 chunks, against 2349 / 966 / 82 at build 21 — the eager
// graph taking 8 KB of the 15, all of it the pulse roster. Merged with the
// relationship-map deferral that lowered MAX_EAGER_KB to 920, it builds
// **2366 KB / 914 KB eager across 89 chunks**.
//
// So the eager line came DOWN 52 KB across the merge while three features
// landed on it, which is the deferral paying for the roster and then some.
// The total is the one that moved, and it moved for the reason above.
//
// Headroom left: 6 KB on the total, 6 on the eager. Both are tight and
// MAX_EAGER_KB is not raiseable, so the next thing added to the daily
// screen has to earn its bytes or defer.
//
// 2372 → 2404 (2026-08-19, the #231 merge): the Patterns tab (v28
// §2, ON TRIAL per D166 §1), the lazy Map with its parked branches
// (D207) and the trait web (v28 §13) land ON TOP of the D202–D204 entry
// above. Everything the three add is lazy — app-shell reaches
// ui/PatternsTab.tsx through React.lazy, the Map's seven modules left
// the eager list for loadMapTab() (the MAX_EAGER_KB lowering below), and
// the trait web rides behind the profile overlay. On their own branch
// these measured 2383 KB / 850 KB eager across 95 chunks; MEASURED ON
// THE MERGE: **2396 KB / 869 KB eager across 99 chunks** —
// the Map deferral paying back the eager bytes the roster spent in the
// entry above.
//
// 2404 → 2440 (2026-08-23): the Patterns tab remounts, on the data rather
// than on a flag (D265). D217 unmounted it for the v1 release and the
// entry above is the raise that admitted it in the first place, so this
// is the same 42 KB coming back. MEASURED against a clean HEAD build (git
// worktree, same command), 2374 → 2416 across 103 → 105 chunks, and the
// two new files are not both new code:
//
//   +40.0 KB  PatternsTab-*.js — the tab and its three lenses, lazy
//   +14.5 KB  world-feed-data-*.js — SPLIT OUT, not added: the tab imports
//             WORLD_TOPICS from it, so rolldown lifted it into a shared
//             chunk…
//   −14.4 KB  …out of `catalogs` (63.1 → 48.7), which is where those
//             bytes already were
//   + 2.5 KB  entry (257.7 → 259.3) + live (64.3 → 65.1): the gate module,
//             its wiring, and the earned-gate memory
//
// The eager graph is 839 → 841 for that last line alone: `world-feed-data`
// joins the modulepreload list, but its bytes were already eager inside
// `catalogs`, so the move is a relocation the ceiling below cannot see —
// the shape the 978 → 920 entry names. So MAX_EAGER_KB — the ceiling that
// is not raiseable — did not have to move for a whole tab: the tab itself
// is behind React.lazy, and the gate that decides whether it is in the bar
// is a 1 KB pure module.
//
// 2440 stands through the 2026-08-25 redesign build-out (D287/D288),
// and the sentence above about raises got a live test: on its own branch
// the paid mechanism's ~42 KB (the door rebuilt as the paid path, the
// buyer's room behind React.lazy, CurSwitch shared between those two
// chunks, the purchases store — every one deferred) tipped 2456 and this
// number briefly read 2480 with the measured entry. The merge with the
// D275–D286 audit took it back: that work shrank the app to 2093 KB
// total / 753 KB eager, so the redesign rides inside headroom the same
// week opened and the raise came out before it ever reached main. The
// eager additions (profile-general's PaidMineCard, the privacy panel's
// asked-by-you row, the two-crowd scorecards, the header's compose
// button) sit against MAX_EAGER_KB's own unchanged 880.
//
// Still not room for a library — either SDK rejoining first paint lands
// hundreds of KB over MAX_EAGER_KB and is caught there, which is where
// that guarantee lives.
const MAX_TOTAL_JS_KB = 2440;
// 955 → 966 (2026-08-14): D139's pulse card — the second fixed instrument
// on the FIRST screen, so its card, its store's demo furniture and the
// two LIVE members are legitimately eager (~10 KB min). What is not
// first-screen stayed out: the trends chart is React.lazy behind the
// card's own tap, and the store's live loaders (template + 21 per-day
// aggs) are dynamic inside ensureLive(). Headroom left: ~5 KB, the same
// posture as the 955 raise.
//
// 966 → 978 (2026-08-14): the same re-pointing as the total above, and
// this is the half where it mattered. The shipping bundle's eager graph is
// **972** where the demo bundle's is 963, so first paint has been 6 KB
// over this ceiling since build 12 or earlier with nothing able to say so.
// The +9 KB is spread across small chunks the live path pulls in — the
// largest single one is a 1.2 KB Sentry SHIM, not the SDK.
//
// THE GUARANTEE IS INTACT, and it was checked rather than assumed, because
// "the eager ceiling has been wrong for four builds" is exactly the shape
// of report that ends with an SDK in first paint. Neither big lazy chunk
// is preloaded in the live build: `dist/index.html` names 23 modules and
// the largest is 40 KB — no 293 KB `index.esm-*` (Firestore), no `prod-*`
// (Sentry, 445 KB at this commit and ~100 KB since). Both were verified
// absent from the modulepreload list at the same commit these numbers come
// from, and Sentry's shrinking does not change the argument: what matters
// is that neither is preloaded, not what either weighs.
//
// 978 is still a ceiling and still not raiseable on request. The doctrine
// from the 955 entry holds at the new figure: either SDK rejoining first
// paint lands at 1265 or 1417, so any ceiling near 978 catches it, and the
// 6 KB band is headroom for a feature rather than room for a library.
//
// 978 → 920 (2026-08-18): D200 took the relationship map off the eager
// graph. THE FIRST TIME THIS CONSTANT HAS COME DOWN, and the entries above
// are seven raises in a row, so it is worth naming what was different:
// nothing was optimised. `spec/relmap.jsx` + its core and panels are
// reachable only from the DEMO Circle field — a live build takes
// LiveCircleBody (D101) — so the entry chunk was carrying ~102 KB of source
// that a shipping app cannot execute. Measured both ways at this commit:
// eager 966 → 906 (−60), entry chunk 494 → 435 (−59), total 2349 → 2349
// and 82 → 83 chunks. The total not moving IS the finding: this is a
// relocation, and the 2026-08-13 entries already say the total cannot see
// one.
//
// THE BAND IS 14 KB, NOT 72, and that is the deliberate half. The freed
// room is exactly what docs/VISION-V28.md §5 is waiting on — the Map's
// Foresight and Crossroads branches are "blocked on bytes, not data" — and
// leaving it inside the ceiling would hand it over silently. A ceiling with
// 72 KB of slack defends nothing; the next feature to want that room should
// raise this line with a measurement beside it, which is what every entry
// above did.
//
// 920 → 860 (2026-08-19): v28 §5 opened the door the entry above was
// holding — the Map's seven modules left the eager graph for loadMapTab()
// (mirror-tab lazy-loads the body, main.jsx prewarms the chunk). Measured
// at this commit: eager 890 → 849 (−41), total 2370 → 2371 and 86 → 92
// chunks — a relocation again, which is the shape these moves have. The
// same doctrine as the 978 → 920 entry: the freed room is FOR the parked
// map branches (g-fore, g-paths, the pulse trend branch), and they now
// grow inside the LAZY map chunk where the eager ceiling no longer taxes
// them — so the band stays ~11 KB and this constant should not need to
// move for them at all.
//
// 860 → 880 (2026-08-19, the #231 merge): the 860 above was measured on
// the branch, before D203's pulse roster — legitimately eager, the entry
// far above records why — joined the graph. Merged: 869 KB eager, the
// deferral still paying for most of the roster. Band stays ~11 KB.
const MAX_EAGER_KB = 880;

// THE BYTES THAT ARE NOT JAVASCRIPT, which this gate could not see at all
// until D223. It weighed dist/assets/*.js exclusively, so the stylesheet —
// render-blocking, shipped on every paint — and the whole font directory
// sat outside every ceiling in the repo. An audit found 12 italic
// @font-face blocks and four woff2 files, 66 KB, for a voice styles.css
// states has no italic and `.app em { font-style: normal }` enforces. Pure
// package weight in the .ipa and .aab, zero runtime cost, and nothing could
// have caught it.
//
// Two numbers rather than one because they fail differently: CSS is
// render-blocking, so its bytes are on the critical path the way an eager
// chunk is; fonts are fetched on demand and cost download size and store
// footprint rather than first paint.
//
// Measured after that removal: 70 KB of CSS, 76 KB of fonts. The headroom
// is deliberately small — these are not numbers that should drift upward
// unnoticed, which is the whole reason they now have a gate.
//
// ── AND THEN ONE NUMBER WAS DOING TWO JOBS (D265) ────────────────────
//
// `cssKb` sums every .css in dist/assets, and the sentence above — "CSS is
// render-blocking, so its bytes are on the critical path" — stopped being
// true of all of it the first time a lazily-loaded component imported a
// stylesheet. Vite emits that as its own file, fetched with the chunk and
// never before; `dist/index.html` links exactly one stylesheet, and only
// that one blocks a paint. The Patterns tab is the case that made the
// difference visible: 15 KB of chunk CSS behind a React.lazy import, which
// the old single ceiling counted the same as 15 KB in the entry sheet.
//
// So state it directly, the way MAX_EAGER_KB's own note does — a
// guarantee that survives only while a number stays small is not one:
//
//   MAX_BLOCKING_CSS_KB  the sheets index.html LINKS. The critical-path
//                        number, and the one that must not drift. It has
//                        NOT moved for the Patterns work — 69 KB before
//                        and after, because none of those bytes are in
//                        the entry sheet.
//   MAX_CSS_KB           every stylesheet in the package. Install weight,
//                        which is the footing fonts are already on.
//
// 78 → 88 (2026-08-23): the Patterns tab's 15 KB of lazy chunk CSS, on a
// tree measuring 69 KB of blocking sheet and 84 KB in total. Raising the
// total is the deliberate half; the number that guards first paint is the
// new one, and it is tight on purpose.
const MAX_BLOCKING_CSS_KB = 74;
const MAX_CSS_KB = 88;
const MAX_FONT_KB = 96;

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

// The non-JS half. CSS lands in dist/assets beside the chunks; fonts are
// copied from public/ to dist/fonts, so both roots are walked. A missing
// directory is 0 rather than a throw — a demo build may not emit either.
const kbOf = (dir, re) => {
  try {
    return readdirSync(dir, { recursive: true })
      .map((f) => String(f).split(sep).join("/"))
      .filter((f) => re.test(f))
      .reduce((n, f) => n + statSync(join(dir, f)).size / 1024, 0);
  } catch { return 0; }
};
const cssKb = kbOf(ASSETS, /\.css$/);
const fontKb = kbOf(join(root, "dist"), /\.(woff2?|ttf|otf)$/);

// ── IS SENTRY IN THIS BUNDLE? Asked of the bundle ────────────────────
//
// Markers, not a filename: the group is `prod-*.js` today, which is a
// rolldown output name and not a promise. These four are SDK internals —
// two of them Sentry's own globals — and each splits cleanly. Measured on
// this tree at build 21, the same command with the DSN the only
// difference:
//
//                        chunks WITH dsn   chunks WITHOUT
//   __SENTRY__                  2                0
//   _sentryDebugIds             1                0
//   sentryWrapped               1                0
//   captureException            3                0
//
// The obvious marker is the one that does NOT work: the bare string
// "sentry" matches 12 chunks with the DSN and 9 without, because the app
// names its own lazy module and its dynamic-import path after it. A
// detector that cannot tell `src/lib/sentry.ts` from `@sentry/browser`
// would report the SDK present in every build, which fails in the
// direction that grades a 1895 KB bundle against the full ceiling and
// calls it the shipping one.
const SENTRY_MARKERS = ["__SENTRY__", "_sentryDebugIds", "sentryWrapped", "captureException"];
const sentryChunks = sized.filter(({ f }) => {
  const src = readFileSync(join(ASSETS, f), "utf8");
  return SENTRY_MARKERS.some((m) => src.includes(m));
});
const SENTRY_IN = sentryChunks.length > 0;
const sentryKb = sentryChunks.reduce((n, s) => n + s.kb, 0);

// ── IS THE V2 LIVE PATH IN THIS BUNDLE? Asked of the bundle ──────────
//
// scripts/live-build-markers.mjs is where the markers and the measurement
// behind them live; check-web-firebase asks the same question off the same
// list, which is the point of the module.
const liveMissing = missingLiveMarkers(sized.map(({ f }) => readFileSync(join(ASSETS, f), "utf8")).join("\n"));
const liveMarkersSeen = LIVE_MARKERS.filter((m) => !liveMissing.includes(m));
const LIVE_IN = liveMissing.length === 0;

if (!DEMO && !LIVE_IN) {
  console.error(
    "check-bundle: this gate describes the SHIPPING bundle, and dist/ was\n"
    + "not built as one — of "
    + LIVE_MARKERS.map((m) => `\`${m}\``).join(", ")
    + `, dist/assets carries ${liveMarkersSeen.length ? liveMarkersSeen.join(", ") : "none"}.\n`
    + "This is read from the BUILD OUTPUT, so setting VITE_V2_LIVE for this\n"
    + "process will not change the answer — rebuild.\n\n"
    + "  Build and check the bundle that ships:\n"
    + "    VITE_V2_LIVE=true VITE_SENTRY_DSN=https://ci@example.invalid/0 npm run build\n"
    + "    npm run check:bundle\n\n"
    + "  The DSN is load-bearing too and for a different reason: without it\n"
    + "  the Sentry chunk is provably dead and rolldown drops it, so the\n"
    + "  TOTAL comes out ~100 KB light. Any non-empty string restores it.\n\n"
    + "  To measure a demo build on purpose, pass --demo. That reports the\n"
    + "  numbers and applies no ceiling, because they are not this app's.",
  );
  process.exit(1);
}

// The same refusal the other way. `--demo` applies no ceiling and says the
// numbers are not this app's — over a live dist/ that is the identical
// wrong-artifact claim, just quieter, and it would report the shipping
// bundle's weight as the demo's.
if (DEMO && LIVE_IN) {
  console.error(
    "check-bundle: --demo says these numbers are a demo build's, and dist/\n"
    + `carries the live path (${liveMarkersSeen.join(", ")}). Rebuild without\n`
    + "VITE_V2_LIVE to measure a demo, or drop --demo to grade this one.",
  );
  process.exit(1);
}

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

// The render-blocking half of the stylesheet budget, asked of the artifact
// for the same reason the eager graph is: a `<link rel="stylesheet">` in
// index.html is fetched and parsed before the first paint, and a chunk's
// own .css beside it in assets/ is not. Same failure shape as the eager
// regexes above, so the same guard: zero links means the emit changed and
// this budget is measuring nothing.
const blockingCssNames = [
  ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\/([^"]+\.css)"/g),
  ...html.matchAll(/<link[^>]+href="\/assets\/([^"]+\.css)"[^>]*rel="stylesheet"/g),
].map((m) => m[1]);
if (!blockingCssNames.length) {
  console.error(
    "check-bundle: dist/index.html links no stylesheet — the emit shape\n"
    + "changed and the render-blocking CSS budget is measuring nothing.",
  );
  process.exit(1);
}
const blockingCssKb = [...new Set(blockingCssNames)].reduce((n, f) => {
  try {
    return n + statSync(join(ASSETS, f)).size / 1024;
  } catch {
    console.error(`check-bundle: dist/index.html links ${f}, which is not in dist/assets.`);
    process.exit(1);
    return n;
  }
}, 0);

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

if (DEMO) {
  console.log(
    "\n--demo: this is NOT the bundle that ships, so no ceiling was applied.\n"
    + "  The shipping build sets VITE_V2_LIVE=true and measures larger — at\n"
    + "  build 14, +12 KB of total and +9 KB of eager graph. Numbers above are\n"
    + "  for comparison only and must not be quoted as this app's size.",
  );
  process.exit(0);
}

let failed = false;
for (const s of over) {
  console.error(`\nOVER per-chunk budget: ${s.f} is ${s.kb.toFixed(0)} KB (max ${MAX_CHUNK_KB} KB)`);
  failed = true;
}

// ── the SDK rule ────────────────────────────────────────────────────
//
// MAX_EAGER_KB's stated purpose is keeping the Firestore (293 KB) and
// Sentry (445 KB then, ~100 KB now) SDKs out of first paint, but it only
// does that as a side
// effect of arithmetic: it is one number covering 23 chunks, so it holds
// exactly as long as nobody raises it. It has been raised four times in
// four days, twice by me, and D144 raised it while REPORTING that first
// paint had been over budget unnoticed for four builds. A guarantee that
// survives only while a number stays small is not one.
//
// So state it directly. The entry chunk is exempt and covered by
// MAX_CHUNK_KB; every OTHER member of the eager set is a module first paint
// fetches before it can paint, and none of them has any business being
// library-sized. The largest today is 40 KB, so 200 leaves a wide berth for
// a legitimately chunky component while still catching either SDK by a
// factor of at least 1.4.
//
// This is the rule that would have caught the pre-D110 tree, where
// data/live.ts imported firebase/firestore statically and 292 KB of SDK was
// preloaded on every cold start for months: the per-chunk ceiling saw
// 292 < 735 and the total counted it either way.
const MAX_EAGER_CHUNK_KB = 200;
for (const s of eager.slice(1)) {
  if (s.kb > MAX_EAGER_CHUNK_KB) {
    console.error(
      `\nOVER eager per-chunk budget: ${s.f} is ${s.kb.toFixed(0)} KB in the`
      + ` FIRST-PAINT set (max ${MAX_EAGER_CHUNK_KB} KB outside the entry).`,
    );
    console.error(
      "  A chunk this size in the modulepreload list is a library, not a\n"
      + "  component — most likely an SDK that became a static import. Make it\n"
      + "  dynamic again; do not raise this number to fit it.",
    );
    failed = true;
  }
}
// Withheld rather than passed when Sentry is out — see SENTRY_IN. A total
// that is missing 450 KB of the app cannot fail this ceiling and must not
// be reported as having cleared it.
if (!SENTRY_IN) {
  console.log(
    `\n  total NOT GRADED — no Sentry chunk in ${ASSETS.replace(root + "/", "")}, so the build saw no\n`
    + `  VITE_SENTRY_DSN and the group is dead code rolldown dropped.\n`
    + `  ${totalKb.toFixed(0)} KB is ~100 KB light and is not this app's size;\n`
    + `  MAX_TOTAL_JS_KB (${MAX_TOTAL_JS_KB} KB) was not applied. The per-chunk and eager\n`
    + `  ceilings above still hold — Sentry is in neither.\n\n`
    + `  To grade the total, set any non-empty DSN and REBUILD — the check\n`
    + `  reads dist/, so exporting it for this process alone changes nothing:\n`
    + `    VITE_SENTRY_DSN=https://ci@example.invalid/0 VITE_V2_LIVE=true npm run build`,
  );
} else if (totalKb > MAX_TOTAL_JS_KB) {
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

// The non-JS ceilings. Applied on the same footing as the JS ones and,
// like MAX_TOTAL_JS_KB, only on a build that was made as the shipping one —
// a demo build's asset set is not this app's.
if (!DEMO) {
  for (const [what, kb, max] of [
    ["render-blocking stylesheet", blockingCssKb, MAX_BLOCKING_CSS_KB],
    ["stylesheet total", cssKb, MAX_CSS_KB],
    ["fonts", fontKb, MAX_FONT_KB],
  ]) {
    if (kb > max) {
      console.error(
        `check-bundle: ${what} is ${kb.toFixed(0)} KB, over the ${max} KB ceiling.\n`
        + "  These bytes ship on every install, and the render-blocking sheet is\n"
        + "  fetched before anything paints. Trim them, move the bytes behind a\n"
        + "  lazy import (which moves them off the blocking number, not off the\n"
        + "  total), or raise the ceiling here deliberately with a note saying why.",
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    "\nEither trim what was added, or raise the ceiling in this script —\n"
    + "deliberately, with a note saying why the app got bigger.",
  );
  process.exit(1);
}

// Name the artifact, not just the verdict. Every failure this gate has had
// was a question of WHICH bundle got measured, so a log line saying "OK"
// without saying "of what" is the one that let four builds through.
// "SHIPPING bundle (VITE_V2_LIVE=true)" was itself an artifact claim that
// could be false twice over: the flag said the V2 half is in and said
// nothing about Sentry, and it was read off this process's environment
// rather than off dist/, so it could be false about the V2 half too. Both
// halves are named now and both are read from the build output, so the
// line cannot assert more than was measured.
console.log(
  SENTRY_IN
    ? `bundle budget OK — SHIPPING bundle (V2 live path in dist, Sentry in, `
      + `${sentryKb.toFixed(0)} KB over ${sentryChunks.length} chunk(s)), `
      + `${totalKb.toFixed(0)} KB total / ${eagerKb.toFixed(0)} KB eager `
      + `(max ${MAX_TOTAL_JS_KB} / ${MAX_EAGER_KB}); `
      + `${blockingCssKb.toFixed(0)} KB blocking css / ${cssKb.toFixed(0)} KB css total `
      + `/ ${fontKb.toFixed(0)} KB fonts `
      + `(max ${MAX_BLOCKING_CSS_KB} / ${MAX_CSS_KB} / ${MAX_FONT_KB})`
    : `bundle budget OK on what was gradable — V2 live path in dist, Sentry OUT, `
      + `${eagerKb.toFixed(0)} KB eager (max ${MAX_EAGER_KB}); `
      + `total ${totalKb.toFixed(0)} KB ungraded`,
);
