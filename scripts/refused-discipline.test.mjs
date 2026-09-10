// refused-discipline.test.mjs — every refusal in the rules suite carries
// its own reason.
//
// Firestore stops a rule at 1,000 evaluated expressions and reports the
// stop as PERMISSION_DENIED, so `assertFails` alone is satisfied by a
// rule that ran out of BUDGET exactly as by a rule that said no. D431 is
// the day that mattered: thirteen refusals in one e2e run were granted by
// exhaustion, and every suite was green. The answer was `refused()`, a
// wrapper that reads the emulator's reason text and fails the case when
// the reason is the budget.
//
// The wrapper's docstring then claimed "`assertFails` is not called
// directly anywhere else", and it stopped being true one commit later:
// the log-erasure and public-answer-map blocks arrived carrying seven
// direct calls, copied from the older idiom. Both are `if false` paths
// where a budget stop cannot be the granting reason, so nothing was
// wrong in FACT — what was wrong was the claim, and the next block
// copied from them lands somewhere a `get()` runs, where the failure is
// silent by construction.
//
// Nothing could see it: `test:rules` runs the coverage ratchet and the
// budget gate, and neither reads the suite's source. This does, and it
// runs in `test:scripts` — which is in CI's lint job, so it costs no
// emulator.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(root, "firestore-tests", "rules.test.ts");
// COMMENTS BLANKED — this file's subject is named in half the comments of
// the suite it reads, including the docstring that makes the claim, so a
// raw scan would report the explanation as the offence. Blanking keeps
// every line number pointing at the real file.
const src = stripComments(readFileSync(FILE, "utf8"));
const lines = src.split("\n");

describe("the rules suite refuses through refused(), not assertFails", () => {
  it("finds the helper — vacuous otherwise", () => {
    // The floor. If the helper is renamed or removed, this file must fail
    // rather than pass over a suite it no longer understands.
    expect(src).toMatch(/async function refused\s*\(/);
    expect(src).toMatch(/maximum of 1000 expressions/i);
  });

  it("calls assertFails exactly once — inside the helper", () => {
    const hits = [];
    lines.forEach((l, i) => { if (/\bassertFails\s*\(/.test(l)) hits.push([i + 1, l.trim()]); });
    // One call site. The import names the symbol without calling it, so
    // it is not a hit; a second call site is a refusal that can be
    // granted by the budget without anyone noticing.
    expect(
      hits.map(([n, l]) => `${n}: ${l}`),
      "a refusal outside refused() — it passes when the rule runs out of budget (D431)",
    ).toHaveLength(1);
    const [[atLine]] = hits;
    const helperAt = lines.findIndex((l) => /async function refused\s*\(/.test(l)) + 1;
    expect(atLine).toBeGreaterThan(helperAt);
    expect(atLine - helperAt).toBeLessThan(6);
  });

  it("and the suite really does refuse things — the count is not zero", () => {
    // The control that keeps this file honest: a scan that found no
    // refusals at all would pass the case above for the wrong reason,
    // which is the exact class of gate this repo keeps re-committing.
    const uses = lines.filter((l) => /\brefused\s*\(/.test(l)).length;
    expect(uses, "the suite stopped refusing anything, or the helper was renamed").toBeGreaterThan(100);
  });
});
