// catalogArt.ts — where a pick tile's picture is, and whose it is (D420,
// docs/CATALOG-QUESTIONS.md § Entity images).
//
// THE PICTURE IS A COMMITTED FILE ON OUR OWN HOSTING, never a hotlink:
// web/catalog-art/<domain>/<key>.<ext>, put there by an operator running
// scripts/build-catalog-art.mjs and served from SITE_ORIGIN. Three things
// follow from that and are the reason this module is small:
//   · the URL is built, not stored — a stored URL could name a host we do
//     not control, which would leak every viewer's IP to it and let the
//     picture change after it was reported (avatar.ts's third property);
//   · the app asks the generated index BEFORE it asks the network — a key
//     that is not in CATALOG_ART never fires a request, so a domain with
//     no pictures costs nothing and a half-pictured one costs no 404s;
//   · a takedown is a deleted file and a hosting deploy. The device that
//     still holds the picture drops it within Cache-Control's hour, and
//     PickArt's onError turns a 404 back into the generated face.
//
// The credits are the licence's condition — CC BY's one clause is that
// the author and the licence are shown — and they ride beside the
// pictures as credits.tsv, fetched only when someone opens the credits
// sheet (PickCredits). Session-cached; a failed fetch is forgotten so the
// next open retries rather than remembering an outage.
import { SITE_ORIGIN } from "./siteOrigin";
import { CATALOG_ART } from "./catalogArtIndex";

/** The path under hosting, mirrored by scripts/catalog-art-lib.mjs's ART_DIR. */
export const ART_PATH = "catalog-art";

/**
 * One notice per RULED source — a source the owner's take-down-on-complaint
 * ruling admits by name rather than a licence (D420 for TMDB, D421 for
 * PokéAPI). Keyed by the tag the credits row carries in its licence
 * column; scripts/catalog-art-lib.mjs's RULED_SOURCE_TAGS is the same
 * list, pinned to this one by test. TMDB's sentence is what their terms
 * ask for verbatim; the Pokémon line names the rights-holders the
 * artwork belongs to, which is the honest credit for a picture we hold
 * under a policy rather than a licence.
 */
export const SOURCE_NOTICES: Readonly<Record<string, string>> = {
  TMDB: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  PokeAPI: "Pokémon artwork © Nintendo, Creatures Inc. and GAME FREAK inc., via PokéAPI.",
};
export const TMDB_NOTICE = SOURCE_NOTICES.TMDB;
/** The free-content route's header line. */
export const COMMONS_NOTICE = "Photographs from Wikimedia Commons, each under the licence beside it.";

/** Does this domain have any picture at all? The browse row's and the
 *  credits door's first question. */
export function hasCatalogArt(domain: string): boolean {
  const d = CATALOG_ART[domain];
  return !!d && Object.values(d).some((keys) => keys.length > 0);
}

const extCache = new Map<string, Map<number, string>>();
function extFor(domain: string, key: number): string {
  const d = CATALOG_ART[domain];
  if (!d) return "";
  let m = extCache.get(domain);
  if (!m) {
    m = new Map();
    for (const [ext, keys] of Object.entries(d)) for (const k of keys) m.set(k, ext);
    extCache.set(domain, m);
  }
  return m.get(key) || "";
}

/** The picture's URL on our hosting, or "" when the entry has none. */
export function catalogArtUrl(domain: string, key: number): string {
  const ext = extFor(domain, key);
  return ext ? `${SITE_ORIGIN}/${ART_PATH}/${encodeURIComponent(domain)}/${key}.${ext}` : "";
}

export interface CatalogCredit {
  key: number;
  file: string;
  name: string;
  author: string;
  licence: string;
  source: string;
}

/** The credits manifest's rows — the same six columns the builder writes.
 *  A row that is not six fields is skipped, not guessed at. */
export function parseCatalogCredits(text: string): CatalogCredit[] {
  const out: CatalogCredit[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.charCodeAt(0) === 35 /* # */) continue;
    const f = line.split("\t");
    if (f.length !== 6) continue;
    const key = Number(f[0]);
    if (!Number.isInteger(key) || key < 1) continue;
    out.push({ key, file: f[1], name: f[2], author: f[3], licence: f[4], source: f[5] });
  }
  return out;
}

const creditCache = new Map<string, Promise<CatalogCredit[]>>();

export function loadCatalogCredits(domain: string): Promise<CatalogCredit[]> {
  if (!hasCatalogArt(domain)) return Promise.resolve([]);
  let p = creditCache.get(domain);
  if (!p) {
    p = fetch(`${SITE_ORIGIN}/${ART_PATH}/${encodeURIComponent(domain)}/credits.tsv`)
      .then((r) => {
        if (!r.ok) throw new Error(`credits: HTTP ${r.status}`);
        return r.text();
      })
      .then(parseCatalogCredits);
    // Forget a failure so the next open retries; the rejection itself
    // still reaches the caller.
    p.catch(() => { if (creditCache.get(domain) === p) creditCache.delete(domain); });
    creditCache.set(domain, p);
  }
  return p;
}

/** Tests only: the two caches above outlive a mocked index or fetch. */
export function resetCatalogArtForTests(): void {
  extCache.clear();
  creditCache.clear();
}
