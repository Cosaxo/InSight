// Does every exported Cloud Function appear in the deploy workflow's
// --only list?
//
// That list names every deployed function by hand — no count here on
// purpose, because the list grows and a number written beside it goes
// stale the same way the list itself would. A function added to
// functions/src/index.ts but not to the string is built, passes every
// test, goes green — and is never deployed. Same silent shape as
// storage.rules being configured and deployed by nothing.
//
// Parses the source with a regex rather than importing it: importing
// functions/src would need a build, and the modules register triggers as
// an import side effect. This stays independent of both.
//
// Escape hatch: ALLOW_UNDEPLOYED=name1,name2 for functions deliberately
// left out (a work-in-progress trigger, say).

import { readFileSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every non-test source under functions/src, discovered rather than
// listed: the hardcoded list this replaced silently missed the first new
// module added after it (moderation.ts) — three functions built, tested,
// green, and invisible to the one gate whose whole job is catching that.
// RECURSIVE. `readdirSync` without it returns directory ENTRIES, which the
// .ts filter then drops silently — so a callable in functions/src/duels/
// would be invisible here and in check-appcheck.mjs, and neither script's
// vacuity counter can save it: both count only what they read. Latent while
// functions/src is flat, which is exactly how the moderation.ts miss this
// script's own comment records happened.
import { readdirSync } from "node:fs";
const SOURCES = readdirSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "functions", "src"),
  { recursive: true },
)
  .map((f) => String(f).split(sep).join("/"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => `functions/src/${f}`);
const WORKFLOW = ".github/workflows/firebase-deploy.yml";

const allowed = new Set(
  (process.env.ALLOW_UNDEPLOYED || "").split(",").map((s) => s.trim()).filter(Boolean),
);

let exported = [];
try {
  for (const rel of SOURCES) {
    const src = readFileSync(resolve(root, rel), "utf8");
    // `export const NAME = onCall(...)` / onSchedule / onDocumentCreated…
    for (const m of src.matchAll(/^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*on[A-Z]/gm)) {
      exported.push({ name: m[1], file: rel });
    }
  }
} catch (err) {
  console.error(
    "check-deploy-targets: could not read a functions source file.\n"
    + "If a file was renamed, update SOURCES in this script.\n"
    + String(err),
  );
  process.exit(1);
}

if (!exported.length) {
  console.error(
    "check-deploy-targets: found NO exported functions, which cannot be right.\n"
    + "The export pattern probably changed — fix this script rather than\n"
    + "letting it pass vacuously.",
  );
  process.exit(1);
}

const workflow = readFileSync(resolve(root, WORKFLOW), "utf8");

// BEFORE ANYTHING ELSE: does the file GitHub Actions LOADS at all?
//
// Everything below asks whether the deploy list is right. This asks the
// prior question, which nothing asked until it had already cost a night:
// whether this workflow parses. GitHub substitutes `${{ … }}` textually
// across the whole file before anything runs, INCLUDING inside a `run:`
// body — where a `#` is shell, not YAML, and GitHub has no idea it is
// looking at a comment. So prose ABOUT an expression is an expression.
//
// D455's step wrote the sentence "`${{ }}` is a textual substitution" as
// a shell comment inside its own run body. Empty is not a parsable
// expression, so the file failed to LOAD — and a load failure is worse
// than anything else this script catches. No job runs, so there is no
// log; the `on:` filters live in the file GitHub could not read, so every
// push to EVERY branch produced a failed run named
// `.github/workflows/firebase-deploy.yml` rather than "Deploy Firebase
// backend"; and across 33 such runs over two days nothing deployed at
// all — the buy door in the very commit that broke it included.
//
// WHERE THE TEXT SITS IS THE WHOLE QUESTION, which is why this walks the
// file rather than grepping it. The identical sentence is safe in
// auth-config.yml and fatal here: there it is a YAML comment, which YAML
// strips before GitHub sees anything, and here it was inside a block
// scalar, which YAML hands over verbatim. A grep cannot tell those apart,
// and the first cut of this check failed on its own explanation — the
// same trap the comment-stripping directly below exists to avoid, except
// that strip must NOT happen up here, because not stripping is precisely
// what GitHub does inside a run body.
//
// Scoped to this one workflow, the file this script already owns, rather
// than to all of .github/workflows: check:deploy-targets runs on the
// deploy path, and CLAUDE.md's rule is that nothing which cannot speak to
// whether a rules fix is safe may block one. This clears that bar the
// short way — a firebase-deploy.yml that cannot load has already blocked
// every deploy, so failing here only ever pre-empts a worse outcome and
// can never stop a deploy that would otherwise have worked.
const exprFaults = [];
{
  const lines = workflow.split("\n");
  // Indentation of the key that opened the block scalar we are inside,
  // or -1 for "not in one". Content belongs to the block while it stays
  // indented past that key.
  let blockIndent = -1;
  const OPENS_BLOCK = /^(\s*)(?:-\s+)?[A-Za-z_][\w.-]*:\s*[|>][-+]?[0-9]*\s*$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = line.search(/\S/);

    if (blockIndent >= 0 && indent !== -1 && indent <= blockIndent) {
      blockIndent = -1; // dedented out of the block scalar
    }
    const inBlock = blockIndent >= 0;
    // Outside a block scalar a leading `#` is a real YAML comment: YAML
    // drops it and GitHub never sees it. Inside one it is script text.
    const isYamlComment = !inBlock && indent !== -1 && line.trimStart().startsWith("#");

    if (!isYamlComment) {
      if (inBlock && line.trimStart().startsWith("#") && line.includes("${{")) {
        // Prose about an expression, in a place GitHub substitutes. Fatal
        // whether or not it is empty — and a NON-empty one is worse than
        // the bug this was written for, since `${{ secrets.X }}` written
        // as an aside pastes the secret into the script.
        exprFaults.push(
          `${WORKFLOW}:${i + 1}: \`\${{\` inside a shell comment in a \`run:\``
          + " body — GitHub substitutes it before bash ever sees the `#`."
          + " Move the sentence to a YAML comment outside the body, as"
          + " auth-config.yml does.",
        );
      } else if (/\$\{\{\s*\}\}/.test(line)) {
        exprFaults.push(
          `${WORKFLOW}:${i + 1}: an EMPTY \`\${{ }}\` where GitHub reads it —`
          + " not a parsable expression, so the whole file fails to load.",
        );
      }
    }

    if (blockIndent < 0) {
      const open = OPENS_BLOCK.exec(line);
      if (open) blockIndent = open[1].length;
    }
  }
}

