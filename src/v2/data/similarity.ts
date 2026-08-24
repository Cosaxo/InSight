// Similarity — the arithmetic behind the Mirror's constellation fields
// (D112): people ranked by how close their test scores sit to yours, and
// cities/countries given real score profiles from the published aggregates.
//
// The prototype drew these maps with invented `match` constants
// (spec/mirror-field-pops.jsx). This module is what makes them REAL:
//
//   place profiles   the bank's 110 core test items are ordinary `scale`
//                    questions whose per-city / per-country option counts
//                    publish like any other answer (D98). An axis score is
//                    the same fold the personal scorer runs — mean of
//                    0..4 agreement, inverts flipped, times 25 — applied
//                    to a whole cohort's counts instead of one person's
//                    answers. Nothing new is written anywhere; a city has
//                    had a score profile since its first test answer, and
//                    this module is just the first reader.
//
//   person scores    completed instruments live at v2_users/{uid}
//                    .testResults, world-readable since D98 (the rules
//                    comment names person-to-person Compare as the point).
//                    parseTestResults below is the defensive read: the
//                    field is client-written and shape-unvalidated, so a
//                    hostile profile must parse to nothing rather than to
//                    NaN positions on a screen that names people.
//
// Everything here is pure — no Firebase, no window — so the arithmetic is
// unit-testable the way cohort.ts is. The rule the file inherits from
// there: an ABSENT cell is zero answers, and a reading with too little
// behind it is refused (null), never padded to look like a finding.

import type { Agreement } from "./cohort";

// ── the instruments ──────────────────────────────────────────────────

/**
 * The four persisted instruments — the only `testResults` keys the data
 * layer reads. A client copy of passive-progress.js's META keys, the way
 * COHORT_DIMS copies BREAKDOWN_DIMS. `logic` is deliberately absent: its
 * result is a different shape making a different claim (a verified score,
 * D57), not an axis profile a distance can run over.
 */
export const CORE_TEST_KINDS = ["big5", "political", "values", "attachment"] as const;

/** One item of a sit-down instrument, as IS_TESTS ships it. */
export interface TestDefItem {
  q: string;
  d: string;
  invert?: boolean;
}

/** One instrument's definition — the slice of IS_TESTS this module reads. */
export interface TestDef {
  title: string;
  dims: Array<{ id: string; label: string }>;
  questions: TestDefItem[];
}

export type TestDefs = Record<string, TestDef>;

/** A bank question as the fold needs it (QuestionDoc, narrowed). */
export interface TestBankItem {
  id: string;
  prompt: string;
  /** The instrument key ("big5", …) — null on lens items, which stay out. */
  test: string | null;
  options: string[];
}

/**
 * A core test item joined to its scoring metadata.
 *
 * `invert` is NOT on the seeded question doc — it lives only in IS_TESTS —
 * so the join matches on the PROMPT TEXT rather than trusting an id
 * convention. A bank item whose prompt no longer matches any definition is
 * dropped rather than scored as-keyed: mis-scoring a reversed item poisons
 * the axis silently, while a dropped item only thins it, and
 * content-parity.test.jsx is the gate that keeps the two sources aligned
 * in the first place.
 */
export interface TestItemMeta {
  qid: string;
  test: string;
  dim: string;
  invert: boolean;
}

export function testItemMeta(bank: readonly TestBankItem[], defs: TestDefs): TestItemMeta[] {
  // prompt → {dim, invert}, per test. Prompts are unique within a test —
  // content-parity pins the banks item-for-item, so a collision would have
  // failed that gate before it could reach this join.
  const byPrompt: Record<string, Record<string, { dim: string; invert: boolean }>> = {};
  for (const [key, t] of Object.entries(defs)) {
    const m: Record<string, { dim: string; invert: boolean }> = {};
    for (const q of t.questions || []) m[q.q] = { dim: q.d, invert: !!q.invert };
    byPrompt[key] = m;
  }
  const out: TestItemMeta[] = [];
  for (const q of bank) {
    if (!q.test || !byPrompt[q.test]) continue;
    // Only the 5-point scale shape is foldable — the arithmetic below
    // hard-codes the 0..4 agreement axis the instruments are written on.
    if ((q.options || []).length !== 5) continue;
    const hit = byPrompt[q.test][q.prompt];
    if (!hit) continue;
    out.push({ qid: q.id, test: q.test, dim: hit.dim, invert: hit.invert });
  }
  return out;
}

