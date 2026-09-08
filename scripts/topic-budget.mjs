// topic-budget.mjs — when a lane may CREATE a category, as arithmetic
// (D421), and what on the You map stays fixed while it does (D422).
//
// WHY THIS EXISTS. Until D421 the answer was never: "A new category is never
// created by a run" (QUESTION-FARM.md hard rule 3, restated at D145). The
// owner reversed it — the lanes create categories now — and then, reading
// the first two cuts the same day, said what the fixed thing actually is:
// "the amount of topics shown at the top in the You map should stay
// roughly the same unless a new one is really needed, but learn, feed,
// daily — all of these can get new topics."
//
// So the thing that is fixed is the MAP'S RING, and the thing that grows is
// the content taxonomies:
//
//   THE RING IS FIXED. The top of the You map is MAP_GROUPS (map-groups.js)
//   — eight hubs, six of them answer groups (Self · Taste · Beliefs ·
//   Knowledge · World · People) and two aims (Foresight · Crossroads).
//   Branches sit INSIDE hubs and draw only once they hold an answer; a new
//   hub is the one thing that changes what the ring shows, and that is the
//   owner's call — "unless a new one is really needed" is a judgement no
//   arithmetic here makes. check-taxonomy.mjs holds the ring at today's
//   count as a ratchet the owner moves.
//
//   THE TAXONOMIES GROW. A feed topic, a learn subject, a daily top — each
//   may be created by a lane through the blockers below, with NO cap on
//   their number. What each must do is LAND IN AN EXISTING HUB, explicitly:
//   a daily top by an entry in a hub's `cats` (never the silent "unplaced
//   lands in World" default — a new Family top in World is wrong by
//   default); a learn subject by its `lrn-` prefix (Knowledge, automatic);
//   a feed topic by a WF_BRANCH row, which is the "added to Taste →"
//   caption and not a placement at all — feed answers do not file on the
//   Map tab. A proposal that can only land in a hub that does not exist
//   HOLDs for the owner.
//
//   SUBTOPICS STAY THE CHEAPER SHAPE. A leaf inherits its parent's hue,
//   adds no chip, no branch and no install page (feed topics are always-on,
//   D96/D321), and is reached by following the parent — so the manual says
//   prefer a leaf when the questions are a PART of a topic that exists.
//   That is a preference of fit, not a cap: a subject that is nobody's part
//   is a topic.
//
// The reversal is not a licence, because everything the old rule was
// protecting is still true: a category is structure, not a label, and the
// old rule's failure was WHERE its caution sat — on a human who left the
// loop at D212 and never arrived (one category created in the project's
// life, `now`, D231, by the owner in person). The caution is arithmetic
// now, and it fires on a schedule. The shape is farm-budget.mjs's, one
// layer up: that regulator answers "how many questions may this run
// write", this one "may this run open a new room to write them into".
//
// BLOCKERS FOR A TOP — each something the old rule asserted in prose:
//
//   1. PLACED. It names an existing hub to land in (see above). Not placed
//      is the owner's question, never a run's.
//   2. EVIDENCE. D145's own sentence — "three runs proposing the same
//      missing top is an argument; one is an anecdote" — made literal:
//      EVIDENCE_MIN parked questions from RUNS_MIN distinct run days.
//   3. NO BREADTH DEBT. Every existing category on that surface at or above
//      its floor. A new room while the old ones are thin is breadth owed
//      twice. The number is the lane regulator's OWN deficit, so this file
//      cannot disagree with the lane about what thin means.
//   4. SETTLING. The last category created on that surface is at floor.
//
// BLOCKERS FOR A LEAF: evidence (parked plus RETAGGED existing questions
// under the parent — free stock, TAGS-PLAN's "a door on an existing
// question is the free first fix" one level down; days on the parked
// only), the parent levelled ("a leaf below a levelled parent is depth
// where breadth is still owed"), and settling per parent.
//
// THE WRITE RULE, both levels: the creating run writes min(budget, floor −
// stock) into the room in the PR that opens it, and the lane's own
// floor-first levelling finishes it — a room at 3 is the largest deficit
// on its surface (feed-budget.mjs's LANE_EXCLUDED comment describes exactly
// that pull). Settling holds the door meanwhile. Capacity was a BLOCKER in
// D421's first cut and locked learn out by arithmetic (cap 10, floor 24);
// it is a write rule since. The one exception is a feed LEAF: feed-budget
// levels topics, not leaves, so a feed leaf must be born full — and it
// always can be, FEED_CAP (60) ≥ LEAF_FLOOR (12), pinned.
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
// category written together, the ring included. Import-safe: the CLI runs
// only when invoked directly, so the arithmetic is unit-testable
// (topic-budget.test.mjs, via test:scripts — the runner CLAUDE.md warns
// hides in the lint job).
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

