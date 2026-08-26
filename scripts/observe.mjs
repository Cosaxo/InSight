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

import { createSign } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";

const die = (m) => { console.error(`observe: ${m}`); process.exit(1); };

// TEST SEAM, the same one seed-content.mjs and operator-call.mjs carry as
// SEED_IDENTITY_BASE / SEED_FUNCTIONS_BASE. When set, every Google host
// below is served from one stub instead: `https://monitoring.googleapis.com`
// becomes `${OBSERVE_BASE}/monitoring.googleapis.com`. Unset in every real
// run, so production always talks to the real hosts.
const BASE = process.env.OBSERVE_BASE || "";
const api = (host, path) => (BASE ? `${BASE}/${host}${path}` : `https://${host}${path}`);
const TOKEN_URL = BASE ? `${BASE}/oauth2.googleapis.com/token` : "https://oauth2.googleapis.com/token";

let sa;
try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ""); }
catch { die("FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON."); }
if (!sa.private_key || !sa.client_email) die("the service-account JSON has no private_key/client_email.");

const b64u = (b) => Buffer.from(b).toString("base64url");

// cloud-platform rather than a per-API scope. The SCOPE says what the token
// is allowed to ask for; the service account's IAM ROLES say what it is
// allowed to get. Narrowing the scope here would only turn a legible
// 403-with-a-role-name into an opaque invalid_scope, and this file's whole
// job is to find out which roles are missing.
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const input = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify(claims))}`;
  const jwt = `${input}.${b64u(createSign("RSA-SHA256").update(input).sign(sa.private_key))}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const body = await res.json();
  if (!res.ok) die(`token exchange failed (${res.status}): ${body.error_description || JSON.stringify(body)}`);
  return body.access_token;
}

const token = await accessToken();

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
        enabledCount: (b.alertPolicies || []).filter((p) => p.enabled?.value !== false).length,
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
      return {
        count: fns.length,
        byRegion: Object.fromEntries(Object.entries(byRegion).map(([r, n]) => [r, n.length])),
        // D13's nine v1 leftovers and runbook 5.9's old-region copies are
        // both "is anything still in us-central1" — a question the repo has
        // asked in prose twice and could never answer.
        staleRegion: byRegion["us-central1"] || [],
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
      if (r.staleRegion.length) {
        console.log(`      us-central1 still holds ${r.staleRegion.length}: ${r.staleRegion.join(", ")}`);
        console.log("      (runbook 5.9b / D13 — dropping a name from --only never deleted these)");
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
