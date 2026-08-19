// How each TYPE answered one question — the reading `docs/MIRROR.md` has
// recorded as dark since the port, drawn without the schema change that
// was supposed to be its price.
//
// THE READING. Every cut on the who-voted sheet today comes from
// `agg.by`: the anchors snapshot each answer froze at vote time (D8),
// folded server-side into exact per-cohort cells. A test result has never
// been in that snapshot, so "how did people like me answer" has been
// answerable for age, gender, city, country, education, relationship and
// height, and refused for the one cut this app is actually about
// (`spec/map-group-stats.js` returns null for all four instruments, and
// says why).
//
// NEXT-FUNCTIONALITY §3 tier 2 costed the fix as a new breakdown dim:
// stamp the matched archetype into `anchorsFrom` at vote time, add it to
// BREAKDOWN_DIMS, accumulate cells from ship date. That plan carries one
// property it states plainly and treats as acceptable — **"forward-only,
// and say so. Answers have never carried scores, so there is nothing to
// backfill."** Which means the cut is blank for every answer already
// given, and blank for you personally until the fold has enough of your
// test items to type you — after which it still only sees what you
// answer NEXT. The question that prompted this module was exactly that:
// *if I answer questions and get typed later, do the old answers count?*
// Under tier 2 the honest answer is no, permanently.
//
// THIS MODULE ANSWERS YES, and the reason it can is that the snapshot was
// never the only place the join could happen. Since D98 answers are
// public and `v2_users/{uid}.testResults` is world-readable; since D112
// `voters.resolveNames` parses those scores out of the SAME profile
// document it already reads for a name (the web SDK has no field mask, so
// they were on the wire regardless). So the session already holds, for a
// question it has opened: who answered, what they picked, and what their
// scores are. Typing them and grouping is arithmetic on data in hand —
// no new read, no new dim, no stamp, nothing to backfill, and it reads
// everyone's CURRENT type against the answers they ALREADY gave. Take
// your test items in month three and month one regroups itself.
//
// WHAT IT COSTS, because the trade is real and belongs in the copy rather
// than in a comment nobody reads. The published cells are a census: every
// answer, exact. This is a SAMPLE — the latest VOTER_FETCH_CAP voters for
// the question (D102), further thinned to the ones carrying a readable
// Big Five. Two numbers, and `TypeSplit` keeps them apart on purpose
// (`sampleN` and `typedN`) because the card has to be able to say which
// denominator a share is out of. A cut that cannot be exact must at least
// be honest about what it is instead, which is the LiveSimilarityField
// rule applied to a new consumer.
//
// BIG FIVE ONLY, and that is not a stub. The politics result is Art. 9
// data (`docs/data-inventory.md`) and slicing every answer by political
// type is the exposure D44 was about; D98 reversed D44 on the ITEMS'
// counts, not on cross-tabbing by result. `typeMix.TYPE_TEST` picked the
// Big Five as the app's least charged system for exactly this reason.
//
// **THIS MODULE NOW OWNS THAT SCOPE RATHER THAN INHERITING IT (D202).**
// Until D202, `typeMix.TYPE_TEST` was an enforcement point and this file
// could lean on it. D202 demoted that constant to a default so a reader
// could switch the population MIX between instruments — and the promise
// in `web/privacy.html` that survived D202 is precisely the one this file
// keeps: *answers* are grouped by the Big Five and by nothing else.
// Leaning on someone else's default for that would mean the promise had
// no owner, so `SPLIT_TEST` below is explicit, passed at every call site,
// and pinned by a test.
//
// Pure — no Firebase, no window, no LIVE. The caller joins voters to
// scores (both already in the store) and hands the rows in, the way
// cohort.ts and similarity.ts take their inputs.
import { TYPE_TEST, TYPE_THIN, typeNames, typeOfParsed } from "./typeMix";
import type { ParsedResults } from "./similarity";

export { TYPE_TEST, TYPE_THIN };

/**
 * The instrument answers may be grouped by — the whole of the D202-surviving
 * promise, in one constant.
 *
 * It is `TYPE_TEST` today and must be passed explicitly rather than left to
 * default: the point is that widening `typeMix`'s default can no longer
 * widen this. `web/privacy.html` states the scope to users and
 * `check:policy-claims` pins that sentence; this is the code half.
 */
export const SPLIT_TEST = TYPE_TEST;

/**
 * Below this many typed voters, the split has no shares at all.
 *
 * `typeMix.TYPE_SMALL` is 40 for a population's type MIX — one number per
 * type over the whole sample. A per-option split spends the same people
 * across the question's options as well, so the same sample buys a
 * coarser reading here and the floor is higher to match. 60 typed voters
 * over a 3-option question is ~20 an option before the types divide it,
 * which is the point where a percentage stops being one person moving.
 */
export const TYPE_SPLIT_SMALL = 60;

/** One type's reading of the question. */
export interface TypeSplitRow {
  type: string;
  /** Typed voters of this type in the sample. */
  n: number;
  /** Dense per-option counts, to the question's own option count. */
  counts: number[];
}

