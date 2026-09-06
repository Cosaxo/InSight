// rank.ts — the nightly published serving order (D316; the spine D317's
// profile will choose from). The arithmetic is pure and injected-store
// tested (the patterns.ts shape, one job over); this file decides WHAT
// is ranked and WHERE the order lives.
//
// WHY A PUBLISHED ORDER EXISTS AT ALL. D316 pages the bank: a device
// stops being handed every question and fetches what a screen actually
// reaches. Pages need an order to page BY, and the order has to be the
// same for everyone at zero marginal reads — so it is computed once a
// night here and published onto one small doc per surface, exactly the
// fitPatternsV2 → v2_patterns/loadings shape. A device reads the order
// doc (one read), then fetches question documents as it reaches them.
// Per-request ranking — the naive recommender — would bill per
// impression; this bills O(bank) reads per NIGHT and O(pages actually
// read) per device, which is the whole cost argument of D316.
//
// THE ORDER'S BASIS, v1: crowd volume, with landslides sunk. Volume
// (the aggregate's `total`) is the one global signal every question
// already publishes, and it is personal to nobody — D163/D317's line
// holds because this fold never reads a uid. The sink is D316 phase 4's
// first signal: a question ≥ RANK_DEAD_MIN answers whose leading option
// holds ≥ RANK_DEAD_SHARE of them has stopped asking anything, and it
// serves LAST in its topic rather than waiting for a human to read a
// retire proposal. Deletion stays the lane's;
// `active: false` stays the kill switch; this only orders.
//
// SURFACES: feed and learn — the two D316 unbounds. The daily is
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

/** The surfaces the order covers — the two D316 pages. */
export const RANK_SURFACES = ["feed", "learn"] as const;
export type RankSurface = (typeof RANK_SURFACES)[number];

/**
 * The daily's shape document (D371) — NOT an order, and the distinction
 * is the reason the file header excludes the daily from RANK_SURFACES.
 * The daily stays positional: everyone answers the same question on the
 * same day, which is what makes a cohort comparison mean anything.
 *
 * What a device needs to run that rule is the bank's LENGTH, not the
 * bank. `computeDeckIds` indexes `(today - epoch - back) mod n`, so with
 * `n` in hand a device computes its seven positions locally — which also
 * keeps the midnight rollover working, where a published deck would hand
 * out yesterday's questions until the 03:07 fold ran.
 *
 * `maxSeq` is the SAFETY, not decoration. Position i maps to `seq === i`
 * only while the daily's seq space is dense from zero, which live.ts's
 * own boot query already states ("per-surface and contiguous") and
 * nothing enforced. Publishing the max lets the device CHECK it —
 * `maxSeq === n - 1` or the fast path is off and the whole-bank fetch
 * stands. A hole must never silently shift the day: retiring a question
 * below the window already moves every visible card (the tombstone note
 * in live.ts), and a device disagreeing with its neighbours about which
 * question today is would be that bug with no symptom.
 */
export interface DailyShapeDoc {
  n: number;
  maxSeq: number;
}

/**
 * The daily bank as the CLIENT counts it. The predicate mirrors
 * `splitBanks`'s daily arm (src/v2/data/deck.ts) exactly, including that
 * it does NOT filter on `active`: retired dailies stay in the bank as
 * tombstones so the positions around them hold, and a count that dropped
 * them would shift every device's day. Two spellings of one predicate is
 * how they drift, so this comment is the second half of the pin —
 * `rank.test.ts` asserts the count against the seed the client reads.
 */
export function dailyShape(bank: readonly V2SeedQuestion[]): DailyShapeDoc {
  const daily = bank.filter(
    (q) => q.surface === "daily" && Array.isArray(q.options) && q.options.length >= 2,
  );
  return {
    n: daily.length,
    maxSeq: daily.reduce((m, q) => Math.max(m, q.seq), -1),
  };
}

