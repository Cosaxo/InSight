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
//                       retry-on-failure cannot double-count. The same
//                       ledger carries uid attribution, which is what
//                       keeps the aggregates CORRECTABLE after a
//                       fake-account ring is discovered (D28).
//
// Schema and access decisions: docs/SCHEMA-V2.md, docs/DECISIONS.md (D5).

import { getFirestore, FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertOperator, HOT_TRIGGER } from "./ops";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { V2_QUESTIONS } from "./v2content";
import {
  canonBreakdownFor,
  catalogEntityKey,
  foldAnchors,
  foldCanonAnchors,
  publishBreakdown,
  publishableCanon,
  seedDocMatches,
  seedOptionConflict,
  describeSeedOptionConflicts,
  shouldPublishAgg,
  type BreakdownCounts,
  type CanonCounts,
  type CatalogSpec,
  type SeedOptionConflict,
} from "./pure";
import { FILM_KEYS, ARTIST_KEYS, EMOJI_KEYS } from "./catalogKeys";

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
// Exported since D57: the logic norms histogram publishes its public
// mirror on the same cadence, for the same attribution argument.
export const PUBLISH_EVERY = 5;

// ── questions that never slice (D44) ────────────────────────────
//
// The political items are Art. 9 special-category data, and D8 treats them
// that way everywhere the *result vector* is concerned: it stays in the
// owner doc, never sliced, never published. The eighteen ITEMS those
// results are computed from ship as ordinary feed cards — `surface: "test"`,
// which deck.ts routes into the live feed alongside `surface: "feed"` — so
// they reached the vote path below like any other question and folded into
// the per-anchor breakdown like any other question. That published each
// political item's split by city, gender, age band, education and
// relationship, to any signed-in reader, while docs/data-inventory.md told
// store reviewers political data is "never sliced by, never published".
//
// The counts still publish. What is withheld is the demographic cross-tab —
// the slice, not the split. D44 has the arithmetic and the alternatives.
//
// Derived from the committed bank at module load, not read per answer:
// v2content.ts is already imported for the seed, so this costs one pass
// over the bank at cold start and NO Firestore read on the hot path — which
// matters, because the vote path's whole design is that it never reads the
// question doc (the catalog path's read is the documented exception).
// check:content holds v2content.ts byte-identical to /content on the deploy
// path, so a new political item joins this set by existing.
//
// Two markers, one set (D52). `test === "political"` is the political
// TEST's own items. `political === true` is the same Art. 9 judgement
// applied to ordinary opinion cards — a feed question like "Should voting
// be mandatory?" is a political opinion in exactly the sense this set
// exists for, and it cannot reuse the `test` marker: PASSIVE.record and
// the feed's test-kicker key off `q.test`, so marking a feed card
// "political" that way would silently count it toward the political
// test's progress rings.
export const POLITICAL_QIDS: ReadonlySet<string> = new Set(
  V2_QUESTIONS.filter((q) => q.test === "political" || q.political === true).map((q) => q.id),
);

// The predicate, exported because the set alone cannot be asserted against
// intent — a test that reads POLITICAL_QIDS and re-derives it from
// V2_QUESTIONS proves only that Set works. slicing.test.ts asserts this
// answers false for every political item the bank actually ships, and true
// for the non-political items that share their surface.
export function slicesDemographics(qid: string): boolean {
  return !POLITICAL_QIDS.has(qid);
}

/**
 * The per-anchor breakdown this answer leaves behind — D44's ENFORCEMENT
 * point, extracted from the trigger so it has cases of its own.
 *
 * Returning `{}` for a political item rather than merely skipping the fold
 * is deliberate: privRef is written with merge:false, so the next answer to
 * a political question also ERASES any breakdown folded before this guard
 * existed, instead of carrying it forward untouched forever.
 */
export function breakdownFor(
  qid: string,
  storedBy: BreakdownCounts | null | undefined,
  anchors: unknown,
  optionIdx: number,
  floor: number,
): BreakdownCounts {
  if (!slicesDemographics(qid)) return {};
  const by: BreakdownCounts = storedBy || {};
  foldAnchors(by, anchors, optionIdx, floor);
  return by;
}

