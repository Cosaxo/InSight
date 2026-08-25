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
// ALL THREE FOLD ARMS are rebuilt. That was not true when this file was
// written — it did the vote arm and refused the other two by name, which
// made "every aggregate is a projection you can rebuild" true of exactly
// one arm out of three, and left a corrupted catalog board with no repair
// path at all. `armFor` routes by the QUESTION's type; each arm reuses the
// same pure.ts helpers the trigger uses.
//
// What each arm can promise, which differs and is worth knowing before
// trusting a report:
//
//   · RANK is exactly replayable, with no caveat. Position sums are plain
//     addition — commutative, associative, nothing to evict — so a rank
//     rebuild is not "a correct fold", it is THE fold.
//   · VOTE is exact below a saturated dimension; see the commutativity
//     note above.
//   · CATALOG has an exact accumulator (`ent`, `total`, and therefore
//     `top` and `rest` — plain counting) and an order-dependent
//     per-segment `by`, which carries both the bucket cap and
//     foldCanonAnchors' own per-cell entity cap.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db as firestore } from "./db";
import { assertOperator, FUNCTIONS_REGION } from "./ops";
// The trigger's own breakdown helper, imported rather than reimplemented.
// Its header says why it is a named function at all: "the trigger, the edit
// path and the catalog path all want the same one, and three copies is how
// they drift". A replay that folded anchors its own way would be a fourth.
import { breakdownFor, CANON_TOP_N, CATALOG_DOMAINS } from "./v2";
import {
  BREAKDOWN_DIMS,
  BREAKDOWN_MAX_BUCKETS,
  canonBreakdownFor,
  canonTopN,
  catalogEntityKey,
  foldCanonAnchors,
  foldRankOrder,
  validRankOrder,
  type BreakdownCounts,
  type CanonCounts,
} from "./pure";

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

// ── the RANK arm (D233) ─────────────────────────────────────────────
//
// An answer carries `order` — the item indexes in the answerer's sequence
// — and the aggregate is per-item POSITION SUMS plus a total, which is
// enough for a crowd order by mean position. No `by` map, deliberately:
// the Mirror's cohort folds read option shares, which an order does not
// have (v2.ts's rank arm has the argument).
//
// THIS ONE IS EXACTLY REPLAYABLE, with no caveat at all — the strongest
// of the three. Position sums are plain addition, so the fold is
// commutative AND associative with nothing to evict, which means the
// order-dependence the vote arm carries above a saturated dimension has no
// analogue here. A rank rebuild is not "a correct fold", it is THE fold.

export interface RankAnswer {
  uid: string;
  order: unknown;
}

export interface RankFoldState {
  qid: string;
  itemCount: number;
  pos: number[];
  total: number;
  folded: number;
  skipped: number;
  excluded: number;
}

export function newRankFold(qid: string, itemCount: number): RankFoldState {
  return {
    qid,
    itemCount,
    pos: new Array<number>(itemCount).fill(0),
    total: 0,
    folded: 0,
    skipped: 0,
    excluded: 0,
  };
}

export function foldRankAnswerInto(
  state: RankFoldState,
  answer: RankAnswer,
  exclude: ReadonlySet<string> = new Set(),
): "folded" | "skipped" | "excluded" {
  if (exclude.has(answer.uid)) {
    state.excluded += 1;
    return "excluded";
  }
  // Same validity gate as the trigger: a non-permutation never aggregated
  // in the first place, so a rebuild must not admit one either.
  const order = validRankOrder(answer.order, state.itemCount);
  if (order === null) {
    state.skipped += 1;
    return "skipped";
  }
  foldRankOrder(state.pos, order);
  state.total += 1;
  state.folded += 1;
  return "folded";
}

// ── the CATALOG arm (D14/D17) ───────────────────────────────────────
//
// An answer carries `entity` — one pick from a shipped catalogue — and the
// fold keeps every entity in `ent` while publishing only `canonTopN`'s
// board. That projection is why the catalog arm still has a private
// document (D290): the board cannot be folded from.
//
// A rebuild reconstructs the accumulator rather than the board, then
// projects, which is the same order the trigger does it in.
//
// Order-dependent for the same reason the vote breakdown is, and one more:
// `foldCanonAnchors` carries BOTH the bucket cap and its own per-cell
// entity cap (CANON_BY_MAX_ENTITIES). `ent` itself is exact — plain
// counting, nothing evicts — so `top`, `rest` and `total` are exact and
// only the per-segment `by` can differ from what was published.

