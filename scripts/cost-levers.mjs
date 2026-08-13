#!/usr/bin/env node
// cost-levers.mjs — what each available change is worth, and in what order.
//
// docs/COSTS.md answers "what will this cost". docs/COST-COMPARISON.md
// answers "is that a lot". This answers "so what do we do about it", which
// is the only one of the three with an action at the end of it.
//
// Same shape as its two siblings — a printer, not a gate. It asserts
// nothing and is not wired into CI. What it is for is re-running the plan
// when an input moves, so docs/COST-REDUCTION.md never becomes folklore.
//
//   node scripts/cost-levers.mjs
//
// THE ARITHMETIC IS NOT HERE and neither are the grades. Every dollar comes
// from scripts/cost-arith.mjs and every letter from scripts/cost-peers.mjs.
// This file contributes exactly one new thing: LEVERS — a list of changes
// somebody could actually make, each expressed in the UNITS OF THE THING IT
// WOULD CHANGE rather than as a saving. `{ kindredQuestions: 4 }` stays
// correct when KINDRED_QUESTIONS moves; "saves 96 reads/user/day" is a
// hand-computed figure that goes stale silently, which is the one
// documentation error this repo keeps re-committing (D39, check:figures).
//
// So no number below is typed. Every one is the model's answer to "what if".
//
// WHAT THIS FILE CANNOT TELL YOU. Effort and risk are judgements, and the
// `notices` field — what a USER would see change — is the one that decides
// most of these and cannot be modelled at all. A lever that halves the bill
// and quietly makes a Mirror stop wrong is not a saving, it is the
// UI-says-it-server-doesn't failure this product defines itself against.
// Those three fields are stated per lever so they can be argued with; only
// the dollars are computed.

import { costModel, totalCost, SCENARIOS } from "./cost-arith.mjs";
import { rate, money, unit, int } from "./cost-peers.mjs";

// Both price sheets built once: costModel() re-reads and re-parses the seed
// to count the bank on every call, which is fine once and silly in a loop.
const MODELS = { false: costModel({}), true: costModel({ regional: true }) };
const evaluate = (dau, mature, { regional = false, ...opts } = {}) =>
  totalCost(MODELS[String(regional)].model(dau, mature, opts).cost);
const readsOf = (dau, mature, { regional = false, ...opts } = {}) =>
  MODELS[String(regional)].model(dau, mature, opts).r;

// Deep-ish merge, because `social` is the one nested bag of overrides and a
// spread would silently drop the earlier levers' social keys — which would
// make a stacked path quietly cheaper than it is, in the flattering
// direction.
const merge = (...os) =>
  os.reduce((acc, o) => ({ ...acc, ...o, social: { ...acc.social, ...(o.social ?? {}) } }), { social: {} });

const SIZES = SCENARIOS.map(([dau, mature, label]) => ({ dau, mature, label }));

// Saving as a percentage, with enough places to stay honest at both ends.
// A flat %.0f prints "-0%" for a real 0.4% cut and "-100%" for a 99.6% one,
// and the second of those is the dangerous rounding: it reads as "free".
const cut = (base, after) => {
  if (base === 0) return "—";
  const p = (1 - after / base) * 100;
  // A negative saving is an INCREASE. It happens for real — a shipped lever
  // compared the wrong way round, or one that trades a term for a bigger
  // one — and the first draft of this printed "--40.1%", which reads as a
  // typo rather than as the sign error it was.
  const sign = p < 0 ? "+" : "-";
  const a = Math.abs(p);
  return sign + (a >= 99 || a < 1 ? a.toFixed(1) : a.toFixed(0)) + "%";
};

