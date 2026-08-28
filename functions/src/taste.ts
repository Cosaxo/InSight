// taste.ts — the per-person interest profile (D317 phase 1, as-built at
// D322). The arithmetic is pure behind an injected store (the patterns.ts
// shape); this file decides WHAT counts as interest and WHERE the profile
// lives.
//
// WHAT THE PROFILE IS, and the whole of what it is: per-topic counts of
// this person's FEED answers, folded nightly from the agg-events ledger
// (D28) — the same log the patterns fit reads, through the same one-day
// reader (ledger.ts). Answering a question about food IS interest in
// food; that is the entire model. Phase 1 deliberately derives from
// nothing but answers — which are public by D98 — so the profile adds no
// new collection of anything, only a new ARRANGEMENT of what the server
// already holds. Behaviour (passes, defers, dwell) stays on the device;
// folding it in is D317 phase 2, which graduates on its own evidence and
// its own record, never silently.
//
// WHAT IT IS FOR, and the only thing: the paged read path (D320/D321)
// sizes each topic's page by it — more fresh questions fetched for the
// topics a person actually answers. It never touches the daily (global
// by design: cohort comparison needs everyone on the same question),
// never enters the Mirror's folds (core only, D161), and is never an
// input to ads or ranking of PEOPLE — MONITORING.md's re-drawn row and
// D317's "what survives D163" hold the line, and the erasure story is
// structural: the profile lives under v2_users/{uid}, so deleteAccount's
// recursiveDelete takes it with the account, no new arm.
//
// FEED ONLY in v1. Learn interest is the follow list the user already
// controls; the daily has no selection to personalize; duels are social,
// not topical. One surface keeps the first profile honest and legible —
// a person can look at it (it is owner-readable, D163's "shown" carried
// over) and see exactly their own answering, counted.
//
// EDITS COUNT ONCE A DAY, approximately. The ledger logs aggregate
// EVENTS: a D86 edit writes a second entry byte-identical in shape to
// the create it supersedes. Within one day the fold dedupes per
// (person, question); an edit on a LATER day counts again. Patterns
// needed exactness there and dedupes across the model's whole life;
// interest is a heuristic where a revisited question over-counting by
// one is noise, and the cheap rule is recorded rather than silently
// wrong.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
// ops.ts sets the global runtime options as an import side effect and must
// stay imported wherever a function is declared (check:fn-runtime).
import { LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { V2_QUESTIONS } from "./v2content";
import { db as firestore } from "./db";
import { readLedgerDay } from "./ledger";
import { utcDay } from "./pure";

/** feed qid → topic, compiled from the seed the same way PATTERNS_QIDS
 * is. Catalog picks are feed-surface and count like any other answer. */
export const FEED_TOPIC_OF: ReadonlyMap<string, string> = new Map(
  V2_QUESTIONS.filter((q) => q.surface === "feed").map((q) => [q.id, q.topic ?? "untopiced"]),
);

/** A missed night folds on the next run, up to a week back — bounded,
 * patterns' own rule, so an outage cannot become an unbounded scan. */
export const TASTE_CATCHUP_DAYS = 7;

export interface TasteProfile {
  /** Per-topic answer counts. */
  t: Record<string, number>;
  /** Total counted answers — the sum of t, kept so a reader (the pager,
   * or the person looking at their own profile) never re-derives it. */
  n: number;
  /**
   * The last ledger day folded into this profile, and the only thing that
   * makes the fold safe to retry.
   *
   * `t` and `n` are ACCUMULATORS. The cursor is written after the
   * profiles, so a crash between the two — or a failure part-way through
   * the chunked write — leaves the day unmarked and the next run adds it
   * again. Verified: with a cursor write that throws once, one answer
   * came out as `n: 2`. The docstring above `runTasteFold` claimed the
   * opposite ("a retried schedule re-folds nothing it already
   * committed"), and cursor-last is exactly what makes a retry re-fold
   * what WAS committed.
   *
   * A per-person stamp is the fix that fits the data: the ledger day is
   * shared, so it cannot be marked per chunk the way the engagement fold
   * marks its own source rows — but a profile is one person's, so it can
   * carry how far it has been folded. A retry then skips whoever was
   * already written and folds whoever was not, which is exactly-once at
   * the (person, day) grain.
   *
   * Optional because every profile written before this existed has none,
   * and an absent stamp means "fold it" — the old behaviour, once.
   */
  d?: string;
}

export interface TasteStore {
  /** The ledger entries for one UTC day. */
  ledgerDay(dayKey: string): Promise<Array<{ uid: string; qid: string }>>;
  /** The last folded day key, "" when the fold has never run. */
  getLastDay(): Promise<string>;
  getProfiles(uids: string[]): Promise<Map<string, TasteProfile>>;
  putProfiles(profiles: Map<string, TasteProfile>): Promise<void>;
  putLastDay(day: string): Promise<void>;
}

/**
 * Fold every unfolded day up to and including yesterday.
 *
 * IDEMPOTENT AT THE (PERSON, DAY) GRAIN, which is a stronger claim than
 * the one that used to be here and is the one that is true. Each profile
 * carries the last day folded into it (`d`), and a day already stamped
 * onto a person is skipped. The cursor still advances last — it is the
 * cheap way to skip whole days — but nothing now depends on it having
 * been written: a crash mid-write leaves some people stamped and some
 * not, and the retry folds exactly the ones that were missed.
 *
 * ONE DAY AT A TIME. The old shape aggregated every owed day into one
 * read-modify-write per person, which is cheaper on a catch-up and cannot
 * be stamped — a stamp only means something if it names a day that was
 * actually folded. Normally exactly one day is owed and the cost is
 * identical; a catch-up pays one read per touched person per day instead
 * of one per run, bounded by TASTE_CATCHUP_DAYS.
 */
export async function runTasteFold(
  store: TasteStore,
  nowMs: number,
  topicOf: ReadonlyMap<string, string> = FEED_TOPIC_OF,
): Promise<{ days: number; counted: number; people: number }> {
  const yesterday = utcDay(nowMs, -1);
  const lastDay = await store.getLastDay();
  const days: string[] = [];
  for (let off = -TASTE_CATCHUP_DAYS; off <= -1; off++) {
    const day = utcDay(nowMs, off);
    if (day > lastDay) days.push(day);
  }
  if (!days.length || yesterday <= lastDay) return { days: 0, counted: 0, people: 0 };

  let counted = 0;
  let people = 0;
  for (const day of days) {
    // Per person, per topic, for THIS day.
    const addByUid = new Map<string, Map<string, number>>();
    const seen = new Set<string>();
    for (const e of await store.ledgerDay(day)) {
      const topic = topicOf.get(e.qid);
      if (!topic || !e.uid) continue;
      // The within-day dedupe (the edit rule in the header): one count
      // per (person, question) per day, first entry wins — the create
      // and its same-day edit are one act of interest.
      const key = `${e.uid}\u0000${e.qid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const topics = addByUid.get(e.uid) ?? new Map<string, number>();
      topics.set(topic, (topics.get(topic) ?? 0) + 1);
      addByUid.set(e.uid, topics);
    }
    if (addByUid.size) {
      const uids = [...addByUid.keys()].sort();
      const profiles = await store.getProfiles(uids);
      const write = new Map<string, TasteProfile>();
      for (const uid of uids) {
        const p = profiles.get(uid) ?? { t: {}, n: 0 };
        // ALREADY FOLDED — a previous attempt at this same day wrote this
        // person before it died. Skipping is the whole retry guarantee.
        if (p.d && p.d >= day) continue;
        for (const [topic, add] of addByUid.get(uid) as Map<string, number>) {
          p.t[topic] = (p.t[topic] ?? 0) + add;
          p.n += add;
          counted += add;
        }
        p.d = day;
        write.set(uid, p);
      }
      if (write.size) await store.putProfiles(write);
      people += write.size;
    }
    // Per day, so a catch-up that dies half way keeps the days it did.
    await store.putLastDay(day);
  }
  return { days: days.length, counted, people };
}

/** The Firestore store. The profile lives under the person's own subtree
 * (v2_users/{uid}/taste/profile — owner-readable, written by nobody but
 * this fold, erased by deleteAccount's recursive delete); the cursor
 * rides v2_meta/app the way the patterns gate does (D265's argument: a
 * field on a doc that already exists costs no new collection, and a day
 * key is not a secret). */
export function firestoreTasteStore(db: Firestore): TasteStore {
  const metaRef = db.collection("v2_meta").doc("app");
  return {
    async ledgerDay(dayKey) {
      return readLedgerDay(db, dayKey);
    },
    async getLastDay() {
      const snap = await metaRef.get();
      return (snap.get("tasteLastDay") as string) ?? "";
    },
    async getProfiles(uids) {
      const out = new Map<string, TasteProfile>();
      for (let i = 0; i < uids.length; i += 300) {
        const chunk = uids.slice(i, i + 300);
        const refs = chunk.map((uid) =>
          db.collection("v2_users").doc(uid).collection("taste").doc("profile"));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap, j) => {
          if (snap.exists) {
            out.set(chunk[j], {
              t: (snap.get("t") as Record<string, number>) ?? {},
              n: (snap.get("n") as number) ?? 0,
              // The day stamp, BOTH WAYS. These projections name their
              // fields one by one, so a field missing from either end is
              // silently dropped — and the retry guard reads `d` off what
              // this returns. Leaving it out of the read made the guard
              // dead in production while the in-memory fake, which keeps
              // the whole object, went on proving it worked.
              ...(snap.get("d") ? { d: String(snap.get("d")) } : {}),
            });
          }
        });
      }
      return out;
    },
    async putProfiles(profiles) {
      const entries = [...profiles.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [uid, p] of entries.slice(i, i + 400)) {
          batch.set(
            db.collection("v2_users").doc(uid).collection("taste").doc("profile"),
            // `set` with no merge replaces the document, so every field
            // the profile carries has to be named here — `d` included, or
            // the stamp written above is dropped on the way out.
            { t: p.t, n: p.n, at: FieldValue.serverTimestamp(), ...(p.d ? { d: p.d } : {}) },
          );
        }
        await batch.commit();
      }
    },
    async putLastDay(day) {
      await metaRef.set({ tasteLastDay: day }, { merge: true });
    },
  };
}

const REGION = FUNCTIONS_REGION;

export const fitTasteV2 = onSchedule(
  // Nightly at 3:27 UTC — after the rank fold (3:07) and before the
  // velocity scan (3:47), all three off the top-of-hour herd. Cost:
  // one paged ledger-day read plus one read and one write per person
  // who answered that day.
  { schedule: "27 3 * * *", region: REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const summary = await runTasteFold(firestoreTasteStore(firestore()), Date.now());
    if (summary.days > 0) {
      logger.info("taste fold", { metric: "taste_fold", ...summary });
    }
  },
);
