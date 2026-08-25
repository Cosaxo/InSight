#!/usr/bin/env node
// check-monitoring.mjs — the alert chain, end to end, from source.
//
// WHY THIS EXISTS. Alert policies are committed JSON applied BY HAND
// (`npm run monitoring:apply`), deliberately and for good reasons — D47 —
// and nothing between the repo and Cloud Monitoring can be checked from
// here. So this does not try to. What it checks is the half that IS in the
// repo, and every link in it fails the same silent way: the policy exists,
// the console is green, and the alert can never fire.
//
//   function emits `metric: "X"`  →  a log-based metric selects on X
//                                 →  a policy's condition reads that metric
//                                 →  apply-monitoring creates both
//
// Break any link and everything still looks configured. apply-monitoring's
// own header says it of the middle one: a policy created against a metric
// type that resolves to nothing "never fires, which looks identical to
// 'no contention'". That is the failure class this repo builds gates for —
// the same one behind check:deploy-targets (a function that builds, tests
// green and is never deployed) and check:appcheck (a callable that serves
// the internet because one option was omitted).
//
// THE FOUR RULES:
//
//   1. Every policy file on disk is in apply-monitoring's POLICIES list.
//      A committed policy nobody applies is check:deploy-targets' bug with
//      a different noun.
//   2. Every POLICIES entry exists on disk. The script already exits 1 on
//      this at RUN time; here it fails in CI instead of in front of an
//      operator who is applying alerts because something is on fire.
//   3. Every log-based metric a policy's conditions read is created by
//      apply-monitoring's METRICS list. This is the "never fires" link.
//   4. Every metric's `jsonPayload.metric="X"` selector matches a
//      `metric: "X"` a Cloud Function actually emits. A metric selecting on
//      a field nothing writes receives no points, and a policy on a metric
//      with no points is not merely quiet — a metric-ABSENCE condition
//      against it cannot fire at all (D48.1), so it reports health it has
//      never measured.
//
// Plus a shape check: a policy with no conditions, or no runbook, is a page
// at 3am with nothing to act on.
//
// NOT on backend-checks.yml, deliberately, and the reasoning is that
// workflow's own: what guards a PR there is what guards production, and
// nothing here says whether a rules fix is safe to deploy. An alerting
// mistake must not be able to block an emergency deploy. It belongs on
// ci.yml with the other statements-about-the-repo gates.
//
// Node stdlib only, like every other check here.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const problems = [];
const fail = (msg) => problems.push(msg);

// ── what is on disk ─────────────────────────────────────────────────
// pulse.json and rates.json are the console's own files, not policies:
// pulse.json is a generated artifact (gitignored) and rates.json is the
// cost model's input. Same exclusion the pulse collector makes.
const NOT_POLICIES = new Set(["pulse.json", "rates.json"]);
const onDisk = readdirSync(join(root, "monitoring"))
  .filter((f) => f.endsWith(".json") && !NOT_POLICIES.has(f))
  .sort();

// ── what apply-monitoring says it will create ───────────────────────
const applySrc = read("scripts/apply-monitoring.mjs");

const listedPolicies = [...applySrc.matchAll(/"(monitoring\/[\w.-]+\.json)"/g)].map((m) => m[1]);

// SCOPED TO THE METRICS ARRAY, not scraped off the whole file. `name:` is
// an ordinary key and apply-monitoring.mjs is free to grow another one —
// a notification channel, a dashboard, a future POLICIES field — and an
// unscoped scrape would let any of them vouch for a metric that the array
// does not actually declare. Clean today (the five matches are exactly the
// five METRICS entries), which is the moment to narrow it rather than
// after something else lands.
const metricsBlock = (() => {
  const from = applySrc.indexOf("const METRICS = [");
  const to = applySrc.indexOf("const POLICIES = [", from < 0 ? 0 : from);
  if (from < 0) return "";
  return applySrc.slice(from, to < 0 ? applySrc.length : to);
})();
if (!metricsBlock) fail("apply-monitoring.mjs: could not find `const METRICS = [` — has it been restructured?");