// ── the levers ──────────────────────────────────────────────────
//
// Ordered cheapest-first within each band, and banded by what they cost to
// do rather than by what they save — because the whole point of the exercise
// is that the biggest saving is not the first thing to reach for.
const LEVERS = [
  {
    band: "config",
    name: "Single-region database",
    change: "nam5 -> a single region, at database creation",
    opts: { regional: true },
    effort: "one setting",
    risk: "IRREVERSIBLE, and has a deadline",
    notices: "nothing — until a region outage, which is the trade being made",
  },
  {
    band: "client",
    name: "Refresh only today on foreground",
    change: "reattach reads DECK_DAYS -> 1 (the back days keep their boot values)",
    opts: { deckListeners: 1 },
    effort: "hours",
    risk: "low",
    // Now the SECOND-largest client term, because polling removed the one
    // that used to dwarf it: `reattach` is bgCycles x DECK_DAYS reads a day
    // against the poll's own handful. The app refreshes the whole deck on
    // every foreground, which is the conservative choice; this lever is the
    // less conservative one.
    notices: "a back day's count can lag until the next cold boot",
  },
  {
    band: "product",
    name: "Kindred walks 4 lists, not 12",
    change: "KINDRED_QUESTIONS 12 -> 4",
    opts: { social: { kindredQuestions: 4 } },
    effort: "one constant",
    risk: "low",
    notices: "a thinner People lens — ranked from 4 of your answers, not 12",
  },
  {
    band: "product",
    name: "Who-voted pages at 50",
    change: "VOTER_FETCH_CAP 200 -> 50, with a cursor for page two",
    opts: { social: { voterCap: 50 } },
    effort: "one constant + a 'load more'",
    risk: "low",
    notices: "'the latest 50 of N' instead of 200 — the honesty rule already covers it",
  },
  {
    band: "product",
    name: "Circle reads 100 answers/member",
    change: "CIRCLE_ANSWER_CAP 300 -> 100",
    opts: { social: { circleAnswerCap: 100 } },
    effort: "one constant",
    risk: "low",
    notices: "Circle compares over ~5 weeks of a member's answers, not ~13",
  },
  {
    band: "architecture",
    name: "Batch the mirror publish (x5)",
    change: "publish the aggregate every 5th answer, as a PERF measure",
    opts: { publishEvery: 5 },
    effort: "days — a trigger change",
    risk: "medium",
    notices: "the live count steps in fives; no privacy claim attached (D98 retired that)",
  },
  {
    band: "architecture",
    name: "Serve the bank off Hosting",
    change: "the question bank as one gzipped CDN asset (staticBank)",
    opts: { staticBank: true },
    effort: "days",
    risk: "low",
    notices: "nothing; cold boot gets faster",
  },
  {
    band: "architecture",
    name: "[SHIPPED D129] Poll instead of stream",
    change: "no onSnapshot on the deck; fetch on vote + a slow timer",
    // Inverted: this is what the app does now, so the "lever" is what
    // REVERTING would cost. Kept in the list rather than deleted, because a
    // lever table that silently drops its biggest entry the day it ships
    // teaches the next reader that the fan-out was never the problem.
    opts: { streamAggs: true },
    effort: "shipped",
    risk: "shipped",
    // CORRECTED after reading the consumers. This field first said the flat
    // "counts update on a timer", which overstated the loss by implying the
    // vote→counted transition rides the listener. It does not:
    // `scheduleAggRefresh` (live.ts:390) already re-reads the aggregate 2.5 s
    // after the write acks and clears `state.unaggregated`, and it is called
    // on BOTH answer paths (the vote ack and D86's edit). The snapshot's own
    // clear at live.ts:494 is a second, redundant route. So what polling
    // actually costs is narrower than it sounds: OTHER people's votes
    // arriving on the card while you watch it.
    notices: "other people's votes stop landing live; your own still confirms in ~2.5 s",
    shipped: true,
  },
];

console.log("\nInSight cost levers — what each change is worth");
console.log("dollars from scripts/cost-arith.mjs, grades from scripts/cost-peers.mjs\n");

// ── 1. each lever alone ─────────────────────────────────────────
// Marginal, against the shipped app. Deliberately NOT cumulative: several of
// these overlap (pollAggs subsumes both publishEvery and deckListeners), so
// a column of individually-true savings would sum to more than exists. The
// stacking is section 3's job, and it is computed rather than added up.
console.log("1 · Each lever on its own, against the app as built");
console.log("                                                " +
  SIZES.map((s) => int(s.dau).padStart(11)).join(""));
