// Promote merged archive questions (the dqx series) into the live daily
// seed — the mechanical half of QUESTION-FARM.md "Promoting questions
// into the live seed" (Phase B, D30). The script exists because the
// dangerous step is transcription, not judgement: live hydration joins
// the seeded bank to the demo layer by PROMPT-STRING EQUALITY (liveSync
// in daily-questions.js), so a hand-retyped prompt silently unhooks the
// question from the Map forever. This copies byte-for-byte or not at
// all. The PICKING stays human — you name the ids, and the resulting
// diff is the promotion PR the manual requires.
//
//   npm run promote -- --source farm dqx13 dqx14
//
// Refuses: non-dqx ids (the original 30 are already live), unknown ids,
// and prompts already present in the seed (a re-promotion). On success
// it appends to content/daily-questions.json with the next free id,
// records each question's provenance row in content/provenance.json
// (D97 — the vintage join the scorecard's `production` section reads;
// --source names who wrote the archive entry, --batch labels the vintage
// and defaults to today's UTC date), and regenerates
// functions/src/v2content.ts (build:content); check:content and
// check:quality then re-verify all three on CI — a promotion without its
// provenance row fails the gate, which is what makes the flag
// unforgettable. Ids in the seed are explicit and append-only — the deck
// epoch (D30) makes appends remap nothing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { CATALOG_FILES } from "./gen-v2content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = join(root, "src", "v2", "spec", "daily-questions.js");
const SEED = join(root, "content", "daily-questions.json");
const PROV = join(root, "content", "provenance.json");

const argv = process.argv.slice(2).filter((a) => a !== "--");
const SOURCES = new Set(["editorial", "farm", "community"]);
const flagOf = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const source = flagOf("--source");
const batch = flagOf("--batch") || new Date().toISOString().slice(0, 10);
// D162's review verdict, written onto the provenance row so "reviewed" is a
// fact rather than a claim. Required for farm/community; refused for
// editorial, because editorial IS the human and a review row there would be
// a person certifying their own writing.
const reviewBy = flagOf("--review");
// Which promoted ids were in the human audit sample. Named rather than
// counted: "3 of these were audited" cannot be checked later, and the whole
// point of the sample is that it is verifiable after the fact.
const auditedIds = new Set((flagOf("--audited") || "").split(",").map((x) => x.trim()).filter(Boolean));
const ids = argv;
const usage =
  "promote: name a source and at least one archive id, e.g. " +
  "`npm run promote -- --source farm --review ai --audited dqx13 dqx13 dqx14`\n" +
  "  (pk ids — pk04 pk11 … — promote the pick archive into content/pick-questions.json instead)\n" +
  "  --source editorial|farm|community   who wrote the archive entry (D97 provenance)\n" +
  "  --batch YYYY-MM-DD                  vintage label, default today (UTC)\n" +
  "  --review ai|human                   who read it before the bank (D162);" +
  " required for farm/community\n" +
  "  --audited id,id                     which of these ids a person read;" +
  " only with --review ai";
if (!ids.length || !source || !SOURCES.has(source)) {
  console.error(usage);
  process.exit(1);
}
if (source === "editorial") {
  if (reviewBy) {
    console.error("promote: --review is for farm/community — editorial IS the human gate (D162)");
    process.exit(1);
  }
} else if (reviewBy !== "ai" && reviewBy !== "human") {
  console.error(
    `promote: --source ${source} needs --review ai|human — D162, nothing enters the bank unread\n\n${usage}`,
  );
  process.exit(1);
}
if (auditedIds.size && reviewBy !== "ai") {
  console.error("promote: --audited describes the sample taken from an AI review, so it needs --review ai");
  process.exit(1);
}
for (const a of auditedIds) {
  if (!ids.includes(a)) {
    console.error(`promote: --audited names ${a}, which is not among the ids being promoted`);
    process.exit(1);
  }
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(batch)) {
  console.error(`promote: --batch ${JSON.stringify(batch)} is not a YYYY-MM-DD date`);
  process.exit(1);
}

