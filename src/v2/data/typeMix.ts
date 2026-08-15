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

/** The one instrument types read from in tier 1. The Big Five archetypes
 * are the app's least charged system; the politics types stay on the
 * profile only, deliberately.
 *
 * It is also the ENFORCEMENT of the scope docs/data-inventory.md promises
 * and `ui/LivePrivacyPanel` prints: no population reading of any kind is
 * computed from the politics, values or attachment result. D157 pointed a
 * second surface at this fold (the profile's type index) and did not
 * widen it — see `typeSharesOn`. */
export const TYPE_TEST = "big5";
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
const system = (): ArchetypeSystem | null => systemOf(TYPE_TEST);

export const typeNames = (): string[] => (system()?.list ?? []).map((t) => t.name);
export const typeLine = (name: string): string =>
  system()?.list.find((t) => t.name === name)?.line ?? "";

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
export const typeOfParsed = (
  results: ParsedResults | null | undefined,
  kind: string = TYPE_TEST,
): string | null => {
  const axes = results?.[kind];
  if (!axes) return null;
  return typeOfDims(Object.entries(axes).map(([id, value]) => ({ id, value })), kind);
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

/** The whole reading for one scope, in one pass over the cached sample. */
export function typeMixFor(scope: "city" | "country" | "world"): TypeMix {
  const sample = (LIVE.kindredPeople() as KindredPerson[]).filter((p) => inScope(p, scope));
  const people: TypedPerson[] = sample
    .map((p) => ({ ...p, type: typeOfPerson(p) }))
    .filter((p) => p.type != null)
    // Likeness order, the People lens's own: most-agreeing first.
    .sort((a, b) => (b.like?.pct ?? 0) - (a.like?.pct ?? 0));
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.type as string, (counts.get(p.type as string) ?? 0) + 1);
  const rows: TypeRow[] = typeNames().map((name) => ({ name, n: counts.get(name) ?? 0 }));
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
// THE SCOPE DOES NOT WIDEN. The sheet renders for all four instruments,
// and it would have been one parameter to type the sample against each of
// them — which is exactly the line docs/data-inventory.md draws and
// `LivePrivacyPanel` prints: the politics result is Art. 9 data and no
// population reading is computed from it, nor from the other two that
// travel with it in that promise. So the other three instruments show no
// frequency at all in a live build rather than a measured one. That is a
// loss of a number, and the alternative was keeping a fabricated one to
// avoid noticing.

export interface TypeShare { name: string; n: number; pct: number }
export interface TypeShares {
  rows: TypeShare[];
  /** People in the sample with a readable result on this instrument. */
  typedN: number;
  /** Everyone the sample holds, typed or not — the honest denominator gap. */
  sampleN: number;
}

/**
 * Measured type frequencies, or null — in a demo build (where the
 * authored share IS the content, like the seeded circle), and on every
 * instrument but TYPE_TEST (see above).
 */
export function typeSharesOn(kind: string): TypeShares | null {
  if (!LIVE.enabled || kind !== TYPE_TEST) return null;
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
