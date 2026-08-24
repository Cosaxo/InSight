// Validates the committed films/artists catalogues (public/films.txt,
// public/artists.txt) and their agreement with the trigger's key sets in
// functions/src/catalogKeys.ts.
//
// The agreement is the load-bearing part, and it binds in BOTH directions,
// including absence: a catalogue file with no matching key set means
// species clients can pick that never aggregate; a key set with no file
// means the trigger accepts answers no client can produce. Both-empty must
// agree too — which is why this gate runs from day one, before any
// catalogue has been generated (D15: generation is an operator step,
// scripts/build-catalog.mjs, because it needs network access to Wikidata).
//
// Unlike pokedex, keys here are Wikidata QID numeric parts — sparse, NOT
// contiguous — so the format checks are uniqueness and monotonic-none:
// key uniqueness, name uniqueness (search must resolve unambiguously),
// and the same corruption rules as every catalogue file.
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseReview } from "./catalog-curate-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function parseCatalogue(file, label) {
  const keys = [];
  const names = new Map();
  if (!existsSync(file)) return { present: false, keys, names };
  const lines = readFileSync(file, "utf8").split("\n");
  const seenKeys = new Set();
  const seenNames = new Set();
  let headerCount = null;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = `${label} line ${i + 1}`;
    if (line === "") {
      if (i !== lines.length - 1) errors.push(`${at}: blank line inside the file`);
      continue;
    }
    if (line.endsWith("\r")) {
      errors.push(`${at}: CRLF line ending — the parser splits on \\n only`);
      continue;
    }
    if (line.startsWith("#")) {
      const m = line.match(/# (\d+) entries/);
      if (m) headerCount = Number(m[1]);
      continue;
    }
    const m = line.match(/^(\d+)\t(.+)$/);
    if (!m) {
      errors.push(`${at}: not \`key<TAB>name\`: ${JSON.stringify(line)}`);
      continue;
    }
    const key = Number(m[1]);
    const name = m[2];
    if (key < 1) errors.push(`${at}: key ${key} — 0 is the Not-listed bucket, never an entry`);
    if (seenKeys.has(key)) errors.push(`${at}: duplicate key ${key}`);
    seenKeys.add(key);
    if (name !== name.trim()) errors.push(`${at}: name has surrounding whitespace`);
    const nk = name.toLowerCase();
    if (seenNames.has(nk)) errors.push(`${at}: duplicate name ${JSON.stringify(name)}`);
    seenNames.add(nk);
    keys.push(key);
    names.set(key, name);
    count += 1;
  }
  if (headerCount !== null && headerCount !== count) {
    errors.push(`${label}: header says ${headerCount} entries, file has ${count}`);
  }
  return { present: true, keys, names };
}

const films = parseCatalogue(join(root, "public", "films.txt"), "films.txt");
const artists = parseCatalogue(join(root, "public", "artists.txt"), "artists.txt");
const emoji = parseCatalogue(join(root, "public", "emoji.txt"), "emoji.txt");
const countries = parseCatalogue(join(root, "public", "countries.txt"), "countries.txt");
const dogs = parseCatalogue(join(root, "public", "dogs.txt"), "dogs.txt");
const colors = parseCatalogue(join(root, "public", "colors.txt"), "colors.txt");

// Countries-only invariants: the catalogue's one minted key is Kosovo's
// 900 (build-countries.mjs header) — every other key must be a 3-digit
// ISO code, and the mint must stay present: losing it on a regeneration
// would orphan every stored Kosovo answer, which is the exact failure
// the never-from-memory rule exists to prevent.
if (countries.present) {
  if (!countries.keys.includes(900)) {
    errors.push("countries.txt: minted key 900 (Kosovo) is missing — regeneration dropped a recorded mint");
  }
  for (const k of countries.keys) {
    if (k !== 900 && (k < 1 || k > 899)) {
      errors.push(`countries.txt: key ${k} outside the ISO numeric range and not the recorded mint`);
    }
  }
}

// Dogs-only invariant: keys are catalogue-minted (build-dogs.mjs) under
// the append-only discipline — the initial mint was 1..N and entries
// never renumber or leave, so the keys stay exactly 1..N contiguous. A
// hole or an out-of-range key means a hand-edit or a broken mint, both
// of which orphan stored answers.
if (dogs.present) {
  const sorted = [...dogs.keys].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      errors.push(`dogs.txt: minted keys must be contiguous from 1 — expected ${i + 1}, found ${sorted[i]}`);
      break;
    }
  }
}

// Colors-only invariant: each key IS the colour plus one —
// 1 + parseInt(hex, 16), the offset keeping black off the Not-listed
// key 0 — so every key sits in 1..0x1000000, and three spec anchors pin
// the derivation itself: black #000000, rebeccapurple #663399, white
// #ffffff. A key outside the range or a moved anchor means the
// derivation changed, which re-keys stored favourites.
if (colors.present) {
  for (const k of colors.keys) {
    if (k < 1 || k > 0x1000000) {
      errors.push(`colors.txt: key ${k} outside 1..0x1000000 — the +1 hex derivation`);
    }
  }
  const want = [[1, "black"], [0x66339a, "rebeccapurple"], [0x1000000, "white"]];
  for (const [k, name] of want) {
    if (colors.names.get(k) !== name) {
      errors.push(`colors.txt: expected key ${k} to be ${name}, found ${colors.names.get(k) ?? "absent"}`);
    }
  }
}

