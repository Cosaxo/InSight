// Validates the committed question bank (functions/src/v2content.ts)
// against its sources in /content, plus the invariants the seed path and
// clients assume.
//
// The load-bearing check is byte identity: v2content.ts compiles into the
// deployed seed callable, so drift between it and /content is a statement
// about production, not style — a hand edit to the generated file, or a
// /content change without a regen, ships a bank nobody reviewed. The
// generator was lost once (it lived only in session notes); regenerating in
// memory on every run is what keeps it from being lost again unnoticed.
//
// The sanity checks guard the classes of content mistake nothing else
// catches before a device does: a duplicate id silently merging two
// questions into one Firestore doc, a scale question whose options drifted
// from the 5-point agree scale the client renders, a feed question filed
// under a topic that doesn't exist, a test item keyed to a dimension its
// own test doesn't declare.
//
// Regeneration stays a deliberate step: `npm run build:content`.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntries, generate, loadContent, CONTENT_SOURCES, LENS_SCALE, LIKERT, dialOptions, fieldOptions, DIAL_BUCKETS } from "./gen-v2content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "functions", "src", "v2content.ts");

let committed;
try {
  committed = readFileSync(OUT, "utf8");
} catch {
  console.error(`check:content: ${OUT} is missing. Run \`npm run build:content\`.`);
  process.exit(1);
}

const errors = [];
let content, entries;
try {
  content = loadContent();
  entries = buildEntries(content);
} catch (e) {
  // A structural error (e.g. a source entry with no id) is not a lint
  // finding to accumulate — nothing downstream is meaningful without it.
  console.error(`check:content: ${e.message}`);
  process.exit(1);
}

// ---- drift: the committed file must be exactly what /content generates.
if (generate(content) !== committed) {
  errors.push(
    "functions/src/v2content.ts differs from what /content generates — " +
      "run `npm run build:content` and review the diff",
  );
}

// ---- ids: unique across the bank, and shaped per surface. Answers are
// immutable docs keyed by qid, so a malformed or colliding id is forever.
const ID_SHAPE = {
  daily: /^daily-\d{3}$/,
  feed: /^feed-[A-Za-z0-9]+$/,
  group: /^group-[A-Za-z0-9]+$/,
  duo: /^duo-\d{3}$/,
  // Two id families share the test surface: the core instruments'
  // `test-<key>-NN`, and the lens items' `lq-<lens>-<N>` — UNPADDED,
  // because the client minted those ids before the items had a backend
  // (lens-defs.js) and devices hold local state keyed by them (D91).
  test: /^(test-[a-z0-9]+-\d{2}|lq-[a-z]+-\d{1,2})$/,
  learn: /^learn-[a-z0-9]+$/,
  // The daily pulse's TEMPLATE ids (D139). Answers are keyed
  // {baseQid}_{day} against these, so the shape is forever like all of
  // them — and it must never admit an underscore, which is the day
  // separator the rules parse on.
  pulse: /^pulse-[a-z0-9]+$/,
};
const seenIds = new Set();
for (const q of entries) {
  if (seenIds.has(q.id)) errors.push(`duplicate id ${q.id}`);
  seenIds.add(q.id);
  if (!ID_SHAPE[q.surface]) errors.push(`${q.id}: unknown surface ${JSON.stringify(q.surface)}`);
  else if (!ID_SHAPE[q.surface].test(q.id)) errors.push(`${q.id}: id does not match the ${q.surface} shape`);
}

// ---- per-surface seq contiguity (the banks sort on it).
const seqBySurface = new Map();
for (const q of entries) {
  const want = seqBySurface.get(q.surface) ?? 0;
  if (q.seq !== want) errors.push(`${q.id}: seq ${q.seq}, expected ${want} (per-surface, contiguous)`);
  seqBySurface.set(q.surface, q.seq + 1);
}

