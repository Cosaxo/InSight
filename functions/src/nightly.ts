// nightly.ts — the one nightly pass over the agg-events ledger (D399,
// ALGORITHM-REFLECTION §4.2).
//
// WHAT IT REPLACES. Three scheduled functions each paged yesterday's
// ledger for themselves: digestEngagementV2 at 02:23 (the digest, then the
// attention and rollup folds), fitPatternsV2 at 02:37 (the fit), fitTasteV2
// at 03:27 (the interest profile). The day's entries were billed three
// times a night — COSTS.md counted it, at 50 k DAU some 400 k reads —
// and the pager itself existed in three copies, which is the shape D197
// names as the one that fails silently (the copy with the try/catch
// reported an invented number). One pass reads each owed day once through
// `memoLedgerReader` and hands the same array to every fold.
//
// WHY THE NAME IS `digestEngagementV2`. The deploy identity and the
// heartbeat metric (`engagement_digest`) are what the armed alert policy
// is keyed on — monitoring/digestEngagementV2-silent.json, applied by
// display name (apply-monitoring.mjs matches on it), verified live at
// D333. A new name would leave that policy watching a metric nothing
// emits and create a second policy beside it; the old name kept means the
// alert that exists keeps meaning what it says. So the pass wears the
// digest's name and this header says what it does. `fitPatternsV2` and
// `fitTasteV2` are retired from the source and the deploy list; the
// deploy's `--only` filter leaves the two DEPLOYED functions standing
// until an operator deletes them (OWNER-LIST.md), where each runs its old
// code, finds its cursor already advanced by this pass, and returns
// before reading a page.
//
// FAILURE ISOLATION, which the old digest function did not have. Each
// fold runs inside its own attempt: a throw in the fit does not cost the
// engagement rollups their night, and a throw in the digest does not cost
// the fit. Each heartbeat is emitted only when the thing it vouches for
// completed — `engagement_digest` when the digest AND the two folds that
// ride behind it all finished (the pipeline the silence policy watches,
// unchanged in meaning), `patterns_fit` when the fit did, `taste_fold`
// when the fold did — so an alert on silence still fires for exactly the
// fold that went quiet. The pass then rethrows the first failure, so the
// invocation is red in the function's own error metrics as well.
//
// THE BUDGET. NIGHTLY (ops.ts) is 1 GiB and 480 s — it was LIGHT_UNBOUNDED's
// 256 MiB until DATA-EFFICIENCY-RUNBOOK 1.3, for the reason ops.ts gives. The
// day's entries are ~200 bytes each in memory (~236 measured, retained; ~470
// with the runbook 2.1 stamp on the row): 20 k at 5 k DAU, 200 k (40 MB) at
// 50 k, held once instead of once per fold — the peak is what any one of the
// three functions already had, PER RESIDENT DAY. That last clause was
// missing and it mattered: the folds run in sequence, each walking its own
// owed days, so an unbounded memo held every day of a catch-up at once —
// ~410 MB on a 7-day recovery at 50 k DAU, on a 256 MiB instance, and the
// OOM re-read the same days the next night and died identically.
// `memoLedgerReader` keeps ONE day now; the ordinary night is unchanged and
// a catch-up re-reads instead of piling up (the velocity scan, runbook 4.4,
// walks its whole days oldest first, so the day it leaves in the memo is
// yesterday — the one every fold after it asks for). See its own comment
// for the measurement and the trade. What no memo bounds is the DAY itself:
// at hundreds of answers a person a day the one resident day is what runs
// out, near 16,000 DAU — SCALE-ARCHITECTURE.md §1. Time is the three folds' in sequence; today
// each is seconds. If the sum ever nears the ceiling the lever is
// `timeoutSeconds` on this one function (gen 2 allows an hour for a
// schedule), not a fourth function — splitting the pass is what this file
// removed.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
// ops.ts sets the global runtime options as an import side effect and must
// stay imported wherever a function is declared (check:fn-runtime guards
// the outcome).
import { NIGHTLY, FUNCTIONS_REGION } from "./ops";
import { db as firestore } from "./db";
import { memoLedgerReader } from "./ledger";
import {
  runEngagementDigest,
  firestoreEngagementStore,
  runAttentionFold,
  firestoreAttentionStore,
  runRollupFold,
  firestoreRollupStore,
  SHARD_FOLD_CAP,
  ROLLUP_FOLD_CAP,
} from "./engagement";
import { runPatternsFit, firestorePatternsStore } from "./patterns";
import { runTasteFold, firestoreTasteStore } from "./taste";
import { runAnswerMapHeal, firestoreAnswerMapStore } from "./answerMaps";
import { runVelocityScan, firestoreVelocityStore } from "./velocity";
import { runLogReconcile, firestoreLogStore } from "./log";
import { runFanoutHeal, firestoreFanoutHealStore } from "./profileFanout";

