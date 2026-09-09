// The group portrait, computed from reveal history — pure math, no I/O.
//
// Everything here is derived from reveal docs the viewer can already read
// (v2_groups/{gid}/reveals/r{n} — one per ROUND since ROUNDS-PLAN /
// D426; before that one per day, gated on the reveal's own members
// snapshot), so the portrait adds no disclosure of its own: it is a
// different arrangement of votes the user has already been shown with
// names attached. That is exactly the scope D1 carves out — named
// who-voted inside a mutual circle.
//
// Kept pure and separate from live.ts so the arithmetic is testable
// without a store: majority ties, missing votes and thin histories are
// the cases that produce a wrong-but-plausible portrait, and those are
// what groupPortrait.test.ts pins.

// The one import: the likeness SORT key, shared with Kindred, Circle and
// the People lens so a thin overlap is discounted the same way everywhere
// (D277 §2). Pure arithmetic — it does not make this module less testable.
import { likenessRate } from "./cohort";

export interface PortraitVote {
  optionIdx: number;
  /** A guess at where the room would land (D386) — read by the roles
   * fold, never by the portrait: which option won is a fact about the
   * answers, and a guess is not one of them. */
  guessIdx?: number;
  /** set only when this member answered a different question — see voteQid */
  qid?: string | null;
  /** Answered after the round revealed, with the table in view (ROUNDS-PLAN
   *  §4): shown on the card, counted in no row here — a portrait is a
   *  reading of blind answers. */
  late?: boolean;
  /**
   * Who this vote's optionIdx MEANT on a "pick" day (D224) — snapshotted
   * by the answering client, because the index is relative to a roster
   * that changes. Absent on non-pick days and in reveals older than D224.
   */
  pickUid?: string | null;
}

export interface PortraitReveal {
  day: string;
  /** The round this reveal is of (ROUNDS-PLAN, D426); absent before
   *  rounds. Carried onto the row so the Groups stop can key and label a
   *  row by it — a room can reveal several rounds in one day. */
  round?: number | null;
  qid?: string | null;
  votes?: Record<string, PortraitVote> | null;
  /** Who was in the group ON that day (SCHEMA-V2) — a pick day's option
   * count, for the roles fold's chance scale (D386). Unread here. */
  members?: readonly string[] | null;
}

/**
 * The question a single vote was an answer to.
 *
 * Members compute the day's duel question independently (duelQFor, deck.ts,
 * with the bank LENGTH as its modulus), so a bank revision can hand two
 * members different questions for the same day with no hacked client. The
 * reveal is published under the question most of them answered and stamps
 * `qid` on the votes that were answers to something else (D70, D71); a vote
 * without one answered the revealed question, which is also what every
 * reveal written before D71 means.
 *
 * Everything downstream that compares two people's optionIdx has to go
 * through this first. Two answers to different questions are not an
 * agreement or a disagreement — option 2 of one prompt has nothing to do
 * with option 2 of another, and counting them together produces a number
 * that looks like consensus and is noise.
 */
export function voteQid(vote: PortraitVote | undefined, revealQid: string | null): string | null {
  if (!vote) return null;
  return typeof vote.qid === "string" && vote.qid ? vote.qid : revealQid;
}

export interface PortraitRow {
  day: string;
  /** The round, when the reveal carries one — the row's identity under
   *  rounds; `day` alone is not, since D426. Null for a legacy reveal. */
  round: number | null;
  qid: string | null;
  /** votes per optionIdx, dense from 0..maxIdx */
  counts: number[];
  /** the winning option — lowest index on a tie, purely for display */
  majorityIdx: number;
  /** how many members picked the majority option */
  majorityN: number;
  /** everyone who voted that round */
  total: number;
  /** my optionIdx, or null if I did not play that round */
  mine: number | null;
  /** true when my option's count equals the max — a tie counts as with */
  withMajority: boolean;
  /**
   * Members who played this round but answered a different question, so their
   * answer is in none of the counts above. Usually 0. Surfaced rather than
   * hidden because `total` otherwise silently disagrees with the number of
   * people the reveal card shows.
   */
  offQuestion: number;
  /** true when MY answer was the off-question one — then `mine` is null */
  mineOffQuestion: boolean;
  /**
   * WHO the majority option meant, on a pick day (D224) — from the votes'
   * own snapshots, never from indexing the current roster. Null unless
   * every counted majority vote that carries a snapshot names the same
   * person: clients can hold different rosters on the same day, and a
   * split snapshot means the index grouping itself was unsound, which is
   * not a thing to paper over with a name.
   */
  majorityPickUid: string | null;
  /** same, for MY vote — who I picked, when my answer snapshotted it */
  minePickUid: string | null;
}

