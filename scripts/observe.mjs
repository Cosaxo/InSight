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

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The JWT-bearer dance, the cloud-platform scope and the stub seam all live
// in one place now that apply-monitoring is the third caller (D302).
import { api, serviceAccount, accessToken } from "./google-api.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
// Per-function detail. Off by default because the normal reading is a
// count and a stray list; on when somebody is deciding whether a stray is
// safe to delete, which needs the trigger, the schedule and whether it has
// run — facts that live only in the deployment, never in this repo.
const DETAIL = argv.includes("--functions");
const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";

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
async function probe(name, url, role, pick) {
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
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
        return {
          name: f.name.split("/").pop(),
          region: f.name.split("/")[3],
          state: f.state || "?",
          env: f.environment || "?",          // GEN_1 or GEN_2
          entryPoint: f.buildConfig?.entryPoint || null,
          runtime: f.buildConfig?.runtime || null,
          updateTime: f.updateTime || null,
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
]);

const out = {
  project: PROJECT,
  // No Date.now() in the payload beyond this: the caller stamps the day.
  readings: Object.fromEntries(results.map((r) => [r.name, r])),
  reachable: results.filter((r) => r.status === "ok").map((r) => r.name),
  blocked: results.filter((r) => r.status !== "ok").map((r) => ({ name: r.name, why: r.why, http: r.http })),
};

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
    }
  }
  if (out.blocked.length) {
    console.log("\n  Blocked readings are a ROLE on the deploy service account, not a code change.");
    console.log("  Each line above names the exact one. D292's separate observer identity is the");
    console.log("  better long-term shape; granting a viewer role here is what makes the reading");
    console.log("  possible today.");
  }
}
