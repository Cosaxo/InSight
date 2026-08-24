// Reading a cohort out of the published breakdown.
//
// `v2_question_aggs.by` is a three-level map — dim → bucket → optionIdx →
// count — folded from the anchors snapshot every answer carries (D8) and,
// since D98, published whole: every cell, every bucket, at any size, with
// nothing suppressed and nothing floored.
//
// That map has been sitting there fully readable and almost entirely
// unread. It is the source for four Mirror surfaces the app was missing:
//
//   People / mix   how a population is composed  → mixFor
//   Explore        what one slice believes       → sliceSplit + divergence
//   Compare        you against a population      → pctFor on your own cell
//   the Map        how usual your answer was     → typicality
//
// Everything here is a pure fold with no Firebase and no window, so the
// arithmetic can be tested directly. The rule the whole file obeys: an
// ABSENT cell is zero, not withheld. That is only true because D98
// removed the suppression — under the old model the same code would have
// been quietly reporting hidden cohorts as empty ones, which is the exact
// inversion that made "absent ≠ zero" a doctrine worth writing down.

import type { AggDoc } from "./deck";
import { sharePcts } from "./pct";

/** dim → bucket → optionIdx → count, as published. */
export type ByMap = Record<string, Record<string, Record<string, number>>>;

export interface Bucket {
  bucket: string;
  /** Answers in this bucket, summed across options. */
  n: number;
  /** Per-option counts, dense to `optionCount`. */
  counts: number[];
}

/** The dims a cohort can be cut by — BREAKDOWN_DIMS, client-side copy. */
export const COHORT_DIMS = [
  "ageBand", "gender", "city", "country", "education", "relationship",
  "heightBand",
] as const;
export type CohortDim = (typeof COHORT_DIMS)[number];

/** Display names, so a chip row does not have to know the field names. */
export const DIM_LABEL: Record<string, string> = {
  ageBand: "Age",
  gender: "Gender",
  city: "City",
  country: "Country",
  education: "Education",
  relationship: "Relationship",
  heightBand: "Height",
};

// The Map's anchor ring speaks its own ids. Two of them are breakdown
// dims and can therefore be answered with real numbers; the rest cannot,
// and the absence is structural rather than pending:
//
//   job   is `profession`, deliberately NOT a breakdown dim (D8) — it is
//         free text, so every distinct spelling would mint a bucket key
//         forever.
//   big5, political, values, attachment
//         are test RESULTS. Nothing aggregates them per cohort, so
//         "how did similar personalities answer" has no source at all.
//         (`cognitive` sat in this list until D103 retired the test.)
//
// A map from anchor to dim is the honest way to say that: an anchor
// missing from this object is one no amount of reading can answer.
export const MAP_ANCHOR_DIM: Record<string, CohortDim> = {
  age: "ageBand",
  edu: "education",
};

/** Dense per-option counts for one (dim, bucket), or null if the cell is absent. */
export function cellFor(
  by: ByMap | undefined,
  dim: string,
  bucket: string,
  optionCount: number,
): number[] | null {
  const cell = by?.[dim]?.[bucket];
  if (!cell) return null;
  return Array.from({ length: Math.max(0, optionCount) }, (_, i) => cell[String(i)] || 0);
}

/**
 * Integer percentages that sum to exactly 100.
 *
 * The rule itself lives in data/pct.ts, shared with the feed's `wfPcts` —
 * two surfaces rounding differently on the same numbers is how a 51/49
 * becomes a 51/48 one screen over, and until that module existed the two
 * agreed only by carrying the same four lines.
 *
 * It used to dump the whole rounding residue on the largest share, which
 * could draw a smaller count LARGER than a bigger one and could move the
 * top bar off the top count. pct.ts has the measurements.
 */
export function pctFor(counts: readonly number[]): number[] {
  return sharePcts(counts);
}

