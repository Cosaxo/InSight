// cost-peers.mjs — the outside world, and the judgement made against it.
//
// Not runnable on its own. Same shape and same reason as cost-arith.mjs:
// a module two consumers share so the two cannot drift apart. Here the
// consumers are `cost-compare.mjs` (rates the app against these peers) and
// `cost-levers.mjs` (prices the changes that would move the rating). Before
// this split there was one copy in cost-compare; the moment the lever script
// wanted a grade there would have been two, and the second would have been
// the one that went stale — which is the argument cost-arith.mjs makes about
// arithmetic, made here about a judgement, where it is if anything stronger.
// A drifted number is wrong. A drifted grade is wrong AND authoritative.
//
// TWO KINDS OF THING LIVE HERE and the difference matters:
//
//   PEERS are FACTS about other companies, sourced and checkable in
//   principle but by nothing in this repository. Each carries the
//   arithmetic that produced it, the URL it came from, and a `skew` field
//   naming which way the comparison is unfair.
//
//   BENCH and rate() are a JUDGEMENT — where the thresholds sit, and what
//   words go on them. Nothing makes them true. They are here so that they
//   are stated in one place and argued with as a unit, rather than being
//   re-invented per script.
//
// Node stdlib only, like every deploy-adjacent script here.

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
// quietly, so two of the four skews run AGAINST this app on purpose.
export const PEERS = [
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
    // this app, which is the direction that keeps the table honest.
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
// and the point of quoting it is that this app's $/GiB is four orders of
// magnitude away from it, which is what "the bill is not about data" means
// when you put a number on it.
export const OBJECT_STORAGE_GIB_MO = 0.023; // GCS/S3 standard, list

// The same-stack peer, which is the fairest single yardstick: it holds the
// database, the pricing and the denominator constant, so what is left is
// this app's read pattern rather than Firebase's price list.
export const BENCH = PEERS[1].perUserMo;

/**
 * A letter grade for a per-DAU monthly cost.
 *
 * A judgement, not a computation, so the thresholds are stated rather than
 * implied — they are multiples of the same-stack benchmark, because "is this
 * a lot" is only answerable against something. "Expensive for what it does"
 * is doing real work in the C band: the comparison is never to an abstract
 * budget but to what a comparable app pays to serve a comparable session.
 *
 * The F band names Snap deliberately. It is not rhetoric: it is the point
 * where an app showing one question a day costs more per user than an app
 * streaming video to half a billion people, and a grade that did not say so
 * would be hiding its own most useful finding.
 */
export const rate = (pd) =>
  pd === 0 ? ["A+", "free — inside the free tier"]
    : pd < BENCH ? ["A", "cheaper than a typical app on the same stack"]
      : pd < BENCH * 3 ? ["B", "normal for the stack"]
        : pd < BENCH * 10 ? ["C", "expensive for what it does"]
          : pd < PEERS[0].perUserMo ? ["D", "very expensive; approaching a video app's per-user cost"]
            : ["F", "costs more per user than Snapchat, while doing far less"];

// ── shared formatters ───────────────────────────────────────────
// Here rather than duplicated because the two scripts print the same
// quantities side by side in two documents, and a dollar figure that
// rounds differently between them reads as a disagreement about the model.
export const money = (n) =>
  n === 0 ? "$0" : n < 0.01 ? "$" + n.toFixed(5) : n < 10 ? "$" + n.toFixed(2) : "$" + Math.round(n).toLocaleString();
// Per-USER money needs more places than per-month money: the interesting
// figures live between a tenth of a cent and forty cents, and %.2f rounds
// the entire middle of this analysis to "$0.01".
export const unit = (n) => (n === 0 ? "$0" : "$" + n.toFixed(n < 0.1 ? 5 : 4));
export const int = (n) => Math.round(n).toLocaleString();
export const x = (n) =>
  (n >= 100 ? Math.round(n).toLocaleString() : n >= 0.1 ? n.toFixed(1) : n.toFixed(2)) + "x";
