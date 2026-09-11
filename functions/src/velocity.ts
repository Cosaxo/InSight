// velocity.ts — D54: the ledger gets eyes.
//
//   runVelocityScan      a nightly pass over `v2_agg_events` (D28's
//                        attribution ledger) that logs, and only logs,
//                        the ring-shaped patterns an operator would
//                        otherwise have to notice by luck. Its output is
//                        the INPUT to the correction runbook
//                        (docs/DEPLOYMENT.md, "Correcting aggregates"),
//                        never a verdict: D29 records the shape of this
//                        lever as "feeding manual review rather than
//                        automatic denial", and this file keeps to it —
//                        nothing here denies, delays or down-weights a
//                        vote. It was its own scheduled function
//                        (`ledgerVelocityScan`, 03:47 UTC) until
//                        DATA-EFFICIENCY-RUNBOOK 4.4 folded it into the
//                        02:23 pass (nightly.ts): the whole days of its
//                        window come off the reader the other folds
//                        already share, and only the partial day since
//                        midnight is its own read.
//
// Purpose limitation, stated because D47 makes it a live question: this
// reads the ledger for exactly the purpose D28 collected it — attributing
// fake-account activity so the record stays correctable. It is NOT the
// DAU/retention counting D47 deferred; that remains a new purpose for
// this data and remains undone until its own record says otherwise.
//
// What a flag means, and does not mean. Honest crowds produce two of
// these signals on their best days: a launch spike or a press mention is
// a birth cluster, and a question shared into a big group chat is a
// burst. That is WHY the output is a WARNING in the log and not an
// action — the operator reads the flag, pulls the uids' ledger entries,
// and decides. Expect false positives on good days; the cost of one is
// a person reading a log line.
//
// What this cannot catch, so the layer above stays honest (D28/D29):
// the +1-account-per-device-per-month drip (designed to sit under the
// publish cadence's noise floor), paid humans at human cadence, and any
// ring patient enough to mimic organic arrival. The scan's job is to
// force attackers into exactly that slow, human-shaped posture — which
// the device-bind month rule then prices per device.

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { utcDayKeyOf } from "./pure";
import type { LedgerDayReader } from "./ledger";
// ops.ts sets the global runtime options as an import side effect and
// must be evaluated before any function here is defined — same reason
// every other function module imports it (check:fn-runtime guards the
// outcome).
import { V2_QUESTIONS } from "./v2content";
import { REQUIRED_LEVEL, levelDef } from "./accountLevel";


// ── pure signal logic (unit-tested, velocity.test.ts) ───────────
//
// Thresholds are exported so the tests pin behaviour AT the boundary
// rather than around it. They are engineering defaults, not physics
// (D37's framing), and each moves in a known direction: raising a floor
// trades misses for quieter logs; lowering it trades operator attention
// for earlier notice.

export interface LedgerRow {
  uid: string;
  qid: string;
  atMs: number;
  /** A D86 edit's ledger row, marked by `fromIdx` on the entry. Counted in
   *  CADENCE — an edit is an action, and a script's rhythm shows in it —
   *  and not in VOLUME, where the ceiling is one entry per question. */
  isEdit?: boolean;
}

// UTC calendar day, "YYYY-MM-DD" — the ledger's `at` is server commit
// time, so bucketing must be UTC or the per-day baselines drift with
// whoever deployed last.

// The impossible-volume ceiling. Answers are create-only with doc id ==
// qid and deleteAccount sweeps the ledger with the account, so one uid
// can never honestly hold more than one CREATE per aggregate-feeding bank
// question — not per day, ever.
//
// CREATES, and that word is the correction. This said "one ledger entry
// per question" and D86 broke it: an optionIdx edit writes a SECOND row
// (v2.ts's update arm, `ledgerEntry(uid, qid, toIdx, fromIdx)`), which is
// why ledger.ts projects `fromIdx` and why both nightly folds dedupe on
// it. With the bank at its current size the ceiling had become almost
// exactly the honest maximum, so a heavy user who also revised answers
// inside the 72-hour window could cross it — a false WARN on the person
// using the app most.
//
// Restored by counting what the invariant is about rather than by
// inflating the bound: edit rows are excluded from the volume count and
// still feed the cadence signal, which is where an edit-spam script would
// show anyway. Duel surfaces never reach the ledger
// (they feed member reveals, not aggregates — D29), so they are not in
// the ceiling. Derived from the committed bank at cold start, the
// POLITICAL_QIDS pattern: no Firestore read.
// The criterion is "reaches the ledger", not a list to extend by habit:
// onV2AnswerCreated diverts group/duo and folds everything else, so every
// other surface writes a v2_agg_events row. `call` was missing — an
// ordinary world answer in every respect, which is what isCallAnswer's
// own comment in firestore.rules says ("isWorldAnswer plus ONE clause").
export function isAggregateSurface(surface: string): boolean {
  return surface === "daily" || surface === "feed" || surface === "test" || surface === "learn"
    || surface === "pulse" || surface === "call";
}
export const AGG_BANK_SIZE = V2_QUESTIONS.filter((q) => isAggregateSurface(q.surface)).length;