/**
 * How a population is composed along one dimension — biggest first.
 *
 * This is the "mix" half of the People lens, and it needs no new read at
 * all: summing a question's buckets counts the people who answered it
 * from each bucket. It is a per-QUESTION mix rather than a per-user one,
 * which is worth being precise about — it says "of the people who
 * answered this, 40% were 25-34", not "40% of the app is 25-34".
 */
export function mixFor(
  by: ByMap | undefined,
  dim: string,
  optionCount: number,
): Bucket[] {
  const buckets = by?.[dim];
  if (!buckets) return [];
  return Object.keys(buckets)
    .map((bucket) => {
      const counts = cellFor(by, dim, bucket, optionCount) || [];
      return { bucket, counts, n: counts.reduce((a, b) => a + b, 0) };
    })
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n || a.bucket.localeCompare(b.bucket));
}

/** One slice's split, as percentages, or null when the slice has no answers. */
export function sliceSplit(
  by: ByMap | undefined,
  dim: string,
  bucket: string,
  optionCount: number,
): number[] | null {
  const counts = cellFor(by, dim, bucket, optionCount);
  if (!counts || !counts.some((c) => c > 0)) return null;
  return pctFor(counts);
}

export interface Divergence {
  bucket: string;
  n: number;
  pct: number[];
  /** Largest per-option gap from the overall split, in points. */
  gap: number;
  /** The option that gap is on. */
  optionIdx: number;
}

/**
 * Where each slice differs most from everyone — the ordering Explore is
 * built on, because "what does this group believe" is only interesting
 * where the answer is *not* what everyone believes.
 *
 * Ranked by the single largest per-option gap rather than a summed
 * distance: a slice that is +14 on one option and -14 on another is one
 * disagreement, and summing would score it double against a slice spread
 * thinly across five options.
 *
 * `minN` exists for legibility, NOT for disclosure — a one-answer bucket
 * is 100/0 and would top every ranking forever while saying nothing. It
 * defaults to 0 so the caller has to choose, and callers that show the
 * whole mix should pass 0.
 */
export function divergence(
  by: ByMap | undefined,
  dim: string,
  overall: readonly number[],
  optionCount: number,
  minN = 0,
): Divergence[] {
  const base = pctFor(overall);
  return mixFor(by, dim, optionCount)
    .filter((b) => b.n >= minN)
    .map((b) => {
      const pct = pctFor(b.counts);
      let gap = 0;
      let optionIdx = 0;
      for (let i = 0; i < pct.length; i++) {
        const d = Math.abs(pct[i] - (base[i] || 0));
        if (d > gap) { gap = d; optionIdx = i; }
      }
      return { bucket: b.bucket, n: b.n, pct, gap, optionIdx };
    })
    .sort((a, b) => b.gap - a.gap || b.n - a.n);
}

/**
 * How split a question is, 0 (unanimous) to 1 (perfectly even).
 *
 * NORMALISED BY OPTION COUNT, which is the whole reason this is a function
 * rather than `1 - leadingShare`. A four-way question at 30/25/25/20 is a
 * genuinely divided room; a binary at 30/70 is not, and the raw leading
 * share ranks the binary as *more* divided. Scaling against each
 * question's own even split (1/k) puts both on the same axis, so the
 * Answers lens can sort a mixed deck without quietly ranking every
 * many-option question above every binary.
 *
 * Zero for a question nobody has answered — an empty room is not a
 * disagreement.
 */
export function divisiveness(counts: readonly number[]): number {
  const k = counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  if (k < 2 || !total) return 0;
  const lead = Math.max(...counts) / total;
  const even = 1 / k;
  // lead runs from `even` (perfectly split) up to 1 (unanimous).
  return Math.max(0, Math.min(1, (1 - lead) / (1 - even)));
}

export interface Score {
  /** Mean answer on a 1..max scale, to one decimal. */
  mean: number;
  /** Top of the scale — 10 for a rating, 5 for a Likert. */
  max: number;
  /** Answers behind the mean. */
  n: number;
}

