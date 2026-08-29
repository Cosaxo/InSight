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
  documentId,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { agreement, type Agreement } from "./cohort";
import { chunkUids } from "./voters";
import { WORLD_ANSWER_SURFACES } from "./voters";

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
  /** How alike your answers are, over what you have both answered. */
  like: Agreement;
  /** qid → optionIdx, as read. */
  answers: Record<string, number>;
}

// ── pure helpers ────────────────────────────────────────────────────

/**
 * Rank a circle: most alike first, then the biggest overlap, then by name.
 *
 * THE COMMENT THAT USED TO BE HERE described this exact bug and then
 * claimed the second sort key prevented it: "a single shared question that
 * happened to match scores 100% — and without the second key that person
 * would head the list forever, above someone who matched on forty of
 * fifty. Sorting on `pct` alone is the ranking bug this app is most likely
 * to ship, because it looks completely right until someone answers one
 * question."
 *
 * It was right about the bug and wrong about the fix, and it shipped that
 * way (D277 §2). `b.pct - a.pct || b.shared - a.shared` sorts on pct
 * FIRST, so `shared` only ever separates two people who already have the
 * same percentage — the 1-of-1 still headed the list, above the 40-of-50,
 * exactly as feared. Five sites sorted this way.
 *
 * `rate` is the key that makes the sentence true: a Wilson lower bound on
 * same/shared, so a thin sample is discounted in proportion to how thin it
 * is. `pct` is still the number the member row prints.
 */
export function rankMembers(members: readonly Member[]): Member[] {
  return members.slice().sort((a, b) =>
    b.like.rate - a.like.rate
    || b.like.shared - a.like.shared
    || (a.name || "￿").localeCompare(b.name || "￿")
    || a.uid.localeCompare(b.uid));
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
  qid: string,
  optionCount: number,
): CircleSplit {
  const counts = new Array(Math.max(0, optionCount)).fill(0) as number[];
  let n = 0;
  for (const m of members) {
    const idx = m.answers[qid];
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
 * ASKED FOR EXACTLY THE ROWS IT WANTS, which is the fix for a count that
 * was bounded on the wrong side of the join. This used to fetch a page of
 * "everyone who follows me" — `where("to","==",me)` with a 100-row cap, no
 * ordering, nothing tying the page to `among` — and then intersect it on
 * the device. Firestore's implicit order is by path, so past 100 followers
 * the page was the lexicographically-first hundred, chosen without
 * reference to the people actually being asked about: every mutual outside
 * that slice read as false. The Circle then printed "N follow you back"
 * too low, dropped the badge from real mutuals, and at zero told someone
 * whose circle DOES follow them back that following is one-way. The
 * follower count is entirely outside the viewer's control, and rules cap
 * it at nothing.
 *
 * The rows wanted are `v2_users/{candidate}/following/{me}` — every path
 * fully known, because a follow's document id IS its target. So the query
 * names them: `documentId() in [...]`, thirty at a time, which is Firestore's
 * limit on `in`. Fewer reads than the old page (at most one per candidate,
 * ≤50, against a flat 100) and exact at any follower count.
 *
 * The `to` equality STAYS, and not as a leftover. `firestore.rules` gates
 * the collection group on `resource.data.to == request.auth.uid`, and D65's
 * measured lesson is that a collection-group read must carry the matching
 * `where` or Firestore refuses the whole query rather than filtering it.
 * Verified against the real rules in an emulator, not reasoned about: the
 * two filters together return exactly the candidates who follow back,
 * including ones the old page could never reach.
 */
export async function fetchFollowersOf(
  db: Firestore,
  me: string,
  among: readonly string[],
): Promise<Set<string>> {
  if (!among.length) return new Set();
  const out = new Set<string>();
  // 30 is the `in` limit. `chunkUids` dedupes and preserves order, which is
  // the same helper the voter reads use for the same reason.
  for (const chunk of chunkUids(among, 30)) {
    const snap = await getDocs(query(
      collectionGroup(db, "following"),
      where("to", "==", me),
      where(documentId(), "in", chunk.map((u) => doc(db, "v2_users", u, "following", me))),
    ));
    for (const d of snap.docs) {
      // The follower is the uid that OWNS the row: v2_users/{follower}/following/{me}
      const owner = d.ref.parent.parent?.id;
      if (owner) out.add(owner);
    }
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
  myAnswers: Readonly<Record<string, number>>,
  names: (uid: string) => string,
): Promise<Member[]> {
  const uids = capFollows(await fetchFollowing(db, me));
  if (!uids.length) return [];
  const [answerSets, followers] = await Promise.all([
    Promise.all(uids.map((u) => fetchAnswersOf(db, u).catch(() => null))),
    fetchFollowersOf(db, me, uids).catch(() => new Set<string>()),
  ]);
  const out: Member[] = [];
  uids.forEach((uid, i) => {
    const answers = answerSets[i];
    if (!answers) return;
    out.push({
      uid,
      name: names(uid),
      mutual: followers.has(uid),
      like: agreement(myAnswers, answers),
      answers,
    });
  });
  return rankMembers(out);
}
