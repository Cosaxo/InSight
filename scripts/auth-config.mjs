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
import { dirname } from "node:path";
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
const SENDER_NAME = "Doxa";

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

// THE SENDER NAME IS PER TEMPLATE, NOT PER PROJECT — and the first
// version of this file had it wrong in both directions, which is worth
// keeping rather than quietly correcting.
//
// It read `notification.sendEmail.senderDisplayName` and reported the
// field as "(unset)". That was not a reading of the project: the field
// does not EXIST at that path, so the read was `undefined` and the code
// could not tell "nobody set it" from "I asked the wrong question". It
// then tried to write there and Apple's opposite number said so plainly:
//
//   400 — Unknown name "senderDisplayName" at 'config.notification.
//   send_email': Cannot find field.
//
// In the Identity Platform Admin API `sendEmail` carries the METHOD and
// the SMTP settings; `senderDisplayName`, `senderLocalPart`, `replyTo`,
// `subject` and `body` live on each EmailTemplate under it. So there is
// no single sender name — there is one per mail, and the wall depends on
// two of them.
//
// The lesson is the one CLAUDE.md states: verify rather than assume, and
// say which it was. A report that prints "(unset)" for a path that does
// not exist is a report that cannot fail, which is worse than no report.
const TEMPLATES = [
  ["verifyEmailTemplate", "verification"],
  ["resetPasswordTemplate", "password reset"],
];

async function reportTemplates() {
  const cfg = await readConfig();
  const send = cfg.notification?.sendEmail || {};
  console.log("\nFirebase Authentication — the mail the wall depends on\n");
  console.log(`  delivery method        ${send.method || "(default: Firebase sends it)"}`);

  const names = [];
  for (const [key, label] of TEMPLATES) {
    const t = send[key];
    // A template Firebase has never been asked about is absent entirely,
    // which is a different fact from one that exists with empty fields —
    // and the difference is exactly what the old code could not see.
    if (!t) {
      console.log(`\n  ${label}: no template stored — Firebase's own default, in every field.`);
      names.push(null);
      continue;
    }
    console.log(`\n  ${label}:`);
    console.log(`    sender display name  ${t.senderDisplayName || "(unset)"}`);
    console.log(`    sender local part    ${t.senderLocalPart || "(default: noreply)"}`);
    console.log(`    reply-to             ${t.replyTo || "(unset)"}`);
    console.log(`    subject              ${t.subject || "(Firebase default)"}`);
    console.log(`    customized           ${t.customized ? "yes" : "no"}`);
    names.push(t.senderDisplayName || null);
  }

  console.log("");
  if (names.every((n) => n === SENDER_NAME)) {
    console.log(`  ✓ both mails send as "${SENDER_NAME}" — 5.16's first half is done.`);
  } else {
    console.log(`  ! at least one mail does not send as "${SENDER_NAME}", so it arrives`);
    console.log(`    from the project id ("${PROJECT}"), which reads as phishing for`);
    console.log(`    an app called Doxa.`);
    console.log(`    Fix: node scripts/auth-config.mjs --sender-name --apply`);
  }
  return cfg;
}

async function setSenderName() {
  const cfg = await readConfig();
  const send = cfg.notification?.sendEmail || {};
  const todo = TEMPLATES.filter(([key]) => (send[key]?.senderDisplayName || "") !== SENDER_NAME);
  if (!todo.length) {
    console.log(`both mails already send as "${SENDER_NAME}" — nothing to write.`);
    return;
  }
  for (const [key, label] of todo) {
    console.log(`${label}: "${send[key]?.senderDisplayName || "(unset)"}"  →  "${SENDER_NAME}"`);
  }
  console.log("");
  // SAID OUT LOUD BEFORE IT IS DONE, because it is a real side effect and
  // not a footnote: setting any field on a template marks it `customized`,
  // and a customized template stops tracking Firebase's own defaults for
  // the fields it does not set. The body is left absent on purpose so
  // Firebase keeps supplying it — but if a future edit sets a body, the
  // localisation Firebase does for free stops.
  console.log("note: writing a template field marks it `customized`. Body and");
  console.log("subject are left unset, so Firebase keeps supplying (and");
  console.log("localising) those; only the sender name becomes ours.");
  if (!APPLY) { console.log("\n(dry run — pass --apply to write it)"); return; }

  // ONE PATCH, both templates, with a mask naming exactly the two leaves.
  // A mask per template would be two round trips and two chances to leave
  // the pair disagreeing — a verification mail from Doxa and a reset
  // from prvfire33 is worse than neither being set, because the
  // inconsistency is what looks like a spoof.
  await patchConfig(
    {
      notification: {
        sendEmail: Object.fromEntries(
          TEMPLATES.map(([key]) => [key, { senderDisplayName: SENDER_NAME }]),
        ),
      },
    },
    TEMPLATES.map(([key]) => `notification.sendEmail.${key}.senderDisplayName`).join(","),
  );
  console.log("\nwritten.");
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

  // THE SINK IS PROVED BEFORE THE PASSWORD MOVES, and the order is the
  // whole point. This rotation is irreversible: the new password exists
  // only in this process, and the old one is gone the moment Firebase
  // accepts the write. Checking DEMO_ACCOUNT_OUT afterwards — which is
  // what this did — meant two ways to leave App Review holding a
  // credential nobody has. Unset: the script printed "set it and re-run"
  // and exited 0, having already locked the account. Set to a path that
  // cannot be written: writeFileSync threw AFTER the rotation, and since
  // asc-review.mjs has by then pushed the PREVIOUS password to App Store
  // Connect, guideline 2.1 rejects the submission on a credential nobody
  // can recover.
  //
  // A directory check is not enough — a read-only directory, a bad mount,
  // a path that is itself a directory all pass one and fail the write. So
  // the file is actually opened here, with a placeholder, and the real
  // credentials overwrite it below.
  const out = process.env.DEMO_ACCOUNT_OUT;
  if (!out) {
    die("DEMO_ACCOUNT_OUT is unset, so a rotated credential would have nowhere private to go.\n"
      + "  Set it to a path and re-run. Nothing was changed.");
  }
  try {
    writeFileSync(out, JSON.stringify({ email: DEMO_EMAIL, password: null }, null, 2));
  } catch (err) {
    die(`DEMO_ACCOUNT_OUT (${out}) is not writable, so a rotated credential would be lost.\n`
      + `  ${err.message}\n`
      + `  Its directory is ${dirname(out)}. Nothing was changed.`);
  }

  const user = existing
    ? await auth.updateUser(existing.uid, { password, emailVerified: true, disabled: false })
    : await auth.createUser({ email: DEMO_EMAIL, password, emailVerified: true });

  console.log(`\ncreated/updated uid ${user.uid}, emailVerified ${user.emailVerified}`);

  // The credentials go to a FILE, not to stdout. A workflow log is
  // readable by every collaborator and kept for months; App Store Connect
  // is where these belong and the next step reads them from here.
  writeFileSync(out, JSON.stringify({ email: DEMO_EMAIL, password }, null, 2));
  console.log(`credentials written to ${out} (not echoed — a run log is not a vault)`);
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
