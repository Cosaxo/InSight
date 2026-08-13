#!/usr/bin/env node
// cost-compare.mjs — rate InSight's bill against other apps' published bills.
//
// docs/COSTS.md answers "what will this cost". This answers "is that a lot",
// which is a different question and needs a denominator the model does not
// have: somebody else's invoice.
//
// Same shape as cost-model.mjs — a printer, not a gate. It asserts nothing
// and is not wired into CI, because a comparison against a competitor's
// disclosure cannot be right or wrong until there is an invoice of our own.
// What it is for is re-running the rating when an input moves, so
// docs/COST-COMPARISON.md never becomes folklore.
//
//   node scripts/cost-compare.mjs              # nam5 multi-region (the default)
//   node scripts/cost-compare.mjs --regional   # single-region price sheet
//
// THE ARITHMETIC IS NOT HERE. Every InSight figure below comes from
// scripts/cost-arith.mjs, the same module cost-model.mjs and pulse.mjs read.
// That is deliberate and it is the whole reason this file is safe to add: a
// comparison script that re-derived the bill would be a third copy of the
// model, and the third copy is the one that goes stale silently while
// printing a confident ratio. If a number here disagrees with
// `npm run costs`, this file has a formatting bug, not a modelling one.
//
// WHAT IS NEW HERE is PEERS — externally sourced figures, which are a
// different KIND of number from anything in cost-arith.mjs and are labelled
// as such. Nothing in this repository can check them. So each one carries
// the arithmetic that produced it and the URL it came from, and where a peer
// publishes two figures that should agree, both are here and the script
// prints the disagreement rather than picking a side.

import { costModel, totalCost, B, SCENARIOS } from "./cost-arith.mjs";

const regional = process.argv.includes("--regional");
const { model } = costModel({ regional });

// ── the peers ───────────────────────────────────────────────────
//
// Chosen to bracket the question rather than to flatter it. Snap is the
// same CATEGORY (consumer social, per-DAU cost disclosed quarterly, which
// almost nobody else does). The Firestore benchmark is the same STACK, so
// it isolates "expensive for a Firebase app" from "Firebase is expensive".
// Signal is the same PRIVACY posture with a full public breakdown. Wikimedia
// is the read-heavy floor — the cheapest well-known thing that serves a
// planet, which is the useful lower bound for an app whose bill is 70% reads.
//
// EVERY DENOMINATOR IS DIFFERENT and that is the trap in this table. Snap
// publishes DAU; Signal publishes registered users; Wikimedia publishes
// monthly unique devices. A per-DAU figure compared against a per-registered
// -user figure flatters whichever side divides by the bigger number — so
// each peer names its denominator and `skew` records which way the
// comparison is unfair, in words, at the point of use. Getting this wrong
// in the flattering direction is the one failure this table could commit
// quietly.
const PEERS = [
  {
    name: "Snap (Snapchat)",
    what: "consumer social, video + AI/ML, 493 M DAU",
    perUserMo: 1.675e9 / 12 / 493e6,
    denom: "DAU",
    basis: "FY2026 infra guidance $1.65–1.70 bn (midpoint) ÷ 12 ÷ 493 M Q2'26 DAU",
    // The one peer that publishes the ratio directly, so it can be checked
    // rather than trusted. Stated $0.86 per DAU per QUARTER in Q4'25; ÷3
    // should land on the guidance-derived figure above, and does (0.287 vs
    // 0.283, a 1.4% gap). Two independent routes agreeing is what makes
    // this the anchor peer — the others have one route each.
    crossCheck: { value: 0.86 / 3, label: "Q4'25 stated $0.86/DAU/quarter ÷ 3" },
    source: "https://www.cnbc.com/2026/08/03/snap-q2-earnings-report-2026.html",
    skew: "like-for-like — same denominator, so this row is the honest one",
  },
  {
    name: "Typical Firestore consumer app",
    what: "same stack, well-optimised, social features",
    perUserMo: 298 / 100e3,
    denom: "DAU",
    basis: "$298/mo at 100 k DAU (published Firestore estimator worked example)",
    crossCheck: { value: 5.4 / 3e3, label: "same source's 3 k DAU row, $5.40/mo" },
    source: "https://mobile-squad.com/apps/firepulse/firestore-cost-estimator/",
    // The two rows from this source disagree by 1.8x per user, which is not
    // an error — it is a smaller app sitting further inside the free tier.
    // Both are printed for exactly that reason.
    skew: "like-for-like on stack and denominator; a vendor estimator, not an invoice",
  },
  {
    name: "Signal",
    what: "E2EE messenger, ~85 M users, full public breakdown",
    perUserMo: 14e6 / 12 / 85e6,
    denom: "registered users",
    basis: "$14 M/yr total infra ÷ 12 ÷ 85 M users",
    crossCheck: { value: 8e6 / 12 / 85e6, label: "ex-SMS ($6 M/yr registration fees removed)" },
    source: "https://signal.org/blog/signal-is-expensive/",
    // Registered users >> DAU, so dividing by it makes Signal look cheaper
    // per head than a DAU-denominated peer would. The skew runs AGAINST
    // InSight, which is the direction that keeps this table honest.
    skew: "UNFAIR TO INSIGHT — registered users, not DAU, so Signal's true per-DAU figure is higher",
  },
  {
    name: "Wikimedia / Wikipedia",
    what: "read-heavy public content at planetary scale, on-prem",
    perUserMo: 3.4e6 / 12 / 950e6,
    denom: "monthly unique devices",
    basis: "$3.4 M/yr internet hosting ÷ 12 ÷ ~950 M monthly unique devices",
    crossCheck: null,
    source: "https://meta.wikimedia.org/wiki/Wikimedia_Foundation_Annual_Plan/2025-2026/Budget_Overview",
    skew: "UNFAIR TO INSIGHT — monthly uniques and owned hardware, not DAU on rented cloud",
  },
];

