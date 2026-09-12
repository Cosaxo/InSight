#!/usr/bin/env node
// observe.mjs — read production's own state with the credential that is
// already here.
//
// WHY THIS EXISTS, and why it did not sooner. D292 designed a read-only
// observer on Workload Identity Federation: a separate `insight-observer`
// service account, five viewer roles, no key. That design is right and is
// still the destination. What was WRONG was treating it as a prerequisite:
// every reading it wants is an ordinary Google API call, and
// `scripts/fn-log.mjs` has been making exactly that kind of call against
// production since D179 — signing a JWT with FIREBASE_SERVICE_ACCOUNT,
// trading it for an OAuth token, and asking Cloud Logging directly.
//
// So the six gcloud commands in runbook 5.13 buy LEAST PRIVILEGE, not
// access. Waiting for them meant nobody could see production's own state
// for as long as they went unrun — which, on 2026-08-26, was long enough
// for every instrument in this repo to report zero answers over 108 real
// ones for fifteen days (D296). An observer that exists is worth more than
// a better-scoped observer that does not.
//
// WHAT IT DOES NOT ASSUME. Which roles this service account actually holds
// is not written down anywhere in this repo, and guessing it from the name
// is how the disabled-service-account theory got two runs of attention in
// D179. So each reading is a PROBE: it reports `ok`, or the exact status
// and the role that would fix it, and one run prints the whole picture
// rather than dying on the first refusal.
//
//   node scripts/observe.mjs            # human-readable
//   node scripts/observe.mjs --json     # machine-readable, for the pulse
//
// Env: FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID (default prvfire33)

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The JWT-bearer dance, the cloud-platform scope and the stub seam all live
// in one place now that apply-monitoring is the third caller (D303).
import { api, serviceAccount, accessToken } from "./google-api.mjs";
// Every read-a-source-and-match below goes through this. A name parked in a
// comment above the live declaration is what the match would otherwise find,
// and source-pins.test.mjs holds the ceiling that made that concrete: this
// file's two paid.ts readers were added without it and the gate said so.
import { stripComments } from "./strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
// Per-function detail. Off by default because the normal reading is a
// count and a stray list; on when somebody is deciding whether a stray is
// safe to delete, which needs the trigger, the schedule and whether it has
// run — facts that live only in the deployment, never in this repo.
const DETAIL = argv.includes("--functions");
// Which monitored resource each log-based metric will actually be written
// against. Off by default: it costs one Logging read per metric and the
// answer only changes when a function moves generation. On when somebody
// is writing or repairing a policy FILTER, which is what needs it.
const METRICS = argv.includes("--metrics");
// A machine-readable copy of the same payload, written to a file while the
// human output goes to stdout unchanged. It exists so the production reader
// can be a workflow instead of a Claude session: a reader that parses the
// padded `✓ alertPolicies  5 live` lines is the one-parser-in-three-copies
// failure D197 recorded, and this probe is the last instrument that should
// carry it. Off unless asked for, and it never changes what the run prints
// or what it exits with — the write happens after the readings are in hand,
// so a broken path cannot cost a reading.
const JSON_OUT = (() => {
  const i = argv.indexOf("--json-out");
  return i >= 0 ? argv[i + 1] : null;
})();
const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";
// `insight`, not `(default)` — functions/src/db.ts:29. Reading the wrong
// database would 404, and a 404 on a project path reads here as "enable the
// API", which is a different and much more alarming fix than "you asked
// about a database that does not exist".
const DB_ID = process.env.FIRESTORE_DB_ID || "insight";

// ABOVE the REGION block on purpose: `die`'s only remaining call site is
// INSIDE that IIFE, which runs during module evaluation, and a `const` is
// in the temporal dead zone until its own line executes. Declared after it,
// the region guard threw `Cannot access 'die' before initialization`
// instead of naming the file and the constant — reproduced by breaking the
// regex. eslint cannot see it: the name IS referenced, and
// `no-use-before-define` is off for scripts/*.mjs. The extraction into
// google-api.mjs is what left this call alone; it had three siblings that
// ran after the declaration and hid it.
const die = (m) => { console.error(`observe: ${m}`); process.exit(1); };

// READ, not retyped (D201/D200) — the same scan operator-call.mjs makes, and
// for the same reason: a wrong region here would report every live function
// as a stray.
const REGION = (() => {
  const src = readFileSync(new URL("../src/lib/region.ts", import.meta.url), "utf8");
  const m = src.match(/export const FUNCTIONS_REGION = "([^"]+)"/);
  if (!m) die("could not read FUNCTIONS_REGION from src/lib/region.ts");
  return m[1];
})();

