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
  const head = "V2_QUESTIONS: V2SeedQuestion[] = ";
  const body = v2content.slice(v2content.indexOf(head) + head.length);
  const arr = JSON.parse(body.slice(0, body.lastIndexOf("];") + 1));
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

// The live k-floor pair, read from the declarations the runtime uses.
// floor.test.ts already pins the CLIENT copies to these and asserts the
// pair moves together; these reads feed the prose entries below, which
// are the claims no test executes.
const v2fnSrc = read("functions/src/v2.ts");
const floorConst = (name) => {
  const m = v2fnSrc.match(new RegExp(`^export const ${name} = (\\d+);`, "m"));
  if (!m) {
    console.error(
      `check-figures: could not read ${name} from functions/src/v2.ts.\n`
      + "    The declaration's shape changed and this scan reads it wrong.\n"
      + "    Fix the scan — a figure gate that silently reads nothing is\n"
      + "    worse than no gate.",
    );
    process.exit(1);
  }
  return Number(m[1]);
};
const aggMinN = floorConst("AGG_MIN_N");
const publishEvery = floorConst("PUBLISH_EVERY");

// Each figure: where it is quoted, how to recompute it, and the exact
// sentence to write when it has moved. The `missing` message matters as
// much as the mismatch one — a gate reading for a sentence that has been
// reworded away is one nobody can satisfy, and the right answer then is to
// delete the entry, not to restore the sentence.
// The D97 budget constants, cross-read from the regulator so the farm
// manual can quote them. QUESTION-FARM.md is LIVE documentation — the
// scheduled runs obey it verbatim — so a drifted budget figure there is
// not a stale doc, it is a mis-instructed run.
const budgetSrc = read("scripts/farm-budget.mjs");
const budgetConst = (name) => {
  const m = budgetSrc.match(new RegExp(`export const ${name} = (\\d+)`));
  if (!m) {
    throw new Error(
      `scripts/farm-budget.mjs no longer declares ${name} — fix this scan, `
      + "a figure gate reading zero is worse than no gate.",
    );
  }
  return Number(m[1]);
};

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
    fix: (n) => `"${n} KiB of JSON"`,
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
  // The paused k-floor (D81), everywhere prose states its live value.
  // data-inventory, MIRROR and SCHEMA-V2 told the truth by discipline;
  // README, COSTS, LOCAL-TESTING and MONETIZATION drifted — the header
  // has the story. Wrap-tolerant where the value and its qualifier sit on
  // different lines, same as the LAUNCH-RUNBOOK entries above.
  {
    file: "README.md",
    what: "the live k-floor (the Honesty section)",
    re: /`AGG_MIN_N` is (\d+) today/,
    actual: aggMinN,
    fix: (n) => `"\`AGG_MIN_N\` is ${n} today" — and if the floor just moved, reword the bullet's pause language with it`,
  },
  {
    // The cell names the pair once; floor.test's coupling test is what
    // guarantees the two constants share a value, so one entry suffices.
    file: "docs/COSTS.md",
    what: "the live k-floor pair (the unit-economics table)",
    re: /`AGG_MIN_N`\/`PUBLISH_EVERY` = (\d+) under D81/,
    actual: aggMinN,
    fix: (n) => `"\`AGG_MIN_N\`/\`PUBLISH_EVERY\` = ${n} under D81"`,
  },
  {
    file: "docs/data-inventory.md",
    what: "the live k-floor (the public-aggregates row)",
    re: /paused to ≥(\d+) pre-launch, D81/,
    actual: aggMinN,
    fix: (n) => `"paused to ≥${n} pre-launch, D81"`,
  },
  {
    file: "docs/MIRROR.md",
    what: "the live k-floor (the floor paragraph)",
    re: /paused to (\d+)\s*\n?\s*until launch traction — D81/,
    actual: aggMinN,
    fix: (n) => `"paused to ${n} until launch traction — D81"`,
  },
  {
    file: "docs/SCHEMA-V2.md",
    what: "the live k-floor (the tooSmall row)",
    re: /\(5 by design; (\d+) under D81's launch pause\)/,
    actual: aggMinN,
    fix: (n) => `"(5 by design; ${n} under D81's launch pause)"`,
  },
  {
    file: "docs/SCHEMA-V2.md",
    what: "the live publish cadence (the counts row)",
    re: /(\d+) under D81's launch pause: clients/,
    actual: publishEvery,
    fix: (n) => `"${n} under D81's launch pause: clients"`,
  },
  {
    file: "docs/LOCAL-TESTING.md",
    what: "the live k-floor (the live-mode walkthrough)",
    re: /k-floor is paused to (\d+) \(D81\)/,
    actual: aggMinN,
    fix: (n) => `"k-floor is paused to ${n} (D81)"`,
  },
  {
    file: "docs/MONETIZATION.md",
    what: "the live k-floor (the pause note)",
    re: /floor is paused to (\d+) pre-launch/,
    actual: aggMinN,
    fix: (n) => `"the floor is paused to ${n} pre-launch"`,
  },
  {
    file: "docs/CATALOG-QUESTIONS.md",
    what: "the live k-floor (the leaderboard reveal)",
    re: /5 by design, paused to (\d+) pre-launch, D81/,
    actual: aggMinN,
    fix: (n) => `"5 by design, paused to ${n} pre-launch, D81"`,
  },
  {
    file: "docs/MONITORING.md",
    what: "the live k-floor (the population panel)",
    re: /Under D81's pause the floor is (\d+)/,
    actual: aggMinN,
    fix: (n) => `"Under D81's pause the floor is ${n}"`,
  },
  {
    file: "docs/DEPLOYMENT.md",
    what: "the live k-floor pair (the fake-ring runbook)",
    re: /both sit at (\d+) under D81's pause/,
    actual: aggMinN,
    fix: (n) => `"both sit at ${n} under D81's pause"`,
  },
  {
    file: "docs/LAUNCH-RUNBOOK.md",
    what: "the live k-floor (the TestFlight step's D81 note)",
    re: /floor sits at (\d+)\s*\n?\s*until launch traction/,
    actual: aggMinN,
    fix: (n) => `"the floor sits at ${n} until launch traction"`,
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
  + `${dailyQuestions} daily; k-floor pair: ${aggMinN}/${publishEvery}).`,
);