// ── axis scores from published counts ────────────────────────────────

/** One axis of one instrument, scored for a population. */
export interface AxisScore {
  dim: string;
  label: string;
  /** 0..100, same normalisation as the personal scorer (mean/4 × 100). */
  value: number;
  /** Answers behind the value — the caller must say how thin it is. */
  n: number;
  /** How many of the instrument's items contributed at least one answer. */
  items: number;
}

/**
 * Fold per-option counts into axis scores for one instrument.
 *
 * `cellOf` returns the population's dense 5-option counts for a bank item
 * (or null where it has none). For the world that is `agg.counts`; for a
 * city it is the `by.city[key]` cell — same fold either way, which is the
 * point: one arithmetic, any cohort.
 *
 * Per-ANSWER weighting rather than the personal scorer's per-item mean:
 * with one answer per item the two are identical (which is what keeps this
 * consistent with your own result), and across a population it stops a
 * two-answer item from outvoting a two-hundred-answer one.
 *
 * An axis nobody answered is OMITTED, not scored 50 — the personal
 * scorer's neutral default is about resuming a half-done sit-down test,
 * and borrowing it here would invent a middle-of-the-road city out of no
 * data at all.
 */
export function axisScores(
  test: string,
  def: TestDef,
  items: readonly TestItemMeta[],
  cellOf: (qid: string) => readonly number[] | null,
): AxisScore[] {
  const acc: Record<string, { norm: number; n: number; items: number }> = {};
  for (const it of items) {
    if (it.test !== test) continue;
    const counts = cellOf(it.qid);
    if (!counts || counts.length !== 5) continue;
    let n = 0;
    let norm = 0;
    for (let i = 0; i < 5; i++) {
      const c = counts[i] || 0;
      n += c;
      norm += c * (it.invert ? 4 - i : i);
    }
    if (!n) continue;
    const a = acc[it.dim] || (acc[it.dim] = { norm: 0, n: 0, items: 0 });
    a.norm += norm;
    a.n += n;
    a.items += 1;
  }
  const out: AxisScore[] = [];
  for (const d of def.dims || []) {
    const a = acc[d.id];
    if (!a) continue;
    out.push({
      dim: d.id,
      label: d.label,
      value: Math.round((a.norm / (4 * a.n)) * 100),
      n: a.n,
      items: a.items,
    });
  }
  return out;
}

/**
 * Your own axis scores from your own answers to the feed's test items —
 * the same fold with a one-hot cell per item.
 *
 * This exists for the person who has answered test cards but not finished
 * an instrument: their completed result (testResults) always wins where it
 * exists, but "you have answered 7 Politics questions" is real data about
 * them and it is theirs, so the field can place them from it rather than
 * refusing until a sit-down test is done. The caller labels which basis a
 * number came from.
 */
/**
 * The store's vote map, in the shape every fold here wants.
 *
 * `LIVE.myVotes()` is `{ [qid]: optionId }` and the option id is a
 * STRING — live.ts writes `String(optionIdx)` on hydrate and stores the
 * caller's string on vote. Every scorer below asks `Number.isInteger(v)`,
 * which is false for `"2"`, so a raw myVotes() folds to nothing at all:
 * no axis gets an answer, `answered` counts zero, and the profile reports
 * "0 of 30 answered" to someone who has answered thirty.
 *
 * That is exactly what shipped (D132). The conversion lived inline in
 * ONE of the two callers, so the bug was invisible as a diff — the
 * working call site and the broken one did not sit next to each other,
 * and the broken one is `.jsx`, where the type that would have caught it
 * is not checked. It lives here now because this module defines the
 * numeric contract; a caller that forgets the conversion is a caller
 * that did not use this function.
 */
