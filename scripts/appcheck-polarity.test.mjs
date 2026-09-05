// appcheck-polarity.test.mjs — the half of check:appcheck that was missing.
//
// The gate reads `enforceAppCheck: ENFORCE_APP_CHECK` at 28 call sites and
// never read the constant. These cases are the mutations that proved it:
// each one leaves check:appcheck (printing "20 enforcing"),
// check:fn-runtime, check:deploy-targets, check:account-level, the
// functions suite and test:scripts green on the real tree, and each one
// ships production callables that demand no attestation.
import { describe, it, expect } from "vitest";
import { checkAppCheckPolarity, polarityExpr, POLARITY_CASES } from "./appcheck-polarity.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPS = join(root, "functions", "src", "ops.ts");

const src = (expr) => `
// A comment quoting the OLD shape, which must not be what gets read:
//   export const ENFORCE_APP_CHECK = false;
export const ENFORCE_APP_CHECK =
  ${expr};
`;

describe("check:appcheck — the constant's polarity", () => {
  it("passes on the real functions/src/ops.ts", () => {
    expect(checkAppCheckPolarity(readFileSync(OPS, "utf8"))).toEqual([]);
  });

  it("reads past a comment quoting a superseded value", () => {
    // The class swept out of four gates on 2026-09-05: a first-match regex
    // over raw source prices off whatever is parked in the comment above.
    expect(polarityExpr(src('process.env.FUNCTIONS_EMULATOR !== "true"')))
      .toBe('process.env.FUNCTIONS_EMULATOR !== "true"');
  });

  it("catches the escape hatch turning from opt-out into opt-IN", () => {
    // The silent one. `=== "true"` means the normal production state —
    // nothing set — enforces nothing, and no other gate can see it:
    // check:fn-runtime sets FUNCTIONS_EMULATOR=true, under which enforcing
    // and non-enforcing callables serialise identically.
    const out = checkAppCheckPolarity(src(
      'process.env.FUNCTIONS_EMULATOR !== "true" &&\n  process.env.APPCHECK_ENFORCE === "true"',
    ));
    expect(out.join(" ")).toMatch(/is false with \(nothing set\), expected true/);
  });

  it("catches the emulator test being inverted", () => {
    const out = checkAppCheckPolarity(src(
      'process.env.FUNCTIONS_EMULATOR === "true" &&\n  process.env.APPCHECK_ENFORCE !== "false"',
    ));
    expect(out.length).toBeGreaterThan(0);
  });

  it("catches a hardcoded false, and a hardcoded true", () => {
    expect(checkAppCheckPolarity(src("false")).join(" ")).toMatch(/expected true/);
    // `true` breaks the emulator instead — the reason the constant exists.
    expect(checkAppCheckPolarity(src("true")).join(" ")).toMatch(/FUNCTIONS_EMULATOR=true/);
  });

  it("catches either conjunct going missing", () => {
    expect(checkAppCheckPolarity(src('process.env.FUNCTIONS_EMULATOR !== "true"')).length)
      .toBeGreaterThan(0);
    expect(checkAppCheckPolarity(src('process.env.APPCHECK_ENFORCE !== "false"')).length)
      .toBeGreaterThan(0);
  });

  it("catches && loosened to ||", () => {
    expect(checkAppCheckPolarity(src(
      'process.env.FUNCTIONS_EMULATOR !== "true" ||\n  process.env.APPCHECK_ENFORCE !== "false"',
    )).length).toBeGreaterThan(0);
  });

  it("holds that only the exact string \"false\" opts out", () => {
    // A truthiness test — `!process.env.APPCHECK_ENFORCE` — would read
    // APPCHECK_ENFORCE=0 or ="" as an opt-out that nothing documents.
    expect(checkAppCheckPolarity(src(
      'process.env.FUNCTIONS_EMULATOR !== "true" &&\n  !process.env.APPCHECK_ENFORCE',
    )).join(" ")).toMatch(/APPCHECK_ENFORCE=yes/);
  });

  it("REFUSES a shape it cannot read rather than evaluating it", () => {
    // A gate that shrugs at an unfamiliar form is a gate that passes
    // forever the day someone extracts a helper. The right answer is to
    // fail and say so.
    const out = checkAppCheckPolarity(src("shouldEnforce()"));
    expect(out.join(" ")).toMatch(/shape this check cannot read/);
    expect(out.join(" ")).toMatch(/shouldEnforce/);
  });

  it("fails when the constant is renamed or deleted, never passes vacuously", () => {
    expect(checkAppCheckPolarity("export const OTHER = 1;\n").join(" "))
      .toMatch(/cannot find/);
    expect(checkAppCheckPolarity("").join(" ")).toMatch(/cannot find/);
  });

  it("names an environment in every case, so a failure says what to set", () => {
    for (const c of POLARITY_CASES) expect(c.why).toMatch(/\S/);
  });
});
