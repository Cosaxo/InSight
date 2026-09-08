// topic-budget.mjs — when a lane may CREATE a category, as arithmetic
// (D421), and WHERE in the tree it creates it (D422).
//
// WHY THIS EXISTS. Until D421 the answer was never: "A new category is never
// created by a run" (QUESTION-FARM.md hard rule 3, restated at D145). The
// owner reversed it — the lanes create categories now — and then ruled on
// the shape the same day (D422): "most topics should be subtopics, there
// should only be a limited number of topics". So the tree has two levels
// with two different rules:
//
//   THE TOP LEVEL IS FIXED. A top-level category — a feed topic, a daily
//   top, a learn subject — is a chip in the row, a branch on the Map, and
//   (for the feed) a page of FEED_PAGE reads for every new install, because
//   feed topics are always-on (D96/D321). TOPS[surface].max is today's
//   count, and it is the OWNER'S number: the regulator holds a top-level
//   proposal until the owner raises the constant. The machinery below it
//   stays whole so that raising it is one edit.
//
//   THE LEAVES GROW. A subtopic under a levelled parent inherits the
//   parent's hue (colour = family, world-subtopics.js), adds no chip and no
//   Map branch, costs a new install no page (leaf cards ride their parent's
//   page), and is reached by following the parent. Every cost the top level
//   pays, a leaf does not — which is why the tree is where growth goes.
//
// The reversal is not a licence, because everything the old rule was
// protecting is still true: a category is structure, not a label, and the
// old rule's failure was WHERE its caution sat — on a human who left the
// loop at D212 and never arrived (one category created in the project's
// life, `now`, D231, by the owner in person). The caution is arithmetic
// now, and it fires on a schedule.
//
// The shape is farm-budget.mjs's, one layer up: that regulator answers "how
// many questions may this run write", this one "may this run open a new
// room to write them into". Same self-closing property: taxonomy growth
// tracks the lanes' stocking throughput.
//
// BLOCKERS FOR A LEAF, each something the old rule asserted in prose:
//
//   1. EVIDENCE. D145's own sentence — "three runs proposing the same
//      missing top is an argument; one is an anecdote" — made literal:
//      EVIDENCE_MIN questions wanting the leaf, over RUNS_MIN distinct run
//      DAYS. Two kinds count: questions PARKED in the ledger (new ones the
//      lane wrote and could not place below the parent), and questions
//      RETAGGED — existing questions under the parent that the proposal
//      names as the leaf's (`retag`), which is free stock: TAGS-PLAN's "a
//      door on an existing question is the free first fix" one level down.
//      Days are counted on the parked entries only; a retag list carries
//      no day, so a pure carve still needs three runs to say so.
//
//   2. PARENT LEVELLED. The parent at or above its own floor — the farm's
//      deferral made literal: "a leaf below a levelled parent is depth where
//      breadth is still owed". The number is the lane regulator's, not
//      recounted here.
//
//   3. SETTLING. The last leaf created under the SAME parent is at its
//      floor. One leaf per parent at a time; different parents grow in
//      parallel, because leaves are cheap.
//
//   THE WRITE RULE. The creating run writes min(budget, floor − parked −
//   retag) into the leaf in the PR that opens it. Learn fields are then
//   levelled by the learn regulator (loadLearnFields counts per field);
//   feed leaves are NOT — feed-budget.mjs counts topics, and deliberately
//   lets leaf doors "fall out at the taxonomy guard" — so a feed leaf has
//   to be born full, and it always can be: FEED_CAP (60) ≥ LEAF_FLOOR (12),
//   pinned by the test, so the capacity check below cannot fire on the
//   feed and exists only to say so if the constants ever cross.
//
// BLOCKERS FOR A TOP: the cap above first, then the same evidence,
// breadth-debt (every existing category at floor) and settling rules
// D421 wrote. The cap is what a run will actually meet; the rest is what
// applies the day the owner raises it.
//
// WHAT IS DELIBERATELY NOT A BLOCKER, and the measurement that decided it
// (D421 §5): a semantic "is this distinct?" gate. question-neighbors.mjs's
// token affinity, measured on the live feed corpus, puts the lowest
// per-topic self-affinity (0.049, `now`) below the highest cross-topic
// affinity (0.117) — no threshold separates the classes, and the topic it
// fails hardest on is the one D231 built as a TIME rather than a subject.
// Distinctness is the run's argument in the PR; the gate is on the
// consequences. Left here so nobody derives it again.
//
// This is an operator/run tool, not a CI gate — the CI half is
// check-taxonomy.mjs (check:taxonomy), which holds every site of a created
// category written together. Import-safe: the CLI runs only when invoked
// directly, so the arithmetic is unit-testable (topic-budget.test.mjs, via
// test:scripts — the runner CLAUDE.md warns hides in the lint job).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOP_FLOOR, RUN_CAP as DAILY_CAP, loadDailyTops } from "./farm-budget.mjs";
// LANE_EXCLUDED is deliberately NOT imported: loadFeedTopics already drops
// it, so a parent the lane cannot stock (`now`) is never counted as thin.
import { TOPIC_FLOOR, RUN_CAP as FEED_CAP, loadFeedTopics } from "./feed-budget.mjs";
import { FIELD_FLOOR, RUN_CAP as LEARN_CAP, loadLearnFields } from "./learn-budget.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// D145's sentence as two numbers. Three runs, because that is the count the
// old rule already named as the difference between an argument and an
// anecdote; one question each, because a run that met the gap twice in a day
// met one gap, not two. Raising either is safe and slows creation; lowering
// RUNS_MIN below 3 makes a single run's opinion sufficient, which is the one
// thing every version of this rule has refused.
export const EVIDENCE_MIN = 3;
export const RUNS_MIN = 3;

