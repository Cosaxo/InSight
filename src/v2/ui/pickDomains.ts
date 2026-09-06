// pickDomains.ts — the pick card's catalogues, one table for both of its
// doors (docs/CATALOG-QUESTIONS.md). `PickSearch` searches it; the browse
// row (`PickTiles`, through world-feed.jsx's renderPick) reads it in file
// order through `pickHead`/`pickLoad`. Its own module rather than a pair
// of exports on the component, because a file that exports a component
// exports only components (react-refresh's rule), and because the table
// is data: every per-domain difference — the store, the copy, the row's
// shape — lives here, and the two consumers agree by construction on
// which catalogue a domain string names.
//
// One table, every shipped catalogue (pokemon, films and artists first,
// D15; the rest as each domain was committed). The per-domain
// differences are the store and the copy: the Pokédex is a closed set
// ("every species is in here"), the QID catalogues are curated tops where
// "not listed" is the expected answer for the long tail.
import POKEDEX, { type Species } from "../data/pokedex";
import ELEMENTS_CATALOG, { type Element } from "../data/elements";
import { FILMS, ARTISTS, ATHLETES, VIDEOGAMES, EMOJI, COUNTRIES, DOGS, COLORS, LANGUAGES, type CatalogEntry } from "../data/catalogs";

export type Row = { id: number; name: string; tag?: string };

export type DomainSpec = {
  load: () => Promise<Row[]>;
  peek: () => Row[] | null;
  search: (q: string, max: number) => Row[];
  placeholder: string;
  hint: string;
  noMatch: string;
};

const speciesRow = (s: Species): Row => ({ id: s.dex, name: s.name, tag: `#${s.dex}` });
// The tag is the atomic number — the same "the key is a fact worth showing"
// call as the dex tag, and for elements the fact doubles as chemistry.
const elementRow = (e: Element): Row => ({ id: e.z, name: e.name, tag: `#${e.z}` });
const entryRow = (e: CatalogEntry): Row => ({ id: e.key, name: e.name });

// The store's parsed list as rows, mapped ONCE per list. `peek` used to map
// on every call, which was fine while its one caller was this component's
// first render — the browse row (pickHead below) reads it on every render
// of every unanswered pick card in the feed, and the emoji catalogue is
// 1,391 rows. The store's array is the identity: it is set once when the
// fetch lands and never replaced, so a cached map keyed on it is exact.
function memoRows<E>(peekRaw: () => E[] | null, toRow: (e: E) => Row): () => Row[] | null {
  let src: E[] | null = null;
  let rows: Row[] | null = null;
  return () => {
    const es = peekRaw();
    if (!es) return null;
    if (es !== src) { src = es; rows = es.map(toRow); }
    return rows;
  };
}

function catalogSpec(
  store: typeof FILMS,
  placeholder: string,
  hint: string,
): DomainSpec {
  const peek = memoRows(() => store.peek(), entryRow);
  return {
    load: () => store.load().then(() => peek() || []),
    peek,
    search: (q, max) => {
      const es = store.peek();
      return es ? store.search(es, q, max).map(entryRow) : [];
    },
    placeholder,
    hint,
    // Curated top, not a census — the honest miss is "not listed".
    noMatch:
      "No match — this is a curated top list. “Not listed” is a real answer.",
  };
}

