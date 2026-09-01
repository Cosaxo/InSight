// check-account-level.test.mjs — the gate's own tripwires.
//
// This gate's failure mode is the one it exists to catch, pointed at
// itself: both of its regexes read files it does not own, and a rename on
// either side makes the match return null. A null-tolerant gate would then
// pass forever while the two numbers drifted — so the checker treats a
// missing match as a FAILURE, and these cases pin that.
import { describe, it, expect } from "vitest";
import { checkAccountLevel, rulesLevel, sourceLevel, definedLevels } from "./check-account-level.mjs";

const RULES = `
    function deviceBindEnforced() { return false; }
    function requiredAccountLevel() { return 1; }
    function deviceBound() { return request.auth.token.get("db", 0) >= requiredAccountLevel(); }
`;
const SOURCE = `
export const ACCOUNT_LEVELS: AccountLevelDef[] = [
  { level: 0, key: "none", what: "...", met: () => true },
  { level: 1, key: "device", what: "...", met: (f) => f.deviceBound },
  { level: 2, key: "device+identity", what: "...", met: (f) => !!f.signInProvider },
];
export const REQUIRED_LEVEL = 1;
`;

const run = (over = {}) => {
  const files = { "firestore.rules": RULES, "functions/src/accountLevel.ts": SOURCE, ...over };
  return checkAccountLevel((p) => files[p]);
};

describe("check:account-level", () => {
  it("passes when the two numbers agree", () => {
    expect(run()).toEqual([]);
  });

  it("catches the rules being STRICTER than the source", () => {
    // The dangerous direction in production: every report reads
    // REQUIRED_LEVEL and says accounts qualify, while the rules refuse
    // their writes. The client shows no error — the vote just un-takes.
    const out = run({ "firestore.rules": RULES.replace("return 1;", "return 2;") });
    expect(out.join(" ")).toMatch(/enforces >= 2.*REQUIRED_LEVEL = 1/);
  });

  it("catches the rules being LOOSER than the source", () => {
    // The dangerous direction for the owner: you raise the bar, believe it
    // is raised, and production keeps counting everyone.
    const out = run({ "functions/src/accountLevel.ts": SOURCE.replace("REQUIRED_LEVEL = 1", "REQUIRED_LEVEL = 2") });
    expect(out.join(" ")).toMatch(/enforces >= 1.*REQUIRED_LEVEL = 2/);
  });

  it("catches a bar pointing at a rung that does not exist", () => {
    const out = run({
      "functions/src/accountLevel.ts": SOURCE.replace("REQUIRED_LEVEL = 1", "REQUIRED_LEVEL = 7"),
      "firestore.rules": RULES.replace("return 1;", "return 7;"),
    });
    expect(out.join(" ")).toMatch(/not a level ACCOUNT_LEVELS defines/);
  });

  it("FAILS rather than passing when it can no longer find either number", () => {
    // The whole point. A gate that reads nothing and reports OK is worse
    // than no gate, because it is believed.
    expect(run({ "firestore.rules": "function somethingElse() { return 1; }" }).join(" "))
      .toMatch(/requiredAccountLevel\(\) not found/);
    expect(run({ "functions/src/accountLevel.ts": "export const SOMETHING = 1;" }).join(" "))
      .toMatch(/REQUIRED_LEVEL not found/);
  });

  it("catches a GAP in the ladder, which makes a bar unreachable", () => {
    // `>=` only means "subsumes" while every rung below the bar exists.
    const gapped = SOURCE.replace('{ level: 1, key: "device", what: "...", met: (f) => f.deviceBound },', "");
    expect(checkAccountLevel((p) => ({ "firestore.rules": RULES, "functions/src/accountLevel.ts": gapped }[p])).join(" "))
      .toMatch(/dense from 0|not a level ACCOUNT_LEVELS defines/);
  });

  it("catches a rung with no met() — a requirement nothing can satisfy", () => {
    // Accounts would silently stop at the rung below, forever, with
    // nothing failing anywhere.
    const noMet = SOURCE.replace(", met: (f) => !!f.signInProvider", "");
    expect(run({ "functions/src/accountLevel.ts": noMet }).join(" "))
      .toMatch(/3 level\(s\) but 2 met\(\) predicate\(s\)/);
  });

  it("parses the numbers it claims to parse", () => {
    expect(rulesLevel(RULES)).toBe(1);
    expect(sourceLevel(SOURCE)).toBe(1);
    expect(definedLevels(SOURCE)).toEqual([0, 1, 2]);
    expect(rulesLevel("nothing here")).toBeNull();
    expect(sourceLevel("nothing here")).toBeNull();
  });
});
