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
//   node scripts/cost-compare.mjs                 # the region production is on
//   node scripts/cost-compare.mjs --multi-region  # the nam5 counterfactual
//
// THE DEFAULT IS READ FROM functions/src/db.ts, not assumed. D200 pointed
// cost-model.mjs and the pulse at `FIRESTORE_LOCATION` and did not reach
// this file, so for the days after it every table below — and every GRADE,
// which is this page's whole output — priced `nam5` at twice the real bill
// while the header advertised that as "the default". The comment above the
// import already said it: if a number here disagrees with `npm run costs`,
// this file has a bug. Every number did.
//
// `--regional` is still accepted for the docs that cite it; on a
// single-region database it asks for the sheet it would get anyway.
//
// THE ARITHMETIC IS NOT HERE. Every InSight figure below comes from
// scripts/cost-arith.mjs, the same module cost-model.mjs and pulse.mjs read.
// That is deliberate and it is the whole reason this file is safe to add: a
// comparison script that re-derived the bill would be a third copy of the
// model, and the third copy is the one that goes stale silently while
// printing a confident ratio. If a number here disagrees with
// `npm run costs`, this file has a formatting bug, not a modelling one.
//
// THE PEERS ARE NOT HERE EITHER. `scripts/cost-peers.mjs` holds them and the
// grade thresholds, because scripts/cost-levers.mjs needs the same two things
// to say whether a proposed change helps — and a second copy of a JUDGEMENT
// drifts as silently as a second copy of arithmetic, while carrying more
// authority. Each peer there is externally sourced, checkable by nothing in
// this repository, and carries the arithmetic that produced it, the URL it
// came from, and which way the comparison is unfair.

import { costModel, totalCost, B, SCENARIOS, REGIONAL, LOCATION_LABEL } from "./cost-arith.mjs";
import { PEERS, OBJECT_STORAGE_GIB_MO, BENCH, rate, money, unit, int, x } from "./cost-peers.mjs";

const regional = process.argv.includes("--multi-region") ? false : REGIONAL;
const { model } = costModel({ regional });

// The model's own scenario list, plus the two sizes the Firestore benchmark
// publishes, so that peer can be compared at MATCHED size instead of by
// interpolation. `mature` follows SCENARIOS' own rule (the flag is about
// how many aggregates are still under the top-up cap, not about the bill).
const SIZES = [...SCENARIOS.map(([dau, mature, label]) => ({ dau, mature, label })),
  { dau: 3_000, mature: true, label: "(benchmark size)", extra: true },
  { dau: 100_000, mature: true, label: "(benchmark size)", extra: true },
].sort((a, b) => a.dau - b.dau);

const perDau = (dau, mature) => totalCost(model(dau, mature).cost) / dau;

console.log(`\nInSight cost comparison — ${regional === REGIONAL ? LOCATION_LABEL : "nam5 multi-region"} prices`);
console.log("InSight figures from scripts/cost-arith.mjs; peer figures from scripts/cost-peers.mjs\n");

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
  const fixed = totalCost(model(s.dau, s.mature, { staticBank: true }).cost);
  console.log(
    int(s.dau).padStart(8) + money(now).padStart(13) + money(fixed).padStart(14) +
    money(now - fixed).padStart(9) + "    " +
    rate(now / s.dau)[0] + " -> " + rate(fixed / s.dau)[0],
  );
}
console.log("\n  The fan-out is the whole gap: polling instead of streaming removes the only");
console.log("  term that grows with the square of the population, which is what turns the");
console.log("  bottom row from an F into a grade an ordinary app would recognise.\n");
