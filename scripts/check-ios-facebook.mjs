// Asserts the Facebook SDK is not linked into the iOS build.
//
//   npm run check:ios-facebook
//
// The removal itself is `scripts/strip-facebook-sdk.mjs`, run as
// postinstall. This is the half that can fail, and the split is
// deliberate: a root `npm ci` runs on the production deploy path
// (backend-checks.yml, called by both ci.yml and firebase-deploy.yml),
// so the stripper must never exit non-zero. This check is wired into
// ci.yml's lint job instead — client-only, off the deploy path, and it
// reds a PR rather than a store submission.
//
// What it catches that the stripper cannot report itself:
//   - a plugin upgrade that changes the manifest layout, so the
//     stripper's patterns silently match nothing
//   - a tree where postinstall did not run (`npm ci --ignore-scripts`,
//     a restored node_modules cache, a hand-copied checkout)
//   - someone reinstalling the plugin and committing the result
//
// See docs/DECISIONS.md D14 for why the SDK is excluded rather than
// declared on the store forms.

import { readFileSync, existsSync } from "node:fs";
import { MANIFEST } from "./strip-facebook-sdk.mjs";

// Pass vacuously ONLY when there is no plugin to check. Anything else
// that "finds nothing" is a bug in this script, not a clean tree.
if (!existsSync(MANIFEST)) {
  console.error(
    "check:ios-facebook: @capacitor-firebase/authentication is not installed.\n" +
      "Run `npm ci` first — this check reads the installed SPM manifest, which\n" +
      "is what SwiftPM actually resolves against.",
  );
  process.exit(1);
}

const src = readFileSync(MANIFEST, "utf8");
const hits = src
  .split("\n")
  .map((line, i) => [i + 1, line])
  .filter(([, line]) => /facebook/i.test(line));

if (hits.length) {
  console.error(
    `check:ios-facebook: the iOS SPM manifest still links the Facebook SDK.\n\n` +
      `  ${MANIFEST}\n`,
  );
  for (const [n, line] of hits) console.error(`    ${n}: ${line.trim()}`);
  console.error(
    `\nEvery iOS build from this tree would ship the Facebook SDK — linked,\n` +
      `never initialised, and undisclosed on the privacy labels. That is the\n` +
      `mismatch Apple's and Google's forms exist to catch.\n\n` +
      `Fix: re-run \`node scripts/strip-facebook-sdk.mjs\`. If it reports that\n` +
      `it stripped nothing, the plugin changed its manifest layout — update\n` +
      `FACEBOOK_PATTERNS in that script. Do NOT relax this check; a linkage\n` +
      `eslint and tsc cannot see is one a store reviewer's binary scan can.\n\n` +
      `Background: docs/DECISIONS.md D14.`,
  );
  process.exit(1);
}

console.log(
  "check:ios-facebook OK — no Facebook linkage in the iOS SPM manifest.",
);
