// farm-budget.mjs — the daily lane's generation budget as arithmetic (D97),
// replacing D33's flat "hard cap of 4" with a regulator.
//
// WHY THIS EXISTS. D33 named the real constraint when it re-paced the farm:
// "review capacity is the binding constraint, and a queue of unreviewed AI
// PRs is inventory, not progress." A flat cap obeys that constraint badly in
// both directions — it keeps generating into a full review queue, and it
// under-generates when the holding pen is empty and promotion is starving.
// This script computes what a run may write from the two numbers that
// actually bound it: how much finished-but-unserved inventory exists (the
// unpromoted archive pen, plus whatever is sitting unreviewed on the lane's
// open PR), and how much the pen is allowed to hold. The steady-state
// consequence is the point: once the pen is full, generation exactly tracks
// the human gate's measured throughput — promote more, and the next runs
// write more; stop reviewing, and the tap closes itself. Raising RUN_CAP is
// safe BECAUSE of this: the cap only binds during catch-up.
//
// The constants (quoted in QUESTION-FARM.md and held equal by
// check:figures):
//   RUN_CAP    = 8   questions per run, the catch-up ceiling. Daily batches
//                    review better small (D33's reasoning survives the
//                    upscale); 8/run refills a fully drained pen in a week.
//   PEN_TARGET = 56  unpromoted questions the pen may hold — 8 weeks of
//                    promotion cover at D30's ≥7/week floor. Beyond that,
//                    generation is outrunning review value, which is the
//                    D33 warning wearing a bigger number.
//   OPEN_MAX   = 12  unreviewed questions on the lane's open roll-up PR at
//                    which generation stops entirely. The roll-up rule
//                    (QUESTION-FARM.md § The PR) keeps one PR per lane; this
//                    keeps that one PR reviewable.
//
// The budget:
//   supply = unpromoted archive + questions on the open lane PR
//   budget = 0                       if open ≥ OPEN_MAX
//          = min(RUN_CAP, max(0, PEN_TARGET − supply))   otherwise
//
// Inputs: the unpromoted count is computed from the tree (the same
// prompt-string join pulse uses — collectPipeline); the open-PR question
// count cannot be read from a checkout, so the run measures it from the
// open lane PR's diff and passes --open <n>. Omitting --open assumes 0 and
// says so — an honest default for a fresh-branch run, an overcount risk the
// farm manual tells the run to close.
//
// This is an operator/run tool, not a CI gate — the CI-side quality gates
// live in question-quality.mjs (check:quality). Import-safe: the CLI runs
// only when invoked directly, so the arithmetic is unit-testable
// (farm-budget.test.mjs, via test:scripts).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RUN_CAP = 8;
export const PEN_TARGET = 56;
export const OPEN_MAX = 12;

// Pure: everything the CLI prints is derived from this one function, so the
// test pins the budget the farm actually gets.
export function laneBudget({ unpromoted, open = 0 }) {
  const supply = unpromoted + open;
  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      supply,
      reason:
        `the open lane PR already carries ${open} unreviewed questions ` +
        `(OPEN_MAX ${OPEN_MAX}) — review is the work now, not writing`,
    };
  }
  const budget = Math.min(RUN_CAP, Math.max(0, PEN_TARGET - supply));
  return {
    budget,
    supply,
    reason:
      budget === 0
        ? `the pen holds ${supply} unserved questions (target ${PEN_TARGET}) — promotion is the bottleneck, not writing`
        : supply === 0
          ? `the pen is empty — full catch-up budget (cap ${RUN_CAP})`
          : `pen at ${supply} of ${PEN_TARGET} — writing toward the target, capped at ${RUN_CAP}/run`,
  };
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  // Deferred import: the collectors read the whole tree and compute dates,
  // which the pure arithmetic above must not depend on.
  const { collectPipeline } = await import("./pulse-collect.mjs");
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const openIdx = args.indexOf("--open");
  const open = openIdx >= 0 ? Number(args[openIdx + 1]) : 0;
  if (!Number.isInteger(open) || open < 0) {
    console.error("farm-budget: --open takes a non-negative integer (questions on the open lane PR)");
    process.exit(1);
  }

  const p = collectPipeline();
  const { budget, supply, reason } = laneBudget({ unpromoted: p.archive.unpromoted, open });

  console.log(`farm-budget: daily lane budget ${budget} (cap ${RUN_CAP}/run)`);
  console.log(`  pen: ${p.archive.unpromoted} unpromoted in the archive + ${open} on the open PR`
    + `${openIdx < 0 ? " (assumed — pass --open with the real count)" : ""} = ${supply} of ${PEN_TARGET}`);
  console.log(`  ${reason}`);

  // The afternoon-distinguishing line (pulse's framing): a short runway
  // with a full pen is a promotion PR, a short runway with an empty one is
  // a writing session — and those are different afternoons.
  const d = p.deck;
  console.log(`  runway: ${d.runwayDays} days (bank ${d.dailyBank}, day ${d.daysElapsed} of the epoch)`
    + ` — ${d.runwayDays <= 21 && p.archive.unpromoted > 0 ? "PROMOTE: the pen has stock and the runway is short"
        : d.runwayDays <= 21 ? "WRITE AND PROMOTE: runway short, pen empty"
        : "healthy"}`);

  // Staleness gates the signal lanes, not the budget: the budget says how
  // many, the scorecard says which lanes — QUESTION-FARM.md's rule.
  const sc = p.scorecard;
  if (!sc.present || sc.staleness === "expired") {
    console.log(`  scorecard: ${sc.present ? `${sc.ageDays} days old (expired)` : "missing"} — coverage lane only (D33 staleness rule)`);
  } else if (sc.staleness === "advisory") {
    console.log(`  scorecard: ${sc.ageDays} days old — treat lane 1–2 signals as advisory (D33)`);
  } else {
    console.log(`  scorecard: fresh (${sc.ageDays ?? 0} days) — lanes 1–2 read it normally`);
  }
  process.exit(0);
}
