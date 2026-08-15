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
}
export interface RevealDocLike {
  day?: string;
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
 * than trusting the caller. Reveals with no `day` sort last (they are the
 * live listener's copy of yesterday, which the caller stamps).
 */
export function duoRuns(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
): DuoRuns {
  const read: boolean[] = [];
  const by: boolean[] = [];
  if (!me || !them) return { read, by };
  const days = [...history].sort((a, b) => String(a.day || "").localeCompare(String(b.day || "")));
  for (const d of days) {
    const votes = d.votes || {};
    const mine = votes[me];
    const theirs = votes[them];
    if (!mine || !theirs) continue;
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
