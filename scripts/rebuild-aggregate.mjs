#!/usr/bin/env node
// rebuild-aggregate.mjs — D290's replay tool, from a terminal.
//
// Rebuilds one question's aggregate from the answers that made it. This is
// the operator half of "the answers are the source of truth and every
// aggregate is a disposable projection": before it, docs/DEPLOYMENT.md's
// "Correcting aggregates" could repair only `counts` — the ledger it read
// carries no anchors — and only within LEDGER_RETENTION_DAYS (90).
//
//   node scripts/rebuild-aggregate.mjs --qid daily-2026-08-24
//   node scripts/rebuild-aggregate.mjs --qid daily-2026-08-24 --apply
//   node scripts/rebuild-aggregate.mjs --qid q-123 --exclude uidA,uidB --apply
//
// `--allow-empty` is the one other flag, and it exists to make a deliberate
// act deliberate: applying a scan that matched NO answers over an aggregate
// that holds some. See the refusal in functions/src/replay.ts for why that
// is far more often a broken query than a genuinely emptied question.
//
// DRY BY DEFAULT. `--apply` has to be asked for: this writes the document
// every surface in the app reads, and the runbook that reaches for it is
// one somebody follows during an incident.
//
// Reads its credentials exactly as scripts/seed-content.mjs does — see
// scripts/operator-call.mjs for the env list and why it is shared.

import { operatorContext, callOperator } from "./operator-call.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

const qid = flag("qid");
const apply = argv.includes("--apply");
const allowEmpty = argv.includes("--allow-empty");
const exclude = (flag("exclude") || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!qid) {
  console.error("rebuild-aggregate: --qid is required.\n"
    + "  node scripts/rebuild-aggregate.mjs --qid <question-id> [--exclude uid,uid] [--apply] [--allow-empty]");
  process.exit(1);
}

let ctx;
try {
  ctx = operatorContext("rebuild-aggregate");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(
  `rebuild-aggregate: project ${ctx.project}, qid ${qid}`
  + (exclude.length ? `, excluding ${exclude.length} uid(s)` : "")
  + (apply ? "  [APPLY]" : "  [dry run]"),
);

let out;
try {
  out = await callOperator(ctx, "rebuildAggregateV2", { qid, apply, exclude, allowEmpty });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`  scanned ${out.scanned}  folded ${out.folded}  skipped ${out.skipped}  excluded ${out.excluded}`);
console.log(`  rebuilt total ${out.total}   counts ${JSON.stringify(out.counts)}`);
if (out.published) {
  console.log(`  published total ${out.published.total}  counts ${JSON.stringify(out.published.counts)}`);
}
const driftKeys = Object.keys(out.drift.counts);
if (out.emptyScan && out.drift.total === 0 && driftKeys.length === 0) {
  // NOT "drift: none". A zero scan compared against an absent or empty
  // aggregate agrees trivially, and printing the healthy sentence there
  // would report a question as verified on the strength of having looked at
  // nothing — the failure this repo keeps naming, a check that passes
  // because it never ran. Say what actually happened instead.
  console.log(
    "  nothing to compare — the scan matched no answers and the published\n"
    + "  aggregate is empty too. Consistent, but nothing was verified: if you\n"
    + "  expected answers here, the query is what to look at, not the fold.",
  );
} else if (out.drift.total === 0 && driftKeys.length === 0) {
  console.log("  drift: none — the published aggregate already matches the answers.");
} else {
  console.log(`  drift: total ${out.drift.total >= 0 ? "+" : ""}${out.drift.total}  counts ${JSON.stringify(out.drift.counts)}`);
}
if (out.carriedEdits) {
  // Stated every run, because it is the one field a rebuild cannot verify.
  console.log("  edits: carried forward unchanged (D226 — not derivable from answers).");
}
if (out.cappedDims.length) {
  console.log(
    `  NOTE: ${out.cappedDims.join(", ")} came out at the bucket cap.\n`
    + "        On a saturated dimension the fold is order-dependent, so the\n"
    + "        rebuilt breakdown is A correct fold of these answers rather than\n"
    + "        necessarily the same one the trigger built. counts/total are exact.",
  );
}
console.log(out.applied ? "  APPLIED — both aggregate documents rewritten." : "  Nothing written. Re-run with --apply.");
