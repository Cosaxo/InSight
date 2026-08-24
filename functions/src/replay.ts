// replay.ts — rebuilding an aggregate from the answers that made it.
//
// WHY THIS EXISTS. The architecture has always rested on a claim nothing
// implemented: that `v2_users/{uid}/answers/{qid}` is the source of truth
// and every aggregate is a derived, disposable projection of it. D28's
// correction runbook rests on it, the nightly Patterns fit and engagement
// digest are already projections, and every future projection change —
// sharding the hot document, moving the breakdown cube onto per-dimension
// documents — is only safe if the projection can be rebuilt.
//
// What the repo had instead was `docs/DEPLOYMENT.md`'s "Correcting
// aggregates", which rebuilds from `v2_agg_events`. That ledger carries
// `{ qid, uid, optionIdx, at, expireAt }` and NO anchors, and it TTLs at
// LEDGER_RETENTION_DAYS (90). So before this file the system could not
// repair a `by` breakdown at all — the ledger has nothing to slice by —
// and could repair nothing older than a quarter.
//
// The answers can do both. They are append-only, one document per person
// per question (so they never contend), they carry the `anchors` snapshot
// the fold slices by (D8), and since D98 they are world-readable behind a
// collection-group index on `qid`. This file turns "the answers are the
// truth" from a sentence in a design document into a function with a test.
//
// ── THE ONE PROPERTY THAT MAKES IT WORK, AND ITS LIMIT ─────────────
//
// The vote fold is COMMUTATIVE while no dimension is saturated: adding a
// vote to `counts` and to a `by` cell does not depend on what came before,
// so any order of the same answers produces the same aggregate. That is
// what lets a batch rebuild equal an incremental accumulation.
//
// It stops being commutative when a dimension reaches
// BREAKDOWN_MAX_BUCKETS. `evictForNewBucket` then drops the smallest
// bucket under BUCKET_EVICT_BELOW to make room, and WHICH bucket is
// smallest depends on arrival order. So on a saturated dimension a replay
// is *a* correct fold of the answers, not necessarily the *same* fold the
// trigger built. Two things follow, and both are deliberate:
//
//   1. The scan orders by `answeredAt` ascending — the closest thing to
//      the trigger's arrival order that the data records. (Eventarc
//      guarantees no ordering at all, so this is an approximation on a
//      saturated dimension and exact everywhere else.) That ordering is
//      the reason firestore.indexes.json carries a second `answers`
//      collection-group index; the existing one leads with
//      `qid, surface` and cannot serve `where qid == X order by
//      answeredAt`.
//   2. The outcome REPORTS which dimensions came out at the cap
//      (`cappedDims`), because those are exactly the ones where the
//      rebuild may differ from what was published. Reporting beats
//      silently returning a number that looks authoritative — the D72
//      rule, applied to a repair tool.
//
// Both of those shrink to nothing the day the breakdown moves onto
// per-dimension documents with room to spare: eviction stops firing, the
// fold is commutative everywhere, and replay becomes exact.
//
// ── WHAT REPLAY CANNOT REBUILD, STATED RATHER THAN PAPERED OVER ────
//
// `edits` (D226's edit-flow matrix) is NOT derivable from the answers. An
// edited answer records where it landed, never where it came from — D86
// freezes anchors and answeredAt and moves `optionIdx` in place — so the
// -old/+new moves that built the matrix are gone. Replay therefore CARRIES
// THE STORED `edits` FORWARD unchanged, exactly as the trigger's create
// arm does. Recomputing it as empty would silently delete a published
// number that is still true.
//
// Only the VOTE arm is rebuilt. Catalog answers (`entity`, D14) and rank
// answers (`order`, D233) fold through different shapes, and a rebuild
// that quietly wrote vote-shaped counts over a canon board would be worse
// than no rebuild at all — so they are refused by name.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db as firestore } from "./db";
import { assertOperator, FUNCTIONS_REGION } from "./ops";
// The trigger's own breakdown helper, imported rather than reimplemented.
// Its header says why it is a named function at all: "the trigger, the edit
// path and the catalog path all want the same one, and three copies is how
// they drift". A replay that folded anchors its own way would be a fourth.
import { breakdownFor } from "./v2";
import { BREAKDOWN_DIMS, BREAKDOWN_MAX_BUCKETS, type BreakdownCounts } from "./pure";

const REGION = FUNCTIONS_REGION;

/** One answer, reduced to the three fields the vote fold reads. */
export interface ReplayAnswer {
  uid: string;
  optionIdx: unknown;
  anchors: unknown;
}

/** Accumulator. Mutable on purpose — the scan folds page by page so a
 *  question with half a million answers never has to fit in memory. */
export interface FoldState {
  qid: string;
  counts: Record<string, number>;
  total: number;
  by: BreakdownCounts;
  folded: number;
  skipped: number;
  excluded: number;
}

