#!/usr/bin/env node
// check-data-inventory.mjs — every collection the rules grant access to
// appears in docs/data-inventory.md.
//
// WHY THIS EXISTS. `data-inventory.md` is what design/store/app-privacy.json
// says its answers have to agree with, and app-privacy.json is the App Store
// privacy label — a legal statement about what the app collects. So the
// inventory is the bottom of that stack, and nothing was holding it to the
// code. It went stale the ordinary way: a feature ships a collection, the
// rules learn about it because they must, and the document that feeds the
// filing does not, because nothing fails when it doesn't.
//
// D130 found three at once on the build-12 pre-flight, all shipped between
// builds 11 and 12 and none of them exotic: the D122 handle registry
// (world-readable), D122's circle invitations, and D126's foresight
// verdicts (world-readable, under the user's own document). No declared
// label ANSWER was wrong — all three fall under types already declared Yes
// — which is exactly why nobody noticed, and exactly why a gate is worth
// more here than a resolution to be careful. D116 made that argument for
// public copy and built check-public-copy.mjs; this is the same argument
// one layer down, and D106 → D116 is the evidence that the discipline
// version does not hold.
//
// WHAT IT CHECKS, and the limit is the point: it is a NAME check, the same
// class as check:globals. Every `match /X/{…}` in firestore.rules names a
// collection; each name must appear somewhere in docs/data-inventory.md.
// It does NOT read the row, verify who the row says may read it, or notice
// a row that has gone stale in place — a name is cheap to check and a
// claim is not. What it guarantees is narrow and is the thing that failed:
// a collection cannot ship without the inventory at least naming it.
//
// It cannot see collections that exist only in Cloud Functions with no
// rules block, because those have no client access path to grant. That is
// a real gap and a deliberate one: server-only working state is not what
// the privacy label asks about. Anything a client can read or write has a
// match block by construction, and that is the set this guards.
//
// Run: node scripts/check-data-inventory.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RULES = join(ROOT, "firestore.rules");
const INVENTORY = join(ROOT, "docs/data-inventory.md");

// Names that appear as a `match` path but are not user data. Each carries
// the reason it cannot be a row, in the shape check:appcheck uses for its
// exemptions — an unexplained entry here is how a gate becomes a rubber
// stamp, so the script refuses one (see below).
const EXEMPT = {
  databases:
    "Not a collection. `match /databases/{database}/documents` is the wrapper every rules file opens with, and it matches the same shape as a collection path.",
  v2_questions:
    "The question BANK — content the app ships, not data it collects from anyone. Client-read-only, server-seeded (seedContentV2). Its drift gates are check:catalogs and check:figures, which read the bank itself.",
  v2_meta:
    "Global app config (minBuild and friends). World-readable, server-written, and holds nothing about any person.",
  v2_velocity:
    "A single global document, `v2_velocity/state` — the daily ledger scan's cursor (D54). Server-only, one doc for the whole app, not per-uid.",
};

const rules = readFileSync(RULES, "utf8");
const inventory = readFileSync(INVENTORY, "utf8");

// Every match path segment that looks like a collection: `match /X/{…}`.
// Subcollections match the same way and are wanted — `invites` and
// `foresight` are both nested, and both were missing when this was written.
const named = new Set();
for (const m of rules.matchAll(/match\s+\/([A-Za-z0-9_]+)\/\{/g)) named.add(m[1]);

const collections = [...named].sort();
const problems = [];

// An exemption for a name the rules no longer mention is a stale excuse,
// and it is the failure mode of every allowlist: the list outlives the
// thing it excused and quietly starts excusing something else.
for (const name of Object.keys(EXEMPT)) {
  if (!named.has(name)) {
    problems.push(
      `stale exemption: "${name}" is exempted here but has no match block in firestore.rules.\n` +
        `    → remove it from EXEMPT in ${"scripts/check-data-inventory.mjs"}`,
    );
  }
  if (!EXEMPT[name] || !EXEMPT[name].trim()) {
    problems.push(`exemption "${name}" carries no reason — an unexplained exemption is not one`);
  }
}

const missing = collections.filter((c) => !(c in EXEMPT) && !inventory.includes(c));
for (const name of missing) {
  problems.push(
    `${name} is reachable through firestore.rules but is not named in docs/data-inventory.md\n` +
      `    → add a row (what it holds, where it lives, who may read it, how it is erased),\n` +
      `      or exempt it in EXEMPT with the reason it is not user data.`,
  );
}

if (problems.length) {
  console.error("check-data-inventory: FAILED\n");
  for (const p of problems) console.error(`  ${p}\n`);
  console.error(
    "docs/data-inventory.md is the source design/store/app-privacy.json answers from,\n" +
      "and that file is the App Store privacy label. A collection missing here is a\n" +
      "collection the filing was not derived against (D130).",
  );
  process.exit(1);
}

const covered = collections.length - Object.keys(EXEMPT).length;
console.log(
  `check-data-inventory OK — ${covered} collection(s) named in docs/data-inventory.md, ` +
    `${Object.keys(EXEMPT).length} exempted with reasons.`,
);