console.log("-".repeat(46 + 11 * SIZES.length));
console.log("as built (post-D129)".padEnd(46) + SIZES.map((s) => money(evaluate(s.dau, s.mature)).padStart(11)).join(""));
console.log("-".repeat(46 + 11 * SIZES.length));
for (const L of LEVERS) {
  // A shipped lever's opts describe the OLD world, so the comparison runs
  // the other way round: what reverting would ADD, not what applying would
  // save. Printing it with the same sign as the unbuilt ones would be a
  // straightforward lie about which direction the app has moved.
  const saved = SIZES.map((s) => (L.shipped
    ? cut(evaluate(s.dau, s.mature, L.opts), evaluate(s.dau, s.mature))
    : cut(evaluate(s.dau, s.mature), evaluate(s.dau, s.mature, L.opts))));
  console.log(`[${L.band[0].toUpperCase()}] ${L.name}`.padEnd(46) + saved.map((v) => v.padStart(11)).join(""));
}
console.log("\n  Percentages, not dollars, because the dollars differ by four orders of");
console.log("  magnitude across this row and the SHAPE is the thing to read: the social");
console.log("  levers matter most at the left, the fan-out levers most at the right.");

// ── 2. why the answer differs by size ───────────────────────────
// The decomposition, which is the reason there is no single answer.
console.log("\n\n2 · Why there is no single answer: what the bill is MADE OF");
{
  const keys = Object.keys(readsOf(5_000, true));
  console.log("     DAU" + keys.map((k) => k.padStart(10)).join("") + "  dominant");
  console.log("-".repeat(8 + 10 * keys.length + 12));
  for (const s of SIZES) {
    const r = readsOf(s.dau, s.mature);
    const top = Object.entries(r).sort((a, b) => b[1] - a[1])[0][0];
    console.log(
      int(s.dau).padStart(8) + keys.map((k) => int(r[k]).padStart(10)).join("") + "  " + top,
    );
  }
}
console.log("\n  Two regimes, and they want different fixes. Below ~10 k DAU the bill is");
console.log("  `social` — flat per user, moved by a cap or an open rate. Above it the bill");
console.log("  is `fanOut` — quadratic in DAU, moved only by publishing or listening less.");

// ── 3. the two paths ────────────────────────────────────────────
//
// Stacked, and computed by running the model with every lever's opts merged
// rather than by adding section 1's percentages — which would double-count
// the overlapping ones and land somewhere optimistic.
//
// Several paths rather than one ladder, because the choice between them is
// not about money. Z and Z+poll differ by exactly one product property —
// whether other people's votes land on the card while you watch — and that
// one property is worth 98% of the bill at 500 k DAU. A and B differ from
// them by whether the caps a Mirror stop reads are allowed to move.
const pick = (...names) => merge(...names.map((n) => LEVERS.find((L) => L.name === n).opts));

const PATHS = [
  // Z first, because it is the one that answers "will this remove
  // functionality" with "no". Every lever in it was checked against its
  // CONSUMERS, not just against the model: nothing in it changes a cap a
  // Mirror stop reads, a claim any copy makes, or a surface a user can
  // open. It is here as its own path rather than as a note on the others
  // because "what can we do that costs the product nothing" turns out to
  // be a different and better question than "what is cheapest to build".
  {
    name: "R · Region only",
    opts: { regional: true },
    note: "the one remaining zero-product-change lever, and it has a deadline",
  },
  {
    name: "R + the remaining client trim",
    opts: merge(pick("Refresh only today on foreground", "Serve the bank off Hosting"),
      { regional: true, streamAggs: false }),
    note: "nothing a user can see, beyond a back day's count lagging a boot",
  },
  {
    name: "A · Keep it live",
    opts: pick("Kindred walks 4 lists, not 12", "Who-voted pages at 50",
      "Circle reads 100 answers/member", "Batch the mirror publish (x5)",
      "Serve the bank off Hosting"),
    note: "the cap trims on top of what shipped — the product-degrading path",
  },
  {
    name: "B · Go polled",
    opts: pick("Kindred walks 4 lists, not 12", "Who-voted pages at 50",
      "Circle reads 100 answers/member", "Serve the bank off Hosting"),
    note: "same as A without the publish batching",
  },
  {
    name: "C · B + single region",
    opts: merge(pick("Kindred walks 4 lists, not 12", "Who-voted pages at 50",
      "Circle reads 100 answers/member", "Serve the bank off Hosting"),
    { regional: true }),
    note: "the same, on a single-region database — decide before the seed",
  },
];

