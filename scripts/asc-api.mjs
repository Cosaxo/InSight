// asc-api.mjs — one App Store Connect credential, one JWT, one test seam.
//
// WHY THIS IS A MODULE. asc-push.mjs has carried this exchange alone since
// the listing was first pushed, and asc-review.mjs is the second caller.
// google-api.mjs's header sets this repo's rule for the same situation on
// the Google side — "three copies is how they drift", quoting pure.ts —
// and normally a second copy would be tolerated until a third. This one is
// extracted at two, for a specific reason:
//
//   `dsaEncoding: "ieee-p1363"`.
//
// Node signs EC keys as DER by default, and every JWT verifier rejects DER
// with a signature error that reads like a wrong key — asc-push.mjs's own
// comment calls it "the single most confusing way to get ASC auth wrong".
// A second hand-written copy of this function has one plausible way to be
// subtly wrong, and the failure it produces sends the reader to Apple's
// key page instead of to this line. That is worth one extraction.
//
// asc-push.mjs is deliberately NOT migrated here, on the terms
// google-api.mjs sets for fn-log.mjs: it works, it is tested, and
// rewriting a working script to save duplication is the trade this repo
// declines everywhere else. It should adopt this the next time it is
// opened for another reason.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (the .p8 contents).

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ASC_API_BASE exists so a caller can be exercised against a stub. It has
// no account to run against in review and no way to be tried safely
// against a real one — the first live run is against the owner's listing —
// so the alternative to a seam is shipping the request shapes unverified.
// Unset in every real use.
export const API = () => process.env.ASC_API_BASE || "https://api.appstoreconnect.apple.com";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

/** The three credential values, or an operator-readable exit. */
export function ascCredentials(tag, keyFile = null) {
  const die = (m) => { console.error(`${tag}: ${m}`); process.exit(1); };
  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;
  const privateKey = keyFile
    ? readFileSync(resolve(keyFile), "utf8")
    : process.env.ASC_PRIVATE_KEY;
  if (!keyId || !issuerId || !privateKey) {
    die(
      "ASC_KEY_ID, ASC_ISSUER_ID and ASC_PRIVATE_KEY (or --key-file) are all\n"
      + "    required. They are the same three ios-release.yml uses;\n"
      + "    docs/IOS-RELEASE.md § 1 says where each comes from and why the\n"
      + "    key must be ADMIN role.",
    );
  }
  return { keyId, issuerId, privateKey };
}

/** A fresh ES256 bearer for App Store Connect. */
export function ascToken({ keyId, issuerId, privateKey }) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  // Apple rejects anything longer than 20 minutes. 10 is plenty and leaves
  // room for a slow request without re-minting mid-flight.
  const payload = { iss: issuerId, iat: now, exp: now + 600, aud: "appstoreconnect-v1" };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  // See the header: DER is Node's default and is what Apple rejects.
  const sig = createSign("SHA256")
    .update(signingInput)
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64u(sig)}`;
}

/**
 * A JSON request that THROWS with Apple's own error text.
 *
 * Not googleFetch's `{ ok, status }` shape, deliberately: that one exists
 * because a 403 from one Google API is a RESULT the run wants to report
 * beside the others. Here every failure is fatal to the step, and Apple's
 * `errors[]` array carries the field-level detail that says which
 * attribute it rejected — which is the only useful thing when a review
 * detail is refused.
 */
export function ascCall(creds) {
  return async function call(method, path, body) {
    const res = await fetch(path.startsWith("http") ? path : `${API()}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${ascToken(creds)}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text;
      try {
        detail = JSON.parse(text).errors
          ?.map((e) => `${e.title}: ${e.detail}`).join("\n    ") || text;
      } catch { /* non-JSON error body — show it raw */ }
      throw new Error(`${method} ${path} → ${res.status}\n    ${detail}`);
    }
    return text ? JSON.parse(text) : null;
  };
}

/**
 * The version a script may edit.
 *
 * Anything live or in review must not be touched by a script running
 * unattended, so the states are enumerated rather than excluded — a new
 * Apple state defaults to "do not edit" rather than to "edit".
 */
export const EDITABLE = new Set([
  "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
  "METADATA_REJECTED", "INVALID_BINARY",
]);