export function voteIndices(
  votes: Readonly<Record<string, string | number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [qid, raw] of Object.entries(votes)) {
    const n = Number(raw);
    // Integer-and-in-range here rather than at each fold: "" coerces to 0,
    // which would score an unanswered question as a strong disagree.
    if (raw !== "" && Number.isInteger(n) && n >= 0 && n <= 4) out[qid] = n;
  }
  return out;
}

export function myAxisScores(
  test: string,
  def: TestDef,
  items: readonly TestItemMeta[],
  votes: Readonly<Record<string, number>>,
): AxisScore[] {
  return axisScores(test, def, items, (qid) => {
    const v = votes[qid];
    if (!Number.isInteger(v) || v < 0 || v > 4) return null;
    const cell = [0, 0, 0, 0, 0];
    cell[v] = 1;
    return cell;
  });
}

// ── stored results, read defensively ────────────────────────────────

/** kind → dim → 0..100. The parsed, trustworthy view of `testResults`. */
export type ParsedResults = Record<string, Record<string, number>>;

/**
 * Parse a profile's `testResults` field into axis values, keeping only
 * what is arithmetically usable.
 *
 * The field is owner-written and the rules validate nothing about its
 * shape (only key count and the server-owned `logic`), so this read has
 * to survive any value a hostile or merely broken client stored: wrong
 * types, absurd numbers, thousand-entry dims arrays. `keys` bounds which
 * instruments are read at all; values coerce to finite numbers or are
 * dropped; the clamp keeps a stored 4e9 from parking someone at the far
 * edge of every axis.
 *
 * Returns null when nothing usable survives, so "has no scores" is one
 * check — the same absent-vs-zero discipline as everywhere else.
 */
