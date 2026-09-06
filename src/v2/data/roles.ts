// YOUR ROLE, as a test result (D204) — the prototype's `role-data.js`,
// folded from the app's real duel record instead of its seeded one.
//
// WHAT IT IS. The duels already record how each 1v1 and each group goes;
// this reads that record as an INSTRUMENT. Four dimensions for a 1v1,
// three for a group, each 0–100 and comparable to a trait score, matched
// to a named type by the same `IS_matchArchetype` every other test uses.
// So a role card IS a result card — same rose, same rarity, same nearby
// types — and no new visual language is invented for it.
//
// PURE, like `groupPortrait` and `duelRuns` beside it: no Firebase, no
// window, no LIVE. The caller hands in the reveal history it already
// fetched for the duel panel, so this adds no read, no field and no
// collection. That is what makes Roles "real on arrival" rather than a
// backend item (D167).
//
// ── the scale (D386, ROLES-PLAN §3.2) ──────────────────────────────────
//
// Every rate here is scored AGAINST LUCK, per day, and then averaged: a
// hit counts 1, a miss counts −1/(k−1) for a day with k options, and the
// mean lands on 0–100 as 50 + 50·mean. So 50 is guessing at random and
// 100 is right every day — on a two-option day and an eight-option pick
// day alike. The raw hit rate was not that: thirteen of the friends
// pool's 32 questions are binary, so a pair whose rotation happened to
// serve them read each other "better", and Independence on a pick day
// in a group of eight was near-certain for a reason that was not the
// person. The receipts (`note`) stay the plain counts, because "right on
// 3 of 4" is the sentence a person can check against the card.
//
// k comes from the bank entry the caller looks up (`BankLookup` — the
// store's `bankQ`), from the reveal's own roster on a pick day, or, when
// neither can say, from the highest index the reveal's votes reach. The
// last is a floor, never a guess at more options than were seen.
//
// ── the day's kind ──────────────────────────────────────────────────────
//
// Eleven of the friends pool's questions ask for a read of the OTHER
// person ("The word that fits them best?"). Both answer about the other
// and the guess is what they said about you — a hit there is knowing how
// you are seen, which is a different measurement from reading their
// preferences, and the same answer on such a day means you each picked
// "Warm" about the other, which says nothing about being alike. The
// bank's `d` tag reaches the seed as `topic` since D386 (the group's
// kind already rode that field), so a `mirror` day is held apart: it
// moves none of the four dims and lands in its own receipt rows
// (`asides`). Without a lookup every day reads as an ordinary one, which
// is what every reveal before the tag was seeded is.
//
// ── the one dimension that did NOT survive the port ────────────────────
//
// The prototype's group instrument has a FOURTH dimension, `cast`
// ("Standing" — how often the group crowns you), and it is the only part
// of `role-data.js` with no live source at all: it reads
// `DUELS.roleVotes(gid)`, a scenario-pack generator that exists solely in
// the demo module, and `docs/MIRROR.md` records those crowns as unbuilt.
//
// Shipping it anyway would have meant a constant 50 for every user —
// which equals the authored baseline exactly, so it would contribute
// nothing to any type match while drawing an identical petal on every
// rose. A dead axis presented as a measurement is precisely what D167
// forbids and what D157 spent a release removing. So `cast` is not here.
//
// Dropping it costs THREE of the nine group types, and they are dropped
// rather than kept hollow. "The First Pick" and "The Spark" are DEFINED
// by `cast` (94 and 78 against a near-neutral rest). "The Floater" is the
// one the first pass missed: without `cast` its signature is 46/46/44,
// and `IS_archScores` weights each dim by |sig − 50|, so a type
// near-neutral on everything can never be picked — a registry case caught
// it. Six remain, their shares renormalised from 83 to 100 because
// `IS_archScores` also taxes rare types by log(maxShare/share) and a
// table that does not sum to 100 quietly shifts every match. The pick
// questions in the group bank are what could ground a real `cast` — their
// options ARE the member list — and since D224 each pick answer snapshots
// the picked member's uid into the reveal, which removes the
// roster-remapping hazard D204 priced. What still stands between here and
// a live `cast` is DATA: the snapshot is forward-only, pick days are a
// fraction of the rotation, and a dimension folded from zero or two
// snapshotted days is the dead axis this file exists to refuse. See D204
// for the arithmetic, D224 for the snapshot, and ROLES-PLAN §3.5 for the
// floored `named` that would replace it.
//
// ── what is folded but not yet matched ─────────────────────────────────
//
// `asides` are receipts for readings the tables do not carry yet — a
// 1v1's projection (did you guess your own answer?) and its mirror days,
// a group's reading of the room (did you call where it landed?). They
// blend and draw like dims and are kept OUT of `dims` on purpose: the
// registry cases hold every signature to exactly the fold's dim ids, so a
// reading the tables cannot see is a row, not a petal, until the tables
// take it (ROLES-PLAN §5 step 4).
import { type RevealDocLike } from "./duelRuns";
import { groupPortrait, portraitRow, voteQid, type PortraitReveal, type PortraitRow } from "./groupPortrait";

