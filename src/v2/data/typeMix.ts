// Types, out in the population (D141 — types tier 1, the v24 type-mix
// design's live fold). A type is already drawn as a mark on the profile;
// here it becomes a property of a POPULATION: who is here, by type, and
// which of them you can actually see.
//
// Honest by construction, the design's rules kept as contract:
//   · every count is out of a STATED basis — the session's cached voter
//     sample (the D102 bound), never a pretend census
//   · absent = zero: a type nobody in the sample carries is named as
//     missing, never drawn as a sliver
//   · a type seen fewer than THIN times is listed with its count, never
//     ranked
//   · the sample and the people with a readable result are different
//     numbers, and the card never blurs them
//
// Tier 1 on purpose (docs/NEXT-FUNCTIONALITY.md §3): everything below is
// arithmetic over data that is already public and already fetched — the
// voter cache and profiles' testResults. No new reads, no new dim, and
// nothing here cross-tabs ANSWERS by type: that is tier 2, a recorded
// decision this module deliberately does not take (D8's surviving half).
import LIVE from "./live";
import type { KindredPerson, ParsedResults } from "./similarity";
// @ts-expect-error TS7016 — untyped spec module (additive exports, D141)
import { ARCHETYPES, matchArchetype } from "../spec/archetype-data.js";

/** The instrument a population reading uses when nobody has chosen one.
 *
 * **This was the enforcement point of a promise until D202, and the change
 * is the whole of that record — read it before touching anything here.**
 * D141 made this constant the single place the fold could be widened
 * ("enforced rather than intended"), and D157 §4 refused to widen it,
 * noting in as many words that it would have been one parameter and
 * accepting the loss of a frequency on three profile sheets as the price.
 * D202 reversed that on the owner's call: every instrument the archetype
 * module defines is now readable as a population, the reader picks which,
 * and `web/privacy.html` says so rather than promising the opposite.
 *
 * What did NOT change, and is a different claim: a test result is still
 * never a **breakdown dim** (D8). No cell is keyed by one, the server
 * still never slices an aggregate by a result, and nothing here puts a
 * result into the anchors snapshot. Widening WHICH result is charted for a
 * population the reader already chose is not the same act as letting the
 * server cut cohorts by it, and D8 is untouched — which is true, and was
 * never the constraint that bound this file. */
export const TYPE_TEST = "big5";

/** Every instrument a population can be read through, in switch order,
 * with the label the chip row prints. Drawn from `IS_ARCHETYPES`' own
 * keys rather than re-listed, so a fifth system cannot appear in the
 * archetype module and be silently missing here. `logic` is deliberately
 * absent upstream — a verified score, not an axis profile (D57). */
export const TYPE_SYSTEMS: { kind: string; label: string }[] = [
  { kind: "big5", label: "Personality" },
  { kind: "political", label: "Politics" },
  { kind: "values", label: "Values" },
  { kind: "attachment", label: "Social" },
];

/** Whether a key is one this fold will read. An unknown key falls back to
 * the default rather than folding an empty system into a card of zeroes. */
export const isTypeSystem = (kind: string): boolean =>
  TYPE_SYSTEMS.some((s) => s.kind === kind);
/** Below this, a count is listed, not ranked. */
export const TYPE_THIN = 8;
/** Below this, a basis has no shares at all — counts only. */
export const TYPE_SMALL = 40;

export interface TypeRow { name: string; n: number }
export interface TypedPerson extends KindredPerson { type: string | null }
export interface TypeMix {
  ranked: TypeRow[];
  thin: TypeRow[];
  absent: TypeRow[];
  counted: number;
  /** Everyone the session's voter cache holds for this scope. */
  sampleN: number;
  /** The subset with a readable Big Five result — the mix's real basis. */
  typedN: number;
  people: TypedPerson[];
}

interface ArchetypeSystem { list: { name: string; line: string }[] }
const systemOf = (kind: string): ArchetypeSystem | null =>
  ((ARCHETYPES as Record<string, ArchetypeSystem | undefined>)[kind]) ?? null;
const system = (kind: string = TYPE_TEST): ArchetypeSystem | null => systemOf(kind);

export const typeNames = (kind: string = TYPE_TEST): string[] =>
  (system(kind)?.list ?? []).map((t) => t.name);
export const typeLine = (name: string, kind: string = TYPE_TEST): string =>
  system(kind)?.list.find((t) => t.name === name)?.line ?? "";

type Dim = { id: string; value: number };
const typeOfDims = (dims: Dim[] | undefined | null, kind: string = TYPE_TEST): string | null => {
  if (!dims || !dims.length) return null;
  const m = matchArchetype(kind, dims) as { list: { name: string }[]; idx: number } | null;
  return m ? m.list[m.idx].name : null;
};

