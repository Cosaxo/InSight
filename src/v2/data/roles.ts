// YOUR ROLE, as a test result — one idea in two settings: WHAT THE PEOPLE
// AROUND YOU MAKE YOU (D437, the owner's 2026-09-09 design; D204 built the
// first shape, D386 rescored it, D434 put Standing beside it, and this
// replaces all three).
//
//  · In a 1v1, every fourth round is a CAST — *Most days, Liv is…* — four
//    plain sentences each carrying an axis: Trust (the one they tell
//    first), Spark (the one who gets them out the door), Judgement (the
//    one they ask what to do), Constancy (the one who is just always
//    there). Your four dims are the share of cast rounds in which THEY
//    said you are each of those. Three casts before a name — the owner's
//    "a bit more than two": one round of four answers is not a person.
//  · In a group, every role vote casts a role, and every role sits in a
//    SEAT — engine · hands · heart · wild. Your four dims are the share of
//    the votes you received per seat, read off the D224 snapshots (never
//    an index the roster remaps) and never counting a vote for yourself
//    — the instrument is what the people AROUND you make you. Two votes
//    before a seat.
//
// A share is not scored against luck: four answers at a quarter each IS
// the chance line, and the tables' baseline is 25 a dim (IS_TEST_AVG).
// How well you read each other — D204's insight and legibility, D386's
// projection and mirror days, the room's call — is not in the instrument
// any more: the cast says what you ARE to someone, a guess says how well
// you know them, and the second lives on the person page's Together tab
// (VISION-2026-09-09 §5.4). A rating round says nothing about anyone and
// folds elsewhere (`groupScores`).
//
// PURE, like the fold it replaces: no Firebase, no window, no LIVE. The
// caller hands in the reveal history it already fetched for the duel
// panel, and a bank lookup (the store's `bankQ`) that says what kind of
// round each reveal was and, for a role vote, which seat its role sits
// in. A reveal whose question the bank cannot name — a device that has
// not re-read the bank, or a question since retired — counts for nothing
// here rather than for something guessed.
//
// THE LEDGER ONCE IT CLEARS THE FLOOR, THE REVEALS UNTIL THEN (D445;
// ROLES-PLAN §3.3, ROUNDS-PLAN §7.2). The server keeps these same counts
// as each round reveals — `ledger.{uid}` on the group document, which
// every member already holds (functions/src/pure.ts, foldRoleLedger) —
// so the reading outlives the thirty reveals a device can page: under
// rounds a fortnight can hold hundreds of reveals, and the device cannot
// fold what it cannot fetch. Each fold below takes the room's ledger
// beside the history and reads the ledger's row for the member when it
// clears the instrument's floor; below the floor — and on a room from
// before the ledger existed, whose row starts at zero on its next reveal
// (the plan's own catch-up: forward-only, no backfill) — it reads the
// reveals it has, as before. The two substrates count by one set of
// rules, so a reading never changes on the day the ledger takes over;
// only how far back it reaches does.
import { castText } from "./deck";
import { type RevealDocLike } from "./duelRuns";
import { voteQid, type PortraitReveal } from "./groupPortrait";

/** Cast rounds below this and a 1v1 names nobody — the owner's floor. */
export const MIN_DUO = 3;
/** Votes received below this and a group seats nobody. */
export const MIN_GROUP = 2;

/** One member's row of the room's role ledger — what the server has
 * counted for them so far (functions/src/pure.ts, `RoleLedgerRow`). Every
 * field optional: a group row carries the votes half, a 1v1 row the casts
 * half, and a room from before D445 has no row at all. */
export interface LedgerRow {
  casts?: number;
  axes?: Partial<Record<string, number>>;
  saw?: { right?: number; total?: number };
  castQid?: string;
  votes?: number;
  seats?: Partial<Record<string, number>>;
}
export type Ledger = Record<string, LedgerRow>;

