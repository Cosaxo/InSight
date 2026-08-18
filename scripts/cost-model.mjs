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
//   node scripts/cost-model.mjs                  # the region production is on
//   node scripts/cost-model.mjs --multi-region   # the multi-region counterfactual
//
// The default is READ from functions/src/db.ts rather than assumed (D198).
// It used to be multi-region regardless of where the database was, which is
// how every table below priced nam5 for three days after D165 moved
// production to europe-west1 — a bill roughly twice the real one, computed
// correctly from a false premise.
//
// The arithmetic itself moved to scripts/cost-arith.mjs when pulse.mjs
// wanted the same numbers — one model, two consumers, no second copy to go
// stale. This file is now only the formatting. Output is unchanged; if you
// touch either file, diff this command's output before and after.

import {
  costModel, authCost, writesPerSec, B, SCENARIOS,
  firestoreCost, functionsCost, totalCost,
  BYTES, CONTENTION_DAU, REGIONAL, LOCATION_LABEL,
} from "./cost-arith.mjs";

// `--regional` is still accepted and is now a no-op wherever production is
// already regional, which is the harmless direction: it asks for the sheet
// it would get anyway. `--multi-region` is the one that changes anything.
const regional = process.argv.includes("--multi-region") ? false : REGIONAL;
const { bank, model } = costModel({ regional });

const money = (n) => (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString());
const int = (n) => Math.round(n).toLocaleString();

console.log(`\nInSight cost model — ${regional === REGIONAL ? LOCATION_LABEL : "nam5 multi-region"} prices`);
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
// version named four and the model grew to six (D67) — the totals moved and
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

// Polling shipped at D129, so it is the BASELINE above, not a fix below.
// What remains unbuilt is the static bank — and its saving is small enough
// that this table now mostly documents how little is left to win on the
// boot path. Kept rather than deleted: "the remaining fix is worth almost
// nothing" is a finding, and deleting the table would leave nobody able to
// see it.
console.log("\nwith the ONE remaining read fix: the question bank served off Hosting");
console.log("     DAU     TOTAL $/mo      saving");
console.log("-".repeat(38));
for (const [dau, mature] of SCENARIOS) {
  const before = model(dau, mature);
  const after = model(dau, mature, { staticBank: true });
  console.log(
    int(dau).padStart(8) + ("$" + money(totalCost(after.cost))).padStart(15) +
    ("$" + money(totalCost(before.cost) - totalCost(after.cost))).padStart(12),
  );
}

// What D129 bought, kept as a table because the alternative is a sentence
// nobody can re-derive. `streamAggs` recovers the pre-D129 arithmetic —
// seven onSnapshot listeners on the deck, every stranger's answer a billed
// delivery — which is what COSTS.md finding 2 documents.
console.log("\nwhat polling replaced: the streamed deck (pre-D129), for the record");
console.log("     DAU     streamed       polled       saving");
console.log("-".repeat(46));
for (const [dau, mature] of SCENARIOS) {
  const streamed = totalCost(model(dau, mature, { streamAggs: true }).cost);
  const polled = totalCost(model(dau, mature).cost);
  console.log(
    int(dau).padStart(8) + ("$" + money(streamed)).padStart(13) +
    ("$" + money(polled)).padStart(13) +
    (streamed ? "-" + ((1 - polled / streamed) * 100).toFixed(1) + "%" : "—").padStart(13),
  );
}

// Egress is the softest line in the model — a document-size estimate times a
// price this project has never been billed for — so it prints as a BAND
// rather than a number. The swing variable is how many users fill the
// optional Basics card, because that is what puts a `by` breakdown in the
// published aggregate the fan-out ships on every delivery.
console.log("\negress band — published-aggregate size is the swing variable (D67)");
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
// the bill is boot and top-up. It never was, and post-D67 it is not close.
console.log("\nwhere the fan-out overtakes every FLAT source combined");
{
  // Every source except the fan-out itself — derived from the model's own
  // keys rather than listed, the same reason the decomposition printer
  // above derives its columns: this list was five keys long when D102's
  // `social` arrived, and a hardcoded sum drops a new term silently,
  // understating the crossover. (`social` does belong in "flat": its
  // crowd factor is min(VOTER_FETCH_CAP, DAU), constant above the cap.)
  const flatOf = (dau, mature) => {
    const { r } = model(dau, mature);
    return Object.entries(r).reduce((a, [k, v]) => (k === "fanOut" ? a : a + v), 0);
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
