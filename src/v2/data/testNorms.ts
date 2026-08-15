// Test norms — what the POPULATION looks like on an instrument, measured
// (D155). The half of a result card that is not about you.
//
// Every profile test card draws two things that are claims about other
// people: a hollow ring labelled "most people" on each axis, and one line
// reading "higher than 9 in 10 members". Both came out of `IS_TEST_AVG` —
// five hand-written constants per instrument whose own comment says
// "Grounded, not precise: enough to give every score a reference point".
//
// That is the D149 shape exactly, one screen over: an authored number a
// writer typed while writing the content, rendered as a measurement,
// carrying the authority of the surface it sits on. "members" is not even
// hedged — it names this app's population and states a percentile in it,
// from a constant plus an assumed spread.
//
// The measurements exist and nothing was pointed at them:
//
//   the mean   the bank's core test items are ordinary `scale` questions
//              whose per-option counts publish like any other answer
//              (D98). `axisScores` already folds those cells into an axis
//              score for a whole cohort — that is how a city gets a score
//              profile (D112). Run it over the WORLD's counts and the
//              result is the population's own average on that axis.
//
//   the rank   the cached voter sample carries real people with real
//              parsed results (`kindredPeople`). Counting how many of them
//              sit below you on an axis is a percentile with a basis you
//              can name, rather than a logistic on an assumed spread.
//
// Tier 1 in the sense docs/NEXT-FUNCTIONALITY.md means: arithmetic over
// data that is already public and already fetched. No new reads, no new
// dimension, nothing written anywhere.
//
// The rules this module keeps, all inherited:
//   · a reading below its floor is NULL or absent, never padded (D72 — a
//     consumer that forgets the check draws nothing readable and fails a
//     test, rather than quietly stating a fabricated average)
//   · the DEMO build keeps the authored constants, because there the
//     invented population IS the content and there is no aggregate to
//     replace it — the same split D149 drew through the learn seam
//   · every number carries what it was measured over, so the caller can
//     say it out loud
//
// Deliberately free of the archetype module: `typeMix.ts` owns the type
// half of the same question and already imports it, and a norms module
// that reached back for `matchArchetype` would close a cycle for one
// call.
import LIVE from "./live";
import {
  axisScores,
  testItemMeta,
  type AxisScore,
  type KindredPerson,
  type TestDef,
  type TestDefs,
  type TestItemMeta,
} from "./similarity";
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField
// precedent: the instrument definitions are the scoring metadata's only
// source, and content-parity.test.jsx pins IS_TESTS to this shape).
import { IS_TESTS, IS_TEST_AVG } from "../spec/test-definitions.js";

const DEFS = IS_TESTS as TestDefs;
const AUTHORED = IS_TEST_AVG as Record<string, Record<string, number>>;

/**
 * Answers an axis needs before its mean is drawn as "most people".
 *
 * Not a disclosure floor — D98 removed those and this module publishes
 * nothing. It is a MEANING floor: the mean of four answers is four
 * people's mood, and drawing it as the population's centre is the same
 * error as drawing the authored constant, with worse arithmetic behind
 * it. 30 answers across an axis's items is where the number stops moving
 * visibly with each new one.
 */
export const NORM_MIN_ANSWERS = 30;
/**
 * ...across at least this many of the instrument's items. One item's mean
 * is that item's mean; an axis is a claim about several questions
 * agreeing, so a single-item axis is refused however many answers it has.
 */
export const NORM_MIN_ITEMS = 2;
/**
 * People an axis needs before a PERCENTILE is stated. Higher than the
 * answer floor and counted in a different unit on purpose: "higher than 8
 * in 10" is a claim about a distribution, and a distribution of eleven
 * people cannot carry deciles.
 */
export const NORM_MIN_PEOPLE = 12;

/** Where a norm came from — said out loud by every surface that draws it. */
export type NormSrc = "measured" | "authored";

export interface TestNorm {
  /** dim → 0..100. Only axes that cleared the floors; possibly empty. */
  avg: Record<string, number>;
  /** dim → answers behind that axis (0 for the authored baseline). */
  n: Record<string, number>;
  src: NormSrc;
}

/** One axis's percentile, with the basis it was counted over. */
export interface AxisRank {
  /** How many people out of ten sit below you on your side. 1..9. */
  outOfTen: number;
  /** People with a readable value on this axis — the stated basis. */
  people: number;
  /** True when you sit at or above the sampled median. */
  above: boolean;
}

