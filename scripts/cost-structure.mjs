#!/usr/bin/env node
// cost-structure.mjs — prices the data-structure reshapes docs/DATA-EFFICIENCY.md
// proposes, against the shipped model in cost-arith.mjs.
//
// Same discipline as cost-levers.mjs: every dollar comes from cost-arith.mjs,
// and each reshape is expressed in the units of the thing it would change —
// documents read per open, per foreground, per boot — so a figure here cannot
// go stale while the constant beside it moves. Nothing is retyped: the shipped
// per-user-day terms are `readsPerUser`'s own, and a reshape is a delta on ONE
// of them, computed from the same B.* behaviour assumptions and the same caps
// read from source (VOTER_FETCH_CAP, KINDRED_QUESTIONS, CIRCLE_ANSWER_CAP,
// DECK_DAYS).
//
// Not a gate: it asserts nothing and is not in CI. It exists so that "what
// would serving Circle from one document per member be worth" is answered by
// running this, never by a number typed into a document.
//
//   node scripts/cost-structure.mjs
//
// What it deliberately prices at ZERO free allowance: production is on the
// named database `insight`, and Google's pricing page says a named database
// does not qualify for the free quota (COST-EXPOSURE.md §2). cost-arith.mjs
// still nets the allowance in `costModel`; the reads and writes here are
// priced straight off the sheet, which is the smaller of the two errors and
// the one the invoice will confirm.

import {
  B, VOTER_FETCH_CAP, DECK_DAYS, PATTERNS_SCAN_READS_PER_MAU,
  SCENARIOS, costModel, REGIONAL, priceSheet, LOCATION_LABEL,
} from "./cost-arith.mjs";

const P = priceSheet(REGIONAL);
const { model } = costModel({ regional: REGIONAL });
const money = (n) => "$" + (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString());

// The crowd a capped fetch returns — cost-arith's own expression. (It was
// the Kindred and sheet rows' factor; those shipped, and it stays for the
// next row that needs it.)
export const crowd = (dau) => Math.min(VOTER_FETCH_CAP, dau);

// Each reshape: the per-user-day reads it removes and the per-user-day writes
// it adds, as functions of the scenario, in the model's own terms. A row
// leaves this list when it ships and its term moves into cost-arith.mjs —
// the foreground refresh (runbook 1.4) was the first, on 2026-09-08, and
// the same day Phase 2 took the names-on-the-sample row, the sheet row
// and the city pass (runbook 2.2–2.5; `socialTerms` in cost-arith.mjs
// now carries all three at their built size) and Phase 3 took the Circle
// row — the answer map, live, on the owner's word (D439 amendment).
export const RESHAPES = [
  {
    key: "deckDoc",
    name: "One deck document per day: seven aggregates in one read at boot",
    reads: () => (DECK_DAYS - 1) * B.boots,
    // the trigger writes the deck document beside today's aggregate
    writes: () => 1,
  },
  {
    key: "aggIncrement",
    name: "Aggregate counters folded by increment, not read-modify-write of the whole document",
    // The trigger's `pubRef` read — one of its three — goes away when the
    // counts are blind increments under merge (the shape the overflow
    // shards already use); the bucket cap moves to a compactor.
    reads: () => B.worldAnswers,
    writes: () => 0,
  },
  {
    key: "scanActiveOnly",
    name: "Candidate-engine scan re-solves only people who answered since the last fit (runbook 4.3b)",
    // The streamed solve (runbook 4.3) reads every fitted person once for
    // the item statistics and once per ALS sweep — PATTERNS_SCAN_READS_
    // PER_MAU per MAU a night. Keeping the per-item statistics between
    // nights and re-reading only the people whose map changed takes that
    // to about one read per ACTIVE person, which the pass already makes.
    reads: () => PATTERNS_SCAN_READS_PER_MAU * B.mauMultiple - 1,
    writes: () => 0,
  },
];

const termsOf = (dau, mature) => model(dau, mature).r;
const totalOf = (r) => Object.values(r).reduce((a, b) => a + b, 0);

console.log(`\nInSight data-structure reshapes — ${LOCATION_LABEL} prices, no free allowance (named database)\n`);
{
  const r = termsOf(50_000, true);
  console.log("shipped reads per user per day at maturity, by term:");
  console.log("  " + Object.entries(r).map(([k, v]) => `${k} ${Math.round(v)}`).join(" · ") + ` · total ${Math.round(totalOf(r))}`);
}

console.log("\nreshape                                                                          saved/user-day  writes+   $/mo saved  5k · 50k · 500k DAU");
console.log("-".repeat(140));
for (const s of RESHAPES) {
  const saved = s.reads(50_000, true);
  const w = s.writes(50_000, true);
  const cols = [5_000, 50_000, 500_000].map((dau) =>
    money(s.reads(dau, true) * dau * 30 * P.read - s.writes(dau, true) * dau * 30 * P.write));
  const live = s.writesIfLive ? ` (+${s.writesIfLive()} if live)` : "";
  console.log(
    s.name.padEnd(80) + String(saved.toFixed(1)).padStart(8) + String(w).padStart(9) + live.padEnd(14)
    + cols.join(" · "),
  );
}

console.log("\nall reshapes together — reads and writes per month, straight off the sheet");
console.log("scenario                 DAU   reads/user-day        $/mo before → after");
console.log("-".repeat(78));
for (const [dau, mature, label] of SCENARIOS) {
  const m = model(dau, mature);
  const t = totalOf(m.r);
  let dr = 0, dw = 0;
  for (const s of RESHAPES) { dr += s.reads(dau, mature); dw += s.writes(dau, mature); }
  const before = t * dau * 30 * P.read + m.writes * 30 * P.write;
  const after = (t - dr) * dau * 30 * P.read + (m.writes + dw * dau) * 30 * P.write;
  console.log(
    label.padEnd(22) + String(dau).padStart(7) + `${Math.round(t)} → ${Math.round(t - dr)}`.padStart(16)
    + `${money(before)} → ${money(after)}`.padStart(26) + `   (−${((1 - after / before) * 100).toFixed(0)}%)`,
  );
}
console.log();
