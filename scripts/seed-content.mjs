#!/usr/bin/env node
// seed-content.mjs — run the operator seed without a browser.
//
// WHY THIS EXISTS. SHIP-CHECKLIST §1 says to run
// `await window.LIVE.seedContent()` from "the app's browser console". There
// is no such console: `firebase.json` serves `web/` — home, join, privacy
// and terms — and the app itself ships only as the native iOS shell. So the
// one step standing between a deployed backend and an app with content in
// it had no way to be performed at all, which is the second time that step
// has been documented as something it is not. (The first: it named a
// `firebase.functions().httpsCallable(...)` call, v8 syntax on a modular
// SDK, that would have thrown ReferenceError.)
//
// The alternative was "run the app locally with the production config",
// which needs Node, a checkout and four env values on the operator's own
// machine — for a step that recurs every time content lands (D30's
// promotion cadence), not once.
//
// HOW IT AUTHENTICATES, and why this grants nothing new. seedContentV2 is
// gated on `assertOperator`: signed in, and uid in SEED_ADMIN_UIDS. It is
// deliberately App Check EXEMPT (functions/src/v2.ts) precisely because it
// was meant to be called from a console. This mints a custom token for the
// operator uid with the service-account key the deploy already uses, trades
// it for an ID token, and calls the callable as that user.
//
// The service account could already write `v2_questions` directly — it
// deploys the rules that protect it. Going through the callable instead
// keeps one code path for seeding, so what CI runs is what the documented
// console call ran: the same idempotency, the same contentRev handling
// (D34), the same {written, skipped} result.
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT   the deploy service-account JSON (contents)
//   SEED_ADMIN_UIDS            comma-separated; the FIRST is used
//   VITE_FIREBASE_API_KEY      the web API key, for the token exchange
//   FIREBASE_PROJECT_ID        defaults to prvfire33
//
// Flags:
//   --bump-rev   invalidate every device's cached bank (D34). Needed ONLY
//                after flipping a question's `active` flag by hand in the
//                console, which changes no document the seed writes.
//   --dry-run    resolve credentials and report what would be called

import { createSign } from "node:crypto";

const argv = process.argv.slice(2);
const BUMP = argv.includes("--bump-rev");
const DRY = argv.includes("--dry-run");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";
// us-central1, matching functions/src/v2.ts and the client's
// getFunctions(app, "us-central1"). Not a default worth guessing: a wrong
// region is a 404 from a URL that looks entirely plausible.
const REGION = "us-central1";
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const RAW_SA = process.env.FIREBASE_SERVICE_ACCOUNT;
const UIDS = (process.env.SEED_ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);

function die(msg) { console.error(`seed-content: ${msg}`); process.exit(1); }

if (!RAW_SA) die("FIREBASE_SERVICE_ACCOUNT is empty — the same secret firebase-deploy.yml uses.");
if (!API_KEY) die("VITE_FIREBASE_API_KEY is empty — it is a repository VARIABLE (docs/IOS-RELEASE.md § 2).");
if (!UIDS.length) {
  die(
    "SEED_ADMIN_UIDS is empty.\n"
    + "    GitHub → Settings → Environments → production → Variables. Without it\n"
    + "    the callable answers permission-denied no matter who calls it, and a\n"
    + "    deploy with it unset still succeeds — it only logs a warning.",
  );
}

let sa;
try { sa = JSON.parse(RAW_SA); } catch { die("FIREBASE_SERVICE_ACCOUNT is not valid JSON."); }
if (!sa.private_key || !sa.client_email) die("the service-account JSON has no private_key/client_email.");

const UID = UIDS[0];

// ── a Firebase custom token ─────────────────────────────────────────
// RS256, signed locally with the key in the JSON — no IAM round trip, so
// this needs no serviceAccountTokenCreator role. `aud` is the fixed
// identitytoolkit audience Google requires for this grant; getting it
// wrong returns INVALID_CUSTOM_TOKEN, which reads like a bad signature.
const b64u = (b) => Buffer.from(b).toString("base64url");
function customToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
  };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(claims))}`;
  const sig = createSign("RSA-SHA256").update(input).sign(sa.private_key);
  return `${input}.${b64u(sig)}`;
}

// Two seams, unset in every real use, for the same reason asc-push has
// one: this script's only real target is production, so the alternative
// to a stub is shipping the request and response shapes unverified — and
// this file exists BECAUSE a documented, unverified call could not work.
const IDENTITY_BASE = process.env.SEED_IDENTITY_BASE || "https://identitytoolkit.googleapis.com";
const FUNCTIONS_BASE = process.env.SEED_FUNCTIONS_BASE
  || `https://${REGION}-${PROJECT}.cloudfunctions.net`;

async function idToken() {
  const res = await fetch(
    `${IDENTITY_BASE}/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken(UID), returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    die(
      `custom-token exchange failed (${res.status}): ${body.error?.message || JSON.stringify(body)}\n`
      + "    ACCOUNT_DISABLED or USER_NOT_FOUND means SEED_ADMIN_UIDS names a uid\n"
      + "    that does not exist in this project's Auth — check it is the\n"
      + "    Google-account uid rather than an anonymous one.",
    );
  }
  return body.idToken;
}

console.log(`seed-content: project ${PROJECT}, operator uid ${UID.slice(0, 6)}…${BUMP ? ", bumpRev" : ""}`);
if (DRY) {
  console.log("  [DRY RUN] credentials resolved; not calling seedContentV2.");
  process.exit(0);
}

const token = await idToken();
const res = await fetch(`${FUNCTIONS_BASE}/seedContentV2`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  // The payload shape LIVE.seedContent sends, field-for-field —
  // `bumpRev` always present, never conditional. vote.test.ts pins that
  // for the client; this is the second caller and should not drift from it.
  body: JSON.stringify({ data: { bumpRev: BUMP === true } }),
});
const body = await res.json();

if (!res.ok || body.error) {
  const e = body.error || {};
  die(
    `seedContentV2 failed (${res.status}): ${e.status || ""} ${e.message || JSON.stringify(body)}\n`
    + "    permission-denied → the uid is not in SEED_ADMIN_UIDS *as deployed*.\n"
    + "      That variable only reaches the runtime on a deploy, so setting it\n"
    + "      without re-running 'Deploy Firebase backend' looks exactly like\n"
    + "      never having set it.\n"
    + "    unauthenticated → the token did not attach; re-run with --dry-run.\n"
    + "    failed-precondition → NOT a transient error and re-running will not\n"
    + "      clear it. Since D58 the seed refuses to edit the option set of a\n"
    + "      question that has already shipped: answers store (qid, optionIdx)\n"
    + "      and nothing else, so swapping options re-keys every vote already\n"
    + "      cast (D52). The message above names each one. Retire a question\n"
    + "      with active:false, or append a new qid — do not 'fix' it by\n"
    + "      editing the options back.",
  );
}

const { written = 0, skipped = 0 } = body.result || {};
console.log(`seed-content: written ${written}, skipped ${skipped}`);
console.log(
  written === 0 && skipped > 0
    ? "  Nothing changed — the bank already matches the repo. Re-running is safe (D34)."
    : "  The question bank is live.",
);
