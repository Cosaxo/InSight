// The follow graph, and the population it makes — the Mirror's Circle
// stop (D101).
//
// WHAT CIRCLE WAS. A field of 49 named people with likeness percentages,
// drawn from `relmap-core.js`. None of them existed. Live mode replaced
// the whole body with an empty state that said so and pointed at groups,
// because v2 had no person-to-person graph of any kind (D3) — groups
// joined by an invite code were the only real connection the app could
// make.
//
// WHAT IT IS NOW. A follow is a BOOKMARK, not a permission grant, and
// that one sentence is the entire design. Since D98 every answer and
// profile is already readable by any signed-in user, so following someone
// gives the follower nothing they did not already have. That removes the
// hard half of a social graph: there is no request, no acceptance, no
// notification, and no state machine — a follow is one document that
// exists or does not.
//
// Mutual follows are a READING, not a state. If both directions exist the
// client calls it mutual; the server stores two independent rows and
// knows nothing about the pair. A "friendship" that has to be agreed is a
// consent mechanism, and consent is only needed for access the follower
// does not otherwise have.
//
// TWO COSTS, both bounded and both paid only when the stop is opened:
//
//   1. One query for your own follow list.
//   2. One query PER followed account for their answers. This is the
//      expensive one and it is why FOLLOW_CAP exists — not as a product
//      limit but as a bound on a fan-out that would otherwise grow with
//      no ceiling. Circle is the only surface in the app that reads a
//      named individual's whole answer set rather than a question's
//      voters, so it is the only one that can fan out this way.
//
// Everything below the fetch functions is pure and unit-tested without
// Firebase, for the same reason cohort.ts is: a likeness ranking that is
// quietly wrong still renders a plausible screen.

import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { agreement, type Agreement } from "./cohort";
import { WORLD_ANSWER_SURFACES, resolveNames } from "./voters";
import {
  flattenAxes, scoreMatch, type ParsedResults, type ScoreMatch,
} from "./similarity";

/**
 * How many accounts one Circle may hold.
 *
 * A bound on fan-out, not a statement about how many people someone may
 * care about: opening the stop runs one answer query per followed
 * account, so an unbounded list is an unbounded read. Picked well above
 * any plausible curated set — if this ever binds in the field the answer
 * is to page the fetch, not to raise the number quietly.
 */
export const FOLLOW_CAP = 50;

/** Answers to read per followed account. */
export const CIRCLE_ANSWER_CAP = 300;

export interface Member {
  uid: string;
  /** Display name, or "" when the account has not set one. */
  name: string;
  /** True when they follow you back — derived, never stored. */
  mutual: boolean;
  /**
   * How alike your answers are, over what you have both answered.
   *
   * ZERO-SHARED until the answer pass runs (loadCircleAnswers). Circle
   * opens on profiles alone now, so this is the second reading rather
   * than the first — see `score`.
   */
  like: Agreement;
  /**
   * Score likeness — 100 minus the mean gap across every axis you both
   * have, over all four persisted instruments.
   *
   * THE PRIMARY RANKING, and the reason is not only cost. `agreement`
   * depends on WHICH questions the two of you happen to have both
   * answered, so it is unstable in a way that shows: rankMembers carries
   * an overlap tiebreak specifically because one shared question that
   * matched scores 100% and would otherwise head the list forever. A
   * score profile is the same basis for everyone and does not move with
   * question luck.
   *
   * This is not a new metric here — D112 already made scoreMatch the
   * primary ranking for the People lens and the similarity field, with
   * agreement as the fallback for people you share no completed
   * instrument with. Circle is the surface that never got moved over.
   *
   * null when either of you has completed no instrument, which is what
   * keeps `agreement` load-bearing rather than decorative.
   */
  score: ScoreMatch | null;
}

/**
 * A member's answers, kept OUT of `Member` deliberately.
 *
 * Circle used to read up to CIRCLE_ANSWER_CAP answers per member on
 * open — the app's single largest read, ~1,500 for a five-person circle
 * — and every one of them served two things: the likeness number and the
 * "where your circle splits" section. The first no longer needs them at
 * all (see `score`); the second genuinely does, because ranking questions
 * by divisiveness means folding every member's answer to every candidate
 * question, and no cheaper query answers that.
 *
 * So the answers became a separate, deferred load rather than a smaller
 * one. That is the cost gate the Mirror already uses everywhere else — a
 * tab body exists only while its tab is open, so Kindred runs on the tap
 * that asks for it — applied to the one surface that was still paying its
 * biggest read on arrival.
 */
