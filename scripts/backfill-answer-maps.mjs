#!/usr/bin/env node
// backfill-answer-maps.mjs — fold every existing answer into the per-person
// answer maps the Circle stop reads (DATA-EFFICIENCY-RUNBOOK 3.4), from a
// terminal or the Backfill answer maps workflow.
//
//   node scripts/backfill-answer-maps.mjs            # dry run: count only
//   node scripts/backfill-answer-maps.mjs --apply    # write the maps
//
// Drives `backfillAnswerMapsV2` — an operator callable that walks the
// `answers` collection group in path order, a page at a time, merging each
// page's answers into their people's maps, and hands back a cursor when
// its own deadline nears. This loop calls it until the cursor comes back
// null. RESUMABLE: pass `--after <answer document path>` to continue a run
// that stopped (the last summary line prints it), and IDEMPOTENT: a merge
// of what a map already holds changes nothing, so re-running over a range
// is safe.
//
// DRY BY DEFAULT, the rebuild tool's rule: `--apply` has to be asked for.
// One read per existing answer either way; writes only under --apply, one
// merged write per person per page.
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
let after = flag("after");

let ctx;
try {
  ctx = operatorContext("backfill-answer-maps");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`backfill-answer-maps: project ${ctx.project}` + (after ? `, resuming after ${after}` : "") + (apply ? "  [APPLY]" : "  [dry run]"));

const totals = { scanned: 0, folded: 0, written: 0, calls: 0 };
for (;;) {
  let out;
  try {
    out = await callOperator(ctx, "backfillAnswerMapsV2", { after, apply });
  } catch (err) {
    console.error(err.message);
    if (after) console.error(`  resume with: --after ${after}`);
    process.exit(1);
  }
  totals.calls += 1;
  totals.scanned += out.scanned;
  totals.folded += out.folded;
  totals.written += out.written;
  console.log(`  call ${totals.calls}: scanned ${out.scanned}  folded ${out.folded}  people ${out.users}  written ${out.written}` + (out.done ? "  (end of the answers)" : `  → next ${out.next}`));
  if (out.done || !out.next) break;
  after = out.next;
}
console.log(`  total: ${totals.scanned} answers scanned, ${totals.folded} folded into maps, ${totals.written} map writes over ${totals.calls} call(s)`);
if (!apply) console.log("  dry run — nothing was written. Re-run with --apply to write the maps.");
