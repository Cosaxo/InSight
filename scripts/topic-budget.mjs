// topic-budget.mjs — when a lane may CREATE a category, as arithmetic
// (D424), and what on the You map stays fixed while it does (D425).
//
// WHY THIS EXISTS. Until D424 the answer was never: "A new category is never
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
// THE POSTURE IS BREADTH-FIRST (D428). The first cut was depth-first —
// every room full before another opens, three days of evidence, one leaf
// per parent at a time — and the owner's reading of it was the correction:
// "the new topic generation should be higher than that, especially in
// learn … aim to almost become like reddit in the end where popular niches
// are almost all covered". Reddit's posture is the opposite of depth-first:
// a niche EXISTS the moment a few people want it, and popularity fills it
// later. So:
//
//   · A room is BORN WITH A HANDFUL, not full. LEAF_BIRTH questions for a
//     feed subtopic, FIELD_BIRTH cards for a learn field. The floor (12,
//     24) is what the lane fills TOWARD afterwards, thinnest first.
//   · A leaf is the LANE'S CALL, in one run. No day rule, no parent-levelled
//     rule, no settling: a leaf is cheap (no chip, no branch, no install
//     page) and it folds itself if it stays empty (D427, re-based below on
//     the handful rather than the floor). What the run owes is the reason in
//     the PR: which popular niche, and why this one before the others.
//   · COVERAGE is a number, and it steers. Every parent has a coverage
//     target (LEAF_TARGET leaves per feed topic, FIELD_TARGET fields per
//     learn subject), and a BREADTH_SHARE of every run's grant opens rooms
//     in the least-covered parents first — coverageAllocation says where.
//     The rest of the grant fills existing rooms, as before. Above the
//     target, opening continues on evidence (a parked question), not on
//     the coverage line.
//   · A learn SUBJECT is cheap too: it is a branch inside the Knowledge hub
//     by prefix, no chip, no hub change — so it is born like a leaf, in one
//     run, with FIELD_BIRTH cards in its first field. Five subjects is not
//     coverage of anything; the world's subjects are dozens.
//   · What costs the chip row, the Map's branches or every install still
//     waits: a feed topic (a chip and FEED_PAGE reads per new device, D96/
//     D321) and a daily top (a Map branch) keep the three-day evidence rule
//     and placement. Breadth debt is no longer a blocker anywhere — the
//     fill share is what pays it.
//
// What that costs, printed and put to the owner rather than gated: a
// learn field is a page of LEARN_PAGE (24) reads per device per boot under
// the follow-everything default (D283) until the interest model narrows
// it. The learn lane's cadence WAS the other cost — twice a week capped its
// reach more than any constant here — until the owner made it daily the
// same day (D428 amendment); the page cost stays on docs/OWNER-LIST.md.
//
// BLOCKERS FOR A FEED OR DAILY TOP — each something the old rule asserted
// in prose:
//
//   1. PLACED. It names an existing hub to land in (see above). Not placed
//      is the owner's question, never a run's.
//   2. EVIDENCE. D145's own sentence — "three runs proposing the same
//      missing top is an argument; one is an anecdote" — made literal:
//      EVIDENCE_MIN parked questions from RUNS_MIN distinct run days.
//   3. SETTLING. The last category created on that surface is at floor.
//
// A LEARN SUBJECT: born with FIELD_BIRTH cards in one field, one run.
//
// A LEAF: born with its handful (parked plus RETAGGED existing questions
// under the parent — free stock, TAGS-PLAN's "a door on an existing
// question is the free first fix" one level down), one run; the only
// blocker is capacity, and only when the run cannot reach the handful.
//
// THE WRITE RULE: the creating run writes min(budget, birth − stock) into
// the room in the PR that opens it. Filling toward the floor is the lane's
// ordinary levelling afterwards — learn levels fields (loadLearnFields
// counts per field); the feed levels TOPICS, and a leaf's questions ARE its
// parent's, so the fill is a tagging rule the CLI prints per topic: of the
// questions written into a parent, tag its thinnest leaves first.
//
// WHAT IS DELIBERATELY NOT A BLOCKER, and the measurement that decided it
// (D424 §5): a semantic "is this distinct?" gate. question-neighbors.mjs's
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
import { TOP_FLOOR, RUN_CAP as DAILY_CAP, loadDailyTops, farmSignal } from "./farm-budget.mjs";
// LANE_EXCLUDED is deliberately NOT imported: loadFeedTopics already drops
// it, so a parent the lane cannot stock (`now`) is never counted as thin.
import { TOPIC_FLOOR, RUN_CAP as FEED_CAP, loadFeedTopics, feedSignal } from "./feed-budget.mjs";
import { FIELD_FLOOR, RUN_CAP as LEARN_CAP, loadLearnFields, learnSignal } from "./learn-budget.mjs";

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
// (bankPager.ts FEED_PAGE): a leaf that fills one page is a whole shelf.
// Held equal to the pager's constant by the test (feedPageCost below reads
// it off the source), so the two cannot drift the way D197's copies did.
// Since D428 this is what the lane fills TOWARD, not what a leaf is born
// with — birth is the handful below.
export const LEAF_FLOOR = 12;