/**
 * A cross-user result, as `parseTestResults` leaves it: kind → dimId →
 * value. `matchArchetype` wants `[{id, value}]`, so the two shapes have to
 * be joined somewhere, and here is the only place that knows both.
 *
 * THIS IS WHERE D141 SHIPPED BROKEN, and the shape is the whole story.
 * `typeOfPerson` read `p.results[TYPE_TEST].dims` — the RAW profile shape
 * that `myType` reads off `LIVE.myTestResults()`, which does carry a
 * `dims` array. But `KindredPerson.results` has been through
 * `parseTestResults`, which flattens the array to an axes map, so `.dims`
 * on it is `undefined` for every person who ever had a result. That fed
 * `matchArchetype(key, undefined)`, which returns null, so `typeOfPerson`
 * returned null UNCONDITIONALLY: `typeMixFor` filtered its whole sample
 * away, `typedN` was always 0, and the type-mix card drew its "nothing
 * typed here" empty state on every population in live mode.
 *
 * Nothing caught it. The module had no test, the two shapes are both
 * `Record`s so the `as Dim[]` cast silenced tsc, and the empty state is
 * indistinguishable from a genuinely thin population — the card was
 * *designed* to say that, so it looked like it was working.
 * Measured with a probe before this fix, not reasoned about.
 */
/**
 * Memoised on the RESULTS OBJECT'S IDENTITY, per instrument.
 *
 * This is a pure function of `(results, kind)` and it is not cheap:
 * `matchArchetype` scores thirteen archetypes over the person's axes with
 * its own allocations each, and `typeOfParsed` builds a fresh `Dim[]` out
 * of `Object.entries` before it can even call in.
 *
 * It is asked the same question about the same person over and over. The
 * People lens types the cached sample; `typeMixFor` types the scoped half
 * of it; `typeSharesOn` types all of it. (A fourth caller, the breakdown
 * sheet's `typeSplitFor`, typed every cached voter on every render until
 * D330 moved that reading to the server.)
 * All of them read `state.scores[uid]`, which `voters.resolveNames` parses
 * once and then holds — so the input is a stable object and the answer
 * cannot have changed while it is.
 *
 * A WeakMap rather than a keyed cache, and identity rather than a rev
 * token: a re-parse produces a NEW object, so a stale entry is
 * unreachable by construction rather than by invalidation, and an entry
 * for a person who has left the cached lists is collectable. The null
 * result is cached too — a person with no result for this instrument is
 * the common case on a young bank, and it is the case that would
 * otherwise re-derive nothing, repeatedly.
 */
const typeMemo = new WeakMap<ParsedResults, Map<string, string | null>>();

export const typeOfParsed = (
  results: ParsedResults | null | undefined,
  kind: string = TYPE_TEST,
): string | null => {
  const axes = results?.[kind];
  if (!axes) return null;
  let byKind = typeMemo.get(results);
  if (!byKind) {
    byKind = new Map<string, string | null>();
    typeMemo.set(results, byKind);
  }
  const hit = byKind.get(kind);
  if (hit !== undefined) return hit;
  const val = typeOfDims(Object.entries(axes).map(([id, value]) => ({ id, value })), kind);
  byKind.set(kind, val);
  return val;
};

export const typeOfPerson = (p: KindredPerson): string | null => typeOfParsed(p.results);

/** Your own type, from your Big Five result — null until the passive fold
 * has published one (the card then says so instead of inventing one). */
export function myType(): string | null {
  return myTypeOn(TYPE_TEST);
}

/** The same, on any instrument the archetype module defines. */
export function myTypeOn(kind: string): string | null {
  const r = (LIVE.myTestResults() as Record<string, { dims?: Dim[] } | undefined>)[kind];
  return typeOfDims(r?.dims, kind);
}

const inScope = (p: KindredPerson, scope: string): boolean => {
  if (scope === "world") return true;
  const a = LIVE.anchors() || {};
  if (scope === "city") return !!a.city && p.city === a.city;
  // "Oslo, NO" → the ISO suffix is the country cut, the same parse the
  // similarity fold uses on the by-cells.
  const cc = a.country;
  return !!cc && p.city.endsWith(`, ${cc}`);
}

/** The whole reading for one scope, in one pass over the cached sample.
 *
 * `kind` is the instrument being charted (D202). It changes nothing about
 * WHICH people are counted — the scope does that — only which result each
 * of them is typed against, so `sampleN` is identical across systems and
 * `typedN` is not: coverage differs by how far each person has got through
 * the round-robined test feed, which is why the thin and small states are
 * computed per instrument rather than once. */
