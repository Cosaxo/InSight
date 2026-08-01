#!/usr/bin/env node
// cost-model.mjs — the arithmetic behind docs/COSTS.md.
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
// The app constants below are READ FROM THE REPO where that is possible
// (the bank size is counted, not typed), so a content change moves the
// model without anyone remembering to edit it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const regional = process.argv.includes("--regional");

// ── price sheet (Blaze) ─────────────────────────────────────────
// Multi-region nam5 is the Firebase default and what prvfire33 is on.
// Regional is roughly half; both are here so the choice is visible.
const P = regional
  ? { read: 0.03e-5, write: 0.09e-5, del: 0.01e-5, store: 0.108 }
  : { read: 0.06e-5, write: 0.18e-5, del: 0.02e-5, store: 0.18 };
const CPU_S = 0.000024;      // $/vCPU-second (Cloud Run tier 1)
const MEM_S = 0.0000025;     // $/GiB-second
const REQ = 0.4e-6;          // $/request

// Free tiers. Firestore's are per DAY; Cloud Run's are per MONTH.
const FREE = { read: 50_000, write: 20_000, del: 20_000, storeGiB: 1 };
const FREE_MO = { cpu: 180_000, mem: 360_000, req: 2_000_000 };

// ── app constants ───────────────────────────────────────────────
// Counted from the generated seed rather than hardcoded: the bank grows
// every promotion cycle (D30) and the cold-boot read cost grows with it.
function bankDocs() {
  const src = readFileSync(join(ROOT, "functions/src/v2content.ts"), "utf8");
  const head = "V2_QUESTIONS: V2SeedQuestion[] = ";
  const body = src.slice(src.indexOf(head) + head.length);
  return JSON.parse(body.slice(0, body.lastIndexOf("];") + 1)).length;
}
const BANK = bankDocs();
const DECK_DAYS = 7;         // src/v2/data/deck.ts
const AGG_CAP = 120;         // live.ts hydrate() top-up cap
const PUBLISH_EVERY = 5;     // functions/src/v2.ts
// HOT_TRIGGER, functions/src/ops.ts. 200 ms is an estimate — two reads and
// two-to-three writes in one transaction — and is the softest input here.
const TRIG = { mem: 0.5, cpu: 1, conc: 20, sec: 0.2 };

// ── behaviour assumptions ───────────────────────────────────────
// The soft numbers. Every one of these is a guess about humans, not a fact
// about the code, which is why they are named and grouped rather than
// scattered through the arithmetic.
const B = {
  worldAnswers: 3,     // daily + feed + learn
  duelAnswers: 1,
  boots: 1.4,          // app opens per active user per day
  onlineMin: 3,        // minutes with the app actually open
  peakWindowMin: 240,  // D7's 4-hour morning window
  mauMultiple: 3,      // MAU = 3 x DAU
  reseedsPerMonth: 4,  // the launch plan's weekly promotion cadence
};

// Reads decompose into exactly four sources — see COSTS.md "Where the
// reads actually go". Keeping them separate is the whole point: the totals
// are unremarkable, the decomposition is where the findings live.
function readsPerUser(dau, { mature, staticBank = false, pollAggs = false }) {
  const boot = (1 + 1 + 1 + DECK_DAYS + 1 + 2 + 2) * B.boots;
  // A question under the floor is re-read at most once per 6 h, so roughly
  // one boot in four pays for it. Mature communities have few left.
  const topUp = ((mature ? 5 : AGG_CAP) / 4) * B.boots;
  // Charged per MAU, not per DAU: a monthly visitor pays the full bank.
  const reseed = staticBank ? 0 : (BANK * B.reseedsPerMonth * B.mauMultiple) / 30;
  // The quadratic one. Publishes scale with DAU; concurrent listeners
  // scale with DAU; every delivery is a billed read. ~1 of the 3 world
  // answers is the globally shared daily, which is the hot document.
  const concurrent = dau / (B.peakWindowMin / B.onlineMin);
  const fanOut = pollAggs ? 0 : concurrent * (B.worldAnswers / PUBLISH_EVERY) / 3;
  return { boot, topUp, reseed, fanOut };
}

