#!/usr/bin/env node
// cost-model.mjs — prints the tables docs/COSTS.md quotes.
//
// Node stdlib only, same discipline as the other scripts here. NOT a gate:
// it asserts nothing and is not wired into CI, because a cost prediction
// cannot be right or wrong until there is an invoice to compare it to.
// What it is for is re-running the model when an input changes — a price
// sheet, the reseed cadence, the behaviour assumptions — so the numbers in
// COSTS.md never become folklore.
//
//   node scripts/cost-model.mjs              # nam5 multi-region (the default)
//   node scripts/cost-model.mjs --regional   # single-region price sheet
//
// The arithmetic itself moved to scripts/cost-arith.mjs when pulse.mjs
// wanted the same numbers — one model, two consumers, no second copy to go
// stale. This file is now only the formatting. Output is unchanged; if you
// touch either file, diff this command's output before and after.

import {
  costModel, authCost, writesPerSec, B, SCENARIOS,
  firestoreCost, functionsCost, totalCost,
} from "./cost-arith.mjs";

const regional = process.argv.includes("--regional");
const { bank, model } = costModel({ regional });

const money = (n) => (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString());
const int = (n) => Math.round(n).toLocaleString();

console.log(`\nInSight cost model — ${regional ? "single-region" : "nam5 multi-region"} prices`);
console.log(`bank: ${bank} question docs (counted from functions/src/v2content.ts)\n`);

console.log("scenario                 DAU     reads/day   writes/day   Firestore  functions      TOTAL");
console.log("-".repeat(92));
for (const [dau, mature, label] of SCENARIOS) {
  const m = model(dau, mature);
  const fs = firestoreCost(m.cost);
  const fn = functionsCost(m.cost);
  console.log(
    label.padEnd(22) + int(dau).padStart(8) + int(m.reads).padStart(14) +
    int(m.writes).padStart(13) + ("$" + money(fs)).padStart(12) +
    ("$" + money(fn)).padStart(11) + ("$" + money(fs + fn)).padStart(11),
  );
}

console.log("\nreads per user per day, by source — the decomposition is the finding");
console.log("     DAU     boot   top-up   reseed  fan-out    total");
console.log("-".repeat(54));
for (const [dau, mature] of SCENARIOS) {
  const { r } = model(dau, mature);
  const t = Object.values(r).reduce((a, b) => a + b, 0);
  console.log(
    int(dau).padStart(8) + int(r.boot).padStart(9) + int(r.topUp).padStart(9) +
    int(r.reseed).padStart(9) + int(r.fanOut).padStart(9) + int(t).padStart(9),
  );
}

console.log("\nwith both read fixes: static bank + polled deck aggregates");
console.log("     DAU     TOTAL $/mo      saving");
console.log("-".repeat(38));
for (const [dau, mature] of SCENARIOS) {
  const before = model(dau, mature);
  const after = model(dau, mature, { staticBank: true, pollAggs: true });
  console.log(
    int(dau).padStart(8) + ("$" + money(totalCost(after.cost))).padStart(15) +
    ("$" + money(totalCost(before.cost) - totalCost(after.cost))).padStart(12),
  );
}

console.log("\nD7 write-contention wall (~1 write/sec/document on the shared daily)");
for (const [dau] of SCENARIOS) {
  const wps = writesPerSec(dau);
  console.log(
    `  DAU ${int(dau).padStart(8)}: ${wps.toFixed(2).padStart(6)} writes/sec  ` +
    (wps < 1 ? "OK" : "CONTENTION"),
  );
}

console.log("\nFirebase Auth, IF the project is on Identity Platform billing");
for (const [dau] of SCENARIOS) {
  const mau = dau * B.mauMultiple;
  console.log(`  MAU ${int(mau).padStart(10)}: $${money(authCost(mau)).padStart(9)}/mo`);
}
console.log("  (plain Firebase Auth is $0 at every size — check which one is active)\n");
