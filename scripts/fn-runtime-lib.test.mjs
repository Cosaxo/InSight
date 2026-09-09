// The predicate the deploy-path compute gate rests on.
//
// EVERY CASE HERE IS THE BUG THAT HAPPENED. `check:fn-runtime` asserted
// `r.mem == null || r.timeout == null || r.maxInst == null` and ran on
// backend-checks.yml, the workflow that guards production. That predicate
// could not select a row, so the gate passed on a tree where every
// function had lost its explicit memory and silently fallen back to the
// gen-2 default of 256 MiB — including deleteAccount, the function its
// own header names as the reason it exists.
//
// It went unnoticed because the gate had no test, and it had no test
// because it reads the compiled functions at module scope: importing it
// runs it. Hence the lib, and hence this file.
import { describe, it, expect } from "vitest";
import { isExplicit } from "./fn-runtime-lib.mjs";

// A stand-in for firebase-functions' ResetValue, which is what an omitted
// `maxInstances` becomes. Not the real class: firebase-functions is not
// resolvable from the repo root (functions/ carries its own
// node_modules), and `test:scripts` runs here. What the real one gives
// this predicate is exactly what matters — an object rather than a
// number — and that was measured on the compiled output, not assumed:
// the gate's own table printed `maxInstances=[object Object]`.
class ResetValueLike {}
const RESET = new ResetValueLike();

describe("what counts as an explicitly set runtime option", () => {
  it("takes a real number", () => {
    expect(isExplicit(512)).toBe(true);
    expect(isExplicit(60)).toBe(true);
    // Zero is a number and would be a real (bad) setting, not an absence
    // — the gate's job is "was it set", and a separate reading decides
    // whether the value is sane.
    expect(isExplicit(0)).toBe(true);
  });

  it("REFUSES the reset sentinel, which is the whole bug", () => {
    // `RESET == null` is false, which is why the old predicate let this
    // through. It prints as [object Object] and means "no ceiling".
    expect(RESET == null, "the sentinel is not nullish — this is the trap").toBe(false);
    expect(isExplicit(RESET)).toBe(false);
  });

  it("refuses absence in both its spellings", () => {
    expect(isExplicit(undefined)).toBe(false);
    expect(isExplicit(null)).toBe(false);
  });

  it("refuses a value that is not a usable number", () => {
    // A stringy "512MiB" reaching this row would mean the endpoint
    // metadata changed shape under us. The gate should say so rather
    // than accept it — an unreadable value is not an explicit one.
    expect(isExplicit("512MiB")).toBe(false);
    expect(isExplicit("512")).toBe(false);
    expect(isExplicit(NaN)).toBe(false);
    expect(isExplicit(Infinity)).toBe(false);
  });

  it("is not simply always-false, which would pass every case above but one", () => {
    // The control. Four of the five cases here assert a rejection, so a
    // predicate that rejected everything would satisfy them — and would
    // fail the whole deploy instead of guarding it.
    expect([256, 512, 1024, 10, 1].every(isExplicit)).toBe(true);
  });
});
