#!/usr/bin/env node
// check-ios-location.mjs — hold the iOS location declarations to what the
// app actually does.
//
// WHY THIS EXISTS. On 2026-08-12 App Store Connect accepted 2.0.0 build 10
// and *then* emailed ITMS-90683: the bundle had no
// NSLocationAlwaysAndWhenInUseUsageDescription. Nothing local said a word —
// the archive built, signed, uploaded and installed. The warning arrives by
// email, after the build number is spent, which is the same silent,
// store-only failure profile check-store-copy.mjs exists for. Apple treats
// it as a warning today and reserves the right to reject; either way the
// cheapest moment to catch it is a PR, not an upload.
//
// THE MECHANISM, verified in source rather than inferred from the warning.
// Apple's analysis reads the linked binary, not the call sites:
//
//   @capacitor/geolocation
//     → ion-ios-geolocation (SwiftPM, fetched at build time)
//       → IONGLOCAuthorisationRequestType.always
//         → CLLocationManager.requestAlwaysAuthorization
//
// The symbol ships in every archive. Nothing in this app reaches it — the
// plugin's only call site passes `.whenInUse` — but a purpose string is
// required for an API the binary *references*, which is exactly what
// Apple's mail says and what the plugin's own README documents.
//
// WHAT IT CHECKS, and why each line is here rather than assumed:
//
//   1. Both usage-description keys exist and are non-empty. The one Apple
//      asked for, and the one that actually drives the prompt.
//   2. They are IDENTICAL. The Always string cannot be shown to a user
//      (see 4), so nobody would notice it drifting into a claim about
//      background use that web/privacy.html's "no location history, no
//      background location" denies. Sameness is cheap; divergence would be
//      undetectable by any other means.
//   3. NSLocationDefaultAccuracyReduced is declared, and the ANDROID
//      manifest agrees with it. Until D178 this demanded `<true/>` (D9's
//      precision cap); D175 reversed that decision and left this rule
//      failing on every correct tree, which is the worst state a gate can
//      be in — the only way past it is to stop looking. It is a
//      consistency check between the platforms now, with the store-label
//      half in check-store-forms.mjs.
//   4. UIBackgroundModes does not contain `location`. This is the
//      behavioural half of the Always key being harmless: a purpose string
//      grants nothing, an Always *request* would, and a background mode is
//      how a location app declares it means it.
//   5. The installed plugin still requests `.whenInUse` and nothing else.
//      A plugin upgrade is the one realistic way the Always prompt could
//      start appearing, and on that day the string in Info.plist ("used
//      once, to work out which city you are nearest") becomes a lie told in
//      a system dialog.
//
// WHERE IT RUNS. ci.yml's lint job, beside check:ios-spm and
// check:ios-facebook. Client-only, off the deploy path (docs/DEPLOYMENT.md):
// nothing here says anything about backend correctness, and none of it
// should be able to block an emergency rules fix.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { nearConsentMismatch } from "./near-consent-rule.mjs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLIST = "ios/App/App/Info.plist";
const PLUGIN = "node_modules/@capacitor/geolocation/ios/Sources/GeolocationPlugin";

const WHEN_IN_USE = "NSLocationWhenInUseUsageDescription";
const ALWAYS = "NSLocationAlwaysAndWhenInUseUsageDescription";

const problems = [];

// ── A minimal plist reader ───────────────────────────────────────────
//
// Not a parser: it finds `<key>NAME</key>` and reads the element that
// follows it. That is enough for this file and avoids a dependency, but it
// assumes two things that hold here and are worth stating — the keys are
// unique (a plist dict's keys must be), and no XML comment sits *between* a
// key and its value (ours all precede the key). Entities are returned
// undecoded; the comparisons below are equality and emptiness, which
// encoding does not affect as long as both sides go through this reader.
function plistValue(src, key) {
  const marker = `<key>${key}</key>`;
  const at = src.indexOf(marker);
  if (at === -1) return undefined;
  const after = src.slice(at + marker.length);
  const m = after.match(
    /^\s*(?:<string>([\s\S]*?)<\/string>|<(true|false)\s*\/>|<array>([\s\S]*?)<\/array>)/,
  );
  if (!m) return undefined;
  if (m[1] !== undefined) return { type: "string", value: m[1] };
  if (m[2] !== undefined) return { type: "bool", value: m[2] === "true" };
  return {
    type: "array",
    value: [...m[3].matchAll(/<string>([\s\S]*?)<\/string>/g)].map((s) => s[1]),
  };
}

const plistPath = join(root, PLIST);
if (!existsSync(plistPath)) {
  // A missing plist is a failure, not a vacuous pass: every assertion below
  // would otherwise report nothing and exit 0.
  console.error(`check:ios-location: ${PLIST} is missing.`);
  process.exit(1);
}
const plist = readFileSync(plistPath, "utf8");

