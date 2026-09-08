// Fetches a picture for each entry of a pick catalogue and commits it as
// hosting content — web/catalog-art/<domain>/<key>.webp beside a
// credits.tsv that says whose picture it is and under which licence — then
// regenerates src/v2/data/catalogArtIndex.ts so the app knows which tiles
// have one (D420, D421; docs/CATALOG-QUESTIONS.md § Entity images).
//
//   node scripts/build-catalog-art.mjs --all                    # every routed domain, in order
//   node scripts/build-catalog-art.mjs pokemon                  # PokéAPI's official artwork (D421)
//   node scripts/build-catalog-art.mjs athletes                 # Commons, via Wikidata P18
//   node scripts/build-catalog-art.mjs countries                # Commons, via Wikidata P41 (the flag)
//   node scripts/build-catalog-art.mjs dogs                     # Commons, breeds found by name
//   node scripts/build-catalog-art.mjs films                    # TMDB posters with TMDB_API_KEY, else Commons' free ones
//   node scripts/build-catalog-art.mjs athletes --limit 40      # a trial run over the head
//   node scripts/build-catalog-art.mjs athletes --remove 615    # THE TAKEDOWN — see below
//
// AN OPERATOR STEP, NOT A CI STEP, for build-catalog.mjs's reason one
// artifact over: it fetches from Wikidata, Wikimedia Commons, PokéAPI's
// GitHub and TMDB, which sandboxed CI runners and most remote sessions
// cannot reach (the 2026-09-07 session that wrote this could reach none
// of them, so the machinery and the data land separately, D15). Run it
// from a session or machine whose network policy allows these hosts —
//
//   query.wikidata.org · commons.wikimedia.org · upload.wikimedia.org
//   raw.githubusercontent.com · api.themoviedb.org · image.tmdb.org
//
// — and commit what it writes; the committed files are what
// check:catalog-art validates, and the endpoints are never needed again
// until the next refresh or takedown.
//
// WHAT IT WILL NOT DO, and why each refusal is in code rather than prose:
//   · fetch at runtime — every picture the app draws is a committed file on
//     our own hosting, never a hotlink (the viewer's IP would reach the
//     third party, the picture could change after it was reported, and
//     Commons asks not to be hotlinked at scale);
//   · ship a picture as it came — every one is re-encoded (catalog-art-lib's
//     toThumb: fitted inside 184 px, EXIF dropped, WebP), which is also how
//     a 300 KB PokéAPI PNG becomes a 10 KB tile;
//   · admit a licence it does not recognise — `licenceAllowed` is the one
//     policy, and the gate holds the committed rows to the same function;
//     TMDB and PokeAPI are admitted as RULED SOURCES (D420, D421), not as
//     licences, and the credits sheet says so;
//   · run from model memory (D15's rule, applied to media): every row
//     carries the source URL it was fetched from.
//
// THE TAKEDOWN. The owner's ruling (D420) is attempt-and-take-down: a
// complaint about a picture is answered by removing it, not by arguing.
// `--remove <key>` deletes the file, drops the credits row, regenerates
// the index, and the commit that carries it deploys hosting (the
// firebase-deploy workflow watches web/**). A device stops drawing the
// picture within Cache-Control's hour, with no app-store release in the
// path. A whole domain comes down with `rm -r web/catalog-art/<domain>`
// and `--remove` with no keys, which only regenerates the index.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ART_DIR, CREDITS_FILE, IMAGE_EXTS, MAX_IMAGE_BYTES, THUMB_WIDTH,
  licenceAllowed, stripHtml, cleanField, formatCredits, readCredits, readCatalogue,
  regenerateCatalogArtIndex, toThumb,
} from "./catalog-art-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);
const UA = "InSight-catalog-art/1.0 (https://github.com/Cosaxo/InSight)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const POKEAPI_ART = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

