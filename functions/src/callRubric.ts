// The tier-A CALL rubric, and the arithmetic that executes it (D127,
// docs/FORESIGHT-CALLS.md §3).
//
// A CALL is a question sealed now and graded later. Every other number in
// this app is a fold over documents the reader can open; a resolved call
// is the one place the app would be ASSERTING something instead. D127's
// answer is admission criteria rather than refusal: a tier-A call resolves
// on the app's OWN published aggregate, so the grade is arithmetic and the
// reader can recompute it. Tiers C (a prose source) and D (the model's
// memory) never enter the bank, and tier B (a fetched endpoint) is not
// built — see the foot of this file.
//
// WHY THIS MODULE EXISTS TWICE. `functions/src/callRubric.ts` is a
// byte-identical copy, held equal by `npm run check:calls` — the same
// arrangement, and the same reason, as logic-gen.ts (D57). The resolver
// grades a call server-side; the card RE-GRADES it on the device from the
// inputs the resolver published, and says so on screen. That second
// evaluation is the whole honesty claim made executable, and it is worth
// nothing if the two copies can disagree about what `topShareAtLeast`
// means. functions/tsconfig compiles only its own src/, so a cross-package
// import cannot reach the deploy bundle; a verbatim copy can, and this
// module is dependency-free by design so that stays true.
//
// EVERYTHING HERE IS PURE. No Firebase, no clock, no window. The caller
// decides WHEN a call may be graded (`resolvesAt` is the resolver's
// business) and supplies the snapshot; this module only says what the
// snapshot means. A grader that reached for a clock could not be tested
// against a fixed input, which is the property the whole design rests on.

/** The tests a tier-A call may be written against. */
export const CALL_TESTS = ["topShareAtLeast", "turnoutAtLeast", "slicesDisagree"] as const;
export type CallTest = (typeof CALL_TESTS)[number];

/**
 * One executable rubric — data the grader RUNS, never prose a reviewer
 * interprets (FORESIGHT-CALLS §3).
 *
 * `qid` names a question in this app's own bank; the grade reads that
 * question's published aggregate and nothing else.
 */
export interface CallRubric {
  /** Only "agg" exists. Tier B's "fetch" is designed, not built. */
  kind: "agg";
  qid: string;
  test: CallTest;
  /** topShareAtLeast: percent 1..100. turnoutAtLeast: answers, ≥ 1. */
  threshold?: number;
  /** slicesDisagree only: the breakdown dim and the two buckets compared. */
  dim?: string;
  buckets?: [string, string];
}

/**
 * What the grader SAW — the published aggregate, narrowed to the cells the
 * rubric actually reads.
 *
 * This is the shape stored as `v2_call_outcomes/{qid}.inputs`, and it is
 * deliberately the same shape both sides evaluate: the device re-grades by
 * passing the stored inputs straight back through `evalRubric`, so "the
 * player can recompute it" is a function call rather than an invitation.
 *
 * Narrowed rather than whole because a full `by` map is unbounded — the
 * outcome doc has to stay small enough to fetch with every other call's.
 */
export interface CallSnapshot {
  qid: string;
  /** Answers folded into the target question, all options. */
  total: number;
  /** optionIdx (as a string key, the aggregate's own form) → count. */
  counts: Record<string, number>;
  /** slicesDisagree only: bucket → (optionIdx → count), for the two named. */
  cells?: Record<string, Record<string, number>>;
}

/** A call's two options, always, in this order. */
export const CALL_YES = 0;
export const CALL_NO = 1;
/** Nobody is scored; the card says why (FORESIGHT-CALLS §7). */
export const CALL_VOID = -1;

/** Sum a `counts` map. Absent cells are zero — the absent-cell doctrine. */
function sum(counts: Record<string, number> | undefined): number {
  let n = 0;
  for (const k in counts) n += counts[k] || 0;
  return n;
}

