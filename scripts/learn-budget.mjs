// learn-budget.mjs — the learn lane's generation budget as arithmetic (D115),
// replacing D32's flat "≤8 cards/run, thinnest fields first".
//
// WHY THIS EXISTS. The flat rule did not merely under-produce; it produced
// NOTHING, and had to. "Thinnest fields first (a field below 8 cards cannot
// sustain the scheduler's spacing)" reads as a floor, every one of the twelve
// fields sits at exactly 8, and so no field is ever thin and every run is a
// correctly-reasoned no-op. The lane has no Routine either, so the rule was
// never tested against a real firing. A lane whose selection rule can only
// return the empty set is not a conservative lane, it is a stopped one.
//
// WHAT ACTUALLY BOUNDS THIS LANE, which is not what bounds the daily one.
// farm-budget.mjs regulates against a promotion PEN: finished questions
// waiting on a second human gate. Learn has no second gate — "one gate instead
// of two means the PR review IS the production review" (QUESTION-FARM.md § the
// learn-card lane), so a merged card is a shipped card and there is no pen to
// measure. The two real bounds are:
//
//   1. What the bank owes its readers. A field is the unit LEARN.plan() serves
//      from, and its cards are consumed as `fresh` exactly once each, so field
//      depth IS runway. The arithmetic, from learn-feed.js's own serve rate
//      (`some` = one learn card per 7 feed cards, the default; `lots` = one in
//      3) and learn-progress.js's three seeded follows: at 8 cards a field, a
//      reader following three fields has 24 fresh cards, which at ~20 feed
//      cards a day is about EIGHT DAYS at the default rate and under four at
//      `lots`. That is the honest state of the shipped bank, and it is the
//      argument for FIELD_TARGET below.
//   2. Review capacity, tighter here than anywhere else. A learn card review
//      is not a taste judgment: the reviewer checks the fact, argues the trap,
//      and sanity-checks the calibration, with no second gate behind them.
//      OPEN_MAX is that ceiling and it sits BELOW the daily lane's 12.
//
// The constants (quoted in QUESTION-FARM.md and held equal by check:figures):
//   RUN_CAP      = 10  cards per run, the catch-up ceiling. Above the old flat
//                      8 because the regulator is what makes a bigger cap safe
//                      (D97's argument, unchanged): the cap binds only while
//                      the bank is short, and OPEN_MAX closes the tap the
//                      moment review stops keeping up.
//   FIELD_TARGET = 24  cards per field — three times the scheduler's spacing
//                      floor, and the depth at which three followed fields
//                      carry a default-rate reader about a month instead of
//                      about a week. Twelve fields at 24 is 288 learn cards
//                      and a seeded bank of ~685 against check:quality's
//                      BANK_WARN, so the target is reachable without spending
//                      the headroom another lane may need. (That constant was
//                      1200, guarding an unpaginated fetch; D161 paged the
//                      fetch and re-pointed it at the localStorage cache
//                      budget.)
//   OPEN_MAX     = 10  unreviewed cards on the lane's open PR at which
//                      generation stops entirely. Equal to RUN_CAP, and
//                      deliberately unlike the daily lane where OPEN_MAX
//                      exceeds it: there, a part-run may top up an open PR
//                      because a second human gate still stands between that
//                      PR and production. Here the merge IS production, so
//                      the lane carries ONE unreviewed batch at a time and
//                      the open count is subtracted from the budget rather
//                      than only compared against a ceiling.
//   MIN_CHUNK    = 4   cards per field a run may write. Not a bound on volume
//                      but on SHAPE: one card each into ten fields is ten
//                      context switches for the writer and cannot demonstrate
//                      the difficulty spread check:quality's batch rule asks
//                      for, which is a per-field property.
//
// The budget:
//   deficit = Σ over fields of max(0, FIELD_TARGET − cards in field)
//   budget  = 0  if open ≥ OPEN_MAX, else
//             min(RUN_CAP, OPEN_MAX − open, max(0, deficit − open))
//
// and the budget is then allocated to the thinnest fields in chunks of at
// least MIN_CHUNK, which is water-filling: uneven fields get concentrated
// attention, level ones get taken in turn, and either way the writer holds one
// subject at a time.
//
// This is an operator/run tool, not a CI gate — the CI-side learn gates are
// check:quality's learn surface and check:content's structural half.
// Import-safe: the CLI runs only when invoked directly, so the arithmetic is
// unit-testable (learn-budget.test.mjs, via test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RUN_CAP = 10;
export const FIELD_TARGET = 24;
export const OPEN_MAX = 10;
export const MIN_CHUNK = 4;

