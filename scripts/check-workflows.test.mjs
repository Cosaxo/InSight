// What check:workflows refuses, proved by breaking a tree.
//
// The gate's subject is the failure that has no log: a workflow GitHub
// cannot load produces a run with no jobs, named after the file's path,
// on every branch at once (D465). So the cases here are about WHERE the
// text sits, which is the whole question — the same sentence is fatal in
// a `run:` body and correct as a YAML comment, and the repo has it the
// safe way in auth-config.yml and play-release.yml.
//
// The vacuity case at the end is the D179/D197 shape: a scanner that
// reads an empty list and reports success is the failure those decisions
// are about, and this gate's own glob is the thing that could go stale.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The gate and every local module it imports — a dependency left out here
// fails as an import error rather than as the refusal under test.
const GATE_FILES = ["check-workflows.mjs", "workflow-expressions.mjs"];

const OPEN = "$" + "{{";
const EMPTY_EXPR = OPEN + " }}";

/** A tree holding `files` (name → yaml), with the gate run inside it. */
function runWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-workflows-"));
  try {
    mkdirSync(join(dir, "scripts"), { recursive: true });
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    for (const f of GATE_FILES) copyFileSync(join(root, "scripts", f), join(dir, "scripts", f));
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, ".github", "workflows", name), body);
    }
    try {
      const out = execFileSync("node", [join(dir, "scripts", "check-workflows.mjs")], {
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

const OK = [
  "name: Fine",
  "on:",
  "  push:",
  "    branches: [main]",
  "jobs:",
  "  go:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  '      - run: echo "hi"',
].join("\n") + "\n";

/** A workflow whose one step's `run:` body holds `lines`. */
function withRunBody(lines) {
  return [
    "name: Under test",
    "on:",
    "  workflow_dispatch:",
    "jobs:",
    "  go:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - name: Step",
    "        run: |",
    ...lines.map((l) => `          ${l}`),
  ].join("\n") + "\n";
}

describe("check:workflows — would every workflow load", () => {
  it("passes a tree of sound workflows, and counts them", () => {
    const r = runWith({ "a.yml": OK, "b.yml": OK });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/check-workflows OK — 2 workflows/);
  });

  it("refuses an expression written as prose in a run body", () => {
    const r = runWith({
      "a.yml": OK,
      "bad.yml": withRunBody([`# ${EMPTY_EXPR} is a textual substitution`, 'echo "hi"']),
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/would not load/);
    expect(r.out).toMatch(/shell comment in a `run:` body/);
  });

  it("names the file at fault, not just the failure", () => {
    const r = runWith({
      "fine.yml": OK,
      "guilty.yml": withRunBody([`# ${EMPTY_EXPR}`, 'echo "hi"']),
    });
    expect(r.out).toMatch(/\.github\/workflows\/guilty\.yml:10/);
    expect(r.out).not.toMatch(/fine\.yml/);
  });

  it("ALLOWS the same sentence as a YAML comment — the form the repo already uses", () => {
    const r = runWith({
      "a.yml": [
        "name: Under test",
        "on:",
        "  workflow_dispatch:",
        "jobs:",
        "  go:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - name: Step",
        "        env:",
        `          # ${EMPTY_EXPR} is a textual substitution GitHub performs`,
        "          FOO: bar",
        '        run: echo "hi"',
      ].join("\n") + "\n",
    });
    expect(r.code).toBe(0);
  });

  it("refuses an empty expression in a value, where GitHub really reads it", () => {
    const r = runWith({
      "a.yml": [
        "name: Under test",
        "on:",
        "  workflow_dispatch:",
        "jobs:",
        "  go:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - name: Step",
        "        env:",
        `          FOO: ${EMPTY_EXPR}`,
        '        run: echo "hi"',
      ].join("\n") + "\n",
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/EMPTY/);
  });

  it("leaves a real expression in a run body alone", () => {
    const r = runWith({
      "a.yml": withRunBody([`echo "| hosting | ${OPEN} steps.hosting.outcome }} |"`]),
    });
    expect(r.code).toBe(0);
  });

  it("fails on an empty workflow directory rather than reporting a green nothing", () => {
    const r = runWith({});
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/no workflow files found/);
  });
});
