// Compare — you against a population, across every assessment.
//
// THE LENS THIS FEEDS SHIPPED AS SOMETHING ELSE FOR ITS WHOLE LIFE, and
// the gap was written down the day it went live. docs/MIRROR.md has said
// since D99 what Compare IS: "you against them across every assessment,
// in the results profile's own visual language". What D99 actually built
// was `pctFor` on your own option, question by question, ranked
// least-typical first — a correct reading, drawn from real counts, that
// answers a different question. Nothing caught it because nothing could:
// every number on that screen was true.
//
// It was also the Answers tab with a different sort. `LiveAnswerRows`
// draws every question of the same population with your own pick marked
// and prints "62% of Oslo are with you" underneath it (`standingIn`), so
// the old Compare's whole reading was one tab to the left, with filters
// and an expander the lens did not have. What the row was missing is the
// one comparison nothing else in the Mirror makes: you and them as WHOLE
// PROFILES, one shape against another.
//
// WHAT "THEM" IS, and there are two answers because there are two kinds
// of population in the Mirror:
//
//   a place    City, Country, World and your Circle are read from
//              per-option COUNTS — the published cells for a place, the
//              members' own answers for a circle — folded through the
//              same `axisScores` the personal scorer runs. One
//              arithmetic, any cohort, which is what that function was
//              written for (D112).
//
//   a set      Groups and Near are people whose test-item answers this
//              device does not hold, but whose completed instruments are
//              public (D98) and already cached beside their names. So
//              their side is the MEAN of the members' own results.
//
// Neither basis is the other and the caller says which one it drew, with
// the count it drew it over. That is the rule this module inherits from
// testNorms.ts and LiveSimilarityField: every number carries what it was
// measured over, so the surface can say it out loud.
//
// Pure — no Firebase, no window — so the whole reading is unit-testable
// the way cohort.ts and similarity.ts are. The refusals are theirs too: a
// reading below its floor is ABSENT, never padded to look like a finding.
import {
  axisScores,
  myAxisScores,
  scoreMatch,
  type ParsedResults,
  type TestDefs,
  type TestItemMeta,
} from "./similarity";

/** kind → dim → 0..100. Both sides of the comparison speak this. */
export type AxisMap = Record<string, Record<string, number>>;

/**
 * Axes an instrument's card needs before it is drawn.
 *
 * MIN_PLACE_AXES' number and MIN_PLACE_AXES' reasoning — one or two axes
 * is a coin toss dressed as a reading, three is the least that can
 * disagree with itself. It binds here on the OVERLAP: a card is drawn
 * only where you and they both have three of the same axes, because the
 * rose's whole claim is that two profiles are being laid over each other.
 */
export const MIN_COMPARE_AXES = 3;

/** One axis of one instrument, both sides of it. */
export interface CompareDim {
  id: string;
  label: string;
  /** Yours, 0..100 — CBRoseGap draws the solid petal to this. */
  value: number;
}

/** One instrument, compared. */
export interface CompareCard {
  kind: string;
  /** The instrument's own title, from its definition. */
  title: string;
  /**
   * Your axes, in the instrument's own order — and ONLY the ones they
   * have too.
   *
   * Trimmed to the overlap rather than carrying your whole profile, which
   * is not a display preference. `CBRoseGap` draws the span between the
   * two of you as `themV[d.id] ?? 50`, so an axis with no counterpart
   * would be washed as though they sat at fifty — a mark on a screen that
   * says something about people who have said nothing. It is a live case
   * and not a theoretical one: `cohortAxisMap` drops an axis below its
   * floor while its siblings clear, so a population routinely has four of
   * an instrument's five.
   *
   * So `dims.length === axes`, and every slice of the rose has a dot.
   */
  dims: CompareDim[];
  /** Their value per axis id — CBAssess's `themV`. */
  theirs: Record<string, number>;
  /** 100 − the mean gap across the axes you share, 0..100. */
  align: number;
  /** Axes that mean ran over — the card's own basis. */
  axes: number;
  /**
   * Answers behind THEIR side of these axes, or 0 on the `people` basis
   * where the count is in people rather than answers.
   */
  answers: number;
}

export interface CompareRead {
  cards: CompareCard[];
  /**
   * Answers behind the axes actually DRAWN, summed across the cards —
   * zero on the `people` basis, where the population is counted in people.
   */
  answers: number;
  /**
   * The same metric pooled across every shared axis of every instrument,
   * or null when nothing cleared the floor.
   *
   * A POOLED mean, not the mean of the cards' percentages, and the
   * difference is deliberate. The prototype averages the card figures
   * (`compare-breakdown.jsx`: `aligns.reduce(...) / aligns.length`),
   * which weights a five-axis instrument the same as a six-axis one. This
   * is `scoreMatch` — the identical call the People lens and the
   * constellation's place cards already make — so "100 minus the average
   * gap across the axes you both have" is one sentence that is true of
   * every likeness figure in the Mirror, and the header number is the
   * same KIND of number as the "92% aligned with your scores" on a place
   * card two tabs over.
   */
  overall: number | null;
  /** Axes the overall ran over, so the surface can state its basis. */
  axes: number;
}