// The pulse (D139) breaks "one entry per question, ever": a pulse answer
// is one per question per DAY, so an honest uid can carry up to one entry
// per pulse template per day the window spans.
//
// PER DAY OF THE SCAN'S WINDOW, not of the ledger's retention. This
// allowance was derived from the 90-day `expireAt` TTL, and the quantity
// it is compared against is `fold.createsPerUid.get(uid)` — non-edit
// entries inside the scan window, which `WINDOW_CAP_MS` caps at 72 hours.
// (It said `perUid.get(uid).length` until the edit rows were split out;
// that is the cadence signal's quantity, not this one.) At the
// current bank that made the ceiling 1026 against an honest maximum of
// about 596: the detector's stated target is a dedup failure or forged
// writes, which shows as roughly 2x a uid's real count, and 2x an
// ordinary heavy day sat comfortably underneath. The signal was not
// wrong, it was asleep.
//
// +1 because a 72-hour window can touch four calendar days.
export const PULSE_BANK_SIZE = V2_QUESTIONS.filter((q) => q.surface === "pulse").length;
export const WINDOW_CAP_MS = 72 * 3600_000;
export const WINDOW_MAX_DAYS = Math.ceil(WINDOW_CAP_MS / 86_400_000) + 1;
export const VOLUME_CEILING = AGG_BANK_SIZE + PULSE_BANK_SIZE * WINDOW_MAX_DAYS;

// Scripted cadence. A human answering the backlog reads each question,
// and reading time varies question to question — the coefficient of
// variation of their inter-answer gaps sits well above these floors. A
// script's sleep(5s) sits near zero, and uniform jitter must spread
// wider than ±40% of its own mean to clear 0.25. The mean floor is the
// second jaw: nobody reads and answers sustained at under 2s/question,
// however varied the gaps.
export const CADENCE_MIN_N = 15;
export const CADENCE_CV_FLOOR = 0.25;
export const CADENCE_MIN_MEAN_MS = 2000;

export interface CadenceStat {
  n: number;
  meanMs: number;
  cv: number;
  flagged: boolean;
}

// null below CADENCE_MIN_N: fewer answers than that cannot distinguish
// a keen human from a careful script, and flagging on them would make
// every enthusiastic new user a log line.
export function cadenceSignal(atMs: number[]): CadenceStat | null {
  if (atMs.length < CADENCE_MIN_N) return null;
  const ts = [...atMs].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean <= 0) {
    // Every timestamp identical — a batch writer, not a person.
    return { n: ts.length, meanMs: 0, cv: 0, flagged: true };
  }
  const variance = gaps.reduce((a, g) => a + (g - mean) * (g - mean), 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;
  return {
    n: ts.length,
    meanMs: Math.round(mean),
    cv,
    flagged: cv < CADENCE_CV_FLOOR || mean < CADENCE_MIN_MEAN_MS,
  };
}

// Birth clustering — the runbook's own first-listed signal ("Auth
// creation-time clusters"), mechanized. A ring minted by one operator
// tends to be born in one sitting; CLUSTER_MIN accounts created within
// CLUSTER_WINDOW_MS that ALL voted in the same scan window is that
// sitting showing up in the tallies. Overlapping windows merge, so a
// 40-account hour reports as one cluster of 40, not 36 clusters of 5.
export const CLUSTER_MIN = 5;
export const CLUSTER_WINDOW_MS = 10 * 60_000;

export interface BirthCluster {
  uids: string[];
  spanMs: number;
  startMs: number;
}

export function birthClusters(
  created: { uid: string; createdMs: number }[],
): BirthCluster[] {
  const rows = [...created].sort((a, b) => a.createdMs - b.createdMs);
  const runs: { lo: number; hi: number }[] = [];
  let lo = 0;
  for (let hi = 0; hi < rows.length; hi++) {
    while (rows[hi].createdMs - rows[lo].createdMs > CLUSTER_WINDOW_MS) lo++;
    if (hi - lo + 1 >= CLUSTER_MIN) {
      const last = runs[runs.length - 1];
      if (last && lo <= last.hi) last.hi = hi;
      else runs.push({ lo, hi });
    }
  }
  return runs.map((r) => ({
    uids: rows.slice(r.lo, r.hi + 1).map((x) => x.uid),
    spanMs: rows[r.hi].createdMs - rows[r.lo].createdMs,
    startMs: rows[r.lo].createdMs,
  }));
}

