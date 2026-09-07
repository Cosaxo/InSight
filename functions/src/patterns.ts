// patterns.ts — the Patterns fold's wiring (v28 §2, trial per D166 §1,
// gated by D167). The arithmetic lives in patternsFit.ts (the shipped
// online engine) and patternsAls.ts (the candidate, D395), both pure; this
// file decides WHAT gets folded and WHERE the state lives, behind an
// injected store (the calls.ts precedent) so the pass logic tests without
// an emulator.
//
// THE SHAPE, and why it is a nightly sweep rather than a trigger arm.
// VISION-V28 §2 asks for "a streaming/incremental fit over the vote log",
// and the app already KEEPS a vote log: the agg-events ledger (D28) —
// one entry per aggregate answer, uid + qid, 90-day TTL, deleted with the
// account. The trigger option — updating vectors inside onV2AnswerCreated
// — would put a read and a write on the app's hottest path (the exact
// worry §2 names), break the pulse.test.mjs tripwire that pins the
// trigger at 5 tx.get sites, and buy real-time vectors nothing needs: a
// map redraws daily at most. So the fit runs where the app's other four
// daily jobs run, folds YESTERDAY's ledger in one pass, and publishes
// once — the write-contention wall (D7) never hears about it.
//
// The ledger lacked one field the fit needs — WHICH option — so
// ledgerEntry now carries optionIdx (v2.ts). Entries written before that
// field existed simply do not fold; the basis counts say so.
//
// TWO ENGINES, ONE DOCUMENT (D395). The shipped online fit measured as
// never leaving its hash seeds under the app's create-only regime (D394,
// docs/ALGORITHM-REFLECTION.md §1), so a second engine runs beside it:
// patternsAls.ts, the same model re-solved nightly in batch over every
// person's current answers. Whichever engine has won the last fortnight
// of one-step-ahead skill owns `q` — the rows every device reads — and
// the other publishes under `candidates` with the same scorecard. The
// crossover is a measurement (pat-6), symmetric, and logged; nobody flips
// it. The candidate's substrate is each person's answer map on their
// private state doc, compacted here from the same ledger day the online
// fit folds — so the ledger stays what D28 made it, and the fit reads
// people rather than days.
//
// THE CORPUS IS CORE ONLY (D161), enforced here at build time: both
// eligible sets compile from the bank the same way POLITICAL_QIDS does,
// so a tail answer cannot enter either fold by any path. The online
// engine keeps the prototype's own pool rule — two options, daily or core
// feed. The candidate's is wider (the owner's call, 2026-09-06): every
// option-shaped core item, the instrument items included, with ordinal
// and one-hot encodings (patternsAls.ts's header).
//
// Scale note, recorded not built (D7) — and CORRECTED 2026-08-31, because
// it named the wrong term and therefore the wrong fix.
//
// It said the binding cost is "the active users' vectors in memory", with
// the remedy "paging the fold by uid range". The vectors are eight floats
// per person; the term that actually binds is the LEDGER DAY, which
// `readLedgerDay` pages out of Firestore and then returns as one array.
// Measured here with realistic 28-character uids and bank-shaped qids,
// after a forced gc: ~290 bytes retained per entry — 124 MiB at 450k
// entries, 250 MiB at 900k. At COSTS.md's ~5 world answers per user per
// day, 100k DAU is ~500k entries ≈ 139 MiB for the array alone, before the
// per-uid Map of Maps built on top of it, the vectors, and node's own
// baseline, on a 256 MiB instance.
//
// Paging by uid range cannot help: the whole day is read precisely to
// learn which uids answered. The fix is the one `velocity.ts` already
// took and wrote down — fold each PAGE as it arrives (`foldInto` there)
// instead of buffering the day — and its note explains why this failure is
// worse than a lost run: nothing here advances a cursor until the end, so
// an OOM re-reads the same day and dies identically, every night, with
// the shards and the rollup behind it never draining.
//
// The candidate's own scan (`scanUsers`) has the opposite shape and the
// answer written down with it: it pages PEOPLE, and holds each person's
// answer map — ~40 answers × ~24 bytes today, bounded by the corpus — so
// its buffer is ~1 KB a person: 150 MB at 150k fitted people, and the
// item step needs only per-item sufficient statistics (an 8×8 Gram and an
// 8-vector), so the day the buffer is the wrong shape the sweep streams
// people through those statistics and holds none of them. That is the
// graduation, not a bigger box.
import { logger } from "firebase-functions";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { V2_QUESTIONS } from "./v2content";
import { readLedgerDay, type LedgerDayReader } from "./ledger";
import {
  PATTERNS_K,
  PATTERNS_MIN_BASIS,
  PATTERNS_QUALITY_FLOOR,
  emptyDayScore,
  emptyModel,
  emptyUser,
  encodeAnswer,
  foldUserDay,
  publishableLoadings,
  publishableQuality,
  displacementSummary,
  readyPool,
  seedsSummary,
  type PatternsDayScore,
  type PatternsDisplacement,
  type PatternsModel,
  type PatternsObservation,
  type PatternsQuality,
  type PatternsSeeds,
  type PatternsUserState,
} from "./patternsFit";
import { mergeSample, sampleAdditions, type SampleDoc } from "./patternsSamples";
import {
  ALS_LAMBDAS_U,
  PATTERNS_CROSSOVER_NIGHTS,
  alsFit,
  alsScoreDay,
  binRows,
  candidateWon,
  compileItems,
  indexItems,
  nextCrossoverStreak,
  procrustes,
  publishableAls,
  rotateModel,
  type AlsModel,
  type AlsRow,
  type AnswerMap,
  type DayEntry,
  type ItemIndex,
  type ItemMeta,
  type ItemSpec,
} from "./patternsAls";