/**
 * The mean of an ORDINAL question, read off its published counts.
 *
 * This is the arithmetic behind Scores, and it is only meaningful because
 * the option index of a `rating` or `scale` question carries magnitude:
 * option 7 really is more than option 3. Handing this a `choice` question
 * would produce a confident number about nothing, so the caller filters by
 * type and this function does not guess — there is nothing in `counts`
 * that could tell it apart.
 *
 * Scored 1..k rather than 0..k-1 so the number reads the way the option
 * label does: a rating card shows "7", not "6".
 *
 * Null when nobody has answered, never 0 — a zero here would render as the
 * worst possible score for a question nobody has rated.
 */
export function meanScore(counts: readonly number[]): Score | null {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n || counts.length < 2) return null;
  const sum = counts.reduce((acc, c, i) => acc + c * (i + 1), 0);
  return { mean: Math.round((sum / n) * 10) / 10, max: counts.length, n };
}

/**
 * The one number a question's row leads with (D120).
 *
 * Three readings, because three kinds of question are asking three
 * different things: an ordinal `rating` is about its AVERAGE, a `scale`
 * about how much of the room AGREES, and everything else about which
 * option LED. Returned as data rather than as a sentence — the words are
 * the row's, the arithmetic is here, and the split is what makes it
 * testable without a DOM.
 *
 * Null when nobody has answered: every branch would otherwise divide by
 * zero and render a confident 0% or 0.0 for a question with no answers.
 */
export type Headline =
  | { kind: "average"; mean: number; max: number }
  | { kind: "agree"; pct: number }
  | { kind: "top"; pct: number; optionIdx: number };

export function headlineFor(counts: readonly number[], type?: string): Headline | null {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n || !counts.length) return null;
  if (type === "rating") {
    const s = meanScore(counts);
    return s ? { kind: "average", mean: s.mean, max: s.max } : null;
  }
  if (type === "scale") {
    // The top TWO points of the scale, read off its end rather than at
    // fixed indices: a Likert is five long today and the bank does not
    // promise it always will be.
    //
    // Summed from pctFor's OUTPUT, not divided locally. This branch used to
    // do `Math.round((agree / n) * 100)`, which is the exact mistake the
    // categorical branch's "62, not 63" case below exists to prevent — and
    // it is worse here, because the number sits directly above the two bars
    // it claims to summarize. Brute-forced over every 5-option vector with
    // counts 0..12: 95,368 of them printed a headline the bars contradict,
    // e.g. [0,0,1,0,7] printing "88% agree" over bars of 13 and 87.
    //
    // pctFor's shares sum to exactly 100, so summing a suffix of them is
    // the agree share by construction, drift included.
    const pct = pctFor(counts);
    return { kind: "agree", pct: pct.slice(-2).reduce((a, b) => a + b, 0) };
  }
  const pct = pctFor(counts);
  const top = counts.reduce((t, v, i) => (v > counts[t] ? i : t), 0);
  return { kind: "top", pct: pct[top], optionIdx: top };
}

/**
 * Where the viewer sits in a distribution (D120) — null when they have
 * not answered it.
 *
 * On an ordinal question the interesting fact is how much of the room is
 * BELOW or ABOVE you, and the bigger of the two is the one worth saying.
 * On a categorical one it is simply how many picked what you picked:
 * "more than 40% of Oslo" would be meaningless when the options are
 * merely different from each other.
 */
export interface Standing {
  kind: "below" | "above" | "with";
  /** Share of the cohort on that side of you, 0..100. */
  pct: number;
}

