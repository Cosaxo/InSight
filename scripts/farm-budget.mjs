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
// promotion throughput — promote more, and the next runs write more; stop
// promoting, and the tap closes itself. Raising RUN_CAP is safe BECAUSE of
// this: the cap only binds during catch-up. Under D162 the throughput being
// tracked was a person's reading; under D212 it is PROMOTE_PACE below —
// the regulator's shape survives both, which is what it was built for.
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
//                    keeps that one PR bounded. Since D212 a PR normally
//                    merges in the run that opened it, so this binds only
//                    when a gate refused the batch and it sat — and a run
//                    facing that should be fixing, not writing.
//   PROMOTE_PACE = 2 pen questions the run itself promotes into the live
//                    seed, oldest first, each run (D212 — promotion stopped
//                    being a human's step). At the daily cadence that is
//                    14/week, exactly D97's ≥14/week target while the pen
//                    has stock: the daily consumes 7, so runway grows by a
//                    day per day. It is deliberately BELOW RUN_CAP: the pen
//                    fills before it drains, stays the buffer D208 says it
//                    is, and generation settles at the promotion pace once
//                    the pen is full — the same steady state as before,
//                    with the person's reading replaced by arithmetic.
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
import { allocateTiers, laneSignal, tierLabel, tierReason } from "./lane-tiers.mjs";

export const RUN_CAP = 8;
export const PEN_TARGET = 56;
export const OPEN_MAX = 12;
export const PROMOTE_PACE = 2;
// D350: what the budget is SPENT on is arithmetic now, not the run's reading
// of "is any topic thin". Until then § Picking topics wrote only where a
// signal pointed or a top sat under four questions, and with the crowd too
// small to give a signal and every top past four the lane logged eighteen
// straight no-ops against an EMPTY pen and a granted budget of 8 (run log
// #31, 2026-08-14 → 09-01) — D33's "never generate into a full review
// queue" firing on an empty one. The pen is the buffer promotion drains; a
// granted budget is always work, and lane-tiers.mjs says where it goes:
//   TOP_FLOOR          = 8   questions per CAT_META top, reached first —
//                            breadth's minimum in the Mirror's subject
//                            groupings and the Map, a week of dailies per
//                            top. A floor, not a target: nothing stops at
//                            it, and the levelling above it is what fills
//                            the pen.
//   DEMAND_MIN_ANSWERS = 100 credited daily answers before the demand share
//                            is read (popularity × depth off the
//                            scorecard's capitalised daily topic rows — the
//                            replenishment signal folds into depth: a top
//                            whose every question is heavily answered has
//                            an audience that is going through it).
//   DEMAND_STALE_DAYS  = 30  the manual's staleness rule, as arithmetic.
export const TOP_FLOOR = 8;
export const DEMAND_MIN_ANSWERS = 100;
export const DEMAND_STALE_DAYS = 30;

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

// Where a granted budget goes (D350): lane-tiers' unit mode over the
// archive's tops. `tops` is [{ id, questions }] — every CAT_META top, thin or
// not — and `demand` is farmSignal's weights or null. The daily's batch-mix
// rule is a spread of tones and forms, not of topics, so there is no chunk
// here; breadth across tops is what the floor and the levelling do.
export function farmAllocation({ tops, budget, demand = null, open = 0 }) {
  const tiers = allocateTiers({
    rows: tops.map((t) => ({ id: t.id, stock: t.questions })),
    budget,
    floor: TOP_FLOOR,
    demand,
    open,
  });
  return {
    deficit: tiers.deficit,
    split: tiers.split,
    allocation: tiers.allocation.map((r) => ({
      top: r.id, questions: r.stock, write: r.write, floor: r.floor, demand: r.demand, level: r.level,
    })),
    reason: tierReason({ split: tiers.split, deficit: tiers.deficit, open, floor: TOP_FLOOR, cap: RUN_CAP, group: "top" }),
  };
}

// The demand signal off the scorecard's DAILY topic rows — capitalised
// CAT_META tops, never the feed's lowercase ids (the scorecard scores the
// two per surface and the manual says never to mix them).
export function farmSignal(scorecard, tops, now = Date.now()) {
  return laneSignal({
    scorecard,
    rows: tops.map((t) => ({ id: t.id, stock: t.questions })),
    answersOf: (id) => scorecard?.topics?.[id]?.answers,
    minAnswers: DEMAND_MIN_ANSWERS,
    staleDays: DEMAND_STALE_DAYS,
    now,
    noun: "daily answers",
  });
}

// The archive's per-top count — "questions per top-level category (first
// element of each cat)", the manual's own rule, over the WHOLE archive
// (promoted and pen alike: both are stock). Reads the spec module through
// check:quality's corpus loader, the one parser of that file (D197's
// one-copy rule), deferred because that loader reads every bank.
export async function loadDailyTops() {
  const { loadCorpus } = await import("./question-quality.mjs");
  const { specQ, catMeta } = loadCorpus();
  const counts = new Map(Object.keys(catMeta).map((t) => [t, 0]));
  for (const q of specQ) {
    const top = Array.isArray(q.cat) ? q.cat[0] : q.cat;
    if (counts.has(top)) counts.set(top, counts.get(top) + 1);
  }
  return [...counts].map(([id, questions]) => ({ id, questions }));
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

  // D350: where the budget goes, as arithmetic. The scorecard's daily rows
  // steer it once the crowd is real; until then the tops level.
  const tops = await loadDailyTops();
  let scorecard = null;
  try {
    const { readFileSync } = await import("node:fs");
    scorecard = JSON.parse(readFileSync(new URL("../content/scorecard.json", import.meta.url), "utf8"));
  } catch {
    // Absent is a state the signal line names, not a reason to stop.
  }
  const signal = farmSignal(scorecard, tops);
  if (budget > 0) {
    const alloc = farmAllocation({ tops, budget, demand: signal.weights, open });
    console.log(`  ${alloc.reason}`);
    console.log("  write:");
    for (const a of alloc.allocation) {
      const why = tierLabel({ ...a, id: a.top, stock: a.questions }, { floor: TOP_FLOOR, weights: signal.weights });
      console.log(`    ${a.write} into ${a.top} — ${why}`);
    }
  }
  console.log(`  signal: ${signal.note}`);
  // D212: promotion is the run's own step now, not an operator's. The pace
  // line prints even at zero stock so a run never has to infer whether
  // promotion was considered — "0 of 2" is an answer, silence is not.
  console.log(
    `  promote: ${Math.min(PROMOTE_PACE, p.archive.unpromoted)} of ${PROMOTE_PACE} this run`
    + ` (oldest pen entries first — npm run promote, D212)`,
  );

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
