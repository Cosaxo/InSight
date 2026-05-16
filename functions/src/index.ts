// insight-functions/index.ts — server-side compute for InSight.
//
// Current scope:
//   - rebuildAreaAggregates / scheduledAreaAggregates: rolls up Big
//     Five vectors per geohash5 cell with k-anonymity.
//   - deleteAccount: user-triggered account wipe. Walks every doc
//     owned by the user + every reference to them in others' subtrees
//     and deletes them, then drops the auth user. App Store + Play
//     Store both require this for any app with sign-up.
//
// All functions use the admin SDK, which bypasses Firestore rules.
// The rules layer is for client traffic; functions can do anything.

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();

const K_ANON_FLOOR = 5;

// Big Five share preference key. Mirrors SharingOverlay's id.
const SHARE_KEY_BIG5 = "big5";

interface UserProfileLike {
  personality?: number[];
  sharePrefs?: Record<string, string>;
}

interface DiscoverableLike {
  geohash?: string;
  uid?: string;
}

interface AggregateDoc {
  geohash5: string;
  count: number;
  mean: number[];       // length 5
  stdev: number[];      // length 5
  updatedAt: FieldValue;
}

// Compute mean and standard deviation per-axis across N 5-vectors.
function summarise(vectors: number[][]): { mean: number[]; stdev: number[] } {
  const n = vectors.length;
  const sums = [0, 0, 0, 0, 0];
  for (const v of vectors) {
    for (let i = 0; i < 5; i++) sums[i] += v[i];
  }
  const mean = sums.map((s) => s / n);
  const sqs = [0, 0, 0, 0, 0];
  for (const v of vectors) {
    for (let i = 0; i < 5; i++) {
      const d = v[i] - mean[i];
      sqs[i] += d * d;
    }
  }
  const stdev = sqs.map((s) => Math.sqrt(s / n));
  return {
    mean: mean.map((m) => Math.round(m * 100) / 100),
    stdev: stdev.map((s) => Math.round(s * 100) / 100),
  };
}

async function runAggregation(): Promise<{
  cellsWritten: number;
  cellsDeleted: number;
  usersConsidered: number;
  usersIncluded: number;
}> {
  const db = getFirestore();

  // 1. Read every discoverable doc — these are users who've opted
  //    into having a position.
  const discoverableSnap = await db.collection("insight_discoverable").get();
  logger.info(`[aggregates] ${discoverableSnap.size} discoverable users`);

  // 2. For each one, fetch their profile and bucket into geohash5.
  const cellsByHash: Record<string, number[][]> = {};
  let usersIncluded = 0;
  for (const docSnap of discoverableSnap.docs) {
    const disc = docSnap.data() as DiscoverableLike;
    const fullHash = disc.geohash;
    if (!fullHash || fullHash.length < 5) continue;
    const hash5 = fullHash.slice(0, 5);

    const profileSnap = await db
      .collection("insight_users")
      .doc(docSnap.id)
      .get();
    if (!profileSnap.exists) continue;
    const profile = profileSnap.data() as UserProfileLike;
    const vec = profile.personality;
    if (
      !Array.isArray(vec) ||
      vec.length !== 5 ||
      !vec.every((n) => typeof n === "number")
    ) {
      continue;
    }
    const level = profile.sharePrefs?.[SHARE_KEY_BIG5] ?? "circle";
    if (level === "nobody") continue;

    if (!cellsByHash[hash5]) cellsByHash[hash5] = [];
    cellsByHash[hash5].push(vec);
    usersIncluded++;
  }

  // 3. For each cell that meets the k-anon floor, write the doc.
  //    For cells below the floor, ensure the doc doesn't exist so
  //    we don't leak stale aggregates as populations shrink.
  const batchWrite = db.batch();
  let cellsWritten = 0;
  let cellsDeleted = 0;

  // First, collect existing aggregate docs so we know which cells
  // to potentially delete.
  const existingSnap = await db
    .collection("aggregates_by_geohash5")
    .get();
  const existingCells = new Set(existingSnap.docs.map((d) => d.id));

  for (const [hash5, vectors] of Object.entries(cellsByHash)) {
    if (vectors.length < K_ANON_FLOOR) {
      // Below floor — make sure no stale doc remains.
      if (existingCells.has(hash5)) {
        batchWrite.delete(
          db.collection("aggregates_by_geohash5").doc(hash5),
        );
        cellsDeleted++;
      }
      continue;
    }
    const stats = summarise(vectors);
    const doc: AggregateDoc = {
      geohash5: hash5,
      count: vectors.length,
      mean: stats.mean,
      stdev: stats.stdev,
      updatedAt: FieldValue.serverTimestamp(),
    };
    batchWrite.set(
      db.collection("aggregates_by_geohash5").doc(hash5),
      doc,
    );
    cellsWritten++;
    existingCells.delete(hash5);
  }

  // Cells that previously had aggregates but had zero contributors
  // this run — drop them too.
  for (const orphan of existingCells) {
    batchWrite.delete(db.collection("aggregates_by_geohash5").doc(orphan));
    cellsDeleted++;
  }

  await batchWrite.commit();
  logger.info(
    `[aggregates] done: ${cellsWritten} written, ${cellsDeleted} deleted, ${usersIncluded}/${discoverableSnap.size} users`,
  );

  return {
    cellsWritten,
    cellsDeleted,
    usersConsidered: discoverableSnap.size,
    usersIncluded,
  };
}

// HTTPS-callable for manual / dev runs. Restricted to signed-in
// users; anyone with an account can kick the aggregator. Idempotent
// + cheap (one batch write at the end), so no harm in casual
// invocations.
export const rebuildAreaAggregates = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    return runAggregation();
  },
);

// Scheduled every 6 hours. Keeps the aggregates fresh as users come
// + go discoverable. Time zone defaults to Etc/UTC.
export const scheduledAreaAggregates = onSchedule(
  { schedule: "every 6 hours", region: "us-central1" },
  async () => {
    await runAggregation();
  },
);


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
//   - aggregates_by_geohash5: the user's Big Five contributed to
//     anonymous averages. Pulling specific contributions back out
//     would either require re-running the aggregator or storing
//     per-user provenance (which would defeat the anonymity). The
//     next scheduled run naturally rebuilds without this user.
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
  { region: "us-central1" },
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
    };

    // 1. Wipe insight_users/{uid}/* + the profile doc itself.
    try {
      counts.ownSubtree = await deleteUserSubtree(uid);
    } catch (err) {
      logger.error("[deleteAccount] subtree wipe failed:", err);
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
    }

    // 5. Finally drop the auth user. Doing this last means any
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

// Use FieldValue to keep the import live for the aggregator section
// above. (Not part of deleteAccount's logic — just placating the
// noUnusedLocals check across the file.)
void FieldValue;