// How long a ledger entry lives (expireAt powers the Firestore TTL policy —
// SHIP-CHECKLIST §5). Two jobs with very different horizons share the doc:
//
//   Dedup needs ~7 days — Eventarc redelivers for at most that long, so any
//   window covering it prevents double counts.
//
//   Attribution needs longer. The ledger is what lets an operator subtract a
//   discovered ring of fake accounts from v2_aggs_private and republish
//   (docs/DEPLOYMENT.md, "Correcting aggregates"); prevention cannot be made
//   complete (D28), so the fallback is that the record stays correctable.
//   That only works while the ring's entries still exist, and an attack is
//   noticed on a human timescale — weeks after the fact, not days. 90 days
//   is notice + investigation headroom; the storage arithmetic is in D28.
//
// deleteAccount erases a uid's entries with the account, so retention here
// never outlives the account it attributes (index.ts phase 4c).
export const LEDGER_RETENTION_DAYS = 90;

// One shape for both write sites (vote and catalog), so the forensic fields
// cannot drift apart. `uid` is the attribution: qid alone dedups fine, but
// leaves no way to identify — and unwind — a fake account's contributions
// after the fact.
function ledgerEntry(uid: string, qid: string) {
  return {
    qid,
    uid,
    at: FieldValue.serverTimestamp(),
    expireAt: new Date(Date.now() + LEDGER_RETENTION_DAYS * 86400000),
  };
}

// ── contention, made observable ─────────────────────────────────
//
// D7 records the per-question write ceiling — Firestore sustains roughly
// one write per second per document, and both documents these
// transactions touch are single docs keyed by qid — and then names the
// condition for revisiting it: "when onV2AnswerCreated starts logging
// transaction retries". It never logged them. The condition was written
// as though the instrument existed, so the first evidence of the ceiling
// would have been a Mirror that stopped moving and nobody able to say why.
//
// Firestore's SDK retries an ABORTED transaction inside runTransaction, so
// a retry leaves no trace outside unless the callback counts its own
// invocations. One attempt is the normal case and two is ordinary
// interleaving; three is the ceiling arriving, which is why that is where
// this logs. A line per contended answer, not per answer.
//
// WHAT PUBLISH_EVERY DID NOT BUY. It cuts writes to pubRef by ~80% and
// closes a disclosure channel (see the constant above), and it is easy to
// read that as headroom. It is not: privRef is written on EVERY answer
// inside the same transaction, and a transaction is bounded by its most
// contended document. The ceiling is exactly where D7's arithmetic puts
// it. This measures it; sharding privRef is what would move it.
const CONTENTION_ATTEMPTS = 3;

// Exported for its test only — nothing outside this module calls it. The
// test drives a fake `runTransaction` that invokes the callback N times,
// which is the one thing worth pinning here: the threshold, and that a
// body's failure still propagates rather than being swallowed by the
// counter. Whether Firestore re-invokes the callback on ABORTED is its
// contract, not something a unit test can establish.
export async function runAggTransaction(
  db: Firestore,
  qid: string,
  body: (tx: Transaction) => Promise<void>,
): Promise<void> {
  let attempts = 0;
  await db.runTransaction(async (tx) => {
    attempts += 1;
    await body(tx);
  });
  // Structured fields as well as the message: the message is what a human
  // greps, the fields are what a log-based metric groups by. Both, because
  // monitoring/onV2AnswerCreated-contention.json counts these and an
  // operator then wants to know WHICH question.
  if (attempts >= CONTENTION_ATTEMPTS) {
    logger.warn(`[v2] aggregate contention on ${qid} — ${attempts} attempts`, {
      metric: "agg_contention",
      qid,
      attempts,
    });
  }
}

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
  // Unicode codepoints — sparse like QIDs, stable by Unicode policy.
  emoji: { keys: EMOJI_KEYS },
};

// ── content seed ────────────────────────────────────────────────

/**
 * Exported and db-injected for the same reason runAggTransaction is: the
 * refusal below (D58) is a guarantee about what this function REFUSES to
 * write, and a guarantee nothing executes is a comment. `getFirestore()`
 * inside the body would have made the enforcement untestable without an
 * emulator — which is exactly the gap that let the invariant go unenforced
 * for as long as it did. seed.test.ts drives it with a stand-in.
 */
