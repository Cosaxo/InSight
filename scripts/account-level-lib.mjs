// account-level-lib — read the account-requirement ladder out of its
// source of truth, for the tools that cannot import TypeScript.
//
// WHY A SHARED PARSER rather than two copies of the regexes: three things
// need to agree about the ladder — the gate that holds firestore.rules
// equal to it, the operator filter that reports on it, and the ladder
// itself. Two of those are .mjs and cannot import functions/src. A second
// copy of the parsing is a second thing to forget when a rung is added,
// which is precisely the failure the ladder was built to avoid.
//
// EVERY PARSER HERE IS FORMAT-INDEPENDENT ON PURPOSE. The first version of
// the level parser was anchored to line starts (`/^\s*level:\s*(\d+),/gm`)
// and would have been blinded by a formatter collapsing the object
// literals — a gate reading nothing and reporting OK, which is worse than
// no gate because it is believed. Nothing here may depend on where the
// newlines fall.
import { readFileSync } from "node:fs";

export const SOURCE = "functions/src/accountLevel.ts";
export const RULES = "firestore.rules";

/**
 * The source of the ACCOUNT_LEVELS array literal, and nothing else.
 *
 * SCOPING MATTERS MORE THAN IT LOOKS. The first version of `countMet` ran
 * over the whole file and counted five predicates for three rungs — the
 * interface's `met: (facts: LevelFacts) => boolean` declaration and
 * levelDef's unknown-level fallback both match a naive `met:` search. It
 * failed loudly, which is the good case; the same over-matching in
 * `parseLadder` would have invented rungs instead. Everything structural
 * is read from this slice only.
 *
 * Bracket-counted rather than regex-matched to the closing `];`, because a
 * nested array in a future rung's definition would end the match early.
 */
export function ladderBlock(tsSrc) {
  const start = tsSrc.indexOf("ACCOUNT_LEVELS");
  if (start < 0) return "";
  // Past the `=`, NOT simply the next `[`. The declaration reads
  // `ACCOUNT_LEVELS: AccountLevelDef[] = [`, so the first bracket after the
  // name belongs to the TYPE — an empty pair, which the counter below
  // closes immediately and returns as a two-character ladder. It failed
  // loudly here; the same slip in a parser that tolerated an empty result
  // would have reported OK forever.
  const eq = tsSrc.indexOf("=", start);
  if (eq < 0) return "";
  const open = tsSrc.indexOf("[", eq);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < tsSrc.length; i += 1) {
    const c = tsSrc[i];
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return tsSrc.slice(open, i + 1);
    }
  }
  return "";
}

/**
 * The rungs, ascending: `[{ level, key }]`.
 *
 * Levels and keys are collected separately and zipped rather than matched
 * as one adjacent pair, so a comment between the two fields — which is
 * ordinary in this file — cannot drop a rung. `key:` followed by a
 * DOUBLE-QUOTED string appears nowhere else in the source: the interface
 * declares `key: string` unquoted, and levelDef's fallback builds its key
 * with a template literal.
 */
export function parseLadder(tsSrc) {
  const block = ladderBlock(tsSrc);
  const levels = [...block.matchAll(/\blevel:\s*(\d+)/g)].map((m) => Number(m[1]));
  const keys = [...block.matchAll(/\bkey:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (levels.length === 0 || levels.length !== keys.length) return [];
  return levels.map((level, i) => ({ level, key: keys[i] }));
}

/** How many rungs declare a `met` predicate — a rung without one cannot be earned. */
export function countMet(tsSrc) {
  return [...ladderBlock(tsSrc).matchAll(/\bmet:\s*\(/g)].length;
}

export function parseRequired(tsSrc) {
  const m = tsSrc.match(/export\s+const\s+REQUIRED_LEVEL\s*=\s*(\d+)\s*;/);
  return m ? Number(m[1]) : null;
}

export function parseRulesLevel(rulesSrc) {
  const m = rulesSrc.match(/function\s+requiredAccountLevel\(\)\s*\{\s*return\s+(\d+)\s*;\s*\}/);
  return m ? Number(m[1]) : null;
}

/**
 * Turn what an operator typed into a bar: a number, or a rung's key.
 *
 * Accepting the KEY is what keeps the tool open to rungs that do not exist
 * yet — `--below device+identity` keeps meaning the same requirement even
 * if a rung is inserted below it and the numbers shift. Returns null for
 * anything that is not a rung, so the caller can refuse rather than
 * silently filtering against a bar nothing defines.
 */
export function resolveBar(input, ladder) {
  const asNum = Number(input);
  if (Number.isInteger(asNum) && String(input).trim() !== "") {
    return ladder.some((l) => l.level === asNum) ? asNum : null;
  }
  const hit = ladder.find((l) => l.key === String(input).trim());
  return hit ? hit.level : null;
}

/** The ladder as the tools want it, read from disk. */
export function loadLadder(read = (p) => readFileSync(p, "utf8")) {
  const src = read(SOURCE);
  return { ladder: parseLadder(src), required: parseRequired(src), metCount: countMet(src) };
}