// Pure: everything the CLI prints derives from this one function, so the test
// pins the budget the lane actually gets.
//
// `fields` is [{ id, cards }] — every field in the bank, thin or not.
export function learnBudget({ fields, open = 0 }) {
  const deficit = fields.reduce((sum, f) => sum + Math.max(0, FIELD_TARGET - f.cards), 0);

  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      reason:
        `the open lane PR already carries ${open} unreviewed cards (OPEN_MAX ${OPEN_MAX}) — ` +
        "review is the work now, not writing. A learn card merges straight into production; " +
        "a queue of them is unreviewed content one merge away from readers",
    };
  }

  // `OPEN_MAX - open` is what makes "one unreviewed batch at a time" true
  // rather than aspirational: without it a run with 5 cards already on the PR
  // would still grant a full cap and leave 15 sitting in front of the one
  // reviewer standing between the lane and production.
  const budget = Math.min(RUN_CAP, OPEN_MAX - open, Math.max(0, deficit - open));
  if (budget === 0) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      reason:
        deficit === 0
          ? `every field is at the ${FIELD_TARGET}-card target — the bank owes its readers nothing, ` +
            "and a card written into a full field is inventory rather than runway"
          : `the bank is ${deficit} cards short of ${FIELD_TARGET}/field, and the ${open} already ` +
            "written and unreviewed cover the whole of it — review is the work now, not writing",
    };
  }

  // Water-filling, thinnest first, in chunks of at least MIN_CHUNK. Ties break
  // on id so a run is reproducible; level fields therefore come up in turn
  // across successive runs rather than one field absorbing every batch.
  const thin = fields
    .filter((f) => f.cards < FIELD_TARGET)
    .sort((a, b) => a.cards - b.cards || a.id.localeCompare(b.id));
  const slots = Math.max(1, Math.min(thin.length, Math.floor(budget / MIN_CHUNK)));
  const chosen = thin.slice(0, slots);

  // Spread the budget as evenly as the chosen fields' own room allows: a field
  // four short of the target takes four, and what it cannot hold moves on
  // rather than being written into it anyway.
  const allocation = chosen.map((f) => ({ field: f.id, cards: f.cards, write: 0 }));
  let left = budget;
  let progress = true;
  while (left > 0 && progress) {
    progress = false;
    for (const a of allocation) {
      if (left === 0) break;
      if (a.cards + a.write >= FIELD_TARGET) continue;
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
        ? `the bank is ${deficit} cards short of ${FIELD_TARGET}/field, ${open} of them already written and unreviewed — capped at ${RUN_CAP}/run`
        : `the bank is ${deficit} cards short of ${FIELD_TARGET}/field — capped at ${RUN_CAP}/run`,
  };
}

// The runway sentence, from the serve rate rather than from a remembered
// figure: the same reasoning as the header's, recomputed against whatever the
// bank holds now. `feedCardsPerDay` is the one estimate here and it is named
// as one wherever it is printed.
export function learnRunway(fields, { followed = 3, feedCardsPerDay = 20 } = {}) {
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
  const { budget, deficit, allocation, reason } = learnBudget({ fields, open });
  const labels = new Map(fields.map((f) => [f.id, f.label]));

  console.log(`learn-budget: lane budget ${budget} (cap ${RUN_CAP}/run)`);
  console.log(
    `  bank: ${fields.reduce((n, f) => n + f.cards, 0)} cards over ${fields.length} fields · ` +
      `${deficit} short of ${FIELD_TARGET}/field + ${open} on the open PR` +
      `${openIdx < 0 ? " (assumed — pass --open with the real count)" : ""}`,
  );
  console.log(`  ${reason}`);

  if (allocation.length) {
    console.log("  write:");
    for (const a of allocation) {
      console.log(`    ${a.write} into ${a.field} (${labels.get(a.field)}) — at ${a.cards} of ${FIELD_TARGET}`);
    }
  }

  // The distinguishing line, pulse's framing: a lane at its target is a
  // different afternoon from a lane whose readers are days from the bottom.
  const r = learnRunway(fields);
  console.log(
    `  runway: ${r.fresh} fresh cards across the ${r.followed} thinnest fields — ` +
      `~${r.someDays} days at the default serve rate, ~${r.lotsDays} at "lots" ` +
      "(assuming ~20 feed cards a day)",
  );
  process.exit(0);
}
