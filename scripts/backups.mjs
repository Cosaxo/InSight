#!/usr/bin/env node
// backups.mjs — put a restorable copy of the database in place, in one command.
//
//   node scripts/backups.mjs                # report what exists and what is missing
//   node scripts/backups.mjs --apply        # create the schedules, turn PITR on
//
// WHY THIS EXISTS. The tree had no backups and no point-in-time recovery,
// and said so in exactly two places — `docs/COST-EXPOSURE.md` §7, twice, as
// a COST footnote about things this page could not verify from here. That is
// the whole of what the repository knew about whether its only asset
// survives a bad afternoon.
//
// What makes that the sharpest edge in the tree rather than a gap in an ops
// checklist is D290's invariant, which every other recovery story here rests
// on: **the answer document is the source of truth and every aggregate is a
// projection rebuilt from it**. `scripts/rebuild-aggregate.mjs` and
// `functions/src/replay.ts` are genuinely good, and both rebuild aggregates
// FROM `v2_users/{uid}/answers`. Neither is a backup. If the answers go —
// a bad backfill, a `deleteAccount` bug, a rules mistake, a fat-fingered
// console delete — the repair path has nothing to read and the app has
// nothing to restore. Every one of the 449 decisions in this repo is a
// decision about data that exists in exactly one place.
//
// WHY IT IS A SCRIPT AND NOT A CONSOLE CLICK. Same argument as
// `apply-monitoring.mjs` and `appcheck.mjs`, and the same evidence behind
// it. D300: `apply-monitoring` sat unrunnable for two days because it needed
// `gcloud` and nobody was logged in, and production had zero policies while
// the repo held thirteen. A console-only step is one nobody can run from a
// phone, prove after the fact, or diff — and the proving is most of the
// value here, because "we have backups" is a belief until an instrument
// reads one back. `npm run observe` reads this state for that reason.
//
// The transport is the one observe.mjs proved reachable and monitoring.yml
// already runs on: sign a JWT with FIREBASE_SERVICE_ACCOUNT, trade it for an
// OAuth token, talk to the Firestore Admin API. No gcloud, no interactive
// login. The deploy service account holds `Editor`, which includes
// `datastore.backupSchedules.create` and `datastore.databases.update`.
//
// NOT ON THE DEPLOY PATH, and it must not become one — monitoring.yml's rule
// for the same reason one directory over. A pipeline that can create a
// backup schedule can delete one, in a deploy that was about something else,
// and the blast radius is "the thing you thought you had, you do not have".
//
// WHAT IT COSTS. Both bill as storage and neither has free usage
// (COST-EXPOSURE §7). Backup storage and PITR storage are priced per GiB-month
// against a database that currently holds ~107 answers — call it cents, and
// call it cents for a long time yet. That is the argument for doing it NOW
// rather than at the load where it matters: the cheapest day to start
// keeping copies is the day there is almost nothing to copy, and the
// expensive day is the one where the decision is made under an incident.
//
// THREE THINGS, and the order is deliberate — PITR first, because it is the
// one that protects against the failure that has already happened somewhere
// else in this tree (a write path doing the wrong thing for a few hours),
// and it starts covering the moment it is on:
//
//   1. Point-in-time recovery — 7 days of one-second granularity. Recovers
//      from "the backfill ran with the wrong predicate at 02:00", which no
//      daily snapshot can, because the snapshot either predates it (and
//      loses a day of answers) or postdates it (and contains the damage).
//   2. A DAILY backup schedule, 7-day retention — the cheap, coarse net.
//   3. A WEEKLY backup schedule, 14-week retention — the one that survives
//      a problem nobody noticed for a month. Retiring a question, a purge,
//      a moderation sweep: this repo's failure mode is quiet, not loud.
//
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents).
//      FIREBASE_PROJECT_ID / FIRESTORE_DB_ID override the defaults below.
import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";

const argv = process.argv.slice(2);
const argOf = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
};

