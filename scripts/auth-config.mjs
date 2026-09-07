// auth-config.mjs — the Firebase Authentication settings the account wall
// depends on, read and written from CI instead of from a console.
//
//   node scripts/auth-config.mjs                    # report, change nothing
//   node scripts/auth-config.mjs --sender-name --apply
//   node scripts/auth-config.mjs --demo-account --apply
//
// Dry run by default, like every other operator script here.
//
// WHY THIS EXISTS. D414 put the account wall up, and with it two things
// that live in Firebase Authentication rather than in this repo:
//
//   1. THE MAIL. A password account cannot reach the app until its
//      confirmation link is opened, so the verification template is now on
//      the critical path of the product's front door — and its sender name
//      defaults to the PROJECT ID. Runbook 5.16 says to fix that in the
//      console. This reads it first, because "it defaults to the project
//      id" was written from documentation rather than from the project,
//      and a runbook step justified by an unverified claim is how three
//      of check:policy-claims' assertions went stale (D183).
//
//   2. THE DEMO ACCOUNT. App Review needs credentials now that the app
//      requires an account (guideline 2.1), and the obvious way to make
//      one does not work: a user created in the Firebase console has
//      `emailVerified: false`, so the wall holds Apple's reviewer exactly
//      where it holds everyone else, and the console exposes no toggle for
//      that flag. Only the Admin SDK can set it. That left "install the
//      build, create an account on an address you can read, open the
//      link" as the owner's job — a phone, an inbox and ten minutes for
//      something a credential can do in one call.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not write the subject or body
// of either mail. Those are copy, and copy in this repo goes through
// docs/COPY.md and a review, not through a flag on an operator script.
// The sender NAME is a different thing: it is the project's identity,
// which the repo already owns in a dozen places.
//
// Auth: FIREBASE_SERVICE_ACCOUNT, the same secret firebase-deploy.yml and
// seed-content.mjs use. The template half goes through the Identity
// Toolkit Admin API rather than the Admin SDK, which has no binding for
// it; the token comes from the same service account.

import { writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
// The fourth caller of the shared exchange rather than a fifth copy of it
// — google-api.mjs's own header names the rule ("three copies is how they
// drift") and the two scripts that predate it. It also brings the
// GOOGLE_API_BASE test seam, which is what lets this file be tested
// without a credential or the internet.
import { api, serviceAccount, accessToken, googleFetch } from "./google-api.mjs";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const APPLY = has("--apply");

// The name the mail comes from. Not a flag value: a build that could be
// told to send mail as anything is a build that can be told to send mail
// as somebody else.
const SENDER_NAME = "InSight";

// The reviewer's address. On the app's own domain rather than a personal
// inbox, and fixed rather than generated, so a second run REUSES the
// account instead of littering the user table with review accounts.
const DEMO_EMAIL = process.env.DEMO_ACCOUNT_EMAIL || "appreview@prvfire33.web.app";

function die(msg) { console.error(`auth-config: ${msg}`); process.exit(1); }

const sa = serviceAccount("auth-config");

// LAZY, and the test is what found the reason. Initialising the Admin SDK
// at module load made the two CONFIG paths — which touch no Auth API at
// all — depend on the service-account JSON carrying `project_id`, a field
// the Identity Toolkit exchange never reads. A report that cannot run
// without a credential it does not use is a report nobody runs.
let ADMIN = null;
function adminAuthHandle() {
  if (!ADMIN) {
    initializeApp({ credential: cert(sa), projectId: PROJECT });
    ADMIN = getAuth();
  }
  return ADMIN;
}

const CONFIG_PATH = `/admin/v2/projects/${PROJECT}/config`;
const HOST = "identitytoolkit.googleapis.com";

let TOKEN = null;
const token = async () => (TOKEN ??= await accessToken(sa, "auth-config"));

async function readConfig() {
  const r = await googleFetch(api(HOST, CONFIG_PATH), await token());
  if (!r.ok) {
    // Named rather than swallowed, and the role is named with it: the
    // likely cause is the service account lacking
    // firebaseauth.configs.getConfig, and "it printed nothing" would send
    // the reader looking at the templates instead of at IAM.
    die(`reading the auth config failed (${r.status}). ${r.message}\n`
      + "    If this is 403, the deploy service account needs the Firebase\n"
      + "    Authentication Admin role (roles/firebaseauth.admin).");
  }
  return r.body;
}

async function patchConfig(patch, mask) {
  const url = `${api(HOST, CONFIG_PATH)}?updateMask=${encodeURIComponent(mask)}`;
  const r = await googleFetch(url, await token(), { method: "PATCH", body: patch });
  if (!r.ok) die(`writing the auth config failed (${r.status}). ${r.message}`);
  return r.body;
}

// A password nobody chose and nobody has to remember. Generated per run
// rather than committed for the reason any credential in a repo is wrong,
// and long enough that its being visible to App Review costs nothing.
function newPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function reportTemplates() {
  const cfg = await readConfig();
  const send = cfg.notification?.sendEmail || {};
  const rows = [
    ["method", send.method || "(default: Firebase sends it)"],
    ["sender local part", send.senderLocalPart || "(default: noreply)"],
    ["sender DISPLAY NAME", send.senderDisplayName || "(unset)"],
    ["reply-to", send.replyTo || "(unset)"],
    ["verification subject", send.verifyEmail?.subject || "(Firebase default)"],
    ["reset subject", send.resetPasswordTemplate?.subject || "(Firebase default)"],
  ];
  console.log("\nFirebase Authentication — the mail the wall depends on\n");
  for (const [k, v] of rows) console.log(`  ${k.padEnd(22)} ${v}`);

  const name = send.senderDisplayName;
  console.log("");
  if (name === SENDER_NAME) {
    console.log(`  ✓ the sender name is already "${SENDER_NAME}" — 5.16's first half is done.`);
  } else if (!name) {
    // The claim runbook 5.16 was written on, now measured. Firebase shows
    // the project id in the console when this field is empty, and that is
    // what a recipient sees.
    console.log(`  ! senderDisplayName is UNSET, so the mail arrives from the project id`);
    console.log(`    ("${PROJECT}"), which reads as phishing for an app called InSight.`);
    console.log(`    Fix: node scripts/auth-config.mjs --sender-name --apply`);
  } else {
    console.log(`  ! senderDisplayName is "${name}", not "${SENDER_NAME}".`);
  }
  return cfg;
}

async function setSenderName() {
  const cfg = await readConfig();
  const current = cfg.notification?.sendEmail?.senderDisplayName || "";
  if (current === SENDER_NAME) {
    console.log(`sender name already "${SENDER_NAME}" — nothing to write.`);
    return;
  }
  console.log(`sender name: "${current || "(unset)"}"  →  "${SENDER_NAME}"`);
  if (!APPLY) { console.log("(dry run — pass --apply to write it)"); return; }
  // The narrowest mask that does the job. A broader one would send back
  // whatever this process happened to hold for every other notification
  // field, which on a partial read is how a config gets flattened.
  await patchConfig(
    { notification: { sendEmail: { senderDisplayName: SENDER_NAME } } },
    "notification.sendEmail.senderDisplayName",
  );
  console.log("written.");
}

async function demoAccount() {
  const auth = adminAuthHandle();
  const password = newPassword();
  let existing = null;
  try { existing = await auth.getUserByEmail(DEMO_EMAIL); } catch { /* not there yet */ }

  console.log(`\nApp Review demo account: ${DEMO_EMAIL}`);
  console.log(existing
    ? `  exists (uid ${existing.uid}, emailVerified ${existing.emailVerified}) — password will be reset`
    : "  does not exist — will be created");
  console.log("  emailVerified will be TRUE, which is the whole point: the wall reads");
  console.log("  `linked && !needsEmailVerify`, and a console-made user fails the second.");

  if (!APPLY) { console.log("\n(dry run — pass --apply to create it)"); return; }

  const user = existing
    ? await auth.updateUser(existing.uid, { password, emailVerified: true, disabled: false })
    : await auth.createUser({ email: DEMO_EMAIL, password, emailVerified: true });

  console.log(`\ncreated/updated uid ${user.uid}, emailVerified ${user.emailVerified}`);

  // The credentials go to a FILE, not to stdout. A workflow log is
  // readable by every collaborator and kept for months; App Store Connect
  // is where these belong and the next step reads them from here.
  const out = process.env.DEMO_ACCOUNT_OUT;
  if (out) {
    writeFileSync(out, JSON.stringify({ email: DEMO_EMAIL, password }, null, 2));
    console.log(`credentials written to ${out} (not echoed — a run log is not a vault)`);
  } else {
    console.log("\nDEMO_ACCOUNT_OUT is unset, so the credential has nowhere private");
    console.log("to go. Set it to a path and re-run; nothing is printed here on purpose.");
  }
}

const wantsSender = has("--sender-name");
const wantsDemo = has("--demo-account");

if (!wantsSender && !wantsDemo) {
  await reportTemplates();
} else {
  await reportTemplates();
  if (wantsSender) await setSenderName();
  if (wantsDemo) await demoAccount();
}
