// Five version numbers across three files, bumped by hand.
//
//   package.json          version      → the marketing version
//   package.json          appBuild     → the build number (also compiled
//                                        into the app as __APP_BUILD__ and
//                                        compared against v2_meta/app for
//                                        the in-app update prompts)
//   android/app/build.gradle  versionName / versionCode
//   ios .xcodeproj        MARKETING_VERSION / CURRENT_PROJECT_VERSION
//
// Ship a mismatch and the update prompt compares against the wrong build,
// or one store gets a version the other does not. `--fix` writes
// package.json's values into the two native projects.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => resolve(root, rel);
const FIX = process.argv.includes("--fix");

const pkg = JSON.parse(readFileSync(p("package.json"), "utf8"));
const version = String(pkg.version);
const appBuild = Number(pkg.appBuild);

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`package.json version "${version}" is not x.y.z`);
  process.exit(1);
}
if (!Number.isInteger(appBuild) || appBuild < 1) {
  console.error(`package.json appBuild must be a positive integer, got ${pkg.appBuild}`);
  process.exit(1);
}

const problems = [];
const warnings = [];

// ── Android ──────────────────────────────────────────────────────
const GRADLE = "android/app/build.gradle";
let gradle = readFileSync(p(GRADLE), "utf8");
const gCode = gradle.match(/versionCode\s+(\d+)/);
const gName = gradle.match(/versionName\s+"([^"]+)"/);
if (!gCode || !gName) {
  problems.push(`${GRADLE}: could not find versionCode / versionName`);
} else {
  if (gName[1] !== version) {
    problems.push(`${GRADLE} versionName "${gName[1]}" != package.json version "${version}"`);
    if (FIX) gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  }
  const code = Number(gCode[1]);
  if (code < appBuild) {
    problems.push(`${GRADLE} versionCode ${code} is BEHIND appBuild ${appBuild}`);
    if (FIX) gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${appBuild}`);
  } else if (code > appBuild) {
    // Legitimate: a Play re-upload of the same release needs a fresh
    // versionCode without a new marketing build.
    warnings.push(`${GRADLE} versionCode ${code} is ahead of appBuild ${appBuild} — fine after a Play re-upload, but bump appBuild before the next release.`);
  }
  if (FIX) writeFileSync(p(GRADLE), gradle);
}

// ── iOS ──────────────────────────────────────────────────────────
// Scoped to the App TARGET's two configurations: the project-level blocks
// carry their own defaults, and rewriting those is not the same edit.
const PBX = "ios/App/App.xcodeproj/project.pbxproj";
let pbx = readFileSync(p(PBX), "utf8");
const targetBlocks = [...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = com\.cosaxo\.insight;/g)];
if (targetBlocks.length !== 2) {
  problems.push(`${PBX}: expected 2 App-target configurations, found ${targetBlocks.length}`);
} else {
  // COUNTED BEFORE COMPARED, and that is the whole of this block's history.
  // Both scans used to push a problem only from INSIDE the loop, so zero
  // matches meant zero problems and the run printed "versions OK — … across
  // package.json, Android and iOS" having read neither iOS key. Reproduced,
  // not reasoned: quote both values the way Xcode legitimately writes build
  // settings (`CURRENT_PROJECT_VERSION = "26";`) and the old scan passed
  // green while checking nothing. The Android half has had this floor since
  // it was written (`if (!gCode || !gName)`); this half never did.
  //
  // Same failure D275 recorded one gate over: a tripwire counting `tx.get(`
  // after the code moved to `tx.getAll(` counted zero and called it a pass.
  // The quotes are accepted now as well as demanded-to-exist, because an
  // Xcode round-trip that adds them is a formatting change, not a version
  // change, and a release gate that fails on it would be worked around.
  const cpv = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = "?(\d+)"?;/g)];
  const mkt = [...pbx.matchAll(/MARKETING_VERSION = "?([0-9.]+)"?;/g)];
  if (cpv.length !== 2) {
    problems.push(
      `${PBX}: found ${cpv.length} CURRENT_PROJECT_VERSION setting(s), expected 2 —`
      + " this scan cannot read the file, so fix the scan rather than trusting it",
    );
  }
  if (mkt.length !== 2) {
    problems.push(
      `${PBX}: found ${mkt.length} MARKETING_VERSION setting(s), expected 2 —`
      + " this scan cannot read the file, so fix the scan rather than trusting it",
    );
  }
  for (const m of cpv) {
    if (Number(m[1]) !== appBuild) {
      problems.push(`${PBX} CURRENT_PROJECT_VERSION ${m[1]} != appBuild ${appBuild}`);
      break;
    }
  }
  for (const m of mkt) {
    if (m[1] !== version) {
      problems.push(`${PBX} MARKETING_VERSION ${m[1]} != package.json version ${version}`);
      break;
    }
  }
  if (FIX) {
    // Writes the unquoted canonical form either way, so a quoted round-trip
    // normalises rather than accumulating a second spelling.
    pbx = pbx.replace(/CURRENT_PROJECT_VERSION = "?\d+"?;/g, `CURRENT_PROJECT_VERSION = ${appBuild};`);
    pbx = pbx.replace(/MARKETING_VERSION = "?[0-9.]+"?;/g, `MARKETING_VERSION = ${version};`);
    writeFileSync(p(PBX), pbx);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);

if (problems.length) {
  if (FIX) {
    console.log("Applied fixes for:");
    for (const x of problems) console.log("  - " + x);
    console.log("\nRe-run without --fix to confirm.");
    process.exit(0);
  }
  console.error("Version mismatch:");
  for (const x of problems) console.error("  - " + x);
  console.error("\nRun `npm run check:versions -- --fix` to sync from package.json.");
  process.exit(1);
}

console.log(`versions OK — ${version} (build ${appBuild}) across package.json, Android and iOS`);
