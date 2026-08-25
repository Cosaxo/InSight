// operator-call.mjs — call an operator callable from a terminal.
//
// WHY THIS IS A MODULE. `seed-content.mjs` explains at length why an
// operator callable needs a caller at all: SHIP-CHECKLIST said to run these
// from "the app's browser console", and there is no such console — the app
// ships only as a native shell. What it does NOT explain is why the
// mint-a-custom-token / trade-it-for-an-ID-token / POST-the-callable dance
// should be written out again for every instrument that needs it. It was
// already written twice (seed-content.mjs, fn-log.mjs) before this file,
// and pure.ts's own rule about `breakdownFor` applies to scripts too:
// "three copies is how they drift."
//
// This is the third caller's home, and the canonical one. The two that
// predate it are deliberately NOT migrated here — both work, one has its
// own test (seed-content.test.mjs), and rewriting a working deploy-path
// script to save duplication is the trade this repo declines everywhere
// else. They should adopt it the next time either is opened for another
// reason.
//
// Env (identical to seed-content.mjs, on purpose — one credential set):
//   FIREBASE_SERVICE_ACCOUNT   the deploy service-account JSON (contents)
//   SEED_ADMIN_UIDS            comma-separated; the FIRST is used
//   VITE_FIREBASE_API_KEY      the web API key, for the token exchange
//   FIREBASE_PROJECT_ID        defaults to prvfire33

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const b64u = (b) => Buffer.from(b).toString("base64url");

/** Resolve credentials and the region. Throws with an operator-readable
 *  reason rather than a stack: every failure here is a missing secret, and
 *  the fix is a console page rather than a code change. */
export function operatorContext(tag = "operator-call") {
  const die = (msg) => {
    const e = new Error(`${tag}: ${msg}`);
    e.operator = true;
    throw e;
  };

  const project = process.env.FIREBASE_PROJECT_ID || "prvfire33";
  // READ, not retyped (D201/D200) — a wrong region is a 404 from a URL that
  // looks entirely plausible. Bare node, so the constant is scanned out of
  // its source rather than imported, and a rename throws here.
  const src = readFileSync(new URL("../src/lib/region.ts", import.meta.url), "utf8");
  const m = src.match(/export const FUNCTIONS_REGION = "([^"]+)"/);
  if (!m) die("could not read FUNCTIONS_REGION from src/lib/region.ts");
  const region = m[1];

  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
  const uids = (process.env.SEED_ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!rawSa) die("FIREBASE_SERVICE_ACCOUNT is empty — the same secret firebase-deploy.yml uses.");
  if (!apiKey) die("VITE_FIREBASE_API_KEY is empty — it is a repository VARIABLE (docs/IOS-RELEASE.md § 2).");
  if (!uids.length) {
    die(
      "SEED_ADMIN_UIDS is empty.\n"
      + "    GitHub → Settings → Environments → production → Variables. Without it\n"
      + "    the callable answers permission-denied no matter who calls it.",
    );
  }
  let sa;
  try { sa = JSON.parse(rawSa); } catch { die("FIREBASE_SERVICE_ACCOUNT is not valid JSON."); }
  if (!sa.private_key || !sa.client_email) die("the service-account JSON has no private_key/client_email.");

  return { project, region, apiKey, sa, uid: uids[0], die };
}

/** RS256 custom token, signed locally with the key in the JSON — no IAM
 *  round trip, so this needs no serviceAccountTokenCreator role. `aud` is
 *  the fixed identitytoolkit audience; getting it wrong returns
 *  INVALID_CUSTOM_TOKEN, which reads like a bad signature. */
function customToken(sa, uid) {
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

async function idToken(ctx) {
  const base = process.env.SEED_IDENTITY_BASE || "https://identitytoolkit.googleapis.com";
  const res = await fetch(`${base}/v1/accounts:signInWithCustomToken?key=${ctx.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken(ctx.sa, ctx.uid), returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    ctx.die(
      `custom-token exchange failed (${res.status}): ${body.error?.message || JSON.stringify(body)}\n`
      + "    ACCOUNT_DISABLED or USER_NOT_FOUND means SEED_ADMIN_UIDS names a uid\n"
      + "    that does not exist in this project's Auth — check it is the\n"
      + "    Google-account uid rather than an anonymous one.",
    );
  }
  return body.idToken;
}

/** Call one callable as the operator, and return its `result`. */
export async function callOperator(ctx, name, data) {
  const base = process.env.SEED_FUNCTIONS_BASE
    || `https://${ctx.region}-${ctx.project}.cloudfunctions.net`;
  const token = await idToken(ctx);
  const res = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    const e = body.error || {};
    // A bare INTERNAL means the function threw something that was not an
    // HttpsError, so Firebase discarded the detail before it left the
    // server. Say so rather than letting "INTERNAL INTERNAL" read like a
    // description — seed-content.mjs's finding, kept.
    const opaque = (e.status || e.message) === "INTERNAL";
    ctx.die(
      `${name} failed (${res.status}): ${e.status || ""} ${e.message || JSON.stringify(body)}`
      + (opaque ? "\n    INTERNAL with no detail means the function threw a non-HttpsError —\n    the reason is in the Cloud Run log, not in this response." : ""),
    );
  }
  return body.result;
}
