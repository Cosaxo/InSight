#!/usr/bin/env node
// routines.mjs — the I/O half of the recreation kit (docs/RECREATE.md,
// docs/PROGRAM-RUNBOOK.md phase 3, D352). Everything that decides lives
// in routines-lib.mjs; this file reads the tree and prints.
//
//   node scripts/routines.mjs --check              the gate (check:routines)
//   node scripts/routines.mjs --write              regenerate docs/RECREATE.md
//   node scripts/routines.mjs --plan <account>     every Routine of an account,
//                                                  with the create_trigger
//                                                  arguments and the web-UI
//                                                  fields; --missing keeps
//                                                  only those not live
//   node scripts/routines.mjs --message <account>  the one line to give a
//                                                  session on that account
//
// WHAT THE GATE HOLDS. The manifest parses and is well-formed; every
// prompt it points at is a fenced block on this branch with no account
// placeholder left in it; every trigger id an inventory table in docs/
// names is a Routine the manifest knows (live or retired); and
// docs/RECREATE.md is what the manifest renders. Stdlib only.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCOUNTS, checkRoutines, parseManifest, pasteLine, plan, renderRecreate } from "./routines-lib.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST = "routines/manifest.json";
const PAGE = "docs/RECREATE.md";

// Generated pages and the decision record carry ids as history, not as
// claims that a Routine exists; the register (ROUTINES.md, when it lands)
// and every runbook inventory do claim it, and are read.
const NOT_INVENTORIES = new Set(["docs/DECISIONS.md", "docs/DECISIONS-INDEX.md", "docs/MERGE-LIST.md", PAGE]);

const readFile = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null);

function inventories() {
  const out = {};
  for (const f of readdirSync(join(ROOT, "docs"))) {
    if (!f.endsWith(".md")) continue;
    const p = `docs/${f}`;
    if (NOT_INVENTORIES.has(p)) continue;
    out[p] = readFileSync(join(ROOT, p), "utf8");
  }
  return out;
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const after = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

const manifestText = readFile(MANIFEST);
if (manifestText == null) {
  console.error(`${MANIFEST} is missing`);
  process.exit(1);
}

if (flag("--check")) {
  const problems = checkRoutines({ manifestText, readFile, inventories: inventories(), recreateText: readFile(PAGE) });
  if (problems.length) {
    console.error(`check:routines — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const { manifest } = parseManifest(manifestText);
  const live = manifest.routines.filter((r) => r.state === "live").length;
  console.log(`check:routines OK — ${manifest.routines.length} routines across ${Object.keys(ACCOUNTS).length} accounts, ${live} live; ${PAGE} is current`);
  process.exit(0);
}

const { manifest, problems } = parseManifest(manifestText);
if (!manifest || problems.length) {
  console.error(`${MANIFEST} has problems — run --check`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

if (flag("--write")) {
  writeFileSync(join(ROOT, PAGE), renderRecreate(manifest, readFile));
  console.log(`wrote ${PAGE} — ${manifest.routines.length} routines`);
} else if (after("--plan")) {
  console.log(JSON.stringify(plan(manifest, after("--plan"), readFile, { missing: flag("--missing") }), null, 2));
} else if (after("--message")) {
  console.log(pasteLine(after("--message")));
} else {
  console.error("usage: routines.mjs --check | --write | --plan <account> [--missing] | --message <account>");
  console.error(`accounts: ${Object.keys(ACCOUNTS).join(", ")}`);
  process.exit(2);
}