/** Days below this and a run says nothing about a person — in the floor's
 * own unit (see duoRoleDays / groupRoleDays). */
export const MIN_DUO = 3;
export const MIN_GROUP = 2;

/** The domain a 1v1 question is tagged with when it asks for a read of
 * the other person rather than what they would do. */
export const MIRROR = "mirror";

/** What the fold asks the bank about a day's question: how many options
 * it had, and what kind of day it was. The store's `bankQ` has this shape
 * (`kind` is the seeded `topic`: a group's us/pick/classic, a 1v1's
 * day/heat/mirror/ahead since D386). */
export interface BankEntryLike {
  options?: readonly string[] | null;
  kind?: string | null;
}
export type BankLookup = (qid: string) => BankEntryLike | null | undefined;

/** A reveal as this fold reads it — the duel shape plus the roster the
 * reveal carries (who was in the group ON that day, SCHEMA-V2), which is
 * a pick day's option count. */
interface RevealLike extends RevealDocLike {
  members?: readonly string[] | null;
}

const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

/**
 * How many options a day had — the chance denominator. The bank entry
 * first; a pick day's roster second (its bank options are empty because
 * the members ARE the options); and when neither can say, the highest
 * index the reveal's own votes reach, which is a floor on the truth and
 * never more options than were seen. Two is the least a question can
 * have, so nothing below it.
 */
export function optionsOn(reveal: RevealLike, qid: string, lookup?: BankLookup): number {
  const q = lookup && qid ? lookup(qid) : null;
  const n = q && q.options ? q.options.length : 0;
  if (n >= 2) return n;
  const pick = !!q && (q.kind === "pick" || !n);
  const roster = reveal.members ? reveal.members.length : 0;
  if (pick && roster >= 2) return roster;
  let top = 0;
  for (const v of Object.values(reveal.votes || {})) {
    if (!v) continue;
    if (typeof v.optionIdx === "number") top = Math.max(top, v.optionIdx);
    if (typeof v.guessIdx === "number") top = Math.max(top, v.guessIdx);
  }
  return Math.max(2, top + 1);
}

/** The running tally behind one chance-scaled reading. */
export interface Tally {
  /** the chance-scaled credit so far: +1 a hit, −1/(k−1) a miss */
  sum: number;
  /** days counted */
  n: number;
  /** plain hits — the receipt */
  hits: number;
}
const tally = (): Tally => ({ sum: 0, n: 0, hits: 0 });
const count = (t: Tally, hit: boolean, k: number): void => {
  t.n++;
  if (hit) { t.hits++; t.sum += 1; } else t.sum -= 1 / (Math.max(2, k) - 1);
};
/** 50 + 50·mean, clamped — 50 with nothing counted, never a flattering 100. */
export const chanceValue = (t: { sum: number; n: number }): number =>
  (t.n ? clamp(50 + (50 * t.sum) / t.n) : 50);

