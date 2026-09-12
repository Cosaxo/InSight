#!/usr/bin/env node
// verify.mjs — run what CI runs, locally, in one command.
//
// The plan comes from scripts/verify-plan.mjs, which reads it out of
// ci.yml and backend-checks.yml rather than carrying a list; that file's
// header has the three breakages this closes and why the list is derived.
// This half is only the runner: order, reporting, and the exit code.
//
// WHAT IT DOES NOT DO: it is not a merge gate and it does not replace CI.
// CI runs on a clean checkout with the emulators and both native
// toolchains; this runs what a laptop can run. The steps it cannot run are
// PRINTED WITH WHAT THEY NEED, never dropped — a sweep that quietly
// covered 52 of 59 steps and said "OK" would be worse than no sweep,
// because the next person would trust it.
//
// Run:
//   npm run verify              the local gates, in CI's order
//   npm run verify -- --list    print the plan and exit
//   npm run verify -- --bail    stop at the first failure
//   npm run verify -- --all     also attempt the emulator / native / audit steps
//   npm run verify -- --only check:globals,check:docs    just these

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan } from "./verify-plan.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const hit = argv.find((a) => a.startsWith(`${f}=`));
  if (hit) return hit.slice(f.length + 1);
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

// THE TWO WORKFLOWS THAT GATE A PULL REQUEST, and only those.
// backend-checks.yml is reusable and called by both ci.yml and
// firebase-deploy.yml, so reading it here is what makes the sweep cover
// the deploy path too. The release workflows (ios-release, play-release,
// asc-metadata) are deliberately out: their gates want signing material
// and store credentials, so including them would make the default run fail
// on every machine that is not a release runner.
const WORKFLOWS = ["ci.yml", "backend-checks.yml"];

const sources = new Map();
for (const f of WORKFLOWS) {
  sources.set(f, readFileSync(join(root, ".github/workflows", f), "utf8"));
}

const plan = buildPlan(sources);

// ── the honesty check ──────────────────────────────────────────────────
// An unclassified step means a workflow grew a step form verify-plan.mjs
// has not been taught, and the only safe reading of that is "this sweep no
// longer covers CI". Fail loudly rather than run a plan that is quietly
// short, which is the exact defect this script exists to close.
if (plan.unknown.length) {
  console.error("\nverify: these workflow steps are not classified:\n");
  for (const u of plan.unknown) console.error(`  ${u.file}: ${u.command.split("\n")[0]}`);
  console.error(
    "\n  Teach scripts/verify-plan.mjs's classify() about them — a step it"
    + "\n  cannot name is a step this sweep would silently skip, and a sweep"
    + "\n  that covers less than it claims is worse than none.\n",
  );
  process.exit(1);
}

// ── what are we running ────────────────────────────────────────────────
let running = plan.gate;
const only = valueOf("--only");
if (only) {
  const wanted = only.split(",").map((s) => s.trim()).filter(Boolean);
  running = plan.gate.filter((r) => wanted.some((w) => r.command.includes(w)));
  const missed = wanted.filter((w) => !plan.gate.some((r) => r.command.includes(w)));
  if (missed.length) {
    console.error(`verify: --only named nothing in the plan: ${missed.join(", ")}`);
    process.exit(1);
  }
}
if (has("--all")) running = [...running, ...plan.deferred.filter((r) => r.kind !== "setup" && r.kind !== "report")];

// `check:docs` rule 4 asks that every check:* gate be named in
// ORIENTATION.md. Report the reverse here as information, not as a
// failure: a gate defined in package.json but wired into no PR workflow is
// either release-only or genuinely unwired, and this runner is not the
// place that decides which.
const defined = Object.keys(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts)
  .filter((k) => k.startsWith("check:"));
const inPlan = new Set(plan.gate.concat(plan.deferred).map((r) => r.command.replace(/^npm run /, "")));
const elsewhere = defined.filter((g) => !inPlan.has(g));

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `\nverify — ${running.length} step(s) from ${WORKFLOWS.join(" + ")}`
  + `${has("--all") ? " (--all)" : ""}\n`,
);

if (has("--list") || plan.deferred.length) {
  if (!has("--all") && plan.deferred.length) {
    console.log("  not run here:");
    for (const r of plan.deferred) {
      console.log(`    ${pad(r.command.split("\n")[0].slice(0, 44), 46)} ${r.need}`);
    }
    console.log("");
  }
}
if (elsewhere.length) {
  console.log(`  gates outside the PR workflows (release-only): ${elsewhere.join(", ")}\n`);
}

if (has("--list")) {
  console.log("  would run, in order:");
  for (const r of running) console.log(`    ${r.command}`);
  console.log("");
  process.exit(0);
}

// ── run ────────────────────────────────────────────────────────────────
const results = [];
const started = process.hrtime.bigint();
for (const [i, step] of running.entries()) {
  const label = `[${String(i + 1).padStart(2)}/${running.length}] ${step.command}`;
  process.stdout.write(`${label}\n`);
  const at = process.hrtime.bigint();
  // The step's own env and working-directory, as CI sets them. Without
  // this the build runs as a demo build and check:bundle refuses to grade
  // it — red for a reason that is about this runner, not about the tree.
  const r = spawnSync(step.command, {
    cwd: step.cwd ? join(root, step.cwd) : root,
    shell: true,
    stdio: has("--quiet") ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, LC_ALL: "en_US.UTF-8", ...step.env },
  });
  const ms = Number((process.hrtime.bigint() - at) / 1_000_000n);
  const ok = r.status === 0;
  results.push({ ...step, ok, ms, out: has("--quiet") ? `${r.stdout ?? ""}${r.stderr ?? ""}` : "" });
  if (!ok && has("--quiet")) process.stdout.write(results.at(-1).out);
  if (!ok && has("--bail")) break;
}

// ── report ─────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
const totalMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

console.log(`\n${"─".repeat(64)}`);
if (failed.length) {
  console.log(`verify FAILED — ${failed.length} of ${results.length} step(s) red in ${secs(totalMs)}\n`);
  for (const f of failed) console.log(`  ✗ ${f.command}`);
  const notRun = running.length - results.length;
  if (notRun > 0) console.log(`\n  ${notRun} step(s) not reached (--bail).`);
} else {
  console.log(`verify OK — ${results.length} step(s) green in ${secs(totalMs)}`);
}
// The slowest few, because this is the number that decides whether anyone
// runs the sweep before pushing.
const slow = [...results].sort((a, b) => b.ms - a.ms).slice(0, 3).filter((r) => r.ms > 2000);
if (slow.length) console.log(`\n  slowest: ${slow.map((r) => `${r.command.replace(/^npm run /, "")} ${secs(r.ms)}`).join(", ")}`);
if (!has("--all") && plan.deferred.some((r) => r.kind === "emulator" || r.kind === "native")) {
  console.log("\n  Still unproven here: the emulator and native steps listed above.");
}
console.log("");

process.exit(failed.length ? 1 : 0);