// A feed leaf is a followable shelf, and a device holds one page of a topic
// (bankPager.ts FEED_PAGE): a leaf that cannot fill one page is the "broken
// room" world-subtopics.js refuses to offer. Held equal to the pager's
// constant by the test (feedPageCost below reads it off the source), so the
// two cannot drift the way D197's copies did.
export const LEAF_FLOOR = 12;

// The top level: today's counts, the owner's numbers (D422). A top-level
// proposal holds at the cap with the owner's words, and the rest of the
// machinery stays whole so raising a max is one edit. Floors and caps are
// the LANES' own, imported rather than restated (D197).
export const TOPS = {
  feed: {
    max: 13, floor: TOPIC_FLOOR, cap: FEED_CAP, noun: "topic",
    sites: ["src/v2/spec/world-feed-topics.js (WORLD_TOPICS)", "content/feed-questions.json (topics)"],
  },
  daily: {
    max: 14, floor: TOP_FLOOR, cap: DAILY_CAP, noun: "top",
    sites: ["src/v2/spec/daily-cats.js (CAT_META)"],
  },
  learn: {
    // A subject is levelled when every field under it is (loadLearnFields).
    max: 5, floor: FIELD_FLOOR, cap: LEARN_CAP, noun: "subject",
    sites: ["content/learn-questions.json (subjects)"],
  },
};

// The leaves: where growth goes. `levelledByLane` is whether the surface's
// own regulator will finish a thin leaf (learn's counts per field; the
// feed's counts topics only), which decides whether the write rule may
// leave a remainder. The daily has no leaf registry: its second level is
// the free-form path `cat: [Top, Sub]` (129 distinct pairs over 154
// questions, measured 2026-09-08), so a daily "leaf" is written, never
// created — `null` here says so.
export const LEAVES = {
  feed: {
    floor: LEAF_FLOOR, cap: FEED_CAP, noun: "subtopic", parentNoun: "topic",
    levelledByLane: false,
    sites: ["src/v2/spec/world-subtopics.js (WORLD_SUBTOPICS)"],
  },
  learn: {
    floor: FIELD_FLOOR, cap: LEARN_CAP, noun: "field", parentNoun: "subject",
    levelledByLane: true,
    sites: ["content/learn-questions.json (fields)"],
  },
  daily: null,
};

export const SURFACES = Object.keys(TOPS);

/** Distinct run days in a proposal's parked questions. A run that parked
 * three questions in one firing is one day, not three — the evidence rule is
 * about recurrence, and a single run cannot manufacture it by writing more. */
export function runDays(questions) {
  return new Set((questions ?? []).map((q) => String(q.run ?? "").slice(0, 10)).filter(Boolean)).size;
}

/** A proposal's level: what it says, else what its shape says. A `parent`
 * is a leaf's defining field, so its presence decides. */
