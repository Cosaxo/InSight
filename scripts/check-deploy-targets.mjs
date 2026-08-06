// Does every exported Cloud Function appear in the deploy workflow's
// --only list?
//
// That list names 17 functions by hand. A function added to
// functions/src/index.ts but not to the string is built, passes every
// test, goes green — and is never deployed. Same silent shape as
// storage.rules being configured and deployed by nothing.
//
// Parses the source with a regex rather than importing it: importing
// functions/src would need a build, and the modules register triggers as
// an import side effect. This stays independent of both.
//
// Escape hatch: ALLOW_UNDEPLOYED=name1,name2 for functions deliberately
// left out (a work-in-progress trigger, say).

import { readFileSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every non-test source under functions/src, discovered rather than
// listed: the hardcoded list this replaced silently missed the first new
// module added after it (moderation.ts) — three functions built, tested,
// green, and invisible to the one gate whose whole job is catching that.
// RECURSIVE. `readdirSync` without it returns directory ENTRIES, which the
// .ts filter then drops silently — so a callable in functions/src/duels/
// would be invisible here and in check-appcheck.mjs, and neither script's
// vacuity counter can save it: both count only what they read. Latent while
// functions/src is flat, which is exactly how the moderation.ts miss this
// script's own comment records happened.
import { readdirSync } from "node:fs";
const SOURCES = readdirSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "functions", "src"),
  { recursive: true },
)
  .map((f) => String(f).split(sep).join("/"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => `functions/src/${f}`);
const WORKFLOW = ".github/workflows/firebase-deploy.yml";

const allowed = new Set(
  (process.env.ALLOW_UNDEPLOYED || "").split(",").map((s) => s.trim()).filter(Boolean),
);

let exported = [];
try {
  for (const rel of SOURCES) {
    const src = readFileSync(resolve(root, rel), "utf8");
    // `export const NAME = onCall(...)` / onSchedule / onDocumentCreated…
    for (const m of src.matchAll(/^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*on[A-Z]/gm)) {
      exported.push({ name: m[1], file: rel });
    }
  }
} catch (err) {
  console.error(
    "check-deploy-targets: could not read a functions source file.\n"
    + "If a file was renamed, update SOURCES in this script.\n"
    + String(err),
  );
  process.exit(1);
}

if (!exported.length) {
  console.error(
    "check-deploy-targets: found NO exported functions, which cannot be right.\n"
    + "The export pattern probably changed — fix this script rather than\n"
    + "letting it pass vacuously.",
  );
  process.exit(1);
}

const workflow = readFileSync(resolve(root, WORKFLOW), "utf8");
const only = workflow.match(/--only\s+"([^"]*functions:[^"]*)"/);
if (!only) {
  console.error(`check-deploy-targets: no --only list found in ${WORKFLOW}`);
  process.exit(1);
}
const deployed = new Set(
  [...only[1].matchAll(/functions:([A-Za-z0-9_]+)/g)].map((m) => m[1]),
);

// …and no deploy may combine --force with a firestore target.
//
// --force is a deploy-wide flag. firebase-tools reads it as
// `shouldDeleteIndexes = options.force` and `shouldDeleteFields =
// options.force` (lib/firestore/api.js), so `--force --only
// "firestore:indexes,functions:…"` deletes every index and field override
// the live project holds that firestore.indexes.json does not name — and
// that file declares `"indexes": []`. The two the repo asks an operator to
// create by hand (the v2_agg_events TTL of LAUNCH-RUNBOOK §5.1, and the
// composite index v2social.ts names for the duel scan) are exactly the
// shape it removes.
//
// The flag is still needed for retry-enabled triggers, hence a split rather
// than a ban: --force on the functions-only step, no --force on the
// rules+indexes one. Checked here rather than left to review because the
// deletion is silent, the run stays green, and the symptom arrives whenever
// the TTL next mattered.
// Comments are stripped first: the prose above the split step names both
// `--force` and a firestore target, and a scanner that reads its own
// explanation as the thing it forbids is worse than no scanner. (The same
// mistake check:globals rule 2 used to make on spec-index.js.)
const steps = workflow
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n")
  .split(/^\s*- name:/m);

const forcedFirestore = steps.filter(
  (s) => /npx firebase deploy/.test(s)
    && /--force\b/.test(s)
    && /--only\s+"[^"]*firestore:/.test(s),
);

if (forcedFirestore.length) {
  console.error(
    `check-deploy-targets: ${WORKFLOW} deploys a firestore target under --force.\n`
    + forcedFirestore.map((s) => `    ${s.trim().replace(/\s+/g, " ").slice(0, 160)}…`).join("\n")
    + "\n\n  --force makes firebase-tools DELETE every index and field override the\n"
    + "  project holds that firestore.indexes.json does not list. Split the step:\n"
    + '  `--only "firestore:rules,firestore:indexes"` with no --force, then\n'
    + '  `--force --only "functions:…"`.',
  );
  process.exit(1);
}

const missing = exported.filter((f) => !deployed.has(f.name) && !allowed.has(f.name));
const stale = [...deployed].filter((n) => !exported.some((f) => f.name === n));

for (const f of missing) {
  console.error(`MISSING from the deploy list: ${f.name}  (${f.file})`);
}
for (const n of stale) {
  console.error(`STALE in the deploy list — no such export: ${n}`);
}

if (missing.length || stale.length) {
  console.error(
    "\nA function missing from --only is built, tested, green and never\n"
    + "deployed. Add it to the list in " + WORKFLOW + ", or set\n"
    + "ALLOW_UNDEPLOYED=" + missing.map((f) => f.name).join(",") + " if that is deliberate.",
  );
  process.exit(1);
}

console.log(
  `deploy-targets OK — ${exported.length} exported functions, all present in --only`
  + (allowed.size ? ` (${allowed.size} explicitly allowed undeployed)` : ""),
);