const num = (v: unknown): number =>
  (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** The ledger's row for a member, or null — a map that is not a map, a
 * uid with no row, and no uid at all read as "no ledger", never as zeros:
 * zeros would be a claim that the server counted and found nothing. */
export function ledgerRow(ledger: unknown, uid: string | null | undefined): LedgerRow | null {
  if (!uid || !ledger || typeof ledger !== "object" || Array.isArray(ledger)) return null;
  const row = (ledger as Record<string, unknown>)[uid];
  return row && typeof row === "object" && !Array.isArray(row) ? (row as LedgerRow) : null;
}

/** Whether the ledger alone draws this member's reading in this room —
 * what lets the Roles tab skip a room's history read (COSTS.md's row). */
export function ledgerClearsFloor(
  ledger: unknown,
  uid: string | null | undefined,
  mode: string | null | undefined,
): boolean {
  const L = ledgerRow(ledger, uid);
  if (!L) return false;
  return (mode || "group") === "duo" ? num(L.casts) >= MIN_DUO : num(L.votes) >= MIN_GROUP;
}

/** The four axes a cast round's answers sit on, in the bank's order —
 * `check:content` holds a cast entry's `dims` to exactly this. */
export const AXES = [
  { id: "trust", label: "Trust" },
  { id: "spark", label: "Spark" },
  { id: "judgement", label: "Judgement" },
  { id: "constancy", label: "Constancy" },
] as const;
export type AxisId = (typeof AXES)[number]["id"];

/** The four seats a role can sit in. In play a seat is its LINE — *the
 * one who gets things going* — never its label; the label is a result
 * card's (the owner's brief: titles are for result cards only). */
export const SEATS = [
  { id: "engine", label: "the Engine", line: "the one who gets things going" },
  { id: "hands", label: "the Hands", line: "the one who gets it done" },
  { id: "heart", label: "the Heart", line: "the one who holds the room together" },
  { id: "wild", label: "the Wildcard", line: "the one the story happens to" },
] as const;
export type SeatId = (typeof SEATS)[number]["id"];
export type Seat = (typeof SEATS)[number];
export const seatOf = (id: string | null | undefined): Seat | null =>
  SEATS.find((s) => s.id === id) || null;

/** What the fold asks the bank about a round's question: its kind (the
 * seeded `topic` — a group's pick/rate/us/classic, a 1v1's domain or
 * `cast`), a role vote's role and seat, a cast round's them forms. */
export interface BankEntryLike {
  prompt?: string | null;
  options?: readonly string[] | null;
  kind?: string | null;
  /** A role vote's scenario pack (D434) — the Groups stop's ink per row. */
  scen?: { id: string; label: string; hue: number } | null;
  role?: { id: string; label: string; seat?: string | null } | null;
  /** A rating's two poles (D434). */
  poles?: readonly string[] | null;
  them?: readonly string[] | null;
  dims?: readonly string[] | null;
}
export type BankLookup = (qid: string) => BankEntryLike | null | undefined;

/** A rating round (D434): the reveal's question is the bank's `rate` kind.
 * Exported so the Mirror's portrait and this fold read the same rule. */
export function isRatingReveal(r: { qid?: string | null }, lookup?: BankLookup): boolean {
  const q = lookup && r.qid ? lookup(r.qid) : null;
  return !!q && q.kind === "rate";
}
/** A cast round (D437): the reveal's question is the bank's `cast` kind. */
export function isCastReveal(r: { qid?: string | null }, lookup?: BankLookup): boolean {
  const q = lookup && r.qid ? lookup(r.qid) : null;
  return !!q && q.kind === "cast";
}

const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

export interface RoleDim {
  id: string;
  label: string;
  value: number;
  /** The plain count the share is made of — every dim carries its receipt. */
  note: string;
}
export interface RoleResult {
  /** What is behind this reading, in the unit the floor counts — cast
   * rounds for a 1v1, votes received for a group — and the weight a blend
   * gives it. */
  n: number;
  dims: RoleDim[];
}

// Oldest first by day, then by round — a room can reveal more than one
// round in a day (ROUNDS-PLAN, D426), and "the latest" has to mean time.
const byDay = <T extends { day?: string; round?: number }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) =>
    String(a.day || "").localeCompare(String(b.day || ""))
    || (typeof a.round === "number" ? a.round : 0) - (typeof b.round === "number" ? b.round : 0));

