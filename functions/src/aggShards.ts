// aggShards.ts — the daily lane's aggregate, sharded; and the compactor
// that publishes it (LOG-FIRST-RUNBOOK phase B, D458; the design is
// ANSWER-SCALE.md §4 with DATA-EFFICIENCY.md §3's correction).
//
// THE WALL. Every answer to a question was one transaction on
// v2_question_aggs/{qid}, and Firestore sustains about one write a second
// per document (D7). The feed spreads its answers across the bank; the
// DAILY does not — one question for everyone, answered inside a waking
// window — so the daily lane alone reaches the ceiling, at about 14,400
// DAU (COSTS.md wall 1, `npm run costs`). This file is the remedy the
// record named from the day D98 removed the cadence: sharding, never a
// floor.
//
// WHAT CHANGES, AND WHAT DOES NOT. For a question the daily bank names
// (`SHARDED_QIDS`, read off the compiled bank so a client cannot opt a
// question in by lying about its surface), the trigger no longer reads
// or rewrites the published document. It writes BLIND INCREMENTS to one
// of AGG_SHARDS counter documents — `v2_agg_shards/{qid}-{s}`, `s` the
// person's hash — in the same transaction as the ledger mark and the
// answer map, so idempotence and atomicity are what they were. The
// compactor below sums the shards once a minute and writes
// v2_question_aggs/{qid} in EXACTLY the shape the trigger wrote —
// `counts`, `total`, `by`, `edits` — so every client keeps reading the one
// document it reads today, at the poll it already polls. What a user
// sees is D447's amendment of D98: exact, and never more than a poll
// behind.
//
// WHY INCREMENTS AND NOT A READ-FOLD-WRITE PER SHARD. A blind increment
// commutes with every other, so the shard a person lands in need not be
// stable (an edit after AGG_SHARDS changed lands elsewhere and the SUM is
// still right — a negative cell in one shard against a positive in
// another), and an edit delivered before its create (Eventarc orders
// nothing) folds correctly instead of being refused and retried as
// `retargetCounts` must on the hot document. It also means the shard
// holds its breakdown UNCAPPED — the cap needs the bucket set, which is
// the read this design removes — and the compactor applies the cap over
// the union: the top BREAKDOWN_MAX_BUCKETS buckets a dimension by count,
// the rest to D400's overflow tail, sharded by bucket hash as the trigger
// did. That is a better cap than the trigger's — the hot set is the
// biggest buckets rather than the earliest — and a deterministic one, so
// `replay.ts`'s "arrival order decides the hot map" caveat is gone for a
// sharded question. Per-shard growth is bounded by AGG_SHARDS: a city
// dimension of the whole catalogue splits N ways, and the index
// exemptions in firestore.indexes.json keep its leaves out of the index.
//
// THE BASE SHARD is the migration. A question that was published before
// this shipped has a document holding every count so far, and from the
// deploy on the trigger never touches it again. The compactor, the first
// time it meets a question with no `{qid}-base` document, moves that
// document and its tail into one — in a transaction, so two runs cannot
// both do it — and from then on the base is summed like any shard. A
// rebuild (replay.ts) writes the base and deletes the rest.
//
// THE COMPACTOR IS STATELESS, and the trade is written down. It asks for
// the shards dirtied in the last COMPACT_LOOKBACK_MS and republishes every
// question they name; a run is idempotent — it recomputes from every
// shard — so a shard compacted fifteen times costs reads and changes
// nothing. What a stateless run cannot do is remember an outage: a shard
// dirtied while the schedule was down longer than the lookback is
// republished on that question's next answer or edit, or by the operator
// lever (`compactAggShardsNowV2`), and not before. The daily question is
// answered continuously, so for the question this exists for that is a
// minute; for a year-old daily edited once during a deploy outage, it is
// a stale count until someone touches it, which a cursor document would
// close at the price of one more collection, its rules, its row and its
// own clock-skew argument — the reason it is not built.
//
// COST. The trigger's ordinary daily answer: two reads (the ledger event
// and the profile) where there were three, and one uncontended write
// where there was one contended one. The compactor: one query and
// AGG_SHARDS + 1 reads a minute per question dirtied in the lookback,
// one write of the published document, and the eight tail documents
// whole once a dimension is past the cap — cents a day for the daily,
// `npm run costs` prints the line. No fixed monthly line: Redis, the
// counter store SCALE-ARCHITECTURE.md §3.2 sizes, bills its instance from
// the hour it exists and would be the whole bill many times over at
// today's actives (OWNER-LIST.md); this store costs per operation and the
// compactor is the same compactor, so Redis is a swap of `AggCompactStore`
// and the trigger's one write when the per-answer line says so.
import { FieldValue, type DocumentSnapshot, type Firestore, type Transaction } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { assertOperator, COMPACTOR, FUNCTIONS_REGION, LIGHT_CALLABLE } from "./ops";
import { db as firestore } from "./db";
import { V2_QUESTIONS } from "./v2content";
import {
  BREAKDOWN_DIMS, BREAKDOWN_MAX_BUCKETS, OVERFLOW_SHARDS, breakdownBucket, fnv1a32, overflowDocId, overflowShard,
  type BreakdownCounts, type EditFlow,
} from "./pure";

