// check-taxonomy.mjs — a category is written at EVERY site, or not at all
// (D424). The CI half of the taxonomy system; the run-time half is
// topic-budget.mjs, which decides whether a category may be created at all.
//
// WHY THIS EXISTS. D424 let the lanes create categories, which made a class
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
//   5. the LEAF lists (D425 — the tree is where growth goes): every feed
//      subtopic is `sub_`-prefixed, unique, under a subject topic that can
//      carry leaves, with a label unique within its parent; every learn
//      field names a subject that exists. A leaf under a format (`fav`) or
//      under `now` is refused here — D231 built `now` as a time, and a leaf
//      of a time would be a subject wearing an expiry it does not have.
//
//   6. the RING (D425 — "the amount of topics shown at the top in the You
//      map should stay roughly the same"): MAP_GROUPS holds today's count
//      of hubs as a ratchet the owner moves; every daily top is EXPLICITLY
//      in a hub's `cats` (the "unplaced lands in World" default is never
//      how a new top arrives); every subject feed topic has a WF_BRANCH
//      caption row that resolves to a branch or a hub, except the one
//      stated exception; and a top-level proposal names a hub that exists.
//
//   7. RETIREMENT is complete (D427 — fold, never delete): a retired id is
//      at NO site — no row on any list, no question met through it (feed
//      `cat`/`sub`/`also`, learn `f`/subject, daily `cat[0]`/`alts`), no
//      hub entry, no caption, no anchor fallback, no ledger row pointing at
//      it; a proposed retirement names an `into` that exists at its level
//      and is not itself. And three orphan rules the fold made worth
//      stating: every learn card's `f` is a live field, the wire's
//      `channels` are wire topics, and the daily's FALLBACK table keys are
//      exactly CAT_META's tops (a top created without a fallback row reads
//      nothing; one retired with the row left behind is the drift class).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractLiteral } from "./question-quality.mjs";
import { TOPS, LEAVES, levelOf, isPlaced } from "./topic-budget.mjs";

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
    groups: extractLiteral(read("src", "v2", "spec", "map-groups.js"), "const GROUPS = [", "map-groups.js"),
    ripples: extractLiteral(read("src", "v2", "spec", "world-feed.jsx"), "const WF_BRANCH = {", "world-feed.jsx", "{", "}"),
    fallback: extractLiteral(read("src", "v2", "spec", "map-anchors.js"), "const FALLBACK = {", "map-anchors.js", "{", "}"),
    dailyQuestions: extractLiteral(read("src", "v2", "spec", "daily-questions.js"), "const Q = [", "daily-questions.js"),
    learnCards: JSON.parse(read("content", "learn-questions.json")).cards,
    wireChannels: JSON.parse(read("content", "feed-questions.json")).channels ?? [],
    ledger: JSON.parse(read("content", "topic-proposals.json")),
  };
}

// The You map's ring, today: eight hubs — six answer groups and two aims.
// A ratchet the OWNER moves, in the same PR as the hub: the ring is the one
// thing on the map a new category may not change on its own (D425).
export const GROUPS_TODAY = 8;

// Feed topics whose caption falls to "added to Interests" by design rather
// than by omission: `now` is a time, not a subject (D231), and a time has no
// branch. A new subject topic without a WF_BRANCH row fails rule 6.
export const RIPPLES_TO_INTERESTS = new Set(["now"]);

// Topics that may not carry leaves: the two formats (FORMAT_ONLY) and `now`
// (D231: a TIME, not a subject — its questions expire, and a leaf of a time
// would be a subject that had been given an expiry it does not have).
export const LEAFLESS = new Set([...["places", "fav"], "now"]);

