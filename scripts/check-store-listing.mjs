// Hold design/store/listing.json against the two stores' field limits.
//
//   npm run check:store-listing
//
// Why a gate for marketing copy: both consoles reject an over-length
// field at the END of a long manual form, after everything else has been
// typed in, and some upload tooling silently truncates Apple's keywords
// field instead of rejecting it — so a listing can go live with the last
// keywords quietly missing. Counting them here costs nothing.
//
// Limits are the published App Store Connect / Play Console maxima.
// Apple counts UTF-16 code units; a plain .length in JS is the same
// measure, which is why nothing here reaches for Intl.Segmenter. The
// copy is ASCII apart from bullets and em dashes, all of which are one
// unit each — but emoji would not be, so if the copy ever gains one,
// this comment is the warning that the count stops being naive.
//
// Deliberately NOT on backend-checks.yml: it says nothing about backend
// correctness, and CLAUDE.md keeps client-only checks off the path that
// guards an emergency rules deploy.

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "design/store/listing.json";

const LIMITS = {
  "apple.name": 30,
  "apple.subtitle": 30,
  "apple.promotionalText": 170,
  "apple.keywords": 100,
  "apple.description": 4000,
  "apple.whatsNew": 4000,
  "play.title": 30,
  "play.shortDescription": 80,
  "play.fullDescription": 4000,
};

// Fields that must exist and be non-empty, beyond the ones with limits.
const REQUIRED = [
  "shared.privacyPolicyUrl", "shared.supportUrl", "shared.bundleId",
  "apple.primaryCategory", "play.category",
];

let listing;
try {
  listing = JSON.parse(readFileSync(join(root, FILE), "utf8"));
} catch (e) {
  console.error(`check-store-listing: cannot read ${FILE} — ${e.message}`);
  process.exit(1);
}

const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), listing);

const problems = [];
const placeholders = [];

for (const [path, max] of Object.entries(LIMITS)) {
  const v = get(path);
  if (typeof v !== "string" || !v.trim()) { problems.push(`${path} is missing or empty`); continue; }
  if (v.length > max) problems.push(`${path} is ${v.length} chars, max ${max} (over by ${v.length - max})`);
}

for (const path of REQUIRED) {
  const v = get(path);
  if (typeof v !== "string" || !v.trim()) problems.push(`${path} is missing or empty`);
}

// Apple's keywords field is comma-separated with no spaces after commas —
// a space costs a character out of the 100 and buys nothing.
const kw = get("apple.keywords");
if (typeof kw === "string" && /,\s/.test(kw)) {
  problems.push("apple.keywords has a space after a comma — Apple counts it against the 100-char budget");
}

// Owner-gated facts, reported the way check-store-copy reports its own.
const walk = (obj, path = []) => {
  for (const [k, v] of Object.entries(obj || {})) {
    if (k.startsWith("_")) continue;
    if (typeof v === "string" && /SET_BEFORE_LAUNCH|REPLACE_WITH_/.test(v)) placeholders.push([...path, k].join("."));
    else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, [...path, k]);
  }
};
walk(listing);

for (const [path, max] of Object.entries(LIMITS)) {
  const v = get(path);
  if (typeof v === "string") console.log(`  ${String(v.length).padStart(4)} / ${String(max).padEnd(4)} ${path}`);
}

if (placeholders.length) {
  console.log(`\ncheck-store-listing: ${placeholders.length} owner-gated placeholder(s), same class as check:store-copy:`);
  for (const p of placeholders) console.log(`  - ${p}`);
  console.log("  These do not fail the check — they are facts, not mistakes.");
}

if (problems.length) {
  console.error(`\ncheck-store-listing: ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("\ncheck-store-listing OK — every field inside its store limit.");