/** Counter documents per sharded question. Sixteen is sixteen sustained
 *  writes a second on the daily — about 230,000 answers in a four-hour
 *  waking window, sixteen times D7's wall — and sixteen reads a minute
 *  for the compactor. Raise it when the contention alert fires on a
 *  shard; the shard a person lands in need not be stable (the header). */
export const AGG_SHARDS = 16;
export const AGG_SHARDS_COLLECTION = "v2_agg_shards";
/** The migration's shard: the published document as it stood when this
 *  shipped, plus its tail — summed like any other, written by the
 *  compactor's first meeting with the question and by a rebuild. */
export const BASE_SHARD = "base";
/** How far back a run looks for dirtied shards — fifteen runs' worth, so
 *  a run that dies or a minute the scheduler skips is covered fourteen
 *  times over (the header has what a longer outage costs). */
export const COMPACT_LOOKBACK_MS = 15 * 60_000;
/** Shard documents one run will name at most — the daily is AGG_SHARDS + 1
 *  of them; two thousand is more than a hundred questions dirtied in one
 *  window, which is not a daily lane. Past it the run says `capped`. */
export const COMPACT_DIRTY_CAP = 2_000;
/** The lever's window: everything dirtied in a day, for a run after an
 *  outage the lookback could not cover. */
export const COMPACT_LEVER_LOOKBACK_MS = 24 * 60 * 60_000;

/** The questions the trigger shards: the daily bank, off the compiled
 *  content — a fact about the question, never the answer's own `surface`
 *  claim, because a client that could opt a feed question into sharding
 *  would put its counts on a path the feed's own answers do not take. */
export const SHARDED_QIDS: ReadonlySet<string> = new Set(V2_QUESTIONS.filter((q) => q.surface === "daily").map((q) => q.id));
export const isShardedQid = (qid: string): boolean => SHARDED_QIDS.has(qid);

/** The counter shard a person's answers land in. */
export const shardOf = (uid: string, n: number = AGG_SHARDS): number => fnv1a32(uid) % n;
export const shardDocId = (qid: string, s: number | typeof BASE_SHARD): string => `${qid}-${s}`;
export const shardRef = (db: Firestore, qid: string, s: number | typeof BASE_SHARD) =>
  db.collection(AGG_SHARDS_COLLECTION).doc(shardDocId(qid, s));

/** One counter shard as stored — or the base. `qid` is what the
 *  compactor queries on; `dirtyAt` is what it orders by. */
export interface ShardDoc {
  qid?: string;
  s?: number | string;
  counts?: Record<string, number>;
  total?: number;
  by?: BreakdownCounts;
  edits?: EditFlow;
  dirtyAt?: number;
}

type Inc = ReturnType<typeof FieldValue.increment>;

