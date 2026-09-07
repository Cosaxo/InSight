// Fetches a picture for each entry of a pick catalogue and commits it as
// hosting content — web/catalog-art/<domain>/<key>.<ext> beside a
// credits.tsv that says whose picture it is and under which licence — then
// regenerates src/v2/data/catalogArtIndex.ts so the app knows which tiles
// have one (D420, docs/CATALOG-QUESTIONS.md § Entity images).
//
//   node scripts/build-catalog-art.mjs athletes                 # Commons, via Wikidata P18
//   node scripts/build-catalog-art.mjs countries                # Commons, via Wikidata P41 (the flag)
//   node scripts/build-catalog-art.mjs films --source tmdb      # TMDB posters (needs TMDB_API_KEY)
//   node scripts/build-catalog-art.mjs athletes --limit 40      # a trial run over the head
//   node scripts/build-catalog-art.mjs athletes --remove 615    # THE TAKEDOWN — see below
//
// AN OPERATOR STEP, NOT A CI STEP, for build-catalog.mjs's reason one
// artifact over: it fetches from Wikidata, Wikimedia Commons and TMDB,
// which sandboxed CI runners and remote dev sessions cannot reach (the
// 2026-09-07 session that wrote this could reach none of the three, so the
// machinery and the data land separately, D15). Run it from any machine
// with network access and commit what it writes; the committed files are
// what check:catalog-art validates, and the endpoints are never needed
// again until the next refresh or takedown.
//
// WHAT IT WILL NOT DO, and why each refusal is in code rather than in
// prose:
//   · fetch at runtime — every image the app draws is a committed file on
//     our own hosting, never a hotlink (the viewer's IP would reach the
//     third party, the picture could change after it was reported, and
//     Commons asks not to be hotlinked at scale);
//   · admit a licence it does not recognise — `licenceAllowed` in
//     catalog-art-lib.mjs is the one policy, and the gate holds the
//     committed rows to the same function;
//   · write an SVG or a GIF, or anything over MAX_IMAGE_BYTES;
//   · run from model memory (D15's rule, applied to media): every row
//     carries the source URL it was fetched from.
//
// THE TAKEDOWN. The owner's ruling (D420) is attempt-and-take-down: a
// complaint about a picture is answered by removing it, not by arguing.
// `--remove <key>` deletes the file, drops the credits row, regenerates
// the index, and the commit that carries it deploys hosting (the
// firebase-deploy workflow watches web/**). A device stops drawing the
// picture within Cache-Control's hour, with no app-store release in the
// path. The domain directory as a whole comes down with `rm -r` and a
// bare run of this script's index step (`--remove` with no keys).
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ART_DIR, CREDITS_FILE, IMAGE_EXTS, MAX_IMAGE_BYTES, THUMB_WIDTH,
  licenceAllowed, stripHtml, cleanField, formatCredits, readCredits, readCatalogue,
  regenerateCatalogArtIndex,
} from "./catalog-art-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "InSight-catalog-art/1.0 (https://github.com/Cosaxo/InSight)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

// How a domain's keys reach a Commons file. `qid` domains are keyed by the
// Wikidata QID numeric part (build-catalog.mjs), so the key IS the entity;
// countries are ISO 3166-1 numeric, which Wikidata carries as P299, and the
// picture worth drawing is the flag (P41), not P18's photo of the place.
// Minted-key domains (dogs, languages) and the range domains (pokemon,
// elements) have no mechanical route from key to entity and are refused
// with a sentence rather than guessed at by name.
const ROUTES = {
  films: { by: "qid", prop: "P18" },
  artists: { by: "qid", prop: "P18" },
  athletes: { by: "qid", prop: "P18" },
  videogames: { by: "qid", prop: "P18" },
  countries: { by: "iso", prop: "P41" },
};

// ── args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const domain = argv[0];
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i === -1 ? dflt : argv[i + 1];
};
const has = (name) => argv.includes(name);
if (!domain || domain.startsWith("--")) {
  console.error("usage: node scripts/build-catalog-art.mjs <domain> [--source commons|tmdb] [--limit N] [--remove KEY[,KEY…]]");
  process.exit(2);
}
const catalogue = readCatalogue(root, domain);
if (!catalogue) {
  console.error(`build-catalog-art: no committed catalogue for ${JSON.stringify(domain)} under public/ — the pictures follow the keys, never the other way round`);
  process.exit(2);
}
const dir = join(root, ART_DIR, domain);
const source = flag("--source", domain === "films" ? "tmdb" : "commons");
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
          `network access (sandboxed sessions may not have it; D15 records the environment's\n` +
          `network policy as the thing that decides). Underlying error: ${e && e.message}`,
        );
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= tries) { console.error(`build-catalog-art: ${new URL(url).host} answered HTTP ${res.status}`); process.exit(1); }
      await new Promise((r) => setTimeout(r, 2500 * attempt));
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
const CHUNK = 150;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** The thumbnail's bytes and extension, or null with the reason. */
async function download(url) {
  const res = await get(url);
  if (!res.ok) return { skip: `HTTP ${res.status}` };
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime];
  if (!ext || !IMAGE_EXTS.includes(ext)) return { skip: `unsupported type ${mime || "unknown"}` };
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) return { skip: "empty body" };
  if (bytes.length > MAX_IMAGE_BYTES) return { skip: `${bytes.length} bytes, over the ${MAX_IMAGE_BYTES} cap` };
  return { bytes, ext };
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