// Per-question burst against the question's own trailing baseline. The
// deck makes naive burst detection lie: the daily question is answered
// by everyone on its day, and a freshly promoted question debuts from
// zero — both are bursts by design. BASELINE_MIN_DAYS is the guard: a
// question must have an ESTABLISHED quiet history before a jump flags,
// which is exactly the shape of the attack worth this signal — a ring
// stuffing an old question to flip a settled split. A ring riding the
// current daily question hides in its crowd; that one is the cadence
// and cluster signals' job.
export const BURST_MIN = 10;
export const BURST_MULT = 4;
export const BASELINE_DAYS = 7;
export const BASELINE_MIN_DAYS = 3;

// dayKey -> qid -> count. The scan's state doc carries the trailing
// window of these; ~bank-size keys per day, far under the 1 MiB doc
// limit at any plausible size.
export type DayCounts = Record<string, Record<string, number>>;

export interface BurstStat {
  qid: string;
  day: string;
  count: number;
  baselineMean: number;
  baselineDays: number;
  flagged: boolean;
}

export function burstSignal(
  qid: string,
  day: string,
  count: number,
  days: DayCounts,
): BurstStat {
  // Days strictly before the one under test; a day the scan never saw
  // is unknown, not zero, so only recorded days count toward baseline.
  const prior = Object.keys(days).filter((d) => d < day);
  const counts = prior.map((d) => days[d][qid] || 0);
  const baselineDays = counts.length;
  const baselineMean = baselineDays
    ? counts.reduce((a, b) => a + b, 0) / baselineDays
    : 0;
  return {
    qid,
    day,
    count,
    baselineMean,
    baselineDays,
    flagged:
      baselineDays >= BASELINE_MIN_DAYS &&
      count >= BURST_MIN &&
      count >= BURST_MULT * Math.max(1, baselineMean),
  };
}

// ── bind coverage (D342) — a MEASUREMENT, not a signal ──────────
//
// WHAT IT IS. Of the accounts that actually voted this window, how many
// hold D29's `db` claim, and how many of the window's counted answers came
// from them. Two ratios, logged at INFO: this flags nothing and accuses
// nobody, which is why it sits apart from the four signals above.
//
// WHY IT EXISTS, and it closes a hole in D37 rather than adding a nicety.
// D37 makes the enforcement flip conditional on two rates read from
// `activateDeviceV2`'s own logs: the error rate, and Android's
// missing-recall rate. Both measure THE ENDPOINT. Neither can see an
// account that never called it — a client below the activation build, a
// device whose bridge is absent (which was every device until D342), a
// boot where the call was never reached. Those accounts vote and are
// invisible to both numbers, so both thresholds can read perfect while
// most voters would be refused the moment the flip lands. That is exactly
// the silent-refusal failure D37 exists to prevent, surviving inside D37's
// own instrument.
//
// This measures the POPULATION THAT MATTERS instead: people who voted.
// `1 - boundAnswers/answers` is, directly, the share of real votes the
// flip would have refused had it been on during this window.
//
// COST: zero extra reads. The scan already fetches a UserRecord for every
// uid in the window for the birth-cluster signal, and custom claims ride
// that record.
export interface LevelTally {
  voters: number;
  answers: number;
}

export interface BindCoverage {
  voters: number;
  answers: number;
  /** Level → what that level's accounts contributed. Sparse: only levels seen. */
  byLevel: Map<number, LevelTally>;
}

/**
 * `perUid` is the window fold's per-account timestamp lists, so its value
 * lengths ARE that account's counted answers. `levels` maps uid → the `db`
 * claim it holds.
 *
 * A uid absent from `levels` counts as LEVEL 0. That includes accounts
 * erased since they voted (D28's vote-then-erase residual — getUsers
 * simply omits them), and it is the honest direction: an answer that
 * cannot be shown to have come from a qualifying account has not been
 * shown to have come from one. The other direction overstates coverage on
 * precisely the day it is trusted.
 *
 * THAT ARGUMENT HOLDS FOR AN ACCOUNT THAT WAS ASKED ABOUT AND NOT FOUND,
 * and for no other kind — so `perUid` must arrive already narrowed to the
 * accounts the Auth read actually reached. An account nobody asked about
 * is not evidence in either direction, and counting it at L0 makes the
 * ladder say "unbound" about a question that was never put. The caller
 * narrows it; this note is here because the two are far apart in the
 * file and the bound that made them differ arrived later than both.
 */