export interface ReplayOutcome {
  qid: string;
  counts: Record<string, number>;
  total: number;
  by: BreakdownCounts;
  folded: number;
  skipped: number;
  excluded: number;
  /** Dimensions sitting at BREAKDOWN_MAX_BUCKETS — where eviction fired and
   *  the rebuild may legitimately differ from what was published. */
  cappedDims: string[];
}

export function newFold(qid: string): FoldState {
  return { qid, counts: {}, total: 0, by: {}, folded: 0, skipped: 0, excluded: 0 };
}

/**
 * Fold ONE answer, mirroring `onV2AnswerCreated`'s vote arm exactly:
 * the same index validity window, the same `counts`/`total` increment,
 * the same `breakdownFor` call. Returns what it did, so a caller can
 * report a scan rather than guess at it.
 */
export function foldAnswerInto(
  state: FoldState,
  answer: ReplayAnswer,
  exclude: ReadonlySet<string> = new Set(),
): "folded" | "skipped" | "excluded" {
  // D28's ring subtraction is the whole reason this parameter exists: the
  // repair is "rebuild WITHOUT these uids", not "undo their votes", because
  // an undo needs a record of what they did and a rebuild needs only the
  // answers that remain.
  if (exclude.has(answer.uid)) {
    state.excluded += 1;
    return "excluded";
  }
  // Same guard as the trigger (v2.ts, vote arm): rules cannot admit a
  // malformed index, so one here means a document written before a rule
  // tightened. Counted and skipped rather than thrown — one bad row must
  // not cost the other half million.
  const optionIdx = answer.optionIdx;
  if (typeof optionIdx !== "number" || optionIdx < 0 || optionIdx > 19) {
    state.skipped += 1;
    return "skipped";
  }
  state.counts[String(optionIdx)] = (state.counts[String(optionIdx)] || 0) + 1;
  state.total += 1;
  state.by = breakdownFor(state.qid, state.by, answer.anchors, optionIdx);
  state.folded += 1;
  return "folded";
}

/** Which dimensions came out saturated — see the header's commutativity note. */
export function cappedDims(by: BreakdownCounts): string[] {
  const out: string[] = [];
  for (const dim of BREAKDOWN_DIMS) {
    const buckets = by[dim];
    if (buckets && Object.keys(buckets).length >= BREAKDOWN_MAX_BUCKETS) out.push(dim);
  }
  return out;
}

export function finishFold(state: FoldState): ReplayOutcome {
  return {
    qid: state.qid,
    counts: state.counts,
    total: state.total,
    by: state.by,
    folded: state.folded,
    skipped: state.skipped,
    excluded: state.excluded,
    cappedDims: cappedDims(state.by),
  };
}

/** Batch convenience over the three above — what the tests drive. */
export function replayFold(
  qid: string,
  answers: Iterable<ReplayAnswer>,
  exclude: ReadonlySet<string> = new Set(),
): ReplayOutcome {
  const state = newFold(qid);
  for (const a of answers) foldAnswerInto(state, a, exclude);
  return finishFold(state);
}

// ── the operator callable ───────────────────────────────────────────
//
// Dry by default. `apply` has to be asked for, because this writes the
// document every surface in the app reads, and the runbook that will reach
// for it is one somebody follows during an incident.
//
// Not App Check attested, for the reason the other operator instruments
// are not: the callers are a console and a script, neither of which can
// attest, and a control that fails when it is most needed is not a
// control. `assertOperator` + SEED_ADMIN_UIDS is what stands in its place,
// and `npm run check:appcheck` holds the exemption so it cannot spread by
// copy-paste.
const SCAN_PAGE = 500;

/** A RUNAWAY GUARD, not the real ceiling. At SCAN_PAGE=500 this is 5M
 *  answers; the binding limit arrives long before it, from ops.ts's global
 *  480-second timeout — a few hundred milliseconds a page puts the
 *  practical bound somewhere around one to two million answers. Both are
 *  far past any question this app has, and the distinction matters for the
 *  day one is not: a timeout is the signal to page the rebuild across
 *  invocations (a cursor in a resume document), NOT to raise either number.
 *
 *  What this constant actually stops is a cursor bug looping forever
 *  against a billed collection. Hitting it throws rather than returning a
 *  short answer, because a rebuild that silently folded half the answers
 *  would publish a confident, wrong aggregate — the exact failure D161
 *  rewrote `live.ts`'s bank fetch to avoid. */
const SCAN_MAX_PAGES = 10_000;

export interface RebuildReport {
  qid: string;
  applied: boolean;
  scanned: number;
  folded: number;
  skipped: number;
  excluded: number;
  total: number;
  counts: Record<string, number>;
  cappedDims: string[];
  published: { total: number; counts: Record<string, number> } | null;
  drift: { total: number; counts: Record<string, number> };
  carriedEdits: boolean;
}

