// moderation.ts — the server half of docs/MODERATION.md.
//
// Confinement is the design, so read the shape before the code: the
// moderation SESSION (a scheduled low-privilege run, docs/MODERATION.md)
// holds exactly two instruments — fetchModQueue and submitModVerdict —
// gated by their own allowlist (MOD_UIDS, deliberately separate from
// SEED_ADMIN_UIDS: a moderator identity can moderate and do nothing
// else). Targets are SERVER-picked: buildModQueue materializes the
// most-flagged takes on a schedule, and submitModVerdict rejects any
// takeId not in that queue — "also moderate X" fails structurally.
//
// MOD_ADVISORY is the trust ladder (order of work, step 3): while true,
// verdicts are recorded and surfaced but nothing is hidden — the
// maintainer applies or rejects by hand. Flipping it to false is a
// deliberate one-line change that should cite the advisory phase's
// track record in its PR.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { LIGHT_CALLABLE, LIGHT_UNBOUNDED } from "./ops";
import { buildModQueueFrom, carriedEscalations, modVerdictError, modVerdictId } from "./pure";

const REGION = "us-central1";

// Drafted in docs/MODERATION.md as open questions; live here as the
// operator-tunable answers until the maintainer settles them.
const MOD_QUEUE_MIN_FLAGS = 3;
const MOD_QUEUE_SIZE = 25;
const MOD_RUN_CAP = 50;
export const MOD_ADVISORY = true;

function modUids(): string[] {
  return (process.env.MOD_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// assertOperator's shape with the moderation allowlist. Deliberately NOT
// the same list: least privilege cuts both ways — an operator uid is not
// thereby a moderator, and a leaked moderator credential cannot seed
// content or trigger reveals.
function assertModerator(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "must be signed in");
  }
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator && !modUids().includes(request.auth.uid)) {
    throw new HttpsError("permission-denied", "moderator-only");
  }
}

// ── the queue: server-picked targets ────────────────────────────

// Daily, an hour before the moderation Routine's slot, so the run always
// judges a fresh queue. Scans all flags; flags are one small doc per
// (user, take) and the count is bounded by real user behavior, but the
// work is unbounded in principle, so it keeps the long deadline.
async function runBuildModQueue(): Promise<void> {
    const db = getFirestore();
    const flags = await db.collection("v2_flags").get();
    const counts: Record<string, number> = {};
    for (const f of flags.docs) {
      const takeId = f.get("takeId");
      if (typeof takeId === "string" && takeId) {
        counts[takeId] = (counts[takeId] || 0) + 1;
      }
    }
    const queue = buildModQueueFrom(counts, MOD_QUEUE_MIN_FLAGS, MOD_QUEUE_SIZE);

    // Rebuild wholesale: stale entries (verdicted, or takes since deleted)
    // must not linger, and the queue is small by construction.
    //
    // Wholesale is also why the verdict log is keyed per generation: this
    // run re-queues every take that is still flagged and still visible —
    // in advisory mode, that is all of them — so a log keyed by takeId
    // alone would refuse the second day's verdict on the first day's
    // grounds. See modVerdictId in pure.ts.
    const existing = await db.collection("v2_mod_queue").get();
    // …with ONE thing surviving the wipe: how often the run has escalated
    // this take. Everything else on an entry describes the generation being
    // replaced, but escalation is a message to a human that the rebuild was
    // silently eating (carriedEscalations, pure.ts). Read off the entry
    // being deleted, in the same fetch, so this costs no extra query.
    const priorEscalations: Record<string, number> = {};
    for (const doc of existing.docs) {
      const n = carriedEscalations({
        escalations: doc.get("escalations"),
        escalated: doc.get("escalated"),
        advisoryVerdict: doc.get("advisoryVerdict"),
      });
      if (n > 0) priorEscalations[doc.id] = n;
    }
    const batch = db.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);
    let queued = 0;
    let carried = 0;
    for (const item of queue) {
      const take = await db.collection("v2_takes").doc(item.takeId).get();
      // A vanished take has nothing to moderate; an already-hidden one is
      // settled. Both fall out of the queue silently.
      if (!take.exists || take.get("hidden")) continue;
      const escalations = priorEscalations[item.takeId] || 0;
      if (escalations > 0) carried += 1;
      batch.set(db.collection("v2_mod_queue").doc(item.takeId), {
        takeId: item.takeId,
        gid: take.get("gid") || null,
        // The text is COPIED here so the moderation session reads only
        // this collection — the minimum-necessary read the design
        // promises. It sees flagged content, never the circle around it.
        text: take.get("text") || "",
        flags: item.flags,
        escalations,
        queuedAt: FieldValue.serverTimestamp(),
      });
      queued += 1;
    }
    await batch.commit();
    logger.info(
      `[mod] queue rebuilt: ${queued} queued of ${queue.length} over-threshold ` +
        `(${flags.size} flags total, floor ${MOD_QUEUE_MIN_FLAGS}); ` +
        `${carried} carrying a prior escalation`,
    );
}

export const buildModQueue = onSchedule(
  { ...LIGHT_UNBOUNDED, schedule: "0 5 * * *", region: REGION },
  runBuildModQueue,
);