// How each domain's keys reach a picture. `qid` domains are keyed by the
// Wikidata QID numeric part (build-catalog.mjs), so the key IS the entity
// and `props` are tried in order (a film's free poster P3383 before a
// still P18 before a logo P154). Countries are ISO 3166-1 numeric, which
// Wikidata carries as P299, and the picture worth drawing is the flag
// (P41). Dogs are catalogue-minted keys whose names are Wikipedia's, so
// they are found by LABEL among the dog-breed classes. Pokémon come from
// PokéAPI's sprite repository by dex number (D421). Films prefer TMDB's
// posters when a key is present and fall back to Commons' free ones.
const ROUTES = {
  pokemon: { source: "pokeapi" },
  countries: { source: "commons", by: "iso", props: ["P41"] },
  athletes: { source: "commons", by: "qid", props: ["P18"] },
  artists: { source: "commons", by: "qid", props: ["P18"] },
  videogames: { source: "commons", by: "qid", props: ["P18", "P154"] },
  dogs: { source: "commons", by: "label", classes: ["Q39367", "Q1418384", "Q25409459"], props: ["P18"] },
  films: { source: "tmdb", fallback: { source: "commons", by: "qid", props: ["P3383", "P18", "P154"] } },
};
// …and the domains that have no picture to fetch, each with its reason —
// printed, so a run over "all the other" says why these are not in it.
const NO_ROUTE = {
  languages: "a language has no picture — its name is the whole of it",
  elements: "the symbol is in the name; a photograph of an element is a photograph of a jar",
  emoji: "the glyph IS the picture, drawn by the tile since D308",
  colors: "the colour IS the picture, drawn by the tile since D308",
};

// ── args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i === -1 ? dflt : argv[i + 1];
};
const has = (name) => argv.includes(name);
const domain = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--source" && argv[argv.indexOf(a) - 1] !== "--limit" && argv[argv.indexOf(a) - 1] !== "--remove");

// ── --all: every routed domain in turn, each in its own process so one
// failure (a missing key, a host the policy blocks) does not take the
// rest down; the exit code says whether any did. ─────────────────────
if (has("--all")) {
  const pass = argv.filter((a) => a === "--limit" || argv[argv.indexOf(a) - 1] === "--limit");
  let failed = 0;
  for (const d of Object.keys(ROUTES)) {
    if (!readCatalogue(root, d)) { console.log(`build-catalog-art: ${d} — no catalogue committed yet, skipped`); continue; }
    console.log(`\n── ${d} ──`);
    const r = spawnSync(process.execPath, [SELF, d, ...pass], { stdio: "inherit", env: process.env });
    if (r.status !== 0) failed += 1;
  }
  for (const [d, why] of Object.entries(NO_ROUTE)) console.log(`build-catalog-art: ${d} — no route on purpose: ${why}`);
  console.log(failed ? `\nbuild-catalog-art: ${failed} domain(s) failed — see above` : "\nbuild-catalog-art: every routed domain done. Now: npm run check:catalog-art, then commit web/catalog-art/ and src/v2/data/catalogArtIndex.ts together.");
  process.exit(failed ? 1 : 0);
}

if (!domain) {
  console.error("usage: node scripts/build-catalog-art.mjs <domain>|--all [--source commons|tmdb|pokeapi] [--limit N] [--remove KEY[,KEY…]]");
  process.exit(2);
}
const catalogue = readCatalogue(root, domain);
if (!catalogue) {
  console.error(`build-catalog-art: no committed catalogue for ${JSON.stringify(domain)} under public/ — the pictures follow the keys, never the other way round`);
  process.exit(2);
}
const dir = join(root, ART_DIR, domain);
const limit = Number(flag("--limit", 0)) || 0;

// ── the takedown ──────────────────────────────────────────────────────
if (has("--remove")) {
  const keys = String(flag("--remove", "")).split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  const { rows } = readCredits(root, domain);
  const gone = [];
  const kept = rows.filter((r) => {
    if (!keys.includes(r.key)) return true;
    const f = join(dir, r.file);
    if (existsSync(f)) rmSync(f);
    gone.push(`${r.name} (${r.key}, ${r.file})`);
    return false;
  });
  if (existsSync(dir)) {
    if (kept.length) writeFileSync(join(dir, CREDITS_FILE), formatCredits(domain, kept));
    else rmSync(dir, { recursive: true, force: true });
  }
  regenerateCatalogArtIndex(root, "build-catalog-art");
  for (const g of gone) console.log(`build-catalog-art: removed ${g}`);
  const missing = keys.filter((k) => !rows.some((r) => r.key === k));
  for (const m of missing) console.log(`build-catalog-art: ${domain} had no picture for key ${m} — nothing to remove`);
  console.log(`build-catalog-art: ${domain} now carries ${kept.length} picture(s). Commit and merge; hosting deploys from web/** (D420).`);
  process.exit(0);
}