// ---- options: scales must be exactly the agree scale, ratings exactly
// 1..10; group "pick" questions are the only legitimately empty options
// (members fill them client-side); everything else needs 2..10 choices.
const RATING = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
for (const q of entries) {
  if (!q.prompt || !q.prompt.trim()) errors.push(`${q.id}: empty prompt`);
  // The current-events serving window (docs/NEXT-FUNCTIONALITY.md §1):
  // feed-only — no other surface serves by date (the daily deck is
  // positional), and the client filter compares UTC day-key strings, so
  // the shape must be exactly that.
  if (q.until !== undefined) {
    if (q.surface !== "feed") errors.push(`${q.id}: \`until\` is the feed's current-events window — no other surface carries it`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(q.until)) errors.push(`${q.id}: \`until\` must be a YYYY-MM-DD UTC day key`);
  }
  if (q.type === "scale") {
    // Lens items run the client's agree-FIRST scale (lens-defs.js SCALE):
    // stored optionIdx indexes it, and world-feed's `4 - val` store
    // inversion depends on the order. Everything else on the scale type is
    // the shared disagree-first LIKERT. Either drifting fails here.
    const want = q.id.startsWith("lq-") ? LENS_SCALE : LIKERT;
    if (!same(q.options, want)) errors.push(`${q.id}: scale options are not the 5-point agree scale`);
  } else if (q.type === "rating") {
    if (!same(q.options, RATING)) errors.push(`${q.id}: rating options are not "1".."10"`);
  } else if (q.type === "pulse") {
    // The pulse's chart maps optionIdx 0..4 onto the 1..5 step axis
    // (ui/PulseTrends), so a pulse question has EXACTLY five authored
    // steps — a 3-step pulse would silently draw on the wrong scale.
    if (q.surface !== "pulse") errors.push(`${q.id}: pulse type outside the pulse surface`);
    if (q.options.length !== 5 || q.options.some((o) => !o || !o.trim())) {
      errors.push(`${q.id}: a pulse question carries exactly five non-empty steps`);
    }
  } else if (q.surface === "pulse") {
    errors.push(`${q.id}: the pulse surface carries only pulse-type questions`);
  } else if (q.surface === "group" && q.topic === "pick") {
    if (q.options.length !== 0) errors.push(`${q.id}: pick questions carry no options`);
  } else if (q.type === "dial" || q.type === "field") {
    // Continuum options are SYNTHESIZED bucket/cell labels (D114): a
    // stored answer's optionIdx is a position in that exact grid, so the
    // committed labels must be exactly what the range/plane produces —
    // drift here re-keys live answers, the same failure D52 freezes. The
    // 12-bucket count also has to stay under the fold's optionIdx
    // ceiling (0..19, functions/src/v2.ts drops anything above).
    if (q.surface !== "feed") errors.push(`${q.id}: ${q.type} outside the feed surface — the continuum loop is feed-only`);
    if (q.type === "dial") {
      if (!(typeof q.lo === "number" && typeof q.hi === "number" && q.lo < q.hi)) {
        errors.push(`${q.id}: dial needs numeric lo < hi`);
      } else if (!same(q.options, dialOptions(q))) {
        errors.push(`${q.id}: dial options are not the ${DIAL_BUCKETS} synthesized bucket labels for lo=${q.lo} hi=${q.hi} unit=${JSON.stringify(q.unit ?? "")}`);
      }
      if (typeof q.unit !== "string" && !Array.isArray(q.ends)) {
        errors.push(`${q.id}: dial needs a unit or end labels — something has to say what the scale measures`);
      }
    } else {
      const twoShort = (a) => Array.isArray(a) && a.length === 2 && a.every((e) => typeof e === "string" && e.trim() && e.length <= 14);
      if (!twoShort(q.ax) || !twoShort(q.ay)) {
        errors.push(`${q.id}: field needs ax/ay as two end labels each, ≤14 chars (they compose into cell labels)`);
      } else if (!same(q.options, fieldOptions(q))) {
        errors.push(`${q.id}: field options are not the synthesized cell labels for its ax/ay`);
      }
    }
  } else if (q.options.length < 2 || q.options.length > 10) {
    errors.push(`${q.id}: ${q.options.length} options (want 2..10)`);
  }
}

// ---- duplicate prompts within a surface read as the same question twice.
const promptsBySurface = new Map();
for (const q of entries) {
  const key = `${q.surface}\u0000${q.prompt}`;
  if (promptsBySurface.has(key)) {
    errors.push(`${q.id}: duplicate prompt within ${q.surface} (also ${promptsBySurface.get(key)})`);
  }
  promptsBySurface.set(key, q.id);
}

// ---- feed topics must exist in the taxonomy the client renders.
const topicIds = new Set(content.feed.topics.map((t) => t.id));
for (const q of entries) {
  if (q.surface === "feed" && !topicIds.has(q.topic)) {
    errors.push(`${q.id}: feed topic ${JSON.stringify(q.topic)} not in feed-questions.json topics`);
  }
}

// ---- domain travels only on catalog questions: it names the key space
// the aggregate trigger validates `entity` answers against, so a domain on
// a vote question (or a catalog question without one) is a wiring mistake.
for (const q of entries) {
  if (q.type === "catalog" && (typeof q.domain !== "string" || !q.domain)) {
    errors.push(`${q.id}: catalog question without a domain`);
  } else if (q.type !== "catalog" && q.domain !== null) {
    errors.push(`${q.id}: domain ${JSON.stringify(q.domain)} on a non-catalog question`);
  }
}

// ---- group kinds are a closed set (the reveal renders each differently).
for (const q of entries) {
  if (q.surface === "group" && !["us", "pick", "classic"].includes(q.topic)) {
    errors.push(`${q.id}: group kind ${JSON.stringify(q.topic)} not us/pick/classic`);
  }
}

