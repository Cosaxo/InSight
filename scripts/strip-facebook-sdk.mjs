// Removes the Facebook SDK from the iOS build. Runs as `postinstall`.
//
// ── What it removes and why ─────────────────────────────────────────
//
// @capacitor-firebase/authentication links the Facebook iOS SDK into
// every iOS build, unconditionally, from its own SwiftPM manifest:
//
//   node_modules/@capacitor-firebase/authentication/Package.swift
//     .package(url: ".../facebook/facebook-ios-sdk.git", from: "18.0.0")
//     → products FacebookCore, FacebookLogin
//     → swiftSettings: .define("RGCFA_INCLUDE_FACEBOOK")
//
// The app never calls signInWithFacebook and `capacitor.config.ts`
// declares providers: ["google.com"] — so the SDK is linked, shipped and
// never initialised. That is the exact mismatch Apple's privacy labels
// and Google's Data safety form exist to catch: an undisclosed
// advertising SDK inside the binary. Declaring it would be honest and
// wrong (we do not use it); removing it makes the honest answer "no".
//
// Android needs none of this — the same plugin gates each provider
// behind a Gradle flag and `rgcfaIncludeFacebook` defaults to false, so
// `android/variables.gradle` setting only `rgcfaIncludeGoogle` already
// keeps Facebook out. The iOS SPM manifest has no equivalent switch.
// That asymmetry is why this script exists and has no Android twin.
//
// ── Why it is safe to remove ────────────────────────────────────────
//
// Verified in the plugin source rather than assumed: every FBSDK symbol
// in FacebookAuthProviderHandler.swift sits behind
// `#if RGCFA_INCLUDE_FACEBOOK` — the import, the stored `LoginManager`,
// its initialiser and each method body. The class shell itself is
// unguarded, so FirebaseAuthentication.swift's reference to it still
// compiles. Without the define, `signInWithFacebook` rejects with the
// plugin's own "provider not enabled" error, which is the correct
// behaviour for a provider we do not offer.
//
// ── Why it never fails the install ──────────────────────────────────
//
// A root `npm ci` runs on the PRODUCTION DEPLOY PATH:
// backend-checks.yml (rules-tests and e2e) is called by both ci.yml and
// firebase-deploy.yml. A postinstall that can exit non-zero would put an
// iOS-only, client-only concern in front of an emergency rules fix —
// precisely what docs/DEPLOYMENT.md says to keep off that path.
//
// So this script warns and exits 0, always. The *assertion* lives in
// `npm run check:ios-facebook`, which is wired into ci.yml's lint job
// only. Belt-and-braces on purpose: if a plugin upgrade changes the
// manifest shape so this stripper silently no-ops, the check reds a PR
// rather than a store submission.

// NOTE ON STRUCTURE: everything below the constants runs only when this
// file is executed directly, never on import. check-ios-facebook.mjs
// imports MANIFEST from here so the two cannot drift apart — and when
// the side effects were at top level, that import ran the stripper and
// hit its `process.exit(0)` before the check's own assertion. The check
// passed vacuously, which is the one way a guard is worse than no guard.
// (Node 22 has no `import.meta.main`; the argv comparison is the idiom.)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFEST = join(
  root,
  "node_modules/@capacitor-firebase/authentication/Package.swift",
);

// Exported so check:ios-facebook asserts on the same patterns this
// removes — one definition, so the two can't drift apart.
export const FACEBOOK_PATTERNS = [
  // dependency entry
  /^\s*\.package\([^)]*facebook-ios-sdk[^)]*\).*\r?\n/gm,
  // target products
  /^\s*\.product\(name:\s*"Facebook[^"]*",\s*package:\s*"facebook-ios-sdk"\),?.*\r?\n/gm,
  // the conditional-compilation flag that activates the handler
  /^\s*\.define\("RGCFA_INCLUDE_FACEBOOK"\),?.*\r?\n/gm,
];

export function stripFacebook(src) {
  let out = src;
  for (const re of FACEBOOK_PATTERNS) out = out.replace(re, "");
  // Removing the last entry of a Swift array literal can leave a dangling
  // comma before the bracket. Swift accepts trailing commas in collection
  // literals, so this is tidiness rather than correctness — but a manifest
  // a human may open should not look half-edited.
  out = out.replace(/,(\s*\n\s*\])/g, "$1");
  return out;
}

function main() {
  // `postinstall` also runs in contexts where the plugin isn't installed
  // (a `--prefix functions` install, a partial tree). Nothing to do is not
  // an error.
  if (!existsSync(MANIFEST)) {
    console.log(
      "strip-facebook-sdk: @capacitor-firebase/authentication not installed — nothing to do.",
    );
    return;
  }

  const before = readFileSync(MANIFEST, "utf8");

  if (!/facebook/i.test(before)) {
    console.log("strip-facebook-sdk: already clean — no Facebook linkage in the iOS SPM manifest.");
    return;
  }

  const after = stripFacebook(before);

  if (/facebook/i.test(after)) {
    // The manifest mentions Facebook in a shape these patterns don't match —
    // an upgrade changed its layout. Warn as loudly as a non-failing script
    // can, and let check:ios-facebook turn it into a red PR.
    console.warn(
      "::warning::strip-facebook-sdk: the plugin manifest still references Facebook\n" +
        "after stripping. Its layout probably changed in an upgrade. The iOS build\n" +
        "will link the Facebook SDK until the patterns in this script are updated —\n" +
        "see docs/DECISIONS.md D15. `npm run check:ios-facebook` fails until then.",
    );
    return;
  }

  writeFileSync(MANIFEST, after);
  console.log(
    "strip-facebook-sdk: removed the Facebook SDK from the iOS SPM manifest " +
      "(dependency, 2 products, RGCFA_INCLUDE_FACEBOOK).",
  );
}

// Direct execution only — see the structure note at the top.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
