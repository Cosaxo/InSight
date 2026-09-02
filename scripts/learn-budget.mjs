// learn-budget.mjs — the learn lane's generation budget as arithmetic (D115),
// replacing D32's flat "≤8 cards/run, thinnest fields first"; reshaped at
// D350 around a FLOOR with no ceiling, the feed regulator's shape.
//
// WHY THIS EXISTS. The flat rule did not merely under-produce; it produced
// NOTHING, and had to. "Thinnest fields first (a field below 8 cards cannot
// sustain the scheduler's spacing)" reads as a floor, every one of the twelve
// fields sits at exactly 8, and so no field is ever thin and every run is a
// correctly-reasoned no-op. The lane has no Routine either, so the rule was
// never tested against a real firing. A lane whose selection rule can only
// return the empty set is not a conservative lane, it is a stopped one.
//
// WHAT BOUNDED THIS LANE UNTIL D350, and why it no longer does. D115 gave it
// a TARGET of 24 cards per field and stopped there ("every field is at the
// target — a card written into a full field is inventory rather than
// runway"). That sentence was sized to a bank every device was handed whole
// and to a runway measured in days of reading; D283 moved the runway
// premise (every field followed by default) and re-labelled 24 a "shape
// goal", D316 phase 2 said the lane's pace unbinds from consumption once
// learn pages, and D320 paged it. The script still stopped. It does not
// now: 24 is the FLOOR every field reaches first — what makes a field worth
// following ON ITS OWN, the question a reader who narrows is asking — and
// above it the budget follows where the crowd is reading fastest, or
// levels thinnest-first, with no ceiling. The single-gate posture is
// unchanged: a merged card is a shipped card, so the lane carries ONE
// unreviewed batch at a time, and that is the one stop left.
//
// The constants (quoted in QUESTION-FARM.md and held equal by check:figures):
//   RUN_CAP      = 10  cards per run — a throughput figure at the writing
//                      bar (each card's trap argued, its fact sourced, its
//                      difficulty placed), not a stock one. Raise it when
//                      runs finish with the bar met and time to spare.
//   FIELD_FLOOR  = 24  cards per field, reached first — three times the
//                      scheduler's 8-card spacing floor, and the depth at
//                      which a single followed field carries a default-rate
//                      reader about a month. A floor, not a target: nothing
//                      stops at it, and no number says how deep a field may
//                      grow.
//   OPEN_MAX     = 10  unreviewed cards on the lane's open PR at which
//                      generation stops entirely. Equal to RUN_CAP and
//                      subtracted from the budget: with no second gate
//                      behind the merge, the lane carries ONE unreviewed
//                      batch at a time. Since D212 a PR normally merges in
//                      the run that opened it, so a batch sitting open
//                      means a gate refused it — fix, do not stack.
//   MIN_CHUNK    = 4   cards per field a run may write. Not a bound on volume
//                      but on SHAPE: one card each into ten fields is ten
//                      context switches for the writer and cannot demonstrate
//                      the difficulty spread check:quality's batch rule asks
//                      for, which is a per-field property.
//   DEMAND_MIN_ANSWERS = 100  credited learn answers across the fields
//                      before the demand share is read; below it the lane
//                      levels. The feed's threshold, for the feed's reason:
//                      a share measured on a handful of answers is noise.
//   DEMAND_STALE_DAYS  = 30  the scorecard's age past which its demand
//                      share is not read (the manual's staleness rule).
//
// The budget:
//   budget = 0 if open ≥ OPEN_MAX, else min(RUN_CAP, OPEN_MAX − open)
//            — never zero for stock
// allocated through lane-tiers' CHUNK mode: a run touches at most
// ⌊budget ÷ MIN_CHUNK⌋ fields, chosen in tier order — under the floor
// thinnest first, then by demand weight (popularity × depth: the field's
// share of credited learn answers times answers per card against the
// deepest field — a field being read fastest is the one running out
// soonest, which is what "runway" meant), then thinnest — and splits the
// budget evenly among them, so the writer holds one subject per chunk.
//
// This is an operator/run tool, not a CI gate — the CI-side learn gates are
// check:quality's learn surface and check:content's structural half.
// Import-safe: the CLI runs only when invoked directly, so the arithmetic is
// unit-testable (learn-budget.test.mjs, via test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allocateTiers, laneSignal, tierLabel, tierReason } from "./lane-tiers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RUN_CAP = 10;
export const FIELD_FLOOR = 24;
export const OPEN_MAX = 10;
export const MIN_CHUNK = 4;
export const DEMAND_MIN_ANSWERS = 100;
export const DEMAND_STALE_DAYS = 30;

