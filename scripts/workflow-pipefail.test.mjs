// Every workflow step that pipes into `tee` must set pipefail.
//
// `cmd | tee file` reports TEE's exit status, which is 0 whatever `cmd`
// did. A step written that way is a green check over a job that failed —
// and the jobs written that way are the ones nobody watches: scheduled
// probes, deploy pushes, the nightly observer.
//
// The observer had exactly that shape, under a comment arguing pipefail
// was unnecessary because "only a broken credential or a broken script is
// an error" — which is the case it was masking. Measured on the exact
// step body: exit 0 under GitHub's default `bash -e`, exit 1 under
// `bash -eo pipefail`. Every other `| tee` step in the repo already set
// it, citing this trap; that one did not, and nothing could see the
// difference.
//
// A rule, not a fix at one site, because the next `| tee` will be written
// by somebody who has not read this paragraph.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, ".github", "workflows");
const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

/**
 * Each `run:` block of a workflow, as raw text.
 *
 * Deliberately not a YAML parse: what matters is the shell body GitHub
 * hands to bash, and a step's `run:` is a block scalar whose indentation
 * is the whole structure. Split on the next key at the step's own indent.
 */
function runBlocks(src) {
  const out = [];
  const lines = src.split("\n");
  let stepStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s+name:/.test(lines[i])) stepStart = i;
    const m = /^(\s*)run:\s*\|/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") { body.push(line); continue; }
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break;
      body.push(line);
    }
    // The step's own keys, so an exemption can be read off them.
    out.push({ head: lines.slice(stepStart, i).join("\n"), body: body.join("\n") });
  }
  return out;
}

/**
 * A step this rule is about: it really pipes a command into `tee`, and
 * its exit status really matters.
 *
 * `| tee` inside prose does not count — several of these blocks quote the
 * trap in a comment or echo it into the job summary, which is how the
 * first version of this rule reported two false positives. A real one
 * writes somewhere: `tee "$RUNNER_TEMP/x.log"` or `tee -a`.
 *
 * `continue-on-error: true` is a genuine exemption rather than an
 * oversight: GitHub ignores that step's status by construction, so
 * pipefail cannot change the job's outcome. The one instance is a
 * diagnostic log tail that runs only `if: failure()` — it exists to
 * print, and a failure to print must not mask the failure it is printing.
 */
const teePipes = (b) => (b.match(/\|\s*tee\s+(-a\s+)?["$]/g) || []).length;
const isExempt = (head) => /continue-on-error:\s*true/.test(head);

describe("workflow steps that pipe into tee", () => {
  it("finds run blocks at all — the parser must not pass vacuously", () => {
    const total = files.reduce((n, f) => n + runBlocks(readFileSync(join(dir, f), "utf8")).length, 0);
    expect(total, "no `run: |` blocks parsed — the split is broken, not the workflows").toBeGreaterThan(20);
  });

  it("finds the tee steps this rule is about", () => {
    const teed = files.flatMap((f) =>
      runBlocks(readFileSync(join(dir, f), "utf8")).filter((s) => teePipes(s.body)));
    expect(teed.length, "no `| tee` steps found — the rule is measuring nothing").toBeGreaterThan(3);
  });

  for (const f of files) {
    const steps = runBlocks(readFileSync(join(dir, f), "utf8"))
      .filter((s) => teePipes(s.body) && !isExempt(s.head));
    if (!steps.length) continue;
    it(`${f} sets pipefail in every step that pipes into tee`, () => {
      for (const s of steps) {
        const teeLines = s.body.split("\n").filter((l) => teePipes(l)).join("\n");
        expect(
          /set\s+-[a-z]*o?\s*pipefail|set\s+-[a-z]*eo[a-z]*\s+pipefail/.test(s.body),
          `${f} has a step piping into tee without \`set -o pipefail\` — it reports `
            + `tee's exit status, so the job goes green whatever the command did:\n${teeLines}`,
        ).toBe(true);
      }
    });
  }
});