// ── your side ────────────────────────────────────────────────────────

/**
 * Your own axes per instrument: a completed test where you have one, your
 * own answers to that instrument's feed items where you have not.
 *
 * `myFlatAxes` (similarity.ts) makes exactly this merge and then flattens
 * it for a distance; this keeps the instruments apart because Compare
 * draws a card per instrument. The merge rule is the same one and for the
 * same reason: a sit-down result is the better measurement, and "you have
 * answered seven Politics questions in the feed" is still real data about
 * you, so the lens fills in from ordinary answering rather than staying
 * blank until you sit a test.
 */
export function myAxisMap(
  results: ParsedResults | null,
  items: readonly TestItemMeta[],
  defs: TestDefs,
  votes: Readonly<Record<string, number>>,
): AxisMap {
  const out: AxisMap = {};
  for (const kind of Object.keys(defs)) {
    if (results?.[kind] && Object.keys(results[kind]).length) {
      out[kind] = results[kind];
      continue;
    }
    const folded = myAxisScores(kind, defs[kind], items, votes);
    if (folded.length) out[kind] = Object.fromEntries(folded.map((a) => [a.dim, a.value]));
  }
  return out;
}

// ── their side, from counts ──────────────────────────────────────────

/** A population's axes, with what they were folded over. */
export interface CohortAxes {
  axes: AxisMap;
  /**
   * Answers behind each axis, kind → dim → n.
   *
   * PER AXIS rather than one total, because the total would be a wrong
   * number wherever the two profiles do not line up exactly. A population
   * with Big Five and Politics measured, read by someone who has only
   * finished Big Five, draws five axes — and a header saying "across 5
   * axes · 12,000 test answers" would be resting five axes on a figure
   * that counts eleven. `compareRead` sums only what it drew.
   */
  n: Record<string, Record<string, number>>;
}

/**
 * A population's axes from per-option counts.
 *
 * `cellOf` returns that population's dense 5-option counts for a bank
 * item, or null where it has none — `agg.by.city[key]` for a city,
 * `agg.counts` for the globe, a device-side fold of the members' picks
 * for a circle. The arithmetic underneath is `axisScores`, unchanged, so
 * a city's Openness here is the same number the constellation places that
 * city by.
 *
 * The two floors are the CALLER'S, and that is the interesting part.
 * testNorms.ts holds an axis to 30 answers across 2 items before it is
 * drawn as "most people", because a place is a SAMPLE of a place and the
 * mean of four answers is four people's mood. A circle is not a sample of
 * anything — it is the exact set you chose, and its mean is that set's
 * mean however small it is. So the sample floor travels with the claim
 * rather than living here; the item floor does not, because "an axis is
 * several questions agreeing" is true of any population.
 */
export function cohortAxisMap(
  defs: TestDefs,
  items: readonly TestItemMeta[],
  cellOf: (qid: string) => readonly number[] | null,
  minAnswers: number,
  minItems: number,
): CohortAxes {
  const axes: AxisMap = {};
  const n: Record<string, Record<string, number>> = {};
  for (const kind of Object.keys(defs)) {
    const def = defs[kind];
    if (!def || !def.dims) continue;
    const dims: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const a of axisScores(kind, def, items, cellOf)) {
      if (a.n < minAnswers || a.items < minItems) continue;
      dims[a.dim] = a.value;
      counts[a.dim] = a.n;
    }
    if (Object.keys(dims).length) {
      axes[kind] = dims;
      n[kind] = counts;
    }
  }
  return { axes, n };
}

// ── their side, from people ──────────────────────────────────────────

/** A population's axes, with how many people carried them. */
export interface PeopleAxes {
  axes: AxisMap;
  /** People who contributed at least one axis, to any instrument. */
  people: number;
  /**
   * …and how many contributed to at least one of `kinds` (D235).
   *
   * A caller that DREW only some of the instruments must count only those,
   * or its basis line overstates what the cards on screen rest on — the
   * same refusal `cohortAxisMap`'s consumer already makes by printing the
   * drawn answers rather than the fold's total.
   *
   * A UNION rather than a sum of per-instrument counts: one person who
   * finished two instruments is one person, and adding the counts would
   * report more people than the roster has.
   */
  peopleIn: (kinds: readonly string[]) => number;
}

/**
 * A population's axes as the MEAN of its members' completed instruments.
 *
 * For Groups and Near, whose members' answers to the test bank this
 * device does not hold. Averaged per AXIS rather than per person, so
 * somebody who has finished Politics and not Big Five counts toward
 * Politics and is simply absent from the other card — the alternative,
 * requiring a whole matching set, would make a group of five with five
 * different half-finished profiles read as having no profile at all.
 *
 * No floor. A group is not a sample of a larger crowd, it is the crowd —
 * the mean of three members' scores IS what those three average — so
 * `people` is returned for the caller to print rather than to gate on.
 * The same reasoning testNorms.ts spells out in the other direction for
 * the world, where a floor is exactly right.
 */
