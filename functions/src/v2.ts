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
import { assertOperator, HOT_TRIGGER } from "./ops";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { V2_QUESTIONS } from "./v2content";
import {
  canonBreakdownFor,
  catalogEntityKey,
  foldAnchors,
  foldCanonAnchors,
  publishableBreakdown,
  publishableCanon,
  shouldPublishAgg,
  type BreakdownCounts,
  type CanonCounts,
  type CatalogSpec,
} from "./pure";
import { FILM_KEYS, ARTIST_KEYS } from "./catalogKeys";

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

// Catalog questions (docs/CATALOG-QUESTIONS.md): the reveal's leaderboard
// cap, and the per-domain key spaces. CATALOG_MAX_ENTITY must equal the
// species count in public/pokedex.txt — scripts/check-pokedex.mjs
// cross-checks this line against the committed catalogue, so regenerating
// a grown catalogue fails CI until this number moves with it. The QID
// domains carry generated key sets instead (catalogKeys.ts, agreement
// enforced by scripts/check-catalogs.mjs); while a set is empty its
// domain simply never aggregates — fail-safe until the catalogue is
// generated and committed (D15).
const CANON_TOP_N = 10;
export const CATALOG_MAX_ENTITY = 1025;
const CATALOG_DOMAINS: Record<string, CatalogSpec> = {
  pokemon: { max: CATALOG_MAX_ENTITY },
  films: { keys: FILM_KEYS },
  artists: { keys: ARTIST_KEYS },
};

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
  { ...HOT_TRIGGER, region: REGION, document: "v2_users/{uid}/answers/{qid}", retry: true },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    // Group/duo answers are sealed duel material — they surface through
    // materialized reveals (v2social), never through world aggregates.
    //
    // What this write is for: it flags the group's day as owing a reveal, so
    // the scheduled scan can ask an INDEXED question ("which groups played
    // yesterday?") instead of reading every group document to find the few
    // that did. See prunePendingDays in pure.ts for the field's contract.
    //
    // It also replaces the `lastCheckedDay` skip-marker this branch used to
    // compensate for. That was a read, a value comparison and a conditional
    // delete whose correctness rested on a specific commit ordering between
    // this trigger and the scan. arrayUnion needs none of it: a late answer
    // re-adds its day unconditionally, so the day re-opens whatever order
    // the two writers land in, and the scan's own transaction settles it.
    // One blind write, no read, and one less race to reason about.
    const surface = snap.get("surface");
    if (surface === "group" || surface === "duo") {
      const gid = snap.get("gid");
      const day = snap.get("day");
      if (typeof gid === "string" && typeof day === "string") {
        try {
          const gref = getFirestore().collection("v2_groups").doc(gid);
          // update(), not set(merge): a group deleted between the answer and
          // this trigger must stay deleted, and set() would resurrect it as a
          // doc holding nothing but pendingDays. NOT_FOUND is the expected
          // outcome there, not an error worth logging loudly.
          await gref.update({ pendingDays: FieldValue.arrayUnion(day) });
        } catch (err) {
          const code = (err as { code?: number | string }).code;
          if (code === 5 || code === "not-found") return;
          logger.warn(`[v2] pending-day mark failed for ${gid}/${day}:`, err);
        }
      }
      return;
    }
    const qid = event.params.qid;
    // Catalog answers carry `entity`, never `optionIdx` — one pick from the
    // shipped catalogue, admitted by rules only on type=="catalog"
    // questions. Same ledger, same private/public docs, same cadence; what
    // publishes is the canon fold (top-N + one "everyone else" bucket)
    // instead of per-option counts, plus per-segment orderings of that
    // board restricted to its own entities (D17 — the top-N-only form D14
    // said was the viable one; a full 1,000-entity split per segment
    // leaves nearly every cell under the floor).
    if (snap.get("entity") !== undefined) {
      const db = getFirestore();
      const eventRef = db.collection("v2_agg_events").doc(event.id);
      const privRef = db.collection("v2_aggs_private").doc(qid);
      const pubRef = db.collection("v2_question_aggs").doc(qid);
      const qRef = db.collection("v2_questions").doc(qid);
      await db.runTransaction(async (tx) => {
        const seen = await tx.get(eventRef);
        if (seen.exists) return;
        // The question's domain decides which key space validates this
        // entity — the trigger's only question-doc read, catalog answers
        // only. A missing or unknown domain never aggregates: with three
        // key spaces (a contiguous range and two sparse QID sets, D15)
        // there is no honest global fallback bound.
        const qDoc = await tx.get(qRef);
        const spec = CATALOG_DOMAINS[qDoc.get("domain") as string];
        if (!spec) {
          logger.warn(`[v2] catalog answer ${event.params.uid}/${qid} on a question with no known domain`);
          return;
        }
        const key = catalogEntityKey(snap.get("entity"), spec);
        if (key === null) {
          logger.warn(`[v2] answer ${event.params.uid}/${qid} has no usable entity key`);
          return; // an unknown key never aggregates; the owner's doc stays, harmless
        }
        const priv = await tx.get(privRef);
        const ent: CanonCounts =
          (priv.exists && (priv.get("ent") as CanonCounts)) || {};
        ent[key] = (ent[key] || 0) + 1;
        const total = ((priv.exists && (priv.get("total") as number)) || 0) + 1;
        // Per-entity anchor slices, transposed foldAnchors with its own
        // per-cell entity cap (pure.ts, D17). Same document, same D7
        // arithmetic as the vote path's `by`.
        const entBy: BreakdownCounts =
          (priv.exists && (priv.get("entBy") as BreakdownCounts)) || {};
        foldCanonAnchors(entBy, snap.get("anchors"), key);
        tx.set(eventRef, {
          qid,
          at: FieldValue.serverTimestamp(),
          expireAt: new Date(Date.now() + 7 * 86400000),
        });
        // Bounded growth: `ent` is capped by catalogue validation (~1k
        // entries); `entBy` by the bucket cap × its own per-cell entity
        // cap (foldCanonAnchors) — tens of KB against Firestore's 1 MiB
        // limit either way.
        tx.set(privRef, { ent, entBy, total }, { merge: false });
        if (total >= AGG_MIN_N) {
          if (shouldPublishAgg(total, AGG_MIN_N, PUBLISH_EVERY)) {
            const canon = publishableCanon(ent, AGG_MIN_N, CANON_TOP_N);
            // A null canon means nothing survives the fold's own floors —
            // publish the bare total rather than a decorative board. When
            // there IS a board, its per-segment orderings ride along:
            // cells restricted to the board's own entities, then the same
            // bucket-cohort floor + complementary suppression as the vote
            // path (D17).
            tx.set(
              pubRef,
              canon
                ? {
                    total,
                    tooSmall: false,
                    top: canon.top,
                    rest: canon.rest,
                    by: publishableBreakdown(canonBreakdownFor(entBy, canon.top), AGG_MIN_N),
                  }
                : { total, tooSmall: false },
              { merge: false },
            );
          }
        } else {
          tx.set(pubRef, { tooSmall: true }, { merge: false });
        }
      });
      return;
    }
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
