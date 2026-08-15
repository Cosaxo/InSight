// feed-budget.mjs — the feed lane's generation budget as arithmetic,
// replacing D97's flat "≤6 questions/run, at most twice weekly to start".
//
// WHY THIS EXISTS. The feed lane shipped with a contract and a flat cap and
// nothing calling it: "No Routine fires this lane yet; it runs when the
// maintainer asks a dev session." Zero farm-authored feed questions have ever
// reached the bank — all 82 rows in content/provenance.json read `editorial`.
// Giving the lane a Routine without giving it a regulator would hand a
// scheduled job the one shape D97 and D115 both had to remove: a flat cap
// generates into a full review queue and under-generates into an empty one,
// and D33 already named review capacity the binding constraint. So the cap
// becomes a computation before the lane becomes a schedule, not after.
//
// WHAT BOUNDS THIS LANE, which is neither of the other two. farm-budget.mjs
// regulates against a promotion PEN (finished questions waiting on a second
// human gate); learn-budget.mjs regulates against RUNWAY (a field's cards are
// consumed `fresh` exactly once each, so depth is days). The feed has neither:
// it is single-gate like learn — a merged feed PR IS the production review —
// but its cards are not consumed on a clock. A feed question stays servable
// forever and the surface serves continuously, so there is no bottom to run
// out of. The two real bounds are:
//
//   1. BREADTH, not depth. The lane's stated job while the crowd is small is
//      "breadth across the ten topics (thinnest-first, the coverage rule)".
//      A reader who filters to `people` meets three questions and a reader who
//      filters to `dilemma` meets twelve; the thin topics are the ones that
//      read as an empty product. So the deficit is measured per topic against
//      a level the bank already demonstrates, and levelling is the whole goal.
//   2. SIGNAL DILUTION, which is a rate bound rather than a stock one and is
//      why RUN_CAP stays small even when the deficit is large. The feed's
//      quality signal is per-question evenness, and a fixed crowd spread over
//      more questions leaves each one with too few answers to score. Adding
//      breadth costs measurement; that trade is worth making slowly.
//
// The constants (quoted in QUESTION-FARM.md and held equal by check:figures):
//   RUN_CAP      = 6   questions per run. D97's number, kept deliberately:
//                      unlike the daily and learn caps — which the regulators
//                      let rise BECAUSE a regulator throttles them — this one
//                      is bounded by dilution, and a regulator does not make a
//                      thin crowd thicker. Raising it is the D97 amendment
//                      that waits on the scorecard showing the crowd keeping
//                      up, not a consequence of this file existing.
//   TOPIC_TARGET = 12  servable questions per topic. Not invented: it is the
//                      depth `dilemma` already carries and `bigq` is one short
//                      of, so the target is "level the ten at what the
//                      best-covered already demonstrate". Ten topics at 12 is
//                      120 servable feed questions — +52 on today's 68, which
//                      lands the seeded bank near 565 against check:quality's
//                      BANK_WARN, leaving the headroom the learn lane needs
//                      for its own 182. (That constant was 1200, guarding an
//                      unpaginated fetch; D161 paged the fetch and re-pointed
//                      it at the localStorage cache budget, so the headroom
//                      this paragraph reasons about got much larger.)
//   OPEN_MAX     = 6   unreviewed questions on the lane's open roll-up PR at
//                      which generation stops entirely. Equal to RUN_CAP and
//                      subtracted from the budget, the learn lane's
//                      single-gate shape rather than the daily lane's: with no
//                      second gate behind the merge, the lane carries ONE
//                      unreviewed batch at a time.
//
// The budget:
//   deficit = Σ over topics of max(0, TOPIC_TARGET − servable questions)
//   budget  = 0  if open ≥ OPEN_MAX, else
//             min(RUN_CAP, OPEN_MAX − open, max(0, deficit − open))
//
// WHAT COUNTS AS DEPTH, and why the count is not `questions.length`. Two feed
// types are in the bank and cannot reach a reader: `rank` is not live-servable
// (D12) and `duel`-type feed cards are prototype legacy. Counting them would
// let a topic read as covered on questions nobody can be served — `sport` sits
// at 13 entries and 10 servable ones, and it is the 10 that a reader meets.
// Scene-attached `sNN` entries DO count: they are ordinary votes, the seed
// emits them, and a reader cannot tell them from any other card. They are out
// of the lane's AUTHORING scope, which is a different question from whether
// they cover a topic.
//
// This is an operator/run tool, not a CI gate — the CI-side feed gates are
// check:quality's feed surface and check:content's structural half.
// Import-safe: the CLI runs only when invoked directly, so the arithmetic is
// unit-testable (feed-budget.test.mjs, via test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RUN_CAP = 6;
export const TOPIC_TARGET = 12;
export const OPEN_MAX = 6;

// The forms a reader can actually be served (QUESTION-FARM.md § The feed lane,
// plus D12 for rank and D136 for path). `path` joined the servable set when
// Crossroads went live; the lane's authorable list is a subset of this one,
// because a legacy `duel` card still covers its topic for a reader.
export const SERVABLE_TYPES = new Set(["vote", "dial", "field", "path"]);