// ── 1v1: the cast ───────────────────────────────────────────────────────
export interface CastRound {
  day?: string;
  round?: number;
  qid: string;
  /** what I said they are — an option index into `options` */
  mine: number;
  /** what they said I am — an index into the same four, said of me in its them form */
  theirs: number;
  /** my guess at what they said I am, or null */
  myGuess: number | null;
  /** my guess landed */
  sawIt: boolean;
}
export interface CastRecord {
  /** cast rounds both of us answered blind */
  n: number;
  /** oldest first */
  rounds: CastRound[];
  /** what I said they are, counted per option index */
  mine: number[];
  /** what they said I am, counted per option index */
  theirs: number[];
  /** the answer they gave most often — the latest on a tie — or null */
  youAre: { idx: number; n: number } | null;
  /** the answer I gave most often, the same way */
  theyAre: { idx: number; n: number } | null;
  /** of the rounds I guessed, how many I guessed right */
  sawIt: { right: number; total: number };
  /** the bank's four answers and four them forms, off the latest cast */
  options: readonly string[];
  them: readonly string[];
}

/**
 * The pair's cast rounds, folded. A round counts only when both answered
 * the same cast question blind (a late answer was made with the table in
 * view — ROUNDS-PLAN §4) and the bank can say it was a cast. My guess is
 * at THEIR answer — what they said I am — so `sawIt` is the same hit the
 * run scores; it is a receipt here and a dim nowhere.
 */
export function castOf(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
  lookup?: BankLookup,
): CastRecord {
  const rounds: CastRound[] = [];
  let options: readonly string[] = [];
  let themForms: readonly string[] = [];
  if (me && them && lookup) {
    for (const rev of byDay(history)) {
      const rowQid = rev.qid || "";
      const q = rowQid ? lookup(rowQid) : null;
      if (!q || q.kind !== "cast") continue;
      const votes = rev.votes || {};
      const mine = votes[me], theirs = votes[them];
      if (!mine || !theirs || mine.late || theirs.late) continue;
      const qa = typeof mine.qid === "string" && mine.qid ? mine.qid : rowQid;
      const qb = typeof theirs.qid === "string" && theirs.qid ? theirs.qid : rowQid;
      if (qa !== rowQid || qb !== rowQid) continue; // a split round is not a cast of each other
      if (typeof mine.optionIdx !== "number" || typeof theirs.optionIdx !== "number") continue;
      const myGuess = typeof mine.guessIdx === "number" ? mine.guessIdx : null;
      rounds.push({
        day: rev.day, round: rev.round, qid: rowQid,
        mine: mine.optionIdx, theirs: theirs.optionIdx, myGuess,
        sawIt: myGuess != null && myGuess === theirs.optionIdx,
      });
      if (q.options && q.options.length) options = q.options;
      if (q.them && q.them.length) themForms = q.them;
    }
  }
  const size = Math.max(4, options.length);
  const tally = (key: "mine" | "theirs"): number[] => {
    const c = new Array<number>(size).fill(0);
    for (const r of rounds) if (r[key] >= 0 && r[key] < size) c[r[key]]++;
    return c;
  };
  const mine = tally("mine"), theirs = tally("theirs");
  // The most-named answer, the LATEST on a tie — the design's rule: a
  // person changes, and the newer word wins the older.
  const top = (c: number[], key: "mine" | "theirs"): { idx: number; n: number } | null => {
    if (!rounds.length) return null;
    const best = Math.max(...c);
    if (best <= 0) return null;
    const latest = [...rounds].reverse().find((r) => c[r[key]] === best);
    return latest ? { idx: latest[key], n: best } : null;
  };
  const guessed = rounds.filter((r) => r.myGuess != null);
  return {
    n: rounds.length, rounds, mine, theirs,
    youAre: top(theirs, "theirs"), theyAre: top(mine, "mine"),
    sawIt: { right: guessed.filter((r) => r.sawIt).length, total: guessed.length },
    options, them: themForms,
  };
}