export interface RoleDim {
  id: string;
  label: string;
  value: number;
  /** The plain count the score is made of — every dim carries its receipt. */
  note: string;
}
/** A reading the tables do not carry yet — drawn as a receipt row, blended
 * like a dim, never matched (see the header). */
export interface RoleAside extends RoleDim {
  /** days behind it, and the weight a blend gives it */
  n: number;
}
export interface RoleResult {
  /** Days behind this reading, in the unit the floor counts — both guessed for a 1v1, played for a group. NOT revealed days — the weight a blend gives it. */
  n: number;
  dims: RoleDim[];
  asides?: RoleAside[];
}

/**
 * A run's steadiness is its lack of flips: 111000 is steady, 101010 is
 * not. A coin lands near 50, which is what makes it comparable to a trait
 * score. Fewer than two entries has no flips to count, so it returns the
 * neutral rather than a flattering 100.
 */
export function steadiness(arr: readonly boolean[]): number {
  if (!arr || arr.length < 2) return 50;
  let flips = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) flips++;
  return clamp(100 - (flips / (arr.length - 1)) * 100);
}

const flipsOf = (arr: readonly boolean[]): number => {
  let f = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) f++;
  return f;
};

const byDay = <T extends { day?: string }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => String(a.day || "").localeCompare(String(b.day || "")));

// ── 1v1 ─────────────────────────────────────────────────────────────────
interface DuoFold {
  read: Tally; seen: Tally; like: Tally; project: Tally;
  mirror: Tally; mirrorBy: Tally;
  /** oldest first — did YOU call THEIR answer, one entry per scored ordinary day */
  readRun: boolean[];
}

/**
 * One pass over the pair's history. Two kinds of day are dropped rather
 * than scored, as `duoRuns` drops them (D156 §3): a day the pair were
 * asked DIFFERENT questions, and — for the guess readings — a day either
 * side has no guess. Likeness is about the ANSWERS, so a day nobody
 * guessed still counts for it; that is why it is tallied before the guess
 * check rather than off the same array. A mirror day counts for nothing
 * but its own two rows.
 */
function duoFold(history: readonly RevealDocLike[], me: string, them: string, lookup?: BankLookup): DuoFold {
  const F: DuoFold = { read: tally(), seen: tally(), like: tally(), project: tally(), mirror: tally(), mirrorBy: tally(), readRun: [] };
  if (!me || !them) return F;
  for (const rev of byDay(history)) {
    const votes = rev.votes || {};
    const mine = votes[me], theirs = votes[them];
    if (!mine || !theirs) continue;
    const rowQid = rev.qid || "";
    const qa = typeof mine.qid === "string" && mine.qid ? mine.qid : rowQid;
    const qb = typeof theirs.qid === "string" && theirs.qid ? theirs.qid : rowQid;
    if (qa !== qb) continue; // the same day, two different questions
    if (typeof mine.optionIdx !== "number" || typeof theirs.optionIdx !== "number") continue;
    const k = optionsOn(rev, qa, lookup);
    const q = lookup && qa ? lookup(qa) : null;
    const guessed = typeof mine.guessIdx === "number" && typeof theirs.guessIdx === "number";
    if (q && q.kind === MIRROR) {
      if (guessed) {
        count(F.mirror, mine.guessIdx === theirs.optionIdx, k);
        count(F.mirrorBy, theirs.guessIdx === mine.optionIdx, k);
      }
      continue;
    }
    count(F.like, mine.optionIdx === theirs.optionIdx, k);
    if (!guessed) continue;
    const hit = mine.guessIdx === theirs.optionIdx;
    count(F.read, hit, k);
    F.readRun.push(hit);
    count(F.seen, theirs.guessIdx === mine.optionIdx, k);
    count(F.project, mine.guessIdx === mine.optionIdx, k);
  }
  return F;
}

