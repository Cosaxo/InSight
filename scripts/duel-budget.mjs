// duel-budget.mjs — the duel lane's generation budget as arithmetic (D213),
// replacing D40's flat "≤4 questions/run, at most weekly to start".
//
// WHY THIS EXISTS. The duel lane was the last question surface still governed
// by a flat cap and a human ask: no Routine fired it, and the measured
// consequence was the same shape D115 found on learn and D145 found on feed —
// a lane that produces nothing. Twelve straight days without a duel question
// (2026-08-07 → 08-19) while three other lanes shipped daily was not a
// judgment anyone made; it was the absence of a schedule wearing one's
// clothes. D213 gives the lane the regulator first and the Routine with it,
// the feed lane's order, for the feed lane's reason: a flat cap on a schedule
// generates into a full queue and under-generates into an empty one.
//
// WHAT BOUNDS THIS LANE. Duels are consumed on a clock, like learn and unlike
// the feed: a group sees ONE group question per day from a rotating pool, and
// a duo sees one 1v1 per day. Depth is therefore days-before-repeat — the
// group pool's 24 entries are a 24-day cycle, and day 25 is the first rerun.
// So the deficit is measured per POOL against a repeat horizon, not per topic
// against breadth: the three pools are the units a player actually drains.
//
// The constants (quoted in QUESTION-FARM.md and held equal by check:figures):
//   RUN_CAP     = 4   questions per run — D40's number, kept deliberately.
//                     Duel questions are the most context-heavy to write
//                     (group order is rotation order; 1v1 appends deep; the
//                     guess-match band is the quality bar), and the surface
//                     consumes at most one per pool per day, so a bigger
//                     batch buys runway nobody is short of yet.
//   POOL_TARGET = 48  questions per pool — twice the shipped group cycle, so
//                     a daily group sees no repeat for ~7 weeks instead of
//                     ~3.5. Not a per-topic breadth figure: pools are the
//                     serving unit, and 48 × 3 pools lands the whole surface
//                     at 144 entries, well inside every headroom gate.
//   OPEN_MAX    = 4   unreviewed questions on the lane's open PR at which
//                     generation stops. Equal to RUN_CAP and subtracted from
//                     the budget — the single-gate shape (a merged duel PR IS
//                     the production review), so the lane carries one batch
//                     at a time even now that merging is the run's own step
//                     (D212): a PR sitting open means a gate failed, and the
//                     right response to that is a fix, not a second batch.
//
// The budget:
//   deficit = Σ over pools of max(0, POOL_TARGET − questions)
//   budget  = 0  if open ≥ OPEN_MAX, else
//             min(RUN_CAP, OPEN_MAX − open, max(0, deficit − open))
//
// The romantic pool counts at full weight while it ships dark: its entries
// carry `active: false` by the D40 posture and light up in one operator
// step, so stocking it is runway for a switch already designed — not
// inventory for a surface that might never exist. If that posture ever
// changes (the pool is cut rather than lit), drop it from loadDuelPools and
// this comment with it.
//
// This is an operator/run tool, not a CI gate — the CI-side duel gates are
// check:quality's duel surface and check:content's structural half.
// Import-safe: the CLI runs only when invoked directly, so the arithmetic is
// unit-testable (duel-budget.test.mjs, via test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RUN_CAP = 4;
export const POOL_TARGET = 48;
export const OPEN_MAX = 4;

