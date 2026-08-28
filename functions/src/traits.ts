// traits.ts — the nightly trait-cube sweep (D330).
//
// Joins each user's CURRENT `testResults` to EVERY core answer they have
// ever given, and publishes one cube per question: that question's split
// by each instrument's matched archetype, each instrument's axis bands,
// and the verified logic band.
//
// WHY A REBUILD RATHER THAN AN ACCUMULATION, which is the whole design.
//
// The obvious shape — stamp the type into the answer's `anchors` snapshot
// at vote time and let the existing trigger fold it — is rejected in D330
// and it is worth knowing why here, because it is the shape a reader will
// reach for. `anchors` is frozen by D5/D86, so a stamp is FORWARD-ONLY:
// every answer given before you were typed would sit in `untested`
// forever, and an answer given under a type you have since grown out of
// would keep the old one. That is not a stale cell, it is a wrong one,
// and it gets wronger as the app ages. It is also client-written, so a
// scripted caller could file its answers under any archetype it liked.
//
// Rebuilding instead buys three properties at once, and none of them is a
// feature anyone had to build:
//
//   * RETROACTIVE. Tonight's run reads tonight's results against every
//     answer ever written, so an answer you gave in month one is in its
//     cohort the morning after you are first typed in month three.
//   * SELF-HEALING. A changed type, a cleared result, a deleted account,
//     a retuned matcher and a renamed archetype are the same event: one
//     night, no migration, no per-user bookkeeping. A leaver's answers
//     leave the cube because phase 1b already removed them — unlike
//     `v2_question_aggs` beside it, this document forgets.
//   * NOTHING PER-PERSON IS WRITTEN. The sweep computes each person's
//     buckets in memory and drops them; the only documents it writes are
//     the per-question cubes. That is D330's custody rule and it is held
//     by a test over the recording fake's write log, not by this comment.
//
// The cost is one night of staleness after a type change, priced in the
// record rather than engineered around.
//
// SHAPE: one question at a time. Memory is O(one question's answers), the
// run is resumable at a qid boundary, and a run that dies half-way leaves
// the other half yesterday's COMPLETE cube rather than a torn one —
// because no invariant spans questions. The alternative (one sweep over
// every answer, folding every question's cube in memory at once) costs
// the same reads and is unbounded in memory.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { db as firestore } from "./db";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { LIGHT_UNBOUNDED, FUNCTIONS_REGION, assertOperator } from "./ops";
import { V2_QUESTIONS } from "./v2content";
import {
  foldTraits, newTraitCube, publishableCube, traitBucketsFor, type TraitCube,
} from "./traitsFit";

/**
 * The questions that get a cube — CORE only.
 *
 * `docs/SCALE-PLAN.md` §1: "the Mirror's cohort readings fold over the
 * core and nothing else." That rule is what keeps this sweep bounded
 * against a feed the owner has decided should grow without limit, and it
 * is why a tail question simply has no cube — which the sheet renders as
 * no instrument chips at all, data-driven, no flag (the D265 posture).
 *
 * Compiled from the bank the way `PATTERNS_QIDS` is, and by the same
 * arms: the daily is core by construction, a feed question is core only
 * if it says so. `test`/`learn`/`pulse`/`call`/`group`/`duo` surfaces are
 * excluded — a duel answer is sealed (D5), a learn answer is a first
 * attempt rather than an opinion, and a test answer is an INPUT to the
 * very types this cuts by, so folding it would be circular.
 */
export const TRAITS_QIDS: ReadonlySet<string> = new Set(
  V2_QUESTIONS.filter(
    (q) => q.surface === "daily" || (q.surface === "feed" && q.core === true),
  ).map((q) => q.id),
);

/** One answer, as the fold needs it. */
export interface TraitAnswer { uid: string; optionIdx: number }

/** What the sweep reads and writes. A narrow interface so the whole run
 *  is exercised against a recording fake (patterns.test.ts's shape). */
export interface TraitsStore {
  /** uid → trait buckets, for every account. Built once per run. */
  allTraitBuckets(): Promise<Map<string, Record<string, string>>>;
  /** Every public answer to one question. */
  answersForQuestion(qid: string): Promise<TraitAnswer[]>;
  /** Publish one question's cube. */
  putCube(qid: string, cube: TraitCube, total: number): Promise<void>;
}

export interface TraitsSummary {
  /** Accounts whose buckets were computed. */
  people: number;
  /** Questions that got a cube written. */
  questions: number;
  /** Answers folded across all of them. */
  folded: number;
}

/**
 * Rebuild every eligible question's cube.
 *
 * A cube is written only for a question with at least one folded answer:
 * an absent document is "no reading yet" (D1), and writing an empty one
 * would put a row of zeros on screen that is not the same claim.
 */
