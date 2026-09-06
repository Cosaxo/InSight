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
  tallyFirstFlagInto,
  tallyFlagsInto,
} from "./pure";

const REGION = FUNCTIONS_REGION;

// Drafted in docs/MODERATION.md as open questions; live here as the
// operator-tunable answers until the maintainer settles them.
const MOD_QUEUE_MIN_FLAGS = 3;
export const MOD_QUEUE_SIZE = 25;
// THE CAP CANNOT FIRE, and three places named it as the bound on a wrong
// remove verdict. `scripts/mod-queue.mjs` mints a fresh `randomUUID()` per
// invocation — deliberately, because "a run id somebody can choose is a
// run id somebody can reuse" — and submits exactly one verdict with it. So
// the count query below always counts 0, on every verdict, forever.
//
// What actually confines a run is the pair the caller and this file form:
// one verdict per invocation, typed by a person who read the text, and one
// verdict per take per queue generation (the `already-exists` guard in the
// transaction). The queue itself holds MOD_QUEUE_SIZE entries.
//
// Left standing rather than removed, because the choice between the two
// ways to make it honest is the maintainer's: scope the runId to a session
// so the cap counts something, or drop it and stop paying for the
// aggregation read on every verdict. Recorded either way — the cost today
// is one billed count() per verdict for a number that is always zero.
const MOD_RUN_CAP = 50;
// How many over-threshold takes the build will CONSIDER to fill those 25.
//
// The queue used to be cut to MOD_QUEUE_SIZE inside buildModQueueFrom, and
// only then did this file discover — one take document at a time, the only
// place that can — that an entry's target had vanished or was already
// hidden. Those entries were skipped with `continue`, so the slot went to
// nobody: 25 candidates, fewer than 25 queued, and the difference was
// invisible except as a smaller number in the log line.
//
// Now the pure fold hands back a WINDOW and the loop below stops at
// MOD_QUEUE_SIZE live entries. The factor bounds what that costs: at worst
// this reads 100 documents instead of 25, and only when the tail is full of
// settled targets — which the sweep below then drains, so the worst case is
// self-limiting rather than the standing state.
const MOD_QUEUE_CANDIDATES = MOD_QUEUE_SIZE * 4;
// No author may hold more than this many of the 25 slots in one generation.
//
// The arithmetic: the floor is 3 flags, accounts are free (D3), and a take
// id is client-chosen — so before this, three accounts and 75 flags could
// occupy the entire queue with 25 takes by one author, and every honest
// report below the floor of that block waited a generation behind it. A cap
// of 5 makes filling the queue cost five authors rather than one, and still
// lets a genuinely prolific offender have their five worst judged now and
// the rest next generation, once these settle and their flags clear.
export const MOD_QUEUE_PER_AUTHOR = 5;
// FALSE since D83 (2026-08-10): world takes shipped, and D78 made this
// flip their hard prerequisite — at world scale, circle-scope trust can no
// longer stand in for enforcement. The header note asked the flip to cite
// the advisory phase's track record; there is none to cite (the advisory
// window closed with zero users and an empty verdict log), and that
// deviation is recorded in D83 rather than papered over. Until the
// low-privilege Routine lands (still blocked, docs/MODERATION.md), the
// only verdict source is a MOD_UIDS operator acting by hand — a remove
// verdict now actually hides, so the blast radius of a wrong one is real.
// What bounds it is ONE VERDICT PER INVOCATION on the caller's side and
// one verdict per take per queue generation on this one; MOD_RUN_CAP does
// not, and this comment said it did — see the cap's own note.
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
export function assertModerator(request: CallableRequest): void {
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
export function avatarTarget(targetId: string): string | null {
  return typeof targetId === "string" && targetId.startsWith("av_")
    ? targetId.slice(3) || null : null;
}

/**
 * Delete every flag cast on one moderation target. Returns how many went.
 *
 * ONE reader for "this target is settled, its flags are spent", because
 * there are now three callers and they must not disagree: the keep verdict,
 * the remove verdict, and the queue build's sweep of targets it finds
 * already gone. A flag that outlives the thing it reported is not evidence
 * of anything — it is a permanent vote in a tally the queue is ranked by.
 *
 * PAGED, unlike the single WriteBatch this replaces. A batch is capped at
 * 500 writes and `commit()` throws over it — and the throw lands AFTER the
 * verdict transaction has already committed, so the moderator would see a
 * failure for a decision that took, and every retry would then hit
 * failed-precondition on the queue entry that is already gone. 500
 * reporters on one take is exactly the mass-false-report case moderation
 * exists for, so it is the wrong place to have a cliff.
 *
 * Best-effort by design, as the keep sweep always was: leftover flags cost
 * a redundant queue entry, never a wrong hide.
 */
async function clearFlagsFor(
  db: FirebaseFirestore.Firestore,
  takeId: string,
): Promise<number> {
  const FLAG_DELETE_PAGE = 400;
  let cleared = 0;
  for (;;) {
    const page = await db.collection("v2_flags")
      .where("takeId", "==", takeId).limit(FLAG_DELETE_PAGE).get();
    if (page.empty) break;
    const batch = db.batch();
    for (const f of page.docs) batch.delete(f.ref);
    await batch.commit();
    cleared += page.size;
    if (page.size < FLAG_DELETE_PAGE) break;
  }
  return cleared;
}

/**
 * Count one queued entry against its author, and say whether it is over.
 *
 * A Map for the same reason the tally and priorEscalations are ones: the key
 * is a uid, and on an object literal a uid of `constructor` reads back as
 * the Object constructor — truthy, and `>= MOD_QUEUE_PER_AUTHOR` against a
 * function is false, so that one account would have been exempt from its own
 * cap. Uids are Firebase-minted rather than client-chosen, so this is
 * belt-and-braces rather than a live hole; it costs a Map.
 *
 * An unknown author (a take written before `authorUid` was required, or a
 * malformed doc) is NEVER capped: the cap exists to stop one account
 * crowding the queue, and refusing to queue a take because its author
 * cannot be read would hide content from moderation on a technicality.
 */
export function overAuthorCap(perAuthor: Map<string, number>, author: unknown): boolean {
  if (typeof author !== "string" || !author) return false;
  const held = perAuthor.get(author) || 0;
  if (held >= MOD_QUEUE_PER_AUTHOR) return true;
  perAuthor.set(author, held + 1);
  return false;
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
    // v2_flags has no upper bound, and the reason is NOT that nothing
    // deletes flags — that was the reason while MOD_ADVISORY was true, and
    // it has been false since D83. A settled take's flags go two ways now:
    // `submitModVerdict` sweeps them on every keep AND remove, and the loop
    // at the end of this function sweeps every settled target on each
    // nightly build, without consulting the advisory flag at all.
    //
    // What is unbounded is what NEVER settles. An escalated take's flags
    // are kept deliberately — they are the evidence a human is going to
    // read — and a flagged take below the queue floor is never judged, so
    // its flags stay. Add the takes ever flagged, no TTL, and deleteAccount
    // removing one uid's, and the collection still has no ceiling: it
    // simply has one for a different reason than this paragraph used to
    // give. Materialising it here put a snapshot of every flag ever cast on
    // a 256 MiB instance
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
    // Folded in the same pass as the tally, for the queue's tie-break —
    // see tallyFirstFlagInto in pure.ts for why the id could not stay it.
    const firstAt = new Map<string, number>();
    let flagCursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let flagCount = 0;
    for (;;) {
      let fq = db.collection("v2_flags").orderBy("__name__").limit(FLAG_PAGE);
      if (flagCursor) fq = fq.startAfter(flagCursor);
      const page = await fq.get();
      if (page.empty) break;
      tallyFlagsInto(tally, page.docs.map((f) => f.get("takeId")));
      tallyFirstFlagInto(firstAt, page.docs.map((f) => ({
        takeId: f.get("takeId"),
        // Timestamp → millis here rather than in pure.ts, which knows
        // nothing about Firestore. A flag written before `at` was required
        // has none; tallyFirstFlagInto skips a non-number rather than
        // reading it as 0, which would sort it to the front of its tie.
        at: f.get("at")?.toMillis?.(),
      })));
      flagCount += page.size;
      if (page.size < FLAG_PAGE) break;
      flagCursor = page.docs[page.docs.length - 1];
    }
    const counts = Object.fromEntries(tally);
    // A candidate WINDOW, not the queue — see MOD_QUEUE_CANDIDATES.
    const queue = buildModQueueFrom(counts, MOD_QUEUE_MIN_FLAGS, MOD_QUEUE_CANDIDATES, firstAt);

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
    // Targets found settled while filling the queue, swept after the loop.
    //
    // The queue build is the only thing that ever LEARNS a flagged target
    // is gone — a take its author deleted, or one hidden before the remove
    // verdict started clearing flags. Their flags otherwise sit in the
    // tally forever, ranking a target that can never be queued and holding
    // a candidate slot on every run from here to the end of the app. Swept
    // here, the tally self-heals on the first run and the residue is gone
    // rather than permanent.
    const settled: string[] = [];
    // Per author, to bound one account's share of a generation.
    const perAuthor = new Map<string, number>();
    let capped = 0;
    for (const item of queue) {
      // The window exists to be walked past dead entries; the QUEUE is
      // still MOD_QUEUE_SIZE, and it is full.
      if (queued >= MOD_QUEUE_SIZE) break;
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
        // Same two exits as a take: vanished, or already settled. Both now
        // hand the target to the sweep — the entry is not coming back, so
        // neither should its flags.
        if (!av.exists || av.get("hidden")) { settled.push(item.takeId); continue; }
        // An avatar's author is the uid its target names, no read required.
        if (overAuthorCap(perAuthor, target)) { capped += 1; continue; }
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
      if (!take.exists || take.get("hidden")) { settled.push(item.takeId); continue; }
      // `authorUid` off the document rather than parsed out of the id: a
      // world take's id is `qid + "_" + uid` and qid may itself contain an
      // underscore, and a circle take's id says nothing about its author at
      // all. The document is already in hand, so this costs no read.
      if (overAuthorCap(perAuthor, take.get("authorUid"))) { capped += 1; continue; }
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
    // AFTER the queue is committed, and deliberately: a sweep that failed
    // half way must not be able to take the rebuild down with it, and the
    // queue is the part that has to land. Sequential rather than
    // Promise.all — this is a scheduled job on the long deadline, and the
    // list is empty on every run after the first that drains the residue.
    let swept = 0;
    for (const takeId of settled) {
      try {
        swept += await clearFlagsFor(db, takeId);
      } catch (err) {
        // Best-effort, like the verdict sweeps: leftover flags cost a
        // candidate slot on the next run, never a wrong hide.
        logger.warn(`[mod] settled-flag sweep failed for ${takeId}:`, err);
      }
    }
    logger.info(
      `[mod] queue rebuilt: ${queued} queued of ${queue.length} candidate(s) ` +
        `(${flagCount} flags over ${tally.size} takes, floor ${MOD_QUEUE_MIN_FLAGS}, ` +
        `window ${MOD_QUEUE_CANDIDATES}, size ${MOD_QUEUE_SIZE}); ` +
        `${carried} carrying a prior escalation; ` +
        `${capped} held back by the per-author cap (${MOD_QUEUE_PER_AUTHOR}); ` +
        `${swept} flag(s) swept from ${settled.length} settled target(s)`,
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

  // A SETTLED verdict clears the target's flags — keep AND remove — so it
  // re-enters the queue only on FRESH flags. Outside the transaction
  // because flag docs are unbounded in principle and best-effort is enough
  // (leftover flags cost a redundant queue entry, never a wrong hide).
  //
  // `remove` was missing here, and its absence was the whole moderation
  // pipeline's undo. A removed take keeps its flag count in the daily
  // tally forever; the tally is what the queue is RANKED by; so the take
  // keeps ranking at the top of every rebuild and is then skipped as
  // already-hidden, one candidate slot at a time. Twenty-five organic
  // removes and the queue could not reach anything below the top
  // twenty-five flag counts again — with MOD_ADVISORY false and hand
  // verdicts the only source (D83), that is moderation off, reporting
  // nothing. It needed no attacker: it was the ordinary consequence of
  // using the tool as designed.
  //
  // Escalate is deliberately NOT here. An escalated take is unsettled — a
  // human is still to look at it — and its flags are the evidence.
  if (!MOD_ADVISORY && (verdict === "keep" || verdict === "remove")) {
    await clearFlagsFor(db, takeId);
  }

  // A REMOVED FACE HAS TO LEAVE THE BUCKET, not just gain a field.
  //
  // The transaction above writes `hidden: true` on the v2_avatars document
  // and stops there — which hides the face everywhere the APP draws it, and
  // nowhere else. storage.rules grants `avatars/{uid}` to any signed-in
  // caller with no reference to that document, so two ordinary API calls —
  // read the token off the profile, fetch the media URL — still served the
  // image a moderator had just removed.
  //
  // Why the fix is the delete and not the rules. Storage rules can reach
  // Firestore with `firestore.get()`, but only the (default) database, and
  // D165 moved this app to a named one — so the gate cannot be written
  // there at all. Even if it could, it would put a Firestore read on every
  // face fetched, on what storage.rules calls "the app's only egress path,
  // and a room of two dozen faces reads two dozen objects".
  //
  // THE COST, and it is the one D178 would care about: once the object is
  // gone a wrongly-removed face is unappealable in substance. `hiddenMeta`
  // still records who removed it, under which policy line and when, so the
  // DECISION is auditable — the image itself is not recoverable. That is
  // the same trade deleteAccount makes one file over, and the same
  // direction: a face that must not be served is worse than a face that
  // cannot be restored.
  const removedFace = !MOD_ADVISORY && verdict === "remove" ? avatarTarget(takeId) : null;
  let mediaRemoved = false;
  if (removedFace) {
    try {
      // ignoreNotFound: a face removed twice, or one whose owner deleted
      // their account between the report and the verdict, is the same
      // outcome either way.
      await getStorage().bucket().file(`avatars/${removedFace}`)
        .delete({ ignoreNotFound: true });
      mediaRemoved = true;
    } catch (err) {
      // NOT a throw. The verdict has already committed, so throwing would
      // show the moderator a failure for a decision that took and send them
      // into a retry that hits failed-precondition on a queue entry already
      // gone — the exact shape the unpaged flag batch used to have.
      // ERROR-level so monitoring sees it, and reported back so the
      // moderator knows the object outlived the verdict.
      logger.error(`[mod] avatar object delete failed for ${removedFace}:`, err);
    }
  }
  return { ok: true, advisory: MOD_ADVISORY, ...(removedFace ? { mediaRemoved } : {}) };
});