// ── which route ───────────────────────────────────────────────────────
if (NO_ROUTE[domain]) {
  console.error(`build-catalog-art: ${domain} has no route on purpose — ${NO_ROUTE[domain]}`);
  process.exit(2);
}
let route = ROUTES[domain];
if (!route) {
  console.error(`build-catalog-art: ${domain} has no route from its keys to a picture — add one to ROUTES with its reasoning`);
  process.exit(2);
}
const wantSource = flag("--source", null);
if (route.source === "tmdb" && !process.env.TMDB_API_KEY && (!wantSource || wantSource === "commons")) {
  console.log("build-catalog-art: no TMDB_API_KEY — films take the Commons route (P3383's free posters, then stills and logos), which pictures the classics and few others; set the key for the posters (OWNER-LIST.md, D420).");
  route = route.fallback;
} else if (wantSource && wantSource !== route.source) {
  if (route.fallback && wantSource === route.fallback.source) route = route.fallback;
  else { console.error(`build-catalog-art: ${domain} does not run through --source ${wantSource}`); process.exit(2); }
}
const source = route.source;
if (source === "tmdb" && !process.env.TMDB_API_KEY) {
  console.error("build-catalog-art: --source tmdb needs TMDB_API_KEY in the environment (a free registration at themoviedb.org/settings/api; the commercial terms are the owner's call — OWNER-LIST.md, D420).");
  process.exit(2);
}

// ── fetch helpers ─────────────────────────────────────────────────────
async function get(url, init = {}, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers || {}) } });
    } catch (e) {
      if (attempt >= tries) {
        console.error(
          `build-catalog-art: cannot reach ${new URL(url).host} — this is an operator step and needs\n` +
          `network access to that host (the header lists all six; a sandboxed session may allow\n` +
          `some and not others). Underlying error: ${e && e.message}`,
        );
        process.exit(1);
      }
      await pause(1500 * attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= tries) { console.error(`build-catalog-art: ${new URL(url).host} answered HTTP ${res.status}`); process.exit(1); }
      await pause(2500 * attempt);
      continue;
    }
    return res;
  }
}
const getJson = async (url, init) => {
  const res = await get(url, init);
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status} for ${url.slice(0, 120)}`);
  return res.json();
};
async function sparql(query) {
  const j = await getJson(`${SPARQL}?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: "application/sparql-results+json" },
  });
  return j.results.bindings;
}
const CHUNK = 120;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** The source's bytes as a tile: downloaded, decoded, re-encoded — or
 *  null with the reason. */
async function fetchThumb(url) {
  const res = await get(url);
  if (!res.ok) return { skip: `HTTP ${res.status}` };
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!/^image\/(jpeg|png|webp|gif|tiff)$/.test(mime)) return { skip: `unsupported type ${mime || "unknown"}` };
  const raw = Buffer.from(await res.arrayBuffer());
  if (!raw.length) return { skip: "empty body" };
  let thumb;
  try {
    thumb = await toThumb(raw);
  } catch (e) {
    return { skip: `could not decode (${e && e.message})` };
  }
  if (!IMAGE_EXTS.includes(thumb.ext)) return { skip: `re-encoded to ${thumb.ext}, which the gate refuses` };
  if (thumb.bytes.length > MAX_IMAGE_BYTES) return { skip: `${thumb.bytes.length} bytes after re-encoding, over the ${MAX_IMAGE_BYTES} cap` };
  return thumb;
}

// ── the run ───────────────────────────────────────────────────────────
const keys = [...catalogue.keys()];
const wanted = limit ? keys.slice(0, limit) : keys;
const existing = readCredits(root, domain).rows;
const rows = new Map(existing.map((r) => [r.key, r]));
const stats = { pictured: 0, noImage: 0, refused: 0, skipped: 0 };
const refusals = new Map();

