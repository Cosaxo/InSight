#!/usr/bin/env node
// appcheck.mjs — read and set App Check state from the credential that is
// already here, so runbook 1.4 and 3.4 stop being console-only.
//
// WHY THIS EXISTS. LAUNCH-RUNBOOK 1.4 and 3.4 are written as Firebase
// Console clicks: mint a debug token, paste it into "Manage debug tokens",
// then later flip enforcement per service. Both are real API resources —
// `projects.apps.debugTokens` and `projects.services` — so the console is
// a CHOICE here, not a constraint, and a console-only step is one nobody
// can run from a phone, prove after the fact, or diff.
//
// This is apply-monitoring.mjs's argument one API over (D303, and the
// header there): an instrument that runs beats a better-provisioned
// instrument that does not. Same credential, same helper, same shape —
// `--report` by default, writes only behind `--apply`.
//
// WHAT WAS VERIFIED AND WHAT WAS NOT. That these resources exist, that a
// debug token is a UUID4 supplied at creation (immutable afterwards, max
// 20 per app), and that enforcementMode is set by patching a service:
// verified against the published REST reference. The exact host, version
// segment and service ids: NOT reachable from the sandbox this was written
// in (firebase.google.com is blocked by the egress proxy), so they are
// taken from that reference and are proved by the first `--report` run,
// which makes GETs only and prints whatever the API answers. A wrong path
// fails LOUDLY with Google's own message — the same property that makes
// asc-push's --display-type safe to guess at.
//
// THE TOKEN NEVER PASSES THROUGH THIS SCRIPT'S OUTPUT. A debug token is a
// bypass, not an attestation (D337): whoever holds it is past App Check on
// every request. So this script REGISTERS a value handed to it in
// APPCHECK_DEBUG_TOKEN and never mints, echoes or logs one — a secret
// printed into an Actions log is readable by anyone with repo read, which
// is a wider audience than the secret has. `--report` prints display names
// and ids; the secrets stay where they were put.
//
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents)
//      FIREBASE_PROJECT_ID      (default prvfire33)
//      APPCHECK_DEBUG_TOKEN     (only for --register-debug-token)
//
// Usage:
//   node scripts/appcheck.mjs                                   # report
//   node scripts/appcheck.mjs --register-debug-token --app <appId> \
//        --display-name "CI" --apply
//   node scripts/appcheck.mjs --enforce firestore.googleapis.com \
//        --mode ENFORCED --apply

import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";

const TAG = "appcheck";
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const REGISTER = argv.includes("--register-debug-token");
const ENFORCE = argOf("--enforce");
const MODE = argOf("--mode");
const APP = argOf("--app");
const DISPLAY_NAME = argOf("--display-name") || "registered by appcheck.mjs";
const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";

const MGMT = "firebase.googleapis.com";
const CHECK = "firebaseappcheck.googleapis.com";

// The services App Check can enforce for this app. Firestore and Storage
// are 3.4's two, in its order; the others are listed so `--report` says
// something about them rather than silently covering two of five.
const SERVICES = [
  "firestore.googleapis.com",
  "firebasestorage.googleapis.com",
  "identitytoolkit.googleapis.com",
  "firebasedatabase.googleapis.com",
  "oauth2.googleapis.com",
];

const MODES = new Set(["UNENFORCED", "ENFORCED", "OFF"]);

const die = (m) => { console.error(`${TAG}: ${m}`); process.exit(1); };

// ── argument shapes that are wrong before any network call ──────────
if (REGISTER && ENFORCE) die("--register-debug-token and --enforce are separate runs. Pick one.");
if (REGISTER && !APP) die("--register-debug-token needs --app <appId>. Run with no flags to list the app ids.");
if (REGISTER && !process.env.APPCHECK_DEBUG_TOKEN) {
  die(
    "--register-debug-token reads the value from APPCHECK_DEBUG_TOKEN and never mints one.\n"
    + "    Generate a UUID4 where the secret will live, put it there, and pass it in\n"
    + "    through the environment. A token this script printed would be a secret in a log.",
  );
}
if (ENFORCE && !MODES.has(String(MODE))) {
  die(`--enforce needs --mode ${[...MODES].join(" | ")}. Got ${MODE === null ? "nothing" : MODE}.`);
}
if (ENFORCE && !SERVICES.includes(ENFORCE)) {
  // Not fatal in principle — Google gains services — but a typo here is a
  // 404 on a PATCH, and a wrong service silently left UNENFORCED is the
  // failure 3.4 is about. Naming the list is cheaper than the debugging.
  die(`--enforce ${ENFORCE} is not one of: ${SERVICES.join(", ")}.`);
}

const sa = serviceAccount(TAG);
const token = await accessToken(sa, TAG);

// ── the project number, which every App Check path is keyed by ──────
// App Check's resource names are projects/{project_NUMBER}/…, while every
// other Firebase surface in this repo is keyed by the project ID. Passing
// the id where a number belongs is a 403 that reads like a missing role,
// which is the single most confusing way to get this wrong.
const proj = await googleFetch(api(MGMT, `/v1beta1/projects/${PROJECT}`), token);
if (!proj.ok) {
  die(
    `could not read project ${PROJECT} (${proj.status}): ${proj.message}\n`
    + "    A 403 here names the role the deploy service account is missing.",
  );
}
const NUMBER = proj.body.projectNumber;
if (!NUMBER) die(`project ${PROJECT} answered without a projectNumber. Body: ${JSON.stringify(proj.body).slice(0, 200)}`);

