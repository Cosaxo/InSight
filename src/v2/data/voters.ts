// Named who-voted — the cross-user read D98 exists to make possible.
//
// Every other module under data/ reads the viewer's own documents and the
// public aggregates. This one reads OTHER PEOPLE'S answers, which until
// D98 no rule permitted and no client attempted. It is the first of its
// kind here, so the shape it establishes matters more than usual:
//
//   1. ONE collection-group query per question, on demand. Not a listener.
//      A question's voter list is opened, not watched — the same posture
//      loadTakes takes, for the same reason (a scrolled-past card must
//      cost nothing).
//   2. Names come from a BATCHED profile read, deduped and session-cached.
//      Resolving uid → name one document at a time is the obvious version
//      and it is a read per voter per open.
//   3. Cohort chips come from the ANSWER, never from the profile. The
//      answer carries the anchors snapshot taken at vote time (D8), so a
//      voter who has since moved city still appears in the city they
//      answered from. Reading the live profile for that would silently
//      re-cohort history, which is the exact thing the snapshot exists to
//      prevent — and it would disagree with the aggregate, which folds
//      the snapshot.
//
// The surface filter is not optional and not a nicety. firestore.rules
// grants the collection-group read as a VALUE test on `surface`, so a
// query without a matching `where` is refused wholesale rather than
// filtered down (D65's lesson, re-proved for this query in
// rules.test.ts). It is also what keeps sealed duel answers out: they
// carry surface "group"/"duo" and are nobody's business until the reveal.

// NOTHING RUNTIME FROM FIREBASE LIVES HERE ANY MORE (D482). The reads
// moved to data/votersFetch.ts, which live.ts imports dynamically —
// this module is in the first-paint graph (live.ts and circle.ts both
// import it statically) and the ~8 KB of query machinery was riding in
// with it for uses that all run long after first paint. The split is
// along the seam this file already had: everything below is pure and
// unit-testable without Firebase, which is what made it movable.
//
// Type-only, so it is erased and costs the graph nothing.
import type { ParsedResults } from "./similarity";

// The surfaces a world answer can carry. Must match the array in
// firestore.rules' collection-group grant exactly — a value here the rule
// does not list makes the whole query fail closed, which is the safe
// direction but an invisible one.
export const WORLD_ANSWER_SURFACES = ["daily", "feed", "test", "learn", "pulse", "call"] as const;

// Voters one fetch returns — the newest first, because the query already
// orders by answeredAt desc (D102).
//
// This bound is what keeps the who-voted sheet from being the app's only
// unbounded read. The daily question is globally shared (computeDeckIds
// takes no uid), so its crowd is roughly "everyone active that day":
// uncapped, one sheet open at 5,000 DAU is ~5,000 answer reads plus up to
// that many profile reads for names — ~10,000 billed reads and a
// multi-second list render for a single tap, growing linearly with DAU
// forever. Every sibling fan-out already carries its bound
// (CIRCLE_ANSWER_CAP, FOLLOW_CAP, KINDRED_QUESTIONS, AGG_ID_CAP); this
// was the one that shipped without.
//
// 200 is a screen-and-a-half of names beyond anyone's patience (~7,000 px
// of rows) and well above any launch-scale crowd, so at small sizes the
// sheet is exhaustive and says nothing about it; when the cap binds, the
// panel says "the latest 200" rather than presenting a truncation as the
// whole room (LiveVotersPanel). Kindred inherits the same bound per
// question: recency-biased, which is the honest bias for a likeness
// ranking drawn from live lists. If a fuller list is ever worth having,
// the answer is to PAGE from the cursor this ordering already provides —
// not to raise the number quietly (the D101 rule).
export const VOTER_FETCH_CAP = 200;

// Firestore's `in` operator caps at 30 values per query (it was 10 before
// 2023). Name resolution chunks on this.
export const UID_CHUNK = 30;

// The who-voted sheet's LIVE TAIL (DATA-EFFICIENCY-RUNBOOK 2.4): the sheet
// reads the nightly sample — the newest VOTER_FETCH_CAP as of last night's
// merge — and then only the answers newer than that, capped here. Under
// the cap the union is exactly the newest VOTER_FETCH_CAP and the panel's
// sentence stays true; AT the cap the day has more answers than the tail
// can hold (today's daily, at any real size), and the sheet falls back to
// the full live query rather than show fifty of today over a hundred and
// fifty of before as "the latest". So the saving is on the cold question
// — the feed card someone opens a week on — and the hot one costs what it
// always did. Trading the exact claim for a cheaper hot sheet is a copy
// decision, and it is the owner's (the runbook's 2.4 note).
export const VOTER_TAIL_CAP = 50;

/** The nightly sample documents, by id — mirrors of `worldSampleId` and
 * `citySampleId` in functions/src/patternsSamples.ts (the two packages do
 * not share a build; pinned by voter-sample.test.ts). The city is the
 * frozen chip, URI-encoded because a chip may hold what a document id may
 * not. */
