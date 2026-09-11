// The whole-world People map: one published position per person (D458).
//
// WHAT THIS IS FOR. The People lens places a stranger from the answers
// you and they have BOTH given — the twelve bounded voter samples the
// device fetches. That works, and it thins by construction: as the bank
// grows, two random people share fewer questions, so the crowd the lens
// can draw shrinks toward the people who happened to answer your cards.
// `PEOPLE-MAP.md` §7 deferred the fix on four grounds and the owner ruled
// on the ask 2026-09-10 (*"i dont see why thats a privacy concern"*).
//
// The fix is to publish what the fit already computes: every person has a
// vector in the same space the rows live in, so a position solved from it
// places them whether or not they overlap with the viewer. What is
// published is the COARSENED form the owner-list row named — two rounded
// numbers and the person's answer count, keyed by uid — never the vector,
// never an answer. The three deferral grounds that were about the shape
// are answered here; the fourth, rotation, is answered by the publication
// path itself (see `worldPositions`' comment in patterns.ts).
//
// This module is pure: bucketing, the caps, and the rounding. The solve
// and the write live in patterns.ts, beside the fit whose rows they read.
import type { AlsModel, AlsRow, ItemMeta } from "./patternsAls";

/** Rows kept per document. The cap is a DRAWING bound, not a privacy one:
 * a disc of 352 px holds a few hundred dots before it is ink, the Map's
 * own budget is 300, and a document of every account would be a megabyte
 * on a lens a phone opens with a tap. What it costs is stated rather than
 * hidden — `total` below is the population the rows were drawn from, and
 * the lens says "600 of 18,400". */
export const WORLD_MAP_CAP = 600;

/** Two decimals. The position is a unit vector's first two components, so
 * the grid is 201 × 201 over the disc — about 1.5 px at the lens's own
 * radius, which is a place on a picture. Rounding is what makes the
 * published number a POSITION rather than the vector it came from: the
 * 8-dimensional original is what the rules still deny. */
export const WORLD_MAP_ROUND = 100;

/** Answers a person needs before a position is published for them. The
 * ridge solve is 8-dimensional; below this the vector is mostly the
 * prior, and a dot drawn from it says more about the ridge than about the
 * person. Same reasoning as `patternsReady`'s own eight. */
export const WORLD_MAP_MIN_ANSWERS = 8;

/** The document every stop that is not a country reads. */
export const WORLD_MAP_ID = "people-world";
/** One document per country, named by the frozen `country` anchor — which
 * is the two-letter code the cube counts (`pure.ts`'s own pattern), not a
 * country's name, so the id needs no catalogue and cannot collide with the
 * `sample-` or `city-` families. */
export const worldMapId = (country: string): string => `people-${encodeURIComponent(country)}`;

/** A published row: where the person sits, and how many questions they
 * have answered. No answers, no chips, no name — the lens resolves names
 * the way it already does, through the voter lists. */
export interface WorldMapRow {
  x: number;
  y: number;
  n: number;
}

export interface WorldMapDoc {
  /** The document's own id, so a reader never parses it back out. */
  id: string;
  /** The country these rows are of; absent on the world document. */
  country?: string;
  rows: Record<string, WorldMapRow>;
  /** Rows kept — what `deleteAccount` decrements, as on a voter sample. */
  n: number;
  /** People the rows were drawn FROM. The lens states it: a picture of
   * 600 of 18,400 is a picture of 600, and saying so is D146's rule
   * pointed at a crowd instead of at a pair. */
  total: number;
  /** The UTC day the positions were solved. */
  day: string;
}

/** One person, solved. `country` absent is a person whose answers carried
 * no country chip — placed on the world map, in no country's own. */
export interface WorldPerson {
  uid: string;
  x: number;
  y: number;
  n: number;
  country?: string;
}

/** Round to the published grid. `-0` is normalised to `0`: JSON keeps the
 * sign, and two documents that differ only there would compare unequal
 * for no reason a reader could see. */
export const roundPos = (v: number): number => {
  const r = Math.round(v * WORLD_MAP_ROUND) / WORLD_MAP_ROUND;
  return r === 0 ? 0 : r;
};

