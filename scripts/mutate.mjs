#!/usr/bin/env node
// mutate.mjs — break the code on purpose, and see whether the tests notice.
//
// WHY THIS EXISTS. This tree has 48 gates and 5,100 tests, and the honest
// question about all of them is the one nothing here could answer: do they
// FAIL when the code is wrong? A suite that runs, passes and asserts
// nothing looks exactly like a suite that guards the invariant — in CI, in
// coverage, and in a review. The only instrument that can tell them apart
// is a deliberate defect.
//
// It was measured by hand once, on 2026-09-09, over a sample of nine
// source mutants: seven died and two survived. Both survivors sat in files
// that satisfy `check:panel-suites` perfectly — the gate proves a suite
// EXISTS. And `src/v2/README.md` and `docs/ORIENTATION.md` §3 have both
// described `src/v2/ui/` as "one suite each, mutation-checked" for
// months, which was true of the first half and aspirational about the
// second. This file is the second half.
//
// SHAPE: the repo's own idiom, which is a nightly lane plus a shrink-only
// ratchet (check:a11y, check:panel-suites, check:globals rule 4). A run
// takes a handful of mutants from a rotating pool, applies each to ONE
// file, runs only that file's owning suite, and records how many survived.
// The baseline may only go down. It is deliberately NOT a full mutation
// run: a complete sweep of this tree would be tens of thousands of test
// invocations, and the value is in the trend and in the named survivor,
// not in a score.
//
// WHY IT IS NOT A `check:*` SCRIPT. Every gate named `check:*` runs on a
// pull request, and this one must not: it spawns a test runner per mutant,
// so it is minutes rather than seconds, and a survivor is a finding to
// read rather than a reason to block a merge. It runs on a schedule
// (.github/workflows/mutate.yml, docs/ROUTINES.md) and reports.
//
// SAFETY. A mutant is written to the real file and restored in a
// `finally`. That is the only way to run the real suite against it, and it
// is why this refuses to start on a tree with uncommitted changes to any
// file it plans to touch: a crash between write and restore would
// otherwise eat work. `--dry` plans and prints without writing anything.
//
// Run:
//   node scripts/mutate.mjs --seed 2026-09-09        # one night's sample
//   node scripts/mutate.mjs --dry                    # what it would do
//   node scripts/mutate.mjs --seed X --count 3
//   node scripts/mutate.mjs --update-baseline        # after a real fix

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(root, "scripts", "mutation-baseline.json");

// ── the operators ────────────────────────────────────────────────────
//
// Textual, small, and each one a defect a person could plausibly write —
// an off-by-one in a comparison, an inverted guard, a min that should be a
// max. Deliberately NOT clever: a mutation that produces code no reviewer
// would ever write tells you nothing about whether the suite guards real
// mistakes.
//
// Every operator carries `why`, printed with a survivor. "orSure survived
// `>=` → `>`" is a bug report; "mutant 7 survived" is not.
export const OPERATORS = [
  { id: "gte-to-gt", find: ">=", to: ">", why: "an off-by-one at a threshold — the classic boundary defect" },
  { id: "lte-to-lt", find: "<=", to: "<", why: "the same boundary, the other way" },
  { id: "and-to-or", find: " && ", to: " || ", why: "a guard that should require both conditions requiring either" },
  { id: "plus-to-minus", find: " += ", to: " -= ", why: "an accumulator running backwards" },
  { id: "min-to-max", find: "Math.min(", to: "Math.max(", why: "a floor used as a ceiling" },
  { id: "max-to-min", find: "Math.max(", to: "Math.min(", why: "a ceiling used as a floor" },
  { id: "strict-neq", find: " !== ", to: " === ", why: "an inverted equality — the shape a refactor flips by accident" },
];

/** Lines a mutant may never be planted on: comments and imports. A mutated
 *  comment is not a defect, and a suite that fails to notice one is not
 *  telling you anything. */
export function mutableLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
  if (t.startsWith("import ") || t.startsWith("export {") || t.startsWith("} from")) return false;
  return true;
}

/**
 * Every place an operator could be applied to this source.
 *
 * Returns `{ op, line, col }` sites, ordered, so a seed selects the same
 * site on every machine — a mutation run that cannot be reproduced is an
 * anecdote.
 */
export function sitesIn(source, operators = OPERATORS) {
  const out = [];
  const lines = source.split("\n");
  lines.forEach((line, i) => {
    if (!mutableLine(line)) return;
    for (const op of operators) {
      let from = 0;
      for (;;) {
        const at = line.indexOf(op.find, from);
        if (at < 0) break;
        out.push({ op: op.id, line: i, col: at });
        from = at + 1;
      }
    }
  });
  return out;
}

