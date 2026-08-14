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
 * profile only, deliberately. */
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
const system = (): ArchetypeSystem | null =>
  ((ARCHETYPES as Record<string, ArchetypeSystem | undefined>)[TYPE_TEST]) ?? null;

export const typeNames = (): string[] => (system()?.list ?? []).map((t) => t.name);
export const typeLine = (name: string): string =>
  system()?.list.find((t) => t.name === name)?.line ?? "";

type Dim = { id: string; value: number };
const typeOfDims = (dims: Dim[] | undefined | null): string | null => {
  if (!dims || !dims.length) return null;
  const m = matchArchetype(TYPE_TEST, dims) as { list: { name: string }[]; idx: number } | null;
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
export const typeOfParsed = (results: ParsedResults | null | undefined): string | null => {
  const axes = results?.[TYPE_TEST];
  if (!axes) return null;
  return typeOfDims(Object.entries(axes).map(([id, value]) => ({ id, value })));
};

export const typeOfPerson = (p: KindredPerson): string | null => typeOfParsed(p.results);

/** Your own type, from your Big Five result — null until the passive fold
 * has published one (the card then says so instead of inventing one). */
export function myType(): string | null {
  const r = (LIVE.myTestResults() as Record<string, { dims?: Dim[] } | undefined>)[TYPE_TEST];
  return typeOfDims(r?.dims);
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