// The scheduled build's on-demand twin (the revealDuelsNowV2 pattern):
// the e2e leg drives it in the emulator, and in production it is the
// maintainer's manual rebuild lever. Moderator-gated like the other two
// instruments — it reads flags, which nobody else may.
export const buildModQueueNow = onCall({ ...LIGHT_UNBOUNDED, region: REGION }, async (request) => {
  assertModerator(request);
  await runBuildModQueue();
  return { ok: true };
});

// ── the two instruments ─────────────────────────────────────────

export const fetchModQueue = onCall({ ...LIGHT_CALLABLE, region: REGION }, async (request) => {
  assertModerator(request);
  const db = getFirestore();
  const queue = await db.collection("v2_mod_queue").orderBy("flags", "desc").get();
  return {
    advisory: MOD_ADVISORY,
    runCap: MOD_RUN_CAP,
    items: queue.docs.map((d) => ({
      takeId: d.get("takeId"),
      text: d.get("text"),
      flags: d.get("flags"),
      // Escalated in THIS generation (so the run does not re-judge what it
      // already deferred within one queue), and how many earlier
      // generations it deferred — the standing signal that survives the
      // rebuild. Both spellings of the first are read because advisory mode
      // records the verdict under `advisoryVerdict`.
      escalated: d.get("escalated") === true || d.get("advisoryVerdict") === "escalate",
      escalations: d.get("escalations") || 0,
    })),
  };
});

export const submitModVerdict = onCall({ ...LIGHT_CALLABLE, region: REGION }, async (request) => {
  assertModerator(request);
  const err = modVerdictError(request.data?.verdict);
  if (err) throw new HttpsError("invalid-argument", err);
  const runId = String(request.data?.runId || "").slice(0, 64);
  if (!runId) throw new HttpsError("invalid-argument", "runId required");
  const { takeId, verdict, policyLine } = request.data.verdict as {
    takeId: string;
    verdict: "remove" | "keep" | "escalate";
    policyLine?: string;
  };

  const db = getFirestore();
  // The per-run cap bounds a broken or hijacked run's blast radius. A
  // count query outside the transaction is fine: the cap is a circuit
  // breaker, not an invariant, and being off by one under a race changes
  // nothing it protects.
  const spent = await db.collection("v2_mod_verdicts").where("runId", "==", runId).count().get();
  if (spent.data().count >= MOD_RUN_CAP) {
    throw new HttpsError("resource-exhausted", `run cap (${MOD_RUN_CAP}) reached`);
  }

  await db.runTransaction(async (tx) => {
    const queueRef = db.collection("v2_mod_queue").doc(takeId);
    const queued = await tx.get(queueRef);
    // THE confinement check: the server picked the targets, and a verdict
    // against anything else — however persuasive the text that asked for
    // it — has no document to land on.
    if (!queued.exists) {
      throw new HttpsError("failed-precondition", "take is not in the moderation queue");
    }
    // Which queue generation this verdict belongs to, read off the
    // SERVER-picked entry rather than accepted from the run (which never
    // names one — the channel shape is unchanged). modVerdictId in pure.ts
    // carries why the log is keyed this way and why an unknown generation
    // falls back to the old, stricter id.
    const queuedAt = queued.get("queuedAt") as { toMillis?: () => number } | null;
    const gen = typeof queuedAt?.toMillis === "function" ? queuedAt.toMillis() : 0;
    const verdictRef = db.collection("v2_mod_verdicts").doc(modVerdictId(takeId, gen));
    const prior = await tx.get(verdictRef);
    if (prior.exists) {
      throw new HttpsError("already-exists", "take already has a verdict this queue generation");
    }
    tx.set(verdictRef, {
      takeId,
      verdict,
      policyLine: policyLine || null,
      runId,
      // Stamped as well as keyed: the maintainer's digest groups the log by
      // generation, and parsing it back out of the document id would be a
      // second, silent copy of modVerdictId's format.
      gen,
      by: request.auth?.uid || null,
      advisory: MOD_ADVISORY,
      at: FieldValue.serverTimestamp(),
    });
    if (MOD_ADVISORY) {
      // Trust-ladder phase: record and surface, touch nothing. The queue
      // entry keeps the verdict so the maintainer's review reads in place.
      //
      // The next rebuild drops these two fields with the rest of the entry,
      // which is right rather than lossy: they annotate THIS generation's
      // queue, and the durable record is the verdict log, which now keeps
      // one entry per generation instead of overwriting nothing.
      tx.update(queueRef, { advisoryVerdict: verdict, advisoryLine: policyLine || null });
      return;
    }
    if (verdict === "remove") {
      tx.update(db.collection("v2_takes").doc(takeId), {
        hidden: { by: "mod", policyLine, runId, at: FieldValue.serverTimestamp() },
      });
      tx.delete(queueRef);
    } else if (verdict === "keep") {
      tx.delete(queueRef);
    } else {
      tx.update(queueRef, { escalated: true });
    }
  });

  // keep-verdicts clear the take's flags so a kept take re-enters the
  // queue only on FRESH flags — outside the transaction because flag
  // docs are unbounded in principle and best-effort is enough (leftover
  // flags cost a redundant queue entry, never a wrong hide).
  if (!MOD_ADVISORY && verdict === "keep") {
    const flags = await db.collection("v2_flags").where("takeId", "==", takeId).get();
    const batch = db.batch();
    for (const f of flags.docs) batch.delete(f.ref);
    await batch.commit();
  }
  return { ok: true, advisory: MOD_ADVISORY };
});