/** The blind write a first answer makes to its shard: +1 on the option,
 *  +1 on the total, +1 on the cell of every dimension the answer's
 *  frozen chips name (D8) — `foldAnchors` as increments, uncapped. */
export function shardIncrements(qid: string, s: number, optionIdx: number, anchors: unknown, nowMs: number): Record<string, unknown> {
  const k = String(optionIdx);
  const by: Record<string, Record<string, Record<string, Inc>>> = {};
  if (anchors && typeof anchors === "object") {
    const src = anchors as Record<string, unknown>;
    for (const dim of BREAKDOWN_DIMS) {
      const bucket = breakdownBucket(src[dim], dim);
      if (bucket === null) continue;
      by[dim] = { [bucket]: { [k]: FieldValue.increment(1) } };
    }
  }
  return { qid, s, counts: { [k]: FieldValue.increment(1) }, total: FieldValue.increment(1), ...(Object.keys(by).length ? { by } : {}), dirtyAt: nowMs };
}

/** The blind write an edit makes (D86): -old/+new on the option and on
 *  every cell the chips name, the total untouched, and one more crossing
 *  in the edit-flow matrix (D226). No skip rule — a cell that never held
 *  the old option goes negative in THIS shard and the sum absorbs it
 *  (the header). */
export function shardEditIncrements(qid: string, s: number, fromIdx: number, toIdx: number, anchors: unknown, nowMs: number): Record<string, unknown> {
  const from = String(fromIdx);
  const to = String(toIdx);
  const move = { [from]: FieldValue.increment(-1), [to]: FieldValue.increment(1) };
  const by: Record<string, Record<string, Record<string, Inc>>> = {};
  if (anchors && typeof anchors === "object") {
    const src = anchors as Record<string, unknown>;
    for (const dim of BREAKDOWN_DIMS) {
      const bucket = breakdownBucket(src[dim], dim);
      if (bucket === null) continue;
      by[dim] = { [bucket]: { ...move } };
    }
  }
  return { qid, s, counts: { ...move }, ...(Object.keys(by).length ? { by } : {}), edits: { [from]: { [to]: FieldValue.increment(1) } }, dirtyAt: nowMs };
}

// ── the compaction, pure ────────────────────────────────────────

export interface SummedShards {
  counts: Record<string, number>;
  total: number;
  by: BreakdownCounts;
  edits: EditFlow;
  /** Cells or options whose sum came out below zero and were dropped — an
   *  edit whose create never folded, or a rebuild racing a fold. Zero on
   *  every honest night; the compactor warns on any. */
  negatives: number;
}

const addInto = (into: Record<string, number>, from: Record<string, number> | undefined): void => {
  for (const [k, n] of Object.entries(from ?? {})) if (typeof n === "number") into[k] = (into[k] || 0) + n;
};

/** Every field folds by addition; a key whose sum is not positive leaves
 *  the map, so the published document never carries a zero or a debt. */
export function sumShards(docs: readonly ShardDoc[]): SummedShards {
  const counts: Record<string, number> = {};
  const by: BreakdownCounts = {};
  const edits: EditFlow = {};
  let total = 0;
  for (const d of docs) {
    addInto(counts, d.counts);
    if (typeof d.total === "number") total += d.total;
    for (const [dim, buckets] of Object.entries(d.by ?? {})) {
      const byDim = by[dim] || (by[dim] = {});
      for (const [bucket, cell] of Object.entries(buckets ?? {})) addInto(byDim[bucket] || (byDim[bucket] = {}), cell);
    }
    for (const [from, row] of Object.entries(d.edits ?? {})) addInto(edits[from] || (edits[from] = {}), row);
  }
  let negatives = 0;
  const prune = (m: Record<string, number>): void => {
    for (const k of Object.keys(m)) {
      if (m[k] > 0) continue;
      if (m[k] < 0) negatives += 1;
      delete m[k];
    }
  };
  prune(counts);
  for (const dim of Object.keys(by)) {
    for (const bucket of Object.keys(by[dim])) {
      prune(by[dim][bucket]);
      if (!Object.keys(by[dim][bucket]).length) delete by[dim][bucket];
    }
    if (!Object.keys(by[dim]).length) delete by[dim];
  }
  for (const from of Object.keys(edits)) {
    prune(edits[from]);
    if (!Object.keys(edits[from]).length) delete edits[from];
  }
  if (total < 0) { negatives += 1; total = 0; }
  return { counts, total, by, edits, negatives };
}

