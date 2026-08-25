// Does the built web bundle actually carry a live Firebase config?
// Run AFTER `npm run build`, on any path that ships the bundle to users.
//
// WHY THIS EXISTS. ios-release.yml went to some length to prove the NATIVE
// half of the Firebase config had landed — it base64-decodes
// GoogleService-Info.plist, runs `plutil -lint` on the result and prints a
// key back out, because (its own words) the plist's absence "is silent in
// the worst way: the app builds, signs, uploads, installs, and has no
// Firebase". The JavaScript half had exactly that failure mode and no check
// at all: `npm run build` ran with no VITE_* environment, so
// `firebaseEnabled` in src/lib/firebase.ts evaluated false, initLive()
// returned early, and the signed archive shipped the demo deck to
// TestFlight. Both halves are needed and only one was guarded.
//
// It is not enough to assert the variables are SET in the environment: the
// question is whether the build that exists on disk was produced with them.
// Vite inlines `import.meta.env.VITE_X` at build time, so the honest test is
// that each required value appears verbatim in the emitted JavaScript. A
// build from a previous, unconfigured run fails that even when the
// environment is now perfect — which is the case worth catching, because it
// is what a reordered workflow step produces.
//
// Deliberately NOT wired into ci.yml. PR builds have no production config
// and should not need one; this belongs on release paths, next to the
// native plist check it mirrors.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { missingLiveMarkers } from "./live-markers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(root, "dist", "assets");

// The four src/lib/firebase.ts calls "required": with any one of them empty,
// firebaseEnabled is false and the app runs on demo data. The optional rest
// (storage bucket, sender id, measurement id) are not checked — absent, they
// cost a feature, not the backend.
const REQUIRED = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const errors = [];

// ── 1. the environment this process can see ──
const missing = REQUIRED.filter((k) => !(process.env[k] || "").trim());
if (missing.length) {
  errors.push(
    `these Firebase variables are unset or empty:\n    ${missing.join("\n    ")}\n\n`
    + "  Without them Vite inlines `undefined`, firebaseEnabled is false, and\n"
    + "  the build is the mock-mode demo app. See docs/IOS-RELEASE.md § Secrets.",
  );
}

// VITE_V2_LIVE is a separate gate in src/v2/main.jsx: initLive() returns
// early unless it is the literal string "true", so a perfect Firebase config
// with this unset still ships the demo deck. Same failure, different switch.
//
// IT IS CHECKED AGAINST dist/, DOWN BELOW, and it used to be checked here
// against process.env — which made this file half a liar. The whole
// argument in the header is that asserting the variables are SET is not
// enough, because "the question is whether the build that exists on disk
// was produced with them"; the four Firebase values were held to that and
// this one, the switch that decides whether ANY of them get used, was
// taken on trust. So a dist/ built with a full Firebase config and no
// VITE_V2_LIVE passed this gate while shipping the demo deck — the exact
// artifact the closing message describes, "a WORKING demo app, signed and
// uploadable". Reproduced on this tree before the fix.

// An emulator build points every SDK at localhost. On a user's phone that is
// not a degraded app, it is an app that cannot reach anything.
if ((process.env.VITE_USE_EMULATOR || "").trim() === "true") {
  errors.push(
    "VITE_USE_EMULATOR=true in a build meant for users — every SDK would be\n"
    + "  pointed at 127.0.0.1. Unset it.",
  );
}

// ── 2. the build on disk ──
let js = "";
let chunks = 0;
try {
  for (const f of readdirSync(ASSETS)) {
    if (!f.endsWith(".js")) continue;
    if (!statSync(join(ASSETS, f)).isFile()) continue;
    js += readFileSync(join(ASSETS, f), "utf8");
    chunks++;
  }
} catch {
  console.error(
    `check-web-firebase: no build at ${ASSETS}.\n`
    + "Run `npm run build` first — this checks the bundle, not the environment.",
  );
  process.exit(1);
}

if (!chunks) {
  console.error(
    `check-web-firebase: ${ASSETS} holds no .js chunks, which cannot be right.\n`
    + "Refusing to pass vacuously — check the build output.",
  );
  process.exit(1);
}

// String literals survive minification as data, so a value that was inlined
// is findable verbatim. Only run this for variables that are actually set;
// an unset one is already reported above and would match everything.
const notInlined = REQUIRED.filter((k) => {
  const v = (process.env[k] || "").trim();
  return v && !js.includes(v);
});
if (notInlined.length) {
  errors.push(
    `these values are set in the environment but do NOT appear in the built\n`
    + `  bundle, so dist/ was produced by a build that could not see them:\n    `
    + notInlined.join("\n    ")
    + "\n\n  Build AFTER exporting them — a stale dist/ from an earlier step is the\n"
    + "  usual cause, and it is exactly what this check is for.",
  );
}

// The live switch, asked of the artifact — see the note beside REQUIRED.
//
// There is no VALUE to look for here the way there is for the four
// Firebase variables: VITE_V2_LIVE is compared against the literal "true"
// inside src/v2/data/live.ts, so what survives a build is not the flag but
// the code it kept. With the flag unset those comparisons fold to false
// and rolldown drops the live read path, taking its vocabulary with it.
// The markers themselves, and the four-build measurement that chose them,
// live in scripts/live-markers.mjs — one file rather than a copy here,
// because check-bundle.mjs has to ask the identical question and a copy
// kept in step by a comment is what check:logic-sync exists to prevent.
const liveMissing = missingLiveMarkers((m) => js.includes(m));
if (liveMissing.length) {
  errors.push(
    "the live read path is NOT in this bundle — VITE_V2_LIVE was not \"true\"\n"
    + "  for the build that produced dist/.\n    "
    + `missing markers: ${liveMissing.join(", ")}\n\n`
    + "  initLive() gates on it before it looks at the Firebase config, so the\n"
    + "  app renders the demo deck no matter how well configured the rest is.\n"
    + "  Setting it for THIS process changes nothing; rebuild with it set.",
  );
}

if (errors.length) {
  console.error("check-web-firebase FAILED:\n\n" + errors.map((e) => "  " + e).join("\n\n") + "\n");
  console.error(
    "  A release build that fails this is not a broken app — it is a WORKING\n"
    + "  demo app, signed and uploadable, whose first symptom is a user seeing\n"
    + "  questions nobody else can see.",
  );
  process.exit(1);
}

console.log(
  `check-web-firebase OK — live config inlined into ${chunks} chunk(s) `
  + `(project ${process.env.VITE_FIREBASE_PROJECT_ID}).`,
);
