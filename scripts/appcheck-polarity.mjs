// Is ENFORCE_APP_CHECK actually ON in production?
//
// check-appcheck.mjs asserts the NAME `ENFORCE_APP_CHECK` appears in every
// callable's options — 28 call sites, and it reads all of them. Nothing
// read the constant itself, so the gate proved that 20 callables all defer
// to one value and never asked what that value is. Changing
// `APPCHECK_ENFORCE !== "false"` to `=== "true"` in functions/src/ops.ts
// turns the escape hatch from opt-OUT into opt-IN — the normal unset state
// then attests nothing — and leaves check:appcheck (still printing "20
// enforcing"), check:fn-runtime, check:deploy-targets, check:account-level,
// the functions suite and test:scripts all green. Verified by mutation,
// not reasoned about.
//
// Nothing else can hold it. check:fn-runtime reads the COMPILED output
// with FUNCTIONS_EMULATOR=true, under which enforcing and non-enforcing
// callables both serialise to `{}` — its own header says so, which is why
// check-appcheck is a source scan in the first place. And the promise is
// in writing: docs/DEPLOYMENT.md's "Unset (the normal state) ⇒ enforced".
//
// WHY A TRUTH TABLE AND NOT A STRING MATCH. Pinning the expression's text
// would fail on any rewrite and pass on any behaviour-preserving one —
// exactly backwards. So this extracts the expression, refuses any shape it
// cannot safely read, and EVALUATES it under the environments that matter.
// A rewrite is free; a change of polarity is not.
import { stripComments } from "./strip-comments.mjs";

// The expression's whole alphabet. A token outside it is not "probably
// fine" — it is a shape this file cannot reason about, and the honest
// answer is to fail loudly rather than evaluate something with a call in
// it. Same posture as the gate's `found !== onCallSites` arm: a form the
// script cannot parse is a form it is not checking.
// `true`/`false` are in the alphabet deliberately: a hardcoded literal
// is the failure this gate's own header names ("`enforceAppCheck: false`
// would satisfy a presence check while doing the opposite"), and it
// deserves the truth table's "is false with (nothing set), expected
// true" rather than a shrug about an unfamiliar shape.
const TOKEN = /\s+|process\.env\.[A-Za-z_][A-Za-z0-9_]*|\btrue\b|\bfalse\b|"[^"\\]*"|'[^'\\]*'|!==|===|&&|\|\||[()!]/y;

/** The environments production and the emulator actually run in. */
export const POLARITY_CASES = [
  {
    env: {},
    want: true,
    why: "nothing set is the NORMAL production state, and it must enforce",
  },
  {
    env: { APPCHECK_ENFORCE: "false" },
    want: false,
    why: "APPCHECK_ENFORCE=false is the documented incident opt-out",
  },
  {
    env: { APPCHECK_ENFORCE: "yes" },
    want: true,
    why: 'only the exact string "false" opts out — anything else enforces',
  },
  {
    env: { FUNCTIONS_EMULATOR: "true" },
    want: false,
    why: "the emulator must not demand a token the e2e loop cannot send",
  },
  {
    env: { FUNCTIONS_EMULATOR: "true", APPCHECK_ENFORCE: "false" },
    want: false,
    why: "both off is still off",
  },
];

/**
 * WHERE THE CONSTANT COMES FROM, which the truth table above does not ask.
 *
 * `check-appcheck` matches the NAME `ENFORCE_APP_CHECK` in each callable's
 * options; `checkAppCheckPolarity` evaluates the constant in ops.ts. Nothing
 * joined the two, so one file could stop importing it and declare its own:
 *
 *     -import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";
 *     +import { LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";
 *     +const ENFORCE_APP_CHECK = false;
 *
 * That is `tsc --noEmit` clean (the redeclaration spelling would be TS2440;
 * this one is not), and it left `check:appcheck` printing "20 callables
 * enforcing App Check" while that file's callables attested nothing.
 * Measured on the real tree against `deviceBind.ts`, restored after.
 *
 * So: exactly one module declares it, and every other module that names it
 * imports it from there. Takes the files as a map so the gate and its test
 * read the same code.
 *
 * @param {Record<string,string>} files  path → source, `functions/src/*.ts`
 * @param {string} owner  the module allowed to declare it
 */
