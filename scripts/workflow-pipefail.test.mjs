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

/**
 * Blank YAML/shell comments, keeping every offset.
 *
 * BOTH RULES IN THIS FILE READ RAW TEXT, and both were satisfied by a
 * comment. Measured: commenting out `set -o pipefail` in a workflow left
 * all 846 script tests green, while DELETING the same line failed
 * correctly — so the pin was on the characters, not on the setting. The
 * outcome rule was worse: commenting out every real `steps.<id>.outcome`
 * read in the quiet-deploy reporter — the step that exists because a
 * rules deploy failed silently on every run — also left the suite green.
 *
 * This is the `// registerPlugin(DeviceBindPlugin.class);` class, in the
 * one file that guards the workflows, and two sibling gates were fixed
 * for exactly it on 2026-09-04.
 *
 * `#` only, because these are YAML files whose `run:` bodies are shell —
 * both use `#`. Quoted `#` is left alone, which is the same trade
 * strip-comments.mjs documents for JS: an exact answer needs a parser, and
 * a parser is a much larger thing to get wrong. Blanking rather than
 * deleting keeps line numbers and offsets, which the messages below quote.
 */
const stripYamlComments = (src) =>
  src.split("\n").map((line) => {
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === "#") return line.slice(0, i) + " ".repeat(line.length - i);
    }
    return line;
  }).join("\n");

const readWorkflow = (path) => stripYamlComments(readFileSync(path, "utf8"));


const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, ".github", "workflows");
const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

/**
 * Each `run:` block of a workflow, as raw text.
 *
 * Deliberately not a YAML parse: what matters is the shell body GitHub
 * hands to bash, and a step's `run:` is a block scalar whose indentation
 * is the whole structure. Split on the next key at the step's own indent.
 *
 * EVERY `run:` SPELLING, not just `run: |`. This matched the literal
 * block scalar alone, so a step written `run: cmd | tee "$X"` on one
 * line — or as a folded `run: >`, two of which already exist in
 * firebase-deploy.yml — was never parsed and so never subject to the
 * rule below. That is not a missed case; it is the rule silently ceasing
 * to apply, and neither vacuity floor above can see it: rewriting one
 * step that way does not fail its per-file case, it DELETES it, while
 * `total > 20` counts blocks repo-wide and `teed.length > 3` still holds
 * on the steps that stayed.
 *
 * A one-line body can still be judged correctly — the assertion reads
 * the body text for `set -o pipefail`, and a one-liner that does not
 * carry it fails, which is right.
 */
function runBlocks(src) {
  const out = [];
  const lines = src.split("\n");
  let stepStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s+name:/.test(lines[i])) stepStart = i;
    // Group 2 is the block indicator (`|`, `>`, with any chomping or
    // explicit-indent suffix) when there is one; group 3 is the rest of
    // the line, which is the body itself for a plain scalar.
    const m = /^(\s*)run:\s*([|>][-+0-9]*)?[ \t]*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const inline = m[2] ? "" : m[3].trim();
    const indent = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") { body.push(line); continue; }
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break;
      body.push(line);
    }
    // The step's own keys, so an exemption can be read off them. The
    // inline remainder leads the body: for a plain scalar it IS the
    // command, and any indented lines after it are its continuation.
    out.push({
      head: lines.slice(stepStart, i).join("\n"),
      body: (inline ? inline + "\n" : "") + body.join("\n"),
    });
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
    const total = files.reduce((n, f) => n + runBlocks(readWorkflow(join(dir, f))).length, 0);
    expect(total, "no `run: |` blocks parsed — the split is broken, not the workflows").toBeGreaterThan(20);
  });

  it("finds the tee steps this rule is about", () => {
    const teed = files.flatMap((f) =>
      runBlocks(readWorkflow(join(dir, f))).filter((s) => teePipes(s.body)));
    expect(teed.length, "no `| tee` steps found — the rule is measuring nothing").toBeGreaterThan(3);
  });

  for (const f of files) {
    const steps = runBlocks(readWorkflow(join(dir, f)))
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

// ── the other way a workflow step fails invisibly ────────────────────
//
// `continue-on-error: true` removes a step from the job's conclusion
// entirely: it can fail and the run is still green. That is deliberate
// where it is used — nothing about static hosting should abort a rules
// deploy — and it is only safe if something REPORTS the outcome. The
// deploy workflow's own comments said the failure would be "surfaced in
// the job summary" while the file had no summary step and read no
// outcome, and that is exactly how `--only storage:rules` failed on every
// deploy until a run log was audited by hand.
//
// The rule is per file rather than global: a workflow may legitimately
// have no such steps.
describe("continue-on-error steps are reported somewhere", () => {
  const parse = (src) => {
    // Steps as raw blocks, split on the `- name:` boundary the whole file
    // uses. A YAML parse would be heavier and no more truthful here: what
    // matters is the text GitHub reads.
    const out = [];
    const lines = src.split("\n");
    let cur = null;
    for (const line of lines) {
      if (/^\s*-\s+name:/.test(line)) {
        if (cur) out.push(cur);
        cur = { head: line, body: "" };
      } else if (cur) cur.body += line + "\n";
    }
    if (cur) out.push(cur);
    return out;
  };

  // A step that only runs ON a failure cannot hide one: the run is already
  // red, and its job is to add context to it — both of the repo's are "Why
  // it failed — the function's own log". The rule is about steps that run
  // on a HEALTHY path and are allowed to fail quietly there.
  const optionalOn = (body) =>
    /continue-on-error:\s*true/.test(body) && !/if:\s*failure\(\)/.test(body);

  for (const f of files) {
    const src = readWorkflow(join(dir, f));
    const steps = parse(src).filter((s) => optionalOn(s.body));
    if (!steps.length) continue;
    it(`${f} gives every optional step an id and reads it back`, () => {
      for (const s of steps) {
        const id = /\bid:\s*([\w-]+)/.exec(s.body);
        expect(
          id,
          `${f} has a continue-on-error step with no \`id:\` — nothing can read its `
            + `outcome, so its failure is invisible on a green run:\n${s.head.trim()}`,
        ).toBeTruthy();
        expect(
          src.includes(`steps.${id[1]}.outcome`),
          `${f} never reads \`steps.${id[1]}.outcome\` — the step can fail with the `
            + "run still green and nothing said:\n" + s.head.trim(),
        ).toBe(true);
      }
    });
  }

  it("finds the optional steps this rule is about", () => {
    const optional = files.flatMap((f) =>
      parse(readWorkflow(join(dir, f))).filter((s) => optionalOn(s.body)));
    expect(optional.length, "no continue-on-error steps found on a healthy path — the rule measures nothing")
      .toBeGreaterThan(1);
  });
});

/**
 * The dispatch/call inputs a caller can type ANYTHING into.
 *
 * GitHub constrains `type: choice` to its declared options and
 * `type: boolean`/`number` to their shapes; everything else — `type:
 * string`, or an input with no `type:` at all — is free text. This walks
 * the `inputs:` map textually, like the rest of this file, rather than
 * pulling a YAML parser in: `yaml` and `js-yaml` are only transitively
 * present here, and a gate that stops working when a transitive dep moves
 * is not a gate.
 */
function freeTextInputs(src) {
  const lines = src.split("\n");
  const out = new Set();
  for (let i = 0; i < lines.length; i++) {
    const head = /^(\s*)inputs:\s*$/.exec(lines[i]);
    if (!head) continue;
    const outer = head[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      const lead = lines[j].length - lines[j].trimStart().length;
      if (lead <= outer) break;
      const entry = /^(\s*)([A-Za-z_][\w-]*):\s*$/.exec(lines[j]);
      if (!entry || entry[1].length <= outer) continue;
      const at = entry[1].length;
      let type = "";
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k].trim() === "") continue;
        const kl = lines[k].length - lines[k].trimStart().length;
        if (kl <= at) break;
        const t = /^\s*type:\s*(\S+)/.exec(lines[k]);
        if (t) { type = t[1]; break; }
      }
      if (type === "" || type === "string") out.add(entry[2]);
    }
  }
  return out;
}

