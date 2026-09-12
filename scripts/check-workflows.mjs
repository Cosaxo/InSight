// Would every workflow file LOAD?
//
// The refusals are workflow-expressions.mjs's, and the reasoning for them
// lives there. This is the half that asks the question of ALL of them.
//
// WHY A SECOND GATE RATHER THAN WIDENING THE FIRST. check:deploy-targets
// asks the same question of firebase-deploy.yml, and it runs on the deploy
// path. Widening THAT to all of them would put a prose mistake in
// ios-release.yml between an emergency rules fix and production, which is
// the trade CLAUDE.md names at length and refuses. firebase-deploy.yml is
// the one file exempt from the objection — a copy that cannot load has
// already blocked every deploy, so failing early only pre-empts a worse
// outcome — and the other 24 are not, so they are checked here, in ci,
// where a red gate reds a pull request and nothing else.
//
// It checks firebase-deploy.yml too, deliberately: the overlap costs
// nothing, and a gate that carved out the one file another gate happens to
// cover would be one reorganisation away from covering nothing.
//
// WHAT IT IS NOT. Not a workflow linter. It asks one question — does the
// expression layer parse — because that is the question whose failure is
// SILENT. A wrong `runs-on` or a bad action SHA fails loudly, in a job,
// with a log. This class fails with no job and no log, under a run named
// after the file's own path, on every branch at once.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expressionFaults } from "./workflow-expressions.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(root, ".github", "workflows");

let names;
try {
  names = readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
} catch {
  console.error(`check-workflows: cannot read ${DIR}`);
  process.exit(1);
}

// A scanner that reads nothing and reports success is the D179/D197 shape:
// green because it looked at an empty list. This repo has twenty-odd
// workflows and will not plausibly have none. A COUNT IS NOT WRITTEN HERE
// on purpose: three sentences across this file, check-deploy-targets.mjs
// and ci.yml each said 25 on the day a 26th was added by the same commit
// as one of them, and the gate prints the real figure on every run.
if (!names.length) {
  console.error("check-workflows: no workflow files found — the tree moved, or this glob is wrong.");
  process.exit(1);
}

const faults = [];
for (const name of names) {
  const rel = `.github/workflows/${name}`;
  faults.push(...expressionFaults(readFileSync(join(DIR, name), "utf8"), rel));
}

if (faults.length) {
  console.error(
    "check-workflows: a workflow would not load. GitHub creates a failed run\n"
    + "with NO jobs and NO log for this, named after the file's path rather than\n"
    + "the workflow, on every branch — because the `on:` filters are inside the\n"
    + "file it could not parse (D465).\n",
  );
  for (const f of faults) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`check-workflows OK — ${names.length} workflows, every \${{ }} parses where GitHub reads it.`);
