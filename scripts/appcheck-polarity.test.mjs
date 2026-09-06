// appcheck-polarity.test.mjs — the half of check:appcheck that was missing.
//
// The gate reads `enforceAppCheck: ENFORCE_APP_CHECK` at 28 call sites and
// never read the constant. These cases are the mutations that proved it:
// each one leaves check:appcheck (printing "20 enforcing"),
// check:fn-runtime, check:deploy-targets, check:account-level, the
// functions suite and test:scripts green on the real tree, and each one
// ships production callables that demand no attestation.
import { describe, it, expect } from "vitest";
import { checkAppCheckPolarity, checkAppCheckProvenance, polarityExpr, POLARITY_CASES } from "./appcheck-polarity.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPS = join(root, "functions", "src", "ops.ts");
const SRC = join(root, "functions", "src");
/** functions/src as the gate reads it. */
const liveTree = () => Object.fromEntries(
  readdirSync(SRC).filter((f) => f.endsWith(".ts"))
    .map((f) => [`functions/src/${f}`, readFileSync(join(SRC, f), "utf8")]),
);

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

describe("check:appcheck — where the constant comes from", () => {
  // The hole the truth table left open, found by pointing a sweep at the
  // fix itself. `check-appcheck` matches the NAME at 28 call sites and the
  // polarity check grades the VALUE in ops.ts; nothing joined them, so one
  // module could stop importing it and declare its own. Verified on the
  // real tree against deviceBind.ts: `tsc --noEmit` clean, `check:appcheck`
  // exit 0, still printing "20 callables enforcing App Check".
  const OPS = 'export const ENFORCE_APP_CHECK =\n  process.env.FUNCTIONS_EMULATOR !== "true" &&\n  process.env.APPCHECK_ENFORCE !== "false";\n';
  const USER = 'import { ENFORCE_APP_CHECK, LIGHT_CALLABLE } from "./ops";\nexport const f = onCall({ ...LIGHT_CALLABLE, enforceAppCheck: ENFORCE_APP_CHECK }, async () => {});\n';
  const tree = (over = {}) => ({
    "functions/src/ops.ts": OPS,
    "functions/src/logic.ts": USER,
    ...over,
  });

  it("passes the real functions/src", () => {
    expect(checkAppCheckProvenance(liveTree())).toEqual([]);
  });

  it("passes a tree where every user imports from ./ops", () => {
    expect(checkAppCheckProvenance(tree())).toEqual([]);
  });

  it("catches a module declaring its own", () => {
    const out = checkAppCheckProvenance(tree({
      "functions/src/logic.ts":
        'import { LIGHT_CALLABLE } from "./ops";\nconst ENFORCE_APP_CHECK = false;\n'
        + "export const f = onCall({ ...LIGHT_CALLABLE, enforceAppCheck: ENFORCE_APP_CHECK }, async () => {});\n",
    }));
    expect(out.join(" ")).toMatch(/logic\.ts declares its own ENFORCE_APP_CHECK/);
  });

  it("catches the name arriving from somewhere other than ./ops", () => {
    const out = checkAppCheckProvenance(tree({
      "functions/src/logic.ts":
        'import { ENFORCE_APP_CHECK } from "./elsewhere";\n'
        + "export const f = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async () => {});\n",
    }));
    expect(out.join(" ")).toMatch(/without importing it from "\.\/ops"/);
  });

  it("reads past a comment, so a commented-out shadow is not a finding", () => {
    // …and, the other way, a commented-out IMPORT does not satisfy the rule.
    expect(checkAppCheckProvenance(tree({
      "functions/src/logic.ts": "// const ENFORCE_APP_CHECK = false;\n" + USER,
    }))).toEqual([]);
    const out = checkAppCheckProvenance(tree({
      "functions/src/logic.ts":
        '// import { ENFORCE_APP_CHECK } from "./ops";\n'
        + "export const f = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async () => {});\n",
    }));
    expect(out.join(" ")).toMatch(/without importing it/);
  });

  it("refuses a tree where nothing declares it — never passes vacuously", () => {
    const out = checkAppCheckProvenance({ "functions/src/logic.ts": USER });
    expect(out.join(" ")).toMatch(/no module declares ENFORCE_APP_CHECK/);
  });

  it("catches two modules declaring it", () => {
    const out = checkAppCheckProvenance(tree({
      "functions/src/other.ts": "export const ENFORCE_APP_CHECK = true;\n",
    }));
    expect(out.join(" ")).toMatch(/declared in more than one module/);
  });
});
