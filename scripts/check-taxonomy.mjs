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
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractLiteral } from "./question-quality.mjs";
import { SURFACES } from "./topic-budget.mjs";

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
    ledger: JSON.parse(read("content", "topic-proposals.json")),
  };
}

export function checkTaxonomy(sources = loadSources()) {
  const { palette, wire, catMeta, seedBranches, learnFields, ledger } = sources;
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
    learn: new Set(learnFields.map((f) => f.id)),
  };
  for (const p of ledger.proposals ?? []) {
    const where = `topic-proposals.json proposal ${JSON.stringify(p.id ?? "(no id)")}`;
    if (!SURFACES[p.surface]) {
      err(`${where}: surface ${JSON.stringify(p.surface)} is not one of ${Object.keys(SURFACES).join("/")}`);
      continue;
    }
    if (known[p.surface].has(p.id)) {
      err(`${where}: ${p.surface} already has a category with that id — a proposal is for a gap, not a rename`);
    }
    if (!p.label) err(`${where}: no label`);
    if (!p.nearest) {
      err(`${where}: no \`nearest\` — the rule is place it, and only propose when it cannot be placed, so the `
        + "category it came closest to is the argument's other half");
    } else if (!known[p.surface].has(p.nearest)) {
      err(`${where}: nearest ${JSON.stringify(p.nearest)} is not a ${p.surface} category`);
    }
    for (const [i, q] of (p.questions ?? []).entries()) {
      if (!q || typeof q.prompt !== "string" || !q.prompt) err(`${where}: questions[${i}] has no prompt`);
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(q?.run ?? ""))) {
        err(`${where}: questions[${i}] has no \`run\` date — the evidence rule counts distinct run DAYS`);
      }
    }
  }
  for (const c of ledger.created ?? []) {
    if (!SURFACES[c.surface]) {
      err(`topic-proposals.json created ${JSON.stringify(c.id)}: unknown surface ${JSON.stringify(c.surface)}`);
    } else if (!known[c.surface].has(c.id)) {
      err(`topic-proposals.json records ${c.surface}/${c.id} as created, and no such category exists — `
        + "either the creation was reverted and this row should go, or it was half-written");
    }
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
  console.log("check:taxonomy — feed palette/wire in sync, CAT_META/map-branches in sync, hues distinct, ledger clean");
  process.exit(0);
}
