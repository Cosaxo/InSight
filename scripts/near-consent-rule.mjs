// near-consent-rule.mjs — does the iOS location purpose string describe the
// app's actual location behaviour?
//
// WHY THIS IS ITS OWN MODULE, and not a block inside check-ios-location.mjs
// where it used to live. That gate is a 332-line top-level script: it reads
// Info.plist, the installed Capacitor plugin's Swift sources under
// node_modules, and src/v2/data/live.ts, then exits. Importing it to test one
// rule would run all of it, against the real tree, and call process.exit —
// so the rule that guards a consent prompt was the one rule in the file that
// nothing could exercise. There is no scripts/check-ios-location.test.mjs at
// all, which is how the defect below survived a night that touched this very
// gate. Extracted rather than main-guarded, for the reason strip-comments.mjs
// was extracted: a module that reads nothing and scans nothing cannot fail
// because a directory moved, which is the property the deploy path needs.
//
// THE RULE, and it is two-sided on purpose. Info.plist's purpose string is
// what iOS shows a person BEFORE they decide, which makes it the strongest
// promise in writing this app makes. D107 exists because it once said "used
// once, on this device" while data/live.ts re-read location every four
// minutes. The mirror is a real failure too: a string that describes a loop
// that is gone asks for more than the app needs, which is the direction that
// loses a permission grant.
import { stripComments } from "./strip-comments.mjs";

// The loop by its CALL, not by its identifier: `PRESENCE_BEAT_MS` also
// appears in prose two hundred lines above the timer, so a bare name test
// kept answering "the loop is here" after the loop was taken out.
const BEAT = /setInterval\([\s\S]{0,120}?PRESENCE_BEAT_MS\s*\)/;
const READS_LOCATION = /locateCell\(/;

/**
 * @param {string} liveSrc  source of src/v2/data/live.ts
 * @returns {boolean} true when a location loop actually runs
 *
 * COMMENTS ARE BLANKED FIRST, and that is the whole point of this function
 * existing. The regex above is a match over raw source, so
 * `// nearState.timer = setInterval(() => { … }, PRESENCE_BEAT_MS);` answered
 * yes to "does the loop run?". Measured on the real tree 2026-09-04:
 * DELETING that line failed the gate correctly, and COMMENTING THE SAME LINE
 * OUT left it green — so the plist could go on promising a Near loop that no
 * longer ran, in the over-describing direction the rule below exists to
 * catch. Commenting a line out is how a feature is parked during a refactor
 * or a hotfix; deleting it is not the common case.
 *
 * This is the same defect check:devicebind carried until 2026-09-04, where
 * `// registerPlugin(DeviceBindPlugin.class);` read as a registration. Every
 * sibling gate that greps source for a required call blanks comments first —
 * check:appcheck's own case is literally `// assertOperator(request);`.
 */
export function locationLoopRuns(liveSrc) {
  const live = stripComments(liveSrc ?? "");
  return BEAT.test(live) && READS_LOCATION.test(live);
}

/**
 * @param {string} liveSrc source of src/v2/data/live.ts
 * @param {string|undefined} purpose NSLocationWhenInUseUsageDescription
 * @returns {"under"|"over"|null} which side is wrong, or null when they agree
 */
export function nearConsentMismatch(liveSrc, purpose) {
  const beats = locationLoopRuns(liveSrc);
  const mentionsNear = /\bNear\b/.test(purpose ?? "");
  if (beats && !mentionsNear) return "under";
  if (!beats && mentionsNear) return "over";
  return null;
}