// ── the artists domain's reviewed exceptions (D256) ────────────────────
// content/artist-review.json is the one catalogue input a human edits by
// hand, so it is the one that can go stale without anybody running
// anything: the builder needs Wikidata and is an operator step, while this
// runs on every push.
//
// The shape contract comes from catalog-curate-lib.mjs rather than a
// second parser here. That is a deliberate exception to this file's
// independence stance, and the line is: the KEY derivation stays
// independent (a gate sharing the builder's derivation shares its bugs),
// but a hand-edited file's contract should have exactly one definition,
// or the gate and the builder disagree about what is legal and the
// operator learns which one was right at 3am. The cross-check below —
// review against the COMMITTED catalogue — is this file's own and shares
// nothing.
{
  const REVIEW = join(root, "content", "artist-review.json");
  let raw = null;
  try {
    raw = JSON.parse(readFileSync(REVIEW, "utf8"));
  } catch (e) {
    errors.push(`content/artist-review.json: ${existsSync(REVIEW) ? `unparseable — ${e.message}` : "missing"}`);
  }
  if (raw) {
    const review = parseReview(raw);
    for (const e of review.errors) errors.push(`content/artist-review.json ${e}`);

    // Both directions against the committed catalogue, and only when it
    // exists: absence is the designed state for this domain (D255), and a
    // review file with no catalogue yet is exactly what a filled-in
    // ruling looks like the moment before the operator runs the builder.
    if (artists.present) {
      const inCatalogue = new Set(artists.keys);
      for (const [qid, entry] of review.reject) {
        if (inCatalogue.has(qid)) {
          errors.push(
            `artists.txt still carries ${entry.name} (Q${qid}), which content/artist-review.json `
            + "rejects — re-run scripts/build-catalog.mjs artists, never hand-edit the catalogue",
          );
        }
      }
      for (const [qid, entry] of review.admit) {
        if (!inCatalogue.has(qid)) {
          errors.push(
            `content/artist-review.json admits ${entry.name} (Q${qid}) but artists.txt does not `
            + "carry them — re-run scripts/build-catalog.mjs artists",
          );
        }
      }
      // A name in the review that disagrees with the catalogue's name for
      // the same key means the reviewer ruled on somebody else. The keys
      // are what bind, so this is the only place the names are checked
      // against anything.
      for (const [qid, entry] of [...review.reject, ...review.admit]) {
        const name = artists.names.get(qid);
        if (name && name !== entry.name) {
          errors.push(
            `content/artist-review.json calls Q${qid} ${JSON.stringify(entry.name)}, `
            + `artists.txt calls it ${JSON.stringify(name)} — one of them is ruling on the wrong person`,
          );
        }
      }
    }
  }
}

// Agreement with the trigger's compiled-in sets: re-derive and compare.
const KEYS_FILE = join(root, "functions", "src", "catalogKeys.ts");
function declaredKeys(source, name) {
  const m = source.match(new RegExp(`export const ${name}[^=]*= new Set<number>\\((\\[[^\\]]*\\])?\\)`));
  if (!m) return null;
  if (!m[1]) return [];
  return m[1]
    .replace(/[[\]\s]/g, "")
    .split(",")
    .filter(Boolean)
    .map(Number);
}
let src = null;
try {
  src = readFileSync(KEYS_FILE, "utf8");
} catch {
  errors.push("functions/src/catalogKeys.ts is missing — run scripts/build-catalog.mjs");
}
if (src !== null) {
  for (const [name, cat, label] of [
    ["FILM_KEYS", films, "films.txt"],
    ["ARTIST_KEYS", artists, "artists.txt"],
    ["EMOJI_KEYS", emoji, "emoji.txt"],
    ["COUNTRY_KEYS", countries, "countries.txt"],
    ["DOG_KEYS", dogs, "dogs.txt"],
    ["COLOR_KEYS", colors, "colors.txt"],
  ]) {
    const declared = declaredKeys(src, name);
    if (declared === null) {
      errors.push(`catalogKeys.ts: no parseable ${name} declaration`);
      continue;
    }
    const got = [...declared].sort((a, b) => a - b).join(",");
    const want = [...cat.keys].sort((a, b) => a - b).join(",");
    if (got !== want) {
      errors.push(
        `${name} disagrees with ${label} (${declared.length} vs ${cat.keys.length} keys` +
          `${cat.present ? "" : "; file absent"}) — run scripts/build-catalog.mjs, never hand-edit`,
      );
    }
  }
}

if (errors.length) {
  console.error(`check:catalogs: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `check:catalogs OK — films ${films.present ? films.keys.length : "absent"}, ` +
    `artists ${artists.present ? artists.keys.length : "absent"}, ` +
    `emoji ${emoji.present ? emoji.keys.length : "absent"}, ` +
    `countries ${countries.present ? countries.keys.length : "absent"}, ` +
    `dogs ${dogs.present ? dogs.keys.length : "absent"}, ` +
    `colors ${colors.present ? colors.keys.length : "absent"}, key sets agree`,
);
