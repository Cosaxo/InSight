#!/usr/bin/env node
// check-account-level — firestore.rules' bar equals the source of truth.
//
// WHY. D338 made the account requirement a LEVEL so the bar can be raised
// by changing one number. That number now lives in two files that cannot
// import each other: `REQUIRED_LEVEL` in functions/src/accountLevel.ts,
// which the callable and every report read, and `requiredAccountLevel()`
// in firestore.rules, which is what actually refuses a write.
//
// Two numbers that must agree and live in different files are two numbers
// that will not agree. And the failure is asymmetric and silent BOTH ways:
// raise the rules and not the source, and reports say accounts qualify
// while their votes are being refused; raise the source and not the rules,
// and the bar you believe you set is not the bar being enforced.
//
// Neither shows up in any test — the rules tests construct their own
// claims, and the callable's tests never read the rules file.
import { readFileSync } from "node:fs";

const RULES = "firestore.rules";
const SOURCE = "functions/src/accountLevel.ts";

export function rulesLevel(rulesSrc) {
  const m = rulesSrc.match(/function\s+requiredAccountLevel\(\)\s*\{\s*return\s+(\d+)\s*;\s*\}/);
  return m ? Number(m[1]) : null;
}

export function sourceLevel(tsSrc) {
  const m = tsSrc.match(/export\s+const\s+REQUIRED_LEVEL\s*=\s*(\d+)\s*;/);
  return m ? Number(m[1]) : null;
}

/**
 * Levels the ladder actually defines, so the bar cannot name a rung that
 * does not exist.
 *
 * Deliberately NOT anchored to the start of a line: the first version was
 * `/^\s*level:\s*(\d+),/gm`, which reads the file only while each entry
 * stays formatted one field per line. A formatter collapsing those object
 * literals would have made the ladder unreadable to this gate — the
 * "parser has drifted" arm below would fire, loudly, but on a change that
 * broke nothing. `\blevel:` plus a digit cannot match `levelFor`,
 * `levelDef` or the interface's `level: number`.
 */
export function definedLevels(tsSrc) {
  return [...tsSrc.matchAll(/\blevel:\s*(\d+)/g)].map((m) => Number(m[1]));
}

export function checkAccountLevel(read = (p) => readFileSync(p, "utf8")) {
  const problems = [];
  const rules = read(RULES);
  const source = read(SOURCE);

  const rl = rulesLevel(rules);
  const sl = sourceLevel(source);
  const levels = definedLevels(source);

  // A missing match is the dangerous case, not a soft one: it means this
  // gate is reading nothing and would pass forever.
  if (rl === null) problems.push(`${RULES}: requiredAccountLevel() not found — this gate cannot see the enforced bar`);
  if (sl === null) problems.push(`${SOURCE}: REQUIRED_LEVEL not found — this gate cannot see the intended bar`);
  if (levels.length === 0) problems.push(`${SOURCE}: no ACCOUNT_LEVELS entries found — the ladder parser has drifted`);
  if (problems.length) return problems;

  if (rl !== sl) {
    problems.push(
      `bar mismatch: ${RULES} enforces >= ${rl}, ${SOURCE} says REQUIRED_LEVEL = ${sl}. `
      + `Whichever is lower is the real bar, and the other file is a belief nobody is holding.`,
    );
  }
  if (!levels.includes(sl)) {
    problems.push(`${SOURCE}: REQUIRED_LEVEL = ${sl} is not a level ACCOUNT_LEVELS defines (${levels.join(", ")})`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkAccountLevel();
  if (problems.length) {
    console.error("check:account-level FAILED:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const lvl = sourceLevel(readFileSync(SOURCE, "utf8"));
  console.log(`check:account-level OK — rules and accountLevel.ts agree the bar is ${lvl}.`);
}
