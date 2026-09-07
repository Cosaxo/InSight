// asc-review.mjs — App Review Information, and the build it applies to.
//
//   node scripts/asc-review.mjs                       # report, change nothing
//   node scripts/asc-review.mjs --apply
//   node scripts/asc-review.mjs --attach-build 33 --apply
//
// Dry run by default, like asc-push.mjs.
//
// WHY THIS EXISTS. D414 made an account mandatory, and that turns a form
// nobody had filled in into a submission blocker: guideline 2.1 refuses a
// review that cannot get past a sign-in screen, and "Sign-in required" had
// been NO for every build up to 32 because it was true. A reviewer meeting
// the wall with that box unticked files "we were unable to review" without
// reading further — a full round trip spent on a checkbox.
//
// WHAT IT WRITES. The four contact fields, the demo account, and the
// notes. Nothing else on the version.
//
// WHAT IT DOES NOT DO: submit. That stays a deliberate act, and this
// script's --apply is not it — asc-push.mjs's header sets the same line
// ("submitting for review — irreversible and outward-facing, and it
// should cost a deliberate human click"), and D414's owner asked to be
// shown what Apple would see before it is sent. `--attach-build` is as
// far as this goes, and attaching is reversible.
//
// THE DEMO ACCOUNT'S PASSWORD comes from a FILE, never a flag: an argument
// is visible in `ps` and in a workflow's own log, and this credential is
// minted by scripts/auth-config.mjs in the same job precisely so it never
// has to be seen. Pass --demo-file with the path that wrote.
//
// Auth: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY — the same three
// ios-release.yml uses.

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ascCredentials, ascCall, EDITABLE } from "./asc-api.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const DEMO_FILE = argOf("--demo-file");
const ATTACH = argOf("--attach-build");

const listing = JSON.parse(readFileSync(join(root, "design/store/listing.json"), "utf8"));
const BUNDLE_ID = listing.shared.bundleId;
const review = listing.shared.appReview;
if (!review) {
  console.error(
    "asc-review: design/store/listing.json has no shared.appReview block.\n"
    + "    The four contact fields Apple requires live there, in the repo,\n"
    + "    for the reason every other listing field does: a diff is a better\n"
    + "    review surface than a web form, and a value nobody can see is a\n"
    + "    value nobody can check.",
  );
  process.exit(1);
}

const call = ascCall(ascCredentials("asc-review", argOf("--key-file")));

// ── the app and the version this applies to ─────────────────────────
const apps = await call("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
const app = apps.data?.[0];
if (!app) {
  console.error(`asc-review: no app with bundle id ${BUNDLE_ID} in this account.`);
  process.exit(1);
}

const versions = await call("GET", `/v1/apps/${app.id}/appStoreVersions?limit=10`);
const version = versions.data?.find((v) => EDITABLE.has(v.attributes.appStoreState));
if (!version) {
  const states = versions.data?.map((v) => v.attributes.appStoreState).join(", ") || "none";
  console.error(
    `asc-review: no editable version. States found: ${states}.\n`
    + "    A version that is live or already in review must not be edited by\n"
    + "    a script — create the next version in App Store Connect first.",
  );
  process.exit(1);
}
console.log(`app ${app.attributes.name} · version ${version.attributes.versionString} `
  + `(${version.attributes.appStoreState})`);

// ── the demo account ────────────────────────────────────────────────
let demo = null;
if (DEMO_FILE) {
  const d = JSON.parse(readFileSync(resolve(DEMO_FILE), "utf8"));
  if (!d.email || !d.password) {
    console.error(`asc-review: ${DEMO_FILE} carries no email/password pair.`);
    process.exit(1);
  }
  demo = d;
}

// ── what the form will say ──────────────────────────────────────────
//
// `demoAccountRequired` is the field that matters most and the one that
// was silently wrong: it was false for every build before 33, truthfully,
// and D414 made it a lie. Set from the WALL rather than from whether a
// demo account happens to be passed, so forgetting the file cannot quietly
// tell Apple the app opens without a sign-in.
const attrs = {
  contactFirstName: review.contactFirstName,
  contactLastName: review.contactLastName,
  contactPhone: review.contactPhone,
  contactEmail: review.contactEmail,
  demoAccountRequired: true,
  notes: review.notes,
  ...(demo ? { demoAccountName: demo.email, demoAccountPassword: demo.password } : {}),
};

console.log("\nApp Review Information");
for (const [k, v] of Object.entries(attrs)) {
  // The password is the one value that must not reach a log. Everything
  // else is exactly what Apple will see, printed so a dry run is a review
  // rather than a promise.
  const shown = k === "demoAccountPassword" ? `(${String(v).length} characters, not printed)` : v;
  console.log(`  ${k.padEnd(20)} ${typeof shown === "string" ? shown.split("\n")[0].slice(0, 90) : shown}`);
}
if (!demo) {
  console.log("\n  ! No --demo-file, so the credentials are NOT being set.");
  console.log("    demoAccountRequired stays true, which is honest and incomplete:");
  console.log("    Apple will ask for an account. Run auth-config.yml first.");
}

// ── the build ───────────────────────────────────────────────────────
let buildId = null;
if (ATTACH) {
  const builds = await call(
    "GET",
    `/v1/builds?filter[app]=${app.id}&filter[version]=${encodeURIComponent(ATTACH)}&limit=1`,
  );
  const b = builds.data?.[0];
  if (!b) {
    console.error(
      `\nasc-review: no build ${ATTACH} in App Store Connect for this app.\n`
      + "    An uploaded build is not visible until Apple finishes PROCESSING\n"
      + "    it, which takes ten minutes to an hour. This is the expected\n"
      + "    answer straight after a release run, not a failure to fix.",
    );
    process.exit(1);
  }
  buildId = b.id;
  console.log(`\nbuild ${ATTACH} → ${b.attributes.processingState} (${b.id})`);
  if (b.attributes.processingState !== "VALID") {
    console.error(
      "    Not VALID yet, so it cannot be attached. Wait for processing.",
    );
    process.exit(1);
  }
}

if (!APPLY) {
  console.log("\n(dry run — pass --apply to write it)");
  process.exit(0);
}

// ── write ───────────────────────────────────────────────────────────
//
// The review detail is a one-to-one child of the version and may or may
// not exist yet, so this is a create-or-update rather than a PATCH: on a
// version that has never been submitted there is nothing to PATCH, and
// POSTing over an existing one is a 409.
const existing = await call(
  "GET", `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`,
).catch(() => null);

if (existing?.data?.id) {
  await call("PATCH", `/v1/appStoreReviewDetails/${existing.data.id}`, {
    data: { type: "appStoreReviewDetails", id: existing.data.id, attributes: attrs },
  });
  console.log("\nreview details updated.");
} else {
  await call("POST", "/v1/appStoreReviewDetails", {
    data: {
      type: "appStoreReviewDetails",
      attributes: attrs,
      relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } },
    },
  });
  console.log("\nreview details created.");
}

if (buildId) {
  await call("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, {
    data: { type: "builds", id: buildId },
  });
  console.log(`build ${ATTACH} attached to version ${version.attributes.versionString}.`);
}

console.log("\nNOT submitted. Submission is a separate, deliberate act —");
console.log("see this script's header and D414.");
