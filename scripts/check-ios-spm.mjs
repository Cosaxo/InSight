// Guards the one non-obvious thing holding the iOS build together (D10).
//
// THE PROBLEM. SwiftPM derives a package's *identity* from the last
// component of its path, and two packages with the same identity are a hard
// resolution failure. At its published path, @capacitor-firebase/app-check
// lands in node_modules/@capacitor-firebase/app-check → identity
// `app-check`. github.com/google/app-check — pulled in transitively by
// GoogleSignIn, which @capacitor-firebase/authentication needs — has the
// same identity. SwiftPM prefers the local package, GoogleSignIn then fails
// to find its `AppCheckCore` product, and dependency resolution dies before
// a single file compiles:
//
//   error: Could not resolve package dependencies:
//     product 'AppCheckCore' required by package 'googlesignin-ios' target
//     'GoogleSignIn' not found in package 'app-check'.
//
// THE FIX. package.json installs the plugin under an npm ALIAS, so it lands
// in node_modules/capacitor-firebase-app-check and its identity changes with
// its path. Nothing else about the plugin changes.
//
// WHY THIS SCRIPT. The alias is invisible at every call site except one
// import, and the obvious "tidy-up" — reinstalling the package under its
// real scoped name — silently reverts it. The break is then a 4-minute
// macOS CI failure with an error message that names neither package.json
// nor the alias. This check fails in seconds, on every platform, and says
// what to do.
//
// DELETE THIS when the collision is fixed upstream (either
// @capacitor-firebase/app-check renaming its package, or SwiftPM growing
// per-dependency identity overrides) — and verify by reverting the alias
// and watching iOS build.
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALIAS = "capacitor-firebase-app-check";
const REAL = "@capacitor-firebase/app-check";

const problems = [];

// 1 · package.json declares the alias, and not the scoped name.
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

if (!deps[ALIAS]) {
  problems.push(
    `package.json has no "${ALIAS}" dependency.\n` +
      `    Install it as an alias:  npm i '${ALIAS}@npm:${REAL}@^8.3.0'`,
  );
} else if (!deps[ALIAS].startsWith(`npm:${REAL}@`)) {
  problems.push(
    `"${ALIAS}" is not an alias of ${REAL} (found "${deps[ALIAS]}").`,
  );
}

if (deps[REAL]) {
  problems.push(
    `package.json depends on "${REAL}" directly, which reintroduces the\n` +
      `    SwiftPM identity collision. Remove it; the aliased entry replaces it.`,
  );
}

// 2 · The generated SPM manifest points at the aliased path. This is the
//     one that actually decides the identity, and `cap sync` rewrites it —
//     so a stale checkout, or a sync run against a reverted package.json,
//     shows up here rather than on a macOS runner.
const SPM = join(root, "ios", "App", "CapApp-SPM", "Package.swift");
let spm = "";
try {
  spm = readFileSync(SPM, "utf8");
} catch {
  problems.push(`${SPM} is missing — run \`npx cap sync ios\`.`);
}
if (spm) {
  if (spm.includes(`node_modules/${REAL}`)) {
    problems.push(
      `ios/App/CapApp-SPM/Package.swift still references node_modules/${REAL}.\n` +
        `    Its last path component is "app-check", which collides with\n` +
        `    github.com/google/app-check. Run \`npx cap sync ios\` and commit.`,
    );
  }
  if (!spm.includes(`node_modules/${ALIAS}`)) {
    problems.push(
      `ios/App/CapApp-SPM/Package.swift does not reference node_modules/${ALIAS}.\n` +
        `    Run \`npx cap sync ios\` and commit the result.`,
    );
  }
}

// 3 · No source imports the scoped name. It would resolve to nothing (the
//     package is not installed under it) and fail the build — but with a
//     module-not-found error that gives no hint the alias is deliberate.
try {
  const hits = execFileSync(
    "git",
    ["grep", "-l", "-F", `from "${REAL}"`, "--", "src", "scripts"],
    { cwd: root, encoding: "utf8" },
  ).trim();
  if (hits) {
    problems.push(
      `these files import "${REAL}", which is not installed under that name:\n` +
        hits.split("\n").map((f) => `      ${f}`).join("\n") +
        `\n    Import "${ALIAS}" instead.`,
    );
  }
} catch (err) {
  // git grep exits 1 with no output when nothing matches — the good case.
  if (err.status !== 1) {
    problems.push(`could not scan sources for "${REAL}" imports: ${err.message}`);
  }
}

if (problems.length) {
  console.error(`check:ios-spm: ${problems.length} problem(s).\n`);
  for (const p of problems) console.error(`  - ${p}\n`);
  console.error(
    "This guards the npm alias that keeps the iOS build resolvable.\n" +
      "See docs/DECISIONS.md D10 for why it exists.",
  );
  process.exit(1);
}

console.log(`check:ios-spm OK — ${REAL} is aliased to ${ALIAS}, no identity collision`);
