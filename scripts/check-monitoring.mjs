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
// THE EIGHT RULES:
//
// (Four when this list was written. Rules 5 to 8 were each added by a
// production failure the four could not see — a filter the API rejects, a
// rate limit on the wrong condition type, documentation with content and
// no MIME type — and the heading was never moved. A count in prose is the
// one documentation error this repo keeps re-committing, and this one sat
// inside a gate.)
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
//   5. Every metric-based condition filter also restricts `resource.type`.
//      Cloud Monitoring REJECTS a create without one — 400, "must specify a
//      restriction on resource.type" — and nothing in this repo could see
//      that until an --apply run took the error in production on
//      2026-08-26, having already created the channel, all five metrics and
//      one policy. Five of the eight committed policies had a bare
//      `metric.type=…` filter. Rule 3 proves the metric a condition names
//      exists; only this proves the filter is one the API will accept.
//
//   8. `documentation.content` and `documentation.mimeType` are present
//      together or not at all. The API: "non-empty content requires
//      non-empty MIME type and vice versa" — a 400, not a default. Three of
//      the eight carried content with no mimeType while the other five set
//      `text/markdown`, and every rule above passed over them, because rule
//      3's shape check asks whether the runbook EXISTS.
//
//      Found by the validation sweep that was supposed to end these, and
//      filed as harmless — "omission is accepted, the field is optional".
//      It is not, and production said so on the next run. Worth keeping as
//      the reason this is a gate rather than a note: a sweep can misjudge a
//      severity, and a gate only has to notice the field is missing.
//
//   6. `alertStrategy.notificationRateLimit` appears ONLY on a policy whose
//      condition is `conditionMatchedLog`. The v3 discovery document says
//      of it: "Required for log-based alerting policies, i.e. policies with
//      a LogMatch condition. This limit is not implemented for alerting
//      policies that do not have a LogMatch condition." SEVEN of the eight
//      committed policies carried it; the API refused the second one it was
//      asked to create. The trap is the phrase "log-based": these policies
//      threshold a log-BASED METRIC, which does not make the POLICY
//      log-based — the API classifies by condition type.
//
//   7. `conditionAbsent.duration` is at most 84600s (23h30m). A server-side
//      ceiling that appears in NEITHER the discovery document NOR
//      alert.proto — both state only a 120s minimum — so an earlier review
//      refuted it from the schema's silence and was wrong. Silence is not
//      permission. Production met it, and six independent public repos
//      record it, several as live-verified.
//
//      The gate holds the API limit. It cannot hold the DESIGN consequence,
//      which is sharper: a once-daily job has an 86400s healthy gap, longer
//      than the longest window the API accepts, so no absence policy can
//      watch one without paging every morning. The three nightly policies
//      are trailing-24h THRESHOLDS for that reason (D303's amendment has
//      the arithmetic), and only `scheduledDuelReveals` — two-hourly, 6h
//      window — is still an absence.
//
//      SHAPE ONLY, and the limit is worth stating: this cannot check the
//      VALUE. A filter naming a resource type the series never carries is
//      accepted, enabled, listed and permanently green — worse than the
//      400, because nothing says so. `npm run observe -- --metrics` reads
//      one real log entry per metric and reports the type it actually
//      carries; that is the check for the value, and it needs production.
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
import { stripComments } from "./strip-comments.mjs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const problems = [];
const fail = (msg) => problems.push(msg);

// ── what apply-monitoring says it will create ───────────────────────
// Read BEFORE the disk scan, because it is half of what decides which
// files on disk are policies at all.
// COMMENTS OFF. Rules 1-3 read this raw, so commenting out one policy in
// the POLICIES list left the gate green while its own rule 1 — "a
// committed policy nobody applies" — was exactly what the tree then had;
// and block-commenting a metric out of METRICS left a policy pointed at a
// metric type nothing creates, which the gate's own error text calls
// "health it has never measured". Both measured before this line.
//
// Rule 4 in this same file has stripped comments since it was written,
// with five lines explaining that a commented-out emitter is precisely
// this shape. The rules above it never got it.
const applySrc = stripComments(read("scripts/apply-monitoring.mjs"));

