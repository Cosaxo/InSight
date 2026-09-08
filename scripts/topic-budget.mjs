// topic-budget.mjs — when a lane may CREATE a category, as arithmetic (D421).
//
// WHY THIS EXISTS. Until D421 the answer was never: "A new category is never
// created by a run. Not for daily, not for feed topics, not for pick cats,
// not for learn fields or subjects" (QUESTION-FARM.md hard rule 3, restated
// at D145). The owner reversed it — the lanes create categories now — and
// the reversal is not a licence, because everything the old rule was
// protecting is still true: a category here is a CAT_META hue, a Map anchor
// with relations, a chip in a filter row, and for learn a group in the Map's
// layout. Adding one redraws the picture the Mirror exists to draw. What was
// wrong with the old rule was not its caution, it was WHERE the caution sat:
// on a human, who is not in the loop (D212), and who therefore never
// arrived — nine months of runs, one topic created (`now`, D231, by the
// owner in person). The caution moves into this file, where it can fire on a
// schedule.
//
// The shape is farm-budget.mjs's, one layer up: that regulator answers "how
// many questions may this run write", this one answers "may this run open a
// new room to write them into". Same property in both — the tap closes
// itself. There generation tracks promotion throughput; here taxonomy width
// tracks the lanes' stocking throughput, so the taxonomy can only grow as
// fast as it can be filled.
//
// THREE BLOCKERS AND A WRITE RULE, each something the old rule asserted in
// prose:
//
//   1. EVIDENCE. D145's own sentence — "three runs proposing the same
//      missing top is an argument; one is an anecdote" — made literal:
//      EVIDENCE_MIN parked questions from RUNS_MIN distinct run days. The
//      questions are parked in content/topic-proposals.json rather than
//      dropped, which is the other half of the reversal: the old rule threw
//      the evidence away ("drop the question") and then asked a human to
//      recognise a pattern across PR bodies nobody was reading.
//
//   2. NO BREADTH DEBT. Every existing category on that surface at or above
//      its floor. This is world-subtopics.js's rule generalised — "a thin
//      subtopic would feel like a broken room" — and the farm manual already
//      applies it one level down, deferring subtopic authoring until "the
//      ten parent topics level at the D213 target", because "a leaf below a
//      levelled parent is depth where breadth is still owed". A new room
//      while the old ones are thin is breadth owed twice. The number is not
//      computed here: it is the lane regulator's OWN deficit, so this file
//      cannot disagree with the lane about what thin means.
//
//   3. SETTLING. The last category created on that surface must itself be at
//      floor before another opens. One room at a time.
//
//   THE WRITE RULE. The creating run writes min(budget, floor − parked) into
//   the new category in the PR that opens it, and the lane's own regulator
//   finishes the job: a category at 3 is the largest deficit on its
//   surface, so floor-first levelling points the very next run at it
//   (feed-budget.mjs's LANE_EXCLUDED comment describes exactly this pull,
//   as the reason `now` had to be excluded from it). Blocker 3 is what
//   keeps the door shut meanwhile.
//
//   This was a fourth BLOCKER in the first cut of D421 — "the run must be
//   able to finish the room it opens" — and the arithmetic locked one
//   surface out without anybody noticing: the learn lane's cap is 10 and
//   its floor 24, so with 3 parked it could never grant the 21 owed, and a
//   rule the owner had just reversed would have stood on learn by
//   accident. Re-read the same day and found. For feed (cap 60, floor 24)
//   and daily (cap 8, floor 8) the write rule produces a category born at
//   its floor anyway, which is what the blocker was for; for learn it is
//   born at 13 and full two runs later.
//
// WHAT IS DELIBERATELY NOT A BLOCKER, and the measurement that decided it.
// The obvious fifth gate is semantic: is this proposal actually distinct, or
// is it a synonym of a topic that already exists? question-neighbors.mjs has
// the machinery (token-set Jaccard, stemmed, concept-folded), so the gate was
// written and then MEASURED against the live feed corpus before being
// believed — affinity as mean nearest-neighbour similarity, each topic's
// questions against their own topic and against every other:
//
//     topic     n   self   best other
//     now      17   0.049  0.076 (event)     <- self < other
//     people   31   0.079  0.066 (dilemma)
//     movies   33   0.125  0.107 (sport)
//     event    30   0.127  0.099 (dilemma)
//     dilemma  27   0.175  0.116 (food)
//     …
//     music    35   0.284  0.073 (bigq)
//
// The classes overlap: the lowest self-affinity (0.049) sits BELOW the
// highest cross-affinity (0.117), so no threshold separates them. Worse, the
// topic it fails hardest on is `now` — whose questions look more like
// `event`'s than like each other, exactly as D231 designed it to: "it is a
// TIME rather than a subject … what distinguishes this lane is not what a
// question is about but how long it is worth asking". A semantic gate would
// have refused the last real topic this project created, for the reason it
// was created. So there is none, and this comment is here so nobody derives
// it again. What survives is the check that IS true: a parked question must
// clear check:neighbors against the whole corpus like any other question —
// not already asked — which is enforced where every other question meets it.
//
// Distinctness is the run's argument, in the PR body, against the four
// numbers below. The gate is on the consequences, not on the meaning.
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
// LANE_EXCLUDED is deliberately NOT imported: loadFeedTopics already
// drops it, so blocker 2 never counts a topic its lane cannot stock
// (`now` is 7 under the floor today and would block the feed forever).
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

