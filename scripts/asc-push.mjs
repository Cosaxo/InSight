#!/usr/bin/env node
// asc-push.mjs — push design/store/listing.json to App Store Connect.
//
//   node scripts/asc-push.mjs                 # report the diff, change nothing
//   node scripts/asc-push.mjs --apply         # write it
//   node scripts/asc-push.mjs --screenshots   # read-only: what image sets exist
//
// WHY THIS EXISTS. listing.json is already the reviewed copy, already held
// against both stores' character limits by check-store-listing.mjs, and
// already the single source for the screenshot captions. Retyping it into
// a web form is an hour that also introduces the one failure that file was
// created to prevent: the store saying something the repo does not.
//
// SCOPE, deliberately narrow. Text only. It does NOT upload screenshots —
// see --screenshots below for why that is a report rather than a push.
// It does not touch pricing, availability, the privacy questionnaire or
// the age rating: those are attestations, and a script that fills in an
// attestation is a script that answers a legal question on your behalf.
// docs/STORE-FORMS.md is the transcribe-by-hand answer for those, on
// purpose.
//
// Dry run by default. --apply is required to write anything.
//
// Auth: the same App Store Connect API key the release workflow uses
// (docs/IOS-RELEASE.md). Either export them:
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY   (the .p8 contents)
// or pass --key-file path/to/AuthKey_XXXX.p8 with the two ids as env vars.
//
// Node stdlib only: the JWT is ES256, which node:crypto signs directly as
// long as the signature is asked for in the JOSE format rather than DER —
// see sign() below, which is the one non-obvious line in this file.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createSign } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const SCREENSHOTS = argv.includes("--screenshots");
const LOCALE = argOf("--locale") || "en-US";

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_FILE = argOf("--key-file");
const PRIVATE_KEY = KEY_FILE
  ? readFileSync(resolve(KEY_FILE), "utf8")
  : process.env.ASC_PRIVATE_KEY;

if (!KEY_ID || !ISSUER_ID || !PRIVATE_KEY) {
  console.error(
    "asc-push: needs ASC_KEY_ID, ASC_ISSUER_ID and the private key.\n"
    + "    export ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_PRIVATE_KEY=\"$(cat AuthKey_XXXX.p8)\"\n"
    + "    or pass --key-file path/to/AuthKey_XXXX.p8\n"
    + "    docs/IOS-RELEASE.md § 1 says where the key comes from.",
  );
  process.exit(1);
}

const listing = JSON.parse(readFileSync(join(root, "design/store/listing.json"), "utf8"));
const BUNDLE_ID = listing.shared.bundleId;

// ── auth ────────────────────────────────────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64url");

