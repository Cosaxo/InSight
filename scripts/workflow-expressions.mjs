// Would GitHub Actions LOAD this workflow file?
//
// Shared by check-deploy-targets.mjs (the deploy path's own workflow) and
// check-workflows.mjs (all of them, ci only). ONE copy on purpose: D197 is
// the record of a bank parser living in three, where the copy with a
// try/catch reported an invented figure instead of failing. A scanner
// whose whole subject is "prose that looks like code" is the last thing to
// keep three versions of.
//
// WHAT IT CATCHES. GitHub substitutes `${{ … }}` textually across the
// whole file before anything runs, `run:` bodies included — where a `#` is
// shell, not YAML, and GitHub has no idea it is looking at a comment. So
// prose ABOUT an expression is an expression. D455's step wrote the
// sentence "`${{ }}` is a textual substitution" as a shell comment inside
// its own run body; empty is not a parsable expression; the file failed to
// LOAD, which is worse than any job failing:
//
//   - no log, because nothing executed (the logs endpoint 404s);
//   - no name, because `name:` is in the file that did not parse;
//   - no `on:` filter either, so every push to EVERY branch made a failed
//     run — 33 across 8 branches that workflow does not run on;
//   - and no deploy for 31 hours, the commit that broke it included.
//
// WHY IT WALKS THE FILE RATHER THAN GREPPING IT. Where the text sits is
// the entire question. The identical sentence is safe in auth-config.yml
// and play-release.yml, where it is a YAML comment that YAML strips before
// GitHub sees anything, and fatal in a block scalar, which YAML hands over
// verbatim. A grep cannot tell those apart: the first cut of this check
// failed on its own explanation. (The same trap check-deploy-targets.mjs
// avoids further down by stripping comments before looking for `--force` —
// inverted here, because not stripping is precisely what GitHub does
// inside a run body.)

/** Lines that open a YAML block scalar: `run: |`, `script: >-`, `- run: |`. */
const OPENS_BLOCK = /^(\s*)(?:-\s+)?[A-Za-z_][\w.-]*:\s*[|>][-+]?[0-9]*\s*$/;

/**
 * Reasons `text` would not load, each already a full sentence naming
 * `label` and a line number. Empty array means it parses.
 */
export function expressionFaults(text, label) {
  const faults = [];
  const lines = text.split("\n");
  // Indentation of the key that opened the block scalar we are inside, or
  // -1 for "not in one". Content belongs to the block while it stays
  // indented past that key.
  let blockIndent = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = line.search(/\S/);

    if (blockIndent >= 0 && indent !== -1 && indent <= blockIndent) {
      blockIndent = -1; // dedented out of the block scalar
    }
    const inBlock = blockIndent >= 0;
    // OUTSIDE a block scalar a leading `#` is a real YAML comment: YAML
    // drops it and GitHub never sees it. INSIDE one it is script text.
    const isYamlComment = !inBlock && indent !== -1 && line.trimStart().startsWith("#");

    if (!isYamlComment) {
      if (inBlock && line.trimStart().startsWith("#") && line.includes("${{")) {
        // Prose about an expression, where GitHub substitutes. Fatal
        // whether or not it is empty — and a NON-empty one is worse than
        // the bug this was written for, since `${{ secrets.X }}` written
        // as an aside pastes the secret into the script, where `set -x` or
        // an error message can print it.
        faults.push(
          `${label}:${i + 1}: \`\${{\` inside a shell comment in a \`run:\` body`
          + " — GitHub substitutes it before bash ever sees the `#`. Move the"
          + " sentence to a YAML comment outside the body, as auth-config.yml"
          + " does.",
        );
      } else if (/\$\{\{\s*\}\}/.test(line)) {
        faults.push(
          `${label}:${i + 1}: an EMPTY \`\${{ }}\` where GitHub reads it — not a`
          + " parsable expression, so the whole file fails to load.",
        );
      }
    }

    if (blockIndent < 0) {
      const open = OPENS_BLOCK.exec(line);
      if (open) blockIndent = open[1].length;
    }
  }
  return faults;
}