/**
 * How far a setting still under its floor has got — the thin row's
 * "1 of 3". Deliberately the SAME unit the floor checks, which is not
 * "revealed days": a 1v1 counts ordinary days both guessed on the same
 * question (a mirror day is not one of them), a group counts days YOU
 * played. A pair can reveal five days and guess on two, and telling them
 * "no 1v1 has run 3 revealed days" would be false — the copy bug this
 * exists to keep out of the panel.
 */
export function duoRoleDays(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
  lookup?: BankLookup,
): number {
  return duoFold(history, me, them, lookup).read.n;
}
export function groupRoleDays(
  reveals: readonly PortraitReveal[],
  myUid: string | null,
): number {
  return groupPortrait(reveals as PortraitReveal[], myUid).daysPlayed;
}

/**
 * Your role in one 1v1, from the pair's reveal history.
 *
 * `read`/`seen`/`steady` come off the ordinary days both guessed; `like`
 * off every ordinary day both answered. The asides are the readings the
 * `duo` table does not carry: projection (your guess was your own
 * answer — the lane's knowledge-against-projection, tie-3) and the mirror
 * days, each side.
 */
export function duoRole(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
  lookup?: BankLookup,
): RoleResult | null {
  const F = duoFold(history, me, them, lookup);
  if (F.read.n < MIN_DUO) return null;
  const asides: RoleAside[] = [];
  if (F.project.n) asides.push({ id: "project", label: "Projection", value: chanceValue(F.project), n: F.project.n,
    note: `guessed your own answer ${F.project.hits} of ${F.project.n} times` });
  if (F.mirror.n) asides.push({ id: "mirror", label: "How they see you", value: chanceValue(F.mirror), n: F.mirror.n,
    note: `you called how they see you on ${F.mirror.hits} of ${F.mirror.n} days` });
  if (F.mirrorBy.n) asides.push({ id: "mirrorBy", label: "How you see them", value: chanceValue(F.mirrorBy), n: F.mirrorBy.n,
    note: `they called how you see them on ${F.mirrorBy.hits} of ${F.mirrorBy.n} days` });
  return {
    n: F.read.n,
    dims: [
      { id: "read", label: "Insight", value: chanceValue(F.read),
        note: `right on ${F.read.hits} of your ${F.read.n} guesses` },
      { id: "seen", label: "Legibility", value: chanceValue(F.seen),
        note: `they're right on ${F.seen.hits} of their ${F.seen.n}` },
      { id: "like", label: "Likeness", value: chanceValue(F.like),
        note: `the same answer on ${F.like.hits} of ${F.like.n} days` },
      { id: "steady", label: "Steadiness", value: steadiness(F.readRun),
        note: `your read flipped ${flipsOf(F.readRun)} times in ${F.readRun.length} days` },
    ],
    asides,
  };
}

// ── groups ──────────────────────────────────────────────────────────────
/**
 * Your role in one group, from its reveal history.
 *
 * The rows come from `groupPortrait`, which the live Groups body already
 * runs on the same history; this walks them once more with the day's
 * option count in hand, because the portrait's numbers are raw and these
 * are scored against luck.
 *
 * `own` divides by days I PLAYED rather than by days revealed, which is a
 * deliberate difference from the prototype (it divides by all revealed
 * days). Dividing by revealed days makes not turning up look like
 * independence, and "away from the majority" has to mean something you
 * did. `pull` is weighted by shared days rather than by person, so a
 * member present for two days does not count as much as one present for
 * twenty. `room` (an aside until the table carries it, ROLES-PLAN §3.5)
 * is your guess at where the room would land — a hit when it named an
 * option that tied for the top — and only on a day two or more answered
 * the row's question, because a room of one is you.
 */
