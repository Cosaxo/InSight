// insight-functions/index.ts — server-side compute for InSight.
//
// Current scope:
//   - deleteAccount: user-triggered account wipe. Walks every doc
//     owned by the user + every reference to them in others' subtrees
//     and deletes them, then drops the auth user. App Store + Play
//     Store both require this for any app with sign-up.
//   - the v2 daily/mirror loop, re-exported at the foot of this file
//     from ./v2 and ./v2social.
//
// The v1 journal-era compute — the area/world/city aggregators, the
// inbound-impression callable and the taxonomy seeder — was deleted in
// decision D13. It ran on schedules over collections nothing had
// written since D4 removed their client, so it could not produce
// output. deleteAccount's cleanup of those v1 collections stays: the
// data may still exist in production, and erasure has to reach it.
//
// All functions use the admin SDK, which bypasses Firestore rules.
// The rules layer is for client traffic; functions can do anything.

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
// ./ops also sets the global runtime options — and must be imported
// before any function is defined. See the note there. It stays a value
// import (not `import "./ops"`) because deleteAccount reads
// ENFORCE_APP_CHECK; if that ever changes, keep the bare side-effect
// import rather than dropping the line.
import { ENFORCE_APP_CHECK } from "./ops";

initializeApp();

// ── deleteAccount ───────────────────────────────────────────────
//
// Walks every doc that belongs to the calling user OR references
// them, deletes each, then drops the Firebase Auth account.
//
// Order matters slightly — we delete the data first, then the auth
// user. If the auth-user delete fails (rare), the next sign-in will
// see an empty profile and the migration won't run (it gates on
// profileExists), so they're effectively in a fresh-account state.
//
// What we wipe (admin SDK, bypasses rules):
//   1. Every doc in insight_users/{uid}/* (all subcollections)
//   2. The user's profile doc insight_users/{uid}
//   3. insight_discoverable/{uid} (if present)
//   4. Inbound impressions the user sent into OTHER users' subtrees
//      — collectionGroup("insight_inbound_impressions") where
//      senderUid == uid
//   5. Relations in OTHER users' subtrees that point at this user
//      — collectionGroup("relations") where linkedUid == uid
//   6. The auth user itself
//
// What we leave (intentional):
//   - the v1 aggregates_* documents: k-floored anonymous averages
//     (floor 20) carrying no per-user provenance, so there is nothing
//     in them to attribute back and nothing to unwind. They are now
//     FROZEN residue rather than a live rollup — D13 deleted the
//     aggregators, so the "next scheduled run rebuilds without this
//     user" this note used to promise will never happen. That changes
//     nothing for erasure (anonymous either way); it does mean the
//     collections are inert data awaiting a one-off operator delete,
//     tracked in D13 rather than here.
//   - circle/{thisUid} marker docs on OTHER users' subtrees: stale
//     after this user is gone (their daily reports can no longer
//     be fetched, so the grant doesn't grant anything), but harmless
//     and finding them all would require another collectionGroup
//     query without an index. The other user can clean them up by
//     removing their relation.

// Delete every doc in a query, in batches of 400 (Firestore batch
// limit is 500; leaving headroom for safety).
async function deleteQueryDocs(
  query: FirebaseFirestore.Query,
): Promise<number> {
  const db = getFirestore();
  let total = 0;
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.docs.length;
    if (snap.docs.length < 400) break;
  }
  return total;
}

