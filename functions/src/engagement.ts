// engagement.ts — R1/D268: the ledger learns to count people.
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
// its own record. D268 is that record — it widens D28's purpose list for
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
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { V2_QUESTIONS } from "./v2content";
import { readLedgerDay, type LedgerDayReader } from "./ledger";

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

// The fold arithmetic lives in pure.ts (ORIENTATION §3). Re-exported
// because this module's own test imports it from here, and because the
// two nightly folds must not be able to disagree about what a day is.
import { utcDay } from "./pure";
export { utcDay };

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
    // A doc EXISTING is not the same as a day having been DIGESTED.
    // runAttentionFold and runRollupFold both create day docs — attn-only
    // or people-only — for days this digest has not folded, and those
    // carry no `firstTime`. `doc ? doc.firstTime : null` handed back
    // `undefined` for one of those, Firestore refuses undefined as a
    // value, and the whole putDay threw: the digest aborts before
    // putLastDay AND before the two folds that run after it in
    // digestEngagementV2, so `lastDay` never advances and the same day
    // poisons the entire pipeline again every night, until it slides out
    // of the catch-up window.
    //
    // `null` is already the vocabulary for "this day was never folded"
    // (D270 — every reader treats a doc with no `actives` as not-digested
    // rather than as a zero day), so that is what a non-digested doc
    // answers here too.
    return typeof doc?.firstTime === "number" ? doc.firstTime : null;
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
      //
      // …and so is one with NO cohort day: an account the pre-fix
      // getStates left with `firstDay: ""` never had one recorded, so
      // today is the first day the digest can honestly claim. Counted
      // once, here, and then written below — after which it matches a
      // cohort like anyone else.
      if (!state || !state.firstDay || state.firstDay === day) firstTime++;
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
          // Adopt today when there is nothing to keep, keep it otherwise.
          // The rest of the row is the account's own history and survives:
          // the bug lost the cohort day, not the streak.
          firstDay: state.firstDay || day,
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
 * public collection (v2_engagement_daily — world-readable per D268's
 * adopted default, written only here, nothing per-person in any of it);
 * each account's bookkeeping pair lives under its own subtree
 * (v2_users/{uid}/engagement/_state — readable by NOBODY, the patterns/
 * state posture, deleteAccount's recursive delete takes it with the
 * account, no new arm). The doc id `_state` deliberately fails the
 * date-shaped id the phase-3 rules arm will admit for client rollups, so
 * "server-only" stays a property of the id discipline. */
