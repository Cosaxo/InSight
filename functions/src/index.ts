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
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { avatarTarget } from "./moderation";
import { refundEurFor } from "./paid";
import { presenceNeighbors } from "./pure";
import { logger } from "firebase-functions";
// ./ops also sets the global runtime options — and must be imported
// before any function is defined. See the note there. It stays a value
// import (not `import "./ops"`) because deleteAccount reads
// ENFORCE_APP_CHECK; if that ever changes, keep the bare side-effect
// import rather than dropping the line.
import { ENFORCE_APP_CHECK, FUNCTIONS_REGION } from "./ops";
import { db as firestore } from "./db";

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
//   - the v1 aggregates_* documents: anonymous averages (v1, retired)
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
  const db = firestore();
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
  const db = firestore();
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
    // AVATARS SHARE THIS QUEUE (D178), namespaced `av_<uid>` so they
    // cannot collide with a take id — and `v2_takes/av_<uid>` never
    // exists, so testing every entry against v2_takes read EVERY queued
    // avatar report as an orphan. Any account deleting itself swept them
    // all, and accounts are free (D3): a flagged photo could be kept out
    // of the queue indefinitely, once a day, by a throwaway.
    //
    // Same absence-keyed design, asked of the right collection. The
    // prefix is read through moderation.ts's own `avatarTarget`, which
    // exists so "the queue build, the verdict and any future consumer
    // cannot disagree about what an avatar target looks like" — this is
    // that future consumer, and it disagreed.
    const face = avatarTarget(takeId);
    const target = face
      ? await db.collection("v2_avatars").doc(face).get()
      : await db.collection("v2_takes").doc(takeId).get();
    if (!target.exists) orphans.push(q.ref);
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
  const db = firestore();
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
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    const uid = request.auth.uid;
    const db = firestore();
    logger.info(`[deleteAccount] starting for uid=${uid}`);

    const counts = {
      ownSubtree: 0,
      discoverable: 0,
      othersRelations: 0,
      othersInbound: 0,
      // Follows OTHER accounts hold of this one (D101, phase 3b). Counted
      // separately from othersRelations because they are a different
      // collection with a different index behind them, and a zero here on
      // an account that had followers is the signal that the index is
      // missing rather than that nobody followed them.
      othersFollows: 0,
      handle: 0,
      // The people directory row (D239). A flat 0/1 rather than a query
      // count: it is one document at a known id, so a 0 here means the
      // delete threw, not that nothing matched.
      peopleRow: 0,
      // Circles this account had ASKED to join and was never approved
      // into (D240) — invisible to the membership sweep by definition.
      pendingJoins: 0,
      invitesTo: 0,
      invitesFrom: 0,
      // Question suggestions swept by phase 4d (docs/NEXT-FUNCTIONALITY.md
      // §6) — the author's queued free text, keyed by uid.
      suggestions: 0,
      // Paid purchase records swept by phase 4e (PAID-PLAN §7, D288 §3) —
      // the buyer's contract ledger, keyed by uid.
      purchases: 0,
      // Paid AD documents taken with them (phase 4e). Not uid-keyed and
      // not reachable by any query from here — the purchase row is the
      // only pointer at one, which is why they go in the same phase.
      paidAds: 0,
      // Bought QUESTIONS whose byline was emptied (phase 4e). The question
      // survives as content deliberately; the buyer's display name and
      // audience dims on it do not, and the purchase row is the only
      // pointer that can find one. Reported because a zero on an account
      // that bought a question is the signal that the pointer was gone
      // before this ran.
      paidQuestionBylines: 0,
      // Paid-question bookings swept by phase 4f (paid.ts, D313) — the
      // pre-payment half of a sale, keyed by uid.
      paidBookings: 0,
      // Reveal docs scrubbed of this uid (phase 1c-bis). Reported for the
      // same reason as modQueueOrphans: it is the number that tells an
      // operator whether the collection-group sweep actually reached
      // anything, and a zero on an account that played duels is a signal.
      reveals: 0,
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

    // 1a. THE AGG-EVENTS LEDGER, AND IT RUNS FIRST NOW — it used to be
    //     phase 4c, a dozen phases after the subtree wipe below.
    //
    //     The nightly folds (the interest profile, the patterns state,
    //     the engagement rollup) READ this ledger and WRITE per-uid
    //     documents under `v2_users/{uid}` from what they find. A fold
    //     that started while this call was in flight therefore saw the
    //     erased account's rows and wrote its profile back UNDER a
    //     subtree that had just been deleted — and nothing could remove
    //     it afterwards, because the auth user is gone and deleteAccount
    //     can never run for that uid again. docs/data-inventory.md
    //     promises the opposite in as many words ("erased with the
    //     account by deleteAccount's recursive delete — no new arm").
    //
    //     Taking the ledger first means a fold that starts at any point
    //     after this line finds nothing for this uid and writes nothing.
    //     What it does not cover is a fold that READ the ledger before
    //     this line and commits after the sweep at the end of this
    //     function; that residue is named there.
    //
    //     What the ledger IS, unchanged by the move: server-only, but
    //     each entry says this account answered this question at this
    //     time, which is exactly the attribution D28 added it for.
    //     Erasure takes the attribution with the account; the tallies it
    //     fed stay (1b below).
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

    // 1b. Wipe the v2 subtree (profile + answers). Aggregate counts the
    // user contributed stay — anonymous tallies. The one place
    // that CAN attribute a count to this uid is the agg-events ledger
    // (D28), taken by phase 1a above, so the tallies are anonymous again
    // the moment this call returns.
    try {
      await db.recursiveDelete(db.collection("v2_users").doc(uid));
    } catch (err) {
      logger.error("[deleteAccount] v2 subtree wipe failed:", err);
      failed.push("v2Subtree");
    }

    // 1b1. The verified-logic attempt doc (D57) — keyed by uid in its own
    // collection, so the subtree wipe above never reaches it. It holds the
    // account's seed, score and timing; the anonymous norms HISTOGRAM the
    // first attempt fed stays, same as the question aggregates a
    // deleted account's answers fed (and unlike those, it has no uid
    // ledger to scrub — the count was never attributable to begin with).
    try {
      await db.collection("v2_logic_attempts").doc(uid).delete();
    } catch (err) {
      logger.error("[deleteAccount] logic attempt wipe failed:", err);
      failed.push("logicAttempt");
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
      // FLAGS FIRST, THEN THE TAKES THEY NAME — per page.
      //
      // This collected the ids as it deleted, and swept their flags after
      // the whole loop, on the reasoning that "once the take is gone
      // nothing can find its flags again". True, and that is exactly the
      // problem: it made the phase depend on state it had already
      // destroyed. One transient failure anywhere after the loop, then the
      // user's own retry, and the takes are gone, so the ids come back
      // empty and their flags are unreachable forever — while the retry
      // returns `ok` and deletes the auth user, so there is no third run.
      // Verified against the real handler: the surviving document was a
      // flag whose id contains the erased uid, in a collection with no TTL
      // whose counts rank the moderation queue.
      //
      // Sweeping each page's flags while its takes still exist makes the
      // phase resumable: at any failure point, whatever is left is still
      // queryable by `authorUid`.
      for (;;) {
        const snap = await db.collection("v2_takes")
          .where("authorUid", "==", uid).limit(400).get();
        if (snap.empty) break;
        const ids = snap.docs.map((d) => d.id);
        // Chunked at ten because `in` is a bounded operator, and over ids
        // rather than a prefix match, which Firestore has no way to
        // express on a suffix.
        for (let i = 0; i < ids.length; i += 10) {
          await deleteQueryDocs(
            db.collection("v2_flags").where("takeId", "in", ids.slice(i, i + 10)),
          );
        }
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        if (snap.docs.length < 400) break;
      }
      // Flags this account WROTE.
      await deleteQueryDocs(db.collection("v2_flags").where("uid", "==", uid));
      // …and flags that NAME it, which the query above cannot see.
      //
      // A flag carries the uid of whoever cast it, and separately the thing
      // it reports. Sweeping only the author left every report AGAINST this
      // account standing: clearFlagsFor only runs for targets the
      // moderation queue actually considers, and the queue's floor is
      // MOD_QUEUE_MIN_FLAGS, so one or two reports on a departed account's
      // face were residue forever. In the one collection whose stated
      // posture is that erasure takes "their takes and flags".
      //
      // WHAT THIS REACHES IS AVATAR FLAGS, AND ONLY THOSE. The paragraph
      // here used to say it reached a flag on a world take as well, "since
      // a world take's id IS qid_uid" — which is true of the id and says
      // nothing about this query. `isTakeFlag()` in firestore.rules pins a
      // take flag's fields to exactly ["takeId", "gid", "uid", "at"]: there
      // is no `target` on one, so this equality cannot match a take flag,
      // ever. The `target` field exists only on the avatar arm, which
      // carries it (the rule's own note) so the rule can reach the avatar
      // document without doing string surgery on an id.
      //
      // The reachable residue is therefore: report cast on a world take →
      // the author deletes their own take (permitted, "your speech stays
      // yours to withdraw") → the flag is orphaned → the author erases.
      // The takes loop above finds no take, so `takeId in ids` never names
      // it, and this cannot see it. Confirmed against the real callable in
      // the emulator, not reasoned. Closing it needs either a `target` on
      // take flags (a rules change, and one that must stay OPTIONAL: a
      // released ruleset applies instantly while installed clients update
      // over weeks, so requiring the field would refuse every report from
      // an app already on a phone) or a trigger that clears a take's flags
      // when the take is deleted, which is what the queue build's own
      // `settled` sweep already does for targets that clear the floor.
      // Neither is a comment's call — see the night list.
      await deleteQueryDocs(db.collection("v2_flags").where("target", "==", uid));
      // The face, both halves (D178). The document is one delete; the
      // BYTES are the first thing this function has ever had to remove
      // from Storage, and the reason storage.rules could keep its retired
      // read grant was precisely that deleteAccount did not touch Storage
      // — "revoking access to objects that still exist would create an
      // erasure gap rather than close a hole". Adding a photo without
      // adding this would have made that sentence describe the live path
      // too.
      //
      // Ignored-not-found rather than checked-then-deleted: an account
      // with no photo is the common case, and a missing object is the
      // outcome either way.
      await db.collection("v2_avatars").doc(uid).delete();
      // The presence doc (D84) is keyed by uid — one delete, and the only
      // location-shaped datum the account ever held server-side is gone.
      //
      // AND ITS CELL'S ROOM CACHE WITH IT (D177). That cache holds a
      // ROSTER — a list of uids standing in a named cell — so deleting
      // the presence doc alone would leave this account listed in a room
      // for up to one beat window after it asked to be erased. Read the
      // cell first, then drop the cached fold for it; the next caller
      // re-folds from presence, which no longer has this account in it.
      //
      // The mix cache next door needs no such sweep: it holds ranked type
      // NAMES and a count, nothing keyed by a uid.
      //
      // Best-effort, and now actually so. That sentence stood here with
      // nothing making it true: there is no inner try in this phase, so a
      // failed delete of one derived cache document pushed the whole phase
      // onto `failed` and refused the auth delete — exactly what the
      // sentence says must not happen. Reordering the clears BEFORE the
      // presence delete (below) would have made that worse, since the
      // source of truth would then survive the failure too.
      //
      // The catch is what the comment always claimed: the cache is
      // derived, it expires on its own within minutes, and losing one
      // sweep of it must not keep an account alive.
      // …and the same ordering rule, for the same reason: the room caches
      // are found through the presence document's own cell, so they are
      // cleared BEFORE it is deleted. Deleting first made the sweep
      // unrepeatable — a retry read no cell and could never find the
      // rosters again, leaving the erased uid listed in a room.
      const pres = await db.collection("v2_presence").doc(uid).get();
      const presCell = pres.get("cell");
      if (typeof presCell === "string" && presCell) {
        // NINE, not one. The cache is keyed by the CALLER's cell while its
        // roster is folded over that cell's whole 3x3 neighbourhood
        // (`roomFor(cells, own, qids)` in v2social.ts, where `cells =
        // presenceNeighbors(cell)` and `own = cell`). presenceNeighbors is
        // symmetric, so a phone standing in X is listed in
        // v2_presence_room/{C} for every C in neighbors(X) — and this
        // deleted X alone, leaving the erased uid in the roster a viewer
        // one cell over reads, for up to a beat window, while the comment
        // above said the window was closed.
        //
        // Nine deletes on a path that already does far more, and
        // presenceNeighbors returns fewer than nine near a pole, which is
        // the whole edge case handled by using it rather than deriving the
        // block here.
        const stale = presenceNeighbors(presCell);
        try {
          await Promise.all(
            (stale.length ? stale : [presCell])
              .map((c) => db.collection("v2_presence_room").doc(c).delete()),
          );
        } catch (err) {
          logger.warn("[deleteAccount] presence room cache sweep failed:", err);
        }
      }
      await db.collection("v2_presence").doc(uid).delete();
      // …and the queue's copy of the text, which the take's deletion does
      // not take with it. Must run AFTER the takes are gone — it identifies
      // its targets by their take being absent. See deleteOrphanedModQueue.
      counts.modQueueOrphans = await deleteOrphanedModQueue();
    } catch (err) {
      logger.error("[deleteAccount] takes/flags wipe failed:", err);
      failed.push("takesFlags");
    }

    // The photo's BYTES (D178) — the first thing this function has ever
    // had to remove from Storage, and its own phase so a bucket problem
    // reports as one instead of as a takes failure.
    //
    // It ABORTS like every other phase rather than being best-effort, and
    // that is deliberate: an orphaned photo of somebody who asked to be
    // deleted is exactly the leftover the abort exists to prevent. The
    // user stays signed in and retries; a stray image outliving its
    // account is not a thing to log and move past.
    //
    // `ignoreNotFound` because the common case by far is an account with
    // no photo, and a missing object is the outcome either way.
    try {
      await getStorage().bucket().file(`avatars/${uid}`)
        .delete({ ignoreNotFound: true });
    } catch (err) {
      logger.error("[deleteAccount] avatar object delete failed:", err);
      failed.push("avatarObject");
    }

    // The FOURTH place a reveal names this account, and the only one that
    // is not keyed by it.
    //
    // A pick day's vote snapshots WHO its index meant (D224), so another
    // member's entry reads `votes.{them}.pickUid = {uid}`. Deleting
    // `votes.{uid}`, `names.{uid}` and the `members` entry leaves that
    // one standing — and reveals are `allow read: if request.auth != null`
    // (firestore.rules, the /reveals/{day} match), so it is a pseudonymous
    // identifier of a deleted account in a document any signed-in user can
    // read. That is exactly the survivor the `members` comment below
    // refuses, one field over.
    //
    // Returns the update fields rather than writing, so both scrub phases
    // fold it into the batch they already have.
    const pickUidScrub = (
      snap: { get: (f: string) => unknown },
    ): Record<string, unknown> => {
      const votes = snap.get("votes");
      if (!votes || typeof votes !== "object") return {};
      const out: Record<string, unknown> = {};
      for (const [voter, v] of Object.entries(votes as Record<string, unknown>)) {
        if (voter === uid) continue; // that whole entry is deleted anyway
        if (v && typeof v === "object" && (v as { pickUid?: unknown }).pickUid === uid) {
          out[`votes.${voter}.pickUid`] = FieldValue.delete();
        }
      }
      return out;
    };

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
            // The join-time map revealGroupDay scopes reveals by. A uid here
            // is the same erasure leak as the two fields around it.
            [`memberJoinedAt.${uid}`]: FieldValue.delete(),
            // …and `ownerUid`, when it names the departing user. It is
            // stamped by createGroupV2 and read by NOTHING — a repo-wide
            // grep finds the one write and no reader — so dropping it is
            // behaviour-neutral, which is exactly why it was missed: the
            // two fields beside it are load-bearing and this one is inert.
            //
            // firestore.rules serves the whole group document to every
            // current member, so leaving it behind publishes a deleted
            // user's raw uid to everyone still in the circle and to anyone
            // they invite afterwards, indefinitely. That is the shape the
            // reveal scrub below already refuses ("a pseudonymous
            // identifier surviving an erasure request"), and
            // docs/data-inventory.md enumerates the survivors as a closed
            // set of three that this was not in.
            //
            // Deleted rather than reassigned to a surviving member: nothing
            // reads it, so inventing a new owner would be a fact this
            // codebase does not have a use for. If ownership ever acquires
            // one, that is the moment to choose a successor deliberately.
            ...(g.get("ownerUid") === uid ? { ownerUid: FieldValue.delete() } : {}),
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
        // The user's vote and display name inside every published reveal of
        // a group they are STILL in. Phase 1c-bis below sweeps reveals by
        // collection-group query and would reach all of these too — this
        // loop stays because it is the half that does not depend on the
        // reveal carrying a `members` snapshot. Reveals written before that
        // payload shipped have none (D5's backfill amendment: the set is
        // provably empty today, and that record asks for it to be
        // re-checked before seeding), and a query on `members` cannot see
        // them. Walking the subcollection can.
        //
        // The two phases compose rather than duplicate: this one removes
        // the uid from `members`, so anything it reaches no longer matches
        // 1c-bis's filter and is not visited twice.
        //
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
            // Whole documents are already in hand (this is a `.get()` page,
            // not a stream of refs), so ask each one whether it mentions
            // this user before spending a write on it. A group's reveals
            // run from the day it was created: every day before the user
            // joined, and every day they did not play, carried none of the
            // three fields below and bought a write that deleted nothing —
            // out of the ~7,300 documents the comment above prices for a
            // year-old account in 20 groups. The check costs no read.
            //
            // It also stops arrayRemove from CREATING `members: []` on a
            // reveal that never had the field, which the unconditional
            // update did on every such document.
            //
            // Nothing is left behind by skipping: a field the snapshot does
            // not carry is a field this update could not have deleted.
            const hasVote = r.get(new FieldPath("votes", uid)) !== undefined;
            const hasName = r.get(new FieldPath("names", uid)) !== undefined;
            const inMembers = Array.isArray(r.get("members")) && (r.get("members") as string[]).includes(uid);
            const picks = pickUidScrub(r);
            if (!hasVote && !hasName && !inMembers && !Object.keys(picks).length) continue;
            batch.update(r.ref, {
              ...picks,
              [`votes.${uid}`]: FieldValue.delete(),
              [`names.${uid}`]: FieldValue.delete(),
              // Scrubbing the vote and the name but leaving the uid here
              // left a pseudonymous identifier — and the group-day history
              // it implies — surviving an erasure request, in a document
              // `allow read: if request.auth != null` hands to any signed-in
              // user (firestore.rules, the /reveals/{day} match). That is
              // the same survivor pickUidScrub refuses one field over.
              //
              // This called `members` "the membership snapshot the reveal
              // read rule gates on … the rule tests `request.auth.uid in
              // members`" until 2026-08-31. It does not, and has not since
              // D98 removed the arm — the claim survived in two copies here
              // while the pickUidScrub comment above, written later, states
              // the rule correctly and points AT these. What the array is
              // now is an erasure index: phase 1c-bis's own collection-group
              // `array-contains` query is its only reader, which is why
              // removing the entry is safe to do while paging that query —
              // one pass, and a page already in hand.
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
      // …and the groups this account OWNS but is no longer in, which the
      // membership query above cannot see. Exactly the gap 1c-bis exists to
      // close for reveals, one field over: leaveGroupV2 removes a uid from
      // memberUids and memberNames and deliberately leaves `ownerUid`
      // standing (D45 — leaving is not an erasure request), so an account
      // that created a circle and later left it keeps its raw uid on a
      // document firestore.rules serves whole to every current member, and
      // to everyone they invite afterwards, forever.
      //
      // docs/data-inventory.md enumerates what survives an erasure as a
      // closed set of three, and web/privacy.html promises in writing that
      // "two things intentionally survive, and neither can identify you".
      // This was in neither list, which makes it a defect against a written
      // promise rather than a judgement call.
      //
      // Single-field equality, so no composite index is needed. It runs
      // AFTER the member loop deliberately: that loop deletes the field for
      // every group it touches, so those documents no longer match this
      // query and are not written twice. NOT_FOUND is tolerated for the
      // same reason it is above — a group deleted underneath us is the
      // outcome we wanted, and failing here would refuse the auth delete.
      const owned = await db.collection("v2_groups").where("ownerUid", "==", uid).get();
      for (const g of owned.docs) {
        try {
          await g.ref.update({ ownerUid: FieldValue.delete() });
        } catch (err) {
          if ((err as { code?: number | string }).code !== 5
            && (err as { code?: string }).code !== "not-found") throw err;
        }
      }
    } catch (err) {
      logger.error("[deleteAccount] v2 group scrub failed:", err);
      failed.push("v2Groups");
    }

    // 1c-bis. The same three fields, in reveals phase 1c cannot reach.
    //
    // 1c walks the groups the account is a MEMBER of. leaveGroupV2 removes a
    // uid from memberUids and memberNames and deliberately does not touch
    // reveals — a reveal is a shared record of a day several people played,
    // and leaving a group is not an erasure request, so rewriting the
    // others' history is not leaving's job (D45). The consequence was that
    // 1c's `array-contains uid` query could not see those groups at all, so
    // anyone who left a group before deleting their account left their name
    // and their votes in that group's reveals permanently — still readable
    // by the remaining members, because firestore.rules grants each uid
    // listed in `members`.
    //
    // So this phase asks the REVEALS instead, by collection-group query on
    // their own members snapshot: membership-independent by construction, so
    // it covers left groups and any future path that detaches a user from a
    // group without going through a callable. Requires a collection-group
    // index on reveals.members; see firestore.indexes.json, the same
    // dependency phases 3 and 4 below already carry.
    //
    // It does NOT replace 1c's loop, because the two miss different things:
    // a query on `members` cannot see a reveal that has no `members` (D5's
    // legacy set), and walking a subcollection cannot see a group you are no
    // longer in. Together they cover both, and they do not overlap — 1c
    // removes the uid from `members`, so what it reached no longer matches
    // the filter here.
    //
    // No cursor: the scrub REMOVES uid from `members`, which is the field
    // the query filters on, so each pass returns only what the previous pass
    // has not yet reached and the loop drains naturally.
    //
    // PASS_CAP is a runaway guard, NOT a bound on legitimate work, and the
    // number is chosen so those two cannot be confused. Hitting it means
    // writes are not landing — the query keeps returning docs the scrub
    // claims to have fixed — which has to be loud rather than an infinite
    // loop against the function timeout. Legitimate work is bounded well
    // below it: MEMBERSHIP_CAP is 20 groups × one reveal per day, so 500
    // passes is ~27 years of daily duels in every group at once. Sizing it
    // to "enough for a plausible account" instead would turn a long-lived
    // account's erasure into a job that fails identically forever, which is
    // the exact failure this phase's page size was chosen to avoid.
    //
    // Rotating WriteBatch rather than BulkWriter: BulkWriter swallows
    // per-write errors by default, which would trade a loud timeout for a
    // silent INCOMPLETE erasure — the worst possible outcome here. (The v1
    // aggregators this pattern was borrowed from are gone as of D13;
    // runSeedV2 in v2.ts is the remaining example.)
    try {
      const PAGE = 400;
      const PASS_CAP = 500;
      let scrubbed = 0;
      let pass = 0;
      for (; pass < PASS_CAP; pass++) {
        const page = await db.collectionGroup("reveals")
          .where("members", "array-contains", uid).limit(PAGE).get();
        if (page.empty) break;
        let batch = db.batch();
        let ops = 0;
        for (const r of page.docs) {
          batch.update(r.ref, {
            ...pickUidScrub(r),
            [`votes.${uid}`]: FieldValue.delete(),
            [`names.${uid}`]: FieldValue.delete(),
            // Same scrub, same reason as phase 1c above: a uid left in
            // `members` is a pseudonymous identifier of a deleted account
            // in a document any signed-in user can read. `members` is not
            // an access grant — the reveal read rule is
            // `allow read: if request.auth != null` — it is the index THIS
            // phase's `array-contains` query walks.
            members: FieldValue.arrayRemove(uid),
          });
          if (++ops >= 450) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }
        if (ops) await batch.commit();
        scrubbed += page.size;
      }
      if (pass >= PASS_CAP) {
        throw new Error(
          `reveal scrub did not drain in ${PASS_CAP} passes (${scrubbed} scrubbed) — writes are not landing`,
        );
      }

      // …AND THE REVEALS THAT NAME YOU WITHOUT LISTING YOU.
      //
      // The pass above walks `members`, which is membership at REVEAL
      // time. A pick answer copies the picked uid into
      // `votes.<voter>.pickUid`, validated against membership at ANSWER
      // time. Answer on a pick day, leave the circle before that night's
      // reveal, and the two disagree: the uid is in the document, in no
      // array the query above can see, and the document is readable by any
      // signed-in account. `web/privacy.html` says deletion removes "your
      // picks and name inside past group reveals".
      //
      // `pickedUids` is written by the reveal builder for exactly this,
      // and the uid is removed from it in the same write that clears the
      // pick — otherwise this loop would re-find the same page until
      // PASS_CAP and throw.
      for (pass = 0; pass < PASS_CAP; pass++) {
        const page = await db.collectionGroup("reveals")
          .where("pickedUids", "array-contains", uid).limit(PAGE).get();
        if (page.empty) break;
        let batch = db.batch();
        let ops = 0;
        for (const r of page.docs) {
          batch.update(r.ref, {
            ...pickUidScrub(r),
            pickedUids: FieldValue.arrayRemove(uid),
          });
          if (++ops >= 450) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }
        if (ops) await batch.commit();
        scrubbed += page.size;
      }
      if (pass >= PASS_CAP) {
        throw new Error(
          `pick scrub did not drain in ${PASS_CAP} passes (${scrubbed} scrubbed) — writes are not landing`,
        );
      }
      counts.reveals = scrubbed;
    } catch (err) {
      logger.error("[deleteAccount] v2 reveal scrub failed:", err);
      failed.push("v2Reveals");
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

    // 3b. Other users' FOLLOWS of this account (D101).
    //
    // The account's own follows go with its v2 subtree in 1b — these are
    // the other direction, documents living under someone else's uid that
    // name this one. Exactly the shape phase 4 handles for `relations`,
    // and it needs the same thing: a collection-group query cannot filter
    // on a document id, so the follow doc carries `to` as a field pinned
    // by the rules to equal its own id.
    //
    // Leaving them would not expose anything — the profile they point at
    // is gone — but it would leave every follower's Circle holding a
    // uid that resolves to nothing, and "erased" has to mean the
    // pointers too, not just the target.
    try {
      const followQuery = db
        .collectionGroup("following")
        .where("to", "==", uid);
      counts.othersFollows = await deleteQueryDocs(followQuery);
    } catch (err) {
      logger.error("[deleteAccount] inbound follows wipe failed:", err);
      failed.push("othersFollows");
    }

    // 3b. The handle registry (D122). `v2_handles/{handle}` is keyed by
    //     the NAME, not the uid, so recursiveDelete of v2_users/{uid} in
    //     phase 1b does not reach it — and leaving it behind is wrong
    //     twice over: the document holds this uid, and the name stays
    //     unclaimable by anyone, forever, for an account that no longer
    //     exists.
    //
    //     Read from the profile before phase 1b deletes it? No — the
    //     profile is already gone by here, so this queries the registry
    //     by uid instead. One equality read on a collection nobody else
    //     writes; a stale handle is worth more than the index saved.
    try {
      const handleQuery = db.collection("v2_handles").where("uid", "==", uid);
      counts.handle = await deleteQueryDocs(handleQuery);
    } catch (err) {
      logger.error("[deleteAccount] handle release failed:", err);
      failed.push("handle");
    }

    // 3c-bis. Pending join requests in circles this account never joined
    //     (D240). `pending` and `pendingNames` live ON the group document,
    //     so phase 1c misses them entirely — that phase matches on
    //     `memberUids`, and the whole point of a pending request is that
    //     the asker is not in that array. The name is the leak: an erased
    //     account would sit in a stranger's circle, by name, waiting to
    //     be approved.
    //
    //     `array-contains` on a single field, so Firestore indexes it
    //     automatically and this needs no index entry.
    try {
      const waiting = await db.collection("v2_groups")
        .where("pending", "array-contains", uid).get();
      for (const g of waiting.docs) {
        await g.ref.update({
          pending: FieldValue.arrayRemove(uid),
          [`pendingNames.${uid}`]: FieldValue.delete(),
        });
      }
      counts.pendingJoins = waiting.size;
    } catch (err) {
      logger.error("[deleteAccount] pending-join wipe failed:", err);
      failed.push("pendingJoins");
    }

    // 3d. The people directory (D239). Keyed by uid but a TOP-LEVEL
    //     document, so phase 1b's recursiveDelete of v2_users/{uid} walks
    //     straight past it — the same trap 3b describes for the handle
    //     registry, and worse if missed: the row holds a name, so leaving
    //     it means an erased account stays findable by the search this
    //     feature exists to provide.
    try {
      await db.doc(`v2_people/${uid}`).delete();
      counts.peopleRow = 1;
    } catch (err) {
      logger.error("[deleteAccount] people directory wipe failed:", err);
      failed.push("peopleRow");
    }

    // 3c. Circle invitations, BOTH directions (D122) — the same shape as
    //     the inbound follows above, and the same reason it is not
    //     covered by phase 1b: these documents live under someone else's
    //     group.
    //
    //     `to == uid` is this account's unanswered inbox, sitting in
    //     other people's circles. `from == uid` is the harder half: an
    //     invitation this account SENT carries its display name, so
    //     leaving it means an erased user's name stays in a stranger's
    //     inbox until they happen to decline it.
    try {
      counts.invitesTo = await deleteQueryDocs(
        db.collectionGroup("invites").where("to", "==", uid),
      );
    } catch (err) {
      logger.error("[deleteAccount] inbound invites wipe failed:", err);
      failed.push("invitesTo");
    }
    try {
      counts.invitesFrom = await deleteQueryDocs(
        db.collectionGroup("invites").where("from", "==", uid),
      );
    } catch (err) {
      logger.error("[deleteAccount] outbound invites wipe failed:", err);
      failed.push("invitesFrom");
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
      // D122's invitation budget, keyed the same way. Added with the
      // callable rather than after someone noticed the ledger surviving
      // an erasure.
      await db.collection("v2_ratelimits").doc(`invite_${uid}`).delete();
      // The suggestion budget (suggestions.ts), same pattern and same
      // reasoning: added with the callable, not after an audit.
      await db.collection("v2_ratelimits").doc(`suggest_${uid}`).delete();
      // The paid-booking budget (paid.ts, D313), same pattern again.
      await db.collection("v2_ratelimits").doc(`paidbook_${uid}`).delete();
    } catch (err) {
      logger.error("[deleteAccount] rate-limit ledger wipe failed:", err);
      failed.push("ratelimits");
    }

    // 4d. This account's question suggestions (docs/NEXT-FUNCTIONALITY.md
    //     §6). The author is the only client who can read them, but each
    //     row carries the uid and free text — erasure covers them the way
    //     it covers takes. A suggestion already promoted into a bank
    //     survives as the QUESTION (content, carrying a provenance
    //     vintage, never a name); the suggestion ROW still goes.
    try {
      counts.suggestions = await deleteQueryDocs(
        db.collection("v2_suggestions").where("uid", "==", uid),
      );
    } catch (err) {
      logger.error("[deleteAccount] suggestions wipe failed:", err);
      failed.push("suggestions");
    }

    // 4e. This account's paid purchase records (PAID-PLAN §7, D288 §3).
    //     Uid-keyed like everything else the sweep covers; the business
    //     record of a sale lives with the payment processor (Stripe since
    //     D313; the hand contract before it), off-app, and the bought
    //     QUESTION survives as content the way a promoted suggestion
    //     does — the purchase ROW still goes, and the next pricing.json
    //     rebuild folds a ledger that no longer names this account.
    try {
      // THE AD FIRST, BECAUSE THE ROW IS THE ONLY POINTER AT IT.
      //
      // A bought ad (D315) lives in `v2_ads/paidad-{bid}` and is deleted
      // by exactly one thing: `closePaidCampaignsV2`, which reads `adId`
      // off the RUNNING PURCHASE ROW. `runSeedAds` was taught to skip
      // `paidad-` ids, so nothing else touches it. Delete the row first
      // and the ad becomes immortal — in a collection whose committed
      // half is empty, so every production ad is one of these, and which
      // every session downloads whole under an unordered cap. That is the
      // accumulation the closer's own delete comment says it exists to
      // prevent, reached by the one path the closer cannot cover: the
      // buyer erasing their account mid-campaign.
      //
      // Read before the sweep rather than deleting from the snapshot:
      // deleteQueryDocs owns the paging, and a purchase list is bounded by
      // what one account bought.
      const bought = await db.collection("v2_purchases").where("uid", "==", uid).get();
      const adIds = bought.docs
        .map((d) => String(d.get("adId") ?? ""))
        .filter((id) => id.length > 0);
      for (const adId of adIds) {
        await db.collection("v2_ads").doc(adId).delete();
      }
      counts.paidAds = adIds.length;
      // …AND THE BYLINE OFF THE BOUGHT QUESTION, for the same reason one
      // line up: the row is the only pointer at it.
      //
      // The question itself survives — that is the decision this phase's
      // header records, and it is not being reversed here. But a bought
      // question carries `sponsor.buyer` (the buyer's DISPLAY NAME, read
      // off their profile at booking) and `sponsor.audience` (their dims;
      // for a city-scoped ask that is the city set on their profile), in
      // a document any signed-in user can read and nothing ever deletes.
      // After erasure no pointer to it exists at all, so it is permanent
      // and unreachable.
      //
      // The asymmetry was the tell: the paid AD is deleted here, while
      // the paid QUESTION — the one actually carrying the person's name —
      // was not. The header says a bought question survives "the way a
      // promoted suggestion does", and a promoted suggestion is content
      // carrying a vintage, never a byline. This makes that true.
      //
      // `sponsor` itself stays (the PAID band renders from its presence),
      // emptied rather than removed. A booking that never went live has
      // no question document, so a missing one is nothing to strip rather
      // than a failure — anything else and one abandoned booking would
      // make the account undeletable.
      const boughtQids = bought.docs
        .map((d) => String(d.get("qid") ?? ""))
        .filter((id) => id.length > 0);
      let stripped = 0;
      for (const qid of boughtQids) {
        try {
          await db.collection("v2_questions").doc(qid).update({
            "sponsor.buyer": FieldValue.delete(),
            "sponsor.audience": FieldValue.delete(),
          });
          stripped += 1;
        } catch (err) {
          // NOT_FOUND (5) is the abandoned-booking case above.
          if ((err as { code?: number }).code !== 5) throw err;
        }
      }
      counts.paidQuestionBylines = stripped;

      // A RUNNING campaign's row is the only pointer at the money it owes
      // back, and this sweep is about to delete it.
      //
      // closePaidCampaignsV2 finds its work with
      // `where("state","==","running")` on this same collection, and that
      // query is the ONLY thing in the system that pays a refund. So a
      // buyer who erases their account mid-window had the unserved part of
      // their budget — up to capEur — written off in silence: no refund,
      // no line anywhere, and the payment intent gone with the row.
      //
      // Recorded rather than refunded, deliberately. A Stripe call on the
      // erasure path is a network round trip inside an operation that must
      // finish: a hang or a 500 there would leave an account half-deleted,
      // which is a worse failure than a debt an operator settles. This is
      // the same posture the closer already takes when it meets a purchase
      // with no payment path — same metric, same arithmetic, so the two
      // land in one place.
      //
      // In its own try/catch because nothing here may block the sweep
      // below: recording a debt is strictly better than the silence, and
      // strictly worse than the erasure completing.
      try {
        const today = new Date().toISOString().slice(0, 10);
        for (const d of bought.docs) {
          if (String(d.get("state") ?? "") !== "running") continue;
          if (String(d.get("kind") ?? "question") !== "question") continue;
          const until = String((d.get("window") as { until?: string })?.until ?? "");
          const budget = (d.get("budget") as {
            cap: number; capEur: number; ratePerAnswer: number;
          }) ?? { cap: 0, capEur: 0, ratePerAnswer: 0 };
          const qid = String(d.get("qid") ?? "");
          let answers = 0;
          if (qid) {
            const agg = await db.collection("v2_question_aggs").doc(qid).get();
            const c = (agg.exists ? agg.get("counts") : null) as Record<string, number> | null;
            if (c) answers = Object.values(c).reduce((a, b) => a + (b || 0), 0);
          }
          const refundEur = refundEurFor(
            budget.cap, budget.capEur, budget.ratePerAnswer, answers,
          );
          if (refundEur <= 0) continue;
          logger.warn(
            `[deleteAccount] ${d.id} erased while running, owing €${refundEur} — settle off-app`,
            {
              metric: "paid_refund_offapp",
              paymentIntent: String(d.get("stripePaymentIntent") ?? ""),
              qid, answers, until, today,
            },
          );
        }
      } catch (err) {
        logger.error("[deleteAccount] running-campaign debt not recorded:", err);
      }

      counts.purchases = await deleteQueryDocs(
        db.collection("v2_purchases").where("uid", "==", uid),
      );
    } catch (err) {
      logger.error("[deleteAccount] purchases wipe failed:", err);
      failed.push("purchases");
    }

    // 4f. This account's paid-question bookings (paid.ts, D313). The
    //     pre-payment half of a sale: prompt, audience, the review's
    //     verdict and note — free text under a uid, covered the way the
    //     suggestions are. A booking that went LIVE already left its
    //     durable halves elsewhere (the purchase row, erased above with
    //     this account; the question doc, which survives as content).
    try {
      counts.paidBookings = await deleteQueryDocs(
        db.collection("v2_paid_bookings").where("uid", "==", uid),
      );
    } catch (err) {
      logger.error("[deleteAccount] paid-booking wipe failed:", err);
      failed.push("paidBookings");
    }

    // 4z. SWEEP THE SUBTREE AGAIN, because the phases above take time and
    //     a nightly fold can commit inside it.
    //
    //     Phase 1a removes what those folds read, so a fold starting
    //     after it writes nothing — but one already mid-run has its rows
    //     in hand, and a per-uid document it commits between 1b and here
    //     would otherwise be permanent: the auth user is about to go, and
    //     this function can never run for that uid again.
    //
    //     Ordinarily this deletes nothing and costs one empty recursive
    //     delete. The failure it exists for is rare and silent, which is
    //     the combination that earns a cheap second pass.
    //
    //     STILL NOT AIRTIGHT, and saying so is the point: a fold that
    //     read the ledger before 1a and commits after this line leaves a
    //     document nothing will remove. Closing that needs a tombstone
    //     the folds consult — which is a uid-keyed record that outlives
    //     the account, so it is a decision rather than a patch. On the
    //     night list.
    try {
      await db.recursiveDelete(db.collection("v2_users").doc(uid));
    } catch (err) {
      logger.error("[deleteAccount] closing v2 subtree sweep failed:", err);
      failed.push("v2SubtreeSweep");
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
export { seedContentV2, onV2AnswerCreated, onV2AnswerUpdated } from "./v2";
export {
  acceptGroupInviteV2,
  claimHandleV2,
  createGroupV2,
  declineGroupInviteV2,
  inviteToGroupV2,
  // joinGroupV2 is the DEPRECATED ALIAS (D240) — same implementation
  // as requestJoinV2, kept exported so builds already installed keep
  // working and start asking to join instead of admitting themselves.
  joinGroupV2,
  requestJoinV2,
  approveJoinV2,
  declineJoinV2,
  leaveGroupV2,
  nearbyCountV2,
  nearbyRoomV2,
  registerPushToken,
  scheduledDuelReveals,
  revealDuelsNowV2,
} from "./v2social";
export { buildModQueue, buildModQueueNow, fetchModQueue, submitModVerdict } from "./moderation";
// D29: the silent per-device activation gate (docs/DEVICE-BIND.md).
export { activateDeviceV2 } from "./deviceBind";
// D54: the daily ledger velocity scan — detection for D28's correction
// story. Logs flags for manual review; never denies a vote.
export { ledgerVelocityScan } from "./velocity";
export { logicStartV2, logicSubmitV2 } from "./logic";
// D194: Foresight CALL, tier A — the daily pass that grades a sealed
// prediction against our OWN published aggregate and publishes the numbers
// it read. No model, no fetch, no judgement anywhere in that path.
export { resolveCallsV2 } from "./calls";
// v28 §2 (trial per D166 §1): the nightly Patterns fit — per-question
// loading vectors from the vote log, core corpus only (D161). The fold
// that has to exist before the Patterns tab may ship (D167).
export { fitPatternsV2 } from "./patterns";
// D316: the nightly published serving order — per-topic question order
// (volume, landslides sunk) onto v2_rank/{feed,learn}, the spine the
// paged read path fetches against. Global signal only; no uid enters
// the fold (D163/D317's line).
export { rankBankV2 } from "./rank";
// D317 phase 1 (D322): the per-person interest profile — feed answers
// counted by topic, nightly, onto v2_users/{uid}/taste/profile. Derived
// from answers alone (public by D98); the pager sizes topic pages by it
// and nothing else reads it.
export { fitTasteV2 } from "./taste";
// R1/D268: the nightly engagement digest — anonymous population counts
// (actives, retention returns, answers by surface) folded from the same
// ledger, one public day doc per UTC day. The rung-0 half of
// docs/ENGAGEMENT-PLAN.md; nothing per-person leaves it.
export { digestEngagementV2 } from "./engagement";
// "Suggest a question" — the community board's write path and the
// operator review instruments (docs/NEXT-FUNCTIONALITY.md §6).
export { suggestQuestionV2, fetchSuggestionsV2, reviewSuggestionV2 } from "./suggestions";
// The self-serve paid-question loop (D313): book → automated review →
// Stripe checkout → the webhook writes the purchase and the live
// question → the closer refunds what the window did not deliver.
export {
  bookPaidQuestionV2, onPaidBookingCreated, sweepPaidReviewsV2,
  createPaidCheckoutV2, stripeWebhookV2, closePaidCampaignsV2,
} from "./paid";
// D290: the replay tool — rebuild a question's aggregate from the answers
// that made it. The operator half of "answers are the source of truth,
// aggregates are disposable projections": D28's correction runbook could
// only ever repair `counts` (the ledger carries no anchors) and only for
// LEDGER_RETENTION_DAYS. This repairs the breakdown too, at any age, and
// is the safety net every later projection change rests on.
export { rebuildAggregateV2 } from "./replay";
// D379: the shareable results page — a public web page per sponsored
// question at the hosting rewrite /q/{qid}, rendered here on the admin
// SDK off the two public documents. onRequest, and no App Check, because
// it serves the open web; the reasoning is share.ts's header.
export { resultsPageV2 } from "./share";
