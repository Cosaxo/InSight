// check-taxonomy.mjs — a category is written at EVERY site, or not at all
// (D421). The CI half of the taxonomy system; the run-time half is
// topic-budget.mjs, which decides whether a category may be created at all.
//
// WHY THIS EXISTS. D421 let the lanes create categories, which made a class
// of defect reachable on a schedule that had only ever been reachable by
// hand: a HALF-CREATED category. A feed topic lives in two files that
// nothing held together — src/v2/spec/world-feed-topics.js (the client
// palette, the chip row, lightness tier 0.52) and content/feed-questions.json
// (the wire taxonomy check:quality validates a question's `cat` against,
// lightness tier 0.55). They agree today, by hand, and no gate said so:
// check-content.mjs validates each feed question's topic against the wire
// list, check:quality validates pick cards against the palette, and neither
// compares the two lists. A topic written to one and not the other fails
// SILENTLY in the direction that matters — the chip renders and matches
// nothing, or the question validates and has no chip.
//
// The daily has the same shape one file over: CAT_META carries a hue per top
// and map-branches.js repeats the seven seed hues as its own literal. Those
// two agree today, also by hand, and also unchecked.
//
// So this gate holds three mirrors and the ledger:
//   1. the feed palette against the wire taxonomy (ids, order, labels, hue,
//      and the two format-only topics that are allowed to be absent);
//   2. the daily's CAT_META against map-branches.js's seed literal;
//   3. hue distinctness on both surfaces, plus a minimum separation on the
//      feed ring so a created hue cannot land on top of a neighbour;
//   4. content/topic-proposals.json: a proposal names a real surface and a
//      real nearest category, does not collide with a category that already
//      exists, and every entry in `created` exists in the taxonomy it claims.
//
// Rule 4 is what makes the ledger trustworthy input to topic-budget.mjs: a
// regulator reading a file nothing validates is farm-budget reading an
// invented number, which is D197's finding.
//
//   5. the LEAF lists (D422 — the tree is where growth goes): every feed
//      subtopic is `sub_`-prefixed, unique, under a subject topic that can
//      carry leaves, with a label unique within its parent; every learn
//      field names a subject that exists. A leaf under a format (`fav`) or
//      under `now` is refused here — D231 built `now` as a time, and a leaf
//      of a time would be a subject wearing an expiry it does not have.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractLiteral } from "./question-quality.mjs";
import { TOPS, LEAVES, levelOf } from "./topic-budget.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

// The two WORLD_TOPICS ids that are formats rather than subjects, and so
// deliberately absent from the feed's own taxonomy: `fav` is the catalogue
// picks' channel (D145 §4) and `places` the place-rating one. D97 §3 states
// the relationship — "WORLD_CHANNELS in a live build is WORLD_TOPICS minus
// `places` and `fav`, the two formats the bank mapper cannot emit". Named
// here so the gate can tell a format from a topic somebody forgot to wire.
export const FORMAT_ONLY = new Set(["places", "fav"]);

// The lightness tier each list is authored at. Not a mistake and not
// normalisable: the wire list is read by a surface that renders the chip on
// a different ground. Held as a constant so a created topic cannot be
// written at the other file's tier.
export const TIER = { palette: 0.52, wire: 0.55 };

// The closest two hues on the feed ring sit today (25 and 40). The gate
// holds the row no tighter than it already is: a created hue must not make
// any neighbouring pair closer than the closest pair that already ships.
export const HUE_MIN_GAP = 15;

const oklch = (s) => {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(String(s ?? ""));
  return m ? { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) } : null;
};

/** Every literal the gate reads, in one place. Split from the checking so
 * the test can drive each rule with a source that BREAKS it — a gate proved
 * only against a green tree is the D179/D275 class: a tripwire that counts
 * the wrong thing reports zero and calls it a pass. */