if (source === "commons") {
  const route = ROUTES[domain];
  if (!route) {
    console.error(
      `build-catalog-art: ${domain} has no mechanical route from its keys to a Commons file — ` +
      `only the QID-keyed domains (${Object.keys(ROUTES).filter((d) => ROUTES[d].by === "qid").join(", ")}) ` +
      "and countries (ISO numeric → P299 → the flag) can be pictured without guessing by name.",
    );
    process.exit(2);
  }
  mkdirSync(dir, { recursive: true });
  // key → Commons file name, one SPARQL chunk at a time.
  const files = new Map();
  for (const part of chunks(wanted, CHUNK)) {
    const bindings = route.by === "qid"
      ? await sparql(`SELECT ?item ?img WHERE { VALUES ?item { ${part.map((k) => `wd:Q${k}`).join(" ")} } ?item wdt:${route.prop} ?img . }`)
      : await sparql(`SELECT ?iso ?img WHERE { VALUES ?iso { ${part.map((k) => `"${String(k).padStart(3, "0")}"`).join(" ")} } ?item wdt:P299 ?iso ; wdt:${route.prop} ?img . }`);
    for (const b of bindings) {
      const key = route.by === "qid" ? Number(b.item.value.replace(/^.*\/Q/, "")) : Number(b.iso.value);
      if (!wanted.includes(key) || files.has(key)) continue;
      // P18/P41 values are Special:FilePath URLs; the file name is the tail.
      const name = decodeURIComponent(b.img.value.replace(/^.*\/Special:FilePath\//, "")).replace(/_/g, " ");
      files.set(key, name);
    }
    await pause(300);
  }
  for (const key of wanted) if (!files.has(key)) { stats.noImage += 1; place(key, null); }

  // Commons: licence, author and a thumbnail URL, fifty titles a call.
  const byKey = [...files.entries()];
  for (const part of chunks(byKey, 50)) {
    const titles = part.map(([, name]) => `File:${name}`).join("|");
    const q = new URLSearchParams({
      action: "query", prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: "LicenseShortName|Artist|Credit", titles, format: "json", formatversion: "2",
    });
    const j = await getJson(`${COMMONS_API}?${q}`);
    const pages = new Map((j.query?.pages || []).map((p) => [String(p.title || "").replace(/^File:/, ""), p]));
    for (const [key, name] of part) {
      const page = pages.get(name) || [...pages.values()].find((p) => (p.title || "").replace(/^File:/, "").toLowerCase() === name.toLowerCase());
      const info = page?.imageinfo?.[0];
      if (!info || page.missing) { stats.noImage += 1; place(key, null); continue; }
      const meta = info.extmetadata || {};
      const licence = cleanField(meta.LicenseShortName?.value || "");
      const verdict = licenceAllowed(licence);
      if (!verdict.ok) { refuse(verdict.why); place(key, null); continue; }
      const author = stripHtml(meta.Artist?.value || meta.Credit?.value || "") || "unknown author";
      const got = await download(info.thumburl || info.url);
      if (got.skip) { stats.skipped += 1; console.log(`build-catalog-art: ${catalogue.get(key)} (${key}): ${got.skip}`); place(key, null); continue; }
      const file = `${key}.${got.ext}`;
      writeFileSync(join(dir, file), got.bytes);
      place(key, {
        key, file, name: catalogue.get(key), author, licence,
        source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replace(/ /g, "_"))}`,
      });
      await pause(120);
    }
  }
} else if (source === "tmdb") {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error(
      "build-catalog-art: --source tmdb needs TMDB_API_KEY in the environment (a free registration at\n" +
      "themoviedb.org/settings/api; the commercial terms are the owner's call — OWNER-LIST.md, D420).",
    );
    process.exit(2);
  }
  if (!ROUTES[domain] || ROUTES[domain].by !== "qid") {
    console.error(`build-catalog-art: TMDB finds a film by its Wikidata id, and ${domain} is not QID-keyed`);
    process.exit(2);
  }
  mkdirSync(dir, { recursive: true });
  for (const key of wanted) {
    // TMDB's /find resolves a Wikidata QID straight to the movie, so the
    // catalogue's own key is the lookup and no title matching is involved.
    let j;
    try {
      j = await getJson(`${TMDB_API}/find/Q${key}?external_source=wikidata_id&api_key=${encodeURIComponent(apiKey)}`);
    } catch (e) {
      console.log(`build-catalog-art: ${catalogue.get(key)} (${key}): ${e.message}`); stats.skipped += 1; place(key, null); continue;
    }
    const movie = (j.movie_results || [])[0];
    if (!movie || !movie.poster_path) { stats.noImage += 1; place(key, null); continue; }
    const got = await download(`${TMDB_IMG}${movie.poster_path}`);
    if (got.skip) { stats.skipped += 1; console.log(`build-catalog-art: ${catalogue.get(key)} (${key}): ${got.skip}`); place(key, null); continue; }
    const file = `${key}.${got.ext}`;
    writeFileSync(join(dir, file), got.bytes);
    place(key, {
      key, file, name: catalogue.get(key), author: "TMDB", licence: "TMDB",
      source: `https://www.themoviedb.org/movie/${movie.id}`,
    });
    await pause(60);
  }
} else {
  console.error(`build-catalog-art: unknown --source ${JSON.stringify(source)} (commons | tmdb)`);
  process.exit(2);
}

// Files nothing names are not art: a previous run's leftovers, a stray
// download. The gate would refuse them; the builder removes them first.
const named = new Set([CREDITS_FILE, ...[...rows.values()].map((r) => r.file)]);
for (const f of readdirSync(dir)) if (!named.has(f)) rmSync(join(dir, f));

if (rows.size) writeFileSync(join(dir, CREDITS_FILE), formatCredits(domain, [...rows.values()]));
else rmSync(dir, { recursive: true, force: true });
regenerateCatalogArtIndex(root, "build-catalog-art");

console.log(
  `build-catalog-art: ${domain} via ${source} — ${stats.pictured} pictured, ${stats.noImage} with no image at the source, ` +
  `${stats.refused} refused on licence, ${stats.skipped} skipped; ${rows.size} row(s) in ${ART_DIR}/${domain}/${CREDITS_FILE}`,
);
for (const [why, n] of [...refusals.entries()].sort((a, b) => b[1] - a[1])) console.log(`  refused ${n}: ${why}`);
console.log("Now: npm run check:catalog-art, then commit web/catalog-art/ and src/v2/data/catalogArtIndex.ts together.");
