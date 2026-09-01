// Upload an AAB to Google Play and assign it to a track.
//
//   node scripts/play-upload.mjs --aab path/to/app-release.aab --track internal
//
// Reads the service account from PLAY_SERVICE_ACCOUNT_JSON (the whole JSON
// key file, as a string).
//
// WHY THIS IS HAND-ROLLED. The obvious move is a marketplace action, and
// this repo's bar for those is visible in ci.yml: it declined even
// gradle/actions/setup-gradle for "one fewer third-party action to pin and
// audit", and every action it does use is actions/*. An upload step holds
// the one credential that can publish to real users, so it is the last
// place to widen that. Node 22 has fetch and node:crypto can sign an
// RS256 JWT, so the whole Play Developer API v3 flow is a hundred lines of
// builtins and no dependency at all.
//
// The flow, which is not obvious from the API docs' ordering:
//   1. sign a JWT with the service account key, exchange it for a token
//   2. open an EDIT — a transaction handle; nothing is live until commit
//   3. upload the bundle, which returns the versionCode Play read from it
//   4. point a track at that versionCode
//   5. commit the edit
// An edit that is never committed simply expires, so a failure in 3 or 4
// leaves nothing half-published. That is why every error path here just
// throws rather than trying to roll back.
//
// The pure helpers are exported and tested (scripts/play-upload.test.mjs).
// The network half is not: it needs an account this project does not have
// yet, which is stated plainly rather than papered over with a mock that
// would only assert this file's own shape back at it.
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";

export const PACKAGE = "com.cosaxo.insight";

/** Play's four tracks. `production` is the only one that reaches everybody. */
export const TRACKS = ["internal", "alpha", "beta", "production"];

export const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * The assertion Google exchanges for an access token. Exported because
 * every field here is a way to get a silent 400 back: a wrong `aud`, a
 * missing `scope`, or an `exp` more than an hour out all fail as
 * "invalid_grant" with nothing naming which.
 */
export function jwtClaims(clientEmail, nowSeconds) {
  return {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    // One hour is Google's maximum. Asking for more is rejected outright.
    exp: nowSeconds + 3600,
  };
}

/**
 * The track body. `status: "completed"` means the release is live on that
 * track at full rollout — which for `production` means every user, so the
 * workflow defaults to `internal` and makes production an explicit choice.
 */
export function trackBody(versionCode, releaseName) {
  return {
    releases: [{
      versionCodes: [String(versionCode)],
      status: "completed",
      ...(releaseName ? { name: releaseName } : {}),
    }],
  };
}

export function parseArgs(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const track = get("--track") ?? "internal";
  if (!TRACKS.includes(track)) {
    throw new Error(`unknown track "${track}" — expected one of ${TRACKS.join(", ")}`);
  }
  const aab = get("--aab");
  if (!aab) throw new Error("--aab <path> is required");
  return { aab, track, releaseName: get("--name") };
}

async function jsonOrThrow(res, what) {
  const text = await res.text();
  if (!res.ok) {
    // Play's errors are informative and the status alone is not, so the
    // body goes into the message. It carries no credential.
    throw new Error(`${what} failed: HTTP ${res.status}\n${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify(jwtClaims(sa.client_email, now)));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  return (await jsonOrThrow(res, "token exchange")).access_token;
}

async function main() {
  const { aab, track, releaseName } = parseArgs(process.argv.slice(2));

  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("PLAY_SERVICE_ACCOUNT_JSON is empty — see docs/PLAY-RELEASE.md §2.2.");
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("PLAY_SERVICE_ACCOUNT_JSON is not valid JSON — paste the whole key file.");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("PLAY_SERVICE_ACCOUNT_JSON has no client_email/private_key — wrong file?");
  }

  const bundle = readFileSync(aab);
  const token = await accessToken(sa);
  const auth = { authorization: `Bearer ${token}` };

  const edit = await jsonOrThrow(
    await fetch(`${API}/${PACKAGE}/edits`, { method: "POST", headers: auth }),
    "opening an edit",
  );
  console.log(`edit ${edit.id} open`);

  const uploaded = await jsonOrThrow(
    await fetch(`${UPLOAD}/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/octet-stream" },
      body: bundle,
    }),
    "uploading the bundle",
  );
  console.log(`uploaded versionCode ${uploaded.versionCode}`);

  await jsonOrThrow(
    await fetch(`${API}/${PACKAGE}/edits/${edit.id}/tracks/${track}`, {
      method: "PUT",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(trackBody(uploaded.versionCode, releaseName)),
    }),
    `assigning track ${track}`,
  );
  console.log(`track ${track} points at ${uploaded.versionCode}`);

  await jsonOrThrow(
    await fetch(`${API}/${PACKAGE}/edits/${edit.id}:commit`, { method: "POST", headers: auth }),
    "committing the edit",
  );
  console.log(`committed — versionCode ${uploaded.versionCode} is on ${track}`);
}

// Import-safe: the tests want the helpers above without opening an edit.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(`\nplay-upload: ${err.message}`);
    process.exit(1);
  });
}