export function typeMixFor(
  scope: "city" | "country" | "world",
  kind: string = TYPE_TEST,
): TypeMix {
  const sys = isTypeSystem(kind) ? kind : TYPE_TEST;
  const sample = (LIVE.kindredPeople() as KindredPerson[]).filter((p) => inScope(p, scope));
  const people: TypedPerson[] = sample
    .map((p) => ({ ...p, type: typeOfParsed(p.results, sys) }))
    .filter((p) => p.type != null)
    // Likeness order, the People lens's own: most-agreeing first.
    .sort((a, b) => (b.like?.pct ?? 0) - (a.like?.pct ?? 0));
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.type as string, (counts.get(p.type as string) ?? 0) + 1);
  const rows: TypeRow[] = typeNames(sys).map((name) => ({ name, n: counts.get(name) ?? 0 }));
  return {
    ranked: rows.filter((r) => r.n >= TYPE_THIN).sort((a, b) => b.n - a.n),
    thin: rows.filter((r) => r.n > 0 && r.n < TYPE_THIN).sort((a, b) => b.n - a.n),
    absent: rows.filter((r) => r.n === 0),
    counted: people.length,
    sampleN: sample.length,
    typedN: people.length,
    people,
  };
}

// ── how common a type actually is (D157) ─────────────────────────────
//
// The profile's type-index sheet ("The 13 types", headed `bar = how
// common`) drew `IS_ARCHETYPES[test].list[].share` — hand-authored
// percentages whose own comment calls them "realistic … common types big,
// rare ones genuinely rare". A reader has no way to tell that from a
// measurement, and the sheet is two taps from a result card that says
// which one is theirs.
//
// So the sheet reads this instead: the same sample `typeMixFor` folds,
// typed against whichever instrument is on screen. Rows come back for
// EVERY type the system defines, zeroes included — a type nobody in the
// sample carries is a measured zero, and dropping it would let a thin
// sample look like a complete map of the population. Ranking by `n` is
// the caller's, and so is drawing the zeroes; this returns the counts.
//
// The authored `share` stays where it is and keeps its OTHER job: the
// commonness prior in `IS_archScores` (rule 3), which taxes rare types on
// a near-tie. That is a model constant, not a claim on a screen, and
// swapping it for a live sample would make which type you ARE drift with
// whoever the app happened to fetch this session.
//
// THE SCOPE WIDENED AT D202, having been refused at D157 §4. The sheet
// renders for all four instruments and this now measures all four, so the
// three that showed no frequency at all get a real one instead of a blank.
//
// D157 §4 called that widening "one parameter" and declined it, on the
// ground that the politics result is Art. 9 data and no population reading
// should be computed from it. The owner reversed it. The argument that
// carried: every input here already publishes under D98, `voters.ts`
// already parses all four instruments into the same session cache, and
// `data/compare.ts` and the City constellation already show a NAMED
// person's politics axes beside yours (D112/D193) — so an aggregate over
// people is strictly less identifying than the per-person view that has
// been shipping for months. What the reversal costs is a promise, and the
// promise was rewritten rather than quietly dropped: `web/privacy.html`
// now describes this reading instead of denying it, and
// `check:policy-claims` pins both the new sentence and the absence of the
// old one.
//
// One thing the reversal did not license: **the numbers must be measured**.
// The v28 prototype derives its non-Big-Five mixes from authored per-type
// shares with a per-population wobble, which is exactly the class D157
// removed and D167 forbids. Every row below is a count of real typed
// people or it is not drawn.

export interface TypeShare { name: string; n: number; pct: number }
export interface TypeShares {
  rows: TypeShare[];
  /** People in the sample with a readable result on this instrument. */
  typedN: number;
  /** Everyone the sample holds, typed or not — the honest denominator gap. */
  sampleN: number;
}

/**
 * Measured type frequencies, or null in a demo build — where the authored
 * share IS the content, like the seeded circle.
 *
 * Since D202 this answers for every instrument in `TYPE_SYSTEMS`, not only
 * `TYPE_TEST`. It still returns null for a key the archetype module does
 * not define, and still returns null rather than a fallback when the fold
 * cannot be done — the D72 posture, so a caller that forgets the check
 * fails a test instead of quietly fabricating.
 */
export function typeSharesOn(kind: string): TypeShares | null {
  if (!LIVE.enabled || !isTypeSystem(kind)) return null;
  const names = (systemOf(kind)?.list ?? []).map((t) => t.name);
  if (!names.length) return null;
  const sample = LIVE.kindredPeople() as KindredPerson[];
  const counts = new Map<string, number>();
  let typedN = 0;
  for (const p of sample) {
    const name = typeOfParsed(p.results, kind);
    if (!name) continue;
    typedN++;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    rows: names.map((name) => ({
      name,
      n: counts.get(name) ?? 0,
      pct: typedN ? Math.round(((counts.get(name) ?? 0) / typedN) * 100) : 0,
    })),
    typedN,
    sampleN: sample.length,
  };
}
