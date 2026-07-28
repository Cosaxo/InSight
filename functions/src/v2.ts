// InSight v2 backend — the daily/mirror core loop.
//
//   seedContentV2       mirrors /content question banks into v2_questions.
//                       Gated: emulator, or an operator uid listed in the
//                       SEED_ADMIN_UIDS env var — with anonymous-first auth
//                       (D3), "any signed-in user" would mean "anyone".
//   onV2AnswerCreated   folds each answer into v2_aggs_private/{qid} and
//                       mirrors a PUBLIC copy to v2_question_aggs/{qid}
//                       only once total >= AGG_MIN_N — a k-floor so a
//                       reader can never recover an individual's answer
//                       from a tiny cohort (same principle as the geo
//                       aggregates' K_ANON_FLOOR). Idempotent via an
//                       event ledger, so at-least-once delivery and
//                       retry-on-failure cannot double-count.
//
// Schema and access decisions: docs/SCHEMA-V2.md, docs/DECISIONS.md (D5).

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { assertOperator } from "./ops";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { V2_QUESTIONS } from "./v2content";
import {
  foldAnchors,
  publishableBreakdown,
  shouldPublishAgg,
  type BreakdownCounts,
} from "./pure";

const REGION = "us-central1";

// Public counts appear only at or above this many answers. Raise as the
// userbase grows; the private doc keeps exact counts either way.
export const AGG_MIN_N = 5;

// Public-mirror write cadence: one publish per this many answers, at every
// size. Two jobs, and it took both to settle the number.
//
// Disclosure (the reason it is uniform): clients hold an onSnapshot on the
// public doc, so rewriting per answer streams one attributable vote per
// step. Batching means each observed delta aggregates PUBLISH_EVERY votes —
// the same k the floor uses, applied to the increment. shouldPublishAgg()
// in pure.ts carries the full argument and the residual.
//
// Contention (D7): both docs in the trigger's transaction are keyed by qid,
// and Firestore sustains ~1 write/sec/document. Publishing every 5th cuts
// writes to pubRef by ~80% at any volume.
//
// It used to be every answer below 50 and every 5th above, on the reasoning
// that a small question has no contention to relieve and an inexact count
// there is visible. True, and beside the point: the small-question case is
// exactly where a per-answer stream is most attributable, because there are
// few enough voters to guess among.
const PUBLISH_EVERY = 5;

// ── content seed ────────────────────────────────────────────────

