#!/usr/bin/env node
// apply-monitoring.mjs — put the three alert policies in place, in one command.
//
//   node scripts/apply-monitoring.mjs --email you@example.com            # report
//   node scripts/apply-monitoring.mjs --email you@example.com --apply    # do it
//
// WHY THIS EXISTS. docs/DEPLOYMENT.md § Alerting spells out the console
// steps: a notification channel, two log-based metrics, and three policies
// that each need the channel id pasted in from the first step's output. It is
// not hard, it is just fiddly enough that it stays undone — and what it
// guards is the failure mode that runbook calls the urgent one, the one
// that looks like nothing from the outside: the app keeps serving, the
// Mirror stops moving, and Eventarc piles up redeliveries for ~7 days.
//
// NOT on the deploy path, and it must not become so. The reasoning is
// DEPLOYMENT.md's, not this script's — repeated here because a script that
// looks runnable in CI invites someone to run it there — but the version
// this file first carried was the wrong one, and copying it forward is how
// a wrong reason outlives the doc that retired it (D47):
//
//   NOT because the deploy service account lacks the permission. It holds
//   `Editor` + `Firebase Admin`, and `Editor` includes
//   `monitoring.alertPolicies.create`. Permission was never the obstacle.
//
//   BUT because a policy is useless without a notification channel id,
//   which is an email address or a Slack hook — per operator, per project,
//   and correctly not in this repo. And because a pipeline that can rewrite
//   an alert policy can delete one silently, in a deploy that was about
//   something else, and the blast radius is "you stop being told when the
//   Mirror stops moving".
//
// Dry run by default, same posture as scrub-v1-discoverable.mjs: it prints
// what it would create and changes nothing without --apply.
//
// Idempotent. Every step looks for its object by name first, so a second
// run reports "exists" rather than creating a duplicate policy that then
// double-pages.
//
// Needs the gcloud CLI, authenticated (`gcloud auth login`) with monitoring
// and logging admin on the project. Node stdlib only, like every other
// script here that a human runs against production.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const PROJECT = argOf("--project") || "prvfire33";
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
    name: "patterns_fit",
    description: "fitPatternsV2 completed a nightly fit (02:37 UTC)",
    filter: 'jsonPayload.metric="patterns_fit"',
  },
  {
    name: "velocity_scan",
    description: "ledgerVelocityScan completed a nightly scan (03:47 UTC)",
    filter: 'jsonPayload.metric="velocity_scan"',
  },
];

const POLICIES = [
  "monitoring/onV2AnswerCreated-errors.json",
  "monitoring/onV2AnswerCreated-contention.json",
  "monitoring/scheduledDuelReveals-silent.json",
  // …and the same shape for the two nightly jobs, which had no policy at
  // all until an audit counted the schedules against this list. A cron that
  // stops running reports nothing: no error, no failed request, just a
  // number on screen that quietly stops moving.
  "monitoring/fitPatternsV2-silent.json",
  "monitoring/ledgerVelocityScan-silent.json",
  // The odd one out, and deliberately so: the three above watch something
  // breaking, this one watches the app working expensively. It reads a
  // BUILT-IN Firestore metric rather than a log-based one, so it needs no
  // METRICS entry above — there is no emit side to break, which also means
  // check-monitoring's rule 3 has nothing to resolve for it.
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

// gcloud writes progress to stderr and data to stdout, so only stdout is
// parsed. A non-zero exit throws with gcloud's own message attached, which
// is more useful than anything this script could say about it.
function gcloud(args, { json = true } = {}) {
  const out = execFileSync("gcloud", [...args, "--project", PROJECT], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 32 * 1024 * 1024,
  });
  return json ? JSON.parse(out || "[]") : out;
}

function step(label, exists, doIt) {
  if (exists) { console.log(`  = ${label} — already exists, skipped`); return false; }
  if (!APPLY) { console.log(`  + ${label} — would create`); return false; }
  doIt();
  console.log(`  ✓ ${label} — created`);
  return true;
}

try {
  gcloud(["version"], { json: false });
} catch {
  console.error("apply-monitoring: gcloud is not on PATH. Install the Cloud SDK and `gcloud auth login`.");
  process.exit(1);
}

for (const rel of POLICIES) {
  if (!existsSync(join(root, rel))) {
    console.error(`apply-monitoring: ${rel} is missing — it is the policy body, not a template.`);
    process.exit(1);
  }
}

console.log(
  `apply-monitoring: project ${PROJECT}, channel "${CHANNEL_NAME}" → ${EMAIL}`
  + (APPLY ? "" : "  (DRY RUN — pass --apply to make changes)"),
);

// ── 1. the notification channel ─────────────────────────────────────
// Everything else references this, so it is first and its id is threaded
// through. Matched on display name: gcloud has no natural key for a
// channel, and a second channel with the same name would silently mean
// half the alerts page one address and half the other.
const channels = gcloud(["alpha", "monitoring", "channels", "list", "--format", "json"]);
let channel = channels.find((c) => c.displayName === CHANNEL_NAME);

step(`notification channel "${CHANNEL_NAME}"`, Boolean(channel), () => {
  gcloud([
    "alpha", "monitoring", "channels", "create",
    "--display-name", CHANNEL_NAME,
    "--type", "email",
    "--channel-labels", `email_address=${EMAIL}`,
  ], { json: false });
  const after = gcloud(["alpha", "monitoring", "channels", "list", "--format", "json"]);
  channel = after.find((c) => c.displayName === CHANNEL_NAME);
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
const metrics = gcloud(["logging", "metrics", "list", "--format", "json"]);
for (const m of METRICS) {
  step(`log-based metric ${m.name}`, metrics.some((x) => x.name === m.name), () => {
    gcloud([
      "logging", "metrics", "create", m.name,
      "--description", m.description,
      "--log-filter", m.filter,
    ], { json: false });
  });
}

// ── 3. the policies ─────────────────────────────────────────────────
const existing = gcloud(["alpha", "monitoring", "policies", "list", "--format", "json"]);

for (const rel of POLICIES) {
  const body = JSON.parse(readFileSync(join(root, rel), "utf8"));
  const already = existing.some((p) => p.displayName === body.displayName);
  step(`policy "${body.displayName}"`, already, () => {
    if (!channel) throw new Error("no notification channel id — the channel step did not complete");
    gcloud([
      "alpha", "monitoring", "policies", "create",
      "--policy-from-file", join(root, rel),
      "--notification-channels", channel.name,
    ], { json: false });
  });
}

console.log(
  APPLY
    ? "\napply-monitoring: done. Verify with:\n"
      + `  gcloud alpha monitoring policies list --project ${PROJECT}\n`
      + "Then send yourself a test page from the console — an alert nobody has\n"
      + "ever seen arrive is an alert you do not know is wired up.\n"
      + "\n"
      + '  ! "scheduledDuelReveals has gone quiet" is a metric-ABSENCE policy,\n'
      + "    and absence conditions need a time series that has existed at\n"
      + "    least once. Until the first scheduled (indexed) reveal scan has\n"
      + "    run in production, it cannot fire — it is green because there is\n"
      + "    nothing to be absent, not because the loop is healthy. Confirm\n"
      + "    one run landed before counting it as cover:\n"
      + `      gcloud logging read 'jsonPayload.metric="duel_reveal_run"' --limit 1 --project ${PROJECT}`
    : "\napply-monitoring: dry run. Re-run with --apply to create the above.",
);