/**
 * Index of the largest count, or -1 when there is nothing to lead.
 *
 * Ties go to NOBODY rather than to the lower index, and that is a grading
 * rule rather than a convenience: a tied top is a question with no leading
 * option, and inventing one to keep the arithmetic flowing is exactly the
 * kind of plausible answer this design exists to refuse. A tie makes the
 * rubric unexecutable, which routes to VOID rather than to a coin toss.
 */
function topIdx(counts: Record<string, number> | undefined): number {
  let best = -1;
  let bestN = 0;
  let tied = false;
  for (const k in counts) {
    const n = counts[k] || 0;
    if (n > bestN) { best = Number(k); bestN = n; tied = false; }
    else if (n === bestN && n > 0) tied = true;
  }
  return tied ? -1 : best;
}

/**
 * Narrow a published aggregate to what one rubric reads.
 *
 * `null` when the aggregate cannot answer the rubric at all — absent,
 * empty, or missing a named cell. Null is NOT an outcome: the resolver
 * retries, and only a human or the overdue rule turns it into a void. The
 * distinction matters because "nobody has answered yet" and "the answer is
 * no" are different claims, and an app that conflated them would be
 * grading silence.
 */
export function snapshotFor(
  rubric: CallRubric,
  agg: { total?: number; counts?: Record<string, number>; by?: Record<string, Record<string, Record<string, number>>> } | null | undefined,
): CallSnapshot | null {
  if (!agg) return null;
  const counts = agg.counts || {};
  const total = typeof agg.total === "number" ? agg.total : sum(counts);
  if (total <= 0) return null;
  if (rubric.test === "slicesDisagree") {
    const dim = rubric.dim;
    const pair = rubric.buckets;
    if (!dim || !pair || pair.length !== 2) return null;
    const cells: Record<string, Record<string, number>> = {};
    for (const b of pair) {
      const cell = agg.by?.[dim]?.[b];
      // A named slice with no answers is not a disagreement and not an
      // agreement — it is a question the aggregate cannot answer yet.
      if (!cell || sum(cell) <= 0) return null;
      cells[b] = { ...cell };
    }
    return { qid: rubric.qid, total, counts: { ...counts }, cells };
  }
  return { qid: rubric.qid, total, counts: { ...counts } };
}

/**
 * Execute a rubric against a snapshot.
 *
 * Returns `CALL_YES` (0) or `CALL_NO` (1) — which are option indexes into
 * the call's own two options — or `null` when the rubric cannot be
 * executed on this snapshot. Never a guess, in any branch: `null` is the
 * only thing this function has to say about a case it cannot decide.
 */
export function evalRubric(rubric: CallRubric, snap: CallSnapshot | null | undefined): number | null {
  if (!snap || snap.qid !== rubric.qid) return null;
  switch (rubric.test) {
    case "topShareAtLeast": {
      // "Will the leading option pass X%?" — the share is of ALL answers,
      // so a question that splits three ways can fail this while still
      // having a clear leader. That is the reading the words make, and it
      // is why the threshold is authored against the option count.
      const t = rubric.threshold;
      if (typeof t !== "number" || snap.total <= 0) return null;
      const top = topIdx(snap.counts);
      if (top < 0) return null;
      const share = (100 * (snap.counts[String(top)] || 0)) / snap.total;
      return share >= t ? CALL_YES : CALL_NO;
    }
    case "turnoutAtLeast": {
      // "Will this question pass N answers?" — the one test whose answer
      // can only ever move one way, so a NO before the deadline is not yet
      // a NO. The resolver's `resolvesAt` is what makes it final.
      const t = rubric.threshold;
      if (typeof t !== "number") return null;
      return snap.total >= t ? CALL_YES : CALL_NO;
    }
    case "slicesDisagree": {
      // "Will these two slices pick different sides?" — the Explore lens's
      // own reading, asked before it exists. Both cells must have a
      // leader; a tied cell is unexecutable rather than a disagreement.
      const pair = rubric.buckets;
      const cells = snap.cells;
      if (!pair || !cells) return null;
      const a = topIdx(cells[pair[0]]);
      const b = topIdx(cells[pair[1]]);
      if (a < 0 || b < 0) return null;
      return a !== b ? CALL_YES : CALL_NO;
    }
    default:
      return null;
  }
}