// ── the pick lane (D14 go-live) ─────────────────────────────────────
// Same job, different archive: pick cards live in window.PICK_QS
// (src/v2/spec/pick-data.js, the "favourite X" class) and promote into
// content/pick-questions.json. Ids are kept VERBATIM (pk07 → bank id
// pick-pk07) rather than renumbered like the daily's: the archive id is
// already the stable name the demo store's crowd and BY data key on, and
// a second number would be one more join to get wrong. Mixed-lane
// invocations are refused — one promotion PR per lane keeps the diff
// reviewable as one thing.
const isPickId = (id) => /^pk\d+$/.test(id);
if (ids.some(isPickId) && !ids.every(isPickId)) {
  console.error("promote: dqx and pk ids in one run — promote each lane separately");
  process.exit(1);
}

function extractFrom(source, marker, where) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${marker} not found in ${where}`);
  const open = source.indexOf("[", start);
  let depth = 0;
  for (let j = open; j < source.length; j++) {
    if (source[j] === "[") depth++;
    else if (source[j] === "]") {
      depth--;
      if (depth === 0) return source.slice(open, j + 1);
    }
  }
  throw new Error(`${marker}: unbalanced brackets in ${where}`);
}

if (ids.every(isPickId)) {
  const PICK_SEED = join(root, "content", "pick-questions.json");
  const PICK_QS = vm.runInNewContext(extractFrom(
    readFileSync(join(root, "src", "v2", "spec", "pick-data.js"), "utf8"),
    "window.PICK_QS = [",
    "pick-data.js",
  ));
  // Only domains whose catalogue file is committed under public/ may go
  // live (QUESTION-FARM.md § the daily catalog-question run, rule 2) — a
  // card whose catalogue is absent opens straight into the picker's error
  // state. CATALOG_FILES is the generator's one map (check-content.mjs
  // reads the same import); both read the filesystem rather than a name
  // list, so films became promotable the moment D265 committed its
  // catalogue and artists stays refused until D266's ruling lands.
  const byPk = new Map(PICK_QS.map((q) => [q.id, q]));
  const seed = JSON.parse(readFileSync(PICK_SEED, "utf8"));
  const have = new Set(seed.questions.map((q) => q.id));
  const havePrompts = new Set(seed.questions.map((q) => q.prompt));
  const picked = [];
  for (const id of ids) {
    const q = byPk.get(id);
    if (!q) {
      console.error(`promote: ${id} is not in the pick archive (PICK_QS has ${PICK_QS.length} entries)`);
      process.exit(1);
    }
    if (have.has(id) || havePrompts.has(q.prompt)) {
      console.error(`promote: ${id} ${JSON.stringify(q.prompt)} is already in the live pick seed — refusing a re-promotion`);
      process.exit(1);
    }
    const file = CATALOG_FILES[q.domain];
    if (!file || !existsSync(join(root, "public", file))) {
      console.error(
        `promote: ${id} rides domain ${JSON.stringify(q.domain)}, which has no committed catalogue under public/ — ` +
        "a card whose catalogue is absent opens into the picker's error state (QUESTION-FARM.md rule 2)",
      );
      process.exit(1);
    }
    // Byte-for-byte, the whole point of the script: prompt, domain and cat
    // are COPIED, and check:quality's parity rule holds seed equal to
    // archive by id afterwards.
    seed.questions.push({ id: q.id, domain: q.domain, cat: q.cat, prompt: q.prompt });
    have.add(id);
    havePrompts.add(q.prompt);
    picked.push(q);
  }
  writeFileSync(PICK_SEED, JSON.stringify(seed, null, 2) + "\n");
  const prov = JSON.parse(readFileSync(PROV, "utf8"));
  if (!prov.pick) prov.pick = {};
  for (const q of picked) {
    // No archiveId field: the seed id IS the archive id, so a second copy
    // of it would be a join that can only ever agree or rot.
    prov.pick[q.id] = {
      source,
      batch,
      ...(reviewBy
        ? { review: { by: reviewBy, at: batch, ...(reviewBy === "ai" ? { audited: auditedIds.has(q.id) } : {}) } }
        : {}),
    };
  }
  writeFileSync(PROV, JSON.stringify(prov, null, 2) + "\n");
  execFileSync("node", [join(root, "scripts", "gen-v2content.mjs"), "--write"], { stdio: "inherit" });
  console.log(`promote: appended ${picked.length} pick card(s) to content/pick-questions.json (provenance: ${source}, batch ${batch})`);
  for (const q of picked) console.log(`  ${q.id} → pick-${q.id}  ${JSON.stringify(q.prompt)}`);
  console.log("promote: run `npm run check:content` and `npm run check:quality`, then open the promotion PR (QUESTION-FARM.md § Promoting). After merge + deploy, an operator reseeds.");
  process.exit(0);
}

// The Q array is pure data literals; extract it by bracket-matching and
// evaluate in a bare context. DQ_BASE and the id formula are cross-read
// from the spec the same way the scorecard cross-reads DECK_EPOCH — a
// copy here would drift.
const src = readFileSync(SPEC, "utf8");
function extractArray(name) {
  return extractFrom(src, `const ${name} = [`, "daily-questions.js");
}
const Q = vm.runInNewContext(extractArray("Q"));
const baseM = src.match(/const DQ_BASE = (\d+)/);
if (!baseM) {
  console.error("promote: DQ_BASE not found in daily-questions.js");
  process.exit(1);
}
const DQ_BASE = Number(baseM[1]);
const idOf = (i) =>
  i < DQ_BASE
    ? "dq" + String(DQ_BASE - i).padStart(2, "0")
    : "dqx" + String(i - DQ_BASE + 1).padStart(2, "0");
const byId = new Map(Q.map((q, i) => [idOf(i), q]));

const seed = JSON.parse(readFileSync(SEED, "utf8"));
const seedPrompts = new Set(seed.map((q) => q.prompt));
let nextId = Math.max(...seed.map((q) => Number(q.id))) + 1;

const added = [];
for (const id of ids) {
  if (!/^dqx\d+$/.test(id)) {
    console.error(`promote: ${id} is not a dqx archive id — the original 30 are already live`);
    process.exit(1);
  }
  const q = byId.get(id);
  if (!q) {
    console.error(`promote: ${id} is not in the archive (Q has ${Q.length} entries; the dqx series ends at ${idOf(Q.length - 1)})`);
    process.exit(1);
  }
  if (seedPrompts.has(q.prompt)) {
    console.error(`promote: ${id} ${JSON.stringify(q.prompt)} is already in the live seed — refusing a re-promotion`);
    process.exit(1);
  }
  const entry = { id: String(nextId++).padStart(3, "0"), ...q };
  seed.push(entry);
  seedPrompts.add(q.prompt);
  added.push({ archiveId: id, seedId: entry.id, prompt: q.prompt });
}

writeFileSync(SEED, JSON.stringify(seed, null, 2) + "\n");
// The provenance row rides the same commit as the seed entry, so the two
// can never land separately — check:quality holds them equal on CI.
const prov = JSON.parse(readFileSync(PROV, "utf8"));
for (const a of added) {
  prov.daily[a.seedId] = {
    archiveId: a.archiveId,
    source,
    batch,
    // Emit-when-relevant, matching the flags elsewhere: an editorial row
    // carries no review key at all rather than a null one.
    ...(reviewBy
      ? { review: { by: reviewBy, at: batch, ...(reviewBy === "ai" ? { audited: auditedIds.has(a.archiveId) } : {}) } }
      : {}),
  };
}
writeFileSync(PROV, JSON.stringify(prov, null, 2) + "\n");
execFileSync("node", [join(root, "scripts", "gen-v2content.mjs"), "--write"], { stdio: "inherit" });
console.log(`promote: appended ${added.length} question(s) to content/daily-questions.json (provenance: ${source}, batch ${batch})`);
for (const a of added) console.log(`  ${a.archiveId} → daily-${a.seedId}  ${JSON.stringify(a.prompt)}`);
console.log("promote: run `npm run check:content` and `npm run check:quality`, then open the promotion PR with per-question provenance (QUESTION-FARM.md § Promoting). After merge + deploy, an operator reseeds.");
