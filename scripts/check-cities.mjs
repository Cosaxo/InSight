// Validates the committed city catalogue (public/cities.txt) against the
// contract src/v2/data/places.ts parses it under.
//
// Deliberately does NOT regenerate from `all-the-cities`: that package is
// ~10 MB and is a one-off authoring tool, so requiring it here would put it
// in every CI install to guard a file that changes twice a year. What can
// actually break at runtime is the *committed file* — a stray tab, a bucket
// key over the 40-char limit, a country block that lost its cities — and all
// of that is checkable from the file alone, everywhere, for free.
//
// Regeneration stays a manual step: `npm run build:cities`.
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { stripComments } from "./strip-comments.mjs";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(root, "public", "cities.txt");

// READ OUT OF functions/src/pure.ts, not copied. A city that cannot be a
// bucket key would be pickable in the profile and then absent from every
// breakdown — the silent failure this whole check exists for — and a
// hand-maintained copy of the bound is one more way to arrive there. Same
// argument check-pokedex.mjs already makes by cross-reading
// CATALOG_MAX_ENTITY, and the one D39 makes about figures in prose.
// COMMENTS ARE BLANKED BEFORE ANY OF THIS IS MATCHED, and it is not tidying.
// Every read below is a regex over raw source that takes the FIRST match, so a
// retuned value with its old line parked above it —
//     // was: <the old line>
//     <the new line>
// — made the gate report the SUPERSEDED number and exit 0. Measured on the real
// tree 2026-09-05. This is the same defect check:devicebind and check:ios-location
// carried until 2026-09-04, where a commented-out call read as a live one; here it
// is worse, because the gate reads a VALUE rather than merely a presence.
// strip-comments.mjs blanks rather than deletes, so every offset and line number
// this gate reports still points at the real file.
const PURE = stripComments(readFileSync(join(root, "functions", "src", "pure.ts"), "utf8"));
function fromPure(pattern, what) {
  const m = PURE.match(pattern);
  if (!m) {
    console.error(`check-cities: could not read ${what} from functions/src/pure.ts.`);
    console.error("Fix the pattern in this script rather than restating the value.");
    process.exit(1);
  }
  return m[1];
}
const MAX_BUCKET = Number(fromPure(/BREAKDOWN_MAX_LABEL = (\d+)/, "BREAKDOWN_MAX_LABEL"));
// …and the character class breakdownBucket rejects, for the same reason.
const REJECT = new RegExp(
  fromPure(/if \(\/(\[[^\n]*?)\/\.test\(v\)\) return null;/, "the rejected character class"),
);

let text;
try {
  text = readFileSync(FILE, "utf8");
} catch {
  console.error(`check:cities: ${FILE} is missing. Run \`npm run build:cities\`.`);
  process.exit(1);
}

const errors = [];
const lines = text.split("\n");
let country = null;
let cities = 0;
const countries = new Set();
const perCountry = new Map();
const seen = new Set();
const coords = new Map();
let headerCount = null;
let headerCountries = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const at = `line ${i + 1}`;
  if (line === "") continue;
  if (line.startsWith("#")) {
    const m = line.match(/# (\d+) places in (\d+) countries/);
    if (m) {
      headerCount = Number(m[1]);
      headerCountries = Number(m[2]);
    }
    continue;
  }
  if (!line.includes("\t")) {
    // A country header.
    if (!/^[A-Z]{2}$/.test(line)) {
      errors.push(`${at}: expected a 2-letter country code, got ${JSON.stringify(line)}`);
      continue;
    }
    if (countries.has(line)) errors.push(`${at}: country ${line} opens a second block`);
    country = line;
    countries.add(line);
    perCountry.set(line, 0);
    continue;
  }
  // A city row.
  if (!country) {
    errors.push(`${at}: city row before any country header`);
    continue;
  }
  const parts = line.split("\t");
  if (parts.length !== 4) {
    errors.push(`${at}: expected exactly three tabs (name, pop, lat, lon), got ${parts.length - 1}`);
    continue;
  }
  const [name, pop, latS, lonS] = parts;
  if (!name) errors.push(`${at}: empty city name`);
  if (name !== name.trim()) errors.push(`${at}: city name has edge whitespace: ${JSON.stringify(name)}`);
  if (!/^\d+$/.test(pop)) errors.push(`${at}: population is not a positive integer: ${JSON.stringify(pop)}`);
  // Coordinates drive nearest-city resolution on the device. A swapped
  // lat/lon or a stray value does not crash anything — it silently puts
  // someone in the wrong city, which is the failure this catches.
  const lat = Number(latS);
  const lon = Number(lonS);
  if (!/^-?\d+(\.\d+)?$/.test(latS) || !(lat >= -90 && lat <= 90)) {
    errors.push(`${at}: latitude out of range or malformed: ${JSON.stringify(latS)}`);
  }
  if (!/^-?\d+(\.\d+)?$/.test(lonS) || !(lon >= -180 && lon <= 180)) {
    errors.push(`${at}: longitude out of range or malformed: ${JSON.stringify(lonS)}`);
  }
  // 0,0 is in the Gulf of Guinea. It is what a missing coordinate looks
  // like once it has been through Number(), and it would silently become
  // the nearest city for anyone whose fix failed to parse.
  if (lat === 0 && lon === 0) errors.push(`${at}: null-island coordinate (0,0)`);
  const bucket = `${name}, ${country}`;
  if (bucket.length > MAX_BUCKET) {
    errors.push(`${at}: bucket key ${JSON.stringify(bucket)} is ${bucket.length} chars (max ${MAX_BUCKET})`);
  }
  // The characters breakdownBucket() rejects (read from pure.ts above). A
  // name containing one is unpickable-but-offered, the same silent hole.
  if (REJECT.test(bucket)) {
    errors.push(`${at}: bucket key ${JSON.stringify(bucket)} contains a character breakdownBucket rejects`);
  }
  if (seen.has(bucket)) errors.push(`${at}: duplicate bucket key ${JSON.stringify(bucket)}`);
  seen.add(bucket);
  coords.set(`${country} ${name}`, { lat, lon });
  perCountry.set(country, perCountry.get(country) + 1);
  cities++;
}

// A country block with no cities is the shape a bad regeneration takes: the
// header survives, the rows do not, and the picker shows an empty country.
for (const [code, n] of perCountry) {
  if (n === 0) errors.push(`country ${code} has a header but no cities`);
}

// The header counts are what a human reads to sanity-check a regeneration.
// If they drift from the body they are worse than absent.
if (headerCount !== null && headerCount !== cities) {
  errors.push(`header says ${headerCount} places, body has ${cities}`);
}
if (headerCountries !== null && headerCountries !== countries.size) {
  errors.push(`header says ${headerCountries} countries, body has ${countries.size}`);
}
if (headerCount === null) errors.push("header is missing its `N places in M countries` line");

// Floors, not targets: catch a truncated or half-written file, which would
// otherwise pass every per-line check above.
if (cities < 9000) errors.push(`only ${cities} cities — expected ~10.9k; the file looks truncated`);
if (countries.size < 200) errors.push(`only ${countries.size} countries — expected ~245`);

// A GLOBAL lat/lon swap passes every per-row range check — Oslo reversed is
// (10.75, 59.91), and both halves are still legal numbers. It would simply
// relocate the entire world and put every user in the wrong city. So a
// handful of places are pinned to where they actually are.
const FIXTURES = [
  ["Oslo", "NO", 59.91, 10.75],
  ["Tokyo", "JP", 35.69, 139.69],
  ["Buenos Aires", "AR", -34.61, -58.38],
  ["Sydney", "AU", -33.87, 151.21],
  ["Reykjavík", "IS", 64.14, -21.90],
];
for (const [name, cc, lat, lon] of FIXTURES) {
  const got = coords.get(`${cc} ${name}`);
  if (!got) {
    errors.push(`fixture ${name}, ${cc} is missing from the catalogue`);
    continue;
  }
  // 0.2° ≈ 22 km — loose enough to survive GeoNames moving a city centroid,
  // tight enough that a swap, a sign flip or a wrong row cannot pass.
  if (Math.abs(got.lat - lat) > 0.2 || Math.abs(got.lon - lon) > 0.2) {
    errors.push(
      `fixture ${name}, ${cc} is at ${got.lat},${got.lon} — expected near ${lat},${lon}`,
    );
  }
}

if (errors.length) {
  console.error(`check:cities: ${errors.length} problem(s) in public/cities.txt`);
  for (const e of errors.slice(0, 25)) console.error(`  ${e}`);
  if (errors.length > 25) console.error(`  … and ${errors.length - 25} more`);
  process.exit(1);
}

console.log(
  `check:cities OK — ${cities} places, ${countries.size} countries, ` +
    `${(text.length / 1024).toFixed(0)} KB`,
);
