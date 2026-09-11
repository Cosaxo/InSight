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
// number the pulse guard reds on (D332), read from the same place so there
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
// And it is not on any pipeline — a control this load-bearing is
// dispatched by a person (.github/workflows/budget.yml), the
// apply-monitoring posture.
//
// WHAT IT WIRES (2026-09-09, COST-EXPOSURE.md §6 C4). The budget's
// notifications go to the Pub/Sub topic `budget-alerts` in the project —
// `notificationsRule.pubsubTopic` — where functions/src/budget.ts sets the
// D332 read breaker (`budgetMode` on v2_meta/app) the first time a month's
// spend reaches the budget, and releases it when the next month arrives
// under the line. The deploy creates the topic with that function, so the
// order is: merge (the deploy), then dispatch this, then the one grant the
// Budgets API cannot make for itself — the budget service agent needs
// Pub/Sub Publisher on the topic (printed below; the console grants it
// when a topic is connected there, the API does not).
//
// CURRENCY. The API refuses a currency that is not the billing account's,
// so none is sent and the account's own is what the figure means — which
// the first live apply (2026-08-27) proved matters: this account bills in
// NOK, so the guard's USD 50 would have stood up a 50 NOK (~$4.6) budget.
// The figure the budget holds therefore lives in rates.json as
// guard.budget ({amount, currency} — 500 NOK ~= the guard's $50), this
// script prefers it, and the output WARNs exactly when the currency the
// API returns is not the one the guard records — an expected NOK is
// confirmation, not noise, and a warning printed every run stops being
// read.
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

// The guard, read once: the figure, and the currency the budget is
// recorded to bill in.
const GUARD = JSON.parse(readFileSync(join(root, "monitoring/rates.json"), "utf8")).guard ?? {};

// The figure: --amount, else guard.budget.amount — the ACCOUNT-currency
// figure, recorded since the first live apply found the account bills in
// NOK — else the USD tolerance itself. One source (D332's "keep the two
// in step" made structural) — a budget retuned without the guard, or the
// reverse, is two thresholds telling two stories about one bill. The
// units field is in the account's currency, so preferring the USD number
// on a NOK account would demand a retune from the real 500 back to 50 on
// every standing dry run — an instruction whose obedient reader shrinks
// the backstop tenfold. Integer, because the API's units field is the
// integer part and a budget with nanos is precision the control does not
// have.
const AMOUNT = (() => {
  const flag = argOf("--amount");
  if (flag != null) {
    const n = Number(flag);
    if (!Number.isInteger(n) || n <= 0) die("--amount must be a positive integer");
    return n;
  }
  const n = GUARD.budget?.amount ?? GUARD.maxNetBurnUsdPerMonth;
  if (!Number.isInteger(n) || n <= 0) {
    die("monitoring/rates.json guard has no positive-integer figure (budget.amount or maxNetBurnUsdPerMonth) — set one, or pass --amount");
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
            + "    budgets live on the billing account (docs/COSTS.md, control 1; D332)."));
    }
    listed.push(...(r.body.budgets || []));
    if (!r.body.nextPageToken) break;
    url = `${budgetsUrl}?pageToken=${encodeURIComponent(r.body.nextPageToken)}`;
  }
}

/** The topic functions/src/budget.ts listens on — one name, pinned to the
 *  function's constant by apply-budget.test.mjs. */
export const BUDGET_TOPIC = "budget-alerts";
const TOPIC = `projects/${PROJECT}/topics/${BUDGET_TOPIC}`;
const PUBLISHER_GRANT = `gcloud pubsub topics add-iam-policy-binding ${BUDGET_TOPIC} --project ${PROJECT} `
  + "--member serviceAccount:billing-budget-alert@system.gserviceaccount.com --role roles/pubsub.publisher";

const wanted = {
  displayName: NAME,
  budgetFilter: { projects: [`projects/${projectNumber}`] },
  amount: { specifiedAmount: { units: String(AMOUNT) } },
  thresholdRules: THRESHOLDS.map((p) => ({ thresholdPercent: p })),
  // Where the budget publishes its state every twenty to thirty minutes;
  // schemaVersion is the notification format's, "1.0" being the only one.
  notificationsRule: { pubsubTopic: TOPIC, schemaVersion: "1.0" },
};

const existing = listed.find((b) => b.displayName === NAME);
const sameAmount = (b) => String(b.amount?.specifiedAmount?.units ?? "") === String(AMOUNT);
const sameThresholds = (b) => {
  const have = (b.thresholdRules || []).map((t) => Number(t.thresholdPercent)).sort((x, y) => x - y);
  return have.length === THRESHOLDS.length && have.every((v, i) => v === THRESHOLDS[i]);
};
const sameTopic = (b) => b.notificationsRule?.pubsubTopic === TOPIC;

/** The topic is created by the deploy of functions/src/budget.ts; a
 *  budget pointed at a topic that does not exist is refused by the API,
 *  and the refusal names the remedy. */
const topicHint = (message) => (/topic/i.test(String(message))
  ? `\n    the topic ${TOPIC} must exist first — it is created by the deploy of functions/src/budget.ts`
    + ` (merge, wait for the deploy, re-dispatch), or by \`gcloud pubsub topics create ${BUDGET_TOPIC} --project ${PROJECT}\``
  : "");

const describe = `"${NAME}": ${AMOUNT}/month on projects/${projectNumber} (${PROJECT}), `
  + `emails at ${THRESHOLDS.map((p) => `${p * 100}%`).join(" / ")} to the billing account's admins and users, `
  + `notifications to ${TOPIC}`;
