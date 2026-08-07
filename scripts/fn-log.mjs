#!/usr/bin/env node
// fn-log.mjs — read a Cloud Function's RUNTIME log, filtered properly.
//
// WHY NOT `firebase functions:log`. It was tried first, on the seed's
// INTERNAL failure, and returned only `cloudaudit.googleapis.com` entries —
// deployment events, newest one fifteen minutes OLDER than the failing
// invocation. Audit logs record who changed the function, not what it did.
// A reader who does not notice that difference concludes "the function
// logged nothing", which is a much stronger and much wronger claim than
// "I read the wrong stream".
//
// So this asks Cloud Logging directly, for the two log names that carry a
// Gen-2 function's own output, and orders newest-first so `--limit` means
// "the most recent N" rather than "the oldest N of a truncated page".
//
// Auth: the deploy service-account key, exchanged for an OAuth token via
// the JWT-bearer grant. Same signing code as seed-content.mjs, different
// audience and scope — and that difference is the whole trick, so it is
// spelled out at the call site rather than left to be inferred.
//
// Env:  FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID (default prvfire33)
// Args: --fn <name>  (required)  --limit <n>  --minutes <n>  --all-severities

import { createSign } from "node:crypto";

const argv = process.argv.slice(2);
const argOf = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const FN = argOf("--fn");
const LIMIT = Number(argOf("--limit", "30"));
const MINUTES = Number(argOf("--minutes", "60"));
const ALL = argv.includes("--all-severities");
const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";

function die(m) { console.error(`fn-log: ${m}`); process.exit(1); }
if (!FN) die("--fn <functionName> is required.");

let sa;
try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ""); }
catch { die("FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON."); }

const b64u = (b) => Buffer.from(b).toString("base64url");

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  // aud is the TOKEN ENDPOINT here, not the identitytoolkit audience
  // seed-content.mjs uses — these are different grants that happen to
  // share a signing routine, and swapping them yields "invalid_grant",
  // which reads like a broken key.
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/logging.read",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const input = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify(claims))}`;
  const jwt = `${input}.${b64u(createSign("RSA-SHA256").update(input).sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok) die(`token exchange failed (${res.status}): ${body.error_description || JSON.stringify(body)}`);
  return body.access_token;
}

// Gen-2 functions run on Cloud Run, so their own output lands under
// run.googleapis.com/{stdout,stderr} against the service name — which is
// the function name LOWERCASED. cloudfunctions.googleapis.com/cloud-functions
// is included for Gen-1 and for the platform's own messages.
// cloudaudit.googleapis.com is deliberately EXCLUDED: it is what
// `firebase functions:log` showed instead of this, and it never contains a
// stack trace.
const service = FN.toLowerCase();
const since = new Date(Date.now() - MINUTES * 60_000).toISOString();
// Each side of the OR is parenthesised explicitly. Cloud Logging does bind
// AND tighter than OR, so this happens to be correct without them — but a
// filter that is right by precedence rather than by punctuation is one
// nobody can check at a glance, and a mis-grouped filter returns plausible
// entries rather than an error.
const filter = [
  `timestamp >= "${since}"`,
  "("
    + `(resource.type="cloud_run_revision" AND resource.labels.service_name="${service}")`
    + " OR "
    + `(resource.type="cloud_function" AND resource.labels.function_name="${FN}")`
    + ")",
  ALL ? "" : 'severity >= "WARNING"',
].filter(Boolean).join(" AND ");

const token = await accessToken();
const res = await fetch("https://logging.googleapis.com/v2/entries:list", {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({
    resourceNames: [`projects/${PROJECT}`],
    filter,
    orderBy: "timestamp desc",
    pageSize: LIMIT,
  }),
});
const body = await res.json();
if (!res.ok) {
  die(
    `logging.entries.list failed (${res.status}): ${body.error?.message || JSON.stringify(body)}\n`
    + "    403 here usually means the service account lacks roles/logging.viewer.",
  );
}

const entries = body.entries || [];
console.log(`fn-log: ${FN} — ${entries.length} entr(y/ies), last ${MINUTES}m, ${ALL ? "all severities" : "WARNING+"}`);
if (!entries.length) {
  console.log(
    "  Nothing. That is informative rather than empty: if the function had run\n"
    + "  and thrown, there would be an entry here. Consider whether the request\n"
    + "  reached it at all — a 500 with no runtime log points at the platform in\n"
    + "  front of the function rather than at its body.\n"
    + "  Re-run with --all-severities to see whether it logged anything at all.",
  );
}
// Oldest-first for reading, having fetched newest-first for correctness.
let all = "";
for (const e of entries.reverse()) {
  const msg = e.textPayload
    ?? e.jsonPayload?.message
    ?? (e.jsonPayload ? JSON.stringify(e.jsonPayload) : "")
    ?? "";
  all += `${msg}\n`;
  console.log(`  ${e.timestamp} [${e.severity || "DEFAULT"}] ${String(msg).slice(0, 2000)}`);
}

// Known errors that are unreadable as stack traces and one sentence as
// prose. Only add an entry here for something that has actually been hit —
// a guessed explanation attached to a real error is worse than none,
// because it stops the reader looking.
const KNOWN = [
  {
    match: /Metadata-Flavor|metadata service|metadata\.google\.internal/i,
    say:
      "The runtime could not get credentials from the GCE metadata server, so\n"
      + "  EVERY Google API call from this function fails — Firestore included.\n"
      + "  Nothing in this repo causes it: initializeApp() takes no arguments and\n"
      + "  correctly uses Application Default Credentials, and no VPC connector or\n"
      + "  explicit serviceAccount is configured.\n"
      + "\n"
      + "  It is the identity the function RUNS AS. Check that the service account\n"
      + "  on the Cloud Run service exists and is ENABLED:\n"
      + "    https://console.cloud.google.com/iam-admin/serviceaccounts?project=prvfire33\n"
      + "  A disabled or deleted service account still DEPLOYS cleanly — the\n"
      + "  reference is valid — and only fails when the runtime asks it for a\n"
      + "  token, which is why this surfaces as a 500 at call time rather than as\n"
      + "  a failed deploy.",
  },
];
for (const k of KNOWN) {
  if (k.match.test(all)) console.log(`\n  ── what this means ──\n  ${k.say}`);
}
