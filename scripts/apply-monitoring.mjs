#!/usr/bin/env node
// apply-monitoring.mjs — put the ten alert policies in place, in one command.
//
//   node scripts/apply-monitoring.mjs --email you@example.com            # report
//   node scripts/apply-monitoring.mjs --email you@example.com --apply    # do it
//
// WHY THIS EXISTS. docs/DEPLOYMENT.md § Alerting spells out the console
// steps: a notification channel, eight log-based metrics, and ten policies
// that each need the channel id pasted in from the first step's output. It is
// not hard, it is just fiddly enough that it stays undone — and what it
// guards is the failure mode that runbook calls the urgent one, the one
// that looks like nothing from the outside: the app keeps serving, the
// Mirror stops moving, and Eventarc piles up redeliveries for ~7 days.
//
// WHY IT DID NOT RUN, for two days, while saying all of that. This script
// shelled out to `gcloud`, authenticated interactively. Its own header said
// permission was never the obstacle — the deploy service account holds
// `Editor`, which includes `monitoring.alertPolicies.create` — and then it
// required a tool nobody had logged into, which is an obstacle of exactly
// the same kind and one the header did not name. On 2026-08-26 the observer
// read production and found zero alert policies and zero log-based metrics
// (D300), two days after this file was written to create thirteen of them.
//
// So the transport is now the one observe.mjs proved reachable: sign a JWT
// with FIREBASE_SERVICE_ACCOUNT, trade it for an OAuth token, POST to the
// Monitoring and Logging APIs (D303). No gcloud, no interactive login, and
// it runs from `.github/workflows/monitoring.yml` behind the production
// environment gate. This is D300's finding applied a second time: a tool
// that runs beats a better-provisioned tool that does not.
//
// STILL NOT ON THE DEPLOY PATH, and it must not become so. The reasoning is
// DEPLOYMENT.md's, not this script's — repeated here because a script that
// looks runnable in CI invites someone to run it there — and only one of
// its two halves was retired by the change above:
//
//   RETIRED: "not because the deploy service account lacks the permission."
//   That was already true and is now load-bearing rather than incidental —
//   the same `Editor` role is what makes the REST path work.
//
//   STANDS: a policy is useless without a notification channel id, which is
//   an email address or a Slack hook — per operator, per project, and
//   correctly not in this repo. It is a workflow INPUT, typed by the person
//   dispatching, not a secret and not a default.
//
//   STANDS, and is the real one: a pipeline that can rewrite an alert
//   policy can delete one silently, in a deploy that was about something
//   else, and the blast radius is "you stop being told when the Mirror
//   stops moving". A separate manually-dispatched workflow is not that
//   pipeline; `firebase-deploy.yml` calling this would be.
//
// Dry run by default, same posture as scrub-v1-discoverable.mjs: it prints
// what it would create and changes nothing without --apply.
//
// Idempotent. Every step looks for its object by name first, so a second
// run reports "exists" rather than creating a duplicate policy that then
// double-pages.
//
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents).
// Node stdlib only, like every other script here that a human runs against
// production.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const PROJECT = argOf("--project") || process.env.FIREBASE_PROJECT_ID || "prvfire33";
const EMAIL = argOf("--email");
const CHANNEL_NAME = argOf("--channel-name") || "InSight oncall";

