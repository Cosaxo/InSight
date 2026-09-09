// patternsSamples.ts — the nightly voter samples (D397), pure.
//
// WHY. Every list the device intersects — Kindred's twelve, the People
// lens's twelve, the pair card's four — is the same query: the newest 200
// answers to one question, 200 billed reads each, then names. The lists
// are public (D98), bounded (D102), recency-ordered, and identical for
// every viewer who opens them within a day; COST-REDUCTION.md priced
// dropping eight of Kindred's twelve at −39% of the bill at 500 DAU. So
// the nightly run publishes them: one document per eligible question,
// `v2_patterns/sample-{qid}`, holding the newest PATTERNS_SAMPLE_CAP
// voters — uid, option index, the answer's frozen cohort chips (D8) — as
// the who-voted sheet's own semantics ("the latest 200"), refreshed
// nightly instead of on open. A Kindred first view goes from ~2,400
// answer reads to twelve; the who-voted sheet itself, a live list of
// names on screen, keeps the live query.
//
// THE SHAPE, and why rows are a map. `rows` is keyed by uid — one row per
// person by construction (an edit overwrites its key), and erasure is a
// field delete: deleteAccount removes `rows.{uid}` from every sample
// without reading who else is in it (index.ts, the D397 arm). Order is
// carried by each row's `d`, the day the answer was ledgered; the client
// sorts newest first. Trimming to the cap drops the oldest days, then the
// highest uids within a day, so a re-run reproduces the same set.
//
// THE FIRST DERIVED PUBLIC DOCUMENT THAT HOLDS UIDS — the reason
// PEOPLE-MAP.md §7 deferred published positions. What it holds is exactly
// what the who-voted sheet already shows anyone signed in: who answered,
// what they picked, the chips their answer froze. Nothing derived, no
// vector, no position. The erasure arm is what it owes, and
// e2e-delete-account.mjs asserts it.
//
// SEEDED ON FIRST TOUCH (D442). The ledger day is the merge's only input,
// and a person answers a given question once — so as D397 shipped, the
// two hundred people who answered before the samples existed never
// arrived, and a long-standing question published a sample of however
// many had answered it SINCE: real rows the reader could not tell from a
// complete list, landing on the 12-voter floors as `thin` — a claim about
// the crowd whose real subject was the deploy date. So the first night
// the pass meets a question whose sample carries no `seeded` stamp, it
// runs the who-voted sheet's own query once — the newest
// PATTERNS_SAMPLE_CAP world answers — folds them in exactly as a ledger
// day is folded, stamps the document, and never asks again. Bounded per
// run (PATTERNS_SEED_PER_RUN) so a busy night cannot put the whole
// corpus's reads inside one invocation; the rest wait a night.
import type { AnswerMap } from "./patternsAls";

/** The device's own bound, mirrored: `VOTER_FETCH_CAP` in
 * src/v2/data/voters.ts is 200 and the two packages do not share a build.
 * A sample larger than the sheet would claim more than the sheet does;
 * smaller would claim less. */
export const PATTERNS_SAMPLE_CAP = 200;

/** How many samples one nightly run may SEED from the answers (D442) —
 * the owner's number, 2026-09-09.
 *
 * A seed is up to PATTERNS_SAMPLE_CAP billed reads, so a seeding night
 * costs at most 25 × 200 = 5,000 reads on top of the pass's own, where an
 * unbounded first night over the whole sampled corpus (540 items at the
 * time of writing, every item the candidate's corpus names) would be up to
 * ~108,000 reads inside one invocation with a timeout — the bound the
 * row on OWNER-LIST.md said nobody had chosen. At 25 a night the corpus
 * converges in at most ceil(540 / 25) = 22 seeding nights, and only the
 * questions a day's answers actually touch are met at all, so the nights
 * that seed anything are the nights people answered questions with a
 * history. After the last unstamped sample is met, the term is zero
 * forever: the stamp is the only thing a later night reads. */
export const PATTERNS_SEED_PER_RUN = 25;

export interface SampleRow {
  /** The option index picked. */
  o: number;
  /** The answer's frozen anchors (D8) — `{}` for an entry that carried none. */
  a: Record<string, string>;
  /** The UTC day the answer was ledgered — the ordering key. */
  d: string;
}

export interface SampleDoc {
  qid: string;
  rows: Record<string, SampleRow>;
  /** How many rows — the basis the client states. */
  n: number;
  /** The UTC day the sample was seeded from the answers themselves
   * (D442) — absent on a document only the ledger has fed. The stamp is
   * the whole idempotence of the seed: a run seeds an unstamped sample
   * and reads nothing for a stamped one, so `mergeSample` has to carry
   * it across every nightly rewrite or the query runs again forever. */
  seeded?: string;
}

export interface SampleAddition {
  uid: string;
  optionIdx: number;
  anchors?: Record<string, string>;
  day: string;
}

export const emptySample = (qid: string): SampleDoc => ({ qid, rows: {}, n: 0 });

/** Newest first: by day descending, then uid ascending — a total order,
 * so two runs over the same rows agree on what the cap keeps. */
