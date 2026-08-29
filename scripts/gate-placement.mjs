// gate-placement.mjs — where a check gate runs, from the workflows.
//
// ITS OWN FILE because the test needs it and doc-index.mjs is a CLI: that
// module runs its whole check at import and calls process.exit(1) on a
// failure, so a test importing it would run the gate as a side effect and
// die mid-collection whenever the tree was red. A pure function in a
// module with no top-level work is importable by both.
//
// The extraction has a second reason, which is the one that produced it.
// The first test for this classifier proved the by-path form by DELETING
// the invocation from a tracked release workflow and restoring it in a
// `finally` — and a `finally` does not survive a SIGKILL or a cancelled
// job. The line it removed is the gate that refuses an iOS archive with an
// unfilled sign-in id or Team ID, so the crash-shaped failure was "the
// release gate quietly disappears from the release workflow": the very
// defect the gate exists to prevent, produced by its own test.

/**
 * Where a gate runs, as a pure function of its package.json command and the
 * workflow sources — exported so the two invocation forms can be tested
 * without editing a workflow.
 *
 * That is not a convenience. The first version of this test proved the
 * by-path form by DELETING the invocation from a tracked release workflow
 * and restoring it in a `finally` — and a `finally` does not survive a
 * SIGKILL or a cancelled CI job. The line it removed is the gate that
 * refuses an iOS archive with an unfilled sign-in id or Team ID, so the
 * crash-shaped failure was "the release gate quietly disappears from the
 * release workflow", which is the exact defect the gate exists to prevent.
 *
 * @param {string} name  the gate's npm script name, e.g. "check:store-copy"
 * @param {string|undefined} command  what package.json runs for it
 * @param {Map<string,string>|Iterable<[string,string]>} workflows  file → source
 */
export function gatePlacement(name, command, workflows) {
  // Both invocation forms count. `npm run <name>` is the common one; a
  // workflow that needs to pass an argument writes `node scripts/<file>.mjs
  // --flag` instead, and matching only the first said one gate was
  // "manual" while a release workflow ran it on every archive.
  const paths = [...String(command ?? "").matchAll(/\bscripts\/[\w.-]+\.mjs/g)].map((m) => m[0]);
  const runs = [...workflows]
    .filter(([, src]) =>
      src.includes(`npm run ${name}`) || paths.some((path) => src.includes(path)))
    .map(([f]) => f);
  if (runs.includes("backend-checks.yml")) return "deploy";
  if (runs.includes("ci.yml")) return "ci";
  if (runs.length) return "release";
  return "manual";
}
