// rank.ts — the nightly published serving order (D313; the spine D314's
// profile will choose from). The arithmetic is pure and injected-store
// tested (the patterns.ts shape, one job over); this file decides WHAT
// is ranked and WHERE the order lives.
//
// WHY A PUBLISHED ORDER EXISTS AT ALL. D313 pages the bank: a device
// stops being handed every question and fetches what a screen actually
// reaches. Pages need an order to page BY, and the order has to be the
// same for everyone at zero marginal reads — so it is computed once a
// night here and published onto one small doc per surface, exactly the
// fitPatternsV2 → v2_patterns/loadings shape. A device reads the order
// doc (one read), then fetches question documents as it reaches them.
// Per-request ranking — the naive recommender — would bill per
// impression; this bills O(bank) reads per NIGHT and O(pages actually
// read) per device, which is the whole cost argument of D313.
//
// THE ORDER'S BASIS, v1: crowd volume, with landslides sunk. Volume
// (the aggregate's `total`) is the one global signal every question
// already publishes, and it is personal to nobody — D163/D314's line
// holds because this fold never reads a uid. The sink is D313 phase 4's
// first signal: a question ≥ RANK_DEAD_MIN answers whose leading option
// holds ≥ RANK_DEAD_SHARE of them is the scorecard's landslide — a
// correct average nobody needs to be asked (the retire-proposal
// predicate) — and it serves LAST in its topic rather than waiting for
// a human to read a retire proposal. Deletion stays the lane's;
// `active: false` stays the kill switch; this only orders.
//
// SURFACES: feed and learn — the two D313 unbounds. The daily is
// positional by design (cohort comparison needs everyone on the same
// question), and test/duel/pulse/call are bounded rosters (D213's
// census) a device still takes whole.
//
// SIZE, measured not hoped: an order doc holds qids and totals only.
// At 10,000 feed questions across ~12 topics the doc is ~150 KB —
// well under the 1 MiB document limit. The graduation when a surface
// approaches it is one doc per topic (the read stays one doc per
// TOPIC a device actually renders); recorded here so the next author
// shards instead of trimming.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
// ops.ts sets the global runtime options as an import side effect and must
// stay imported wherever a function is declared (check:fn-runtime).
import { LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { V2_QUESTIONS, type V2SeedQuestion } from "./v2content";
import { db as firestore } from "./db";
import { utcDay } from "./pure";

/** The surfaces the order covers — the two D313 pages. */
export const RANK_SURFACES = ["feed", "learn"] as const;
export type RankSurface = (typeof RANK_SURFACES)[number];

/** The landslide sink (D313 phase 4's first signal): at this many answers
 * with the leading option at this share, a question has stopped asking
 * anything and serves last in its topic. The numbers are the scorecard's
 * own retire-proposal floor, kept equal on purpose — one predicate,
 * spelled twice, is how the two would drift apart. */
export const RANK_DEAD_MIN = 20;
export const RANK_DEAD_SHARE = 0.9;

export interface RankAgg {
  total: number;
  counts: Record<string, number>;
}

export interface RankTopicOrder {
  /** Serving order, best first; landslides at the tail. */
  qids: string[];
  /** Answers across the topic — the topic sheet's honest count feed. */
  total: number;
}

export interface RankDoc {
  /** The day the fold ran for, so a device can tell a stale order. */
  day: string;
  basis: string;
  topics: Record<string, RankTopicOrder>;
}

/** The I/O the fold needs, as an interface (patterns.ts's precedent) —
 * the ordering logic is testable without any Firestore shape. */
export interface RankStore {
  /** Aggregates for these qids; absent means unanswered. */
  aggsFor(qids: string[]): Promise<Map<string, RankAgg>>;
  putOrder(surface: RankSurface, doc: RankDoc): Promise<void>;
}

const BASIS = "volume desc, landslides sink (D313); ties by seq";

/** Landslide: enough answers that the split is believed, and a leading
 * option holding nearly all of them. */
export function isLandslide(agg: RankAgg | undefined): boolean {
  if (!agg || agg.total < RANK_DEAD_MIN) return false;
  const top = Math.max(0, ...Object.values(agg.counts));
  return top / agg.total >= RANK_DEAD_SHARE;
}

/** In the serving window, live.ts's own rule (both boundaries inclusive):
 * a `now` question past its UTC day stops being OFFERED, and one written
 * for next week is not offered early. */
function inWindow(q: V2SeedQuestion, today: string): boolean {
  return (!q.until || q.until >= today) && (!q.from || q.from <= today);
}

/**
 * The whole order, pure. Roster from the seeded bank (the same compiled
 * source PATTERNS_QIDS trusts), aggregates injected, day injected — so a
 * test can hold every input still.
 */
export function computeRank(
  bank: readonly V2SeedQuestion[],
  aggs: Map<string, RankAgg>,
  today: string,
): Record<RankSurface, RankDoc> {
  const out = {} as Record<RankSurface, RankDoc>;
  // Once, not per row: the fold exists for banks where a find-per-row
  // would be quadratic in exactly the regime the order is built for.
  const seqOf = new Map(bank.map((q) => [q.id, q.seq ?? 0]));
  for (const surface of RANK_SURFACES) {
    const roster = bank.filter(
      (q) => q.surface === surface && q.active !== false && inWindow(q, today),
    );
    const topics: Record<string, RankTopicOrder> = {};
    for (const q of roster) {
      // A topic-less entry still serves; "" would make a key nothing
      // renders, so it files under a name the client can ask for.
      const topic = q.topic ?? "untopiced";
      (topics[topic] ??= { qids: [], total: 0 }).qids.push(q.id);
    }
    for (const t of Object.keys(topics)) {
      const rows = topics[t].qids.map((qid) => {
        const agg = aggs.get(qid);
        return {
          qid,
          total: agg?.total ?? 0,
          dead: isLandslide(agg),
          seq: seqOf.get(qid) ?? 0,
        };
      });
      rows.sort((a, b) =>
        a.dead !== b.dead
          ? (a.dead ? 1 : -1)
          : b.total !== a.total
            ? b.total - a.total
            : a.seq - b.seq,
      );
      topics[t] = {
        qids: rows.map((r) => r.qid),
        total: rows.reduce((s, r) => s + r.total, 0),
      };
    }
    out[surface] = { day: today, basis: BASIS, topics };
  }
  return out;
}

/** Run the fold and publish. Idempotent by construction — the order is a
 * pure function of (bank, aggregates, day), so a retried schedule writes
 * the same documents again. */
export async function runBankRank(
  store: RankStore,
  nowMs: number,
  bank: readonly V2SeedQuestion[] = V2_QUESTIONS,
): Promise<{ surfaces: number; topics: number; ranked: number }> {
  const today = utcDay(nowMs, 0);
  const qids = bank
    .filter((q) => RANK_SURFACES.includes(q.surface as RankSurface))
    .map((q) => q.id);
  const aggs = await store.aggsFor(qids);
  const docs = computeRank(bank, aggs, today);
  let topics = 0;
  let ranked = 0;
  for (const surface of RANK_SURFACES) {
    topics += Object.keys(docs[surface].topics).length;
    ranked += Object.values(docs[surface].topics).reduce((s, t) => s + t.qids.length, 0);
    await store.putOrder(surface, docs[surface]);
  }
  return { surfaces: RANK_SURFACES.length, topics, ranked };
}

/** The Firestore store: aggregates read in getAll chunks (the patterns
 * getUsers shape — most learn/tail qids have no agg doc yet and read as
 * unanswered), the order published to v2_rank/{surface}, world-readable
 * and written by nobody (the v2_patterns posture, in rules and in
 * docs/data-inventory.md). */
export function firestoreRankStore(db: Firestore): RankStore {
  return {
    async aggsFor(qids) {
      const out = new Map<string, RankAgg>();
      for (let i = 0; i < qids.length; i += 300) {
        const chunk = qids.slice(i, i + 300);
        const refs = chunk.map((qid) => db.collection("v2_question_aggs").doc(qid));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap, j) => {
          if (snap.exists) {
            out.set(chunk[j], {
              total: (snap.get("total") as number) ?? 0,
              counts: (snap.get("counts") as Record<string, number>) ?? {},
            });
          }
        });
      }
      return out;
    },
    async putOrder(surface, docPayload) {
      await db
        .collection("v2_rank")
        .doc(surface)
        .set({ ...docPayload, at: FieldValue.serverTimestamp() });
    },
  };
}

const REGION = FUNCTIONS_REGION;

export const rankBankV2 = onSchedule(
  // Nightly at 3:07 UTC — after the patterns fit (2:37) so a device that
  // reads both sees the same night's world, before the velocity scan
  // (3:47). Cost: O(bank) agg reads per night plus two writes; a device
  // pays one read per order doc it actually uses.
  { schedule: "7 3 * * *", region: REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const summary = await runBankRank(firestoreRankStore(firestore()), Date.now());
    logger.info("bank rank", { metric: "bank_rank", ...summary });
  },
);
