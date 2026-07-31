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
// Codepoint-keyed (build-emoji.mjs); the display name embeds the character
// ("😂 face with tears of joy"), so no renderer is needed here.
const EMOJI = makeCatalog("emoji.txt");

declare global {
  interface Window {
    FILMS?: Catalog;
    ARTISTS?: Catalog;
    EMOJI?: Catalog;
  }
}

// Render-time lookup bridge for the spec layer (world-feed.jsx), the
// places.ts Object.assign form.
Object.assign(globalThis, { FILMS, ARTISTS, EMOJI });

export { FILMS, ARTISTS, EMOJI };