export const DOMAINS: Record<string, DomainSpec> = {
  pokemon: {
    load: () => POKEDEX.load().then(() => DOMAINS.pokemon.peek() || []),
    peek: memoRows(() => POKEDEX.peek(), speciesRow),
    search: (q, max) => {
      const ss = POKEDEX.peek();
      return ss ? POKEDEX.search(ss, q, max).map(speciesRow) : [];
    },
    placeholder: "Search the Pokédex…",
    hint: "one pick from 1,025 — the crowd's canon reveals after",
    noMatch:
      "No match — every species is in here, so check the spelling.",
  },
  films: catalogSpec(FILMS, "Search films…", "one favourite — the crowd's canon reveals after"),
  artists: catalogSpec(ARTISTS, "Search artists…", "one favourite — the crowd's canon reveals after"),
  athletes: catalogSpec(ATHLETES, "Search 640 athletes…", "one pick — the crowd's canon reveals after"),
  videogames: catalogSpec(VIDEOGAMES, "Search 1,000 video games…", "one pick — the crowd's canon reveals after"),
  elements: {
    load: () => ELEMENTS_CATALOG.load().then(() => DOMAINS.elements.peek() || []),
    peek: memoRows(() => ELEMENTS_CATALOG.peek(), elementRow),
    search: (q, max) => {
      const es = ELEMENTS_CATALOG.peek();
      return es ? ELEMENTS_CATALOG.search(es, q, max).map(elementRow) : [];
    },
    placeholder: "Search the periodic table…",
    hint: "one pick from 118 — the crowd's canon reveals after",
    // A closed set, and a small one: name or symbol both search
    // ("gold" and "au" find the same row).
    noMatch:
      "No match — all 118 are in here, by name or symbol (“gold”, “Au”).",
  },
  emoji: {
    ...catalogSpec(EMOJI, "Search emoji…", "one pick from 1,391 — the crowd's canon reveals after"),
    // A closed set, unlike the curated tops: every base emoji is here.
    // Sequences are not — tones and combos count as their base, and a
    // ZWJ-combo devotee's honest answer is Not listed.
    noMatch:
      "No match — try the word for it (“fire”, “skull”). Tones and combos count as their base.",
  },
  dogs: {
    ...catalogSpec(DOGS, "Search dog breeds…", "one pick from 554 — the crowd's canon reveals after"),
    // A wide net rather than a curated top: most of the world's named
    // breeds are here, so a miss is usually spelling — but crosses and
    // mutts are real dogs with no row, and theirs is the honest miss.
    noMatch:
      "No match — try the common name. Crosses and mixes count as “Not listed”.",
  },
  colors: {
    ...catalogSpec(COLORS, "Search colours…", "one pick from 139 — the crowd's canon reveals after"),
    // The CSS spec's named colours, alias-deduped (aqua stands for cyan,
    // gray for grey) — so a miss is often the alias spelling, and every
    // colour outside the spec's 139 names is honestly "Not listed".
    noMatch:
      "No match — these are the CSS names (try “aqua”, “gray”). Anything unnamed counts as “Not listed”.",
  },
  languages: {
    ...catalogSpec(LANGUAGES, "Search languages…", "one pick from 183 — the crowd's canon reveals after"),
    // The ISO 639-1 set, so each entry is a language family's headline
    // name; rows carry the native name too ("French (français)"), and a
    // search in either script resolves. Dialects and languages outside
    // the 183 are honestly "Not listed".
    noMatch:
      "No match — try the English or native name. Anything beyond the ISO 183 counts as “Not listed”.",
  },
  countries: {
    ...catalogSpec(COUNTRIES, "Search countries…", "one pick from 250 — the crowd's canon reveals after"),
    // A closed set: the full ISO 3166-1 list, territories included, so
    // the honest miss is a spelling rather than an absence. English
    // names ("Germany", not "Deutschland"); accents fold in search.
    noMatch:
      "No match — every ISO country and territory is here, under its English name.",
  },
};

// The browse row's two reads (world-feed.jsx's renderPick, D308 → D389):
// the catalogue as rows in the FILE'S OWN ORDER, and the one fetch that
// fills it — the same fetch the search pays on open, so a card that offers
// tiles costs no read the picker would not. The rows here are what the
// search itself would list for an empty query, tags included, which is how
// a Pokémon tile can say "#25" and an element tile "#79": for the keyed
// catalogues the order is the source's own and the tag is what makes that
// order legible at a glance.
export function pickHead(domain: string): Row[] | null {
  const spec = DOMAINS[domain];
  return spec ? spec.peek() : null;
}
export function pickLoad(domain: string): Promise<Row[]> {
  const spec = DOMAINS[domain];
  return spec ? spec.load() : Promise.reject(new Error(`pickLoad: no catalogue for ${domain}`));
}