/** How many cast rounds a pair has run — the thin row's "1 of 3". The
 * count the fold reads: the ledger's once it clears the floor, otherwise
 * the reveals in hand (see the header). */
export function duoCastCount(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
  lookup?: BankLookup,
  ledger?: unknown,
): number {
  const casts = num(ledgerRow(ledger, me)?.casts);
  return casts >= MIN_DUO ? casts : castOf(history, me, them, lookup).n;
}

export interface DuoRoleResult extends RoleResult {
  /** the receipts the panel prints under the average */
  sawIt: { right: number; total: number };
  youAre: { idx: number; n: number } | null;
  theyAre: { idx: number; n: number } | null;
}

/**
 * Your role in one 1v1: the share of cast rounds in which they said you
 * are each of the four things. `themName` is the other person's first
 * name, for the receipts — the bank's them forms carry `{name}`.
 */
export function duoRole(
  history: readonly RevealDocLike[],
  me: string,
  them: string,
  lookup?: BankLookup,
  themName?: string | null,
  romantic = false,
  ledger?: unknown,
): DuoRoleResult | null {
  const C = castOf(history, me, them, lookup);
  // The ledger's row once it clears the floor (the header): its counts
  // are keyed by axis id, and its them forms come off the bank by the cast
  // question it names — so a room this device has never paged still
  // draws its receipts in full. Below the floor, the reveals in hand.
  const L = ledgerRow(ledger, me);
  const fromLedger = !!L && num(L.casts) >= MIN_DUO;
  const n = fromLedger ? num(L?.casts) : C.n;
  if (n < MIN_DUO) return null;
  const named = fromLedger && L?.castQid && lookup ? lookup(L.castQid)?.them : null;
  const forms: readonly string[] = named && named.length ? named : C.them;
  // An axis is where the bank puts it: a cast entry's `dims` names the
  // axis of each answer, and the bank's order is AXES' order (held by
  // check:content), so index i is axis i either way — which is also why
  // the ledger's `axes[id]` and the window's `theirs[i]` are one count.
  const dims: RoleDim[] = AXES.map((ax, i) => {
    const count = fromLedger ? num(L?.axes?.[ax.id]) : (C.theirs[i] || 0);
    const said = forms[i] ? castText(forms[i], themName, romantic) : ax.label.toLowerCase();
    return {
      id: ax.id, label: ax.label, value: clamp((count / n) * 100),
      note: `they said you are ${said} in ${count} of ${n} rounds`,
    };
  });
  const sawIt = fromLedger ? { right: num(L?.saw?.right), total: num(L?.saw?.total) } : C.sawIt;
  // `youAre`/`theyAre` need the ORDER of the rounds (the latest wins a
  // tie), which a ledger of counts cannot give: they stay the window's.
  return { n, dims, sawIt, youAre: C.youAre, theyAre: C.theyAre };
}

// ── groups: the seats ───────────────────────────────────────────────────
export interface SeatTally {
  /** votes received per seat, off snapshots, self-votes out */
  shares: Record<SeatId, number>;
  /** votes received in all */
  total: number;
}

/**
 * Every vote a member received on a role vote, by the seat of the role it
 * was cast in — the fold `archetypeOf` runs in the owner's design, on the
 * reveals the app already holds. A vote counts only when its snapshot
 * names the member (D224), it was blind, and it was an answer to the
 * reveal's own question; a vote for yourself is not the room naming you.
 *
 * Who HOLDS a role is not read here: that is the card's rule (every blind
 * vote, self-votes included) and `groupCast.roleVotes` folds it, so the
 * Mirror's Votes lens and the reveal agree about who the mastermind is.
 * This fold is the reading underneath — the share of the votes that came
 * from other people.
 */
