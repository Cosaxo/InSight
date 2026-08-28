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
// THE RULES — no count in this heading, deliberately: it said FOUR while
// listing eight, which is the hand-maintained figure check:figures exists
// to prevent, one directory over. The header is the specification, so a
// new rule is written here in the same breath as it is written below.
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
//   9. Every `metric: "X"` a Cloud Function emits has a log-based metric
//      that selects on it. This is rule 4's edge walked from the other
//      end, and until it was written NOTHING walked it that way: rules 1-8
//      all start from a committed policy, so a line a function writes to a
//      metric nobody created is invisible here — the emit is in the repo,
//      the arming is not, and every gate stays green.
//
//      D323 §3 records that a buyer charged twice is "recorded AND
//      alarmed". `paid_duplicate_payment` is emitted at ERROR by paid.ts,
//      no METRICS entry selects on it, and the only severity>=ERROR policy
//      in monitoring/ is scoped to onV2AnswerCreated — so the second half
//      has never been true. That is exactly the shape this direction
//      exists for: one half written, the other assumed, and each believing
//      the other was there.
//
//      A RATCHET (UNARMED below), because on the day it was written 21 of
//      the 26 names emitted had nowhere to land, and a cliff that size is
//      a gate somebody turns off. The live split is in the OK line rather
//      than quoted here twice. Every entry carries its reason, and only
//      moves DOWN — a new unarmed emitter fails, an entry whose emitter is
//      gone fails, and an entry that has since been given a metric fails
//      asking to be deleted.
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

