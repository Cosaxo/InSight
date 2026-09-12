// Every gate CI's lint job runs, in one command, reporting ALL failures.
//
// WHY THIS EXISTS. CLAUDE.md §2 has said three times that the fifth runner
// hides: `test:scripts` is wired into CI's LINT job, so `npm run lint`
// locally is eslint alone and says nothing about it, and three branches
// shipped a broken gate script through that gap (D179, D197, D275's). The
// record kept growing after the sentence was written — "check:file-size is
// the second gate this session that CI found and a local run did not, after
// check:fn-types" — and the session that wrote it ended with "ran the whole
// lint job locally this time", by hand, because there was no command for it.
// This is that command.
//
// AND IT REPORTS EVERYTHING. GitHub stops a job at its first failing step,
// so a push that breaks three gates reports one; you fix it, push, wait, and
// learn about the second. Forty-two gates deep that is the dominant cost of
// the whole pipeline — not the minutes, the round trips. Every step runs here
// whatever the ones before it did, and the summary at the end names all of
// them.
//
// THE LIST IS DERIVED, NOT RESTATED (lint-steps.mjs). It is read out of
// ci.yml's lint job at run time, so a gate added to CI is added here with no
// second edit and the two cannot drift. The dependency points the right way:
// CI is the authority on what must pass, and this mirrors it.
//
// Which is exactly the shape that fails silently — a parser that matches
// nothing reports success, green because it looked at an empty list, which is
// the D179/D197 class this file is trying to close. So FLOOR is a tripwire in
// check-workflows.mjs's shape: refuse to run at all rather than pass having
// found three gates out of forty.

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintSteps, isSetup, FLOOR } from "./lint-steps.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const steps = lintSteps(readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8"));

if (steps.length < FLOOR) {
  console.error(
    `check-all: read only ${steps.length} steps out of ci.yml's lint job, which is `
    + `below the floor of ${FLOOR}.\n`
    + "That is a broken parser, not a small job. Refusing to run: a gate runner "
    + "that reports success over three of forty gates is worse than no runner, "
    + "because it is believed (D179, D197).",
  );
  process.exit(1);
}

const gates = steps.filter((c) => !isSetup(c));

if (process.argv.includes("--list")) {
  for (const c of gates) console.log(c);
  process.exit(0);
}

// check:fn-types typechecks files importing firebase-admin/firebase-functions,
// so without functions/node_modules it is a hundred TS2307s rather than a
// finding. CI installs them in the lint job for exactly this reason. Say so up
// front instead of reporting a wall of red as if it were the tree's fault.
if (gates.some((c) => c.includes("check:fn-types")) && !existsSync(join(root, "functions", "node_modules"))) {
  console.error(
    "check-all: functions/node_modules is missing, so `check:fn-types` will "
    + "report import errors rather than real findings.\n"
    + "           Run `npm ci --prefix functions` first — CI's lint job does.\n",
  );
}

console.log(`check-all — ${gates.length} steps from ci.yml's lint job. Every one runs.\n`);

const failed = [];
for (const [i, cmd] of gates.entries()) {
  console.log(`\n─── [${String(i + 1).padStart(2)}/${gates.length}] ${cmd}`);
  // Streamed rather than captured: this takes minutes, and a runner that goes
  // quiet for two of them reads as hung. The summary below is what makes the
  // failures findable afterwards.
  const r = spawnSync(cmd, { cwd: root, stdio: "inherit", shell: true });
  const code = r.status ?? 1;
  if (code !== 0) {
    failed.push({ cmd, code, signal: r.signal });
    console.log(`✗ FAILED (exit ${code}) — continuing, so this run reports every failure`);
  }
}

console.log(`\n${"=".repeat(64)}`);
if (!failed.length) {
  console.log(`check-all OK — ${gates.length}/${gates.length} green.`);
  process.exit(0);
}
console.error(`check-all: ${failed.length} of ${gates.length} FAILED\n`);
for (const f of failed) console.error(`  ✗ ${f.cmd}${f.signal ? ` (${f.signal})` : ""}`);
console.error("\nScroll up for each one's output — they ran in the order listed.");
process.exit(1);
