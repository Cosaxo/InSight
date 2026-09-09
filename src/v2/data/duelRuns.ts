// duelRuns — how well a 1v1 pair reads each other, folded out of the
// reveal history they can both already see (D156).
//
// WHAT IT IS. The prototype's finished duel card ends with two rows of
// dots: one per revealed day, filled when the guess landed. "The dots ARE
// the score" — there is no number anywhere, because the shape of the run
// (a clump of misses, a late streak) says more than an average.
//
// The live card had nothing there. The data was already on the phone: the
// reveal doc for each day carries both members' `optionIdx` and `guessIdx`,
// and `LIVE.social.revealHistory` hands back every readable one. So this is
// a pure fold, no read, no new field — the same posture as `cohort.ts`.
//
// TWO DAYS ARE DELIBERATELY DROPPED rather than scored:
//
//   1. A day the pair were asked DIFFERENT questions (D70/D71's split).
//      Comparing a guess about one prompt to an answer about another lands
//      on "called it" by coincidence — the exact bug LdReveal's `comparable`
//      check exists to stop, one screen further along.
//   2. A day either side has no guess. Both runs are drawn on one axis and
//      read against each other, so a day present in one row and absent from
//      the other would offset every dot after it and make the two rows
//      describe different weeks.
//
// Dropping is right for both: a run of dots claims "these are the days we
// played", and a day that cannot be scored is not one of them.
export interface RevealVoteLike {
  optionIdx?: number;
  guessIdx?: number;
  qid?: string;
  /** The member a pick named, snapshotted at write time (D224) — the
   *  index above is roster-relative and a leave remaps it. */
  pickUid?: string | null;
  /** Answered after the round revealed, with the table in view (ROUNDS-PLAN
   *  §4). Shown in the reveal; counted by no fold, because it was not blind. */
  late?: boolean;
}
export interface RevealDocLike {
  day?: string;
  /** The round this reveal is of (ROUNDS-PLAN, D426); absent before rounds. */
  round?: number;
  qid?: string;
  votes?: Record<string, RevealVoteLike>;
}
export interface DuoRuns {
  /** Oldest first — did YOU call THEIR answer, one entry per scored day. */
  read: boolean[];
  /** Oldest first — did THEY call YOURS. Same days, same order. */
  by: boolean[];
}

const qidOf = (v: RevealVoteLike, rowQid: string): string =>
  (typeof v.qid === "string" && v.qid ? v.qid : rowQid);

/**
 * Fold a duo's reveal history into the two runs.
 *
 * `history` may arrive in any order — `revealHistory()` returns newest
 * first and the runs are drawn oldest-left, so this sorts by day key rather
 * than trusting the caller.
 *
 * A reveal with no `day` sorts FIRST, not last. This said "last" and the
 * code never did it: the comparator is `String(a.day || "")`, and an empty
 * string precedes every date key, so a dayless reveal — the live
 * listener's copy of yesterday, before the caller stamps it — lands at the
 * oldest end of a run drawn oldest-left. Nothing caught it because no case
 * passes one. duelRuns.test.ts's "sorts a dayless reveal FIRST" is the
 * pin, so the sentence and the comparator cannot drift apart again.
 *
 * NO PRODUCTION CALLER. Everything outside this module and its own test
 * that names `duoRuns` is a COMMENT citing it — `LiveRolesPanel` and
 * `roles.ts` both do — while the fold that actually runs is `roles.ts`'s
 * private `duoFold`, reached through `duoRoleRounds` and `duoRole`. So
 * there are two definitions of "a scored round" in the tree and this is
 * the one nobody executes. Left standing rather than deleted on an
 * unattended night, because removing a tested export that two comments
 * point at is a bigger call than correcting a false sentence; recorded on
 * the night list so the choice is made deliberately.
 */
export function duoRuns(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
): DuoRuns {
  const read: boolean[] = [];
  const by: boolean[] = [];
  if (!me || !them) return { read, by };
  // …and by round within a day: a pair can reveal several rounds in one
  // day (ROUNDS-PLAN, D426), and the run has to keep the order they landed.
  const days = [...history].sort((a, b) =>
    String(a.day || "").localeCompare(String(b.day || ""))
    || (typeof a.round === "number" ? a.round : 0) - (typeof b.round === "number" ? b.round : 0));
  for (const d of days) {
    const votes = d.votes || {};
    const mine = votes[me];
    const theirs = votes[them];
    if (!mine || !theirs) continue;
    // A late answer was made with the table in view — not a read of anyone,
    // and not read by anyone's guess either.
    if (mine.late || theirs.late) continue;
    if (typeof mine.optionIdx !== "number" || typeof theirs.optionIdx !== "number") continue;
    if (typeof mine.guessIdx !== "number" || typeof theirs.guessIdx !== "number") continue;
    const rowQid = d.qid || "";
    if (qidOf(mine, rowQid) !== qidOf(theirs, rowQid)) continue;
    read.push(mine.guessIdx === theirs.optionIdx);
    by.push(theirs.guessIdx === mine.optionIdx);
  }
  return { read, by };
}

