// A step that reads another step's `outcome` must be able to RUN.
//
// GitHub inserts an implicit `success()` into any `if:` that names no
// status function. So a step conditioned on `steps.X.outcome == 'failure'`
// — and nothing else — is skipped in exactly the state its condition
// describes: the job is failing, the implicit success() is false, and the
// condition is only ever EVALUATED after X passed, where it is false. The
// step cannot fire.
//
// That shipped. `pulse.yml`'s responder was written to hand a red operator
// gate to a Routine that prepares the operator's answer — the lane exists,
// its prompt is on main, the runbook describes it — and the step could not
// execute on the only day it is for. A short runway or a stale scorecard
// would have produced a red morning email and no responder, forever, with
// nothing saying so.
//
// Nothing could see it. The condition is not code, so no runner reads it;
// `workflow-pipefail.test.mjs` — whose second block is about steps that
// fail invisibly — stays green over an `if:` naming a step that is not
// even in the file. Measured: that mutation was run.
//
// TWO WAYS TO MAKE IT REACHABLE, and both are already in this repo:
//   - name a status function in the condition (`failure()`, `always()`),
//     as firebase-deploy.yml's quiet-deploy reporter does; or
//   - give the read step `continue-on-error: true`, so the job is not
//     failing and the implicit success() holds — security-audit.yml's
//     two audited steps.
// Which one is right is a judgement about the JOB's colour, not about the
// condition: continue-on-error turns the run green, which is wrong wherever
// the redness is the signal.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, ".github", "workflows");
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));

/** Steps as raw text blocks, split on the `- name:` boundary. */
function steps(src) {
  const out = [];
  let cur = null;
  for (const line of src.split("\n")) {
    if (/^\s*-\s+name:/.test(line)) {
      if (cur) out.push(cur);
      // The newline matters: `head + body` is scanned as one text below,
      // and without it the name line runs into the step's first key —
      // which is how the first draft of this file decided that
      // security-audit's two `continue-on-error` steps had no `id:`.
      cur = { head: line + "\n", body: "" };
    } else if (cur) cur.body += line + "\n";
  }
  if (cur) out.push(cur);
  return out;
}

/** Step ids, so a condition cannot name one that does not exist. */
const idsOf = (src) => new Set([...src.matchAll(/^\s*id:\s*([A-Za-z0-9_-]+)\s*$/gm)].map((m) => m[1]));

/** `continue-on-error: true` on the step with this id. */
function tolerant(src, id) {
  const block = steps(src).find((s) => new RegExp(`^\\s*id:\\s*${id}\\s*$`, "m").test(s.head + s.body));
  return !!block && /continue-on-error:\s*true/.test(block.head + block.body);
}

// A status function anywhere in the condition displaces the implicit
// success(). `cancelled()` counts: it is a deliberate choice about when
// the step runs, not an oversight.
const NAMES_STATUS = /\b(?:failure|always|cancelled|success)\s*\(\s*\)/;

describe("a step that reads another step's outcome", () => {
  it("finds outcome readers at all — the scan must not pass vacuously", () => {
    const n = files.reduce((acc, f) => acc + steps(readFileSync(join(dir, f), "utf8"))
      .filter((s) => (s.body.match(/^[ \t]*if:.*$/gm) || [])
        .some((l) => /steps\.[A-Za-z0-9_-]+\.outcome/.test(l))).length, 0);
    expect(n, "no `steps.X.outcome` conditions found — the split is broken, not the workflows")
      .toBeGreaterThan(0);
  });

  for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    const ids = idsOf(src);
    // The `if:` KEY, anchored to the start of its line. A loose `if:`
    // match reads the word out of a comment — this file's own explanation
    // of the trap contains "any `if:` that names no status function", and
    // the first draft matched THAT, found no outcome in it, and passed
    // every check vacuously. Caught by the mutation, not by reading.
    const ifLines = (b) => (b.match(/^[ \t]*if:.*$/gm) || []);
    const readerLine = (b) => ifLines(b).find((l) => /steps\.[A-Za-z0-9_-]+\.outcome/.test(l));
    const readers = steps(src).filter((s) => readerLine(s.body));
    if (!readers.length) continue;

    it(`${f} can actually run every step it conditions on an outcome`, () => {
      for (const s of readers) {
        const cond = readerLine(s.body) || "";
        const named = [...cond.matchAll(/steps\.([A-Za-z0-9_-]+)\.outcome/g)].map((m) => m[1]);
        // The step it names has to exist, or the condition is a constant.
        for (const id of named) {
          expect(ids.has(id), `${f}: \`${s.head.trim()}\` reads steps.${id}.outcome — no step has that id`).toBe(true);
        }
        // …and the job must be able to reach it: either the condition
        // names a status function, or every step it reads tolerates its
        // own failure.
        const reachable = NAMES_STATUS.test(cond) || named.every((id) => tolerant(src, id));
        expect(
          reachable,
          `${f}: \`${s.head.trim()}\` is conditioned on ${named.map((i) => `steps.${i}.outcome`).join(", ")} `
            + "but names no status function, and the step(s) it reads do not carry `continue-on-error: true`. "
            + "GitHub's implicit success() means it is SKIPPED exactly when that outcome is 'failure'. "
            + "Add failure()/always() to the condition, or continue-on-error to the step it reads — "
            + "the choice is about whether the job should still go red.",
        ).toBe(true);
      }
    });
  }
});
