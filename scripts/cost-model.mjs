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
  BYTES, CONTENTION_DAU,
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

// Columns derived from the model's own keys, not listed here. The previous
// version named four and the model grew to six (D66) — the totals moved and
// the columns did not, which is the exact shape of the defect D47 found one
// layer up. A printer that cannot go stale is worth six lines.
console.log("\nreads per user per day, by source — the decomposition is the finding");
{
  const keys = Object.keys(model(SCENARIOS[0][0], SCENARIOS[0][1]).r);
  const w = 9;
  console.log("     DAU" + keys.map((k) => k.padStart(w)).join("") + "total".padStart(w));
  console.log("-".repeat(8 + w * (keys.length + 1)));
  for (const [dau, mature] of SCENARIOS) {
    const { r } = model(dau, mature);
    const t = Object.values(r).reduce((a, b) => a + b, 0);
    console.log(
      int(dau).padStart(8) + keys.map((k) => int(r[k]).padStart(w)).join("") + int(t).padStart(w),
    );
  }
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

// Egress is the softest line in the model — a document-size estimate times a
// price this project has never been billed for — so it prints as a BAND
// rather than a number. The swing variable is how many users fill the
// optional Basics card, because that is what puts a `by` breakdown in the
// published aggregate the fan-out ships on every delivery.
console.log("\negress band — published-aggregate size is the swing variable (D66)");
console.log(`     DAU   ${String(BYTES.aggDocLow / 1000 + " KB").padStart(11)}` +
  `${String(BYTES.aggDoc / 1000 + " KB").padStart(12)}${String(BYTES.aggDocHigh / 1000 + " KB").padStart(12)}`);
console.log("-".repeat(43));
for (const [dau, mature] of SCENARIOS) {
  const at = (k) => "$" + money(model(dau, mature, { aggBytes: k }).cost.egress);
  console.log(
    int(dau).padStart(8) + at("aggDocLow").padStart(11)
    + at("aggDoc").padStart(12) + at("aggDocHigh").padStart(12),
  );
}

// The claim COSTS.md used to make about its own shape: that below 50k DAU
// the bill is boot and top-up. It never was, and post-D66 it is not close.
console.log("\nwhere the fan-out overtakes every FLAT source combined");
{
  const flatOf = (dau, mature) => {
    const { r } = model(dau, mature);
    return r.boot + r.topUp + r.reseed + r.rules + r.server;
  };
  let lo = 100, hi = 500_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (model(mid, true).r.fanOut < flatOf(mid, true)) lo = mid; else hi = mid;
  }
  console.log(`  crossover at DAU ${int(hi)} (flat sources ${int(flatOf(hi, true))} reads/user/day)`);
  console.log(`  D7's write-contention wall is at DAU ${int(CONTENTION_DAU)} — `
    + (hi > CONTENTION_DAU ? "the wall still binds first" : "the READ line crosses FIRST"));
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
