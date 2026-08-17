// calls.ts — the Foresight CALL resolver (D193, docs/FORESIGHT-CALLS.md).
//
//   resolveCallsV2   a daily scheduled pass that grades every tier-A call
//                    past its `resolvesAt`, by EXECUTING the call's own
//                    rubric against this app's published aggregate, and
//                    publishes the inputs it read beside the outcome.
//
// THE RULE THIS FILE IS BUILT AROUND (D127): a machine may propose an
// outcome; it may never be the reason an outcome is believed. The reason
// is the executed rubric, and its inputs are published with the result. So
// there is no model anywhere in this path, no fetch, no recollection and
// no judgement — the grade is arithmetic over `v2_question_aggs/{qid}`,
// and `callRubric.ts` (byte-identical to the client's copy, held equal by
// `npm run check:calls`) is the only thing that decides it.
//
// FOUR THINGS THIS DELIBERATELY DOES NOT DO:
//
//   · It never guesses. `evalRubric` returns null for anything it cannot
//     decide — an absent aggregate, an empty one, a named slice with no
//     answers, a tie for the lead — and null is not an outcome. The call
//     stays open and the next pass tries again.
//
//   · It never grades early. `resolvesAt` is a UTC day key and the pass
//     skips anything not yet past it, so a call that would resolve
//     "correctly" today because the aggregate happens to sit the right
//     side of the line is left alone until the day it was sold on.
//
//   · It never rewrites an outcome. A graded call is graded; the write is
//     `create`-shaped (`{ exists: false }` precondition), so a redelivered
//     or overlapping run is a no-op rather than a second, different truth.
//     This is also what makes the rules' `!exists(v2_call_outcomes/{qid})`
//     answer-fence stable: the document appears exactly once.
//
//   · It never leaves a call open forever. That is the one place this
//     file goes beyond FORESIGHT-CALLS §5, which hands an unexecutable
//     call to a human. There is no operator console for that today, and
//     §7 is explicit that "an unresolved call is worse than a missing
//     feature — it takes the player's guess and never comes back". So
//     after CALL_VOID_AFTER_DAYS of failing to execute, the resolver
//     writes a VOID with the reason. A void is the app admitting it could
//     not grade; it asserts nothing about the world and scores nobody,
//     which is exactly why an automatic one is safe where an automatic
//     GUESS would not be. Every attempt in between is logged, so a human
//     who is watching still gets the chance §5 describes.

import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
// ops.ts sets the global runtime options as an import side effect and must
// be evaluated before any function here is defined — the same reason every
// other function module imports it (check:fn-runtime guards the outcome).
import { LIGHT_UNBOUNDED } from "./ops";
import { V2_QUESTIONS } from "./v2content";
import { db as firestore } from "./db";
import {
  CALL_VOID,
  evalRubric,
  rubricFault,
  snapshotFor,
  type CallRubric,
  type CallSnapshot,
} from "./callRubric";

const REGION = "us-central1";

/**
 * How long an unexecutable call stays open before it is voided.
 *
 * Long enough that a slow aggregate (a young question nobody has answered
 * yet) gets a real chance to arrive, short enough that a player is not
 * left holding a guess for a month. Fourteen days is a fortnight of daily
 * passes, each one logged — the window in which a human could still step
 * in, expressed as a number rather than as a hope.
 */
export const CALL_VOID_AFTER_DAYS = 14;

/** The compiled bank's call entries. No query: the bank ships in the deploy. */
export interface BankCall {
  id: string;
  resolvesAt: string;
  rubric: CallRubric;
}

export function bankCalls(): BankCall[] {
  return V2_QUESTIONS.filter((q) => q.surface === "call").map((q) => ({
    id: q.id,
    resolvesAt: String(q.resolvesAt ?? ""),
    rubric: q.rubric as unknown as CallRubric,
  }));
}