export function parseTestResults(
  raw: unknown,
  keys: readonly string[],
): ParsedResults | null {
  if (!raw || typeof raw !== "object") return null;
  const out: ParsedResults = {};
  for (const kind of keys) {
    const entry = (raw as Record<string, unknown>)[kind];
    if (!entry || typeof entry !== "object") continue;
    const dims = (entry as { dims?: unknown }).dims;
    if (!Array.isArray(dims)) continue;
    const axes: Record<string, number> = {};
    // 12 is headroom over the widest instrument (6 axes) — past that the
    // array is not a result, whatever it is.
    for (const d of dims.slice(0, 12)) {
      if (!d || typeof d !== "object") continue;
      const id = (d as { id?: unknown }).id;
      const value = Number((d as { value?: unknown }).value);
      if (typeof id !== "string" || !id || !Number.isFinite(value)) continue;
      axes[id] = Math.max(0, Math.min(100, Math.round(value)));
    }
    if (Object.keys(axes).length) out[kind] = axes;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The verified logic percentile off a profile's raw `testResults`, or
 * null. Beside parseTestResults because it is the same job on the same
 * field — a cross-user read surviving whatever shape it meets — but it is
 * deliberately NOT part of ParsedResults: that type is "kind → dim →
 * 0..100" and every consumer iterates it (flattenAxes feeds the likeness
 * metric), so smuggling a non-instrument key in would quietly move
 * Kindred's arithmetic. The logic result is also the one server-written
 * entry (D57), so shape defense here is about strangers' documents in
 * general, not about forgeability.
 */
export function parseLogicPct(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const logic = (raw as { logic?: unknown }).logic;
  if (!logic || typeof logic !== "object") return null;
  const pct = Number((logic as { pctile?: unknown }).pctile);
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// ── likeness ─────────────────────────────────────────────────────────

/**
 * A place node needs at least this many shared axes before it gets a
 * position. One or two axes is a coin toss dressed as a reading — three
 * is the least that can disagree with itself.
 */
export const MIN_PLACE_AXES = 3;

/**
 * Pseudo-axes of prior, and the gap they carry — the shrinkage that stops
 * the thinnest comparison winning every list (D275 §2).
 *
 * THE BIAS. `match` divided the summed gap by the candidate's OWN
 * intersection size, then the sort ranked candidates against each other on
 * the result. A mean of three draws is far noisier than a mean of
 * twenty-two, and the TOP of a ranked list is exactly where noise
 * accumulates — so the person shown as most like you was, structurally,
 * the person you shared fewest axes with. Simulated over 200 candidates
 * with ZERO true similarity and axes drawn N(50, 15), the top score by
 * intersection width 3 / 5 / 8 / 12 / 16 / 22 came out:
 *
 *     97.6  95.3  93.2  91.6  90.5  89.6      (no prior — an 8.0 spread)
 *     87.9  88.7  88.8  88.8  88.4  88.2      (AXIS_PRIOR 6 — 0.9)
 *
 * λ = 6 is the flattest of the values tried (3 → 1.9, 10 → 1.3); it is
 * also one instrument's worth of axes, which is the unit `minAxes` already
 * counts in. TYPICAL_AXIS_GAP is E|X − Y| for two independent N(50, 15)
 * draws — 15·√2·√(2/π) = 16.93 closed form, 17.16 simulated with the 0..100
 * clamp the parser applies. The app's own assumed population: IS_TEST_AVG
 * is the per-axis mean and archetype-data measures around it at ±15.
 *
 * The result is an empirical-Bayes posterior mean: a wide comparison is
 * barely moved, a thin one is pulled most of the way to the population's
 * ordinary gap. It cannot invert the metric — at equal width, a smaller
 * gap still scores higher — it only stops width itself being worth points.
 */
export const AXIS_PRIOR = 6;
export const TYPICAL_AXIS_GAP = 17;

export interface ScoreMatch {
  /**
   * 100 − mean |gap| across shared axes, 0..100. The PRINTED number, and
   * unchanged by D275: it is exactly the sentence D112 chose it for, and
   * it is what the constellation's radius encodes.
   */
  match: number;
  /**
   * SORT KEY ONLY, never printed and never drawn — the same comparison
   * with AXIS_PRIOR pseudo-axes of prior folded in, and unrounded.
   *
   * The `cohort.likenessRate` split, one metric over: `match` is the
   * explainable number, this is the one that decides who goes first. Two
   * things were wrong with ranking on `match` — the width bias above, and
   * rounding, which collapses a pool onto ~20 integers and sent a large
   * tied block to `uid.localeCompare` to be crowned alphabetically.
   *
   * NOT the drawn number, deliberately. Shrinking the radius would pull a
   * perfect match from the ring's inner bound (44 px) to 52 and the exact
   * opposite from 138 to 95 — the field would lose most of its spread, and
   * the spread is the reading. What the shrinkage is FOR is deciding which
   * twelve people the field draws at all (CITY_FIELD_CAP), which is where
   * the bias actually bit.
   */
  raw: number;
  /** Shared axes the mean ran over. */
  axes: number;
  /** Instruments that contributed (person-to-person only). */
  tests: number;
}

/** Flatten per-test axis maps into "test:dim" keys so tests never collide. */
export function flattenAxes(byTest: ParsedResults): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [kind, dims] of Object.entries(byTest)) {
    for (const [dim, v] of Object.entries(dims)) out[`${kind}:${dim}`] = v;
  }
  return out;
}

/**
 * The likeness metric, in one explainable sentence: one hundred minus the
 * average gap between your scores and theirs, across every axis you both
 * have. Same property `agreement` (cohort.ts) was chosen for — a number
 * on a screen that names someone must survive being explained to them.
 *
 * That sentence is `match`, and D275 §2 left it alone. What it added is
 * `raw` beside it: the same comparison with a prior, used for the ORDER
 * and for nothing a reader sees. See AXIS_PRIOR for the bias that needed.
 */
export function scoreMatch(
  mine: Readonly<Record<string, number>>,
  theirs: Readonly<Record<string, number>>,
  minAxes: number,
): ScoreMatch | null {
  let axes = 0;
  let gap = 0;
  const tests = new Set<string>();
  for (const [k, v] of Object.entries(mine)) {
    const t = theirs[k];
    if (typeof t !== "number") continue;
    axes++;
    gap += Math.abs(v - t);
    const colon = k.indexOf(":");
    if (colon > 0) tests.add(k.slice(0, colon));
  }
  if (axes < Math.max(1, minAxes)) return null;
  return {
    match: Math.round(100 - gap / axes),
    raw: 100 - (gap + AXIS_PRIOR * TYPICAL_AXIS_GAP) / (axes + AXIS_PRIOR),
    axes,
    tests: tests.size,
  };
}

