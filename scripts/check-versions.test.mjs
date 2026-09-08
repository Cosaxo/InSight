// check-versions.test.mjs — the gate that keeps three version numbers
// agreeing, driven against a real tree rather than trusted.
//
// WHY THIS FILE EXISTS. `check:versions` reports what an operator reads
// before a release, and its success line NAMES Android: "versions OK —
// 2.0.0 (build 34) across package.json, Android and iOS". It matched
// `versionCode` and `versionName` with `.match()` on the raw gradle
// source, which takes the FIRST hit — and parking a superseded value in a
// comment above the live line is house style in this tree.
//
// Measured before the fix, with the plant below: the gate printed that
// exact success line while android/app/build.gradle declared 1.0.0 and
// versionCode 5.
//
// `scripts/source-pins.test.mjs` is the ratchet for this whole class and
// could not see it: its pattern matches `readFileSync(…).match(`, and here
// the read and the match are separate statements over a variable. So the
// hold has to be behavioural, which is what this file is.
//
// Run against a COPY of the tracked tree, like check-figures.test.mjs and
// check-appcheck.test.mjs: the claim is about what the gate DOES with a
// file, so the file has to be real.
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GRADLE = "android/app/build.gradle";

let tree;
beforeAll(() => {
  tree = mkdtempSync(join(tmpdir(), "check-versions-"));
  execFileSync("bash", ["-c",
    `cd ${JSON.stringify(root)} && git ls-files -z | tar --null -T - -cf - | tar -xf - -C ${JSON.stringify(tree)}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
}, 60_000);

/** Run the gate inside `dir` with `--fix`, returning status and output. */
function runFix(dir) {
  try {
    return { code: 0, out: execFileSync("node", [join(dir, "scripts", "check-versions.mjs"), "--fix"], {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** Run the gate inside `dir`, returning its status and combined output. */
function runGate(dir) {
  try {
    return { code: 0, out: execFileSync("node", [join(dir, "scripts", "check-versions.mjs")], {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("check:versions reads the version, not a comment above it", () => {
  it("passes on an unmodified copy of the tree", () => {
    const r = runGate(tree);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/versions OK/);
  });

  it("catches a downgrade parked under a `// was:` line", () => {
    const path = join(tree, GRADLE);
    const original = readFileSync(path, "utf8");
    try {
      // The house-style shape: the superseded values in a comment, the
      // live ones below it. The comment is what `.match()` used to find.
      // ORDER MATTERS, and getting it wrong is how this plant first
      // proved nothing: insert the comment FIRST and the next replace
      // rewrites the comment's own `versionName`, leaving the live line
      // correct. Downgrade the real values, then park the old ones above.
      const planted = original
        .replace(/versionName\s+"[^"]+"/, 'versionName "1.0.0"')
        .replace(/( *)versionCode\s+\d+/, (m, pad) =>
          `${pad}// was: versionCode 34 / versionName "2.0.0" before the downgrade\n${pad}versionCode 5`);
      expect(planted, "the plant did not change anything").not.toBe(original);
      writeFileSync(path, planted);

      const r = runGate(tree);
      expect(
        r.code,
        `the gate passed an Android build declaring 1.0.0 / 5:\n${r.out}`,
      ).toBe(1);
      // …and says which file and which value, because "something is wrong"
      // before a release is not an operator's answer.
      expect(r.out).toMatch(/versionName "1\.0\.0"/);
      expect(r.out).toMatch(/versionCode 5 is BEHIND/);
    } finally {
      writeFileSync(path, original);
    }
  });

  // ── THE REPAIR PATH HAD THE SAME DEFECT ─────────────────────────
  //
  // Fixing the READ left the WRITE reading the comment: both `--fix`
  // branches called a non-global `.replace()` on the raw source, so on
  // exactly the shape above they rewrote the values INSIDE the comment
  // and left the live lines alone — while printing "Applied fixes for:"
  // and exiting 0. The gate's own failure message tells the operator to
  // run `--fix`, so the affirmative lie is the one that costs something.
  //
  // Nothing saw it because none of the cases above runs `--fix` at all.
  it("--fix repairs the LIVE lines and leaves the comment standing", () => {
    const path = join(tree, GRADLE);
    const original = readFileSync(path, "utf8");
    try {
      const planted = original
        .replace(/versionName\s+"[^"]+"/, 'versionName "1.0.0"')
        .replace(/( *)versionCode\s+\d+/, (m, pad) =>
          `${pad}// was: versionCode 34 / versionName "2.0.0" before the downgrade\n${pad}versionCode 5`);
      writeFileSync(path, planted);
      expect(runGate(tree).code, "the plant did not fail the gate").toBe(1);

      const fixed = runFix(tree);
      expect(fixed.code, fixed.out).toBe(0);
      expect(fixed.out).toMatch(/Applied fixes for/);

      const after = readFileSync(path, "utf8");
      // The provenance note is untouched — rewriting it is what the bug
      // did, and it is the only record of what the values used to be.
      expect(
        after,
        "--fix rewrote the comment instead of the code",
      ).toMatch(/\/\/ was: versionCode 34 \/ versionName "2\.0\.0" before the downgrade/);
      // …and the live lines really moved.
      expect(after).toMatch(/\n\s*versionCode 34\b/);
      expect(after).toMatch(/\n\s*versionName "2\.0\.0"/);
      // The operator's own next step: a re-run without --fix agrees.
      expect(runGate(tree).code, "the gate still refuses after its own --fix").toBe(0);
    } finally {
      writeFileSync(path, original);
    }
  });

  it("--fix still repairs a downgrade with NO comment above it", () => {
    // THE CONTROL for the case above: without it, "the comment survived"
    // would also be what a --fix that had stopped writing anything looks
    // like. Same downgrade, no comment, and the file must still move.
    const path = join(tree, GRADLE);
    const original = readFileSync(path, "utf8");
    try {
      writeFileSync(path, original.replace(/versionName\s+"[^"]+"/, 'versionName "1.0.0"'));
      expect(runFix(tree).code).toBe(0);
      expect(readFileSync(path, "utf8")).toMatch(/\n\s*versionName "2\.0\.0"/);
      expect(runGate(tree).code).toBe(0);
    } finally {
      writeFileSync(path, original);
    }
  });

  it("still fails a downgrade with NO comment above it", () => {
    // THE CONTROL. The case above passes just as well if the gate began
    // refusing every gradle file it reads — this is the same defect
    // without the comment, which the gate always caught.
    const path = join(tree, GRADLE);
    const original = readFileSync(path, "utf8");
    try {
      writeFileSync(path, original.replace(/versionName\s+"[^"]+"/, 'versionName "1.0.0"'));
      expect(runGate(tree).code).toBe(1);
    } finally {
      writeFileSync(path, original);
    }
  });
});
