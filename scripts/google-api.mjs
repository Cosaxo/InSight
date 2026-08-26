#!/usr/bin/env node
// google-api.mjs — one credential, one OAuth token, one test seam, for the
// scripts that talk to Google's own APIs rather than to a Firebase callable.
//
// WHY THIS IS A MODULE, and why it is a SECOND one. operator-call.mjs is
// the canonical caller for *callables*: it mints a Firebase custom token,
// trades it for an ID token, and POSTs to cloudfunctions.net. That is a
// different exchange from this one, which mints a JWT-bearer assertion and
// trades it for an OAuth2 access token scoped to cloud-platform, for the
// Monitoring, Logging, Cloud Functions and Billing APIs. Sharing a file
// between them would share a comment header and nothing else.
//
// What IS shared is that this dance was already written twice against
// Google's own APIs — fn-log.mjs since 2026-08-07, observe.mjs since D300
// — and
// apply-monitoring is the third caller. pure.ts's rule about breakdownFor
// applies to scripts as much as to functions: "three copies is how they
// drift." fn-log.mjs is deliberately NOT migrated here, on the same terms
// operator-call.mjs sets for the two that predate it: it works, and
// rewriting a working script to save duplication is the trade this repo
// declines everywhere else. It should adopt this the next time it is
// opened for another reason.
//
// Env: FIREBASE_SERVICE_ACCOUNT (the deploy service-account JSON, contents)

import { createSign } from "node:crypto";

// TEST SEAM. When set, every Google host is served from one stub instead:
// `https://monitoring.googleapis.com` becomes
// `${GOOGLE_API_BASE}/monitoring.googleapis.com`. Unset in every real run,
// so production always talks to the real hosts.
//
// Read per call rather than captured at import: a test that sets the
// variable after importing this module would otherwise silently reach the
// real internet, which is the one failure a seam must not have.
export const api = (host, path) => {
  const base = process.env.GOOGLE_API_BASE || "";
  return base ? `${base}/${host}${path}` : `https://${host}${path}`;
};

const tokenUrl = () => api("oauth2.googleapis.com", "/token");

/** Parse and validate the service-account JSON, or exit with an
 *  operator-readable reason. Every failure here is a missing secret and the
 *  fix is a settings page, so a stack trace would be noise. */
export function serviceAccount(tag) {
  const die = (m) => { console.error(`${tag}: ${m}`); process.exit(1); };
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) die("FIREBASE_SERVICE_ACCOUNT is empty — the same secret firebase-deploy.yml uses.");
  let sa;
  try { sa = JSON.parse(raw); } catch { die("FIREBASE_SERVICE_ACCOUNT is not valid JSON."); }
  if (!sa.private_key || !sa.client_email) die("the service-account JSON has no private_key/client_email.");
  return sa;
}

const b64u = (b) => Buffer.from(b).toString("base64url");

/** RS256 JWT-bearer assertion traded for an OAuth2 access token.
 *
 *  cloud-platform rather than a per-API scope, deliberately. The SCOPE says
 *  what the token is allowed to ask for; the service account's IAM ROLES
 *  say what it is allowed to get. Narrowing the scope here would only turn
 *  a legible 403-with-a-role-name into an opaque invalid_scope — and for
 *  both callers, finding out which roles are missing is the point. */
export async function accessToken(sa, tag = "google-api") {
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
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  // TEXT THEN PARSE, not res.json() — D295's defect, and it was carried into
  // this file verbatim from observe.mjs before the review caught it. A
  // non-JSON token response (an HTML 502 from Google's front end, or the
  // 403 body this repo's own agent proxy returns) makes res.json() reject
  // BEFORE the !res.ok branch below can run, so the operator gets
  // `Unexpected token '<'` naming neither the status nor the URL — and the
  // message that names both is unreachable. googleFetch 25 lines down was
  // already written this way; this function is the one that did not get it,
  // in the file whose stated purpose is to be the single correct copy.
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* an HTML error page is the platform, not the API */ }
  if (!body) {
    const head = text.replace(/\s+/g, " ").trim().slice(0, 160);
    console.error(`${tag}: token exchange returned ${res.status} ${res.statusText} with a non-JSON body.\n    ${head || "(empty)"}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`${tag}: token exchange failed (${res.status}): ${body.error_description || JSON.stringify(body)}`);
    process.exit(1);
  }
  return body.access_token;
}

/** A JSON request with the operator-readable failure shape both callers
 *  want: `{ ok, status, body, message }` rather than a throw, because a 403
 *  from one API is a RESULT — the reading that says which role is missing —
 *  and must not take the run down before the others have answered. */
export async function googleFetch(url, token, { method = "GET", body } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* an HTML error page is the platform, not the API */ }
    return {
      ok: res.ok,
      status: res.status,
      body: parsed ?? {},
      message: parsed?.error?.message || text.replace(/\s+/g, " ").trim().slice(0, 160),
    };
  } catch (err) {
    return { ok: false, status: 0, body: {}, message: String(err).slice(0, 160) };
  }
}
