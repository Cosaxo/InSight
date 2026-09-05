#!/usr/bin/env node
// check-pricing.mjs — the committed rate card stays inside its own rules.
//
// content/pricing.json is the PUBLIC half of the paid mechanism (PAID-PLAN
// §6, D288 §3): its CONSTANTS are the policy every price is computed from,
// and its demand fields are the fallback the door prints until the live
// half lands (D366 — the server folds the ledger onto `v2_meta/pricing`
// after every sale and every night; scripts/build-pricing.mjs runs the
// same fold by hand and refreshes this snapshot). A malformed or
// out-of-bounds card would either break the door client-side or print a
// price the mechanism's own clamps forbid — and because the file is edited
// by script AND by hand (the constants are re-priced by PR), both authors
// need the same referee. The live document is held to the same shape by
// the two overlay parsers (functions/src/pricingFold.ts mergeLivePricing,
// src/v2/data/pricing.ts parseLive), each tested on its own side.
//
// What it holds, each line a recorded rule:
//   - the constants are sane: base > 0, floorX > 0, crowdStep ≥ 0, caps
//     positive (§6's floor — "so every cohort stays buyable"; the ceiling
//     left at D368, because the index measures crowding and crowding has
//     none)
//   - cohorts are EXACTLY city · country · world (D164's three windows)
//   - every idx sits at or above floorX — a value under the floor means
//     the fold's arithmetic and this file disagree
//   - every booked row is exactly 14 days of 0/1 — the door draws exactly
//     that many ticks
//   - nextOpen is null (= tomorrow) or an ISO day
//   - estimates carry their basis or do not exist (D288 §3: no forecast
//     without a campaign behind it — campaigns ≥ 1, days ≥ 1; since D367 a
//     campaign that has served a week counts, and `running` says how many)
//   - the buyer's budget range is sane (D367): minEur below capEur, and
//     every preset a whole-euro figure inside it, ascending
//   - crowdFree (D372) is the places a scope has before campaigns share
//     — a whole number of at least one; the multiplier counts the
//     campaigns beyond it, so 1 is D368's every-campaign-crowds card
//   - the menu (D371) names a preset per cohort — city · country ·
//     world, each one of `budgets` so the composer opens on a chip it
//     can press, non-decreasing outward, because a wider reach at a
//     lower price would print the door's own argument backwards
//   - windowDays is the one window every campaign runs (D313's 29): a
//     positive whole number, read by the server's booking path and
//     printed by the door, so neither can say a different figure
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
// The crowding step (D368): what each other campaign in rotation adds to
// the multiplier. Zero is legal (a flat card); negative is not a price.
if (!(typeof p.crowdStep === "number" && p.crowdStep >= 0)) fail(`crowdStep must be a non-negative number, got ${JSON.stringify(p.crowdStep)}`);
// The free places (D372): how many campaigns a scope carries before the
// next one shares — the feed gives paid cards their own places, one in
// every SPONSOR_EVERY, so the first few sales dilute nobody.
if (!(Number.isInteger(p.crowdFree) && p.crowdFree >= 1)) fail(`crowdFree must be a whole number of places, at least 1, got ${JSON.stringify(p.crowdFree)}`);
if (!(typeof p.capEur === "number" && p.capEur > 0)) fail(`capEur must be positive, got ${JSON.stringify(p.capEur)}`);
// The buyer's budget (D367): capEur is the MOST a buyer may set, minEur
// the least, and `budgets` the presets the composer offers — each inside
// that range, ascending, so the door never offers a figure the server
// would refuse.
if (!(typeof p.minEur === "number" && p.minEur > 0 && p.minEur < p.capEur)) fail(`minEur must be positive and below capEur, got ${JSON.stringify(p.minEur)}`);
if (!Array.isArray(p.budgets) || p.budgets.length < 2) fail(`budgets must list at least two presets, got ${JSON.stringify(p.budgets)}`);
else {
  p.budgets.forEach((b, i) => {
    if (!(Number.isInteger(b) && b >= p.minEur && b <= p.capEur)) fail(`budgets[${i}] ${JSON.stringify(b)} is not a whole-euro figure inside [${p.minEur}, ${p.capEur}]`);
    if (i > 0 && !(b > p.budgets[i - 1])) fail(`budgets must ascend — ${JSON.stringify(p.budgets)}`);
  });
}
// The menu (D371): the price a row on the door prints per reach — a
// preset budget per cohort, sold as "up to N answers" at the line in
// force. Each must be one of the composer's chips, or picking a row
// would open on a budget no chip shows pressed.
const menu = p.menu && typeof p.menu === "object" ? p.menu : null;
if (!menu) fail(`menu must map city · country · world to a preset budget, got ${JSON.stringify(p.menu)}`);
else {
  const keys = Object.keys(menu).sort();
  if (keys.join(",") !== "city,country,world") fail(`menu must name exactly city · country · world, got [${keys.join(", ")}]`);
  const budgets = Array.isArray(p.budgets) ? p.budgets : [];
  for (const scope of ["city", "country", "world"]) {
    const m = menu[scope];
    if (!budgets.includes(m)) fail(`menu.${scope} ${JSON.stringify(m)} is not one of the budget presets ${JSON.stringify(budgets)}`);
  }
  if (!(menu.city <= menu.country && menu.country <= menu.world)) fail(`menu must not fall as the reach widens — city ≤ country ≤ world, got ${JSON.stringify(menu)}`);
}
if (!(Number.isInteger(p.windowDays) && p.windowDays > 0)) fail(`windowDays must be a positive whole number of days, got ${JSON.stringify(p.windowDays)}`);
// `adBase` — the flat ad window (D315) — left the card at D370 with the
// self-serve ad lane; a card that still carries it is stale.
if (p.adBase !== undefined) fail("adBase is no longer a price — the ad lane retired at D370; drop it from the card");
if (!(typeof p.floorWeek === "number" && p.floorWeek > 0)) fail(`floorWeek must be positive, got ${JSON.stringify(p.floorWeek)}`);
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
  if (!(typeof c.idx === "number" && Number.isFinite(c.idx) && c.idx >= p.floorX))
    fail(`${scope}.idx ${JSON.stringify(c.idx)} is under the floor ${p.floorX} — the floor is the mechanism`);
  if (!Array.isArray(c.booked) || c.booked.length !== 14 || c.booked.some((b) => b !== 0 && b !== 1))
    fail(`${scope}.booked must be exactly 14 entries of 0/1`);
  // The crowding strip (D368): campaigns in rotation per day, the count
  // the idx is folded from. Optional so a card from before it parses.
  if (c.crowd !== undefined && (!Array.isArray(c.crowd) || c.crowd.length !== 14 || c.crowd.some((n) => !Number.isInteger(n) || n < 0)))
    fail(`${scope}.crowd must be exactly 14 non-negative integers`);
  if (!(c.nextOpen === null || isDay(c.nextOpen)))
    fail(`${scope}.nextOpen must be null (= tomorrow) or YYYY-MM-DD, got ${JSON.stringify(c.nextOpen)}`);
}

