// Does the app's declared minimum OS actually run the bundle it ships?
//
// WHY THIS EXISTS. Two floors, five files, and nothing comparing them.
// `IPHONEOS_DEPLOYMENT_TARGET` sat at 15.0 in all four build
// configurations — Capacitor's scaffolding default, never a decision, and
// the number the App Store publishes as the minimum OS. The bundle it
// installs was built for something else entirely: `vite.config.ts` set no
// `build.target`, so the floor was whatever Vite's default happened to be
// that week (ios16.4), and the stylesheet was built out of `oklch()`
// (Safari 15.4) and `color-mix()` (16.2) with no `@supports` anywhere.
// The JavaScript was no better — `Object.hasOwn` (15.4) appears 63 times
// in the emitted bundle. So an iPhone on iOS 15 could install build 26
// and render a page with no ground and no ink.
//
// Nothing could see it. `check:bundle` weighs CSS bytes and never reads a
// declaration; `check:ios-spm`, `check:ios-facebook` and
// `check:ios-location` each guard one specific iOS fact and none of them
// is this one; CI has no iOS device. It was found by reading the pbxproj
// against the stylesheet, which is exactly the comparison below.
//
// ── THE TWO KINDS OF TOO-NEW, WHICH IS THE WHOLE RULE ───────────────
//
// A feature above the floor is not automatically a defect, and treating
// it as one would make this gate noise. What decides it is WHERE the
// feature is used:
//
//   FATAL — inside a custom property's value. Custom properties accept
//   almost any token stream, so nothing fails at parse time; the failure
//   is at SUBSTITUTION. `background: var(--surface)` where `--surface`
//   holds an `oklch()` the browser cannot parse is invalid-at-computed-
//   value-time, and the property falls back to its initial value. One
//   unsupported function in one token takes out every consumer of it —
//   which is why `--surface` and `--ink` unset the page ground and the
//   text ink on every screen at once.
//
//   PROGRESSIVE — an ordinary declaration, at-rule or selector. An
//   unsupported value is dropped at parse time and the declaration simply
//   does not apply. `text-wrap: pretty` (Safari 17.5) is above this floor
//   on purpose: below 17.5 the text is not balanced, and that is the
//   entire consequence.
//
// So FATAL uses are held to the floor and PROGRESSIVE ones are listed and
// allowed. A progressive use that must NOT degrade is an `@supports`
// block's job, not this gate's.
//
// The JS list is a spot-check rather than a browserslist: `build.target`
// makes esbuild lower SYNTAX, and lowers no API at all, so an API newer
// than the floor ships as-is and throws on an older device. The list
// holds the ones this bundle uses; it is not a claim to be exhaustive,
// and it says so when it passes.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PBXPROJ = join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
const SPM = join(root, "ios", "App", "CapApp-SPM", "Package.swift");
const VITE = join(root, "vite.config.ts");

/** "16.4" → 16.04, "16" → 16 — ordering only, never arithmetic. */
export const iosNum = (v) => {
  const [maj, min = "0"] = String(v).split(".");
  return Number(maj) + Number(min) / 100;
};