export function firestoreEngagementStore(
  db: Firestore,
  // The shared, memoised reader in production (nightly.ts, D398); the
  // default is the same pager unshared, for a caller with only a db.
  ledgerDay: LedgerDayReader = (dayKey) => readLedgerDay(db, dayKey),
): EngagementStore {
  const daily = db.collection("v2_engagement_daily");
  const metaRef = daily.doc("meta");
  return {
    // One reader for one day of the ledger (ledger.ts). This held the
    // third copy of the pager until D398 — projected uid + qid + at, its
    // own page loop — and the digest reads the shared day now, so the
    // second and third fold of a night pay no ledger reads at all.
    ledgerDay,
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
          // EXISTING is not the same as having been DIGESTED — the same
          // distinction cohortOf needs one level up. runRollupFold creates
          // this very document with nothing but `fg7` for an account that
          // used the app without answering, so `snap.exists` is true while
          // the digest has never seen that account.
          //
          // Read as a DigestState it came back with `firstDay: ""`, which
          // equals no cohort day and never counts as a first-timer. So the
          // day that person first ANSWERED was never recorded, the empty
          // string was copied forward on every later day, and they could
          // never match a d1/d7/d30 cohort again — for the rest of the
          // account's life. Exactly the population rung 2 exists to see:
          // people who browse before they commit.
          //
          // The digest's own field is the test, not the document — and
          // that field is `lastDay`, not `firstDay`.
          //
          // Testing `firstDay` was this fix's own first attempt and it
          // threw the baby out: an account the bug had already damaged
          // carries `firstDay: ""` AND a real `lastDay`, `activeDays` and
          // `streak`, because the old path copied the empty string forward
          // while correctly accumulating the other three. Dropping the
          // whole state re-stamped every one of those accounts as born on
          // the first night after deploy — a streak of forty days reset to
          // one, `streaksBroken` blind to it, and `firstTime` inflated by
          // the size of that population, which is the DENOMINATOR
          // cohortOf() hands the published d1/d7/d30 retention curve.
          //
          // `lastDay` is the honest test because the fold writes all four
          // together, so a document that has one has been digested and a
          // document that has none has not. The missing cohort day is then
          // adopted below, where the fold can count it as a first-timer
          // exactly once — which was the point — without discarding what
          // the account earned.
          const lastDay = snap.get("lastDay");
          if (typeof lastDay === "string" && lastDay) {
            const firstDay = snap.get("firstDay");
            out.set(chunk[j], {
              firstDay: typeof firstDay === "string" ? firstDay : "",
              lastDay,
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
            // MERGE, because this document has a second writer. The digest
            // owns four fields on it; `runRollupFold` owns `fg7`, the
            // trailing foreground window R3/D272's fade signal is computed
            // from — and both run in the same nightly invocation, this one
            // first. A replacing write deleted fg7 every night minutes
            // before the fold read it back, so `advanceFgWindow` restarted
            // the window at length 1, and its own rule needs six readings
            // before it will report fading: the signal could not fire, ever,
            // while the read and the write that compute it were billed
            // nightly regardless. Pinned in engagement.test.ts against THIS
            // adapter — the injected store the pure passes run against
            // models a whole-object replace, which is what this was doing.
            { merge: true },
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
      // MERGE, because two other folds own sections of this same document:
      // `attn` (runAttentionFold) and `people` (runRollupFold), both of
      // which write with { merge: true }. A replacing write here deleted
      // whichever of them had already landed — and it is reachable without
      // a crash replay, since the rules admit an attention shard dated up
      // to two days ahead of request.time, so tonight's fold can create an
      // attn-only doc for a day this digest has not reached yet. The
      // shards are deleted as they are folded, so what that dropped could
      // not be recomputed.
      //
      // Safe against stale keys, which is the usual reason to prefer a
      // replace: the only map the digest writes is `bySurface`, it is
      // derived from an append-only ledger, and a re-fold of the same day
      // therefore sees a superset of the keys it saw before. Nothing it
      // wrote can need removing.
      await daily.doc(day.day).set(
        { ...day, foldedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    },
  };
}

// ── rung 1: the attention fold (R2/D270) ────────────────────────
//
// Devices write one anonymous shard per finished day (v2_attention,
// src/v2/data/engagement.ts); this fold sums them into the day docs'
// `attn` section and DELETES them — fold-and-delete is the channel's own
// promise (ATTENTION.md §6: an operator who keeps the raw shards has a
// funnel), so the deletion is asserted by test, not assumed.
//
// LATE SHARDS ARE THE NORMAL CASE, not an error: a device flushes
// yesterday's tally on its next boot, which can be days later. So the
// fold takes whatever shards exist for ANY day and merges additively
// (FieldValue.increment under set-merge) into that day's doc, however
// old. Exactly-once is per CHUNK: each chunk's increments and its
// deletes commit in one batch, so a crash between chunks leaves later
// shards alive and unfolded — refolded next night, never double-counted.

/** One nightly pass is bounded; leftovers fold the next night, and the
 * heartbeat says when the cap bit (no silent caps). */
export const SHARD_FOLD_CAP = 20_000;
export const SHARD_CHUNK = 300; // 1 set + ≤300 deletes per batch, under the 500-op limit

/** How many shards are held in memory at once.
 *
 * The cap above bounds the NIGHT's work; this bounds the HEAP, and they
 * are different jobs. The fold used to read `cap` shards in one `.get()`
 * and only chunk the writes — so a full night materialised 20,000 shard
 * objects at once. Measured with rules-legal maximal shards (31 `s`
 * keys, 120 `qids` keys, both at their rules caps), retained after an
 * explicit gc() with only the page array referenced: 17.2 KB per shard
 * as plain objects, so 335 MB for a full cap. That is the FLOOR — it
 * counts the parsed values alone, and the real path holds Admin SDK
 * snapshots around them. The function is sized LIGHT_UNBOUNDED, 256
 * MiB, so the floor alone is already over the limit; and since this fold
 * is the only thing that deletes shards, an OOM means the backlog never
 * drains — the same failure, identically, every night.
 *
 * 900 is 3 × SHARD_CHUNK deliberately. A read page that is not a whole
 * number of write batches would split batches at page boundaries and
 * make the crash-safe unit depend on where a page happened to end.
 * Worst case is ~63 MB of shards resident, which leaves room on 256 MiB;
 * typical shards are a fraction of that.
 *
 * NO CURSOR, and none is needed: the fold DELETES what it folds, so the
 * next unfiltered page is the next set of shards. The one thing that
 * does not go away is a shard whose `day` is unfoldable — those are left
 * for a human, so they come back on every page, which is why the loop
 * stops when a whole page yields nothing foldable.
 */
const SHARD_READ_PAGE = 3 * SHARD_CHUNK;

/** The estimate the buckets allow: their midpoints (0 · 1–2 · 3–5 · 6–10
 * · 11+). `est` sums midpoints per device — an ESTIMATE and labelled so
 * downstream; `reach` counts devices that used the feature at all, which
 * bucketing cannot distort. Both scale by 1/rate for sampled shards. */
export const BUCKET_MIDPOINTS = [0, 1.5, 4, 8, 12] as const;

export interface AttentionShardDoc {
  id: string;
  day: string;
  rate: unknown;
  s: unknown;
  qids?: unknown;
}

export interface AttnCounter {
  reach: number;
  est: number;
}
export interface AttnDelta {
  devices: number;
  s: Record<string, AttnCounter>;
  /** D271: per-question counters — qid → kind (s|a|p|d) → counter. The
   * client's `_other` overflow cell folds into qOther instead, so the
   * truncation is reported rather than blended into a fake question. */
  q: Record<string, Record<string, AttnCounter>>;
  qOther: number;
}

export interface AttentionStore {
  /** Up to `cap` shards, any day, any order. */
  shardPage(cap: number): Promise<AttentionShardDoc[]>;
  /** ONE atomic commit: merge the delta into the day doc's `attn`
   * section AND delete exactly these shards. */
  applyAttention(day: string, delta: AttnDelta, shardIds: string[]): Promise<void>;
  /**
   * The question keys the day document already holds.
   *
   * One read per day per run, and the only thing that can make the
   * per-day cap true across runs: the shards are deleted as they fold, so
   * tomorrow night starts with an empty page and a full budget while the
   * document keeps everything it was given. Without this the fence bounds
   * one night's fold and the document grows by up to a cap every night.
   */
  dayQids(day: string): Promise<ReadonlySet<string>>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The smallest sampling rate a shard may claim, and therefore the largest
 * number of devices one shard may stand for (1 / this = 1000).
 *
 * WHY A FLOOR AND NOT JUST A CEILING. `weight = 1 / rate` and the rules
 * bounded `rate` only from above, so `rate: 1e-12` was a legal create —
 * and one free anonymous account writing one shard could add ~1e12
 * devices, and ~1e12 to any question's seen/answered counts, to a
 * world-readable day document. Those counts are what the pulse console
 * reads and what QUESTION-FARM's scorecard proposes retirements from.
 *
 * 0.001 is a tenth of a percent — smaller than any sample this app would
 * ship (at a million devices it is a thousand shards a day, which is
 * already the fewest that could carry the per-question map), and a single
 * shard standing for more than a thousand devices is not a reading
 * anybody should publish. Mirrored in firestore.rules as a create bound,
 * so the honest fence is at the door and this is the reader's backstop —
 * the same two-sided shape `QIDS_CAP` has.
 */
export const MIN_SHARD_RATE = 0.001;

/**
 * The reader's two fences on the per-question map's KEYS (D271).
 *
 * The rules bound `qids` to a map of at most 120 entries and deliberately
 * stop there: rules cannot iterate a map, so they can pin neither a key's
 * length nor the union across shards. The fold could, and did not — it
 * turned every client-chosen key straight into a field name on the
 * shared, world-readable `v2_engagement_daily/{day}` document.
 *
 * That is a hard outage, not a cost. Seven rules-legal shards carrying
 * 119 keys of 1200 characters each push the day document past Firestore's
 * 1 MiB entity limit; after that the day can NEVER be written again, the
 * offending shards are never deleted so they return on every page
 * forever, and because `runAttentionFold` is awaited unguarded, the
 * rollup fold and the heartbeat behind it stop running too. One free
 * anonymous account, seven writes, and nothing recovers without a manual
 * delete. Measured on the emulator against the real rules and the real
 * fold, before and after this fence.
 *
 * The same file already makes this argument for the other client-chosen
 * value in the same document (MIN_SHARD_RATE, one shelf up), and
 * `pure.ts` makes it for the analogous anchor-derived keys. `attn.q` was
 * the one aggregate map with no fence on the reader.
 *
 * QID_KEY_MAX: the longest id the bank actually ships is 18 characters
 * (`test-attachment-00`); a bought question is `paidq-` plus a booking id,
 * ~43. 64 is generous headroom and still refuses a key that cannot be a
 * question id.
 *
 * QIDS_PER_DAY_CAP: the binding limit is not bytes but INDEX ENTRIES —
 * `v2_engagement_daily` carries no field exemptions, so every leaf is
 * indexed ascending AND descending. One qid holds up to 4 kinds × 2
 * numbers = 8 leaves = 16 entries, against Firestore's 40,000 per
 * document, so 2,500 qids is the ceiling and 1,500 is the fence. At 64
 * characters that is also ~225 KB, comfortably inside 1 MiB. The bank is
 * 913 questions today, so a day cannot hold enough BANK qids to reach the
 * fence. This said "the bank can double before this truncates anything
 * real" and check:figures kept the number current underneath it until the
 * claim expired: at 750 against 1,500 doubling lands exactly ON the fence,
 * and it was only ever true by twelve questions. The headroom is not
 * stated as a multiple again — a ratio between a gated figure and a
 * constant is a claim nothing holds. What the fence catches when it is
 * reached (a bank past it, or paid `paidq-` qids on top of one) is
 * `qOther`, the "…and more" cell the client's own cap already spills
 * into, so the reading stays reported rather than silently dropped.
 */
export const QID_KEY_MAX = 64;
export const QIDS_PER_DAY_CAP = 1500;

/** Pure: fold shards (all of one day, or several) into per-day deltas.
 * The rules pin the key vocabulary but deliberately not the values
 * (rules cannot iterate a map) — so the clamps live HERE, on the only
 * reader: buckets to 0..4 integers, rates to [MIN_SHARD_RATE, 1]. */
const clampBucket = (raw: unknown): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.min(4, Math.max(0, Math.trunc(raw))) : 0;

export function foldShards(
  shards: AttentionShardDoc[],
  /**
   * The question keys each day's document ALREADY holds — what makes the
   * cap below a fence around the DAY rather than around this call.
   *
   * Without it the cap counted only the keys in the delta being built, and
   * `runAttentionFold` builds one delta per CHUNK of 300 shards and merges
   * every one of them into the same day document. So the 1,500 test reset
   * itself every chunk: 600 shards of distinct keys put 3,000 on one day
   * doc, measured, and nothing bounded the total at all. Past ~2,500 the
   * document exceeds Firestore's 40,000 index entries, the batch fails,
   * the shards are never deleted so they come back on every page forever,
   * and the rollup fold and its heartbeat — awaited after this — stop
   * running with it. Recovery is a manual delete.
   *
   * Optional because the fold is also called directly on a whole day's
   * shards, where the delta IS the day.
   */
  held?: (day: string) => ReadonlySet<string> | undefined,
): Map<string, AttnDelta> {
  const out = new Map<string, AttnDelta>();
  // Per day: everything the document will hold once this delta lands —
  // what it already had, plus what this call has admitted so far. The cap
  // is a test on THIS, which is the number that has to stay under 2,500.
  const union = new Map<string, Set<string>>();
  for (const shard of shards) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shard.day)) continue;
    // A rate outside the honest range weighs ONE device, which is what an
    // absent or junk rate has always done here — not a rescale to the
    // floor, because a shard claiming 1e-12 is not a shard that sampled
    // hard, it is a shard that lied, and treating it as 1000 devices
    // would be believing the lie by three orders of magnitude less.
    const rate =
      typeof shard.rate === "number"
        && shard.rate >= MIN_SHARD_RATE
        && shard.rate <= 1
        ? shard.rate
        : 1;
    const weight = 1 / rate;
    let delta = out.get(shard.day);
    if (!delta) {
      delta = { devices: 0, s: {}, q: {}, qOther: 0 };
      out.set(shard.day, delta);
      union.set(shard.day, new Set(held?.(shard.day) ?? []));
    }
    const dayKeys = union.get(shard.day)!;
    delta.devices = round2(delta.devices + weight);
    const s = shard.s && typeof shard.s === "object" ? (shard.s as Record<string, unknown>) : {};
    for (const [key, raw] of Object.entries(s)) {
      const bucket = clampBucket(raw);
      if (bucket <= 0) continue;
      const c = delta.s[key] || (delta.s[key] = { reach: 0, est: 0 });
      c.reach = round2(c.reach + weight);
      c.est = round2(c.est + BUCKET_MIDPOINTS[bucket] * weight);
    }
    // D271: the per-question map. The client's `_other` overflow cell is
    // truncation, not a question — counted apart so a capped device
    // reads as "…and more", never as a phantom qid.
    const q = shard.qids && typeof shard.qids === "object"
      ? (shard.qids as Record<string, unknown>)
      : {};
    // Overflow is counted ONCE per shard, like the client's own `_other`
    // cell: a shard that overran the cap is one device reading "…and
    // more", not one per key it brought.
    let spilled = false;
    const spill = () => {
      if (spilled) return;
      spilled = true;
      delta!.qOther = round2(delta!.qOther + weight);
    };
    for (const [qid, kindsRaw] of Object.entries(q)) {
      if (!kindsRaw || typeof kindsRaw !== "object") continue;
      if (qid === "_other") {
        spill();
        continue;
      }
      // The two fences (QID_KEY_MAX / QIDS_PER_DAY_CAP above). A key too
      // long to be a question id is refused outright; a NEW key past the
      // day's cap spills, while one already in the map keeps counting —
      // truncating a question halfway through a day would be worse than
      // either outcome.
      if (qid.length > QID_KEY_MAX) {
        spill();
        continue;
      }
      // A THIRD FENCE, and the only one about the NAME rather than the
      // size. `delta.q` is a plain object indexed by a key any anonymous
      // device chooses — the rules bound that map by COUNT (120) and never
      // by name — so `delta.q[qid] || (delta.q[qid] = {})` hands a
      // prototype member straight through. Reproduced against the compiled
      // fold: one shard carrying `constructor` puts `{reach, est}` on the
      // global `Object` itself, which outlives the invocation on a warm
      // instance, while that shard's tally for the key is silently
      // discarded. `__proto__` is defused today only by an accident of how
      // the Admin SDK deserialises maps — nothing here pins it, and the
      // day it changes the same shape blanks real questions' cells.
      //
      // `breakdownBucket`'s idiom, one module over, for the same reason.
      if (qid in ({} as Record<string, unknown>)) {
        spill();
        continue;
      }
      if (!dayKeys.has(qid) && dayKeys.size >= QIDS_PER_DAY_CAP) {
        spill();
        continue;
      }
      dayKeys.add(qid);
      for (const [kind, raw] of Object.entries(kindsRaw as Record<string, unknown>)) {
        if (kind !== "s" && kind !== "a" && kind !== "p" && kind !== "d") continue;
        const bucket = clampBucket(raw);
        if (bucket <= 0) continue;
        const kinds = delta.q[qid] || (delta.q[qid] = {});
        const c = kinds[kind] || (kinds[kind] = { reach: 0, est: 0 });
        c.reach = round2(c.reach + weight);
        c.est = round2(c.est + BUCKET_MIDPOINTS[bucket] * weight);
      }
    }
  }
  return out;
}

export async function runAttentionFold(
  store: AttentionStore,
  cap = SHARD_FOLD_CAP,
): Promise<{ shards: number; days: number; capped: boolean }> {
  let folded = 0;
  // BY ID, not a count: an unfoldable shard is not deleted, so it comes
  // back on every page, and adding page lengths would count it once per
  // pass. The set is what keeps `shards` an honest total of DISTINCT
  // shards seen — and it is bounded by the page size, because a whole
  // page of them ends the loop.
  const skipped = new Set<string>();
  const days = new Set<string>();
  // day → the question keys its document holds, seeded from the document
  // and grown as this run's chunks land. Outlives the page loop.
  const heldByDay = new Map<string, Set<string>>();

  for (;;) {
    const seen = folded + skipped.size;
    const want = Math.min(SHARD_READ_PAGE, cap - seen);
    if (want <= 0) break;
    const page = await store.shardPage(want);
    if (!page.length) break;

    const byDay = new Map<string, AttentionShardDoc[]>();
    for (const shard of page) {
      const list = byDay.get(shard.day) || [];
      list.push(shard);
      byDay.set(shard.day, list);
    }
    const before = folded;
    for (const [day, shards] of byDay) {
      days.add(day);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { // unfoldable; left for a human
        for (const s of shards) skipped.add(s.id);
        continue;
      }
      // WHAT THE DAY ALREADY HOLDS, read once and then carried across
      // every chunk of it — including the pages after this one, which is
      // why the map lives outside the page loop. Each chunk becomes its
      // own delta merged into the same document, so a cap that could only
      // see one delta was no cap at all.
      let seen = heldByDay.get(day);
      if (!seen) {
        seen = new Set(await store.dayQids(day));
        heldByDay.set(day, seen);
      }
      const dayKeys = seen;
      for (let i = 0; i < shards.length; i += SHARD_CHUNK) {
        const chunk = shards.slice(i, i + SHARD_CHUNK);
        const delta = foldShards(chunk, (d) => (d === day ? dayKeys : undefined)).get(day);
        if (delta) {
          await store.applyAttention(day, delta, chunk.map((s) => s.id));
          for (const qid of Object.keys(delta.q)) dayKeys.add(qid);
        }
        folded += chunk.length;
      }
    }

    // A short page means the collection is drained. A full page that
    // folded nothing means every shard left is unfoldable — asking again
    // returns the same ones forever.
    if (page.length < want || folded === before) break;
  }

  const shards = folded + skipped.size;
  return { shards, days: days.size, capped: shards >= cap };
}

export function firestoreAttentionStore(db: Firestore): AttentionStore {
  return {
    async shardPage(cap) {
      const snap = await db.collection("v2_attention").limit(cap).get();
      return snap.docs.map((d) => ({
        id: d.id,
        day: String(d.get("day") ?? ""),
        rate: d.get("rate"),
        s: d.get("s"),
        qids: d.get("qids"),
      }));
    },
    async dayQids(day) {
      // The whole document rather than a projection: Firestore cannot
      // project a map's KEYS, and this map is exactly what the cap keeps
      // small. One read per day per run.
      const snap = await db.collection("v2_engagement_daily").doc(day).get();
      const q = snap.get("attn.q");
      return new Set(q && typeof q === "object" ? Object.keys(q as object) : []);
    },
    async applyAttention(day, delta, shardIds) {
      const batch = db.batch();
      const inc = (c: AttnCounter) => ({
        reach: FieldValue.increment(c.reach), est: FieldValue.increment(c.est),
      });
      const s: Record<string, unknown> = {};
      for (const [key, c] of Object.entries(delta.s)) s[key] = inc(c);
      const q: Record<string, Record<string, unknown>> = {};
      for (const [qid, kinds] of Object.entries(delta.q)) {
        q[qid] = {};
        for (const [kind, c] of Object.entries(kinds)) q[qid][kind] = inc(c);
      }
      batch.set(
        db.collection("v2_engagement_daily").doc(day),
        // A day older than the digest's catch-up may have no doc at all;
        // this merge then creates an attn-only one, and the console's
        // reader treats a doc with no `actives` as not-digested rather
        // than as a zero day (pulse-collect.mjs).
        {
          day,
          attn: {
            devices: FieldValue.increment(delta.devices),
            // EMIT-WHEN-SET, like the two lines under it — and it was the
            // one of the three that was not. An empty map written under
            // { merge: true } does not merge into what is there, it
            // REPLACES it: Firestore puts an explicitly-written empty map
            // in the update mask, and the SDK says so in those words
            // ("Add a field path for an explicitly updated empty map").
            // So one shard carrying `s: {}` erased `attn.s` for the whole
            // day — opens, slow boots, errors, tab and lens visits,
            // answers by surface, reveals, notification opens — and it
            // could not be recomputed, because the same batch deletes the
            // shards it was folded from, three lines below.
            //
            // Reachable without an attacker: `onHidden()` calls
            // `ensureToday()` without `note()`, so a phone backgrounded
            // just after UTC midnight and not reopened that day flushes a
            // shard whose `s` is empty, and a LATE shard — this fold's own
            // header calls that the normal case — lands on a later night,
            // after the day's real counters are already in the document.
            // It was also a one-write attack: the rules require only that
            // `s` be a map whose keys are known, and `{}` satisfies that.
            ...(Object.keys(s).length ? { s } : {}),
            ...(Object.keys(q).length ? { q } : {}),
            ...(delta.qOther ? { qOther: FieldValue.increment(delta.qOther) } : {}),
          },
        },
        { merge: true },
      );
      for (const id of shardIds) batch.delete(db.collection("v2_attention").doc(id));
      await batch.commit();
    },
  };
}

// ── rung 2: the rollup fold (R3/D272) ───────────────────────────
//
// Devices write one uid-keyed day rollup per finished day (v2_users/
// {uid}/engagement/{day}); this fold sums them into the day docs'
// `people` section and marks each rollup `folded: true` — the rollups
// are NOT deleted (their 90-day TTL is the deletion; the trail under the
// account is the point of the channel), so the folded flag is what makes
// the sweep exactly-once. Late rollups are as normal as late shards: a
// device flushes yesterday on its next boot, so the query is "unfolded",
// not "yesterday". Exactly-once is per chunk, the shard fold's shape:
// each chunk's day-doc increments, its folded-marks and its _state
// updates commit in one batch.
//
// FADE — the reading only this channel can produce (ENGAGEMENT-PLAN
// §3.3): the digest's `_state` doc gains `fg7`, the trailing window of
// foreground buckets, advanced here as each rollup folds; a window that
// sinks two buckets is a person going quiet while still opening the app.
// The window advances in day order within a run; a rollup arriving days
// late lands out of order and smears the window by one slot — noise on a
// bucketed trend, accepted and stated.

export const ROLLUP_FOLD_CAP = 10_000;
// 1 day-doc set + ≤200 folded marks + ≤200 _state sets per batch — 401,
// under Firestore's 500-op limit. `fgWindows.size` equals `rows.length`
// (one rollup per person per day), so the batch is exactly `2n + 1` and
// the ceiling is 249. Exported because nothing pinned that arithmetic:
// raising this to 400 makes it 801 and every test stayed green.
export const ROLLUP_CHUNK = 200;

export interface RollupRow {
  uid: string;
  day: string;
  sessions: unknown;
  fgMin: unknown;
  quiet: unknown;
  answers: unknown;
  depthEnd: unknown;
  dayparts: unknown;
}

export interface PeopleDelta {
  rollups: number;
  sessions: number;
  quiet: number;
  answers: number;
  depthEnd: number;
  dayparts: [number, number, number, number];
  fgBuckets: [number, number, number, number, number];
  fading: number;
}

export interface RollupStore {
  /** Up to `cap` unfolded rollups, any day. */
  rollupPage(cap: number): Promise<RollupRow[]>;
  /** The uids' trailing fg windows (absent uid → no window yet). */
  getFgStates(uids: string[]): Promise<Map<string, number[]>>;
  /** ONE atomic commit: merge the delta into the day doc's `people`
   * section, mark exactly these rollups folded, write these windows. */
  applyRollups(
    day: string,
    delta: PeopleDelta,
    rows: Array<{ uid: string; day: string }>,
    fgWindows: Map<string, number[]>,
  ): Promise<void>;
}

const clampInt = (raw: unknown, max: number): number =>
  typeof raw === "number" && Number.isFinite(raw)
    ? Math.min(max, Math.max(0, Math.trunc(raw)))
    : 0;

/** Advance a trailing fg window by one folded day. Fading: six or more
 * readings, and the newest three average two buckets under the window's
 * first three — sinking, not merely low. */
export function advanceFgWindow(prev: number[] | undefined, fgMin: number): {
  fg7: number[];
  fading: boolean;
} {
  const win = [...(Array.isArray(prev) ? prev.map((v) => clampInt(v, 4)) : []), clampInt(fgMin, 4)]
    .slice(-7);
  let fading = false;
  if (win.length >= 6) {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    fading = avg(win.slice(-3)) + 2 <= avg(win.slice(0, 3));
  }
  return { fg7: win, fading };
}

/** Pure: fold one chunk's rollups (all of one day) into the people
 * delta. Clamps every value — the rules bound honest clients; this
 * bounds the rest. `fading` is added by the runner, which holds the
 * windows. */
export function foldRollups(rows: RollupRow[]): PeopleDelta {
  const delta: PeopleDelta = {
    rollups: 0, sessions: 0, quiet: 0, answers: 0, depthEnd: 0,
    dayparts: [0, 0, 0, 0], fgBuckets: [0, 0, 0, 0, 0], fading: 0,
  };
  for (const row of rows) {
    delta.rollups++;
    delta.sessions += clampInt(row.sessions, 300);
    delta.quiet += clampInt(row.quiet, 300);
    delta.answers += clampInt(row.answers, 2000);
    delta.depthEnd += clampInt(row.depthEnd, 1);
    delta.fgBuckets[clampInt(row.fgMin, 4)]++;
    const parts = Array.isArray(row.dayparts) ? row.dayparts : [];
    for (let i = 0; i < 4; i++) delta.dayparts[i] += clampInt(parts[i], 300);
  }
  return delta;
}

export async function runRollupFold(
  store: RollupStore,
  cap = ROLLUP_FOLD_CAP,
): Promise<{ rollups: number; days: number; capped: boolean }> {
  const page = await store.rollupPage(cap);
  const byDay = new Map<string, RollupRow[]>();
  for (const row of page) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !row.uid) continue;
    const list = byDay.get(row.day) || [];
    list.push(row);
    byDay.set(row.day, list);
  }
  // Oldest day first, so a uid with two late rollups advances its fg
  // window in calendar order within this run.
  const days = [...byDay.keys()].sort();
  for (const day of days) {
    const rows = byDay.get(day)!;
    for (let i = 0; i < rows.length; i += ROLLUP_CHUNK) {
      const chunk = rows.slice(i, i + ROLLUP_CHUNK);
      const delta = foldRollups(chunk);
      const states = await store.getFgStates(chunk.map((r) => r.uid));
      const fgWindows = new Map<string, number[]>();
      for (const row of chunk) {
        const adv = advanceFgWindow(states.get(row.uid), clampInt(row.fgMin, 4));
        fgWindows.set(row.uid, adv.fg7);
        if (adv.fading) delta.fading++;
      }
      await store.applyRollups(day, delta, chunk.map((r) => ({ uid: r.uid, day: r.day })), fgWindows);
    }
  }
  return { rollups: page.length, days: byDay.size, capped: page.length >= cap };
}

