#!/usr/bin/env node
// check-figures.mjs — hold documented counts equal to the tree.
//
// WHY THIS EXISTS. This repo keeps re-committing one documentation error:
// a number quoted in prose, kept current by intention, going stale. It has
// happened at least four times now — the spec layer's suppression count
// twice (42, then 27, in the very paragraph warning against it), the a11y
// baseline once (19 after a pass took it to 11), and README.md's rules-test
// count, which said 40 in two places while the suite ran 44.
//
// scripts/check-a11y.mjs closed the first three by recomputing them. It
// could not close the fourth: its subject is src/v2/README.md and the
// figures it owns are ones it already computes for the ratchet. This is the
// same idea pointed at the root README, and it is a separate script rather
// than a fifth responsibility bolted onto the a11y ratchet — a doc mismatch
// reported by a gate named "a11y" reads as an accessibility regression,
// which is exactly the confusion that script's own header warns about.
//
// WHAT IT DOES NOT COVER, so the next reader does not assume more than it
// checks: the coverage percentages README quotes are behind a full
// `vitest --coverage` run, too slow for the lint job and already hedged in
// the prose as "what it says today". The bundle figures in src/v2/README.md
// are check:bundle's business. This script owns test COUNTS, which are a
// cheap static scan and the ones that move most often.
//
// Adding a figure is one entry in FIGURES below. The one exception is at
// the bottom, where CLAUDE.md §2's table is held to its own heading: that
// figure is written as ROWS rather than as a number, so it cannot be a
// pattern with a capture group (D279).
//
// It started README-only and grew a `file` field when the launch docs
// began quoting the question-bank size. That was the right moment: those
// counts appear in LAUNCH-RUNBOOK's status header and SHIP-CHECKLIST's
// seed step, and the seed step's number is the one an operator reads to
// decide whether a seed run did what it should.
//
// It grew the k-floor pair after D81 paused it, and both entries are GONE
// now — D98 deleted the constants and every sentence that quoted them, so
// the reads went with them (the note beside the bank scan below is the
// account). The episode is kept here because it is why this gate exists at
// all: the pause was scrupulous in the app — every floor sentence branched
// on the constant, gated by floor.test — and missed in prose, where README
// went on claiming the design floor under the heading "Honesty is the
// architecture". That is the UI-says-it-server-doesn't failure this product
// defines itself against, committed in documentation instead of UI.
//
// DECISIONS.md is deliberately NOT covered. Its arithmetic is the state at
// the moment a decision was taken, so a figure there going "stale" is the
// record working — gating it would force rewriting history to satisfy a
// linter. Only live documentation belongs here.
//
// Run: node scripts/check-figures.mjs   (wired into CI's lint job)

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { bankArray } from "./v2content-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sources = new Map();
const read = (rel) => {
  if (!sources.has(rel)) sources.set(rel, readFileSync(join(root, rel), "utf8"));
  return sources.get(rel);
};

// Count top-level test cases by their `it(` declarations.
//
// A static scan rather than a test run: this has to be cheap enough for the
// lint job, and the count has to be the same on a machine with no Java. It
// is only honest while the suites declare their cases literally — no
// `it.each`, no `it.skip`, no cases generated in a loop — so the scan
// refuses to report a number when it finds one of those rather than
// quietly under-counting. Verified equal to the runner's own total (44)
// when this was written.
const DYNAMIC = /\b(?:it|test|describe)\.(?:each|skip|only|todo|failing)\b/;