export function groupRole(
  reveals: readonly PortraitReveal[],
  myUid: string | null,
  lookup?: BankLookup,
): RoleResult | null {
  const P = groupPortrait(reveals as PortraitReveal[], myUid);
  if (P.daysPlayed < MIN_GROUP || myUid == null) return null;

  const own = tally(), pull = tally(), room = tally();
  const majRun: boolean[] = [];
  for (const r of byDay(reveals)) {
    const row: PortraitRow | null = portraitRow(r, myUid);
    if (!row || row.mine == null) continue;
    const votes = r.votes || {};
    const mine = votes[myUid];
    if (!mine) continue;
    const k = optionsOn(r as RevealLike, row.qid || "", lookup);
    count(own, row.withMajority, k);
    majRun.push(row.withMajority);
    const rowQid = r.qid ?? null;
    const myQid = voteQid(mine, rowQid);
    for (const [uid, v] of Object.entries(votes)) {
      if (uid === myUid || !v || typeof v.optionIdx !== "number") continue;
      // A day we answered DIFFERENT questions is not a shared day —
      // groupPortrait's own rule, kept here for the same reason.
      if (voteQid(v, rowQid) !== myQid) continue;
      count(pull, v.optionIdx === mine.optionIdx, k);
    }
    const guess = mine.guessIdx;
    if (typeof guess === "number" && row.total >= 2) {
      count(room, (row.counts[guess] || 0) === row.majorityN, k);
    }
  }
  const asides: RoleAside[] = [];
  if (room.n) asides.push({ id: "room", label: "Reading the room", value: chanceValue(room), n: room.n,
    note: `called where the room landed ${room.hits} of ${room.n} times` });

  return {
    n: P.daysPlayed,
    dims: [
      { id: "own", label: "Independence", value: clamp(100 - chanceValue(own)),
        note: `away from the majority on ${own.n - own.hits} of ${own.n} days` },
      { id: "pull", label: "Centrality", value: chanceValue(pull),
        note: `others landed with you ${pull.hits} of ${pull.n} times` },
      { id: "settle", label: "Steadiness", value: steadiness(majRun),
        note: `you moved in and out of the majority ${flipsOf(majRun)} times` },
    ],
    asides,
  };
}

// ── the average across settings ─────────────────────────────────────────
/**
 * Blend several settings into one portrait, weighted by those days.
 *
 * A three-day duel must not swing the portrait as hard as a twenty-four
 * day one. The blended dims carry NO `note`: a receipt belongs to one
 * setting, and "right on 7 of 11" is false of an average. Asides blend
 * the same way, each on its own days.
 */
export function blendRoles(items: readonly RoleResult[]): RoleResult | null {
  const real = items.filter((r) => r && r.n > 0);
  if (!real.length) return null;
  const total = real.reduce((a, r) => a + r.n, 0);
  if (!total) return null;
  const ids = real[0].dims.map((d) => d.id);
  const dims: RoleDim[] = ids.map((id) => {
    const label = real[0].dims.find((d) => d.id === id)?.label ?? id;
    let sum = 0;
    for (const r of real) {
      const d = r.dims.find((x) => x.id === id);
      if (d) sum += d.value * r.n;
    }
    return { id, label, value: clamp(sum / total), note: "" };
  });
  const asideIds: string[] = [];
  for (const r of real) for (const a of r.asides || []) if (!asideIds.includes(a.id)) asideIds.push(a.id);
  const asides: RoleAside[] = [];
  for (const id of asideIds) {
    let sum = 0, n = 0, label = id;
    for (const r of real) {
      const a = (r.asides || []).find((x) => x.id === id);
      if (!a || !(a.n > 0)) continue;
      sum += a.value * a.n; n += a.n; label = a.label;
    }
    if (n) asides.push({ id, label, value: clamp(sum / n), note: "", n });
  }
  return { n: total, dims, asides };
}