/** The ONLINE engine's pool: two options (the engine is one bit per
 * question — the prototype's own rule), and CORE ONLY (D161): the daily
 * bank is core by construction, a feed question only if it says so.
 * Everything else — tests, learn, pulse's composite ids, calls, catalog —
 * never enters. */
export const PATTERNS_QIDS: ReadonlySet<string> = new Set(
  V2_QUESTIONS.filter(
    (q) =>
      Array.isArray(q.options) && q.options.length === 2 &&
      (q.surface === "daily" || (q.surface === "feed" && q.core === true)),
  ).map((q) => q.id),
);

/** The CANDIDATE engine's corpus (D395): every option-shaped core item,
 * instrument items included — bin, ord and one-hot pseudo-items, compiled
 * from the bank (patternsAls.compileItems). Its two-option rows are
 * exactly PATTERNS_QIDS, which is what lets the two engines be scored on
 * one currency. */
export const PATTERNS_ITEMS: readonly ItemSpec[] = compileItems(V2_QUESTIONS);
/** The questions whose answers the compaction records — a superset of
 * PATTERNS_QIDS. */
export const PATTERNS_ITEM_QIDS: ReadonlySet<string> = new Set(PATTERNS_ITEMS.map((s) => s.qid));

/** A missed night folds on the next run, up to a week back — bounded, so
 * a long outage cannot turn the catch-up into an unbounded ledger scan.
 * Beyond it, unfolded days stay unfolded and the basis counts say so. */
export const PATTERNS_CATCHUP_DAYS = 7;

/** The device ridge the ONLINE engine's scorecard is measured at — the
 * shipped `estimateTheta` default, published so the phone reads it. */
export const SGD_LAMBDA_U = 0.5;

export interface PatternsLedgerEntry {
  uid: string;
  qid: string;
  optionIdx?: number;
  /** Present only on a D86 edit (v2.ts's ledgerEntry): the index the
   *  answer moved away from. Its ABSENCE is what marks a first answer. */
  fromIdx?: number;
  /** The answer's frozen cohort chips (D8), for the voter samples (D397). */
  anchors?: Record<string, string>;
}

export type PatternsEngine = "sgd" | "als";

/** A published row: the vector, its basis, the sum of raw encoded answers
 * (mean = sum/n for every kind), and an ordinal item's sd. */
export type PublishedRow = AlsRow;

/** The engine that is NOT in `q`, with the same scorecard, so the two can
 * be compared on the document itself. */
export interface PatternsCandidate {
  q: Record<string, PublishedRow>;
  /** Present for the candidate engine's wider corpus (ord/opt items). */
  items?: Record<string, ItemMeta>;
  quality?: PatternsQuality;
  displacement?: PatternsDisplacement;
  /** The device ridge this scorecard was measured at. */
  lambdaU: number;
  /** Consecutive nights this candidate has out-skilled the engine. */
  streak: number;
  /** The candidate's pooled bits under each device ridge tried tonight —
   * the reader's view of why `lambdaU` is what it is. */
  lambdaSweep?: Record<string, number>;
}

/** The whole loadings document, minus the server clock. Read and written
 * WHOLE (D395) — a field-by-field projection is how the retry stamp
 * shipped dead (store-projection.test.ts), and this document has grown
 * too many fields to name twice. */
export interface PatternsPublication {
  k: number;
  lastDay: string;
  folded: number;
  engine: PatternsEngine;
  /** The engine's rows — what every device reads. */
  q: Record<string, PublishedRow>;
  /** The engine's item metadata, when its corpus is wider than bin. */
  items?: Record<string, ItemMeta>;
  /** The device ridge the engine's scorecard was measured at. */
  lambdaU: number;
  quality?: PatternsQuality;
  displacement: PatternsDisplacement;
  seeds: PatternsSeeds;
  candidates: { sgd?: PatternsCandidate; als?: PatternsCandidate };
  /** The lastDay on which the engine last changed hands. */
  crossedAt?: string;
}

/** The I/O the fit needs, as an interface (calls.ts's store precedent) —
 * the sweep's pass logic is testable without any Firestore shape. */
export interface PatternsStore {
  /** The ledger entries for one UTC day, oldest first. */
  ledgerDay(dayKey: string): Promise<PatternsLedgerEntry[]>;
  /** The previous publication, whole, or null before the first. */
  getModel(): Promise<PatternsPublication | null>;
  putModel(pub: PatternsPublication): Promise<void>;
  getUsers(uids: string[]): Promise<Map<string, PatternsUserState>>;
  putUsers(states: Map<string, PatternsUserState>): Promise<void>;
  /** Every person's state, paged — the candidate's substrate. */
  scanUsers(each: (uid: string, state: PatternsUserState) => void): Promise<void>;
  /** The voter samples for these questions, where one exists (D397). */
  getSamples(qids: string[]): Promise<Map<string, SampleDoc>>;
  putSamples(samples: Map<string, SampleDoc>): Promise<void>;
}

// The fold arithmetic lives in pure.ts (ORIENTATION §3). Re-exported
// because this module's own test imports it from here, and because the
// two nightly folds must not be able to disagree about what a day is.
import { utcDay } from "./pure";
export { utcDay };

const EMPTY_DISPLACEMENT: PatternsDisplacement = { space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {} };

/** Rows → a PatternsModel over the bin keys, for the online engine and
 * for the seed/pool summaries that speak that shape. */
const sgdModelFrom = (k: number, rows: Record<string, PublishedRow>): PatternsModel => {
  const q: PatternsModel["q"] = {};
  for (const [key, r] of Object.entries(rows)) q[key] = { v: [...r.v], n: r.n, sum: r.sum };
  return { k, q };
};