function countTests(relPath) {
  const src = readFileSync(join(root, relPath), "utf8");
  if (DYNAMIC.test(src)) {
    throw new Error(
      `${relPath} uses a dynamic test form (it.each / it.skip / …), which this\n`
      + "    static scan cannot count. Either count these files by running the\n"
      + "    suite, or drop the figure from the README — a gate that quietly\n"
      + "    under-counts is worse than no gate.",
    );
  }
  return (src.match(/^\s*it\(/gm) || []).length;
}

const rulesTests =
  countTests("firestore-tests/rules.test.ts")
  + countTests("firestore-tests/storage.rules.test.ts");

// The seeded question bank. `functions/src/v2content.ts` is generated data
// — one flat array of objects, each with a literal "id" and "surface" — so
// counting the keys is exact rather than approximate. If that file ever
// stops being generated and someone hand-writes an entry across lines, the
// count still holds: the scan matches the key, not the object shape.
//
// Two figures rather than one because they answer different questions.
// The total is what `seedContent()` reports back to an operator, so it is
// the number they check a seed run against. The daily count is the runway
// figure the launch plan reasons about — 90 questions is ~13 weeks at the
// promotion cadence — and the two move independently.
const v2content = read("functions/src/v2content.ts");
const surfaces = [...v2content.matchAll(/"surface":\s*"([^"]+)"/g)].map((m) => m[1]);
const seededQuestions = (v2content.match(/"id":\s*"[^"]+"/g) || []).length;
const dailyQuestions = surfaces.filter((s) => s === "daily").length;

// The bank's wire size, for COSTS.md's cold-boot row. Parsed rather than
// measured off the file, because the file is TypeScript around the data:
// its bytes include a type annotation and whatever the generator's
// formatter did that week, and neither of those ships to a device.
//
// One decimal place, and the gate compares the rounded value — the point is
// to catch a promotion cycle moving the figure by kilobytes, not to make a
// whitespace change red the tree.
const bankKiB = (() => {
  // scripts/v2content-lib.mjs — one parser, shared with cost-arith and
  // question-quality, because all three had their own copy and all three
  // broke differently when a second export arrived (D197). Its header has
  // the three failure modes.
  const arr = bankArray(v2content);
  return Math.round((JSON.stringify(arr).length / 1024) * 10) / 10;
})();

// The Patterns fit's eligible corpus (D265) — two-option daily plus
// two-option core feed, the rule `PATTERNS_QIDS` compiles from this same
// bank. Quoted in `src/v2/data/patternsReady.ts` as the scale the tab's
// pool floor is a fraction of, which is precisely the kind of sentence
// this file exists for: it is true today, it moves every time the bank
// grows a core question, and nothing else would notice.
const patternsEligibleCount = (() => {
  const arr = bankArray(v2content);
  return arr.filter((q) => (q.options || []).length === 2
    && (q.surface === "daily" || (q.surface === "feed" && q.core === true))).length;
})();

if (!seededQuestions || !dailyQuestions) {
  console.error(
    "check-figures: found no questions in functions/src/v2content.ts.\n"
    + "    The file's shape changed and this scan reads it wrong. Fix the scan —\n"
    + "    a figure gate that silently counts zero is worse than no gate.",
  );
  process.exit(1);
}

// The live k-floor pair used to be read here and pinned into eleven
// prose sentences. D98 deleted both constants and every sentence that
// quoted them, so the reads and their entries are gone too.
//
// Deleted rather than pointed at a replacement, per this file's own rule
// a few lines up: a gate reading for a sentence that has been reworded
// away is one nobody can satisfy, and the right answer then is to delete
// the entry, not to restore the sentence.

// Each figure: where it is quoted, how to recompute it, and the exact
// sentence to write when it has moved. The `missing` message matters as
// much as the mismatch one — a gate reading for a sentence that has been
// reworded away is one nobody can satisfy, and the right answer then is to
// delete the entry, not to restore the sentence.
// The D97 budget constants, cross-read from the regulator so the farm
// manual can quote them. QUESTION-FARM.md is LIVE documentation — the
// scheduled runs obey it verbatim — so a drifted budget figure there is
// not a stale doc, it is a mis-instructed run.
const constFrom = (rel) => {
  const src = read(rel);
  return (name) => {
    const m = src.match(new RegExp(`export const ${name} = (\\d+)`));
    if (!m) {
      throw new Error(
        `${rel} no longer declares ${name} — fix this scan, `
        + "a figure gate reading zero is worse than no gate.",
      );
    }
    return Number(m[1]);
  };
};
const budgetConst = constFrom("scripts/farm-budget.mjs");
// The D115 learn regulator's constants, same reasoning: the learn lane's
// section of QUESTION-FARM.md is what a run obeys, so a drifted cap there
// hands it a budget the script does not compute.
const learnConst = constFrom("scripts/learn-budget.mjs");
// The feed regulator's constants. This lane's cap is bounded by signal
// dilution rather than by the regulator, so the figure gate matters MORE here,
// not less: a manual quoting a bigger number than the script computes is the
// one way a run could be told to spread the crowd thinner than the design says.
const feedConst = constFrom("scripts/feed-budget.mjs");
// The duel regulator's constants (D213), same reasoning as the other three
// lanes': the duel section is what a scheduled run obeys.
const duelConst = constFrom("scripts/duel-budget.mjs");
// The style gate's own bounds. These are not a regulator's budget — they are
// what check:quality REFUSES — so a drifted figure here is not a
// mis-instructed run but a run instructed to write something the gate will
// reject after the writing is done.
const qualityConst = constFrom("scripts/question-quality.mjs");

// The shipped version pair, off package.json — the source `check:versions`
// itself treats as authoritative when it writes the two native projects.
//
// This entry exists because LAUNCH-RUNBOOK 5.6 went stale THREE times, and
// 5.6 is the step whose whole job is noticing version numbers disagree.
// Its own paragraph had already drawn the conclusion ("the honest reading
// is that this number will be wrong again") and stopped one move short of
// the remedy this file is: where a number is load-bearing, make the gate
// own it. Read as strings — a build is an integer today and the version is
// not, and comparing text is what the fix line has to write anyway.
const appPkg = JSON.parse(read("package.json"));

// How many rows the App Privacy filing declares, off the filing itself.
//
// LAUNCH-RUNBOOK 4.4 is the step that TYPES this form into App Store
// Connect, and its count went stale twice after D180 had already caught it
// once: ca8f4eb added D203's Health row and left the prose at nine, D272
// added Product Interaction and left it there still. Both drifts point the
// same way — the instruction under-declares, which app-privacy.json itself
// calls "the direction that gets an app pulled" — in the one step whose
// output is a legal statement.
//
// check:store-forms already holds app-privacy.json, STORE-FORMS.md and the
// age-rating half to each other; what nothing held was the RUNBOOK PROSE
// that a human reads while clicking. This is 5.6's remedy at 4.4.
//
// The count only. The per-row purposes cannot be gated into one sentence —
// ten rows are App Functionality and one is Analytics — which is why 4.4
// says to read the printout rather than the paragraph.
const appPrivacyRows = JSON.parse(read("design/store/app-privacy.json")).collected.length;

// How many functions actually ship, counted the way check-deploy-targets
// counts them — the same directory walk and the same regex, not a hand-kept
// file list. Hand-listing the sources is how this number would go stale a
// second time: check-deploy-targets' own comment records a `moderation.ts`
// miss from exactly that, which is why it reads the directory.
//
// functions/README.md said 17 while the deploy shipped 29, and that file is
// where ORIENTATION §3 sends every newcomer for the backend. Twelve
// functions' worth of drift in the one document whose job is to say what is
// there.
// Spelled-out numbers, because two of the sentences below are prose and
// this repo writes small counts as words. Only the values these rules can
// actually reach need an entry; anything outside the table falls back to
// digits and the diff says so plainly.
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

// The number words this file's suggestions are written in — generated,
// in their own module so the gate's own arithmetic can be tested without
// importing (and therefore RUNNING) the gate.
import { word } from "./number-words.mjs";
import { stripComments } from "./strip-comments.mjs";


// How many test runners this repo has, off package.json — the figure
// CLAUDE.md §2's heading quotes and ORIENTATION §1 and §5 repeat.
//
// This entry exists because that answer was FOUR while the tree ran five,
// and the missing one is `test:scripts`. It is the only suite wired into
// CI's LINT job, so `npm run lint` locally is eslint alone and says
// nothing about it, and doc-index.mjs rule 4 — the rule that keeps the
// map from silently omitting a thing — reads `check:*` names only and so
// could not see the omission either. Three branches shipped a broken gate
// script through that gap (D179, D197, and D275's), each of them a script
// that CHECKS something, which is why nothing else went red. D279 makes
// the count something a gate owns instead of something a table remembers.
//
// Counted GROUPED, the way the table tabulates them — one row per suite,
// not one per npm script — so NOT_A_RUNNER is an explicit list of the
// aliases: a script that runs a suite already tabulated, under different
// flags or chained with its siblings. A new `test:*` script that is
// neither fails this gate until someone decides which it is, and that is
// the whole point: the failure being closed is a runner arriving with
// nobody writing it down.
const NOT_A_RUNNER = new Set([
  "test:e2e:erasure",    // the `:erasure` and `:moderation` halves of the
  "test:e2e:moderation", // table's `test:e2e` row, not rows of their own
  "test:e2e:all",        // those three drivers on one emulator boot (D276)
  "test:coverage",       // test:unit again, instrumented
]);
const testRunners = (() => {
  const own = Object.keys(appPkg.scripts)
    .filter((k) => k.startsWith("test:") && !NOT_A_RUNNER.has(k));
  // Plus `npm run test --prefix functions`, whose script lives in the
  // functions package rather than this one — read rather than assumed, so
  // deleting it there fails here instead of leaving the count one high.
  const fns = JSON.parse(read("functions/package.json")).scripts.test;
  if (!fns) {
    throw new Error(
      "check-figures: functions/package.json no longer declares a `test` "
      + "script — fix this scan, a figure gate reading low is worse than none.",
    );
  }
  return own.length + 1;
})();

// The exemption list check:appcheck owns, counted from that file rather
// than restated here — a second copy of the number is what this gate is
// for.
const appCheckExemptions = (() => {
  const src = readFileSync(resolve(root, "scripts", "check-appcheck.mjs"), "utf8");
  const block = /const EXEMPT = \{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error("check-figures: could not find EXEMPT in check-appcheck.mjs");
  return [...block[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].length;
})();

// Jobs carrying `environment: production`, counted from the workflow files
// rather than from the sentence that describes them. DEPLOYMENT.md said "two
// jobs, and only two — verified rather than assumed" for as long as there
// were four: rebuild-aggregate.yml joined at D290, monitoring.yml at D303,
// and a claim that advertises its own verification is exactly the one nobody
// re-checks. Counted on the YAML key at job indent, not on the string, so the
// prose inside a workflow comment cannot inflate it.
const gatedJobs = readdirSync(join(root, ".github/workflows"))
  .filter((f) => f.endsWith(".yml"))
  .reduce((n, f) => n + (read(`.github/workflows/${f}`).match(/^ {4}environment: production$/gm) || []).length, 0);

// The alerting surface, counted from apply-monitoring.mjs's own lists
// rather than restated. check:monitoring already holds those lists equal to
// what is on disk, so deriving from them here means this gate and that one
// cannot report different totals.
//
// Why these are worth watching: the number had drifted in THREE places at
// once — the runbook step called them "the two monitoring alerts", its
// refusal rationale priced widening the deploy role "for two policies", and
// this script's own header said "three". There are eight. A refusal whose
// arithmetic is off by 4x is not a refusal anybody can re-derive, and the
// runbook's count is the number an operator reads before deciding whether
// the step matters.
const applyMonitoringSrc = read("scripts/apply-monitoring.mjs");
const monitoringPolicies =
  [...applyMonitoringSrc.matchAll(/"monitoring\/[\w.-]+\.json"/g)].length;
const monitoringMetrics =
  [...applyMonitoringSrc.matchAll(/name:\s*"[\w]+"/g)].length;

const shippedFunctions = readdirSync(resolve(root, "functions", "src"), { recursive: true })
  .map((f) => String(f).split(sep).join("/"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .reduce(
    (n, f) => n + [...read(`functions/src/${f}`)
      .matchAll(/^export\s+const\s+[A-Za-z0-9_]+\s*=\s*on[A-Z]/gm)].length,
    0,
  );

// The feed bank and its core/tail split. Both figures were stale when
// D296's audit looked: docs/SCALE-PLAN.md said "All 82 ... carry
// core: true" and content/README.md said "Feed questions (82)", against a
// file holding 130 questions of which 50 declare `core: false`. The second
// half is the one that mattered — SCALE-PLAN's whole argument is about what
// an unbounded feed costs, and a reader told the tail was empty would plan
// against a state that ended some time ago. Counted here so neither can
// drift again.
const feedQs = JSON.parse(read("content/feed-questions.json")).questions;
const feedCount = feedQs.length;
const feedCoreCount = feedQs.filter((q) => q.core === true).length;
const feedTailCount = feedQs.filter((q) => q.core === false).length;

// Spec modules fully off the shared-global bridge: they export something and
// assign nothing to window/globalThis, so an importer gets a binding and
// there is no publication left behind. Read from the directory, never from a
// list — CLAUDE.md hand-listed seven while the tree held 32, understating
// its own migration by 25 modules, in the paragraph directly above the one
// warning that a hand-kept figure does not stay current. Same shape and same
// reason as the shippedFunctions walk above.
const convertedSpecModules = (() => {
  const dir = join(root, "src/v2/spec");
  return readdirSync(dir)
    .filter((f) => /\.(js|jsx)$/.test(f))
    .filter((f) => {
      const src = readFileSync(join(dir, f), "utf8");
      if (!/^\s*export\s/m.test(src)) return false;
      return !/(?:globalThis|window)\.[A-Za-z_$][\w$]*\s*=[^=]|Object\.assign\(\s*(?:globalThis|window)\s*,/.test(src);
    }).length;
})();

// How far that hand-listed seven had drifted when D39's successor measured
// it: 32 in the tree against 7 in the prose. A fixed fact about a past
// state, so it is written down rather than computed — see the FIGURES entry
// that quotes it.
const SPEC_MIGRATION_DRIFT = 25;

// The monitoring gate's own rule list, counted off its numbered header —
// the list a reader trusts before they trust the gate.
const monitoringRules = (() => {
  const src = read("scripts/check-monitoring.mjs");
  const head = src.slice(0, src.indexOf("import "));
  // \d+ rather than \d: at a single digit the count silently stops at
  // nine, so a tenth rule would leave the gate reporting NINE and passing
  // a drifted heading straight through — the entry defending the drift it
  // was added to catch.
  return new Set([...head.matchAll(/^\/\/\s+(\d+)\. /gm)].map((m) => m[1])).size;
})();

// The modules that define Cloud Functions, counted off the tree. ops.ts's
// header prose said "nine" while there were fifteen — the hand-kept-figure
// drift this script exists for, in the file whose whole subject is that a
// value spelled out in many places is a value some edit will miss.
const fnModules = (() => {
  const dir = "functions/src";
  // join(root, …) like every other block here. A bare relative read is the
  // one thing in this file that depends on the caller's cwd, and it dies
  // with ENOENT when the gate is run from scripts/ rather than the root.
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    // Through stripComments, for the reason two other gates adopted it
    // tonight: a commented-out `onCall(` would count as a definition.
    // Today raw and stripped both give 15, so this is a latent miscount
    // rather than a live one — which is exactly when it is cheap to close.
    .filter((f) => /\bonCall\(|\bonSchedule\(|\bonDocument/
      .test(stripComments(read(`${dir}/${f}`))))
    .length;
})();

// The instruments the app actually ships, counted off IS_TESTS' own keys.
//
// `passive-progress.js` opened with "progress for the five core tests"
// while the object had held four since D103 retired the Thinking test —
// the same hand-kept-figure drift this script exists for, in a file the
// smoke suite has a whole describe block about ("the retired Thinking test
// is gone from every surface"). A top-level key at four-space indent is a
// test; the nested `dims` and `questions` sit deeper.
const coreTests = (() => {
  const src = read("src/v2/spec/test-definitions.js");
  const open = src.indexOf("export const IS_TESTS = {");
  if (open < 0) {
    throw new Error(
      "check-figures: src/v2/spec/test-definitions.js no longer declares\n"
      + "    `export const IS_TESTS = {` — fix this scan rather than the count.\n"
      + "    A figure gate that cannot find its subject reports zero.",
    );
  }
  return [...src.slice(open).matchAll(/^ {4}([a-z][A-Za-z0-9_]*):\s*\{/gm)].length;
})();

// The mount smoke files, counted off the directory. CLAUDE.md §2 calls them
// out by glob and then says how many, and the two parted company when
// smoke-live.test.jsx landed: the glob matched six while the sentence said
// five. Same class as every other entry here — a number beside a pattern,
// where the pattern moves and the number does not.
const smokeFiles = readdirSync(join(root, "src/v2/test"))
  .filter((f) => /^smoke-.*\.test\.jsx$/.test(f)).length;

// …and the suites that actually SHARE that harness, which is a different
// number and the one CLAUDE.md's sentence is about. The glob and the
// harness parted company twice over: `dialog.test.jsx` has imported
// mount-app for a long time, and the 2026-09-02 render-coverage files are
// not named smoke-*. Until this entry the sentence read "these are the
// only ones that execute a render", which by then was wrong about eighteen
// suites in this one directory.
const harnessFiles = readdirSync(join(root, "src/v2/test"))
  .filter((f) => /\.test\.jsx$/.test(f))
  .filter((f) => /from ["']\.\/mount-app\.jsx["']/.test(
    readFileSync(join(root, "src/v2/test", f), "utf8"),
  )).length;

// How many notifications the product actually SENDS, off v2social.ts's own
// call sites. web/privacy.html promises the token is "only used for" them
// and names them, and that sentence said ONE for the nine days after D236
// shipped three more — while the sender's own comment beside them said
// "two". A promise in writing is the one thing CLAUDE.md says moves first,
// so the number it quotes is derived here rather than typed.
//
// `validate` is excluded and named rather than filtered by a pattern: it
// is a dryRun send that never reaches a phone (registerPushToken uses it
// to test a token), so it is not a notification anyone receives.
const pushKinds = (() => {
  const src = readFileSync(join(root, "functions/src/v2social.ts"), "utf8");
  const kinds = new Set([...src.matchAll(/\bkind:\s*"([a-z-]+)"/g)].map((m) => m[1]));
  kinds.delete("validate");
  if (!kinds.size) {
    throw new Error(
      "check-figures: no `kind: \"…\"` push sites in v2social.ts — the sender "
      + "changed shape; fix this reader, do not delete the entry.",
    );
  }
  return kinds.size;
})();

// Storage's byte cap, read off storage.rules itself. The suite that pins
// that rule described it as an "8MB cap" for as long as the number had
// been 256 KB — the 8 MB was the retired dailyPhotos cap, stranded by the
// sweep that removed the surface, while the file's own cases used 300 KB
// and 200 KB against the real rule. Exactly this table's class: a number
// beside a thing that moved.
const storageCapKb = (() => {
  const src = readFileSync(join(root, "storage.rules"), "utf8");
  const m = /request\.resource\.size\s*<\s*(\d+)\s*\*\s*1024/.exec(src);
  if (!m) {
    throw new Error(
      "check-figures: no `request.resource.size < N * 1024` in storage.rules — "
      + "the cap moved or changed shape; fix this reader, do not delete the entry.",
    );
  }
  return Number(m[1]);
})();

// The city catalogue's size, read off the generated file's own header — the
// same line check-cities.mjs parses. It is quoted exactly once in live
// documentation and was quoted in seven code comments besides, none of them
// gated; the comments now say "~11k" so a regeneration cannot make them
// wrong by one, and this holds the one sentence that states the number.
const cityPlaces = Number(
  /# (\d+) places in \d+ countries/.exec(read("public/cities.txt"))?.[1] ?? 0,
);

const FIGURES = [
  {
    file: "docs/SCALE-PLAN.md",
    what: "feed questions declaring `core: true`",
    // `\s+` across the wrap, as elsewhere in this table — the sentence
    // breaks after "in", and a re-wrap must not silently stop matching.
    re: /(\d+) of the (?:\d+) in\s+`content\/feed-questions\.json` carry `core: true`/,
    actual: String(feedCoreCount),
    fix: (n) => `"${n} of the ${feedCount} ... carry \`core: true\`"`,
  },
  {
    file: "docs/SCALE-PLAN.md",
    what: "feed questions in the bank",
    re: /(?:\d+) of the (\d+) in\s+`content\/feed-questions\.json` carry `core: true`/,
    actual: String(feedCount),
    fix: (n) => `"... of the ${n} in content/feed-questions.json"`,
  },
  {
    file: "docs/SCALE-PLAN.md",
    what: "feed questions declaring `core: false` (the tail)",
    // `\s+` across the wrap: the clause breaks after "declare".
    re: /(\d+) declare\s+`core: false`/,
    actual: String(feedTailCount),
    fix: (n) => `"${n} declare \`core: false\`"`,
  },
  {
    file: "content/README.md",
    what: "feed questions in the bank",
    re: /\| Feed questions \((\d+)\)/,
    actual: String(feedCount),
    fix: (n) => `"Feed questions (${n})"`,
  },
  {
    file: "docs/CATALOG-QUESTIONS.md",
    what: "places in the city catalogue",
    re: /`public\/cities\.txt` \(([\d,]+) places/,
    actual: cityPlaces.toLocaleString("en-US"),
    fix: (n) => `"\`public/cities.txt\` (${n} places"`,
  },
  {
    file: "scripts/check-monitoring.mjs",
    what: "rules the monitoring gate's header enumerates",
    re: /THE (\w+) RULES:/,
    // Counted off the header's own numbered list, which is the thing that
    // drifted: it said FOUR while enumerating eight, each of the last four
    // added by a production failure the first four could not see.
    actual: ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"][monitoringRules]
      ?? String(monitoringRules),
    fix: (n) => `"THE ${n} RULES:"`,
  },
  {
    file: "functions/src/ops.ts",
    what: "modules that define functions and import the region constant",
    re: /imported by all (\w+) modules that define functions/,
    actual: word(fnModules),
    fix: (n) => `"imported by all ${n} modules that define functions"`,
  },
  {
    file: "src/v2/spec/passive-progress.js",
    what: "core tests the passive tracker follows",
    re: /progress for the (\w+) core tests/,
    // Through the shared speller like every other entry here. It shipped
    // as a literal list because the two lines it had to survive spelled
    // numbers differently — this file's own `NUMBER_WORDS` table on one
    // side, `word()` on the other — and git merges those two changes
    // without a conflict, leaving the gate dead on a name that no longer
    // exists. Both lines are on main now and `word()` is the survivor, so
    // the list has nothing left to protect against.
    actual: word(coreTests),
    fix: (n) => `"progress for the ${n} core tests"`,
  },
  {
    file: "CLAUDE.md",
    what: "mount smoke files (§2)",
    re: /all but one of the \*\*(\w+)\*\* `smoke-\*\.test\.jsx`/,
    actual: word(smokeFiles),
    fix: (n) => `"all but one of the **${n}** \`smoke-*.test.jsx\`"`,
  },
  {
    file: "web/privacy.html",
    what: "notifications the token is promised to be used for",
    re: /only used for the (\w+) notifications this app/,
    actual: word(pushKinds),
    fix: (n) => `"only used for the ${n} notifications this app sends"`,
  },
  {
    file: "firestore-tests/storage.rules.test.ts",
    what: "the storage byte cap the suite says it pins",
    re: /owner-only path match, (\d+) KB cap, image content-type/,
    actual: String(storageCapKb),
    fix: (n) => `"owner-only path match, ${n} KB cap, image content-type"`,
  },
  {
    file: "CLAUDE.md",
    what: "suites sharing the mount harness (§2)",
    re: /harness, and \*\*(\w+)\*\* suites share it/,
    actual: word(harnessFiles),
    fix: (n) => `"and **${n}** suites share it"`,
  },
  {
    file: "CLAUDE.md",
    what: "spec modules off the shared-global bridge (§1)",
    re: /^(\d+) modules are already off the bridge/m,
    actual: String(convertedSpecModules),
    fix: (n) => `"${n} modules are already off the bridge"`,
  },
  {
    file: "CLAUDE.md",
    what: "how far that figure had drifted (§1)",
    re: /understate the migration by (\d+)\n?modules/m,
    // A CONSTANT, not `convertedSpecModules - 7`. That subtraction read as
    // the same recomputation as the entry above it and is not: the drift is
    // history — the prose said seven while the tree held 32 — so it is 25
    // whatever the tree holds today. Derived, it moved with every
    // conversion, so the first person doing the "convert on touch" work
    // CLAUDE.md asks for would have been told by a red gate to write a
    // number that never happened. The one figure here the tree cannot
    // answer, and the only one whose `actual` is a literal.
    actual: String(SPEC_MIGRATION_DRIFT),
    fix: (n) => `"understate the migration by ${n} modules"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "monitoring alerts the operator step applies",
    re: /Apply the (\w+) monitoring alerts/,
    actual: word(monitoringPolicies),
    fix: (n) => `"Apply the ${n} monitoring alerts"`,
  },
  {
    file: "docs/DEPLOYMENT.md",
    what: "jobs carrying `environment: production`",
    // Capitalised: the figure opens the sentence, so the word in the prose
    // is "Four" and a lowercase `actual` would fail on a correct document.
    re: /\*\*What the environment gates\.\*\* (\w+) jobs/,
    actual: cap(word(gatedJobs)),
    fix: (n) => `"**What the environment gates.** ${n} jobs"`,
  },
  {
    file: "docs/MONITORING.md",
    what: "alert policies in the instruments table",
    // The copy D303's own sweep MISSED while claiming to have found them
    // all — byte-identical before and after that commit, at seven against a
    // tree of eight. Gated now for the reason the sweep exists.
    re: /\| `monitoring\/\*\.json` \| (\w+) alert policies/,
    actual: word(monitoringPolicies),
    fix: (n) => `"| \`monitoring/*.json\` | ${n} alert policies"`,
  },
  {
    file: "docs/COSTS.md",
    what: "alert policies in monitoring/",
    // One of three copies that were actually wrong when D303 swept for them
    // — it said four. The others were DEPLOYMENT.md's heading and its
    // blockquote. (D303 first claimed five; the runbook's "eight" was right
    // and priced against a retired premise, and apply-monitoring's header
    // had already been fixed at D291. See D303's own correction.)
    re: /`monitoring\/` holds\s+(\w+) policies/,
    actual: word(monitoringPolicies),
    fix: (n) => `"\`monitoring/\` holds ${n} policies"`,
  },
  {
    file: "docs/DEPLOYMENT.md",
    what: "alert policies the section documents",
    // The heading carried "three alerts, deliberately" for as long as there
    // were eight, and "Why only these three" underneath it — because five
    // were added by later work that had no reason to re-read a heading.
    // check:monitoring holds the LISTS equal to the directory; nothing held
    // the prose to the lists.
    re: /## Alerting \((\w+) policies, \w+ log-based metrics\)/,
    actual: word(monitoringPolicies),
    fix: (n) => `"## Alerting (${n} policies, ...)"`,
  },
  {
    file: "docs/DEPLOYMENT.md",
    what: "log-based metrics the section documents",
    re: /## Alerting \(\w+ policies, (\w+) log-based metrics\)/,
    actual: word(monitoringMetrics),
    fix: (n) => `"## Alerting (..., ${n} log-based metrics)"`,
  },
  {
    file: "scripts/apply-monitoring.mjs",
    what: "alert policies this script puts in place",
    re: /put the (\w+) alert policies in place/,
    actual: word(monitoringPolicies),
    fix: (n) => `"put the ${n} alert policies in place"`,
  },
  {
    file: "scripts/apply-monitoring.mjs",
    what: "log-based metrics this script creates",
    re: /a notification channel, (\w+) log-based metrics/,
    actual: word(monitoringMetrics),
    fix: (n) => `"a notification channel, ${n} log-based metrics"`,
  },
  {
    file: "src/v2/data/patternsReady.ts",
    what: "the Patterns fit's eligible corpus",
    re: /the eligible corpus is (\d+) questions today/,
    actual: String(patternsEligibleCount),
    fix: (n) => `"the eligible corpus is ${n} questions today"`,
  },
  // The runner count, in the three sentences that quote it. All three
  // together, because the whole failure D279 records is one of them being
  // updated and the others not — the §1 line and the §5 line are the two a
  // newcomer reads before they ever open CLAUDE.md §2.
  {
    file: "CLAUDE.md",
    what: "test runners (the §2 heading)",
    re: /There are (\w+) test runners, and they are not interchangeable/,
    actual: word(testRunners),
    fix: (n) => `"There are ${n} test runners, and they are not interchangeable"`,
  },
  {
    file: "docs/ORIENTATION.md",
    what: "test runners (§1's reading order)",
    re: /global scope; (\w+) non-interchangeable test runners/,
    actual: word(testRunners),
    fix: (n) => `"the spec layer's global scope; ${n} non-interchangeable test runners"`,
  },
  {
    file: "docs/ORIENTATION.md",
    what: "test runners (§5's gate map)",
    re: /There are (\w+) test runners, \*\*not interchangeable\*\*/,
    actual: word(testRunners),
    fix: (n) => `"There are ${n} test runners, **not interchangeable**"`,
  },
  {
    file: "functions/README.md",
    what: "functions that ship",
    re: /(\d+) functions ship from this codebase/,
    actual: String(shippedFunctions),
    fix: (n) => `"${n} functions ship from this codebase"`,
  },
  {
    file: "README.md",
    what: "rules tests (the repo map)",
    re: /—\s*(\d+) emulator tests/,
    actual: rulesTests,
    fix: (n) => `"— ${n} emulator tests"`,
  },
  // The App Check exemption count. README said FIVE while the gate
  // reported seven, which is the security-relevant version of this whole
  // file's problem: a reviewer auditing the exempt surface against the
  // README counts five, finds seven, and cannot tell whether two
  // exemptions were added without a record or the sentence simply rotted.
  // Read out of check-appcheck.mjs's own EXEMPT keys rather than
  // re-derived, so the two cannot disagree about what "exempt" means.
  {
    file: "README.md",
    what: "callables exempt from App Check",
    re: /The\s+(\w+) that cannot are the operator and moderator instruments/,
    actual: word(appCheckExemptions),
    fix: (n) => `"The ${n} that cannot are the operator and moderator instruments"`,
  },
  // MIRROR.md reasons from this ratio — "so a given week's deck serves at
  // most one" — and the denominator is the daily bank, which the promotion
  // cadence moves every week. It had drifted 114 → 128, making anyone
  // re-deriving Scores' fill rate about 12% optimistic off the document
  // whose whole job is to be the read path's source of truth.
  {
    file: "docs/MIRROR.md",
    what: "the daily bank behind the place-rating ratio",
    re: /holds twenty-four in ([a-z- ]+), spread over three radii/,
    actual: word(dailyQuestions),
    fix: (n) => `"holds twenty-four in ${n}, spread over three radii"`,
  },
  {
    file: "README.md",
    what: "rules tests (the testing section)",
    re: /(\d+) security-rules tests \(Firestore \+ Storage\)/,
    actual: rulesTests,
    fix: (n) => `"${n} security-rules tests (Firestore + Storage)"`,
  },
  // LOCAL-TESTING.md quoted this same figure ungated and drifted to 29
  // while the suite ran 50 — the fourth README-style staleness, in the
  // one doc a newcomer runs the suites from. `rulesTests` was already
  // computed for the two README entries; this is the third consumer.
  {
    file: "docs/LOCAL-TESTING.md",
    what: "rules tests (the test-suite block)",
    re: /(\d+) security-rules tests \(Firestore \+ Storage emulators\)/,
    actual: rulesTests,
    fix: (n) => `"${n} security-rules tests (Firestore + Storage emulators)"`,
  },
  {
    file: "docs/SHIP-CHECKLIST.md",
    what: "questions a seed run writes",
    re: /(\d+) questions land in `v2_questions`/,
    actual: seededQuestions,
    fix: (n) => `"${n} questions land in \`v2_questions\`"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "questions a seed run writes",
    re: /(\d+) questions land in `v2_questions`/,
    actual: seededQuestions,
    fix: (n) => `"${n} questions land in \`v2_questions\`"`,
  },
  // content/README.md's bank table quoted the pool size ungated and sat at
  // 90 for a full promotion vintage while the bank held 114 — the D187 batch
  // landed 2026-08-16 and nothing read the sentence. Same figure, another
  // consumer; the count is already computed for the runbook entries below.
  {
    file: "content/README.md",
    what: "the daily pool size (the bank table)",
    re: /The daily World question pool \((\d+)\)/,
    actual: dailyQuestions,
    fix: (n) => `"The daily World question pool (${n})"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the daily bank and the seeded total (status header)",
    re: /daily bank is at (\d+)\s*\n?\s*questions of \d+ seeded/,
    actual: dailyQuestions,
    fix: (n) => `"the daily bank is at ${n} questions of ${seededQuestions} seeded"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the seeded total (status header)",
    re: /daily bank is at \d+\s*\n?\s*questions of (\d+) seeded/,
    actual: seededQuestions,
    fix: (n) => `"the daily bank is at ${dailyQuestions} questions of ${n} seeded"`,
  },
  // docs/SCHEMA-V2.md contradicted ITSELF: the seed writes "191 docs" on one
  // line and "369 docs" thirty lines later, with the gate reading neither
  // file. Both are the same derived number, so both are entries.
  {
    file: "docs/SCHEMA-V2.md",
    what: "seeded question count (the seed description)",
    re: /into `v2_questions` \((\d+) docs/,
    actual: seededQuestions,
    fix: (n) => `"into \`v2_questions\` (${n} docs"`,
  },
  {
    file: "docs/SCHEMA-V2.md",
    what: "seeded question count (the cache description)",
    re: /The question bank \((\d+) docs\)/,
    actual: seededQuestions,
    fix: (n) => `"The question bank (${n} docs)"`,
  },
  {
    file: "docs/SCHEMA-V2.md",
    what: "rules tests (the testing section)",
    re: /test:rules` — (\d+) rules tests/,
    actual: rulesTests,
    fix: (n) => `"test:rules\` — ${n} rules tests"`,
  },
  // COSTS.md was covered by nothing until D67, which is how it came to
  // quote a 369-document bank for two promotion cycles after the bank
  // reached 389. It is the largest body of hand-maintained numbers in the
  // repo, and most of them cannot be gated here — a dollar figure is an
  // output of scripts/cost-model.mjs, and re-deriving it in this script
  // would be a second copy of the model, which is the thing cost-arith.mjs
  // exists to prevent. These two are the INPUTS: they come from the tree
  // rather than from the model, they move on their own every promotion
  // cycle, and they are what the cold-boot row is computed from.
  {
    file: "docs/COSTS.md",
    what: "the question bank's document count (the cold-boot row)",
    re: /\*\*\+(\d+) reads\*\* — the whole question bank/,
    actual: seededQuestions,
    fix: (n) => `"**+${n} reads** — the whole question bank"`,
  },
  {
    file: "docs/COSTS.md",
    what: "the question bank's wire size",
    re: /(\d+\.\d) KiB of JSON/,
    actual: bankKiB,
    // toFixed(1), not the bare number: the pattern above REQUIRES a decimal
    // place, so when the rounded size lands on a whole number (125.0 prints
    // as "125") the advice would otherwise name a sentence this script then
    // cannot find. A gate whose suggested fix fails the gate is worse than
    // a gate that just says no.
    fix: (n) => `"${n.toFixed(1)} KiB of JSON"`,
  },
  // The four below were quoting 399 while the bank ran 463, and every one
  // of them sat NEXT TO a figure this script already held — the cold-boot
  // row states the count twice in one table cell, and the gate read the
  // first half only. That is the same staleness the header describes,
  // caught in the same file the gate was already open in, which is the
  // argument for widening the read rather than trusting the neighbouring
  // sentence to be noticed.
  {
    file: "docs/COSTS.md",
    what: "the question bank's document count (the cold-boot row, second half)",
    re: /`V2_QUESTIONS`, (\d+) docs/,
    actual: seededQuestions,
    fix: (n) => `"\`V2_QUESTIONS\`, ${n} docs"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the App Privacy row count (4.4, the nutrition label)",
    re: /you copy it across: \*\*(\d+) data types\*\*/,
    actual: String(appPrivacyRows),
    fix: (n) => `"you copy it across: **${n} data types**"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the shipped version (5.6, version lockstep)",
    re: /holds at (\d+\.\d+\.\d+) build \d+/,
    actual: appPkg.version,
    fix: (v) => `"holds at ${v} build ${appPkg.appBuild}"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the shipped build number (5.6, version lockstep)",
    re: /holds at \d+\.\d+\.\d+ build (\d+)/,
    actual: String(appPkg.appBuild),
    fix: (n) => `"holds at ${appPkg.version} build ${n}"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the bank size the un-run reseed is measured against",
    re: /and the bank is \*\*(\d+)\*\*/,
    actual: seededQuestions,
    fix: (n) => `"and the bank is **${n}**"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "seeded questions (the k-floor note in the on-device walk)",
    // Wrap-tolerant like the status-header entry above: the count and the
    // words after it sit on different lines, and D81's rewording of this
    // paragraph moved the break. A gate that a reflow can silence is one
    // that goes quiet exactly when the prose around a figure changes.
    re: /the (\d+)\s*\n?\s*seeded questions are/,
    actual: seededQuestions,
    fix: (n) => `"the ${n} seeded questions are"`,
  },
  {
    file: "docs/SHIP-CHECKLIST.md",
    what: "the bank refetch a reseed used to cost",
    re: /a (\d+)-read\s*\n?\s*bank refetch/,
    actual: seededQuestions,
    fix: (n) => `"a ${n}-read bank refetch"`,
  },
  // The three D97 budget figures the farm manual quotes. They live in
  // scripts/farm-budget.mjs (with the reasoning that produced them) and
  // are quoted in QUESTION-FARM.md § Picking topics; retuning one there
  // without the other would hand the scheduled runs a budget the
  // regulator does not compute.
  {
    file: "docs/QUESTION-FARM.md",
    what: "the daily lane's per-run cap (RUN_CAP)",
    re: /up to \*\*(\d+) questions per run\*\*/,
    actual: budgetConst("RUN_CAP"),
    fix: (n) => `"up to **${n} questions per run**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the unpromoted-pen target (PEN_TARGET)",
    re: /pen target of \*\*(\d+)\*\*/,
    actual: budgetConst("PEN_TARGET"),
    fix: (n) => `"pen target of **${n}**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the open-PR review ceiling (OPEN_MAX)",
    re: /\*\*(\d+)\*\* unreviewed questions on the lane's open PR/,
    actual: budgetConst("OPEN_MAX"),
    fix: (n) => `"**${n}** unreviewed questions on the lane's open PR"`,
  },
  // The D212 promotion pace — the number that replaced a person's reading as
  // what the daily regulator's steady state tracks. A drifted figure here
  // would tell a run to promote at a pace the arithmetic was not sized for.
  {
    file: "docs/QUESTION-FARM.md",
    what: "the daily lane's per-run promotion pace (PROMOTE_PACE)",
    // Wrap-tolerant like the learn/feed entries: the sentence breaks lines.
    re: /promotes up to \*\*(\d+) pen questions per\s*\n?\s*run\*\*/,
    actual: budgetConst("PROMOTE_PACE"),
    fix: (n) => `"promotes up to **${n} pen questions per run**"`,
  },
  // The four D115 learn-lane figures, quoted in § The learn-card lane.
  {
    file: "docs/QUESTION-FARM.md",
    what: "the learn lane's per-run cap (RUN_CAP)",
    re: /up\s*\n?\s*to \*\*(\d+) cards per run\*\*/,
    actual: learnConst("RUN_CAP"),
    fix: (n) => `"up to **${n} cards per run**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the learn per-field depth target (FIELD_TARGET)",
    re: /\*\*(\d+) cards per\s*\n?\s*field\*\*/,
    actual: learnConst("FIELD_TARGET"),
    fix: (n) => `"**${n} cards per field**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the learn open-PR review ceiling (OPEN_MAX)",
    re: /\*\*(\d+)\*\* unreviewed cards on\s*\n?\s*that PR/,
    actual: learnConst("OPEN_MAX"),
    fix: (n) => `"**${n}** unreviewed cards on that PR"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the learn per-field minimum batch (MIN_CHUNK)",
    re: /at least \*\*(\d+) cards into any field it touches\*\*/,
    actual: learnConst("MIN_CHUNK"),
    fix: (n) => `"at least **${n} cards into any field it touches**"`,
  },
  // The three feed-lane figures, quoted in § The feed lane. Same reasoning as
  // the other two lanes': the section is what a scheduled run obeys, so a cap
  // drifted there hands the run a budget feed-budget.mjs does not compute.
  {
    file: "docs/QUESTION-FARM.md",
    what: "the feed lane's per-run cap (RUN_CAP)",
    // "feed questions", not "questions": the daily lane's own RUN_CAP sentence
    // reads "up to **8 questions per run**" and appears first in the file, so
    // a shared pattern would silently check the feed's cap against the daily's
    // number. Distinct figures need distinct sentences.
    re: /\*\*(\d+) feed questions per run\*\*/,
    actual: feedConst("RUN_CAP"),
    fix: (n) => `"**${n} feed questions per run**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the feed per-topic breadth target (TOPIC_TARGET)",
    re: /\*\*(\d+)\s*\n?\s*servable questions per\s*\n?\s*topic\*\*/,
    actual: feedConst("TOPIC_TARGET"),
    fix: (n) => `"**${n} servable questions per topic**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the feed open-PR review ceiling (OPEN_MAX)",
    re: /\*\*(\d+)\*\* unreviewed questions on\s*\n?\s*that PR/,
    actual: feedConst("OPEN_MAX"),
    fix: (n) => `"**${n}** unreviewed questions on that PR"`,
  },
  // The three duel-lane figures (D213), quoted in § The duel lane.
  {
    file: "docs/QUESTION-FARM.md",
    what: "the duel lane's per-run cap (RUN_CAP)",
    re: /up to \*\*(\d+) duel questions per run\*\*/,
    actual: duelConst("RUN_CAP"),
    fix: (n) => `"up to **${n} duel questions per run**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the duel per-pool depth target (POOL_TARGET)",
    re: /\*\*(\d+) questions per\s*\n?\s*pool\*\*/,
    actual: duelConst("POOL_TARGET"),
    fix: (n) => `"**${n} questions per pool**"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the duel open-PR review ceiling (OPEN_MAX)",
    re: /\*\*(\d+)\*\* unreviewed duel questions on\s*\n?\s*that PR/,
    actual: duelConst("OPEN_MAX"),
    fix: (n) => `"**${n}** unreviewed duel questions on that PR"`,
  },
  // The two Crossroads ceilings, quoted in § Crossroads stories. Not budget
  // figures like the eleven above but the same failure: the section is what
  // a run writing a story obeys, and a manual quoting a longer ceiling than
  // the gate enforces sends 38 hand-authored strings into a gate that
  // refuses them — the most expensive thing in the lane to redo.
  {
    file: "docs/QUESTION-FARM.md",
    what: "the ending-name ceiling a story is written to (OPTION_MAX)",
    re: /`OPTION_MAX`\s*\n?\s*\((\d+) chars\)/,
    actual: qualityConst("OPTION_MAX"),
    fix: (n) => `"\`OPTION_MAX\` (${n} chars)"`,
  },
  {
    file: "docs/QUESTION-FARM.md",
    what: "the fork-choice ceiling a story is written to (PATH_CHOICE_MAX)",
    re: /`PATH_CHOICE_MAX`\s*\n?\s*\((\d+) chars\)/,
    actual: qualityConst("PATH_CHOICE_MAX"),
    fix: (n) => `"\`PATH_CHOICE_MAX\` (${n} chars)"`,
  },
];

const errors = [];
for (const fig of FIGURES) {
  const m = read(fig.file).match(fig.re);
  if (!m) {
    errors.push(
      `${fig.file}: could not find the sentence quoting ${fig.what}\n`
      + `    (pattern ${fig.re}).\n`
      + "    If the figure is no longer quoted there, delete its entry from\n"
      + "    FIGURES in this script rather than restoring the sentence.",
    );
    continue;
  }
  // Numeric by default, because every figure here was one until the
  // version pair arrived: "2.0.0" through Number() is NaN, which compares
  // unequal to everything and would have reported a permanently wrong
  // figure as permanently wrong. An entry declares its own type by what it
  // puts in `actual`.
  const claimed = typeof fig.actual === "string" ? m[1] : Number(m[1]);
  if (claimed !== fig.actual) {
    errors.push(
      `${fig.file} states ${claimed} for ${fig.what}; the tree has ${fig.actual}.\n`
      + `    Correct the sentence to: ${fig.fix(fig.actual)}.`,
    );
  }
}

// The heading's number is only half the claim: the TABLE under it has to
// have that many rows. Held here rather than as a FIGURES entry because
// this figure is not written as a word — it is the rows themselves — and
// a heading corrected to "six" over a five-row table is exactly the drift
// D279 is about, one edit short of the fix.
const runnerTable = /\n### 2\. There are [^\n]*\n([\s\S]*?)\n#{2,3} /.exec(read("CLAUDE.md"));
if (!runnerTable) {
  throw new Error(
    "check-figures: CLAUDE.md no longer opens §2 with `### 2. There are …` —\n"
    + "    fix this scan. A gate that cannot find its subject reports zero rows,\n"
    + "    and a figure gate reading zero is worse than no gate.",
  );
}
const runnerRows = runnerTable[1].split("\n")
  .filter((l) => l.startsWith("| `npm run test")).length;
if (runnerRows !== testRunners) {
  errors.push(
    `CLAUDE.md §2's table has ${runnerRows} runner rows; the tree has `
    + `${testRunners} runners.\n`
    + "    Add or remove the ROW, not just the heading — the two are one claim.",
  );
}

if (errors.length) {
  console.error("\ncheck-figures: documented figures no longer match the tree:\n");
  for (const e of errors) console.error(`  ${e}\n`);
  console.error(
    "  Nothing is broken in the code — this is documentation quoting a number\n"
    + "  that has moved, which is the one documentation error this repo keeps\n"
    + "  re-committing. Fix the prose, not this script.",
  );
  process.exit(1);
}

console.log(
  `check-figures OK — ${FIGURES.length} documented figures across `
  + `${sources.size} files match the tree `
  + `(rules tests: ${rulesTests}; questions: ${seededQuestions}, `
  + `${dailyQuestions} daily).`,
);