// ── the join, memoised ───────────────────────────────────────────────
//
// `testItemMeta` rebuilds a prompt→dim map over the whole bank on every
// call, and these folds run inside render paths (DifferRows redraws on
// every profile tab switch). Keyed on the bank's own length: the bank is
// replaced wholesale on hydrate and never grows an item at a time, so a
// changed length is the only way its contents can differ within a
// session.
let itemsCache: { key: number; items: TestItemMeta[] } | null = null;
function coreItems(): TestItemMeta[] {
  const bank = LIVE.testFeedItems();
  if (itemsCache && itemsCache.key === bank.length) return itemsCache.items;
  const items = testItemMeta(bank, DEFS);
  itemsCache = { key: bank.length, items };
  return items;
}

// The measured means, memoised on how much of the bank has an aggregate.
//
// `loadSimilarity` tops the test aggregates up once per session, so this
// key moves a handful of times and then stands still. It is an O(bank)
// walk to compute against an O(bank × instruments) fold to skip, which is
// why it keys on coverage rather than on a clock.
let normCache: { key: string; byTest: Record<string, TestNorm> } | null = null;
function aggCoverage(items: readonly TestItemMeta[]): string {
  let withAgg = 0;
  let answers = 0;
  for (const it of items) {
    const agg = LIVE.aggFor(it.qid);
    if (!agg) continue;
    withAgg++;
    answers += Number(agg.total) || 0;
  }
  return `${items.length}:${withAgg}:${answers}`;
}

function measuredNorms(): Record<string, TestNorm> {
  const items = coreItems();
  const key = aggCoverage(items);
  if (normCache && normCache.key === key) return normCache.byTest;
  const byTest: Record<string, TestNorm> = {};
  for (const kind of Object.keys(DEFS)) {
    const def: TestDef | undefined = DEFS[kind];
    if (!def || !def.dims) continue;
    // The world's cells are the aggregate's own top-level counts — the
    // same `cellOf` shape placeProfiles builds per city, with no `by` cut
    // in front of it.
    const axes: AxisScore[] = axisScores(kind, def, items, (qid) => {
      const counts = LIVE.aggFor(qid)?.counts as Record<string, number> | undefined;
      if (!counts) return null;
      return Array.from({ length: 5 }, (_, i) => Number(counts[String(i)]) || 0);
    });
    const avg: Record<string, number> = {};
    const n: Record<string, number> = {};
    for (const a of axes) {
      if (a.n < NORM_MIN_ANSWERS || a.items < NORM_MIN_ITEMS) continue;
      avg[a.dim] = a.value;
      n[a.dim] = a.n;
    }
    byTest[kind] = { avg, n, src: "measured" };
  }
  normCache = { key, byTest };
  return byTest;
}

/**
 * Drop the memos. Not needed in the app: `state.aggs` is emptied on an
 * account switch, so the coverage key moves and the fold re-runs on its
 * own. It exists for tests, which swap the whole store under the module
 * and would otherwise be served a previous case's answer.
 */
export function resetNormCache(): void {
  itemsCache = null;
  normCache = null;
}

/**
 * The population's average on one instrument's axes.
 *
 * In a demo build this is the authored baseline and says so. In a live
 * build it is the measured fold — and `avg` is EMPTY until the floors
 * clear, which is the state a young install is in. An empty map is not a
 * failure and must not be papered over with the constants: the caller
 * draws no reference mark and says the crowd is not there yet.
 */
export function testNorm(testKey: string): TestNorm {
  if (!LIVE.enabled) {
    const avg = AUTHORED[testKey] || {};
    const n: Record<string, number> = {};
    for (const dim of Object.keys(avg)) n[dim] = 0;
    return { avg, n, src: "authored" };
  }
  return measuredNorms()[testKey] || { avg: {}, n: {}, src: "measured" };
}

/** The one-line convenience the old `IS_TEST_AVG[k]` call sites want. */
export function testAvg(testKey: string): Record<string, number> {
  return testNorm(testKey).avg;
}

/** True when this instrument has at least one axis with a real baseline. */
export function hasNorm(testKey: string): boolean {
  return Object.keys(testNorm(testKey).avg).length > 0;
}

// ── the sample: real people with real results ────────────────────────

/**
 * Everyone in the session's cached voter sample who has a readable result
 * on this instrument, as bare axis maps.
 *
 * The D102 bound is the whole basis and callers must state it: this is
 * who the app has fetched for THIS viewer, not a census. The viewer
 * themselves is never in it — `kindredPeople` excludes the signed-in uid
 * — which is what makes a percentile over it a comparison rather than a
 * self-count.
 */
