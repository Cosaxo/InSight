#!/usr/bin/env node
// rules-coverage.mjs — a conjunct the rules suite cannot see going dark.
//
// WHAT IT MEASURES. The Firestore emulator records, for every expression in
// firestore.rules, how many times it evaluated to each value. An atomic
// boolean predicate that never once evaluated FALSE across the whole suite
// is one the suite cannot tell is still doing anything: delete it and every
// test still passes. That is not a hypothesis. Two were confirmed by
// mutation on this tree:
//
//   firestore.rules `isCatalogAnswer`'s `type == "catalog"` — true 5 times,
//     false 0. Deleted, the suite stayed 179/179 green, and an entity
//     answer could then land on any of 291 active feed questions. The test
//     that names the case was refused one clause earlier by `surface`, so
//     it never reached the one it named. Closed 2026-09-06.
//   `v2_flags`' avatar-arm field allowlist — true 14, false 0. Removed, the
//     suite stayed green, leaving that collection writable with arbitrary
//     fields by any signed-in user.
//
// A POSITIVE CONTROL in the same run (opening `v2_presence`'s `allow read:
// if false`) reddened three tests, so those green results were the suite's
// and not a broken run.
//
// WHY A RATCHET AND NOT A FLOOR. Ninety-odd predicates are in this state
// today. Most are probably fine — a `hasOnly` on a shape no test bothers to
// violate is uncovered, not wrong — and demanding a negative test for each
// one tonight would be a week of work and a lot of tests written to satisfy
// a number. What is worth holding is the DIRECTION: a new rule arriving
// with no negative case makes the count go up, and that fails here. Same
// instrument as check:globals rule 4, and the same rule about the other
// direction: covering one lowers the number, which also fails, asking for
// the baseline to come down with it.
//
// WHY IT LIVES INSIDE test:rules. The report only exists while the emulator
// that ran the suite is still up, so this cannot be a `check:*` in the lint
// job — it runs in the same `emulators:exec` as the suite, after it.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(root, "scripts", "rules-coverage-baseline.json");

/**
 * Every atomic boolean predicate in the report, keyed by source range.
 *
 * The emulator's `report` is a tree: each node carries a `sourcePosition`
 * and the `values` it took, with `children` for its sub-expressions. A node
 * whose values are booleans is a predicate; the leaves under it are the
 * operands (strings, nulls, numbers), which is why this keeps boolean nodes
 * rather than leaf nodes.
 *
 * Keyed by `currentOffset:endOffset` so the same expression reached through
 * two paths counts once.
 *
 * @param {{report: unknown[]}} data the parsed coverage payload
 */
export function booleanAtoms(data) {
  const out = new Map();
  const isBool = (node) => {
    const vals = Array.isArray(node?.values) ? node.values : [];
    return vals.some((v) => v && v.value && "boolValue" in v.value);
  };
  // ATOMIC means no boolean SUB-expression. `a && b` evaluates to a boolean
  // too, and counting it would count the same conjunct twice and inflate the
  // total — 681 against 353 when this was first written, which is the whole
  // `&&`/`||` chain double-counted. The claim the ratchet rests on is
  // precise: delete this predicate and every test still passes. That is only
  // true of the leaves.
  const hasBoolChild = (node) =>
    (node.children || []).some((c) => isBool(c) || hasBoolChild(c));
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const pos = node.sourcePosition;
    if (pos && isBool(node) && !hasBoolChild(node)) {
      const key = `${pos.currentOffset}:${pos.endOffset}`;
      const prev = out.get(key) || { line: pos.line, t: 0, f: 0 };
      for (const b of node.values) {
        if (!b || !b.value || !("boolValue" in b.value)) continue;
        if (b.value.boolValue) prev.t += b.count || 0;
        else prev.f += b.count || 0;
      }
      out.set(key, prev);
    }
    for (const c of node.children || []) walk(c);
  };
  for (const n of data.report || []) walk(n);
  return out;
}

/** Those that never once evaluated false — the ones a deletion would hide. */
export function neverFalse(atoms) {
  return [...atoms.entries()]
    .filter(([, v]) => v.f === 0)
    .map(([k, v]) => ({ range: k, line: v.line, t: v.t }))
    .sort((a, b) => a.line - b.line);
}

/**
 * The ratchet's verdict. Pure, so the test can drive it without an emulator.
 *
 * @returns {{ok: boolean, message: string}}
 */
export function verdict(count, total, baseline) {
  if (count > baseline) {
    return {
      ok: false,
      message:
        `rules-coverage: ${count} atomic predicates never evaluate FALSE, baseline ${baseline}.\n`
        + "  A new rule arrived without a test that makes it refuse, or a test that\n"
        + "  used to exercise one stopped. Either way the suite can no longer tell\n"
        + "  those conjuncts are doing anything — delete one and it stays green.\n"
        + "  Add the negative case, or raise the baseline deliberately with the\n"
        + "  reason, the way check:globals rule 4 is raised.",
    };
  }
  if (count < baseline) {
    return {
      ok: false,
      message:
        `rules-coverage: ${count} never-false predicates, baseline ${baseline} — it went DOWN.\n`
        + `  Good. Lower the baseline to ${count} so it cannot drift back up:\n`
        + "      npm run test:rules:baseline\n"
        + "  A ratchet that is not tightened is a ratchet that only ever loosens.",
    };
  }
  return { ok: true, message: `rules-coverage OK — ${count} of ${total} atomic predicates never evaluate false (baseline ${baseline})` };
}

// ── the run ──────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const project = process.env.RULES_COVERAGE_PROJECT || "insight-rules-test";
  const url = `http://${host}/emulator/v1/projects/${project}:ruleCoverage.html`;

  let html;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    // Loud, not skipped. A coverage gate that shrugs when it cannot read the
    // report is the vacuous gate this file exists to prevent.
    console.error(
      `rules-coverage: could not read the coverage report at ${url}\n`
      + `    ${e.message}\n`
      + "    It runs inside the emulators:exec that ran the suite, so the emulator\n"
      + "    should still be up. If the port or project id moved, fix them here.",
    );
    process.exit(1);
  }

  const a = html.indexOf("const data = ");
  const b = html.indexOf("\n};", a);
  if (a === -1 || b === -1) {
    console.error(
      "rules-coverage: the report is no longer `const data = {…};` in a <script>.\n"
      + "    firebase-tools changed its shape. Fix this parser rather than\n"
      + "    dropping the check.",
    );
    process.exit(1);
  }
  const data = JSON.parse(html.slice(a + "const data = ".length, b + 2));
  const atoms = booleanAtoms(data);
  const never = neverFalse(atoms);

  if (!atoms.size) {
    console.error(
      "rules-coverage: the report carries no boolean predicates at all.\n"
      + "    That means the suite did not run against this emulator, or the\n"
      + "    report shape changed. Either way this is not a pass.",
    );
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")).neverFalse;
  if (process.argv.includes("--update-coverage-baseline")) {
    writeFileSync(BASELINE, `${JSON.stringify({ neverFalse: never.length }, null, 2)}\n`);
    console.log(`rules-coverage: baseline written — ${never.length}`);
    process.exit(0);
  }

  const v = verdict(never.length, atoms.size, baseline);
  if (!v.ok) {
    console.error(`\n${v.message}\n`);
    console.error("  Lines with no false evaluation:");
    for (const n of never.slice(0, 12)) console.error(`    firestore.rules:${n.line}  (true ${n.t}×)`);
    if (never.length > 12) console.error(`    …and ${never.length - 12} more`);
    process.exit(1);
  }
  console.log(v.message);
}