/**
 * The landslide sink (D316 phase 4's first signal): at this many answers
 * with the leading option at this share, a question has stopped asking
 * anything and serves last in its topic.
 *
 * NOT THE SCORECARD'S LANDSLIDE, though this said it was — "the
 * scorecard's own retire-proposal floor, kept equal on purpose — one
 * predicate, spelled twice, is how the two would drift apart", under a
 * predicate that had already drifted. The scorecard grades on EVENNESS
 * (scripts/scorecard-metrics.mjs), which normalises the leading share by
 * the option count: `1 − (maxShare − 1/n)/(1 − 1/n) < 0.18`. This is a
 * raw top share and ignores n, so the two disagree in both directions —
 * measured, on the same aggregates:
 *
 *   binary 90/10     sunk here, NOT a scorecard landslide (evenness 0.20)
 *   4-option 88/4/4/4  a scorecard landslide, NOT sunk here (evenness 0.16)
 *
 * They also cover different question types: the scorecard has a second
 * formula for ordinals, and this predicate is applied to everything.
 *
 * So an operator reading the nightly retire proposals and the published
 * serving order gets two verdicts on the same question. WHICH ONE IS
 * RIGHT IS THE OWNER'S CALL — making them one predicate changes what the
 * feed serves, so it is not a comment fix — and the comment now says what
 * is true rather than telling the next reader not to look.
 */
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
  /** How many questions the topic CARRIES: home plus every `also` door
   * (docs/TAGS-PLAN.md §2). `qids` is home placement only, because that
   * is what paging needs — a straddler must be fetched once, from one
   * page, not once per shelf it appears on. But the topic sheet counts
   * membership, so `qids.length` under-reports every straddler and the
   * client cannot recover the difference: it sees `also` only on the
   * questions it already holds. So the fold, which sees the whole bank,
   * states it. Equal to `qids.length` on any surface without `also`
   * (learn), which is why the reader can take it unconditionally. */
  carry: number;
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
  /** `v2_rank/daily` — the shape, not an order (see DailyShapeDoc). */
  putDailyShape(doc: DailyShapeDoc): Promise<void>;
}

const BASIS = "volume desc, landslides sink (D316); ties by seq";

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
    // Membership, counted over the same roster the order is built from:
    // a topic carries a question if it is its home OR one of its `also`
    // doors. Kept beside the home walk rather than folded into it because
    // the two answer different questions — what to PAGE, and what to
    // COUNT — and a topic can be an `also` door with no home question at
    // all, which still belongs on the sheet.
    const carried: Record<string, number> = {};
    for (const q of roster) {
      // A topic-less entry still serves; "" would make a key nothing
      // renders, so it files under a name the client can ask for.
      const topic = q.topic ?? "untopiced";
      (topics[topic] ??= { qids: [], total: 0, carry: 0 }).qids.push(q.id);
      for (const t of new Set([topic, ...(q.also ?? [])])) {
        carried[t] = (carried[t] ?? 0) + 1;
      }
    }
    // An `also`-only topic has no home question, so the home walk never
    // made it a key. It still carries questions a reader can reach, so it
    // gets an entry that pages nothing and counts honestly.
    for (const t of Object.keys(carried)) {
      topics[t] ??= { qids: [], total: 0, carry: 0 };
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
        carry: carried[t] ?? 0,
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
): Promise<{ surfaces: number; topics: number; ranked: number; dailyN: number }> {
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
  // The daily's shape rides the same nightly write (D371). It is not an
  // order and takes no aggregates — the daily is positional — but it
  // belongs here rather than in its own function: one schedule, one place
  // a device looks for "what does the bank look like tonight", and the
  // publish is a single small document.
  const daily = dailyShape(bank);
  await store.putDailyShape(daily);
  return { surfaces: RANK_SURFACES.length, topics, ranked, dailyN: daily.n };
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
    async putDailyShape(docPayload) {
      await db
        .collection("v2_rank")
        .doc("daily")
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
