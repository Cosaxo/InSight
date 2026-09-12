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
// and one-hot encodings (patternsAls.ts's header) — and, since D458, the
// profile anchors as items: the values the scanned people carry, floored
// and capped per dim, compiled from the people rather than the bank. The
// compaction keeps each person's newest anchors on their state document
// beside the answer map (`an`), the fit reads both, and the scorecard
// solves a person from both — so a vector starts from the person's
// demographics before their first answer, which is what the Oracle, the
// People lens and the Map all read. And since D459 the catalogue picks:
// a `pick` answer's canonical entity key rides the ledger entry as
// `entity`, the compaction keeps each person's picks beside the map
// (`p`), and every entity enough people picked is an item like an
// anchor's value. The pick cards were tail by the bank's flag when
// D459 admitted them on the owner's instruction, and are core since
// D462 (the owner's word, 2026-09-10) — shipped whole to every device,
// so their answerers are no longer interest-selected. PICK_QIDS stays
// gated on the TYPE either way: a pick is never option-shaped, and the
// flag is the serving rule, not this fold's.
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
import {
  CITY_SAMPLE_PAIRS_PER_NIGHT,
  PATTERNS_SAMPLE_CAP,
  PATTERNS_SEED_PER_RUN,
  citySampleAdditions,
  citySampleId,
  mergeSample,
  needsSeed,
  sampleAdditions,
  seedAddition,
  seedSample,
  type SampleAddition,
  type SampleDoc,
} from "./patternsSamples";
import type { ProfileStamp } from "./profileStamp";
import { WORLD_ANSWER_SURFACES } from "./answerSurfaces";
import {
  ALS_LAMBDAS_U,
  ALS_TAUS,
  PATTERNS_CROSSOVER_NIGHTS,
  alsFitStreamed,
  alsScoreDay,
  anchorSpecsOf,
  observationsOf,
  binRows,
  pickSpecsOf,
  candidateWon,
  compileItems,
  indexItems,
  nextCrossoverStreak,
  procrustes,
  publishableAls,
  rotateModel,
  validAnchors,
  type AlsModel,
  type AlsRow,
  type AnchorMap,
  type AnswerMap,
  type DayEntry,
  type ItemIndex,
  type ItemMeta,
  type ItemSpec,
  type PersonKnown,
  type PickMap,
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

/** The catalogue questions whose picks the compaction records (D459):
 * every `catalog` card in the bank. Gated on the type, not the flag —
 * see the header — so a pick on anything else is not one. */
export const PICK_QIDS: ReadonlySet<string> = new Set(
  V2_QUESTIONS.filter((q) => q.type === "catalog" && typeof (q as { domain?: unknown }).domain === "string").map((q) => q.id),
);

/** A missed night folds on the next run, up to a week back — bounded, so
 * a long outage cannot turn the catch-up into an unbounded ledger scan.
 * Beyond it, unfolded days stay unfolded and the basis counts say so. */
export const PATTERNS_CATCHUP_DAYS = 7;

/** The device ridge the ONLINE engine's scorecard is measured at — the
 * shipped `estimateTheta` default, published so the phone reads it. */
export const SGD_LAMBDA_U = 0.5;
/** The online engine's link slope — the shipped link, never swept: its
 * scorecard is the fold's own arm (patternsFit.foldUserDay), which
 * guesses `marginal + θ·L` as it always has. */
export const SGD_TAU = 1;

export interface PatternsLedgerEntry {
  uid: string;
  qid: string;
  optionIdx?: number;
  /** Present only on a D86 edit (v2.ts's ledgerEntry): the index the
   *  answer moved away from. Its ABSENCE is what marks a first answer. */
  fromIdx?: number;
  /** The answer's frozen cohort chips (D8), for the voter samples (D397). */
  anchors?: Record<string, string>;
  /** A catalogue pick's canonical entity key (D459), on catalog entries. */
  entity?: string;
  /** The author's profile stamp (DATA-EFFICIENCY-RUNBOOK 2.1) — name,
   *  parsed core scores, logic percentile — present on a create the
   *  trigger stamped, absent on an edit and on older entries. */
  n?: string;
  s?: Record<string, Record<string, number>> | null;
  l?: number | null;
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
   * the reader's view of why `lambdaU` is what it is (the best link slope
   * for that ridge). */
  lambdaSweep?: Record<string, number>;
  /** The link's slope this scorecard was measured at (D460): the guess is
   * `marginal + tau·θ·L`, and the phone reads it beside `lambdaU`. */
  tau?: number;
  /** Pooled bits under each slope tried tonight, at that slope's best
   * ridge — why `tau` is what it is. */
  tauSweep?: Record<string, number>;
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
  /** The link slope the engine's scorecard was measured at (D460); the
   * online engine's is the shipped 1. Absent on a document before it. */
  tau?: number;
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
  /** The per-city samples (runbook 2.5), keyed by document id
   *  (`citySampleId`), where one exists; and their writes. */
  getCitySamples(ids: string[]): Promise<Map<string, SampleDoc>>;
  putCitySamples(samples: Map<string, SampleDoc>): Promise<void>;
  /** The world map's position documents (D462): one per country plus the
   *  world's own, keyed by document id. A set, like the samples — the
   *  document is rebuilt whole every night. */
  putWorldMaps(docs: Map<string, WorldMapDoc>): Promise<void>;
  /** Every world-map document id standing right now. Bounded by the
   *  country catalogue plus the world's own, and read so that a country
   *  which produced NOBODY tonight can be rewritten empty rather than left
   *  drawing last night's people as current. */
  listWorldMapIds(): Promise<string[]>;
  /** The newest PATTERNS_SAMPLE_CAP world answers to one question, as
   * sample additions — the who-voted sheet's own query, run once per
   * question ever, to seed its sample (D442). Up to the cap in billed
   * reads, which is why the run bounds how often it asks. */
  seedRows(qid: string): Promise<SampleAddition[]>;
}

