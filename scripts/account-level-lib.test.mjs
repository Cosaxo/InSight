// account-level-lib.test.mjs — the parsers, which decide what two tools
// and one deploy-path gate believe about the ladder.
//
// EVERY CASE HERE IS A BUG THAT HAPPENED. Writing this lib produced three
// in a row, each of the same family: a parser that matches slightly the
// wrong thing and reports something plausible.
//
//   1. `ladderBlock` took the first `[` after the name — which is the one
//      in the TYPE, `AccountLevelDef[]`. It returned "[]": an empty ladder.
//   2. `countMet` ran over the whole file and counted the interface's own
//      `met:` declaration and levelDef's fallback — five predicates for
//      three rungs.
//   3. An earlier level parser was anchored to line starts, so a formatter
//      collapsing the object literals would have blinded it.
//
// Two of those failed loudly because the gate treats an empty parse as an
// error. That is the only reason they were cheap, and it is why these
// cases exist: the same slips in a tolerant parser report OK forever.
import { describe, it, expect } from "vitest";
import {
  countMet,
  ladderBlock,
  parseLadder,
  parseRequired,
  parseRulesLevel,
  resolveBar,
} from "./account-level-lib.mjs";

const SRC = `
export interface AccountLevelDef {
  level: number;
  key: string;
  met: (facts: LevelFacts) => boolean;
}

export const ACCOUNT_LEVELS: AccountLevelDef[] = [
  { level: 0, key: "none", what: "...", met: () => true },
  {
    level: 1,
    // a comment between the fields, which is ordinary in the real file
    key: "device",
    what: "...",
    met: (f) => f.deviceBound,
  },
  { level: 2, key: "device+identity", what: "...", met: (f) => !!f.signInProvider },
];

export const REQUIRED_LEVEL = 1;

export function levelDef(level) {
  return ACCOUNT_LEVELS.find((l) => l.level === level)
    || { level, key: \`unknown-\${level}\`, what: "...", met: () => false };
}
`;

describe("ladderBlock", () => {
  it("skips the TYPE's brackets and returns the array literal", () => {
    // Bug 1. `AccountLevelDef[]` sits between the name and the array, and
    // taking the next `[` returns an empty pair — a ladder with no rungs,
    // from a file that has three.
    const block = ladderBlock(SRC);
    expect(block.startsWith("[")).toBe(true);
    expect(block).toContain("device+identity");
    expect(block).not.toContain("REQUIRED_LEVEL");
  });

  it("excludes everything after the array, so levelDef's fallback is invisible", () => {
    expect(ladderBlock(SRC)).not.toContain("unknown-");
  });

  it("returns empty when there is no ladder, rather than guessing", () => {
    expect(ladderBlock("export const SOMETHING = [1, 2];")).toBe("");
  });
});

describe("parseLadder", () => {
  it("reads every rung, including one with a comment between its fields", () => {
    expect(parseLadder(SRC)).toEqual([
      { level: 0, key: "none" },
      { level: 1, key: "device" },
      { level: 2, key: "device+identity" },
    ]);
  });

  it("does not depend on where the newlines fall", () => {
    // Bug 3. The whole ladder on one line must parse identically — a
    // formatter is not a semantic change.
    const flat = SRC.replace(/\n\s*/g, " ");
    expect(parseLadder(flat)).toEqual(parseLadder(SRC));
  });

  it("returns empty when levels and keys do not pair up", () => {
    // Better to report nothing (which the gate treats as a failure) than to
    // zip mismatched lists and invent a rung called something else.
    expect(parseLadder("export const ACCOUNT_LEVELS = [{ level: 0 }, { level: 1 }];")).toEqual([]);
  });
});

describe("countMet", () => {
  it("counts only the rungs' predicates", () => {
    // Bug 2. The interface declares `met:` and levelDef's fallback defines
    // one; neither is a rung.
    expect(countMet(SRC)).toBe(3);
  });
});

describe("resolveBar", () => {
  const ladder = parseLadder(SRC);

  it("accepts a level number", () => {
    expect(resolveBar(2, ladder)).toBe(2);
    expect(resolveBar("2", ladder)).toBe(2);
  });

  it("accepts a rung's KEY, which is the future-proof form", () => {
    // A key keeps meaning the same requirement even if a rung is inserted
    // beneath it and every number shifts.
    expect(resolveBar("device+identity", ladder)).toBe(2);
    expect(resolveBar("  device  ", ladder)).toBe(1);
  });

  it("refuses a bar the ladder does not define", () => {
    // A typo'd `--below 5` that quietly matched everything would report the
    // entire population as unqualified — a very convincing wrong answer.
    expect(resolveBar(9, ladder)).toBeNull();
    expect(resolveBar("nope", ladder)).toBeNull();
    expect(resolveBar("", ladder)).toBeNull();
  });
});

describe("the two numbers", () => {
  it("reads REQUIRED_LEVEL and the rules literal", () => {
    expect(parseRequired(SRC)).toBe(1);
    expect(parseRulesLevel("function requiredAccountLevel() { return 2; }")).toBe(2);
  });

  it("returns null rather than a default when either is missing", () => {
    expect(parseRequired("nothing")).toBeNull();
    expect(parseRulesLevel("nothing")).toBeNull();
  });
});