export function bindCoverage(
  perUid: Map<string, number[]>,
  levels: Map<string, number>,
): BindCoverage {
  const byLevel = new Map<number, LevelTally>();
  let voters = 0;
  let answers = 0;
  for (const [uid, times] of perUid) {
    const lvl = levels.get(uid) ?? 0;
    voters += 1;
    answers += times.length;
    const t = byLevel.get(lvl) || { voters: 0, answers: 0 };
    t.voters += 1;
    t.answers += times.length;
    byLevel.set(lvl, t);
  }
  return { voters, answers, byLevel };
}

/**
 * What moving the bar to `bar` would have cost over this window: the
 * voters and answers sitting BELOW it.
 *
 * This is the number to read before raising `REQUIRED_LEVEL`
 * (accountLevel.ts) — and before the first flip of `deviceBindEnforced`,
 * where the bar is already 1. `refusedAnswers / answers` is the share of
 * real votes that would have been silently rolled back, which is the
 * failure D37 exists to prevent and could not see (D342).
 */
export function refusedAt(cov: BindCoverage, bar: number): LevelTally {
  let voters = 0;
  let answers = 0;
  for (const [lvl, t] of cov.byLevel) {
    if (lvl < bar) {
      voters += t.voters;
      answers += t.answers;
    }
  }
  return { voters, answers };
}

/** Percent, one decimal, and 0 rather than NaN on an empty window. */
export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

export interface WindowFold {
  entries: number;
  perUid: Map<string, number[]>;
  /** Non-edit rows per uid — what VOLUME_CEILING bounds. Separate from
   *  `perUid` because cadence wants every action and volume wants one per
   *  question; folding them into one number would put the invariant back
   *  where D86 left it. */
  createsPerUid: Map<string, number>;
  perDayQid: DayCounts;
}

export function emptyFold(): WindowFold {
  return { entries: 0, perUid: new Map(), createsPerUid: new Map(), perDayQid: {} };
}

// Fold a batch INTO an existing accumulator. The scan calls this once per
// page so it never holds the whole window as LedgerRow objects: a row is
// ~5 machine words (two string refs, a double, object header), while the
// fold keeps one packed double per entry plus one Map slot per uid. That
// is the difference between a 256 MiB instance surviving the 72 h
// catch-up window and OOM-ing on it — see the scan below.
export function foldInto(acc: WindowFold, rows: LedgerRow[]): WindowFold {
  for (const r of rows) {
    let times = acc.perUid.get(r.uid);
    if (!times) {
      times = [];
      acc.perUid.set(r.uid, times);
    }
    times.push(r.atMs);
    if (!r.isEdit) acc.createsPerUid.set(r.uid, (acc.createsPerUid.get(r.uid) || 0) + 1);
    const day = utcDayKeyOf(r.atMs);
    const forDay = acc.perDayQid[day] || (acc.perDayQid[day] = {});
    forDay[r.qid] = (forDay[r.qid] || 0) + 1;
  }
  acc.entries += rows.length;
  return acc;
}

/**
 * Is this uid over the volume ceiling?
 *
 * EXPORTED and pure, for the reason `heldPageFrom` in paid.ts is: the
 * decision lived inline in the scheduled handler, which no test reaches —
 * the whole `ledgerVelocityScan` body was uncovered (`runVelocityScan`, its
 * shape since DATA-EFFICIENCY-RUNBOOK 4.4, is driven over a fake store, but
 * the extraction stands) — so both halves of the D86 edit fix could be
 * reverted with all 550 tests green. The fold's two
 * cases proved the COUNTING and nothing proved what the count was used
 * for.
 *
 * Reads `createsPerUid`, not `perUid`: an edit writes a second ledger row
 * and the ceiling is one create per question. The cadence signal beside
 * the call site still reads every row.
 */
export function volumeFlagged(fold: WindowFold, uid: string): boolean {
  return (fold.createsPerUid.get(uid) || 0) > VOLUME_CEILING;
}

export function foldWindow(rows: LedgerRow[]): WindowFold {
  return foldInto(emptyFold(), rows);
}

export function mergeDays(state: DayCounts, add: DayCounts): DayCounts {
  const out: DayCounts = {};
  for (const d of new Set([...Object.keys(state), ...Object.keys(add)])) {
    out[d] = { ...(state[d] || {}) };
    for (const [qid, n] of Object.entries(add[d] || {})) {
      out[d][qid] = (out[d][qid] || 0) + n;
    }
  }
  return out;
}

// Day keys sort lexicographically as dates, so "the newest `keep` days"
// is a sort and a slice.
export function pruneDays(days: DayCounts, keep = BASELINE_DAYS): DayCounts {
  const kept = Object.keys(days).sort().slice(-keep);
  const out: DayCounts = {};
  for (const k of kept) out[k] = days[k];
  return out;
}

