#!/usr/bin/env node
// check-account-level — firestore.rules' bar equals the source of truth.
//
// WHY. D342 made the account requirement a LEVEL so the bar can be raised
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
import {
  RULES,
  SOURCE,
  countMet,
  parseLadder,
  parseRequired,
  parseRulesLevel,
} from "./account-level-lib.mjs";

// Re-exported so this gate's own tests can drive the parsers directly, and
// so a reader who lands here first is not sent hunting for them.
export { parseRulesLevel as rulesLevel, parseRequired as sourceLevel };
export const definedLevels = (tsSrc) => parseLadder(tsSrc).map((l) => l.level);

export function checkAccountLevel(read = (p) => readFileSync(p, "utf8")) {
  const problems = [];
  const rules = read(RULES);
  const source = read(SOURCE);

  const rl = parseRulesLevel(rules);
  const sl = parseRequired(source);
  const ladder = parseLadder(source);
  const levels = ladder.map((l) => l.level);

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
  // The ladder must stay ascending and dense from 0. `>=` only means
  // "subsumes" while every rung below the bar exists — a gap makes a bar
  // unreachable, and a repeat makes a level's identity depend on array
  // order. Checked HERE rather than only in the unit tests because this is
  // the copy that runs on the deploy path.
  const ascending = [...levels].sort((a, b) => a - b);
  if (String(levels) !== String(ascending) || new Set(levels).size !== levels.length) {
    problems.push(`${SOURCE}: ACCOUNT_LEVELS is not ascending and unique (${levels.join(", ")})`);
  } else if (levels.some((l, i) => l !== i)) {
    problems.push(`${SOURCE}: ACCOUNT_LEVELS must be dense from 0 (${levels.join(", ")}) — a gap makes a bar unreachable`);
  }
  // Every rung needs a test for earning it. A rung with no `met` is a
  // requirement nothing can satisfy: accounts silently stop at the rung
  // below, forever, with nothing failing.
  const met = countMet(source);
  if (met !== levels.length) {
    problems.push(`${SOURCE}: ${levels.length} level(s) but ${met} met() predicate(s) — a rung with no test can never be earned`);
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
  const src = readFileSync(SOURCE, "utf8");
  const ladder = parseLadder(src);
  const lvl = parseRequired(src);
  const name = ladder.find((l) => l.level === lvl)?.key ?? "?";
  console.log(
    `check:account-level OK — rules and accountLevel.ts agree the bar is ${lvl} (${name}); `
    + `${ladder.length} rung(s): ${ladder.map((l) => `${l.level}=${l.key}`).join(" ")}`,
  );
}