export type MemberAnswers = Record<string, Record<string, number>>;

// ── pure helpers ────────────────────────────────────────────────────

/**
 * Rank a circle: most alike first, then the biggest overlap, then by name.
 *
 * The overlap tiebreak matters more than it looks. Agreement is a
 * percentage, so a single shared question that happened to match scores
 * 100% — and without the second key that person would head the list
 * forever, above someone who matched on forty of fifty. Sorting on
 * `pct` alone is the ranking bug this app is most likely to ship,
 * because it looks completely right until someone answers one question.
 */
export function rankMembers(members: readonly Member[]): Member[] {
  return members.slice().sort((a, b) => {
    // Score first, exactly as rankKindred orders the People lens (D112):
    // everyone you share a completed instrument with sorts above everyone
    // you do not, and a missing score is a fallback rather than a zero.
    // Sorting the two bases together would rank an 80% score match below
    // a 100% agreement drawn from one shared question, which is the
    // comparison the tiebreak below exists because of.
    if (!!a.score !== !!b.score) return a.score ? -1 : 1;
    if (a.score && b.score) {
      const d = b.score.match - a.score.match || b.score.axes - a.score.axes;
      if (d) return d;
    }
    return b.like.pct - a.like.pct
      || b.like.shared - a.like.shared
      || (a.name || "￿").localeCompare(b.name || "￿")
      || a.uid.localeCompare(b.uid);
  });
}

export interface CircleSplit {
  qid: string;
  /** Per-option counts across the circle, dense to `optionCount`. */
  counts: number[];
  /** How many of the circle answered it. */
  n: number;
}

/**
 * How the circle answered one question.
 *
 * The viewer is NOT in it, and that is the opposite of the choice
 * `typicality` makes for the Map — deliberately. There, you are a member
 * of your own age band and excluding yourself would make the Map
 * disagree with the aggregate beside it. Here the question the screen
 * asks is "what do the people I follow think", and folding yourself in
 * would let a circle of one show you your own answer as its consensus.
 */
export function circleSplit(
  members: readonly Member[],
  answers: MemberAnswers,
  qid: string,
  optionCount: number,
): CircleSplit {
  const counts = new Array(Math.max(0, optionCount)).fill(0) as number[];
  let n = 0;
  for (const m of members) {
    // The answers arrive as their own map rather than on the member,
    // because they are now a SEPARATE and deferred read — a member the
    // answer pass has not covered (or whose read failed) is absent here,
    // and absent is exactly "did not answer this" for a split's purposes.
    const idx = answers[m.uid]?.[qid];
    if (idx == null || idx < 0 || idx >= counts.length) continue;
    counts[idx]++;
    n++;
  }
  return { qid, counts, n };
}

/** Cap a follow list deterministically — oldest follows win a tie. */
export function capFollows(uids: readonly string[], cap = FOLLOW_CAP): string[] {
  return uids.slice(0, Math.max(0, cap));
}

// ── reads ───────────────────────────────────────────────────────────

/** The uids this account follows, oldest first. */
export async function fetchFollowing(db: Firestore, uid: string): Promise<string[]> {
  const snap = await getDocs(query(
    collection(db, "v2_users", uid, "following"),
    fsLimit(FOLLOW_CAP),
  ));
  return snap.docs
    .map((d) => ({ id: d.id, at: (d.data().at as { seconds?: number } | undefined)?.seconds || 0 }))
    // Oldest first so the cap is stable across sessions: ordering by an
    // unindexed field server-side would need an index for a list this
    // small, and the sort is free once the page is in hand.
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .map((d) => d.id);
}

/**
 * Which of `uids` follow `me` back.
 *
 * One collection-group query on `to`, not one query per candidate. The
 * `to` field exists for deleteAccount (a collection-group query cannot
 * filter on a document id) and this is its second reader — the mutual
 * flag comes free off an index that had to exist anyway.
 */
export async function fetchFollowersOf(
  db: Firestore,
  me: string,
  among: readonly string[],
): Promise<Set<string>> {
  if (!among.length) return new Set();
  const snap = await getDocs(query(
    collectionGroup(db, "following"),
    where("to", "==", me),
    fsLimit(FOLLOW_CAP * 2),
  ));
  const set = new Set(among);
  const out = new Set<string>();
  for (const d of snap.docs) {
    // The follower is the uid that OWNS the row: v2_users/{follower}/following/{me}
    const owner = d.ref.parent.parent?.id;
    if (owner && set.has(owner)) out.add(owner);
  }
  return out;
}

