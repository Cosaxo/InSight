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

import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { LIGHT_CALLABLE, LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { db as firestore } from "./db";
import {
  buildModQueueFrom,
  carriedEscalations,
  modVerdictError,
  modVerdictId,
  tallyFlagsInto,
} from "./pure";

const REGION = FUNCTIONS_REGION;

// Drafted in docs/MODERATION.md as open questions; live here as the
// operator-tunable answers until the maintainer settles them.
const MOD_QUEUE_MIN_FLAGS = 3;
const MOD_QUEUE_SIZE = 25;
const MOD_RUN_CAP = 50;
// FALSE since D83 (2026-08-10): world takes shipped, and D78 made this
// flip their hard prerequisite — at world scale, circle-scope trust can no
// longer stand in for enforcement. The header note asked the flip to cite
// the advisory phase's track record; there is none to cite (the advisory
// window closed with zero users and an empty verdict log), and that
// deviation is recorded in D83 rather than papered over. Until the
// low-privilege Routine lands (still blocked, docs/MODERATION.md), the
// only verdict source is a MOD_UIDS operator acting by hand — a remove
// verdict now actually hides, so the blast radius of a wrong one is real
// and bounded by MOD_RUN_CAP.
export const MOD_ADVISORY = false;

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
// judges a fresh queue. Reads every flag, a page at a time — the collection
// is unbounded (see below), so the work is unbounded too and it keeps the
// long deadline. What it HOLDS is bounded by the number of distinct takes,
// which is what made paging worth doing rather than raising the memory.
/**
 * The uid behind an `av_`-namespaced moderation target, or null (D178).
 *
 * One reader for the prefix so the queue build, the verdict and any future
 * consumer cannot disagree about what an avatar target looks like. Returns
 * null for a take id, which is every id that existed before D178.
 */
function avatarTarget(targetId: string): string | null {
  return typeof targetId === "string" && targetId.startsWith("av_")
    ? targetId.slice(3) || null : null;
}

/** The Storage bucket avatars live in, for the queue's viewing URL. */
function avatarBucket(): string {
  try {
    return getStorage().bucket().name;
  } catch {
    // The emulator can be run without a bucket configured, and a queue
    // that refused to build for want of a display URL would take TAKE
    // moderation down with it. An avatar entry without a bucket is one a
    // moderator must escalate rather than judge, which is the safe way for
    // this to fail.
    return "";
  }
}

async function runBuildModQueue(): Promise<void> {
    const db = firestore();
    // PAGED, not `.get()` on the collection.
    //
    // v2_flags has no upper bound. MOD_ADVISORY makes the keep-verdict sweep
    // below the only path that deletes a flag, and it is dead code while
    // advisory is on; deleteAccount removes one uid's; nothing else does, and
    // there is no TTL. So the collection only grows, and materialising it
    // here put a snapshot of every flag ever cast on a 256 MiB instance
    // (LIGHT_UNBOUNDED, whose ops.ts rationale describes a STREAMING
    // recursiveDelete). At roughly 1.2 KB of heap per snapshot doc that is
    // an OOM somewhere above 100k flags — well before the 480 s deadline the
    // comment above reasons about, and the failure is silent in-band: the
    // stale queue keeps serving, `queuedAt` never advances, so `gen` freezes
    // and every re-judgement throws already-exists. buildModQueueNow shares
    // these options, so the manual recovery lever died the same way.
    //
    // What is retained now is one counter per DISTINCT take rather than one
    // object per flag. That is not a hard bound either — it grows with the
    // number of takes ever flagged — but it is the smallest thing the queue
    // can be built from, and it is smaller than the flag count by however
    // many people flagged the same take. The real bound is retention, and
    // that is a policy decision this does not take (D55 §11).
    //
    // tallyFlagsInto, not an object literal keyed in place: takeId is a
    // client-chosen document id, and the prototype names read back truthy
    // (see tallyFlags in pure.ts — a take posted as `constructor` was
    // unqueueable however often it was flagged).
    const FLAG_PAGE = 1000;
    const tally = new Map<string, number>();
    let flagCursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let flagCount = 0;
    for (;;) {
      let fq = db.collection("v2_flags").orderBy("__name__").limit(FLAG_PAGE);
      if (flagCursor) fq = fq.startAfter(flagCursor);
      const page = await fq.get();
      if (page.empty) break;
      tallyFlagsInto(tally, page.docs.map((f) => f.get("takeId")));
      flagCount += page.size;
      if (page.size < FLAG_PAGE) break;
      flagCursor = page.docs[page.docs.length - 1];
    }
    const counts = Object.fromEntries(tally);
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
    // Keyed by document id, which is the take id — client-chosen, so a Map
    // for the same reason tallyFlags is one. On an object literal the miss
    // path `priorEscalations[item.takeId] || 0` returns the Object
    // CONSTRUCTOR for a take called `constructor`, and that function is what
    // would be written to the queue entry's `escalations` field below.
    const priorEscalations = new Map<string, number>();
    for (const doc of existing.docs) {
      const n = carriedEscalations({
        escalations: doc.get("escalations"),
        escalated: doc.get("escalated"),
        advisoryVerdict: doc.get("advisoryVerdict"),
      });
      if (n > 0) priorEscalations.set(doc.id, n);
    }
    const batch = db.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);
    let queued = 0;
    let carried = 0;
    // The bucket, resolved once rather than per item: an avatar entry
    // carries it beside the token so the moderation session can build the
    // same URL the app does and actually LOOK at what was reported. There
    // is no signed-URL call here on purpose — that needs signBlob on the
    // runtime service account, which is infrastructure this repo cannot
    // assert, and a moderator holding the app's own read grant is the
    // smaller claim.
    const bucket = avatarBucket();
    for (const item of queue) {
      // AVATARS ARE MODERATED THROUGH THIS SAME QUEUE (D178), namespaced
      // by an `av_` target id so they cannot collide with a take id.
      //
      // The queue's field is still called `takeId` because takes were the
      // only moderatable thing when it was written and renaming it would
      // move rules, the verdict log, the e2e and a live client for no
      // behaviour. Read it as the moderation TARGET id.
      const target = avatarTarget(item.takeId);
      if (target) {
        const av = await db.collection("v2_avatars").doc(target).get();
        // Same two exits as a take: vanished, or already settled.
        if (!av.exists || av.get("hidden")) continue;
        const escalations = priorEscalations.get(item.takeId) || 0;
        if (escalations > 0) carried += 1;
        batch.set(db.collection("v2_mod_queue").doc(item.takeId), {
          takeId: item.takeId,
          kind: "avatar",
          gid: null,
          // No text to copy — the content IS the image, so what the
          // session gets is what it needs to fetch it and nothing about
          // the person behind it. Not even a display name: a face is
          // judged against the policy, not against who is wearing it.
          text: "",
          token: av.get("token") || "",
          bucket,
          flags: item.flags,
          escalations,
          queuedAt: FieldValue.serverTimestamp(),
        });
        queued += 1;
        continue;
      }
      const take = await db.collection("v2_takes").doc(item.takeId).get();
      // A vanished take has nothing to moderate; an already-hidden one is
      // settled. Both fall out of the queue silently.
      //
      // Deliberately a truthiness test rather than `=== true`: `hidden` is a
      // boolean now (D65), but a take hidden before that change carries the
      // old annotation MAP here, and a map is truthy while `=== true` would
      // silently re-queue every one of them.
      if (!take.exists || take.get("hidden")) continue;
      const escalations = priorEscalations.get(item.takeId) || 0;
      if (escalations > 0) carried += 1;
      batch.set(db.collection("v2_mod_queue").doc(item.takeId), {
        takeId: item.takeId,
        kind: "take",
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
        `(${flagCount} flags over ${tally.size} takes, floor ${MOD_QUEUE_MIN_FLAGS}); ` +
        `${carried} carrying a prior escalation`,
    );
}

export const buildModQueue = onSchedule(
  { ...LIGHT_UNBOUNDED, schedule: "0 5 * * *", region: REGION },
  runBuildModQueue,
);

// NO enforceAppCheck on any of the three moderation callables below, and
// that is the decision rather than the omission it looks like. The
// moderation Routine runs in a dedicated low-privilege environment with no
// repo checkout and no app (docs/MODERATION.md, D22) — confinement is the
// entire point of that environment, so there is no attested client for it
// to call from and attestation would refuse the only caller these have.
// assertModerator + MOD_UIDS is the control that stands in its place.
// `npm run check:appcheck` holds the exemption and fails if it is ever
// copied onto a callable that could attest.
//
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
  const db = firestore();
  const queue = await db.collection("v2_mod_queue").orderBy("flags", "desc").get();
  return {
    advisory: MOD_ADVISORY,
    runCap: MOD_RUN_CAP,
    items: queue.docs.map((d) => ({
      takeId: d.get("takeId"),
      // D178. `kind` tells the session what it is looking at; for an
      // avatar the content is an image, so it gets what it needs to fetch
      // one and nothing else. Absent on entries queued before D178, which
      // read as takes — the same default the collection had.
      kind: d.get("kind") || "take",
      token: d.get("token") || null,
      bucket: d.get("bucket") || null,
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

  const db = firestore();
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
      // Two fields, because they answer to two different readers. `hidden`
      // is the BOOLEAN the read rule compares against — it has to be a bare
      // equality or the gate stops being enforceable on a list query (D65,
      // and the long comment on that rule). `hiddenMeta` is the annotation
      // this used to write into `hidden` itself: nobody's access decision
      // turns on it, it exists so an appeal can be answered.
      // Same two fields on either kind, which is the reason an avatar got
      // its own DOCUMENT rather than a field on the profile (D178): the
      // remove path is one write of a shape the appeal path, the read
      // rules and this transaction all already understand.
      const target = avatarTarget(takeId);
      tx.update(
        target
          ? db.collection("v2_avatars").doc(target)
          : db.collection("v2_takes").doc(takeId),
        {
          hidden: true,
          hiddenMeta: { by: "mod", policyLine, runId, at: FieldValue.serverTimestamp() },
        },
      );
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