// Pure: everything the CLI prints derives from this one function, so the test
// pins the budget the lane actually gets.
//
// `fields` is [{ id, cards }] — every field in the bank, thin or not.
// `demand` is { fieldId: weight } from learnSignal, or null when blind.
export function learnBudget({ fields, open = 0, demand = null }) {
  const deficit = fields.reduce((sum, f) => sum + Math.max(0, FIELD_FLOOR - f.cards), 0);

  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      split: { floor: 0, demand: 0, level: 0 },
      reason:
        `the open lane PR already carries ${open} unreviewed cards (OPEN_MAX ${OPEN_MAX}) — ` +
        "review is the work now, not writing. A learn card merges straight into production; " +
        "a queue of them is unreviewed content one merge away from readers",
    };
  }

  // `OPEN_MAX - open` is what makes "one unreviewed batch at a time" true
  // rather than aspirational. Never zero for stock (D316/D350).
  const budget = Math.min(RUN_CAP, OPEN_MAX - open);
  const tiers = allocateTiers({
    rows: fields.map((f) => ({ id: f.id, stock: f.cards })),
    budget,
    floor: FIELD_FLOOR,
    demand,
    open,
    chunk: MIN_CHUNK,
  });
  return {
    budget: tiers.spent,
    deficit,
    split: tiers.split,
    allocation: tiers.allocation.map((r) => ({
      field: r.id, cards: r.stock, write: r.write, floor: r.floor, demand: r.demand, level: r.level,
    })),
    reason: tierReason({ split: tiers.split, deficit, open, floor: FIELD_FLOOR, cap: RUN_CAP, unit: "cards", group: "field" }),
  };
}

// The demand signal, or the reason there is none — lane-tiers' laneSignal
// pointed at where this lane's credited answers live: the scorecard's
// `learn.fields` rows (D33's learn section), not the daily/feed topic rows.
export function learnSignal(scorecard, fields, now = Date.now()) {
  return laneSignal({
    scorecard,
    rows: fields.map((f) => ({ id: f.id, stock: f.cards })),
    answersOf: (id) => scorecard?.learn?.fields?.[id]?.answers,
    minAnswers: DEMAND_MIN_ANSWERS,
    staleDays: DEMAND_STALE_DAYS,
    now,
    noun: "learn answers",
  });
}

// The runway sentence, from the serve rate rather than from a remembered
// figure: the same reasoning as the header's, recomputed against whatever the
// bank holds now. `feedCardsPerDay` is the one estimate here and it is named
// as one wherever it is printed.
//
// `followed` DEFAULTS TO EVERY FIELD since D283, and that is a change of
// input rather than of method. It was 3 because learn-progress.js seeded
// three follows, so three thin fields were what a fresh install could
// actually reach; the default now follows every field the bank ships, so
// the honest denominator is the whole bank. Passing a smaller number still
// answers the old question — what a reader who has narrowed to n fields
// has left — which is why this stays a parameter.
export function learnRunway(fields, { followed = fields.length, feedCardsPerDay = 20 } = {}) {
  const shallowest = fields.slice().sort((a, b) => a.cards - b.cards).slice(0, followed);
  const fresh = shallowest.reduce((n, f) => n + f.cards, 0);
  return {
    fresh,
    followed: shallowest.length,
    // learn-feed.js RATE — restated rather than imported: that module is a
    // browser singleton that reads localStorage at load.
    someDays: Math.round(fresh / (feedCardsPerDay / 7)),
    lotsDays: Math.round(fresh / (feedCardsPerDay / 3)),
  };
}

export function loadLearnFields() {
  const learn = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
  const counts = new Map(learn.fields.map((f) => [f.id, 0]));
  for (const card of learn.cards) counts.set(card.f, (counts.get(card.f) ?? 0) + 1);
  return learn.fields.map((f) => ({ id: f.id, label: f.label, cards: counts.get(f.id) ?? 0 }));
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const openIdx = args.indexOf("--open");
  const open = openIdx >= 0 ? Number(args[openIdx + 1]) : 0;
  if (!Number.isInteger(open) || open < 0) {
    console.error("learn-budget: --open takes a non-negative integer (cards on the open lane PR)");
    process.exit(1);
  }

  const fields = loadLearnFields();
  let scorecard = null;
  try {
    scorecard = JSON.parse(readFileSync(join(root, "content", "scorecard.json"), "utf8"));
  } catch {
    // Absent is a legitimate state the signal line names; a missing scorecard
    // must not stop a run computing its budget.
  }
  const signal = learnSignal(scorecard, fields);
  const { budget, deficit, allocation, reason } = learnBudget({ fields, open, demand: signal.weights });
  const labels = new Map(fields.map((f) => [f.id, f.label]));

  console.log(`learn-budget: lane budget ${budget} (cap ${RUN_CAP}/run)`);
  console.log(
    `  bank: ${fields.reduce((n, f) => n + f.cards, 0)} cards over ${fields.length} fields · ` +
      `${deficit} under the ${FIELD_FLOOR}/field floor + ${open} on the open PR` +
      `${openIdx < 0 ? " (assumed — pass --open with the real count)" : ""}`,
  );
  console.log(`  ${reason}`);

  if (allocation.length) {
    console.log("  write:");
    for (const a of allocation) {
      const why = tierLabel({ ...a, id: a.field, stock: a.cards }, { floor: FIELD_FLOOR, weights: signal.weights, unit: "cards" });
      console.log(`    ${a.write} into ${a.field} (${labels.get(a.field)}) — ${why}`);
    }
  }
  console.log(`  signal: ${signal.note}`);

  // The distinguishing line, pulse's framing: a lane at its floor is a
  // different afternoon from a lane whose readers are days from the bottom.
  const r = learnRunway(fields);
  console.log(
    `  runway: ${r.fresh} fresh cards across ${r.followed} followed field${r.followed === 1 ? "" : "s"} — ` +
      `~${r.someDays} days at the default serve rate, ~${r.lotsDays} at "lots" ` +
      "(assuming ~20 feed cards a day)",
  );
  process.exit(0);
}