/**
 * Whether a rubric is well-formed — the check `check:calls` dry-runs at
 * authoring time, and the resolver repeats before touching a document.
 *
 * Returns the reason it is not, or null when it is. A rubric that cannot
 * be executed TODAY will not work in May either (FORESIGHT-CALLS §3), and
 * this is the half of that gate which needs no data.
 */
export function rubricFault(rubric: unknown): string | null {
  const r = rubric as CallRubric | null;
  if (!r || typeof r !== "object") return "rubric is missing";
  if (r.kind !== "agg") return `kind ${JSON.stringify(r.kind)} — tier A grades on our own aggregate ("agg"); tier B is not built`;
  if (typeof r.qid !== "string" || !r.qid) return "rubric names no qid";
  if (!(CALL_TESTS as readonly string[]).includes(r.test)) {
    return `test ${JSON.stringify(r.test)} is not one of ${CALL_TESTS.join(" · ")}`;
  }
  if (r.test === "topShareAtLeast") {
    if (typeof r.threshold !== "number" || !(r.threshold > 0) || r.threshold > 100) {
      return "topShareAtLeast needs a threshold in 1..100 (percent)";
    }
  }
  if (r.test === "turnoutAtLeast") {
    if (!Number.isInteger(r.threshold) || !((r.threshold as number) > 0)) {
      return "turnoutAtLeast needs a whole-number threshold ≥ 1 (answers)";
    }
  }
  if (r.test === "slicesDisagree") {
    if (typeof r.dim !== "string" || !r.dim) return "slicesDisagree needs a breakdown dim";
    if (!Array.isArray(r.buckets) || r.buckets.length !== 2) return "slicesDisagree needs exactly two buckets";
    if (r.buckets[0] === r.buckets[1]) return "slicesDisagree compares a bucket with itself";
  }
  return null;
}

/**
 * The rubric as one line the card prints beside the outcome.
 *
 * The basis has to sit next to the claim (FORESIGHT-CALLS §6), and it has
 * to be legible without opening a document — so this says the test in
 * words rather than printing the JSON. It names the target qid because the
 * reader's next move is to go and read that question.
 */
export function describeRubric(rubric: CallRubric): string {
  switch (rubric.test) {
    case "topShareAtLeast":
      return `the leading option on ${rubric.qid} reaches ${rubric.threshold}%`;
    case "turnoutAtLeast":
      return `${rubric.qid} reaches ${rubric.threshold} answers`;
    case "slicesDisagree":
      return `${rubric.buckets?.[0]} and ${rubric.buckets?.[1]} pick different sides on ${rubric.qid}`;
    default:
      return rubric.qid;
  }
}

// ── What is NOT here ────────────────────────────────────────────────
//
// TIER B — a rubric whose truth comes from a named endpoint with a stable
// schema (`{kind:"fetch", url, path, map}`). It is designed in
// docs/FORESIGHT-CALLS.md §3 and deliberately absent: every residual
// failure mode in that document's §9 belongs to B, and shipping A alone
// forever is recorded there as a legitimate end state rather than a
// half-built one. Adding it means a network call inside the grader, a
// `map` with a mandatory `*` fallback, and a dry run that actually
// fetches — none of which this module's purity survives, so it would
// arrive beside this file rather than inside it.
//
// A CLOCK. The prototype's ten-second timer is the game's presentation
// (design/standalone-v28/predict-cards.jsx) and belongs to the card. A
// scoring rule that depended on wall time could not be tested, which is
// the same line `data/foresight.ts` draws for READ.