/** The model and the item metadata a position is solved against: the
 * PUBLISHED rows, whichever engine owns them tonight.
 *
 * The ALS engine publishes its item metadata, so the anchor and pick rows
 * (D454, D455) are solvable and a person's demographics count toward
 * where they stand — exactly as they do in the device's own fold. The
 * online engine publishes bin rows keyed by qid and no metadata, so the
 * items are synthesised here, which is what the device does with the same
 * rows (`data/patterns.ts`'s pool). Either way the person is solved
 * against the rows the phone is about to draw, which is the whole point:
 * a position in another frame is a dot in the wrong place.
 */
export function positionModel(
  k: number,
  rows: Record<string, { v: number[]; n: number; sum: number; sd?: number }>,
  items: Record<string, ItemMeta> | undefined,
): AlsModel {
  const copy: Record<string, AlsRow> = {};
  for (const [key, r] of Object.entries(rows)) copy[key] = { ...r, v: [...r.v] };
  if (items) return { k, rows: copy, items: { ...items } };
  const bin: Record<string, ItemMeta> = {};
  for (const key of Object.keys(copy)) bin[key] = { kind: "bin", qid: key, nOptions: 2 };
  return { k, rows: copy, items: bin };
}

/**
 * The documents, from the people as they stream past.
 *
 * Bounded as it goes rather than at the end: a country's list never grows
 * past twice the cap before it is trimmed, so the pass holds countries ×
 * cap rows at worst instead of the whole population. The nightly fit is
 * the memory-shortest thing in this codebase (the streamed solve exists
 * for that reason), and a builder that buffered every account would put
 * back exactly what that bought.
 *
 * WHO IS KEPT, said plainly because a cap is a selection: the people with
 * the most answers, ties by uid. They are the ones the fit knows best —
 * the position of someone with nine answers is mostly the prior — and the
 * rule is fixed rather than random so two nights running on the same
 * population draw the same picture.
 *
 * THE WORLD DOCUMENT IS A ROUND-ROBIN over the countries, not the global
 * top: taking the 600 most-answered accounts would draw whichever country
 * signed up first and call it the world. Countries take turns, in name
 * order, each offering its next-best — so a country of nine is on the
 * world map, and a country of ninety thousand does not fill it.
 */
export class WorldMapBuilder {
  private readonly byCountry = new Map<string, WorldPerson[]>();
  private readonly totals = new Map<string, number>();
  private world = 0;

  constructor(private readonly cap: number = WORLD_MAP_CAP) {}

  add(person: WorldPerson): void {
    const key = person.country ?? "";
    const list = this.byCountry.get(key) ?? [];
    list.push(person);
    this.byCountry.set(key, list);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
    this.world += 1;
    if (list.length > this.cap * 2) this.byCountry.set(key, trim(list, this.cap));
  }

  docs(day: string): Map<string, WorldMapDoc> {
    const out = new Map<string, WorldMapDoc>();
    const kept = new Map<string, WorldPerson[]>();
    for (const [country, list] of this.byCountry) kept.set(country, trim(list, this.cap));
    for (const [country, list] of kept) {
      if (!country) continue; // no chip: on the world map, in nobody's country
      out.set(worldMapId(country), {
        id: worldMapId(country),
        country,
        rows: rowsOf(list),
        n: list.length,
        total: this.totals.get(country) ?? list.length,
        day,
      });
    }
    // the world's own, a turn each
    const queues = [...kept.keys()].sort().map((c) => kept.get(c) as WorldPerson[]);
    const picked: WorldPerson[] = [];
    for (let round = 0; picked.length < this.cap; round++) {
      let any = false;
      for (const q of queues) {
        if (round >= q.length) continue;
        any = true;
        picked.push(q[round]);
        if (picked.length >= this.cap) break;
      }
      if (!any) break;
    }
    out.set(WORLD_MAP_ID, {
      id: WORLD_MAP_ID,
      rows: rowsOf(picked),
      n: picked.length,
      total: this.world,
      day,
    });
    return out;
  }
}

const trim = (list: WorldPerson[], cap: number): WorldPerson[] =>
  [...list].sort((a, b) => b.n - a.n || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)).slice(0, cap);

const rowsOf = (list: readonly WorldPerson[]): Record<string, WorldMapRow> => {
  const rows: Record<string, WorldMapRow> = {};
  for (const p of list) rows[p.uid] = { x: p.x, y: p.y, n: p.n };
  return rows;
};