export interface CanonAnswer {
  uid: string;
  entity: unknown;
  anchors: unknown;
}

export interface CanonFoldState {
  qid: string;
  domain: string;
  ent: CanonCounts;
  entBy: BreakdownCounts;
  total: number;
  folded: number;
  skipped: number;
  excluded: number;
}

export function newCanonFold(qid: string, domain: string): CanonFoldState {
  return { qid, domain, ent: {}, entBy: {}, total: 0, folded: 0, skipped: 0, excluded: 0 };
}

export function foldCanonAnswerInto(
  state: CanonFoldState,
  answer: CanonAnswer,
  exclude: ReadonlySet<string> = new Set(),
): "folded" | "skipped" | "excluded" {
  if (exclude.has(answer.uid)) {
    state.excluded += 1;
    return "excluded";
  }
  // The domain decides which key space validates the entity — the same
  // single source the trigger reads, imported rather than copied.
  const spec = CATALOG_DOMAINS[state.domain];
  if (!spec) {
    state.skipped += 1;
    return "skipped";
  }
  const key = catalogEntityKey(answer.entity, spec);
  if (key === null) {
    state.skipped += 1;
    return "skipped";
  }
  state.ent[key] = (state.ent[key] || 0) + 1;
  state.total += 1;
  foldCanonAnchors(state.entBy, answer.anchors, key);
  state.folded += 1;
  return "folded";
}

/** The published board, built from the accumulator exactly as the trigger
 *  builds it. Kept beside the fold so the two cannot drift. */