export function levelOf(p) {
  if (p.level === "top" || p.level === "leaf") return p.level;
  return p.parent ? "leaf" : "top";
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Pure: the CLI prints nothing these functions did not decide, so the test
// pins the verdict a lane actually gets.
//
//   parked        questions waiting in the ledger for this leaf
//   retag         existing questions under the parent the proposal claims
//   days          distinct run days among the parked (runDays above)
//   parentDeficit the parent's shortfall below ITS floor, from the lane
//   budget        what the lane's regulator grants this run
//   settling      the last leaf created under this parent: its stock, or null
export function leafVerdict({ surface, parked, retag = 0, days, parentDeficit, budget, settling = null }) {
  const s = LEAVES[surface];
  if (s === null) {
    return {
      create: false, owed: 0, write: 0, blockers: [],
      reason: "the daily's second level is the path — write `cat: [Top, Sub]` on the question; there is nothing to create",
    };
  }
  if (!s) throw new Error(`topic-budget: unknown surface ${JSON.stringify(surface)}`);
  const blockers = [];
  const evidence = parked + retag;
  if (evidence < EVIDENCE_MIN || days < RUNS_MIN) {
    blockers.push(
      `evidence: ${plural(parked, "parked question")} + ${retag} retagged over ${plural(days, "run day")} ` +
      `(need ${EVIDENCE_MIN} over ${RUNS_MIN}) — one run's opinion is an anecdote`,
    );
  }
  if (parentDeficit > 0) {
    blockers.push(
      `parent thin: the ${s.parentNoun} owes ${plural(parentDeficit, "question")} to reach its floor — ` +
      "a leaf below a levelled parent is depth where breadth is still owed",
    );
  }
  if (settling !== null && settling < s.floor) {
    blockers.push(`settling: the last ${s.noun} created under this ${s.parentNoun} is at ${settling} of ${s.floor} — one leaf per parent at a time`);
  }
  const owed = Math.max(0, s.floor - evidence);
  const write = Math.max(0, Math.min(budget, owed));
  const rest = owed - write;
  if (rest > 0 && !s.levelledByLane) {
    // Cannot fire on the feed while FEED_CAP ≥ LEAF_FLOOR (pinned); here so
    // the constants crossing is a printed reason, not a thin shelf.
    blockers.push(`capacity: a ${surface} ${s.noun} is not levelled by its lane, so it must be born full — ${owed} owed, ${budget} granted`);
  }
  return {
    create: blockers.length === 0,
    owed, write, blockers,
    reason: blockers.length === 0
      ? `create it, write ${plural(write, "question")} into it in the same PR (${parked} parked + ${retag} retagged + ${write} = ${evidence + write} of ${s.floor}` +
        (rest > 0 ? `; the lane's floor-first levelling writes the other ${rest} on its next runs, and settling holds the door until then` : "") +
        `), and write every site: ${s.sites.join(" · ")}`
      : blockers[0],
  };
}

//   count    top-level categories the surface has today
//   parked   questions waiting for this top
//   days     distinct run days among them
//   deficit  the lane regulator's own total shortfall below its floor
//   budget   what the lane grants this run
//   settling the last top created on this surface: its stock, or null
export function topVerdict({ surface, count, parked, days, deficit, budget, settling = null }) {
  const s = TOPS[surface];
  if (!s) throw new Error(`topic-budget: unknown surface ${JSON.stringify(surface)}`);
  const blockers = [];
  if (count >= s.max) {
    blockers.push(
      `top level fixed: ${surface} has ${count} ${s.noun}s and the owner's limit is ${s.max} (D422 — "there should only be a ` +
      `limited number of topics") — propose it as a ${LEAVES[surface] ? LEAVES[surface].noun : "path"} under \`nearest\` instead; ` +
      "raising TOPS.max is the owner's edit",
    );
  }
  if (parked < EVIDENCE_MIN || days < RUNS_MIN) {
    blockers.push(`evidence: ${plural(parked, "parked question")} over ${plural(days, "run day")} (need ${EVIDENCE_MIN} over ${RUNS_MIN}) — one run's opinion is an anecdote`);
  }
  if (deficit > 0) {
    blockers.push(
      `breadth debt: the ${surface} lane owes ${plural(deficit, "question")} to reach ${s.floor}/${s.noun} on the categories ` +
      "that already exist — a new room while the old ones are thin is breadth owed twice",
    );
  }
  if (settling !== null && settling < s.floor) {
    blockers.push(`settling: the last ${surface} ${s.noun} created is at ${settling} of ${s.floor} — one room at a time`);
  }
  const owed = Math.max(0, s.floor - parked);
  const write = Math.max(0, Math.min(budget, owed));
  const rest = owed - write;
  return {
    create: blockers.length === 0,
    owed, write, blockers,
    reason: blockers.length === 0
      ? `create it, write ${plural(write, "question")} into it in the same PR (${parked} parked + ${write} = ${parked + write} of ${s.floor}` +
        (rest > 0 ? `; the lane's floor-first levelling writes the other ${rest} on its next runs, and settling holds the door until then` : "") +
        `), and write every site: ${s.sites.join(" · ")}`
      : blockers[0],
  };
}

/** D421's name for the top-level verdict, kept for the record's readers. */
export const topicVerdict = topVerdict;

/** D231's hue pick as an algorithm rather than a judgement: "hue 115 is the
 * widest gap left in the row (85 -> 145), picked for distance from its
 * neighbours rather than for a meaning". The midpoint of the widest arc on
 * the ring — the only choice that maximises distance from both neighbours —
 * and the chroma/lightness tier never moves, so a created chip cannot
 * invent a visual language. A LEAF never calls this: colour = family. */
export function hueFor(hues) {
  const ring = [...new Set(hues.map((h) => ((h % 360) + 360) % 360))].sort((a, b) => a - b);
  if (ring.length === 0) return 0;
  if (ring.length === 1) return (ring[0] + 180) % 360;
  let best = { gap: -1, at: 0 };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = i + 1 < ring.length ? ring[i + 1] : ring[0] + 360;
    const gap = b - a;
    if (gap > best.gap) best = { gap, at: (a + gap / 2) % 360 };
  }
  return Math.round(best.at);
}