/** Apply one site to the source, returning the mutated text. */
export function applyMutant(source, site, operators = OPERATORS) {
  const op = operators.find((o) => o.id === site.op);
  if (!op) throw new Error(`unknown operator ${site.op}`);
  const lines = source.split("\n");
  const line = lines[site.line];
  if (line.slice(site.col, site.col + op.find.length) !== op.find) {
    throw new Error(`site ${site.op}@${site.line}:${site.col} no longer matches — the file moved under the plan`);
  }
  lines[site.line] = line.slice(0, site.col) + op.to + line.slice(site.col + op.find.length);
  return lines.join("\n");
}

// ── choosing what to mutate ──────────────────────────────────────────

/**
 * A deterministic 32-bit hash, so `--seed 2026-09-09` picks the same
 * sample everywhere. `Math.random()` would make a survivor unreproducible,
 * which is the one thing a survivor has to be.
 */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Source files that have a same-name suite beside them — the only files
 *  where a survivor is a statement about a specific suite rather than
 *  about the tree in general. */
export function targetsIn(dirAbs, dirRel) {
  const names = readdirSync(dirAbs);
  const tests = new Set(names.filter((n) => /\.test\.(ts|tsx|js|jsx|mjs)$/.test(n)));
  return names
    .filter((n) => /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && !/\.d\.ts$/.test(n))
    .map((n) => ({
      source: `${dirRel}/${n}`,
      suite: [...tests].find((t) => t.replace(/\.test\.\w+$/, "") === n.replace(/\.\w+$/, "")),
    }))
    .filter((t) => t.suite)
    .map((t) => ({ source: t.source, suite: `${dirRel}/${t.suite}` }));
}

const SEARCH_DIRS = ["src/v2/data", "src/v2/ui", "functions/src"];

export function allTargets(rootDir = root) {
  const out = [];
  for (const d of SEARCH_DIRS) {
    const abs = join(rootDir, d);
    if (existsSync(abs)) out.push(...targetsIn(abs, d));
  }
  return out.sort((a, b) => (a.source < b.source ? -1 : 1));
}

/**
 * The night's sample: `count` (target, site) pairs chosen by the seed.
 *
 * Spread ACROSS targets rather than drilling into one — the question is
 * "which suites are asleep", and four mutants in one file answers it for
 * one file.
 */
export function planRun({ targets, seed, count, readSource }) {
  const plan = [];
  const n = targets.length;
  if (!n) return plan;
  for (let i = 0; i < count; i++) {
    const t = targets[hash(`${seed}:${i}`) % n];
    const src = readSource(t.source);
    const sites = sitesIn(src);
    if (!sites.length) continue;
    plan.push({ ...t, site: sites[hash(`${seed}:${i}:site`) % sites.length] });
  }
  return plan;
}

// ── the run ──────────────────────────────────────────────────────────

function isEntry() {
  return process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  // AN EMPTY VALUE IS NOT A FLAG, and the whole lane turned on it. The
  // scheduled workflow passes `--seed "${{ inputs.seed || '' }}"`, and a
  // cron run has no inputs — so the seed arrived as `""`, which is falsy,
  // which fell to the bare-flag branch and returned the BOOLEAN true. The
  // caller then did `String(arg("seed", <today>))` and got the literal
  // string "true": the same seed every night, so the "handful of mutants
  // from a rotating pool, seeded by the date" that this file's header
  // describes was one frozen sample of five sites out of the thousands
  // the planner can see, re-run nightly for as long as the lane has
  // existed, printing "0 survivors" about coverage it never touched.
  // The date fallback had never once been reached.
  if (next !== undefined && !next.startsWith("--")) return next === "" ? fallback : next;
  return true;
}

function dirtyFiles() {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })
      .split("\n").filter(Boolean).map((l) => l.slice(3).trim());
  } catch {
    return [];
  }
}

function runSuite(suite) {
  const inFunctions = suite.startsWith("functions/");
  const cwd = inFunctions ? join(root, "functions") : root;
  const rel = inFunctions ? relative("functions", suite) : suite;
  try {
    execFileSync("npx", ["vitest", "run", rel], {
      cwd, stdio: "pipe", encoding: "utf8",
      env: { ...process.env, LC_ALL: "en_US.UTF-8", CI: "1" },
      timeout: 10 * 60_000,
    });
    return "SURVIVED"; // the suite passed with a defect in place
  } catch {
    return "KILLED";
  }
}

