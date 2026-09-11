// What check:deploy-targets refuses about the workflow's own LOADABILITY,
// proved by breaking a tree rather than by reading the source.
//
// The gate's older half asks whether every exported function reaches the
// --only list. This half asks the prior question: does GitHub Actions load
// the file at all. It exists because on 2026-09-10 it did not, and nothing
// noticed for two days — the failure has no log to read, since no job runs,
// and it renames every run after the file's path, which reads in an inbox
// like any other red build.
//
// THE DISCRIMINATING CASE IS THE THIRD ONE. The identical sentence about
// `${{ }}` is fatal inside a `run:` body and harmless as a YAML comment,
// because YAML strips the second before GitHub sees anything. A check that
// merely greps for the token cannot tell those apart and fails on the
// repo's own prose — auth-config.yml has written it that way, safely, for
// as long as the step has existed. The first cut of this check did exactly
// that, so the case is pinned here rather than trusted.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(root, "scripts", "check-deploy-targets.mjs");

/** A minimal tree the gate is happy with, with `steps` spliced into it. */
function workflowWith(steps) {
  return [
    "name: Deploy Firebase backend",
    "on:",
    "  push:",
    "    branches: [main]",
    "jobs:",
    "  deploy:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    ...steps,
    "      - name: Deploy functions",
    '        run: npx firebase deploy --only "functions:helloV2"',
  ].join("\n") + "\n";
}

function runWith(steps) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-targets-"));
  try {
    mkdirSync(join(dir, "scripts"), { recursive: true });
    mkdirSync(join(dir, "functions", "src"), { recursive: true });
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    copyFileSync(GATE, join(dir, "scripts", "check-deploy-targets.mjs"));
    writeFileSync(
      join(dir, "functions", "src", "index.ts"),
      "export const helloV2 = onCall(async () => {});\n",
    );
    writeFileSync(
      join(dir, ".github", "workflows", "firebase-deploy.yml"),
      workflowWith(steps),
    );
    try {
      const out = execFileSync("node", [join(dir, "scripts", "check-deploy-targets.mjs")], {
        cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Written as a concatenation so this file can talk about the token without
// containing a live one: the test suite is not a workflow, but a reader
// copying the line out of here into one should not be handed the bug.
const OPEN = "$" + "{{";
const EMPTY_EXPR = OPEN + " }}";

describe("check:deploy-targets — will GitHub load the workflow at all", () => {
  it("passes on a tree whose workflow is fine (so the refusals below are attributable)", () => {
    const r = runWith([]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/deploy-targets OK/);
  });

  it("refuses an empty expression written as a shell comment in a run body", () => {
    const r = runWith([
      "      - name: Write the config",
      "        run: |",
      "          set -o pipefail",
      `          # ${EMPTY_EXPR} is a textual substitution GitHub performs`,
      '          echo "hi"',
    ]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/would not load/);
    expect(r.out).toMatch(/shell comment in a `run:` body/);
  });

  it("ALLOWS the same sentence as a YAML comment — YAML strips it before GitHub reads it", () => {
    const r = runWith([
      "      - name: Write the config",
      "        env:",
      `          # ${EMPTY_EXPR} is a textual substitution GitHub performs`,
      "          FOO: bar",
      "        run: |",
      '          echo "hi"',
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/deploy-targets OK/);
  });

  it("refuses an empty expression in a place GitHub really reads — a value", () => {
    const r = runWith([
      "      - name: Write the config",
      "        env:",
      `          FOO: ${EMPTY_EXPR}`,
      '        run: echo "hi"',
    ]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/EMPTY/);
  });

  it("leaves a real expression in a run body alone — the deploy report uses one", () => {
    const r = runWith([
      "      - name: Report",
      "        run: |",
      `          echo "| hosting | ${OPEN} steps.hosting.outcome }} |"`,
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/deploy-targets OK/);
  });

  it("refuses a NON-empty expression smuggled into a run-body comment, which is worse", () => {
    // `${{ secrets.X }}` written as an aside pastes the secret into the
    // script, where `set -x` or an error message can print it.
    const r = runWith([
      "      - name: Write the config",
      "        run: |",
      `          # never interpolate ${OPEN} secrets.FIREBASE_SERVICE_ACCOUNT }} here`,
      '          echo "hi"',
    ]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/shell comment in a `run:` body/);
  });
});
