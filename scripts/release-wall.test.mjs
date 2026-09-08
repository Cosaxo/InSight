// release-wall.test.mjs — the account wall, held in the two workflows that
// can put a build in front of a stranger.
//
// WHY THIS EXISTS. `VITE_REQUIRE_SIGNIN` decides whether a build carries
// D414's account wall, and it resolves from a repository VARIABLE that
// cannot be read from the repo — so "does this build have the wall" was a
// question nobody could answer without installing the result. It was asked
// for build 33 and could not be answered.
//
// Two things then went wrong in sequence, and both were invisible here.
// `play-release.yml` shipped with the default pointed the wrong way
// (`|| 'false'`), which D414 amendment 2 caught by hand — one afternoon
// from costing a release. And when D419 added the report-and-refusal to
// `ios-release.yml`, Play got neither: measured, reverting Play's default
// to `|| 'false'` left every check:* gate and the whole scripts suite
// green. `grep -rn REQUIRE_SIGNIN scripts/` was zero hits — no script,
// test or gate read the variable at all.
//
// That matters more on Play than the symmetry suggests: it is ONE variable
// read by BOTH workflows, so clearing it for a single deliberately
// wall-less iOS archive disarms the Android upload too.
//
// What this file does NOT do is forbid the override. A wall-less build is
// a legitimate thing to archive and install by hand; what D414 forbids is
// one reaching a store. So the rule is the same shape the workflows use: a
// REPORT always, a REFUSAL on upload.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS = ["ios-release.yml", "play-release.yml"];
const src = (f) => readFileSync(join(root, ".github", "workflows", f), "utf8");

describe("both release workflows default the account wall ON", () => {
  it("finds the workflows — vacuous otherwise", () => {
    for (const f of WORKFLOWS) expect(src(f).length, `${f} is missing or empty`).toBeGreaterThan(1000);
  });

  for (const f of WORKFLOWS) {
    it(`${f} resolves VITE_REQUIRE_SIGNIN to 'true' when the variable is unset`, () => {
      // The literal, not a regex over the name: `|| 'false'` and a bare
      // `${{ vars.REQUIRE_SIGNIN }}` are the two ways this goes wrong, and
      // both mention the variable.
      expect(
        src(f),
        `${f} no longer defaults VITE_REQUIRE_SIGNIN to 'true' — an unset repository `
          + "variable would ship a build with no account wall (D414)",
      ).toMatch(/VITE_REQUIRE_SIGNIN:\s*\$\{\{\s*vars\.REQUIRE_SIGNIN\s*\|\|\s*'true'\s*\}\}/);
    });

    it(`${f} refuses an UPLOAD whose build has no wall — exactly once`, () => {
      const s = src(f);
      // The refusal, in the shape both files use: gated on upload, keyed on
      // the resolved value, and exiting non-zero rather than warning.
      const REFUSAL = /if \[ "\$\{\{ inputs\.upload \}\}" = "true" \] && \[ "\$VITE_REQUIRE_SIGNIN" != "true" \]; then/g;
      const found = s.match(REFUSAL) ?? [];
      expect(
        found.length,
        `${f} has no refusal — a store upload can carry a wall-less build with nothing to say so`,
      ).toBeGreaterThan(0);
      // EXACTLY ONE, and the count is the point rather than pedantry.
      //
      // Two night shifts audit this repo on the same nights, and on
      // 2026-09-07/08 both wrote this same block into play-release.yml
      // independently — 22:15 UTC and 03:14 UTC, five hours apart with the
      // first branch public the whole time. Neither
      // branch is wrong and `git merge-tree` reports ZERO conflicts, so
      // git simply keeps both: the composed workflow prints the wall line
      // twice and evaluates the same refusal twice. Measured on the
      // composed tree — the block appears at two line numbers — and it is
      // the shape D336 names, where every gate stays green and a test
      // breaks for a reason nobody can read.
      //
      // Without this count the composition failed on the POSITIVE CONTROL
      // below instead, because a non-global `String.replace` removes only
      // the first of two. That is a true red with an unreadable cause. A
      // duplicated refusal should say so in one sentence.
      expect(
        found.length,
        `${f} carries the upload refusal ${found.length} times. Two shifts wrote it independently and git `
          + "merged both without a conflict — keep one, and prefer the wording that names the store.",
      ).toBe(1);
      const after = s.slice(s.search(/if \[ "\$\{\{ inputs\.upload \}\}" = "true" \] && \[ "\$VITE_REQUIRE_SIGNIN"/));
      expect(after.slice(0, 600), `${f}'s refusal does not exit non-zero`).toMatch(/\n\s*exit 1\n/);
    });

    it(`${f} reports the resolved value even when it does not refuse`, () => {
      // An artifact-only run is where a wrong value is cheapest to notice,
      // and the summary line is the only place it can be read at all.
      expect(src(f), `${f} no longer prints the resolved wall value`).toMatch(/VITE_REQUIRE_SIGNIN=\$\{VITE_REQUIRE_SIGNIN:-<unset>\}/);
      expect(src(f), `${f} no longer writes the wall value to the job summary`).toMatch(/wall=\$\{VITE_REQUIRE_SIGNIN:-<unset>\}[^\n]*GITHUB_STEP_SUMMARY/);
    });
  }

  it("the rules can actually fail — a positive control on each matcher", () => {
    const good = src("play-release.yml");
    const flipped = good.replace("vars.REQUIRE_SIGNIN || 'true'", "vars.REQUIRE_SIGNIN || 'false'");
    expect(/VITE_REQUIRE_SIGNIN:\s*\$\{\{\s*vars\.REQUIRE_SIGNIN\s*\|\|\s*'true'\s*\}\}/.test(flipped)).toBe(false);
    // GLOBAL, because a duplicated block would otherwise leave the second
    // copy standing and this control would fail with a message about the
    // matcher — which is what the composed two-shift tree actually did.
    const unguarded = good.replace(/if \[ "\$\{\{ inputs\.upload \}\}" = "true" \] && \[ "\$VITE_REQUIRE_SIGNIN" != "true" \]; then/g, "if false; then");
    expect(/if \[ "\$\{\{ inputs\.upload \}\}" = "true" \] && \[ "\$VITE_REQUIRE_SIGNIN" != "true" \]; then/.test(unguarded)).toBe(false);
  });
});