export function loadSources() {
  return {
    palette: extractLiteral(
      read("src", "v2", "spec", "world-feed-topics.js"),
      "export const WORLD_TOPICS = [", "world-feed-topics.js"),
    wire: JSON.parse(read("content", "feed-questions.json")).topics,
    catMeta: extractLiteral(
      read("src", "v2", "spec", "daily-cats.js"),
      "export const CAT_META = {", "daily-cats.js", "{", "}"),
    seedBranches: extractLiteral(
      read("src", "v2", "spec", "map-branches.js"), "const CATS = [", "map-branches.js"),
    learnFields: JSON.parse(read("content", "learn-questions.json")).fields,
    learnSubjects: JSON.parse(read("content", "learn-questions.json")).subjects,
    subtopics: extractLiteral(
      read("src", "v2", "spec", "world-subtopics.js"), "const WORLD_SUBTOPICS = [", "world-subtopics.js"),
    feedQuestions: JSON.parse(read("content", "feed-questions.json")).questions,
    ledger: JSON.parse(read("content", "topic-proposals.json")),
  };
}

// Topics that may not carry leaves: the two formats (FORMAT_ONLY) and `now`
// (D231: a TIME, not a subject — its questions expire, and a leaf of a time
// would be a subject that had been given an expiry it does not have).
export const LEAFLESS = new Set([...["places", "fav"], "now"]);

