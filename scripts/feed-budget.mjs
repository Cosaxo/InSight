// feed-budget.mjs — the feed lane's generation budget as arithmetic: a
// coverage FLOOR every topic reaches first, a DEMAND share above it that
// follows where the crowd actually answers, and no ceiling (D342).
//
// WHY THIS EXISTS. The feed lane shipped with a contract and a flat cap and
// nothing calling it (D97); D145 gave it a Routine and this regulator in the
// same change, because a scheduled job with a flat cap is the one shape D97
// and D115 both had to remove — it generates into a full review queue and
// under-generates into an empty one. D213 raised the per-topic level from
// 12 to 24 and the cadence to daily. D342 is the third shape: the level
// became a floor rather than a target, the stop at the level went, and the
// budget above the floor follows demand.
//
// WHAT BOUNDED THIS LANE UNTIL D342, and why neither bound holds now. The
// regulator stopped at a per-topic TARGET ("every topic is at the target —
// a question written into a full topic buys breadth nobody was missing")
// and held RUN_CAP at 6 on a SIGNAL-DILUTION argument (a fixed crowd spread
// over more questions leaves each one with too few answers to score). Both
// were sized to a bank every device was handed whole, and that premise is
// gone: D316 adopted "there should be no question limit", D319–D321 built
// it — the install fetches the boot surfaces, the core and a page per
// topic, never the bank — and D316's own phases say what that does to the
// lanes: "production volume stops being sized to consumption … cadence and
// RUN_CAP become throughput questions answered by the writing bar rather
// than the read path." A target the lane stops at IS sizing production to
// consumption. What was true in the dilution argument survives in two
// places that are not a cap: DEMAND_MIN_ANSWERS below (the demand signal
// is not READ until the crowd is real, because a share measured on a
// handful of answers is noise), and D319's serving order (a question that
// measures badly sinks; nothing needs a cap to prevent it being written).
//
// The constants (quoted in QUESTION-FARM.md and held equal by
// check:figures):
//   RUN_CAP      = 60  questions per run — the owner's "much higher" after
//                      12, and D316's own order of magnitude over the
//                      original 6 ("question production scales up by an
//                      order of magnitude or more", SCALE-PLAN's first
//                      owner decision). A throughput number at the writing
//                      bar, not a crowd number: the batch gates score sixty
//                      candidates and their 1,770 sibling pairs in one
//                      pass, and the PR body carries one packet line and
//                      one argument per question as before. Lower it the
//                      day a batch merges with a dupe the re-read should
//                      have caught; it is one constant. What it costs is
//                      recorded at D342: at sixty a day the seeded bank
//                      reaches check:quality's BANK_WARN in about three
//                      months and BANK_FAIL in about five — the in-memory
//                      design that tripwire asks for is the decision owed
//                      before then, and it is a device change, not a cap.
//   TOPIC_FLOOR  = 24  servable questions every topic reaches BEFORE any
//                      budget goes to demand — the breadth bound, kept at
//                      D213's level: a reader who filters to a topic meets
//                      a product, not three cards. A floor, not a target:
//                      nothing stops at it, and no number here says how
//                      big a topic may grow.
//   OPEN_MAX     = 60  unreviewed questions on the lane's open roll-up PR at
//                      which generation stops entirely — equal to RUN_CAP
//                      and subtracted from the budget, the single-gate
//                      shape (a merged feed question is a served one, so
//                      the lane carries ONE unreviewed batch at a time).
//                      Since D212 a PR normally merges in the run that
//                      opened it, so a batch sitting open means a gate
//                      refused it — the right response is a fix, not a
//                      second batch. This is the one stop left, and it is
//                      about the gate, not the bank.
//   DEMAND_MIN_ANSWERS = 100  credited feed answers across the allocatable
//                      topics before the demand share is read at all.
//                      Below it the lane levels thinnest-first (the blind
//                      mode). Ten topics at ten answers each is the least
//                      a ranking can be told apart from noise — the same
//                      order as the taste profile's TASTE_MIN_TOTAL (10
//                      answers before a person's own profile shapes
//                      anything, D322) and the scorecard's 20-answer
//                      landslide floor.
//   DEMAND_STALE_DAYS  = 30  the committed scorecard's age past which its
//                      demand share is not read — the farm manual's own
//                      staleness rule (older than 30 days → coverage only),
//                      applied to this lane's signal.
//
// The budget:
//   budget   = 0                          if open ≥ OPEN_MAX
//            = min(RUN_CAP, OPEN_MAX − open)  otherwise — never 0 for stock
//   floor    = min(budget, max(0, Σ max(0, TOPIC_FLOOR − stock) − open)),
//              one per topic under the floor per pass, thinnest first
//   the rest = by DEMAND WEIGHT when the scorecard carries a signal
//              (D'Hondt rounds, so a small budget still lands on the
//              leaders), else LEVELLING — one per topic per pass, thinnest
//              first, with no ceiling
//
// Demand weight per topic = popularity × depth — the daily lane's demand
// lane (QUESTION-FARM.md § Picking topics) made computable for a surface
// that serves continuously. Popularity is the topic's share of credited
// feed answers (the scorecard's conserved shares, so a door redistributes
// demand and never mints it — TAGS-PLAN §3). Depth is answers per servable
// question, normalised to the deepest topic — how hard the topic's stock
// is being used, which is the reading of "how far its audience goes
// through the pool" that stays measurable while D319's volume order keeps
// new questions at the tail (least ÷ most would read 0 for every topic
// holding one unanswered question, which is all of them). The product is
// answers² ÷ stock: a big topic leads, and a small devoted one whose few
// questions all get answered earns content beside it. No topic's demand
// share may exceed the batch-mix gate's own ceiling (check:quality: no
// topic past ⌈0.75 × batch⌉), so the allocation never prints a batch the
// pre-flight would refuse.
//
// What the demand share may NOT do is unchanged: it allocates the TAIL
// (new production declares `core: false`, and only a person moves a
// question into the Mirror's corpus — QUESTION-FARM.md § The feed lane),
// and `now` stays out of the fold (D231, LANE_EXCLUDED below).
//
// WHAT COUNTS AS STOCK, and why the count is not `questions.length`. One
// feed type is in the bank and cannot reach a reader: `duel`-type feed
// cards are prototype legacy. Counting them would let a topic read as
// covered on questions nobody can be served. `rank` left this exclusion at
// D233 — an answer can carry an order now, so a rank card covers its topic
// like any other. Scene-attached `sNN` entries DO count: they are ordinary
// votes, the seed emits them, and a reader cannot tell them from any other
// card. They are out of the lane's AUTHORING scope, which is a different
// question from whether they cover a topic.
//
// This is an operator/run tool, not a CI gate — the CI-side feed gates are
// check:quality's feed surface and check:content's structural half.
// Import-safe: the CLI runs only when invoked directly, so the arithmetic is
// unit-testable (feed-budget.test.mjs, via test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allocateTiers, laneSignal, tierLabel, tierReason, BATCH_TOPIC_SHARE } from "./lane-tiers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RUN_CAP = 60;
export const TOPIC_FLOOR = 24;
export const OPEN_MAX = 60;
export const DEMAND_MIN_ANSWERS = 100;
export const DEMAND_STALE_DAYS = 30;

