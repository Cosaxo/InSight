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
//   RUN_CAP      = 12  questions per run, a throughput number: what one run
//                      can pre-flight, argue one line each, door-justify
//                      and re-read as a batch at the writing bar — the
//                      learn lane's 10 plus the two continuum/path slots
//                      the batch-mix rule asks the feed to vary into. It is
//                      no longer bounded by the crowd; raise it when runs
//                      finish with the bar met and time to spare, lower it
//                      the day a batch merges with a dupe the re-read
//                      should have caught.
//   TOPIC_FLOOR  = 24  servable questions every topic reaches BEFORE any
//                      budget goes to demand — the breadth bound, kept at
//                      D213's level: a reader who filters to a topic meets
//                      a product, not three cards. A floor, not a target:
//                      nothing stops at it, and no number here says how
//                      big a topic may grow.
//   OPEN_MAX     = 12  unreviewed questions on the lane's open roll-up PR at
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RUN_CAP = 12;
export const TOPIC_FLOOR = 24;
export const OPEN_MAX = 12;
export const DEMAND_MIN_ANSWERS = 100;
export const DEMAND_STALE_DAYS = 30;

// The batch-mix gate's topic ceiling (question-quality.mjs checkBatch:
// `top > Math.ceil(feed.length * 0.75)` fails). Spelled once here so the
// allocation and the gate cannot disagree about what one topic may take.
export const BATCH_TOPIC_SHARE = 0.75;

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

// Thinnest first, ties on id so a run is reproducible. Re-sorted per pass so
// what a pass already wrote counts.
const byThinness = (rows) =>
  rows.slice().sort((a, b) => a.questions + a.write - (b.questions + b.write) || a.topic.localeCompare(b.topic));

