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

const REGION = "us-central1";

// Public counts appear only at or above this many answers. Raise as the
// userbase grows; the private doc keeps exact counts either way.
export const AGG_MIN_N = 5;

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
    // forever while rules still accepted the answer.
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
      // expireAt powers a Firestore TTL policy (see SHIP-CHECKLIST) —
      // dedup only matters within the ~7-day retry window, so the
      // ledger must not grow forever.
      tx.set(eventRef, {
        qid,
        at: FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 7 * 86400000),
      });
      tx.set(privRef, { counts, total }, { merge: false });
      // The public mirror: k-floored, and deliberately without a fresh
      // timestamp — per-vote timing deltas shouldn't be attributable.
      if (total >= AGG_MIN_N) {
        tx.set(pubRef, { counts, total, tooSmall: false }, { merge: false });
      } else {
        tx.set(pubRef, { tooSmall: true }, { merge: false });
      }
    });
  },
);
