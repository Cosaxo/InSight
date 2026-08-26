// scorecard-metrics.mjs — the "splits, not landslides" bar as a number,
// per question type (D33, amended 2026-08-06). Extracted from
// question-scorecard.mjs so the arithmetic is testable on its own; the
// scorecard imports from here and nothing else redefines it.
//
// Two formulas because the types measure different things:
//
// CATEGORICAL (binary / choice / dilemma / vote / duel): options are
// unordered, so "split" means no option dominates —
//   evenness = 1 − (maxShare − 1/n) / (1 − 1/n)
// 1.0 = perfectly even, 0.0 = unanimous.
//
// ORDINAL (scale / rating): slots are positions on one axis, and there
// maxShare mismeasures both failure modes. A rating where everyone
// answers 5–8 spreads over enough slots to keep maxShare low — shares
// (0,0,0,0,.2,.3,.3,.2,0,0) score 0.778 under the categorical formula,
// a "strong split" that is actually a consensus; and a scale at 65%
// agree / 15% disagree scores 0.75 while the UI's own headline calls it
// "65% agree". What "divides people" means on an axis is that BOTH
// sides are populated, AWAY from the middle:
//   ordinalSplit = sideBalance × spread
//   sideBalance  = 1 − |low − high| / (low + high)   (0 if nobody took a side)
//   spread       = min(1, Σ shareᵢ·|i − mid| / ((n−1)/4))
// with mid = (n−1)/2; slots below mid are "low", above are "high", and
// an exact-middle slot (scale's Neutral) sits on neither side. (n−1)/4
// is half the maximum possible mean distance, so a distribution as
// dispersed as uniform — or more — counts as fully spread rather than
// being graded on tail-heaviness. 1.0 = a real two-sided split; 0.0 =
// unanimity, including unanimity on the middle: all-Neutral scores 0,
// because a crowd that agrees to shrug is still a crowd that agrees.
//
// Both clamp to [0, 1]; both take shares (fractions summing to 1), not
// counts — the k-floor already did the privacy work upstream.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ── demand credit (docs/TAGS-PLAN.md §3) ──
// A question's answers credit every topic it carries — its home `cat` plus
// its `also` doors — in CONSERVED shares: the home takes HOME_SHARES, each
// door one, normalized so a question's shares sum to exactly 1. Summing
// credited answers across topics therefore equals summing answers across
// questions, and that property is pinned as a test rather than prose.
//
// Conservation is the anti-gaming design, not an accounting taste: the
// generator that assigns doors is the same species as the run that reviews
// them, and the demand lanes steer that generator's own future budget. Full
// credit per door would pay it to tag broadly — a closed loop where liberal
// tagging manufactures the demand that justifies more of the same. Under
// conservation a door never ADDS credit, only redistributes it, so broad
// tagging costs the home topic's own signal and buys nothing. What is left —
// a tilt inside individually defensible tags — is the human audit's job
// (QUESTION-FARM.md, tag honesty in the 1-in-AUDIT_ONE_IN read).
//
// 2:1 rather than even, because the home is a stronger claim than a door:
// it is where the Map files the card and what the kicker names. The same
// ratio is the D163 contract for the on-device model's card affinity
// (docs/TAGS-PLAN.md §4) — one constant, used everywhere, so nobody tunes
// the two apart by accident.
/** Does this aggregate document carry a readable result?
 *
 *  IT IS JUST "DOES THE DOCUMENT EXIST", and that is the whole point. The
 *  scorecard asked `agg.tooSmall === false` from the day it was written,
 *  which was correct while a k-anonymity floor existed: the trigger stamped
 *  `tooSmall` and a floored question published a document with no usable
 *  counts.
 *
 *  D98 removed the floor and stopped writing the field. `undefined === false`
 *  is false, so the reader began answering "below floor" for EVERY aggregate
 *  in production — a fail-closed test against a field that no longer exists
 *  is indistinguishable from a real refusal. D98 swept the client's copy of
 *  the same predicate in the commit that changed the trigger; this copy, in a
 *  script, was missed, and nothing failed because nothing tested it.
 *
 *  Measured 2026-08-25: all 104 aggregate documents in prvfire33 carry
 *  `{counts|pos, total, by}` and no `tooSmall`, so the scorecard had been
 *  reporting `scored: 0` over 108 real answers, and every number downstream
 *  of it — the pulse's answersCounted, the population state, the question
 *  farm's evenness and retirement lanes — inherited the zero.
 *
 *  So: a document exists only because the trigger folded an answer into it
 *  (`v2_question_aggs` is `allow write: if false`), which means its presence
 *  IS the signal. There is no floor to clear. Kept as a named function rather
 *  than inlined at eight call sites for the reason pure.ts gives about
 *  `breakdownFor`: three copies is how they drift — and this bug is what the
 *  drift looks like when one copy is left behind. */