// The top level, per surface: floors and caps are the LANES' own, imported
// rather than restated (D197). `sites` is what a creating run must write,
// and the list check:taxonomy holds together — the hub site is on it for
// the daily and the feed, because a top written at every other site and
// not there lands in World (daily) or captions "added to Interests" (feed)
// without anybody having decided so.
export const TOPS = {
  feed: {
    floor: TOPIC_FLOOR, cap: FEED_CAP, noun: "topic",
    sites: [
      "src/v2/spec/world-feed-topics.js (WORLD_TOPICS)",
      "content/feed-questions.json (topics)",
      "src/v2/spec/world-feed.jsx (WF_BRANCH — the 'added to …' caption; a branch or hub label)",
    ],
  },
  daily: {
    floor: TOP_FLOOR, cap: DAILY_CAP, noun: "top",
    sites: [
      "src/v2/spec/daily-cats.js (CAT_META)",
      "src/v2/spec/map-groups.js (the hub's cats — never the silent World default)",
    ],
  },
  learn: {
    // A subject is levelled when every field under it is (loadLearnFields).
    floor: FIELD_FLOOR, cap: LEARN_CAP, noun: "subject",
    sites: ["content/learn-questions.json (subjects — Knowledge by the lrn- prefix, automatic)"],
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

//   placed   whether the proposal names an existing hub to land in (the CLI
//            resolves it: a daily `group` is a hub id, a feed `group` is a
//            WF_BRANCH target — a CAT_META key or a hub label — and learn is
//            always placed, by prefix)
//   parked   questions waiting for this top
//   days     distinct run days among them
//   deficit  the lane regulator's own total shortfall below its floor
//   budget   what the lane grants this run
//   settling the last top created on this surface: its stock, or null
export function topVerdict({ surface, placed = true, parked, days, deficit, budget, settling = null }) {
  const s = TOPS[surface];
  if (!s) throw new Error(`topic-budget: unknown surface ${JSON.stringify(surface)}`);
  const blockers = [];
  if (!placed) {
    blockers.push(
      `not placed: no existing hub on the You map takes it (D422 — the ring stays as it is "unless a new one is really ` +
      `needed", and that is the owner's call, on docs/OWNER-LIST.md) — name a \`group\` that exists, or propose it as a ` +
      `${LEAVES[surface] ? LEAVES[surface].noun : "path"} under \`nearest\``,
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

/** The You map's ring — MAP_GROUPS' hubs, with the branch ids each holds —
 * and the feed's caption table. Read through check:quality's extractor,
 * the one parser (D197). */
export async function loadRing() {
  const { extractLiteral } = await import("./question-quality.mjs");
  const groups = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "map-groups.js"), "utf8"), "const GROUPS = [", "map-groups.js");
  const ripples = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "world-feed.jsx"), "utf8"), "const WF_BRANCH = {", "world-feed.jsx", "{", "}");
  const catMeta = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "daily-cats.js"), "utf8"), "export const CAT_META = {", "daily-cats.js", "{", "}");
  return { groups, ripples, catMeta };
}

/** Whether a top-level proposal lands in a hub that exists. Daily: `group`
 * is a hub id. Feed: `group` is a WF_BRANCH target — a CAT_META key (a
 * branch) or a hub label. Learn: always, by the lrn- prefix. */
export function isPlaced(p, ring) {
  if (p.surface === "learn") return true;
  if (!p.group) return false;
  if (p.surface === "daily") return ring.groups.some((g) => g.id === p.group);
  if (p.surface === "feed") return Object.keys(ring.catMeta).includes(p.group) || ring.groups.some((g) => g.label === p.group);
  return false;
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

  const ring = await loadRing();
  console.log(`topic-budget: ${plural(proposals.length, "proposal")} in the ledger (evidence ${EVIDENCE_MIN} over ${RUNS_MIN} run days)`);
  console.log(`  the You map's ring is fixed (D422): ${ring.groups.length} hubs — ${ring.groups.map((g) => g.label).join(" · ")} — a new one is the owner's`);
  console.log("  the taxonomies grow, each new room landing in a hub that exists:");
  for (const [name, s] of Object.entries(TOPS)) {
    const t = tops[name];
    const leafRows = leaves[name];
    const leafLine = LEAVES[name] === null
      ? "second level is the free path [Top, Sub]"
      : `${plural(leafRows.length, LEAVES[name].noun)}, floor ${LEAVES[name].floor}, ${leafRows.filter((l) => l.stock < LEAVES[name].floor).length} under it`;
    console.log(`    ${name}: ${plural(t.count, s.noun)}, lane owes ${t.deficit}${t.deficit === 0 ? " (levelled)" : ""} · ${leafLine}`);
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
      const placed = isPlaced(p, ring);
      v = topVerdict({ surface: p.surface, placed, parked, days, deficit: tops[p.surface].deficit, budget: TOPS[p.surface].cap, settling });
      console.log(`    ${parked} parked over ${plural(days, "run day")} · hub ${p.group ? JSON.stringify(p.group) : "unstated"}${placed ? "" : " (none such)"} · lane owes ${tops[p.surface].deficit}`);
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
