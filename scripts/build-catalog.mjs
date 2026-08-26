// Generates public/films.txt or public/artists.txt — the curated catalogues
// behind the feed's `pick` cards (docs/CATALOG-QUESTIONS.md, D15) — and
// regenerates functions/src/catalogKeys.ts from whatever catalogue files
// exist afterwards, so the trigger's key sets can never drift from the
// files clients ship (scripts/check-catalogs.mjs enforces the agreement).
//
//   node scripts/build-catalog.mjs films
//   node scripts/build-catalog.mjs artists
//   node scripts/build-catalog.mjs athletes
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
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { regenerateCatalogKeys } from "./catalog-keys-lib.mjs";
import {
  MUSIC_OCC_SEEDS,
  MUSIC_RATIO_MIN,
  musicShare,
  keepsAsArtist,
  parseReview,
  applyReview,
} from "./catalog-curate-lib.mjs";

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
    //
    // THIS QUERY IS THE CANDIDATE GENERATOR, NOT THE CATALOGUE. On its own
    // it returns a canon of famous people who once touched music —
    // Leonardo da Vinci 2nd, Goethe 3rd, Mother Teresa 20th — because
    // sitelinks rank the person while P106 only asks whether they ever
    // played or wrote (D266 has the measurements). `refine` below is what
    // turns candidates into a catalogue. Its recall is the reason the
    // query is left broad: everything the rule keeps has to be in here
    // first, and an over-tight query is the one mistake no later stage
    // can undo.
    //
    // The floor is 40 rather than D15's 60 because refine drops about half
    // the pool: at 60 the survivors do not reach TOP_N. The 4,000 cap is
    // headroom over the ~2,600 the floor actually returns.
    query: `SELECT DISTINCT ?item ?itemLabel ?links WHERE {
  { ?item wdt:P31 wd:Q215380 . }
  UNION
  { ?item wdt:P31 wd:Q5 ; wdt:P106 ?occ .
    VALUES ?occ { wd:Q177220 wd:Q639669 wd:Q488205 wd:Q36834 wd:Q2252262 } }
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT 4000`,
    label: (b) => b.itemLabel.value,
    refine: refineArtists,
  },
  athletes: {
    out: "athletes.txt",
    what: "athletes",
    // 640 rather than TOP_N, matching the owner's 2026-08-26 reference
    // sheet ("Search 640 athletes") — and the tail past ~640 is
    // single-country league fame, which a worldwide favourite question
    // reaches through "Not listed" honestly enough.
    top: 640,
    // No single query: the person-side closure (?item wdt:P106/wdt:P279*
    // athlete) times the endpoint out with or without the label service —
    // probed twice, 2026-08-26 — so the closure is fetched FIRST (917
    // occupations, instant) and candidates are gathered per occupation
    // chunk, ranked locally, labelled in chunks.
    //
    // THE ARTISTS' DISEASE, CONFIRMED HERE TOO. The first unrefined run
    // ranked George W. Bush first, with Albert Camus (goalkeeper), Niels
    // Bohr (footballer) and Henry Ford in the top ten — sitelinks rank
    // the person, P106 only asks whether they ever played (D266's exact
    // measurement, one domain over). So the same cure: at least a third
    // of an entry's occupations athletic, checked against the closure the
    // gatherer already fetched. No review file yet — the ratio's output
    // reads clean for sport in a way music's did not (a footballer's
    // P106 rarely lists five other trades), and the artists' review lane
    // is the precedent to copy the day a wrongly-dropped legend surfaces.
    fetch: fetchAthletes,
  },
};

