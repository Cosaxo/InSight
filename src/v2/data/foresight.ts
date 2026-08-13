// Foresight — how well you can read a population (D126).
//
// v19's one new feature, and the only item on the 19-point list still
// unbuilt. The prototype ships it as two card types:
//
//   READ  which side did one demographic slice pick on a question the
//         crowd has already settled? Scored instantly.
//   CALL  a real-world event sealed now, scored when it resolves.
//
// THIS MODULE IS READ. Call is not here, and §"What CALL needs" at the
// foot of this file says exactly what it is waiting on — it is an ops
// process, not an afternoon of code.
//
// WHY READ IS NOW REAL, AND WAS NOT BUILDABLE BEFORE. The prototype
// derives a slice's answer from `wfHash(qid + dim + bucket)` — an
// invented truth, chosen to be stable rather than correct, because under
// the old model no cohort cell below the k-floor was published and most
// cells were below it. So the game could be *played* but never *scored*:
// there was nothing to be right about.
//
// D98 published every cell at every size, and D99 put the fold in
// data/cohort.ts. So the answer to "which option did 25-34 pick" is now
// a lookup, not a hash — the same lookup the Explore lens draws, and the
// same numbers the who-voted sheet lists by name. A read can therefore
// never disagree with the screen behind it, which is the property the
// prototype's hash was reaching for and could only approximate.
//
// Everything here is pure: no Firebase, no window, no clock. The clock
// belongs to the card (it is a presentation choice about how long you
// get to think), and a scoring rule that depended on wall time could not
// be tested.

import { cellFor, mixFor, pctFor, type ByMap } from "./cohort";

/** A question, as the generator needs it. */
export interface ForesightSource {
  id: string;
  text: string;
  options: string[];
  /** Overall published counts, dense to options.length. */
  counts: number[];
  by: ByMap | undefined;
}

export interface Read {
  /** Stable id: one read per (question, slice), so it cannot be re-rolled. */
  id: string;
  qid: string;
  text: string;
  options: string[];
  dim: string;
  bucket: string;
  /** The slice's own split, as percentages — the answer, kept for the reveal. */
  slicePct: number[];
  /** The option the slice actually picked most. */
  answerIdx: number;
  /** Answers behind the slice. */
  n: number;
  /** The overall split, so the card can show what the crowd did. */
  overallPct: number[];
  /**
   * True when the slice's top pick differs from everyone's. These are the
   * reads worth asking — see `SURPRISE_FIRST`.
   */
  surprise: boolean;
}

/**
 * Answers a slice needs before it can be read.
 *
 * LEGIBILITY, not disclosure — the same distinction `divergence`'s minN
 * draws (D99), and worth repeating because the number looks like the
 * floor D98 deleted. It is not. Nothing is withheld: the cell is
 * published at any size and the Explore lens draws it at any size. This
 * threshold is about whether a QUESTION IS FAIR: a bucket holding three
 * answers has a "most picked" that one more answer could flip, so asking
 * someone to predict it and then marking them wrong is scoring a coin
 * toss. Raising it makes the game harder to fill; lowering it makes it
 * dishonest.
 */
export const READ_MIN_N = 8;

/**
 * Minimum lead the top option needs, in points, over the runner-up.
 *
 * The second half of the same fairness rule. A 51/49 slice has a
 * technically correct answer that nobody could read, and marking a
 * player wrong for it teaches them the game is arbitrary.
 */
export const READ_MIN_LEAD = 12;

/** Reads whose slice disagrees with the crowd are offered first. */
export const SURPRISE_FIRST = true;

/** Build the id for one read, so callers agree without importing the shape. */
export function readId(qid: string, dim: string, bucket: string): string {
  return `${qid}__${dim}__${bucket}`;
}

/**
 * Every fair read available in a set of questions.
 *
 * Ordered surprise-first, then by how thin the slice is — a read where
 * the slice went against everyone is the one that teaches you something,
 * and one where the slice merely agrees with the crowd is answerable
 * without knowing anything about the slice at all. That second kind is
 * not filtered out (some are genuinely uncertain), just ranked below.
 */
export function readsFrom(
  questions: readonly ForesightSource[],
  dims: readonly string[],
  minN = READ_MIN_N,
  minLead = READ_MIN_LEAD,
): Read[] {
  const out: Read[] = [];
  for (const q of questions) {
    if (!q.options.length || !q.counts.some((c) => c > 0)) continue;
    const overallPct = pctFor(q.counts);
    const overallTop = topIdx(q.counts);
    for (const dim of dims) {
      for (const b of mixFor(q.by, dim, q.options.length)) {
        if (b.n < minN) continue;
        const pct = pctFor(b.counts);
        const answerIdx = topIdx(b.counts);
        // Lead over the runner-up, in points.
        const sorted = [...pct].sort((x, y) => y - x);
        if ((sorted[0] - (sorted[1] || 0)) < minLead) continue;
        out.push({
          id: readId(q.id, dim, b.bucket),
          qid: q.id, text: q.text, options: q.options,
          dim, bucket: b.bucket,
          slicePct: pct, answerIdx, n: b.n,
          overallPct,
          surprise: answerIdx !== overallTop,
        });
      }
    }
  }
  return out.sort((a, b) =>
    (SURPRISE_FIRST ? Number(b.surprise) - Number(a.surprise) : 0)
    || b.n - a.n
    || a.id.localeCompare(b.id));
}

