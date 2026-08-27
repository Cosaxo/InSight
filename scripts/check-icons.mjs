// Are the committed launcher icons the icon builder's output for the
// committed mark?
//
// D324 recorded the gap this closes: both release-path gates read
// `dist/`, but the app icon reaches the binary from
// ios/App/App/Assets.xcassets/ (and the Android mipmaps from res/),
// which `cap sync` does not write and no gate read — so build 26 shipped
// the iris only because a human ran scripts/gen-icons.mjs by hand and
// committed the PNGs, "and nothing in this repo could tell the
// difference if they had not."
//
// A regenerate-and-compare gate is the wrong shape here: the builder
// renders its masters through Chromium, and a re-render is not
// byte-stable across Chromium versions, so CI would flake on pixels
// while the mark stood still. Instead the builder writes
// design/icon/icons.lock.json — the hash of the mark, of the builder
// itself, and of every file it wrote — and this gate holds the tree to
// the lock. Change the mark, the builder, or any icon by hand, and this
// fails until `node scripts/gen-icons.mjs` runs for real.
//
// One more arm rides along: gen-icons composites over INK, and its own
// comment says that hex MUST equal values/ic_launcher_background.xml or
// Android 26+ composites the adaptive foreground over one colour while
// pre-26 ships the other baked in. That equality was prose; now it is
// checked, off the lock's own recorded ink.

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = "design/icon/icons.lock.json";
const IOS_ICON = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
const BACKGROUND_XML = "android/app/src/main/res/values/ic_launcher_background.xml";

/**
 * Pure comparison, tested in check-icons.test.mjs. `hashes` maps every
 * path the caller could hash (source, script, outputs) to its sha256, or
 * null for a file that does not exist; `backgroundXml` is the raw text of
 * the Android background-colour resource.
 */
export function iconLockProblems(lock, { sourceHash, scriptHash, outputHashes, backgroundXml }) {
  const problems = [];
  if (!lock || typeof lock !== "object") {
    return ["design/icon/icons.lock.json is missing or unreadable — run `node scripts/gen-icons.mjs` (needs Chromium) so the icons have a lock to be held to"];
  }

  // Vacuity first: a lock that no longer covers the iOS marketing icon —
  // the exact file D324 is about — is a lock that has stopped guarding
  // the thing it exists for, however green the hashes are.
  const outputs = lock.outputs && typeof lock.outputs === "object" ? lock.outputs : {};
  if (!(IOS_ICON in outputs)) {
    problems.push(`the lock does not cover ${IOS_ICON} — the one file D324 is about. Fix gen-icons.mjs's OUTPUTS rather than letting this pass vacuously`);
  }
  if (Object.keys(outputs).length < 16) {
    problems.push(`the lock covers ${Object.keys(outputs).length} outputs — gen-icons writes 16 (15 Android mipmaps + the iOS marketing icon), so a shrunken list means the builder and the lock disagree`);
  }

  if (lock.source !== sourceHash) {
    problems.push("design/icon/mark.svg changed and the icons were not regenerated — the committed launchers still draw the previous mark. Run `node scripts/gen-icons.mjs`");
  }
  if (lock.script !== scriptHash) {
    problems.push("scripts/gen-icons.mjs changed since the lock was written — the committed icons are a previous builder's output. Run `node scripts/gen-icons.mjs` (or --relock only for outputs whose provenance is verified some other way)");
  }
  for (const [path, hash] of Object.entries(outputs)) {
    const got = outputHashes[path];
    if (got === null || got === undefined) {
      problems.push(`${path} is in the lock and not in the tree — an icon the builder wrote has been deleted`);
    } else if (got !== hash) {
      problems.push(`${path} differs from what gen-icons.mjs wrote — a hand-touched or stale icon. Regenerate rather than editing outputs`);
    }
  }

  // The INK coupling: one colour, two homes (the baked-in legacy icons
  // and the adaptive-icon background resource), drift = two different
  // icons by Android version.
  const m = /<color name="ic_launcher_background">(#[0-9a-fA-F]{6})<\/color>/.exec(backgroundXml || "");
  if (!m) {
    problems.push(`${BACKGROUND_XML} carries no ic_launcher_background colour — the adaptive icon composites over a colour this repo no longer states`);
  } else if (typeof lock.ink === "string" && m[1].toLowerCase() !== lock.ink.toLowerCase()) {
    problems.push(`${BACKGROUND_XML} says ${m[1]} while gen-icons bakes ${lock.ink} into the legacy icons — Android 26+ and pre-26 would ship two different grounds`);
  }
  return problems;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const sha = (p) => (existsSync(join(root, p)) ? createHash("sha256").update(readFileSync(join(root, p))).digest("hex") : null);

  let lock = null;
  try {
    lock = JSON.parse(readFileSync(join(root, LOCK), "utf8"));
  } catch {
    // handled as the missing-lock problem below
  }

  const outputHashes = {};
  for (const path of Object.keys(lock?.outputs ?? {})) outputHashes[path] = sha(path);

  const problems = iconLockProblems(lock, {
    sourceHash: sha("design/icon/mark.svg"),
    scriptHash: sha("scripts/gen-icons.mjs"),
    outputHashes,
    backgroundXml: existsSync(join(root, BACKGROUND_XML)) ? readFileSync(join(root, BACKGROUND_XML), "utf8") : "",
  });

  if (problems.length) {
    for (const p of problems) console.error(`check-icons: ${p}`);
    process.exit(1);
  }
  console.log(
    `check-icons OK — ${Object.keys(lock.outputs).length} launcher icons match the lock; mark, builder and background colour unchanged since the last real run`,
  );
}
