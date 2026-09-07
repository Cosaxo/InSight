// GENERATED from web/catalog-art/*/credits.tsv by
// scripts/build-catalog-art.mjs (any domain's run regenerates every
// domain's entry, via scripts/catalog-art-lib.mjs) — do not hand-edit.
// scripts/check-catalog-art.mjs re-derives this from the committed
// directories and fails CI on any disagreement.
//
// Which catalogue entries have a picture on hosting, by file extension
// (D420). The app asks this BEFORE it asks the network: a tile whose key
// is not here never fires a request that would end in a 404, and a
// domain with no directory draws its generated faces and nothing else.
// Empty until an operator runs the builder — the fetch needs Wikimedia
// Commons and Wikidata, which sandboxed sessions cannot reach (D15's
// reason, one artifact over).
export const CATALOG_ART: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = {
};