// ── the scan ────────────────────────────────────────────────────

// One doc, one writer (this function, daily): the cursor plus the
// trailing per-question day counts. Client access is denied outright in
// firestore.rules — same posture as the ledger it summarizes.
const STATE_PATH = "v2_velocity/state";

// A missed run widens the next window instead of losing the day, capped
// so a long outage cannot turn the catch-up scan into a 90-day read.
// Days beyond the cap are simply never analysed — logged as the gap is,
// not silently absorbed. Declared with VOLUME_CEILING above, which is
// derived from it: the ceiling has to describe the window it is compared
// against, and it did not while the two lived 200 lines apart.
const PAGE = 5000;
// Warn lines carry uids (the runbook needs them) but cap the inline
// list — a 500-account cluster is a finding, not a log payload.
const LOG_UID_CAP = 40;

/**
 * Read one window of the ledger and fold it, page by page.
 *
 * EXTRACTED so it can be executed, for the reason `volumeFlagged` above
 * was: the whole `ledgerVelocityScan` body was unreachable from any test,
 * so the paging loop could be broken with every suite green (the run is
 * `runVelocityScan` since DATA-EFFICIENCY-RUNBOOK 4.4 and IS driven by a
 * test; this tail read still is not, which is why the fake below stays).
 * Measured before this existed — widening `page.size < PAGE` to `<=`
 * makes a full first page end the read, and all 607 functions tests
 * stayed green. That turns every one of D28's four signals into a
 * reading of an arbitrary 5,000-row prefix while the heartbeat below
 * goes on logging a confident entry count, and it is also the source of
 * the coverage line the owner is told to read before moving the account
 * bar (accountLevel.ts).
 *
 * Folded PER PAGE rather than accumulated — the argument is at the call
 * site, and it is a memory one: a 50k-DAU catch-up buffered as rows
 * exceeds the instance and leaves the cursor unmoved, so the next run
 * dies identically, forever.
 */
export async function scanLedgerWindow(
  db: Firestore,
  windowStart: number,
  fold: WindowFold = emptyFold(),
): Promise<{ fold: WindowFold; maxAt: number }> {
  // Tracked here rather than reduced over `rows` at the end, for the same
  // reason: there is no `rows` to reduce over any more.
  let maxAt = windowStart;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let q = db
      .collection("v2_agg_events")
      .where("at", ">", Timestamp.fromMillis(windowStart))
      .orderBy("at")
      // `fromIdx` rides along because an edit's row carries it and
      // nothing else does — the volume ceiling is about creates, and a
      // field left out of the projection is a guard that is dead in
      // production while the in-memory fake goes on proving it works
      // (the note store-projection.test.ts exists for).
      .select("uid", "qid", "at", "fromIdx")
      .limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    const pageRows: LedgerRow[] = [];
    for (const d of page.docs) {
      const uid = d.get("uid");
      const at = d.get("at") as Timestamp | undefined;
      // Entries without a uid predate D28's attribution field; they
      // can still be inside the window shortly after that deploy.
      if (typeof uid === "string" && uid && at) {
        const atMs = at.toMillis();
        pageRows.push({
          uid, qid: String(d.get("qid") || ""), atMs,
          ...(d.get("fromIdx") === undefined ? {} : { isEdit: true }),
        });
        if (atMs > maxAt) maxAt = atMs;
      }
    }
    foldInto(fold, pageRows);
    if (page.size < PAGE) break;
    cursor = page.docs[page.docs.length - 1];
  }
  return { fold, maxAt };
}

/**
 * One page of auth records, folded into the two things the scan reads from
 * it: when each account was created, and which of them carry a usable
 * device-bind level.
 *
 * PURE, and extracted for the reason the ledger reader was (the same shape
 * one file over): the loop lived inside the scheduled handler, which no
 * runner executes, so the filter below could be replaced with a coercion
 * and the whole functions suite and every e2e stayed green — while its own
 * comment names exactly what that costs.
 *
 * An ACTUAL integer only, matching what firestore.rules accepts —
 * `get("db", 0) >= n` errors on a string or a boolean and denies. Coercing
 * would overstate coverage: `Number(true)` is 1, so a malformed claim
 * would count as a qualifying account on exactly the day this number is
 * trusted, and the number is D37's flip decision — what share of real
 * votes enforcement would refuse. A level ABOVE the ladder is kept rather
 * than discarded: that is an account minted by a newer deploy than this
 * code, which levelDef describes honestly.
 *
 * An unparseable creation time drops the account from the birth-cluster
 * input rather than seeding it with NaN, which would make every span
 * involving it NaN and the cluster silently unreportable.
 */