// Log-based metrics, created before the policies that read them.
const METRICS = [
  {
    name: "agg_contention",
    description: "onV2AnswerCreated transaction attempts >= 3 (D7 write ceiling)",
    filter: 'severity>=WARNING AND jsonPayload.metric="agg_contention"',
  },
  {
    // The breakdown cube's cap (pure.ts BREAKDOWN_MAX_BUCKETS) discarding
    // a cohort count — a sub-floor bucket evicted for a newcomer, or the
    // newcomer refused because every slot is published. Silent from the
    // day the cap was written until D397; dormant until a question has
    // answers from 25 cities or countries, and its first firing is the
    // evidence ALGORITHM-REFLECTION §4.4 builds the overflow document on.
    name: "agg_evict",
    description: "onV2AnswerCreated dropped a breakdown bucket at BREAKDOWN_MAX_BUCKETS (evicted or refused)",
    filter: 'severity>=WARNING AND jsonPayload.metric="agg_evict"',
  },
  {
    // The scheduled reveal scan's heartbeat. Filtered to mode="indexed" —
    // the schedule's mode — on purpose: runDuelReveals is shared with
    // revealDuelsNowV2's manual lever, which defaults to "full", and an
    // operator running the lever during an incident must not reset the
    // absence timer on the alert that reported it.
    name: "duel_reveal_run",
    description: "scheduledDuelReveals completed a scheduled (indexed) scan",
    filter: 'jsonPayload.metric="duel_reveal_run" AND jsonPayload.mode="indexed"',
  },
  // The two NIGHTLY jobs. Both already emitted their metric — the emit side
  // was never the gap; nothing was reading it. Registered here so the
  // silence policies below have a metric to be absent from.
  {
    // Emitted from the nightly pass (nightly.ts, `digestEngagementV2`)
    // since D398 folded the three ledger readers into one invocation; the
    // policy file keeps its fitPatternsV2 name because that is the display
    // name the ARMED policy carries, and a renamed policy is a new one.
    name: "patterns_fit",
    description: "the nightly Patterns fit completed — inside digestEngagementV2 since D398 (02:23 UTC)",
    filter: 'jsonPayload.metric="patterns_fit"',
  },
  {
    name: "velocity_scan",
    description: "ledgerVelocityScan completed a nightly scan (03:47 UTC)",
    filter: 'jsonPayload.metric="velocity_scan"',
  },
  {
    name: "engagement_digest",
    description: "digestEngagementV2 completed the nightly engagement pipeline (02:23 UTC; the same pass carries the Patterns fit and the taste fold since D398)",
    filter: 'jsonPayload.metric="engagement_digest"',
  },
  // The paid pipeline had NO metric registered at all, so none of its money
  // outcomes could be alerted on. These two are the ones that mean a person
  // is owed money that is not moving — see monitoring/paid-refund-stuck.json
  // for which is which and what to do about each.
  {
    name: "paid_refund_held",
    description: "closePaidCampaignsV2: a refund failed; the purchase stays open and retries nightly",
    filter: 'jsonPayload.metric="paid_refund_held"',
  },
  {
    name: "paid_refund_already",
    description: "closePaidCampaignsV2: a refund was already on the intent — a run died mid-close",
    filter: 'jsonPayload.metric="paid_refund_already"',
  },
];

const POLICIES = [
  "monitoring/onV2AnswerCreated-errors.json",
  "monitoring/onV2AnswerCreated-contention.json",
  // The cap alert (D397): the same trigger, the same "not an error" shape
  // as contention — the answer folds, the count for one cohort does not.
  "monitoring/onV2AnswerCreated-evictions.json",
  "monitoring/scheduledDuelReveals-silent.json",
  // …and the same shape for the two nightly jobs, which had no policy at
  // all until an audit counted the schedules against this list. A cron that
  // stops running reports nothing: no error, no failed request, just a
  // number on screen that quietly stops moving.
  "monitoring/fitPatternsV2-silent.json",
  "monitoring/ledgerVelocityScan-silent.json",
  "monitoring/digestEngagementV2-silent.json",
  // The odd one out, and deliberately so: the three above watch something
  // breaking, this one watches the app working expensively. It reads a
  // BUILT-IN Firestore metric rather than a log-based one, so it needs no
  // METRICS entry above — there is no emit side to break, which also means
  // check-monitoring's rule 3 has nothing to resolve for it.
  // The money one. Not a rate — one held refund is one too many, and its
  // own code comment says an unfixable one retries "every night, until an
  // operator intervenes" while reporting nothing.
  "monitoring/paid-refund-stuck.json",
  "monitoring/firestore-read-runaway.json",
  // The write side is watched separately because the read policy cannot see
  // it: something that writes without reading runs under a green dashboard.
  // "Writes are only 3% of the bill" is a statement about organic traffic,
  // not a bound during an incident.
  "monitoring/firestore-write-runaway.json",
];