// ── which questions the ranking runs over ────────────────────────────

/**
 * Choose the questions Kindred compares people across — most divisive
 * first (D275 §2).
 *
 * THE BUG THIS REPLACES was a `.slice(0, cap)` over `Object.keys(votes)`,
 * under a comment claiming "the viewer's OWN most recent answers" — a
 * claim D112 repeated when it recorded the pool as recency-biased. Object
 * key order is insertion order, the store assigns its persisted cache
 * before the delta query, the delta query carries no `orderBy`, and
 * re-assigning an existing key does not move it. So the set froze at
 * whatever the first cold boot put first and never moved again, and the
 * two boot paths disagree — the same account ranked strangers differently
 * on a second device.
 *
 * RECENCY IS NOT THE REPLACEMENT, because it cannot be: the vote map
 * carries no timestamps. peopleMap.ts had already reached that conclusion
 * for the sibling surface while this one claimed the recency it could not
 * have.
 *
 * DIVISIVENESS is the better key anyway. Agreeing on a question 95% of
 * people answer the same way is nearly no evidence about two people;
 * agreeing on a 50/50 split is a great deal. `divisiveness` has measured
 * exactly that since D99 and had never been used to pick anything.
 *
 * `scoreOf` returns -1 for a question this device holds no counts for, so
 * a measured question always outranks an unmeasured one while a brand-new
 * account still fills its whole quota. Ties break by qid, so the set does
 * not reshuffle between two renders reading the same aggregates.
 *
 * Non-integer votes are dropped: a catalog answer stores an entity id and
 * a rank answer a joined order, both on a surface the voter query accepts
 * — so those qids issued a collection-group read, got documents back, and
 * had every row discarded for want of a numeric optionIdx.
 */
export function pickKindredQids(
  votes: Readonly<Record<string, string | number>>,
  scoreOf: (qid: string) => number,
  cap: number,
): string[] {
  return Object.keys(votes)
    .filter((id) => !id.startsWith("g_") && Number.isInteger(Number(votes[id])) && votes[id] !== "")
    .sort((a, b) => (scoreOf(b) - scoreOf(a)) || a.localeCompare(b))
    .slice(0, Math.max(0, cap));
}

// ── people, ranked ───────────────────────────────────────────────────

/** One candidate as live.ts assembles them from the cached voter lists. */
export interface KindredPerson {
  uid: string;
  name: string;
  /** Frozen city anchor from their most recent cached answer ("Oslo, NO"). */
  city: string;
  like: Agreement;
  results: ParsedResults | null;
  /**
   * The whole frozen anchors snapshot from that same answer (D152) —
   * profession, age band, education, gender, the lot.
   *
   * `city` above is one of these and stays a named field because the
   * ranking and the scope filters index it directly. The rest are here so
   * the People lens can say who someone IS ("Ceramicist · 25-34") rather
   * than only how alike you are, and they cost nothing: the voter rows
   * carrying them were already fetched and cached for the ranking.
   *
   * From the ANSWER, never the live profile — same rule as `city` (D8).
   * Reading the profile would describe someone by who they are today
   * beside a likeness computed from who they were when they answered.
   *
   * Optional because a person assembled from answers with no anchors has
   * none, which is a real state and not a missing field.
   */
  anchors?: Record<string, string>;
}

export interface RankedPerson extends KindredPerson {
  /** Score-based likeness, or null when you share no completed instrument. */
  score: ScoreMatch | null;
}

/**
 * Rank people around you, PRIMARILY by test scores (D112): everyone you
 * share a completed instrument with sorts first, by score match; everyone
 * else follows on answer agreement — the fallback likeness, not a gate.
 * A person with no shared instrument still appears; the caller says which
 * basis each row stands on.
 */
