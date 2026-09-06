// patternsSamples.ts — the nightly voter samples (D385), pure.
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
// without reading who else is in it (index.ts, the D385 arm). Order is
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
import type { AnswerMap } from "./patternsAls";

/** The device's own bound, mirrored: `VOTER_FETCH_CAP` in
 * src/v2/data/voters.ts is 200 and the two packages do not share a build.
 * A sample larger than the sheet would claim more than the sheet does;
 * smaller would claim less. */
export const PATTERNS_SAMPLE_CAP = 200;

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
  return { qid, rows: Object.fromEntries(kept), n: kept.length };
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