/**
 * Whether a call may be graded at `now`.
 *
 * `resolvesAt` is a UTC day key and the comparison is on day keys, not on
 * millisecond arithmetic — a call sold as "by October" resolves on the
 * first pass of 1 October wherever the instance happens to be running.
 * Exported so the test pins the boundary rather than a value near it.
 */
export function isDue(resolvesAt: string, now: Date): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(resolvesAt) && utcDayKey(now) >= resolvesAt;
}

/** Days from a UTC day key to `now`, floor 0. */
export function daysPastDue(resolvesAt: string, now: Date): number {
  const due = Date.parse(`${resolvesAt}T00:00:00Z`);
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.floor((now.getTime() - due) / 86_400_000));
}

function utcDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** What one pass did, so the log line and the test read the same numbers. */
export interface ResolveSummary {
  due: number;
  resolved: number;
  voided: number;
  waiting: number;
  faulty: number;
}

/**
 * The two document operations this pass performs, as an interface.
 *
 * A seam, not an abstraction layer: the scheduled export passes the real
 * Firestore handle and the test passes a fake. It exists because the
 * decisions here — grade, wait, void, skip — are the whole feature, and an
 * emulator is the only other way to exercise the branch where a call is
 * three days overdue with no aggregate. `runResolveCalls` is what a test
 * has to be able to run.
 */
export interface CallStore {
  /** The published aggregate for a question, or null when absent. */
  agg(qid: string): Promise<{ total?: number; counts?: Record<string, number>; by?: Record<string, Record<string, Record<string, number>>> } | null>;
  /** Whether this call already has a published outcome. */
  hasOutcome(qid: string): Promise<boolean>;
  /** Publish one, once. Must be create-shaped: a second write is a no-op. */
  putOutcome(qid: string, outcome: OutcomeDoc): Promise<void>;
}

export interface OutcomeDoc {
  outcomeIdx: number;
  resolvedBy: "auto";
  inputs: CallSnapshot | null;
  note?: string;
}

/**
 * One resolution pass.
 *
 * Clock- and store-injected so a test can drive a fixed date against a
 * fixed database; the scheduled export below supplies the real ones.
 * Nothing in here reads a clock of its own — the same discipline
 * callRubric.ts keeps, for the same reason (a grader that reaches for a
 * clock cannot be tested against a fixed input).
 */
export async function runResolveCalls(
  now = new Date(),
  store: CallStore = firestoreStore(),
): Promise<ResolveSummary> {
  const summary: ResolveSummary = { due: 0, resolved: 0, voided: 0, waiting: 0, faulty: 0 };

  for (const call of bankCalls()) {
    if (!isDue(call.resolvesAt, now)) continue;

    // Already graded is not work: `due` counts what this pass had to
    // decide, so the log line says something when it says nothing.
    if (await store.hasOutcome(call.id)) continue;
    summary.due++;

    // A rubric that cannot be executed at all is a content fault, not a
    // grading one. check:calls refuses it at authoring; this is the second
    // door, because a bank can be seeded from a build that predates the
    // gate. It voids immediately rather than waiting out the window: no
    // number of retries fixes a malformed expression.
    const fault = rubricFault(call.rubric);
    if (fault) {
      summary.faulty++;
      logger.error(`[calls] ${call.id} has an unexecutable rubric (${fault}) — voiding`);
      await writeOutcome(store, call.id, CALL_VOID, null, `the rubric could not be executed: ${fault}`);
      summary.voided++;
      continue;
    }

    const agg = await store.agg(call.rubric.qid);
    const snap: CallSnapshot | null = snapshotFor(call.rubric, agg);
    const outcomeIdx = evalRubric(call.rubric, snap);

    if (outcomeIdx === null) {
      const overdue = daysPastDue(call.resolvesAt, now);
      if (overdue >= CALL_VOID_AFTER_DAYS) {
        // The honest end of the road: the app could not grade, and says so
        // rather than leaving the guess in the air (FORESIGHT-CALLS §7).
        logger.error(
          `[calls] ${call.id} unresolved ${overdue}d past ${call.resolvesAt} ` +
            `(${call.rubric.test} on ${call.rubric.qid}) — voiding`,
        );
        await writeOutcome(
          store,
          call.id,
          CALL_VOID,
          snap,
          `${call.rubric.qid} could not answer this call within ${CALL_VOID_AFTER_DAYS} days of ${call.resolvesAt}`,
        );
        summary.voided++;
      } else {
        // Loud, per FORESIGHT-CALLS §9's "nobody resolves it" row: this is
        // the line a human reads while there is still time to act on it.
        logger.warn(
          `[calls] ${call.id} is ${overdue}d past ${call.resolvesAt} and not yet gradable ` +
            `(${call.rubric.test} on ${call.rubric.qid}${agg ? "" : ", no aggregate"}) — ` +
            `retrying; auto-void at ${CALL_VOID_AFTER_DAYS}d`,
        );
        summary.waiting++;
      }
      continue;
    }

    await writeOutcome(store, call.id, outcomeIdx, snap, null);
    summary.resolved++;
    logger.info(
      `[calls] ${call.id} resolved to option ${outcomeIdx} ` +
        `(${call.rubric.test} on ${call.rubric.qid}, n=${snap?.total ?? 0})`,
    );
  }

  return summary;
}