const est = p.estimates || {};
for (const [scope, e] of Object.entries(est)) {
  if (!SCOPES.includes(scope)) { fail(`estimates.${scope} is not a cohort`); continue; }
  if (!(Number.isInteger(e.perDay) && e.perDay >= 0)) fail(`estimates.${scope}.perDay must be a non-negative integer`);
  if (!(Number.isInteger(e.campaigns) && e.campaigns >= 1)) fail(`estimates.${scope} without campaigns ≥ 1 — a forecast needs a completed campaign behind it (D288 §3)`);
  if (!(Number.isInteger(e.days) && e.days >= 1)) fail(`estimates.${scope}.days must be ≥ 1 — the basis ships with the figure`);
  // D367: a campaign still serving may be part of the basis after a week;
  // the count of those rides along so the door can say so.
  if (e.running !== undefined && !(Number.isInteger(e.running) && e.running >= 0 && e.running <= e.campaigns)) fail(`estimates.${scope}.running must be an integer between 0 and campaigns`);
}

// ── the functions copy (D313) ───────────────────────────────────────────
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
console.log(`check-pricing OK — base €${p.base}/answer, ${p.crowdFree} free place(s) then +${Math.round(p.crowdStep * 100)}% per campaign beyond, budgets €${p.minEur}–€${p.capEur}, menu €${p.menu.city} · €${p.menu.country} · €${p.menu.world} for ${p.windowDays} days; idx ${SCOPES.map((s) => `${s} ×${cohorts[s].idx}`).join(" · ")}; booked ${nBooked}; ${Object.keys(est).length} estimate(s), each with its basis.`);