const sa = serviceAccount("observe");

const token = await accessToken(sa, "observe");

/** One probe. Never throws: a refusal is a RESULT, because the point of the
 *  run is to learn which readings are available and which need a role. */
async function probe(name, url, role, pick, init = {}) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (!res.ok) {
      const msg = body?.error?.message || text.slice(0, 140);
      // 403 means the API is on and the ROLE is missing; 404 on a project
      // path usually means the API itself is not enabled. Different fixes,
      // so they must not read the same.
      const why = res.status === 403 ? `grant ${role}`
        : res.status === 404 ? "enable the API for this project"
        : "see the message";
      return { name, status: res.status === 403 ? "denied" : "error", http: res.status, why, message: msg };
    }
    return { name, status: "ok", ...pick(body ?? {}) };
  } catch (err) {
    return { name, status: "error", why: "the request itself failed", message: String(err).slice(0, 140) };
  }
}

// WHAT RESOURCE THE METRICS' SERIES WILL CARRY, measured rather than
// reasoned. On 2026-08-26 the first `--apply` run created the channel, all
// five metrics and one policy, then took a 400 from Cloud Monitoring:
//
//   condition_threshold.filter had an invalid value of
//   metric.type="logging.googleapis.com/user/agg_contention": must specify
//   a restriction on "resource.type"
//
// Five committed policies read a log-based user metric with no
// `resource.type` in the filter. Adding one is the fix, and adding the
// WRONG one is worse than the 400: a policy naming a resource type its
// series never carries is accepted, enabled, listed and permanently green,
// and cannot fire. The 400 at least says so out loud.
//
// A log-based metric inherits the monitored resource of the log entries it
// counts, so the only authority on the right value is an entry. This reads
// one per metric, using apply-monitoring's own log filter — parsed out of
// its source the way check-monitoring parses the same lists, because a
// second copy of them is how they drift.
//
// It answers a second question for free, and that one is check:monitoring
// rule 4's: that rule proves STATICALLY that some function emits
// `metric: "X"`, and cannot say whether it has ever run. `entries: 0` here
// is that gap, measured.
const metricFilters = (() => {
  const src = readFileSync(join(root, "scripts/apply-monitoring.mjs"), "utf8");
  return [...src.matchAll(/name:\s*"([\w]+)",[\s\S]{0,400}?filter:\s*(['"])([\s\S]*?)\2/g)]
    .map((m) => ({ metric: m[1], filter: m[3] }));
})();

async function metricResources() {
  const readings = await Promise.all(metricFilters.map(async ({ metric, filter }) => {
    const r = await probe(
      `metric:${metric}`,
      api("logging.googleapis.com", "/v2/entries:list"),
      "roles/logging.viewer",
      (b) => {
        const e = (b.entries || [])[0];
        if (!e) return { entries: 0, resourceType: null, note: "no entry in the window — nothing has emitted it yet" };
        return {
          entries: 1,
          resourceType: e.resource?.type || null,
          resourceLabels: e.resource?.labels || {},
          at: e.timestamp || null,
        };
      },
      {
        method: "POST",
        body: JSON.stringify({
          resourceNames: [`projects/${PROJECT}`],
          filter,
          orderBy: "timestamp desc",
          pageSize: 1,
        }),
      },
    );
    return { metric, ...r };
  }));
  return readings;
}

// THE MONEY PATH'S OWN SECRETS, read out of the module that reads them
// (D200/D201) rather than retyped here. Retyping is how the third copy of a
// list drifts, and this list has a specific way of drifting: a renamed
// variable would leave this reader printing "unset" for a name nothing looks
// for any more, which reads as a missing secret and is a missing READER.
//
// AND IT DRIFTED THE OTHER WAY. The scan takes every `process.env.X` in the
// file, and since D456 `paid.ts` reads `FUNCTIONS_EMULATOR` — the variable
// the emulator sets and, in that file's own words, "nothing can set into a
// deployed runtime". So a perfectly configured deployment printed
// `✗ FUNCTIONS_EMULATOR NOT SET` and read as one secret short of working,
// with no deploy able to clear it. A name is a SECRET here only if the
// deploy could put it in the runtime; the emulator's marker is a runtime
// fact, which is the opposite thing. The guard that should have caught this
// only asks whether each scraped name appears in paid.ts — true of this one
// — so it cannot fail in the over-scraping direction, and the count below
// is what closes that.
const NOT_SECRETS = new Set(["FUNCTIONS_EMULATOR", "NODE_ENV", "GCLOUD_PROJECT", "K_SERVICE"]);
const PAID_ENV_NAMES = (() => {
  const src = stripComments(readFileSync(join(root, "functions/src/paid.ts"), "utf8"));
  const all = [...new Set([...src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]))];
  return all.filter((n) => !NOT_SECRETS.has(n));
})();

// The functions paid.ts deploys. The dotenv the deploy writes is baked into
// EVERY function's runtime config, so any of them would answer the presence
// question — but the URL only exists on the webhook, and runbook 5.14 step 2
// is "point a Stripe endpoint at it", so this reader is keyed on the ones a
// buyer's money actually travels through.
const PAID_FN_NAMES = (() => {
  const src = stripComments(readFileSync(join(root, "functions/src/paid.ts"), "utf8"));
  return [...src.matchAll(/^export const (\w+) = on/gm)].map((m) => m[1].toLowerCase());
})();

// The eight policies this repo commits, so "armed" can be answered by NAME
// rather than by count — a project with eight unrelated policies would
// otherwise read as fully armed.
const committedPolicies = readdirSync(join(root, "monitoring"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => { try { return JSON.parse(readFileSync(join(root, "monitoring", f), "utf8")); } catch { return null; } })
  .filter((p) => p && typeof p.displayName === "string" && Array.isArray(p.conditions))
  .map((p) => p.displayName);

const results = await Promise.all([
  probe(
    "alertPolicies",
    api("monitoring.googleapis.com", `/v3/projects/${PROJECT}/alertPolicies`),
    "roles/monitoring.viewer",
    (b) => {
      const live = (b.alertPolicies || []).map((p) => p.displayName);
      const missing = committedPolicies.filter((n) => !live.includes(n));
      return {
        liveCount: live.length,
        committed: committedPolicies.length,
        // THE reading runbook 5.5 exists for. Nothing in this repository
        // could answer it before today.
        armed: missing.length === 0,
        missing,
        // `enabled` is a BARE BOOLEAN in the v3 JSON representation, not a
        // protobuf wrapper — the discovery doc gives `{"type":"boolean"}`
        // with no $ref. Read as `p.enabled !== false` it was
        // `(false)?.value` -> undefined -> `undefined !== false` -> true, so
        // a DISABLED policy counted as enabled and this number could only
        // ever equal liveCount. `!== false` is kept for the field being
        // absent, which the API omits when it is true.
        enabledCount: (b.alertPolicies || []).filter((p) => p.enabled !== false).length,
      };
    },
  ),
  probe(
    "logMetrics",
    api("logging.googleapis.com", `/v2/projects/${PROJECT}/metrics`),
    "roles/logging.viewer",
    (b) => ({ count: (b.metrics || []).length, names: (b.metrics || []).map((m) => m.name) }),
  ),
  probe(
    "functions",
    api("cloudfunctions.googleapis.com", `/v2/projects/${PROJECT}/locations/-/functions?pageSize=100`),
    "roles/cloudfunctions.viewer",
    (b) => {
      const fns = b.functions || [];
      const byRegion = {};
      for (const f of fns) {
        // name is projects/P/locations/REGION/functions/NAME
        const region = f.name?.split("/")[3] || "?";
        (byRegion[region] ||= []).push(f.name.split("/").pop());
      }
      // ANY region that is not the canonical one, not just us-central1.
      // Written as `byRegion["us-central1"]` first, because that is the only
      // stale region the repo's prose has ever named — and the first run
      // found 21 there AND two more in europe-west3 and one in
      // europe-north1 that no document mentions. A reader that only asks
      // about the region it expects to be wrong finds exactly the wrongness
      // it expected, which is the same shape as the runbook counting nine
      // where production holds 21.
      const strays = Object.fromEntries(
        Object.entries(byRegion).filter(([r]) => r !== REGION).map(([r, n]) => [r, n]),
      );
      // Kept whole so --functions can describe a stray without a second
      // call. An eventTrigger with a pubsub topic named `firebase-schedule-*`
      // IS a scheduled function — the v2 API models schedules that way, so
      // "does this bill me every night" is answerable without the source.
      const detail = fns.map((f) => {
        const ev = f.eventTrigger || {};
        const topic = ev.pubsubTopic || "";
        const scheduled = /firebase-schedule/.test(topic);
        // PRESENCE ONLY, never the value. The list response carries the
        // runtime's environment variables in full, and this project's
        // secrets reach the runtime through that dotenv rather than through
        // Secret Manager (DEPLOYMENT.md § Runtime environment) — so
        // `sk_live_…` is literally in the body being read here. Only the
        // KEY SET crosses out of this function, and observe.test.mjs
        // asserts a planted value reaches no line of any output mode. Same
        // discipline auth-config.yml applies to the demo password.
        //
        // `undefined` is a THIRD answer and is not folded into "unset": if
        // the API omits the map, saying the secrets are missing would be a
        // fabricated reading of exactly the shape D296 recorded, where an
        // instrument reported zero over 108 real answers for fifteen days.
        const envMap = f.serviceConfig?.environmentVariables;
        return {
          name: f.name.split("/").pop(),
          region: f.name.split("/")[3],
          state: f.state || "?",
          env: f.environment || "?",          // GEN_1 or GEN_2
          entryPoint: f.buildConfig?.entryPoint || null,
          runtime: f.buildConfig?.runtime || null,
          updateTime: f.updateTime || null,
          uri: f.serviceConfig?.uri || null,
          // Whose credentials the function runs with — the identity the
          // hard stop's grant goes to (D471), read rather than assumed:
          // the gen-2 default is the Compute Engine default account, and a
          // deploy that set another would leave a typed default granting
          // the wrong principal.
          serviceAccount: f.serviceConfig?.serviceAccountEmail || null,
          envNames: envMap ? Object.keys(envMap) : null,
          trigger: scheduled ? "schedule"
            : ev.eventType ? ev.eventType
              : f.serviceConfig?.uri ? "https"
                : "?",
          eventFilters: (ev.eventFilters || []).map((x) => `${x.attribute}=${x.value}`),
        };
      });
      return {
        detail,
        count: fns.length,
        byRegion: Object.fromEntries(Object.entries(byRegion).map(([r, n]) => [r, n.length])),
        canonicalRegion: REGION,
        strays,
        strayCount: Object.values(strays).reduce((a, n) => a + n.length, 0),
      };
    },
  ),
  probe(
    "billing",
    api("cloudbilling.googleapis.com", `/v1/projects/${PROJECT}/billingInfo`),
    "roles/billing.viewer",
    (b) => ({ enabled: b.billingEnabled === true, account: b.billingAccountName || null }),
  ),
  // WHETHER THE HARD STOP IS ARMED (D471). functions/src/budget.ts detaches
  // billing at three budgets with one API call the functions' runtime
  // account may not make until it holds roles/billing.projectManager on
  // the project — and the only other way to learn whether it may is to
  // let a month reach the line, which is the one test nobody can run.
  // So the project's IAM policy is read for the binding, and joined below
  // with the account onBudgetAlert actually runs as (the functions
  // reading carries it), so nothing here is typed. A POST, like
  // entries:list: getIamPolicy is a method, not a resource.
  probe(
    "hardStop",
    api("cloudresourcemanager.googleapis.com", `/v1/projects/${PROJECT}:getIamPolicy`),
    "roles/viewer (resourcemanager.projects.getIamPolicy)",
    (b) => ({
      role: "roles/billing.projectManager",
      holders: (b.bindings || [])
        .filter((x) => x.role === "roles/billing.projectManager")
        .flatMap((x) => x.members || []),
    }),
    { method: "POST", body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }) },
  ),
  // Runbook 5.11 and 5.12 both END in a BigQuery dataset, and neither could
  // be answered from this repository before today — 5.12's own text says the
  // diff "has never happened", and the reason it never happened is that
  // nobody could see whether the export was on. Listing datasets is the
  // cheapest authoritative answer to both: the mirror writes one, the
  // billing export writes one, and `location` is what D165's EU residency
  // argument is actually about.
  probe(
    "bigquery",
    api("bigquery.googleapis.com", `/bigquery/v2/projects/${PROJECT}/datasets?all=true&maxResults=200`),
    "roles/bigquery.dataViewer",
    (b) => {
      const sets = (b.datasets || []).map((d) => ({
        id: d.datasetReference?.datasetId || d.id || "?",
        // The list response carries location per dataset, so the residency
        // question costs no second call.
        location: d.location || "?",
      }));
      return { count: sets.length, datasets: sets };
    },
  ),
  // WHETHER THE ONLY ASSET SURVIVES A BAD AFTERNOON. Nothing in this
  // repository could answer that before 2026-09-11 — `docs/COST-EXPOSURE.md`
  // §7 listed backups and PITR among the facts it "could not verify from
  // here", which was true and was also the whole of what was known.
  //
  // It reads the DATABASE, not the schedules, for `pitr`: the schedules are
  // a promise about tomorrow and PITR is a property of the thing itself.
  // `scripts/backups.mjs` is what puts them in place.
  probe(
    "backups",
    api("firestore.googleapis.com", `/v1/projects/${PROJECT}/databases/${DB_ID}`),
    "roles/datastore.viewer",
    (b) => ({ pitr: b.pointInTimeRecoveryEnablement === "POINT_IN_TIME_RECOVERY_ENABLED" }),
  ),
  probe(
    "backupSchedules",
    api("firestore.googleapis.com", `/v1/projects/${PROJECT}/databases/${DB_ID}/backupSchedules`),
    "roles/datastore.viewer",
    (b) => {
      const all = b.backupSchedules || [];
      return {
        count: all.length,
        daily: all.some((x) => x.dailyRecurrence),
        weekly: all.some((x) => x.weeklyRecurrence),
        // Retention read back rather than assumed: a schedule created with
        // the wrong duration is accepted, listed, and quietly keeps three
        // hours of history. "A schedule exists" is not the reading anybody
        // wants; "how far back can I go" is.
        retention: all.map((x) => x.retention || "?"),
      };
    },
  ),
]);

const metricReadings = METRICS ? await metricResources() : null;

// THE MONEY PATH, derived from the functions reading rather than fetched
// again — the list response already carries every field this needs.
//
// WHY THIS IS HERE AT ALL. `OWNER-LIST.md` carries the sentence "a session
// cannot read the deployed environment, so whether a sale can go through
// TODAY is a fact only you can check". That was true of every session that
// had not tried, which is the same shape D292 recorded about the observer:
// the reading was an ordinary API call the whole time, and treating it as
// unavailable is what kept it unread. Runbook 5.14's own text asks for this
// out loud about the third name — "the one of the three whose absence does
// not stop the loop, which makes it the one to check rather than assume".
const paidPath = (() => {
  const fn = results.find((r) => r.name === "functions");
  if (fn.status !== "ok") return { status: fn.status, why: fn.why };
  const deployed = fn.detail.filter((d) => PAID_FN_NAMES.includes(d.name.toLowerCase()));
  const webhook = deployed.find((d) => d.name.toLowerCase() === "stripewebhookv2");
  // A function whose env map the API did not return is not evidence of an
  // unset secret. Counted separately so the verdict can say "unreadable"
  // instead of inventing "unset" — see the functions probe's own comment.
  const withEnv = deployed.filter((d) => Array.isArray(d.envNames));
  const secrets = Object.fromEntries(PAID_ENV_NAMES.map((n) => [n, {
    on: withEnv.filter((d) => d.envNames.includes(n)).length,
    of: withEnv.length,
  }]));
  const set = (n) => withEnv.length > 0 && secrets[n]?.on > 0;
  return {
    status: "ok",
    deployed: deployed.map((d) => d.name),
    missingFunctions: PAID_FN_NAMES.filter((n) => !deployed.some((d) => d.name.toLowerCase() === n)),
    // Runbook 5.14 step 2 needs this string and nothing else. Printing it
    // here is what turns "run gcloud functions describe" into "read the
    // line above".
    webhookUrl: webhook?.uri || null,
    envReadable: withEnv.length > 0,
    secrets,
    // The two that stop a sale, and the one that only removes the judgement
    // half of the review. Kept apart because folding them would report the
    // loop as broken when it is merely reviewing on gates alone.
    canSell: set("STRIPE_SECRET_KEY") && set("STRIPE_WEBHOOK_SECRET"),
    reviewJudged: set("ANTHROPIC_API_KEY"),
  };
})();

// The Firestore→BigQuery mirror (runbook 5.11) announces itself as deployed
// FUNCTIONS, so it is answerable from the list already in hand. Detecting it
// by its functions rather than by a dataset name is the authoritative half:
// a dataset can be created by anything, an `ext-` function is the extension.
const bqMirror = (() => {
  const fn = results.find((r) => r.name === "functions");
  if (fn.status !== "ok") return { status: fn.status, why: fn.why };
  const fns = fn.detail.filter((d) => d.name.startsWith("ext-firestore-bigquery-export"));
  return { status: "ok", installed: fns.length > 0, functions: fns.map((d) => `${d.region}/${d.name}`) };
})();

// Cloud Billing export (runbook 5.12) writes tables named
// `gcp_billing_export_*` into a dataset of the operator's choosing, so the
// dataset NAME proves nothing and the table names prove it exactly. One
// list per dataset, bounded — this project holds a handful, and an
// unbounded scan is the thing a daily scheduled reader must not grow.
const BILLING_TABLE_SCAN_MAX = 10;
const billingExport = await (async () => {
  const bq = results.find((r) => r.name === "bigquery");
  if (bq.status !== "ok") return { status: bq.status, why: bq.why };
  const scanned = bq.datasets.slice(0, BILLING_TABLE_SCAN_MAX);
  const hits = [];
  for (const d of scanned) {
    const r = await probe(
      `tables:${d.id}`,
      api("bigquery.googleapis.com", `/bigquery/v2/projects/${PROJECT}/datasets/${d.id}/tables?maxResults=200`),
      "roles/bigquery.dataViewer",
      (b) => ({ tables: (b.tables || []).map((t) => t.tableReference?.tableId || t.id || "?") }),
    );
    if (r.status !== "ok") continue;
    const billing = r.tables.filter((t) => t.startsWith("gcp_billing_export_"));
    if (billing.length) hits.push({ dataset: d.id, location: d.location, tables: billing });
  }
  return {
    status: "ok",
    on: hits.length > 0,
    hits,
    scanned: scanned.length,
    truncated: bq.datasets.length > scanned.length,
  };
})();

// The hard stop's ARMED reading is the join of two probes: the binding
// (hardStop) and the account onBudgetAlert runs as (functions). Written
// onto the hardStop result so the JSON carries one answer, with the three
// honest states kept apart — not deployed, deployed and not granted,
// granted — because "not armed" over an undeployed function would send
// the operator to IAM for a function that does not exist yet.
{
  const hs = results.find((r) => r.name === "hardStop");
  const fn = results.find((r) => r.name === "functions");
  if (hs?.status === "ok") {
    const budgetFn = fn?.status === "ok" ? fn.detail.find((d) => d.name === "onBudgetAlert") : undefined;
    hs.functionAccount = budgetFn?.serviceAccount ?? null;
    hs.deployed = fn?.status === "ok" ? Boolean(budgetFn) : null;
    hs.armed = hs.functionAccount ? hs.holders.includes(`serviceAccount:${hs.functionAccount}`) : null;
  }
}

const out = {
  project: PROJECT,
  // No Date.now() in the payload beyond this: the caller stamps the day.
  readings: Object.fromEntries(results.map((r) => [r.name, r])),
  reachable: results.filter((r) => r.status === "ok").map((r) => r.name),
  blocked: results.filter((r) => r.status !== "ok").map((r) => ({ name: r.name, why: r.why, http: r.http })),
  // Derived, not probed — they carry no `name` and never join `reachable`
  // or `blocked`, so a caller counting readings still counts readings.
  paidPath,
  bqMirror,
  billingExport,
  ...(metricReadings ? { metricResources: metricReadings } : {}),
};

if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));