// iOS/Safari minimums, each checked against caniuse at the version
// quoted. A feature added here needs its own number, not a guess.
export const CSS_FEATURES = [
  { name: "oklch()", re: /oklch\(/g, ios: "15.4" },
  { name: "oklab()", re: /oklab\(/g, ios: "15.4" },
  { name: "color-mix()", re: /color-mix\(/g, ios: "16.2" },
  { name: "light-dark()", re: /light-dark\(/g, ios: "17.5" },
  { name: "color(display-p3 …)", re: /color\(\s*display-p3/g, ios: "15.4" },
  { name: "relative colors (from …)", re: /(?:rgb|hsl|oklch|oklab)\(\s*from\s/g, ios: "16.4" },
  { name: "@property", re: /@property\b/g, ios: "16.4" },
  { name: "@container", re: /@container\b/g, ios: "16.0" },
  { name: ":has()", re: /:has\(/g, ios: "15.4" },
  { name: "subgrid", re: /grid-template-(?:rows|columns):[^;]*\bsubgrid\b/g, ios: "16.0" },
  { name: "text-wrap: balance", re: /text-wrap:\s*balance/g, ios: "17.5" },
  { name: "text-wrap: pretty", re: /text-wrap:\s*pretty/g, ios: "17.5" },
  { name: "accent-color", re: /accent-color:/g, ios: "15.4" },
];

export const JS_APIS = [
  { name: "Object.hasOwn", re: /\bObject\.hasOwn\b/g, ios: "15.4" },
  { name: "structuredClone", re: /\bstructuredClone\b/g, ios: "15.4" },
  { name: "Array.prototype.findLast", re: /\.findLast(?:Index)?\(/g, ios: "15.4" },
  { name: "Array.prototype.toSorted", re: /\.toSorted\(/g, ios: "16.4" },
  { name: "Array.prototype.toReversed", re: /\.toReversed\(/g, ios: "16.4" },
  { name: "Array.fromAsync", re: /\bArray\.fromAsync\b/g, ios: "18.4" },
  { name: "Promise.withResolvers", re: /\bPromise\.withResolvers\b/g, ios: "17.4" },
];

/**
 * Is this occurrence inside a custom property's value?
 *
 * That is what turns "does not apply" into "unsets every consumer". A
 * declaration starts after the previous `;` or `{`, so the test is
 * whether the text from there to here opens with `--name:`.
 */
export function isInCustomProperty(src, index) {
  const start = Math.max(src.lastIndexOf(";", index), src.lastIndexOf("{", index)) + 1;
  return /^\s*--[A-Za-z0-9_-]+\s*:/.test(src.slice(start, index));
}

/**
 * Classify one stylesheet's use of each feature. Pure — the caller
 * supplies the text, so the rule is testable without a tree.
 */
export function scanCss(src, label = "css") {
  const fatal = [];
  const progressive = [];
  for (const f of CSS_FEATURES) {
    for (const m of src.matchAll(f.re)) {
      const line = src.slice(0, m.index).split("\n").length;
      const where = { feature: f.name, ios: f.ios, at: `${label}:${line}` };
      if (isInCustomProperty(src, m.index)) fatal.push(where);
      else progressive.push(where);
    }
  }
  return { fatal, progressive };
}

function walk(dir, keep) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p, keep));
    else if (keep(e)) out.push(p);
  }
  return out;
}

export function main() {
  const errors = [];

  // ── 1. the app package's floor, and that it is ONE number ─────────
  const pbx = readFileSync(PBXPROJ, "utf8");
  const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([0-9.]+);/g)].map((m) => m[1]);
  if (!targets.length) {
    errors.push(
      `no IPHONEOS_DEPLOYMENT_TARGET in ${PBXPROJ.replace(root + "/", "")}.\n`
      + "  This gate cannot compare a floor it cannot find — the pbxproj shape\n"
      + "  changed, and that is the failure, not a passing build.",
    );
  }
  const distinct = [...new Set(targets)];
  if (distinct.length > 1) {
    errors.push(
      `the build configurations disagree about the minimum OS:\n    ${distinct.join(", ")}\n\n`
      + "  Xcode publishes the one belonging to the configuration that archives,\n"
      + "  so a split here means the number the App Store shows is decided by\n"
      + "  which scheme ran. Set all of them.",
    );
  }
  const FLOOR = distinct[0] ?? "0";

  // ── 2. the SPM package's floor, which may not exceed it ───────────
  const spm = readFileSync(SPM, "utf8");
  const spmM = /\.iOS\(\.v([0-9_]+)\)/.exec(spm);
  if (!spmM) {
    errors.push(`no .iOS(.vNN) platform in ${SPM.replace(root + "/", "")} — cannot compare.`);
  } else {
    const spmVer = spmM[1].replace("_", ".");
    if (iosNum(spmVer) > iosNum(FLOOR)) {
      errors.push(
        `CapApp-SPM requires iOS ${spmVer} but the app targets ${FLOOR}.\n`
        + "  Xcode refuses this outright at build time; it is here so the refusal\n"
        + "  arrives in seconds on any machine instead of at the end of a macOS run.",
      );
    }
  }

  // ── 3. the bundle's floor, which must be the SAME number ──────────
  const vite = readFileSync(VITE, "utf8");
  for (const key of ["target", "cssTarget"]) {
    const block = new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`).exec(vite);
    if (!block) {
      errors.push(
        `vite.config.ts sets no build.${key}.\n`
        + "  Unset, the floor of the shipped bundle is whatever Vite's default is\n"
        + "  this week, and the app package's floor is decided somewhere else\n"
        + "  entirely. That gap is what this gate exists for — pin it.",
      );
      continue;
    }
    const ios = /ios([0-9.]+)/.exec(block[1]);
    if (!ios) {
      errors.push(`vite.config.ts's build.${key} names no iOS version: [${block[1].trim()}]`);
    } else if (ios[1] !== FLOOR) {
      errors.push(
        `build.${key} targets iOS ${ios[1]} but the app ships to ${FLOOR}.\n`
        + "  The App Store publishes the pbxproj number as the minimum OS, so the\n"
        + "  lower of these two is the one users get and the higher is the one the\n"
        + "  bundle was built for. They have to be the same number.",
      );
    }
  }

  // ── 4. what the stylesheets actually use ──────────────────────────
  const fatal = new Map();
  const progressive = new Map();
  for (const file of walk(join(root, "src"), (e) => e.endsWith(".css"))) {
    const rel = file.replace(root + "/", "");
    const { fatal: f, progressive: p } = scanCss(readFileSync(file, "utf8"), rel);
    for (const hit of f) {
      const e = fatal.get(hit.feature) ?? { ios: hit.ios, sites: [] };
      e.sites.push(hit.at);
      fatal.set(hit.feature, e);
    }
    for (const hit of p) {
      const e = progressive.get(hit.feature) ?? { ios: hit.ios, count: 0 };
      e.count++;
      progressive.set(hit.feature, e);
    }
  }

  for (const [name, e] of fatal) {
    if (iosNum(e.ios) <= iosNum(FLOOR)) continue;
    const shown = e.sites.slice(0, 4);
    errors.push(
      `${name} needs iOS ${e.ios}, and it is used INSIDE A CUSTOM PROPERTY —\n`
      + `  ${e.sites.length} site(s), e.g. ${shown.join(", ")}${e.sites.length > shown.length ? ", …" : ""}\n\n`
      + `  The app ships to ${FLOOR}. Custom properties parse permissively, so this\n`
      + "  does not fail at parse time — it fails at substitution, and every\n"
      + "  `var()` of it computes to the property's initial value. One token,\n"
      + "  every consumer.\n\n"
      + `  Either raise the floor to ${e.ios}, or give the token an @supports\n`
      + "  fallback, or compile it down (css.transformer: 'lightningcss').",
    );
  }

  // ── 5. the JS spot-check ──────────────────────────────────────────
  const jsOver = [];
  for (const file of walk(join(root, "src"), (e) => /\.(ts|tsx|js|jsx)$/.test(e) && !/\.test\./.test(e))) {
    const src = readFileSync(file, "utf8");
    const rel = file.replace(root + "/", "");
    for (const a of JS_APIS) {
      if (iosNum(a.ios) <= iosNum(FLOOR)) continue;
      const m = [...src.matchAll(a.re)];
      if (m.length) {
        const line = src.slice(0, m[0].index).split("\n").length;
        jsOver.push(`${a.name} (iOS ${a.ios}) — ${rel}:${line}${m.length > 1 ? ` +${m.length - 1} more` : ""}`);
      }
    }
  }
  if (jsOver.length) {
    errors.push(
      `these JavaScript APIs are newer than the iOS ${FLOOR} floor:\n    `
      + jsOver.join("\n    ")
      + "\n\n  build.target lowers SYNTAX and polyfills no API, so each of these\n"
      + "  throws on a device that installed the app legitimately.",
    );
  }

  if (errors.length) {
    console.error("check-ios-floor FAILED:\n\n" + errors.map((e) => "  " + e).join("\n\n") + "\n");
    console.error(
      "  The number in the pbxproj is what the App Store publishes as the\n"
      + "  minimum OS. A build that fails this is not a broken app — it is an\n"
      + "  installable one that renders wrong, on a device the store said was\n"
      + "  supported.",
    );
    return 1;
  }

  const prog = [...progressive.entries()]
    .filter(([, e]) => iosNum(e.ios) > iosNum(FLOOR))
    .map(([name, e]) => `${name} (iOS ${e.ios}, ${e.count}×)`);

  console.log(
    `check-ios-floor OK — iOS ${FLOOR} in ${targets.length} build configuration(s), `
    + "matching build.target, build.cssTarget and CapApp-SPM.",
  );
  if (prog.length) {
    console.log(
      `  Above the floor but degrading cleanly, so allowed: ${prog.join(", ")}.\n`
      + "  These are ordinary declarations — unsupported means they do not apply,\n"
      + "  not that a token unsets. A custom property would have failed.",
    );
  }
  console.log(
    "  The JS list is a spot-check of the APIs this bundle uses, not a\n"
    + "  browserslist — build.target lowers syntax and polyfills nothing.",
  );
  return 0;
}

// Importable for its own tests (the check-data-inventory.mjs pattern);
// runs only when it IS the command.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(main());
