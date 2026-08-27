#!/usr/bin/env node
// pulse.mjs — the decision console: one page that answers "what should I do
// about this next?" across cost, money, the question pipeline, and reach.
//
// WHY THIS EXISTS. Two instruments already existed and neither was a view.
// `cost-model.mjs` prints five scenarios of predicted bill. `question-
// scorecard.mjs` scores questions the crowd has already answered. Between
// them sat the things nobody was computing at all: what the bill nets
// against, how many days of question runway are left before D30's no-wrap
// invariant breaks, and how much of the backend has an instrument pointed
// at it. Those are decisions, and they were being made from memory.
//
// WHAT IT IS NOT. Not analytics. This repo ships no product analytics (see
// docs/data-inventory.md, "Not collected"), and this script does not change
// that: every number below comes from a committed file, the cost model's
// stated assumptions, or the k-floored public aggregates the scorecard
// already reads. Nothing here reads a user. docs/MONITORING.md carries the
// full list of what was deliberately NOT built and which record forbids it.
//
// WHAT IT IS NOT, PART 2: a gate. `--check` exists and exits non-zero, but
// it is deliberately not wired into CI — see the block above check() for the
// argument, which is the same one that keeps check:figures off the backend
// path.
//
//   node scripts/pulse.mjs               # write monitoring/pulse.json + .html
//   node scripts/pulse.mjs --json        # print the artifact, write nothing
//   node scripts/pulse.mjs --check       # operator gate: runway + staleness
//   node scripts/pulse.mjs --multi-region  # model the multi-region counterfactual
//
// Node stdlib only, like every deploy-adjacent script here.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./pulse-collect.mjs";
import { REGIONAL as PROD_REGIONAL } from "./cost-arith.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = join(ROOT, "monitoring", "pulse.json");
const OUT_HTML = join(ROOT, "monitoring", "pulse.html");

const args = process.argv.slice(2);
// The price sheet follows the database (D200, functions/src/db.ts) rather
// than a flag defaulting to the more expensive answer; the flag is left for
// asking what the other region would have cost.
const REGIONAL = args.includes("--multi-region") ? false : PROD_REGIONAL;
const CHECK = args.includes("--check");
const JSON_ONLY = args.includes("--json");

// ── the trail ───────────────────────────────────────────────────
// A snapshot that overwrites itself cannot show a direction, and direction
// is most of what a decision needs — "the runway is 87 days" is worth much
// less than "the runway is 87 days and it was 94 last week." The scorecard
// has this problem too (one OUT path, overwritten every run, no history at
// all); this at least does not repeat it.
//
// JSONL, one row per DAY rather than per run: append-only so a regeneration
// can never destroy a past reading, and re-running on the same day replaces
// that day's row rather than adding a duplicate. Only the handful of figures
// worth trending — the full artifact is in pulse.json, and a trail that
// carried everything would be a second copy of it that nobody could read.
const OUT_TRAIL = join(ROOT, "monitoring", "pulse-trail.jsonl");

function trailRow(p) {
  return {
    on: p.generatedOn,
    runwayDays: p.pipeline.deck.runwayDays,
    dailyBank: p.pipeline.deck.dailyBank,
    totalQuestions: p.pipeline.totalQuestions,
    unpromoted: p.pipeline.archive.unpromoted,
    seededBankDocs: p.cost.seededBankDocs,
    burnUsd5k: p.money.breakEven[2].burnUsd,
    burnUsd50k: p.money.breakEven[3].burnUsd,
    revenueUsd: p.money.revenueUsdPerMonth,
    // The guard's two figures worth trending (D327): what we measure the
    // population at, and what that costs net of revenue. Null until the
    // engagement trail exists — a gap, never a zero.
    measuredActives: p.guard.measuredActives ?? null,
    netBurnUsd: p.guard.netBurnUsd ?? null,
    functionsAlerted: p.instrumentation.alertedCount,
    functionCount: p.instrumentation.functionCount,
    scorecardAgeDays: p.pipeline.scorecard.ageDays ?? null,
    answersCounted: p.pipeline.scorecard.totalAnswers ?? null,
    // The digest trail's two headline figures (R1/D268). Null until the
    // first committed monitoring/engagement.json — and null is what the
    // renderer draws as a gap, so the trail stays honest about the days
    // before the digest existed.
    dau: p.engagement?.present ? p.engagement.latest?.actives ?? null : null,
    retD7: p.engagement?.present ? p.engagement.returned?.d7?.rate ?? null : null,
  };
}

