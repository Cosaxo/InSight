// What ci.yml's lint job runs, as a pure function of the workflow source.
//
// ITS OWN FILE for gate-placement.mjs's reason, which is not a style
// preference but the only shape that is testable: check-all.mjs is a CLI
// that reads ci.yml, spawns forty-odd gates and exits on the result, all at
// import. A test importing THAT would run the entire lint job as a side
// effect of collection — minutes of subprocesses, and a red tree would kill
// the test run mid-flight. A pure function in a module with no top-level
// work is importable by both.

// Under this and the parse is wrong, not the tree. The lint job carried 46
// steps when this was written; the floor is deliberately far below that, so
// ordinary growth and pruning never trip it and a structural change does.
export const FLOOR = 30;

/**
 * The commands ci.yml's lint job runs, in order.
 *
 * Text, not YAML: this repo has no yaml dependency and its other workflow
 * readers (check-deploy-targets.mjs, gate-placement.mjs) do the same. Comment
 * lines go first for the reason gate-placement.mjs records — these workflows
 * explain themselves at length, and the gates most likely to be DESCRIBED in
 * a comment are the ones a naive match gets wrong.
 *
 * @param {string} src  ci.yml's contents
 * @returns {string[]}  every `- run:` command in the lint job, in order
 */
export function lintSteps(src) {
  const live = String(src).split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const start = live.indexOf("\n  lint:\n");
  if (start < 0) throw new Error("lint-steps: ci.yml has no `lint:` job — fix this parser");
  const rest = live.slice(start + 1);
  // The next job at the same indent ends the block. `\n  \w` rather than a
  // job-name list: this must not need editing when a job is added.
  const end = rest.search(/\n {2}[A-Za-z0-9_-]+:\n/);
  const block = end < 0 ? rest : rest.slice(0, end);
  // A `run: |` block inside lint would be silently truncated to nothing by
  // the single-line match below, which is the failure this whole file is
  // about. There are none today; if one arrives, this stops rather than
  // quietly dropping it.
  // Both spellings: `- run: |` opens a step, `run: |` follows a `name:`.
  // The first was missed when this guard was written, and its own test is
  // what found that — a guard against silent truncation that was itself
  // blind to the commoner shape.
  if (/^\s+(?:- )?run: \|/m.test(block)) {
    throw new Error(
      "lint-steps: ci.yml's lint job now has a multi-line `run: |` step, which "
      + "this parser cannot read. Teach it that shape — do not let it skip one.",
    );
  }
  return [...block.matchAll(/^\s+- run: (.+)$/gm)].map((m) => m[1].trim());
}

/**
 * CI's setup steps, which are not gates. They exist in the workflow because a
 * fresh runner has no node_modules; running them locally would reinstall the
 * tree on every invocation.
 *
 * @param {string} cmd
 */
export const isSetup = (cmd) => /^npm ci\b/.test(cmd);
