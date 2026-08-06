// Are the store-facing pages actually fillable-in and filled in?
//
//   npm run check:store-copy
//
// Deliberately NOT in CI, and that is the whole design. The placeholders
// this catches are unfilled *today*, so wiring it into ci.yml would red
// the tree immediately and the first response would be to delete the
// check. It is a pre-submission gate instead: docs/SHIP-CHECKLIST.md runs
// it before a store upload, when the values are known.
//
// Why it exists at all: privacy.html routes GDPR erasure requests to "the
// support address listed on the terms of service page", and that address
// was `[support email — set before launch]`. A user exercising a legal
// right lands on a bracket. Nothing was watching, because a placeholder in
// shipped HTML looks exactly like prose to every other gate in this repo.
//
// SCOPE WIDENED beyond prose, because the same shape of bug lives in three
// committed config files. Each carries a REPLACE_WITH_* marker that only a
// human with an account can fill, each ships fine with the marker still in
// it, and each fails *silently and only on a device* — which is the exact
// profile of the terms.html bug, minus the prose. Two of them had no guard
// at all:
//
//   - the two web/.well-known/ files — invite links quietly open the
//     hosted fallback page instead of the app
//   - ios Info.plist CFBundleURLTypes — the Google sign-in sheet opens and
//     the flow never returns, so the one path off an anonymous account
//     (D3) is dead
//
// Everything compiles, every other gate stays green, and nothing reports
// an error. The store upload is the last moment any of it is cheap to fix.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Bracketed markers of the form [... set before launch] / [TODO ...] etc.
const PLACEHOLDER = /\[[^\]\n]*\b(set before launch|TBD|TODO|FIXME|placeholder|your [a-z ]+ here)\b[^\]\n]*\]/gi;

const PAGES = ["web/terms.html", "web/privacy.html"];

// Account-gated values: a Play signing fingerprint, an Apple Team ID and a
// reversed OAuth client ID. Same marker shape in all three so one regex
// covers them and a fourth costs one line here.
const REPLACE_MARKER = /REPLACE_WITH_[A-Z0-9_]+/g;

// `parked: true` means the placeholder cannot block the release currently
// being made. Only D42's Play deferral sets it today: the assetlinks
// fingerprint comes from Play Console → App signing, which does not exist
// while Play is deferred, so an iOS release must be able to pass with it
// still unfilled. It is still REPORTED in every mode — a parked
// placeholder that goes quiet is one nobody remembers to fill.
const CONFIGS = [
  ["web/.well-known/assetlinks.json", "Play Console → Setup → App signing", { parked: "Play deferred (D42)" }],
  ["web/.well-known/apple-app-site-association", "Apple Developer → Membership → Team ID"],
  ["ios/App/App/Info.plist", "REVERSED_CLIENT_ID in GoogleService-Info.plist"],
];

// --ios: exit 0 when the only remaining placeholders are parked ones, so
// the release workflow can HARD-gate on this. Without it the check could
// never be automated for an iOS build — it would fail on a Play value by
// design, and the first response to a gate that always fails is to delete
// the gate. Default mode is unchanged and still reports everything.
const IOS_ONLY = process.argv.includes("--ios");

let problems = 0;
let parked = 0;

// Scan a file line by line, reporting every match of `pattern`. Returns the
// number found so both passes can share the counting and the missing-file
// case — a deleted file is a failure, not a pass: these are all load-bearing
// and "no placeholders found" must never be reachable by absence.
function scan(rel, pattern, missingNote, hint, opts = {}) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    // A deleted file is a failure even when parked: absence must never be
    // a way to pass.
    console.error(`check-store-copy: ${rel} is missing — ${missingNote}`);
    problems++;
    return;
  }
  const excused = Boolean(opts.parked) && IOS_ONLY;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(pattern)) {
        console.error(
          `check-store-copy: ${rel}:${i + 1} unfilled placeholder ${m[0]}` +
            (excused ? `  [parked — ${opts.parked}, not blocking]` : "") +
            (hint ? `\n    → ${hint}` : ""),
        );
        if (excused) parked++;
        else problems++;
      }
    });
}

for (const rel of PAGES) {
  scan(rel, PLACEHOLDER, "the store listings link to it.");
}

for (const [rel, hint, opts] of CONFIGS) {
  scan(rel, REPLACE_MARKER, "invite links and Google sign-in read it.", hint, opts);
}

if (problems) {
  console.error(
    `\ncheck-store-copy: ${problems} unfilled placeholder(s).\n` +
    `None of these can be guessed. The web/terms.html ones are legal facts —\n` +
    `the operating entity, its jurisdiction and a real monitored support\n` +
    `address that GDPR erasure requests reach. The REPLACE_WITH_* ones are\n` +
    `account-gated IDs; docs/SHIP-CHECKLIST.md says where each comes from.`,
  );
  process.exit(1);
}

console.log(
  `check-store-copy OK — no unfilled placeholders in ` +
    `${PAGES.length} store-facing pages, ${CONFIGS.length} config files.` +
    (parked ? `\n  (${parked} parked placeholder(s) reported above and excused by --ios.)` : ""),
);
