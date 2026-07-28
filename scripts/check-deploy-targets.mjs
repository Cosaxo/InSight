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
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = [
  "functions/src/index.ts",
  "functions/src/v2.ts",
  "functions/src/v2social.ts",
];
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
