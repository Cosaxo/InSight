#!/usr/bin/env node
// apply-budget.mjs — put the Cloud Billing budget in place, in one command.
//
//   node scripts/apply-budget.mjs             # report (dry run)
//   node scripts/apply-budget.mjs --apply     # create or retune it
//   node scripts/apply-budget.mjs --amount 80 --apply   # override the figure
//
// WHY THIS EXISTS. docs/COSTS.md has called the budget "the cheapest thing
// on this page" since 2026-08-01, priced its absence (an invoice up to
// thirty days late is the first notice of every failure that page
// imagines), and carried the gcloud one-liner — and on 2026-08-27 it still
// did not exist, for the reason D303 named about the alert policies: the
// command needed a tool and a login nobody had, so the cheapest control
// stayed the undone one. Same remedy as apply-monitoring.mjs: the REST API
// over FIREBASE_SERVICE_ACCOUNT, no gcloud, dry-run by default, idempotent
// by display name, and a 403 that names the exact role and where it goes.
//
// WHAT IT CREATES. One budget named "InSight" on the billing account the
// project is attached to, filtered to this project, at
// `guard.maxNetBurnUsdPerMonth` from monitoring/rates.json — the same
// number the pulse guard reds on (D327), read from the same place so there
// is exactly one figure to retune — with threshold emails at 50%, 90%,
// 100% and 150% of it. Recipients are the billing account's admins and
// users (Google's default; nothing here narrows it), so the owner's inbox
// is wired by owning the account, with no channel to configure.
//
// THE FILTER IS THE PROJECT NUMBER, RESOLVED, NOT THE ID TYPED. The
// Budgets API's project filter takes `projects/{project_number}`; a budget
// filtered to a string that matches nothing tracks $0 forever and never
// fires, which reads exactly like "spending is fine" — the silent-checkbox
// failure, on the control whose whole job is to be the backstop. So the
// script asks Resource Manager for the number instead of trusting a typed
// form (the COSTS.md one-liner's `projects/prvfire33` is the ID, and this
// is why the script exists rather than a copy of that command).
//
// THE ONE GRANT THIS NEEDS THAT THE DEPLOY ACCOUNT DOES NOT HAVE. Budgets
// live on the BILLING ACCOUNT, not the project, so the project's `Editor`
// role — which is why observe/apply-monitoring work — says nothing here.
// The missing role is `roles/billing.costsManager` (create/edit budgets,
// view spend, nothing else) granted on the billing account to the service
// account's email; the 403 branch below prints both halves verbatim. That
// grant is the five minutes that remain human in this control.
//
// WHAT IT DOES NOT DO. It does not cap anything — a budget notifies
// (COSTS.md: the only hard stop is detaching billing, which is an outage).
// It does not wire Pub/Sub: the budget → topic → `budgetMode` auto-flip is
// D327's recorded next joint, and it starts from the budget this script
// creates. And it is not on any pipeline — a control this load-bearing is
// dispatched by a person (.github/workflows/budget.yml), the
// apply-monitoring posture.
//
// CURRENCY. The API refuses a currency that is not the billing account's,
// so none is sent and the account's own is what the figure means. The
// guard's arithmetic is USD; if the account bills in something else the
// created budget says so in the output and the WARNING below says to
// re-run with --amount sized for that currency. Erring unhandled would be
// a 50 NOK budget (~$4.6) silently standing in for a $50 one.
//
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents).
// Node stdlib only, like every other script here that a human runs against
// production.

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const PROJECT = argOf("--project") || process.env.FIREBASE_PROJECT_ID || "prvfire33";
const NAME = argOf("--name") || "InSight";
const die = (m) => { console.error(`apply-budget: ${m}`); process.exit(1); };

