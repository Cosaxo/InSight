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
// for the arithmetic and D224 for the snapshot.
import { duoRuns, type RevealDocLike } from "./duelRuns";
import { groupPortrait, type PortraitReveal } from "./groupPortrait";

/** Days below this and a run says nothing about a person — in the floor's
 * own unit (see duoRoleDays / groupRoleDays). */
export const MIN_DUO = 3;
export const MIN_GROUP = 2;

/**
 * How far a setting still under its floor has got — the thin row's
 * "1 of 3". Deliberately the SAME unit the floor checks, which is not
 * "revealed days": a 1v1 counts scored days (both guessed, the same
 * question — duoRuns drops the rest), a group counts days YOU played.
 * A pair can reveal five days and guess on two, and telling them "no 1v1
 * has run 3 revealed days" would be false — the copy bug this exists to
 * keep out of the panel.
 */
export function duoRoleDays(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
): number {
  return duoRuns(history, me, them).read.length;
}
export function groupRoleDays(
  reveals: readonly PortraitReveal[],
  myUid: string | null,
): number {
  return groupPortrait(reveals as PortraitReveal[], myUid).daysPlayed;
}

export interface RoleDim {
  id: string;
  label: string;
  value: number;
  /** The plain count the score is made of — every dim carries its receipt. */
  note: string;
}
export interface RoleResult {
  /** Days behind this reading, in the unit the floor counts — both guessed for a 1v1, played for a group. NOT revealed days — the weight a blend gives it. */
  n: number;
  dims: RoleDim[];
}

const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));
const rate = (r: number, t: number): number => (t ? clamp((r / t) * 100) : 50);

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

// ── 1v1 ─────────────────────────────────────────────────────────────────
/**
 * Your role in one 1v1, from the pair's reveal history.
 *
 * `read`/`seen`/`steady` come straight off `duoRuns`, which already drops
 * the two kinds of unscoreable day (different questions, or a missing
 * guess). `like` cannot: it is about the ANSWERS, not the guesses, so a
 * day where neither of you guessed still counts for it. That is why it
 * walks the history itself rather than riding the same array — the two
 * denominators are genuinely different, and sharing one would either
 * discard likeness days or credit unguessed days as reads.
 */
export function duoRole(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
): RoleResult | null {
  const runs = duoRuns(history, me, them);
  if (runs.read.length < MIN_DUO) return null;

  let same = 0, shared = 0;
  for (const rev of history) {
    const votes = rev.votes || {};
    const mine = votes[me], theirs = votes[them];
    if (!mine || !theirs) continue;
    const rowQid = rev.qid || "";
    const qa = typeof mine.qid === "string" && mine.qid ? mine.qid : rowQid;
    const qb = typeof theirs.qid === "string" && theirs.qid ? theirs.qid : rowQid;
    if (qa !== qb) continue; // the same day, two different questions
    if (typeof mine.optionIdx !== "number" || typeof theirs.optionIdx !== "number") continue;
    shared++;
    if (mine.optionIdx === theirs.optionIdx) same++;
  }

  const readRight = runs.read.filter(Boolean).length;
  const seenRight = runs.by.filter(Boolean).length;
  return {
    n: runs.read.length,
    dims: [
      { id: "read", label: "Insight", value: rate(readRight, runs.read.length),
        note: `right on ${readRight} of your ${runs.read.length} guesses` },
      { id: "seen", label: "Legibility", value: rate(seenRight, runs.by.length),
        note: `they're right on ${seenRight} of their ${runs.by.length}` },
      { id: "like", label: "Likeness", value: rate(same, shared),
        note: `the same answer on ${same} of ${shared} days` },
      { id: "steady", label: "Steadiness", value: steadiness(runs.read),
        note: `your read flipped ${flipsOf(runs.read)} times in ${runs.read.length} days` },
    ],
  };
}

const flipsOf = (arr: readonly boolean[]): number => {
  let f = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) f++;
  return f;
};

// ── groups ──────────────────────────────────────────────────────────────
/**
 * Your role in one group, from its reveal history.
 *
 * Every number folds out of `groupPortrait`, which the live Groups body
 * already runs on the same history — so this is arithmetic over a fold
 * that has happened, not a second pass over the data.
 *
 * `own` divides by days I PLAYED rather than by days revealed, which is a
 * deliberate difference from the prototype (it divides by all revealed
 * days). Dividing by revealed days makes not turning up look like
 * independence, and "away from the majority" has to mean something you
 * did.
 */
export function groupRole(
  reveals: readonly PortraitReveal[],
  myUid: string | null,
): RoleResult | null {
  const P = groupPortrait(reveals as PortraitReveal[], myUid);
  if (P.daysPlayed < MIN_GROUP) return null;

  const away = P.daysPlayed - P.meWithMaj;
  // Centrality: across everyone who has shared days with me, how often
  // they landed where I did. Weighted by shared days rather than by
  // person, so a member present for two days does not count as much as
  // one present for twenty.
  let agree = 0, shared = 0;
  for (const p of P.people) { agree += p.agree; shared += p.shared; }
  const majRun = P.rows
    .filter((r) => r.mine != null)
    .map((r) => r.withMajority)
    .reverse(); // rows are newest-first; a run reads oldest-left

  return {
    n: P.daysPlayed,
    dims: [
      { id: "own", label: "Independence", value: rate(away, P.daysPlayed),
        note: `away from the majority on ${away} of ${P.daysPlayed} days` },
      { id: "pull", label: "Centrality", value: rate(agree, shared),
        note: `others landed with you ${agree} of ${shared} times` },
      { id: "settle", label: "Steadiness", value: steadiness(majRun),
        note: `you moved in and out of the majority ${flipsOf(majRun)} times` },
    ],
  };
}

// ── the average across settings ─────────────────────────────────────────
/**
 * Blend several settings into one portrait, weighted by those days.
 *
 * A three-day duel must not swing the portrait as hard as a twenty-four
 * day one. The blended dims carry NO `note`: a receipt belongs to one
 * setting, and "right on 7 of 11" is false of an average.
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
  return { n: total, dims };
}
