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

if (!seededQuestions || !dailyQuestions) {
  console.error(
    "check-figures: found no questions in functions/src/v2content.ts.\n"
    + "    The file's shape changed and this scan reads it wrong. Fix the scan —\n"
    + "    a figure gate that silently counts zero is worse than no gate.",
  );
  process.exit(1);
}

// Each figure: where it is quoted, how to recompute it, and the exact
// sentence to write when it has moved. The `missing` message matters as
// much as the mismatch one — a gate reading for a sentence that has been
// reworded away is one nobody can satisfy, and the right answer then is to
// delete the entry, not to restore the sentence.
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
  + `(rules tests: ${rulesTests}; questions: ${seededQuestions}, ${dailyQuestions} daily).`,
);