if (exprFaults.length) {
  console.error(
    `check-deploy-targets: ${WORKFLOW} would not load.\n`
    + exprFaults.map((f) => `    ${f}`).join("\n"),
  );
  process.exit(1);
}
// COMMENTS OFF FIRST, and every match rather than the first.
//
// Two bugs, one shape. This read the file raw and took `.match`, which is
// the LEFTMOST occurrence — so a `# e.g. --only "functions:…"` line above
// the step answered for the step, and the live list could be truncated to
// two names with the gate printing "42 exported functions, all present in
// --only". Commenting the deploy step out entirely did the same. Measured
// both ways before this line changed.
//
// The `--force` rule at the bottom of this same file already strips
// comments and says why — "a scanner that reads its own explanation as the
// thing it forbids is worse than no scanner". Only one of the file's two
// halves had the fix; this is the other half.
//
// Every `--only` is unioned because the deploy is allowed to be split
// across steps, which is exactly what the --force rule below exists to
// police: reading one of them would make the gate depend on which step
// happens to come first.
const liveWorkflow = workflow.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
const onlyLists = [...liveWorkflow.matchAll(/--only\s+"([^"]*functions:[^"]*)"/g)];
if (!onlyLists.length) {
  console.error(`check-deploy-targets: no --only list found in ${WORKFLOW}`);
  process.exit(1);
}
const deployed = new Set(
  onlyLists.flatMap((o) => [...o[1].matchAll(/functions:([A-Za-z0-9_]+)/g)].map((m) => m[1])),
);

// …and no deploy may combine --force with a firestore target.
//
// --force is a deploy-wide flag. firebase-tools reads it as
// `shouldDeleteIndexes = options.force` and `shouldDeleteFields =
// options.force` (lib/firestore/api.js), so `--force --only
// "firestore:indexes,functions:…"` deletes every index and field override
// the live project holds that firestore.indexes.json does not name. The
// two the repo asks an operator to create by hand (the v2_agg_events TTL
// of LAUNCH-RUNBOOK §5.1, and the composite index v2social.ts names for
// the duel scan) are exactly the shape it removes.
//
// This paragraph used to add "and that file names exactly one index (the
// v2_takes list composite, D65)". It has named more than one for a while —
// indexes.test.ts is the live account of which query shapes resolve
// against it — and the argument never rested on the count.
//
// The flag is still needed for retry-enabled triggers, hence a split rather
// than a ban: --force on the functions-only step, no --force on the
// rules+indexes one. Checked here rather than left to review because the
// deletion is silent, the run stays green, and the symptom arrives whenever
// the TTL next mattered.
// Comments are stripped first: the prose above the split step names both
// `--force` and a firestore target, and a scanner that reads its own
// explanation as the thing it forbids is worse than no scanner. (The same
// mistake check:globals rule 2 used to make on spec-index.js.)
const steps = workflow
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n")
  .split(/^\s*- name:/m);

const forcedFirestore = steps.filter(
  (s) => /npx firebase deploy/.test(s)
    && /--force\b/.test(s)
    && /--only\s+"[^"]*firestore:/.test(s),
);

if (forcedFirestore.length) {
  console.error(
    `check-deploy-targets: ${WORKFLOW} deploys a firestore target under --force.\n`
    + forcedFirestore.map((s) => `    ${s.trim().replace(/\s+/g, " ").slice(0, 160)}…`).join("\n")
    + "\n\n  --force makes firebase-tools DELETE every index and field override the\n"
    + "  project holds that firestore.indexes.json does not list. Split the step:\n"
    + '  `--only "firestore:rules,firestore:indexes"` with no --force, then\n'
    + '  `--force --only "functions:…"`.',
  );
  process.exit(1);
}

const missing = exported.filter((f) => !deployed.has(f.name) && !allowed.has(f.name));
const stale = [...deployed].filter((n) => !exported.some((f) => f.name === n));

for (const f of missing) {
  console.error(`MISSING from the deploy list: ${f.name}  (${f.file})`);
}
for (const n of stale) {
  console.error(`STALE in the deploy list — no such export: ${n}`);
}

if (missing.length || stale.length) {
  console.error(
    "\nA function missing from --only is built, tested, green and never\n"
    + "deployed. Add it to the list in " + WORKFLOW + ", or set\n"
    + "ALLOW_UNDEPLOYED=" + missing.map((f) => f.name).join(",") + " if that is deliberate.",
  );
  process.exit(1);
}

console.log(
  `deploy-targets OK — ${exported.length} exported functions, all present in --only`
  + (allowed.size ? ` (${allowed.size} explicitly allowed undeployed)` : ""),
);