export function rankKindred(
  people: readonly KindredPerson[],
  mine: ParsedResults | null,
  opts: { city?: string; minShared?: number } = {},
): RankedPerson[] {
  const minShared = opts.minShared ?? 1;
  const mineFlat = mine ? flattenAxes(mine) : null;
  return people
    .filter((p) => (opts.city ? p.city === opts.city : true))
    .map((p) => ({
      ...p,
      // A person-to-person match needs a whole shared instrument (5-6
      // axes at once) — the per-test dims arrive together or not at all,
      // so MIN here is one instrument's worth.
      score: mineFlat && p.results ? scoreMatch(mineFlat, flattenAxes(p.results), 5) : null,
    }))
    .filter((p) => p.score !== null || p.like.shared >= minShared)
    .sort((a, b) => {
      if (!!a.score !== !!b.score) return a.score ? -1 : 1;
      if (a.score && b.score) {
        return b.score.raw - a.score.raw
          || b.score.axes - a.score.axes
          || b.like.rate - a.like.rate
          || a.uid.localeCompare(b.uid);
      }
      // rate, not pct (D275 §2) — see cohort.likenessRate. A 1-of-1
      // stranger headed this list ahead of a 45-of-50 one, at every site
      // that sorted on the percentage.
      return b.like.rate - a.like.rate
        || b.like.shared - a.like.shared
        || a.uid.localeCompare(b.uid);
    });
}

// ── places, profiled ────────────────────────────────────────────────

export interface PlaceProfile {
  /** The breakdown bucket key — "Oslo, NO" for cities, "NO" for countries. */
  key: string;
  /** Per-instrument axis scores, only where answers exist. */
  byTest: Record<string, AxisScore[]>;
  /** Total answers behind the profile, summed across axes. */
  n: number;
  /** Likeness to the viewer, or null below MIN_PLACE_AXES shared axes. */
  score: ScoreMatch | null;
}

/**
 * Score profiles for every bucket of one breakdown dim, ranked most-like-
 * you first, places without enough shared axes last (they still list —
 * a city that only lacks data must read as "thin", never as "unlike you").
 *
 * `myFlat` may be null (a viewer with no scores at all): profiles still
 * compute, every score is null, and the field renders places by size
 * with the honest caption. The viewer's own bucket is the caller's to
 * mark (`home`), not this fold's to guess.
 */