function model(dau, mature, opts = {}) {
  const r = readsPerUser(dau, { mature, ...opts });
  const reads = Object.values(r).reduce((a, b) => a + b, 0) * dau;
  // Below the floor the public mirror is rewritten on EVERY answer; above
  // it, once per five. The cold-start period is the expensive one.
  const pub = mature ? 1 / PUBLISH_EVERY : 1;
  const writes = dau * (B.worldAnswers * (1 + 2 + pub) + B.duelAnswers * 2 + 0.2);
  const deletes = dau * B.worldAnswers; // ledger TTL, 90 days later
  const inv = dau * (B.worldAnswers + B.duelAnswers);
  // Concurrency 20 only pays off under queue pressure; at low volume each
  // invocation effectively owns its instance for the request.
  const pack = Math.min(TRIG.conc, Math.max(1, dau / 500));
  const cpu = (inv * TRIG.sec * TRIG.cpu) / pack;
  const mem = (inv * TRIG.sec * TRIG.mem) / pack;
  const storeGiB =
    (dau * (B.worldAnswers + B.duelAnswers) * 0.5 * 365 +
      dau * B.worldAnswers * 0.4 * 90) / 1024 / 1024;

  const over = (used, free) => Math.max(0, used - free);
  const cost = {
    reads: over(reads, FREE.read) * P.read * 30,
    writes: over(writes, FREE.write) * P.write * 30,
    deletes: over(deletes, FREE.del) * P.del * 30,
    storage: over(storeGiB, FREE.storeGiB) * P.store,
    cpu: over(cpu * 30, FREE_MO.cpu) * CPU_S,
    mem: over(mem * 30, FREE_MO.mem) * MEM_S,
    req: over(inv * 30, FREE_MO.req) * REQ,
  };
  return { r, reads, writes, inv, storeGiB, cost };
}

// Identity Platform MAU tiers. Only applies if the project was upgraded —
// plain Firebase Auth is free at any size. COSTS.md finding 3: nobody has
// recorded which one prvfire33 is on, and the gap is four figures a month.
const AUTH_TIERS = [[49_999, 0], [99_999, 0.0055], [999_999, 0.0046], [9_999_999, 0.0032]];
const authCost = (mau) => {
  let c = 0, prev = 0;
  for (const [cap, rate] of AUTH_TIERS) {
    if (mau > prev) { c += (Math.min(mau, cap) - prev) * rate; prev = cap; }
  }
  return c;
};

const SCENARIOS = [
  [50, false, "Launch / TestFlight"],
  [500, false, "Friends-of-friends"],
  [5_000, true, "Real traction"],
  [50_000, true, "Scale"],
  [500_000, true, "Hit"],
];

const money = (n) => (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString());
const int = (n) => Math.round(n).toLocaleString();

console.log(`\nInSight cost model — ${regional ? "single-region" : "nam5 multi-region"} prices`);
console.log(`bank: ${BANK} question docs (counted from functions/src/v2content.ts)\n`);

console.log("scenario                 DAU     reads/day   writes/day   Firestore  functions      TOTAL");
console.log("-".repeat(92));
for (const [dau, mature, label] of SCENARIOS) {
  const m = model(dau, mature);
  const fs = m.cost.reads + m.cost.writes + m.cost.deletes + m.cost.storage;
  const fn = m.cost.cpu + m.cost.mem + m.cost.req;
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
  const sum = (c) => Object.values(c).reduce((a, b) => a + b, 0);
  console.log(
    int(dau).padStart(8) + ("$" + money(sum(after.cost))).padStart(15) +
    ("$" + money(sum(before.cost) - sum(after.cost))).padStart(12),
  );
}

console.log("\nD7 write-contention wall (~1 write/sec/document on the shared daily)");
for (const [dau] of SCENARIOS) {
  const wps = dau / (B.peakWindowMin * 60);
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