export function checkTaxonomy(sources = loadSources()) {
  const { palette, wire, catMeta, seedBranches, learnFields, learnSubjects, subtopics, feedQuestions, ledger } = sources;
  const errors = [];
  const err = (m) => errors.push(m);

  // ── 1 · the feed's two lists ──
  const paletteById = new Map(palette.map((t) => [t.id, t]));
  const wireById = new Map(wire.map((t) => [t.id, t]));

  for (const t of wire) {
    if (!paletteById.has(t.id)) {
      err(`feed topic ${JSON.stringify(t.id)} is in content/feed-questions.json but not in WORLD_TOPICS — `
        + "a question can be filed under it and no chip will ever show it");
    }
  }
  for (const t of palette) {
    if (!wireById.has(t.id) && !FORMAT_ONLY.has(t.id)) {
      err(`feed topic ${JSON.stringify(t.id)} is in WORLD_TOPICS but not in content/feed-questions.json — `
        + "the chip renders and check:quality rejects every question written under it. "
        + `If it is a FORMAT rather than a subject, add it to FORMAT_ONLY with the reason (today: ${[...FORMAT_ONLY].join(", ")})`);
    }
  }
  // Order, for the ids both hold: the chip row is drawn in palette order and
  // the wire list is the same row on another surface. A created topic
  // appended to one and inserted into the other is a reordering nobody meant.
  const sharedPalette = palette.filter((t) => wireById.has(t.id)).map((t) => t.id);
  const sharedWire = wire.filter((t) => paletteById.has(t.id)).map((t) => t.id);
  if (sharedPalette.join(",") !== sharedWire.join(",")) {
    err(`feed topic ORDER differs between the two lists:\n    palette: ${sharedPalette.join(" ")}\n    wire:    ${sharedWire.join(" ")}`);
  }
  for (const t of wire) {
    const p = paletteById.get(t.id);
    if (!p) continue;
    if (p.label !== t.label) {
      err(`feed topic ${t.id}: label ${JSON.stringify(p.label)} in WORLD_TOPICS, ${JSON.stringify(t.label)} on the wire`);
    }
    const a = oklch(p.color), b = oklch(t.color);
    if (!a) err(`feed topic ${t.id}: WORLD_TOPICS color ${JSON.stringify(p.color)} is not an oklch() triple`);
    else if (!b) err(`feed topic ${t.id}: wire color ${JSON.stringify(t.color)} is not an oklch() triple`);
    else {
      if (a.h !== b.h) err(`feed topic ${t.id}: hue ${a.h} in WORLD_TOPICS, ${b.h} on the wire — one topic, one hue`);
      if (a.c !== b.c) err(`feed topic ${t.id}: chroma ${a.c} in WORLD_TOPICS, ${b.c} on the wire`);
      if (a.l !== TIER.palette) err(`feed topic ${t.id}: WORLD_TOPICS lightness ${a.l}, tier is ${TIER.palette}`);
      if (b.l !== TIER.wire) err(`feed topic ${t.id}: wire lightness ${b.l}, tier is ${TIER.wire}`);
    }
  }

  // ── 2 · the daily's two lists ──
  const branchById = new Map(seedBranches.map((c) => [c.id, c]));
  for (const [top, meta] of Object.entries(catMeta)) {
    if (typeof meta.hue !== "number" || !Number.isFinite(meta.hue)) {
      err(`CAT_META top ${JSON.stringify(top)} has no numeric hue — the Map draws a branch per top`);
    }
    if (!meta.seedId) continue;
    const b = branchById.get(meta.seedId);
    if (!b) {
      err(`CAT_META top ${JSON.stringify(top)} names seedId ${JSON.stringify(meta.seedId)}, `
        + "which is not a branch in map-branches.js");
    } else if (b.hue !== meta.hue) {
      err(`seed branch ${meta.seedId}: hue ${b.hue} in map-branches.js, ${meta.hue} in CAT_META`);
    }
  }
  for (const b of seedBranches) {
    if (!Object.values(catMeta).some((m) => m.seedId === b.id)) {
      err(`map-branches.js draws branch ${JSON.stringify(b.id)}, which no CAT_META top claims as its seedId`);
    }
  }

  // ── 3 · hues stay distinguishable ──
  const dailyHues = new Map();
  for (const [top, meta] of Object.entries(catMeta)) {
    if (dailyHues.has(meta.hue)) err(`CAT_META: ${top} and ${dailyHues.get(meta.hue)} both sit at hue ${meta.hue} — two branches one colour`);
    else dailyHues.set(meta.hue, top);
  }
  const ring = palette
    .map((t) => ({ id: t.id, h: oklch(t.color)?.h }))
    .filter((t) => Number.isFinite(t.h))
    .sort((a, b) => a.h - b.h);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const gap = i + 1 < ring.length ? b.h - a.h : 360 - a.h + b.h;
    if (gap < HUE_MIN_GAP) {
      err(`feed hues ${a.id} (${a.h}) and ${b.id} (${b.h}) are ${gap} apart, under HUE_MIN_GAP ${HUE_MIN_GAP} — `
        + "a created hue takes the widest gap's midpoint (topic-budget.mjs hueFor); this pair is too close to tell apart");
    }
  }

  // ── 4 · the ledger ──
  const known = {
    daily: new Set(Object.keys(catMeta)),
    feed: new Set(palette.map((t) => t.id)),
    learn: new Set(learnSubjects.map((f) => f.id)),
  };
  const knownLeaves = {
    feed: new Set(subtopics.map((l) => l.id)),
    learn: new Set(learnFields.map((f) => f.id)),
    daily: new Set(),
  };
  const labelSlug = (l) => String(l ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const knownLabels = {
    daily: new Set(Object.keys(catMeta).map(labelSlug)),
    feed: new Set([...palette.map((t) => labelSlug(t.label)), ...subtopics.map((l) => labelSlug(l.label))]),
    learn: new Set([...learnSubjects.map((f) => labelSlug(f.label)), ...learnFields.map((f) => labelSlug(f.label))]),
  };
  const feedById = new Map(feedQuestions.map((q) => [q.id, q]));
  for (const p of ledger.proposals ?? []) {
    const where = `topic-proposals.json proposal ${JSON.stringify(p.id ?? "(no id)")}`;
    if (!TOPS[p.surface]) {
      err(`${where}: surface ${JSON.stringify(p.surface)} is not one of ${Object.keys(TOPS).join("/")}`);
      continue;
    }
    const level = levelOf(p);
    if (p.level !== undefined && p.level !== level) err(`${where}: level must be "top" or "leaf"`);
    if (known[p.surface].has(p.id) || knownLeaves[p.surface].has(p.id)) {
      err(`${where}: ${p.surface} already has a category with that id — a proposal is for a gap, not a rename`);
    }
    if (!p.label) err(`${where}: no label`);
    else if (knownLabels[p.surface].has(labelSlug(p.label))) {
      err(`${where}: label ${JSON.stringify(p.label)} already names a ${p.surface} category — a proposal is for a gap, not a rename`);
    }
    if (level === "leaf") {
      if (LEAVES[p.surface] === null) {
        err(`${where}: the daily has no leaf registry — its second level is the path \`cat: [Top, Sub]\`; write it on the question`);
      } else if (!p.parent) {
        err(`${where}: a leaf proposal needs \`parent\``);
      } else if (!known[p.surface].has(p.parent)) {
        err(`${where}: parent ${JSON.stringify(p.parent)} is not a ${p.surface} ${TOPS[p.surface].noun}`);
      } else if (p.surface === "feed" && LEAFLESS.has(p.parent)) {
        err(`${where}: ${p.parent} may not carry leaves (a format, or \`now\` — D231's time, not a subject)`);
      }
      if (p.surface === "feed" && p.id && !/^sub_[a-z0-9_]+$/.test(p.id)) {
        err(`${where}: a feed subtopic id is \`sub_<slug>\` (world-subtopics.js) — got ${JSON.stringify(p.id)}`);
      }
      for (const [i, id] of (p.retag ?? []).entries()) {
        if (p.surface !== "feed") { err(`${where}: retag[${i}] — only the feed carves a leaf out of existing questions`); break; }
        const q = feedById.get(id);
        if (!q) err(`${where}: retag[${i}] ${JSON.stringify(id)} is not a feed question`);
        else if (q.cat !== p.parent) err(`${where}: retag[${i}] ${id} lives under ${q.cat}, not under ${p.parent} — a leaf is a part of its parent`);
        else if (typeof q.sub === "string") err(`${where}: retag[${i}] ${id} already carries sub ${q.sub}`);
      }
    } else {
      if (!p.nearest) {
        err(`${where}: no \`nearest\` — the rule is place it, and only propose when it cannot be placed, so the `
          + "category it came closest to is the argument's other half");
      } else if (!known[p.surface].has(p.nearest)) {
        err(`${where}: nearest ${JSON.stringify(p.nearest)} is not a ${p.surface} category`);
      }
    }
    for (const [i, q] of (p.questions ?? []).entries()) {
      if (!q || typeof q.prompt !== "string" || !q.prompt) err(`${where}: questions[${i}] has no prompt`);
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(q?.run ?? ""))) {
        err(`${where}: questions[${i}] has no \`run\` date — the evidence rule counts distinct run DAYS`);
      }
    }
  }
  for (const c of ledger.created ?? []) {
    if (!TOPS[c.surface]) {
      err(`topic-proposals.json created ${JSON.stringify(c.id)}: unknown surface ${JSON.stringify(c.surface)}`);
      continue;
    }
    const exists = levelOf(c) === "leaf" ? knownLeaves[c.surface].has(c.id) : known[c.surface].has(c.id);
    if (!exists) {
      err(`topic-proposals.json records ${c.surface}/${c.id} as created, and no such ${levelOf(c)} exists — `
        + "either the creation was reverted and this row should go, or it was half-written");
    }
  }

  // ── 5 · the leaf lists ──
  const leafIds = new Set();
  const leafLabels = new Map(); // parent -> Set(label slug)
  for (const l of subtopics) {
    const where = `world-subtopics.js leaf ${JSON.stringify(l.id ?? "(no id)")}`;
    if (!/^sub_[a-z0-9_]+$/.test(String(l.id))) err(`${where}: id must be \`sub_<slug>\``);
    if (leafIds.has(l.id)) err(`${where}: id repeats`);
    leafIds.add(l.id);
    if (!l.label) err(`${where}: no label`);
    if (!paletteById.has(l.parent)) err(`${where}: parent ${JSON.stringify(l.parent)} is not a WORLD_TOPICS id`);
    else if (LEAFLESS.has(l.parent)) err(`${where}: parent ${l.parent} may not carry leaves (a format, or \`now\` — D231)`);
    const set = leafLabels.get(l.parent) ?? new Set();
    if (set.has(labelSlug(l.label))) err(`${where}: label ${JSON.stringify(l.label)} repeats under ${l.parent}`);
    set.add(labelSlug(l.label));
    leafLabels.set(l.parent, set);
  }
  const subjectIds = new Set(learnSubjects.map((s) => s.id));
  const fieldIds = new Set();
  for (const f of learnFields) {
    if (fieldIds.has(f.id)) err(`learn field ${JSON.stringify(f.id)}: id repeats`);
    fieldIds.add(f.id);
    if (!subjectIds.has(f.subject)) err(`learn field ${JSON.stringify(f.id)}: subject ${JSON.stringify(f.subject)} is not in learn-questions.json subjects`);
  }

  return errors;
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const errors = checkTaxonomy();
  if (errors.length) {
    console.error(`check:taxonomy — ${errors.length} problem${errors.length === 1 ? "" : "s"}:\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error("\nA category is written at every site or not at all (D421).");
    process.exit(1);
  }
  console.log("check:taxonomy — feed palette/wire in sync, CAT_META/map-branches in sync, hues distinct, leaf lists sound, ledger clean");
  process.exit(0);
}