export function checkTaxonomy(sources = loadSources()) {
  const { palette, wire, catMeta, seedBranches, learnFields, learnSubjects, subtopics, feedQuestions, groups, ripples,
    fallback, dailyQuestions, learnCards, wireChannels, ledger } = sources;
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
      // Rule 6's half for a proposal: it lands somewhere that exists. A
      // missing `group` is not an error here — topic-budget HOLDs it for the
      // owner — but a `group` that names nothing is a typo waiting to land in
      // World, and that IS.
      if (p.group && !isPlaced(p, { groups, catMeta })) {
        err(`${where}: group ${JSON.stringify(p.group)} is not ${p.surface === "daily" ? "a hub id in map-groups.js" : "a CAT_META key or a hub label (a WF_BRANCH target)"}`);
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
    const retiredSince = (ledger.retired ?? []).some((r) => r.surface === c.surface && r.id === c.id);
    if (!exists && !retiredSince) {
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

  // ── 6 · the ring ──
  if (groups.length !== GROUPS_TODAY) {
    err(`map-groups.js holds ${groups.length} hubs and GROUPS_TODAY says ${GROUPS_TODAY} — the You map's ring is the owner's `
      + "(D425); if a hub was really needed, move the constant in the same PR, with the ruling");
  }
  const hubOf = new Map();
  for (const g of groups) for (const c of g.cats ?? []) hubOf.set(c, g.id);
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const [top, meta] of Object.entries(catMeta)) {
    const catId = meta.seedId || `top-${slug(top)}`;
    if (!hubOf.has(catId)) {
      err(`CAT_META top ${JSON.stringify(top)} (${catId}) is in no hub's cats in map-groups.js — it would land in World by the `
        + "unplaced default, which is a placement nobody made (D425: a new top is written INTO a hub)");
    }
  }
  const topKeys = new Set(Object.keys(catMeta));
  const hubLabels = new Set(groups.map((g) => g.label));
  for (const t of palette) {
    if (FORMAT_ONLY.has(t.id) || RIPPLES_TO_INTERESTS.has(t.id)) continue;
    if (!(t.id in ripples)) {
      err(`feed topic ${JSON.stringify(t.id)} has no WF_BRANCH row in world-feed.jsx — its cards would caption "added to Interests" `
        + "by the default; name the branch or hub they read toward, or add the id to RIPPLES_TO_INTERESTS with the reason");
    }
  }
  for (const [id, target] of Object.entries(ripples)) {
    if (!paletteById.has(id)) err(`WF_BRANCH names ${JSON.stringify(id)}, which is not a WORLD_TOPICS id`);
    if (!topKeys.has(target) && !hubLabels.has(target)) {
      err(`WF_BRANCH ${id} -> ${JSON.stringify(target)}: not a CAT_META top nor a hub label — the caption would name a place the map does not have`);
    }
  }

  // ── 7 · retirement is complete, and nothing is orphaned ──
  const slugOf = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const hubCats = new Set(groups.flatMap((g) => g.cats ?? []));
  const fieldIdSet = new Set(learnFields.map((f) => f.id));
  const wireTopicIds = new Set(wire.map((t) => t.id));
  for (const r of ledger.retired ?? []) {
    const where = `topic-proposals.json retired ${JSON.stringify(r.id ?? "(no id)")}`;
    if (!TOPS[r.surface]) { err(`${where}: unknown surface ${JSON.stringify(r.surface)}`); continue; }
    const id = r.id;
    const sites = [];
    if (r.surface === "feed") {
      if (paletteById.has(id)) sites.push("WORLD_TOPICS");
      if (wireById.has(id)) sites.push("feed-questions.json topics");
      if (wireChannels.includes(id)) sites.push("feed-questions.json channels");
      if (subtopics.some((l) => l.id === id)) sites.push("WORLD_SUBTOPICS");
      if (subtopics.some((l) => l.parent === id)) sites.push("WORLD_SUBTOPICS as a parent");
      if (id in ripples) sites.push("WF_BRANCH");
      if (feedQuestions.some((q) => q.cat === id)) sites.push("a feed question's cat");
      if (feedQuestions.some((q) => q.sub === id)) sites.push("a feed question's sub");
      if (feedQuestions.some((q) => Array.isArray(q.also) && q.also.includes(id))) sites.push("a feed question's also");
    } else if (r.surface === "daily") {
      if (id in catMeta) sites.push("CAT_META");
      if (hubCats.has(`top-${slugOf(id)}`) || (catMeta[id]?.seedId && hubCats.has(catMeta[id].seedId))) sites.push("a hub's cats in map-groups.js");
      if (id in fallback) sites.push("map-anchors FALLBACK");
      if (dailyQuestions.some((q) => Array.isArray(q.cat) && q.cat[0] === id)) sites.push("an archive row's cat[0]");
      if (dailyQuestions.some((q) => Array.isArray(q.alts) && q.alts.some((a) => Array.isArray(a) && a[0] === id))) sites.push("an archive row's alts");
    } else if (r.surface === "learn") {
      if (learnSubjects.some((x) => x.id === id)) sites.push("learn subjects");
      if (fieldIdSet.has(id)) sites.push("learn fields");
      if (learnFields.some((f) => f.subject === id)) sites.push("a learn field's subject");
      if (learnCards.some((c) => c.f === id)) sites.push("a learn card's f");
    }
    for (const p of ledger.proposals ?? []) {
      if (p.surface === r.surface && (p.id === id || p.parent === id || p.nearest === id || p.group === id)) sites.push(`proposal ${p.id}`);
    }
    for (const x of ledger.retirements ?? []) {
      if (x.surface === r.surface && (x.id === id || x.into === id)) sites.push(`retirement row ${x.id}`);
    }
    if (sites.length) err(`${where}: retired, and still at ${sites.join(", ")} — a fold removes every site (D427); this one stopped part way`);
    if (!r.into) err(`${where}: no \`into\` — where did its questions go?`);
  }
  for (const r of ledger.retirements ?? []) {
    const where = `topic-proposals.json retirement ${JSON.stringify(r.id ?? "(no id)")}`;
    if (!TOPS[r.surface]) { err(`${where}: unknown surface ${JSON.stringify(r.surface)}`); continue; }
    const level = levelOf(r);
    const live = level === "leaf" ? knownLeaves[r.surface] : known[r.surface];
    if (!live.has(r.id)) err(`${where}: no such ${level} on ${r.surface} — nothing to retire`);
    if (!r.into) err(`${where}: no \`into\` — a room folds into another, it is never deleted`);
    else if (r.into === r.id) err(`${where}: \`into\` is the room itself`);
    else if (level === "leaf" && r.surface === "feed") {
      const leaf = subtopics.find((l) => l.id === r.id);
      if (leaf && r.into !== leaf.parent) err(`${where}: a feed leaf folds into its own parent (${leaf.parent}), not ${JSON.stringify(r.into)}`);
    } else if (level === "leaf" && r.surface === "learn") {
      const f = learnFields.find((x) => x.id === r.id), g = learnFields.find((x) => x.id === r.into);
      if (f && (!g || g.subject !== f.subject)) err(`${where}: a learn field folds into a field of the same subject (${f.subject})`);
    } else if (!known[r.surface].has(r.into)) {
      err(`${where}: \`into\` ${JSON.stringify(r.into)} is not a ${r.surface} ${TOPS[r.surface].noun}`);
    } else if (r.surface === "feed" && LEAFLESS.has(r.into)) {
      err(`${where}: \`into\` ${r.into} is a format or \`now\` — subject questions do not fold into either`);
    }
    if (r.owner !== undefined && !/^\d{4}-\d{2}-\d{2}/.test(String(r.owner))) err(`${where}: \`owner\` is the date the owner said so, not ${JSON.stringify(r.owner)}`);
  }
  for (const c of learnCards) {
    if (!fieldIdSet.has(c.f)) { err(`learn card ${JSON.stringify(c.id)}: f ${JSON.stringify(c.f)} is not a live field — an orphan the Map cannot file`); }
  }
  for (const ch of wireChannels) {
    if (!wireTopicIds.has(ch)) err(`feed-questions.json channels names ${JSON.stringify(ch)}, which is not a wire topic`);
  }
  const fbKeys = new Set(Object.keys(fallback));
  for (const top of Object.keys(catMeta)) if (!fbKeys.has(top)) err(`CAT_META top ${JSON.stringify(top)} has no FALLBACK row in map-anchors.js — its questions fall back to no anchor reading`);
  for (const k of fbKeys) if (!(k in catMeta)) err(`map-anchors FALLBACK names ${JSON.stringify(k)}, which is not a CAT_META top — a row left behind, or a typo`);

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
    console.error("\nA category is written at every site or not at all (D424).");
    process.exit(1);
  }
  console.log("check:taxonomy — feed palette/wire in sync, CAT_META/map-branches in sync, hues distinct, leaf lists sound, ring held, nothing retired half way, ledger clean");
  process.exit(0);
}
