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
// Adding a figure is one entry in FIGURES below.
//
// It started README-only and grew a `file` field when the launch docs
// began quoting the question-bank size. That was the right moment: those
// counts appear in LAUNCH-RUNBOOK's status header and SHIP-CHECKLIST's
// seed step, and the seed step's number is the one an operator reads to
// decide whether a seed run did what it should.
//
// It grew the k-floor pair after D81 paused it. The pause was scrupulous
// in the app — every floor sentence branches on the constant, gated by
// floor.test — and missed in prose: README kept claiming the design
// floor, under the heading "Honesty is the architecture", which is the
// UI-says-it-server-doesn't failure this product defines itself against,
// committed in documentation instead of UI. The pair's entries hold in
// both directions, so the eventual revert (D81's two-literal edit) fails
// every stale pause sentence instead of trusting someone to remember
// them — the prose half of the enumeration D81 promises.
//
// DECISIONS.md is deliberately NOT covered. Its arithmetic is the state at
// the moment a decision was taken, so a figure there going "stale" is the
// record working — gating it would force rewriting history to satisfy a
// linter. Only live documentation belongs here.
//
// Run: node scripts/check-figures.mjs   (wired into CI's lint job)

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
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
// The style gate's own bounds. These are not a regulator's budget — they are
// what check:quality REFUSES — so a drifted figure here is not a
// mis-instructed run but a run instructed to write something the gate will
// reject after the writing is done.
const qualityConst = constFrom("scripts/question-quality.mjs");

const FIGURES = [
  {
    file: "README.md",
    what: "rules tests (the repo map)",
    re: /—\s*(\d+) emulator tests/,
    actual: rulesTests,
    fix: (n) => `"— ${n} emulator tests"`,
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
  const claimed = Number(m[1]);
  if (claimed !== fig.actual) {
    errors.push(
      `${fig.file} states ${claimed} for ${fig.what}; the tree has ${fig.actual}.\n`
      + `    Correct the sentence to: ${fig.fix(fig.actual)}.`,
    );
  }
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