// The figure: --amount, else the guard's own number. One source (D327's
// "keep the two in step" made structural) — a budget retuned without the
// guard, or the reverse, is two thresholds telling two stories about one
// bill. Integer, because the API's units field is the integer part and a
// budget with nanos is precision the control does not have.
const AMOUNT = (() => {
  const flag = argOf("--amount");
  if (flag != null) {
    const n = Number(flag);
    if (!Number.isInteger(n) || n <= 0) die("--amount must be a positive integer");
    return n;
  }
  const rates = JSON.parse(readFileSync(join(root, "monitoring/rates.json"), "utf8"));
  const n = rates.guard?.maxNetBurnUsdPerMonth;
  if (!Number.isInteger(n) || n <= 0) {
    die("monitoring/rates.json guard.maxNetBurnUsdPerMonth is not a positive integer — set it, or pass --amount");
  }
  return n;
})();

// COSTS.md's own rule for the shape: 50% and 90% while it is still cheap
// to be curious, 100%, and 150% so the alert keeps firing while the number
// is still two figures.
const THRESHOLDS = [0.5, 0.9, 1.0, 1.5];

const sa = serviceAccount("apply-budget");
const token = await accessToken(sa, "apply-budget");

/** One resolving read, with the failure a result the operator can act on. */
const need = async (what, url, role, where) => {
  const r = await googleFetch(url, token);
  if (!r.ok) {
    die(`${what} returned ${r.status}: ${r.message}\n`
      + `    fix: grant ${role} on ${where} to ${sa.client_email}`
      + (r.status === 403 && /not been used|disabled/i.test(r.message)
        ? "\n    (or the API itself is off — the message above carries Google's enable link)"
        : ""));
  }
  return r.body;
};

// 1 · The project number — the only form the budget filter matches.
const proj = await need(
  "resolving the project",
  api("cloudresourcemanager.googleapis.com", `/v1/projects/${PROJECT}`),
  "roles/viewer (the deploy account's Editor already includes it — a refusal here means this is not that credential)",
  `project ${PROJECT}`,
);
const projectNumber = proj.projectNumber;
if (!projectNumber) die(`project ${PROJECT} resolved without a projectNumber — cannot build a filter that matches`);

// 2 · The billing account the project is attached to.
const info = await need(
  "reading the project's billing info",
  api("cloudbilling.googleapis.com", `/v1/projects/${PROJECT}/billingInfo`),
  "roles/viewer",
  `project ${PROJECT}`,
);
if (!info.billingEnabled || !info.billingAccountName) {
  die(`project ${PROJECT} has no active billing account (billingEnabled: ${!!info.billingEnabled}) — `
    + "a budget has nothing to watch. This is the Blaze attachment, console-side.");
}
const BA = info.billingAccountName; // "billingAccounts/XXXXXX-XXXXXX-XXXXXX"

// 3 · The budgets that already exist. THE grant lives here: budgets are a
// billing-account resource, so the project roles that carry every other
// script in this repo say nothing about this call.
const budgetsUrl = api("billingbudgets.googleapis.com", `/v1/${BA}/budgets`);
const listed = [];
{
  let url = budgetsUrl;
  for (let page = 0; page < 5; page++) {
    const r = await googleFetch(url, token);
    if (!r.ok) {
      // Two different 403s land here, and the first live run (2026-08-27)
      // hit both in order. SERVICE_DISABLED — the Billing Budgets API off
      // on the PROJECT (Google gates it on the caller's quota project even
      // though the resource is the billing account) — is self-serviceable:
      // the deploy account's own Editor role can enable it, verified live.
      // Only the plain permission 403 is the human grant. Printing the
      // grant for the disabled-API case sent the operator toward a console
      // errand that would not have fixed anything.
      const apiOff = r.status === 403 && /not been used|disabled/i.test(r.message);
      die(`listing budgets on ${BA} returned ${r.status}: ${r.message}\n`
        + (apiOff
          ? `    fix: enable billingbudgets.googleapis.com on project ${PROJECT} — Google's message\n`
            + "    above carries the console link, or POST serviceusage's :enable for it with this\n"
            + "    same credential (its Editor role suffices), then re-run. The grant below may\n"
            + "    still be missing behind this; the re-run will say."
          : `    fix: grant roles/billing.costsManager on the BILLING ACCOUNT ${BA}\n`
            + `    to ${sa.client_email} — a role on the project cannot satisfy this;\n`
            + "    budgets live on the billing account (docs/COSTS.md, control 1; D327)."));
    }
    listed.push(...(r.body.budgets || []));
    if (!r.body.nextPageToken) break;
    url = `${budgetsUrl}?pageToken=${encodeURIComponent(r.body.nextPageToken)}`;
  }
}