/** Index of the largest count; ties go to the lower index. */
function topIdx(counts: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
  return best;
}

/** One scored read, as it is stored and replayed. */
export interface Verdict {
  id: string;
  qid: string;
  dim: string;
  bucket: string;
  /** What the player picked; -1 when the clock ran out unanswered. */
  guess: number;
  correct: boolean;
  /** ms since epoch, supplied by the caller — this module holds no clock. */
  at: number;
}

/**
 * Score a guess.
 *
 * A timeout (`guess < 0`) is a MISS, not a skip, and that is a rule
 * rather than an implementation detail: the clock is the game, and a
 * card you can let expire for free is one where waiting is always the
 * best play when you are unsure.
 */
export function scoreRead(read: Read, guess: number, at: number): Verdict {
  return {
    id: read.id, qid: read.qid, dim: read.dim, bucket: read.bucket,
    guess,
    correct: guess >= 0 && guess === read.answerIdx,
    at,
  };
}

export interface Record {
  /** Reads answered. */
  played: number;
  /** Of those, right. */
  hits: number;
  /** hits/played as a percentage, 0 when nothing is played. */
  pct: number;
  /** Consecutive hits ending at the most recent verdict. */
  streak: number;
  /** The longest run of hits anywhere in the log. */
  best: number;
}

/**
 * Fold a log into a record.
 *
 * Takes the log in any order and sorts by `at`: the store hands back a
 * map, and a streak computed over Object.values() order would be a
 * different number on a different device for the same history.
 */
export function recordOf(log: readonly Verdict[]): Record {
  const rows = [...log].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  let hits = 0;
  let streak = 0;
  let best = 0;
  for (const v of rows) {
    if (v.correct) { hits++; streak++; if (streak > best) best = streak; }
    else streak = 0;
  }
  return {
    played: rows.length,
    hits,
    pct: rows.length ? Math.round((hits / rows.length) * 100) : 0,
    streak,
    best,
  };
}

/**
 * Per-dimension accuracy — which cuts of the population you read well.
 *
 * The reason the whole feature is worth more than a score: "you read age
 * well and education badly" is a fact about you that no other surface in
 * the app can produce, and it comes free off the same log.
 *
 * Dimensions with nothing played are absent rather than zero, for the
 * usual reason — 0% and "not yet" are different claims.
 */
export function byDim(log: readonly Verdict[]): Array<{ dim: string; played: number; hits: number; pct: number }> {
  const t: Record2 = {};
  for (const v of log) {
    const row = t[v.dim] || (t[v.dim] = { played: 0, hits: 0 });
    row.played++;
    if (v.correct) row.hits++;
  }
  return Object.keys(t)
    .map((dim) => ({
      dim, played: t[dim].played, hits: t[dim].hits,
      pct: Math.round((t[dim].hits / t[dim].played) * 100),
    }))
    .sort((a, b) => b.pct - a.pct || b.played - a.played || a.dim.localeCompare(b.dim));
}
type Record2 = { [dim: string]: { played: number; hits: number } };

/** Reads not yet in the log, in offer order. */
export function unplayed(reads: readonly Read[], log: Readonly<{ [id: string]: unknown }>): Read[] {
  return reads.filter((r) => !(r.id in log));
}

/**
 * How the slice's answer compares to what a guesser would say by default.
 *
 * Used only for the reveal copy. `cellFor` is re-derived rather than
 * passed so the reveal cannot drift from the generator's own reading of
 * the same cell.
 */
export function revealFor(read: Read, by: ByMap | undefined): number[] | null {
  return cellFor(by, read.dim, read.bucket, read.options.length);
}

// ── What CALL needs, and why it is not in this file ──────────────────
//
// A CALL is "Arsenal to win the league — sealed now, scored in May". The
// machinery is small: a question with a `resolvesAt` and an `outcomeIdx`
// written after the fact, an answer sealed until then (the duel seal
// already proves that shape works), and the same verdict fold above.
//
// What it needs and does not have is **an outcome nobody can fake**:
//
//   1. EVENTS. The bank ships none, and unlike D100's Scores there is no
//      equivalent hiding in it — a `rating` question is ordinal whatever
//      its subject, but no existing question is about a future fact.
//   2. A RESOLVER. Someone or something has to write `outcomeIdx` when
//      the match ends. That is an operator process with an SLA, not a
//      function: an unresolved call is worse than a missing feature,
//      because it takes the player's guess and never comes back.
//   3. D1. Seeding events with invented outcomes to fill the frame is
//      the one thing the no-synthetic-data rule forbids outright, and it
//      is exactly what the prototype does (4 settled events, hardcoded).
//
// The variant that would need neither an author nor a resolver is a call
// on the app's OWN future data — "will tomorrow's question split past
// 60/40?" — which the aggregate settles by itself. That is a different
// card from the prototype's and a product decision, so it is written
// down here rather than built.
//
// DESIGNED, NOT BUILT: docs/FORESIGHT-CALLS.md has the schema, the
// rubric format and the failure modes; D127 records the rule the whole
// design turns on — a machine may PROPOSE an outcome and may never be
// the REASON one is believed. Read that before adding anything here.
