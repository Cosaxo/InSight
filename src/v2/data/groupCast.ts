// groupCast — what the Mirror's Groups stop draws, folded from the room's
// own reveals (D435, the owner's 2026-09-09 design). Pure: no store, no
// window, no I/O — the caller hands in the reveal history it already
// fetched for the duel panel and the bank lookup (`bankQ`) that says what
// kind of round each reveal was.
//
// Three readings of one record:
//
//   · roleVotes   — who the room named, role by role: the LATEST vote on
//                   each role, who holds it, a contested runner-up, and who
//                   voted for whom. The Votes lens, the role map and
//                   Compare's role chips all read this one fold.
//   · groupScores — how the group rates itself: one row per rated
//                   question, the five-step counts, the mean, your step.
//   · namedCount  — the votes that named you against the votes the room
//                   cast, for the one sentence that says so (Compare).
//
// WHO HOLDS A ROLE IS THE CARD'S RULE (LiveDuelPanel over `revealTally`):
// every blind answer to the round's own question counts, a vote for
// yourself included; the most-named holds the role, a tie shares it, and
// a runner-up with two or more votes within one of the top makes it
// contested. So what this stop draws is exactly what the room saw on the
// reveal. The INSTRUMENT is stricter (roles.ts `seatTally`: a vote for
// yourself is not the room naming you), and that is the difference
// between a record and a reading — the Votes lens is the record.
//
// Every vote is placed by its D224 snapshot (`pickUid`), never by indexing
// the roster: a join or a leave remaps every historical index, and a vote
// with no snapshot (a reveal older than D224) is counted for nobody rather
// than for whoever now sits at that index.
import { voteQid, type PortraitReveal, type PortraitVote } from "./groupPortrait";
import { seatOf, type BankLookup, type SeatId } from "./roles";

/** A scenario pack, as the seeded question carries it (D432). */
export interface Pack { id: string; label: string; hue: number }

export interface RoleVoteRow {
  /** The role's id — one row per role, the latest vote on it. */
  key: string;
  qid: string;
  round: number | null;
  day: string;
  /** The role — *the mastermind*. */
  label: string;
  prompt: string;
  pack: Pack | null;
  seat: SeatId | null;
  /** Votes RECEIVED per member — blind, on this question, snapshotted. */
  votes: Record<string, number>;
  /** Who voted for whom: the named member → their voters, in the reveal's order. */
  by: Record<string, string[]>;
  /** Votes counted. */
  total: number;
  /** Everyone at the top count — one holder, or the two or more who share it. */
  holders: string[];
  /** The contested runner-up (the card's rule), or null. */
  second: string | null;
  contested: boolean;
  /** Whom YOU named, blind; null when you sat it out or answered late. */
  mine: string | null;
}

export interface RoleVotes {
  /** Latest first. */
  roles: RoleVoteRow[];
  /** The packs with a row, in the order their first row appears. */
  packs: Pack[];
}

// Oldest first by day, then by round — a room can reveal more than one
// round in a day (ROUNDS-PLAN, D426), and "the latest" has to mean time.
type Dated = PortraitReveal & { round?: number };
const byTime = (list: readonly PortraitReveal[]): Dated[] =>
  [...(list as Dated[])].sort((a, b) =>
    String(a.day || "").localeCompare(String(b.day || ""))
    || (typeof a.round === "number" ? a.round : 0) - (typeof b.round === "number" ? b.round : 0));

const roundOf = (r: Dated): number | null => (typeof r.round === "number" ? r.round : null);

/** The blind, on-question answers of a reveal, in the reveal's order. */
function counted(r: PortraitReveal): Array<[string, PortraitVote]> {
  const rowQid = r.qid || "";
  return Object.entries(r.votes || {}).filter(([, v]) =>
    !!v && !v.late && typeof v.optionIdx === "number" && voteQid(v, rowQid) === rowQid);
}

/**
 * Who the room named, role by role.
 *
 * A reveal is a role vote when the bank says its question is a `pick`
 * carrying a role (D432). A question the bank cannot name — a device that
 * has not re-read the bank, a question since retired — is no row here
 * rather than a row with a guessed role.
 */
