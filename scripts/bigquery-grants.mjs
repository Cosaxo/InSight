// bigquery-grants.mjs — what the answer log's writer must hold, read off the
// project's IAM policy and the dataset's access list rather than assumed.
//
// WHY A MODULE, and why it is pure. apply-bigquery.mjs prints the grant the
// owner must make and observe.mjs reads whether it was made; a rule held in
// two files is the drift pure.ts and google-api.mjs both warn about, and
// this rule drifted in its ONE copy first. From 2026-09-09 to 2026-09-12
// the apply script named `${project}@appspot.gserviceaccount.com` — the
// GEN-1 default — while every function in this tree is gen-2 and runs as
// the Compute Engine default account (Observe production, 2026-09-12:
// `437999864865-compute@developer.gserviceaccount.com`). A grant made to
// the printed account reached nobody the trigger runs as. So the account is
// never typed here: both callers read it off the deployed function
// (`serviceConfig.serviceAccountEmail`) and pass it in, and a caller that
// could not read it says so instead of guessing a default (D-2026-09-12a).
//
// WHAT THE WRITER DOES (functions/src/log.ts): streams rows into
// `insight.answers` (`bigquery.tables.updateData`), reads the table's
// metadata for the erasure ceiling (`bigquery.tables.get`), and runs the
// reconcile's SELECT and the erasure's DELETE as query jobs
// (`bigquery.jobs.create`, plus updateData for the DML). Two predefined
// roles cover exactly that — BigQuery Data Editor and BigQuery Job User —
// and the broad roles a default account may already hold (Editor, Owner,
// BigQuery Admin) cover both. A grant on the DATASET covers the rows and
// never the jobs: `bigquery.jobs.create` is a project permission, which is
// why the second command has no dataset form.

/** Project roles that let an account write rows and read the table's metadata. */
export const APPEND_ROLES = [
  "roles/bigquery.dataEditor",
  "roles/bigquery.dataOwner",
  "roles/bigquery.admin",
  "roles/editor",
  "roles/owner",
];

/** Project roles that let an account run a query job — the reconcile's
 *  SELECT, the shadow's three queries, the erasure's DELETE. */
export const JOB_ROLES = [
  "roles/bigquery.jobUser",
  "roles/bigquery.user",
  "roles/bigquery.admin",
  "roles/editor",
  "roles/owner",
];

/** Entries in a dataset's own access list (`datasets.get` → `access[].role`)
 *  that let an account write rows: the legacy names BigQuery still reports
 *  and the predefined roles it accepts there. */
export const DATASET_WRITE_ROLES = [
  "WRITER",
  "OWNER",
  "roles/bigquery.dataEditor",
  "roles/bigquery.dataOwner",
  "roles/bigquery.admin",
];

/** The two grants the apply script asks for: the minimum, not the broad roles. */
export const NEEDED_ROLES = ["roles/bigquery.dataEditor", "roles/bigquery.jobUser"];

const member = (account) => `serviceAccount:${account}`;

/** The roles among `roles` that `account` holds on the project, off a
 *  `getIamPolicy` body's bindings. Membership is exact: a binding for the
 *  gen-1 default is not a binding for the gen-2 one. */
export function projectRolesHeld(bindings, account, roles = [...new Set([...APPEND_ROLES, ...JOB_ROLES])]) {
  const m = member(account);
  return roles.filter((role) => (bindings || []).some((b) => b.role === role && (b.members || []).includes(m)));
}

/** The write-capable entries a dataset's access list grants `account`
 *  directly — by e-mail (the console's grant) or as an IAM member. */
export function datasetRolesHeld(access, account) {
  const m = member(account);
  return (access || [])
    .filter((a) => a.userByEmail === account || a.iamMember === m)
    .map((a) => a.role)
    .filter((r) => DATASET_WRITE_ROLES.includes(r));
}

/** The verdict for one account: may it append rows, may it run a query
 *  job, and through which roles. Every field is `null` where the input it
 *  needs was not readable — a refused policy is not evidence of a missing
 *  role, and "cannot append" over a refusal would send the owner to grant
 *  what may already be there (the D296 shape: a confident zero). */
export function logAccess({ account, bindings, access }) {
  if (!account) {
    return { account: null, project: null, dataset: null, appendVia: null, queryVia: null, canAppend: null, canQuery: null };
  }
  const project = bindings ? projectRolesHeld(bindings, account) : null;
  const dataset = access ? datasetRolesHeld(access, account) : null;
  const appendVia = project === null && dataset === null ? null : [
    ...(project ?? []).filter((r) => APPEND_ROLES.includes(r)),
    ...(dataset ?? []).map((r) => `${r} (on the dataset)`),
  ];
  const queryVia = project === null ? null : project.filter((r) => JOB_ROLES.includes(r));
  // Nothing found on the side that was read, with the other side refused,
  // is still not a no: the role could be on the side nobody could read.
  const canAppend = appendVia === null ? null
    : appendVia.length > 0 ? true
      : project !== null && dataset !== null ? false : null;
  const canQuery = queryVia === null ? null : queryVia.length > 0;
  return { account, project, dataset, appendVia, queryVia, canAppend, canQuery };
}

/** The two commands, for the account that was READ — never a default. */
export function grantCommands(project, account) {
  return NEEDED_ROLES.map((role) =>
    `gcloud projects add-iam-policy-binding ${project} --member=serviceAccount:${account} --role=${role}`);
}