// The tiers themselves live once, in lane-tiers.mjs, shared with the daily
// and learn regulators; the batch-mix ceiling is re-exported so a test of
// this lane reads it from this lane.
export { BATCH_TOPIC_SHARE };

// The forms a reader can actually be served (QUESTION-FARM.md § The feed lane,
// plus D136 for path and D233 for rank). `path` joined the servable set when
// Crossroads went live and `rank` when answers learned to carry an order; the
// lane's authorable list is a subset of this one, because a legacy `duel`
// card still covers its topic for a reader.
export const SERVABLE_TYPES = new Set(["vote", "rank", "dial", "field", "path"]);

// Topics this lane may not write into (D231). `now` is the current-events
// lane, and it is EDITORIAL by design — docs/NEXT-FUNCTIONALITY.md §1 ends
// its "not doing" list with "farm-authored current events", because
// timeliness needs a human and a news question written by an unsupervised
// job is the thing the farm's governance exists to prevent.
//
// The exclusion has to live HERE rather than in the run's instructions,
// because the regulator would otherwise recruit the lane by arithmetic: a
// brand-new topic sits 24 under the floor, the largest deficit in the
// taxonomy, so thinnest-first would point every run at it from the day it
// was created — and once it had answers, demand would. A rule the
// allocator argues against every run is a rule that eventually loses.
export const LANE_EXCLUDED = new Set(["now"]);

