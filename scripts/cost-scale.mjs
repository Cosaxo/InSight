#!/usr/bin/env node
// cost-scale.mjs — what an infinite feed costs, as a table.
//
//   npm run costs:scale
//
// WHY THIS EXISTS. docs/SCALE-PLAN.md answers "can we scale question
// production by two orders of magnitude" with a number, and a number in
// prose is the one documentation error this repo keeps re-committing
// (D39, check:figures). The answer was originally measured by overriding
// B.changedPerReseed in a scratch script and pasting the output, which is
// precisely the shape that goes stale — so the scratch script is here
// instead, and the plan cites the command rather than the figures.
//
// It is a separate script rather than more rows in cost-model.mjs because
// the subject is different: cost-model.mjs prices the app AS BUILT at five
// audience sizes, and this prices a CHANGE to the content pipeline that
// nobody has made. Mixing a hypothetical into the as-built table is how a
// prediction gets read as a measurement.
//
// TWO INPUTS, and the split between them is the finding:
//
//   - BANK SIZE moves nothing. A returning device pages `updatedAt >
//     cursor` and pays for the delta (D34), and the offline cache holds
//     the rest, so the bank is a one-time install cost that never appears
//     in a steady-state month. The table proves it rather than asserting
//     it, because "obviously the bank is cached" is exactly the kind of
//     reasoning this model exists to replace.
//   - PROMOTION RATE moves the reseed term, linearly and mildly. That is
//     the term an infinite feed actually buys.
//
// B.changedPerReseed is mutated in place because readsPerUser() reads it
// from the module object at call time and does not accept it as an opt —
// the same reason cost-levers.mjs reaches for opts where it can. If that
// term ever becomes a proper option, this script should use it.

import {
  costModel, firestoreCost, functionsCost, SCENARIOS, B, bankDocs, LOCATION_LABEL,
} from "./cost-arith.mjs";

const money = (n) => (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString());
const shipped = B.changedPerReseed;

// Labelled by the record that sets them where one does, so the table does
// not hard-code a cadence the farm docs own.
const RATES = [
  [shipped, `${shipped}/wk · D30 floor (shipped)`],
  [shipped * 2, `${shipped * 2}/wk · D97 target`],
  [50, "50/wk"],
  [100, "100/wk"],
  [350, "350/wk · 50/day"],
  [700, "700/wk · 100/day"],
];

// The first row is the bank as it stands, counted from the seed like every
// other bank figure in this repo — it was typed as 513 and the bank passed
// it two promotion cycles ago. A hand-maintained figure in a table whose
// finding is "these rows are identical" is the safest place for one to go
// stale and the least excusable (D39, check:figures).
const BANKS = [bankDocs(), 1500, 5000, 20000, 100000];

const header = (label) =>
  label.padEnd(28) + SCENARIOS.map(([d]) => `DAU ${d.toLocaleString()}`.padStart(13)).join("");

// One model serves every rate: readsPerUser() reads B.changedPerReseed at
// CALL time, so mutating B between calls is picked up without rebuilding.
// Verified rather than assumed — a hoisted model priced 3 reseed reads
// before the mutation and 280 after.
const { model } = costModel({});
const totalsFor = () =>
  SCENARIOS.map(([dau, mature]) => {
    const m = model(dau, mature);
    return firestoreCost(m.cost) + functionsCost(m.cost);
  });

// The label, not a second copy of the premise: this script has always
// priced `costModel({})`, which since D200 means the region production is
// actually on — so the hardcoded "nam5" above these tables disagreed with
// the numbers under it rather than with the tree.
console.log(`\nInSight scale model — ${LOCATION_LABEL} prices`);
console.log("the question the table answers: what does an infinite feed cost\n");

console.log("1 · PROMOTION RATE — the term that moves ($/mo)\n");
console.log(header("rate"));
console.log("-".repeat(28 + 13 * SCENARIOS.length));
for (const [rate, label] of RATES) {
  B.changedPerReseed = rate;
  const row = totalsFor().map((t) => `$${money(t)}`.padStart(13)).join("");
  console.log(label.padEnd(28) + row);
}
B.changedPerReseed = shipped;

console.log("\n  Reseed reads are charged per MAU, not per DAU: a monthly visitor pays for");
console.log("  every promotion since their last visit. That is why the rate matters at all");
console.log("  and why it stays mild — it is a delta, not a bank refetch (D34).\n");

console.log("2 · BANK SIZE — the term that does not move ($/mo)\n");
console.log(header("bank documents"));
console.log("-".repeat(28 + 13 * SCENARIOS.length));
for (const bank of BANKS) {
  // Bank size IS a costModel() argument rather than a B field, so this one
  // does need its own build per row.
  const { model: bankModel } = costModel({ bank });
  const row = SCENARIOS.map(([dau, mature]) => {
    const m = bankModel(dau, mature);
    return `$${money(firestoreCost(m.cost) + functionsCost(m.cost))}`.padStart(13);
  }).join("");
  console.log(`${bank.toLocaleString()} docs`.padEnd(28) + row);
}

console.log("\n  Identical rows are the finding, not a bug in the table. If a future change");
console.log("  makes bank size bill — a per-boot refetch, a lost cache, a query that stops");
console.log("  paging — these rows separate, and that is the regression to look for.\n");

console.log("3 · WHAT TRIPS FIRST, and it is not the bill\n");
console.log("  WAS the unpaginated bank fetch, which returned a short page and NO error");
console.log("  once the bank passed its limit — a truncated corpus with nothing failing");
console.log("  anywhere. D161 paged it; the loop ends on a short page and never on a count");
console.log("  it believes in advance, and bank-cache.test.ts asserts completeness.");
console.log();
console.log("  NEXT is the localStorage bank cache, and it is silent in the same way: the");
console.log("  quota failure is caught and ignored, so crossing it stops the caching and");
console.log("  makes every boot pay a full fetch, forever, with no symptom. check:quality's");
console.log("  BANK_WARN/BANK_FAIL now watch that budget and say so in MB.\n");
console.log("  docs/SCALE-PLAN.md is the plan these numbers were computed for.\n");