// The athletes domain's gatherer — see the spec's comment for why it is
// staged. Shapes its rows exactly as the single-query path does, so the
// same-name dedupe, the top cut and the format checks below apply
// unchanged.
async function fetchAthletes() {
  const occs = (await sparql("SELECT DISTINCT ?occ WHERE { ?occ wdt:P279* wd:Q2066131 }"))
    .map((b) => qidNum(b.occ.value))
    .filter(Boolean);
  const athleticOcc = new Set(occs);
  console.log(`build-catalog: athlete occupation closure holds ${occs.length} occupations`);
  const byKey = new Map();
  for (let i = 0; i < occs.length; i += 90) {
    const values = occs.slice(i, i + 90).map((k) => `wd:Q${k}`).join(" ");
    // P31 Q5 is load-bearing: deities carry athletic occupations too, and
    // the first run without it ranked Apollo 15th and Artemis 25th.
    const page = await sparql(
      `SELECT DISTINCT ?item ?links WHERE { VALUES ?occ { ${values} } ?item wdt:P106 ?occ ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?links . FILTER(?links >= 45) }`,
    );
    for (const b of page) {
      const key = qidNum(b.item.value);
      if (key == null || key === 0) continue;
      const links = Number(b.links.value) || 0;
      const prev = byKey.get(key);
      if (!prev || links > prev.links) byKey.set(key, { key, links });
    }
  }
  // The ratio rule (the artists' cure, D266/D267): fetch each candidate's
  // FULL occupation set and keep the ones at least a third athletic. Run
  // over a deep head so the cut to `top` still bites on curated rows.
  const ranked = [...byKey.values()]
    .sort((a, b) => b.links - a.links || a.key - b.key)
    .slice(0, 2000);
  const occOf = new Map();
  for (let i = 0; i < ranked.length; i += 150) {
    const values = ranked.slice(i, i + 150).map((r) => `wd:Q${r.key}`).join(" ");
    for (const b of await sparql(
      `SELECT ?item ?occ WHERE { VALUES ?item { ${values} } ?item wdt:P106 ?occ }`,
    )) {
      const k = qidNum(b.item.value);
      if (!occOf.has(k)) occOf.set(k, new Set());
      occOf.get(k).add(qidNum(b.occ.value));
    }
  }
  const annotated = ranked.map((r) => {
    const all = occOf.get(r.key) || new Set();
    const athletic = [...all].filter((o) => athleticOcc.has(o)).length;
    return { ...r, athletic, occTotal: all.size, keep: all.size > 0 && athletic / all.size >= 1 / 3 };
  });

  // Names for the head of ALL candidates — kept AND dropped — plus any
  // qid the review file mentions: an admitted row needs its label, and
  // the review list has to show the drops by name or ruling on them is
  // guessing.
  //
  // "mul" beside "en", and "en" wins: Wikidata has been migrating items
  // whose name is spelled the same everywhere onto one multilingual
  // label and DELETING the per-language copies — Q615 (Messi) carries
  // only `mul` today, which is how a plain LANG="en" filter silently
  // dropped the most-linked footballer on earth while keeping Cristiano.
  // The label SERVICE falls back to mul by itself; raw rdfs:label does
  // not, so the fallback is spelled out here.
  const reviewRaw = JSON.parse(readFileSync(join(root, "content", "athlete-review.json"), "utf8"));
  const review = parseReview(reviewRaw);
  if (review.errors.length) {
    console.error(`build-catalog: content/athlete-review.json has ${review.errors.length} problem(s)`);
    for (const e of review.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const reviewQids = new Set([...review.reject.keys(), ...review.admit.keys()]);
  const toName = annotated.filter((r, i) => i < 1200 || reviewQids.has(r.key));
  const names = new Map();
  for (let i = 0; i < toName.length; i += 150) {
    const values = toName.slice(i, i + 150).map((r) => `wd:Q${r.key}`).join(" ");
    for (const b of await sparql(
      `SELECT ?item ?label (LANG(?label) AS ?lang) WHERE { VALUES ?item { ${values} } ?item rdfs:label ?label . FILTER(LANG(?label) IN ("en", "mul")) }`,
    )) {
      const k = qidNum(b.item.value);
      const isEn = b.lang && b.lang.value === "en";
      if (isEn || !names.has(k)) names.set(k, b.label.value);
    }
  }
  const named = annotated
    .map((r) => ({ ...r, name: (names.get(r.key) || "").trim() }))
    // No English label, or a label that is just the QID: not offerable —
    // the single-query path's rule, applied here since it never sees these.
    .filter((r) => r.name && !new RegExp(`^Q${r.key}( |$)`).test(r.name));

  if (REVIEW_LIST) {
    const shown = named.slice(0, REVIEW_LIST);
    console.log(
      `# athletes candidates 1..${shown.length} of ${named.length}, popularity order.\n` +
        `# KEEP/DROP is the mechanical rule (>= 1/3 of occupations athletic).\n` +
        `# Rule on the ones it got wrong in content/athlete-review.json:\n` +
        `#   a DROP that is famous FOR sport -> admit   (no reason needed)\n` +
        `#   a KEEP that is not              -> reject  (needs a why)\n` +
        `# Format: verdict<TAB>qid<TAB>athletic/total<TAB>sitelinks<TAB>name`,
    );
    for (const r of shown) {
      console.log(`${r.keep ? "KEEP" : "DROP"}\t${r.key}\t${r.athletic}/${r.occTotal}\t${r.links}\t${r.name}`);
    }
    process.exit(0);
  }

  const kept = named.filter((r) => r.keep);
  console.log(
    `build-catalog: curation rule kept ${kept.length} of ${named.length} named candidates ` +
      `(${named.length - kept.length} dropped as famous-but-not-for-sport)`,
  );

  const out = applyReview(kept, named, review);
  if (out.rejected.length || out.admitted.length) {
    console.log(
      `build-catalog: review applied — ${out.rejected.length} rejected, ${out.admitted.length} admitted` +
        (out.admitted.length ? ` (${out.admitted.map((e) => e.name).join(", ")})` : ""),
    );
  }
  for (const e of out.redundant) {
    console.warn(
      `build-catalog: content/athlete-review.json ${e.side === "admit" ? "admits" : "rejects"} ` +
        `${e.name} (Q${e.qid}), but the rule already agrees — the entry is doing nothing`,
    );
  }
  if (out.stale.length) {
    console.error(
      `build-catalog: ${out.stale.length} entr${out.stale.length === 1 ? "y" : "ies"} in ` +
        `content/athlete-review.json name candidates this run did not return:`,
    );
    for (const e of out.stale) console.error(`  - ${e.side}: ${e.name} (Q${e.qid})`);
    console.error("  Wikidata changed under the file. Re-run --review-list and re-rule these.");
    process.exit(1);
  }
  return out.rows;
}

// The artists domain's membership rule. SPARQL cannot express it — it is a
// ratio over a subclass closure, and the closure is what makes "composer"
// count when it is spelled "Kapellmeister" — so it runs here, over the
// candidates the query returned. The rule itself and every measurement
// behind it live in scripts/catalog-curate-lib.mjs; this function is the
// Wikidata half plus the reviewed exceptions.
async function refineArtists(pool) {
  const keys = pool.map((r) => r.key);

  // A band's P106 is usually empty — it is not a person — so the group
  // flag has to be fetched separately or every group scores 0/0.
  const groups = new Set();
  for (const b of await chunked(keys, (v) => `SELECT ?item WHERE { VALUES ?item { ${v} } ?item wdt:P31 wd:Q215380 }`)) {
    groups.add(qidNum(b.item.value));
  }

  const occOf = new Map();
  for (const b of await chunked(keys, (v) => `SELECT ?item ?occ WHERE { VALUES ?item { ${v} } ?item wdt:P106 ?occ }`)) {
    const k = qidNum(b.item.value);
    if (!occOf.has(k)) occOf.set(k, new Set());
    occOf.get(k).add(qidNum(b.occ.value));
  }

  // Classify each distinct occupation ONCE, by subclass closure, rather
  // than per person: ~500 occupations across ~2,600 candidates.
  const distinctOcc = [...new Set([...occOf.values()].flatMap((s) => [...s]))];
  const union = MUSIC_OCC_SEEDS.map((q) => `{ ?o wdt:P279* wd:Q${q} }`).join(" UNION ");
  const musicOcc = new Set();
  for (const b of await chunked(distinctOcc, (v) => `SELECT DISTINCT ?o WHERE { VALUES ?o { ${v} } ${union} }`)) {
    musicOcc.add(qidNum(b.o.value));
  }

  const annotated = pool.map((r) => {
    const row = { ...r, isGroup: groups.has(r.key), occ: occOf.get(r.key) || new Set() };
    row.share = musicShare(row.occ, musicOcc);
    row.keep = keepsAsArtist(row, musicOcc);
    return row;
  });

  if (REVIEW_LIST) {
    const shown = annotated.slice(0, REVIEW_LIST);
    console.log(
      `# artists candidates 1..${shown.length} of ${annotated.length}, popularity order.\n` +
        `# KEEP/DROP is the mechanical rule (>= ${(MUSIC_RATIO_MIN * 100).toFixed(0)}% of occupations musical,\n` +
        `# groups exempt). Rule on the ones it got wrong in content/artist-review.json:\n` +
        `#   a DROP that is a real music artist -> admit   (no reason needed)\n` +
        `#   a KEEP that is not                 -> reject  (needs a why)\n` +
        `# Format: verdict<TAB>qid<TAB>music/total<TAB>sitelinks<TAB>name`,
    );
    for (const r of shown) {
      const frac = r.isGroup ? "group" : `${r.share.music}/${r.share.total}`;
      console.log(`${r.keep ? "KEEP" : "DROP"}\t${r.key}\t${frac}\t${r.links}\t${r.name}`);
    }
    process.exit(0);
  }

  const kept = annotated.filter((r) => r.keep);
  console.log(
    `build-catalog: curation rule kept ${kept.length} of ${annotated.length} candidates ` +
      `(${annotated.length - kept.length} dropped as famous-but-not-for-music)`,
  );

  const raw = JSON.parse(readFileSync(join(root, "content", "artist-review.json"), "utf8"));
  const review = parseReview(raw);
  if (review.errors.length) {
    console.error(`build-catalog: content/artist-review.json has ${review.errors.length} problem(s)`);
    for (const e of review.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const out = applyReview(kept, annotated, review);
  if (out.rejected.length || out.admitted.length) {
    console.log(
      `build-catalog: review applied — ${out.rejected.length} rejected, ${out.admitted.length} admitted` +
        (out.admitted.length ? ` (${out.admitted.map((e) => e.name).join(", ")})` : ""),
    );
  }
  for (const e of out.redundant) {
    console.warn(
      `build-catalog: content/artist-review.json ${e.side === "admit" ? "admits" : "rejects"} ` +
        `${e.name} (Q${e.qid}), but the rule already agrees — the entry is doing nothing`,
    );
  }
  // A stale exception is fatal, not a warning: it means the reviewer's
  // subject has left the candidate pool, so the file now records a
  // judgement about somebody this catalogue no longer contains, and the
  // next reader would trust it. Refresh the review, not the ignore-list.
  if (out.stale.length) {
    console.error(
      `build-catalog: ${out.stale.length} entr${out.stale.length === 1 ? "y" : "ies"} in ` +
        `content/artist-review.json name candidates this run did not return:`,
    );
    for (const e of out.stale) console.error(`  - ${e.side}: ${e.name} (Q${e.qid})`);
    console.error("  Wikidata changed under the file. Re-run --review-list and re-rule these.");
    process.exit(1);
  }
  return out.rows;
}

const domain = process.argv[2];
const spec = DOMAINS[domain];
if (!spec) {
  console.error(
    `build-catalog: usage: node scripts/build-catalog.mjs <${Object.keys(DOMAINS).join("|")}> [--review-list [N]]`,
  );
  process.exit(1);
}

// `--review-list [N]` prints the top N candidates with the decision the
// rule made about each, and writes NOTHING. It exists because the last
// few names in the artists domain are a human's call (D266): a reviewer
// needs one ranked list showing both what was kept and what was dropped,
// with the fraction that decided it, so filling
// content/artist-review.json is reading rather than guessing.
const reviewFlag = process.argv.indexOf("--review-list");
const REVIEW_LIST = reviewFlag === -1 ? 0 : Number(process.argv[reviewFlag + 1]) || 300;
if (REVIEW_LIST && !spec.refine && !spec.fetch) {
  console.error(`build-catalog: --review-list is only meaningful for a domain with a curation rule (${domain} has none)`);
  process.exit(1);
}

const qidNum = (uri) => {
  const m = uri.match(/\/Q(\d+)$/);
  return m ? Number(m[1]) : null;
};

// One query path for the catalogue query and for the enrichment a domain's
// `refine` runs — the refusals below are the only ones an operator sees, so
// they say which of the two failed by naming nothing but the endpoint.
async function sparql(query) {
  let res;
  try {
    res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`, {
      headers: {
        // Wikidata asks bots to identify themselves; the repo is the contact.
        "User-Agent": "InSight-catalog-builder/1.0 (https://github.com/Cosaxo/InSight)",
        Accept: "application/sparql-results+json",
      },
    });
  } catch (e) {
    console.error(
      `build-catalog: cannot reach ${ENDPOINT} — this is an operator step and needs\n` +
        `network access to Wikidata (sandboxed sessions may not have it; D15 records\n` +
        `the environment's network policy as the thing that decides, and D266 the run\n` +
        `where it had been widened). Underlying error: ${e && e.message}`,
    );
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`build-catalog: ${ENDPOINT} answered HTTP ${res.status}`);
    process.exit(1);
  }
  return (await res.json()).results.bindings;
}

// Ask about at most this many entities per enrichment query. A VALUES list
// of the whole candidate pool times a P279* closure is the shape that
// times the label service out; the cut is arbitrary and generous.
const CHUNK = 150;
const chunked = async (keys, build) => {
  const out = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const values = keys.slice(i, i + CHUNK).map((k) => `wd:Q${k}`).join(" ");
    out.push(...(await sparql(build(values))));
  }
  return out;
};

// A domain either answers to one query (films, artists) or gathers its
// own rows in stages (athletes) — both hand the pipeline below the same
// {key, name, links} shape, so dedupe, the top cut and the format checks
// treat them identically.
let rows;
if (spec.fetch) {
  rows = await spec.fetch();
} else {
  const bindings = await sparql(spec.query);

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
  rows = [...byKey.values()].sort((a, b) => b.links - a.links || a.key - b.key);
}

// A domain whose query cannot express its own membership rule refines the
// candidates here, before same-name dedupe and the top-N cut — the cut has
// to bite on the curated list, or the catalogue is 1,000 candidates with
// the rule applied to a suffix of them.
if (spec.refine) rows = await spec.refine(rows);

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

rows = rows.slice(0, spec.top || TOP_N);

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