export function firestoreRollupStore(db: Firestore): RollupStore {
  const stateRef = (uid: string) =>
    db.collection("v2_users").doc(uid).collection("engagement").doc("_state");
  return {
    async rollupPage(cap) {
      // The collection-group single-field index on `folded` is a
      // fieldOverride in firestore.indexes.json — deployed with the
      // rules, per the existing --only path.
      // ORDERED BY DAY, and the order is the whole fairness argument.
      //
      // With no orderBy, Firestore falls back to `__name__` — which for
      // this collection group is `v2_users/{uid}/engagement/{day}`, so the
      // page was uid-major. Below the cap that is invisible; above it, the
      // SAME low-sorting uids are taken every night and the high-sorting
      // ones never reach the front of the queue. Their rollups die
      // unfolded at the 90-day TTL, `people` becomes a biased
      // sub-population rather than a count, and `fg7` never advances for
      // them so D272's fade signal cannot fire for those accounts at all.
      //
      // The cap's stated contract — "leftovers fold the next night" — is
      // only true if the queue is FIFO, so it is ordered by the day the
      // rollup is for. Note that an explicit `__name__` order would be the
      // same starvation with the fallback written down; the fix is a
      // different key, not a stated one.
      //
      // Needs a COMPOSITE collection-group index (folded ASC, day ASC) —
      // the single-field `folded` override no longer covers the query.
      // The emulator does not enforce index configuration, so nothing in
      // the e2e suites can catch its absence; indexes.test.ts pins it.
      const snap = await db.collectionGroup("engagement")
        .where("folded", "==", false)
        .orderBy("day")
        .limit(cap)
        .get();
      return snap.docs.map((d) => ({
        uid: d.ref.parent.parent?.id ?? "",
        day: String(d.get("day") ?? ""),
        sessions: d.get("sessions"),
        fgMin: d.get("fgMin"),
        quiet: d.get("quiet"),
        answers: d.get("answers"),
        depthEnd: d.get("depthEnd"),
        dayparts: d.get("dayparts"),
      }));
    },
    async getFgStates(uids) {
      const out = new Map<string, number[]>();
      const unique = [...new Set(uids)];
      for (let i = 0; i < unique.length; i += 300) {
        const chunk = unique.slice(i, i + 300);
        const snaps = await db.getAll(...chunk.map(stateRef));
        snaps.forEach((snap, j) => {
          if (snap.exists && Array.isArray(snap.get("fg7"))) {
            out.set(chunk[j], snap.get("fg7") as number[]);
          }
        });
      }
      return out;
    },
    async applyRollups(day, delta, rows, fgWindows) {
      const batch = db.batch();
      batch.set(
        db.collection("v2_engagement_daily").doc(day),
        {
          day,
          people: {
            rollups: FieldValue.increment(delta.rollups),
            sessions: FieldValue.increment(delta.sessions),
            quiet: FieldValue.increment(delta.quiet),
            answers: FieldValue.increment(delta.answers),
            depthEnd: FieldValue.increment(delta.depthEnd),
            fading: FieldValue.increment(delta.fading),
            // maps rather than lists: FieldValue.increment needs a field
            // path, and a list element has none
            dayparts: Object.fromEntries(delta.dayparts.map((v, i) => [`d${i}`, FieldValue.increment(v)])),
            fgBuckets: Object.fromEntries(delta.fgBuckets.map((v, i) => [`b${i}`, FieldValue.increment(v)])),
          },
        },
        { merge: true },
      );
      for (const row of rows) {
        batch.update(
          db.collection("v2_users").doc(row.uid).collection("engagement").doc(row.day),
          { folded: true },
        );
      }
      for (const [uid, fg7] of fgWindows) {
        batch.set(stateRef(uid), { fg7 }, { merge: true });
      }
      await batch.commit();
    },
  };
}

// The scheduled function that ran the three folds below — the digest,
// then the attention fold, then the rollup fold — is `digestEngagementV2`
// in nightly.ts since D398, where it also hosts the patterns fit and the
// taste fold over one shared ledger read. The deploy identity and the
// heartbeat metric (`engagement_digest`) are unchanged; only the module
// moved, so that the pass has one home and one header.