export function standingIn(
  counts: readonly number[], mine: number, type?: string,
): Standing | null {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n || mine < 0 || mine >= counts.length) return null;
  // Read off pctFor rather than divided here, which is the same correction
  // headlineFor's scale branch carries above: this sentence is printed
  // directly UNDER the row's bar, and the bar is pctFor. Dividing locally
  // reproduces the exact drift that branch describes — `[1,7]` draws a bar
  // of 87 and `Math.round(7/8*100)` says 88, one screen line apart.
  //
  // pctFor's shares sum to exactly 100, so a share, a prefix or a suffix
  // of them is the right number by construction, largest-remainder
  // rounding included.
  const pct = pctFor(counts);
  if (type === "rating" || type === "scale") {
    // WHICH SIDE is still decided on the raw counts. The shares can tie
    // where the counts do not (and the reverse), and "the bigger of the
    // two" is a claim about the room rather than about the bar.
    const below = counts.slice(0, mine).reduce((a, b) => a + b, 0);
    const above = counts.slice(mine + 1).reduce((a, b) => a + b, 0);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    return below >= above
      ? { kind: "below", pct: sum(pct.slice(0, mine)) }
      : { kind: "above", pct: sum(pct.slice(mine + 1)) };
  }
  return { kind: "with", pct: pct[mine] };
}

export interface Typicality {
  /** Share of this cohort that answered the same as you, 0..100. */
  share: number;
  /** The cohort's most common answer. */
  mode: number;
  /** True when your answer IS the cohort's most common one. */
  withMajority: boolean;
  /** Answers in the cohort, so a caller can say how thin the reading is. */
  n: number;
}

/**
 * How usual your answer was among people who share one anchor with you.
 *
 * This is the Map's headline claim — "48% of people your age chose the
 * same" — and until D98 it was a hash of the question id (D72 refused it
 * for exactly that reason). It is now arithmetic on published counts.
 *
 * Returns null when the cohort has no answers, which the caller must
 * render as absence rather than as a zero: "nobody your age has answered
 * this" and "0% of people your age agreed" are different sentences and
 * only one of them is true.
 *
 * YOUR OWN ANSWER IS INCLUDED in the denominator, deliberately. You are a
 * member of your own age band, the aggregate folded your answer like
 * everyone else's, and subtracting yourself would make the Map disagree
 * with the who-voted sheet beside it over the same cohort.
 */
export function typicality(
  by: ByMap | undefined,
  dim: string,
  bucket: string,
  myOptionIdx: number,
  optionCount: number,
): Typicality | null {
  const counts = cellFor(by, dim, bucket, optionCount);
  if (!counts) return null;
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n) return null;
  const pct = pctFor(counts);
  let mode = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > counts[mode]) mode = i;
  const mine = myOptionIdx >= 0 && myOptionIdx < pct.length ? myOptionIdx : -1;
  return {
    share: mine >= 0 ? pct[mine] : 0,
    mode,
    withMajority: mine >= 0 && mine === mode,
    n,
  };
}

export interface Agreement {
  /** Questions both sides answered. */
  shared: number;
  /** Of those, how many matched. */
  same: number;
  /** same/shared as a percentage, 0 when nothing is shared. */
  pct: number;
}

/**
 * Agreement between two answer maps — the likeness metric behind Kindred
 * and person-to-person Compare.
 *
 * Deliberately the simplest thing that is true: the share of commonly
 * answered questions where both picked the same option. No weighting by
 * how divisive a question was, no similarity over scale distance. Those
 * are better metrics and every one of them is a judgement call about what
 * likeness MEANS, which is a product decision rather than an
 * implementation detail — this one can be explained in a sentence to the
 * person it is about, which is the property that matters most on a screen
 * that names them.
 */
export function agreement(
  mine: Readonly<Record<string, number>>,
  theirs: Readonly<Record<string, number>>,
): Agreement {
  let shared = 0;
  let same = 0;
  for (const qid of Object.keys(mine)) {
    if (!(qid in theirs)) continue;
    shared++;
    if (mine[qid] === theirs[qid]) same++;
  }
  return { shared, same, pct: shared ? Math.round((same / shared) * 100) : 0 };
}

/** Convenience: the `by` map off an aggregate, or undefined. */
export function byOf(agg: AggDoc | undefined | null): ByMap | undefined {
  return (agg?.by as ByMap | undefined) || undefined;
}
