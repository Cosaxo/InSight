// fn-boot-rules.mjs — the two rules check:fn-boot applies, as pure
// functions of a module list.
//
// ITS OWN MODULE for gate-placement.mjs's reason, which that file learned
// the hard way: check-fn-boot.mjs is a CLI that spawns a subprocess and
// calls process.exit, so a test importing it would run the whole gate as a
// side effect. And the alternative — driving the real gate by editing an
// import in functions/src and rebuilding — would have a test mutate
// tracked source and restore it in a `finally`, which is exactly the shape
// gate-placement.mjs's header forbids: a `finally` does not survive a
// SIGKILL or a cancelled job, and what the crash would leave behind here
// is the barrel import whose removal is the thing being tested.
//
// So the I/O stays in the CLI and the judgement lives here, fed a list.

/**
 * What is wrong with a boot graph, or an empty array.
 *
 * @param {string[]} modules  every file in the eager require graph
 * @param {{maxModules: number, deny: Array<{match: string, why: string}>}} rules
 * @returns {Array<{rule: "deny"|"grew"|"shrank", match?: string, hits?: string[], count?: number}>}
 */
export function evaluateBootGraph(modules, { maxModules, deny }) {
  const problems = [];

  // Rule 1 — a package the app provably does not use may not be parsed on
  // every cold start. Substring rather than exact package name on purpose:
  // the v1 API is a PATH inside a package the app does use
  // (firebase-functions/lib/v1/), so a package-level test could not name it.
  for (const entry of deny) {
    const hits = modules.filter((m) => m.includes(entry.match));
    if (hits.length) problems.push({ rule: "deny", match: entry.match, hits });
  }

  // Rule 2 — check:globals rule 4's shape. Growth fails; a SHRINK fails
  // too, asking for the baseline to come down with the improvement, because
  // a ratchet that only notices growth lets the number drift back to an old
  // ceiling for free.
  if (modules.length > maxModules) problems.push({ rule: "grew", count: modules.length });
  else if (modules.length < maxModules) problems.push({ rule: "shrank", count: modules.length });

  return problems;
}

/** The packages behind a module list, for the OK line's count. */
export function packagesOf(modules) {
  return new Set(
    modules
      .filter((m) => m.includes("node_modules/"))
      .map((m) => m.replace(/^.*node_modules\//, ""))
      .map((m) => (m.startsWith("@") ? m.split("/").slice(0, 2).join("/") : m.split("/")[0])),
  );
}

// ── the denylist ───────────────────────────────────────────────────────
// A package here is one this app does not use, with how it last got in.
// Nothing is listed on taste: the test is "does the repository call it".
export const DENY = [
  {
    match: "@firebase/database-compat",
    why: "the Realtime Database client. This app is Firestore-only — no getDatabase, no .ref(). "
       + "It arrived through `import { logger } from \"firebase-functions\"`, the root barrel, "
       + "which re-exports the v2 `database` provider. Import from \"firebase-functions/logger\" "
       + "(identical function objects) or the specific v2 subpath you need.",
  },
  {
    match: "firebase-functions/lib/v1/",
    why: "the v1 Cloud Functions API. Every function here is v2 (onCall, onDocument*, onSchedule). "
       + "The root `firebase-functions` barrel loads v1 alongside v2 — import a subpath instead.",
  },
];