// 1 · Both purpose strings present and non-empty.
const strings = {};
for (const key of [WHEN_IN_USE, ALWAYS]) {
  const entry = plistValue(plist, key);
  if (!entry || entry.type !== "string" || !entry.value.trim()) {
    problems.push(
      `${PLIST}: ${key} is missing or empty.\n` +
        `    Apple requires a purpose string for every location API the binary\n` +
        `    references — ${ALWAYS} because\n` +
        `    ion-ios-geolocation names requestAlwaysAuthorization, even though this\n` +
        `    app only ever requests when-in-use. Omitting it uploads fine and\n` +
        `    returns ITMS-90683 by email, one spent build number later.`,
    );
  } else {
    strings[key] = entry.value;
  }
}

// 1b · …and the string describes EVERY location read the app makes.
//
// It said "Used once, on this device, to work out which city you are
// nearest" while the Near presence loop re-read location every four
// minutes for as long as Near was on and the app was open — a fresh read
// each time, because locate.ts caps `maximumAge` at one minute precisely
// so a stale fix cannot place you in a room you left. D175 turned
// precision ON for that feature, and the string still described only the
// city lookup. This is the prompt iOS shows a person before they decide,
// so it is a promise in writing in the strongest sense the app has.
//
// Two-sided on purpose. Silent-while-the-loop-exists is the bug that
// happened; still-claiming-it-after-the-loop-goes is the mirror, and a
// purpose string that over-describes is its own kind of wrong.
const liveTs = join(root, "src/v2/data/live.ts");
if (existsSync(liveTs)) {
  const live = readFileSync(liveTs, "utf8");
  // The rule itself lives in near-consent-rule.mjs, and the extraction is
  // the fix rather than tidying: this file runs at import time and calls
  // process.exit, so the one rule here that guards a consent prompt was the
  // one nothing could execute in a test. It blanks comments before matching,
  // because the match is over raw source and a COMMENTED-OUT timer read as a
  // running one — measured on the real tree, deleting the line failed and
  // commenting the same line out passed. See that module for the whole case.
  const mismatch = nearConsentMismatch(live, strings[WHEN_IN_USE]);
  if (mismatch === "under") {
    problems.push(
      `${PLIST}: the purpose string does not mention Near.\n` +
        `    data/live.ts re-reads location on a PRESENCE_BEAT_MS timer while\n` +
        `    Near is on, so "used once" is not what the app does — and this\n` +
        `    string is the prompt shown before anyone can consent to it.\n` +
        `    web/privacy.html already describes the ~200 m square; the plist\n` +
        `    is the copy that lags.`,
    );
  }
  if (mismatch === "over") {
    problems.push(
      `${PLIST}: the purpose string describes a Near loop that is gone.\n` +
        `    No PRESENCE_BEAT_MS read remains in data/live.ts. A purpose\n` +
        `    string that over-describes asks for more than the app needs,\n` +
        `    which is the direction that loses a permission grant. Simplify\n` +
        `    it — and the store label and privacy page move with it.`,
    );
  }
}

// 2 · …and identical, so the never-shown one cannot drift.
if (
  strings[WHEN_IN_USE] !== undefined &&
  strings[ALWAYS] !== undefined &&
  strings[WHEN_IN_USE] !== strings[ALWAYS]
) {
  problems.push(
    `${PLIST}: the two location purpose strings differ.\n` +
      `    ${WHEN_IN_USE}:\n      ${strings[WHEN_IN_USE]}\n` +
      `    ${ALWAYS}:\n      ${strings[ALWAYS]}\n` +
      `    Keep them identical. The Always string is never rendered (this app\n` +
      `    never requests Always authorisation), so a claim that grew in it\n` +
      `    would be unreviewable — and it sits beside privacy.html's "no\n` +
      `    background location". If the app genuinely starts asking for\n` +
      `    Always, this check is the wrong thing to edit: the store label,\n` +
      `    D9's table and the privacy panel all move first.`,
  );
}