// Pure: everything the CLI prints derives from this one function, so the test
// pins the budget the lane actually gets.
//
// `topics` is [{ id, questions }] — every allocatable topic, thin or not.
// `demand` is { topicId: weight } from feedSignal, or null when the lane is
// blind.
export function feedBudget({ topics, open = 0, demand = null }) {
  const deficit = topics.reduce((sum, t) => sum + Math.max(0, TOPIC_FLOOR - t.questions), 0);
  const empty = { deficit, allocation: [], split: { floor: 0, demand: 0, level: 0 } };

  if (open >= OPEN_MAX) {
    return {
      ...empty,
      budget: 0,
      reason:
        `the open lane PR already carries ${open} unreviewed questions (OPEN_MAX ${OPEN_MAX}) — ` +
        "review is the work now, not writing. A feed question merges straight into production; " +
        "a queue of them is unreviewed content one merge away from the feed",
    };
  }

  // Never zero for stock (D316): the only stop is the open PR above.
  const budget = Math.min(RUN_CAP, OPEN_MAX - open);
  const rows = topics.map((t) => ({ topic: t.id, questions: t.questions, write: 0, floor: 0, demand: 0, level: 0 }));
  let left = budget;

  // 1. The floor — breadth before anything else. One per under-floor topic
  //    per pass, thinnest first: six questions into six thin topics is this
  //    lane working (the breadth rule feed-budget.test.mjs pins), and a
  //    topic never takes more than its own room under the floor. Questions
  //    already sitting on the open PR are assumed to cover the deficit
  //    first — a checkout cannot see which topics they went to.
  let floorLeft = Math.min(left, Math.max(0, deficit - open));
  while (floorLeft > 0) {
    const under = byThinness(rows).filter((r) => r.questions + r.write < TOPIC_FLOOR);
    if (!under.length) break;
    for (const r of under) {
      if (!floorLeft) break;
      r.write++;
      r.floor++;
      floorLeft--;
      left--;
    }
  }

  // 2. Demand — everything the floor leaves, where the crowd answers.
  //    D'Hondt rounds (each unit to the topic with the highest
  //    weight ÷ (already given + 1)): proportional over a large budget,
  //    and over a small one it lands on the leaders rather than spreading
  //    one each to the tail, which is what "prioritise popular topics"
  //    means when there are twelve to give. Capped per topic at the
  //    batch-mix gate's own ceiling so the pre-flight can accept what the
  //    regulator printed.
  const weighted = demand ? rows.filter((r) => (demand[r.topic] ?? 0) > 0) : [];
  if (left > 0 && weighted.length) {
    const cap = Math.ceil(budget * BATCH_TOPIC_SHARE);
    while (left > 0) {
      const eligible = weighted.filter((r) => r.write < cap);
      if (!eligible.length) break;
      let pick = null;
      let best = -1;
      for (const r of eligible) {
        const score = demand[r.topic] / (r.demand + 1);
        if (!pick || score > best) {
          best = score;
          pick = r;
        } else if (score === best) {
          // Ties: the heavier weight, then id — reproducible either way.
          const w = demand[r.topic];
          const pw = demand[pick.topic];
          if (w > pw || (w === pw && r.topic < pick.topic)) pick = r;
        }
      }
      pick.write++;
      pick.demand++;
      left--;
    }
  }

  // 3. Levelling — no signal (or nothing left with weight), so the rest
  //    spreads thinnest-first across every topic with no ceiling: the bank
  //    grows evenly until the crowd says where.
  while (left > 0) {
    for (const r of byThinness(rows)) {
      if (!left) break;
      r.write++;
      r.level++;
      left--;
    }
  }

  const split = rows.reduce(
    (s, r) => ({ floor: s.floor + r.floor, demand: s.demand + r.demand, level: s.level + r.level }),
    { floor: 0, demand: 0, level: 0 },
  );
  // Floor rows first (thinnest first, as the bank stood), then the rest by
  // what they got.
  const allocation = [
    ...rows.filter((r) => r.floor > 0).sort((a, b) => a.questions - b.questions || a.topic.localeCompare(b.topic)),
    ...rows.filter((r) => r.floor === 0 && r.write > 0).sort((a, b) => b.write - a.write || a.topic.localeCompare(b.topic)),
  ];

  const parts = [];
  if (split.floor) parts.push(`${split.floor} to the ${TOPIC_FLOOR}/topic floor (${deficit} short${open ? `, ${open} of them on the open PR` : ""}, thinnest first)`);
  if (split.demand) parts.push(`${split.demand} by demand share`);
  if (split.level) parts.push(`${split.level} levelling thinnest-first above the floor (no demand signal)`);
  return {
    budget: budget - left,
    deficit,
    allocation,
    split,
    reason: `${parts.join(" · ")} — capped at ${RUN_CAP}/run${open ? `, less the ${open} unreviewed on the open PR` : ""}`,
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

// The demand signal, or the reason there is none. The feed lane has no
// runway sentence to print — its questions are not consumed — so what a run
// needs to know is which MODE it is in: levelling blind, or writing where a
// real crowd answers. Says so out loud rather than leaving the run to infer
// it from zeros. `now` is the clock, injectable so the staleness rule is
// testable.
export function feedSignal(scorecard, topics, now = Date.now()) {
  const blind = (note) => ({ mode: "blind", weights: null, note });
  if (!scorecard) return blind("no committed scorecard — levelling thinnest-first");
  const rows = scorecard.topics || {};
  const ageDays = scorecard.generatedAt
    ? Math.floor((now - Date.parse(scorecard.generatedAt)) / 86400000)
    : null;
  const age = ageDays === null ? "carries no date" : `is ${ageDays} days old`;
  if (ageDays === null || ageDays > DEMAND_STALE_DAYS) {
    return blind(
      `scorecard ${age} (the demand share is not read past ${DEMAND_STALE_DAYS} days) — ` +
        "a share off a stale crowd steers at last month's readers; levelling thinnest-first until it is refreshed",
    );
  }
  const credited = topics.map((t) => ({ id: t.id, stock: t.questions, answers: rows[t.id]?.answers ?? 0 }));
  const total = credited.reduce((n, t) => n + t.answers, 0);
  const scored = topics.reduce((n, t) => n + (rows[t.id]?.scored ?? 0), 0);
  if (total < DEMAND_MIN_ANSWERS) {
    return blind(
      `scorecard credits ${+total.toFixed(1)} feed answers over ${scored} scored questions (${age.replace("is ", "")}) — ` +
        `under ${DEMAND_MIN_ANSWERS}, a share measured on that few is noise; levelling thinnest-first`,
    );
  }
  const density = credited.map((t) => (t.stock ? t.answers / t.stock : 0));
  const deepest = Math.max(...density);
  const weights = {};
  credited.forEach((t, i) => {
    const popularity = t.answers / total;
    const depth = deepest ? density[i] / deepest : 0;
    weights[t.id] = +(popularity * depth).toFixed(4);
  });
  const sum = Object.values(weights).reduce((n, w) => n + w, 0);
  if (!sum) {
    // Answers credited only to topics with no servable stock (a legacy
    // duel-type card's topic, say): a crowd, but nothing it could be
    // steering toward.
    return blind(`scorecard credits ${+total.toFixed(1)} feed answers, none to a topic with servable stock — levelling thinnest-first`);
  }
  const lead = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id, w]) => `${id} ${Math.round((100 * w) / sum)}%`);
  return {
    mode: "demand",
    weights,
    note:
      `scorecard credits ${+total.toFixed(1)} feed answers over ${scored} scored questions (${age.replace("is ", "")}) — ` +
      `demand leads ${lead.join(", ")} (share of the budget above the floor; popularity × depth). ` +
      "Evenness per topic still steers WHAT to write, not where",
  };
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
      const why = a.floor
        ? `floor — at ${a.questions} of ${TOPIC_FLOOR}`
        : a.demand
          ? `demand — at ${a.questions}, weight ${signal.weights[a.topic]}`
          : `levelling — at ${a.questions}`;
      console.log(`    ${a.write} into ${a.topic} (${labels.get(a.topic)}) — ${why}`);
    }
  }
  console.log(`  signal: ${signal.note}`);
  process.exit(0);
}