// D428 — Reddit's posture as numbers. A room exists with a handful; the
// lane fills it afterwards; coverage steers where the next room opens.
//   LEAF_BIRTH    4  a subtopic exists once four questions carry its tag —
//                    a reader who filters to it meets a shelf with something
//                    on it, and the feed is a mix, so a thin leaf is never
//                    the whole screen.
//   FIELD_BIRTH   6  a learn field exists with six cards across difficulties
//                    — check:quality's LEARN_FIELD_SPAN_MIN (20 points of p)
//                    needs a spread, and four cannot show one honestly.
//   LEAF_TARGET  12  leaves per feed topic the breadth share opens toward
//                    (Sport: football, tennis, running, cycling, F1, gym …).
//                    A floor for coverage, not a cap: above it, opening
//                    continues on evidence.
//   FIELD_TARGET  8  fields per learn subject, the same way.
//   BREADTH_SHARE 1/3 of a run's grant that opens rooms while any parent is
//                    under its coverage target — feed 20 of 60 (five leaves
//                    a day at birth), learn 10 of 30 (a field and a half a
//                    run). The other two thirds fill what exists.
export const LEAF_BIRTH = 4;
export const FIELD_BIRTH = 6;
export const LEAF_TARGET = 12;
export const FIELD_TARGET = 8;
export const BREADTH_SHARE = 1 / 3;

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
      "src/v2/spec/map-anchors.js (FALLBACK — the anchor readings a top's questions fall back to)",
    ],
  },
  learn: {
    // A subject is a branch inside Knowledge by prefix — no chip, no hub
    // change — so it is CHEAP: born like a leaf, one run, with FIELD_BIRTH
    // cards in its first field (D428).
    floor: FIELD_FLOOR, cap: LEARN_CAP, noun: "subject", cheap: true, birth: FIELD_BIRTH,
    sites: ["content/learn-questions.json (subjects — Knowledge by the lrn- prefix, automatic; plus its first field and that field's cards)"],
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
    floor: LEAF_FLOOR, birth: LEAF_BIRTH, target: LEAF_TARGET, cap: FEED_CAP, noun: "subtopic", parentNoun: "topic",
    // The feed levels TOPICS; a leaf's questions are its parent's, so the
    // fill toward the floor is a tagging rule the CLI prints per topic.
    levelledByLane: false,
    sites: ["src/v2/spec/world-subtopics.js (WORLD_SUBTOPICS)"],
  },
  learn: {
    floor: FIELD_FLOOR, birth: FIELD_BIRTH, target: FIELD_TARGET, cap: LEARN_CAP, noun: "field", parentNoun: "subject",
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
//   parked    questions written for this leaf and waiting in the ledger
//   retag     existing questions under the parent the proposal claims
//   budget    what the lane's regulator grants this run
//   parentOk  the parent exists on this surface and may carry leaves
export function leafVerdict({ surface, parked, retag = 0, budget, parentOk = true }) {
  const s = LEAVES[surface];
  if (s === null) {
    return {
      create: false, owed: 0, write: 0, blockers: [],
      reason: "the daily's second level is the path — write `cat: [Top, Sub]` on the question; there is nothing to create",
    };
  }
  if (!s) throw new Error(`topic-budget: unknown surface ${JSON.stringify(surface)}`);
  const blockers = [];
  if (!parentOk) blockers.push(`parent: not a ${surface} ${s.parentNoun} that may carry leaves`);
  const stock = parked + retag;
  const owed = Math.max(0, s.birth - stock);
  const write = Math.max(0, Math.min(budget, owed));
  if (write < owed) {
    blockers.push(`capacity: a ${s.noun} exists with its handful (${s.birth}) or not at all — ${stock} in hand, ${owed} to write, ${budget} granted`);
  }
  return {
    create: blockers.length === 0,
    owed, write, blockers,
    reason: blockers.length === 0
      ? `create it — the lane's call, one run (D428): write ${plural(write, "question")} into it in the same PR (${parked} parked + ${retag} retagged + ${write} = ${stock + write}, born at the handful of ${s.birth}; the lane fills it toward ${s.floor} afterwards), say in the PR which popular niche this is and why it before the others, and write every site: ${s.sites.join(" · ")}`
      : blockers[0],
  };
}

//   placed   whether the proposal names an existing hub to land in (the CLI
//            resolves it: a daily `group` is a hub id, a feed `group` is a
//            WF_BRANCH target — a CAT_META key or a hub label — and learn is
//            always placed, by prefix)
//   parked   questions waiting for this top
//   days     distinct run days among them
//   budget   what the lane grants this run
//   settling the last top created on this surface: its stock, or null
export function topVerdict({ surface, placed = true, parked, days, budget, settling = null }) {
  const s = TOPS[surface];
  if (!s) throw new Error(`topic-budget: unknown surface ${JSON.stringify(surface)}`);
  const blockers = [];
  if (!placed) {
    blockers.push(
      `not placed: no existing hub on the You map takes it (D425 — the ring stays as it is "unless a new one is really ` +
      `needed", and that is the owner's call, on docs/OWNER-LIST.md) — name a \`group\` that exists, or propose it as a ` +
      `${LEAVES[surface] ? LEAVES[surface].noun : "path"} under \`nearest\``,
    );
  }
  if (s.cheap) {
    // A learn subject: a branch inside Knowledge, no chip, no hub change —
    // the lane's call in one run, born with its first field's handful.
    const owed = Math.max(0, s.birth - parked);
    const write = Math.max(0, Math.min(budget, owed));
    if (write < owed) blockers.push(`capacity: a ${s.noun} exists with its first field's handful (${s.birth}) or not at all — ${parked} in hand, ${owed} to write, ${budget} granted`);
    return {
      create: blockers.length === 0, owed, write, blockers,
      reason: blockers.length === 0
        ? `create it — the lane's call, one run (D428): the subject row, its first field, and ${plural(write, "card")} into that field in the same PR (${parked} parked + ${write} = ${parked + write} of the handful ${s.birth}); Knowledge takes it by prefix; say in the PR which subject and why. Sites: ${s.sites.join(" · ")}`
        : blockers[0],
    };
  }
  if (parked < EVIDENCE_MIN || days < RUNS_MIN) {
    blockers.push(`evidence: ${plural(parked, "parked question")} over ${plural(days, "run day")} (need ${EVIDENCE_MIN} over ${RUNS_MIN}) — one run's opinion is an anecdote, and a ${s.noun} is a chip, a branch or a page per install`);
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

/** Where the breadth share opens rooms this run (D428). `parents` is
 * [{ id, rooms }] — every parent on the surface with how many leaves it
 * holds; the least covered (rooms ÷ target) get a room each, round-robin,
 * until the share is spent at `birth` per room. Parents at or over the
 * target get none from this share — above the target a room opens on
 * evidence, not on the coverage line. Returns the split so the lane can
 * pass the reserve to its own regulator (learn: --reserve). */
export function coverageAllocation({ parents, target, birth, budget, share = BREADTH_SHARE }) {
  const under = parents.filter((p) => p.rooms < target).map((p) => ({ ...p }));
  const breadth = Math.max(0, Math.floor(budget * share));
  let rooms = under.length ? Math.floor(breadth / birth) : 0;
  const opens = new Map();
  while (rooms > 0 && under.length) {
    under.sort((a, b) => (a.rooms / target) - (b.rooms / target) || a.id.localeCompare(b.id));
    const p = under[0];
    opens.set(p.id, (opens.get(p.id) ?? 0) + 1);
    p.rooms += 1;
    rooms -= 1;
    if (p.rooms >= target) under.shift();
  }
  const open = [...opens].map(([parent, n]) => ({ parent, open: n }));
  const spent = open.reduce((n, o) => n + o.open, 0) * birth;
  return {
    breadth: spent,
    fill: budget - spent,
    open,
    reason: open.length
      ? `open ${plural(open.reduce((n, o) => n + o.open, 0), "room")} this run (${spent} of ${budget}, ${birth} each): ${open.map((o) => `${o.parent} ×${o.open}`).join(" · ")} — least covered first; the lane picks the most popular uncovered niche in each, and says why in the PR`
      : parents.length && under.length === 0
        ? `every parent is at its coverage target (${target}) — the breadth share rests; a room above the target opens on evidence`
        : `the breadth share (${breadth}) cannot reach one room's handful (${birth}) — nothing opens this run`,
  };
}

/** D424's name for the top-level verdict, kept for the record's readers. */
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

// ── retirement (D427): fold, never delete ──
//
// WHY A PATH OUT EXISTS. D424 and D425 made creation cheap and left removal
// impossible — a room that stopped earning its place had nowhere to go, and
// the ledger had nowhere to say so. That asymmetry compounds: every room
// created under the evidence rule was a room that could never be wrong.
// The owner asked for the path out the day the path in merged.
//
// THE PRINCIPLE: a room is retired by FOLDING its questions into another
// room, never by deleting them. Answers are public and immutable but for one
// edit shape (D86), every daily answer is filed on somebody's Map, and a
// deleted question is an orphaned answer. So a fold rewrites where a
// question is MET — its `cat`, `sub` or `f` — and nothing else about it, and
// the ledger's `retired` list is what makes "retired" mean retired:
// check:taxonomy rule 7 fails a retired id found at any site.
//
// WHAT LICENSES A FOLD, per level — and the levels differ on purpose:
//   · a LEAF that is thin (stock under its floor). Feed leaves are not
//     levelled by their lane, so a thin leaf has exactly two futures — fill
//     it this run or fold it — and the fold is free: dropping `sub` leaves
//     every question exactly where it was, the parent's.
//   · a TOP that nobody answers: the lane's own demand signal readable
//     (laneSignal, past DEMAND_MIN_ANSWERS) and the room's share under
//     RETIRE_SHARE of an even share. "Thin" is NOT a signal for a top — the
//     lane levels tops thinnest-first, so a thin top gets filled, never
//     retired. While the crowd is too small to read, a top-level fold is
//     the OWNER'S word: a date in the ledger row.
//   · the owner's word licenses either level at any time — D334's ask, the
//     other way round: the ruling, recorded where the run reads it.
//   · a top with leaves under it is folded AFTER its leaves (a blocker): a
//     leaf re-parented in passing is a placement nobody argued.
//
// WHAT A FOLD MOVES, and what it costs:
//   · feed leaf → strip `sub`; `into` is the parent, always. Costs nothing.
//   · learn field → the cards' `f` → into, a field of the SAME subject: the
//     Map files mastered cards under lrn-<subject>, so a cross-subject fold
//     moves them between hubs — a top-level move, the owner's.
//   · feed topic → the questions' `cat` → into; a door onto it is dropped,
//     or replaced by into where into is not already carried; the palette
//     row, the wire row and the WF_BRANCH caption go. Feed answers do not
//     file on the Map tab, so what moves is where the cards are met, and
//     the demand credit.
//   · daily top → the archive rows' cat[0] (and any alts) → into; the
//     CAT_META row, the hub's `cats` entry and the FALLBACK row go. THIS
//     ONE MOVES ANSWERS ON EVERY USER'S MAP — a daily answer is filed by its
//     question's branch and the branch is gone — which is why a daily fold
//     takes the owner's word or a real crowd's silence, never a run's
//     tidiness.
//   · a HUB is the owner's in both directions (D425): branches re-hubbed
//     first, GROUPS_TODAY moved in the same PR.
export const RETIRE_SHARE = 0.1;

//   into        the room the questions fold into
//   intoExists  whether it exists at the right level, on the same surface,
//               and (feed leaf) is the parent / (learn field) shares the subject
//   stock       the room's stock; floor its level's floor
//   leaves      leaves still under a top (must be 0)
//   ownerSaid   the ledger row carries the owner's dated word
//   signal      the lane's laneSignal result, or null; share the room's share
//               of its weights; evenShare 1/N — the demand half of a licence
export function retireVerdict({ level, surface, id, into, intoExists, stock, floor, birth = null, leaves = 0, ownerSaid = false, signal = null, share = null, evenShare = null }) {
  const s = level === "leaf" ? LEAVES[surface] : TOPS[surface];
  if (!s) throw new Error(`topic-budget: no ${level} on surface ${JSON.stringify(surface)}`);
  const blockers = [];
  if (!into) blockers.push("no `into` — a room is folded into another, never deleted; name where its questions go");
  else if (into === id) blockers.push("`into` is the room itself");
  else if (!intoExists) {
    blockers.push(level === "leaf" && surface === "feed"
      ? `\`into\` must be the leaf's own parent — a leaf's questions are already the parent's, and the fold just drops the tag`
      : level === "leaf"
        ? `\`into\` must be a ${s.noun} of the same ${s.parentNoun} — across ${s.parentNoun}s is a move between hubs, the owner's`
        : `\`into\` is not a ${surface} ${s.noun} that exists`);
  }
  if (leaves > 0) blockers.push(`${plural(leaves, "leaf")} still under it — fold the leaves first, each with its own row`);
  // D428 re-based the leaf's thin licence on the HANDFUL it was born with,
  // not the floor: every leaf is under the floor at birth now, and the lane
  // fills it — so "thin" means it fell below its handful (questions retired
  // from under it), or the crowd is readable and silent on it.
  const handful = birth ?? s.birth ?? floor;
  const thin = level === "leaf" && stock < handful;
  const readable = signal && signal.mode !== "blind";
  const silent = readable && share !== null && evenShare !== null && share < RETIRE_SHARE * evenShare;
  const licence = ownerSaid ? "the owner's word"
    : level === "leaf" && thin ? `below its handful: ${stock} of ${handful} — the room it was born with is gone, and a ${surface} ${s.noun} that lost its handful has two futures — fill it this run, or fold`
    : silent ? `nobody answers it: ${(share * 100).toFixed(1)}% of the crowd's share against an even ${(evenShare * 100).toFixed(1)}% (under ${RETIRE_SHARE} of even)`
    : null;
  if (!licence) {
    blockers.push(level === "leaf"
      ? `no licence: it holds its handful (${stock} of ${handful}), the crowd is ${readable ? "not silent on it" : "too small to read"} and the owner has not said — a room with its handful stays and the lane fills it`
      : readable
        ? `no licence: the crowd answers it (${share === null ? "share unread" : (share * 100).toFixed(1) + "%"} against an even ${evenShare === null ? "?" : (evenShare * 100).toFixed(1) + "%"}) and the owner has not said`
        : `no licence: the demand signal is blind (${signal ? signal.note : "no signal"}) and the owner has not said — a top folds on a real crowd's silence or the owner's word, never on a run's tidiness`);
  }
  const fold = level === "leaf" && surface === "feed" ? `strip \`sub: "${id}"\` from every feed question carrying it (they stay ${into}'s)`
    : level === "leaf" ? `rewrite \`f: "${id}"\` → "${into}" on every card`
    : surface === "feed" ? `rewrite \`cat: "${id}"\` → "${into}" on every feed question; drop each \`also\` door onto it (or replace with "${into}" where not already carried)`
    : surface === "daily" ? `rewrite cat[0] "${id}" → "${into}" on every archive row, and every alt naming it — answers move branch on every user's Map`
    : `rewrite each field's subject "${id}" → "${into}"`;
  return {
    retire: blockers.length === 0,
    licence,
    blockers,
    reason: blockers.length === 0
      ? `retire it — ${licence}. Fold: ${fold}; then remove every site: ${s.sites.join(" · ")}; then move the row from \`retirements\` to \`retired\` with the PR`
      : blockers[0],
  };
}

/** The demand reading a retirement licence needs: the lane's own signal over
 * its own rows, the room's share of the weights, and an even share. Null
 * share when the room has no weight — which, with the signal readable, is
 * the strongest silence there is. */
export function demandReading(signal, id, rowIds) {
  if (!signal || signal.mode === "blind" || !signal.weights) return { share: null, evenShare: null };
  const sum = Object.values(signal.weights).reduce((n, w) => n + w, 0) || 1;
  return { share: (signal.weights[id] ?? 0) / sum, evenShare: 1 / Math.max(1, rowIds.length) };
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
  console.log(`  the You map's ring is fixed (D425): ${ring.groups.length} hubs — ${ring.groups.map((g) => g.label).join(" · ")} — a new one is the owner's`);
  console.log("  the taxonomies grow, each new room landing in a hub that exists:");
  for (const [name, s] of Object.entries(TOPS)) {
    const t = tops[name];
    const leafRows = leaves[name];
    const leafLine = LEAVES[name] === null
      ? "second level is the free path [Top, Sub]"
      : `${plural(leafRows.length, LEAVES[name].noun)}, floor ${LEAVES[name].floor}, ${leafRows.filter((l) => l.stock < LEAVES[name].floor).length} under it`;
    console.log(`    ${name}: ${plural(t.count, s.noun)}, lane owes ${t.deficit}${t.deficit === 0 ? " (levelled)" : ""} · ${leafLine}`);
  }
  // D428 — where the breadth share opens rooms this run, per surface, and
  // which existing leaves the fill should tag first.
  const learnJson = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
  const coverage = {
    feed: coverageAllocation({
      parents: tops.feed.rows.map((r) => ({ id: r.id, rooms: leaves.feed.filter((l) => l.parent === r.id).length })),
      target: LEAF_TARGET, birth: LEAF_BIRTH, budget: FEED_CAP,
    }),
    learn: coverageAllocation({
      parents: learnJson.subjects.map((sj) => ({ id: sj.id, rooms: leaves.learn.filter((l) => l.parent === sj.id).length })),
      target: FIELD_TARGET, birth: FIELD_BIRTH, budget: LEARN_CAP,
    }),
  };
  console.log("  coverage (D428 — a room exists with a handful; the breadth share opens rooms least-covered first):");
  for (const [name, c] of Object.entries(coverage)) {
    const parents = name === "feed" ? tops.feed.rows.map((r) => r.id) : learnJson.subjects.map((sj) => sj.id);
    const target = name === "feed" ? LEAF_TARGET : FIELD_TARGET;
    const line = parents.map((id) => `${id} ${leaves[name].filter((l) => l.parent === id).length}/${target}`).join(" · ");
    console.log(`    ${name}: ${line}`);
    console.log(`      ${c.reason}`);
    if (name === "learn") console.log(`      then: npm run learn:budget -- --reserve ${c.breadth} (the fill share is ${c.fill}); each field is a page of 24 reads per device per boot until the interest model narrows it`);
    const thin = leaves[name].filter((l) => l.stock < LEAVES[name].floor);
    if (thin.length) console.log(`      fill first (under ${LEAVES[name].floor}): ${thin.map((l) => `${l.id} ${l.stock}${name === "feed" ? ` (tag questions written into ${l.parent})` : ""}`).join(" · ")}`);
  }
  if (proposals.length === 0) {
    console.log("  no proposals — nothing to rule on. A lane opens the rooms the coverage line names, and parks a question that"
      + " fits nothing under its nearest parent (QUESTION-FARM.md § When no category fits); it does not drop it.");
  }

  for (const p of proposals) {
    const level = levelOf(p);
    const parked = (p.questions ?? []).length;
    const days = runDays(p.questions);
    console.log(`\n  ${p.surface}/${p.id} (${level}) — "${p.label}"` + (p.parent ? ` under ${p.parent}` : ` nearest ${p.nearest ?? "unstated"}`));
    if (!TOPS[p.surface]) { console.log(`    unknown surface ${JSON.stringify(p.surface)} — check:taxonomy fails on this`); continue; }
    let v;
    if (level === "leaf") {
      const retag = (p.retag ?? []).length;
      const parentOk = p.surface === "feed"
        ? tops.feed.rows.some((r) => r.id === p.parent)
        : p.surface === "learn" ? learnJson.subjects.some((sj) => sj.id === p.parent)
        : false;
      v = leafVerdict({ surface: p.surface, parked, retag, budget: LEAVES[p.surface]?.cap ?? 0, parentOk });
      console.log(`    ${parked} parked + ${retag} retagged · grant ${LEAVES[p.surface]?.cap ?? 0} · handful ${LEAVES[p.surface]?.birth ?? "-"}`);
    } else {
      const prior = (ledger.created ?? []).filter((c) => c.surface === p.surface && levelOf(c) === "top").at(-1);
      const settling = prior ? (tops[p.surface].rows.find((r) => r.id === prior.id)?.stock ?? 0) : null;
      const placed = isPlaced(p, ring);
      v = topVerdict({ surface: p.surface, placed, parked, days, budget: TOPS[p.surface].cap, settling });
      console.log(`    ${parked} parked over ${plural(days, "run day")} · hub ${p.group ? JSON.stringify(p.group) : "unstated"}${placed ? "" : " (none such)"}${TOPS[p.surface].cheap ? " · cheap: Knowledge by prefix" : ""}`);
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
  const retirements = ledger.retirements ?? [];
  if (retirements.length) {
    let scorecard = null;
    try { scorecard = JSON.parse(readFileSync(join(root, "content", "scorecard.json"), "utf8")); } catch { /* absent is a state the signal names */ }
    console.log(`\n  ${plural(retirements.length, "retirement")} proposed — fold, never delete (D427):`);
    for (const r of retirements) {
      const level = levelOf(r);
      const t = tops[r.surface], l = leaves[r.surface];
      if (!t) { console.log(`  ${r.surface}/${r.id}: unknown surface — check:taxonomy fails on this`); continue; }
      let stock = 0, floor = 0, leavesUnder = 0, intoExists = false, signal = null, rowIds = [];
      if (level === "leaf") {
        const row = (l ?? []).find((x) => x.id === r.id);
        stock = row?.stock ?? 0; floor = LEAVES[r.surface]?.floor ?? 0;
        intoExists = r.surface === "feed" ? r.into === row?.parent
          : (l ?? []).some((x) => x.id === r.into && x.parent === row?.parent);
      } else {
        floor = TOPS[r.surface].floor;
        if (r.surface === "learn") {
          const fields = (l ?? []).filter((x) => x.parent === r.id);
          stock = fields.reduce((n, f) => n + f.stock, 0); leavesUnder = fields.length;
          const learnJson = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
          intoExists = learnJson.subjects.some((sj) => sj.id === r.into);
          const sig = learnSignal(scorecard, loadLearnFields());
          // a subject's share is its fields' shares summed
          if (sig.weights) { const w = {}; for (const f of loadLearnFields()) { const fid = learnJson.fields.find((x) => x.id === f.id)?.subject; if (fid) w[fid] = (w[fid] ?? 0) + (sig.weights[f.id] ?? 0); } signal = { ...sig, weights: w }; } else signal = sig;
          rowIds = learnJson.subjects.map((sj) => sj.id);
        } else {
          const row = t.rows.find((x) => x.id === r.id);
          stock = row?.stock ?? 0;
          leavesUnder = (l ?? []).filter((x) => x.parent === r.id).length;
          intoExists = t.rows.some((x) => x.id === r.into);
          signal = r.surface === "feed" ? feedSignal(scorecard, loadFeedTopics()) : farmSignal(scorecard, await loadDailyTops());
          rowIds = t.rows.map((x) => x.id);
        }
      }
      const { share, evenShare } = demandReading(signal, r.id, rowIds);
      const v = retireVerdict({ level, surface: r.surface, id: r.id, into: r.into, intoExists, stock, floor, birth: level === "leaf" ? LEAVES[r.surface]?.birth ?? null : null, leaves: leavesUnder,
        ownerSaid: /^\d{4}-\d{2}-\d{2}/.test(String(r.owner ?? "")), signal, share, evenShare });
      console.log(`\n  ${r.surface}/${r.id} (${level}) → ${r.into ?? "?"} — ${r.reason ?? "no reason given"}`);
      console.log(`    stock ${stock} of ${floor}${leavesUnder ? ` · ${plural(leavesUnder, "leaf")} under it` : ""}${r.owner ? ` · owner ${r.owner}` : ""}${signal ? ` · signal: ${signal.mode === "blind" ? "blind" : "readable"}` : ""}`);
      if (v.retire) console.log(`    RETIRE — ${v.reason}`);
      else { console.log("    HOLD:"); for (const b of v.blockers) console.log(`      · ${b}`); }
    }
  }
  process.exit(0);
}