export async function runSeedV2(
  db: Firestore,
  bumpRev = false,
): Promise<{ written: number; skipped: number }> {
  const refs = V2_QUESTIONS.map((q) => db.collection("v2_questions").doc(q.id));
  // `active` is the operational kill switch — the seed must never flip a
  // question ops disabled back on, so it is only written on first create.
  // The full snapshots (not just the id set) are kept because they are also
  // what makes the write skip below possible: getAll has already paid for
  // the read, so diffing is free.
  const stored = new Map<string, Record<string, unknown>>();
  const present = new Set<string>();
  for (const s of await db.getAll(...refs)) {
    if (!s.exists) continue;
    present.add(s.id);
    stored.set(s.id, s.data() as Record<string, unknown>);
  }
  let batch = db.batch();
  let inBatch = 0;
  let written = 0;
  const refused: SeedOptionConflict[] = [];
  for (let i = 0; i < V2_QUESTIONS.length; i++) {
    const q = V2_QUESTIONS[i];
    const payload: Record<string, unknown> = {
      surface: q.surface,
      seq: q.seq,
      type: q.type,
      // The aggregate trigger reads the question doc's `domain` to pick the
      // catalogue an `entity` answer validates against (D14/D15) — the seed
      // must transport it or live catalog questions can never aggregate.
      domain: q.domain,
      prompt: q.prompt,
      options: q.options,
      topic: q.topic,
      axis: q.axis,
      test: q.test,
    };
    // Unchanged docs are not rewritten. Two things depend on this, and the
    // second is the expensive one: `updatedAt` only means something as an
    // incremental cursor if it moves when the content moves (live.ts reads
    // the bank with `updatedAt > cursor`), and `contentRev` below only
    // bumps when something actually changed.
    if (seedDocMatches(stored.get(q.id), payload)) continue;
    // D52's un-editable invariant, enforced where the edit would land rather
    // than in the reviewer's eye. A changed option set on a LIVE question
    // re-keys every vote already stored against it, silently — so this doc
    // is refused and the rest of the seed proceeds. Refusing per-document
    // rather than aborting the run is deliberate: a batch of legitimate
    // prompt fixes must not be held hostage by one bad edit, and the throw
    // at the end makes sure the refusal cannot be missed either way.
    const conflict = seedOptionConflict(q.id, stored.get(q.id), payload);
    if (conflict) {
      refused.push(conflict);
      continue;
    }
    payload.updatedAt = FieldValue.serverTimestamp();
    if (!present.has(q.id)) payload.active = true;
    batch.set(refs[i], payload, { merge: true });
    written++;
    // Firestore batches cap at 500 ops.
    if (++inBatch === 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  // `contentRev` is the FULL-invalidation lever: it blows away every
  // device's cached bank so the next boot re-reads all of it. That costs
  // 369 reads per returning user (docs/COSTS.md), so it is no longer
  // spent on every run — only when this seed created documents, and when
  // an operator asks for it explicitly.
  //
  // Ordinary content growth does NOT need it: new and edited docs carry a
  // fresh `updatedAt`, and clients page them in against their cursor.
  //
  // `bumpRev` exists for the one case the cursor cannot see — an `active`
  // flag flipped by hand in the console, which changes no document the
  // seed writes. Note that a stale client is a cosmetic problem, not a
  // correctness one: firestore.rules re-checks `active` on every answer
  // write, so a killed question that is still on someone's screen is
  // refused server-side rather than silently accepted.
  //
  // NEW questions deliberately do NOT bump it either, which is the whole
  // point: a promotion is exactly the case this exists to make cheap, and
  // creates carry `updatedAt` like every other write, so the cursor pages
  // them in. The only automatic bump left is the first seed of an empty
  // project, which initialises the field.
  const metaRef = db.collection("v2_meta").doc("app");
  const firstEver = (await metaRef.get()).get("contentRev") === undefined;
  const bumped = bumpRev || firstEver;
  if (bumped) {
    await metaRef.set({ contentRev: FieldValue.serverTimestamp() }, { merge: true });
  }
  const skipped = V2_QUESTIONS.length - written - refused.length;
  logger.info(
    `[v2] seeded ${written} questions, ${skipped} unchanged ` +
      `(${present.size} pre-existing, contentRev ${bumped ? "bumped" : "held"})`,
  );
  // Loud, and after the commit. The legitimate writes are already durable —
  // holding them back would punish the rest of the batch for one bad edit —
  // but the run does NOT get to report success, because a silently-skipped
  // question is exactly the outcome D52 exists to prevent. An operator who
  // genuinely means to retire a question has `active: false`; an operator
  // who genuinely means to replace one appends a new qid. Neither path goes
  // through here.
  if (refused.length) {
    const detail = describeSeedOptionConflicts(refused);
    logger.error(
      `[v2] REFUSED ${refused.length} option-set edit(s) to live questions ` +
        `(D52 — answers store optionIdx, so editing options re-keys every ` +
        `vote already cast): ${detail}`,
    );
    throw new HttpsError(
      "failed-precondition",
      `refused ${refused.length} option-set edit(s) to already-seeded questions; ` +
        `shipped option sets are immutable (D52). Retire with active:false or ` +
        `append a new qid instead. ${detail}`,
    );
  }
  return { written, skipped };
}

// NO enforceAppCheck, deliberately: this is invoked from a browser console
// as the last remaining step of SHIP-CHECKLIST §1, and by the e2e — neither
// carries an App Check token. assertOperator + SEED_ADMIN_UIDS is the
// control instead. Held by `npm run check:appcheck`, which also fails if
// enforcement is ever added here without removing the exemption, because
// adding it would refuse the console call that checklist step is written
// around.
export const seedContentV2 = onCall({ region: REGION }, async (request) => {
  assertOperator(request);
  // bumpRev forces the full cache invalidation the seed no longer spends
  // by default — see runSeedV2. Use it after flipping `active` by hand in
  // the console; ordinary content growth does not need it.
  return runSeedV2(getFirestore(), request.data?.bumpRev === true);
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
          // RETHROWN, so `retry: true` above actually means something on this
          // branch. It used to warn and return normally, which made the retry
          // policy dead here: the mark is the ONLY thing that puts this day
          // in front of the scheduled scan, so losing it loses the reveal —
          // for a group-day where the single answerer has already played,
          // silently and permanently.
          //
          // D19's stated safety net does not cover it. "The answer never
          // folded into any aggregate — a louder problem, already logged" is
          // true of the vote path; this branch returns before any aggregate
          // work. And the monitoring filter is severity>=ERROR while this
          // logged WARNING, so nothing was watching either.
          //
          // Safe to retry: arrayUnion is idempotent, and the NOT_FOUND case
          // above still returns cleanly rather than retrying against a group
          // that is deliberately gone.
          logger.error(`[v2] pending-day mark failed for ${gid}/${day}:`, err);
          throw err;
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
      await runAggTransaction(db, qid, async (tx) => {
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
        //
        // D44 applies here too, though no political question can currently
        // reach this path — the eighteen are type "scale" and this branch
        // needs an `entity`. The guard is here anyway because the cost is
        // one condition and the alternative is a trap that reopens silently
        // the day someone ships a catalog question with test: "political".
        const entSlices = slicesDemographics(qid);
        const entBy: BreakdownCounts = entSlices
          ? (priv.exists && (priv.get("entBy") as BreakdownCounts)) || {}
          : {};
        if (entSlices) foldCanonAnchors(entBy, snap.get("anchors"), key, AGG_MIN_N);
        // What the last publish released, per bucket. The publish CADENCE is
        // counted in answers to the question; a bucket's own movement is not,
        // so the k that shouldPublishAgg gives `total` has to be applied a
        // second time, per bucket, or a step of one names a person
        // (steppedBreakdown, pure.ts).
        const entReleased: BreakdownCounts = entSlices
          ? (priv.exists && (priv.get("entByPub") as BreakdownCounts)) || {}
          : {};
        const publishing = total >= AGG_MIN_N
          && shouldPublishAgg(total, AGG_MIN_N, PUBLISH_EVERY);
        const canon = publishing ? publishableCanon(ent, AGG_MIN_N, CANON_TOP_N) : null;
        // Only a publish moves the released map — an answer that changes
        // nothing on screen must not consume a bucket's step budget.
        // Same rule as the vote path: store what was PUBLISHED, so a
        // suppressed bucket does not spend its step budget unseen.
        const entByPub = canon
          ? publishBreakdown(canonBreakdownFor(entBy, canon.top), entReleased, AGG_MIN_N)
          : entReleased;
        tx.set(eventRef, ledgerEntry(event.params.uid, qid));
        // Bounded growth: `ent` is capped by catalogue validation (~1k
        // entries); `entBy` by the bucket cap × its own per-cell entity
        // cap (foldCanonAnchors) — tens of KB against Firestore's 1 MiB
        // limit either way. `entByPub` is a subset of `entBy` restricted to
        // the published board, so it is bounded by CANON_TOP_N × the bucket
        // cap and adds no new growth term.
        tx.set(privRef, { ent, entBy, entByPub, total }, { merge: false });
        if (total >= AGG_MIN_N) {
          if (publishing) {
            // A null canon means nothing survives the fold's own floors —
            // publish the bare total rather than a decorative board. When
            // there IS a board, its per-segment orderings ride along:
            // cells restricted to the board's own entities, stepped so no
            // bucket moves by less than the floor, then the same
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
                    by: entByPub,
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
    await runAggTransaction(db, qid, async (tx) => {
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
      //
      // D44: political items never slice. Reading `{}` rather than the
      // stored map — instead of only skipping the fold — is deliberate:
      // privRef is written with merge:false below, so the next answer to a
      // political question also ERASES any breakdown folded before this
      // guard existed, rather than carrying it forward untouched forever.
      const slices = slicesDemographics(qid);
      const by = breakdownFor(
        qid,
        priv.exists ? (priv.get("by") as BreakdownCounts) : null,
        snap.get("anchors"),
        optionIdx,
        AGG_MIN_N,
      );
      // The breakdown a reader has already seen. PUBLISH_EVERY bounds the
      // delta of `counts`, whose unit is the question; a bucket's unit is the
      // bucket, and a five-answer window routinely carries a single anchored
      // answer (anchors stay empty until the Basics card is filled, D8), so
      // without a second gate one publish moves one bucket by one and names
      // that person's vote — with every dimension moving together, which is a
      // quasi-identifier rather than a cell. steppedBreakdown (pure.ts)
      // re-emits the previous value until a bucket has gained AGG_MIN_N.
      const released: BreakdownCounts = slices
        ? (priv.exists && (priv.get("byPub") as BreakdownCounts)) || {}
        : {};
      const publishing = total >= AGG_MIN_N
        && shouldPublishAgg(total, AGG_MIN_N, PUBLISH_EVERY);
      // Only a publish moves the released map. An answer that rewrites
      // nothing must not spend a bucket's step budget, or the gate would
      // decay to "every fifth answer" — which is the bound that was already
      // there and is not the one this needs.
      //
      // publishBreakdown returns ONE value that is both what goes on the
      // public document and what is stored as the next baseline. They were
      // two expressions once, and the e2e caught the difference: storing the
      // stepped map charged a suppressed bucket for a value no reader saw.
      const byPub = publishing ? publishBreakdown(by, released, AGG_MIN_N) : released;
      tx.set(eventRef, ledgerEntry(event.params.uid, qid));
      tx.set(privRef, { counts, total, by, byPub }, { merge: false });
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
        if (publishing) {
          // The breakdown carries its OWN floor, per cell, plus
          // complementary suppression (pure.ts). A question past the
          // overall floor still shows no slice until that slice can be
          // shown without singling anyone out — and, since the step gate,
          // no slice moves by less than that floor either.
          tx.set(pubRef, { counts, total, tooSmall: false, by: byPub }, { merge: false });
        }
      } else {
        tx.set(pubRef, { tooSmall: true }, { merge: false });
      }
    });
  },
);