// Raw object storage, for the data-level section. Not a peer app — a price,
// and the point of quoting it is that InSight's $/GiB is four orders of
// magnitude away from it, which is what "the bill is not about data" means
// when you put a number on it.
const OBJECT_STORAGE_GIB_MO = 0.023; // GCS/S3 standard, list

const money = (n) =>
  n === 0 ? "$0" : n < 0.01 ? "$" + n.toFixed(5) : n < 10 ? "$" + n.toFixed(2) : "$" + Math.round(n).toLocaleString();
// Per-USER money needs more places than per-month money: the interesting
// figures live between a tenth of a cent and forty cents, and %.2f rounds
// the entire middle of this document to "$0.01".
const unit = (n) => (n === 0 ? "$0" : "$" + n.toFixed(n < 0.1 ? 5 : 4));
const int = (n) => Math.round(n).toLocaleString();
const x = (n) =>
  (n >= 100 ? Math.round(n).toLocaleString() : n >= 0.1 ? n.toFixed(1) : n.toFixed(2)) + "x";

// The model's own scenario list, plus the two sizes the Firestore benchmark
// publishes, so that peer can be compared at MATCHED size instead of by
// interpolation. `mature` follows SCENARIOS' own rule (the flag is about
// how many aggregates are still under the top-up cap, not about the bill).
const SIZES = [...SCENARIOS.map(([dau, mature, label]) => ({ dau, mature, label })),
  { dau: 3_000, mature: true, label: "(benchmark size)", extra: true },
  { dau: 100_000, mature: true, label: "(benchmark size)", extra: true },
].sort((a, b) => a.dau - b.dau);

const perDau = (dau, mature) => totalCost(model(dau, mature).cost) / dau;

console.log(`\nInSight cost comparison — ${regional ? "single-region" : "nam5 multi-region"} prices`);
console.log("InSight figures from scripts/cost-arith.mjs; peer figures from PEERS in this file\n");

// ── 1. unit economics ───────────────────────────────────────────
// The headline is not the total — COSTS.md has the totals. It is the total
// DIVIDED BY USERS, because that is the number that is supposed to fall as
// an app grows and here does the opposite.
console.log("1 · InSight unit economics — what one user costs, by size");
console.log("     DAU  scenario                 total/mo    $/DAU/mo    $/MAU/mo    $/MAU/yr   vs 500-DAU");
console.log("-".repeat(102));
const base = perDau(500, false);
for (const s of SIZES) {
  const t = totalCost(model(s.dau, s.mature).cost);
  const pd = t / s.dau;
  console.log(
    int(s.dau).padStart(8) + "  " + s.label.padEnd(22) +
    money(t).padStart(11) + unit(pd).padStart(12) +
    unit(t / (s.dau * B.mauMultiple)).padStart(12) +
    unit((t * 12) / (s.dau * B.mauMultiple)).padStart(12) +
    (s.dau <= 500 ? "—" : x(pd / base)).padStart(13),
  );
}
console.log("\n  The right-hand column is the finding. Unit cost is supposed to FALL with");
console.log("  scale; here it rises " + x(perDau(500_000, true) / base) + " between the second row and the last.");

// ── 2. the peer table ───────────────────────────────────────────
console.log("\n\n2 · The peers, and what InSight costs against each");
console.log("peer                              $/user/mo  denominator            basis");
console.log("-".repeat(102));
for (const p of PEERS) {
  console.log(
    p.name.padEnd(33) + unit(p.perUserMo).padStart(10) + "  " + p.denom.padEnd(22) + " " + p.basis,
  );
  if (p.crossCheck) {
    const gap = Math.abs(p.crossCheck.value - p.perUserMo) / p.perUserMo;
    console.log(
      "".padEnd(33) + unit(p.crossCheck.value).padStart(10) +
      `  cross-check (${(gap * 100).toFixed(0)}% apart): ${p.crossCheck.label}`,
    );
  }
  console.log("".padEnd(35) + "skew: " + p.skew);
}

