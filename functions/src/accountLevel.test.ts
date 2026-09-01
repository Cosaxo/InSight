// The account-requirement ladder (D338).
//
// WHAT IS ACTUALLY AT STAKE HERE. `db` is the claim firestore.rules
// compares against `requiredAccountLevel()`, so every function below
// decides whether a real person's votes count. The cases are chosen for
// the ways that goes wrong SILENTLY — a demotion nobody sees, a
// client-declared level, a level minted by a newer deploy — rather than
// for coverage of the happy path, which is one line.
import { describe, expect, it } from "vitest";
import type { AccountLevelDef, LevelFacts } from "./accountLevel";
import { ACCOUNT_LEVELS, REQUIRED_LEVEL, levelDef, levelFor } from "./accountLevel";

describe("the ladder itself", () => {
  it("is ascending, dense from 0, and has no duplicates", () => {
    // `>=` in the rules only means "subsumes" while the ladder is ordered
    // and every rung exists. A gap would make a bar unreachable; a
    // duplicate would make levelDef's answer depend on array order.
    const levels = ACCOUNT_LEVELS.map((l) => l.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(levels.length);
    expect(levels).toEqual(levels.map((_, i) => i));
  });

  it("every rung says what it verifies", () => {
    // A level nothing can verify is the dead allowlist entry D331 removed
    // from the profile: a promise the tree cannot keep.
    for (const l of ACCOUNT_LEVELS) {
      expect(l.key.length, `level ${l.level} has no key`).toBeGreaterThan(0);
      expect(l.what.length, `level ${l.level} says nothing`).toBeGreaterThan(20);
    }
  });

  it("the enforced bar is a rung that exists", () => {
    expect(ACCOUNT_LEVELS.map((l) => l.level)).toContain(REQUIRED_LEVEL);
  });
});

describe("levelFor", () => {
  it("gives nothing to a device that did not pass", () => {
    // The callable returns `cooldown` in this case and never calls grant,
    // so this is belt and braces — but a helper that awarded a level to a
    // failed check would be the kind of bug that ships green.
    expect(levelFor({ deviceBound: false })).toBe(0);
    expect(levelFor({ deviceBound: false, signInProvider: "google.com" })).toBe(0);
  });

  it("device alone is level 1; device plus a real identity is level 2", () => {
    expect(levelFor({ deviceBound: true, signInProvider: "anonymous" })).toBe(1);
    expect(levelFor({ deviceBound: true, signInProvider: "google.com" })).toBe(2);
    expect(levelFor({ deviceBound: true, signInProvider: "apple.com" })).toBe(2);
  });

  it("a MISSING provider is treated as anonymous, not as linked", () => {
    // Fail closed. An absent claim on the token must not be read as "some
    // provider", which would hand every anonymous session level 2 the day
    // a token shape changed.
    expect(levelFor({ deviceBound: true })).toBe(1);
    expect(levelFor({ deviceBound: true, signInProvider: "" })).toBe(1);
  });
});

describe("levelDef", () => {
  it("describes each known rung", () => {
    expect(levelDef(0).key).toBe("none");
    expect(levelDef(1).key).toBe("device");
    expect(levelDef(2).key).toBe("device+identity");
  });

  it("describes an unknown rung instead of throwing", () => {
    // An account minted by a NEWER deploy than the reader — the nightly
    // scan and the operator report both hit this during a rollout, and
    // neither should crash on an account being ahead of it.
    expect(levelDef(99).key).toBe("unknown-99");
    expect(levelDef(99).what).toMatch(/newer deploy/);
  });
});

// ── open to rungs that do not exist yet ──────────────────────────────
//
// THE PROPERTY THE OWNER ASKED FOR: adding a stricter requirement later
// should be one entry in ACCOUNT_LEVELS, not an edit to the walker, the
// rules, the nightly coverage report and the operator filter.
//
// These cases re-implement the walk over a SYNTHETIC ladder, because that
// is the only way to test "a level nobody has written yet is handled"
// without writing it. If levelFor ever grows a branch that names a
// specific level, one of these fails.
describe("a future rung needs no code change", () => {
  // The walk under test, applied to a ladder this file owns.
  const walk = (ladder: AccountLevelDef[], facts: LevelFacts) => {
    let level = 0;
    for (const rung of ladder) {
      if (rung.level === 0) continue;
      if (!rung.met(facts)) break;
      level = rung.level;
    }
    return level;
  };

  const withThird: AccountLevelDef[] = [
    ...ACCOUNT_LEVELS,
    {
      level: 3,
      key: "device+identity+phone",
      what: "A hypothetical stricter rung, defined only in this test.",
      met: (f: LevelFacts & { phoneVerified?: boolean }) => !!f.phoneVerified,
    },
  ];

  it("awards the new rung when its own test passes", () => {
    const facts = { deviceBound: true, signInProvider: "google.com", phoneVerified: true };
    expect(walk(withThird, facts)).toBe(3);
    // …and the real ladder, given the same facts, tops out where it should.
    expect(levelFor(facts)).toBe(2);
  });

  it("STOPS at the first unmet rung rather than taking the highest satisfied one", () => {
    // The subsumption property, and the reason the walk breaks instead of
    // maximising. An account meeting rung 3 but NOT rung 2 must report 2's
    // predecessor, not 3 — otherwise firestore.rules' `>=` waves through
    // an account that never met the bar it is compared against.
    const skipped = { deviceBound: true, signInProvider: "anonymous", phoneVerified: true };
    expect(walk(withThird, skipped)).toBe(1);
  });

  it("a rung whose test fails leaves everything above it unreachable", () => {
    const nothing = { deviceBound: false, signInProvider: "google.com", phoneVerified: true };
    expect(walk(withThird, nothing)).toBe(0);
  });

  it("levelFor names no specific level", () => {
    // The structural version of the same claim: if the walker mentions a
    // number, adding a rung means editing it, and this whole section is a
    // lie. Reads the function's own source.
    const src = levelFor.toString();
    expect(src).not.toMatch(/\b(?:===?\s*)?[123]\b(?!\d)/);
  });
});