const listedPolicies = [...applySrc.matchAll(/"(monitoring\/[\w.-]+\.json)"/g)].map((m) => m[1]);
const metricNames = [...applySrc.matchAll(/name:\s*"([\w]+)"/g)].map((m) => m[1]);

// ── what is on disk ─────────────────────────────────────────────────
// A file is a POLICY CANDIDATE if apply-monitoring names it, OR if it
// carries the shape of one (displayName plus a conditions array, which
// every Cloud Monitoring alert policy has). The union matters, and getting
// it wrong is how this gate stops being a gate:
//
//   - SHAPE ALONE is self-defeating. Three of the rules below exist to
//     catch a policy missing `displayName`, `conditions` or
//     `documentation.content` — so filtering on the first two means the
//     malformed file is silently excluded instead of reported, and the
//     gate goes green on exactly the fault it was written for. That is
//     what this filter did between two commits on 2026-08-26.
//   - NAME ALONE misses a stray policy nobody wired into apply-monitoring,
//     which is rule 1's whole subject.
//   - A DENYLIST of non-policies (what this was before, pulse.json and
//     rates.json) was already one short: the first `scorecard --fetch` to
//     write monitoring/engagement.json made this gate demand a runbook of
//     the engagement trail. A list that must be edited whenever somebody
//     adds a file starts lying at the moment somebody is adding a file.
//
// So: named-or-shaped in, everything else out. engagement.json is neither.
// The machine-written artifacts this directory holds. They are gitignored,
// rebuilt by the console, and the one thing here likely to be caught
// mid-write — which is the whole reason unparseable JSON is tolerated at
// all. Naming them keeps that tolerance to its stated subject.
const MACHINE_WRITTEN = new Set(["pulse.json"]);
const unreadable = [];

const looksLikePolicy = (f) => {
  if (!f.endsWith(".json")) return false;
  if (listedPolicies.includes(`monitoring/${f}`)) return true;
  let p;
  // A half-written artifact is not a policy, and must not take the gate
  // down either — monitoring/pulse.json is machine-written and gitignored,
  // so it is the file here most likely to be caught mid-write.
  //
  // But "unparseable" was being read as "not a policy", so a committed
  // file that is broken JSON — or valid JSON of an unexpected shape —
  // entered no set at all and NO rule saw it, including the one about a
  // committed policy nobody applies. Measured with a payload carrying the
  // very `notificationRateLimit` that rule 6 is about: the gate printed
  // OK. Only the mid-write case is tolerated now; anything else
  // unreadable is reported below.
  try { p = JSON.parse(read(`monitoring/${f}`)); } catch {
    if (!MACHINE_WRITTEN.has(f)) unreadable.push(`${f} (not valid JSON)`);
    return false;
  }
  if (typeof p.displayName === "string" || Array.isArray(p.conditions)) return true;
  // Valid JSON that is not policy-shaped is usually a data trail —
  // engagement.json is one, and the note above says so. What is NOT fine is
  // a file carrying alert-policy machinery while failing to be classified
  // as a policy: `alertStrategy` is rule 6's whole subject, so such a file
  // slipping into no set at all is the hole, not the tolerance.
  if (p && typeof p === "object" && ("alertStrategy" in p || "notificationChannels" in p)) {
    unreadable.push(`${f} (carries alert-policy fields but no displayName or conditions)`);
  }
  return false;
};
const onDisk = readdirSync(join(root, "monitoring")).filter(looksLikePolicy).sort();
for (const f of unreadable) {
  fail(
    `monitoring/${f} entered no rule at all — not classified as a policy and `
    + "not a known machine-written artifact. Give it a displayName or "
    + "conditions, list it in apply-monitoring.mjs, or delete it.",
  );
}