export function seatTally(
  reveals: readonly PortraitReveal[],
  uid: string | null,
  lookup?: BankLookup,
): SeatTally {
  const shares: Record<SeatId, number> = { engine: 0, hands: 0, heart: 0, wild: 0 };
  let total = 0;
  if (!uid || !lookup) return { shares, total };
  for (const r of reveals) {
    const rowQid = r.qid || "";
    const q = rowQid ? lookup(rowQid) : null;
    const seat = q && q.kind === "pick" && q.role ? seatOf(q.role.seat) : null;
    if (!q || !q.role || !seat) continue;
    for (const [voter, v] of Object.entries(r.votes || {})) {
      if (!v || v.late || typeof v.optionIdx !== "number") continue;
      if (voteQid(v, rowQid) !== rowQid) continue;
      const who = typeof v.pickUid === "string" && v.pickUid ? v.pickUid : null;
      if (!who || who === voter) continue; // no snapshot, or a vote for yourself
      if (who === uid) { shares[seat.id] += 1; total += 1; }
    }
  }
  return { shares, total };
}

/** The tally the fold reads: the ledger's row once it clears the floor,
 * the reveals in hand until then — see the header. A seat the ledger names
 * and this build does not know (none today) counts in `total` and in no
 * share, which is the same honesty an out-of-range option gets. */
function seatSource(
  reveals: readonly PortraitReveal[],
  uid: string | null,
  lookup?: BankLookup,
  ledger?: unknown,
): SeatTally {
  const L = ledgerRow(ledger, uid);
  if (L && num(L.votes) >= MIN_GROUP) {
    const shares: Record<SeatId, number> = { engine: 0, hands: 0, heart: 0, wild: 0 };
    for (const s of SEATS) shares[s.id] = num(L.seats?.[s.id]);
    return { shares, total: num(L.votes) };
  }
  return seatTally(reveals, uid, lookup);
}

/** How many votes a member has received — the thin row's "1 of 2". */
export function groupVoteCount(
  reveals: readonly PortraitReveal[],
  uid: string | null,
  lookup?: BankLookup,
  ledger?: unknown,
): number {
  return seatSource(reveals, uid, lookup, ledger).total;
}

export interface GroupRoleResult extends RoleResult {
  /** the seat with the most votes, first in SEATS' order on a tie */
  seat: Seat;
  shares: Record<SeatId, number>;
}

/**
 * Your seat in one group: the share of the votes you received per seat.
 * Ratings and the older kinds count for nothing here — a rating says
 * nothing about anyone, and an untagged pick casts no seat.
 */
export function groupRole(
  reveals: readonly PortraitReveal[],
  myUid: string | null,
  lookup?: BankLookup,
  ledger?: unknown,
): GroupRoleResult | null {
  const T = seatSource(reveals, myUid, lookup, ledger);
  if (myUid == null || T.total < MIN_GROUP) return null;
  const dims: RoleDim[] = SEATS.map((s) => ({
    id: s.id, label: s.label.replace(/^the /, ""),
    value: clamp((T.shares[s.id] / T.total) * 100),
    note: `${T.shares[s.id]} of ${T.total} votes in ${s.label.toLowerCase()} roles`,
  }));
  const seat = [...SEATS].sort((a, b) => T.shares[b.id] - T.shares[a.id])[0];
  return { n: T.total, dims, seat, shares: T.shares };
}

/** A member's seat in a group — the fold above run for somebody else,
 * with the same floor: null until two votes name them. */
export function seatFor(
  reveals: readonly PortraitReveal[],
  uid: string,
  lookup?: BankLookup,
  ledger?: unknown,
): { seat: Seat; n: number; shares: Record<SeatId, number> } | null {
  const T = seatSource(reveals, uid, lookup, ledger);
  if (T.total < MIN_GROUP) return null;
  const seat = [...SEATS].sort((a, b) => T.shares[b.id] - T.shares[a.id])[0];
  return { seat, n: T.total, shares: T.shares };
}

// ── the average across settings ─────────────────────────────────────────
/**
 * Blend several settings into one portrait, weighted by what is behind
 * each — casts for a 1v1, votes for a group. A three-cast 1v1 must not
 * swing the portrait as hard as a twelve-cast one. The blended dims carry
 * NO `note`: a receipt belongs to one setting, and "2 of 3" is false of an
 * average.
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