export interface PortraitPerson {
  uid: string;
  /** rounds BOTH of us voted */
  shared: number;
  /** of those, rounds we picked the same option */
  agree: number;
  /** agree/shared as a 0–100 integer; 0 when shared is 0 */
  pct: number;
}

export interface GroupPortrait {
  /** revealed rounds seen (reveals that exist and carry votes) */
  rounds: number;
  /** rounds I voted */
  roundsPlayed: number;
  /** rounds my option's count was the max — see withMajority note */
  meWithMaj: number;
  /** alignment as 0–100 over roundsPlayed; 0 when I never played */
  alignPct: number;
  /** newest first, same order the reveals were given in */
  rows: PortraitRow[];
  /** everyone but me, most-agreeing first */
  people: PortraitPerson[];
  /** highest-agreement member with >= MIN_SHARED shared rounds, else null */
  twin: PortraitPerson | null;
  /** lowest-agreement member with >= MIN_SHARED shared rounds, else null */
  contrarian: PortraitPerson | null;
}

// One shared day is a coin flip, not a kinship: naming someone "most like
// you" off a single agreement would be the fabrication this feature
// exists to remove. Two is still thin, but it is the floor at which the
// label says something a user can check against the rows above it.
export const MIN_SHARED = 2;

export function portraitRow(reveal: PortraitReveal, myUid: string | null): PortraitRow | null {
  const votes = reveal.votes;
  if (!votes) return null;
  const played = Object.entries(votes).filter(([, v]) => v && typeof v.optionIdx === "number" && !v.late);
  if (!played.length) return null;
  const rowQid = reveal.qid ?? null;
  // Only answers to THIS row's question may be counted together — see
  // voteQid. The rest still count as having played (the reveal card shows
  // them), which is why offQuestion is reported rather than dropped.
  const entries = played.filter(([, v]) => voteQid(v, rowQid) === rowQid);
  if (!entries.length) return null;
  const maxIdx = Math.max(...entries.map(([, v]) => v.optionIdx));
  const counts = new Array<number>(maxIdx + 1).fill(0);
  for (const [, v] of entries) counts[v.optionIdx]++;
  const maxN = Math.max(...counts);
  const majorityIdx = counts.indexOf(maxN);
  const mineVote = myUid != null ? votes[myUid] : undefined;
  // A late answer of mine is on the card and in no row: not blind, so not
  // a round I played for the alignment below (ROUNDS-PLAN §4) — the same
  // rule `played` applied to everyone else's votes a few lines up.
  const minePlayed = mineVote && typeof mineVote.optionIdx === "number" && !mineVote.late;
  const mineOffQuestion = !!minePlayed && voteQid(mineVote, rowQid) !== rowQid;
  // `mine` is my answer TO THIS QUESTION. If I answered a different one I
  // have no option in this row's space, so the alignment arithmetic below
  // must not count the day as one I played — a made-up alignment is the
  // fabrication D1 forbids, and it would be indistinguishable from a real one.
  const mine = minePlayed && !mineOffQuestion ? (mineVote as PortraitVote).optionIdx : null;
  // The pick-day snapshots (D224). Only the counted votes on the majority
  // option are consulted, and only unanimously: a mixed set (old and new
  // clients, or genuinely different rosters) yields null and the reader
  // falls back to the index rather than to a guessed name.
  const majorityPicks = entries
    .filter(([, v]) => v.optionIdx === majorityIdx)
    .map(([, v]) => v.pickUid)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  const majorityPickUid =
    majorityPicks.length > 0 && majorityPicks.every((p) => p === majorityPicks[0])
      ? majorityPicks[0]
      : null;
  const minePick = mine != null ? (mineVote as PortraitVote).pickUid : null;
  return {
    day: reveal.day,
    round: typeof reveal.round === "number" ? reveal.round : null,
    qid: rowQid,
    counts,
    majorityIdx,
    majorityN: maxN,
    total: entries.length,
    offQuestion: played.length - entries.length,
    mineOffQuestion,
    mine,
    // "with the majority" is about the count, not the index, so a 2–2 tie
    // leaves both blocs with the majority rather than punishing the one
    // that happens to sit at the higher option index.
    withMajority: mine != null && counts[mine] === maxN,
    majorityPickUid,
    minePickUid: typeof minePick === "string" && minePick ? minePick : null,
  };
}

