// Generates public/films.txt or public/artists.txt — the curated catalogues
// behind the feed's `pick` cards (docs/CATALOG-QUESTIONS.md, D15) — and
// regenerates functions/src/catalogKeys.ts from whatever catalogue files
// exist afterwards, so the trigger's key sets can never drift from the
// files clients ship (scripts/check-catalogs.mjs enforces the agreement).
//
//   node scripts/build-catalog.mjs films
//   node scripts/build-catalog.mjs artists
//
// AN OPERATOR STEP, NOT A CI STEP. This fetches from Wikidata's public
// SPARQL endpoint (CC0 data), which sandboxed CI runners and remote dev
// sessions may not reach — the 2026-07-30 session that built this could
// not, which is why the machinery and the data land separately (D15). Run
// it from any machine with network access and commit the result; the
// committed files are what CI validates, the endpoint is never needed
// again until the next refresh.
//
// WHY QID-NUMERIC KEYS: the stored answer is the entry's key, and keys
// must survive a refresh — a catalogue is curated by POPULARITY, so ranks
// reorder constantly, and rank-derived keys would silently repoint every
// stored favourite. Wikidata QIDs are stable external identifiers; the
// numeric part keeps the whole answer domain one integer, like the dex
// numbers (0 stays "Not listed" everywhere).
//
// WHY sitelink-ranked: sitelink count (how many language Wikipedias carry
// the article) is the least gameable popularity proxy Wikidata itself
// stores — no third-party ratings feed, no API key, and it favours
// era-spanning fame over this week's chart.
import { writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { regenerateCatalogKeys } from "./catalog-keys-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://query.wikidata.org/sparql";
const TOP_N = 1000;

// A generous floor keeps the result set small enough for the label
// service; the top-N cut happens locally.
const DOMAINS = {
  films: {
    out: "films.txt",
    what: "films",
    // Every film (P31 Q11424) — documentaries and shorts included; the
    // sitelink ranking surfaces the famous ones. The publication year
    // (P577) disambiguates remakes ("Hamlet (1948)").
    query: `SELECT DISTINCT ?item ?itemLabel (SAMPLE(YEAR(?pub)) AS ?year) ?links WHERE {
  ?item wdt:P31 wd:Q11424 ; wikibase:sitelinks ?links .
  FILTER(?links >= 40)
  OPTIONAL { ?item wdt:P577 ?pub . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?item ?itemLabel ?links
ORDER BY DESC(?links) LIMIT 2000`,
    label: (b) => {
      const name = b.itemLabel.value;
      const year = b.year && b.year.value;
      return year ? `${name} (${year})` : name;
    },
  },
  artists: {
    out: "artists.txt",
    what: "music artists",
    // Musical groups plus humans whose occupation is musical — singer,
    // musician, singer-songwriter, composer, rapper. Composers belong: a
    // favourite-artist canon that cannot hold Beethoven is curating taste,
    // not measuring it.
    query: `SELECT DISTINCT ?item ?itemLabel ?links WHERE {
  { ?item wdt:P31 wd:Q215380 . }
  UNION
  { ?item wdt:P31 wd:Q5 ; wdt:P106 ?occ .
    VALUES ?occ { wd:Q177220 wd:Q639669 wd:Q488205 wd:Q36834 wd:Q2252262 } }
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= 60)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT 2000`,
    label: (b) => b.itemLabel.value,
  },
};

const domain = process.argv[2];
const spec = DOMAINS[domain];
if (!spec) {
  console.error(`build-catalog: usage: node scripts/build-catalog.mjs <${Object.keys(DOMAINS).join("|")}>`);
  process.exit(1);
}

const qidNum = (uri) => {
  const m = uri.match(/\/Q(\d+)$/);
  return m ? Number(m[1]) : null;
};

let res;
try {
  res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(spec.query)}&format=json`, {
    headers: {
      // Wikidata asks bots to identify themselves; the repo is the contact.
      "User-Agent": "InSight-catalog-builder/1.0 (https://github.com/Cosaxo/InSight)",
      Accept: "application/sparql-results+json",
    },
  });
} catch (e) {
  console.error(
    `build-catalog: cannot reach ${ENDPOINT} — this is an operator step and needs\n` +
      `network access to Wikidata (sandboxed sessions typically do not have it; D15).\n` +
      `Underlying error: ${e && e.message}`,
  );
  process.exit(1);
}
if (!res.ok) {
  console.error(`build-catalog: ${ENDPOINT} answered HTTP ${res.status}`);
  process.exit(1);
}
const bindings = (await res.json()).results.bindings;

// QID-dedupe first (GROUP BY should already guarantee it), then rank.
const byKey = new Map();
for (const b of bindings) {
  const key = qidNum(b.item.value);
  if (key == null || key === 0) continue;
  const links = Number(b.links.value) || 0;
  const name = spec.label(b).trim();
  // A label that is just the QID means "no English label" — not offerable.
  if (!name || new RegExp(`^Q${key}( |$)`).test(name)) continue;
  const prev = byKey.get(key);
  if (!prev || links > prev.links) byKey.set(key, { key, name, links });
}
let rows = [...byKey.values()].sort((a, b) => b.links - a.links || a.key - b.key);

// Same-name entries: keep the most-linked, drop the rest, and say so —
// the build-cities merge stance. Search resolves names, so a duplicate
// name is an ambiguous search result; "curated, not complete" plus the
// "Not listed" bucket make dropping the obscure twin the honest option.
const seenNames = new Map();
const dropped = [];
rows = rows.filter((r) => {
  const k = r.name.toLowerCase();
  if (seenNames.has(k)) {
    dropped.push(r);
    return false;
  }
  seenNames.set(k, r);
  return true;
});
if (dropped.length) {
  console.warn(
    `build-catalog: dropped ${dropped.length} same-name entr${dropped.length === 1 ? "y" : "ies"} ` +
      `(kept the most-linked): ` + dropped.slice(0, 8).map((r) => `${r.name} (Q${r.key})`).join("; "),
  );
}

rows = rows.slice(0, TOP_N);

// Format corruption is a hard failure, never a filter (build-cities.mjs).
const malformed = rows.filter(
  (r) => /[\t\n\r]/.test(r.name) || r.name.startsWith("#") || r.name !== r.name.trim(),
);
if (malformed.length) {
  console.error(
    `build-catalog: ${malformed.length} name(s) would corrupt the file format: ` +
      JSON.stringify(malformed.slice(0, 5).map((r) => r.name)),
  );
  process.exit(1);
}
if (rows.length < 200) {
  console.error(`build-catalog: only ${rows.length} usable rows — refusing to write a stub catalogue`);
  process.exit(1);
}

const lines = [
  `# InSight ${spec.what} catalogue — GENERATED by scripts/build-catalog.mjs ${domain}, do not edit.`,
  "# Source: Wikidata (CC0), ranked by sitelink count. Keys are Wikidata QID",
  `# numeric parts (2831 = Q2831) — stable across refreshes, which is the point:`,
  "# stored answers are keys (docs/CATALOG-QUESTIONS.md), and ranks reorder.",
  `# ${rows.length} entries, popularity order. Format: \`key<TAB>name\`.`,
];
for (const r of rows) lines.push(`${r.key}\t${r.name}`);
const text = lines.join("\n") + "\n";
writeFileSync(join(root, "public", spec.out), text);
console.log(
  `build-catalog: wrote ${rows.length} ${spec.what} — ` +
    `${(text.length / 1024).toFixed(1)} KB raw, ${(gzipSync(text).length / 1024).toFixed(1)} KB gzipped`,
);

// ── regenerate the trigger's key sets from ALL committed catalogues ─────
// One derivation for every builder: scripts/catalog-keys-lib.mjs.
regenerateCatalogKeys(root, "build-catalog");