const metricFilters = Object.fromEntries(
  [...applySrc.matchAll(/name:\s*"([\w]+)",[\s\S]{0,400}?filter:\s*(['"])([\s\S]*?)\2/g)]
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

// ── rule 5: a metric-based filter restricts resource.type ───────────
// Runs over the same parsed policies rule 3 walked, but separately, because
// the two failures are different: rule 3's is a filter that resolves to
// nothing and stays quiet, this one's is a create the API refuses outright.
for (const f of onDisk) {
  let policy;
  try { policy = JSON.parse(read(`monitoring/${f}`)); } catch { continue; }
  for (const cond of policy.conditions ?? []) {
    for (const key of ["conditionThreshold", "conditionAbsent"]) {
      const filter = cond[key]?.filter;
      if (!filter || !/metric\.type\s*=/.test(filter)) continue;
      if (/resource\.type\s*=/.test(filter)) continue;
      fail(`monitoring/${f}: ${key} filters on a metric.type with no resource.type restriction.\n`
        + `    ${filter}\n`
        + "    Cloud Monitoring rejects the create with 400 — \"must specify a restriction\n"
        + "    on resource.type\". This is not a lint: the policy cannot be created at all,\n"
        + "    and apply-monitoring stops the run there, leaving whatever it made before it.\n"
        + "    For a logging.googleapis.com/user/* metric the right value is the resource of\n"
        + "    the LOG ENTRIES it counts — `npm run observe -- --metrics` measures it.");
    }
  }
}

// ── rule 8: documentation is a PAIR ────────────────────────────────
for (const f of onDisk) {
  let policy;
  try { policy = JSON.parse(read(`monitoring/${f}`)); } catch { continue; }
  const doc = policy.documentation ?? {};
  const hasContent = typeof doc.content === "string" && doc.content.length > 0;
  const hasMime = typeof doc.mimeType === "string" && doc.mimeType.length > 0;
  if (hasContent !== hasMime) {
    fail(`monitoring/${f}: documentation has ${hasContent ? "content but no mimeType" : "mimeType but no content"}.\n`
      + "    The API refuses the create: \"non-empty content requires non-empty MIME type\n"
      + "    and vice versa\". It is not defaulted. Every other policy here uses\n"
      + "    \"mimeType\": \"text/markdown\".");
  }
}

// ── rule 6 + 7: policy-body fields the API refuses ──────────────────
// Both were found by a production POST rather than by anything here, one
// per run, at the cost of a merge and a dispatch each. They are the same
// CLASS and it is not a shape: a field whose legality depends on another
// field's value. A schema check would catch neither.
const ABSENCE_MAX_S = 84600; // 23h30m

for (const f of onDisk) {
  let policy;
  try { policy = JSON.parse(read(`monitoring/${f}`)); } catch { continue; }
  const conditions = policy.conditions ?? [];
  const isLogMatch = conditions.some((c) => c.conditionMatchedLog);

  if (policy.alertStrategy?.notificationRateLimit && !isLogMatch) {
    fail(`monitoring/${f}: alertStrategy.notificationRateLimit on a policy with no conditionMatchedLog.\n`
      + "    The API refuses it: \"only log-based alert policies may specify a notification\n"
      + "    rate limit\". Thresholding a logging.googleapis.com/user/* metric does NOT make\n"
      + "    the policy log-based — the classification is by CONDITION TYPE. Delete the\n"
      + "    field; autoClose carries no such restriction and stays.");
  }

  // RULE 8 — every condition carries exactly one RECOGNISED type, and a
  // log-match carries a filter.
  //
  // Two holes, both measured on this tree by mutation rather than argued.
  //
  // Rule 3 above walks `conditionThreshold` and `conditionAbsent` only, so
  // a `conditionMatchedLog` with its `filter` deleted passed every rule in
  // this file — a log-match with no filter matches nothing, which is the
  // silent failure this whole gate exists for: the policy creates fine and
  // never fires.
  //
  // And a condition whose type key is not one this file knows — a typo, or
  // a v3 type nobody has taught it — fell through every loop. It was
  // caught only where `notificationRateLimit` happens to be present, via
  // rule 6's `isLogMatch` going false, which is one policy of eleven.
  // Verified both ways: renaming the type key on the file that HAS the
  // rate limit fails, and doing the same on one that does not passes.
  //
  // Listed rather than inferred, so a genuinely new condition type fails
  // here and someone reads the API before adding it to the list.
  const KNOWN_CONDITIONS = ["conditionThreshold", "conditionAbsent", "conditionMatchedLog"];
  for (const cond of conditions) {
    const kinds = Object.keys(cond).filter((k) => k.startsWith("condition"));
    const known = kinds.filter((k) => KNOWN_CONDITIONS.includes(k));
    if (known.length !== 1) {
      fail(`monitoring/${f}: condition "${cond.displayName ?? "(unnamed)"}" carries `
        + `${known.length === 0 ? "no recognised condition type" : `${known.length} condition types`}`
        + ` (found: ${kinds.join(", ") || "none"}).\n`
        + "    Every rule in this file keys on the type, so a condition with none is walked\n"
        + "    by nothing and checked by nothing — it is not a schema slip, it is the gate\n"
        + "    going quiet. If this is a real v3 type, add it to KNOWN_CONDITIONS and give\n"
        + `    it a filter rule of its own. Known: ${KNOWN_CONDITIONS.join(", ")}.`);
      continue;
    }
    if (known[0] === "conditionMatchedLog" && !cond.conditionMatchedLog?.filter) {
      fail(`monitoring/${f}: conditionMatchedLog has no filter.\n`
        + "    A log-match with no filter matches nothing. The policy creates without\n"
        + "    complaint and never fires, which is exactly the shape this gate exists to\n"
        + "    refuse — rule 3's filter walk covers conditionThreshold and conditionAbsent\n"
        + "    only, so nothing else in this file would have noticed.");
    }
  }

  for (const cond of conditions) {
    const d = cond.conditionAbsent?.duration;
    if (!d) continue;
    const secs = Number(String(d).replace(/s$/, ""));
    if (Number.isFinite(secs) && secs > ABSENCE_MAX_S) {
      fail(`monitoring/${f}: conditionAbsent.duration is ${d}, above the API's ${ABSENCE_MAX_S}s (23h30m) ceiling.\n`
        + "    Neither the discovery document nor alert.proto states this maximum — they give\n"
        + "    only a 120s minimum — so it cannot be found by reading the schema. It is real.\n"
        + "    And do not simply lower the number: if the watched job runs ONCE A DAY its\n"
        + "    healthy gap is 86400s, longer than any window the API accepts, so every legal\n"
        + "    absence window pages every morning. Use a trailing-24h threshold instead —\n"
        + "    ALIGN_SUM over 86400s, COMPARISON_LT 1, evaluationMissingData ACTIVE.");
    }
  }
}

// ── rule 4: each metric selects on a field a function emits ──────────
// COMMENTS STRIPPED, because a commented-out emitter is exactly the shape
// this rule exists to catch and the raw text could not tell the two apart.
// Measured: comment out the one `logger.info("patterns fit", { metric:
// "patterns_fit", … })` call and this gate stays green — "every metric to a
// field a function emits" — while the metric receives no points, the
// threshold policy never fires, and its own error text ("it reports health
// it has never measured") becomes true of the gate itself. Deleting the
// same line fails loudly, which is what made the hole invisible.
//
// check-appcheck.mjs records the identical failure — `// assertOperator(
// request);` answered yes — and `strip-comments.mjs` exists because four
// gates needed this and each had its own copy.
// Recursive, like check-deploy-targets' and check-appcheck's walks over
// this same directory, and for the reason the first of those wrote down:
// latent while functions/src is flat, which is exactly how the
// moderation.ts miss happened there.
const fnSrc = readdirSync(join(root, "functions/src"), { recursive: true })
  .map((f) => String(f).split(sep).join("/"))
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
  + "every condition resolves to a metric, every metric to a field a function emits, "
  + "every metric-based filter restricts resource.type, and no policy body carries a "
  + "field the API refuses for its condition type.",
);