/**
 * Who picked what, for one reveal — the group card's bar rows.
 *
 * Returns one entry per option index that at least one member chose, so a
 * dead option draws no row (a row reading "0" is noise on a screen whose
 * whole job is the shape of the split). Members who answered a DIFFERENT
 * question are excluded entirely: their vote is not in this question's
 * counts, and the card says so separately rather than folding it in.
 */
export function revealTally(
  reveal: RevealDocLike,
  optionCount: number,
): Array<{ optionIdx: number; uids: string[] }> {
  const votes = reveal.votes || {};
  const rowQid = reveal.qid || "";
  const byOpt = new Map<number, string[]>();
  for (const uid of Object.keys(votes)) {
    const v = votes[uid];
    if (typeof v.optionIdx !== "number") continue;
    if (qidOf(v, rowQid) !== rowQid) continue;
    // The tally is what "you read the room" is scored against, so a late
    // answer stays out of it; the card lists late answers on their own row.
    if (v.late) continue;
    const list = byOpt.get(v.optionIdx);
    if (list) list.push(uid);
    else byOpt.set(v.optionIdx, [uid]);
  }
  const out: Array<{ optionIdx: number; uids: string[] }> = [];
  // Option order, not count order: the bars sit under the prompt whose
  // options they are, and re-sorting by popularity makes the winner move
  // between days for reasons that are not about the answer.
  const width = Math.max(optionCount, ...[...byOpt.keys()].map((i) => i + 1), 0);
  for (let i = 0; i < width; i++) {
    const uids = byOpt.get(i);
    if (uids && uids.length) out.push({ optionIdx: i, uids });
  }
  return out;
}

/** A role vote's row: who the counted votes named, and by whom. */
export interface RoleTallyRow {
  /** The lowest option index the row folded — the ballot's order, and the
   *  index the bars, `held` and `rival` still speak in. */
  optionIdx: number;
  /** The member named; null for a vote neither a snapshot nor the reveal's
   *  roster can place. */
  uid: string | null;
  uids: string[];
}

/**
 * Who one counted role vote names: its D224 snapshot (`pickUid`), else the
 * reveal's OWN roster at that index (`members`, the room as it stood
 * before the reveal) — never the live roster, which a leave remaps. This
 * is the one definition of "who does this option name": the card, its run
 * and the Mirror's Votes lens answered it in three places with three
 * fallbacks, which is how the card and the lens came to disagree (the
 * second review of #456).
 */
export function namedBy(
  v: { optionIdx?: number | null; pickUid?: string | null },
  roster: readonly string[],
): string | null {
  if (typeof v.pickUid === "string" && v.pickUid) return v.pickUid;
  return typeof v.optionIdx === "number" ? (roster[v.optionIdx] ?? null) : null;
}

/**
 * The role vote's tally by WHO was named, not by option index. Two indexes
 * can name one member: A votes index 3 (snapshot D), C leaves, B votes
 * index 2 — which is D now, and D's snapshot says so. By index that is a
 * tie and the card read "D and D share the mastermind"; by snapshot D
 * holds it 2–0, which is what `groupCast.roleVotes` says on the Mirror,
 * and the card must agree with the stop. The same counted votes as
 * `revealTally` (this question, not late); rows in option order.
 */
export function roleTally(reveal: RevealDocLike, roster: readonly string[]): RoleTallyRow[] {
  const votes = reveal.votes || {};
  const rowQid = reveal.qid || "";
  const byWho = new Map<string, RoleTallyRow>();
  const byIdx = new Map<number, RoleTallyRow>();
  for (const voter of Object.keys(votes)) {
    const v = votes[voter];
    if (typeof v.optionIdx !== "number") continue;
    if (qidOf(v, rowQid) !== rowQid) continue;
    if (v.late) continue;
    const who = namedBy(v, roster);
    const have = who ? byWho.get(who) : byIdx.get(v.optionIdx);
    if (have) {
      have.uids.push(voter);
      if (v.optionIdx < have.optionIdx) have.optionIdx = v.optionIdx;
    } else {
      const row: RoleTallyRow = { optionIdx: v.optionIdx, uid: who, uids: [voter] };
      if (who) byWho.set(who, row); else byIdx.set(v.optionIdx, row);
    }
  }
  return [...byWho.values(), ...byIdx.values()].sort((a, b) => a.optionIdx - b.optionIdx);
}
