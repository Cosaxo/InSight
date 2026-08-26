// The seed's field whitelist, held to what the generator actually emits.
//
// WHY THIS EXISTS, and the answer is "three times". A seeded question doc
// is assembled from a WHITELIST in `runSeedV2` (functions/src/v2.ts), not
// from a spread — deliberately, because /content carries authoring fields
// that have no business on a device. The cost of a whitelist is that it
// has to be kept in step with the generator, and nothing was keeping it:
//
//   D234 (2026-08-21)  core, tag, rates, until, sponsor, also, tier,
//                      resolvesAt, rubric, mode, branch, sub — twelve
//                      fields promised by SCHEMA-V2.md, read by the
//                      client, written by nothing, for two releases.
//   D281 (2026-08-24)  bg — the background the feed's `i` opens. The
//                      card would have kept showing the empty sheet.
//   D284 (2026-08-24)  c, t, p, k, w — the learn card itself. This one
//                      was worse than dark: the client DROPS a learn card
//                      with no `c` rather than guessing an answer key, so
//                      Learn would have gone permanently empty on every
//                      live device.
//
// Every one of those passed `tsc`, `check:content`, the unit suites and
// the mount tests, because every test seeds its own fixtures — the bank
// under test always had the field, and only production did not. D234's own
// record says a field the seed does not name never reaches Firestore. It
// said so in a comment, twice, above the two places the next fields died.
//
// WHAT THIS COMPARES. Four copies of one list have to agree, and this
// walks all four:
//
//   1. the generator's emitted keys  (scripts/gen-v2content.mjs, run for
//      real over /content — the union of keys across every entry)
//   2. the payload whitelist         (functions/src/v2.ts)
//   3. SEEDED_FIELDS                 (functions/src/pure.ts — the compare,
//      without which an edit to an existing doc can never land)
//   4. the test mirror               (functions/src/seed.test.ts's
//      storedForm — without which the no-op case reports phantom writes)
//
// Read from the SOURCES rather than imported, for 2 and 4: importing
// v2.ts pulls firebase-admin and the whole function surface into a Node
// script, and `storedForm` is not exported. The scan is deliberately dumb
// — the emit-when-set idiom is one line per field and has been for every
// field ever added, so a regex over it is not a heuristic, it is reading
// the list.
//
// WHAT IS DELIBERATELY NOT AN ERROR: a field in the payload that the
// generator never emits. That is how a field is retired — the generator
// stops writing it, the payload keeps transporting nothing, and
// SEEDED_FIELDS keeps comparing so `FieldValue.delete()` can remove it
// from standing docs (D234's amendment). Reported as a note, not a fail.

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntries, loadContent } from "./gen-v2content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// `id` is the document NAME, never a field on it; `active` is written only
// on first create and deliberately never compared (a reseed must not fight
// the operator's kill switch); `updatedAt` is the seed's own stamp.
const NOT_FIELDS = new Set(["id", "active", "updatedAt"]);

// Fields the generator emits DELIBERATELY WITHOUT transporting — authoring
// metadata whose consumer does not exist yet. Listed with the reason, the
// `NOT_SEEDED` shape in check-content.mjs, and stale entries fail: a field
// listed here that the generator has stopped emitting, or one that has
// since grown a transport, is a note nobody re-read.
//
// The bar for adding a line is that NOTHING ON A DEVICE READS IT. If a
// client reader exists, the field is dark rather than deliberate, and dark
// is what this gate is for.
const NOT_TRANSPORTED = {
  political:
    "D52's authoring marker on politically charged questions. Six feed "
    + "entries carry it and no client reader exists — every `political` in "
    + "src/ names the political TEST instrument, not this flag. So it is "
    + "content-layer metadata the question farm and check:quality reason "
    + "about, not a fact a card needs, and transporting it would ship a "
    + "field for nobody. The moment a reader appears (the kicker keyed on "
    + "it, the passive-collection marker D52 describes), delete this entry "
    + "and add the three transports — the gate will then insist.",
};

/** Every key the generator actually puts on a question, over the real bank. */
function emittedFields() {
  const keys = new Set();
  for (const q of buildEntries(loadContent())) {
    for (const k of Object.keys(q)) if (!NOT_FIELDS.has(k)) keys.add(k);
  }
  return keys;
}

/**
 * The field names a source assigns into an object literal, by the two
 * idioms this tree uses: `...(cond ? { name: … } : {})` and a plain
 * `name: q.name,`. Scoped to a named region so the scan cannot wander
 * into an unrelated literal in the same file.
 */
function fieldsIn(src, startMarker, endMarker, at) {
  const from = src.indexOf(startMarker);
  if (from < 0) throw new Error(`${at}: could not find ${JSON.stringify(startMarker)}`);
  const to = src.indexOf(endMarker, from);
  if (to < 0) throw new Error(`${at}: could not find ${JSON.stringify(endMarker)} after it`);
  // Comments stripped first, and for the reason the SEEDED_FIELDS scan
  // gives: these blocks are more prose than code, and a field name written
  // in a comment would satisfy the check without reaching the object.
  const region = src.slice(from, to).replace(/\/\/[^\n]*/g, "");
  const keys = new Set();
  // `...(cond ? { name: … } : {})` — the emit-when-set idiom.
  for (const m of region.matchAll(/\{\s*([A-Za-z_$][\w$]*)\s*:/g)) keys.add(m[1]);
  // `name: q.name,` — the always-written fields. NOT anchored to the line
  // start: storedForm packs several onto one line (`surface: q.surface,
  // seq: q.seq, type: q.type,`), and an anchored pattern saw only the
  // first of each, reporting six fields as missing that were right there.
  for (const m of region.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*q\./g)) keys.add(m[1]);
  for (const k of NOT_FIELDS) keys.delete(k);
  return keys;
}