// Pure: everything the CLI prints derives from this one function, so the test
// pins the budget the lane actually gets.
//
// `topics` is [{ id, questions }] — every allocatable topic, thin or not.
// `demand` is { topicId: weight } from feedSignal, or null when the lane is
// blind.
export function feedBudget({ topics, open = 0, demand = null }) {
  const deficit = topics.reduce((sum, t) => sum + Math.max(0, TOPIC_FLOOR - t.questions), 0);
  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      split: { floor: 0, demand: 0, level: 0 },
      reason:
        `the open lane PR already carries ${open} unreviewed questions (OPEN_MAX ${OPEN_MAX}) — ` +
        "review is the work now, not writing. A feed question merges straight into production; " +
        "a queue of them is unreviewed content one merge away from the feed",
    };
  }
  // Never zero for stock (D316): the only stop is the open PR above.
  const budget = Math.min(RUN_CAP, OPEN_MAX - open);
  const tiers = allocateTiers({
    rows: topics.map((t) => ({ id: t.id, stock: t.questions })),
    budget,
    floor: TOPIC_FLOOR,
    demand,
    open,
  });
  return {
    budget: tiers.spent,
    deficit,
    split: tiers.split,
    allocation: tiers.allocation.map((r) => ({
      topic: r.id, questions: r.stock, write: r.write, floor: r.floor, demand: r.demand, level: r.level,
    })),
    reason: tierReason({ split: tiers.split, deficit, open, floor: TOPIC_FLOOR, cap: RUN_CAP }),
  };
}

export function loadFeedTopics() {
  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
  const counts = new Map(feed.topics.map((t) => [t.id, 0]));
  for (const q of feed.questions) {
    if (!SERVABLE_TYPES.has(q.type)) continue;
    // Membership, not a partition (docs/TAGS-PLAN.md §3): a straddler covers
    // every topic it can be met through — home plus `also` doors — so a door
    // on an existing question is the free first fix for a thin topic: a new
    // question splits the conserved answer budget, a door on an existing one
    // does not. Doors onto subtopic leaves fall out at the taxonomy guard
    // below, the same way a retired topic would.
    for (const t of [q.cat, ...(q.also || [])]) {
      // A question whose topic left the taxonomy is a check:quality failure,
      // not this script's to reinterpret — count only what the taxonomy names.
      if (!counts.has(t)) continue;
      counts.set(t, counts.get(t) + 1);
    }
  }
  return feed.topics
    .filter((t) => !LANE_EXCLUDED.has(t.id))
    .map((t) => ({ id: t.id, label: t.label, questions: counts.get(t.id) ?? 0 }));
}

// The demand signal, or the reason there is none — lane-tiers' laneSignal
// pointed at where this lane's credited answers live: the scorecard's
// per-topic rows (lowercase feed ids; the daily's tops are capitalised, and
// the two are never mixed). `now` is injectable so the staleness rule is
// testable.
export function feedSignal(scorecard, topics, now = Date.now()) {
  return laneSignal({
    scorecard,
    rows: topics.map((t) => ({ id: t.id, stock: t.questions })),
    answersOf: (id) => scorecard?.topics?.[id]?.answers,
    minAnswers: DEMAND_MIN_ANSWERS,
    staleDays: DEMAND_STALE_DAYS,
    now,
    noun: "feed answers",
  });
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const openIdx = args.indexOf("--open");
  const open = openIdx >= 0 ? Number(args[openIdx + 1]) : 0;
  if (!Number.isInteger(open) || open < 0) {
    console.error("feed-budget: --open takes a non-negative integer (questions on the open lane PR)");
    process.exit(1);
  }

  const topics = loadFeedTopics();
  let scorecard = null;
  try {
    scorecard = JSON.parse(readFileSync(join(root, "content", "scorecard.json"), "utf8"));
  } catch {
    // Absent is a legitimate state the signal line names; a missing scorecard
    // must not stop a run computing its budget.
  }
  const signal = feedSignal(scorecard, topics);
  const { budget, deficit, allocation, reason } = feedBudget({ topics, open, demand: signal.weights });
  const labels = new Map(topics.map((t) => [t.id, t.label]));

  console.log(`feed-budget: lane budget ${budget} (cap ${RUN_CAP}/run)`);
  console.log(
    `  bank: ${topics.reduce((n, t) => n + t.questions, 0)} servable questions over ${topics.length} topics · ` +
      `${deficit} under the ${TOPIC_FLOOR}/topic floor + ${open} on the open PR` +
      `${openIdx < 0 ? " (assumed — pass --open with the real count)" : ""}`,
  );
  console.log(`  ${reason}`);

  if (allocation.length) {
    console.log("  write:");
    for (const a of allocation) {
      const why = tierLabel({ ...a, id: a.topic, stock: a.questions }, { floor: TOPIC_FLOOR, weights: signal.weights });
      console.log(`    ${a.write} into ${a.topic} (${labels.get(a.topic)}) — ${why}`);
    }
  }
  console.log(`  signal: ${signal.note}`);
  process.exit(0);
}
