// The read breaker (D332) — the lever docs/COSTS.md § "What to actually
// do at 3am" designed and deliberately left unbuilt until the owner asked
// for it. The ask arrived 2026-08-27: keep Firebase usage from outrunning
// revenue. The watch half of that sentence is the pulse guard
// (scripts/pulse-collect.mjs, same record); this is the half you pull.
//
// One field, `budgetMode` on `v2_meta/app` — a document `hydrate()`
// already reads once per boot, so the lever itself costs no read at all
// (the D265 shape). The operator sets it with
// `npm run budget:mode -- --level 1`; firestore.rules keeps the document
// `allow write: if false`, so the admin SDK is the only pen, and the seed
// and the nightly fit both write the document with `{merge: true}`, so
// the field survives them (patterns.ts says so in its own comment: the
// fit owns two fields on a document the seed and the operator own the
// rest of).
//
// LEVEL 1 pauses the discretionary cross-user reads — the D98 surfaces
// (named who-voted, Kindred, Circle, takes). That is the `social` column
// of the cost model: ~354 of ~440 reads per user per day at 5,000 DAU
// (docs/COSTS.md "Where the reads actually go"), the largest line in the
// bill and the only one a flag can shed without touching the product's
// answering loop. Votes, the daily, the feed, aggregates and the Mirror's
// published-aggregate folds all keep working — what pauses is reading
// other users' answer documents on demand.
//
// The similarity fields' test-agg sweep is deliberately NOT behind this,
// although COSTS.md's design sketch listed "similarity". Measured, not
// assumed: the sweep is ~110 published-aggregate reads once per session
// (session-cached, D169) against social's ~354 per user per DAY, and
// pausing it would blank the Scores and Compare lenses and the field —
// three more surfaces claiming "nobody yet" about a crowd that exists,
// bought with a rounding error. The decision record carries the same
// arithmetic.
//
// Level 2 (thinning the answering loop's own reads — the deck poll, the
// foreground re-fetch) is RESERVED, not built: those terms are flat and
// small since D129 (3 + 28 reads/user/day), so a second level today would
// be a switch that changes what a user sees in exchange for nothing the
// bill can notice. If the flat terms ever grow a DAU slope back, that is
// the moment it earns building — with its own record.
//
// Propagation is per-boot, not live, and that is accepted: the field
// rides the one meta read, so a running session keeps its mode until the
// next cold start or the next account's hydrate. A cost lever does not
// need seconds; it needs to hold by tomorrow morning.
//
// HONESTY over silence: every gated surface says it is paused, in the one
// sentence below, because a panel rendering "nobody answered yet" about a
// crowd it chose not to fetch is the failure class CLAUDE.md names — a UI
// claim nothing makes true. The loaders leave their caches ABSENT (the
// loadVoters rule: absent is "we could not ask", empty is "nobody
// answered"), and the panels' paused branches are what keep absence from
// being read as either.

/** The level at which the D98 social reads pause. */
export const BUDGET_MODE_SOCIAL = 1;

/**
 * Whether the social loaders refuse at this mode. Coerced the way
 * `hydrate()` stores its meta siblings (`Number(x) || 0`), so an absent
 * field, a demo build and a malformed value all read as "not paused" —
 * the lever fails open, because a device that cannot read the mode is a
 * device whose reads are already modelled.
 */
export function socialReadsPaused(mode: number): boolean {
  return Number(mode) >= BUDGET_MODE_SOCIAL;
}

/**
 * The one sentence a gated surface shows. One constant rather than five
 * local strings so the claim cannot fork — and it is a claim: the mode is
 * set by an operator for exactly this reason, which is what makes the
 * sentence true. No "back soon" (a promise nothing here keeps), no
 * instruction, one clause of why (docs/COPY.md).
 */
export const BUDGET_PAUSED_BODY =
  "This view is paused while we keep InSight’s costs in check.";

/** The head for surfaces whose empty state carries a title + line. */
export const BUDGET_PAUSED_HEAD = "Paused for now";
