#!/usr/bin/env node
// check-fn-boot.mjs — what every Cloud Function loads before it can serve
// anything, as a shrink-only ratchet and a denylist.
//
// WHY IT EXISTS. `firebase.json` declares one codebase, so a container
// loads the WHOLE of functions/lib/index.js on every cold start, whichever
// single function it was started to serve. That graph was unmeasured —
// `check:eager-content` makes exactly this claim about the client's
// first-paint graph and nothing made it about the server's — and what grew
// in the gap was not the app's own code:
//
//   27 modules wrote `import { logger } from "firebase-functions"`, the
//   ROOT barrel, which re-exports the v1 API and every v2 provider
//   including `database`. That pulled firebase-admin/database and
//   @firebase/database-compat — the Realtime Database client — into all 49
//   functions of an app that does not use Realtime Database at all.
//   Measured on the compiled index, median of three fresh processes:
//   744 ms and 831 modules before, 637 ms and 802 after the imports moved
//   to `firebase-functions/logger`. Every logger member is the IDENTICAL
//   function object across the two specifiers, so the swap could not
//   change behaviour — which is also why nothing else in the tree noticed
//   it for as long as it stood.
//
// WHY THE GRAPH AND NOT THE CLOCK. A timing ratchet on a shared CI runner
// is noise: the same tree measured 637 and 744 ms here within a minute,
// and a gate that fails on a slow neighbour is a gate people re-run until
// it passes. Module PRESENCE is exact, reproducible, and names the thing
// to fix. So this asserts two things that do not move with load:
//
//   1. DENYLIST — a package the app provably does not use may not be in
//      the boot graph. Each entry carries what it is and how it got in.
//   2. RATCHET — the module count may only go DOWN, `check:globals` rule
//      4's shape. A shrink fails too, asking for the baseline to come
//      down with it, so the number cannot quietly drift back up after
//      somebody's cleanup.
//
// WHAT IT IS NOT. Not a cold-start budget and no opinion about how big the
// graph should be. It needs a BUILT functions/lib — it requires the real
// compiled entry rather than reading imports, because the whole failure
// class here is transitive: not one line in this repository names
// @firebase/database-compat.
//
// Run: node scripts/check-fn-boot.mjs   (after `npm run build --prefix functions`)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DENY, evaluateBootGraph, packagesOf } from "./fn-boot-rules.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(root, "functions/lib/index.js");
const SELF = "scripts/check-fn-boot.mjs";

// ── the baseline ───────────────────────────────────────────────────────
// Lower it in the same commit that removes modules; the script prints the
// new number. Raising it is allowed and is the point: it becomes a line in
// a diff somebody has to justify, rather than an accident.
const MAX_MODULES = 802;


if (!existsSync(ENTRY)) {
  console.error(
    `check-fn-boot: no build at functions/lib/index.js.\n`
    + `  This gate requires the compiled entry, because the failure class is\n`
    + `  TRANSITIVE — no line in this repository names @firebase/database-compat.\n\n`
    + `  Run: npm run build --prefix functions\n`,
  );
  process.exit(1);
}

// Load the real entry in a FRESH process and report its module cache. A
// subprocess rather than an import here, so this gate's own dependencies
// can never appear in the graph it is measuring.
const probe = `
  require(${JSON.stringify(ENTRY)});
  const mods = Object.keys(require.cache)
    .map((p) => p.replace(${JSON.stringify(root + "/")}, ""));
  process.stdout.write(JSON.stringify(mods));
`;
let modules;
try {
  modules = JSON.parse(execFileSync(process.execPath, ["-e", probe], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    // The entry defines functions; it must not try to reach a project.
    env: { ...process.env, FUNCTIONS_CONTROL_API: "true", GCLOUD_PROJECT: "demo-check" },
  }));
} catch (err) {
  console.error(
    "check-fn-boot: could not load functions/lib/index.js.\n\n"
    + String(err.stderr || err.message).split("\n").slice(0, 12).map((l) => `  ${l}`).join("\n")
    + "\n\n  A boot that throws is a cold start that fails. Fix the entry, or\n"
    + "  rebuild if lib/ is stale: npm run build --prefix functions\n",
  );
  process.exit(1);
}

let failed = false;
const problems = evaluateBootGraph(modules, { maxModules: MAX_MODULES, deny: DENY });
const said = (rule) => problems.filter((p) => p.rule === rule);

// ── rule 1: the denylist ───────────────────────────────────────────────
for (const p of said("deny")) {
  failed = true;
  const entry = DENY.find((d) => d.match === p.match);
  console.error(`\ncheck-fn-boot: ${p.match} is in every function's boot graph.\n`);
  console.error(`  ${entry.why.split("\n").join("\n  ")}\n`);
  console.error(`  ${p.hits.length} file(s), e.g.:`);
  for (const h of p.hits.slice(0, 3)) console.error(`    ${h.replace(/^.*node_modules\//, "")}`);
}

// A denylist entry that stops matching is not a win to keep quiet about —
// it means the reason is gone, and the entry now documents nothing. Same
// shape as check-appcheck's exemption list and check:eager-content's
// allowlist: the list may not outlive its subjects.
//
// Deliberately NOT a failure, unlike those two, and the asymmetry is the
// point: their entries name debt that someone must come back for, so a
// stale one hides a finished job. These name a package that must stay OUT,
// so "no longer present" is the gate working. Printing it is enough.
const inert = DENY.filter((e) => !problems.some((p) => p.rule === "deny" && p.match === e.match));
if (inert.length && inert.length !== DENY.length) {
  console.log(`check-fn-boot: still enforced and currently absent — ${inert.map((e) => e.match).join(", ")}`);
}

// ── rule 2: the ratchet ────────────────────────────────────────────────
for (const p of said("grew")) {
  failed = true;
  console.error(
    `\ncheck-fn-boot: the boot graph grew — ${p.count} modules, baseline ${MAX_MODULES}.\n\n`
    + `  Every one of these is parsed on every cold start of every function,\n`
    + `  including the ones that never touch what was added. Either drop the\n`
    + `  dependency from the eager path (a lazy require() inside the handler\n`
    + `  that needs it works — functions/ is CommonJS), or raise MAX_MODULES\n`
    + `  in ${SELF} in the same commit, saying why.\n`,
  );
}

for (const p of said("shrank")) {
  if (failed) break;   // a denied package present is the thing to fix first
  if (process.argv.includes("--pin")) {
    const src = readFileSync(join(root, SELF), "utf8");
    writeFileSync(
      join(root, SELF),
      src.replace(/^const MAX_MODULES = \d+;$/m, `const MAX_MODULES = ${p.count};`),
    );
    console.log(`check-fn-boot: baseline pinned to ${p.count}.`);
    process.exit(0);
  }
  failed = true;
  console.error(
    `\ncheck-fn-boot: the boot graph SHRANK — ${p.count} modules against a `
    + `${MAX_MODULES} baseline.\n\n`
    + `  That is the good direction and the gate still fails, for check:globals\n`
    + `  rule 4's reason: a ratchet that only notices growth lets the number\n`
    + `  drift back up to an old ceiling for free. Bring the baseline down with\n`
    + `  the improvement:\n\n`
    + `    node ${SELF} --pin\n`,
  );
}

if (failed) process.exit(1);

const packages = packagesOf(modules);
console.log(
  `check-fn-boot OK — ${modules.length} modules at the ceiling `
  + `(${packages.size} packages) in every function's cold start, `
  + `${DENY.length} denied package(s) absent`,
);