export function roleVotes(
  reveals: readonly PortraitReveal[],
  lookup: BankLookup | undefined,
  myUid: string | null,
): RoleVotes {
  const byRole = new Map<string, RoleVoteRow>();
  if (!lookup) return { roles: [], packs: [] };
  for (const r of byTime(reveals)) {
    const qid = r.qid || "";
    const q = qid ? lookup(qid) : null;
    if (!q || q.kind !== "pick" || !q.role) continue;
    const votes: Record<string, number> = {};
    const by: Record<string, string[]> = {};
    let total = 0;
    let mine: string | null = null;
    for (const [voter, v] of counted(r)) {
      const who = typeof v.pickUid === "string" && v.pickUid ? v.pickUid : null;
      if (!who) continue;
      votes[who] = (votes[who] || 0) + 1;
      (by[who] = by[who] || []).push(voter);
      total += 1;
      if (voter === myUid) mine = who;
    }
    const order = Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = order.length ? order[0][1] : 0;
    const holders = order.filter(([, n]) => n === top).map(([u]) => u);
    const runner = order.find(([, n]) => n < top) || null;
    const contested = holders.length === 1 && !!runner && runner[1] >= 2 && top - runner[1] <= 1;
    const pack = q.scen ? { id: String(q.scen.id), label: String(q.scen.label), hue: Number(q.scen.hue) } : null;
    // The latest vote on a role replaces the one before it — a role is
    // held by whoever the room named LAST, and the run marks carry the
    // history.
    byRole.set(q.role.id, {
      key: q.role.id, qid, round: roundOf(r), day: String(r.day || ""),
      label: q.role.label, prompt: String(q.prompt || ""),
      pack, seat: seatOf(q.role.seat)?.id ?? null,
      votes, by, total, holders,
      second: contested && runner ? runner[0] : null,
      contested, mine,
    });
  }
  // Latest first — the order the reveal history is read in.
  const roles = [...byRole.values()].sort((a, b) =>
    b.day.localeCompare(a.day) || (b.round ?? 0) - (a.round ?? 0));
  const packs: Pack[] = [];
  for (const row of roles) if (row.pack && !packs.some((p) => p.id === row.pack!.id)) packs.push(row.pack);
  return { roles, packs };
}

export interface GroupScore {
  qid: string;
  round: number | null;
  day: string;
  prompt: string;
  poles: [string, string];
  /** The five step labels — the question's own options. */
  steps: string[];
  /** Blind answers per step, dense over the five. */
  counts: number[];
  total: number;
  /** 0..4 */
  mean: number;
  /** 0..100 — the mean over the five steps, the card's own figure. */
  score: number;
  /** The step label nearest the mean. */
  label: string;
  /** Everyone but you, blind: who stood where. */
  marks: Array<{ uid: string; step: number }>;
  /** Your step, blind; null when you sat it out or answered late. */
  mine: number | null;
}

/**
 * How the group rates itself: one row per rated question, the latest
 * answer to each (a rating asked twice is the same reading, updated).
 * Latest first; the caller sorts by lean where it wants the strongest
 * reading on top.
 */
export function groupScores(
  reveals: readonly PortraitReveal[],
  lookup: BankLookup | undefined,
  myUid: string | null,
): GroupScore[] {
  const byQ = new Map<string, GroupScore>();
  if (!lookup) return [];
  for (const r of byTime(reveals)) {
    const qid = r.qid || "";
    const q = qid ? lookup(qid) : null;
    if (!q || q.kind !== "rate" || !q.poles || q.poles.length < 2) continue;
    const steps = (q.options || []).map(String);
    const counts = [0, 0, 0, 0, 0];
    const marks: Array<{ uid: string; step: number }> = [];
    let mine: number | null = null;
    let total = 0;
    for (const [uid, v] of counted(r)) {
      const step = Math.max(0, Math.min(4, v.optionIdx));
      counts[step] += 1;
      total += 1;
      if (uid === myUid) mine = step;
      else marks.push({ uid, step });
    }
    if (!total) continue;
    const mean = counts.reduce((s, c, i) => s + c * i, 0) / total;
    const nearest = Math.round(mean);
    byQ.set(qid, {
      qid, round: roundOf(r), day: String(r.day || ""),
      prompt: String(q.prompt || ""), poles: [String(q.poles[0]), String(q.poles[1])],
      steps, counts, total, mean, score: Math.round((mean / 4) * 100),
      label: steps[nearest] || `step ${nearest + 1}`,
      marks, mine,
    });
  }
  return [...byQ.values()].sort((a, b) =>
    b.day.localeCompare(a.day) || (b.round ?? 0) - (a.round ?? 0));
}

/**
 * The room named you N of M votes: of every blind, snapshotted vote the
 * OTHERS cast on a role vote — all of them, not just the latest per role
 * — how many named you. Your own votes are not the room, so they are in
 * neither number.
 */
export function namedCount(
  reveals: readonly PortraitReveal[],
  uid: string | null,
  lookup: BankLookup | undefined,
): { mine: number; all: number } {
  let mine = 0, all = 0;
  if (!uid || !lookup) return { mine, all };
  for (const r of reveals) {
    const qid = r.qid || "";
    const q = qid ? lookup(qid) : null;
    if (!q || q.kind !== "pick" || !q.role) continue;
    for (const [voter, v] of counted(r)) {
      const who = typeof v.pickUid === "string" && v.pickUid ? v.pickUid : null;
      if (!who || voter === uid) continue;
      all += 1;
      if (who === uid) mine += 1;
    }
  }
  return { mine, all };
}