const APPLY = argv.includes("--apply");
const PROJECT = argOf("--project") || process.env.FIREBASE_PROJECT_ID || "prvfire33";
// `insight`, not `(default)` — functions/src/db.ts:29. A named database is
// also why FREE quota is zero here (cost-arith.mjs:155), and getting this
// wrong is the failure that looks most like success: every call below would
// 404 against `(default)`, and a 404 on a project path reads as "the API is
// not enabled" rather than "you backed up the wrong database".
const DB = argOf("--database") || process.env.FIRESTORE_DB_ID || "insight";
const NAME = `projects/${PROJECT}/databases/${DB}`;

const fs = (path) => api("firestore.googleapis.com", `/v1/${NAME}${path}`);

// Retention, as seconds, because that is what the API takes and a duration
// written "604800s" in a request body is unreadable in a diff.
const DAYS = 86_400;
const DAILY_RETENTION = 7 * DAYS;       // the API's maximum for a daily schedule
const WEEKLY_RETENTION = 14 * 7 * DAYS; // the API's maximum for a weekly one
const WEEKLY_DAY = argOf("--weekly-day") || "SUNDAY";

const sa = serviceAccount("backups");
const token = await accessToken(sa, "backups");

console.log(
  `backups: ${NAME}`
  + (APPLY ? "" : "  (DRY RUN — pass --apply to make changes)"),
);

/** A refusal here is FATAL, unlike observe.mjs where it is a result. The
 *  steps are independent, but reporting "done" after a 403 would be the one
 *  failure this script exists to prevent: a believed backup is worse than a
 *  known missing one, because it stops anybody looking again. */
function must(what, res, role) {
  if (res.ok) return res.body;
  const why = res.status === 403 ? `\n    Grant ${role} to ${sa.client_email}.`
    : res.status === 404 ? `\n    A 404 here usually means the database name is wrong — this ran against "${DB}".`
      : "";
  console.error(`backups: ${what} failed (${res.status}): ${res.message}${why}`);
  process.exit(1);
}

let changed = 0;
async function step(label, satisfied, doIt) {
  if (satisfied) { console.log(`  = ${label} — already in place, skipped`); return; }
  if (!APPLY) { console.log(`  + ${label} — would create`); return; }
  await doIt();
  changed++;
  console.log(`  ✓ ${label} — created`);
}

// ── 1. point-in-time recovery ───────────────────────────────────────
const db = must(
  "reading the database",
  await googleFetch(fs(""), token),
  "roles/datastore.viewer",
);
const pitrOn = db.pointInTimeRecoveryEnablement === "POINT_IN_TIME_RECOVERY_ENABLED";