// 3 · The precision declaration, and the label that has to agree with it.
//
// THIS RULE WAS REVERSED AT D178, AFTER BEING WRONG SINCE D175. It used to
// demand `<true/>` — D9's precision cap — and its message said losing that
// "flips the App Store label to Precise Location". D175 flipped both, on
// the owner's explicit go, to give Near a venue-scale radius: the plist
// went to `<false/>`, Android's FINE permission was uncapped, and
// STORE-FORMS.md ticked Precise Location. This gate was not updated, so it
// failed on every correct tree for three commits.
//
// A gate that fires on the right state is worse than no gate, because the
// only way past it is to stop looking. So the rule is no longer an opinion
// about which value is correct — it is a CONSISTENCY check between the two
// files that have to agree, whichever way the decision goes. The label's
// own half of the same cross-check lives in check-store-forms.mjs; this
// half is the platform pair.
const reduced = plistValue(plist, "NSLocationDefaultAccuracyReduced");
if (!reduced || reduced.type !== "bool") {
  problems.push(
    `${PLIST}: NSLocationDefaultAccuracyReduced is missing or is not a boolean.\n` +
      `    It decides whether iOS hands back a precise fix, and therefore what\n` +
      `    the App Store privacy label has to say. Absent, the platform default\n` +
      `    applies and nothing here or in the store forms records which.`,
  );
} else {
  // Android's half. D175 uncapped ACCESS_FINE_LOCATION at the same time;
  // if one platform asks for precision and the other does not, the app
  // measures a different radius per device and every distance sentence in
  // the UI is true on one of them.
  const manifest = readFileSync(
    join(root, "android/app/src/main/AndroidManifest.xml"), "utf8",
  );
  const fineCapped = /ACCESS_FINE_LOCATION[\s\S]{0,200}?android:maxSdkVersion/.test(manifest);
  const fineDeclared = /ACCESS_FINE_LOCATION/.test(manifest);
  const iosPrecise = reduced.value === false;
  if (iosPrecise && (!fineDeclared || fineCapped)) {
    problems.push(
      `iOS asks for a PRECISE fix but Android does not.\n` +
        `    NSLocationDefaultAccuracyReduced is <false/> while\n` +
        `    ACCESS_FINE_LOCATION is ${fineDeclared ? "capped by maxSdkVersion" : "not declared"}.\n` +
        `    Near's grid cell would then be a different size per platform, and\n` +
        `    every distance the UI states would be true on one of them (D175).`,
    );
  }
  if (!iosPrecise && fineDeclared && !fineCapped) {
    problems.push(
      `Android asks for a PRECISE fix but iOS does not.\n` +
        `    The same mismatch as above, pointed the other way.`,
    );
  }
}

// 4 · No background-location capability behind the Always key.
const modes = plistValue(plist, "UIBackgroundModes");
if (modes?.type === "array" && modes.value.includes("location")) {
  problems.push(
    `${PLIST}: UIBackgroundModes declares "location".\n` +
      `    ${ALWAYS} is present only to satisfy\n` +
      `    Apple's static analysis of a linked symbol; this app reads location\n` +
      `    once, in the foreground, on an explicit tap. A background location\n` +
      `    mode is a different product and a different privacy page.`,
  );
}

// 5 · The installed plugin still asks for when-in-use, and only that.
//
// Same shape as check:ios-facebook — read the source that actually compiles,
// so a plugin upgrade cannot quietly change what the app asks the user for.
const pluginDir = join(root, PLUGIN);
if (!existsSync(pluginDir)) {
  console.error(
    `check:ios-location: ${PLUGIN} is not installed.\n` +
      `Run \`npm ci\` first — this check reads the plugin source that Xcode\n` +
      `compiles, not the version range in package.json.`,
  );
  process.exit(1);
}

const REQUEST = /requestLocationAuthorisation\(type:\s*\.([A-Za-z]+)\)/g;
const requested = [];
for (const file of readdirSync(pluginDir).filter((f) => f.endsWith(".swift"))) {
  const src = readFileSync(join(pluginDir, file), "utf8");
  for (const m of src.matchAll(REQUEST)) requested.push([file, m[1]]);
}

if (!requested.length) {
  // "Found nothing" must never be how this passes: the call shape is
  // upstream's to change, and a rename would silently retire the assertion.
  problems.push(
    `${PLUGIN}: no requestLocationAuthorisation(type: .x) call site found.\n` +
      `    The plugin's authorisation call changed shape, so this check can no\n` +
      `    longer see what the app asks for. Re-read GeolocationPlugin.swift and\n` +
      `    update the pattern — do not delete the assertion.`,
  );
} else {
  const wrong = requested.filter(([, type]) => type !== "whenInUse");
  for (const [file, type] of wrong) {
    problems.push(
      `${PLUGIN}/${file}: requests .${type} authorisation.\n` +
        `    This app's Info.plist purpose string describes foreground reads\n` +
        `    only — the city lookup, and Near's square while the app is open.\n` +
        `    If the plugin now asks for\n` +
        `    .${type}, that string is shown in a prompt it does not describe, and\n` +
        `    the store label, D9's table and web/privacy.html all need revisiting\n` +
        `    before this check does.`,
    );
  }
}

if (problems.length) {
  console.error("check:ios-location failed:\n");
  for (const p of problems) console.error(`  - ${p}\n`);
  console.error("See docs/DECISIONS.md D107 for why each of these is held.");
  process.exit(1);
}

console.log(
  `check:ios-location: both purpose strings present and identical, ` +
    `${reduced?.value === false ? "precise fix requested on both platforms" : "reduced accuracy on"}, ` +
    `no background location mode, plugin requests ` +
    `when-in-use only (${requested.length} call site${requested.length === 1 ? "" : "s"}).`,
);