/** The five things a night does, as thunks — so the pass can be driven
 * by a test with nothing behind them, and so the Firestore stores are
 * built exactly once per invocation, over one shared reader. */
export interface NightlyRunners {
  digest: () => ReturnType<typeof runEngagementDigest>;
  patterns: () => ReturnType<typeof runPatternsFit>;
  taste: () => ReturnType<typeof runTasteFold>;
  attention: () => ReturnType<typeof runAttentionFold>;
  rollup: () => ReturnType<typeof runRollupFold>;
  /** The answer maps' heal (DATA-EFFICIENCY-RUNBOOK 3.3) — the sixth,
   *  off the same ledger read; a night that skips it leaves the trigger's
   *  own writes standing, which is the whole point of a heal. */
  answerMaps: () => ReturnType<typeof runAnswerMapHeal>;
  /** D54's velocity scan (runbook 4.4) — the seventh, its whole days off
   *  the same reader and the partial day its own read. It logs its own
   *  flags and heartbeat (`velocity_scan`). */
  velocity: () => ReturnType<typeof runVelocityScan>;
  /** The answer log's reconcile (log.ts, D447 phase A) — the eighth, off
   *  the same ledger read: yesterday's entries the BigQuery table lacks,
   *  and the erasures the day deferred. Skips itself where there is no
   *  BigQuery (the emulator), and says so. */
  log: () => ReturnType<typeof runLogReconcile>;
  /** The profile fan-out's heal (profileFanout.ts) — the ninth: every
   *  account whose stamp change the hourly budget deferred gets the
   *  fan-out from its profile as it is now. Bounded by the markers. */
  fanout: () => ReturnType<typeof runFanoutHeal>;
}

/** The three log levels the pass speaks — `logger`'s, injectable. */
export type NightlyLog = Pick<typeof logger, "info" | "warn" | "error">;

export interface NightlyOutcome {
  /** Which folds threw, in run order — empty on a clean night. */
  failed: string[];
}

/**
 * Run the night: digest, fit, taste, attention, rollups — each isolated,
 * each heartbeat emitted only for a fold that completed, the first
 * failure rethrown at the end.
 */