import {
  WORLD_MAP_MIN_ANSWERS,
  WorldMapBuilder,
  positionModel,
  positionTheta,
  roundPos,
  type WorldMapDoc,
} from "./patternsWorld";

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
  /** Per-city samples merged (runbook 2.5). */
  citySamples: number;
  /** World-map documents written — one per country with anyone placed,
   *  plus the world's own (D462). */
  worldMaps: number;
  /** People a position was published for. */
  worldPlaced: number;
  /** Of those, seeded from the answers tonight — their one bounded
   * query each (D442). Zero on every night after the corpus is met. */
  seeded: number;
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
  /** The per-RUN city-pair budget. Injectable for the same reason
   * `eligible` and `items` are: the real bound is 30,000 pairs, and a
   * test that had to build 30,001 of them would spend a minute of CI
   * proving arithmetic. */
  cityPairsPerRun: number = CITY_SAMPLE_PAIRS_PER_NIGHT,
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
  const alsTauPrev = engine === "als" ? (prev?.tau ?? SGD_TAU) : (prev?.candidates.als?.tau ?? SGD_TAU);
  // the (ridge, slope) grid the candidate is scored on (D395, D460)
  const gridKey = (lam: number, tau: number): string => `${lam}|${tau}`;
  const grid: { lam: number; tau: number }[] = [];
  for (const lam of ALS_LAMBDAS_U) for (const tau of ALS_TAUS) grid.push({ lam, tau });
  // the published rows each displacement compares against
  const prevSgdPub: Record<string, number[]> = {};
  for (const [qid, r] of Object.entries(sgdRows)) prevSgdPub[qid] = [...r.v];
  const prevAlsPub: Record<string, number[]> = {};
  if (alsPrev) for (const [key, r] of Object.entries(alsPrev.rows)) prevAlsPub[key] = [...r.v];
  // The scorecard solves a person against the model as it stood BEFORE
  // the day, so its anchor items are the ones that model published; the
  // fit's own index is compiled below, from the people it is about to
  // read (D458).
  const index: ItemIndex = indexItems([...items, ...anchorSpecsOf(alsPrev?.items), ...pickSpecsOf(alsPrev?.items)]);
  const itemQids = new Set(items.map((s) => s.qid));

  // the days still owed, oldest first, bounded by the catch-up window
  const days: string[] = [];
  for (let off = -PATTERNS_CATCHUP_DAYS; off <= -1; off++) {
    const day = utcDay(nowMs, off);
    if (day > lastDay && day >= floor) days.push(day);
  }
  if (!days.length || yesterday <= lastDay) {
    return {
      days: 0, folded: 0, compacted: 0, samples: 0, citySamples: 0, worldMaps: 0, worldPlaced: 0, seeded: 0, users: 0, questions: Object.keys(model.q).length,
      bits: 0, skill: 0, seedCos: 0, engine, candidateSkill: 0, streak: engine === "sgd" ? alsStreakPrev : sgdStreakPrev, crossed: false,
    };
  }

  let folded = 0;
  let compacted = 0;
  let samplesWritten = 0;
  let citySamplesWritten = 0;
  // The seed budget is per RUN, not per day (D442): a catch-up folds up
  // to PATTERNS_CATCHUP_DAYS days in one invocation, and the bound exists
  // to cap what one invocation reads.
  let seedsLeft = PATTERNS_SEED_PER_RUN;
  // AND THE CITY-PAIR BUDGET IS PER RUN TOO, for the identical reason —
  // which it was not, three lines of reasoning above notwithstanding.
  // `citySampleAdditions` takes CITY_SAMPLE_PAIRS_PER_NIGHT as a DEFAULT
  // argument, and the call site is inside the day loop, so every owed day
  // started the budget again.
  //
  // Measured: two owed days produced 60,000 city-sample reads and writes
  // in one invocation, exactly 2× the constant. At PATTERNS_CATCHUP_DAYS
  // that is ~210,000 each way — 7-14 minutes against a 480 s deadline,
  // and the run that would hit it is the one that must not die, because
  // nothing advances `lastDay` until the end. A pass that times out here
  // re-owes the same days tomorrow and spends the same 7x again.
  let cityPairsLeft = cityPairsPerRun;
  let seeded = 0;
  const today = utcDay(nowMs, 0);
  const touched = new Set<string>();
  // One tally per owed day (D325) — a day with nothing eligible keeps
  // its n: 0 row, so the series says "no answers" out loud rather than
  // skipping the date (the putModel zero-rather-than-nothing idiom).
  const scored: { day: string; score: PatternsDayScore }[] = [];
  // The candidate's tally for the same days, under each device ridge and
  // link slope tried — the best pair is what it publishes as its
  // scorecard, and what the phone is told to solve and guess with.
  const alsScored = new Map<string, { day: string; score: PatternsDayScore }[]>();
  for (const g of grid) alsScored.set(gridKey(g.lam, g.tau), []);
  for (const day of days) {
    const score = emptyDayScore();
    scored.push({ day, score });
    for (const g of grid) alsScored.get(gridKey(g.lam, g.tau))!.push({ day, score: emptyDayScore() });
    const dayEntries = await store.ledgerDay(day);
    const entries = dayEntries.filter(
      (e) => eligible.has(e.qid) && (e.optionIdx === 0 || e.optionIdx === 1),
    );
    // The compaction's input: every option-shaped answer to a question the
    // candidate's corpus names — the online engine's two-option entries
    // included — newest last, so the last write below is the person's
    // current answer, edits and all.
    const wide = dayEntries.filter((e) => itemQids.has(e.qid) && typeof e.optionIdx === "number" && e.optionIdx >= 0);
    // The picks (D459): a catalogue card's entries, the entity where a
    // vote has its option — compacted beside the map, and sampled.
    const picks = dayEntries.filter((e) => PICK_QIDS.has(e.qid) && typeof e.entity === "string" && e.entity !== "");
    let refolded = 0;
    if (!entries.length && !wide.length && !picks.length) continue;
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
    // The person's NEWEST anchors of the day, kept to what the cube would
    // count (D458) — a snapshot the compaction sets whole, last wins like
    // the answer map. Read off every entry of the day, the two-option
    // ones included: an anchor is on the answer whatever its question.
    const newestAnchors = new Map<string, AnchorMap>();
    for (const e of dayEntries) {
      const an = validAnchors(e.anchors);
      if (an) newestAnchors.set(e.uid, an);
    }
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
    const picksByUid = new Map<string, PickMap>();
    for (const e of picks) {
      const pm = picksByUid.get(e.uid) ?? {};
      pm[e.qid] = e.entity as string;
      picksByUid.set(e.uid, pm);
      if (e.anchors) {
        const an = anchorsByUid.get(e.uid) ?? {};
        an[e.qid] = e.anchors;
        anchorsByUid.set(e.uid, an);
      }
    }
    // The day's profile stamp per person (runbook 2.1): the newest
    // stamped entry of theirs, ANY question — the stamp is a fact about
    // the person, so it goes onto every row of theirs the samples below
    // write or rewrite tonight. Entries are in `at` order, so last wins.
    const stampByUid = new Map<string, ProfileStamp>();
    for (const e of dayEntries) {
      if (typeof e.n === "string") stampByUid.set(e.uid, { n: e.n, s: e.s ?? null, l: e.l ?? null });
    }
    const uids = [...new Set([...byUid.keys(), ...answersByUid.keys(), ...picksByUid.keys()])].sort();
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
    // What else is known about a person before the day: their anchors —
    // the state's, else the ones on today's own entries, since the
    // profile precedes the answer and a newcomer's demographics are
    // evidence one step ahead too (D458) — and their picks from before
    // the day (D459; today's are not, since a pick and a vote on one day
    // have no order the ledger keeps).
    const known = new Map<string, PersonKnown>();
    for (const uid of uids) {
      const user = states.get(uid);
      // A person a dead run already stamped has today's answers merged in
      // already — scoring them would read the answer off their own map.
      if (user?.d && user.d >= day) continue;
      const seen = byUid.get(uid);
      if (!seen) continue;
      history.set(uid, user?.a ?? {});
      const an = user?.an ?? newestAnchors.get(uid);
      if (an || user?.p) known.set(uid, { ...(an ? { an } : {}), ...(user?.p ? { p: user.p } : {}) });
      for (const [qid, v] of [...seen.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
        dayEntries2.push(v.prev === undefined ? { uid, qid, x: v.x } : { uid, qid, x: v.x, prev: v.prev });
      }
    }
    const marginalStart = new Map<string, { n: number; sum: number }>();
    for (const [qid, L] of Object.entries(model.q)) marginalStart.set(qid, { n: L.n, sum: L.sum });
    for (const g of grid) {
      const rows = alsScored.get(gridKey(g.lam, g.tau))!;
      rows[rows.length - 1].score = alsScoreDay(alsPrev, index, history, dayEntries2, marginalStart, g.lam, known, g.tau);
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
      const an = newestAnchors.get(uid);
      if (an) user.an = an;
      const todaysPicks = picksByUid.get(uid);
      if (todaysPicks) {
        user.p = { ...(user.p ?? {}), ...todaysPicks };
        compacted += Object.keys(todaysPicks).length;
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
    const adds = sampleAdditions(day, answersByUid, anchorsByUid, picksByUid, stampByUid);
    if (adds.size) {
      const qids = [...adds.keys()].sort();
      const prevSamples = await store.getSamples(qids);
      const next = new Map<string, SampleDoc>();
      for (const qid of qids) {
        let prev = prevSamples.get(qid) ?? null;
        // ── seeded on first touch (D442) ────────────────────────────
        //
        // A sample only the ledger has fed holds the people who answered
        // since D397 and nobody before, and the reader cannot tell. So
        // the first night the pass meets an unstamped sample it runs the
        // sheet's own query once — the newest cap of the question's
        // answers — and folds them in BEFORE the day, so an entry
        // ledgered today wins its tie with the seed's copy of the same
        // answer. Bounded per run; in qid order so a night's budget
        // spends the same way twice. A seeded row carries no stamp (the
        // answer document has none); the device resolves its name live,
        // as it does for any row without one (runbook 2.3).
        if (needsSeed(prev)) {
          if (seedsLeft > 0) {
            seedsLeft -= 1;
            prev = seedSample(prev, qid, await store.seedRows(qid), today);
            seeded += 1;
          } else if (!prev) {
            // Budget spent. A sample that EXISTS still takes the day —
            // short as it was, no shorter — but one that does not exist
            // is not created short tonight: with no document the device
            // keeps the live query, which is complete, and the seed lands
            // the next night the question is met. The day's answers are
            // not lost to it — the seed reads the answers themselves.
            continue;
          }
        }
        next.set(qid, mergeSample(prev, qid, adds.get(qid) ?? [], undefined, stampByUid));
      }
      if (next.size) {
        await store.putSamples(next);
        samplesWritten += next.size;
      }
      // ── and per city (runbook 2.5) ──────────────────────────────
      //
      // The same merge over the additions whose frozen chips name a city,
      // one document per (question, city), hottest pairs first up to the
      // night's budget. In CHUNKS, read-merge-write-drop, rather than the
      // world loop's read-all-then-write-all: the world set is bounded by
      // the corpus, this one by the product of two catalogues, and
      // holding every merged city document until the end is the memory
      // shape the pass is already short of.
      const pairs = citySampleAdditions(adds, cityPairsLeft);
      cityPairsLeft -= pairs.length;
      for (let i = 0; i < pairs.length; i += 300) {
        const chunk = pairs.slice(i, i + 300);
        const ids = chunk.map((p) => citySampleId(p.qid, p.city));
        const prevCity = await store.getCitySamples(ids);
        const nextCity = new Map<string, SampleDoc>();
        chunk.forEach((p, j) => {
          nextCity.set(ids[j], mergeSample(prevCity.get(ids[j]) ?? null, p.qid, p.adds, undefined, stampByUid, p.city));
        });
        await store.putCitySamples(nextCity);
        citySamplesWritten += nextCity.size;
      }
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
      for (const g of grid) alsScored.get(gridKey(g.lam, g.tau))!.pop();
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
  let bestTau = alsTauPrev;
  const lambdaSweep: Record<string, number> = {};
  const tauSweep: Record<string, number> = {};
  if (scored.length) {
    let best = Infinity;
    const round4 = (x: number) => Math.round(x * 10000) / 10000;
    for (const g of grid) {
      const rows = alsScored.get(gridKey(g.lam, g.tau))!;
      const n = rows.reduce((a, r) => a + r.score.n, 0);
      const bits = rows.reduce((a, r) => a + r.score.bits, 0);
      const mean = n > 0 ? bits / n : Infinity;
      // each sweep reads the OTHER knob at its best, so a reader sees one
      // curve per knob rather than the whole grid
      if (n > 0) {
        const lk = String(g.lam), tk = String(g.tau);
        lambdaSweep[lk] = Math.min(lambdaSweep[lk] ?? Infinity, round4(mean));
        tauSweep[tk] = Math.min(tauSweep[tk] ?? Infinity, round4(mean));
      }
      if (mean < best - 1e-12) { best = mean; bestLambda = g.lam; bestTau = g.tau; }
    }
    // no observation scored tonight: keep last night's ridge and slope
    // rather than "win" on an empty comparison — and say the sweeps saw
    // nothing, zero being the scorecard's own idiom for that
    if (!Number.isFinite(best)) {
      bestLambda = alsLambdaPrev;
      bestTau = alsTauPrev;
      for (const lam of ALS_LAMBDAS_U) lambdaSweep[String(lam)] = 0;
      for (const tau of ALS_TAUS) tauSweep[String(tau)] = 0;
    }
  }
  const alsQuality = scored.length
    ? publishableQuality(alsScored.get(gridKey(bestLambda, bestTau))!, alsQualityPrev?.series ?? [])
    : alsQualityPrev;
  // STREAMED (DATA-EFFICIENCY-RUNBOOK 4.3): the scan is handed to the
  // solve as a function it runs once per sweep, so no person's map is
  // held past the callback — the buffered `people[]` this replaced was
  // ~1 KB a person resident, the out-of-memory this file's header
  // predicted near 150,000 people. The reads are 1 + ALS_SWEEPS scans a
  // night instead of one; the model carries that (PATTERNS_SCAN_READS_PER_MAU).
  //
  // What the callback hands over is the whole person, not the answer map:
  // the anchor items (D458) and the pick items (D459) are compiled from
  // the values the population carries, so the compilation moved into the
  // streamed fit's own pass 0 — the buffered fit could be handed a
  // ready-made index because it had the crowd in hand, and this one has
  // it only while the scan is running. A person with picks and no answers
  // still has a map to fit from, so the filter takes either.
  const scan = (each: (uid: string, person: { a: AnswerMap } & PersonKnown) => void) => store.scanUsers((uid, st) => {
    const hasA = !!st.a && Object.keys(st.a).length > 0;
    const hasP = !!st.p && Object.keys(st.p).length > 0;
    if (hasA || hasP) each(uid, { a: st.a ?? {}, ...(st.an ? { an: st.an } : {}), ...(st.p ? { p: st.p } : {}) });
  });
  let als: AlsModel | null = alsPrev;
  const streamed = await alsFitStreamed(alsPrev, scan, index, k);
  if (streamed.people) {
    const solved = streamed.model;
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
  // IT IS TESTED NOW, and what it took is worth keeping, because two
  // reasonable-looking fixtures prove nothing here.
  //
  // `procrustes` refuses on two conditions, and either one silently turns
  // this block into a no-op that a test still passes over. It needs at
  // least `k` SHARED keys, and it needs those rows to SPAN all k
  // directions ("a direction the shared rows do not span cannot be
  // aligned — refuse the whole rotation rather than invent it").
  //
  //   · Every crossover fixture the suite had shared ONE or TWO rows
  //     against k = 8. Instrumented 2026-09-07: `crossed=true`, both sets
  //     exactly [daily-000, daily-001], and the rows handed on byte-
  //     identical to the ones given — 0 of 2 changed. Widening the LEDGER
  //     to twelve core questions did not move it, because the corpus that
  //     matters is the one the FOLD produces: the ten extra never reached
  //     `als.rows` at all.
  //   · Ten questions whose answers are read off six bits of the person
  //     index share ten rows and still refuse — the rows come out rank
  //     six, so the second condition fires where the first no longer does.
  //
  // `patterns.test.ts` "rotates the crossing engine's rows onto the ones
  // the devices were reading" is the fixture that meets both, and it
  // asserts both preconditions rather than hoping for them. The property
  // it pins is that re-fitting a rotation onto the published rows finds
  // nothing left to do; with this line deleted the same residual comes
  // back with off-diagonals to 0.25.
  //
  // None of that is a reason to make the two directions symmetric; the
  // asymmetry above is still right.
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
    tau: bestTau,
    tauSweep,
  };
  const sgdCandidate: PatternsCandidate = {
    q: sgdRowsOut,
    ...(sgdQuality ? { quality: sgdQuality } : {}),
    displacement: sgdDisplacement,
    lambdaU: SGD_LAMBDA_U,
    tau: SGD_TAU,
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
    tau: nextEngine === "als" ? bestTau : SGD_TAU,
    ...((nextEngine === "als" ? alsQuality : sgdQuality) ? { quality: nextEngine === "als" ? alsQuality : sgdQuality } : {}),
    displacement: nextEngine === "als" ? alsDisplacement : sgdDisplacement,
    // Distance from birth, not from last night: the one number that says
    // whether the vectors have learned anything at all (D394), over the
    // rows the devices draw.
    seeds: seedsSummary({ k, q: binOf(enginePub) }),
    candidates: nextEngine === "als" ? { sgd: sgdCandidate } : { als: alsCandidate },
    ...(crossed ? { crossedAt: yesterday } : prev?.crossedAt ? { crossedAt: prev.crossedAt } : {}),
  };
  // ── the world map's positions (D462) ──────────────────────────
  //
  // One more scan, and the only one that reads the people AFTER the rows
  // are final: every person is solved against the rows this publication
  // is about to hand the devices, so the dots and the viewer's own dot —
  // which the phone solves from those same rows — are in one space. A
  // position solved against any other frame is a dot in the wrong place.
  //
  // THIS IS WHAT ANSWERS THE ROTATION GROUND `PEOPLE-MAP.md` §7 deferred
  // on. The worry was that the fit's axes drift night to night, so a
  // published position would reshuffle the world without anyone changing
  // their mind. They do not drift any more than the rows do: the ALS rows
  // are rotated onto last night's published rows before they are
  // published (the procrustes block above), and the online engine's rows
  // move by a step size. Solving from the published rows inherits that
  // alignment exactly — the map moves as little as the rows do, which is
  // the most any lens over them can promise.
  //
  // What it costs: one scan of the fitted people per night, on top of the
  // fit's own 1 + ALS_SWEEPS (DATA-EFFICIENCY-RUNBOOK 4.3), and one write
  // per country plus one. The scan holds nothing per person — the builder
  // is bounded at countries × cap — for the reason the streamed fit is.
  const posModel = positionModel(k, engineRows, engineItems);
  const posIndex: ItemIndex = indexItems([
    ...items,
    ...anchorSpecsOf(engineItems),
    ...pickSpecsOf(engineItems),
  ]);
  const posLambda = pub.lambdaU;
  const world = new WorldMapBuilder();
  let placed = 0;
  await store.scanUsers((uid, st) => {
    const answers = st.a ?? {};
    const n = Object.keys(answers).length;
    // ANSWERS, not observations: a profile alone must not buy a dot, for
    // the reason patternsReady's own floor counts answers (§7.5).
    if (n < WORLD_MAP_MIN_ANSWERS) return;
    const obs = observationsOf(posModel, {
      a: answers,
      ...(st.an ? { an: st.an } : {}),
      ...(st.p ? { p: st.p } : {}),
    }, posIndex);
    if (!obs.length) return;
    // The device's ridge, through the one function that owns the
    // convention — see `positionTheta`, which says what the scaled form
    // was and why the two solves have to agree.
    const theta = positionTheta(obs, k, posLambda);
    let norm = 0;
    for (const x of theta) norm += x * x;
    norm = Math.sqrt(norm);
    if (!(norm > 0)) return;
    placed += 1;
    world.add({
      uid,
      x: roundPos((theta[0] ?? 0) / norm),
      y: roundPos((theta[1] ?? 0) / norm),
      n,
      ...(typeof st.an?.country === "string" && st.an.country ? { country: st.an.country } : {}),
    });
  });
  const worldDocs = world.docs(yesterday);
  // A COUNTRY THAT EMPTIED OUT IS STILL PUBLISHED. `docs()` emits one
  // document per country with somebody in it tonight, and the write is a
  // `set` per emitted id — so a country whose last placed account moved
  // its chip, fell under the answer floor, or deleted itself keeps
  // yesterday's document, and the lens draws those people as that
  // country's crowd with no way to know better. The world's own document
  // is rewritten every night and cannot go stale this way, which is why
  // this was only ever true of the small ones.
  //
  // Rewritten EMPTY rather than deleted: the reader states "N of M" off
  // this document, and a document that says nobody is here is a different
  // thing from a document that is not there yet. Bounded by the country
  // catalogue — one range query, ~245 documents at the very most, the
  // same range the erasure arm walks.
  for (const id of await store.listWorldMapIds()) {
    if (worldDocs.has(id)) continue;
    worldDocs.set(id, { id, rows: {}, n: 0, total: 0, day: yesterday });
  }
  await store.putWorldMaps(worldDocs);

  await store.putModel(pub);
  if (crossed) {
    logger.info("patterns crossover", { metric: "patterns_crossover", from: engine, to: nextEngine, streak, day: yesterday });
  }
  return {
    days: days.length,
    folded,
    compacted,
    samples: samplesWritten,
    citySamples: citySamplesWritten,
    worldMaps: worldDocs.size,
    worldPlaced: placed,
    seeded,
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
        ...(typeof d.tau === "number" ? { tau: d.tau } : {}),
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
              // the anchors, both ways as well (D458) — same reason as `a`
              ...(snap.get("an") ? { an: snap.get("an") as Record<string, string> } : {}),
              // and the picks (D459)
              ...(snap.get("p") ? { p: snap.get("p") as Record<string, string> } : {}),
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
            // `set` with no merge replaces the document — `d`, `a`, `an` and
            // `p` have to be named or the stamp, the maps and the anchors
            // never land.
            { v: s.v, n: s.n, at: FieldValue.serverTimestamp(), ...(s.d ? { d: s.d } : {}), ...(s.a ? { a: s.a } : {}), ...(s.an ? { an: s.an } : {}), ...(s.p ? { p: s.p } : {}) },
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
            // The seed stamp, BOTH WAYS (D442) — the `d`/`a` lesson one
            // store method up: the run decides whether to pay the seed
            // query off what this returns, so a read that dropped it
            // would re-seed every touched sample every night, at up to
            // 200 reads each, with every unit test green.
            ...(snap.get("seeded") ? { seeded: String(snap.get("seeded")) } : {}),
          });
        });
      }
      return out;
    },
    async putSamples(samples) {
      // Under the loadings document's own rule: `v2_patterns/{docId}` reads
      // signed-in and writes nobody, so a sample needs no rules change —
      // and no rules change is possible for it to get wrong. `set` with no
      // merge: the merged document is the whole sample — so `seeded` has
      // to be named here or the stamp is removed on every rewrite.
      const entries = [...samples.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [qid, doc] of entries.slice(i, i + 400)) {
          batch.set(db.collection("v2_patterns").doc(`sample-${qid}`), {
            qid, rows: doc.rows, n: doc.n, ...(doc.seeded ? { seeded: doc.seeded } : {}), at: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }
    },
    async getCitySamples(ids) {
      const out = new Map<string, SampleDoc>();
      for (let i = 0; i < ids.length; i += 300) {
        const chunk = ids.slice(i, i + 300);
        const snaps = await db.getAll(...chunk.map((id) => db.collection("v2_patterns").doc(id)));
        snaps.forEach((snap, j) => {
          if (!snap.exists) return;
          out.set(chunk[j], {
            qid: String(snap.get("qid") ?? ""),
            city: String(snap.get("city") ?? ""),
            rows: (snap.get("rows") as SampleDoc["rows"]) ?? {},
            n: (snap.get("n") as number) ?? 0,
          });
        });
      }
      return out;
    },
    async listWorldMapIds() {
      // The same id range `deleteAccount`'s world-map arm walks, and for
      // the same reason it gives: the family is bounded by the country
      // catalogue plus one ('.' follows '-'), so this is one query.
      const snap = await db.collection("v2_patterns")
        .where(FieldPath.documentId(), ">=", "people-")
        .where(FieldPath.documentId(), "<", "people.")
        .select()
        .get();
      return snap.docs.map((d) => d.id);
    },
    async putWorldMaps(docs) {
      // `v2_patterns/{docId}` again: signed-in reads, nobody writes — the
      // loadings document's own rule, so this family needs no rules change
      // and none can get it wrong. `set` with no merge: the document is
      // rebuilt whole, so a person who stopped clearing the cap leaves it
      // the same night, and `deleteAccount`'s field delete is the only
      // thing that has to reach in between two nights.
      const entries = [...docs.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [id, doc] of entries.slice(i, i + 400)) {
          batch.set(db.collection("v2_patterns").doc(id), doc);
        }
        await batch.commit();
      }
    },
    async putCitySamples(samples) {
      // Same collection, same rule, a different prefix (`city-`): the
      // erasure arm scans world samples by id range and reaches these
      // through the account's own answers instead (index.ts, 1a′).
      const entries = [...samples.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [id, doc] of entries.slice(i, i + 400)) {
          batch.set(db.collection("v2_patterns").doc(id), {
            qid: doc.qid, city: doc.city ?? "", rows: doc.rows, n: doc.n, at: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }
    },
    async seedRows(qid) {
      // THE WHO-VOTED SHEET'S OWN QUERY (src/v2/data/voters.ts,
      // `fetchVoterPicks`): the newest PATTERNS_SAMPLE_CAP world answers to
      // one question, on the collection-group index the client already
      // needs for it (firestore.indexes.json: qid, surface, answeredAt
      // desc). Same filter, same order, same cap, so the seeded sample IS
      // the sheet's list rather than a different crowd. The surface
      // clause is the server's copy of the list, held equal to the
      // client's by answerSurfaces.test.ts — the admin SDK walks past the
      // rules, so nothing here would refuse a drifted copy. Projected to
      // the fields the addition needs; the uid is the path's, not a field.
      const snap = await db
        .collectionGroup("answers")
        .where("qid", "==", qid)
        .where("surface", "in", [...WORLD_ANSWER_SURFACES])
        .orderBy("answeredAt", "desc")
        .limit(PATTERNS_SAMPLE_CAP)
        .select("optionIdx", "anchors", "answeredAt", "editedAt")
        .get();
      const out: SampleAddition[] = [];
      for (const d of snap.docs) {
        const uid = d.ref.parent.parent?.id;
        if (!uid) continue;
        const add = seedAddition(uid, {
          optionIdx: d.get("optionIdx"),
          anchors: d.get("anchors"),
          answeredAt: d.get("answeredAt"),
          editedAt: d.get("editedAt"),
        });
        if (add) out.push(add);
      }
      return out;
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
            ...(d.get("an") ? { an: d.get("an") as Record<string, string> } : {}),
            ...(d.get("p") ? { p: d.get("p") as Record<string, string> } : {}),
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
