#!/usr/bin/env node
// backfill-log.mjs — load every existing answer into the BigQuery answer
// log (SCALE-ARCHITECTURE.md phase A, D446), from a terminal or the
// Backfill answer log workflow.
//
//   node scripts/backfill-log.mjs --before 2026-09-10            # dry run: count only
//   node scripts/backfill-log.mjs --before 2026-09-10 --apply    # append the rows
//
// Drives `backfillLogV2` — an operator callable that walks the `answers`
// collection group in path order, a page at a time, appending a row per
// answer written BEFORE the cutoff day, and hands back a cursor when its
// own deadline nears. This loop calls it until the cursor comes back null.
//
// THE CUTOFF IS THE DAY THE TRIGGER STARTED APPENDING — the deploy that
// carried log.ts. Every answer from that day on already has its row (the
// trigger's, keyed by event id) or gets it from the nightly reconcile;
// an answer before it has none, and a backfilled row's id is
// `bf:{uid}:{qid}`, so a range re-run appends the same ids. RESUMABLE:
// `--after <answer document path>` continues a stopped run (the last
// summary line prints it). DRY BY DEFAULT: `--apply` has to be asked for.
//
// Reads its credentials exactly as scripts/rebuild-aggregate.mjs does —
// scripts/operator-call.mjs has the env list and why it is shared.

import { operatorContext, callOperator } from "./operator-call.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const apply = argv.includes("--apply");
const before = flag("before");
let after = flag("after");

if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
  console.error("backfill-log: --before <YYYY-MM-DD> is required — the UTC day the trigger started appending (the deploy's day)");
  process.exit(1);
}

let ctx;
try {
  ctx = operatorContext("backfill-log");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`backfill-log: project ${ctx.project}, answers before ${before}` + (after ? `, resuming after ${after}` : "") + (apply ? "  [APPLY]" : "  [dry run]"));

const totals = { scanned: 0, rows: 0, appended: 0, calls: 0 };
for (;;) {
  let out;
  try {
    out = await callOperator(ctx, "backfillLogV2", { before, after, apply });
  } catch (err) {
    console.error(err.message);
    if (after) console.error(`  resume with: --after ${after}`);
    process.exit(1);
  }
  totals.calls += 1;
  totals.scanned += out.scanned;
  totals.rows += out.rows;
  totals.appended += out.appended;
  console.log(`  call ${totals.calls}: scanned ${out.scanned}  rows ${out.rows}  appended ${out.appended}` + (out.done ? "  (end of the answers)" : `  → next ${out.next}`));
  if (out.done || !out.next) break;
  after = out.next;
}
console.log(`  total: ${totals.scanned} answers scanned, ${totals.rows} rows before the cutoff, ${totals.appended} appended over ${totals.calls} call(s)`);
if (!apply) console.log("  dry run — nothing was appended. Re-run with --apply to load the rows.");
