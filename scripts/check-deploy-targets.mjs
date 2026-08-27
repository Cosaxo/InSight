// Does every exported Cloud Function appear in the deploy workflow's
// --only list?
//
// That list names every deployed function by hand — no count here on
// purpose, because the list grows and a number written beside it goes
// stale the same way the list itself would. A function added to
// functions/src/index.ts but not to the string is built, passes every
// test, goes green — and is never deployed. Same silent shape as
// storage.rules being configured and deployed by nothing.
//
// Parses the source with a regex rather than importing it: importing
// functions/src would need a build, and the modules register triggers as
// an import side effect. This stays independent of both.
//
// Since 2026-08-27 this gate also asserts the FIRESTORE deploy form
// reaches every configured database. FIRESTORE-REGION.md § The two
// silent failures asked for exactly this arm when D165's step 4 shipped
// without it: with the multi-database `firestore` ARRAY in firebase.json,
// the sub-target form `--only "firestore:rules,firestore:indexes"` is
// firebase-tools#10447's silently-does-nothing shape — exit 0, "Deploy
// complete!", nothing deployed. The pinned firebase-tools (15.24.0)
// carries the fix (PR #9770); the arm exists because a caret range
// resolves to whatever the lockfile holds, the failure mode is silence,
// and the subject is the file that decides who can read whose answers.
//
// Escape hatch: ALLOW_UNDEPLOYED=name1,name2 for functions deliberately
// left out (a work-in-progress trigger, say).

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = ".github/workflows/firebase-deploy.yml";

// The workflow, split into its named steps, comment lines stripped
// FIRST: the prose above the rules/functions split names both `--force`
// and a firestore target, and a scanner that reads its own explanation
// as the thing it forbids is worse than no scanner. (The same mistake
// check:globals rule 2 used to make on spec-index.js.)
export function workflowSteps(src) {
  return src
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n")
    .split(/^\s*- name:/m);
}

// No deploy may combine --force with a firestore target.
//
// --force is a deploy-wide flag. firebase-tools reads it as
// `shouldDeleteIndexes = options.force` and `shouldDeleteFields =
// options.force` (lib/firestore/api.js), so `--force --only
// "firestore…,functions:…"` deletes every index and field override the
// live project holds that firestore.indexes.json does not name. The
// two the repo asks an operator to create by hand (the v2_agg_events TTL
// of LAUNCH-RUNBOOK §5.1, and the composite index v2social.ts names for
// the duel scan) are exactly the shape it removes.
//
// This paragraph used to add "and that file names exactly one index (the
// v2_takes list composite, D65)". It has named more than one for a while —
// indexes.test.ts is the live account of which query shapes resolve
// against it — and the argument never rested on the count.
//
// The flag is still needed for retry-enabled triggers, hence a split rather
// than a ban: --force on the functions-only step, no --force on the
// firestore one. Checked here rather than left to review because the
// deletion is silent, the run stays green, and the symptom arrives whenever
// the TTL next mattered. The pattern is \bfirestore\b rather than
// `firestore:` so the bare non-sub-target form the multi-database config
// requires stays covered — tightening the deploy form must not loosen
// this arm.
export function forcedFirestoreSteps(steps) {
  return steps.filter(
    (s) => /npx firebase deploy/.test(s)
      && /--force\b/.test(s)
      && /--only\s+"[^"]*\bfirestore\b/.test(s),
  );
}

// The firestore deploy form, held to the config it has to reach.
//
// Returns problem strings; empty means fine. `firestoreCfg` is
// firebase.json's `firestore` value: the single-database OBJECT form may
// use the sub-target spelling (it was correct for the whole one-database
// era), the multi-database ARRAY form may not — under it the sub-target
// spelling is the silent no-op the header describes, and the form that
// reaches every configured database is the bare product, `firestore`.
export function firestoreFormProblems(workflowSrc, firestoreCfg) {
  const problems = [];
  const fsSteps = workflowSteps(workflowSrc).filter(
    (s) => /npx firebase deploy/.test(s) && /--only\s+"[^"]*\bfirestore\b/.test(s),
  );

  if (!fsSteps.length) {
    problems.push(
      "no step deploys a firestore target — firestore.rules configured and\n"
      + "  deployed by nothing is the storage.rules failure this gate's header\n"
      + "  records. If the step moved, update this gate rather than letting it\n"
      + "  pass vacuously.",
    );
    return problems;
  }

  if (!Array.isArray(firestoreCfg)) return problems;

  for (const s of fsSteps) {
    const only = s.match(/--only\s+"([^"]*)"/);
    const entries = only ? only[1].split(",").map((e) => e.trim()) : [];
    const sub = entries.filter((e) => /^firestore:/.test(e));
    if (sub.length) {
      problems.push(
        `the sub-target form under the multi-database config: ${sub.join(", ")}\n`
        + "  firebase.json's `firestore` key is the multi-database ARRAY (D165),\n"
        + "  and under it this spelling is firebase-tools#10447's\n"
        + '  silently-does-nothing shape — exit 0, "Deploy complete!", nothing\n'
        + '  deployed. Use the non-sub-target form: --only "firestore"\n'
        + "  (FIRESTORE-REGION.md § The two silent failures).",
      );
    }
  }
  return problems;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
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
  const SOURCES = readdirSync(resolve(root, "functions", "src"), { recursive: true })
    .map((f) => String(f).split(sep).join("/"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => `functions/src/${f}`);

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

  const forcedFirestore = forcedFirestoreSteps(workflowSteps(workflow));
  if (forcedFirestore.length) {
    console.error(
      `check-deploy-targets: ${WORKFLOW} deploys a firestore target under --force.\n`
      + forcedFirestore.map((s) => `    ${s.trim().replace(/\s+/g, " ").slice(0, 160)}…`).join("\n")
      + "\n\n  --force makes firebase-tools DELETE every index and field override the\n"
      + "  project holds that firestore.indexes.json does not list. Split the step:\n"
      + '  `--only "firestore"` with no --force, then\n'
      + '  `--force --only "functions:…"`.',
    );
    process.exit(1);
  }

  const firestoreCfg = JSON.parse(readFileSync(resolve(root, "firebase.json"), "utf8")).firestore;
  const formProblems = firestoreFormProblems(workflow, firestoreCfg);
  if (formProblems.length) {
    console.error(
      `check-deploy-targets: ${WORKFLOW} — `
      + formProblems.join("\n\ncheck-deploy-targets: " + WORKFLOW + " — "),
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
    `deploy-targets OK — ${exported.length} exported functions, all present in --only; `
    + `firestore deploy form reaches every configured database`
    + (allowed.size ? ` (${allowed.size} explicitly allowed undeployed)` : ""),
  );
}