if (isEntry()) {
  const seed = String(arg("seed", new Date().toISOString().slice(0, 10)));
  const count = Number(arg("count", 5));
  const dry = !!arg("dry", false);
  const update = !!arg("update-baseline", false);

  const targets = allTargets();
  const plan = planRun({
    targets, seed, count,
    readSource: (p) => readFileSync(join(root, p), "utf8"),
  });

  // THE VACUITY FLOOR. This is the one instrument in the tree that can
  // answer "do the suites fail when the code is wrong", and every way it
  // can find nothing to do looks exactly like a clean run: a renamed
  // SEARCH_DIRS entry, a planner that stops matching, a count of zero.
  // It would print "mutate OK — 0 survivor(s)" and exit 0, which is the
  // D179/D197/D275 class this repo has been bitten by three times, in a
  // script written the same day as scripts/lib/compare.mjs, whose own
  // header says "THE VACUITY FLOOR IS NOT OPTIONAL". The floors are the
  // two the run cannot be honest without: something to mutate, and a
  // plan to run.
  if (!targets.length) {
    console.error(
      "mutate REFUSES to run: no suited source file found at all.\n"
      + `  Searched ${SEARCH_DIRS.join(", ")} for a .ts/.tsx with a sibling suite.\n`
      + "  A moved source root or a changed test-file convention reads exactly\n"
      + "  like a clean night from here, which is what this refusal is for.",
    );
    process.exit(2);
  }
  if (!plan.length) {
    console.error(
      `mutate REFUSES to run: ${targets.length} suited file(s) and an EMPTY plan.\n`
      + "  Either --count is zero or the planner found no mutable site. Both mean\n"
      + "  this run would prove nothing and say so as a pass.",
    );
    process.exit(2);
  }

  console.log(`mutate — seed ${seed}, ${plan.length} mutant(s) over ${targets.length} suited file(s)\n`);

  if (dry) {
    for (const m of plan) {
      const op = OPERATORS.find((o) => o.id === m.site.op);
      console.log(`  ${m.source}:${m.site.line + 1}  ${op.find} → ${op.to}   (${m.suite})`);
    }
    process.exit(0);
  }

  const dirty = new Set(dirtyFiles());
  const blocked = plan.filter((m) => dirty.has(m.source));
  if (blocked.length) {
    console.error(
      "mutate REFUSES to run: it writes a defect into the real file and restores it in a\n"
      + "finally, so a crash mid-run would eat uncommitted work. Commit or stash these first:\n"
      + blocked.map((m) => `  ${m.source}`).join("\n"),
    );
    process.exit(2);
  }

  const results = [];
  for (const m of plan) {
    const abs = join(root, m.source);
    const original = readFileSync(abs, "utf8");
    const op = OPERATORS.find((o) => o.id === m.site.op);
    let verdict = "ERROR";
    try {
      writeFileSync(abs, applyMutant(original, m.site));
      verdict = runSuite(m.suite);
    } catch (err) {
      verdict = `ERROR (${err.message})`;
    } finally {
      writeFileSync(abs, original);
    }
    results.push({ ...m, verdict, op });
    const mark = verdict === "KILLED" ? "killed " : verdict === "SURVIVED" ? "SURVIVED" : "error  ";
    console.log(`  ${mark}  ${m.source}:${m.site.line + 1}  ${op.find} → ${op.to}`);
  }

  const survivors = results.filter((r) => r.verdict === "SURVIVED");
  console.log(`\n  ${results.length - survivors.length} killed, ${survivors.length} survived\n`);
  for (const s of survivors) {
    console.log(
      `  SURVIVOR  ${s.source}:${s.site.line + 1}\n`
      + `    ${s.op.find} → ${s.op.to} — ${s.op.why}\n`
      + `    ${s.suite} passed with that defect in place. Either the line is not\n`
      + `    reachable from the suite, or it is reached and never asserted on.\n`
      + `    Reproduce: node scripts/mutate.mjs --seed ${seed} --count ${count} --dry\n`,
    );
  }

  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : { survivors: 0 };
  if (update) {
    writeFileSync(BASELINE, `${JSON.stringify({ ...base, survivors: survivors.length }, null, 2)}\n`);
    console.log(`baseline updated to ${survivors.length}`);
    process.exit(0);
  }
  if (survivors.length > base.survivors) {
    console.error(
      `mutate: ${survivors.length} survivor(s) against a baseline of ${base.survivors}.\n`
      + "  A survivor is a suite that passed while its subject was wrong. Fix the\n"
      + "  suite — raising the baseline is the one repair that is never right,\n"
      + "  because the number is the whole instrument.",
    );
    process.exit(1);
  }
  console.log(`mutate OK — ${survivors.length} survivor(s), baseline ${base.survivors}.`);
}