/**
 * Publish one outcome, once.
 *
 * `create` rather than `set`: a second run — or a retry of a run that
 * committed and then failed — must not produce a different truth for a
 * call somebody has already been scored against. An ALREADY_EXISTS is the
 * write doing its job, so it is swallowed rather than thrown.
 *
 * `inputs` is what the grader SAW. Without it the outcome is an assertion
 * again; with it the client re-runs the same arithmetic over the same
 * numbers and prints whether it agrees.
 */
async function writeOutcome(
  store: CallStore,
  qid: string,
  outcomeIdx: number,
  inputs: CallSnapshot | null,
  note: string | null,
): Promise<void> {
  await store.putOutcome(qid, {
    outcomeIdx,
    // "auto" is the only value this file writes. The field exists so a
    // hand-resolved exception is distinguishable from a graded one, which
    // is the difference between "the arithmetic said so" and "a person
    // said so" — and the card prints it.
    resolvedBy: "auto",
    inputs: inputs ?? null,
    ...(note ? { note } : {}),
  });
}

/** The real store: Firestore, with the create-once discipline. */
export function firestoreStore(): CallStore {
  const db = firestore();
  return {
    async agg(qid) {
      const snap = await db.collection("v2_question_aggs").doc(qid).get();
      return snap.exists ? (snap.data() as Awaited<ReturnType<CallStore["agg"]>>) : null;
    },
    async hasOutcome(qid) {
      return (await db.collection("v2_call_outcomes").doc(qid).get()).exists;
    },
    async putOutcome(qid, outcome) {
      try {
        // `create` rather than `set`, and `resolvedAt` is the SERVER's
        // clock rather than this instance's — the record of when a grade
        // happened should not depend on which machine ran the pass.
        await db.collection("v2_call_outcomes").doc(qid).create({
          ...outcome,
          resolvedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        const code = (err as { code?: number | string }).code;
        if (code === 6 || code === "already-exists") return;
        throw err;
      }
    },
  };
}

export const resolveCallsV2 = onSchedule(
  // Daily, off the top-of-hour herd and after the duel reveals. Cost is
  // one aggregate read per due call per day, against a bank of a handful:
  // it does not appear in docs/COSTS.md's three lines because it cannot
  // reach a rounding error there.
  { schedule: "23 4 * * *", region: REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const summary = await runResolveCalls();
    if (summary.due > 0) {
      logger.info(
        `[calls] pass: ${summary.due} due · ${summary.resolved} resolved · ` +
          `${summary.voided} voided · ${summary.waiting} waiting · ${summary.faulty} faulty`,
      );
    }
  },
);