export function peopleAxisMap(
  defs: TestDefs,
  results: ReadonlyArray<ParsedResults | null>,
): PeopleAxes {
  const acc: Record<string, Record<string, { sum: number; n: number }>> = {};
  const seen = new Set<number>();
  // Who contributed to WHICH instrument, so a caller that drew some of
  // them can count only those (see PeopleAxes.peopleIn).
  const perKind: Record<string, Set<number>> = {};
  results.forEach((r, i) => {
    if (!r) return;
    for (const kind of Object.keys(defs)) {
      const dims = r[kind];
      if (!dims) continue;
      const into = acc[kind] || (acc[kind] = {});
      for (const [dim, v] of Object.entries(dims)) {
        if (!Number.isFinite(v)) continue;
        const a = into[dim] || (into[dim] = { sum: 0, n: 0 });
        a.sum += v;
        a.n += 1;
        seen.add(i);
        (perKind[kind] || (perKind[kind] = new Set<number>())).add(i);
      }
    }
  });
  const axes: AxisMap = {};
  for (const kind of Object.keys(defs)) {
    const into = acc[kind];
    if (!into) continue;
    const dims: Record<string, number> = {};
    // The instrument's own dim order, so the rose's slices and the pole
    // rows read the way the results page does.
    for (const d of defs[kind].dims || []) {
      const a = into[d.id];
      if (!a || !a.n) continue;
      dims[d.id] = Math.round(a.sum / a.n);
    }
    if (Object.keys(dims).length) axes[kind] = dims;
  }
  return {
    axes,
    people: seen.size,
    peopleIn(kinds) {
      const union = new Set<number>();
      for (const k of kinds) {
        const s = perKind[k];
        if (s) for (const i of s) union.add(i);
      }
      return union.size;
    },
  };
}

// ── the comparison ───────────────────────────────────────────────────

/**
 * Lay the two profiles over each other, instrument by instrument.
 *
 * A card exists only where BOTH sides carry MIN_COMPARE_AXES of the same
 * axes; an instrument only one of you has is not a comparison and is left
 * out rather than drawn half-empty against a neutral 50, which is the
 * invented middle-of-the-road population `axisScores` already refuses to
 * manufacture.
 *
 * `order` is the instruments in the order the surface wants them, which
 * is the caller's business — this returns the cards it could build, in
 * that order.
 *
 * `theirN` is the per-axis answer count from `cohortAxisMap`, absent on
 * the `people` basis. Passed in rather than looked up so this stays a
 * pure fold over two maps, and so the answer figure the header prints
 * counts the axes it drew and nothing else.
 */
export function compareRead(
  defs: TestDefs,
  order: readonly string[],
  mine: AxisMap,
  theirs: AxisMap,
  theirN?: Record<string, Record<string, number>>,
): CompareRead {
  const cards: CompareCard[] = [];
  // Pooled across instruments for the header figure, so a wide test does
  // not count twice — see CompareRead.overall.
  const mineFlat: Record<string, number> = {};
  const themFlat: Record<string, number> = {};
  for (const kind of order) {
    const def = defs[kind];
    const my = mine[kind];
    const them = theirs[kind];
    if (!def || !my || !them) continue;
    // The instrument's own dim order and its own labels: `mine` may have
    // come off a stored result whose key order is whatever JSON gave back.
    // OVERLAP ONLY — see CompareCard.dims for why an axis with no
    // counterpart cannot be carried through.
    const dims: CompareDim[] = [];
    const shared: Record<string, number> = {};
    for (const d of def.dims || []) {
      const v = my[d.id];
      if (!Number.isFinite(v) || !Number.isFinite(them[d.id])) continue;
      dims.push({ id: d.id, label: d.label, value: v });
      shared[d.id] = them[d.id];
    }
    if (dims.length < MIN_COMPARE_AXES) continue;
    // `scoreMatch` needs both sides keyed the same; the bare dim id is
    // safe within one instrument, and the flatten below prefixes for the
    // pooled figure because two instruments can share a dim id ("open" is
    // Social's and could be anyone's).
    const m = scoreMatch(
      Object.fromEntries(dims.map((d) => [d.id, d.value])), shared, MIN_COMPARE_AXES,
    );
    if (!m) continue;
    let answers = 0;
    for (const d of dims) {
      mineFlat[`${kind}:${d.id}`] = d.value;
      themFlat[`${kind}:${d.id}`] = shared[d.id];
      answers += theirN?.[kind]?.[d.id] || 0;
    }
    cards.push({ kind, title: def.title || kind, dims, theirs: shared, align: m.match, axes: m.axes, answers });
  }
  // Already flat and already prefixed, so this is `scoreMatch` on the
  // union of every card's shared axes — the same call, one level up.
  const all = cards.length ? scoreMatch(mineFlat, themFlat, MIN_COMPARE_AXES) : null;
  return {
    cards,
    answers: cards.reduce((s, c) => s + c.answers, 0),
    overall: all ? all.match : null,
    axes: all ? all.axes : 0,
  };
}