export async function runTraitsSweep(
  store: TraitsStore,
  eligible: ReadonlySet<string> = TRAITS_QIDS,
): Promise<TraitsSummary> {
  const buckets = await store.allTraitBuckets();
  // Computed once and shared by every question — the join is the whole
  // cost saving over doing this per question, and the map is dropped when
  // the run returns.
  const untested = traitBucketsFor(null);
  let questions = 0;
  let folded = 0;
  for (const qid of eligible) {
    const answers = await store.answersForQuestion(qid);
    if (!answers.length) continue;
    const cube = newTraitCube();
    let total = 0;
    for (const a of answers) {
      // A voter with no profile document (deleted between the two reads)
      // folds as untested rather than being dropped: the cube's totals
      // must equal the question's answer count on every dim, and a
      // silently skipped answer would break that identity where an
      // untested one does not.
      foldTraits(cube, buckets.get(a.uid) ?? untested, a.optionIdx);
      total += 1;
    }
    await store.putCube(qid, publishableCube(cube), total);
    questions += 1;
    folded += total;
  }
  return { people: buckets.size, questions, folded };
}

/** The real store. */
export function firestoreTraitsStore(db: Firestore): TraitsStore {
  return {
    async allTraitBuckets() {
      // `.select()` is not optional: firestore.rules' own comment records
      // that the reveal path "added a fieldMask for exactly this and
      // OOM'd without one". Only testResults is read, and only to compute
      // buckets that are discarded when the run ends.
      const snap = await db.collection("v2_users").select("testResults").get();
      const out = new Map<string, Record<string, string>>();
      for (const d of snap.docs) out.set(d.id, traitBucketsFor(d.get("testResults")));
      return out;
    },
    async answersForQuestion(qid) {
      // The collection-group scan replay.ts already runs against the
      // index D290 added for it. The anon surfaces (D327) are included on
      // purpose: an anonymous answer counts in every public tally exactly
      // like any other — only its authorship is withheld, and a cube
      // holds no authorship at all.
      const snap = await db
        .collectionGroup("answers")
        .where("qid", "==", qid)
        .get();
      const out: TraitAnswer[] = [];
      for (const d of snap.docs) {
        const uid = d.ref.parent.parent?.id;
        const optionIdx = d.get("optionIdx");
        const surface = d.get("surface");
        // Vote-shaped answers only. A catalog answer carries `entity` and
        // a rank answer carries `order`; neither has an option column to
        // fold, and both would arrive here as undefined.
        if (!uid || typeof optionIdx !== "number") continue;
        if (surface === "group" || surface === "duo") continue; // sealed (D5)
        out.push({ uid, optionIdx });
      }
      return out;
    },
    async putCube(qid, cube, total) {
      // Whole-document write, never a merge: the cube is a rebuild, so a
      // bucket that emptied since last night has to DISAPPEAR. A merge
      // would leave yesterday's cells standing under a dim nobody is in
      // any more, which is the one failure a rebuild is supposed to make
      // impossible.
      await db.collection("v2_question_traits").doc(qid).set({
        at: FieldValue.serverTimestamp(),
        total,
        by: cube,
      });
    },
  };
}

const REGION = FUNCTIONS_REGION;

export const foldTraitsV2 = onSchedule(
  // Nightly, after the patterns fit (2:37) so the two heavy collection-
  // group readers do not overlap, and off the top-of-hour herd. Cost is
  // in docs/COSTS.md's Traits row.
  { schedule: "17 3 * * *", region: REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const summary = await runTraitsSweep(firestoreTraitsStore(firestore()));
    if (summary.questions > 0) {
      logger.info("traits sweep", { metric: "traits_sweep", ...summary });
    }
  },
);

/**
 * Rebuild one question's cube on demand — the operator's escape hatch, so
 * a single question can be corrected during an incident without waiting
 * for the schedule.
 *
 * Dry by default, `replay.ts`'s shape: this writes the document every
 * cohort reading of that question is drawn from, and the runbook that
 * reaches for it is one somebody follows under pressure.
 *
 * Not App Check attested, for the reason the other operator instruments
 * are not: the caller is a console, which cannot attest, and a control
 * that fails when it is most needed is not a control.
 */
export const rebuildTraitsV2 = onCall(
  { region: REGION, ...LIGHT_UNBOUNDED },
  async (req) => {
    assertOperator(req.auth);
    const qid = String((req.data as { qid?: unknown })?.qid ?? "");
    const apply = (req.data as { apply?: unknown })?.apply === true;
    if (!qid) throw new HttpsError("invalid-argument", "qid is required");
    if (!TRAITS_QIDS.has(qid)) {
      throw new HttpsError(
        "failed-precondition",
        `${qid} is not in the trait sweep's eligible set — it is a tail or non-vote question, `
        + "so it has no cube by design (docs/SCALE-PLAN.md §1)",
      );
    }
    const store = firestoreTraitsStore(firestore());
    try {
      if (!apply) {
        const answers = await store.answersForQuestion(qid);
        return { qid, apply: false, wouldFold: answers.length };
      }
      const summary = await runTraitsSweep(store, new Set([qid]));
      return { qid, apply: true, ...summary };
    } catch (err) {
      // Wrapped, so an incident does not read "INTERNAL INTERNAL".
      throw new HttpsError("internal", `rebuildTraitsV2 ${qid}: ${String((err as Error)?.message ?? err)}`);
    }
  },
);