export const isScoredAgg = (agg) => !!agg;

/** Does this row contribute to an evenness MEAN?
 *
 *  Not the same question as `isScoredAgg`. A row is scored when somebody
 *  answered it; it is MEASURED when the split can be computed at all — and
 *  sixteen feed questions (11 dial, 3 field, 2 path) declare neither
 *  `options` nor `items`, so `n` is 0, `optionShares` returns null and
 *  `evenness` is null however many people answered.
 *
 *  Those rows used to be invisible here for the wrong reason: the retired
 *  `tooSmall` predicate marked every aggregate below-floor, so nothing
 *  reached a rollup at all. D294 fixed the predicate and they arrived —
 *  into `t.evenSum += r.evenness ?? 0`, which turns "not measurable" into a
 *  perfect landslide and divides by a denominator that counted it.
 *
 *  The first artifact published with that bug says how bad it reads:
 *  `types.feed.dial {scored: 7, avgEvenness: 0}`, over seven rows not one
 *  of which was measured. A dial whose crowd is perfectly uniform scores
 *  the same 0 as one where everybody picked the same number.
 *
 *  THE REPO HAD ALREADY RULED ON THIS. `bucketEvenness`
 *  (pulse-collect.mjs) skips non-numeric evenness, and the test pinning it
 *  says why in one line: "scoring it as a landslide would invent a
 *  landslide that nobody voted in". The three means did not obey the rule
 *  the buckets did. */
export const isMeasured = (row) => typeof row?.evenness === "number";

export const HOME_SHARES = 2;