/**
 * One account's world answers, as qid → optionIdx.
 *
 * Carries the same `surface` filter voters.ts does, and for the same
 * non-negotiable reason: firestore.rules grants the cross-user read as a
 * VALUE test on `surface`, so a query without a matching `where` is
 * refused wholesale rather than filtered down (D65). It is also what
 * keeps sealed duel answers out of a Circle reading.
 */
export async function fetchAnswersOf(
  db: Firestore,
  uid: string,
): Promise<Record<string, number>> {
  const snap = await getDocs(query(
    collection(db, "v2_users", uid, "answers"),
    where("surface", "in", [...WORLD_ANSWER_SURFACES]),
    fsLimit(CIRCLE_ANSWER_CAP),
  ));
  const out: Record<string, number> = {};
  for (const d of snap.docs) {
    const idx = d.data().optionIdx;
    if (typeof idx === "number") out[d.id] = idx;
  }
  return out;
}

/** Follow someone. Idempotent — re-following an existing row rewrites it. */
export async function follow(db: Firestore, me: string, target: string): Promise<void> {
  if (!me || !target || me === target) return;
  await setDoc(doc(db, "v2_users", me, "following", target), {
    at: serverTimestamp(),
    // Pinned equal to the doc id by the rules; see firestore.rules.
    to: target,
  });
}

export async function unfollow(db: Firestore, me: string, target: string): Promise<void> {
  if (!me || !target) return;
  await deleteDoc(doc(db, "v2_users", me, "following", target));
}

/**
 * Build the whole Circle: who you follow, their answers, their likeness
 * to you, and which of them follow you back.
 *
 * Fans out one answer query per member, in parallel and capped. A member
 * whose read fails is dropped rather than failing the stop — one
 * unreadable account must not blank a circle of thirty.
 */
export async function loadCircle(
  db: Firestore,
  me: string,
  mine: ParsedResults | null,
  names: Record<string, string>,
  scores: Record<string, ParsedResults | null>,
): Promise<Member[]> {
  const uids = capFollows(await fetchFollowing(db, me));
  if (!uids.length) return [];
  // ONE read per member, and it is the read that was already happening for
  // names — `resolveNames` fills the score cache from the same profile
  // document (D112), so the ranking below is free on top of a lookup the
  // stop needed anyway. That is the whole shape of this change: the
  // likeness stopped needing a fan-out because the data it wants was
  // already on the wire for a different reason.
  const [, followers] = await Promise.all([
    resolveNames(db, uids, names, scores),
    fetchFollowersOf(db, me, uids).catch(() => new Set<string>()),
  ]);
  const mineFlat = mine ? flattenAxes(mine) : null;
  const out: Member[] = uids.map((uid) => ({
    uid,
    name: names[uid] || "",
    mutual: followers.has(uid),
    // Empty until loadCircleAnswers runs. `agreement` over nothing is
    // {shared:0, same:0, pct:0}, which every consumer already renders as
    // "nothing in common yet" rather than as 0% — the state existed
    // before this change, for a member who genuinely shared no question.
    like: agreement({}, {}),
    // A person-to-person match needs a whole shared instrument (5-6 axes
    // arriving together), the same MIN rankKindred uses. Below that the
    // gap is measured over too little to mean anything.
    score: mineFlat && scores[uid] ? scoreMatch(mineFlat, flattenAxes(scores[uid]!), 5) : null,
  }));
  return rankMembers(out);
}

/**
 * The deferred half: every member's answers, for the splits section.
 *
 * Still one query per member and still capped — this is the read the
 * open-time load used to pay, moved to the moment something actually
 * needs it. It also fills `like`, which is why a member with no shared
 * instrument gets a likeness at all.
 *
 * A member whose read fails is dropped from the map rather than failing
 * the stop; one unreadable account must not blank a circle of thirty.
 */
export async function loadCircleAnswers(
  db: Firestore,
  members: readonly Member[],
  myAnswers: Readonly<Record<string, number>>,
): Promise<{ answers: MemberAnswers; ranked: Member[] }> {
  const sets = await Promise.all(
    members.map((m) => fetchAnswersOf(db, m.uid).catch(() => null)),
  );
  const answers: MemberAnswers = {};
  const ranked = members.map((m, i) => {
    const set = sets[i];
    if (!set) return m;
    answers[m.uid] = set;
    return { ...m, like: agreement(myAnswers, set) };
  });
  return { answers, ranked: rankMembers(ranked) };
}
