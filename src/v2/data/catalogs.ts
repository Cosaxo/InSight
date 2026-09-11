// catalogs.ts — the QID-keyed catalogues behind the feed's `pick` cards:
// films and music artists (docs/CATALOG-QUESTIONS.md, D15).
//
// The pokedex.ts contract with one structural difference: keys are
// Wikidata QID numeric parts, SPARSE and stable across refreshes, so
// name resolution is a Map rather than an index lookup and there is no
// contiguity to pin — scripts/check-catalogs.mjs pins key/name uniqueness
// and the agreement with the trigger's key sets instead.
//
// Until an operator generates a catalogue (scripts/build-catalog.mjs — it
// needs network access to Wikidata, which sandboxed sessions lack), its
// asset is absent and load() rejects; the picker shows its error state
// and nothing pretends to be data.

import POKEDEX from "./pokedex";
import ELEMENTS_CATALOG from "./elements";

export interface CatalogEntry {
  /** Wikidata QID numeric part (2831 = Q2831) — the stored answer key. */
  key: number;
  name: string;
}

export function parseCatalog(text: string): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.charCodeAt(0) === 35 /* # */) continue;
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const key = Number(line.slice(0, tab));
    const name = line.slice(tab + 1);
    // check-catalogs.mjs makes sure this never fires on a shipped file.
    if (!Number.isInteger(key) || key < 1 || !name) continue;
    out.push({ key, name });
  }
  return out;
}

// Same folding as places.ts/pokedex.ts: search must not demand accents.
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export interface Catalog {
  load(): Promise<CatalogEntry[]>;
  peek(): CatalogEntry[] | null;
  search(entries: CatalogEntry[], q: string, max?: number): CatalogEntry[];
  nameOf(entries: CatalogEntry[], key: number): string | null;
  key(e: CatalogEntry): string;
  NOT_LISTED: number;
}

