// insight-functions/index.ts — server-side compute for InSight.
//
// Current scope: rebuildAreaAggregates. Walks every discoverable
// user, joins their Big Five from the user profile, buckets by
// geohash5 (≈ 5 km × 5 km), and writes per-cell averages to the
// aggregates_by_geohash5 collection. K-anonymity enforced — cells
// with fewer than K_ANON_FLOOR contributors are skipped (existing
// docs for those cells get deleted so we don't leak old aggregates
// as the cell drops below the floor).
//
// Privacy contract per included user:
//   - present in `insight_discoverable` (they've opted into being
//     a discoverable point — that's the trigger for inclusion).
//   - profile.personality is a 5-length number array (Big Five
//     test taken).
//   - profile.sharePrefs?.big5 isn't explicitly "nobody" (default
//     "circle" means included; "world" obviously included; "city"
//     included; only "nobody" excluded).
//
// Two callable surfaces:
//   - rebuildAreaAggregates: HTTPS-callable for manual triggers /
//     dev runs.
//   - scheduledAreaAggregates: scheduled every 6 hours.

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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