// Delete what a re-run no longer finds, so the manifest never describes a
// picture the source withdrew; --limit runs leave the rest untouched.
const place = (key, result) => {
  const prev = rows.get(key);
  if (prev && prev.file !== result?.file && existsSync(join(dir, prev.file))) rmSync(join(dir, prev.file));
  if (result) { rows.set(key, result); stats.pictured += 1; } else rows.delete(key);
};
const refuse = (why) => { stats.refused += 1; refusals.set(why, (refusals.get(why) || 0) + 1); };
const skip = (key, why) => { stats.skipped += 1; console.log(`build-catalog-art: ${catalogue.get(key)} (${key}): ${why}`); place(key, null); };
const write = (key, thumb, credit) => {
  const file = `${key}.${thumb.ext}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), thumb.bytes);
  place(key, { key, file, name: catalogue.get(key), ...credit });
};

try {
if (source === "commons") {
  // 1. key → Commons file name, props in preference order, one chunk at a time.
  const files = new Map();
  const optionals = route.props.map((p, i) => `OPTIONAL { ?item wdt:${p} ?p${i} . }`).join(" ");
  const pick = (b) => { for (let i = 0; i < route.props.length; i++) if (b[`p${i}`]) return b[`p${i}`].value; return null; };
  const fileName = (v) => decodeURIComponent(v.replace(/^.*\/Special:FilePath\//, "")).replace(/_/g, " ");
  if (route.by === "qid") {
    for (const part of chunks(wanted, CHUNK)) {
      for (const b of await sparql(`SELECT ?item ${route.props.map((_, i) => `?p${i}`).join(" ")} WHERE { VALUES ?item { ${part.map((k) => `wd:Q${k}`).join(" ")} } ${optionals} }`)) {
        const key = Number(b.item.value.replace(/^.*\/Q/, ""));
        const v = pick(b);
        if (v && wanted.includes(key) && !files.has(key)) files.set(key, fileName(v));
      }
      await pause(300);
    }
  } else if (route.by === "iso") {
    for (const part of chunks(wanted, CHUNK)) {
      for (const b of await sparql(`SELECT ?iso ${route.props.map((_, i) => `?p${i}`).join(" ")} WHERE { VALUES ?iso { ${part.map((k) => `"${String(k).padStart(3, "0")}"`).join(" ")} } ?item wdt:P299 ?iso . ${optionals} }`)) {
        const key = Number(b.iso.value);
        const v = pick(b);
        if (v && wanted.includes(key) && !files.has(key)) files.set(key, fileName(v));
      }
      await pause(300);
    }
  } else if (route.by === "label") {
    // By name, among the classes a breed can be an instance of: the
    // catalogue's names are Wikipedia's (build-dogs.mjs), so an exact
    // English label or alias finds most of them, and a miss keeps its face.
    const byName = new Map([...catalogue].filter(([k]) => wanted.includes(k)).map(([k, n]) => [n, k]));
    const lit = (n) => `${JSON.stringify(n)}@en`;
    for (const part of chunks([...byName.keys()], 80)) {
      const q = `SELECT ?label ${route.props.map((_, i) => `?p${i}`).join(" ")} WHERE {
        VALUES ?label { ${part.map(lit).join(" ")} }
        VALUES ?cls { ${route.classes.map((c) => `wd:${c}`).join(" ")} }
        ?item rdfs:label|skos:altLabel ?label ; wdt:P31 ?cls . ${optionals} }`;
      for (const b of await sparql(q)) {
        const key = byName.get(b.label.value);
        const v = pick(b);
        if (key && v && !files.has(key)) files.set(key, fileName(v));
      }
      await pause(300);
    }
  }
  for (const key of wanted) if (!files.has(key)) { stats.noImage += 1; place(key, null); }

  // 2. Commons: licence, author and a thumbnail URL, fifty titles a call.
  for (const part of chunks([...files.entries()], 50)) {
    const q = new URLSearchParams({
      action: "query", prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: "LicenseShortName|Artist|Credit", titles: part.map(([, name]) => `File:${name}`).join("|"),
      format: "json", formatversion: "2",
    });
    const j = await getJson(`${COMMONS_API}?${q}`);
    const pages = new Map((j.query?.pages || []).map((p) => [String(p.title || "").replace(/^File:/, "").toLowerCase(), p]));
    for (const [key, name] of part) {
      const page = pages.get(name.toLowerCase());
      const info = page?.imageinfo?.[0];
      if (!info || page.missing) { stats.noImage += 1; place(key, null); continue; }
      const meta = info.extmetadata || {};
      const licence = cleanField(meta.LicenseShortName?.value || "");
      const verdict = licenceAllowed(licence);
      if (!verdict.ok) { refuse(verdict.why); place(key, null); continue; }
      const author = stripHtml(meta.Artist?.value || meta.Credit?.value || "") || "unknown author";
      const thumb = await fetchThumb(info.thumburl || info.url);
      if (thumb.skip) { skip(key, thumb.skip); continue; }
      write(key, thumb, { author, licence, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replace(/ /g, "_"))}` });
      await pause(120);
    }
  }
} else if (source === "pokeapi") {
  // PokéAPI's sprite repository carries the official artwork by dex number
  // — a 475 px PNG with transparency, which toThumb turns into a 184 px
  // WebP that keeps it, so the Pokémon sits on the tile's own pattern.
  for (const key of wanted) {
    const thumb = await fetchThumb(`${POKEAPI_ART}/${key}.png`);
    if (thumb.skip) { if (/HTTP 404/.test(thumb.skip)) { stats.noImage += 1; place(key, null); } else skip(key, thumb.skip); continue; }
    write(key, thumb, {
      author: "Nintendo / Creatures Inc. / GAME FREAK inc.", licence: "PokeAPI",
      source: `https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/other/official-artwork/${key}.png`,
    });
    await pause(80);
  }
} else if (source === "tmdb") {
  const apiKey = process.env.TMDB_API_KEY;
  for (const key of wanted) {
    // TMDB's /find resolves a Wikidata QID straight to the movie, so the
    // catalogue's own key is the lookup and no title matching is involved.
    let j;
    try {
      j = await getJson(`${TMDB_API}/find/Q${key}?external_source=wikidata_id&api_key=${encodeURIComponent(apiKey)}`);
    } catch (e) {
      skip(key, e.message); continue;
    }
    const movie = (j.movie_results || [])[0];
    if (!movie || !movie.poster_path) { stats.noImage += 1; place(key, null); continue; }
    const thumb = await fetchThumb(`${TMDB_IMG}${movie.poster_path}`);
    if (thumb.skip) { skip(key, thumb.skip); continue; }
    write(key, thumb, { author: "TMDB", licence: "TMDB", source: `https://www.themoviedb.org/movie/${movie.id}` });
    await pause(60);
  }
}
} catch (e) {
  // An HTTP error from a host, not a network failure (`get` handles those):
  // in a sandboxed session the egress proxy answers 403 for a host off the
  // environment's allowlist, and that is the usual meaning of this line.
  console.error(`build-catalog-art: ${domain}: ${e && e.message} — an HTTP 403 here usually means the host is not on this environment's network allowlist (the header lists the six).`);
  process.exit(1);
}

// Files nothing names are not art: a previous run's leftovers, a stray
// download. The gate would refuse them; the builder removes them first.
if (existsSync(dir)) {
  const named = new Set([CREDITS_FILE, ...[...rows.values()].map((r) => r.file)]);
  for (const f of readdirSync(dir)) if (!named.has(f)) rmSync(join(dir, f));
  if (rows.size) writeFileSync(join(dir, CREDITS_FILE), formatCredits(domain, [...rows.values()]));
  else rmSync(dir, { recursive: true, force: true });
}
regenerateCatalogArtIndex(root, "build-catalog-art");

console.log(
  `build-catalog-art: ${domain} via ${source} — ${stats.pictured} pictured, ${stats.noImage} with no image at the source, ` +
  `${stats.refused} refused on licence, ${stats.skipped} skipped; ${rows.size} row(s) in ${ART_DIR}/${domain}/${CREDITS_FILE}`,
);
for (const [why, n] of [...refusals.entries()].sort((a, b) => b[1] - a[1])) console.log(`  refused ${n}: ${why}`);
if (!has("--all")) console.log("Now: npm run check:catalog-art, then commit web/catalog-art/ and src/v2/data/catalogArtIndex.ts together.");