function makeCatalog(asset: string): Catalog {
  let cache: CatalogEntry[] | null = null;
  let inflight: Promise<CatalogEntry[]> | null = null;
  let names: Map<number, string> = new Map();
  let namesFor: CatalogEntry[] | null = null;
  let foldedFor: CatalogEntry[] | null = null;
  let folded: string[] = [];

  const foldedNames = (entries: CatalogEntry[]): string[] => {
    if (foldedFor !== entries) {
      folded = entries.map((e) => fold(e.name));
      foldedFor = entries;
    }
    return folded;
  };

  return {
    NOT_LISTED: 0,
    load() {
      if (cache) return Promise.resolve(cache);
      if (inflight) return inflight;
      const url = `${import.meta.env.BASE_URL || "/"}${asset}`.replace(/\/{2,}/g, "/");
      inflight = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${asset}: HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => {
          const entries = parseCatalog(text);
          // Zero entries: an index.html fallback, or a catalogue that has
          // not been generated yet — either way, not data.
          if (!entries.length) throw new Error(`${asset} parsed to zero entries`);
          cache = entries;
          return entries;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    peek() {
      return cache;
    },
    // File order is popularity order (the generator ranks by sitelinks),
    // so the empty-query state and tie-breaks read as "most famous first".
    search(entries, q, max = 40) {
      const needle = fold(q.trim());
      if (!needle) return entries.slice(0, max);
      const fn = foldedNames(entries);
      const hits: { e: CatalogEntry; rank: number; at: number }[] = [];
      for (let i = 0; i < entries.length; i++) {
        const idx = fn[i].indexOf(needle);
        if (idx < 0) continue;
        // "godfather" hits "The Godfather" at word-start rank — which is
        // why the rows carry no alias column (the sketch's alias example
        // is exactly this class).
        const rank = idx === 0 ? 0 : fn[i][idx - 1] === " " ? 1 : 2;
        hits.push({ e: entries[i], rank, at: i });
      }
      hits.sort((a, b) => a.rank - b.rank || a.at - b.at);
      return hits.slice(0, max).map((h) => h.e);
    },
    nameOf(entries, key) {
      if (key === 0) return "Not listed";
      if (namesFor !== entries) {
        names = new Map(entries.map((e) => [e.key, e.name]));
        namesFor = entries;
      }
      return names.get(key) ?? null;
    },
    key: (e) => String(e.key),
  };
}

const FILMS = makeCatalog("films.txt");
const ARTISTS = makeCatalog("artists.txt");
// QID-keyed like films/artists (build-catalog.mjs athletes, D308) —
// export-only, like COUNTRIES: its consumers import it.
const ATHLETES = makeCatalog("athletes.txt");
// QID-keyed, films-shaped (build-catalog.mjs videogames, 2026-09-06) —
// export-only, like COUNTRIES: its consumers import it.
const VIDEOGAMES = makeCatalog("videogames.txt");
// Codepoint-keyed (build-emoji.mjs); the display name embeds the character
// ("😂 face with tears of joy"), so no renderer is needed here.
const EMOJI = makeCatalog("emoji.txt");
// ISO-3166-numeric-keyed (build-countries.mjs), alphabetical — there is
// no popularity column in ISO, so the empty-query state reads A→Z rather
// than pretending to a fame ranking the source does not carry.
const COUNTRIES = makeCatalog("countries.txt");
// Minted-key catalogue (build-dogs.mjs), alphabetical initial mint —
// like COUNTRIES, export-only: its consumers import it.
const DOGS = makeCatalog("dogs.txt");
// Hex-derived keys (build-colors.mjs, 1 + parseInt(hex, 16)) — like
// COUNTRIES, export-only: its consumers import it.
const COLORS = makeCatalog("colors.txt");
// Catalogue-minted keys (build-languages.mjs, append-only, the dogs
// discipline; names carry the native name in parens when it differs) —
// like COUNTRIES, export-only: its consumers import it.
const LANGUAGES = makeCatalog("languages.txt");

// There used to be a render-time lookup bridge here — a `declare global`
// Window widening plus `Object.assign(globalThis, { FILMS, ARTISTS, EMOJI })`
// — for the spec layer, in the places.ts form, on the three LEGACY stores.
// Its own comment stated the rule that removed it: COUNTRIES was deliberately
// absent because its consumers import it, "and a publication nothing reads by
// name is exactly what check:globals rule 5 exists to delete". The three
// legacy stores reached that state too — `world-feed.jsx:29` imports all five
// and `ui/pickDomains.ts` imports all nine — so the bridge was writing names
// nobody looked up.
//
// It survived rule 5 for the reason D280 wrote down: the rule asks whether a
// name appears ANYWHERE outside its publisher, and `import { FILMS }` in the
// spec layer satisfies it while reaching nobody. Checked the D280 way before
// deleting — every `FILMS`/`ARTISTS`/`EMOJI` occurrence in the tree is an
// import, a definition, or was this line; there is no `window.X` reader.
export { FILMS, ARTISTS, ATHLETES, VIDEOGAMES, EMOJI, COUNTRIES, DOGS, COLORS, LANGUAGES };

/**
 * A catalogue question's `domain`, resolved far enough to NAME a key.
 *
 * The feed's `pickStore` has been the only resolver since the first
 * catalogue question, and it is a method on a spec-layer component, so
 * nothing typed could reach it — D464 gave the Map a catalogue bead to
 * name, one shelf away from that method. These two functions are that
 * reach: everything the Map needs (the name, and a kick to load the
 * list), and nothing else, so the stores' different entry shapes —
 * `elements` carries an atomic number where the rest carry a key — stay
 * inside the module that knows about them.
 *
 * The pokédex is the default rather than an arm, which is how it shipped:
 * the first catalogue question was a Pokémon one and every later domain
 * was added beside it. `catalogs.test.ts` pins every PICK_QS domain to an
 * arm, which is what stops a real domain landing on that default.
 */
function storeOf(domain: string | null | undefined): {
  NOT_LISTED: number;
  load(): Promise<unknown>;
  name(key: number): string | null;
} {
  const plain = (c: Catalog) => ({
    NOT_LISTED: c.NOT_LISTED,
    load: () => c.load() as Promise<unknown>,
    name: (key: number) => { const l = c.peek(); return l ? c.nameOf(l, key) : null; },
  });
  switch (domain) {
    case "films": return plain(FILMS);
    case "artists": return plain(ARTISTS);
    case "athletes": return plain(ATHLETES);
    case "videogames": return plain(VIDEOGAMES);
    case "emoji": return plain(EMOJI);
    case "countries": return plain(COUNTRIES);
    case "dogs": return plain(DOGS);
    case "colors": return plain(COLORS);
    case "languages": return plain(LANGUAGES);
    case "elements": return {
      NOT_LISTED: ELEMENTS_CATALOG.NOT_LISTED,
      load: () => ELEMENTS_CATALOG.load() as Promise<unknown>,
      name: (key: number) => { const l = ELEMENTS_CATALOG.peek(); return l ? ELEMENTS_CATALOG.nameOf(l, key) : null; },
    };
    default: return {
      NOT_LISTED: POKEDEX.NOT_LISTED,
      load: () => POKEDEX.load() as Promise<unknown>,
      name: (key: number) => { const l = POKEDEX.peek(); return l ? POKEDEX.nameOf(l, key) : null; },
    };
  }
}

/** The entity's display name, or null while its catalogue is unloaded —
 * a caller shows a placeholder rather than the raw key, the feed's own
 * rule (`pickName`). */
export function catalogName(domain: string | null | undefined, key: number): string | null {
  const store = storeOf(domain);
  if (key === store.NOT_LISTED) return "Not listed";
  return store.name(key);
}

/** Kick the domain's list, once — resolves when a name can be had. */
export function loadCatalogNames(domain: string | null | undefined): Promise<void> {
  return storeOf(domain).load().then(() => undefined);
}

