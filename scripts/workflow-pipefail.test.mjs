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

  // PER JOB, not per file, and the difference is a real hole. `outcome` is
  // only readable inside the job that produced it, and this searched the
  // whole FILE — so a workflow with the same step id in two jobs satisfied
  // the rule on the strength of the other job's readback. `device-screens.yml`
  // is the first file here with that shape (`drive` in both the Android and
  // the iOS job). Measured: deleting only the Android job's
  // `echo "drive: ${{ steps.drive.outcome }}"` left this suite at 15 passed,
  // exit 0; deleting BOTH correctly failed. So the rule was not vacuous, it
  // was scoped one level too wide.
  //
  // Latent rather than live — a per-job audit of every workflow found each
  // optional step read back in its own job — which is why this is a
  // tightening and not a fix with a red test behind it. The splitter it
  // needs is the one the pipe-to-shell rule below already brought.
  for (const f of files) {
    const src = readWorkflow(join(dir, f));
    // A file with no `jobs:` block parses to nothing; fall back to the whole
    // file so such a workflow is still checked rather than silently skipped.
    const perJob = jobs(src);
    const scopes = perJob.length ? perJob : [{ name: "(whole file)", text: src }];
    const carrying = scopes
      .map((j) => ({ j, steps: parse(j.text).filter((s) => optionalOn(s.body)) }))
      .filter((x) => x.steps.length);
    if (!carrying.length) continue;
    it(`${f} gives every optional step an id and reads it back in its own job`, () => {
      for (const { j, steps } of carrying) {
        for (const s of steps) {
          const id = /\bid:\s*([\w-]+)/.exec(s.body);
          expect(
            id,
            `${f}:${j.name} has a continue-on-error step with no \`id:\` — nothing can read its `
              + `outcome, so its failure is invisible on a green run:\n${s.head.trim()}`,
          ).toBeTruthy();
          expect(
            j.text.includes(`steps.${id[1]}.outcome`),
            `${f}:${j.name} never reads \`steps.${id[1]}.outcome\` IN THAT JOB — the step can fail with the `
              + "run still green and nothing said. An outcome read in a different job of the same "
              + "file does not count:\n" + s.head.trim(),
          ).toBe(true);
        }
      }
    });
  }

  it("finds the optional steps this rule is about", () => {
    const optional = files.flatMap((f) =>
      parse(readWorkflow(join(dir, f))).filter((s) => optionalOn(s.body)));
    expect(optional.length, "no continue-on-error steps found on a healthy path — the rule measures nothing")
      .toBeGreaterThan(1);
  });

  it("one job's readback does not answer for another's — a positive control", () => {
    // The exact shape the file-wide search could not tell apart: one step
    // id, two jobs, and only one of them reporting.
    const src = [
      "jobs:",
      "  a:",
      "    steps:",
      "      - name: Drive",
      "        id: drive",
      "        continue-on-error: true",
      "        run: echo hi",
      "      - name: Report",
      '        run: echo "drive: ${{ steps.drive.outcome }}"',
      "  b:",
      "    steps:",
      "      - name: Drive",
      "        id: drive",
      "        continue-on-error: true",
      "        run: echo hi",
      "",
    ].join("\n");
    const [a, b] = jobs(src);
    expect(a.name).toBe("a");
    expect(b.name).toBe("b");
    expect(parse(a.text).filter((s) => optionalOn(s.body)).length).toBe(1);
    expect(parse(b.text).filter((s) => optionalOn(s.body)).length).toBe(1);
    expect(a.text.includes("steps.drive.outcome"), "job a should report its own step").toBe(true);
    expect(b.text.includes("steps.drive.outcome"), "job b reports nothing, and the file-wide search could not see that").toBe(false);
    // …and the file-wide reading, which is what shipped, cannot tell them
    // apart at all.
    expect(src.includes("steps.drive.outcome"), "the old file-scoped test passed on this input").toBe(true);
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
 * WHERE THIS RULE STOPS. It holds free-text inputs and SECRETS, not every
 * `${{ }}`: `github.sha`, `runner.temp` and a `type: choice` cannot carry
 * a payload, and a rule that cried about them would be turned off. The
 * other classic carrier — an issue title or PR body through
 * `pull_request_target` / `issue_comment` — has no instance here because
 * no workflow uses those triggers at all; if one ever does, this is the
 * function to widen.
 *
 * SECRETS JOINED THE RULE ON 2026-09-11, and the scope note above is why
 * they were not in it: it reasoned about what an ATTACKER can put in a
 * box, and a secret is set by the operator. But the substitution is the
 * same substitution — the value is spliced in before bash parses the line
 * — so a password holding a quote, a backtick or a dollar is a broken
 * command at best, and `$( )` inside the double quotes it usually sits in
 * executes at worst. `play-release.yml` had exactly one such site, on the
 * keystore sanity check run immediately before signing, in a job that also
 * holds the Play service account and the decoded keystore; every other
 * secret in every other workflow here already went through `env:`. So this
 * rule costs nothing today and holds the shape that was one edit away.
 */
describe("free-text inputs never reach a run body", () => {
  it("finds the free-text inputs this rule is about", () => {
    const all = new Set();
    for (const f of files) for (const n of freeTextInputs(readWorkflow(join(dir, f)))) all.add(n);
    // Vacuity guard: if this ever hits zero the parser has broken and
    // every case below would pass by finding nothing.
    expect(all.size, "no free-text workflow inputs found at all — freeTextInputs() has stopped parsing").toBeGreaterThan(0);
  });

  it("no run block interpolates a secret either", () => {
    // Secrets go in `env:` and are read as `"$NAME"`, which is what every
    // workflow here does — see the note above for why this joined the rule.
    const bad = [];
    for (const f of files) {
      const src = readWorkflow(join(dir, f));
      for (const { body } of runBlocks(src)) {
        for (const m of body.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)) {
          bad.push(`${f}: \${{ secrets.${m[1]} }}`);
        }
      }
    }
    expect(
      bad,
      "a secret is interpolated into a run body, where it is spliced in before bash parses the line — bind it in the step's env: and read \"$NAME\" instead",
    ).toEqual([]);
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

/**
 * Each job's own text, so a rule can be about a JOB rather than a file.
 *
 * File scope is not close enough for the rule below — a workflow with two
 * jobs would satisfy it on the strength of the other one's checkout — and
 * it is the same weakness this file's continue-on-error rule already has,
 * written down here so whoever fixes that one has the splitter to hand.
 */
function jobs(src) {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const out = [];
  let cur = null;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^ {2}([A-Za-z_][\w-]*):\s*$/.exec(lines[i]);
    if (m) { cur = { name: m[1], lines: [] }; out.push(cur); continue; }
    if (lines[i].trim() !== "" && /^\S/.test(lines[i])) break;
    if (cur) cur.lines.push(lines[i]);
  }
  return out.map((j) => ({ name: j.name, text: j.lines.join("\n") }));
}

/** `curl … | bash`, and the three other spellings of the same thing. */
const PIPE_TO_SHELL = /\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba|z|k)?sh\b/;

/**
 * WHY THIS RULE EXISTS. `device-screens.yml`'s iOS job pipes an unpinned
 * installer into bash. That is a DELIBERATE trade with its reasoning at
 * the step — the version that works is recorded into the results and
 * pinned from there rather than guessed — so this rule does not forbid it.
 * What came with it by accident was a repo write token: the job runs under
 * `permissions: contents: write`, and `actions/checkout` leaves that
 * credential in `.git/config` by default, where anything running
 * afterwards can read it. Nothing in that job needed it — publish.sh does
 * `git init` in a fresh directory and pushes with an explicit
 * x-access-token URL — so the fix cost one line and left the trade alone.
 *
 * The rule is the general form: run somebody else's script if you must,
 * but not beside a credential you are not using.
 */
describe("a job that runs a remote script keeps no credential on disk", () => {
  const risky = [];
  for (const f of files) {
    const src = readWorkflow(join(dir, f));
    for (const j of jobs(src)) if (PIPE_TO_SHELL.test(j.text)) risky.push({ f, j });
  }

  it("finds the jobs this rule is about — vacuous otherwise", () => {
    // If the tree ever stops piping anything into a shell this becomes a
    // rule about nothing, and it should be deleted rather than left
    // passing. Until then a zero here means the splitter broke.
    expect(risky.length, "no job pipes a remote script into a shell — has jobs() stopped parsing?").toBeGreaterThan(0);
  });

  it("none of them persists its checkout credentials", () => {
    const bad = risky
      .filter(({ j }) => /actions\/checkout/.test(j.text) && !/persist-credentials:\s*false/.test(j.text))
      .map(({ f, j }) => `${f}:${j.name}`);
    expect(
      bad,
      "a job pipes a remote script into a shell AND leaves its checkout credentials in .git/config — "
        + "add `with: persist-credentials: false` to that job's checkout, or stop piping",
    ).toEqual([]);
  });

  it("the rule can actually fail — a positive control", () => {
    const job = [
      "  demo:",
      "    steps:",
      "      - uses: actions/checkout@abc",
      "      - run: curl -fsSL https://example.test/i | bash",
    ].join("\n");
    const src = `jobs:\n${job}\n`;
    const [only] = jobs(src);
    expect(only.name).toBe("demo");
    expect(PIPE_TO_SHELL.test(only.text)).toBe(true);
    expect(/persist-credentials:\s*false/.test(only.text)).toBe(false);
    const fixed = src.replace("checkout@abc", "checkout@abc\n        with:\n          persist-credentials: false");
    expect(/persist-credentials:\s*false/.test(jobs(fixed)[0].text)).toBe(true);
  });
});

/**
 * The hosting deploy runs the gates that guard what it ships.
 *
 * `firebase-deploy.yml` triggers on `web/**` and deploys hosting, and its
 * only `needs:` is `backend-checks.yml`, which says nothing about the
 * hosting payload. The five gates that DO — headers, CSP hashes, policy
 * claims, public copy, the ask page's price — live in `ci.yml` alone,
 * which on a push to main runs in PARALLEL with the deploy and therefore
 * gates nothing it does.
 *
 * The precedent is one gate over, and it is written in this repo's own
 * comments: `check:pricing` was moved onto the deploy path after "a push
 * to main deployed the stale card while ci.yml went red beside it, in
 * parallel, too late". `check:ask-pricing` — the gate on the price the
 * PUBLIC door prints — did not move with it. The CSP case is the silent
 * one: a stale hash ships a page whose own scripts are blocked, with
 * nothing red anywhere.
 *
 * A rule rather than a fix at one site, because the next gate added to
 * ci.yml for `web/` will be added by somebody who has not read this.
 */
const HOSTING_GATES = [
  "check:web-headers",
  "check:csp-hashes",
  "check:policy-claims",
  "check:public-copy",
  "check:ask-pricing",
];

describe("the hosting deploy runs the gates that guard what it ships", () => {
  const src = readWorkflow(join(dir, "firebase-deploy.yml"));
  const blocks = runBlocks(src);
  const deploysHosting = (b) => /firebase\s+deploy\b[^\n]*--only\s+"hosting"/.test(b.body);
  const hostingAt = blocks.findIndex(deploysHosting);
  const gatesMissingBefore = (bs, at) => {
    const before = bs.slice(0, at).map((b) => b.body).join("\n");
    return HOSTING_GATES.filter((g) => !new RegExp(`npm run ${g}(\\s|$)`, "m").test(before));
  };

  it("finds the hosting deploy at all — the rule must not pass vacuously", () => {
    expect(
      hostingAt,
      "no step in firebase-deploy.yml deploys hosting — has the deploy moved, or has runBlocks stopped parsing?",
    ).toBeGreaterThanOrEqual(0);
  });

  it("every one of them runs in an earlier step of the same job", () => {
    expect(
      gatesMissingBefore(blocks, hostingAt),
      "firebase-deploy.yml deploys hosting without running these gates first — they guard exactly what that step "
        + "ships, and ci.yml runs them in parallel with this workflow, which is too late",
    ).toEqual([]);
  });

  it("a commented-out gate does not satisfy it — a positive control", () => {
    // The trap this whole file was rewritten for: a rule that reads raw
    // text is satisfied by prose. Blanking the `npm run` line behind a
    // `#` must read as absent, and deleting it must read the same way.
    const synthetic = [
      "jobs:",
      "  deploy:",
      "    steps:",
      "      - name: Gate the hosting payload",
      "        run: |",
      ...HOSTING_GATES.map((g) => `          npm run ${g}`),
      "      - name: Deploy hosting",
      '        run: npx firebase deploy --project x --non-interactive --only "hosting"',
      "",
    ].join("\n");
    const ok = runBlocks(stripYamlComments(synthetic));
    expect(gatesMissingBefore(ok, ok.findIndex(deploysHosting))).toEqual([]);

    const commented = synthetic.replace("          npm run check:csp-hashes", "          # npm run check:csp-hashes");
    const hidden = runBlocks(stripYamlComments(commented));
    expect(
      gatesMissingBefore(hidden, hidden.findIndex(deploysHosting)),
      "commenting a gate out left the rule green — the comment stripper is not reaching the run body",
    ).toEqual(["check:csp-hashes"]);
  });
});