// The floors and caps are the LANES' own, imported rather than restated —
// D197's one-copy rule, and the reason blocker 2 cannot disagree with the
// regulator it reads. `sites` is what a creating run must write, and it is
// the list check:taxonomy holds together: a feed topic lives in TWO files
// (the client palette and the wire taxonomy), which is precisely the
// half-creation nothing caught before this file existed.
export const SURFACES = {
  daily: {
    floor: TOP_FLOOR,
    cap: DAILY_CAP,
    noun: "top",
    sites: ["src/v2/spec/daily-cats.js (CAT_META)"],
  },
  feed: {
    floor: TOPIC_FLOOR,
    cap: FEED_CAP,
    noun: "topic",
    sites: [
      "src/v2/spec/world-feed-topics.js (WORLD_TOPICS)",
      "content/feed-questions.json (topics)",
    ],
  },
  learn: {
    floor: FIELD_FLOOR,
    cap: LEARN_CAP,
    noun: "field",
    sites: ["content/learn-questions.json (fields)"],
  },
};

/** Distinct run days in a proposal's parked questions. A run that parked
 * three questions in one firing is one day, not three — the evidence rule is
 * about recurrence, and a single run cannot manufacture it by writing more. */
export function runDays(questions) {
  return new Set((questions ?? []).map((q) => String(q.run ?? "").slice(0, 10)).filter(Boolean)).size;
}

// Pure: the CLI prints nothing this function did not decide, so the test pins
// the verdict a lane actually gets.
//
//   parked   how many questions are waiting in the ledger for this category
//   days     distinct run days among them (runDays above)
//   deficit  the lane regulator's own total shortfall below its floor
//   budget   what the lane's regulator grants this run — it sizes the write,
//            it never blocks (the header has the learn lockout that decided it)
//   settling the previous created category's stock, or null if there is none
export function topicVerdict({ surface, parked, days, deficit, budget, settling = null }) {
  const s = SURFACES[surface];
  if (!s) throw new Error(`topic-budget: unknown surface ${JSON.stringify(surface)}`);
  const blockers = [];
  if (parked < EVIDENCE_MIN || days < RUNS_MIN) {
    blockers.push(
      `evidence: ${parked} parked question${parked === 1 ? "" : "s"} over ${days} run day${days === 1 ? "" : "s"} ` +
      `(need ${EVIDENCE_MIN} over ${RUNS_MIN}) — one run's opinion is an anecdote`,
    );
  }
  if (deficit > 0) {
    blockers.push(
      `breadth debt: the ${surface} lane owes ${deficit} question${deficit === 1 ? "" : "s"} to reach ` +
      `${s.floor}/${s.noun} on the categories that already exist — a new room while the old ones are thin ` +
      "is breadth owed twice",
    );
  }
  if (settling !== null && settling < s.floor) {
    blockers.push(
      `settling: the last ${surface} category created is at ${settling} of ${s.floor} — one room at a time`,
    );
  }
  const owed = Math.max(0, s.floor - parked);
  const write = Math.max(0, Math.min(budget, owed));
  const rest = owed - write;
  return {
    create: blockers.length === 0,
    owed,
    write,
    blockers,
    reason: blockers.length === 0
      ? `create it, write ${write} question${write === 1 ? "" : "s"} into it in the same PR (${parked} parked ` +
        `+ ${write} = ${parked + write} of ${s.floor}` +
        (rest > 0 ? `; the lane's floor-first levelling writes the other ${rest} on its next runs, and settling holds the door until then` : "") +
        `), and write every site: ${s.sites.join(" · ")}`
      : blockers[0],
  };
}

/** What a feed topic costs every device, read off the pager rather than
 * restated: the feed's topics are always-on (D96), so a new install fetches
 * a page per topic until its cache converges (bankPager.ts, D321). The
 * regulator PRINTS this and does not gate on it — a ceiling on the
 * taxonomy is a limit on what the axes can connect, and D352 puts that
 * kind of limit to the owner rather than into a script. Returns null if
 * the constant moves, so the line goes quiet instead of inventing a
 * number (D197). */