function token() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  // Apple rejects anything longer than 20 minutes. 10 is plenty and
  // leaves room for a slow upload without re-minting mid-request.
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  // dsaEncoding: "ieee-p1363" is the whole trick. Node's default for EC is
  // DER, which JWT verifiers reject with a signature error that reads like
  // a wrong key — the single most confusing way to get ASC auth wrong.
  const sig = createSign("SHA256")
    .update(signingInput)
    .sign({ key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64u(sig)}`;
}

const API = "https://api.appstoreconnect.apple.com";

async function call(method, path, body) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token()}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text).errors?.map((e) => `${e.title}: ${e.detail}`).join("\n    ") || text;
    } catch { /* non-JSON error body — show it raw */ }
    throw new Error(`${method} ${path} → ${res.status}\n    ${detail}`);
  }
  return text ? JSON.parse(text) : null;
}

// ── locate the app and the editable version ─────────────────────────
const apps = await call("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
const app = apps.data?.[0];
if (!app) {
  console.error(
    `asc-push: no app with bundle id ${BUNDLE_ID} in this account.\n`
    + "    The App Store Connect app record has to exist first — this script\n"
    + "    fills a record in, it does not create one.",
  );
  process.exit(1);
}
console.log(`asc-push: ${app.attributes.name} (${BUNDLE_ID})${APPLY ? "" : "   [DRY RUN]"}`);

if (SCREENSHOTS) {
  // Read-only on purpose. The upload flow is a four-step reserve / PUT /
  // checksum / commit dance keyed on a display-type enum whose members
  // change when Apple ships new hardware — exactly the kind of thing that
  // should not be guessed at from a machine with no account to test
  // against. Uploading six images by hand is ten minutes; getting this
  // wrong silently is worse. So: report what the API says, and let a human
  // drag the files.
  const versions = await call("GET", `/v1/apps/${app.id}/appStoreVersions?limit=1`);
  const version = versions.data?.[0];
  if (!version) { console.log("  no app store version yet"); process.exit(0); }
  const locs = await call("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  for (const loc of locs.data) {
    const sets = await call("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
    console.log(`  ${loc.attributes.locale}: ${sets.data.length} screenshot set(s)`);
    for (const s of sets.data) {
      const shots = await call("GET", `/v1/appScreenshotSets/${s.id}/appScreenshots`);
      console.log(`    ${s.attributes.screenshotDisplayType}: ${shots.data.length} image(s)`);
    }
  }
  const dir = join(root, "design/store/screenshots/iphone-6.9");
  const local = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : [];
  console.log(`\n  locally: ${local.length} capture(s) in design/store/screenshots/iphone-6.9/`);
  console.log("  Upload these by hand — see the note in this script's source for why.");
  process.exit(0);
}

// The editable version is the one not yet released. Anything in a live or
// in-review state must not be edited by a script running unattended.
const EDITABLE = new Set([
  "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
  "METADATA_REJECTED", "INVALID_BINARY",
]);
const versions = await call("GET", `/v1/apps/${app.id}/appStoreVersions?limit=10`);
const version = versions.data?.find((v) => EDITABLE.has(v.attributes.appStoreState));
if (!version) {
  console.error(
    "asc-push: no editable App Store version.\n"
    + `    States found: ${versions.data.map((v) => v.attributes.appStoreState).join(", ") || "none"}\n`
    + "    Create a new version in App Store Connect first. This script will not\n"
    + "    edit one that is live or in review.",
  );
  process.exit(1);
}

// ── the two places the text lives ───────────────────────────────────
// Apple splits it: name/subtitle/privacy URL belong to the APP (they
// survive versions), while description/keywords/what's-new belong to the
// VERSION. Sending a field to the wrong one is a 409 that reads like a
// permissions problem.
const infos = await call("GET", `/v1/apps/${app.id}/appInfos`);
const info = infos.data[0];
const infoLocs = await call("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`);
const infoLoc = infoLocs.data.find((l) => l.attributes.locale === LOCALE);

const verLocs = await call("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
const verLoc = verLocs.data.find((l) => l.attributes.locale === LOCALE);

if (!infoLoc || !verLoc) {
  console.error(`asc-push: no ${LOCALE} localization. Add it in App Store Connect, or pass --locale.`);
  process.exit(1);
}

const a = listing.apple;
const s = listing.shared;

const plan = [
  { id: infoLoc.id, kind: "appInfoLocalizations", label: "app info", fields: {
    name: a.name,
    subtitle: a.subtitle,
    privacyPolicyUrl: s.privacyPolicyUrl,
  } },
  { id: verLoc.id, kind: "appStoreVersionLocalizations", label: "version", fields: {
    description: a.description,
    keywords: a.keywords,
    promotionalText: a.promotionalText,
    whatsNew: a.whatsNew,
    supportUrl: s.supportUrl,
    marketingUrl: s.supportUrl,
  } },
];

let changes = 0;
for (const group of plan) {
  const current = group.kind === "appInfoLocalizations" ? infoLoc.attributes : verLoc.attributes;
  const diff = {};
  for (const [k, v] of Object.entries(group.fields)) {
    if ((current[k] ?? "") !== v) diff[k] = v;
  }
  const keys = Object.keys(diff);
  if (!keys.length) { console.log(`  = ${group.label}: already matches listing.json`); continue; }
  changes += keys.length;
  for (const k of keys) {
    const was = current[k] ?? "";
    const short = (t) => (t.length > 60 ? `${t.slice(0, 57)}…` : t).replace(/\n/g, "⏎");
    console.log(`  ${APPLY ? "✓" : "+"} ${group.label}.${k}: "${short(was)}" → "${short(diff[k])}"`);
  }
  if (APPLY) {
    await call("PATCH", `/v1/${group.kind}/${group.id}`, {
      data: { type: group.kind, id: group.id, attributes: diff },
    });
  }
}

console.log(
  !changes
    ? "\nasc-push: nothing to do — App Store Connect already matches listing.json."
    : APPLY
      ? `\nasc-push: ${changes} field(s) updated. Screenshots, the privacy questionnaire and the age rating are still yours (docs/STORE-FORMS.md).`
      : `\nasc-push: ${changes} field(s) would change. Re-run with --apply.`,
);