/** The hues a surface already spends, for hueFor. */
export function hueRing(surface, taxonomy) {
  if (surface === "daily") return Object.values(taxonomy).map((m) => m.hue);
  return taxonomy.map((t) => {
    const m = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)/.exec(t.color ?? "");
    return m ? Number(m[1]) : NaN;
  }).filter((h) => Number.isFinite(h));
}

/** What a feed TOPIC costs every device, read off the pager rather than
 * restated: feed topics are always-on (D96), so a new install fetches a
 * page per topic until its cache converges (bankPager.ts, D321). A leaf
 * costs none of this — its cards ride the parent's page. Returns null if
 * the constant moves, so the line goes quiet instead of inventing (D197). */
export function feedPageCost() {
  try {
    const src = readFileSync(join(root, "src", "v2", "data", "bankPager.ts"), "utf8");
    const m = /export const FEED_PAGE = (\d+);/.exec(src);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export function loadLedger() {
  return JSON.parse(readFileSync(join(root, "content", "topic-proposals.json"), "utf8"));
}

/** Every surface's top level: count, per-category stock, and the lane's own
 * shortfall — summed the way each lane regulator sums it, which is why this
 * reads their loaders instead of counting again. */
export async function loadTops() {
  const daily = await loadDailyTops();
  const feed = loadFeedTopics();          // already drops LANE_EXCLUDED
  const learn = loadLearnFields();
  const learnJson = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
  const debt = (rows, stockOf, floor) => rows.reduce((sum, r) => sum + Math.max(0, floor - stockOf(r)), 0);
  return {
    daily: { count: daily.length, rows: daily.map((t) => ({ id: t.id, stock: t.questions })), deficit: debt(daily, (t) => t.questions, TOP_FLOOR) },
    feed: { count: feed.length + 1 /* + `now`, excluded from the lane, still a chip */, rows: feed.map((t) => ({ id: t.id, stock: t.questions })), deficit: debt(feed, (t) => t.questions, TOPIC_FLOOR) },
    learn: { count: learnJson.subjects.length, rows: learn.map((f) => ({ id: f.id, stock: f.cards })), deficit: debt(learn, (f) => f.cards, FIELD_FLOOR) },
  };
}

/** The leaves: feed subtopics with their `sub`-tagged stock, learn fields
 * with their cards, each with its parent. Reads the subtopic list through
 * check:quality's extractor — one parser (D197). */
export async function loadLeaves() {
  const { extractLiteral } = await import("./question-quality.mjs");
  const subs = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "world-subtopics.js"), "utf8"),
    "const WORLD_SUBTOPICS = [", "world-subtopics.js");
  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
  const tagged = new Map();
  for (const q of feed.questions) if (typeof q.sub === "string") tagged.set(q.sub, (tagged.get(q.sub) ?? 0) + 1);
  const learn = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
  const cards = new Map();
  for (const c of learn.cards) cards.set(c.f, (cards.get(c.f) ?? 0) + 1);
  return {
    feed: subs.map((s) => ({ id: s.id, parent: s.parent, stock: tagged.get(s.id) ?? 0 })),
    learn: learn.fields.map((f) => ({ id: f.id, parent: f.subject, stock: cards.get(f.id) ?? 0 })),
  };
}

/** A parent's shortfall below its own floor, in the lane's terms: a feed
 * topic against TOPIC_FLOOR; a learn subject is the sum over its fields
 * against FIELD_FLOOR. */