export function foldAuthPage(
  users: readonly { uid: string; metadata: { creationTime: string }; customClaims?: Record<string, unknown> | null }[],
  created: { uid: string; createdMs: number }[],
  levels: Map<string, number>,
): void {
  for (const u of users) {
    const ms = Date.parse(u.metadata.creationTime);
    if (!Number.isNaN(ms)) created.push({ uid: u.uid, createdMs: ms });
    const raw = u.customClaims?.db;
    if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) levels.set(u.uid, raw);
  }
}

/** What the runner reads and writes — the pass's Firestore in
 * production (`firestoreVelocityStore`), a fixture in velocity.test.ts. */
export interface VelocityStore {
  getState(): Promise<{ lastScanAt: number; days: DayCounts }>;
  putState(state: { lastScanAt: number; days: DayCounts }): Promise<void>;
  /** A whole UTC day's rows, off the reader the pass shares (D399) — free
   *  for a day another fold already read, one paged read otherwise. */
  ledgerDay(day: string): Promise<LedgerRow[]>;
  /** The rows after `sinceMs`, folded page by page into `into` — the
   *  partial day since midnight, the one read this scan makes itself.
   *  Returns the newest timestamp it saw. */
  ledgerTail(sinceMs: number, into: WindowFold): Promise<number>;
  /** Auth records for up to 100 uids. */
  users(uids: string[]): Promise<readonly { uid: string; metadata: { creationTime: string }; customClaims?: Record<string, unknown> | null }[]>;
}

export interface VelocitySummary {
  entries: number;
  uids: number;
  volumeFlags: number;
  cadenceFlags: number;
  clusterFlags: number;
  burstFlags: number;
  /** Whole days served off the shared reader, and rows the tail read itself. */
  sharedDays: number;
  tailRows: number;
  /** How many of the window's active accounts the Auth fan-out actually
   *  read, and how many there were. Equal on an ordinary night.
   *
   *  THE CLUSTER SIGNAL IS A CLAIM ABOUT A POPULATION, which is what
   *  makes a stop here different from a heal's: a heal that stops leaves
   *  work undone and says so, while a cluster scan that stops reports
   *  "no clusters" about a subset it chose by uid order. So the pair is
   *  in the summary and the pass warns on it — an absence of flags is
   *  only evidence if the scan saw everyone. */
  authScanned: number;
  authTotal: number;
}

/** How long the scan may spend asking Admin Auth about the window's
 *  active accounts before it stops — a SLICE, which `runNightlyPass`
 *  turns into an instant (FANOUT_HEAL_SLICE_MS has the argument for the
 *  shape). Forty seconds is hundreds of round trips at a hundred
 *  accounts each; a window that wants more than that is one where the
 *  cluster signal has stopped being a per-night check and wants a
 *  cursor, which is a design change rather than a longer fold. */
export const VELOCITY_AUTH_SLICE_MS = 40_000;

/** The three log levels the scan speaks — `logger`'s, injectable. */
export type VelocityLog = Pick<typeof logger, "info" | "warn">;

const DAY_MS = 86_400_000;
const utcDayStart = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * One night's scan: the window since the last run (72-hour catch-up cap),
 * folded from the whole days the pass has already read plus the partial
 * day since midnight; then D54's four signals, the coverage line and the
 * heartbeat, exactly as the scheduled function emitted them.
 *
 * THE CURSOR SEMANTICS STAY. `lastScanAt` is the newest entry timestamp
 * seen and is written at the END, so a run that dies re-reads the same
 * window next time; the window is capped at WINDOW_CAP_MS whatever the
 * gap. Rows from a whole day are filtered to those after `windowStart`,
 * so a day read whole for the other folds is never counted twice across
 * two nights.
 */
