// engagement.ts — R1/D251: the ledger learns to count people.
//
//   digestEngagementV2   a nightly scheduled pass over `v2_agg_events`
//                        that folds each finished UTC day into one small
//                        PUBLIC day document (v2_engagement_daily/{day})
//                        of anonymous population counts — actives, first
//                        answerers, cohort returns, answers by surface —
//                        plus the per-account bookkeeping pair the counts
//                        need (v2_users/{uid}/engagement/_state).
//
// PURPOSE, stated because velocity.ts states the opposite: this IS the
// DAU/retention counting D47 deferred and MONITORING.md refused pending
// its own record. D251 is that record — it widens D28's purpose list for
// the ledger (dedup, attribution, and now population counting), and the
// scope it grants is exactly what this file does: anonymous counts out,
// uid-keyed bookkeeping under the account that owns it, nothing else.
// docs/ENGAGEMENT-PLAN.md §2 is the argument; rung 0 collects nothing new.
//
// A SECOND SCAN, DELIBERATELY (ENGAGEMENT-RUNBOOK 1.1's named decision).
// velocity.ts walks the same ledger nightly, but over a CURSOR window
// (lastScanAt → now, capped 72 h) — the right shape for "what happened
// since I last looked", and the wrong one for calendar-day statistics: a
// window spanning midnight belongs to two day docs. Folding this into
// that pass would couple two windowing semantics to save one read per
// entry per night (~3 × DAU ≈ 15k reads at 5k DAU, ~$0.006/night at the
// regional sheet) — the coupling costs more than the reads. Revisit if
// the pulse console's read tripwires ever say otherwise.
//
// WHY A NIGHTLY SWEEP AND NOT A TRIGGER ARM: the same reason patterns.ts
// gives — the trigger is the app's hottest path, pulse.test.mjs pins its
// exact read count, and day-granular counts need nothing real-time.
//
// Scale note, recorded not built (the patterns.ts clause): one day's fold
// holds the active uids' sets in memory — fine to ~100k DAU under
// LIGHT_UNBOUNDED's 256 MiB; the fix at that size is paging the fold by
// uid range, not a bigger box.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
// ops.ts sets the global runtime options as an import side effect and must
// stay imported wherever a function is declared (check:fn-runtime guards
// the outcome).
import { LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { V2_QUESTIONS } from "./v2content";
import { db as firestore } from "./db";

/** A missed night folds on the next run, bounded — patterns.ts's clause
 * and constant, for the same reason: a long outage must not turn the
 * catch-up into an unbounded ledger scan. Days beyond it stay unfolded,
 * and an unfolded day is an ABSENT doc, never a zero one (see runEngagementDigest). */
export const DIGEST_CATCHUP_DAYS = 7;

/** A streak counts as broken only from this length — two days of habit
 * ending is noise; a week of habit ending is the churn signal the day doc
 * exists to surface. */
export const STREAK_BROKEN_MIN = 3;

export interface DigestEntry {
  uid: string;
  qid: string;
}

/** The bookkeeping pair (v2_users/{uid}/engagement/_state) — the smallest
 * state from which the day doc's cohort counts are computable without
 * rescanning history: when this account first answered, when it last did,
 * how many distinct days, and its current consecutive-day streak.
 * Server-written, readable by nobody, erased with the account by the
 * recursive delete (the patterns/state precedent — no new erasure arm). */
export interface DigestState {
  firstDay: string;
  lastDay: string;
  activeDays: number;
  streak: number;
}

interface CohortReturn {
  returned: number;
  /** The cohort's size — that day's firstTime count. `null` when the
   * cohort day was never folded (before the deploy, or beyond the
   * catch-up window): an unknown denominator is not a zero one. */
  of: number | null;
}

export interface EngagementDay {
  day: string;
  /** Distinct uids with any ledger event this day. */
  actives: number;
  /** Actives whose first-ever ledger day is this day. */
  firstTime: number;
  /** Distinct (uid, qid) pairs — a same-day D86 edit collapses to one. */
  votes: number;
  /** Raw ledger entries, edit deltas included; votes ≤ events. */
  events: number;
  /** Deduped pairs per derived surface (see surfaceOfQid). */
  bySurface: Record<string, number>;
  /** Signup-cohort returns: of the accounts whose FIRST day was N days
   * before this one, how many were active today. */
  returned: { d1: CohortReturn; d7: CohortReturn; d30: CohortReturn };
  /** Streaks ≥ STREAK_BROKEN_MIN whose owner returned today after a gap.
   * Detected ON RETURN, deliberately: an account that never comes back is
   * a retention fact, not a streak one, and seeing it would take a scan
   * of every silent account. */
  streaksBroken: number;
}

/** The I/O the digest needs, as an interface (the patterns.ts store
 * precedent) — the pass logic is testable without any Firestore shape. */
export interface EngagementStore {
  /** The ledger entries for one UTC day, oldest first. */
  ledgerDay(dayKey: string): Promise<DigestEntry[]>;
  /** Last folded day, "" if never. */
  getLastDay(): Promise<string>;
  putLastDay(day: string): Promise<void>;
  getStates(uids: string[]): Promise<Map<string, DigestState>>;
  putStates(states: Map<string, DigestState>): Promise<void>;
  /** A previously folded day doc, for cohort denominators. */
  getDay(dayKey: string): Promise<EngagementDay | null>;
  putDay(day: EngagementDay): Promise<void>;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function utcDay(nowMs: number, offsetDays: number): string {
  const d = new Date(nowMs);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** dayKey + delta, in UTC — "2026-08-01" + (-1) → "2026-07-31". */
export function dayOffset(dayKey: string, delta: number): string {
  return utcDay(Date.parse(`${dayKey}T00:00:00Z`), delta);
}

/** Whole days from a to b (a ≤ b), by UTC calendar. */
export function dayGap(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// qid → surface, compiled from the bank (the POLITICAL_QIDS pattern: no
// Firestore read). The ledger carries no surface field and does not need
// one: every aggregate-feeding qid is either in the bank directly or is a
// pulse's `{baseQid}_{day}` composite (the rules parse the day off the id
// the same way). Catalog answers carry their bank qid. Anything else —
// entries older than the bank, a retired question — reads as "other"
// rather than being guessed. Duel answers never reach the ledger at all
// (velocity.ts records why), so duel activity is not this document's to
// count — the reveal fold already owns it.
const SURFACE_BY_QID: ReadonlyMap<string, string> = new Map(
  V2_QUESTIONS.map((q) => [q.id, q.surface]),
);
const PULSE_DAY_SUFFIX = /_\d{4}-\d{2}-\d{2}$/;
export function surfaceOfQid(qid: string): string {
  const direct = SURFACE_BY_QID.get(qid);
  if (direct) return direct;
  if (PULSE_DAY_SUFFIX.test(qid)) {
    const base = SURFACE_BY_QID.get(qid.replace(PULSE_DAY_SUFFIX, ""));
    if (base) return base;
  }
  return "other";
}

/**
 * Fold every unfolded day up to and including yesterday. Idempotent the
 * way the patterns fit is: the collection carries the last folded day,
 * and the per-uid state only advances (`lastDay` is monotonic), so a
 * retried schedule re-folds nothing and a crashed run recomputes the
 * same numbers.
 *
 * Write order per day is doc → states → lastDay, chosen for what each
 * crash window costs: before the doc, nothing happened; between doc and
 * states, the re-run recomputes an identical doc from unadvanced states;
 * between states and lastDay, the re-run rewrites the doc from ADVANCED
 * states — `firstTime` stays exact (the guard below counts a state whose
 * firstDay IS this day), cohort returns stay exact (firstDay never
 * changes), and only `streaksBroken` can undercount for that one day.
 * Counts, not money; recorded rather than engineered away.
 *
 * An empty day still writes its doc, with zeros: the trail must be able
 * to say "folded, nobody came", because an ABSENT doc means "never
 * folded" and the console draws that as a gap, not a flat line (the
 * pulse-trail rule).
 */
export async function runEngagementDigest(
  store: EngagementStore,
  nowMs: number,
  surfaceOf: (qid: string) => string = surfaceOfQid,
): Promise<{ days: number; lastDay: string; actives: number; votes: number }> {
  const lastDay = await store.getLastDay();

  // the days still owed, oldest first, bounded by the catch-up window
  const days: string[] = [];
  for (let off = -DIGEST_CATCHUP_DAYS; off <= -1; off++) {
    const day = utcDay(nowMs, off);
    if (day > lastDay) days.push(day);
  }
  if (!days.length) return { days: 0, lastDay, actives: 0, votes: 0 };

  // Days folded in THIS run, so a catch-up day can read the denominator
  // the previous iteration just wrote without a round trip.
  const writtenNow = new Map<string, EngagementDay>();
  const cohortOf = async (day: string): Promise<number | null> => {
    const doc = writtenNow.get(day) ?? (await store.getDay(day));
    return doc ? doc.firstTime : null;
  };

  let lastDoc: EngagementDay | null = null;
  for (const day of days) {
    const entries = await store.ledgerDay(day);

    // one Set of qids per uid — a same-day edit's second entry collapses
    // here, exactly the dedup the patterns fit does and for the same
    // reason: the ledger logs aggregate EVENTS, and this reader wants
    // people.
    const byUid = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!e.uid) continue;
      let qids = byUid.get(e.uid);
      if (!qids) {
        qids = new Set();
        byUid.set(e.uid, qids);
      }
      qids.add(e.qid);
    }

    const uids = [...byUid.keys()].sort();
    const states = await store.getStates(uids);

    let firstTime = 0;
    let votes = 0;
    let streaksBroken = 0;
    const bySurface: Record<string, number> = {};
    const returned = { d1: 0, d7: 0, d30: 0 };
    const cohortDay = {
      d1: dayOffset(day, -1),
      d7: dayOffset(day, -7),
      d30: dayOffset(day, -30),
    };

    const changed = new Map<string, DigestState>();
    for (const uid of uids) {
      const qids = byUid.get(uid)!;
      votes += qids.size;
      for (const qid of qids) {
        const s = surfaceOf(qid);
        bySurface[s] = (bySurface[s] || 0) + 1;
      }

      const state = states.get(uid);
      // A state whose firstDay IS this day was written by a crashed run
      // of this same fold — still a first-timer (see the header).
      if (!state || state.firstDay === day) firstTime++;
      if (state) {
        if (state.firstDay === cohortDay.d1) returned.d1++;
        if (state.firstDay === cohortDay.d7) returned.d7++;
        if (state.firstDay === cohortDay.d30) returned.d30++;
      }

      // Monotonic guard: a state at or past this day was advanced by a
      // previous (possibly crashed) run — recompute reads it, never
      // re-bumps it.
      if (!state) {
        changed.set(uid, { firstDay: day, lastDay: day, activeDays: 1, streak: 1 });
      } else if (state.lastDay < day) {
        const gap = dayGap(state.lastDay, day);
        if (gap >= 2 && state.streak >= STREAK_BROKEN_MIN) streaksBroken++;
        changed.set(uid, {
          firstDay: state.firstDay,
          lastDay: day,
          activeDays: state.activeDays + 1,
          streak: gap === 1 ? state.streak + 1 : 1,
        });
      }
    }

    const doc: EngagementDay = {
      day,
      actives: uids.length,
      firstTime,
      votes,
      events: entries.length,
      bySurface,
      returned: {
        d1: { returned: returned.d1, of: await cohortOf(cohortDay.d1) },
        d7: { returned: returned.d7, of: await cohortOf(cohortDay.d7) },
        d30: { returned: returned.d30, of: await cohortOf(cohortDay.d30) },
      },
      streaksBroken,
    };

    await store.putDay(doc);
    writtenNow.set(day, doc);
    if (changed.size) await store.putStates(changed);
    await store.putLastDay(day);
    lastDoc = doc;
  }

  return {
    days: days.length,
    lastDay: days[days.length - 1],
    actives: lastDoc?.actives ?? 0,
    votes: lastDoc?.votes ?? 0,
  };
}

/** The Firestore store. The day docs and the lastDay cursor live in ONE
 * public collection (v2_engagement_daily — world-readable per D251's
 * adopted default, written only here, nothing per-person in any of it);
 * each account's bookkeeping pair lives under its own subtree
 * (v2_users/{uid}/engagement/_state — readable by NOBODY, the patterns/
 * state posture, deleteAccount's recursive delete takes it with the
 * account, no new arm). The doc id `_state` deliberately fails the
 * date-shaped id the phase-3 rules arm will admit for client rollups, so
 * "server-only" stays a property of the id discipline. */
export function firestoreEngagementStore(db: Firestore): EngagementStore {
  const daily = db.collection("v2_engagement_daily");
  const metaRef = daily.doc("meta");
  return {
    async ledgerDay(dayKey) {
      const start = new Date(`${dayKey}T00:00:00Z`);
      const end = new Date(start.getTime() + 86400000);
      const out: DigestEntry[] = [];
      // paged like the velocity scan — the day's ledger can be large and
      // the fold needs two fields of it
      let query = db
        .collection("v2_agg_events")
        .where("at", ">=", start)
        .where("at", "<", end)
        .orderBy("at")
        .select("uid", "qid")
        .limit(5000);
      for (;;) {
        const snap = await query.get();
        for (const d of snap.docs) {
          out.push({ uid: String(d.get("uid") ?? ""), qid: String(d.get("qid") ?? "") });
        }
        if (snap.size < 5000) break;
        query = query.startAfter(snap.docs[snap.size - 1]);
      }
      return out;
    },
    async getLastDay() {
      const snap = await metaRef.get();
      return (snap.exists && (snap.get("lastDay") as string)) || "";
    },
    async putLastDay(day) {
      await metaRef.set({ lastDay: day, at: FieldValue.serverTimestamp() });
    },
    async getStates(uids) {
      const out = new Map<string, DigestState>();
      for (let i = 0; i < uids.length; i += 300) {
        const chunk = uids.slice(i, i + 300);
        const refs = chunk.map((uid) =>
          db.collection("v2_users").doc(uid).collection("engagement").doc("_state"));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap, j) => {
          if (snap.exists) {
            out.set(chunk[j], {
              firstDay: (snap.get("firstDay") as string) ?? "",
              lastDay: (snap.get("lastDay") as string) ?? "",
              activeDays: (snap.get("activeDays") as number) ?? 0,
              streak: (snap.get("streak") as number) ?? 0,
            });
          }
        });
      }
      return out;
    },
    async putStates(states) {
      const entries = [...states.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [uid, s] of entries.slice(i, i + 400)) {
          batch.set(
            db.collection("v2_users").doc(uid).collection("engagement").doc("_state"),
            s,
          );
        }
        await batch.commit();
      }
    },
    async getDay(dayKey) {
      const snap = await daily.doc(dayKey).get();
      if (!snap.exists) return null;
      return snap.data() as EngagementDay;
    },
    async putDay(day) {
      await daily.doc(day.day).set({ ...day, foldedAt: FieldValue.serverTimestamp() });
    },
  };
}

export const digestEngagementV2 = onSchedule(
  // Nightly, off the top-of-hour herd and clear of the other two ledger
  // readers (patterns 02:37, velocity 03:47). Cost at 5k DAU: one paged
  // scan of the day's entries (~3 × DAU reads), one _state read and one
  // write per active account, one day doc — pennies; the arithmetic is
  // an input to scripts/cost-arith.mjs, not a figure to trust from here.
  { schedule: "23 2 * * *", region: FUNCTIONS_REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const res = await runEngagementDigest(firestoreEngagementStore(firestore()), Date.now());
    // The heartbeat — monitoring/digestEngagementV2-silent.json watches
    // for this line's ABSENCE (the fitPatternsV2 pattern): a scheduled
    // function that stops running reports nothing, so the alert is on
    // silence, and this log is the pulse it listens for.
    logger.info(
      `[engagement] digest: ${res.days} day(s) folded through ${res.lastDay || "—"} — actives=${res.actives} votes=${res.votes}`,
      {
        metric: "engagement_digest",
        days: res.days,
        lastDay: res.lastDay,
        actives: res.actives,
        votes: res.votes,
      },
    );
  },
);