const wanted = {
  displayName: NAME,
  budgetFilter: { projects: [`projects/${projectNumber}`] },
  amount: { specifiedAmount: { units: String(AMOUNT) } },
  thresholdRules: THRESHOLDS.map((p) => ({ thresholdPercent: p })),
};

const existing = listed.find((b) => b.displayName === NAME);
const sameAmount = (b) => String(b.amount?.specifiedAmount?.units ?? "") === String(AMOUNT);
const sameThresholds = (b) => {
  const have = (b.thresholdRules || []).map((t) => Number(t.thresholdPercent)).sort((x, y) => x - y);
  return have.length === THRESHOLDS.length && have.every((v, i) => v === THRESHOLDS[i]);
};

const describe = `"${NAME}": ${AMOUNT}/month on projects/${projectNumber} (${PROJECT}), `
  + `emails at ${THRESHOLDS.map((p) => `${p * 100}%`).join(" / ")} to the billing account's admins and users`;

/** The non-USD trap, said out loud wherever the currency comes back. */
const currencyNote = (b) => {
  const cur = b?.amount?.specifiedAmount?.currencyCode;
  if (!cur) return "";
  return cur === "USD"
    ? ` (USD)`
    : ` (${cur} — WARNING: the guard's arithmetic is USD; if ${AMOUNT} ${cur} is not the`
      + ` intended figure, re-run with --amount sized for ${cur})`;
};

if (!existing) {
  if (!APPLY) {
    console.log(`+ would create budget ${describe}\n\n`
      + "Dry run — nothing was changed. Re-run with --apply to create it.");
    process.exit(0);
  }
  const r = await googleFetch(budgetsUrl, token, { method: "POST", body: wanted });
  if (!r.ok) {
    die(`creating the budget returned ${r.status}: ${r.message}\n`
      + `    fix: grant roles/billing.costsManager on the BILLING ACCOUNT ${BA} to ${sa.client_email}`);
  }
  console.log(`created budget ${describe}${currencyNote(r.body)}\n\n`
    + "Confirm from the console once (Billing → Budgets & alerts) — then this script's\n"
    + "dry run is the standing check, and monitoring/rates.json's guard note says to\n"
    + "keep the two figures moving together.");
} else if (sameAmount(existing) && sameThresholds(existing)) {
  console.log(`= budget ${describe}${currencyNote(existing)} — exists and matches. Nothing to do.`);
} else {
  const have = `${existing.amount?.specifiedAmount?.units ?? "?"}/month, thresholds `
    + `${(existing.thresholdRules || []).map((t) => `${Number(t.thresholdPercent) * 100}%`).join(" / ") || "(none)"}`;
  if (!APPLY) {
    console.log(`~ would retune budget "${NAME}" — it holds ${have}; the tree says ${AMOUNT}/month at `
      + `${THRESHOLDS.map((p) => `${p * 100}%`).join(" / ")}.\n\n`
      + "Dry run — nothing was changed. Re-run with --apply to retune it.");
    process.exit(0);
  }
  // PATCH only the two fields this script owns. The filter is deliberately
  // NOT in the mask: a budget an operator re-scoped by hand should not be
  // silently re-narrowed by a retune that was about the amount.
  const r = await googleFetch(
    `${api("billingbudgets.googleapis.com", `/v1/${existing.name}`)}?updateMask=amount,thresholdRules`,
    token,
    { method: "PATCH", body: { amount: wanted.amount, thresholdRules: wanted.thresholdRules } },
  );
  if (!r.ok) {
    die(`retuning the budget returned ${r.status}: ${r.message}\n`
      + `    fix: grant roles/billing.costsManager on the BILLING ACCOUNT ${BA} to ${sa.client_email}`);
  }
  console.log(`retuned budget "${NAME}" — was ${have}; now ${AMOUNT}/month at `
    + `${THRESHOLDS.map((p) => `${p * 100}%`).join(" / ")}${currencyNote(r.body)}.`);
}