export async function runVelocityScan(
  store: VelocityStore,
  nowMs: number,
  log: VelocityLog = logger,
  // An absolute instant on the pass's clock (`runNightlyPass`), not a
  // duration — see FANOUT_HEAL_SLICE_MS for why the distinction is the
  // whole shape. `clock` is separate from `nowMs`, which names the window
  // and is one fixed reading for the night.
  opts: { deadlineAt?: number; clock?: () => number } = {},
): Promise<VelocitySummary> {
  const state = await store.getState();
  const lastScanAt = state.lastScanAt || 0;
  const windowStart = Math.max(lastScanAt, nowMs - WINDOW_CAP_MS);

  const fold = emptyFold();
  let maxAt = windowStart;
  let sharedDays = 0;
  // The whole days in the window — every UTC day from the window's first
  // to yesterday — off the shared reader, cut to the rows after the
  // window's start.
  const todayStart = utcDayStart(nowMs);
  for (let dayStart = utcDayStart(windowStart); dayStart < todayStart; dayStart += DAY_MS) {
    const rows = (await store.ledgerDay(utcDayKeyOf(dayStart))).filter((r) => r.uid && r.atMs > windowStart);
    foldInto(fold, rows);
    for (const r of rows) if (r.atMs > maxAt) maxAt = r.atMs;
    sharedDays += 1;
  }
  // The partial day: everything since midnight (or since the window's
  // start, when that is later), read here and folded per page.
  const before = fold.entries;
  const tailSince = Math.max(windowStart, todayStart - 1);
  const tailMax = await store.ledgerTail(tailSince, fold);
  // The cursor is the newest ENTRY seen, never the bound the tail was
  // asked from: an empty tail leaves it where the whole days put it, so
  // a night with nothing since midnight cannot move it past a row that
  // was never read. (A cursor inside yesterday costs the next night one
  // extra day read off the shared reader, filtered to the rows after it —
  // small, and only ever at a size where nobody answers before 02:23.)
  if (tailMax > tailSince && tailMax > maxAt) maxAt = tailMax;
  const tailRows = fold.entries - before;

  // Signals 1 + 2: per-uid volume and cadence.
  let volumeFlags = 0;
  let cadenceFlags = 0;
  for (const [uid, times] of fold.perUid) {
    const creates = fold.createsPerUid.get(uid) || 0;
    if (volumeFlagged(fold, uid)) {
      volumeFlags++;
      log.warn(
        `[velocity] impossible volume: uid=${uid} creates=${creates} of n=${times.length} exceeds the ceiling (${AGG_BANK_SIZE}-question bank + ${PULSE_BANK_SIZE} pulse × ${WINDOW_MAX_DAYS}d of window) — dedup failure or forged writes`,
        { metric: "velocity_flag", kind: "volume", uid, n: creates, entries: times.length },
      );
    }
    const cad = cadenceSignal(times);
    if (cad && cad.flagged) {
      cadenceFlags++;
      log.warn(
        `[velocity] scripted cadence: uid=${uid} n=${cad.n} mean=${cad.meanMs}ms cv=${cad.cv.toFixed(2)}`,
        { metric: "velocity_flag", kind: "cadence", uid, n: cad.n, meanMs: cad.meanMs, cv: cad.cv },
      );
    }
  }

  // Signal 3: birth clusters among the window's active accounts.
  // getUsers takes at most 100 identifiers per call. Accounts already
  // deleted (vote-then-erase — D28 records that residual) simply do
  // not appear; their votes still count toward the other signals.
  const uids = [...fold.perUid.keys()];
  const created: { uid: string; createdMs: number }[] = [];
  // Riding the same fetch: the `db` claim lives on the UserRecord this
  // loop already pulls, so coverage below costs no extra call.
  const levels = new Map<string, number>();
  // ONE ADMIN-AUTH ROUND TRIP PER HUNDRED ACTIVE ACCOUNTS, and until now
  // no bound of any kind on how many — a window with fifty thousand
  // active uids is five hundred sequential calls to a service this pass
  // does not control, inside a 480-second invocation, with five folds
  // still behind it. Checked BEFORE each page, because the question is
  // whether to start another round trip.
  const clock = opts.clock ?? Date.now;
  let scanned = 0;
  for (let i = 0; i < uids.length; i += 100) {
    if (opts.deadlineAt != null && clock() >= opts.deadlineAt) break;
    const page = uids.slice(i, i + 100);
    foldAuthPage(await store.users(page), created, levels);
    scanned += page.length;
  }
  const clusters = birthClusters(created);
  for (const c of clusters) {
    log.warn(
      `[velocity] birth cluster: ${c.uids.length} accounts created within ${Math.round(c.spanMs / 60_000)}m all voted this window`,
      {
        metric: "velocity_flag",
        kind: "cluster",
        size: c.uids.length,
        spanMs: c.spanMs,
        uids: c.uids.slice(0, LOG_UID_CAP),
        truncated: c.uids.length > LOG_UID_CAP,
      },
    );
  }

  // Signal 4: per-question bursts. Merge the window into the trailing
  // state FIRST so a window spanning midnight gives day two a baseline
  // that includes day one, then judge each (day, qid) the window
  // touched against the days before it.
  const merged = mergeDays(state.days || {}, fold.perDayQid);
  let burstFlags = 0;
  for (const [day, qids] of Object.entries(fold.perDayQid)) {
    for (const qid of Object.keys(qids)) {
      const b = burstSignal(qid, day, merged[day][qid], merged);
      if (b.flagged) {
        burstFlags++;
        log.warn(
          `[velocity] burst: qid=${qid} day=${day} n=${b.count} baseline=${b.baselineMean.toFixed(1)}/day over ${b.baselineDays}d`,
          { metric: "velocity_flag", kind: "burst", qid, day, n: b.count, baselineMean: b.baselineMean },
        );
      }
    }
  }

  await store.putState({ lastScanAt: maxAt, days: pruneDays(merged) });

  // Bind coverage (D342, per-level since D343). INFO, and stated as the
  // decision it informs rather than as bare ratios — the question an
  // operator has on flip day, and again on every later tightening, is
  // "what share of real votes would this refuse", and they should not
  // have to do the subtraction while deciding.
  // NARROWED TO WHAT WAS ASKED. The Auth loop above stops on the pass's
  // clock, and the uids it reached are its first `scanned` in the same
  // sorted order — so everything after that point is an account nobody
  // asked about, which `bindCoverage` would otherwise tally at L0 and
  // report as unbound. On a night that stopped early, that is the number
  // an operator reads before flipping enforcement, overstating what it
  // would refuse without bound: at the limit, "would refuse 100% of
  // answers" about a population the scan never saw.
  const askedAbout = new Set(uids.slice(0, scanned));
  const covPool = scanned >= uids.length
    ? fold.perUid
    : new Map([...fold.perUid].filter(([uid]) => askedAbout.has(uid)));
  const cov = bindCoverage(covPool, levels);
  const atBar = refusedAt(cov, REQUIRED_LEVEL);
  const ladder = [...cov.byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lvl, t]) => `L${lvl}(${levelDef(lvl).key})=${t.voters}v/${t.answers}a`)
    .join(" ");
  log.info(
    `[velocity] bind coverage: ${ladder || "no voters"} — at the current bar (>=${REQUIRED_LEVEL}) `
      + `enforcement would refuse ${atBar.answers}/${cov.answers} answers (${pct(atBar.answers, cov.answers)}%) `
      + `from ${atBar.voters}/${cov.voters} voters`
      // The basis, and only when it is not the obvious one: a partial
      // night's ratio is still a real ratio, over a smaller room.
      + (scanned >= uids.length ? "" : ` — over the ${scanned} of ${uids.length} active accounts this pass reached`),
    {
      metric: "bind_coverage",
      voters: cov.voters,
      answers: cov.answers,
      // The population the ratio is OVER, so the metric can be read
      // without the message: equal on an ordinary night.
      scanned,
      active: uids.length,
      bar: REQUIRED_LEVEL,
      refusedVoters: atBar.voters,
      refusedAnswers: atBar.answers,
      refusedPct: pct(atBar.answers, cov.answers),
      // Per level, so raising the bar can be priced from the same line
      // rather than from a second query written during an incident.
      levels: Object.fromEntries([...cov.byLevel].map(([l, t]) => [l, t])),
    },
  );

  // The heartbeat — the scheduledDuelReveals pattern: the message is
  // what a human greps, the fields are what the log-based metric
  // `velocity_scan` selects on (monitoring/ledgerVelocityScan-silent.json
  // keeps its name; the metric is the same line from inside the pass).
  const summary: VelocitySummary = {
    entries: fold.entries, uids: fold.perUid.size, volumeFlags, cadenceFlags, clusterFlags: clusters.length, burstFlags, sharedDays, tailRows,
    authScanned: scanned, authTotal: uids.length,
  };
  log.info(
    `[velocity] scan: ${fold.entries} entries, ${fold.perUid.size} uids — flags: volume=${volumeFlags} cadence=${cadenceFlags} cluster=${clusters.length} burst=${burstFlags} (${sharedDays} whole day(s) off the shared read, ${tailRows} rows read for the partial day)`,
    { metric: "velocity_scan", ...summary },
  );
  return summary;
}

export function firestoreVelocityStore(db: Firestore, ledgerDay: LedgerDayReader): VelocityStore {
  const stateRef = db.doc(STATE_PATH);
  return {
    async getState() {
      const snap = await stateRef.get();
      return {
        lastScanAt: (snap.exists && (snap.get("lastScanAt") as number)) || 0,
        days: (snap.exists && (snap.get("days") as DayCounts)) || {},
      };
    },
    async putState(state) {
      await stateRef.set(state);
    },
    async ledgerDay(day) {
      // Entries without a uid predate D28's attribution field; the
      // runner drops them, as the tail's own reader always has.
      return (await ledgerDay(day)).map((e) => ({
        uid: e.uid, qid: e.qid, atMs: e.at,
        ...(e.fromIdx === undefined ? {} : { isEdit: true }),
      }));
    },
    async ledgerTail(sinceMs, into) {
      return (await scanLedgerWindow(db, sinceMs, into)).maxAt;
    },
    async users(uids) {
      return (await getAuth().getUsers(uids.map((uid) => ({ uid })))).users;
    },
  };
}
