#!/usr/bin/env node
// Which sign-in providers does the live Firebase project actually have on?
//
// WHY THIS EXISTS. `LAUNCH-RUNBOOK.md` 1.3 has said since 2026-08-04 that
// Google is *"enabled but UNVERIFIED"* because *"the project-config endpoint
// returns only `authorizedDomains` to an unauthenticated caller, no
// `idpConfig`, so there is no remote probe for it"*. That sentence is true
// about an UNAUTHENTICATED caller and false about this repo: the deploy
// service account in `FIREBASE_SERVICE_ACCOUNT` can read the Identity
// Platform admin API, which returns exactly the missing `idpConfig`.
//
// It cost a launch item to find out. D414 added Sign in with Apple, shift A
// found on 2026-09-09 that the native provider list never named it, and the
// review that followed could not answer "is the provider even on?" — so it
// went to the owner as a click that turned out not to be needed. It was
// already enabled. The gap was the paper trail, and a probe is the only
// thing that closes a paper trail permanently.
//
// NOT A CI GATE, deliberately. It needs a production credential, which the
// PR path does not have and should not have — `backend-checks.yml` is
// reusable by both `ci.yml` and `firebase-deploy.yml` precisely so that what
// guards a PR is what guards production, and a check that only ever runs on
// one of the two would break that property. Run it by hand, or on the deploy
// path where the secret already exists.
//
// Usage:  FIREBASE_SERVICE_ACCOUNT='<the json>' node scripts/check-auth-providers.mjs
//         (add --json for a machine-readable dump)
//
// It prints identifiers and booleans only. Apple's private key is not
// returned by this API at all, and the credential is never echoed.
//
// NO DEPENDENCY, on purpose. `google-auth-library` would do the token dance
// in one line, and it resolves from the root `node_modules` today — but it
// is declared only in `functions/package.json`, so at the root it is an
// undeclared transitive that disappears the day something upstream drops it,
// taking this script with it and saying "module not found" about a launch
// check. `ios-release.yml` already mints an App Store Connect assertion the
// same way and its comment names the reason: "Node 22's `fetch` plus
// `node:crypto` for the RS256 assertion". Same trade here.

import { createSign } from "node:crypto";

/** A signed JWT bearer assertion → an access token, RFC 7523 §2.1. */
async function accessToken(sa, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    // Ten minutes. Google caps the assertion at an hour; short is free here
    // because the token is used immediately and never stored.
    exp: now + 600,
  })}`;
  const sig = createSign("RSA-SHA256").update(body).end()
    .sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${body}.${sig}`,
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) {
    console.error(`check-auth-providers: could not mint a token (${r.status}).`);
    if (j?.error) console.error(`  ${j.error}: ${j.error_description || ""}`);
    process.exit(2);
  }
  return j.access_token;
}

const WANT = ["apple.com", "google.com"];

function creds() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) {
    console.error("check-auth-providers: FIREBASE_SERVICE_ACCOUNT is not set.");
    console.error("  It is the same secret firebase-deploy.yml writes to sa-key.json.");
    process.exit(2);
  }
  // Accepts the raw JSON and the base64 form, because both spellings are in
  // use across CI providers and a probe that only reads one is a probe that
  // reports "not set" for a secret that is.
  try { return JSON.parse(raw); }
  catch { /* fall through */ }
  try { return JSON.parse(Buffer.from(raw, "base64").toString("utf8")); }
  catch {
    console.error("check-auth-providers: FIREBASE_SERVICE_ACCOUNT is neither JSON nor base64 JSON.");
    process.exit(2);
  }
}

const sa = creds();
const project = sa.project_id;
const token = await accessToken(sa, [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
]);
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}`;

async function get(path) {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const body = await r.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* reported below */ }
  return { status: r.status, json, body };
}

const idp = await get("/defaultSupportedIdpConfigs");
const cfg = await get("/config");

if (idp.status !== 200 || idp.json?.error) {
  const e = idp.json?.error;
  console.error(`check-auth-providers: the admin API refused (${idp.status}).`);
  if (e) console.error(`  ${e.status}: ${e.message}`);
  console.error("  A deploy service account needs the Firebase Authentication Admin");
  console.error("  role to READ this; the runbook's 'no remote probe' note is about an");
  console.error("  unauthenticated caller, not about this credential.");
  process.exit(1);
}

const configured = new Map(
  (idp.json.defaultSupportedIdpConfigs || [])
    .map((c) => [String(c.name).split("/").pop(), c.enabled === true]),
);
const signIn = cfg.json?.signIn || {};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    project,
    idp: Object.fromEntries(configured),
    anonymous: signIn.anonymous?.enabled === true,
    email: signIn.email?.enabled === true,
  }, null, 2));
} else {
  console.log(`auth providers on ${project}:`);
  for (const [id, on] of configured) console.log(`  ${id.padEnd(14)} ${on ? "on" : "OFF"}`);
  console.log(`  ${"anonymous".padEnd(14)} ${signIn.anonymous?.enabled === true ? "on" : "OFF"}`);
  console.log(`  ${"email".padEnd(14)} ${signIn.email?.enabled === true ? "on" : "OFF"}`);
}

// THE ASSERTION, and it is about the doors the APP offers rather than about
// every door Firebase knows. `LiveSignInGate` renders Apple first and Google
// second, and D3's first run needs Anonymous — so those three off is a
// broken app, and each has shipped or nearly shipped broken for want of
// exactly this check (D387's App Check token, D414's provider list).
const missing = [
  ...WANT.filter((id) => configured.get(id) !== true),
  ...(signIn.anonymous?.enabled === true ? [] : ["anonymous"]),
];
if (missing.length) {
  console.error(`\ncheck-auth-providers FAILED — not enabled: ${missing.join(", ")}`);
  console.error("  Firebase Console → Authentication → Sign-in method.");
  process.exit(1);
}
console.log("\ncheck-auth-providers OK — every door the app offers is enabled.");