console.log("\n\n3 · Stacked: what each combination costs, and what it costs the product");
for (const P of PATHS) {
  console.log("\n" + P.name + " — " + P.note);
  console.log("     DAU     as built       after      saved    grade");
  console.log("  " + "-".repeat(52));
  for (const s of SIZES) {
    const base = evaluate(s.dau, s.mature);
    const after = evaluate(s.dau, s.mature, P.opts);
    console.log(
      int(s.dau).padStart(8) + money(base).padStart(13) + money(after).padStart(12) +
      cut(base, after).padStart(11) +
      ("  " + rate(base / s.dau)[0] + " -> " + rate(after / s.dau)[0]).padStart(12),
    );
  }
}

// ── 4. the unit curve, which is the real test ───────────────────
// A path that lowers the bill but leaves the slope alone has not fixed
// anything — it has bought time. This is the check for that, and it is the
// reason section 3's grades are not the last word.
console.log("\n\n4 · Did it fix the SLOPE? ($/DAU/mo, and the 500 -> 500 k multiple)");
console.log("path                          " + SIZES.map((s) => int(s.dau).padStart(11)).join("") + "    500->500k");
console.log("-".repeat(30 + 11 * SIZES.length + 13));
{
  const row = (label, opts) => {
    const pd = SIZES.map((s) => evaluate(s.dau, s.mature, opts) / s.dau);
    const lo = pd[SIZES.findIndex((s) => s.dau === 500)];
    const hi = pd[SIZES.length - 1];
    return label.padEnd(30) + pd.map((v) => unit(v).padStart(11)).join("") +
      (Math.round(hi / lo) + "x").padStart(13);
  };
  console.log(row("as built", {}));
  for (const P of PATHS) console.log(row(P.name, P.opts));
}
// Computed, not typed. This note is about four specific numbers and an
// earlier draft had them inline — which is the failure the header of this
// file warns about, committed in the paragraph explaining a subtlety, where
// a stale figure would be least likely to be noticed and most likely to be
// quoted.
{
  const A = PATHS[0];
  const small = SIZES.find((s) => s.dau === 500);
  const big = SIZES[SIZES.length - 1];
  const slope = (opts) =>
    (evaluate(big.dau, big.mature, opts) / big.dau) / (evaluate(small.dau, small.mature, opts) / small.dau);
  console.log("\n  This is the column that matters, and path A's entry LOOKS LIKE A BUG.");
  console.log("  It is not. Path A cuts every absolute figure — " +
    cut(evaluate(small.dau, small.mature), evaluate(small.dau, small.mature, A.opts)).slice(1) +
    " at " + int(small.dau) + " DAU, " +
    cut(evaluate(big.dau, big.mature), evaluate(big.dau, big.mature, A.opts)).slice(1) + " at " +
    int(big.dau) + " —");
  console.log("  and makes the SLOPE worse (" + Math.round(slope({})) + "x -> " +
    Math.round(slope(A.opts)) + "x), because the social trims shrink the flat");
  console.log("  baseline far harder than the batching shrinks the quadratic term. Divide");
  console.log("  the small end by more than the big end and the ratio between them rises.");
  console.log("  Path A buys time; it does not fix the shape. Only the paths that stop");
  console.log("  streaming flatten the curve.");
}

// ── 5. what none of this touches ────────────────────────────────
console.log("\n\n5 · Bounded by arithmetic, not by a lever");
{
  const floor = SIZES.map((s) => {
    const r = readsOf(s.dau, s.mature, PATHS[1].opts);
    return r.boot + r.rules + r.server;
  });
  // Flat by construction — boot is per-open, rules and server are per-answer,
  // and none of the three has a DAU term. Printed as one number with the
  // flatness asserted rather than as five identical columns.
  const flat = floor.every((f) => Math.abs(f - floor[0]) < 0.5);
  console.log("  Irreducible reads/user/day after path B (boot + rule + server): " +
    (flat ? int(floor[0]) + " at every size." : floor.map(int).join(", ") + " across the sizes."));
  console.log("  These are answer-driven and flat. No lever here touches them, and none");
  console.log("  needs to — they are ~" +
    int(floor[2]) + " reads against the " + int(Object.values(readsOf(5_000, true)).reduce((a, b) => a + b, 0)) +
    " the app charges today.");
}
console.log("\n  Also untouched, and both larger than anything above: whether the project is");
console.log("  on Identity Platform billing (COSTS.md finding 3 — four figures a month at");
console.log("  150 k MAU, console-only), and whether App Check enforcement is armed on the");
console.log("  Firestore API (an unmetered read path is not a lever, it is a hole).\n");