/** A refused WRITE (create or retune) has two readings since the wire
 *  (D448), and the API's "The caller does not have permission" is all it
 *  says for either:
 *    - roles/billing.costsManager on the billing account: budgets are a
 *      billing-account resource, and project Editor says nothing there;
 *    - pubsub.topics.setIamPolicy on the topic: the Budgets API demands it
 *      of the CALLER whenever notificationsRule.pubsubTopic is set (it
 *      makes the service agent's publisher grant on the caller's behalf),
 *      and project Editor does not carry that either.
 *  The first dispatch with the topic (2026-09-10) was the second: the role
 *  had been granted on 2026-08-27 and this script had CREATED the budget
 *  with it, so the canned costsManager line named the wrong grant, the
 *  second time this branch did (the disabled API was the first). So a 403
 *  now says both, with the tell: a budget this credential could list and
 *  create is one the role is already in place for. Any other refusal keeps
 *  the one line, and topicHint still reads the message for a missing topic. */
const writeFix = (r) => (r.status !== 403
  ? `    fix: grant roles/billing.costsManager on the BILLING ACCOUNT ${BA} to ${sa.client_email}`
  : `    two grants read as this 403, and the message does not say which:\n`
    + `    - roles/billing.costsManager on the BILLING ACCOUNT ${BA} to ${sa.client_email}: already in place\n`
    + `      wherever this credential could list and create the budget, which leaves\n`
    + `    - pubsub.topics.setIamPolicy on ${TOPIC}: the Budgets API demands it of the caller whenever a\n`
    + `      topic is attached, and project Editor does not carry it.\n`
    + `    the way through that needs no new role: connect the topic in the console (Billing -> Budgets &\n`
    + `    alerts -> "${NAME}" -> Manage notifications -> Connect a Pub/Sub topic to this budget -> ${BUDGET_TOPIC}),\n`
    + `    which attaches it AND makes the publisher grant; this script's dry run then reads "exists and\n`
    + `    matches". Or grant the credential the topic's admin once and re-dispatch with apply:\n`
    + `      gcloud pubsub topics add-iam-policy-binding ${BUDGET_TOPIC} --project ${PROJECT} --member serviceAccount:${sa.client_email} --role roles/pubsub.admin`);

const grantNote = `\n\nThe one grant the API cannot make: the budget's service agent must be allowed to publish\n`
  + `to the topic (functions/src/budget.ts reads it) — run once, in Cloud Shell:\n  ${PUBLISHER_GRANT}`;

/** The wrong-currency trap, said out loud wherever the currency comes
 *  back. The comparison is against the currency the guard RECORDS
 *  (guard.budget.currency; USD — the arithmetic's own — when none is), so
 *  the warning fires exactly when reality diverges from the record: an
 *  expected NOK is confirmation, an unexpected one is 500 of the wrong
 *  money standing in for the figure the guard means. */
const DECLARED_CURRENCY = GUARD.budget?.currency ?? "USD";
const currencyNote = (b) => {
  const cur = b?.amount?.specifiedAmount?.currencyCode;
  if (!cur) return "";
  return cur === DECLARED_CURRENCY
    ? ` (${cur}${GUARD.budget?.currency ? ", as recorded" : ""})`
    : ` (${cur} — WARNING: the guard records ${DECLARED_CURRENCY}; if ${AMOUNT} ${cur} is not the`
      + ` intended figure, re-run with --amount sized for ${cur}, and record it in`
      + ` monitoring/rates.json guard.budget)`;
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
      + writeFix(r)
      + topicHint(r.message));
  }
  console.log(`created budget ${describe}${currencyNote(r.body)}\n\n`
    + "Confirm from the console once (Billing → Budgets & alerts) — then this script's\n"
    + "dry run is the standing check, and monitoring/rates.json's guard note says to\n"
    + "keep the two figures moving together." + grantNote);
} else if (sameAmount(existing) && sameThresholds(existing) && sameTopic(existing)) {
  console.log(`= budget ${describe}${currencyNote(existing)} — exists and matches. Nothing to do.`);
} else {
  const have = `${existing.amount?.specifiedAmount?.units ?? "?"}/month, thresholds `
    + `${(existing.thresholdRules || []).map((t) => `${Number(t.thresholdPercent) * 100}%`).join(" / ") || "(none)"}`
    + `, notifications to ${existing.notificationsRule?.pubsubTopic ?? "(no topic)"}`;
  if (!APPLY) {
    console.log(`~ would retune budget "${NAME}" — it holds ${have}; the tree says ${AMOUNT}/month at `
      + `${THRESHOLDS.map((p) => `${p * 100}%`).join(" / ")}.\n\n`
      + "Dry run — nothing was changed. Re-run with --apply to retune it.");
    process.exit(0);
  }
  // PATCH only the three fields this script owns. The filter is deliberately
  // NOT in the mask: a budget an operator re-scoped by hand should not be
  // silently re-narrowed by a retune that was about the amount.
  const r = await googleFetch(
    `${api("billingbudgets.googleapis.com", `/v1/${existing.name}`)}?updateMask=amount,thresholdRules,notificationsRule`,
    token,
    { method: "PATCH", body: { amount: wanted.amount, thresholdRules: wanted.thresholdRules, notificationsRule: wanted.notificationsRule } },
  );
  if (!r.ok) {
    die(`retuning the budget returned ${r.status}: ${r.message}\n`
      + writeFix(r)
      + topicHint(r.message));
  }
  console.log(`retuned budget "${NAME}" — was ${have}; now ${AMOUNT}/month at `
    + `${THRESHOLDS.map((p) => `${p * 100}%`).join(" / ")}, notifications to ${TOPIC}${currencyNote(r.body)}.`
    + grantNote);
}
