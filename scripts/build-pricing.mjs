// build-pricing.mjs — refold the purchase ledger into content/pricing.json
// (PAID-PLAN §6, D288 §3; the runbook's phase 3).
//
//   node scripts/build-pricing.mjs --project prvfire33
//   node scripts/build-pricing.mjs --emulator
//
// Needs admin credentials (GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth
// application-default login`), or --emulator with the Firestore emulator up.
//
// Run BY HAND, in the same sitting as scripts/record-purchase.mjs — a
// contract lands, the fold reruns, the changed pricing.json goes in the
// same commit. The door reads the COMMITTED file and never other buyers'
// rows: "a price a buyer cannot see is a price that can be quietly
// discriminated, and this repo's answer to that class of problem is
// always the same: publish the number" (PAID-PLAN §6).
//
// What each field is, and where its honesty comes from:
//
//   idx        The demand multiplier per cohort: sold ÷ available
//              slot-days over the trailing window (§6's "desire"),
//              mapped LINEARLY into [floorX, ceilX] —
//              idx = floorX + ratio × (ceilX − floorX), rounded to 2dp.
//              The mapping is a choice, so it is stated here and diffed
//              in PRs like the numbers it produces. One slot per day per
//              cohort (SPONSOR_SLOT stays the unit of sale — the cap is
//              one diff away, which is why it is a named constant).
//   booked     The next 14 days as 0/1: day i is generated+1+i, booked
//              when any running QUESTION purchase of that scope covers
//              it. Real windows, nothing else — with an empty ledger the
//              row is all zeros, which is true.
//   nextOpen   The first uncovered day, ISO — or null when tomorrow is
//              open, so the door can say "tomorrow" without a stale date.
//   estimates  Per-answer-per-day expectations, WITHHELD until a cohort
//              has a completed campaign to measure from (D288 §3): only
//              CLOSED question purchases contribute, each as its
//              sponsored question's total answers over its window, and
//              the entry carries its basis (campaigns, days). An empty
//              ledger prints prices and open days — never a forecast.
//
// The subscriptions kind is ignored here on purpose: a subscription buys
// a metric's continuity, not the daily slot (PAID-PLAN §5), so it moves
// no slot-day arithmetic.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "content/pricing.json");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};
const die = (msg) => { console.error(`build-pricing: ${msg}`); process.exit(1); };

const emulator = flag("emulator");
const projectId = opt("project") || (emulator ? "demo-insight" : undefined);
if (!projectId) die("--project is required (or --emulator)");
if (emulator && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

initializeApp(emulator ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

// The standing constants come FROM the committed file, so a deliberate
// re-pricing is an edit to pricing.json reviewed in a PR — this script
// only ever moves the demand-derived fields.
const prev = JSON.parse(readFileSync(OUT, "utf8"));
const { base, floorX, ceilX, floorWeek, capEur, currency, trailingDays, fx } = prev;
if (!(base > 0) || !(floorX > 0) || !(ceilX >= floorX)) die("pricing.json constants are out of shape — fix the file first");

const DAY = 24 * 60 * 60 * 1000;
const dayISO = (t) => new Date(t).toISOString().slice(0, 10);
const todayUTC = Date.parse(`${dayISO(Date.now())}T00:00:00Z`);

const snap = await db.collection("v2_purchases").get();
const purchases = snap.docs.map((d) => d.data()).filter((p) => p && p.kind === "question");

const parse = (s) => {
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
};
const covers = (p, t) => {
  const a = parse(p.window && p.window.start);
  const b = parse(p.window && p.window.until);
  return a != null && b != null && a <= t && t <= b;
};

const SCOPES = ["city", "country", "world"];
const cohorts = {};
const estimates = {};
for (const scope of SCOPES) {
  const mine = purchases.filter((p) => p.scope === scope);

  // sold ÷ available slot-days over the trailing window, one slot per day
  let sold = 0;
  for (let i = 1; i <= trailingDays; i++) {
    const t = todayUTC - i * DAY;
    if (mine.some((p) => covers(p, t))) sold++;
  }
  const ratio = trailingDays ? sold / trailingDays : 0;
  const idx = Math.round(Math.min(ceilX, Math.max(floorX, floorX + ratio * (ceilX - floorX))) * 100) / 100;

  // the next 14 days as real windows; day i is generated+1+i
  const booked = [];
  let nextOpen = null;
  for (let i = 1; i <= 14; i++) {
    const t = todayUTC + i * DAY;
    const b = mine.some((p) => p.state === "running" && covers(p, t)) ? 1 : 0;
    booked.push(b);
    if (!b && nextOpen === null) nextOpen = i === 1 ? "tomorrow" : dayISO(t);
  }
  // `nextOpen` CANNOT SAY "sold out", and no reader may ask it to. It is
  // null both when tomorrow is open and when the loop above found no open
  // day at all, because the stored shape is `null | YYYY-MM-DD` and has no
  // third value. `booked` is the field that carries it — all ones — and the
  // rate card reads that (SgRateRow, spec/suggestions.jsx) rather than
  // printing "next open tomorrow" over a full fortnight, which is what it
  // did until 2026-08-26.

  cohorts[scope] = {
    idx,
    booked,
    nextOpen: nextOpen === "tomorrow" ? null : nextOpen,
  };

  // estimates only from completed campaigns (D288 §3) — the sponsored
  // question's own total over its window, basis carried
  const closed = mine.filter((p) => p.state === "closed" && p.qid);
  let answers = 0, days = 0, campaigns = 0;
  for (const p of closed) {
    const a = parse(p.window && p.window.start);
    const b = parse(p.window && p.window.until);
    if (a == null || b == null || b <= a) continue;
    const agg = await db.doc(`v2_question_aggs/${p.qid}`).get();
    if (!agg.exists) continue;
    const counts = agg.get("counts") || {};
    const total = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
    answers += total;
    days += Math.round((b - a) / DAY);
    campaigns++;
  }
  if (campaigns > 0 && days > 0) {
    estimates[scope] = { perDay: Math.round(answers / days), campaigns, days };
  }
}

const out = {
  generated: dayISO(Date.now()),
  currency, base, floorX, ceilX, floorWeek, capEur, fx, trailingDays,
  cohorts,
  estimates,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote content/pricing.json — ${purchases.length} question purchase(s) folded`);
for (const scope of SCOPES) {
  const c = cohorts[scope];
  console.log(`  ${scope}: idx ×${c.idx} · ${c.booked.filter(Boolean).length} of 14 days booked · next open ${c.nextOpen || "tomorrow"}${estimates[scope] ? ` · ≈${estimates[scope].perDay}/day over ${estimates[scope].campaigns} campaign(s)` : " · no completed campaign — no estimate"}`);
}
console.log("\nCommit the changed pricing.json — the committed file IS the rate card the door prints.");
