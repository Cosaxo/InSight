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
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(root, "public", "cities.txt");

// Must match BREAKDOWN_MAX_LABEL in functions/src/pure.ts. A city that
// cannot be a bucket key would be pickable in the profile and then absent
// from every breakdown — the silent failure this whole check exists for.
const MAX_BUCKET = 40;

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
  if (parts.length !== 2) {
    errors.push(`${at}: expected exactly one tab, got ${parts.length - 1}`);
    continue;
  }
  const [name, pop] = parts;
  if (!name) errors.push(`${at}: empty city name`);
  if (name !== name.trim()) errors.push(`${at}: city name has edge whitespace: ${JSON.stringify(name)}`);
  if (!/^\d+$/.test(pop)) errors.push(`${at}: population is not a positive integer: ${JSON.stringify(pop)}`);
  const bucket = `${name}, ${country}`;
  if (bucket.length > MAX_BUCKET) {
    errors.push(`${at}: bucket key ${JSON.stringify(bucket)} is ${bucket.length} chars (max ${MAX_BUCKET})`);
  }
  // The characters breakdownBucket() in functions/src/pure.ts rejects. A
  // name containing one is unpickable-but-offered, the same silent hole.
  if (/[./[\]*~]/.test(bucket)) {
    errors.push(`${at}: bucket key ${JSON.stringify(bucket)} contains a character breakdownBucket rejects`);
  }
  if (seen.has(bucket)) errors.push(`${at}: duplicate bucket key ${JSON.stringify(bucket)}`);
  seen.add(bucket);
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