export function sampleOrder(a: [string, SampleRow], b: [string, SampleRow]): number {
  if (a[1].d !== b[1].d) return a[1].d < b[1].d ? 1 : -1;
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/**
 * Merge a day's answers into a question's sample. A person already in the
 * sample is moved to their newest answer (an edit, or a day the ledger
 * replayed); the result is trimmed to the cap, oldest out.
 */
export function mergeSample(prev: SampleDoc | null, qid: string, adds: readonly SampleAddition[], cap: number = PATTERNS_SAMPLE_CAP): SampleDoc {
  const rows: Record<string, SampleRow> = { ...(prev?.rows ?? {}) };
  for (const add of adds) {
    if (!add.uid || !Number.isInteger(add.optionIdx) || add.optionIdx < 0) continue;
    const cur = rows[add.uid];
    // the newest day wins; within a day the later entry (the caller's
    // order) wins, which is the edit
    if (cur && cur.d > add.day) continue;
    rows[add.uid] = { o: add.optionIdx, a: add.anchors ?? {}, d: add.day };
  }
  const kept = Object.entries(rows).sort(sampleOrder).slice(0, cap);
  // The seed stamp rides every rewrite (D442): the merged document is the
  // WHOLE sample (putSamples is a set with no merge), so a merge that
  // rebuilt the document without it would un-seed the question nightly.
  return { qid, rows: Object.fromEntries(kept), n: kept.length, ...(prev?.seeded ? { seeded: prev.seeded } : {}) };
}

/** Whether the pass owes this sample its one seed (D442): no document
 * yet, or one only the ledger has fed. */
export const needsSeed = (doc: SampleDoc | null | undefined): boolean => !doc?.seeded;

/** A Firestore Timestamp, as much of it as the seed needs. */
export interface MillisLike { toMillis(): number }

/**
 * One answer document → one sample addition, the seed's projection (D442).
 * The uid is the caller's (it is the document's grandparent, not a field);
 * the option must be a non-negative integer, as `mergeSample` demands —
 * a catalog answer carries `entity` and no option column, so it is
 * skipped rather than coerced (the client's `fetchVoterPicks` rule); the
 * chips are the answer's frozen anchors (D8), string values only, exactly
 * the filter `ledgerAnchors` applies when the ledger copies the same
 * snapshot (v2.ts), so a seeded row and a ledgered row of the same
 * answer are byte-identical.
 *
 * THE DAY IS WHEN THE ANSWER LAST MOVED — `editedAt` when a D86 edit
 * stamped it, else `answeredAt` — because that is the day the ledger
 * folded it: a create's entry lands on the create day and an edit's on
 * the edit day, and `mergeSample` moves the row to the edit day. So a
 * seeded row lands exactly where the ledger would have put it, and an
 * edit the ledger already moved meets the seed as a TIE (same day, same
 * option) rather than as a rollback or a second person. Null when the
 * document has no usable clock — nothing to order it by, so it is not
 * minted at an invented day.
 */
export function seedAddition(
  uid: string,
  d: { optionIdx?: unknown; anchors?: unknown; answeredAt?: unknown; editedAt?: unknown },
): SampleAddition | null {
  const at = isMillis(d.editedAt) ? d.editedAt : isMillis(d.answeredAt) ? d.answeredAt : null;
  if (!uid || !at || !Number.isInteger(d.optionIdx) || (d.optionIdx as number) < 0) return null;
  const anchors: Record<string, string> = {};
  if (d.anchors && typeof d.anchors === "object") {
    for (const [k, v] of Object.entries(d.anchors as Record<string, unknown>)) {
      if (typeof v === "string" && v.length <= 80) anchors[k] = v;
    }
  }
  return {
    uid,
    optionIdx: d.optionIdx as number,
    ...(Object.keys(anchors).length ? { anchors } : {}),
    day: new Date(at.toMillis()).toISOString().slice(0, 10),
  };
}

const isMillis = (x: unknown): x is MillisLike =>
  !!x && typeof x === "object" && typeof (x as MillisLike).toMillis === "function";

/**
 * Seed a sample from the answers (D442): the query's rows folded in
 * exactly as a ledger day is — one row per person, the newest day wins,
 * the cap keeps the newest — then stamped with the day the seed ran.
 * The caller merges the ledger day AFTER this, so an entry ledgered
 * today wins its tie with the seed's copy of the same answer (the
 * caller's order is the tiebreak, as `mergeSample` says).
 */
export function seedSample(prev: SampleDoc | null, qid: string, rows: readonly SampleAddition[], day: string): SampleDoc {
  return { ...mergeSample(prev, qid, rows), seeded: day };
}

/** The sample documents a day's entries touch, grouped by question, from
 * the compaction's own view of the day (qid → answers, per person). */
export function sampleAdditions(day: string, byUid: ReadonlyMap<string, AnswerMap>, anchorsByUid: ReadonlyMap<string, Record<string, Record<string, string>>>): Map<string, SampleAddition[]> {
  const out = new Map<string, SampleAddition[]>();
  for (const [uid, answers] of [...byUid.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const [qid, optionIdx] of Object.entries(answers)) {
      const list = out.get(qid) ?? [];
      list.push({ uid, optionIdx, anchors: anchorsByUid.get(uid)?.[qid], day });
      out.set(qid, list);
    }
  }
  return out;
}
