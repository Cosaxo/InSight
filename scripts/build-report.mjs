// build-report.mjs — build one question report (PAID-PLAN §9.2 v1).
//
//   node scripts/build-report.mjs --qid feed-042 --emulator
//   VITE_FIREBASE_API_KEY=… VITE_FIREBASE_PROJECT_ID=… VITE_FIREBASE_APP_ID=… \
//     node scripts/build-report.mjs --qid feed-042
//
// Run BY HAND, per contract — v1 is a script, not a scheduled job
// (PAID-PLAN §9.2: "sell by hand at hand-set prices"). Output lands in
// reports/<qid>-<day>/ — GITIGNORED, because the roll carries public app
// names and a repo is not where a deliverable with names in it belongs.
//
// AUTH POSTURE, the load-bearing choice: this signs in ANONYMOUSLY and
// reads through the client SDK, so every read runs the exact rules path
// any signed-in user gets. "A buyer gets no read path a signed-in user
// does not have" (D225) is enforced by firestore.rules itself here, not
// promised — and REPORT_READ_SET (report-lib.mjs) bounds which
// world-readable collections the builder touches on top of that. Each
// prod run mints one throwaway anonymous account; that is the cost of
// reading as an ordinary user, and it answers nothing, so it perturbs no
// count.
//
// App Check: the Firestore data plane is not enforced yet (LAUNCH-RUNBOOK
// 3.4). The day it flips, this script needs a debug token
// (FIREBASE_APPCHECK_DEBUG_TOKEN) registered in the console — noted here
// so the failure, when it comes, names its own fix.
//
// Reads per run, the arithmetic (all billed as ordinary reads): the agg
// and question docs (2) + the roll (one read per answer) + profiles
// (one per distinct voter) + the neighbour join (per sampled voter,
// ceil(candidates/30) `in` queries billing only the answers found). At
// launch scale that is hundreds, not thousands; the basis lines on the
// page state every bound.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, collection, collectionGroup, doc,
  getDoc, getDocs, query, where, orderBy, limit, startAfter, documentId,
} from "firebase/firestore";
import { makeReader, buildReportData, renderReportHtml, renderCsvs } from "./report-lib.mjs";

const arg = (name) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const has = (name) => process.argv.includes("--" + name);

const qid = arg("qid");
if (!qid) {
  console.error("usage: node scripts/build-report.mjs --qid <qid> [--emulator] [--out <dir>] [--sample <n>]");
  process.exit(1);
}

// The dims and their closed vocabularies come from the functions' own
// compiled output (the e2e's D201 pattern) — one source, the same one
// check:anchors holds to the profile selects, never a copy here.
let vocab;
try {
  const pure = await import("../functions/lib/pure.js");
  vocab = { dims: pure.BREAKDOWN_DIMS, byDim: pure.BREAKDOWN_DIM_VOCAB };
} catch {
  console.error("functions/lib is not built — run `npm run build --prefix functions` first.");
  process.exit(1);
}

// The named database (D165) — same env override the backend and the e2e
// harness read, so this cannot silently point at `(default)`.
const DB_ID = process.env.FIRESTORE_DB_ID || "insight";

let app, auth, db;
if (has("emulator")) {
  app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
  auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  db = getFirestore(app, DB_ID); connectFirestoreEmulator(db, "127.0.0.1", 8080);
} else {
  const need = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("missing env: " + missing.join(", ") + " (the app's own config names — src/lib/firebase.ts)");
    process.exit(1);
  }
  app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
  auth = getAuth(app);
  db = getFirestore(app, DB_ID);
}

await signInAnonymously(auth);

const reader = makeReader({
  db, collection, collectionGroup, doc, getDoc, getDocs,
  query, where, orderBy, limit, startAfter, documentId,
});

const opts = { qid, vocab };
const sampleArg = arg("sample");
if (sampleArg !== null) {
  const n = Number(sampleArg);
  // Rejected loudly, not coerced: `--sample 3OO` as NaN would slice the
  // join to nothing and ship a report claiming a 0-voter basis, and
  // `--sample 0` silently ignored would pay for the full join the
  // operator asked to skip.
  if (!Number.isFinite(n) || n < 0) {
    console.error(`--sample must be a non-negative number, got "${sampleArg}"`);
    process.exit(1);
  }
  opts.neighbourSample = n;
}
const data = await buildReportData(reader, opts);

const day = data.generatedAt.slice(0, 10);
const out = arg("out") || join("reports", `${qid}-${day}`);
mkdirSync(out, { recursive: true });
const csvs = renderCsvs(data);
writeFileSync(join(out, "report.html"), renderReportHtml(data));
writeFileSync(join(out, "roll.csv"), csvs.roll);
writeFileSync(join(out, "edits.csv"), csvs.edits);
writeFileSync(join(out, "series.csv"), csvs.series);

console.log(`report for ${qid} — ${data.total} answers, ${data.roll.length} roll rows, ` +
  `${data.edits.moves} moves, ${data.neighbours.length} neighbours → ${out}/`);
console.log("reads:", JSON.stringify(reader.stats.reads), "queries:", reader.stats.queries);
console.log("the bundle carries public app names — deliver it to the buyer; do not commit it.");
process.exit(0);