export async function runNightlyPass(r: NightlyRunners, log: NightlyLog = logger): Promise<NightlyOutcome> {
  const failed: { fold: string; err: unknown }[] = [];
  const attempt = async <T>(fold: string, run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run();
    } catch (err) {
      failed.push({ fold, err });
      // ERROR, with the fold named: the heartbeat that stays silent says
      // which pipeline is stale a day later; this says why tonight.
      log.error(`[nightly] ${fold} failed — the other folds ran`, { metric: "nightly_fold_failed", fold, error: String(err) });
      return null;
    }
  };

  const digest = await attempt("digest", r.digest);
  const fit = await attempt("patterns", r.patterns);
  // The fit's heartbeat — monitoring/fitPatternsV2-silent.json thresholds
  // a day with none of these. `days` is the owed-day count, so a night
  // with nothing to fold still beats; a night that threw does not.
  if (fit && (fit.folded > 0 || fit.days > 0)) log.info("patterns fit", { metric: "patterns_fit", ...fit });
  const taste = await attempt("taste", r.taste);
  if (taste && taste.days > 0) log.info("taste fold", { metric: "taste_fold", ...taste });
  // The velocity scan (runbook 4.4) speaks for itself — its flags and its
  // `velocity_scan` heartbeat are logged inside the runner, unchanged
  // from the scheduled function's, so the silence policy keeps counting.
  await attempt("velocity", r.velocity);
  // The heal speaks only when it healed: in steady state the trigger
  // wrote every entry live and the heal's read finds nothing missing, so
  // a line every night would be a heartbeat for the absence of work. A
  // healed count is the thing worth seeing — it means a live write was
  // missed, and monitoring should notice a night with many.
  const heal = await attempt("answerMaps", r.answerMaps);
  // The log's reconcile speaks for itself too (`log_reconcile`), and runs
  // after the heal so a night that dies in the folds still mirrors the
  // day — the ledger keeps it for ninety days either way.
  await attempt("log", r.log);
  // The fan-out heal speaks only when it healed, like the map heal: a
  // healed account is a stamp change the budget refused in the day.
  const fan = await attempt("fanout", r.fanout);
  if (fan && fan.pending > 0) {
    // A backlog is a WARNING, not a line in the info stream: the heal is
    // what keeps the header's promise that the last name lands within a
    // day, and a night that did not reach everyone is a night that
    // promise was not kept for. Not a count — the query stops one past
    // the cap and does not know how many more there are.
    (fan.left ? log.warn : log.info)(
      `[v2] fan-out heal: ${fan.healed} of ${fan.pending} deferred stamp change(s) applied, ${fan.touched} sample(s) touched`
      + (fan.left ? ` — MORE than ${fan.pending} were waiting; the rest keep their markers for tomorrow` : ""),
      { metric: "profile_fanout_heal", ...fan });
  }
  if (heal && heal.healed > 0) {
    log.warn(`[answerMaps] heal filled ${heal.entries} entr${heal.entries === 1 ? "y" : "ies"} for ${heal.healed} of ${heal.people} people on ${heal.day} — the trigger missed a live write`, { metric: "answer_map_heal", ...heal });
  }
  // Rung 1's fold runs AFTER the digest so a fresh day doc exists for
  // most shards to merge into (a late shard for an older day merges
  // just as well — see runAttentionFold's header).
  const attn = await attempt("attention", r.attention);
  if (attn?.capped) {
    log.warn(
      `[engagement] shard fold hit its cap (${SHARD_FOLD_CAP}) — leftovers fold tomorrow; sampling (src/v2/data/engagement.ts SHARD_SAMPLE_RATE) is the designed lever if this repeats`,
      { metric: "engagement_shard_cap", shards: attn.shards },
    );
  }
  // …and rung 2's rollups (R3/D272), unfolded-flag driven so late
  // arrivals sweep like late shards do.
  const roll = await attempt("rollup", r.rollup);
  if (roll?.capped) {
    // The TIME budget ended the night (DATA-EFFICIENCY-RUNBOOK 4.1) — a
    // full page is no longer a stop — so the number that matters is what
    // is left: leftovers do fold tomorrow, and this says how many.
    log.warn(
      `[engagement] rollup fold stopped at its time budget after ${roll.rollups} rollups (pages of ${ROLLUP_FOLD_CAP}) — ${roll.left} left unfolded, first in tomorrow's queue`,
      { metric: "engagement_rollup_cap", rollups: roll.rollups, left: roll.left },
    );
  }
  // The heartbeat — monitoring/digestEngagementV2-silent.json watches for
  // this line's ABSENCE: a scheduled function that stops running reports
  // nothing, so the alert is on silence, and this log is the pulse it
  // listens for. All three of the engagement pipeline's folds, as it was
  // when they were one function: a rollup fold that threw is a pipeline
  // that did not complete, whatever the digest did.
  if (digest && attn && roll) {
    log.info(
      `[engagement] digest: ${digest.days} day(s) folded through ${digest.lastDay || "—"} — actives=${digest.actives} votes=${digest.votes}; shards=${attn.shards} over ${attn.days} day(s); rollups=${roll.rollups} over ${roll.days} day(s)`,
      {
        metric: "engagement_digest",
        days: digest.days,
        lastDay: digest.lastDay,
        actives: digest.actives,
        votes: digest.votes,
        shards: attn.shards,
        shardDays: attn.days,
        rollups: roll.rollups,
        rollupDays: roll.days,
      },
    );
  }
  if (failed.length) {
    const first = failed[0];
    throw new Error(`nightly pass: ${failed.map((f) => f.fold).join(", ")} failed — ${String(first.err)}`);
  }
  return { failed: [] };
}

export const digestEngagementV2 = onSchedule(
  // Nightly, off the top-of-hour herd. It was also timed clear of the
  // velocity scan — its own 03:47 function, which kept its own read of
  // this same ledger — and that half is spent: runbook 4.4 folded the scan
  // into THIS pass, so there is nothing left to stand clear of and the
  // time is the herd alone. (velocity.ts's own header says so; this line
  // was the copy that did not hear.) Cost is one
  // paged read of the day's entries for all three ledger folds together,
  // plus each fold's own per-person state reads and writes — COSTS.md's
  // rows, and scripts/cost-arith.mjs's LEDGER_PASS_READS_PER_ENTRY.
  { schedule: "23 2 * * *", region: FUNCTIONS_REGION, ...NIGHTLY },
  async () => {
    const db = firestore();
    // ONE clock for the night, so every fold agrees on which day is
    // "yesterday" — three separate schedules could not, which is one more
    // small thing the pass removes.
    const now = Date.now();
    const ledgerDay = memoLedgerReader(db);
    await runNightlyPass({
      digest: () => runEngagementDigest(firestoreEngagementStore(db, ledgerDay), now),
      patterns: () => runPatternsFit(firestorePatternsStore(db, ledgerDay), now),
      taste: () => runTasteFold(firestoreTasteStore(db, ledgerDay), now),
      velocity: () => runVelocityScan(firestoreVelocityStore(db, ledgerDay), now),
      answerMaps: () => runAnswerMapHeal(firestoreAnswerMapStore(db, ledgerDay), now),
      log: () => runLogReconcile(firestoreLogStore(db, ledgerDay), now),
      fanout: () => runFanoutHeal(firestoreFanoutHealStore(db)),
      attention: () => runAttentionFold(firestoreAttentionStore(db)),
      rollup: () => runRollupFold(firestoreRollupStore(db)),
    });
  },
);
