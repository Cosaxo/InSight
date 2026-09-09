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
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const PROJECT = argOf("--project") || process.env.FIREBASE_PROJECT_ID || "prvfire33";

export const DATASET = "insight";
export const TABLE = "answers";
export const LOCATION = "europe-west1";

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

  const ds = await googleFetch(`${base}/datasets/${DATASET}`, token);
  if (ds.ok) {
    const where = ds.body.location || "?";
    console.log(`  dataset ${DATASET}: exists (${where})`);
    if (where.toLowerCase() !== LOCATION) {
      console.error(`  ✗ dataset ${DATASET} is in ${where}, not ${LOCATION} — the log must stay in the named database's region; delete and re-create it, or point LOG_DATASET at one that is`);
      process.exit(1);
    }
  } else if (ds.status === 404) {
    if (APPLY) {
      const made = await googleFetch(`${base}/datasets`, token, { method: "POST", body: datasetBody(PROJECT) });
      if (!made.ok) { console.error(`  ✗ dataset create failed: ${made.status} ${made.message}`); process.exit(1); }
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

  console.log("");
  console.log("  The functions' runtime service account must be able to append rows and run the");
  console.log("  erasure DELETE — two roles, granted once by the project owner (OWNER-LIST.md):");
  console.log(`    gcloud projects add-iam-policy-binding ${PROJECT} --member=serviceAccount:${PROJECT}@appspot.gserviceaccount.com --role=roles/bigquery.dataEditor`);
  console.log(`    gcloud projects add-iam-policy-binding ${PROJECT} --member=serviceAccount:${PROJECT}@appspot.gserviceaccount.com --role=roles/bigquery.jobUser`);
  console.log("  (a project whose default service account still holds Editor already has both;");
  console.log("   the first answer after the deploy tells — `log_append_failed` in the function's log.)");
  if (!APPLY) console.log("\n  dry run — nothing was created. Re-run with --apply.");
}

if (process.argv[1] && /apply-bigquery\.mjs$/.test(process.argv[1])) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