export const worldSampleId = (qid: string): string => `sample-${qid}`;
export const citySampleId = (qid: string, city: string): string => `city-${qid}~${encodeURIComponent(city)}`;

/** The session's profile caches, which a sample read fills from the rows
 * that carry a stamp (runbook 2.3) — so `resolveNames` afterwards has
 * nothing left to read for those people. */
export interface ProfileCaches {
  names: Record<string, string>;
  scores?: Record<string, ParsedResults | null>;
  logic?: Record<string, number | null>;
}

export interface Voter {
  uid: string;
  /**
   * The option they picked — or **-1 for a catalogue answer**, which has
   * no option column to sit in and carries `entity` instead.
   *
   * -1 rather than an absent field because every fold over these rows
   * already bounds-checks this (`groupByOption`, typeSplit, logicSplit,
   * peopleMap all test `>= 0`), so a catalogue row falls out of an
   * options-shaped reading by arithmetic rather than by each caller
   * remembering to ask.
   */
  optionIdx: number;
  /**
   * The catalogue key they picked (D14), for a pick question only.
   *
   * Carried since 2026-09-11. These rows used to be DROPPED in the fetch
   * — "a catalog board is a different surface with a different renderer"
   * — which was true about the renderer and cost the surface every name:
   * a catalogue question was the one kind of question in the app where
   * "who picked what" could not be asked at all, six months after D98
   * made answers public precisely so it could be.
   */
  entity?: number;
  /** The cohort this answer was given from — frozen at vote time (D8). */
  anchors: Record<string, string>;
  /** Display name, or "" when the voter has not set one. */
  name: string;
  /** True for the viewer's own answer, so the UI can mark it. */
  isMe: boolean;
}

/**
 * What a row answers WITH — the option index, or the catalogue key for a
 * pick. Every fold that compares two people's answers has to read it
 * through this rather than off `optionIdx`, which is a permanent -1 on a
 * catalogue row.
 *
 * NOT A FUNCTION HERE, deliberately. This module is imported statically by
 * data/live.ts, which is in the first-paint graph — check:bundle's eager
 * ceiling has no headroom at all (the constant exists to keep the 292 KB
 * Firestore SDK out of first paint, and it is measured to the byte). An
 * exported helper for an expression this small is eager weight for a
 * one-line read, so the two callers spell it: live.ts's Kindred fold, and
 * ui/LivePickBreakdown, which is behind the feed chunk.
 */

// ── pure helpers (unit-tested without Firebase) ─────────────────────

/** Split uids into `in`-sized chunks, preserving order and deduping. */
export function chunkUids(uids: readonly string[], size = UID_CHUNK): string[][] {
  const seen = new Set<string>();
  const flat: string[] = [];
  for (const u of uids) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    flat.push(u);
  }
  const out: string[][] = [];
  for (let i = 0; i < flat.length; i += size) out.push(flat.slice(i, i + size));
  return out;
}

/**
 * Group voters by the option they picked, as a dense array of the
 * question's option count.
 *
 * Dense rather than sparse on purpose: the UI draws one column per option
 * including the empty ones, and a missing key would render as a missing
 * column rather than an empty one — "nobody picked this" is a result.
 */
export function groupByOption(voters: readonly Voter[], optionCount: number): Voter[][] {
  const out: Voter[][] = Array.from({ length: Math.max(0, optionCount) }, () => []);
  for (const v of voters) {
    if (v.optionIdx >= 0 && v.optionIdx < out.length) out[v.optionIdx].push(v);
  }
  return out;
}

/**
 * The order voters are shown in: the viewer first, then named people, then
 * the unnamed.
 *
 * Putting yourself first is not vanity — it is the fastest way to check
 * that the list is telling the truth about you, which is the first thing
 * anyone does with a screen like this. Unnamed last because a run of
 * "Someone" at the top reads as a broken list.
 */
export function sortVoters(voters: readonly Voter[]): Voter[] {
  return [...voters].sort((a, b) => {
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
    const an = a.name ? 0 : 1;
    const bn = b.name ? 0 : 1;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid);
  });
}

/** The uid owning an answer document, from its path: v2_users/{uid}/answers/{qid}. */
export function uidFromAnswerPath(path: string): string | null {
  const parts = path.split("/");
  const i = parts.indexOf("v2_users");
  return i >= 0 && parts.length > i + 1 ? parts[i + 1] : null;
}

/**
 * Newest first, one row per person, at most `cap`: the live tail ahead of
 * the sample it extends. A person in both — an edit since the merge, or
 * the viewer's own answer — keeps the newer row.
 */
export function unionVoters(newest: readonly Voter[], older: readonly Voter[], cap: number = VOTER_FETCH_CAP): Voter[] {
  const seen = new Set<string>();
  const out: Voter[] = [];
  for (const v of [...newest, ...older]) {
    if (seen.has(v.uid)) continue;
    seen.add(v.uid);
    out.push(v);
  }
  return out.slice(0, cap);
}
