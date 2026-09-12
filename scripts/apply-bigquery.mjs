#!/usr/bin/env node
// apply-bigquery.mjs — create the answer log's home in BigQuery
// (SCALE-ARCHITECTURE.md phase A, D447): dataset `insight` in europe-west1
// and the `answers` table — partitioned by day, clustered by person then
// question — from bigquery/answers.schema.json, the file functions/src/log.ts
// is held to.
//
//   node scripts/apply-bigquery.mjs            # dry run: what it would create
//   node scripts/apply-bigquery.mjs --apply    # create what is missing
//
// Same posture as apply-monitoring.mjs, for the same reasons: REST with the
// deploy service account's token (google-api.mjs), dry by default,
// idempotent — every object is looked up by name first and a second run
// reports "exists". Not on the deploy path: a dataset is created once and
// a pipeline that can create one can drop one.
//
// WHAT IT DOES NOT DO. The functions' runtime service account needs two
// roles to write rows and run the erasure DML — BigQuery Data Editor and
// BigQuery Job User — and granting IAM is the owner's click, not a
// script's: this prints the two commands and stops. The region is fixed
// to the named database's (D165): the privacy page places the data in
// Google Cloud's EU infrastructure, and a dataset elsewhere would move it.
//
// WHO THE GRANT GOES TO is READ, never typed (D-2026-09-12a). From
// 2026-09-09 to 2026-09-12 this printed `${PROJECT}@appspot…`, the gen-1
// default, and the owner ran the click against it on 2026-09-10 — while
// every function in this tree is gen-2 and runs as the Compute Engine
// default account. So the account is looked up on the deployed trigger
// (`serviceConfig.serviceAccountEmail`), the project's policy and the
// dataset's access list are read for what it already holds
// (bigquery-grants.mjs, the arithmetic observe.mjs shares), and the two
// commands print only for a role that is actually missing. Before the
// first deploy there is no function to read, and the fallback says so.
//
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";
import { stripComments } from "./strip-comments.mjs";
import { logAccess, grantCommands } from "./bigquery-grants.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const PROJECT = argOf("--project") || process.env.FIREBASE_PROJECT_ID || "prvfire33";

export const DATASET = "insight";
export const TABLE = "answers";
export const LOCATION = "europe-west1";
/** The trigger's own name, the function the grant is for. */
export const TRIGGER = "onV2AnswerCreated";

// READ, not retyped (D200/D201), the way observe.mjs reads it — through
// stripComments, so a superseded region parked in a comment above the live
// line cannot be the one this matches (source-pins.test.mjs).
const REGION = (() => {
  const m = stripComments(readFileSync(resolve(root, "src/lib/region.ts"), "utf8")).match(/export const FUNCTIONS_REGION = "([^"]+)"/);
  if (!m) { console.error("apply-bigquery: could not read FUNCTIONS_REGION from src/lib/region.ts"); process.exit(1); }
  return m[1];
})();

/** The request bodies, pure so scripts/apply-bigquery.test.mjs can hold
 *  them to the schema file and to log.ts's own reading of the table. */
export function datasetBody(project, dataset = DATASET, location = LOCATION) {
  return {
    datasetReference: { projectId: project, datasetId: dataset },
    location,
    description: "InSight's answer log (SCALE-ARCHITECTURE.md, D447): one row per ledger entry, the truth every nightly fold is computed from.",
  };
}

export function tableBody(project, schema, dataset = DATASET, table = TABLE) {
  return {
    tableReference: { projectId: project, datasetId: dataset, tableId: table },
    schema: { fields: schema },
    // One partition per UTC day of `day`, so a nightly query over a day
    // scans that day and nothing else, and the reconcile's ±1-day lookup
    // scans three.
    timePartitioning: { type: "DAY", field: "day" },
    // Clustered by PERSON then question (2026-09-09; it was question then
    // person). Clustering prunes on a prefix of its columns, so the order
    // decides which filter reads less: the one DML statement the design
    // has is the erasure's `WHERE uid IN …` (log.ts), and the nightly's
    // per-question work is a window over the DAY partition, which the
    // partitioning already bounds and clustering cannot shrink further.
    // A per-question scan over all time — a sample rebuilt from scratch —
    // is the rare query this order makes a full scan; the erasure that
    // runs every night is the one it makes a fraction. Whether BigQuery
    // prunes a DELETE by cluster as it prunes a SELECT could not be read
    // from here (the docs host is unreachable from the sandbox); the
    // nightly batch in log.ts bounds the cost either way, and this order
    // is free to choose while the table does not exist yet.
    clustering: { fields: ["uid", "qid"] },
    description: "One row per answer (a D86 edit is a second row with from_idx). Appended by the answer trigger, reconciled nightly from the Firestore ledger, backfilled once from the answer documents; deleted per account by deleteAccount.",
  };
}

export function readSchema() {
  return JSON.parse(readFileSync(resolve(root, "bigquery/answers.schema.json"), "utf8"));
}

