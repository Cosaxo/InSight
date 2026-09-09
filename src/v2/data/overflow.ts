// overflow.ts — the breakdown cap's tail, read side (D400).
//
// `v2_question_aggs.by[dim]` holds at most BREAKDOWN_MAX_BUCKETS values a
// dimension (functions/src/pure.ts) — the cells almost every reader wants,
// and a bound on the hot document's size. Past it the trigger evicts or
// refuses, and since D400 the cell goes to the question's TAIL:
// `v2_agg_overflow/{qid}-{shard}`, eight shards by bucket hash, every city
// and country cell the hot map cannot hold. hot ∪ tail is exact and a
// bucket lives in exactly one of the two, so a device that finds its own
// city missing from a hot map AT the cap reads the one shard that city
// hashes to and merges the cell in — one read per such question, once
// per session, and nothing at all for a question under the cap or for a
// city the hot map holds. Under the cap, absent still means zero
// (cohort.ts's rule); at the cap, absent means "in the tail", and this
// module is what tells the two apart.
//
// THE HASH IS THE SERVER'S. `overflowShard` is FNV-1a over UTF-16 code
// units mod OVERFLOW_SHARDS, byte for byte what functions/src/pure.ts
// computes; overflow.test.ts pins the same vectors both suites pin, and
// reads the server's constants off its source so the two packages cannot
// drift apart without a red gate. The document id is derived, never
// listed, which is what keeps the read to one shard.
//
// THE SDK IS BOUND LAZILY, never imported (D122): live.ts imports this
// module statically and live.ts is on the first-paint path, so a static
// `import { getDocs } from "firebase/firestore"` here drags the whole
// Firestore client into the eager graph — measured before this shipped:
// 634 KB → 961 KB against a 642 KB ceiling, `check:bundle` red. The
// voters module's shape is the rule: a type from the SDK, the functions
// off `getFirestoreApi()` at call time.
import { getFirestoreApi } from "../../lib/firebase";
import type { Firestore } from "firebase/firestore";
import type { AggDoc } from "./deck";

/** functions/src/pure.ts OVERFLOW_SHARDS, mirrored. */
export const OVERFLOW_SHARDS = 8;
/** functions/src/pure.ts BREAKDOWN_MAX_BUCKETS, mirrored — the hot map's
 * size at which a missing bucket may be in the tail. */
export const OVERFLOW_HOT_CAP = 24;
/** Firestore's `in` takes 30 ids. */
const IN_CHUNK = 30;

export function overflowShard(bucket: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bucket.length; i++) {
    h ^= bucket.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % OVERFLOW_SHARDS;
}

export const overflowDocId = (qid: string, bucket: string): string => `${qid}-${overflowShard(bucket)}`;

export type Cell = Record<string, number>;

/**
 * The questions whose shard is worth a read for this viewer: the hot map
 * for `dim` is at the cap and lacks `key`. Everything else is decided
 * from the hot document alone — under the cap an absent bucket is zero,
 * and a present bucket is the whole count.
 */
export function overflowWanted(
  aggs: Readonly<Record<string, AggDoc | null | undefined>>,
  qids: readonly string[],
  dim: string,
  key: string,
): string[] {
  const out: string[] = [];
  for (const qid of qids) {
    const byDim = aggs[qid]?.by?.[dim];
    if (!byDim || byDim[key]) continue;
    if (Object.keys(byDim).length >= OVERFLOW_HOT_CAP) out.push(qid);
  }
  return out;
}

export interface OverflowCell { qid: string; dim: string; key: string; cell: Cell }

/**
 * The viewer's cell from each wanted question's shard. One `documentId()
 * in` query per 30 shards; a shard that does not exist, or exists without
 * the key, contributes nothing — the hot map's absence stands as zero.
 * `read` is the number of shard documents that came back, for the store's
 * read tally.
 */
export async function fetchOverflowCells(
  db: Firestore,
  qids: readonly string[],
  dim: string,
  key: string,
): Promise<{ cells: OverflowCell[]; read: number }> {
  const cells: OverflowCell[] = [];
  let read = 0;
  if (!qids.length) return { cells, read };
  const { collection, documentId, getDocs, query, where } = await getFirestoreApi();
  const idToQid = new Map<string, string>();
  for (const qid of qids) idToQid.set(overflowDocId(qid, key), qid);
  const ids = [...idToQid.keys()];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const snap = await getDocs(query(collection(db, "v2_agg_overflow"), where(documentId(), "in", chunk)));
    read += snap.size;
    for (const d of snap.docs) {
      const qid = idToQid.get(d.id);
      const cell = (d.data() as Record<string, Record<string, Cell>>)[dim]?.[key];
      if (qid && cell) cells.push({ qid, dim, key, cell: { ...cell } });
    }
  }
  return { cells, read };
}

/** The hot document with the viewer's tail cell filled in — a new object;
 * the input is not touched, so a cached document is never mutated in
 * place under a render that holds it. */
export function withOverflowCell(agg: AggDoc, dim: string, key: string, cell: Cell): AggDoc {
  return { ...agg, by: { ...(agg.by ?? {}), [dim]: { ...(agg.by?.[dim] ?? {}), [key]: { ...cell } } } };
}