export function parentDeficitOf(surface, parent, tops, leaves) {
  if (surface === "feed") {
    const row = tops.feed.rows.find((r) => r.id === parent);
    return row ? Math.max(0, TOPIC_FLOOR - row.stock) : null;
  }
  if (surface === "learn") {
    const fields = leaves.learn.filter((l) => l.parent === parent);
    return fields.length ? fields.reduce((s, f) => s + Math.max(0, FIELD_FLOOR - f.stock), 0) : null;
  }
  return null;
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const ledger = loadLedger();
  const tops = await loadTops();
  const leaves = await loadLeaves();
  const proposals = ledger.proposals ?? [];

  console.log(`topic-budget: ${plural(proposals.length, "proposal")} in the ledger (evidence ${EVIDENCE_MIN} over ${RUNS_MIN} run days)`);
  console.log("  the top level is fixed (D422) — growth goes into the tree:");
  for (const [name, s] of Object.entries(TOPS)) {
    const t = tops[name];
    const leafRows = leaves[name];
    const leafLine = LEAVES[name] === null
      ? "second level is the free path [Top, Sub]"
      : `${plural(leafRows.length, LEAVES[name].noun)}, floor ${LEAVES[name].floor}, ${leafRows.filter((l) => l.stock < LEAVES[name].floor).length} under it`;
    console.log(`    ${name}: ${t.count} of ${s.max} ${s.noun}s, lane owes ${t.deficit}${t.deficit === 0 ? " (levelled)" : ""} · ${leafLine}`);
  }
  if (proposals.length === 0) {
    console.log("  no proposals — nothing to rule on. A lane parks a question that fits nothing under its nearest parent"
      + " (QUESTION-FARM.md § When no category fits); it does not drop it.");
  }

  for (const p of proposals) {
    const level = levelOf(p);
    const parked = (p.questions ?? []).length;
    const days = runDays(p.questions);
    console.log(`\n  ${p.surface}/${p.id} (${level}) — "${p.label}"` + (p.parent ? ` under ${p.parent}` : ` nearest ${p.nearest ?? "unstated"}`));
    if (!TOPS[p.surface]) { console.log(`    unknown surface ${JSON.stringify(p.surface)} — check:taxonomy fails on this`); continue; }
    let v;
    if (level === "leaf") {
      const prior = (ledger.created ?? []).filter((c) => c.surface === p.surface && c.parent === p.parent).at(-1);
      const settling = prior ? (leaves[p.surface]?.find((l) => l.id === prior.id)?.stock ?? 0) : null;
      const parentDeficit = parentDeficitOf(p.surface, p.parent, tops, leaves) ?? 0;
      const retag = (p.retag ?? []).length;
      v = leafVerdict({ surface: p.surface, parked, retag, days, parentDeficit, budget: LEAVES[p.surface]?.cap ?? 0, settling });
      console.log(`    ${parked} parked + ${retag} retagged over ${plural(days, "run day")} · parent owes ${parentDeficit} · grant ${LEAVES[p.surface]?.cap ?? 0}`);
    } else {
      const prior = (ledger.created ?? []).filter((c) => c.surface === p.surface && levelOf(c) === "top").at(-1);
      const settling = prior ? (tops[p.surface].rows.find((r) => r.id === prior.id)?.stock ?? 0) : null;
      v = topVerdict({ surface: p.surface, count: tops[p.surface].count, parked, days, deficit: tops[p.surface].deficit, budget: TOPS[p.surface].cap, settling });
      console.log(`    ${parked} parked over ${plural(days, "run day")} · ${tops[p.surface].count} of ${TOPS[p.surface].max} · lane owes ${tops[p.surface].deficit}`);
    }
    if (v.create) {
      console.log(`    CREATE — ${v.reason}`);
      if (level === "top" && p.surface !== "learn") console.log("    hue: hueFor(hueRing(surface, taxonomy)) — the widest gap's midpoint (D231's pick, mechanised); a leaf takes its parent's");
      if (level === "top" && p.surface === "feed") {
        const page = feedPageCost();
        console.log(page === null
          ? "    cost: FEED_PAGE not found in bankPager.ts — the per-install line is silent rather than invented"
          : `    cost: every new install fetches a page of ${page} for this topic (D96 always-on, D321) — a leaf would cost none`);
      }
    } else {
      console.log("    HOLD:");
      for (const b of v.blockers) console.log(`      · ${b}`);
    }
  }
  process.exit(0);
}