/** SEEDED_FIELDS' string literals. */
function seededFields() {
  const src = readFileSync(join(root, "functions", "src", "pure.ts"), "utf8");
  const from = src.indexOf("export const SEEDED_FIELDS = [");
  if (from < 0) throw new Error("pure.ts: SEEDED_FIELDS not found");
  const to = src.indexOf("] as const;", from);
  const region = src.slice(from, to);
  // Strings only, and comments are stripped first: these blocks are mostly
  // prose, and a field name quoted inside a comment would satisfy the check
  // without reaching the array.
  const code = region.replace(/\/\/[^\n]*/g, "");
  return new Set([...code.matchAll(/"([\w$]+)"/g)].map((m) => m[1]));
}

const emitted = emittedFields();
const payload = fieldsIn(
  readFileSync(join(root, "functions", "src", "v2.ts"), "utf8"),
  "const payload: Record<string, unknown> = {",
  "seedDocMatches(stored.get(q.id), payload)",
  "functions/src/v2.ts",
);
const compared = seededFields();
const mirrored = fieldsIn(
  readFileSync(join(root, "functions", "src", "seed.test.ts"), "utf8"),
  "function storedForm(",
  "...overrides,",
  "functions/src/seed.test.ts",
);

const problems = [];
const missing = (label, have, why) => {
  for (const f of [...emitted].sort()) {
    if (NOT_TRANSPORTED[f] || have.has(f)) continue;
    problems.push(`\`${f}\` is emitted by the generator but is not in ${label} — ${why}`);
  }
};

for (const [f, why] of Object.entries(NOT_TRANSPORTED)) {
  if (!emitted.has(f)) {
    problems.push(`NOT_TRANSPORTED lists \`${f}\` ("${why}") but the generator no longer emits it — drop the entry`);
  } else if (payload.has(f)) {
    problems.push(`NOT_TRANSPORTED lists \`${f}\` as deliberately untransported, but the payload carries it — drop the entry, the ordinary rules cover it now`);
  }
}
missing(
  "runSeedV2's payload (functions/src/v2.ts)",
  payload,
  "a field the seed does not name NEVER REACHES FIRESTORE, and every gate stays green because tests seed their own fixtures",
);
missing(
  "SEEDED_FIELDS (functions/src/pure.ts)",
  compared,
  "a field the compare ignores is a field an edit can never move: the doc is written once at create and frozen thereafter",
);
missing(
  "storedForm (functions/src/seed.test.ts)",
  mirrored,
  "that mirror is what the no-op case asserts against, so without it every doc carrying the field reports as a phantom rewrite",
);

// ── the same disagreement, one level down: PER SURFACE (D311) ────────
//
// The union above answers "is `bg` transported at all", and the answer
// stayed yes while the DAILY builder dropped it: the feed's emit covered
// for every surface, the daily bank's seven context texts silently never
// shipped, and the production seed's own `written` count (51 where 58
// was owed) was the only thing anywhere that disagreed. So the union
// check gains a per-entry half for the banks the lanes write into —
// daily, feed, pick, the ones whose entries carry ids — holding that a
// top-level source field the generator emits ANYWHERE is emitted on that
// entry's own doc. Fields renamed on emit (`cat` → branch/sub, `tone` →
// topic) never appear in the emitted union under their source names, so
// they cannot false-positive here.
{
  const content = loadContent();
  const byId = new Map();
  for (const q of buildEntries(content)) byId.set(q.id, q);
  const banks = [
    ["daily", content.daily, (q) => `daily-${q.id}`],
    ["feed", content.feed.questions, (q) => `feed-${q.id}`],
    ["pick", content.pick.questions, (q) => `pick-${q.id}`],
  ];
  for (const [bank, list, docId] of banks) {
    for (const src of list) {
      const doc = byId.get(docId(src));
      if (!doc) continue; // not emitted at all — not this rule's business
      for (const f of Object.keys(src)) {
        if (NOT_FIELDS.has(f) || NOT_TRANSPORTED[f] || !emitted.has(f)) continue;
        // A falsy source value emitting nothing IS the emit-when-set
        // idiom's contract (`core: false` means tail exactly like an
        // absent `core`, D161) — the disease is a truthy value that
        // never ships.
        if (!src[f]) continue;
        if (!(f in doc)) {
          problems.push(
            `\`${f}\` on ${bank} ${JSON.stringify(String(src.id))} is in the source and in the generator's emitted union, `
            + `but the ${bank} builder drops it — it ships on other surfaces and silently not on this one`,
          );
        }
      }
    }
  }
}

const retired = [...payload].filter((f) => !emitted.has(f)).sort();

if (problems.length) {
  console.error("check:seed-fields FAILED — the seed's copies of the field list disagree:\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    "\n  This has happened three times (D234, D281, D284) and the third would\n"
    + "  have emptied Learn on every live device. Add the field to each place\n"
    + "  named above; the emit-when-set idiom beside its neighbours is the\n"
    + "  whole change.",
  );
  process.exit(1);
}

console.log(
  `check-seed-fields OK — ${emitted.size} generated fields, all transported, compared and mirrored`
  + (retired.length ? `; ${retired.length} retired field(s) still transported for deletion: ${retired.join(", ")}` : ""),
);