// Pure: everything the CLI prints derives from this one function, so the test
// pins the budget the lane actually gets.
//
// `pools` is [{ id, questions }] — all three pools, thin or not.
export function duelBudget({ pools, open = 0 }) {
  const deficit = pools.reduce((sum, p) => sum + Math.max(0, POOL_TARGET - p.questions), 0);

  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      deficit,
      allocation: [],
      reason:
        `the open lane PR already carries ${open} unreviewed questions (OPEN_MAX ${OPEN_MAX}) — ` +
        "a duel PR merges straight into production, so an open one means a gate refused it; " +
        "fixing that is the work, not writing past it",
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
          ? `every pool is at the ${POOL_TARGET}-question target — a daily player goes ~7 weeks ` +
            "without a repeat, and past that point new entries buy variety nobody has drained yet"
          : `the pools are ${deficit} questions short of ${POOL_TARGET} each, and the ${open} ` +
            "already written and unreviewed cover what this run could add",
    };
  }

  // Water-filling, thinnest pool first, ties broken on id so a run is
  // reproducible. No MIN_CHUNK: the batch-mix rules are per-batch, and a
  // budget of 4 spread across three pools is this lane working — each pool
  // has its own id series and its own append rule, so there is no per-pool
  // spread property a single question fails to demonstrate.
  const thin = pools
    .filter((p) => p.questions < POOL_TARGET)
    .sort((a, b) => a.questions - b.questions || a.id.localeCompare(b.id));

  const allocation = thin.map((p) => ({ pool: p.id, questions: p.questions, write: 0 }));
  let left = budget;
  let progress = true;
  while (left > 0 && progress) {
    progress = false;
    for (const a of allocation) {
      if (left === 0) break;
      if (a.questions + a.write >= POOL_TARGET) continue;
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
        ? `the pools are ${deficit} questions short of ${POOL_TARGET} each, ${open} of them already written and unreviewed — capped at ${RUN_CAP}/run`
        : `the pools are ${deficit} questions short of ${POOL_TARGET} each — capped at ${RUN_CAP}/run`,
  };
}

export function loadDuelPools() {
  const duel = JSON.parse(readFileSync(join(root, "content", "duel-questions.json"), "utf8"));
  // Pool order here is thinnest-agnostic — the sort above decides priority.
  // Ids match the bank's own keys so the allocation names the array a run
  // appends to, not a prettified label it then has to translate back.
  return ["group", "oneVsOne", "romantic"].map((id) => ({
    id,
    questions: Array.isArray(duel[id]) ? duel[id].length : 0,
  }));
}

// The scorecard line. Like the feed, duels have no runway sentence — pools
// rotate rather than drain — so what a run needs to know is whether the
// guess-match signal exists yet, because that signal is this surface's whole
// quality bar (near 100% = dead, at or under chance = noise; write into the
// band between).
export function duelSignal(scorecard) {
  const d = scorecard?.duel;
  if (!d) return { mode: "blind", note: "no committed scorecard — levelling the pools blind, thinnest-first" };
  const scored = d.coverage?.scored ?? 0;
  if (!scored) {
    return {
      mode: "blind",
      note:
        "scorecard scores 0 duel questions — levelling the pools blind, thinnest-first. " +
        "The guess-match band has nothing to say until duos play",
    };
  }
  const dead = Array.isArray(d.deadDuels) ? d.deadDuels.length : 0;
  const noisy = Array.isArray(d.noisyDuels) ? d.noisyDuels.length : 0;
  return {
    mode: "signal",
    note:
      `scorecard scores ${scored} duel questions — read the guess-match band before writing; ` +
      `${dead} dead and ${noisy} noisy duels are retire-proposal material for the PR body`,
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
    console.error("duel-budget: --open takes a non-negative integer (questions on the open lane PR)");
    process.exit(1);
  }

  const pools = loadDuelPools();
  const { budget, deficit, allocation, reason } = duelBudget({ pools, open });

  console.log(`duel-budget: lane budget ${budget} (cap ${RUN_CAP}/run)`);
  console.log(
    `  pools: ${pools.map((p) => `${p.id} ${p.questions}`).join(" · ")} — ` +
      `${deficit} short of ${POOL_TARGET}/pool + ${open} on the open PR` +
      `${openIdx < 0 ? " (assumed — pass --open with the real count)" : ""}`,
  );
  console.log(`  ${reason}`);

  if (allocation.length) {
    console.log("  write:");
    for (const a of allocation) {
      console.log(`    ${a.write} into ${a.pool} — at ${a.questions} of ${POOL_TARGET}`);
    }
  }

  let scorecard = null;
  try {
    scorecard = JSON.parse(readFileSync(join(root, "content", "scorecard.json"), "utf8"));
  } catch {
    // Absent is a legitimate state the signal line names; a missing scorecard
    // must not stop a run computing its budget.
  }
  console.log(`  signal: ${duelSignal(scorecard).note}`);
  process.exit(0);
}
