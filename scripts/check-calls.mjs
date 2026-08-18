#!/usr/bin/env node
// check-calls.mjs — the CALL surface's two gates (D194, docs/FORESIGHT-CALLS.md).
//
// A resolved call is the one number in this app a reader cannot recompute
// from the app's own documents — unless the grade is arithmetic over an
// aggregate that already publishes, which is exactly what tier A is. This
// script is what keeps that true, and it holds two things:
//
//   1 · THE TWO RUBRIC COPIES ARE BYTE-IDENTICAL.
//       src/v2/data/callRubric.ts is the source; functions/src/callRubric.ts
//       is the deployable copy (functions/tsconfig compiles only its own
//       src/, so a cross-package import cannot reach the deploy bundle).
//       The resolver grades server-side and the CARD RE-GRADES on the
//       device from the published inputs, printing whether the two agree —
//       so a drifted copy would not just mis-grade, it would make the app
//       contradict itself on screen. Same arrangement and same reason as
//       check-logic-sync (D57).
//
//   2 · EVERY AUTHORED RUBRIC IS EXECUTABLE, AND DECIDABLE.
//       FORESIGHT-CALLS §3: "a rubric that cannot be executed today will
//       not work in May either", so a call is admitted only if the grader
//       can already run it. CI has no production aggregate to run against,
//       so the dry run here is the honest offline equivalent and it is
//       STRONGER than one provisional execution: each rubric is run twice,
//       against a synthetic snapshot shaped to make it true and one shaped
//       to make it false, and BOTH branches must come back. A rubric that
//       can only ever return one answer is not a prediction — it is a
//       sentence with a known ending — and that is the failure this half
//       catches. The wiring faults (an unknown test, a target that does not
//       exist, a dim nothing folds) fall out of the same pass.
//
// WHAT IT CANNOT CHECK, stated so nobody reads a green run as more than it
// is: whether the answer is UNKNOWN at serving time. That is a claim about
// production data — a call on a threshold the target question has already
// crossed is a lookup wearing a prediction's clothes — and content/
// call-questions.json's authoring notes carry it as rule 4, for a human.
//
// Runs on the deploy path (backend-checks.yml), because the bank it reads
// is the bank seedContentV2 compiles in.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildEntries } from "./gen-v2content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "src/v2/data/callRubric.ts";
const COPY = "functions/src/callRubric.ts";

const errors = [];

// ── 1 · the two copies ──────────────────────────────────────────
const src = readFileSync(resolve(root, SOURCE), "utf8");
const copy = readFileSync(resolve(root, COPY), "utf8");
if (src !== copy) {
  console.error(
    `check:calls FAILED — ${COPY} differs from ${SOURCE}.\n`
    + `The device would re-grade a published outcome with different arithmetic\n`
    + `than the resolver used, and the card prints that disagreement.\n`
    + `Fix: cp ${SOURCE} ${COPY}   (edit the source copy, never the functions one)`,
  );
  process.exit(1);
}

// ── the modules ─────────────────────────────────────────────────
//
// Imported rather than text-parsed, because half of this gate is EXECUTION
// — the point is to run the shipped arithmetic, and a re-implementation
// here would be the drift the module exists to prevent. Node ≥22.18 strips
// the types on import; functions/package.json is deliberately CommonJS, so
// pure.ts's import is the one that needs the warning silenced (the npm
// script names that flag, and names only that one).
let rubricMod;
let pureMod;
try {
  rubricMod = await import(pathToFileURL(resolve(root, SOURCE)).href);
  pureMod = await import(pathToFileURL(resolve(root, "functions/src/pure.ts")).href);
} catch (e) {
  console.error(
    `check:calls: could not load the rubric arithmetic (${e.message}).\n`
    + "This gate imports TypeScript directly and needs Node ≥22.18 (or the\n"
    + "--experimental-strip-types flag on 22.6–22.17).",
  );
  process.exit(1);
}
const { CALL_TESTS, evalRubric, rubricFault, snapshotFor, CALL_YES, CALL_NO } = rubricMod;
const { BREAKDOWN_DIMS, BREAKDOWN_DIM_VOCAB, breakdownBucket } = pureMod;

// ── the bank ────────────────────────────────────────────────────
let entries;
try {
  entries = buildEntries();
} catch (e) {
  console.error(`check:calls: ${e.message}`);
  process.exit(1);
}
const byId = new Map(entries.map((q) => [q.id, q]));
const calls = entries.filter((q) => q.surface === "call");

// Surfaces whose answers fold into `v2_question_aggs/{qid}` under the
// question's OWN id — the only documents a tier-A rubric can read. Duel
// answers publish under `duel-{qid}` and pulse answers under
// `{qid}_{day}`, so a rubric naming one of those would never find a
// document and would sit unresolved until the overdue rule voided it. The
// list mirrors firestore.rules' isWorldAnswer surface set.
const AGGREGATING = new Set(["daily", "feed", "test", "learn"]);

/**
 * Two snapshots for one rubric: one that should grade YES, one NO.
 *
 * Built from the TARGET's real option count, so a rubric written against a
 * five-option question is exercised on five options. Deliberately hand-made
 * rather than derived from evalRubric — a fixture computed by the thing it
 * is testing proves nothing.
 */