export function checkAppCheckProvenance(files, owner = "ops.ts") {
  const errors = [];
  const declares = [];
  const NAME = "ENFORCE_APP_CHECK";
  for (const [path, raw] of Object.entries(files)) {
    const src = stripComments(raw);
    if (!src.includes(NAME)) continue;
    // A local binding of the name, however spelled.
    const local = new RegExp(`(?:^|[;{}\\n])\\s*(?:export\\s+)?(?:const|let|var|function)\\s+${NAME}\\b`)
      .test(src);
    if (local) declares.push(path);
    if (path.endsWith(owner)) continue;
    if (local) {
      errors.push(
        `${path} declares its own ${NAME}.\n`
        + `  Every attested callable is supposed to defer to the one constant in\n`
        + `  ${owner}. A local binding is type-clean, passes this gate's name check\n`
        + `  at every call site, and turns attestation off for this file alone.`,
      );
      continue;
    }
    const imports = new RegExp(`import\\s*\\{[^}]*\\b${NAME}\\b[^}]*\\}\\s*from\\s*["']\\./ops["']`)
      .test(src);
    if (!imports) {
      errors.push(
        `${path} uses ${NAME} without importing it from "./ops".\n`
        + `  If it now comes from somewhere else, that somewhere else is what\n`
        + `  decides whether 20 callables demand attestation — point this check\n`
        + `  at it deliberately rather than letting the source drift.`,
      );
    }
  }
  if (!declares.length) {
    errors.push(
      `no module declares ${NAME}. It moved, or this scan stopped reading the\n`
      + "  right directory — either way the polarity check above is now grading\n"
      + "  a constant nothing uses.",
    );
  } else if (declares.length > 1) {
    errors.push(`${NAME} is declared in more than one module: ${declares.join(", ")}.`);
  }
  return errors;
}

/** The declaration's right-hand side, comments stripped. */
export function polarityExpr(opsSource) {
  const src = stripComments(opsSource);
  const at = src.search(/\bexport\s+const\s+ENFORCE_APP_CHECK\s*=/);
  if (at === -1) return null;
  const eq = src.indexOf("=", at);
  const end = src.indexOf(";", eq);
  if (end === -1) return null;
  return src.slice(eq + 1, end).trim();
}

/**
 * Errors, one string each — empty when the constant enforces by default.
 * Pure: takes the source, so the gate and its test read the same code.
 */
export function checkAppCheckPolarity(opsSource) {
  const expr = polarityExpr(opsSource);
  if (!expr) {
    return [
      "cannot find `export const ENFORCE_APP_CHECK = …;` in functions/src/ops.ts.\n"
      + "  Every callable's attestation defers to that one constant. If it moved,\n"
      + "  point this check at the new home — do not delete the check, or the\n"
      + "  value goes unread again and App Check can be off with every gate green.",
    ];
  }

  // Refuse before evaluating, not after.
  TOKEN.lastIndex = 0;
  for (let i = 0; i < expr.length;) {
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(expr);
    if (!m) {
      return [
        `ENFORCE_APP_CHECK is written in a shape this check cannot read:\n    ${expr}\n`
        + `  Stopped at: ${JSON.stringify(expr.slice(i, i + 24))}\n\n`
        + "  It evaluates the expression against real environments, so it accepts\n"
        + "  only env reads, string literals, !==/===, &&, ||, ! and parens. Widen\n"
        + "  TOKEN in scripts/appcheck-polarity.mjs deliberately, or keep the\n"
        + "  constant a plain boolean expression.",
      ];
    }
    i = TOKEN.lastIndex;
  }

  let read;
  try {
    read = new Function("process", `"use strict"; return (${expr});`);
  } catch (e) {
    return [`ENFORCE_APP_CHECK does not parse as an expression: ${e.message}\n    ${expr}`];
  }

  const errors = [];
  for (const c of POLARITY_CASES) {
    const got = !!read({ env: { ...c.env } });
    if (got === c.want) continue;
    const shown = Object.keys(c.env).length
      ? Object.entries(c.env).map(([k, v]) => `${k}=${v}`).join(" ")
      : "(nothing set)";
    errors.push(
      `ENFORCE_APP_CHECK is ${got} with ${shown}, expected ${c.want}.\n`
      + `  ${c.why}.\n`
      + `    ${expr}\n\n`
      + "  Every attested callable defers to this one value, so the polarity here\n"
      + "  is the difference between 20 functions demanding attestation and 20\n"
      + "  serving any caller on the internet.",
    );
  }
  return errors;
}