export async function runRebuild(
  qid: string,
  opts: { apply: boolean; exclude: ReadonlySet<string> },
): Promise<RebuildReport> {
  const db = firestore();
  // One document since D275 — the vote arm no longer keeps a private copy,
  // so there is exactly one thing to compare against and exactly one to
  // rewrite. (The catalog arm's private accumulator is untouched by this
  // tool, which refuses catalog questions by name.)
  const pubRef = db.collection("v2_question_aggs").doc(qid);

  // Optimistic concurrency, and the reason it is here rather than a
  // transaction: a rebuild reads every answer to the question, which can be
  // hundreds of thousands of documents — far outside anything a Firestore
  // transaction may hold. So the scan runs outside one and the WRITE checks
  // that the stored total has not moved since the scan began. A live answer
  // landing mid-scan aborts the rebuild instead of being erased by it.
  const before = await pubRef.get();
  const beforeTotal = (before.exists && (before.get("total") as number)) || 0;
  // D226's matrix, carried rather than recomputed — see the header.
  const edits = before.exists ? (before.get("edits") as unknown) : undefined;

  const state = newFold(qid);
  let scanned = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    let q = db
      .collectionGroup("answers")
      .where("qid", "==", qid)
      .orderBy("answeredAt", "asc")
      .limit(SCAN_PAGE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      // The two arms this cannot rebuild, refused by name rather than
      // folded into a shape they do not have.
      if (doc.get("entity") !== undefined) {
        throw new HttpsError(
          "failed-precondition",
          `${qid} is a catalog question (D14) — the canon fold is not rebuilt here`,
        );
      }
      if (doc.get("order") !== undefined) {
        throw new HttpsError(
          "failed-precondition",
          `${qid} is a rank question (D233) — the position fold is not rebuilt here`,
        );
      }
      // The answer doc lives at v2_users/{uid}/answers/{qid}; the uid is
      // the grandparent's id and is what the D28 exclusion matches on.
      const uid = doc.ref.parent.parent?.id || "";
      foldAnswerInto(state, { uid, optionIdx: doc.get("optionIdx"), anchors: doc.get("anchors") }, opts.exclude);
      scanned += 1;
    }
    if (snap.size < SCAN_PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
    if (page === SCAN_MAX_PAGES - 1) {
      throw new HttpsError(
        "resource-exhausted",
        `${qid} exceeded ${SCAN_MAX_PAGES} pages — either a cursor bug or a question `
          + "far larger than this tool was built for; do not raise the bound without reading its note",
      );
    }
  }

  const out = finishFold(state);
  const publishedCounts = (before.exists && (before.get("counts") as Record<string, number>)) || {};
  const drift: Record<string, number> = {};
  for (const k of new Set([...Object.keys(out.counts), ...Object.keys(publishedCounts)])) {
    const d = (out.counts[k] || 0) - (publishedCounts[k] || 0);
    if (d !== 0) drift[k] = d;
  }

  if (opts.apply) {
    const now = await pubRef.get();
    const nowTotal = (now.exists && (now.get("total") as number)) || 0;
    if (nowTotal !== beforeTotal) {
      throw new HttpsError(
        "aborted",
        `${qid} took an answer during the scan (${beforeTotal} → ${nowTotal}) — re-run`,
      );
    }
    const payload = {
      counts: out.counts,
      total: out.total,
      by: out.by,
      ...(edits ? { edits } : {}),
    };
    // Same `merge: false` the trigger uses: a rebuild is a whole-document
    // replacement, so a key the fold no longer produces does not survive it.
    await pubRef.set(payload, { merge: false });
    logger.warn(`[replay] rebuilt ${qid}`, {
      metric: "agg_rebuild",
      qid,
      total: out.total,
      excluded: out.excluded,
      driftTotal: out.total - beforeTotal,
    });
  }

  return {
    qid,
    applied: opts.apply,
    scanned,
    folded: out.folded,
    skipped: out.skipped,
    excluded: out.excluded,
    total: out.total,
    counts: out.counts,
    cappedDims: out.cappedDims,
    published: before.exists ? { total: beforeTotal, counts: publishedCounts } : null,
    drift: { total: out.total - beforeTotal, counts: drift },
    carriedEdits: edits !== undefined,
  };
}

export const rebuildAggregateV2 = onCall({ region: REGION }, async (request: CallableRequest) => {
  assertOperator(request);
  const qid = typeof request.data?.qid === "string" ? request.data.qid.trim() : "";
  if (!qid) throw new HttpsError("invalid-argument", "qid required");
  const apply = request.data?.apply === true;
  const raw = Array.isArray(request.data?.exclude) ? request.data.exclude : [];
  const exclude = new Set<string>(raw.filter((u: unknown): u is string => typeof u === "string" && !!u));
  return runRebuild(qid, { apply, exclude });
});