if (AS_JSON) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`observe: ${PROJECT} — ${out.reachable.length}/${results.length} readings available\n`);
  for (const r of results) {
    if (r.status !== "ok") {
      console.log(`  ✗ ${r.name.padEnd(14)} ${r.status} (${r.http ?? "-"}) — ${r.why}`);
      console.log(`      ${r.message}`);
      continue;
    }
    if (r.name === "alertPolicies") {
      console.log(`  ✓ alertPolicies  ${r.liveCount} live, ${r.enabledCount} enabled; `
        + `${r.armed ? "ALL committed policies are armed" : `${r.missing.length}/${r.committed} committed NOT armed`}`);
      for (const m of r.missing) console.log(`      not armed: ${m}`);
    } else if (r.name === "logMetrics") {
      console.log(`  ✓ logMetrics     ${r.count} log-based metric(s)`);
    } else if (r.name === "functions") {
      console.log(`  ✓ functions      ${r.count} deployed — ${JSON.stringify(r.byRegion)}`);
      if (r.strayCount) {
        console.log(`      ${r.strayCount} outside ${r.canonicalRegion}:`);
        for (const [region, names] of Object.entries(r.strays)) {
          console.log(`        ${region} (${names.length}): ${names.join(", ")}`);
        }
        console.log("      (runbook 5.9b / D13 — dropping a name from --only never deleted these)");
      }
      if (DETAIL) {
        console.log("");
        for (const d of r.detail.sort((a, b) => (a.region + a.name).localeCompare(b.region + b.name))) {
          const stray = d.region !== r.canonicalRegion ? " *" : "  ";
          console.log(`     ${stray}${d.region.padEnd(15)} ${d.name.padEnd(34)} ${String(d.env).padEnd(6)} ${d.state.padEnd(8)} ${d.trigger}`);
          if (d.eventFilters.length) console.log(`        on ${d.eventFilters.join(" ")}`);
          console.log(`        entry ${d.entryPoint ?? "?"} · ${d.runtime ?? "?"} · last deployed ${d.updateTime ?? "?"}`);
        }
        console.log("\n      * = outside the canonical region. `schedule` means it fires on a");
        console.log("        timer and bills for it; an event type means it fires on a write.");
      }
    } else if (r.name === "billing") {
      console.log(`  ✓ billing        enabled=${r.enabled} account=${r.account ?? "-"}`);
    } else if (r.name === "hardStop") {
      if (r.deployed === null) {
        console.log(`  ✓ hardStop       unreadable — the functions reading is not available, so which account to check is unknown`);
      } else if (!r.deployed) {
        console.log("  ✓ hardStop       onBudgetAlert is not deployed — nothing to arm yet (D471)");
      } else if (!r.functionAccount) {
        console.log("  ✓ hardStop       onBudgetAlert is deployed but the API did not say which account it runs as");
      } else if (r.armed) {
        console.log(`  ✓ hardStop       ARMED — onBudgetAlert runs as ${r.functionAccount}, which holds ${r.role} (D471)`);
      } else {
        console.log(`  ✓ hardStop       **NOT ARMED** — ${r.functionAccount} does not hold ${r.role} on ${PROJECT};`);
        console.log("      the detach at three budgets is refused until it does (LAUNCH-RUNBOOK 5.18):");
        console.log(`      gcloud projects add-iam-policy-binding ${PROJECT} --member serviceAccount:${r.functionAccount} --role ${r.role}`);
      }
    } else if (r.name === "bigquery") {
      console.log(`  ✓ bigquery       ${r.count} dataset(s)`
        + (r.count ? `: ${r.datasets.map((d) => `${d.id} (${d.location})`).join(", ")}` : ""));
    } else if (r.name === "backups") {
      console.log(`  ✓ backups        point-in-time recovery: ${r.pitr ? "ON" : "**OFF**"}`);
    } else if (r.name === "backupSchedules") {
      console.log(`  ✓ backupSched.   ${r.count} schedule(s) — daily=${r.daily} weekly=${r.weekly}`
        + (r.retention.length ? ` retention=${r.retention.join(",")}` : ""));
      if (!r.daily || !r.weekly) {
        console.log("      Actions → Backups (apply off first). A database with no schedule");
        console.log("      has no copy, and D290 makes the answers the only source there is.");
      }
    }
  }

  // The money path and the two BigQuery steps, printed together because the
  // question they answer is one question: can this project take a payment
  // and can it see what it spent. Every line is a runbook box.
  console.log("\n  The money path (runbook 5.14) — read from the deployment, not assumed:");
  if (paidPath.status !== "ok") {
    console.log(`    ✗ unreadable — the functions reading is ${paidPath.status} (${paidPath.why})`);
  } else if (!paidPath.deployed.length) {
    console.log("    ✗ none of paid.ts's functions are deployed — nothing to configure yet.");
  } else if (!paidPath.envReadable) {
    console.log("    · the API returned no environment map for these functions, so the three");
    console.log("      secrets are UNREADABLE from here — which is not the same as unset, and is");
    console.log("      not reported as unset. Check the deploy's 'Write functions runtime env' step.");
  } else {
    for (const n of PAID_ENV_NAMES) {
      const c = paidPath.secrets[n];
      const mark = c.on > 0 ? (c.on === c.of ? "✓" : "!") : "✗";
      const note = c.on > 0 && c.on < c.of ? `  (on ${c.on} of ${c.of} — re-deploy, the dotenv is per-deploy)` : "";
      console.log(`    ${mark} ${n.padEnd(21)} ${c.on > 0 ? "present in the runtime" : "NOT SET"}${note}`);
    }
    console.log("");
    console.log(`    A sale can complete today: ${paidPath.canSell ? "YES" : "NO"}`
      + (paidPath.canSell ? "" : " — checkout answers `unavailable` and the webhook 503s,"));
    if (!paidPath.canSell) console.log("      so a buyer reaches an approved quote and a dead end, and nothing pages.");
    // WHAT "NO KEY" MEANS CHANGED THE SAME DAY THIS LINE WAS WRITTEN. D454
    // printed "deterministic gates alone (paid_review_gates_only)", which
    // was the behaviour until D456: the gates never read the WORDS, so a
    // keyless deployment approved whatever arrived. D456 made a keyless
    // runtime DEFER instead — the booking stays in `review`, which is the
    // Routine's queue — and kept gates-only for the emulator alone, keyed
    // on FUNCTIONS_EMULATOR, which nothing can set into a deployed
    // runtime. So `paid_review_gates_only` can no longer appear in the
    // runtime this script reads, and the old sentence told an operator
    // that unreviewed questions were going out when the truth is the
    // opposite and quieter: a queue nobody is emptying.
    console.log(`    Reviews settle inside the request: ${paidPath.reviewJudged
      ? "YES — Claude's judgement"
      : "NO — every booking is HELD for the review Routine (paid_review_deferred)"}`);
    if (!paidPath.reviewJudged) {
      console.log("      Nothing publishes until that queue is emptied: `node scripts/paid-review.mjs --list`.");
    }
  }
  if (paidPath.status === "ok" && paidPath.webhookUrl) {
    console.log(`\n    stripeWebhookV2 → ${paidPath.webhookUrl}`);
    console.log("      That is the URL runbook 5.14 step 2 asks for. Subscribe THREE events:");
    console.log("      checkout.session.completed, .async_payment_succeeded, .async_payment_failed");
    console.log("      — EUR's delayed methods settle later, and `completed` alone strands them.");
  } else if (paidPath.status === "ok" && paidPath.deployed.length) {
    console.log("\n    stripeWebhookV2 has no URL in the reading — it may not be deployed.");
  }
  if (paidPath.status === "ok" && paidPath.missingFunctions.length) {
    console.log(`    Not deployed: ${paidPath.missingFunctions.join(", ")}`);
  }

  console.log("\n  BigQuery (runbook 5.11 mirror, 5.12 billing export):");
  if (bqMirror.status !== "ok") {
    console.log(`    ✗ mirror         unreadable — functions is ${bqMirror.status}`);
  } else {
    console.log(`    ${bqMirror.installed ? "✓" : "·"} mirror         ${bqMirror.installed
      ? `installed — ${bqMirror.functions.join(", ")}`
      : "not installed. 5.11 is deliberately timed WITH the first real users:"}`);
    if (!bqMirror.installed) {
      console.log("                     the extension streams from the moment it is installed, and");
      console.log("                     rows of accounts erased in the interim never arrive at all.");
    }
  }
  if (billingExport.status !== "ok") {
    console.log(`    ✗ billing export unreadable — the bigquery reading is ${billingExport.status}`);
  } else if (billingExport.on) {
    for (const h of billingExport.hits) {
      console.log(`    ✓ billing export ${h.dataset} (${h.location}) — ${h.tables.join(", ")}`);
    }
  } else {
    console.log(`    · billing export not on — no gcp_billing_export_* table in ${billingExport.scanned} dataset(s).`);
    console.log("                     Until it is, every cost figure in docs/COSTS.md stays a");
    console.log("                     prediction with nothing to diff against (5.12).");
  }
  console.log("");
  console.log("      These three are OWNER actions: a Stripe account, a console toggle and an");
  console.log("      extension install. What this reader changes is that their state is now a");
  console.log("      line here rather than a fact nobody in the repo could see.");
  if (metricReadings) {
    console.log("\n  What each log-based metric's series will be written against:");
    for (const m of metricReadings) {
      if (m.status !== "ok") {
        console.log(`    ✗ ${m.metric.padEnd(20)} ${m.status} (${m.http ?? "-"}) — ${m.why}`);
        continue;
      }
      if (!m.entries) {
        console.log(`    · ${m.metric.padEnd(20)} no entry yet — ${m.note}`);
        continue;
      }
      const labels = Object.entries(m.resourceLabels || {})
        .filter(([k]) => k !== "project_id")
        .map(([k, v]) => `${k}=${v}`).join(" ");
      console.log(`    ✓ ${m.metric.padEnd(20)} resource.type="${m.resourceType}"  ${labels}`);
    }
    console.log("");
    console.log("      A policy filtering on one of these metrics MUST restrict resource.type");
    console.log("      — Cloud Monitoring rejects the create otherwise (400) — and must use the");
    console.log("      value above. A policy naming a type its series never carries is accepted,");
    console.log("      enabled and permanently green, which is worse than the 400.");
    console.log("");
    console.log("      `no entry yet` is check:monitoring rule 4's blind spot, measured: that");
    console.log("      rule proves a function CONTAINS the emit line, never that it has run.");
  }

  if (out.blocked.length) {
    console.log("\n  Blocked readings are a ROLE on the deploy service account, not a code change.");
    console.log("  Each line above names the exact one. D292's separate observer identity is the");
    console.log("  better long-term shape; granting a viewer role here is what makes the reading");
    console.log("  possible today.");
  }
}
