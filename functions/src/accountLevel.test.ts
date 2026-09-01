// The account-requirement ladder (D338).
//
// WHAT IS ACTUALLY AT STAKE HERE. `db` is the claim firestore.rules
// compares against `requiredAccountLevel()`, so every function below
// decides whether a real person's votes count. The cases are chosen for
// the ways that goes wrong SILENTLY — a demotion nobody sees, a
// client-declared level, a level minted by a newer deploy — rather than
// for coverage of the happy path, which is one line.
import { describe, expect, it } from "vitest";
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