if (!EMAIL) {
  console.error(
    "apply-monitoring: --email is required — it is where the pages go.\n"
    + "    node scripts/apply-monitoring.mjs --email you@example.com [--apply]\n"
    + "    Use --channel-name to name the channel something other than "
    + `"${CHANNEL_NAME}".`,
  );
  process.exit(1);
}

for (const rel of POLICIES) {
  if (!existsSync(join(root, rel))) {
    console.error(`apply-monitoring: ${rel} is missing — it is the policy body, not a template.`);
    process.exit(1);
  }
}

const sa = serviceAccount("apply-monitoring");
const token = await accessToken(sa, "apply-monitoring");

const mon = (path) => api("monitoring.googleapis.com", `/v3/projects/${PROJECT}${path}`);
const log = (path) => api("logging.googleapis.com", `/v2/projects/${PROJECT}${path}`);

/** Unlike observe.mjs, a refusal here is FATAL rather than a result. The
 *  steps below are ordered and dependent — policies carry the channel id,
 *  and two of them read metrics created a step earlier — so continuing past
 *  a failure would create half an alert chain and report success for it.
 *  That is the exact shape check-monitoring exists to prevent in the repo,
 *  and it would be worse in the project, where no gate can see it. */
function must(what, res, role) {
  if (res.ok) return res.body;
  const why = res.status === 403 ? `\n    Grant ${role} to ${sa.client_email}.`
    : res.status === 404 ? "\n    A 404 on a project path usually means the API is not enabled for this project."
      : "";
  console.error(`apply-monitoring: ${what} failed (${res.status}): ${res.message}${why}`);
  process.exit(1);
}

let created = 0;
async function step(label, exists, doIt) {
  if (exists) { console.log(`  = ${label} — already exists, skipped`); return; }
  if (!APPLY) { console.log(`  + ${label} — would create`); return; }
  await doIt();
  created++;
  console.log(`  ✓ ${label} — created`);
}

console.log(
  `apply-monitoring: project ${PROJECT}, channel "${CHANNEL_NAME}" → ${EMAIL}`
  + (APPLY ? "" : "  (DRY RUN — pass --apply to make changes)"),
);

// ── 1. the notification channel ─────────────────────────────────────
// Everything else references this, so it is first and its id is threaded
// through. Matched on display name: a channel has no natural key, and a
// second channel with the same name would silently mean half the alerts
// page one address and half the other.
const channelList = must(
  "listing notification channels",
  await googleFetch(mon("/notificationChannels"), token),
  "roles/monitoring.notificationChannelEditor",
);
let channel = (channelList.notificationChannels || []).find((c) => c.displayName === CHANNEL_NAME);

await step(`notification channel "${CHANNEL_NAME}"`, Boolean(channel), async () => {
  channel = must(
    "creating the notification channel",
    await googleFetch(mon("/notificationChannels"), token, {
      method: "POST",
      body: { type: "email", displayName: CHANNEL_NAME, labels: { email_address: EMAIL }, enabled: true },
    }),
    "roles/monitoring.notificationChannelEditor",
  );
});

if (channel && channel.labels?.email_address && channel.labels.email_address !== EMAIL) {
  console.log(
    `  ! the existing channel points at ${channel.labels.email_address}, not ${EMAIL}.\n`
    + "    Left alone — repointing an oncall channel is not something a script\n"
    + "    should do silently. Change it in the console, or use --channel-name.",
  );
}

// ── 2. the log-based metrics ────────────────────────────────────────
// Two policies count a LOG LINE rather than a built-in signal, so their
// metrics have to exist before the policies that read them — otherwise a
// policy is created against a metric type that resolves to nothing and
// never fires, which looks identical to "no contention" and to "the
// reveal scan is healthy" respectively.
const metricList = must(
  "listing log-based metrics",
  await googleFetch(log("/metrics"), token),
  "roles/logging.configWriter",
);
const liveMetrics = (metricList.metrics || []).map((m) => m.name);