export function groupPortrait(reveals: PortraitReveal[], myUid: string | null): GroupPortrait {
  const rows: PortraitRow[] = [];
  for (const r of reveals) {
    const row = portraitRow(r, myUid);
    if (row) rows.push(row);
  }

  const roundsPlayed = rows.filter((r) => r.mine != null).length;
  const meWithMaj = rows.filter((r) => r.withMajority).length;

  // pairwise agreement, over the same rows the user can see above
  const acc: Record<string, { shared: number; agree: number }> = {};
  for (const r of reveals) {
    const votes = r.votes;
    if (!votes || myUid == null) continue;
    const mine = votes[myUid];
    if (!mine || typeof mine.optionIdx !== "number") continue;
    // A late answer — given after the reveal, with the table in view — is
    // not blind, so it is nobody's shared reading, mine or theirs
    // (ROUNDS-PLAN §4): the rows above already leave it out, and the
    // twin and breaks-ranks labels this feeds must not be earned by an
    // answer that could see the room first.
    if (mine.late) continue;
    const rowQid = r.qid ?? null;
    const myQid = voteQid(mine, rowQid);
    for (const [uid, v] of Object.entries(votes)) {
      if (uid === myUid || !v || typeof v.optionIdx !== "number" || v.late) continue;
      // A round we answered DIFFERENT questions is not a shared round. Counting
      // it either way is wrong: as agreement it invents a kinship, as
      // disagreement it invents a rift — and both feed the "twin" and
      // "breaks ranks" labels below, which name a real person to their face.
      if (voteQid(v, rowQid) !== myQid) continue;
      const a = (acc[uid] = acc[uid] || { shared: 0, agree: 0 });
      a.shared++;
      if (v.optionIdx === mine.optionIdx) a.agree++;
    }
  }
  const people: PortraitPerson[] = Object.entries(acc)
    .map(([uid, a]) => ({ uid, shared: a.shared, agree: a.agree, pct: a.shared ? Math.round((a.agree / a.shared) * 100) : 0 }))
    // Sorted on the confidence-bounded rate, not the printed percentage
    // (D277 §2). This list feeds the "twin" and "breaks ranks" labels
    // below, which name a real person to their face — so a member who
    // overlapped on one question must not be able to take either label off
    // someone who overlapped on twenty. MIN_SHARED gates who is eligible;
    // this decides the order of the ones who are.
    .sort((x, y) => likenessRate(y.agree, y.shared) - likenessRate(x.agree, x.shared)
      || y.shared - x.shared
      || (x.uid < y.uid ? -1 : 1));

  const eligible = people.filter((p) => p.shared >= MIN_SHARED);
  // Both labels need a SPREAD, not just a sample.
  //
  // The comparator's final clause is a uid tiebreak that never returns 0, so
  // a fully tied list is ordered by uid alone — and taking first and last of
  // it crowned one person "most like you" and called another "breaks ranks"
  // on identical numbers. Reproduced: three members each 3/3 with me yields
  // twin=ann, contrarian=cy, and LiveGroupsMirrorBody renders "breaks ranks"
  // beside a literal 3/3 and a full accent bar. The inverse fires too — with
  // everyone at 0%, someone is crowned the twin.
  //
  // Reachable on day two of a live group (3 members, 2 shared days is the
  // minimum clearing MIN_SHARED), and stable across sessions, so the same
  // person is named the dissenter every time they open it. MIN_SHARED bounds
  // the sample size; nothing bounded the spread.
  //
  // A single eligible member is still a twin — "most like you" of one person
  // claims no contrast. What is meaningless is TWO OR MORE at the same
  // number, where first and last are the uid tiebreak talking.
  const flatTie = eligible.length > 1 && eligible[0].pct === eligible[eligible.length - 1].pct;
  // …and the OTHER end is not simply the other end of this sort. The list is
  // ordered by `likenessRate` — a Wilson lower bound, which is right for
  // crowning the twin (D277 §2: rate sorts, pct draws) and wrong for reading
  // backwards off, because a bound penalises a thin sample toward zero. So
  // the member who shared two days and agreed on both lands LAST at 100%,
  // and "breaks ranks" is printed beside a full accent bar reading 2/2.
  // Reproduced with Ada 13/14 and Bo 2/2: rate .79 vs .55, and Bo is last.
  //
  // The dissenter is therefore the lowest PRINTED likeness, which is the
  // number the label is read against — and there is no dissenter at all when
  // that is the twin, because then nobody in the group is further from you
  // than the person being called closest. `flatTie` is the special case of
  // that and stays for the twin's own sake.
  const low = eligible.reduce((a, b) => (b.pct < a.pct ? b : a), eligible[0]);
  const contrarian = eligible.length > 1 && low.uid !== eligible[0].uid && low.pct < eligible[0].pct
    ? low
    : null;
  return {
    rounds: rows.length,
    roundsPlayed,
    meWithMaj,
    alignPct: roundsPlayed ? Math.round((meWithMaj / roundsPlayed) * 100) : 0,
    rows,
    people,
    twin: flatTie ? null : (eligible[0] || null),
    contrarian,
  };
}