// Moderation-queue entries whose take no longer exists.
//
// v2_mod_queue holds a COPY of each flagged take's text — moderation.ts
// copies it so the moderation run reads one collection and never the circle
// around it. The cost of that confinement is that deleting a take does not
// delete the words: the copy outlives it until the next 05:00 rebuild.
//
// Keyed on the take's ABSENCE rather than on an author, for two reasons.
// The entry carries no author field and deliberately should not — a uid in
// the run's one readable collection would hand it a person to judge instead
// of a text. And absence is already the queue's own rule for "settled":
// runBuildModQueue skips a take that no longer exists. So this collects
// entries orphaned by an ordinary author-deletes-their-take as well, which
// nothing swept before either.
//
// Bounded whatever the account looks like: the queue holds at most
// MOD_QUEUE_SIZE entries (25, moderation.ts) in total across all users, so
// this is one query, at most that many existence checks, and a single batch
// far below the 500-write cap.
async function deleteOrphanedModQueue(): Promise<number> {
  const db = getFirestore();
  const queue = await db.collection("v2_mod_queue").get();
  const orphans: FirebaseFirestore.DocumentReference[] = [];
  for (const q of queue.docs) {
    const takeId = q.get("takeId");
    // An entry naming no take can never be settled by anything — it is
    // residue by definition, so it goes with the rest.
    if (typeof takeId !== "string" || !takeId) {
      orphans.push(q.ref);
      continue;
    }
    const take = await db.collection("v2_takes").doc(takeId).get();
    if (!take.exists) orphans.push(q.ref);
  }
  if (!orphans.length) return 0;
  const batch = db.batch();
  for (const ref of orphans) batch.delete(ref);
  await batch.commit();
  return orphans.length;
}

// Recursively delete every doc under insight_users/{uid}/*.
// Firestore's CLI has `firestore:delete --recursive` but that's
// admin tooling, not callable from a function. We do it by hand:
// list all subcollections, delete their docs, then delete the
// parent doc.
async function deleteUserSubtree(uid: string): Promise<number> {
  const db = getFirestore();
  const userRef = db.collection("insight_users").doc(uid);
  let total = 0;
  // Drop subcollections — listCollections is admin-only.
  const subcollections = await userRef.listCollections();
  for (const sub of subcollections) {
    total += await deleteQueryDocs(sub);
  }
  // Drop the parent doc last so subscriptions don't see a phantom
  // profile with no children mid-delete.
  await userRef.delete();
  total += 1;
  return total;
}