console.log("\nInSight's cost per user as a multiple of each peer, by size");
console.log("     DAU" + PEERS.map((p) => p.name.split(" ")[0].padStart(14)).join(""));
console.log("-".repeat(8 + 14 * PEERS.length));
for (const s of SIZES) {
  const pd = perDau(s.dau, s.mature);
  console.log(
    int(s.dau).padStart(8) +
    PEERS.map((p) => (pd === 0 ? "free" : x(pd / p.perUserMo)).padStart(14)).join(""),
  );
}

// ── 3. crossovers ───────────────────────────────────────────────
// The size at which InSight's per-user cost passes each peer's. Bisection
// on the model rather than on a fitted curve: the function is monotonic in
// DAU but not smooth (free tiers, the mature flag), so solving it
// analytically would mean re-deriving the model — the thing this file
// exists not to do.
const cross = (target) => {
  let lo = 200, hi = 20e6;
  if (perDau(hi, true) < target) return null;
  if (perDau(lo, false) > target) return lo;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (perDau(mid, mid >= 1000) < target) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
};
console.log("\n\n3 · Where InSight overtakes each peer (DAU at which $/user/mo crosses)");
console.log("-".repeat(102));
for (const p of PEERS) {
  const c = cross(p.perUserMo);
  console.log(
    p.name.padEnd(33) + (c === null ? "never" : int(c) + " DAU").padStart(14) +
    "   " + (c === null ? "" : c < 1000 ? "(≈ the point the free tier ends — see the note)" : ""),
  );
}
console.log("\n  Below ~177 DAU the bill is $0 (free tier), so the first crossover is really");
console.log("  'where InSight starts paying at all' rather than a statement about the peer.");

// ── 4. data levels ──────────────────────────────────────────────
// The other half of the question. An app's cost is usually a story about how
// much data it holds; this one is not, and the ratios below are how you tell.
console.log("\n\n4 · Data levels — what the bill does as data grows");
console.log("     DAU   stored GiB    $/GiB/mo   vs object storage   egress÷stored   reads/day per GiB");
console.log("-".repeat(102));
for (const s of SIZES) {
  const m = model(s.dau, s.mature);
  const t = totalCost(m.cost);
  console.log(
    int(s.dau).padStart(8) + m.storeGiB.toFixed(2).padStart(13) +
    money(t / m.storeGiB).padStart(12) +
    x(t / m.storeGiB / OBJECT_STORAGE_GIB_MO).padStart(20) +
    x(m.egressGiBMo / m.storeGiB).padStart(16) +
    int(m.reads / m.storeGiB).padStart(20),
  );
}
console.log("\n  Storage itself is " +
  (() => { const m = model(5_000, true); return ((m.cost.storage / totalCost(m.cost)) * 100).toFixed(1); })() +
  "% of the bill at 5 k DAU and " +
  (() => { const m = model(500_000, true); return ((m.cost.storage / totalCost(m.cost)) * 100).toFixed(2); })() +
  "% at 500 k.");
console.log("  The model's storage line assumes ONE YEAR of accumulation; ten years of it");
console.log("  would still not reach 1% of the bill at any size. This app is not data-expensive.");
console.log("  It is read-expensive, and the two are priced completely differently.");