// Pure: everything the CLI prints derives from this one function, so the test
// pins the budget the lane actually gets.
//
// `topics` is [{ id, questions }] — every topic in the taxonomy, thin or not.
export function feedBudget({ topics, open = 0 }) {
  const deficit = topics.reduce((sum, t) => sum + Math.max(0, TOPIC_TARGET - t.questions), 0);

  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      reason:
        `the open lane PR already carries ${open} unreviewed questions (OPEN_MAX ${OPEN_MAX}) — ` +
        "review is the work now, not writing. A feed question merges straight into production; " +
        "a queue of them is unreviewed content one merge away from the feed",
    };
  }

  const budget = Math.min(RUN_CAP, OPEN_MAX - open, Math.max(0, deficit - open));
  if (budget === 0) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      reason:
        deficit === 0
          ? `every topic is at the ${TOPIC_TARGET}-question target — the ten read evenly, and a ` +
            "question written into a full topic buys breadth nobody was missing while costing " +
            "every question in it a share of the same crowd"
          : `the bank is ${deficit} questions short of ${TOPIC_TARGET}/topic, and the ${open} ` +
            "already written and unreviewed cover the whole of it — review is the work now",
    };
  }

  // Water-filling, thinnest first, ties broken on id so a run is reproducible.
  //
  // No MIN_CHUNK here, deliberately, and it is the one place this regulator
  // departs from learn-budget's shape rather than copying it. Learn chunks
  // because difficulty spread is a per-FIELD property that a single card
  // cannot demonstrate; the feed's batch-mix rules are per-BATCH (spread the
  // tones, vary the forms), and breadth across the ten topics is the lane's
  // stated job. Six questions into six thin topics is this lane working.
  const thin = topics
    .filter((t) => t.questions < TOPIC_TARGET)
    .sort((a, b) => a.questions - b.questions || a.id.localeCompare(b.id));

  const allocation = thin.map((t) => ({ topic: t.id, questions: t.questions, write: 0 }));
  let left = budget;
  let progress = true;
  while (left > 0 && progress) {
    progress = false;
    for (const a of allocation) {
      if (left === 0) break;
      if (a.questions + a.write >= TOPIC_TARGET) continue;
      a.write++;
      left--;
      progress = true;
    }
  }

  return {
    budget: budget - left,
    deficit,
    allocation: allocation.filter((a) => a.write > 0),
    reason:
      open > 0
        ? `the bank is ${deficit} questions short of ${TOPIC_TARGET}/topic, ${open} of them already written and unreviewed — capped at ${RUN_CAP}/run`
        : `the bank is ${deficit} questions short of ${TOPIC_TARGET}/topic — capped at ${RUN_CAP}/run`,
  };
}

export function loadFeedTopics() {
  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
  const counts = new Map(feed.topics.map((t) => [t.id, 0]));
  for (const q of feed.questions) {
    if (!SERVABLE_TYPES.has(q.type)) continue;
    // A question whose topic left the taxonomy is a check:quality failure, not
    // this script's to reinterpret — count only what the taxonomy names.
    if (!counts.has(q.cat)) continue;
    counts.set(q.cat, counts.get(q.cat) + 1);
  }
  return feed.topics.map((t) => ({ id: t.id, label: t.label, questions: counts.get(t.id) ?? 0 }));
}

// The scorecard line. The feed lane has no runway sentence to print — its
// questions are not consumed — so what a run needs to know instead is which
// MODE it is in: levelling blind, or writing where a real crowd answers. This
// says so out loud rather than leaving the run to infer it from zeros.
export function feedSignal(scorecard, topics) {
  if (!scorecard) return { mode: "blind", note: "no committed scorecard — coverage only, thinnest-first" };
  const rows = scorecard.topics || {};
  const scored = topics.reduce((n, t) => n + (rows[t.id]?.scored ?? 0), 0);
  const answers = topics.reduce((n, t) => n + (rows[t.id]?.answers ?? 0), 0);
  const ageDays = scorecard.generatedAt
    ? Math.floor((Date.now() - Date.parse(scorecard.generatedAt)) / 86400000)
    : null;
  if (!scored) {
    return {
      mode: "blind",
      note:
        `scorecard ${ageDays === null ? "carries no date" : `is ${ageDays} days old`} and scores 0 feed ` +
        "questions — coverage only, thinnest-first. Dilution costs nothing you can currently measure, " +
        "which is an argument for levelling now rather than for writing faster",
    };
  }
  return {
    mode: "signal",
    note:
      `scorecard scores ${scored} feed questions over ${answers} answers (${ageDays} days old) — ` +
      "read evenness per topic before allocating; the thinnest topic is not automatically the neediest",
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
  const { budget, deficit, allocation, reason } = feedBudget({ topics, open });
  const labels = new Map(topics.map((t) => [t.id, t.label]));

  console.log(`feed-budget: lane budget ${budget} (cap ${RUN_CAP}/run)`);
  console.log(
    `  bank: ${topics.reduce((n, t) => n + t.questions, 0)} servable questions over ${topics.length} topics · ` +
      `${deficit} short of ${TOPIC_TARGET}/topic + ${open} on the open PR` +
      `${openIdx < 0 ? " (assumed — pass --open with the real count)" : ""}`,
  );
  console.log(`  ${reason}`);

  if (allocation.length) {
    console.log("  write:");
    for (const a of allocation) {
      console.log(
        `    ${a.write} into ${a.topic} (${labels.get(a.topic)}) — at ${a.questions} of ${TOPIC_TARGET}`,
      );
    }
  }

  let scorecard = null;
  try {
    scorecard = JSON.parse(readFileSync(join(root, "content", "scorecard.json"), "utf8"));
  } catch {
    // Absent is a legitimate state the signal line names; a missing scorecard
    // must not stop a run computing its budget.
  }
  console.log(`  signal: ${feedSignal(scorecard, topics).note}`);
  process.exit(0);
}