const cellTotal = (cell: Record<string, number>): number => Object.values(cell).reduce((a, b) => a + b, 0);

/**
 * The cap over the union: per dimension the `cap` biggest buckets stay
 * hot, ties by name so two runs agree, and the rest go to the tail shard
 * their name hashes to — the same shard the trigger and the client
 * compute (overflowShard). `overCap` says whether any tail exists at all,
 * which is when the tail documents are written.
 */
export function capBreakdown(by: BreakdownCounts, cap: number = BREAKDOWN_MAX_BUCKETS): { hot: BreakdownCounts; tails: Record<string, BreakdownCounts>; overCap: boolean } {
  const hot: BreakdownCounts = {};
  const tails: Record<string, BreakdownCounts> = {};
  let overCap = false;
  for (const dim of Object.keys(by).sort()) {
    const ranked = Object.entries(by[dim]).sort((a, b) => cellTotal(b[1]) - cellTotal(a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (ranked.length > cap) overCap = true;
    hot[dim] = Object.fromEntries(ranked.slice(0, cap));
    for (const [bucket, cell] of ranked.slice(cap)) {
      const s = String(overflowShard(bucket));
      const shard = tails[s] || (tails[s] = {});
      (shard[dim] || (shard[dim] = {}))[bucket] = cell;
    }
  }
  return { hot, tails, overCap };
}

export interface Published {
  /** The document in the trigger's own shape; `edits` only when there are any. */
  pub: { counts: Record<string, number>; total: number; by: BreakdownCounts; edits?: EditFlow };
  tails: Record<string, BreakdownCounts>;
  overCap: boolean;
  negatives: number;
}

/** Shards in, the published document and its tail out. */
export function publishedFrom(docs: readonly ShardDoc[]): Published {
  const sum = sumShards(docs);
  const { hot, tails, overCap } = capBreakdown(sum.by);
  return {
    pub: { counts: sum.counts, total: sum.total, by: hot, ...(Object.keys(sum.edits).length ? { edits: sum.edits } : {}) },
    tails, overCap, negatives: sum.negatives,
  };
}

/** The base shard a published document and its tail become: the hot map
 *  and every tail cell as one uncapped map (a bucket lives in exactly one
 *  of the two, so the union is a plain merge, never a sum). */
export function baseFrom(qid: string, pub: ShardDoc | null, tails: readonly (BreakdownCounts | null)[], nowMs: number): ShardDoc & { migrated: true } {
  const by: BreakdownCounts = {};
  const take = (src: BreakdownCounts | null | undefined): void => {
    for (const [dim, buckets] of Object.entries(src ?? {})) {
      const byDim = by[dim] || (by[dim] = {});
      for (const [bucket, cell] of Object.entries(buckets ?? {})) byDim[bucket] = { ...(byDim[bucket] ?? {}), ...cell };
    }
  };
  take(pub?.by);
  for (const t of tails) take(t);
  return {
    qid, s: BASE_SHARD, counts: { ...(pub?.counts ?? {}) }, total: pub?.total ?? 0, by,
    ...(pub?.edits && Object.keys(pub.edits).length ? { edits: pub.edits } : {}),
    dirtyAt: nowMs, migrated: true,
  };
}

// ── the compactor ───────────────────────────────────────────────

export interface AggCompactStore {
  /** The questions with a shard dirtied at or after `sinceMs`, at most
   *  `cap` shard documents' worth; `capped` when the page was full. */
  dirtyQids(sinceMs: number, cap: number): Promise<{ qids: string[]; capped: boolean }>;
  /** Every shard of one question, the base included where it exists. */
  shardsOf(qid: string): Promise<ShardDoc[]>;
  /** The migration (the header): make the base from the published
   *  document and its tail, once, in a transaction. Returns the base
   *  when this call created it, null when one already existed. */
  ensureBase(qid: string, nowMs: number): Promise<ShardDoc | null>;
  publish(qid: string, out: Published): Promise<void>;
}

export interface AggCompactSummary {
  qids: number;
  shards: number;
  published: number;
  migrated: number;
  negatives: number;
  /** The dirty page was full: more questions were waiting than one run names. */
  capped: boolean;
  /** The clock ended the run before every dirty question was published. */
  stopped: boolean;
  /** Every dirty question was published — the heartbeat's own sentence. */
  clean: boolean;
}

/**
 * One run: the dirty questions (or the ones named), each read whole,
 * summed, capped and published. Idempotent per question — a run
 * recomputes from every shard, so running twice publishes the same
 * document twice.
 */
export async function runAggCompaction(
  store: AggCompactStore,
  nowMs: number,
  log: Pick<typeof logger, "info" | "warn"> = logger,
  opts: { deadlineAt?: number; clock?: () => number; qids?: readonly string[]; lookbackMs?: number } = {},
): Promise<AggCompactSummary> {
  const clock = opts.clock ?? Date.now;
  const deadlineAt = opts.deadlineAt ?? Number.POSITIVE_INFINITY;
  const asked = opts.qids
    ? { qids: opts.qids, capped: false }
    : await store.dirtyQids(nowMs - (opts.lookbackMs ?? COMPACT_LOOKBACK_MS), COMPACT_DIRTY_CAP);
  // In id order whatever the store returned, so a run the clock ends
  // stops at a predictable place and two runs agree on what came first.
  const dirty = { qids: [...new Set(asked.qids)].sort(), capped: asked.capped };
  let shards = 0;
  let published = 0;
  let migrated = 0;
  let negatives = 0;
  let stopped = false;
  for (const qid of dirty.qids) {
    if (clock() > deadlineAt) { stopped = true; break; }
    const docs = await store.shardsOf(qid);
    if (!docs.some((d) => d.s === BASE_SHARD)) {
      const base = await store.ensureBase(qid, nowMs);
      if (base) { docs.push(base); migrated += 1; }
    }
    const out = publishedFrom(docs);
    await store.publish(qid, out);
    shards += docs.length;
    published += 1;
    negatives += out.negatives;
  }
  const clean = !dirty.capped && !stopped;
  const summary: AggCompactSummary = { qids: dirty.qids.length, shards, published, migrated, negatives, capped: dirty.capped, stopped, clean };
  // The heartbeat — monitoring/compactAggShardsV2-silent.json watches for
  // this line's ABSENCE, so it logs on every run, an idle one included:
  // an idle minute is a compactor that is alive, and only a missing
  // minute is one that is not.
  (clean && !negatives ? log.info : log.warn)(
    `[agg] compacted ${published} of ${dirty.qids.length} dirty question(s) from ${shards} shard(s)`
    + (migrated ? `, ${migrated} migrated to a base shard` : "")
    + (negatives ? ` — ${negatives} cell(s) summed below zero and were dropped` : "")
    + (dirty.capped ? ` — MORE than ${COMPACT_DIRTY_CAP} shards were dirty; the rest wait a minute` : "")
    + (stopped ? " — STOPPED on the clock with questions unpublished; they are still dirty for the next run" : ""),
    { metric: "agg_compact", ...summary },
  );
  return summary;
}

/** The replay's concurrency stamp over a question's shards (replay.ts):
 *  every shard's id and write time, sorted — any fold during the scan
 *  changes it. Undefined when a shard carries no write time, which the
 *  replay refuses on rather than guesses about; "" for no shards. */
export function shardsStamp(snaps: readonly DocumentSnapshot[]): string | undefined {
  const parts: string[] = [];
  for (const d of snaps) {
    const t = d.updateTime;
    if (!t) return undefined;
    parts.push(`${d.id}:${t.seconds}.${t.nanoseconds}`);
  }
  return parts.sort().join("|");
}

/** A query's snapshot as shard documents, the base's `s` kept as its name. */
const shardDocsOf = (snaps: readonly DocumentSnapshot[]): ShardDoc[] =>
  snaps.filter((d) => d.exists).map((d) => d.data() as ShardDoc);

export function firestoreAggCompactStore(db: Firestore): AggCompactStore {
  const shardsQuery = (qid: string) => db.collection(AGG_SHARDS_COLLECTION).where("qid", "==", qid);
  return {
    async dirtyQids(sinceMs, cap) {
      // One more than the cap, so a full page is a fact and not a guess.
      const snap = await db.collection(AGG_SHARDS_COLLECTION).where("dirtyAt", ">=", sinceMs).orderBy("dirtyAt").limit(cap + 1).get();
      const capped = snap.size > cap;
      const qids = new Set<string>();
      for (const d of snap.docs.slice(0, cap)) {
        const qid = d.get("qid");
        if (typeof qid === "string" && qid) qids.add(qid);
      }
      return { qids: [...qids].sort(), capped };
    },
    async shardsOf(qid) {
      return shardDocsOf((await shardsQuery(qid).get()).docs);
    },
    async ensureBase(qid, nowMs) {
      const baseRef = shardRef(db, qid, BASE_SHARD);
      const pubRef = db.collection("v2_question_aggs").doc(qid);
      const tailRefs = Array.from({ length: OVERFLOW_SHARDS }, (_, s) => db.collection("v2_agg_overflow").doc(overflowDocId(qid, s)));
      return db.runTransaction(async (tx: Transaction) => {
        const existing = await tx.get(baseRef);
        if (existing.exists) return null;
        const [pub, ...tails] = await tx.getAll(pubRef, ...tailRefs);
        const base = baseFrom(qid, pub.exists ? (pub.data() as ShardDoc) : null, tails.map((t) => (t.exists ? (t.data() as BreakdownCounts) : null)), nowMs);
        tx.create(baseRef, base);
        return base;
      });
    },
    async publish(qid, out) {
      const batch = db.batch();
      batch.set(db.collection("v2_question_aggs").doc(qid), out.pub, { merge: false });
      // The tail, whole, the moment any dimension is past the cap — the
      // eight documents, empty ones included, so a bucket that moved from
      // the tail to the hot map is not still found in a stale shard by a
      // reader who looks (replay.ts writes the tail the same way).
      if (out.overCap) {
        for (let s = 0; s < OVERFLOW_SHARDS; s++) {
          batch.set(db.collection("v2_agg_overflow").doc(overflowDocId(qid, s)), out.tails[String(s)] ?? {}, { merge: false });
        }
      }
      await batch.commit();
    },
  };
}

export const compactAggShardsV2 = onSchedule(
  // Every minute — the interval the deck poll already reads at
  // (AGG_POLL_MS, src/v2/data/live.ts), so a card's count is exact and
  // never more than a poll behind (D447's amendment of D98). The
  // function's own timeout (COMPACTOR, ops.ts) is under the interval, so
  // two runs never overlap; if they did, both would publish the same sums.
  { schedule: "* * * * *", region: FUNCTIONS_REGION, ...COMPACTOR },
  async () => {
    const now = Date.now();
    await runAggCompaction(firestoreAggCompactStore(firestore()), now, logger, { deadlineAt: now + COMPACTOR.timeoutSeconds * 1000 - 10_000 });
  },
);

/** The operator lever: publish one question now, or everything dirtied in
 *  the last day — after an outage longer than the lookback, or from the
 *  e2e, which cannot wait a minute for the schedule. */
export const compactAggShardsNowV2 = onCall(
  { ...LIGHT_CALLABLE, region: FUNCTIONS_REGION },
  async (request: CallableRequest) => {
    assertOperator(request);
    const qid = typeof request.data?.qid === "string" && request.data.qid ? request.data.qid : null;
    try {
      return await runAggCompaction(firestoreAggCompactStore(firestore()), Date.now(), logger, qid ? { qids: [qid] } : { lookbackMs: COMPACT_LEVER_LOOKBACK_MS });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", `compaction failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);