export function placeProfiles(
  items: readonly TestItemMeta[],
  defs: TestDefs,
  aggOf: (qid: string) => { by?: Record<string, Record<string, Record<string, number>>> } | null,
  dim: "city" | "country",
  myFlat: Readonly<Record<string, number>> | null,
  filter?: (key: string) => boolean,
): PlaceProfile[] {
  // ONE PASS OVER ITEMS, not one pass per bucket (D169).
  //
  // This read the other way round until it was measured: collect the union
  // of buckets, then for each bucket call `axisScores` once per instrument,
  // each call re-scanning all 110 items to keep the quarter belonging to
  // that instrument. So the work was buckets × instruments × items, and
  // three quarters of it was the `it.test !== test` skip.
  //
  // The waste that dominates is not the ×4 though, it is the shape. A
  // question publishes at most BREAKDOWN_MAX_BUCKETS (24) cells per dim,
  // so of the buckets in the union — which is uncapped, and is every city
  // the app has ever seen answer a test item (D112's known limit 3) — all
  // but ~24 miss for any given item. The old loop paid a lookup for every
  // (bucket, item) pair and threw away the misses; this one visits only
  // the cells that exist, so the fold is output-sensitive.
  //
  // Measured on 110 items, node, mean of 25: a 60-city union 3.0 → 1.6 ms,
  // 400 cities 8.0 → 3.6 ms, 2,000 cities 25.9 → 9.2 ms. The gain grows
  // with the union because that is the term that stopped multiplying;
  // what is left is the per-bucket emit (an AxisScore row per axis, then
  // scoreMatch), which is linear in buckets and genuinely needed — every
  // bucket has to be scored before the field can rank them and keep
  // PLACE_FIELD_CAP.
  //
  // The accumulator is what `axisScores` builds internally, held per
  // bucket instead of per call: bucket → test → axis → {norm, n, items}.
  // Same arithmetic, same per-ANSWER weighting, same omit-an-unanswered-
  // axis rule. `similarity.test.ts` keeps the OLD implementation verbatim
  // and runs it beside this one on randomised aggregates, so this stays a
  // refactor rather than a rewrite that happened to pass the cases
  // somebody had already thought of.
  type Acc = { norm: number; n: number; items: number };
  const perBucket = new Map<string, Record<string, Record<string, Acc>>>();
  for (const it of items) {
    if (!defs[it.test]) continue;
    const byDim = aggOf(it.qid)?.by?.[dim];
    if (!byDim) continue;
    for (const key of Object.keys(byDim)) {
      if (filter && !filter(key)) continue;
      const cell = byDim[key];
      let n = 0;
      let norm = 0;
      for (let i = 0; i < 5; i++) {
        const c = cell[String(i)] || 0;
        n += c;
        norm += c * (it.invert ? 4 - i : i);
      }
      // Registered even at n === 0, because the old union was built from
      // the KEYS and only dropped a bucket at the `if (!n)` below. A
      // bucket whose every cell is empty must still reach that check
      // rather than never existing — the two agree today, and they agree
      // for the same stated reason rather than by luck.
      let byTest = perBucket.get(key);
      if (!byTest) perBucket.set(key, (byTest = {}));
      const dims = byTest[it.test] || (byTest[it.test] = {});
      if (!n) continue;
      const a = dims[it.dim] || (dims[it.dim] = { norm: 0, n: 0, items: 0 });
      a.norm += norm;
      a.n += n;
      a.items += 1;
    }
  }

  const out: PlaceProfile[] = [];
  // Map iteration is insertion-ordered, and insertion follows the same
  // item-then-key walk the old Set did — so ties the sort below cannot
  // break (equal match AND equal n) still land in the order they did.
  for (const [key, acc] of perBucket) {
    const byTest: Record<string, AxisScore[]> = {};
    const flat: Record<string, number> = {};
    let n = 0;
    for (const kind of Object.keys(defs)) {
      const dims = acc[kind];
      if (!dims) continue;
      const axes: AxisScore[] = [];
      // `def.dims` order, not accumulation order: the axis row on the
      // place card reads in the instrument's own order.
      for (const d of defs[kind].dims || []) {
        const a = dims[d.id];
        if (!a) continue;
        axes.push({
          dim: d.id,
          label: d.label,
          value: Math.round((a.norm / (4 * a.n)) * 100),
          n: a.n,
          items: a.items,
        });
      }
      if (!axes.length) continue;
      byTest[kind] = axes;
      for (const a of axes) {
        flat[`${kind}:${a.dim}`] = a.value;
        n += a.n;
      }
    }
    if (!n) continue;
    out.push({
      key,
      byTest,
      n,
      score: myFlat ? scoreMatch(myFlat, flat, MIN_PLACE_AXES) : null,
    });
  }
  return out.sort((a, b) => {
    if (!!a.score !== !!b.score) return a.score ? -1 : 1;
    if (a.score && b.score) return b.score.raw - a.score.raw || b.n - a.n;
    return b.n - a.n || a.key.localeCompare(b.key);
  });
}

/**
 * The viewer's own flattened axes: completed instruments first, own feed
 * answers filling any instrument not yet finished. Null when neither
 * exists — the field then says so instead of centring a person it knows
 * nothing about.
 */
export function myFlatAxes(
  results: ParsedResults | null,
  items: readonly TestItemMeta[],
  defs: TestDefs,
  votes: Readonly<Record<string, number>>,
): Record<string, number> | null {
  const merged: ParsedResults = {};
  for (const kind of Object.keys(defs)) {
    if (results?.[kind]) {
      merged[kind] = results[kind];
      continue;
    }
    const folded = myAxisScores(kind, defs[kind], items, votes);
    if (folded.length) {
      merged[kind] = Object.fromEntries(folded.map((a) => [a.dim, a.value]));
    }
  }
  return Object.keys(merged).length ? flattenAxes(merged) : null;
}

// ── layout hash ──────────────────────────────────────────────────────

/**
 * Stable angle for a field node, from its id — FNV-1a over the string,
 * mapped to [0, 1). Deterministic so the constellation does not reshuffle
 * on every render, and id-keyed so it survives re-ranking. (gHash's
 * consecutive-input weakness — see the test-users decision — does not
 * bite here: adjacent hashes would only place two nodes at similar
 * angles, and the radius still separates them.)
 */
export function angleHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 10000) / 10000;
}