// ── what apply-monitoring says it will create ───────────────────────
// Read BEFORE the disk scan, because it is half of what decides which
// files on disk are policies at all.
const applySrc = read("scripts/apply-monitoring.mjs");

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
const looksLikePolicy = (f) => {
  if (!f.endsWith(".json")) return false;
  if (listedPolicies.includes(`monitoring/${f}`)) return true;
  let p;
  // A half-written artifact is not a policy, and must not take the gate
  // down either — monitoring/pulse.json is machine-written and gitignored,
  // so it is the file here most likely to be caught mid-write.
  try { p = JSON.parse(read(`monitoring/${f}`)); } catch { return false; }
  return typeof p.displayName === "string" || Array.isArray(p.conditions);
};
const onDisk = readdirSync(join(root, "monitoring")).filter(looksLikePolicy).sort();

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
//
// READ AS UTF-8 THROUGH fs, NOT THROUGH grep, and that is not a style
// preference — it is rule 9's own failure mode arriving early. On
// 2026-08-28 functions/src/taste.ts carried a raw NUL byte at line 112 —
// a deliberate composite-key separator typed as the character instead of
// as `\x00`, not debris — and grep therefore called the file binary,
// printed "binary file matches" and reported not one of the names in it,
// so the first inventory of what this repo emits was one name short and
// said nothing. That byte is somebody's fix,
// but the reading outlives it — an inventory a single control character
// can shorten is an inventory that under-reports in the direction that
// flatters, and this rule's subject is that a name nobody can see is a
// name nobody arms. Bytes in, decoded; a control character is then just a
// character that matches nothing.
const fnFiles = readdirSync(join(root, "functions/src"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .sort()
  .map((f) => [`functions/src/${f}`, read(`functions/src/${f}`)]);
const fnSrc = fnFiles.map(([, src]) => src).join("\n");

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

// ── rule 9: each emitted name has a metric to land in ───────────────
//
// The same edge as rule 4, from the emitter's end. Both halves have to be
// checked separately because they fail separately: rule 4 catches a metric
// wired to a line nobody writes, this catches a line written to a metric
// nobody created. Neither can see the other's fault.
// AN INVENTORY IS ONLY AS HONEST AS THE SHAPES IT CAN READ, so this reads
// the whole VALUE after `metric:` and then insists the value be a shape a
// name can be counted out of. The first version of this rule matched
// `metric: "X"` alone and was green while functions/src/paid.ts:612 emitted
// two names through a ternary — unarmed, unrecorded, and printed nowhere.
// A rule that misses an emit reports a smaller debt than exists, which is
// the direction that flatters, and the same failure as the NUL above.
//
// So: exactly two shapes are countable, and everything else FAILS asking
// to be written as one of them. Widening the regex until it matched more
// was the other road and it is worse — `metric: c === "approve" ? "a" : "b"`
// has three literals in it and only two are names, so a scanner that takes
// every quoted word invents a metric called "approve" and then reports it
// missing forever.
const EMITS = /\bmetric:\s*/g;
const ONE = /^"([\w]+)"$/;
// Anchored at the END so the condition's own literals cannot be captured.
const TERNARY = /\?\s*"([\w]+)"\s*:\s*"([\w]+)"$/;

/**
 * The value expression after `metric:` — up to the property's end, which
 * is a top-level comma, a closing brace, or the line ending. Quotes and
 * nesting are tracked so a comma inside either does not end it early.
 */
function valueAfter(src, from) {
  let depth = 0, quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { if (depth === 0) return src.slice(from, i); depth--; }
    else if (depth === 0 && (c === "," || c === "\n")) return src.slice(from, i);
  }
  return src.slice(from);
}

/**
 * name → the files that emit it, from [path, source] pairs.
 * Sites whose value is neither shape are returned by `opaqueEmits`, which
 * reads the same files — they are a failure, not a silent skip.
 */
export function emittedMetrics(files) {
  const byName = new Map();
  const add = (name, file) => {
    if (!byName.has(name)) byName.set(name, []);
    if (!byName.get(name).includes(file)) byName.get(name).push(file);
  };
  for (const [file, src] of files) {
    for (const m of src.matchAll(EMITS)) {
      const value = valueAfter(src, m.index + m[0].length).trim();
      const one = value.match(ONE);
      if (one) { add(one[1], file); continue; }
      const two = value.match(TERNARY);
      if (two) { add(two[1], file); add(two[2], file); }
    }
  }
  return byName;
}

/**
 * The sites this inventory cannot count: a `metric:` whose value is a
 * variable, a template literal, or a ternary that does not end in two
 * string literals. Each is a name that never appears in the tree as text,
 * so no grep, no reviewer and no rule below can find it.
 */
export function opaqueEmits(files) {
  const out = [];
  for (const [file, src] of files) {
    for (const m of src.matchAll(EMITS)) {
      const at = m.index + m[0].length;
      const value = valueAfter(src, at).trim();
      if (ONE.test(value) || TERNARY.test(value)) continue;
      out.push({ file, line: src.slice(0, at).split("\n").length, value });
    }
  }
  return out;
}

// THE RATCHET. Every name here is emitted by a Cloud Function today and
// selected on by no log-based metric, so the line reaches Cloud Logging
// and stops. The reason it is unarmed IS the entry — a bare list of names
// would record the debt without recording whether anybody had thought
// about it, and this repo's other baselines (check:a11y's per-file
// findings, check:panel-suites' OWED) all carry the why.
//
// It only moves DOWN. Arming a name means a METRICS entry and a policy in
// apply-monitoring.mjs, and deleting the line here in the same commit.
const PAID = "The paid loop ships with no alert policy of any kind, so every paid_* name "
  + "here goes to Cloud Logging and stops. Arming them is not one metric: it is the "
  + "operator's call on which are a page and which are a morning read, and on several "
  + "the residue is money rather than a stale number (D323 §§3-5).";

export const UNARMED = {
  // ── two nightly heartbeats that are simply owed ────────────────────
  // Same shape as patterns_fit, velocity_scan and engagement_digest,
  // which each have a metric and a "has gone quiet" policy. A scheduled
  // job that stops reports nothing at all: no error, no failed request.
  bank_rank: "The 03:07 nightly bank rank's heartbeat. Owed a metric and a quiet "
    + "policy exactly like fitPatternsV2's; nobody wired it.",
  taste_fold: "The 03:27 nightly taste fold's heartbeat, with one thing to settle "
    + "before arming it: it is emitted only when the fold MOVED (`summary.days > 0`), "
    + "so to any policy a quiet day and a dead job are the same signal. Deciding which "
    + "is which — emit unconditionally, or threshold something else — comes first.",

  // ── deliberate, and documented as such ─────────────────────────────
  velocity_flag: "DELIBERATE, and the only entry here that is. docs/DEPLOYMENT.md "
    + "§ \"Correcting aggregates after a fake-account ring\" says it in as many "
    + "words: deliberately NO alert policy ships for these flags. Each "
    + "kind carries an honest false positive — a launch spike looks like a birth "
    + "cluster — so the flags are a daily read during calm and an hourly one during an "
    + "incident, not a page. The field is named there as what a metric would select on "
    + "if evidence ever justifies standing eyes.",

  // ── a page that would fire at the person causing it ────────────────
  agg_rebuild: "Warned once per question that replay.ts rebuilds, and a rebuild is "
    + "something an operator started (rebuild-aggregate.yml). The alert would page the "
    + "person doing the repair. What IS worth watching is a rebuild nobody started, "
    + "and this line carries nothing that separates the two.",

  // ── a designed overflow, self-healing on the first day ─────────────
  engagement_shard_cap: "The fold hit its cap and the leftovers fold tomorrow — "
    + "designed behaviour with a designed lever (SHARD_SAMPLE_RATE). One day at the cap "
    + "is not an incident; several running is, and that is a metric plus a threshold "
    + "nobody has priced.",
  engagement_rollup_cap: "Same overflow, rollup side. See engagement_shard_cap.",

  // ── true today, by configuration ───────────────────────────────────
  operator_moderator_overlap: "Warned once per production cold start while MOD_UIDS "
    + "and SEED_ADMIN_UIDS intersect, which they DO today — one person holds both, and "
    + "runbook 5.7 is the one-variable fix. A policy would page continuously for a "
    + "known configuration. The fix is the arming: the warning stops when it lands.",

  // ── the paid loop: one shared reason, three with a note of their own ─
  paid_duplicate_payment: `${PAID} This is the one D323 §3 calls "recorded and alarmed"; `
    + "only the first half is built.",
  paid_async_failed: `${PAID} Logged at error (D323 §5) so a delayed payment that fails `
    + "is not swallowed — but swallowed and unwatched differ only in the log.",
  paid_review_gates_only: `${PAID} The fail-open marker DEPLOYMENT.md names for an `
    + "ANTHROPIC_API_KEY that is unset: reviews then decide on the deterministic gates "
    + "alone, and nothing counts how many did.",
  // The pair the first version of this rule could not see at all: paid.ts
  // emits them through a ternary, so `metric: "…"` never appears for either
  // and the inventory printed 24 where the tree emits 26. They are here
  // because the scanner reads the shape now, not because anything changed
  // in paid.ts.
  paid_review_approved: PAID,
  paid_review_declined: PAID,
  paid_awaiting_settlement: PAID,
  paid_campaign_closed: PAID,
  paid_refund_held: PAID,
  paid_refund_offapp: PAID,
  paid_review_held: PAID,
  paid_review_stalled: PAID,
  paid_review_stalled_total: PAID,
  paid_review_sweep: PAID,
  paid_session_expire_skipped: PAID,
};

/**
 * The ratchet in all three directions: a name with nowhere to land and no
 * recorded reason (`unarmed`), a recorded name nothing emits any more
 * (`ghosts`), and a recorded name that has since been armed (`armed`).
 * The last two are the D275 shape — a tripwire that keeps counting after
 * the code stopped doing the thing reports a debt nobody owes, and the
 * next real one hides inside the wrong number.
 */
export function auditEmitters(emitted, selectedFields, baseline = UNARMED) {
  const selected = new Set(selectedFields);
  return {
    unarmed: [...emitted.keys()].filter((n) => !selected.has(n) && !(n in baseline)).sort(),
    ghosts: Object.keys(baseline).filter((n) => !emitted.has(n)).sort(),
    armed: Object.keys(baseline).filter((n) => selected.has(n)).sort(),
  };
}

const emitted = emittedMetrics(fnFiles);
// Before the inventory is trusted, the sites it could not read. This runs
// first because every count below it is wrong while one of these stands.
for (const site of opaqueEmits(fnFiles)) {
  fail(`${site.file}:${site.line} emits a metric this inventory cannot read: metric: ${site.value}\n`
    + "    The name never appears in the tree as text, so no grep finds it, no reviewer\n"
    + "    sees it and no rule here can tell whether it is armed. Write it as a literal\n"
    + "    — `metric: \"name\"`, or a ternary ending in two of them — and it counts.");
}
const selectedFields = Object.values(metricFilters)
  .map((f) => f.match(/jsonPayload\.metric\s*=\s*"([\w]+)"/)?.[1])
  .filter(Boolean);
const emitAudit = auditEmitters(emitted, selectedFields);

for (const name of emitAudit.unarmed) {
  fail(`${(emitted.get(name) || []).join(", ")} emits metric:"${name}", and no log-based metric selects on it.\n`
    + "    The line reaches Cloud Logging and stops there: no metric, so no policy, so\n"
    + "    nothing can page on it — and the code reads as if something does.\n"
    + "    Either add a METRICS entry and the policy that reads it in\n"
    + "    scripts/apply-monitoring.mjs, or add the name to UNARMED in this file WITH\n"
    + "    the reason it is not worth arming. The reason is the record; a bare name\n"
    + "    added to make this pass buys nothing.");
}
for (const name of emitAudit.ghosts) {
  fail(`UNARMED records "${name}", which no function in functions/src emits any more.\n`
    + "    Delete the entry. A baseline that keeps counting after the code stopped\n"
    + "    doing the thing reports a debt nobody owes, and the next real one hides\n"
    + "    inside the wrong number (D275: a read tripwire counting `tx.get(` after the\n"
    + "    code had moved to `tx.getAll(`, so it counted zero and called it a win).");
}
for (const name of emitAudit.armed) {
  fail(`UNARMED records "${name}", but apply-monitoring.mjs now creates a metric that\n`
    + "    selects on it. Delete the entry in the same commit that armed it: a ratchet\n"
    + "    only tightens if the fix takes the line with it, and a stale entry means the\n"
    + "    next time that name goes unarmed this gate says nothing.");
}

// ── report ───────────────────────────────────────────────────────────
// Guarded, so a test can import the parsers above without the gate running
// and — on a failure — calling process.exit out from under vitest. Same
// shape as check-data-inventory.mjs and check-public-copy.mjs.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly && problems.length) {
  console.error("check-monitoring FAILED\n");
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  process.exit(1);
}

if (invokedDirectly) console.log(
  `check:monitoring OK — ${onDisk.length} policies, ${metricNames.length} log-based metrics, `
  + "every condition resolves to a metric, every metric to a field a function emits, "
  + "every metric-based filter restricts resource.type, and no policy body carries a "
  // Counted, not subtracted: `emitted.size - UNARMED` would be the same
  // number only while the three checks above are green, which is a figure
  // that reads correctly right up until it matters.
  + `field the API refuses for its condition type; ${emitted.size} names emitted, `
  + `${[...emitted.keys()].filter((n) => selectedFields.includes(n)).length} armed `
  + `and ${Object.keys(UNARMED).length} unarmed with a reason each, none new `
  + "(this only moves down).",
);