function probes(rubric, optionCount) {
  const zero = () => {
    const c = {};
    for (let i = 0; i < optionCount; i++) c[String(i)] = 0;
    return c;
  };
  if (rubric.test === "topShareAtLeast") {
    const yes = zero();
    yes["0"] = 100;
    const no = zero();
    // Spread evenly enough that the top share lands under the threshold,
    // with a clear leader so the tie rule does not swallow the case.
    no["0"] = Math.max(1, Math.ceil((rubric.threshold - 1)));
    no["1"] = 100 - no["0"];
    return [
      { snap: { qid: rubric.qid, total: 100, counts: yes }, want: CALL_YES },
      { snap: { qid: rubric.qid, total: 100, counts: no }, want: CALL_NO },
    ];
  }
  if (rubric.test === "turnoutAtLeast") {
    const one = zero();
    one["0"] = rubric.threshold;
    const few = zero();
    few["0"] = rubric.threshold - 1;
    return [
      { snap: { qid: rubric.qid, total: rubric.threshold, counts: one }, want: CALL_YES },
      { snap: { qid: rubric.qid, total: rubric.threshold - 1, counts: few }, want: CALL_NO },
    ];
  }
  // slicesDisagree: the two named cells lead on different options, then on
  // the same one. Needs at least two options to be able to disagree at all.
  const [a, b] = rubric.buckets;
  const lead = (i) => {
    const c = zero();
    c[String(i)] = 10;
    c[String(i === 0 ? 1 : 0)] = 3;
    return c;
  };
  const counts = zero();
  counts["0"] = 13;
  counts["1"] = 13;
  return [
    { snap: { qid: rubric.qid, total: 26, counts, cells: { [a]: lead(0), [b]: lead(1) } }, want: CALL_YES },
    { snap: { qid: rubric.qid, total: 26, counts, cells: { [a]: lead(0), [b]: lead(0) } }, want: CALL_NO },
  ];
}

for (const q of calls) {
  const at = q.id;
  const r = q.rubric;

  const fault = rubricFault(r);
  if (fault) {
    errors.push(`${at}: ${fault}`);
    continue;
  }

  const target = byId.get(r.qid);
  if (!target) {
    errors.push(`${at}: rubric targets ${r.qid}, which is not in the bank — the grade would have nothing to read`);
    continue;
  }
  if (target.surface === "call") {
    errors.push(`${at}: rubric targets another call (${r.qid}) — a call graded on a call is a grade of a grade`);
    continue;
  }
  if (!AGGREGATING.has(target.surface)) {
    errors.push(
      `${at}: rubric targets ${r.qid} on the ${target.surface} surface, which does not publish `
      + `v2_question_aggs/${r.qid} — nothing would ever resolve it`,
    );
    continue;
  }
  const optionCount = (target.options || []).length;
  if (optionCount < 2) {
    errors.push(`${at}: rubric targets ${r.qid}, which has ${optionCount} option(s) — there is no split to read`);
    continue;
  }

  // A threshold at or under the share the leading option ALWAYS has is a
  // call with one possible answer. Two options can never leave the leader
  // below 50%, so "will it pass 50%?" is a sentence with a known ending.
  if (r.test === "topShareAtLeast" && r.threshold <= 100 / optionCount) {
    errors.push(
      `${at}: topShareAtLeast ${r.threshold}% on a ${optionCount}-option question — the leader is always `
      + `at least ${(100 / optionCount).toFixed(1)}%, so this can only resolve one way`,
    );
    continue;
  }

  if (r.test === "slicesDisagree") {
    if (!BREAKDOWN_DIMS.includes(r.dim)) {
      errors.push(`${at}: dim ${JSON.stringify(r.dim)} is not folded into \`by\` — ${BREAKDOWN_DIMS.join(" · ")}`);
      continue;
    }
    const vocab = BREAKDOWN_DIM_VOCAB[r.dim];
    let bad = false;
    for (const b of r.buckets) {
      if (vocab && !vocab.includes(b)) {
        // A bucket outside the closed vocabulary can never have a cell, so
        // the call would sit unexecutable until the overdue rule voided it
        // — a typo that costs everyone who answered it their guess.
        errors.push(`${at}: bucket ${JSON.stringify(b)} is not a ${r.dim} value — ${vocab.join(" · ")}`);
        bad = true;
      } else if (breakdownBucket(b, r.dim) === null) {
        errors.push(`${at}: bucket ${JSON.stringify(b)} does not survive breakdownBucket — no cell is ever keyed on it`);
        bad = true;
      }
    }
    if (bad) continue;
  }

  // ── the dry run ──
  for (const { snap, want } of probes(r, optionCount)) {
    // snapshotFor is exercised too: it is the half that decides whether the
    // aggregate can answer the rubric at all, and a rubric whose snapshot
    // never narrows is one the resolver would read as "not yet" forever.
    const narrowed = snapshotFor(r, { total: snap.total, counts: snap.counts, by: snap.cells ? { [r.dim]: snap.cells } : undefined });
    if (!narrowed) {
      errors.push(`${at}: snapshotFor returned nothing for a populated aggregate — the rubric can never be executed`);
      break;
    }
    const got = evalRubric(r, narrowed);
    if (got !== want) {
      errors.push(
        `${at}: dry run expected ${want === CALL_YES ? "YES" : "NO"} and got `
        + `${got === null ? "null (unexecutable)" : got === CALL_YES ? "YES" : "NO"}`,
      );
    }
  }
}

// A `tier` the module does not know is a call nothing will grade.
for (const q of calls) {
  if (q.rubric && q.rubric.test && !CALL_TESTS.includes(q.rubric.test)) {
    errors.push(`${q.id}: test ${JSON.stringify(q.rubric.test)} is not one this build can run`);
  }
}

if (errors.length) {
  console.error(`check:calls: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `check:calls OK — ${COPY} is byte-identical to ${SOURCE} (${src.length} bytes); `
  + `${calls.length} call rubric(s) executable and decidable in both directions.`,
);