// ── the apps ────────────────────────────────────────────────────────
async function apps() {
  const out = [];
  for (const [kind, path] of [["ios", "iosApps"], ["android", "androidApps"], ["web", "webApps"]]) {
    const res = await googleFetch(api(MGMT, `/v1beta1/projects/${PROJECT}/${path}`), token);
    // A 403 on one platform is a RESULT — some projects have no Android app
    // — so it is reported beside the others rather than taking the run down.
    if (!res.ok) { out.push({ kind, error: `${res.status} ${res.message}` }); continue; }
    for (const a of res.body.apps || []) {
      out.push({ kind, appId: a.appId, displayName: a.displayName || a.bundleId || a.packageName || "" });
    }
  }
  return out;
}

// ── report ──────────────────────────────────────────────────────────
async function report() {
  console.log(`${TAG}: project ${PROJECT} (number ${NUMBER})${APPLY ? "" : "   [READ ONLY]"}\n`);

  console.log("  Apps");
  const list = await apps();
  if (!list.length) console.log("    (none — App Check registers APPS, so there is nothing to configure yet)");
  for (const a of list) {
    if (a.error) { console.log(`    ${a.kind.padEnd(8)} — could not list: ${a.error}`); continue; }
    console.log(`    ${a.kind.padEnd(8)} ${a.appId}  ${a.displayName}`);
    const dt = await googleFetch(api(CHECK, `/v1/projects/${NUMBER}/apps/${a.appId}/debugTokens`), token);
    if (!dt.ok) { console.log(`        debug tokens: could not read (${dt.status}) ${dt.message}`); continue; }
    const tokens = dt.body.debugTokens || [];
    // Display names and ids only. The `token` field is deliberately not
    // read here even though the API returns it: see the header.
    console.log(`        debug tokens: ${tokens.length
      ? tokens.map((t) => t.displayName || t.name.split("/").pop()).join(", ")
      : "none"}`);
  }

  console.log("\n  Enforcement");
  for (const svc of SERVICES) {
    const res = await googleFetch(api(CHECK, `/v1/projects/${NUMBER}/services/${svc}`), token);
    // A service never configured answers 404 or an empty mode; both mean
    // the same thing operationally and neither is an error.
    const mode = res.ok ? (res.body.enforcementMode || "UNENFORCED (unset)") : `unreadable (${res.status}) ${res.message}`;
    console.log(`    ${svc.padEnd(34)} ${mode}`);
  }

  console.log(
    "\n  Reading it. UNENFORCED means App Check tokens are COLLECTED and metrics\n"
    + "  accrue, but nothing is refused — that is the 24-48h soak state runbook 3.4\n"
    + "  wants before the flip. ENFORCED refuses unattested requests. OFF collects\n"
    + "  nothing, so it is not a safer UNENFORCED: it is a blind one.\n"
    + "\n  Register both debug tokens BEFORE enforcing (runbook 1.4). After the flip a\n"
    + "  browser that cannot attest simply stops returning rows, with nothing in its\n"
    + "  output about why — a dev machine and the screenshot job are both that browser.",
  );
}

// ── writes ──────────────────────────────────────────────────────────
async function registerDebugToken() {
  const url = api(CHECK, `/v1/projects/${NUMBER}/apps/${APP}/debugTokens`);
  console.log(`${TAG}: register a debug token on ${APP} as "${DISPLAY_NAME}"`);
  if (!APPLY) {
    console.log("  + would create it. DRY RUN — nothing was changed. Re-run with --apply.");
    return 0;
  }
  const res = await googleFetch(url, token, {
    method: "POST",
    // `token` is the caller's UUID4. It is immutable once set, which is why
    // a wrong value here is a delete-and-recreate rather than a patch.
    body: { displayName: DISPLAY_NAME, token: process.env.APPCHECK_DEBUG_TOKEN },
  });
  if (!res.ok) {
    console.error(
      `  ✗ ${res.status}: ${res.message}\n`
      + "    400 with 'token' in the message means the value is not a UUID4.\n"
      + "    403 names the role the deploy service account is missing.\n"
      + "    An app can hold at most 20 debug tokens.",
    );
    return 1;
  }
  // The response echoes the token. It is not printed, for the reason in the
  // header — the id and the name are what an operator needs to revoke it.
  console.log(`  ✓ registered as ${res.body.name || "(unnamed)"}`);
  return 0;
}

async function setEnforcement() {
  const url = api(CHECK, `/v1/projects/${NUMBER}/services/${ENFORCE}?updateMask=enforcementMode`);
  const before = await googleFetch(api(CHECK, `/v1/projects/${NUMBER}/services/${ENFORCE}`), token);
  const now = before.ok ? (before.body.enforcementMode || "UNENFORCED (unset)") : `unknown (${before.status})`;
  console.log(`${TAG}: ${ENFORCE}  ${now} → ${MODE}`);
  if (now === MODE) {
    console.log("  = already there. Nothing to do.");
    return 0;
  }
  if (!APPLY) {
    console.log(
      "  + would change it. DRY RUN — nothing was changed. Re-run with --apply.\n"
      + "    ENFORCED is not reversible without a window where unattested clients fail,\n"
      + "    so read the soak metrics first (runbook 3.4).",
    );
    return 0;
  }
  const res = await googleFetch(url, token, {
    method: "PATCH",
    body: { name: `projects/${NUMBER}/services/${ENFORCE}`, enforcementMode: MODE },
  });
  if (!res.ok) {
    console.error(`  ✗ ${res.status}: ${res.message}`);
    return 1;
  }
  console.log(`  ✓ ${ENFORCE} is now ${res.body.enforcementMode || MODE}`);
  return 0;
}

let code = 0;
if (REGISTER) code = await registerDebugToken();
else if (ENFORCE) code = await setEnforcement();
else await report();
process.exit(code);