export function canonPublishable(state: CanonFoldState) {
  const canon = canonTopN(state.ent, CANON_TOP_N);
  return {
    total: state.total,
    top: canon.top,
    rest: canon.rest,
    by: canonBreakdownFor(state.entBy, canon.top),
  };
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
/**
 * A document's write stamp: `null` when it does not exist, a
 * seconds.nanoseconds string when Firestore stamped it, and `undefined`
 * when it exists but carries no stamp.
 *
 * Seconds and nanoseconds rather than millis, because two folds inside one
 * millisecond is not hypothetical — it is D7's contention case, which is
 * the situation somebody runs a rebuild in.
 *
 * The three-way return is deliberate and the `undefined` arm is the point.
 * An earlier draft returned the string "unknown" there, which compares
 * EQUAL to itself — so an unstamped document would have read as "nothing
 * changed" and waved the write through, fail-open on the one path where
 * the guard cannot actually see anything. The caller treats `undefined` as
 * "cannot verify" and refuses, the way D65's `hidden` equality fails
 * closed. Unreachable for a server read today; unreachable is not a reason
 * to be wrong about it.
 */
export function docStamp(
  snap: FirebaseFirestore.DocumentSnapshot,
): string | null | undefined {
  if (!snap.exists) return null;
  const t = snap.updateTime;
  return t ? `${t.seconds}.${t.nanoseconds}` : undefined;
}

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
  /** Which fold was rebuilt. Reported rather than inferred by the reader:
   *  `counts` is empty on the rank and catalog arms by construction, and a
   *  report that did not say which arm ran would read as "no votes". */
  arm: ReplayArm;
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

/** Which fold an answer to this question goes through. Decided by the
 *  QUESTION's type rather than by sniffing the first answer's shape: the
 *  rules admit only one shape per type, so the question is the authority,
 *  and a stray answer of the wrong shape is then an anomaly this reports
 *  instead of an arm it silently switches to. */
export type ReplayArm = "vote" | "rank" | "catalog";

/**
 * Why this tool cannot address a question, or null when it can.
 *
 * The scan keys on the BANK ID — `collectionGroup("answers").where("qid",
 * "==", qid)` — and two surfaces break that assumption in opposite ways.
 *
 * PULSE aggregates are keyed `{qid}_{day}`, and a pulse answer carries that
 * composite as its own `qid`. So the bank id matches no answer at all: a
 * rebuild scanned zero rows, computed zero drift, and reported success,
 * which rebuild-aggregate.mjs prints as "drift: none — the published
 * aggregate already matches the answers". A repair tool handing back a
 * clean bill for an aggregate it cannot see is worse during an incident
 * than one that refuses. Passing the composite instead fails the bank
 * lookup, so the day's aggregate has no address here either way — and
 * saying so is the honest answer until it has one.
 *
 * GROUP and DUO answers are sealed duel votes, and onV2AnswerCreated
 * returns before the world fold precisely because of that. Rebuilding one
 * would not repair an aggregate; it would MINT a public one the trigger
 * deliberately never writes, out of votes that are supposed to stay sealed
 * until their reveal. The header's claim to mirror the vote arm exactly was
 * false on this guard alone.
 *
 * A predicate rather than an inline throw so it can be tested: runRebuild
 * itself needs Firestore, and this decision does not.
 */
export function rebuildRefusal(surface: unknown): string | null {
  const s = typeof surface === "string" ? surface : "";
  if (s === "pulse") {
    return "pulse aggregates are keyed {qid}_{day}; this tool addresses bank ids, "
      + "so it can neither see the day's answers nor name the day's aggregate";
  }
  if (s === "group" || s === "duo") {
    return `answers on the "${s}" surface are sealed duel votes; the trigger writes `
      + "no world aggregate for them, so a rebuild would mint one rather than repair it";
  }
  return null;
}

export function armFor(questionType: unknown): ReplayArm {
  if (questionType === "catalog") return "catalog";
  if (questionType === "rank") return "rank";
  // Every other type in the bank — binary, choice, vote, scale, rating,
  // dial, dilemma, pulse, field, path — folds through optionIdx.
  return "vote";
}

export async function runRebuild(
  qid: string,
  opts: { apply: boolean; exclude: ReadonlySet<string> },
): Promise<RebuildReport> {
  const db = firestore();
  const pubRef = db.collection("v2_question_aggs").doc(qid);
  // Catalog alone still keeps a private accumulator (D290), because its
  // published board is canonTopN's lossy projection. For that arm the
  // private document is what a fold reads, so it is also what the
  // concurrency guard has to watch.
  const privRef = db.collection("v2_aggs_private").doc(qid);

  const qSnap = await db.collection("v2_questions").doc(qid).get();
  if (!qSnap.exists) {
    throw new HttpsError("not-found", `${qid} is not in the question bank`);
  }
  // Refused before any scan: a surface this tool cannot address must say so
  // rather than scan nothing and report health. See rebuildRefusal.
  const refusal = rebuildRefusal(qSnap.get("surface"));
  if (refusal) {
    throw new HttpsError("failed-precondition", `${qid}: ${refusal}`);
  }
  const arm = armFor(qSnap.get("type"));
  const accRef = arm === "catalog" ? privRef : pubRef;

  const before = await accRef.get();
  const beforeTotal = (before.exists && (before.get("total") as number)) || 0;
  const beforeStamp = docStamp(before);
  // D226's matrix, carried rather than recomputed — see the header. Vote
  // arm only: rank and catalog answers have no edit path (D86 admits an
  // optionIdx move and nothing else), so neither aggregate has the field.
  const edits = arm === "vote" && before.exists ? (before.get("edits") as unknown) : undefined;

  // Per-arm setup that needs the question document.
  const itemCount = ((qSnap.get("options") as unknown[] | undefined) || []).length;
  const domain = String(qSnap.get("domain") || "");
  if (arm === "rank" && itemCount === 0) {
    throw new HttpsError("failed-precondition", `${qid} is a rank question with no options`);
  }
  if (arm === "catalog" && !CATALOG_DOMAINS[domain]) {
    throw new HttpsError(
      "failed-precondition",
      `${qid} names catalogue domain "${domain}", which has no key space here`,
    );
  }

  const vote = newFold(qid);
  const rank = newRankFold(qid, itemCount);
  const canon = newCanonFold(qid, domain);
  let scanned = 0;
  let wrongShape = 0;
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
      // The answer doc lives at v2_users/{uid}/answers/{qid}; the uid is
      // the grandparent's id and is what the D28 exclusion matches on.
      const uid = doc.ref.parent.parent?.id || "";
      scanned += 1;
      if (arm === "catalog") {
        if (doc.get("entity") === undefined) { wrongShape += 1; continue; }
        foldCanonAnswerInto(canon, { uid, entity: doc.get("entity"), anchors: doc.get("anchors") }, opts.exclude);
      } else if (arm === "rank") {
        if (doc.get("order") === undefined) { wrongShape += 1; continue; }
        foldRankAnswerInto(rank, { uid, order: doc.get("order") }, opts.exclude);
      } else {
        if (doc.get("entity") !== undefined || doc.get("order") !== undefined) { wrongShape += 1; continue; }
        foldAnswerInto(vote, { uid, optionIdx: doc.get("optionIdx"), anchors: doc.get("anchors") }, opts.exclude);
      }
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

  // One shape for the report, whichever arm produced it.
  const out = arm === "vote" ? finishFold(vote) : null;
  const total = arm === "vote" ? vote.total : arm === "rank" ? rank.total : canon.total;
  const folded = arm === "vote" ? vote.folded : arm === "rank" ? rank.folded : canon.folded;
  const skipped = (arm === "vote" ? vote.skipped : arm === "rank" ? rank.skipped : canon.skipped) + wrongShape;
  const excluded = arm === "vote" ? vote.excluded : arm === "rank" ? rank.excluded : canon.excluded;

  // `counts` is the vote arm's shape. The other two report their own, and
  // the drift comparison below is on `total` for them — a per-item
  // position sum and a canon board do not have "counts" to diff, and
  // inventing a comparison that looks like one would be worse than saying
  // so. `total` is exact on every arm, which is what a drift check needs.
  const counts = arm === "vote" ? vote.counts : {};
  const publishedCounts = (arm === "vote" && before.exists
    && (before.get("counts") as Record<string, number>)) || {};
  const drift: Record<string, number> = {};
  for (const k of new Set([...Object.keys(counts), ...Object.keys(publishedCounts)])) {
    const d = (counts[k] || 0) - (publishedCounts[k] || 0);
    if (d !== 0) drift[k] = d;
  }

  if (opts.apply) {
    const now = await accRef.get();
    const nowStamp = docStamp(now);
    if (beforeStamp === undefined || nowStamp === undefined) {
      throw new HttpsError(
        "aborted",
        `${qid}'s aggregate carries no write stamp, so a concurrent fold cannot be `
          + "ruled out — refusing rather than overwriting on an unverifiable read",
      );
    }
    if (nowStamp !== beforeStamp) {
      const nowTotal = (now.exists && (now.get("total") as number)) || 0;
      throw new HttpsError(
        "aborted",
        `${qid} was written during the scan (total ${beforeTotal} → ${nowTotal}`
          + `${nowTotal === beforeTotal ? ", an edit — the total does not move" : ""}) — re-run`,
      );
    }
    // Same `merge: false` the trigger uses: a rebuild is a whole-document
    // replacement, so a key the fold no longer produces does not survive it.
    if (arm === "catalog") {
      // Both documents, because the private one is a real accumulator and
      // the public one is its projection — writing only one would leave
      // the next answer folding from a board it cannot fold from.
      await privRef.set({ ent: canon.ent, entBy: canon.entBy, total: canon.total }, { merge: false });
      await pubRef.set(canonPublishable(canon), { merge: false });
    } else if (arm === "rank") {
      await pubRef.set({ total: rank.total, pos: rank.pos }, { merge: false });
    } else {
      await pubRef.set(
        { counts: vote.counts, total: vote.total, by: vote.by, ...(edits ? { edits } : {}) },
        { merge: false },
      );
    }
    logger.warn(`[replay] rebuilt ${qid}`, {
      metric: "agg_rebuild",
      qid,
      arm,
      total,
      excluded,
      driftTotal: total - beforeTotal,
    });
  }

  return {
    qid,
    arm,
    applied: opts.apply,
    scanned,
    folded,
    skipped,
    excluded,
    total,
    counts,
    // Only the vote arm's `by` saturates in a way a reader must be warned
    // about; the canon arm's per-segment map has the same caps, so it is
    // reported too. Rank has no breakdown at all and always reports none.
    cappedDims: arm === "vote" ? out!.cappedDims : arm === "catalog" ? cappedDims(canon.entBy) : [],
    published: before.exists ? { total: beforeTotal, counts: publishedCounts } : null,
    drift: { total: total - beforeTotal, counts: drift },
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
