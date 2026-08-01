// Seeds the production question bank from CI — the deploy workflow's
// last step (D36). Runs the SAME loop the seedContentV2 callable runs
// (functions/lib/seedCore.js, compiled during the deploy job), with the
// deploy's service-account credentials (GOOGLE_APPLICATION_CREDENTIALS).
// This is what retired "operator forgets to reseed" as a failure mode:
// a content merge deploys, then seeds, and a red seed step is the alarm.
//
// Merge-idempotent by construction (seedCore): existing docs get field
// refreshes, `active` is written only on first create (the ops kill
// switch survives every reseed), and contentRev bumps so clients refetch
// once. Safe to run manually too: FIREBASE_PROJECT overrides the target
// (defaults to prvfire33) for a staging project.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Resolve from the functions tree: firebase-admin and the compiled seed
// live there, not in the root node_modules.
const req = createRequire(join(root, "functions", "package.json"));

if (!existsSync(join(root, "functions", "lib", "seedCore.js"))) {
  console.error("seed-prod: functions/lib is missing — run `npm run build --prefix functions` first");
  process.exit(1);
}

const { initializeApp } = req("firebase-admin/app");
const { getFirestore } = req("firebase-admin/firestore");
const { V2_QUESTIONS } = req("./lib/v2content.js");
const { seedQuestions } = req("./lib/seedCore.js");

const project = process.env.FIREBASE_PROJECT || "prvfire33";
initializeApp({ projectId: project });

const res = await seedQuestions(getFirestore(), V2_QUESTIONS, (m) => console.log(`seed-prod: ${m}`));
console.log(`seed-prod: ${project} — ${res.written} questions written, ${res.created} newly created`);