async function main() {
  const sa = serviceAccount("apply-bigquery");
  const token = await accessToken(sa, "apply-bigquery");
  const base = api("bigquery.googleapis.com", `/bigquery/v2/projects/${PROJECT}`);
  console.log(`apply-bigquery: project ${PROJECT}, ${DATASET}.${TABLE} in ${LOCATION}${APPLY ? "  [APPLY]" : "  [dry run]"}`);

  // The dataset's own access list, for the grant reading below — a console
  // grant lands there rather than on the project, and a reading that only
  // asked the project would send the owner to grant what is already held.
  let datasetAccess = null;
  const ds = await googleFetch(`${base}/datasets/${DATASET}`, token);
  if (ds.ok) {
    const where = ds.body.location || "?";
    datasetAccess = ds.body.access || [];
    console.log(`  dataset ${DATASET}: exists (${where})`);
    if (where.toLowerCase() !== LOCATION) {
      console.error(`  ✗ dataset ${DATASET} is in ${where}, not ${LOCATION} — the log must stay in the named database's region; delete and re-create it, or point LOG_DATASET at one that is`);
      process.exit(1);
    }
  } else if (ds.status === 404) {
    if (APPLY) {
      const made = await googleFetch(`${base}/datasets`, token, { method: "POST", body: datasetBody(PROJECT) });
      if (!made.ok) { console.error(`  ✗ dataset create failed: ${made.status} ${made.message}`); process.exit(1); }
      datasetAccess = made.body.access || [];
      console.log(`  dataset ${DATASET}: created in ${LOCATION}`);
    } else {
      console.log(`  dataset ${DATASET}: would create in ${LOCATION}`);
    }
  } else {
    console.error(`  ✗ cannot read dataset ${DATASET}: ${ds.status} ${ds.message}`);
    process.exit(1);
  }

  const tb = await googleFetch(`${base}/datasets/${DATASET}/tables/${TABLE}`, token);
  if (tb.ok) {
    const have = (tb.body.schema?.fields || []).map((f) => f.name);
    const want = readSchema().map((f) => f.name);
    const missing = want.filter((n) => !have.includes(n));
    console.log(`  table ${TABLE}: exists (${have.length} fields${missing.length ? `; MISSING ${missing.join(", ")} — add them by hand, a schema change is not this script's` : ""})`);
    if (missing.length) process.exit(1);
  } else if (tb.status === 404) {
    if (APPLY) {
      const made = await googleFetch(`${base}/datasets/${DATASET}/tables`, token, { method: "POST", body: tableBody(PROJECT, readSchema()) });
      if (!made.ok) { console.error(`  ✗ table create failed: ${made.status} ${made.message}`); process.exit(1); }
      console.log(`  table ${TABLE}: created (partitioned by day, clustered by uid, qid)`);
    } else {
      console.log(`  table ${TABLE}: would create (${readSchema().length} fields, partitioned by day, clustered by uid, qid)`);
    }
  } else if (tb.status !== 404) {
    console.error(`  ✗ cannot read table ${TABLE}: ${tb.status} ${tb.message}`);
    process.exit(1);
  }

  // THE GRANT, read rather than assumed: which account the trigger runs
  // as, and what it already holds. Both reads are dry in every mode.
  console.log("");
  const fn = await googleFetch(
    api("cloudfunctions.googleapis.com", `/v2/projects/${PROJECT}/locations/${REGION}/functions/${TRIGGER}`), token);
  const account = fn.ok ? fn.body.serviceConfig?.serviceAccountEmail || null : null;
  const policy = await googleFetch(
    api("cloudresourcemanager.googleapis.com", `/v1/projects/${PROJECT}:getIamPolicy`), token,
    { method: "POST", body: { options: { requestedPolicyVersion: 3 } } });
  const access = logAccess({ account, bindings: policy.ok ? policy.body.bindings || [] : null, access: datasetAccess });
  console.log("  The account the trigger runs as must be able to append rows (BigQuery Data Editor) and");
  console.log("  run the reconcile's SELECT and the erasure's DELETE (BigQuery Job User) — granted once,");
  console.log("  by the project owner (OWNER-LIST.md). A default account that still holds Editor has both.");
  if (!account) {
    console.log(`  ✗ ${TRIGGER} could not be read (${fn.status} ${fn.message}) — not deployed yet, or the credential`);
    console.log("    lacks roles/cloudfunctions.viewer. Once it is deployed, Actions → Observe production prints the");
    console.log("    account it runs as and whether it holds both, with the two commands if not. The gen-2 default");
    console.log(`    is the Compute Engine account (PROJECT_NUMBER-compute@developer.gserviceaccount.com), NOT ${PROJECT}@appspot…`);
  } else {
    console.log(`  ${TRIGGER} runs as ${account} (read off the deployment)`);
    const line = (ok, what, via, no) => console.log(`    ${ok === null ? "·" : ok ? "✓" : "✗"} ${what}: ${ok === null ? "unreadable — the IAM policy was refused" : ok ? `yes — ${via.join(", ")}` : no}`);
    line(access.canAppend, "append rows", access.appendVia ?? [], "no role that writes rows, on the project or on the dataset");
    line(access.canQuery, "run a query job", access.queryVia ?? [], "no role that runs a query job (a project permission)");
    if (access.canAppend === false || access.canQuery === false) {
      console.log("    Until both are ✓ every append logs `log_append_failed` (the count is untouched) and the nightly");
      console.log("    reconcile cannot catch the day up — for THIS account, not a default:");
      for (const c of grantCommands(PROJECT, account)) console.log(`      ${c}`);
    } else if (access.canAppend && access.canQuery) {
      console.log("    nothing to grant.");
    }
  }
  if (!APPLY) console.log("\n  dry run — nothing was created. Re-run with --apply.");
}

if (process.argv[1] && /apply-bigquery\.mjs$/.test(process.argv[1])) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