const alsModelFrom = (k: number, rows: Record<string, PublishedRow> | undefined, items: Record<string, ItemMeta> | undefined): AlsModel | null => {
  if (!rows || !items || !Object.keys(rows).length) return null;
  const copy: Record<string, AlsRow> = {};
  for (const [key, r] of Object.entries(rows)) copy[key] = { ...r, v: [...r.v] };
  return { k, rows: copy, items: { ...items } };
};

/** The engine's two-option rows, as the pool gate and the seeds summary read them. */
const binOf = (pub: { q: Record<string, PublishedRow>; items?: Record<string, ItemMeta> }): Record<string, { v: number[]; n: number; sum: number }> =>
  pub.items ? binRows(pub.q, pub.items) : Object.fromEntries(Object.entries(pub.q).map(([k, r]) => [k, { v: r.v, n: r.n, sum: r.sum }]));

export interface PatternsRunSummary {
  days: number;
  folded: number;
  /** Answers compacted onto people's maps — the candidate's substrate. */
  compacted: number;
  /** Voter sample documents rewritten tonight (D397). */
  samples: number;
  users: number;
  questions: number;
  bits: number;
  skill: number;
  seedCos: number;
  engine: PatternsEngine;
  /** The candidate's skill tonight, and its streak after tonight. */
  candidateSkill: number;
  streak: number;
  crossed: boolean;
}

/**
 * Fold every unfolded day up to and including yesterday.
 *
 * IDEMPOTENT PER PERSON, which is the claim that is true. The model's
 * cursor is written ONCE, after the whole catch-up loop, while the user
 * vectors are written per day — so a crash inside the loop leaves the
 * cursor behind and the next run re-reads days these vectors already
 * carry. `foldUserDay` is a STEP, not a set, so re-reading them moved
 * every touched person's vector twice and re-stepped the model from it.
 * The docstring here used to say the model's cursor made that impossible.
 *
 * Each vector now carries the last day folded into it and a day already
 * stamped on a person is skipped — the answer map included, which is a
 * set rather than a step and would survive a re-merge, but is skipped
 * with the rest so one guard covers the document.
 *
 * WHAT THAT COSTS, stated because it is a real trade and not a free win.
 * The model and the vectors co-evolve: the model is stepped from each
 * person's vector as that person's day is folded. On a retry the skipped
 * people do not step the model either, so a crashed night's contribution
 * to the MODEL from people already folded is lost rather than applied
 * twice. That is the same bargain the engagement folds strike — "a crash
 * leaves work unfolded rather than double-folded" — and it is the right
 * one here: an under-learned day is noise in an online fit, while a
 * double-stepped vector is a person's own coordinate moved to somewhere
 * they never were. The candidate engine has no such trade: it is a
 * function of the answer maps, and a re-run reproduces it exactly.
 */