for (const m of METRICS) {
  await step(`log-based metric ${m.name}`, liveMetrics.includes(m.name), async () => {
    must(
      `creating log-based metric ${m.name}`,
      await googleFetch(log("/metrics"), token, {
        method: "POST",
        body: { name: m.name, description: m.description, filter: m.filter },
      }),
      "roles/logging.configWriter",
    );
  });
}

/**
 * The caveat an operator needs at the moment they arm alerting, DERIVED
 * from the committed policies rather than restated beside them.
 *
 * It used to say all four silence policies watch an absence and cannot
 * fire until each job has run once in production. That was true when it
 * was written and is now the inverse for three of them: D303's amendment
 * moved the nightly-job policies to trailing-24h THRESHOLDS carrying
 * `evaluationMissingData: EVALUATION_MISSING_DATA_ACTIVE`, chosen in that
 * record precisely because a threshold over a never-emitting series
 * "would otherwise evaluate nothing and stay green forever, which is the
 * exact hole the absence condition existed to close".
 *
 * So the operator was told three live, firing-capable alerts were inert,
 * printed at the moment they go and verify. Reading the shape off the
 * files is what stops it going stale a second time: nothing here restates
 * which policy is which.
 */
function absenceCaveat() {
  const absent = [];
  const armed = [];
  for (const rel of POLICIES) {
    const body = JSON.parse(readFileSync(join(root, rel), "utf8"));
    const conds = body.conditions || [];
    (conds.some((c) => c.conditionAbsent) ? absent : armed).push(body.displayName);
  }
  const lines = [];
  for (const name of absent) {
    lines.push(
      `\n  ! "${name}" is a metric-ABSENCE policy, and absence conditions`
      + "\n    need a time series that has existed at least once. Until that job"
      + "\n    has run in production it cannot fire — green because there is"
      + "\n    nothing to be absent, not because the loop is healthy.",
    );
  }
  if (armed.length) {
    lines.push(
      `\n  · The other ${armed.length} fire from the first evaluation: they are`
      + "\n    thresholds with evaluationMissingData ACTIVE, so a series that has"
      + "\n    never emitted is treated as a breach rather than as silence.",
    );
  }
  return lines.join("\n");
}

// ── 3. the policies ─────────────────────────────────────────────────
const policyList = must(
  "listing alert policies",
  await googleFetch(mon("/alertPolicies"), token),
  "roles/monitoring.alertPolicyEditor",
);
const livePolicies = (policyList.alertPolicies || []).map((p) => p.displayName);

for (const rel of POLICIES) {
  const body = JSON.parse(readFileSync(join(root, rel), "utf8"));
  await step(`policy "${body.displayName}"`, livePolicies.includes(body.displayName), async () => {
    // The committed file carries `notificationChannels: []` because the id
    // is per-operator and correctly not in the repo. Filling it at POST is
    // the whole reason the channel step runs first — a policy created with
    // an empty list is enabled, visible, green, and pages nobody.
    if (!channel?.name) {
      console.error("apply-monitoring: no notification channel id — the channel step did not complete.");
      process.exit(1);
    }
    must(
      `creating policy "${body.displayName}"`,
      await googleFetch(mon("/alertPolicies"), token, {
        method: "POST",
        body: { ...body, notificationChannels: [channel.name] },
      }),
      "roles/monitoring.alertPolicyEditor",
    );
  });
}

console.log(
  APPLY
    ? `\napply-monitoring: done, ${created} created. Verify with the instrument rather`
      + " than by eye:\n"
      + "  npm run observe\n"
      + "`armed` should read true and no committed policy should be listed missing.\n"
      + "Then send yourself a test page from the console — an alert nobody has\n"
      + "ever seen arrive is an alert you do not know is wired up.\n"
      + "\n"
      + absenceCaveat()
    : "\napply-monitoring: dry run. Re-run with --apply to create the above.",
);