await step("point-in-time recovery (7 days)", pitrOn, async () => {
  must(
    "enabling point-in-time recovery",
    // updateMask, not a whole-object PATCH: the database resource carries
    // the location, the concurrency mode and the delete-protection flag, and
    // a full replace would rewrite all of them from whatever this script
    // happened to read a moment ago.
    await googleFetch(`${fs("")}?updateMask=pointInTimeRecoveryEnablement`, token, {
      method: "PATCH",
      body: { pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_ENABLED" },
    }),
    "roles/datastore.owner",
  );
});

// ── 2. the backup schedules ─────────────────────────────────────────
// Matched on RECURRENCE, not on name: a schedule's name is server-assigned,
// so there is no natural key, and creating a second daily schedule is not a
// harmless duplicate — it doubles the backup storage bill silently and
// forever, which is the shape apply-monitoring's channel matching avoids one
// API over.
const scheduleList = must(
  "listing backup schedules",
  await googleFetch(fs("/backupSchedules"), token),
  "roles/datastore.viewer",
);
const schedules = scheduleList.backupSchedules || [];
const daily = schedules.find((s) => s.dailyRecurrence) || null;
const weekly = schedules.find((s) => s.weeklyRecurrence) || null;

/** The seconds a schedule keeps, or NaN if it did not say. The API writes
 *  a duration as "604800s". */
function keeps(schedule) {
  return Number(String(schedule?.retention ?? "").replace(/s$/, ""));
}

/** A schedule whose RECURRENCE matches but whose retention does not is the
 *  one thing this script used to report as a success. `step` was handed
 *  "is there a daily schedule", and printed a label naming seven days —
 *  so a schedule keeping three hours read as "7-day retention, already in
 *  place, skipped", which is this script's own stated failure: a believed
 *  backup that stops anybody looking again.
 *
 *  Corrected in place rather than created alongside: the matching note
 *  above is right that a second daily schedule doubles the storage bill
 *  forever, and the retention is the only field in disagreement. Same
 *  updateMask discipline as the PITR patch. */
async function stepRetention(label, found, want, create) {
  if (found && keeps(found) === want) { console.log(`  = ${label} — already in place, skipped`); return; }
  if (found) {
    const has = keeps(found);
    const said = Number.isFinite(has) ? `keeps ${Math.round(has / DAYS * 10) / 10} day(s)` : "says no retention";
    if (!APPLY) { console.log(`  ~ ${label} — exists but ${said}, would correct`); return; }
    must(
      "correcting the backup schedule's retention",
      // The schedule's own server-assigned resource name, through the same
      // seam every other call uses — never a URL built from NAME, which
      // would be this script guessing at a key the API assigns.
      await googleFetch(api("firestore.googleapis.com", `/v1/${found.name}?updateMask=retention`), token, {
        method: "PATCH",
        body: { retention: `${want}s` },
      }),
      "roles/datastore.owner",
    );
    changed++;
    console.log(`  ✓ ${label} — corrected (${said})`);
    return;
  }
  if (!APPLY) { console.log(`  + ${label} — would create`); return; }
  await create();
  changed++;
  console.log(`  ✓ ${label} — created`);
}

await stepRetention(`daily backups, ${DAILY_RETENTION / DAYS}-day retention`, daily, DAILY_RETENTION, async () => {
  must(
    "creating the daily backup schedule",
    await googleFetch(fs("/backupSchedules"), token, {
      method: "POST",
      body: { retention: `${DAILY_RETENTION}s`, dailyRecurrence: {} },
    }),
    "roles/datastore.owner",
  );
});

await stepRetention(
  `weekly backups on ${WEEKLY_DAY}, ${WEEKLY_RETENTION / (7 * DAYS)}-week retention`,
  weekly,
  WEEKLY_RETENTION,
  async () => {
    must(
      "creating the weekly backup schedule",
      await googleFetch(fs("/backupSchedules"), token, {
        method: "POST",
        body: { retention: `${WEEKLY_RETENTION}s`, weeklyRecurrence: { day: WEEKLY_DAY } },
      }),
      "roles/datastore.owner",
    );
  },
);

// ── 3. what is actually restorable RIGHT NOW ────────────────────────
// The schedules above are a promise about the future. This is the only line
// on the page that is evidence, and it is the reason the script does not
// stop at "created": a schedule that exists and has produced nothing is
// indistinguishable, from the repo, from one that is working — which is
// D300's finding wearing different clothes.
const backupList = must(
  "listing backups",
  await googleFetch(api("firestore.googleapis.com", `/v1/projects/${PROJECT}/locations/-/backups`), token),
  "roles/datastore.viewer",
);
const backups = (backupList.backups || []).filter((b) => b.database === NAME);
console.log(
  `\n  restorable now: ${backups.length} backup(s)`
  + (backups.length
    ? ` — newest ${backups.map((b) => b.snapshotTime).sort().at(-1)}`
    : " — NOTHING. A schedule takes up to a day to produce its first one."),
);

console.log(
  APPLY
    ? `\nbackups: done, ${changed} created. Verify with the instrument rather than by eye:\n`
      + "  npm run observe\n"
      + "`backups.pitr` should read true and both schedules should be listed.\n"
      + "\nA schedule is not a restore. The first real test of any of this is\n"
      + "restoring into a scratch database and reading a row back — untested\n"
      + "recovery is a belief, and this script cannot upgrade it to a fact."
    : "\nbackups: dry run. Re-run with --apply to create the above.",
);