async function runSeedV2(): Promise<{ written: number }> {
  const db = getFirestore();
  const refs = V2_QUESTIONS.map((q) => db.collection("v2_questions").doc(q.id));
  // `active` is the operational kill switch — the seed must never flip a
  // question ops disabled back on, so it is only written on first create.
  const existing = new Set(
    (await db.getAll(...refs)).filter((s) => s.exists).map((s) => s.id),
  );
  let batch = db.batch();
  let inBatch = 0;
  for (let i = 0; i < V2_QUESTIONS.length; i++) {
    const q = V2_QUESTIONS[i];
    const payload: Record<string, unknown> = {
      surface: q.surface,
      seq: q.seq,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      topic: q.topic,
      axis: q.axis,
      test: q.test,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!existing.has(q.id)) payload.active = true;
    batch.set(refs[i], payload, { merge: true });
    // Firestore batches cap at 500 ops.
    if (++inBatch === 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  // Bump the content revision — clients cache the question bank locally
  // and refetch only when this changes (one meta read per boot instead
  // of ~190 bank reads).
  await db.collection("v2_meta").doc("app").set(
    { contentRev: FieldValue.serverTimestamp() },
    { merge: true },
  );
  logger.info(`[v2] seeded ${V2_QUESTIONS.length} questions (${existing.size} pre-existing)`);
  return { written: V2_QUESTIONS.length };
}

export const seedContentV2 = onCall({ region: REGION }, async (request) => {
  assertOperator(request);
  return runSeedV2();
});

// ── answer → aggregate ──────────────────────────────────────────

export const onV2AnswerCreated = onDocumentCreated(
  { region: REGION, document: "v2_users/{uid}/answers/{qid}", retry: true },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    // Group/duo answers are sealed duel material — they surface through
    // materialized reveals (v2social), never through world aggregates.
    // A late duel answer must REOPEN its day for the reveal scan: the
    // scan's lastCheckedDay skip-marker would otherwise close the day
    // forever while rules still accepted the answer. This == check is
    // race-free only because the scan writes the marker inside a
    // transaction that re-reads the answers (see revealGroupDay): our
    // answer either got counted there, or committed after the marker —
    // so the read below is guaranteed to see lastCheckedDay === day.
    const surface = snap.get("surface");
    if (surface === "group" || surface === "duo") {
      const gid = snap.get("gid");
      const day = snap.get("day");
      if (typeof gid === "string" && typeof day === "string") {
        try {
          const gref = getFirestore().collection("v2_groups").doc(gid);
          const g = await gref.get();
          if (g.exists && g.get("lastCheckedDay") === day) {
            await gref.update({ lastCheckedDay: FieldValue.delete() });
          }
        } catch (err) {
          logger.warn(`[v2] reopen-day failed for ${gid}/${day}:`, err);
        }
      }
      return;
    }
    const qid = event.params.qid;
    const optionIdx = snap.get("optionIdx");
    if (typeof optionIdx !== "number" || optionIdx < 0 || optionIdx > 19) {
      logger.warn(`[v2] answer ${event.params.uid}/${qid} has no usable index`);
      return; // malformed can't pass rules; don't retry-loop on it
    }
    const db = getFirestore();
    const eventRef = db.collection("v2_agg_events").doc(event.id);
    const privRef = db.collection("v2_aggs_private").doc(qid);
    const pubRef = db.collection("v2_question_aggs").doc(qid);
    await db.runTransaction(async (tx) => {
      // Idempotency: Eventarc is at-least-once and retry is on — the
      // ledger makes redelivery a no-op instead of a double count.
      const seen = await tx.get(eventRef);
      if (seen.exists) return;
      const priv = await tx.get(privRef);
      const counts: Record<string, number> =
        (priv.exists && (priv.get("counts") as Record<string, number>)) || {};
      counts[String(optionIdx)] = (counts[String(optionIdx)] || 0) + 1;
      const total = ((priv.exists && (priv.get("total") as number)) || 0) + 1;
      // Per-anchor breakdown, in the SAME document as the plain counts.
      // Deliberately not new per-dimension docs: this transaction already
      // writes privRef, so folding the slices in costs no extra document
      // and D7's ~1-write/sec-per-document ceiling is unchanged.
      //
      // Answers written before any anchors are collected simply carry
      // `anchors: {}` and fold to nothing, so this is inert until there is
      // something to slice by — see D8.
      const by: BreakdownCounts =
        (priv.exists && (priv.get("by") as BreakdownCounts)) || {};
      foldAnchors(by, snap.get("anchors"), optionIdx);
      // expireAt powers a Firestore TTL policy (see SHIP-CHECKLIST) —
      // dedup only matters within the ~7-day retry window, so the
      // ledger must not grow forever.
      tx.set(eventRef, {
        qid,
        at: FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 7 * 86400000),
      });
      tx.set(privRef, { counts, total, by }, { merge: false });
      // The public mirror: k-floored, and deliberately without a fresh
      // timestamp — per-vote timing deltas shouldn't be attributable.
      //
      // Not written on every answer. The cadence is one publish per
      // PUBLISH_EVERY answers at ANY size — see the constant above and
      // shouldPublishAgg() in pure.ts. Two independent reasons land on the
      // same rule: an observer of this document's history must not be able
      // to attribute a step to one person, and both docs in this
      // transaction are single documents keyed by qid against Firestore's
      // ~1 write/sec/document (D7 records that arithmetic).
      //
      // Sharding is the real fix for the write ceiling and is deliberately
      // NOT done here. privRef always holds the exact running total, so
      // nothing is lost; the public mirror lags by at most
      // PUBLISH_EVERY - 1 answers.
      if (total >= AGG_MIN_N) {
        if (shouldPublishAgg(total, AGG_MIN_N, PUBLISH_EVERY)) {
          // The breakdown carries its OWN floor, per cell, plus
          // complementary suppression (pure.ts). A question past the
          // overall floor still shows no slice until that slice can be
          // shown without singling anyone out.
          const byPub = publishableBreakdown(by, AGG_MIN_N);
          tx.set(pubRef, { counts, total, tooSmall: false, by: byPub }, { merge: false });
        }
      } else {
        tx.set(pubRef, { tooSmall: true }, { merge: false });
      }
    });
  },
);