export function feedPageCost() {
  try {
    const src = readFileSync(join(root, "src", "v2", "data", "bankPager.ts"), "utf8");
    const m = /export const FEED_PAGE = (\d+);/.exec(src);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** D231's hue pick as an algorithm rather than a judgement: "hue 115 is the
 * widest gap left in the row (85 -> 145), picked for distance from its
 * neighbours rather than for a meaning". The midpoint of the widest arc on
 * the ring, which is the only choice that maximises the new topic's distance
 * from both neighbours — and the chroma/lightness tier never moves, so a
 * created chip cannot invent a visual language (D352's rule is about new
 * visual languages; a row on a surface that exists is not one). */
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

/** The hues a surface already spends, for hueFor. Daily reads CAT_META's own
 * hue field; feed reads the oklch third component out of WORLD_TOPICS. */
export function hueRing(surface, taxonomy) {
  if (surface === "daily") return Object.values(taxonomy).map((m) => m.hue);
  return taxonomy.map((t) => {
    const m = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)/.exec(t.color ?? "");
    return m ? Number(m[1]) : NaN;
  }).filter((h) => Number.isFinite(h));
}

export function loadLedger() {
  return JSON.parse(readFileSync(join(root, "content", "topic-proposals.json"), "utf8"));
}

/** Every surface's stock and its lane's shortfall, in the lane's own terms.
 * `deficit` is summed the way each lane regulator sums it, which is why this
 * reads their loaders instead of counting again. */
export async function loadSurfaces() {
  const daily = await loadDailyTops();
  const feed = loadFeedTopics();          // already drops LANE_EXCLUDED
  const learn = loadLearnFields();
  const debt = (rows, stockOf, floor) =>
    rows.reduce((sum, r) => sum + Math.max(0, floor - stockOf(r)), 0);
  return {
    daily: {
      rows: daily.map((t) => ({ id: t.id, stock: t.questions })),
      deficit: debt(daily, (t) => t.questions, TOP_FLOOR),
    },
    feed: {
      rows: feed.map((t) => ({ id: t.id, stock: t.questions })),
      deficit: debt(feed, (t) => t.questions, TOPIC_FLOOR),
    },
    learn: {
      rows: learn.map((f) => ({ id: f.id, stock: f.cards })),
      deficit: debt(learn, (f) => f.cards, FIELD_FLOOR),
    },
  };
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const ledger = loadLedger();
  const surfaces = await loadSurfaces();
  const proposals = ledger.proposals ?? [];

  console.log(`topic-budget: ${proposals.length} proposal${proposals.length === 1 ? "" : "s"} in the ledger`
    + ` (evidence ${EVIDENCE_MIN} questions over ${RUNS_MIN} run days)`);
  // The system's own top speed, stated so nobody has to derive it: with
  // every surface levelled the only brake is evidence, and the write rule
  // finishes a feed or daily room in the run that opens it — so the ceiling
  // is one category per RUNS_MIN days per surface. Whether that is the
  // right speed is the owner's (docs/OWNER-LIST.md, D421).
  console.log(`  top speed: one category per ${RUNS_MIN} run days per surface, when levelled — the owner's number to move`);
  for (const [name, s] of Object.entries(SURFACES)) {
    const sur = surfaces[name];
    console.log(`  ${name}: ${sur.rows.length} categories, floor ${s.floor}/${s.noun}`
      + `, lane owes ${sur.deficit}${sur.deficit === 0 ? " — levelled" : ""}`);
  }

  if (proposals.length === 0) {
    console.log("  no proposals — nothing to rule on. A lane parks an unfittable question here"
      + " (QUESTION-FARM.md § When no category fits); it does not drop it.");
  }

  for (const p of proposals) {
    const s = SURFACES[p.surface];
    if (!s) {
      console.log(`  ${p.id}: unknown surface ${JSON.stringify(p.surface)} — check:taxonomy will fail on this`);
      continue;
    }
    const sur = surfaces[p.surface];
    const parked = (p.questions ?? []).length;
    const days = runDays(p.questions);
    // The last category created on this surface, and what it holds now.
    const prior = (ledger.created ?? []).filter((c) => c.surface === p.surface).at(-1);
    const settling = prior ? (sur.rows.find((r) => r.id === prior.id)?.stock ?? 0) : null;
    // The lane's grant, minus what any other creation this run already spent.
    const budget = s.cap;
    const v = topicVerdict({ surface: p.surface, parked, days, deficit: sur.deficit, budget, settling });
    console.log(`\n  ${p.surface}/${p.id} — "${p.label}" (nearest existing: ${p.nearest ?? "unstated"})`);
    console.log(`    ${parked} parked over ${days} run day${days === 1 ? "" : "s"}`
      + ` · lane owes ${sur.deficit} · grant ${budget} · needs ${v.owed} more to reach ${s.floor}`);
    if (v.create) {
      const hue = p.surface === "learn" ? null : "see hueFor";
      console.log(`    CREATE — ${v.reason}`);
      if (hue) console.log("    hue: run hueFor(hueRing(surface, taxonomy)) — the widest gap's midpoint (D231's pick, mechanised)");
      if (p.surface === "feed") {
        const page = feedPageCost();
        console.log(page === null
          ? "    cost: FEED_PAGE not found in bankPager.ts — the per-install line is silent rather than invented"
          : `    cost: every new install fetches a page of ${page} for this topic until its cache converges (D96 always-on, D321)`
            + ` — ${surfaces.feed.rows.length + 1} topics × ${page} = ${(surfaces.feed.rows.length + 1) * page} first-session reads on the feed`);
      }
    } else {
      console.log("    HOLD:");
      for (const b of v.blockers) console.log(`      · ${b}`);
    }
  }
  process.exit(0);
}
