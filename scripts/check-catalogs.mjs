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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function parseCatalogue(file, label) {
  const keys = [];
  if (!existsSync(file)) return { present: false, keys };
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
    count += 1;
  }
  if (headerCount !== null && headerCount !== count) {
    errors.push(`${label}: header says ${headerCount} entries, file has ${count}`);
  }
  return { present: true, keys };
}

const films = parseCatalogue(join(root, "public", "films.txt"), "films.txt");
const artists = parseCatalogue(join(root, "public", "artists.txt"), "artists.txt");
const emoji = parseCatalogue(join(root, "public", "emoji.txt"), "emoji.txt");

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
    `emoji ${emoji.present ? emoji.keys.length : "absent"}, key sets agree`,
);