function appendTrail(p) {
  const row = trailRow(p);
  const prior = existsSync(OUT_TRAIL)
    ? readFileSync(OUT_TRAIL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const kept = prior.filter((r) => r.on !== row.on);
  const rows = [...kept, row].sort((a, b) => a.on.localeCompare(b.on));
  writeFileSync(OUT_TRAIL, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return rows;
}

function readTrail() {
  if (!existsSync(OUT_TRAIL)) return [];
  return readFileSync(OUT_TRAIL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// ── the operator gate ───────────────────────────────────────────
// `--check` is a REAL gate — it exits non-zero — and it is deliberately NOT
// in CI. The conditions it catches are content-operations conditions: the
// deck runway shortens by one every midnight whether or not anyone opened
// a pull request, so wiring this into CI would fail unrelated work on a
// Tuesday for a reason that pull request cannot fix. That is exactly the
// failure mode CLAUDE.md's rule about keeping client-only checks off the
// backend path is protecting against, pointed the other way.
//
// Where it belongs instead is a scheduled job, beside the scorecard read
// it already does — one that runs daily and whose job it IS to write
// questions. That job is `.github/workflows/pulse.yml`, which runs
// `node scripts/pulse.mjs --check` on its cron as a step named for what it
// is; this comment said the wiring lived outside the repo for as long as
// the workflow had existed.

const RUNWAY_FLOOR = 21;   // three weeks — two farm cycles of notice

function check(pulse) {
  const problems = [];
  const { deck, scorecard } = pulse.pipeline;

  if (deck.runwayDays < RUNWAY_FLOOR) {
    problems.push(
      `deck runway is ${deck.runwayDays} days (floor ${RUNWAY_FLOOR}).\n`
      + `    The daily bank holds ${deck.dailyBank} questions and the calendar has eaten\n`
      + `    ${deck.daysElapsed} of them since DECK_EPOCH. At zero, computeDeckIds starts\n`
      + `    wrapping again and the next reseed silently remaps every user's answered\n`
      + `    history once (D30, the residual limit). Nothing else in the tree notices.\n`
      + `    Fix: promote questions into content/daily-questions.json — ${deck.promotionNeededPerWeek}/week\n`
      + "    keeps the invariant, and the farm's budget cap allows "
      + `${deck.farmBudgetPerWeek}.`,
    );
  }

  if (scorecard.present && scorecard.staleness === "expired") {
    problems.push(
      `content/scorecard.json is ${scorecard.ageDays} days old (expired past 30).\n`
      + "    QUESTION-FARM.md's staleness rule puts the farm on lane 3 only until it is\n"
      + "    refreshed. Fix: npm run scorecard -- --fetch",
    );
  }

  // The usage-vs-revenue guard (D327). "over" alone trips — unarmed and
  // unmeasured are questions the OK line carries, not conditions to page
  // about every morning pre-launch.
  const g = pulse.guard;
  if (g.state === "over") {
    problems.push(
      `the bill is outrunning revenue: modelled burn $${g.burnUsd}/mo at the measured\n`
      + `    ${g.measuredActives} actives (${g.measuredOn}) against $${g.revenueUsd}/mo recorded revenue —\n`
      + `    net $${g.netBurnUsd}/mo, over the $${g.allowanceUsd} allowance (monitoring/rates.json guard).\n`
      + "    Three levers, in the order to reach for them (D327):\n"
      + "      1. price or record real revenue in monitoring/rates.json — if users arrived,\n"
      + "         this is the good version of this alert;\n"
      + "      2. pull the read breaker: npm run budget:mode -- --level 1 (sheds the D98\n"
      + "         social reads, ~80% of the modelled bill, honestly labelled in the app);\n"
      + "      3. raise the allowance deliberately, in the same commit that says why.\n"
      + "    And check the Cloud Billing budget/console — this figure is a model, and the\n"
      + "    model's own record is that its errors are missing terms (docs/COSTS.md).",
    );
  }

  if (problems.length) {
    console.error("\npulse --check: conditions that need an operator, not a commit:\n");
    for (const p of problems) console.error(`  ${p}\n`);
    return 1;
  }
  const guardLine = pulse.guard.state === "ok"
    ? `net burn $${pulse.guard.netBurnUsd}/mo at ${pulse.guard.measuredActives} measured actives (allowance $${pulse.guard.allowanceUsd})`
    : pulse.guard.state === "unmeasured"
      ? "guard unmeasured (no committed engagement trail yet — `npm run scorecard -- --fetch` arms it)"
      : "guard unarmed (no maxNetBurnUsdPerMonth in monitoring/rates.json)";
  console.log(
    `pulse --check OK — deck runway ${deck.runwayDays} days, `
    + `scorecard ${scorecard.present ? scorecard.staleness : "absent (pre-launch)"}, `
    + `${guardLine}.`,
  );
  return 0;
}

// ── main ────────────────────────────────────────────────────────

const pulse = collect({ regional: REGIONAL });

if (JSON_ONLY) {
  console.log(JSON.stringify({ ...pulse, trail: readTrail() }, null, 2));
} else if (CHECK) {
  process.exit(check(pulse));
} else {
  const { renderPulse } = await import("./pulse-render.mjs");
  const trail = appendTrail(pulse);
  writeFileSync(OUT_JSON, JSON.stringify(pulse, null, 2) + "\n");
  writeFileSync(OUT_HTML, renderPulse(pulse, trail));
  const { deck } = pulse.pipeline;
  console.log(
    `pulse: wrote monitoring/pulse.json and monitoring/pulse.html\n`
    + `  burn at ${pulse.cost.scenarios[2].label.toLowerCase()}: `
    + `$${pulse.money.breakEven[2].burnUsd}/mo · `
    + `deck runway ${deck.runwayDays} days · `
    + `${pulse.instrumentation.alertedCount}/${pulse.instrumentation.functionCount} functions alerted`,
  );
  console.log("  open monitoring/pulse.html in a browser (it is self-contained; no server needed)");
}