/**
 * WHY THIS RULE EXISTS. `${{ }}` is a TEXTUAL substitution GitHub performs
 * on the run body before bash is handed the script, so a free-text input
 * pasted into a `run:` is not an argument — it is code, running with that
 * step's secrets in its environment. `auth-config.yml`'s App Store Connect
 * step held `ASC_PRIVATE_KEY` and pasted two of them; measured with the
 * step's own body and a stand-in key, a `set_version` of
 * `2.0.0$(printf %s "$ASC_PRIVATE_KEY" > /tmp/exfil.txt)` wrote the key to
 * the file, exited 0, and left the step log reading `--set-version 2.0.0`.
 * An honest operator was bitten by the same hole more quietly: a value
 * with a space in it split into two arguments.
 *
 * The fix at every site is the same — bind the input in the step's `env:`
 * and read `"$NAME"` in the shell, which is the pattern these files
 * already use for their secrets.
 *
 * WHERE THIS RULE STOPS. It holds free-text inputs only, not every
 * `${{ }}`: `github.sha`, `runner.temp` and a `type: choice` cannot carry
 * a payload, and a rule that cried about them would be turned off. The
 * other classic carrier — an issue title or PR body through
 * `pull_request_target` / `issue_comment` — has no instance here because
 * no workflow uses those triggers at all; if one ever does, this is the
 * function to widen.
 */
describe("free-text inputs never reach a run body", () => {
  it("finds the free-text inputs this rule is about", () => {
    const all = new Set();
    for (const f of files) for (const n of freeTextInputs(readWorkflow(join(dir, f)))) all.add(n);
    // Vacuity guard: if this ever hits zero the parser has broken and
    // every case below would pass by finding nothing.
    expect(all.size, "no free-text workflow inputs found at all — freeTextInputs() has stopped parsing").toBeGreaterThan(0);
  });

  it("no run block interpolates one", () => {
    const bad = [];
    for (const f of files) {
      const src = readWorkflow(join(dir, f));
      const free = freeTextInputs(src);
      if (!free.size) continue;
      for (const { body } of runBlocks(src)) {
        for (const name of free) {
          // Both spellings GitHub accepts for the same value.
          const re = new RegExp(String.raw`\$\{\{\s*(?:inputs|github\.event\.inputs)\.` + name + String.raw`\s*\}\}`);
          if (re.test(body)) bad.push(`${f}: \${{ inputs.${name} }}`);
        }
      }
    }
    expect(
      bad,
      "a free-text workflow input is interpolated into a run body, where it is code rather than an argument — bind it in the step's env: and read \"$NAME\" instead",
    ).toEqual([]);
  });
});