export async function runPatternsFit(
  store: PatternsStore,
  nowMs: number,
  eligible: ReadonlySet<string> = PATTERNS_QIDS,
  items: readonly ItemSpec[] = PATTERNS_ITEMS,
): Promise<PatternsRunSummary> {
  const yesterday = utcDay(nowMs, -1);
  const floor = utcDay(nowMs, -PATTERNS_CATCHUP_DAYS);
  const prev = await store.getModel();
  const k = prev?.k ?? PATTERNS_K;
  const engine: PatternsEngine = prev?.engine ?? "sgd";
  const lastDay = prev?.lastDay ?? "";

  // Both engines as the last run PUBLISHED them (the store reads the doc,
  // so these are the 4 dp vectors a returning reader was actually shown) —
  // wherever each lives tonight. The online model refits from its rounded
  // rows, a perturbation orders of magnitude under the step size.
  const sgdRows = engine === "sgd" ? (prev?.q ?? {}) : (prev?.candidates.sgd?.q ?? {});
  const model: PatternsModel = prev ? sgdModelFrom(k, sgdRows) : emptyModel(k);
  const sgdQualityPrev = engine === "sgd" ? prev?.quality : prev?.candidates.sgd?.quality;
  const sgdStreakPrev = engine === "sgd" ? 0 : (prev?.candidates.sgd?.streak ?? 0);
  const alsPrev: AlsModel | null = engine === "als"
    ? alsModelFrom(k, prev?.q, prev?.items)
    : alsModelFrom(k, prev?.candidates.als?.q, prev?.candidates.als?.items);
  const alsQualityPrev = engine === "als" ? prev?.quality : prev?.candidates.als?.quality;
  const alsStreakPrev = engine === "als" ? 0 : (prev?.candidates.als?.streak ?? 0);
  const alsLambdaPrev = engine === "als" ? (prev?.lambdaU ?? ALS_LAMBDAS_U[0]) : (prev?.candidates.als?.lambdaU ?? ALS_LAMBDAS_U[0]);
  // the published rows each displacement compares against
  const prevSgdPub: Record<string, number[]> = {};
  for (const [qid, r] of Object.entries(sgdRows)) prevSgdPub[qid] = [...r.v];
  const prevAlsPub: Record<string, number[]> = {};
  if (alsPrev) for (const [key, r] of Object.entries(alsPrev.rows)) prevAlsPub[key] = [...r.v];
  const index: ItemIndex = indexItems(items);
  const itemQids = new Set(items.map((s) => s.qid));

  // the days still owed, oldest first, bounded by the catch-up window
  const days: string[] = [];
  for (let off = -PATTERNS_CATCHUP_DAYS; off <= -1; off++) {
    const day = utcDay(nowMs, off);
    if (day > lastDay && day >= floor) days.push(day);
  }
  if (!days.length || yesterday <= lastDay) {
    return {
      days: 0, folded: 0, compacted: 0, samples: 0, users: 0, questions: Object.keys(model.q).length,
      bits: 0, skill: 0, seedCos: 0, engine, candidateSkill: 0, streak: engine === "sgd" ? alsStreakPrev : sgdStreakPrev, crossed: false,
    };
  }

  let folded = 0;
  let compacted = 0;
  let samplesWritten = 0;
  const touched = new Set<string>();
  // One tally per owed day (D325) — a day with nothing eligible keeps
  // its n: 0 row, so the series says "no answers" out loud rather than
  // skipping the date (the putModel zero-rather-than-nothing idiom).
  const scored: { day: string; score: PatternsDayScore }[] = [];
  // The candidate's tally for the same days, under each device ridge
  // tried — the best of them is what it publishes as its scorecard.
  const alsScored = new Map<number, { day: string; score: PatternsDayScore }[]>();
  for (const lam of ALS_LAMBDAS_U) alsScored.set(lam, []);
  for (const day of days) {
    const score = emptyDayScore();
    scored.push({ day, score });
    for (const lam of ALS_LAMBDAS_U) alsScored.get(lam)!.push({ day, score: emptyDayScore() });
    const dayEntries = await store.ledgerDay(day);
    const entries = dayEntries.filter(
      (e) => eligible.has(e.qid) && (e.optionIdx === 0 || e.optionIdx === 1),
    );
    // The compaction's input: every option-shaped answer to a question the
    // candidate's corpus names — the online engine's two-option entries
    // included — newest last, so the last write below is the person's
    // current answer, edits and all.
    const wide = dayEntries.filter((e) => itemQids.has(e.qid) && typeof e.optionIdx === "number" && e.optionIdx >= 0);
    let refolded = 0;
    if (!entries.length && !wide.length) continue;
    // group by person; sort each person's day by qid so a replay
    // reproduces the run (the fit is order-sensitive within a day)
    //
    // ONE OBSERVATION PER (person, question), LAST WINS. The ledger is a log
    // of aggregate EVENTS, not of people: a D86 edit writes a second entry
    // under a fresh `event.id` (v2.ts, the onV2AnswerUpdated handler), byte-
    // identical in shape to the create it supersedes. Read as two rows, one
    // person who answered 0 and changed their mind to 1 folds as two people
    // who disagree — 30 of them became `{n: 60, marginal: 0}`, a p0 of 0.500
    // against a truth of 0.050. That inflates the published basis
    // `nextAsk(minBasis = 8)` gates the Oracle on, and whipsaws theta inside
    // a single day.
    //
    // v2.ts:161 shows the theta consequence of edits was considered and
    // accepted; the n and marginal dilution was not. Deduping here rather
    // than at either write site because the ledger's two entries are both
    // correct as AGGREGATE events — the -old/+new delta the counts need is
    // exactly why the second one exists. It is only this reader that wants a
    // person's latest answer instead.
    //
    // AND ACROSS DAYS, WHICH IS THE COMMON CASE. This map was built inside
    // the per-day loop and nowhere else, so "last wins" held only within
    // one UTC day — while an edit has no day window at all (rules impose a
    // 60-second cooldown, nothing more). A person who changed their mind
    // on Tuesday about Monday's answer produced exactly the
    // `{n: 60, marginal: 0}` the paragraph above calls the bug, from the
    // very code that says it fixed it.
    //
    // What makes it fixable without per-person state is that an edit's
    // ledger entry now carries `fromIdx` — what the answer moved away
    // from. An entry with no `fromIdx` is a first answer and counts a
    // person; a day whose entries for a pair are ALL edits is a revision
    // of something an earlier day folded, and moves the marginal by
    // -old/+new without adding to `n` (foldUserDay). An edit written
    // before that field existed carries none, so it reads as a first
    // answer and folds the old way — history stays as it was folded.
    //
    // `ledgerDay` returns the day in `at` order, so the last entry for a pair
    // is the newest and the FIRST edit carries the value the model holds.
    const byUid = new Map<string, Map<string, { x: number; prev?: number }>>();
    for (const e of entries) {
      const seen = byUid.get(e.uid) ?? new Map<string, { x: number; prev?: number }>();
      const x = encodeAnswer(e.optionIdx as number);
      const cur = seen.get(e.qid);
      if (e.fromIdx === undefined) {
        // A first answer supersedes anything the day held for this pair:
        // create-then-edit inside one day is one person, final answer.
        seen.set(e.qid, { x });
      } else if (cur) {
        // Another edit on a pair the day has already classified — keep
        // that classification, take the newer answer.
        seen.set(e.qid, { ...cur, x });
      } else {
        seen.set(e.qid, { x, prev: encodeAnswer(e.fromIdx) });
      }
      byUid.set(e.uid, seen);
    }
    // The compaction's map: the person's CURRENT answer per question.
    // Last wins is the whole rule here — the ledger is in `at` order, and a
    // map is a set, not a step, so an edit simply overwrites its key.
    const answersByUid = new Map<string, AnswerMap>();
    const anchorsByUid = new Map<string, Record<string, Record<string, string>>>();
    for (const e of wide) {
      const a = answersByUid.get(e.uid) ?? {};
      a[e.qid] = e.optionIdx as number;
      answersByUid.set(e.uid, a);
      if (e.anchors) {
        const an = anchorsByUid.get(e.uid) ?? {};
        an[e.qid] = e.anchors;
        anchorsByUid.set(e.uid, an);
      }
    }
    const uids = [...new Set([...byUid.keys(), ...answersByUid.keys()])].sort();
    const states = await store.getUsers(uids);
    // The candidate scores the day BEFORE the day is merged into anyone's
    // map: each person's vector is re-solved from the answers they had
    // given before today (the state as read), which is what the device
    // does, and the item rows are last night's. One step ahead or it isn't
    // held out. The entries are the online engine's own, in its fold
    // order, and the marginal both engines guess from is seeded from the
    // online model's counts before the day — so the baseline is one number
    // for both scorecards and skill has one denominator (patternsAls.ts,
    // alsScoreDay's header).
    const dayEntries2: DayEntry[] = [];
    const history = new Map<string, AnswerMap>();
    for (const uid of uids) {
      const user = states.get(uid);
      // A person a dead run already stamped has today's answers merged in
      // already — scoring them would read the answer off their own map.
      if (user?.d && user.d >= day) continue;
      const seen = byUid.get(uid);
      if (!seen) continue;
      history.set(uid, user?.a ?? {});
      for (const [qid, v] of [...seen.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
        dayEntries2.push(v.prev === undefined ? { uid, qid, x: v.x } : { uid, qid, x: v.x, prev: v.prev });
      }
    }
    const marginalStart = new Map<string, { n: number; sum: number }>();
    for (const [qid, L] of Object.entries(model.q)) marginalStart.set(qid, { n: L.n, sum: L.sum });
    for (const lam of ALS_LAMBDAS_U) {
      const rows = alsScored.get(lam)!;
      rows[rows.length - 1].score = alsScoreDay(alsPrev, index, history, dayEntries2, marginalStart, lam);
    }
    const write = new Map<string, PatternsUserState>();
    for (const uid of uids) {
      const seen = byUid.get(uid);
      const user = states.get(uid) ?? emptyUser(k);
      // ALREADY FOLDED — a previous attempt at this day wrote this person
      // before it died. Neither the vector nor the model steps again, and
      // the map is not re-merged; see the note on the trade in this
      // function's header.
      if (user.d && user.d >= day) { refolded += 1; continue; }
      if (seen) {
        const obs: PatternsObservation[] = [...seen.entries()].map(([qid, v]) => (
          v.prev === undefined ? { qid, x: v.x } : { qid, x: v.x, prev: v.prev }
        ));
        obs.sort((p, q) => (p.qid < q.qid ? -1 : 1));
        foldUserDay(model, user, obs, score);
        folded += obs.length;
      }
      const todays = answersByUid.get(uid);
      if (todays) {
        user.a = { ...(user.a ?? {}), ...todays };
        compacted += Object.keys(todays).length;
      }
      user.d = day;
      write.set(uid, user);
      touched.add(uid);
    }
    if (write.size) await store.putUsers(write);
    // ── the voter samples (D397) ───────────────────────────────────
    //
    // Every question the day's answers touch gets its sample re-merged:
    // the newest PATTERNS_SAMPLE_CAP voters, uid → option and frozen chips,
    // the who-voted sheet's own list refreshed nightly. A set, not a step
    // — re-merging a day a dead run already merged changes nothing — so
    // it needs no stamp of its own.
    const adds = sampleAdditions(day, answersByUid, anchorsByUid);
    if (adds.size) {
      const qids = [...adds.keys()].sort();
      const prevSamples = await store.getSamples(qids);
      const next = new Map<string, SampleDoc>();
      for (const qid of qids) next.set(qid, mergeSample(prevSamples.get(qid) ?? null, qid, adds.get(qid) ?? []));
      await store.putSamples(next);
      samplesWritten += next.size;
    }
    // A DAY A DEAD RUN ALREADY FOLDED IS NOT AN EMPTY DAY. The retry guard
    // above skips everybody a previous attempt stamped, so `score` stays at
    // n: 0 — and a zero row published into the series says exactly what the
    // series' own docstring defines it to mean: nobody answered. For a day
    // that had answers, folded into the model that crashed before it could
    // publish. The row then lives 90 days in the standing prequential
    // record D325 keeps as "the number any candidate engine must beat", and
    // the ledger day it describes is consumed, so nothing can recompute it.
    //
    // Silence is the honest reading: a previous attempt owned that day's
    // score and it is gone. Dropped from `scored` rather than published,
    // and only when the day had entries and every one of them was skipped
    // as already folded — a day that genuinely had no eligible answers
    // keeps its n: 0 row, which is the putModel zero-rather-than-nothing
    // idiom working as intended. The candidate's rows for the day go with
    // it, for the same reason.
    //
    // THE TEST IS `score.n`, NOT `write.size`, and the two stopped meaning
    // the same thing at D395. `write` holds everyone the loop above
    // TOUCHED, and since the corpus widened that includes people who
    // answered only wider-corpus items: they have no `seen`, so nothing
    // scores them, but they do have `todays`, so their map is merged and
    // they are written. One such newcomer on a retried day made
    // `write.size` non-zero while `score` was still n: 0, the drop did not
    // fire, and the fabricated "nobody answered" row went into the 90-day
    // standing record anyway — for a day that had a scored answer, folded
    // by the run that died. `score.n` is the row's OWN number, so the
    // guard now reads as what the paragraph above says it does: we are
    // about to publish a row saying nobody answered, and the reason it
    // says that is that everybody was already folded.
    if (!score.n && refolded > 0) {
      scored.pop();
      for (const lam of ALS_LAMBDAS_U) alsScored.get(lam)!.pop();
    }
  }

  // ── the online engine's publication ────────────────────────────────
  //
  // …and if EVERY owed day was one of those, there is no head to publish.
  // `lastDay` still advances — the days really are folded, and not
  // advancing would re-walk them forever, since every user is stamped — so
  // the previous publish is carried forward untouched rather than replaced
  // by a row about nothing.
  // NOTHING, not an invented day, when there is no head AND no previous
  // publish. This read `prevQuality ?? publishableQuality([{ day:
  // yesterday, score: emptyDayScore() }], …)`, which manufactures exactly
  // the "nobody answered" row the drop above exists to suppress — and it
  // is reachable: a FIRST-EVER run that folds the whole catch-up window
  // and dies before putModel leaves every entry stamped as folded and no
  // model published, so the retry drops every day and has no prior to
  // carry forward.
  //
  // `quality` is already optional on the way back out, because a loadings
  // doc predating D325 has none. Publishing without one is therefore a
  // state readers handle, and it is the honest one: the fit has nothing to
  // say about this run.
  const sgdQuality = scored.length
    ? publishableQuality(scored, sgdQualityPrev?.series ?? [])
    : sgdQualityPrev;
  const sgdDisplacement = displacementSummary(prevSgdPub, model);
  const sgdPub = publishableLoadings(model);
  const sgdRowsOut: Record<string, PublishedRow> = {};
  for (const [qid, L] of Object.entries(model.q)) sgdRowsOut[qid] = { v: sgdPub[qid].v, n: L.n, sum: L.sum };

  // ── the candidate engine (D395) ────────────────────────────────────
  //
  // Scored above, one step ahead, under each device ridge; the ridge that
  // scored best over the owed days is the one its scorecard is published
  // at, and the one the phone is told to solve with. Then the re-solve
  // over every person's current answers, warm-started from last night and
  // rotated onto last night's basis (a batch solve has no continuous
  // basis of its own; the alignment is what makes "how far did it move"
  // a question with an answer — D325's unaligned displacement was defined
  // for the online fit, which folds one persistent model forward).
  let bestLambda = alsLambdaPrev;
  const lambdaSweep: Record<string, number> = {};
  if (scored.length) {
    let best = Infinity;
    for (const lam of ALS_LAMBDAS_U) {
      const rows = alsScored.get(lam)!;
      const n = rows.reduce((a, r) => a + r.score.n, 0);
      const bits = rows.reduce((a, r) => a + r.score.bits, 0);
      const mean = n > 0 ? bits / n : Infinity;
      lambdaSweep[String(lam)] = n > 0 ? Math.round((bits / n) * 10000) / 10000 : 0;
      if (mean < best - 1e-12) { best = mean; bestLambda = lam; }
    }
    // no observation scored tonight: keep last night's ridge rather than
    // "win" on an empty comparison
    if (!Number.isFinite(best)) bestLambda = alsLambdaPrev;
  }
  const alsQuality = scored.length
    ? publishableQuality(alsScored.get(bestLambda)!, alsQualityPrev?.series ?? [])
    : alsQualityPrev;
  const people: { uid: string; a: AnswerMap }[] = [];
  await store.scanUsers((uid, st) => {
    if (st.a && Object.keys(st.a).length) people.push({ uid, a: st.a });
  });
  let als: AlsModel | null = alsPrev;
  if (people.length) {
    const solved = alsFit(alsPrev, people, index, k);
    als = alsPrev ? rotateModel(solved, procrustes(
      Object.fromEntries(Object.entries(solved.rows).map(([key, r]) => [key, r.v])),
      prevAlsPub,
      k,
    )) : solved;
  }
  const alsRowsOut: Record<string, PublishedRow> = als ? publishableAls(als) : {};
  const alsItemsOut: Record<string, ItemMeta> = als ? { ...als.items } : {};
  const alsDisplacement = als
    ? displacementSummary(prevAlsPub, { k, q: Object.fromEntries(Object.entries(als.rows).map(([key, r]) => [key, { v: r.v, n: r.n, sum: r.sum }])) })
    : EMPTY_DISPLACEMENT;

  // ── the crossover ──────────────────────────────────────────────────
  //
  // Whichever engine is the candidate tonight either extends its streak or
  // loses it; at PATTERNS_CROSSOVER_NIGHTS it becomes the engine. The rule
  // is symmetric on purpose: the online fit is the candidate the night
  // after it loses, and can win the rows back the same way.
  const engineQuality = engine === "sgd" ? sgdQuality : alsQuality;
  const candidateQuality = engine === "sgd" ? alsQuality : sgdQuality;
  const won = scored.length > 0 && candidateWon(engineQuality, candidateQuality, PATTERNS_QUALITY_FLOOR);
  const streak = nextCrossoverStreak(engine === "sgd" ? alsStreakPrev : sgdStreakPrev, won);
  const crossed = streak >= PATTERNS_CROSSOVER_NIGHTS && (engine === "sgd" ? !!als : true);
  const nextEngine: PatternsEngine = crossed ? (engine === "sgd" ? "als" : "sgd") : engine;

  // On a crossover TO ALS the new engine's rows are rotated onto the rows
  // the devices were reading last night, over the keys both carry, so the
  // map moves as little as the change of engine allows.
  //
  // ONE DIRECTION ONLY, and the asymmetry is deliberate rather than an
  // omission — this said "on a crossover" flatly, which reads as both. The
  // rotation lives inside the ALS arm below; the crossback to SGD
  // publishes `sgdRowsOut` untouched.
  //
  // Why it must: the SGD rows share a basis with the per-person vectors
  // (`user.v`) that the online fold steps every night. Rotating only the
  // PUBLISHED copy would leave those two in different frames, and the next
  // fold would step each person against rows that no longer mean what
  // their vector means. ALS has no such tie — its rows are re-solved whole
  // each night from the item side — so rotating its published copy costs
  // nothing and buys the devices a map that does not jump.
  //
  // The crossback path is currently unreachable in the test suite:
  // deleting this whole `if (crossed)` block leaves the functions suite
  // green, which is on the night's list. That is a coverage gap, not a
  // reason to make the two directions symmetric.
  let engineRows: Record<string, PublishedRow>;
  let engineItems: Record<string, ItemMeta> | undefined;
  if (nextEngine === "als" && als) {
    let rows = als;
    if (crossed) {
      rows = rotateModel(als, procrustes(
        Object.fromEntries(Object.entries(als.rows).map(([key, r]) => [key, r.v])),
        prevSgdPub,
        k,
      ));
    }
    engineRows = publishableAls(rows);
    engineItems = { ...rows.items };
  } else {
    engineRows = sgdRowsOut;
    engineItems = undefined;
  }
  // The benched engine starts its own count from nothing the night it is
  // benched; otherwise the candidate carries tonight's streak.
  const candidateStreak = crossed ? 0 : streak;
  const alsCandidate: PatternsCandidate = {
    q: alsRowsOut,
    items: alsItemsOut,
    ...(alsQuality ? { quality: alsQuality } : {}),
    displacement: alsDisplacement,
    lambdaU: bestLambda,
    streak: nextEngine === "sgd" ? candidateStreak : 0,
    lambdaSweep,
  };
  const sgdCandidate: PatternsCandidate = {
    q: sgdRowsOut,
    ...(sgdQuality ? { quality: sgdQuality } : {}),
    displacement: sgdDisplacement,
    lambdaU: SGD_LAMBDA_U,
    streak: nextEngine === "als" ? candidateStreak : 0,
  };
  const enginePub = { q: engineRows, items: engineItems };
  const pub: PatternsPublication = {
    k,
    lastDay: yesterday,
    folded,
    engine: nextEngine,
    q: engineRows,
    ...(engineItems ? { items: engineItems } : {}),
    lambdaU: nextEngine === "als" ? bestLambda : SGD_LAMBDA_U,
    ...((nextEngine === "als" ? alsQuality : sgdQuality) ? { quality: nextEngine === "als" ? alsQuality : sgdQuality } : {}),
    displacement: nextEngine === "als" ? alsDisplacement : sgdDisplacement,
    // Distance from birth, not from last night: the one number that says
    // whether the vectors have learned anything at all (D394), over the
    // rows the devices draw.
    seeds: seedsSummary({ k, q: binOf(enginePub) }),
    candidates: nextEngine === "als" ? { sgd: sgdCandidate } : { als: alsCandidate },
    ...(crossed ? { crossedAt: yesterday } : prev?.crossedAt ? { crossedAt: prev.crossedAt } : {}),
  };
  await store.putModel(pub);
  if (crossed) {
    logger.info("patterns crossover", { metric: "patterns_crossover", from: engine, to: nextEngine, streak, day: yesterday });
  }
  return {
    days: days.length,
    folded,
    compacted,
    samples: samplesWritten,
    users: touched.size,
    questions: Object.keys(engineRows).length,
    bits: pub.quality?.bits ?? 0,
    skill: pub.quality?.skill ?? 0,
    seedCos: pub.seeds.meanCos,
    engine: nextEngine,
    candidateSkill: (nextEngine === "als" ? sgdQuality : alsQuality)?.skill ?? 0,
    streak: candidateStreak,
    crossed,
  };
}

/** Firestore refuses `undefined` outright; a JSON round trip drops it
 * (and only it — every published number is finite by construction). */
const dropUndefined = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The Firestore store. State lives in two places, each chosen for its
 * erasure story: the model in ONE public doc (v2_patterns/loadings —
 * world-readable like every aggregate, written once per run so D7's
 * write wall never hears about it, nothing per-person in it), and each
 * person's vector and answer map under their own subtree
 * (v2_users/{uid}/patterns/state — readable by NOBODY, the push/
 * precedent, and deleteAccount's recursive delete takes it with the
 * account, no new arm). */
export function firestorePatternsStore(
  db: Firestore,
  // The shared, memoised reader in production (nightly.ts, D399): the
  // digest has already paid for the day by the time the fit asks.
  ledgerDay: LedgerDayReader = (dayKey) => readLedgerDay(db, dayKey),
): PatternsStore {
  const modelRef = db.collection("v2_patterns").doc("loadings");
  return {
    // One reader for one day of the ledger (ledger.ts, extracted at D322
    // for D197's one-copy reason; shared across the night's folds at D399).
    ledgerDay,
    async getModel() {
      // WHOLE, not field by field (D395). This read used to name `k`, `q`,
      // `lastDay`, `series` and `quality` one at a time, and the putModel
      // below is a `set` with no merge — so a field this projection forgot
      // was a field the next replace DELETED. `quality` nearly went that
      // way (store-projection.test.ts). The document has grown a second
      // engine, item metadata and a device ridge since; reading it whole
      // and normalising the pre-D395 shape is the projection that cannot
      // drop anything.
      const snap = await modelRef.get();
      if (!snap.exists) return null;
      const d = (snap.data() ?? {}) as Partial<PatternsPublication>;
      return {
        k: d.k ?? PATTERNS_K,
        lastDay: d.lastDay ?? "",
        folded: d.folded ?? 0,
        engine: d.engine === "als" ? "als" : "sgd",
        q: d.q ?? {},
        ...(d.items ? { items: d.items } : {}),
        lambdaU: typeof d.lambdaU === "number" ? d.lambdaU : SGD_LAMBDA_U,
        ...(d.quality ? { quality: d.quality } : {}),
        displacement: d.displacement ?? EMPTY_DISPLACEMENT,
        seeds: d.seeds ?? { n: 0, meanCos: 0, share90: 0, meanNorm: 0, seedNorm: 0 },
        candidates: d.candidates ?? {},
        ...(d.crossedAt ? { crossedAt: d.crossedAt } : {}),
      };
    },
    async putModel(pub) {
      // The whole publication and the server clock. `set` with NO merge
      // REPLACES the document, which is what a whole-document publication
      // wants: nothing stale survives from a shape the run no longer
      // writes. The scorecards ride the same write (D325): zero extra
      // reads, zero extra writes; the client reads `k`, `q`, `items` and
      // `lambdaU` and ignores the rest until something draws it.
      await modelRef.set({ ...dropUndefined(pub), at: FieldValue.serverTimestamp() });
      // ── the mount signal (D265) ──────────────────────────────────
      //
      // The Patterns tab is absent from the bar until the fit can carry
      // it, and the client decides that from ONE number: how many
      // questions are fitted on a basis worth drawing. That number has to
      // reach a device that has not opened the tab — which is every
      // device, before the gate opens — so it cannot live in the loadings
      // doc: reading 11 KB of vectors on every cold start to decide
      // whether to render a button is the read this app spends its
      // hydrate budget avoiding.
      //
      // `v2_meta/app` is the document `hydrate()` already fetches for
      // contentRev and the build gates, so the gate costs ZERO extra
      // reads — the same argument D196's gate makes by folding aggregates
      // the store already holds. Merged, never set: this fit owns two
      // fields on a document the seed and the operator own the rest of.
      //
      // The floor rides along with the count so the client can tell what
      // the number means rather than assuming (patternsFit.readyPool).
      // Counted over the engine's TWO-OPTION rows only — what the Map
      // draws — so a wider corpus does not open the tab on rows no lens
      // has a design for yet.
      await db.collection("v2_meta").doc("app").set(
        {
          patternsPool: readyPool({ k: pub.k, q: binOf(pub) }, PATTERNS_MIN_BASIS),
          patternsBasis: PATTERNS_MIN_BASIS,
        },
        { merge: true },
      );
    },
    async getUsers(uids) {
      const out = new Map<string, PatternsUserState>();
      for (let i = 0; i < uids.length; i += 300) {
        const chunk = uids.slice(i, i + 300);
        const refs = chunk.map((uid) =>
          db.collection("v2_users").doc(uid).collection("patterns").doc("state"));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap, j) => {
          if (snap.exists) {
            out.set(chunk[j], {
              v: (snap.get("v") as number[]) ?? [],
              n: (snap.get("n") as number) ?? 0,
              // The day stamp, BOTH WAYS — see the twin in taste.ts. The
              // retry guard reads `d` off what this returns, so omitting
              // it here made that guard dead in production.
              ...(snap.get("d") ? { d: String(snap.get("d")) } : {}),
              // The answer map, both ways too (D395): the compaction merges
              // into what this returns, so a read that dropped it would
              // publish a candidate fitted on yesterday alone, every night.
              ...(snap.get("a") ? { a: snap.get("a") as Record<string, number> } : {}),
            });
          }
        });
      }
      return out;
    },
    async putUsers(states) {
      const entries = [...states.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [uid, s] of entries.slice(i, i + 400)) {
          batch.set(
            db.collection("v2_users").doc(uid).collection("patterns").doc("state"),
            // `set` with no merge replaces the document — `d` and `a` have
            // to be named or the stamp and the map never land.
            { v: s.v, n: s.n, at: FieldValue.serverTimestamp(), ...(s.d ? { d: s.d } : {}), ...(s.a ? { a: s.a } : {}) },
          );
        }
        await batch.commit();
      }
    },
    async getSamples(qids) {
      const out = new Map<string, SampleDoc>();
      for (let i = 0; i < qids.length; i += 300) {
        const chunk = qids.slice(i, i + 300);
        const snaps = await db.getAll(...chunk.map((qid) => db.collection("v2_patterns").doc(`sample-${qid}`)));
        snaps.forEach((snap, j) => {
          if (!snap.exists) return;
          out.set(chunk[j], {
            qid: chunk[j],
            rows: (snap.get("rows") as SampleDoc["rows"]) ?? {},
            n: (snap.get("n") as number) ?? 0,
          });
        });
      }
      return out;
    },
    async putSamples(samples) {
      // Under the loadings document's own rule: `v2_patterns/{docId}` reads
      // signed-in and writes nobody, so a sample needs no rules change —
      // and no rules change is possible for it to get wrong. `set` with no
      // merge: the merged document is the whole sample.
      const entries = [...samples.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [qid, doc] of entries.slice(i, i + 400)) {
          batch.set(db.collection("v2_patterns").doc(`sample-${qid}`), {
            qid, rows: doc.rows, n: doc.n, at: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }
    },
    async scanUsers(each) {
      // Every `patterns/state` document there is, paged by path — the
      // collection-group order Firestore keeps without an index of its own.
      // The only documents in a `patterns` subcollection are `state`, and
      // the uid is the grandparent's id.
      const PAGE = 500;
      let query = db.collectionGroup("patterns").orderBy(FieldPath.documentId()).limit(PAGE);
      for (;;) {
        const snap = await query.get();
        for (const d of snap.docs) {
          if (d.id !== "state") continue;
          const uid = d.ref.parent.parent?.id;
          if (!uid) continue;
          each(uid, {
            v: (d.get("v") as number[]) ?? [],
            n: (d.get("n") as number) ?? 0,
            ...(d.get("d") ? { d: String(d.get("d")) } : {}),
            ...(d.get("a") ? { a: d.get("a") as Record<string, number> } : {}),
          });
        }
        if (snap.size < PAGE) break;
        query = query.startAfter(snap.docs[snap.size - 1]);
      }
    },
  };
}

// `fitPatternsV2`, the scheduled function that ran this fit at 02:37 UTC,
// retired at D399: the fit runs inside the nightly pass (nightly.ts,
// `digestEngagementV2`, 02:23 UTC) over the ledger day the digest has
// already read. Its heartbeat metric `patterns_fit` is emitted there, so
// monitoring/fitPatternsV2-silent.json still watches the fit.
