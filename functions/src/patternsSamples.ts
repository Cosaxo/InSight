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
// answer reads to twelve.
//
// AND SINCE DATA-EFFICIENCY-RUNBOOK 2.2 A ROW CARRIES THE PERSON, not only
// the vote: display name, parsed core scores and the logic percentile,
// copied off the ledger entry the world-answer trigger stamped from the
// profile it already held (v2.ts, profileStamp.ts). The device reads the
// sample and needs no profile behind it — the second, larger read every
// surface paid (up to 200 profile documents per list) is gone, and the
// who-voted sheet reads the sample too (runbook 2.4), topped up by a
// short live tail. A row written before the stamp existed simply lacks
// the keys, and the device resolves that person the old way once.
//
// THE SHAPE, and why rows are a map. `rows` is keyed by uid — one row per
// person by construction (an edit overwrites its key), and erasure is a
// field delete: deleteAccount removes `rows.{uid}` from every sample
// without reading who else is in it (index.ts, the D397 arm). Order is
// carried by each row's `d`, the day the answer was ledgered; the client
// sorts newest first. Trimming to the cap drops the oldest days, then the
// highest uids within a day, so a re-run reproduces the same set.
//
// PER-CITY SAMPLES (runbook 2.5). The City stop's constellation asks the
// same twelve questions for the newest 200 answers FROM ONE CITY (D278),
// which the world sample cannot answer — a 2% city holds ~4 of its 200
// rows. So the fold also merges, per (question, city) the day touched, a
// `city-{qid}~{city}` document of the same shape, capped the same way, from
// the additions whose frozen chips name that city. The number of such
// pairs a night is bounded (CITY_SAMPLE_PAIRS_PER_NIGHT, hottest pairs
// first) because at scale it is the product of two catalogues; a pair
// past the budget skips the night, and its document — if it has one —
// simply holds the newest rows the fold has seen, which is the D397
// caveat every sample already carries.
//
// THE FIRST DERIVED PUBLIC DOCUMENT THAT HOLDS UIDS — the reason
// PEOPLE-MAP.md §7 deferred published positions. What it holds is exactly
// what the who-voted sheet already shows anyone signed in: who answered,
// what they picked, the chips their answer froze, the name and scores on
// their public profile. Nothing derived, no vector, no position. The
// erasure arm is what it owes, and e2e-delete-account.mjs asserts it.
import type { AnswerMap } from "./patternsAls";
import type { ParsedResults, ProfileStamp } from "./profileStamp";

/** The device's own bound, mirrored: `VOTER_FETCH_CAP` in
 * src/v2/data/voters.ts is 200 and the two packages do not share a build.
 * A sample larger than the sheet would claim more than the sheet does;
 * smaller would claim less. */
export const PATTERNS_SAMPLE_CAP = 200;

/** How many (question, city) samples one night merges at most, hottest
 * pairs first. Each costs a read and a write; at 300 reads a round trip
 * and 400 writes a batch the budget is ~100 round trips and ~75 commits,
 * a minute or two of the pass's eight — and $0.04 a night at the regional
 * sheet. It binds where a day touches more pairs than that: around 50 k
 * DAU on COSTS.md's answer rates, where the coldest pairs of the night
 * wait for a busier one. Phase 4's streaming pass is where it can rise. */
export const CITY_SAMPLE_PAIRS_PER_NIGHT = 30_000;

export interface SampleRow {
  /** The option index picked. */
  o: number;
  /** The answer's frozen anchors (D8) — `{}` for an entry that carried none. */
  a: Record<string, string>;
  /** The UTC day the answer was ledgered — the ordering key. */
  d: string;
  /** Display name as stamped, "" for none. Absent on a row written before
   *  runbook 2.2, which the device resolves the old way. */
  n?: string;
  /** Parsed core scores, null for none; present exactly when `n` is. */
  s?: ParsedResults | null;
  /** Logic percentile, null for none; present exactly when `n` is. */
  l?: number | null;
}

export interface SampleDoc {
  qid: string;
  rows: Record<string, SampleRow>;
  /** How many rows — the basis the client states. */
  n: number;
  /** The city a per-city sample holds — absent on the world sample. */
  city?: string;
}

export interface SampleAddition {
  uid: string;
  optionIdx: number;
  anchors?: Record<string, string>;
  day: string;
  /** The person's stamp for the day, where an entry of theirs carried one.
   *  Absent on a day whose entries for them were all edits — the row then
   *  keeps what its create wrote. */
  stamp?: ProfileStamp;
}

export const emptySample = (qid: string, city?: string): SampleDoc => ({ qid, rows: {}, n: 0, ...(city ? { city } : {}) });

/** The world sample's document id. */
export const worldSampleId = (qid: string): string => `sample-${qid}`;

/** A per-city sample's document id. `encodeURIComponent` because a city
 * string is a catalogue label ("Oslo, NO") and a document id may not hold
 * a slash; the device builds the same id (src/v2/data/voters.ts). The
 * prefix differs from the world sample's so the erasure arm's id-range
 * scan of world samples never enumerates the city documents. */
export const citySampleId = (qid: string, city: string): string => `city-${qid}~${encodeURIComponent(city)}`;

/** Newest first: by day descending, then uid ascending — a total order,
 * so two runs over the same rows agree on what the cap keeps. */
