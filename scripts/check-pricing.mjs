#!/usr/bin/env node
// check-pricing.mjs — the committed rate card stays inside its own rules.
//
// content/pricing.json is the PUBLIC half of the paid mechanism (PAID-PLAN
// §6, D288 §3): the door prints it, buyers read it, and it is recomputed by
// scripts/build-pricing.mjs from the purchase ledger. A malformed or
// out-of-bounds card would either break the door client-side or print a
// price the mechanism's own clamps forbid — and because the file is edited
// by script AND by hand (the constants are re-priced by PR), both authors
// need the same referee.
//
// What it holds, each line a recorded rule:
//   - the constants are sane: base > 0, 0 < floorX ≤ ceilX, caps positive
//     (§6's floor-and-ceiling — "a floor so every cohort stays buyable, a
//     ceiling so the multiplier never turns the slot into a bidding war")
//   - cohorts are EXACTLY city · country · world (D164's three windows)
//   - every idx sits inside [floorX, ceilX] — a value outside the clamps
//     means the script's arithmetic and this file disagree
//   - every booked row is exactly 14 days of 0/1 — the door draws exactly
//     that many ticks
//   - nextOpen is null (= tomorrow) or an ISO day
//   - estimates carry their basis or do not exist (D288 §3: no forecast
//     without a completed campaign behind it — campaigns ≥ 1, days ≥ 1)
//
// Run: node scripts/check-pricing.mjs   (wired into ci.yml's client job —
// client content, so it stays OFF backend-checks.yml: nothing here says
// anything about whether a rules fix is safe to deploy.)

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "content/pricing.json";

const fails = [];
const fail = (msg) => fails.push(msg);

let p;
try {
  p = JSON.parse(readFileSync(resolve(root, FILE), "utf8"));
} catch (err) {
  console.error(`check-pricing: ${FILE} does not parse — ${err.message}`);
  process.exit(1);
}

const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

if (!isDay(p.generated)) fail(`generated must be YYYY-MM-DD, got ${JSON.stringify(p.generated)}`);
if (p.currency !== "EUR") fail(`currency must be EUR (the rate card's own unit; display conversion is the client's), got ${JSON.stringify(p.currency)}`);
if (!(typeof p.base === "number" && p.base > 0)) fail(`base must be a positive per-answer figure, got ${JSON.stringify(p.base)}`);
if (!(typeof p.floorX === "number" && p.floorX > 0)) fail(`floorX must be positive, got ${JSON.stringify(p.floorX)}`);
if (!(typeof p.ceilX === "number" && p.ceilX >= p.floorX)) fail(`ceilX must be ≥ floorX, got ${JSON.stringify(p.ceilX)}`);
if (!(typeof p.capEur === "number" && p.capEur > 0)) fail(`capEur must be positive, got ${JSON.stringify(p.capEur)}`);
if (!(typeof p.floorWeek === "number" && p.floorWeek > 0)) fail(`floorWeek must be positive, got ${JSON.stringify(p.floorWeek)}`);
if (!(Number.isInteger(p.trailingDays) && p.trailingDays > 0)) fail(`trailingDays must be a positive integer, got ${JSON.stringify(p.trailingDays)}`);
// The display-conversion table is part of the committed card: a rate the
// client would otherwise hardcode is a fact that drifts, so it lives here,
// dated by `generated` and diffed like the prices it converts.
const fx = p.fx || {};
for (const [code, r] of Object.entries(fx)) {
  if (!/^[A-Z]{3}$/.test(code)) fail(`fx.${code} is not a currency code`);
  if (!(typeof r === "number" && r > 0)) fail(`fx.${code} must be a positive EUR multiplier, got ${JSON.stringify(r)}`);
}

const SCOPES = ["city", "country", "world"];
const cohorts = p.cohorts || {};
const seen = Object.keys(cohorts).sort();
if (seen.join(",") !== [...SCOPES].sort().join(","))
  fail(`cohorts must be exactly ${SCOPES.join(" · ")}, got [${seen.join(", ")}]`);
for (const scope of SCOPES) {
  const c = cohorts[scope];
  if (!c) continue;
  if (!(typeof c.idx === "number" && c.idx >= p.floorX && c.idx <= p.ceilX))
    fail(`${scope}.idx ${JSON.stringify(c.idx)} is outside [${p.floorX}, ${p.ceilX}] — the clamps are the mechanism`);
  if (!Array.isArray(c.booked) || c.booked.length !== 14 || c.booked.some((b) => b !== 0 && b !== 1))
    fail(`${scope}.booked must be exactly 14 entries of 0/1`);
  if (!(c.nextOpen === null || isDay(c.nextOpen)))
    fail(`${scope}.nextOpen must be null (= tomorrow) or YYYY-MM-DD, got ${JSON.stringify(c.nextOpen)}`);
}

const est = p.estimates || {};
for (const [scope, e] of Object.entries(est)) {
  if (!SCOPES.includes(scope)) { fail(`estimates.${scope} is not a cohort`); continue; }
  if (!(Number.isInteger(e.perDay) && e.perDay >= 0)) fail(`estimates.${scope}.perDay must be a non-negative integer`);
  if (!(Number.isInteger(e.campaigns) && e.campaigns >= 1)) fail(`estimates.${scope} without campaigns ≥ 1 — a forecast needs a completed campaign behind it (D288 §3)`);
  if (!(Number.isInteger(e.days) && e.days >= 1)) fail(`estimates.${scope}.days must be ≥ 1 — the basis ships with the figure`);
}

// ── the functions copy (D304) ───────────────────────────────────────────
// The booking path prices server-side off functions/src/pricing.ts, a
// generated embed of this same card (scripts/gen-pricing-ts.mjs — the
// gen-v2content relationship). Byte-compare here so the price the server
// charges and the price the door prints cannot drift: a card edit without
// a regen fails THIS gate, not a buyer.
try {
  const { generatePricingTs } = await import("./gen-pricing-ts.mjs");
  const want = generatePricingTs(readFileSync(resolve(root, FILE), "utf8"));
  const have = readFileSync(resolve(root, "functions", "src", "pricing.ts"), "utf8");
  if (want !== have) {
    fail("functions/src/pricing.ts is out of sync with content/pricing.json — run `npm run build:pricing-ts` and commit it");
  }
} catch (err) {
  fail(`functions/src/pricing.ts could not be compared — ${err.message}`);
}

if (fails.length) {
  console.error(`check-pricing: ${FILE} breaks its own rules:\n`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  console.error("\nRegenerate with scripts/build-pricing.mjs, or fix the hand-edit.");
  process.exit(1);
}
const nBooked = SCOPES.map((s) => `${s} ${cohorts[s].booked.filter(Boolean).length}/14`).join(" · ");
console.log(`check-pricing OK — base €${p.base}/answer, idx ${SCOPES.map((s) => `${s} ×${cohorts[s].idx}`).join(" · ")}; booked ${nBooked}; ${Object.keys(est).length} estimate(s), each with its basis.`);