export const deleteAccount = onCall(
  // Unbounded per-account work, and a partial failure refuses the auth
  // delete — so a timeout here is a job the user can never complete.
  { region: "us-central1", enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    const uid = request.auth.uid;
    const db = getFirestore();
    logger.info(`[deleteAccount] starting for uid=${uid}`);

    const counts = {
      ownSubtree: 0,
      discoverable: 0,
      othersRelations: 0,
      othersInbound: 0,
      // Not per-user: the queue sweep is keyed on a take being gone, not on
      // whose it was, so this counts every orphan it found (see
      // deleteOrphanedModQueue). Reported because a nonzero number here on
      // a routine deletion is the signal that something else is leaving
      // entries behind.
      modQueueOrphans: 0,
    };
    // Phases that threw. If ANY wipe phase fails we must refuse to
    // delete the auth user: deleting it anyway would strand the
    // leftover data with no owner able to retry — a silent
    // right-to-erasure violation reported as ok:true.
    const failed: string[] = [];

    // 1. Wipe insight_users/{uid}/* + the profile doc itself.
    try {
      counts.ownSubtree = await deleteUserSubtree(uid);
    } catch (err) {
      logger.error("[deleteAccount] subtree wipe failed:", err);
      failed.push("ownSubtree");
    }

    // 1b. Wipe the v2 subtree (profile + answers). Aggregate counts the
    // user contributed stay — k-floored, anonymous tallies. The one place
    // that CAN attribute a count to this uid is the agg-events ledger
    // (D28), and phase 4c deletes it, so the tallies are anonymous again
    // the moment this call returns.
    try {
      await db.recursiveDelete(db.collection("v2_users").doc(uid));
    } catch (err) {
      logger.error("[deleteAccount] v2 subtree wipe failed:", err);
      failed.push("v2Subtree");
    }

    // 1b2. Wipe the user's takes and flags (docs/MODERATION.md). Both
    // live in top-level collections keyed by takeId — outside the
    // v2_users subtree 1b erased — so right-to-erasure has to query them
    // out by uid. Hidden takes go too: the soft-hide exists for appeal
    // and audit, and a deleted account has ended both.
    //
    // deleteQueryDocs rather than one unbounded batch per collection: a
    // batch caps at 500 writes, so an account with enough takes and flags
    // failed this phase outright — and a failed phase refuses the auth
    // delete, which turns "too talkative" into an account that can never
    // finish deleting itself.
    try {
      await deleteQueryDocs(db.collection("v2_takes").where("authorUid", "==", uid));
      await deleteQueryDocs(db.collection("v2_flags").where("uid", "==", uid));
      // …and the queue's copy of the text, which the take's deletion does
      // not take with it. Must run AFTER the takes are gone — it identifies
      // its targets by their take being absent. See deleteOrphanedModQueue.
      counts.modQueueOrphans = await deleteOrphanedModQueue();
    } catch (err) {
      logger.error("[deleteAccount] takes/flags wipe failed:", err);
      failed.push("takesFlags");
    }

    // 1c. Leave every v2 group: membership, name, and reveal entries all
    // reference the user — right-to-erasure means none may linger. A
    // group left empty is deleted outright (reveals included).
    try {
      const groups = await db.collection("v2_groups")
        .where("memberUids", "array-contains", uid).get();
      for (const g of groups.docs) {
        const members: string[] = g.get("memberUids") || [];
        if (members.length <= 1) {
          await db.recursiveDelete(g.ref);
          continue;
        }
        try {
          await g.ref.update({
            memberUids: FieldValue.arrayRemove(uid),
            [`memberNames.${uid}`]: FieldValue.delete(),
          });
        } catch (err) {
          // NOT_FOUND (5) means the group was deleted between the query
          // above and this write — the other member left, taking the group
          // with it. That is the outcome we wanted. Treating it as a
          // failure would push "v2Groups" onto `failed`, which refuses the
          // auth delete and leaves the user unable to erase their account
          // because someone else did something benign.
          if ((err as { code?: number | string }).code !== 5
            && (err as { code?: string }).code !== "not-found") throw err;
          continue;
        }
        // The user's vote and display name inside every published reveal.
        // Was one sequential update per reveal doc with no bound: a
        // year-old account in 20 groups is ~7,300 round trips, which blew
        // the old 60s wall — and the design then correctly refuses the auth
        // delete, so the user retries a job that fails identically forever.
        //
        // Rotating WriteBatch rather than BulkWriter: BulkWriter swallows
        // per-write errors by default, which would trade a loud timeout for
        // a silent INCOMPLETE erasure — the worst possible outcome here.
        // (The v1 aggregators this pattern was borrowed from are gone as of
        // D13; runSeedV2 in v2.ts is the remaining example.)
        let revealCursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        for (;;) {
          let q = g.ref.collection("reveals").orderBy("__name__").limit(400);
          if (revealCursor) q = q.startAfter(revealCursor);
          const page = await q.get();
          if (page.empty) break;
          let batch = db.batch();
          let ops = 0;
          for (const r of page.docs) {
            batch.update(r.ref, {
              [`votes.${uid}`]: FieldValue.delete(),
              [`names.${uid}`]: FieldValue.delete(),
              // The membership snapshot the reveal read rule gates on
              // (firestore.rules, the /reveals/{day} match). Scrubbing the
              // vote and the name but leaving the uid here left a
              // pseudonymous identifier — and the group-day history it
              // implies — surviving an erasure request. Removing it costs
              // the deleted user read access to a reveal they can no longer
              // authenticate for anyway, and costs no OTHER member
              // anything: the rule tests `request.auth.uid in members`, so
              // each entry only ever grants its own owner.
              members: FieldValue.arrayRemove(uid),
            });
            if (++ops >= 450) {
              await batch.commit();
              batch = db.batch();
              ops = 0;
            }
          }
          if (ops) await batch.commit();
          if (page.size < 400) break;
          revealCursor = page.docs[page.docs.length - 1];
        }
      }
    } catch (err) {
      logger.error("[deleteAccount] v2 group scrub failed:", err);
      failed.push("v2Groups");
    }

    // 2. Drop insight_discoverable/{uid} if present.
    try {
      const discRef = db.collection("insight_discoverable").doc(uid);
      const discSnap = await discRef.get();
      if (discSnap.exists) {
        await discRef.delete();
        counts.discoverable = 1;
      }
    } catch (err) {
      logger.error("[deleteAccount] discoverable wipe failed:", err);
      failed.push("discoverable");
    }

    // 3. Inbound impressions this user sent into other people's
    //    subtrees. Requires a collection-group index on senderUid;
    //    see firestore.indexes.json.
    try {
      const sentQuery = db
        .collectionGroup("insight_inbound_impressions")
        .where("senderUid", "==", uid);
      counts.othersInbound = await deleteQueryDocs(sentQuery);
    } catch (err) {
      logger.error("[deleteAccount] inbound impressions wipe failed:", err);
      failed.push("othersInbound");
    }

    // 4. Other users' relations pointing at this user via linkedUid.
    //    Requires a collection-group index on linkedUid.
    try {
      const relQuery = db
        .collectionGroup("relations")
        .where("linkedUid", "==", uid);
      counts.othersRelations = await deleteQueryDocs(relQuery);
    } catch (err) {
      logger.error("[deleteAccount] cross-user relations wipe failed:", err);
      failed.push("othersRelations");
    }

    // 4b. Rate-limit ledgers keyed by this uid. Rules make them fully
    //     opaque to clients, but they contain recipient uids and
    //     activity timestamps — right-to-erasure covers them too.
    try {
      await db.collection("insight_ratelimits").doc(uid).delete();
      await db.collection("v2_ratelimits").doc(`join_${uid}`).delete();
    } catch (err) {
      logger.error("[deleteAccount] rate-limit ledger wipe failed:", err);
      failed.push("ratelimits");
    }

    // 4c. The aggregate event ledger's entries for this uid. Same
    //     reasoning as 4b — server-only, but each entry says this account
    //     answered this question at this time, which is exactly the
    //     attribution D28 added it for. Erasure takes the attribution
    //     with the account; the k-floored tallies it fed stay (1b).
    //
    //     An answer still in flight through Eventarc when this runs can
    //     land its entry AFTER the sweep — bounded residue, gone at TTL,
    //     recorded in D28 rather than chased with a second pass.
    try {
      await deleteQueryDocs(db.collection("v2_agg_events").where("uid", "==", uid));
    } catch (err) {
      logger.error("[deleteAccount] agg-event ledger wipe failed:", err);
      failed.push("aggEvents");
    }

    // 5. Any wipe failure above must abort BEFORE the auth delete:
    //    the user stays signed in and can simply retry. Swallowing
    //    the error and deleting the auth user would orphan the
    //    leftover data forever while reporting success.
    if (failed.length > 0) {
      logger.error(`[deleteAccount] incomplete for uid=${uid}`, { failed, counts });
      throw new HttpsError(
        "internal",
        `Deletion incomplete (${failed.join(", ")}) — nothing was lost, please retry.`,
      );
    }

    // 6. Finally drop the auth user. Doing this last means any
    //    failure above leaves the user able to retry (they're still
    //    signed in). If THIS step fails, the user is mostly-wiped
    //    but their auth account lingers — they can sign in to a
    //    fresh, empty account.
    try {
      await getAuth().deleteUser(uid);
    } catch (err) {
      logger.error("[deleteAccount] auth.deleteUser failed:", err);
      throw new HttpsError(
        "internal",
        "Account data was wiped, but the auth account couldn't be deleted. Sign out and contact support.",
      );
    }

    logger.info(`[deleteAccount] done for uid=${uid}`, counts);
    return { ok: true, ...counts };
  },
);

// ── v2 (daily/mirror core loop) ─────────────────────────────────
export { seedContentV2, onV2AnswerCreated } from "./v2";
export {
  createGroupV2,
  joinGroupV2,
  leaveGroupV2,
  registerPushToken,
  scheduledDuelReveals,
  revealDuelsNowV2,
} from "./v2social";
export { buildModQueue, buildModQueueNow, fetchModQueue, submitModVerdict } from "./moderation";