export function sampleOrder(a: [string, SampleRow], b: [string, SampleRow]): number {
  if (a[1].d !== b[1].d) return a[1].d < b[1].d ? 1 : -1;
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

const stampFields = (stamp: ProfileStamp): Pick<SampleRow, "n" | "s" | "l"> => ({ n: stamp.n, s: stamp.s, l: stamp.l });

/**
 * Merge a day's answers into a question's sample. A person already in the
 * sample is moved to their newest answer (an edit, or a day the ledger
 * replayed); the result is trimmed to the cap, oldest out.
 *
 * TRIMMED BEFORE THE MERGE AS WELL AS AFTER (runbook 2.2). The daily
 * question's additions are the whole day's actives — every one of them
 * used to be written into the row map before the sort took the newest
 * cap back out. The additions are one person each (last wins within a
 * day, the caller's order) and then cut to the cap in the sample's own
 * order first, which is exact: an addition dropped here is older than cap
 * additions that all outrank it in the final sort, so it could never have
 * survived that sort either.
 *
 * `stamps` is the day's stamp per person (patterns.ts builds it from every
 * entry of the day, any question): a row the merge rewrites anyway is
 * brought up to the person's newest stamp for free, so a name or a score
 * that changed reaches the rows of the questions they DID NOT answer
 * today too — for the samples this night touches. profileFanout.ts is what
 * reaches the rest, at the moment the profile changes.
 */
export function mergeSample(
  prev: SampleDoc | null,
  qid: string,
  adds: readonly SampleAddition[],
  cap: number = PATTERNS_SAMPLE_CAP,
  stamps?: ReadonlyMap<string, ProfileStamp>,
  city?: string,
): SampleDoc {
  const latest = new Map<string, SampleAddition>();
  for (const add of adds) {
    if (!add.uid || !Number.isInteger(add.optionIdx) || add.optionIdx < 0) continue;
    const cur = latest.get(add.uid);
    // the newest day wins; within a day the later entry (the caller's
    // order) wins, which is the edit
    if (cur && cur.day > add.day) continue;
    latest.set(add.uid, add);
  }
  const trimmed = [...latest.values()]
    .sort((x, y) => (x.day !== y.day ? (x.day < y.day ? 1 : -1) : x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0))
    .slice(0, cap);
  const rows: Record<string, SampleRow> = { ...(prev?.rows ?? {}) };
  for (const add of trimmed) {
    const cur = rows[add.uid];
    if (cur && cur.d > add.day) continue;
    // An addition without a stamp is an edit's: the row keeps the name and
    // scores its create carried, and its chips move with the answer.
    const kept = cur && cur.n !== undefined ? { n: cur.n, s: cur.s ?? null, l: cur.l ?? null } : {};
    rows[add.uid] = { o: add.optionIdx, a: add.anchors ?? {}, d: add.day, ...kept, ...(add.stamp ? stampFields(add.stamp) : {}) };
  }
  if (stamps) {
    for (const [uid, row] of Object.entries(rows)) {
      const stamp = stamps.get(uid);
      if (stamp) rows[uid] = { ...row, ...stampFields(stamp) };
    }
  }
  const kept = Object.entries(rows).sort(sampleOrder).slice(0, cap);
  return { qid, rows: Object.fromEntries(kept), n: kept.length, ...(city ?? prev?.city ? { city: city ?? prev?.city } : {}) };
}

/** The sample documents a day's entries touch, grouped by question, from
 * the compaction's own view of the day (qid → answers, per person), with
 * the person's stamp for the day attached where they have one. */
export function sampleAdditions(
  day: string,
  byUid: ReadonlyMap<string, AnswerMap>,
  anchorsByUid: ReadonlyMap<string, Record<string, Record<string, string>>>,
  stamps?: ReadonlyMap<string, ProfileStamp>,
): Map<string, SampleAddition[]> {
  const out = new Map<string, SampleAddition[]>();
  for (const [uid, answers] of [...byUid.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const stamp = stamps?.get(uid);
    for (const [qid, optionIdx] of Object.entries(answers)) {
      const list = out.get(qid) ?? [];
      list.push({ uid, optionIdx, anchors: anchorsByUid.get(uid)?.[qid], day, ...(stamp ? { stamp } : {}) });
      out.set(qid, list);
    }
  }
  return out;
}

/** The per-city samples a day's additions touch: (qid, city) → the
 * additions whose frozen chips name that city, hottest pairs first (most
 * additions, then qid, then city — a total order, so the budget cuts the
 * same pairs on a re-run), cut to `budget` pairs. An addition with no
 * city, or a blank one, belongs to no city sample. */
export function citySampleAdditions(
  adds: ReadonlyMap<string, readonly SampleAddition[]>,
  budget: number = CITY_SAMPLE_PAIRS_PER_NIGHT,
): Array<{ qid: string; city: string; adds: SampleAddition[] }> {
  const pairs = new Map<string, { qid: string; city: string; adds: SampleAddition[] }>();
  for (const [qid, list] of adds) {
    for (const add of list) {
      const city = add.anchors?.city;
      if (typeof city !== "string" || !city.trim()) continue;
      const key = citySampleId(qid, city);
      const pair = pairs.get(key) ?? { qid, city, adds: [] };
      pair.adds.push(add);
      pairs.set(key, pair);
    }
  }
  return [...pairs.values()]
    .sort((x, y) => y.adds.length - x.adds.length
      || (x.qid < y.qid ? -1 : x.qid > y.qid ? 1 : 0)
      || (x.city < y.city ? -1 : x.city > y.city ? 1 : 0))
    .slice(0, Math.max(0, budget));
}