export interface TypeSplit {
  /** Types with enough behind them to rank, most numerous first. */
  ranked: TypeSplitRow[];
  /** Seen but under TYPE_THIN — listed with counts, never ranked. */
  thin: TypeSplitRow[];
  /** Types nobody in the sample carries. Named as missing, never drawn. */
  absent: string[];
  /** Voters the session holds for this question — the outer basis. */
  sampleN: number;
  /** Of those, the ones carrying a readable Big Five — the real basis. */
  typedN: number;
  /**
   * The TYPED sample's own split across the options.
   *
   * NOT the published census, and the difference is the one arithmetic
   * trap in this module. A type's share compared against `agg.counts`
   * mixes two effects: how that type differs from everyone, and how the
   * latest-200-with-a-result differ from everyone. Only the first is the
   * reading. Comparing within the sample cancels the second — whatever
   * bias recency and having-taken-test-items introduce is then in both
   * sides of the subtraction. The census stays on screen as "Everyone",
   * it just is not what the divergence line subtracts.
   */
  overall: number[];
  /** The viewer's own type, when the passive fold has published one. */
  mine: string | null;
  /** True once `typedN` is enough for shares to mean anything. */
  enough: boolean;
}

/**
 * A voter as this fold needs them — the store's join of answer to scores
 * (`LIVE.voterScores`).
 *
 * `uid` is carried even though the arithmetic never reads it: the roster
 * under the bars has to be scoped to exactly the people a row counted,
 * and a type is not an anchor, so `uidsOfType` is the only way to express
 * that membership.
 */
export interface ScoredVoter {
  uid: string;
  optionIdx: number;
  results: ParsedResults | null;
}

const dense = (n: number): number[] => Array.from({ length: Math.max(0, n) }, () => 0);
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * Group a question's cached voters by their current Big Five type.
 *
 * `mine` is passed rather than read, so the module stays pure and the
 * caller decides whether "your type" comes from the passive fold or from
 * a stored result — `typeMix.myType()` already settles that question and
 * this fold should not settle it a second way.
 */
export function typeSplitFor(
  voters: readonly ScoredVoter[],
  optionCount: number,
  mine: string | null = null,
): TypeSplit {
  const counts = new Map<string, number[]>();
  const overall = dense(optionCount);
  let typedN = 0;

  for (const v of voters) {
    const type = typeOfParsed(v.results, SPLIT_TEST);
    // No readable result is not a type — it thins the basis and is
    // reported as the gap between sampleN and typedN, never bucketed as
    // an "unknown" type that would then rank against the real ones.
    if (!type) continue;
    typedN += 1;
    // A catalog answer or an out-of-range index counts toward the type's
    // n (they are a typed person who answered) but lands in no column.
    // Dropping them from n instead would make the columns sum to a
    // number the header does not show.
    let row = counts.get(type);
    if (!row) {
      row = dense(optionCount);
      counts.set(type, row);
    }
    if (v.optionIdx >= 0 && v.optionIdx < optionCount) {
      row[v.optionIdx] += 1;
      overall[v.optionIdx] += 1;
    }
  }

  // Every type the system defines gets considered, not just the ones
  // present — `absent` is a finding (D141's rule, kept), and it can only
  // be stated by starting from the full list.
  const rows: TypeSplitRow[] = typeNames(SPLIT_TEST).map((type) => ({
    type,
    n: counts.has(type) ? sum(counts.get(type)!) : 0,
    counts: counts.get(type) || dense(optionCount),
  }));
  // `n` is the column sum, so a typed voter whose answer landed in no
  // column is invisible here. That is deliberate: n has to equal what the
  // bars add up to, or the row lies about its own picture.

  return {
    ranked: rows.filter((r) => r.n >= TYPE_THIN).sort((a, b) => b.n - a.n || a.type.localeCompare(b.type)),
    thin: rows.filter((r) => r.n > 0 && r.n < TYPE_THIN).sort((a, b) => b.n - a.n || a.type.localeCompare(b.type)),
    absent: rows.filter((r) => r.n === 0).map((r) => r.type),
    sampleN: voters.length,
    typedN,
    overall,
    mine,
    enough: typedN >= TYPE_SPLIT_SMALL,
  };
}

/**
 * The uids carrying one type, for scoping the roster under the bars.
 *
 * Here rather than in the component because it must type people the same
 * way `typeSplitFor` did — a second call site matching types its own way
 * is how the names under a number stop being the people it counted.
 */
export function uidsOfType<T extends { uid: string; results: ParsedResults | null }>(
  voters: readonly T[],
  type: string,
): Set<string> {
  const out = new Set<string>();
  for (const v of voters) if (typeOfParsed(v.results, SPLIT_TEST) === type) out.add(v.uid);
  return out;
}

/**
 * Where a type parts company with the typed sample, in percentage points.
 *
 * The same shape `cohort.divergence` returns for a published cohort, so
 * the sentence the sheet draws is the same sentence in both modes and the
 * two cannot disagree about what "parts company" means. Null when the row
 * is too thin to have a reading at all — refused rather than padded,
 * which is the rule the whole data layer runs on.
 */
export function typeDivergence(
  row: TypeSplitRow,
  overall: readonly number[],
): { optionIdx: number; gap: number; higher: boolean } | null {
  if (row.n < TYPE_THIN) return null;
  const totalAll = sum(overall);
  if (!totalAll || !row.n) return null;
  let best = -1;
  let gap = 0;
  let higher = false;
  for (let i = 0; i < row.counts.length; i++) {
    const mine = (row.counts[i] / row.n) * 100;
    const theirs = ((overall[i] || 0) / totalAll) * 100;
    const d = Math.round(Math.abs(mine - theirs));
    if (d > gap) {
      gap = d;
      best = i;
      higher = mine > theirs;
    }
  }
  return best < 0 || gap === 0 ? null : { optionIdx: best, gap, higher };
}
