// The group portrait, computed from reveal history — pure math, no I/O.
//
// Everything here is derived from reveal docs the viewer can already read
// (v2_groups/{gid}/reveals/{day}, gated on the reveal's own members
// snapshot), so the portrait adds no disclosure of its own: it is a
// different arrangement of votes the user has already been shown with
// names attached. That is exactly the scope D1 carves out — named
// who-voted inside a mutual circle.
//
// Kept pure and separate from live.ts so the arithmetic is testable
// without a store: majority ties, missing votes and thin histories are
// the cases that produce a wrong-but-plausible portrait, and those are
// what groupPortrait.test.ts pins.

export interface PortraitVote {
  optionIdx: number;
}

export interface PortraitReveal {
  day: string;
  qid?: string | null;
  votes?: Record<string, PortraitVote> | null;
}

export interface PortraitRow {
  day: string;
  qid: string | null;
  /** votes per optionIdx, dense from 0..maxIdx */
  counts: number[];
  /** the winning option — lowest index on a tie, purely for display */
  majorityIdx: number;
  /** how many members picked the majority option */
  majorityN: number;
  /** everyone who voted that day */
  total: number;
  /** my optionIdx, or null if I did not play that day */
  mine: number | null;
  /** true when my option's count equals the max — a tie counts as with */
  withMajority: boolean;
}

export interface PortraitPerson {
  uid: string;
  /** days BOTH of us voted */
  shared: number;
  /** of those, days we picked the same option */
  agree: number;
  /** agree/shared as a 0–100 integer; 0 when shared is 0 */
  pct: number;
}

export interface GroupPortrait {
  /** revealed days seen (reveals that exist and carry votes) */
  days: number;
  /** days I voted */
  daysPlayed: number;
  /** days my option's count was the max — see withMajority note */
  meWithMaj: number;
  /** alignment as 0–100 over daysPlayed; 0 when I never played */
  alignPct: number;
  /** newest first, same order the reveals were given in */
  rows: PortraitRow[];
  /** everyone but me, most-agreeing first */
  people: PortraitPerson[];
  /** highest-agreement member with >= MIN_SHARED shared days, else null */
  twin: PortraitPerson | null;
  /** lowest-agreement member with >= MIN_SHARED shared days, else null */
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
  const entries = Object.entries(votes).filter(([, v]) => v && typeof v.optionIdx === "number");
  if (!entries.length) return null;
  const maxIdx = Math.max(...entries.map(([, v]) => v.optionIdx));
  const counts = new Array<number>(maxIdx + 1).fill(0);
  for (const [, v] of entries) counts[v.optionIdx]++;
  const maxN = Math.max(...counts);
  const majorityIdx = counts.indexOf(maxN);
  const mineVote = myUid != null ? votes[myUid] : undefined;
  const mine = mineVote && typeof mineVote.optionIdx === "number" ? mineVote.optionIdx : null;
  return {
    day: reveal.day,
    qid: reveal.qid ?? null,
    counts,
    majorityIdx,
    majorityN: maxN,
    total: entries.length,
    mine,
    // "with the majority" is about the count, not the index, so a 2–2 tie
    // leaves both blocs with the majority rather than punishing the one
    // that happens to sit at the higher option index.
    withMajority: mine != null && counts[mine] === maxN,
  };
}

export function groupPortrait(reveals: PortraitReveal[], myUid: string | null): GroupPortrait {
  const rows: PortraitRow[] = [];
  for (const r of reveals) {
    const row = portraitRow(r, myUid);
    if (row) rows.push(row);
  }

  const daysPlayed = rows.filter((r) => r.mine != null).length;
  const meWithMaj = rows.filter((r) => r.withMajority).length;

  // pairwise agreement, over the same rows the user can see above
  const acc: Record<string, { shared: number; agree: number }> = {};
  for (const r of reveals) {
    const votes = r.votes;
    if (!votes || myUid == null) continue;
    const mine = votes[myUid];
    if (!mine || typeof mine.optionIdx !== "number") continue;
    for (const [uid, v] of Object.entries(votes)) {
      if (uid === myUid || !v || typeof v.optionIdx !== "number") continue;
      const a = (acc[uid] = acc[uid] || { shared: 0, agree: 0 });
      a.shared++;
      if (v.optionIdx === mine.optionIdx) a.agree++;
    }
  }
  const people: PortraitPerson[] = Object.entries(acc)
    .map(([uid, a]) => ({ uid, shared: a.shared, agree: a.agree, pct: a.shared ? Math.round((a.agree / a.shared) * 100) : 0 }))
    .sort((x, y) => y.pct - x.pct || y.shared - x.shared || (x.uid < y.uid ? -1 : 1));

  const eligible = people.filter((p) => p.shared >= MIN_SHARED);
  return {
    days: rows.length,
    daysPlayed,
    meWithMaj,
    alignPct: daysPlayed ? Math.round((meWithMaj / daysPlayed) * 100) : 0,
    rows,
    people,
    twin: eligible[0] || null,
    contrarian: eligible.length > 1 ? eligible[eligible.length - 1] : null,
  };
}