// ── 5. engagement levels ────────────────────────────────────────
// "Data levels" has a second reading — not bytes at rest, but how much each
// user generates and consumes. That is B.worldAnswers, and the model is
// re-run against it here.
//
// Mutating the shared B and restoring it is deliberate and is how COSTS.md's
// own sensitivity line was produced. It is safe because this file is a
// single-shot printer: nothing else holds a reference across the loop, and
// the restore is unconditional.
console.log("\n\n5 · Engagement levels — the same users, generating more");
const savedAnswers = B.worldAnswers;
const LEVELS = [1, 3, 6, 12];
console.log("answers/user/day" + SIZES.filter((s) => !s.extra).map((s) => int(s.dau).padStart(13)).join(""));
console.log("-".repeat(16 + 13 * SIZES.filter((s) => !s.extra).length));
try {
  for (const lvl of LEVELS) {
    B.worldAnswers = lvl;
    const fresh = costModel({ regional });
    console.log(
      (String(lvl) + (lvl === savedAnswers ? " (modelled)" : "")).padEnd(16) +
      SIZES.filter((s) => !s.extra)
        .map((s) => money(totalCost(fresh.model(s.dau, s.mature).cost)).padStart(13)).join(""),
    );
  }
} finally {
  B.worldAnswers = savedAnswers;
}
// Measured rather than asserted: an earlier draft of this note claimed
// engagement "barely moves" the bill, which the table above plainly
// contradicts at the top row. The real contrast is between the two
// EXPONENTS, and both are printed so the claim can be checked.
{
  const ratio = (dau, mature, a, b) => {
    const saved = B.worldAnswers;
    const at = (n) => { B.worldAnswers = n; return totalCost(costModel({ regional }).model(dau, mature).cost); };
    try { return at(b) / at(a); } finally { B.worldAnswers = saved; }
  };
  const pop = (a, b) => totalCost(model(b, true).cost) / totalCost(model(a, true).cost);
  console.log("\n  4x the answers per user  ->  " +
    x(ratio(5_000, true, 3, 12)) + " the bill at 5 k DAU, " +
    x(ratio(500_000, true, 3, 12)) + " at 500 k   (sub-linear to linear)");
  console.log("  10x the users            ->  " +
    x(pop(5_000, 50_000)) + " the bill from 5 k, " +
    x(pop(50_000, 500_000)) + " from 50 k          (super-linear)");
  console.log("\n  That gap is the whole story. Engagement is a cost this app can afford to");
  console.log("  encourage; population is one it currently cannot, because the dominant");
  console.log("  term is a listener fan-out that scales with the SQUARE of the population.");
}

// ── 6. the rating ───────────────────────────────────────────────
// A letter grade is a judgement, not a computation, so the thresholds are
// stated here rather than implied. They are set against the peer table above:
// "cheap" means under the same-stack benchmark, "normal" means inside the
// range the peers occupy, "expensive" means above the most expensive peer
// that does strictly more work than InSight does.
const BENCH = PEERS[1].perUserMo;  // same stack — the fairest single yardstick
const rate = (pd) =>
  pd === 0 ? ["A+", "free — inside the free tier"]
    : pd < BENCH ? ["A", "cheaper than a typical app on the same stack"]
      : pd < BENCH * 3 ? ["B", "normal for the stack"]
        : pd < BENCH * 10 ? ["C", "expensive for what it does"]
          : pd < PEERS[0].perUserMo ? ["D", "very expensive; approaching a video app's per-user cost"]
            : ["F", "costs more per user than Snapchat, while doing far less"];
console.log("\n\n6 · The rating");
console.log("     DAU    $/DAU/mo    total/mo   grade   verdict");
console.log("-".repeat(102));
for (const s of SIZES) {
  const pd = perDau(s.dau, s.mature);
  const [g, v] = rate(pd);
  console.log(
    int(s.dau).padStart(8) + unit(pd).padStart(12) +
    money(totalCost(model(s.dau, s.mature).cost)).padStart(12) + g.padStart(8) + "   " + v,
  );
}
// The two columns are deliberately side by side, because they disagree and
// the disagreement is the answer. A "C" next to $59/month is not a call to
// action — it is a warning about the SLOPE, priced at a size where the
// absolute number is still lunch money. Reporting only the grade would
// panic; reporting only the total would mislead.
console.log("\n  Grade thresholds are relative to the same-stack benchmark (" + unit(BENCH) +
  "/DAU/mo),\n  not absolute: A < 1x, B < 3x, C < 10x, D < Snap's " + unit(PEERS[0].perUserMo) + ", F above it.");

// ── 7. the grade the recorded fixes would buy ───────────────────
//
// COSTS.md files two read fixes as recorded-and-deliberately-not-built
// (D7): serve the question bank off Hosting (`staticBank`), and poll the
// deck aggregates instead of streaming them (`pollAggs`). Both are already
// inputs to the model, so the graded version costs nothing to produce — and
// it is the only part of this file that says what to DO about the rating
// rather than what the rating is.
//
// This is not a recommendation to build them now. It is the price tag on
// the deferral, which is the thing D7's discipline asks for and the thing a
// grade on its own does not give you.
console.log("\n\n7 · The same rating, if the two fixes COSTS.md already records were built");
console.log("     DAU     as built    with fixes    saved   grade: now -> fixed");
console.log("-".repeat(102));
for (const s of SIZES) {
  const now = totalCost(model(s.dau, s.mature).cost);
  const fixed = totalCost(model(s.dau, s.mature, { staticBank: true, pollAggs: true }).cost);
  console.log(
    int(s.dau).padStart(8) + money(now).padStart(13) + money(fixed).padStart(14) +
    money(now - fixed).padStart(9) + "    " +
    rate(now / s.dau)[0] + " -> " + rate(fixed / s.dau)[0],
  );
}
console.log("\n  The fan-out is the whole gap: polling instead of streaming removes the only");
console.log("  term that grows with the square of the population, which is what turns the");
console.log("  bottom row from an F into a grade an ordinary app would recognise.\n");