const metricNames = [...metricsBlock.matchAll(/name:\s*"([\w]+)"/g)].map((m) => m[1]);
const metricFilters = Object.fromEntries(
  [...metricsBlock.matchAll(/name:\s*"([\w]+)",[\s\S]{0,400}?filter:\s*(['"])([\s\S]*?)\2/g)]
    .map((m) => [m[1], m[3]]),
);

if (!listedPolicies.length) fail("apply-monitoring.mjs: could not find a POLICIES list — has it been restructured?");
if (!metricNames.length) fail("apply-monitoring.mjs: could not find a METRICS list — has it been restructured?");

// ── rule 1 + 2: the policy list and the directory agree ─────────────
for (const f of onDisk) {
  if (!listedPolicies.includes(`monitoring/${f}`)) {
    fail(`monitoring/${f} is committed but absent from apply-monitoring.mjs's POLICIES —\n`
      + "    it will never be applied, and nothing else says so.");
  }
}
for (const rel of listedPolicies) {
  if (!existsSync(join(root, rel))) {
    fail(`apply-monitoring.mjs lists ${rel}, which does not exist.`);
  }
}

// ── rule 3 + shape: each policy's conditions resolve ─────────────────
const USER_METRIC = /logging\.googleapis\.com\/user\/([\w]+)/g;

for (const f of onDisk) {
  let policy;
  try {
    policy = JSON.parse(read(`monitoring/${f}`));
  } catch (err) {
    fail(`monitoring/${f} is not valid JSON: ${err.message}`);
    continue;
  }

  if (!policy.displayName) fail(`monitoring/${f}: no displayName — the console lists it as untitled, and apply-monitoring matches on this to stay idempotent.`);
  if (!Array.isArray(policy.conditions) || policy.conditions.length === 0) {
    fail(`monitoring/${f}: no conditions — a policy that watches nothing.`);
  }
  if (!policy.documentation?.content) {
    fail(`monitoring/${f}: no documentation.content — this is the runbook that arrives with the page. Without it the alert says something is wrong and nothing about what to do.`);
  }

  const conditionText = JSON.stringify(policy.conditions ?? []);
  for (const [, metric] of conditionText.matchAll(USER_METRIC)) {
    if (!metricNames.includes(metric)) {
      fail(`monitoring/${f} reads log-based metric "${metric}", which apply-monitoring.mjs does not create.\n`
        + "    The policy would be created against a metric type that resolves to nothing —\n"
        + "    it never fires, and that is indistinguishable from the condition never occurring.");
    }
  }
}

// ── rule 4: each metric selects on a field a function emits ──────────
//
// COMMENTS ARE BLANKED FIRST, and this file was the last gate here that
// did not do it. Every sibling strips — check-appcheck.mjs (whose header
// records that commenting out `assertOperator` left it green),
// check-purge-listeners.mjs, check-labels.mjs, check-data-inventory.mjs,
// check-spec-globals rule 2, and check-policy-claims.mjs, whose own
// stripping landed at b3dc1c9 for "a disclosure commented out of the
// privacy page still counted as present".
//
// It matters most here, of all of them. This gate's stated purpose is
// that every link in the alert chain "fails the same silent way — the
// policy exists, the console is green, and the alert can never fire", and
// commenting out an emit is exactly how such a line goes away in practice:
// somebody silences a noisy log while debugging, and the constant name
// survives inside the comment that silenced it. Measured on this tree
// before the fix — replacing `metric: "agg_contention",` in v2.ts with a
// commented-out copy of itself left this script printing "every metric to
// a field a function emits" and exiting 0, while DELETING the same line
// outright failed it correctly. Live for a deletion, blind to a comment.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

const fnSrc = readdirSync(join(root, "functions/src"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => stripComments(read(`functions/src/${f}`)))
  .join("\n");

for (const name of metricNames) {
  const filter = metricFilters[name];
  if (!filter) {
    fail(`apply-monitoring.mjs: metric "${name}" has no filter.`);
    continue;
  }
  const selector = filter.match(/jsonPayload\.metric\s*=\s*"([\w]+)"/);
  if (!selector) continue; // a metric may legitimately select on severity or text
  const field = selector[1];
  // The house pattern is `logger.x(message, { metric: "X", … })` — see the
  // contention line in v2.ts and the reveal heartbeat in v2social.ts.
  if (!new RegExp(`metric:\\s*"${field}"`).test(fnSrc)) {
    fail(`log-based metric "${name}" selects on jsonPayload.metric="${field}", which no Cloud Function emits.\n`
      + "    The metric receives no points, so a threshold policy never fires and an\n"
      + "    ABSENCE policy cannot fire at all — it reports health it has never measured.");
  }
}

// ── report ───────────────────────────────────────────────────────────
if (problems.length) {
  console.error("check-monitoring FAILED\n");
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  process.exit(1);
}

console.log(
  `check:monitoring OK — ${onDisk.length} policies, ${metricNames.length} log-based metrics, `
  + "every condition resolves to a metric and every metric to a field a function emits.",
);