export function sampleAxes(testKey: string): Array<Record<string, number>> {
  if (!LIVE.enabled) return [];
  const out: Array<Record<string, number>> = [];
  for (const p of LIVE.kindredPeople() as KindredPerson[]) {
    const axes = p.results?.[testKey];
    if (axes && Object.keys(axes).length) out.push(axes);
  }
  return out;
}

/**
 * Where you sit on one axis against the sampled people — counted, not
 * modelled.
 *
 * What this replaces: `1 / (1 + exp(-1.702 × (diff / 15)))`, a logistic on
 * an assumed 15-point spread applied to your distance from an authored
 * constant, printed as "higher than 9 in 10 members". Two guesses stacked
 * and a population named.
 *
 * Null below NORM_MIN_PEOPLE. `outOfTen` is clamped to 1..9 because
 * "higher than 0 in 10" and "higher than 10 in 10" are both sentences a
 * sample of forty cannot support.
 */
export function axisRank(testKey: string, dim: string, value: number): AxisRank | null {
  const people = sampleAxes(testKey).filter((a) => typeof a[dim] === "number");
  if (people.length < NORM_MIN_PEOPLE) return null;
  let below = 0;
  for (const a of people) if (a[dim] < value) below++;
  const frac = below / people.length;
  const above = frac >= 0.5;
  // Deciles of the side you are on, so the sentence and the number agree:
  // "higher than 7 in 10" reads off `frac`, "lower than 7 in 10" off its
  // complement. Rounding before choosing a side would let an even split
  // print as "higher than 5 in 10", which says nothing at all.
  const outOfTen = Math.max(1, Math.min(9, Math.round((above ? frac : 1 - frac) * 10)));
  return { outOfTen, people: people.length, above };
}

// ── rarity: how unusual you actually are ─────────────────────────────

/**
 * Axes a rarity reading needs. Same number and same reasoning as
 * MIN_PLACE_AXES: one or two axes is a coin toss dressed as a reading,
 * three is the least that can disagree with itself.
 */
export const RARITY_MIN_AXES = 3;

export interface RarityRead {
  /** Share of the sampled people sitting at least as far out as you, 1..99. */
  pct: number;
  /** People the share was counted over. */
  people: number;
  /** Axes every one of them was measured on — the comparison's own basis. */
  axes: number;
}

/**
 * How many of the sampled people sit at least as far from the average as
 * you do — the dot field on the result banner, counted.
 *
 * What it replaces: `exp(−0.916 · z^2.33)` where `z` was your RMS distance
 * from the authored constants divided by an assumed 15-point scatter. The
 * curve is described in `IS_profileRarity` as "fitted", and it is — to
 * nothing this app has ever measured.
 *
 * Everyone is scored on the SAME axis set (the axes you and the norm both
 * have), and a person missing any of them is left out rather than scored
 * on fewer: an RMS over four axes and an RMS over two are not comparable
 * numbers, and mixing them would make people with thin profiles look
 * systematically average.
 */
export function rarityAmong(
  testKey: string,
  dims: ReadonlyArray<{ id: string; value: number }>,
): RarityRead | null {
  const norm = testNorm(testKey);
  const axes = dims.filter((d) => typeof norm.avg[d.id] === "number");
  if (axes.length < RARITY_MIN_AXES) return null;
  const rms = (get: (id: string) => number | undefined): number | null => {
    let s = 0;
    for (const d of axes) {
      const v = get(d.id);
      if (typeof v !== "number") return null;
      const e = v - norm.avg[d.id];
      s += e * e;
    }
    return Math.sqrt(s / axes.length);
  };
  const mine = rms((id) => dims.find((d) => d.id === id)?.value);
  if (mine == null) return null;
  let out = 0;
  let people = 0;
  for (const a of sampleAxes(testKey)) {
    const theirs = rms((id) => a[id]);
    if (theirs == null) continue;
    people++;
    if (theirs >= mine) out++;
  }
  if (people < NORM_MIN_PEOPLE) return null;
  // Clamped off both ends: "0 in 100" would say nobody in the world is as
  // unusual as you on the strength of forty people, and 100 would say
  // everybody is.
  return { pct: Math.max(1, Math.min(99, Math.round((out / people) * 100))), people, axes: axes.length };
}