export function creditShares(topics) {
  const weights = topics.map((_, i) => (i === 0 ? HOME_SHARES : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  return topics.map((topic, i) => ({ topic, share: weights[i] / total }));
}

export const evennessOf = (shares, n) => {
  const maxShare = Math.max(...shares);
  return clamp01(1 - (maxShare - 1 / n) / (1 - 1 / n));
};

export const ordinalSplit = (shares) => {
  const n = shares.length;
  const mid = (n - 1) / 2;
  let low = 0;
  let high = 0;
  let dist = 0;
  shares.forEach((s, i) => {
    if (i < mid) low += s;
    else if (i > mid) high += s;
    dist += s * Math.abs(i - mid);
  });
  const sided = low + high;
  const sideBalance = sided > 0 ? 1 - Math.abs(low - high) / sided : 0;
  const spread = Math.min(1, dist / ((n - 1) / 4));
  return clamp01(sideBalance * spread);
};

// The router the scorecard calls: ordinal types by name, categorical
// otherwise — feed types (vote/duel) and any future type default to the
// categorical bar, which is the safe reading for unordered options.
export const splitQualityOf = (type, shares, n) =>
  type === "scale" || type === "rating" ? ordinalSplit(shares) : evennessOf(shares, n);

// ── the production rollup (D97) ──
// The same scored rows the scorecard already computes, re-cut by WHO WROTE
// the question — content/provenance.json's source (editorial | farm |
// community) and batch (a vintage label). This is the farm measuring
// itself: "is my output holding the editorial bar, and which vintage's
// shapes won" is the question the upscale's constant-improvement loop runs
// on, and it is answerable from k-floored public aggregates already
// fetched — no new read path, nothing per-user (the D40 duel-section
// precedent for adding a cut without adding a source).
//
// Vintage keys are `source:batch` so two sources sharing a date never
// merge. Rows whose surface has no provenance table, or whose id has no
// row, land under `unknown` — visibly, because check:quality holds the
// join exact and a silent drop would be the D39 stale-figure class.
export function rollupProduction(rows, prov) {
  const bySource = {};
  const byVintage = {};
  const bump = (map, key, r) => {
    const t = (map[key] ||= {
      questions: 0, served: 0, scored: 0, answers: 0, evenSum: 0, measured: 0, strong: 0, landslides: 0,
    });
    t.questions++;
    if (r.served) t.served++;
    if (r.signal === "scored") {
      t.scored++;
      t.answers += r.total;
      // `measured`, not `scored`, is the mean's denominator — see isMeasured.
      if (isMeasured(r)) { t.evenSum += r.evenness; t.measured++; }
      if (r.grade === "strong") t.strong++;
      if (r.grade === "landslide") t.landslides++;
    }
  };
  for (const r of rows) {
    const m = /^(daily|feed)-(.+)$/.exec(r.qid);
    if (!m) continue;
    const row = prov?.[m[1]]?.[m[2]];
    const source = row?.source || "unknown";
    bump(bySource, source, r);
    bump(byVintage, `${source}:${row?.batch || "unbatched"}`, r);
  }
  const finish = (map) => {
    for (const t of Object.values(map)) {
      // null when nothing was MEASURED, even if rows were scored — the
      // reader already renders a null average as "no reading yet", which is
      // the truth about a cell of dials. Reporting 0 there says the crowd
      // agreed unanimously.
      t.avgEvenness = t.measured ? +(t.evenSum / t.measured).toFixed(3) : null;
      delete t.evenSum;
    }
    return map;
  };
  return { bySource: finish(bySource), byVintage: finish(byVintage) };
}

// ── per-question attention (R4/D271) ────────────────────────────────────
//
// The denominator the scorecard never had: what the feed SHOWED, not only
// what got answered. Folded from the engagement trail's day docs
// (monitoring/engagement.json ← v2_engagement_daily.attn.q), which are
// bucket-midpoint ESTIMATES scaled by the sampling rate — labelled so at
// every consumer, because an estimate quoted as a count is the D67
// failure with a new face.

/** Below this estimated seen-count a ratio is null, not a number: three
 * devices' buckets cannot say a question bores anyone. */
export const ATTENTION_MIN_SEEN = 5;

/** Printed beside the metrics wherever they render — the D33 rule, which
 * a per-question dashboard doubles: a skip is not dislike, a new
 * question's numbers are novelty-inflated for weeks, and a metric this
 * simple invites writing questions AT it. Warmth outranks conversion. */
export const ATTENTION_WARNING =
  "attention is an estimate from bucketed, sampled shards; a skip is not dislike "
  + "(seen-denominators only), novelty inflates new questions, and no attention "
  + "figure outranks the content rules (D33/D271)";

/**
 * Fold the trail's per-question attention into per-qid metrics.
 * `days` is the committed trail's array of v2_engagement_daily docs.
 */
export function attentionFromTrail(days) {
  const qids = {};
  let daysWithQ = 0;
  let truncatedDevices = 0;
  for (const d of days || []) {
    const q = d?.attn?.q;
    truncatedDevices += d?.attn?.qOther || 0;
    if (!q || typeof q !== "object") continue;
    daysWithQ++;
    for (const [qid, kinds] of Object.entries(q)) {
      const row = qids[qid] || (qids[qid] = { seen: 0, answered: 0, passed: 0, deferred: 0 });
      row.seen += kinds?.s?.est || 0;
      row.answered += kinds?.a?.est || 0;
      row.passed += kinds?.p?.est || 0;
      row.deferred += kinds?.d?.est || 0;
    }
  }
  const round2 = (n) => Math.round(n * 100) / 100;
  for (const row of Object.values(qids)) {
    row.seen = round2(row.seen);
    row.answered = round2(row.answered);
    row.passed = round2(row.passed);
    row.deferred = round2(row.deferred);
    const enough = row.seen >= ATTENTION_MIN_SEEN;
    row.conv = enough ? round2(row.answered / row.seen) : null;
    row.passRate = enough ? round2(row.passed / row.seen) : null;
  }
  return { daysWithQ, truncatedDevices, qids };
}