// ---- test items must score against a dimension their test declares.
for (const [key, t] of Object.entries(content.tests)) {
  const dims = new Set(t.dims.map((d) => d.id));
  for (const q of entries) {
    if (q.test === key && !dims.has(q.axis)) {
      errors.push(`${q.id}: axis ${JSON.stringify(q.axis)} not a ${key} dimension`);
    }
  }
}

// ---- lens items the same way: the axis names the dimension the CLIENT
// scores the answer against (lens-defs.js), so a d/axis typo ships an item
// no lens can hear. lenses.json declares its dims for exactly this check;
// lens-content.test.ts binds the whole file to IS_LENSES, dims included.
for (const [key, l] of Object.entries(content.lenses)) {
  const dims = new Set(l.dims.map((d) => d.id));
  for (const q of entries) {
    if (q.id.startsWith(`lq-${key}-`) && !dims.has(q.axis)) {
      errors.push(`${q.id}: axis ${JSON.stringify(q.axis)} not a ${key} dimension`);
    }
  }
}

// ---- learn cards: the client-side correctness metadata never reaches the
// server doc, so this is the only gate that sees it. A c/t mistake ships a
// card that teaches the wrong answer; an unknown field orphans the card
// from every follow list and level.
{
  const fieldIds = new Set(content.learn.fields.map((f) => f.id));
  const subjIds = new Set(content.learn.subjects.map((s) => s.id));
  for (const f of content.learn.fields) {
    if (!subjIds.has(f.subject)) errors.push(`learn field ${f.id}: unknown subject ${JSON.stringify(f.subject)}`);
  }
  for (const card of content.learn.cards) {
    const at = `learn card ${card.id ?? "?"}`;
    if (!fieldIds.has(card.f)) errors.push(`${at}: unknown field ${JSON.stringify(card.f)}`);
    if (!Array.isArray(card.a) || card.a.length !== 4) errors.push(`${at}: needs exactly 4 options`);
    else {
      if (!(card.c >= 0 && card.c < 4)) errors.push(`${at}: correct index ${card.c} out of range`);
      if (!(card.t >= 0 && card.t < 4)) errors.push(`${at}: trap index ${card.t} out of range`);
      if (card.c === card.t) errors.push(`${at}: the trap IS the correct answer`);
    }
    if (!(card.p >= 1 && card.p <= 99)) errors.push(`${at}: p ${card.p} outside 1..99`);
    // "the fact in three words" is the doc's aspiration; the shipped bank
    // runs 2..6 — bound it there so the map labels stay label-sized.
    const kw = String(card.k ?? "").trim().split(/\s+/).filter(Boolean).length;
    if (kw < 2 || kw > 6) errors.push(`${at}: k is ${kw} words (want 2..6)`);
  }
}

// ---- every file in /content is accounted for.
//
// The generator names the six banks it loads, so a file nobody loads is
// invisible here — it just sits, and the README describes it as content.
// `archetypes.json` did exactly that (D137): 12 KB read by no script and no
// source, whose live counterpart is `src/v2/spec/archetype-data.js`, and the
// two had diverged to different names in nearly every slot. That is worse
// than dead weight — /content is documented as the source of truth, so
// editing the stale copy looks like changing the app and changes nothing.
//
// The rule: a .json here is a generator input, or it is listed below WITH
// its reason. A stale entry fails too (listed but absent, or listed and
// loaded anyway), the check-purge-listeners shape, so the list cannot
// outlive its subjects.
const NOT_SEEDED = {
  "provenance.json":
    "measurement metadata, not content — who wrote each question and in "
    + "which vintage (D97); read by check:quality and the scorecard rollup",
  "scorecard.json":
    "generated measurement output, read by the scorecard renderer; never "
    + "an input to the bank",
};

const contentFiles = readdirSync(join(root, "content"))
  .filter((f) => f.endsWith(".json"));
const loaded = new Set(Object.values(CONTENT_SOURCES));
for (const f of contentFiles) {
  if (loaded.has(f) || NOT_SEEDED[f]) continue;
  errors.push(
    `content/${f} is read by nothing — not a generator input, not listed in `
    + "NOT_SEEDED. Either wire it up, or delete it and its README row: an "
    + "unread file under /content reads as content and is not.",
  );
}
for (const [f, why] of Object.entries(NOT_SEEDED)) {
  if (!contentFiles.includes(f)) {
    errors.push(`NOT_SEEDED lists content/${f} ("${why}") but the file is gone — drop the entry`);
  } else if (loaded.has(f)) {
    errors.push(`NOT_SEEDED lists content/${f} as never seeded, but the generator loads it — drop the entry`);
  }
}

if (errors.length) {
  console.error(`check:content: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
  process.exit(1);
}

const counts = {};
for (const q of entries) counts[q.surface] = (counts[q.surface] ?? 0) + 1;
console.log(
  `check:content: v2content.ts in sync — ${entries.length} questions (` +
    Object.entries(counts).map(([s, n]) => `${s} ${n}`).join(" · ") +
    ")",
);
