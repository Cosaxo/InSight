// insight-functions/pure.ts — pure computational helpers.
//
// Everything in this module is deterministic given its inputs: no
// firebase imports, no I/O, no ambient randomness (byte sources and
// clocks come in as parameters). That's what makes these testable
// without an emulator — see pure.test.ts.

// ── invite codes (v2social) ─────────────────────────────────────

// Unambiguous invite alphabet (no 0/O/1/I/L).
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

// Map 8 caller-supplied random bytes onto the alphabet. The byte
// source is a parameter (randomBytes in production, a stub in tests)
// so the mapping itself stays pure.
export function inviteCodeFromBytes(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// ── handles (D122) ──────────────────────────────────────────────
//
// A handle is the app's first ADDRESS: the thing that lets one person
// name another. Until it existed the only way to reach a specific
// account was an invite code — a capability you had to type — which is
// why circles were joined rather than offered.
//
// The rules this shape has to satisfy, in order of how much they matter:
//
//   1. ONE canonical form. `@Olaf`, `olaf` and ` OLAF ` are the same
//      handle, or the uniqueness registry is not a registry. Casefold on
//      the way in, store the fold as the key, and keep the typed form
//      only as a display string.
//   2. NO CONFUSABLES. `rn` vs `m` and `l` vs `I` are the impersonation
//      surface every handle system grows. Latin letters, digits and one
//      separator is not a complete answer to that, but it removes the
//      whole non-ASCII half of it, which is where the industrial-grade
//      lookalikes live.
//   3. NOT A UID. Handles and uids must never be confusable by a reader
//      or by a call site, so the minimum length is above the point where
//      a handle could pass for something else, and the charset excludes
//      the separators Firestore paths use.
//
// Pure so both halves can share it: the client validates as you type
// (data/handles.ts re-exports the same rules) and the callable validates
// again, because a client check is a courtesy and the callable is the
// gate.

/** Longest a handle may be, typed or stored. */
export const HANDLE_MAX = 20;
/** Shortest. Three is enough to be a name and long enough not to be noise. */
export const HANDLE_MIN = 3;

// Lowercase ASCII letters, digits, underscore. No dot (Firestore path
// segments), no hyphen (visually close to en dash in a lot of fonts),
// nothing outside ASCII.
const HANDLE_RE = /^[a-z0-9_]+$/;

/**
 * The canonical key for a typed handle, or null if it is not one.
 *
 * Strips a leading `@` and surrounding space, lowercases, then validates.
 * Returning null rather than throwing is deliberate — every caller has a
 * different thing to say about a bad handle, and none of them wants a
 * try/catch to say it.
 */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().replace(/^@+/, "").toLowerCase();
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX) return null;
  if (!HANDLE_RE.test(h)) return null;
  // Leading digits are legal (a handle is not an identifier) but a handle
  // that is ONLY digits reads as an id and would collide with every
  // "search by number" affordance a future version grows.
  if (/^[0-9]+$/.test(h)) return null;
  // Reserved: words a handle must not be able to impersonate, because
  // each of them already means something in this app's copy or its URLs.
  if (RESERVED_HANDLES.has(h)) return null;
  return h;
}

/**
 * Names no account may hold.
 *
 * Two families: the app's own URL segments (a handle that is also a route
 * makes "prvfire33.web.app/join" ambiguous the day handles get links),
 * and the words the product uses to mean *the system rather than a
 * person* — an account called `insight` or `admin` is a phishing kit.
 */
export const RESERVED_HANDLES = new Set([
  "insight", "admin", "administrator", "root", "system", "support",
  "help", "about", "privacy", "terms", "join", "invite", "invites",
  "profile", "settings", "account", "me", "you", "everyone", "world",
  "team", "staff", "official", "mod", "moderator", "null", "undefined",
  "anonymous", "anon", "deleted",
]);

// ── day-key arithmetic (v2social) ───────────────────────────────

// THE ARGUMENT IS AN OFFSET IN DAYS, not a timestamp, and that distinction
// is why this comment exists. `functions/src` carried FOUR exports named
// `utcDayKey` in two incompatible families: this one and paid.ts's took an
// offset, logic.ts's and velocity.ts's took a millisecond timestamp. So
// `utcDayKey(0)` meant TODAY in one family and 1970-01-01 in the other,
// and `utcDayKey(Date.now())` meant a date about 46 million years out.
// Nothing imported across the families, so it never fired — it was a trap
// waiting for the first person to import the nearer one.
//
// The two timestamp-takers are `utcDayKeyOf` now, and paid.ts's copy is
// gone in favour of this one, which it was byte-identical to. One name,
// one meaning. functions/src/exports.test.ts refuses a second export of
// any name, so the shape cannot come back.
export function utcDayKey(offsetDays = 0, nowMs: number = Date.now()): string {
  const d = new Date(nowMs + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * The same grain, from a TIMESTAMP rather than an offset — `utcDayKeyOf(
 * Date.now())` is today. The name carries the difference because the
 * shared one did not: both families are `(number) => string`, so calling
 * either with the other's argument type-checks and silently returns a
 * date 46 million years out, or 1970.
 *
 * One implementation, here, because logic.ts and velocity.ts each had
 * their own — velocity's built the string field by field and this one
 * slices an ISO string, which agree on every value either was ever given.
 */
export function utcDayKeyOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A UTC day key `offsetDays` from `nowMs`, as `YYYY-MM-DD`.
 *
 * The nightly folds' signature — the clock first, the offset second — and
 * deliberately not `utcDayKey` above, which takes them the other way round
 * and defaults the clock. Both are correct and both are called; what was
 * wrong is that this one existed TWICE, byte-identical, in engagement.ts and
 * patterns.ts, two nightly functions whose day keys have to agree with each
 * other and with the documents the other one wrote.
 *
 * It floors to midnight before adding, where `utcDayKey` adds milliseconds
 * and slices the ISO string. In UTC the two agree — there is no offset to
 * shift under them — so this is a style difference, not a second answer.
 */
const pad = (n: number) => String(n).padStart(2, "0");
export function utcDay(nowMs: number, offsetDays: number): string {
  const d = new Date(nowMs);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function prevDayKey(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00Z");
  return new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
}

// ── the pending-day marker (v2social) ───────────────────────────
//
// `v2_groups/{gid}.pendingDays` is the set of day keys this group has at
// least one duel answer for and no reveal yet. onV2AnswerCreated adds to it
// (arrayUnion); the reveal scan removes a day once it has settled it, either
// by publishing the reveal or by deciding the day did not clear the bar.
//
// It exists so the scheduled scan can ask an INDEXED question — "which
// groups played yesterday?" — instead of reading every group document 12
// times a day to find the few that did. It also replaces the older
// `lastCheckedDay` skip-marker outright, and that is the bigger win: the
// marker needed a compensating delete from the answer trigger, whose
// correctness rested on a specific commit ordering between two writers.
// arrayUnion has no such ordering problem — a late answer re-adds the day
// whatever else is happening, so the day re-opens by construction rather
// than by argument.
//
// How many days to keep. firestore.rules refuses a duel answer for a day
// more than 4 days behind request.time, so a pending day older than that can
// never gain another answer and will never settle. 6 is that bound plus
// headroom for the UTC-vs-local skew the rules' forward window allows.
export const PENDING_DAYS_KEEP = 6;

// The next pendingDays array: `settledDay` dropped, anything older than
// `oldestKeptDay` dropped, duplicates and non-strings dropped. Day keys are
// ISO `YYYY-MM-DD`, so a lexicographic compare is a chronological one.
//
// Pure, and separately tested, because the failure it prevents is silent:
// an array that only ever grows turns a duo whose partner never plays into a
// group document that accretes one string per day forever.
export function prunePendingDays(
  current: unknown,
  settledDay: string,
  oldestKeptDay: string,
): string[] {
  if (!Array.isArray(current)) return [];
  const out: string[] = [];
  for (const d of current) {
    if (typeof d !== "string") continue;
    if (d === settledDay) continue;
    if (d < oldestKeptDay) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

// WHICH DAYS a run looks at, and this is the half that used to be wrong.
//
// The scan asked about exactly one day — `utcDayKey(-1)` — and the schedule
// never passed one, so a group-day was eligible for reveal during the single
// UTC day after it and never again. That is not the window the rest of the
// system works in: firestore.rules accepts a duel answer up to FOUR days
// late (deliberately, so a client flushing a queue after ~3 days offline
// still lands its vote), and onV2AnswerCreated re-adds the day to
// `pendingDays` whenever one arrives. So an answer syncing on D+2 re-opened
// day D, correctly, into a scan that would never ask about day D again.
// Nothing errored: both members had answered, the day sat pending forever,
// and the duo's streak stayed at whatever the earlier empty settle left it.
//
// The window is PENDING_DAYS_KEEP, because that is already the bound the
// pruning uses — a pending day older than that can never gain another answer
// and is dropped. Matching them means the scan asks about exactly the days
// that can still change, which is the definition `pendingDays` was given.
//
// Steady-state cost is five extra indexed queries per run that return
// nothing. An explicit `dayKey` still means that day alone: the operator
// lever and the e2e both pass one, and narrowing is what an operator
// reaching for it during an incident usually wants.
export function scanDays(dayKey?: string, nowMs: number = Date.now()): string[] {
  if (dayKey) return [dayKey];
  return Array.from({ length: PENDING_DAYS_KEEP }, (_, i) => utcDayKey(-(i + 1), nowMs));
}

// ── reveal conditions + streaks (v2social) ──────────────────────

// The two reveal conditions (decision D5):
//   group · at least one member answered
//   duo   · both-or-nothing — both members must have played
export function shouldReveal(mode: string, played: number): boolean {
  return mode === "duo" ? played >= 2 : played >= 1;
}

/**
 * May a reveal for `dayKey` move the group's PRESENT-TENSE state — its
 * streak and its `lastRevealDay`?
 *
 * Only if the day is newer than the last one revealed. `utcDayKey` is
 * `YYYY-MM-DD`, so a string compare is a date compare.
 *
 * WHY IT IS NEEDED. `scanDays()` walks the pending window NEWEST FIRST, and
 * `revealDuelsNowV2` defaults to `mode: "full"` over all six days — so a
 * run routinely reveals yesterday (streak +1, lastRevealDay = yesterday)
 * and then reaches a day-before-that that was still pending. Without this,
 * that older reveal wrote `lastRevealDay = day-2`, REGRESSING it, and
 * `nextStreak(yesterday, day-2, n)` returns 1 because yesterday is not the
 * day before day-2. A duo's streak went to 1 for having a gap FILLED IN.
 *
 * The next legitimate reveal then computed `nextStreak(day-2, day-1)` and
 * got 2, so the count recovered from 1 rather than resuming — the loss is
 * permanent in the only sense that matters to the user, who watched a
 * 40-day streak become 1.
 *
 * The operator's own recovery lever was the sharpest way to trigger it:
 * `revealDuelsNowV2` with no dayKey zeroed the current streak of any duo
 * younger than six days or with a settled gap.
 *
 * A backfilled day still PUBLISHES its reveal — the reveal doc is the
 * record of what was answered, and it is written either way. What it stops
 * doing is claiming to be the present.
 */
export function movesPresentState(
  lastRevealDay: string | null | undefined,
  dayKey: string,
): boolean {
  return typeof lastRevealDay !== "string" || !lastRevealDay || dayKey > lastRevealDay;
}

// A streak extends only when the previous reveal was for the day
// immediately before this one; any gap resets to 1.
export function nextStreak(
  lastRevealDay: string | null | undefined,
  dayKey: string,
  currentStreak: number,
): number {
  return lastRevealDay === prevDayKey(dayKey) ? currentStreak + 1 : 1;
}

// Who a day's reveal may be shown to.
//
// The reveal doc carries its own `members` array and firestore.rules gates
// the read on THAT, not on the group's current membership — which is what
// makes the guarantee retroactive in one direction: joining tomorrow does
// not hand you every past day, and leaving does not retract the days you
// played. The array was the membership AT REVEAL TIME, and that is a
// different thing from membership on the day being revealed.
//
// The gap it left is one scan wide, every day. Day D is revealed by the D+1
// scan, which runs `every 120 minutes` — so anyone who joined between
// 00:00 UTC and that scan was a current member when the snapshot was taken,
// went into `members`, and could read day D's votes and names for a day they
// were not in the group for. `revealGroupDay`'s own comment claimed to have
// closed this by preferring the page snapshot to a fresher read, but both
// reads happen on D+1, so it only ever closed the seconds between them.
//
// The bound is the END of the day being revealed, not its start: someone who
// joined midway through day D was there for it and may have played it.
//
// …and anyone who DID play the day is included whatever their join time
// says. firestore.rules accepts a duel answer up to four days late, so a
// member can legitimately land a vote for a day that precedes their join —
// an offline client flushing a queue, or a fresh group playing a recent day.
// Excluding them would publish a reveal containing their own vote that they
// alone cannot read, and "you see the days you played" is the invariant the
// e2e already asserts.
//
// KNOWN RESIDUAL, recorded rather than papered over: that clause is also an
// unlock. Join a group, backfill an answer for a day inside the four-day
// window, and the reveal admits you. It is strictly narrower than what this
// replaces — passive joining now reveals nothing, and the unlock costs a
// visible vote in the circle's own reveal — but it is not nothing. Closing
// it means bounding the write, not the read: firestore.rules would have to
// refuse a duel answer for a day preceding the member's join. That is a
// change to the densest rule in the file, whose failure mode is a vote that
// silently vanishes, and it would refuse the legitimate fresh-group case
// above. Left for a decision of its own (D55 §9).
//
// A uid with NO recorded join time is included, and that is not a fallback —
// it is the correct answer. The field is written by createGroupV2 and
// joinGroupV2 from the day this shipped, so its absence means the member
// joined before that, which is necessarily before any day this function will
// ever be asked about. Reading absence as "unknown, exclude" would blank
// every reveal for every group that existed on deploy day.
//
// Takes plain millis rather than Timestamps so this stays firebase-free like
// the rest of the module; the caller converts.
export function revealMembersFor(
  members: readonly string[],
  joinedAtMs: Record<string, unknown>,
  dayKey: string,
  playedUids: readonly string[] = [],
): string[] {
  const dayEnd = Date.parse(`${dayKey}T00:00:00Z`) + 86400000;
  // Server-generated (utcDayKey), so this is unreachable in the pipeline. It
  // degrades to the previous behaviour rather than to an empty array: a
  // reveal nobody can read is a worse failure than one scoped too widely,
  // and a malformed day key means the reveal is already wrong.
  if (!Number.isFinite(dayEnd)) return [...members];
  const played = new Set(playedUids);
  return members.filter((uid) => {
    if (played.has(uid)) return true;
    const at = Object.prototype.hasOwnProperty.call(joinedAtMs, uid)
      ? joinedAtMs[uid]
      : undefined;
    if (typeof at !== "number" || !Number.isFinite(at)) return true;
    return at < dayEnd;
  });
}

// ── the duel question-level signal (D40 part 3) ─────────────────
//
// Duel answers never reach the world aggregates — the trigger
// short-circuits them into the sealed reveal path, and that stays. This is
// the deliberately smaller aggregate written WHERE THE ANSWERS ARE ALREADY
// BEING READ: at reveal time, summed across ALL groups, k-floored like
// every published number. What it may never contain: gids, uids, names,
// member sets, per-group anything, or anything below the floor. The
// privacy arithmetic is D40's: every input is a vote the group's own
// members already see with names attached at reveal, so the cross-group,
// floored sum is strictly less revealing than the reveal itself.

export interface DuelVoteLike {
  optionIdx: number;
  guessIdx?: number;
}

export interface DuelAggState {
  plays: number; // group-days revealed
  total: number; // persons counted — the unit the k-floor applies to
  counts: Record<string, number>; // per-option, bank-option questions only
  guessTotal: number; // duo guesses cast (both partners may guess)
  guessMatches: number; // …of which called the partner's actual pick
}

/**
 * The question a group-day reveal is published under, given the qid each
 * member's answer carried.
 *
 * Members compute the day's question independently — `duelQFor` in
 * src/v2/data/deck.ts is a pure function of (gid, utcDay, bank), and the
 * BANK LENGTH is the modulus. So a promotion, or an `active:false` flip,
 * remaps the rotation for whoever refreshes their cached bank first, and
 * two members can legitimately answer different questions on the same day
 * with no hacked client involved. Rules cannot catch it: they check that
 * the qid exists in the bank, which both of them do.
 *
 * This used to be `qid = qid || s.get("qid")` — first counted answer wins,
 * which meant the group's published question depended on the order of
 * `memberUids`. Plurality instead: the question the most members actually
 * answered. Ties break on lexical qid order, so the result is a function
 * of the votes alone and a retried transaction cannot pick differently.
 *
 * Returns null only when no answer carried a usable qid.
 */
export function revealQid(qids: readonly unknown[]): string | null {
  const counts = new Map<string, number>();
  for (const q of qids) {
    if (typeof q !== "string" || !q) continue;
    counts.set(q, (counts.get(q) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  // Sorted, then strictly-greater: the lowest qid wins a tie, and the scan
  // order is the sort's rather than the Map's insertion order (which is the
  // member order this function exists to stop depending on).
  for (const [qid, n] of [...counts.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  )) {
    if (n > bestN) {
      best = qid;
      bestN = n;
    }
  }
  return best;
}

/**
 * The subset of a reveal's votes that may be folded into `qid`'s aggregate:
 * those actually cast on it.
 *
 * The reveal doc still carries every vote — dropping one there is the
 * "silently discarded" outcome revealGroupDay's transaction is built to
 * avoid, and a member who played deserves to appear in their group's
 * reveal whatever their client's bank said. But the cross-group aggregate
 * is a different artefact with a different guarantee: it is read as "how
 * this question went", so a vote cast on another question is not a
 * rounding error there, it is a wrong number under the wrong prompt.
 *
 * Order is preserved, because duelAggDelta pairs a duo's two votes
 * positionally to score guesses.
 */
export function votesMatchingQid<T>(
  entries: readonly { qid: unknown; vote: T }[],
  qid: string | null,
): T[] {
  if (!qid) return [];
  return entries.filter((e) => e.qid === qid).map((e) => e.vote);
}

/**
 * The reveal doc's `votes` map, with each vote stamped with its own qid when
 * that is not the question the day is published under.
 *
 * The stamp is what lets the reveal CARD render an answer under the prompt
 * its author was actually shown (D71). Without it the card had one qid for
 * the whole day and put every answer under it — a line with a member's name
 * on it, asserting something they never said.
 *
 * Absent means "the revealed question", so the common case writes exactly the
 * document it wrote before, and every reveal written before D71 reads
 * correctly with no migration.
 */
export function revealVotes<T extends object>(
  entries: readonly { uid: string; qid: unknown; vote: T }[],
  qid: string | null,
): Record<string, T | (T & { qid: string })> {
  const out: Record<string, T | (T & { qid: string })> = {};
  for (const e of entries) {
    out[e.uid] =
      typeof e.qid === "string" && e.qid && e.qid !== qid
        ? { ...e.vote, qid: e.qid }
        : e.vote;
  }
  return out;
}

/**
 * One reveal's contribution. `optionCount` is the question's bank-option
 * count — 0 for `pick` questions, whose optionIdx values index each
 * group's OWN member list and are meaningless summed across groups (the
 * D12 lesson: wrong-shaped data is worse than none), so a pick publishes
 * plays and total only. An out-of-range optionIdx (a pair that answered
 * across a pool flip, or bank drift) stays in `total` — it is a real
 * person's play — but folds into no count, so Σcounts ≤ total by design.
 * Guesses are scored only when the duo's BOTH answers are in range (the
 * pair coherently played this question) and the guess itself names a real
 * option; a guess compared against a different question's answer would be
 * noise wearing a number.
 *
 * CALLERS MUST PASS ONLY VOTES CAST ON THIS QUESTION. The range filter
 * above catches an out-of-range index, but a vote cast on a DIFFERENT
 * question whose index happens to be in range for this one is
 * indistinguishable here — it lands in a real bucket of a published,
 * k-floored aggregate. `revealQid` picks the question and
 * `votesMatchingQid` does the filtering; this function cannot.
 */
export function duelAggDelta(
  votes: readonly DuelVoteLike[],
  mode: string,
  optionCount: number,
): DuelAggState {
  const counts: Record<string, number> = {};
  const inRange = (i: unknown): i is number =>
    typeof i === "number" && Number.isInteger(i) && i >= 0 && i < optionCount;
  for (const v of votes) {
    if (inRange(v.optionIdx)) counts[String(v.optionIdx)] = (counts[String(v.optionIdx)] || 0) + 1;
  }
  let guessTotal = 0;
  let guessMatches = 0;
  if (mode === "duo" && votes.length === 2 && inRange(votes[0].optionIdx) && inRange(votes[1].optionIdx)) {
    for (let i = 0; i < 2; i++) {
      const guess = votes[i].guessIdx;
      if (!inRange(guess)) continue;
      guessTotal++;
      if (guess === votes[1 - i].optionIdx) guessMatches++;
    }
  }
  return { plays: 1, total: votes.length, counts, guessTotal, guessMatches };
}

/** Fold a delta onto the stored private state, tolerating an absent or
 *  malformed prior doc — the first reveal of a question creates it. */
export function foldDuelAgg(prev: unknown, delta: DuelAggState): DuelAggState {
  const p = (prev && typeof prev === "object" ? prev : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const counts: Record<string, number> = {};
  const pc = p.counts;
  if (pc && typeof pc === "object") {
    for (const [k, v] of Object.entries(pc as Record<string, unknown>)) counts[k] = num(v);
  }
  for (const [k, v] of Object.entries(delta.counts)) counts[k] = (counts[k] || 0) + v;
  return {
    plays: num(p.plays) + delta.plays,
    total: num(p.total) + delta.total,
    counts,
    guessTotal: num(p.guessTotal) + delta.guessTotal,
    guessMatches: num(p.guessMatches) + delta.guessMatches,
  };
}

/** The public mirror of a duel aggregate, written on every fold (D98 —
 *  there is no floor and no cadence). Guess fields publish only when a
 *  guess exists, counts only when any vote landed in range — absent keys,
 *  not zeroes, so a pick question's doc never grows fields that would
 *  invite reading meaning into them. */
export function publishableDuelAgg(state: DuelAggState): Record<string, unknown> {
  return {
    plays: state.plays,
    total: state.total,
    ...(Object.keys(state.counts).length ? { counts: state.counts } : {}),
    ...(state.guessTotal > 0
      ? { guessTotal: state.guessTotal, guessMatches: state.guessMatches }
      : {}),
  };
}

// ── per-anchor breakdowns (v2) ──────────────────────────────────
//
// "How did every kind of person split?" — the same question the world
// aggregate answers, asked one demographic slice at a time.
//
// Two hard constraints shape everything below.
//
// 1. DOCUMENT GROWTH. The counts live inside the existing
//    v2_question_aggs/{qid} document rather than new per-dimension docs, so
//    D7's ~1-write-per-second-per-document ceiling does not move. That only
//    holds if the document cannot grow without bound — so breakdowns are
//    restricted to low-cardinality anchors, and each dimension is capped at
//    BREAKDOWN_MAX_BUCKETS distinct values. `profession` is deliberately
//    excluded: it is free text up to 80 chars, so every distinct spelling
//    would mint a key forever.
//
//    `city` was excluded for that same reason until D9 replaced the profile's
//    free-text city and country boxes with a picker over a fixed catalogue of
//    ~11k places. Its values are now drawn from a closed vocabulary
//    ("Oslo, NO"), every one of them verified at build time to fit
//    BREAKDOWN_MAX_LABEL and to survive breakdownBucket — see
//    scripts/check-cities.mjs. The bucket cap still applies and matters more
//    here than anywhere else: a global question can touch far more than 24
//    cities, so the long tail degrades rather than the dimension freezing.
//
//    `country` was NEVER safe under the old scheme and shipped anyway — as
//    free text it split "Norway"/"norway"/"NO" into three sub-floor cohorts
//    and published none of them. It now carries the ISO code derived from
//    the picked city, which is why that dimension starts working at all.
//
// 2. NO SUPPRESSION OF ANY KIND (D98). This constraint used to read
//    "k-anonymity that survives subtraction", and it drove complementary
//    suppression: a lone hole plus a known total is recoverable by
//    subtraction, so the floor had to take a second bucket with it. None
//    of that runs now — every bucket publishes, at every size — because
//    the answers the buckets are folded from are themselves readable.
//    The paragraph stays as the record of what was removed and why it
//    existed, which is the thing a future reader will want if anyone ever
//    proposes putting it back.
//
//    WHAT THE FLOOR DOES NOT DO, stated here because the wording used to
//    imply otherwise. The unit the floor applies to is the BUCKET — the sum
//    of a bucket's per-option counts. It is not applied per option. So a
//    bucket published at exactly the floor can still carry a lopsided split:
//    { "Oslo, NO": { "0": 4, "1": 1 } } says in as many words that exactly
//    one of the five Oslo answers chose option 1.
//
//    That is k-anonymity behaving as specified rather than a hole in it. The
//    floor protects IDENTIFICATION — no cohort is small enough to name a
//    person — and does not protect ATTRIBUTE counts inside a cohort that
//    clears it. Recovering whose answer the "1" is still requires knowing the
//    other four, which is the same collusion bound D7 records for the publish
//    cadence.
//
//    It is also not separately fixable here, which is why it is recorded
//    rather than engineered around. The plain `counts` published alongside
//    have exactly the same property at the same floor (a question at total 5
//    splitting 4/1 discloses one person's option globally), so a per-option
//    floor would have to apply there too — and a per-option floor means a
//    4-option question needs ~20 answers per city before any of it renders,
//    with the surviving options no longer summing to the bucket total. That
//    trades the product's one job, showing the split, for a bound the floor
//    was never claiming. See D18 for the arithmetic.

// Anchors coarse enough to bucket. Order is the display order.
export const BREAKDOWN_DIMS = [
  "ageBand",
  "gender",
  "city",
  "country",
  "education",
  "relationship",
  "heightBand",
  // D328. NOT `profession`: the pick is a list of 31 and growing, which is
  // longer than the cap and therefore exhaustible. This is its derived
  // FIELD (20 values), the same pair `ageBand` makes with `age`.
  "jobField",
] as const;
export type BreakdownDim = (typeof BREAKDOWN_DIMS)[number];

// Per-dimension distinct-value cap. 8 dims x 24 buckets x up to 20 options is
// ~3.8k integers worst case — tens of KB against Firestore's 1 MiB limit,
// with room for the plain counts alongside. D328 added the eighth and did
// not move this number: the cap is what bounds the document, so a new dim
// costs one dimension's worth and nothing more.
export const BREAKDOWN_MAX_BUCKETS = 24;
// Bucket labels are stored as map keys; anything longer is a free-text field
// that slipped through and should not be minting keys.
export const BREAKDOWN_MAX_LABEL = 40;

// Dimensions whose values come from a closed vocabulary get their shape
// checked here as well as at the source.
//
// The bucket cap is a scarce resource, and anchors are written by the CLIENT
// onto its own answer doc where firestore.rules can only enforce a length —
// so whoever fills the slots first decides what the dimension can ever show.
// 24 nonsense values blank it for everybody, permanently: nothing evicts a
// bucket, and `by` is carried forward across every publish.
//
// Two different defences, because the dimensions are two different shapes.
//
// SIX OF THEM HAVE A CLOSED VOCABULARY, and it is SHORTER THAN THE CAP.
// ageBand/gender/education/relationship/heightBand/jobField come from
// <select>s of 7, 4, 15, 6, 6 and 20 values; checking membership means the
// dimension cannot be exhausted at all,
// because there are fewer legal buckets than slots. That is the real fix and
// it is available here and nowhere else — the rules layer cannot hold a
// vocabulary, and the client choosing from a list says nothing about what a
// script sends. `npm run check:anchors` holds these equal to the <select>
// lists in src/v2/spec/profile-general.jsx, the way check-cities.mjs holds
// the city catalogue to its own rules.
//
// This used to say a bogus value in these four "costs one suppressed
// sub-floor bucket, not the dimension". That was wrong in the same way the
// city note was right: 24 of them cost the dimension.
//
// CITY AND COUNTRY CANNOT BE CLOSED THAT WAY — ~11k places and ~249
// countries against 24 slots — so membership would still leave them
// exhaustible with real values. Their shapes stay, and the cap itself
// changed instead: see the eviction rule in foldAnchors.
const BREAKDOWN_DIM_SHAPE: Partial<Record<BreakdownDim, RegExp>> = {
  // "Oslo, NO" — a catalogue name and an ISO 3166-1 alpha-2 code. Must
  // agree with placeKey() in src/v2/data/places.ts.
  city: /^.+, [A-Z]{2}$/,
  // ISO 3166-1 alpha-2, derived client-side from the picked city.
  country: /^[A-Z]{2}$/,
};

// The closed vocabularies, verbatim from the profile's <select>s. Every value
// must survive breakdownBucket and fit BREAKDOWN_MAX_LABEL, and every list
// must be shorter than BREAKDOWN_MAX_BUCKETS — check:anchors asserts all
// three, and the last is the one that makes exhaustion impossible rather
// than merely harder.
//
// `Vocational / trade` is deliberately spelled "Vocational or trade" here
// AND in the profile: the slash is in breakdownBucket's rejected class, so
// the shipped option folded into no bucket at all from the day it was added.
// Nothing surfaced it — the answer wrote, the aggregate just never counted
// it — which is precisely the silence check:anchors now closes.
export const BREAKDOWN_DIM_VOCAB: Partial<Record<BreakdownDim, readonly string[]>> = {
  ageBand: ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
  gender: ["Woman", "Man", "Non-binary", "Prefer not to say"],
  education: [
    "Primary school", "Middle school", "High school", "Vocational or trade",
    "Some college", "Associate degree", "Bachelor's", "Postgraduate diploma",
    "Master's", "MBA", "Doctorate", "Postdoctoral",
    "Professional certification", "Self-taught", "Other",
  ],
  relationship: [
    "Single", "Dating", "Partnered", "Married", "It’s complicated",
    "Prefer not to say",
  ],
  // D140: banded like ageBand, coarse on purpose — the band IS what is
  // collected (the profile offers no centimetre field to fold from).
  heightBand: [
    "Under 160 cm", "160-169 cm", "170-179 cm", "180-189 cm",
    "190 cm or taller", "Prefer not to say",
  ],
  // D328: derived from the profession pick, never typed — JOB_FIELDS in
  // src/v2/spec/profile-vitals.js, held equal by check:anchors, which also
  // proves every JOB_OPTS entry maps into this list. Twenty against a cap
  // of 24: the headroom is deliberate, so the list can grow before the
  // unexhaustibility property has to be re-argued.
  jobField: [
    "Arts & culture", "Media & writing", "Science, education & research",
    "Software & IT", "Engineering & architecture", "Healthcare",
    "Business & finance", "Marketing & sales", "Law & government",
    "Public sector & nonprofit", "Trades, construction & manufacturing",
    "Agriculture & environment", "Transport & logistics",
    "Service & hospitality", "Self-employed", "Student", "Retired",
    "Homemaker", "Between jobs", "Other",
  ],
};

const VOCAB_SETS: Partial<Record<BreakdownDim, ReadonlySet<string>>> = Object.fromEntries(
  Object.entries(BREAKDOWN_DIM_VOCAB).map(([dim, vals]) => [dim, new Set(vals)]),
);

export type BreakdownCounts = Record<string, Record<string, Record<string, number>>>;

// A bucket label Firestore can hold as a map key, or null to skip. Rejects
// the empty string, over-long values, and the dotted/slashed forms that are
// awkward as field paths. With a dim, also rejects anything outside that
// dimension's vocabulary shape.
export function breakdownBucket(value: unknown, dim?: BreakdownDim): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > BREAKDOWN_MAX_LABEL) return null;
  if (/[./[\]*~]/.test(v)) return null;
  // A label already keyed on Object.prototype is not a bucket name — it is a
  // write into the prototype chain. The folds below do
  // `byDim[bucket] || (byDim[bucket] = {})`, and with bucket === "__proto__"
  // that assignment sets the PROTOTYPE rather than a property; the per-option
  // counter beneath it then increments a field every later object in the
  // process inherits. Measured, not reasoned: one answer carrying
  // `anchors: { gender: "__proto__" }` makes an unrelated question publish
  // `{"f":{"1":6}}` for five voters — counts nobody cast, on every question
  // that instance goes on to serve. "constructor" and "toString" are the same
  // shape one step weaker: they read back truthy and so also walk past the
  // BREAKDOWN_MAX_BUCKETS check.
  //
  // This is the only place it can be caught. firestore.rules can bound an
  // anchor's LENGTH and nothing else (the reason BREAKDOWN_DIM_SHAPE exists
  // above), and four of the six dimensions have no closed vocabulary to check
  // against — so a free anonymous account can put any 40-char string here.
  //
  // Membership in the prototype rather than a blocklist: a list of names the
  // language owns is a list this repo would have to maintain against it.
  if (v in ({} as Record<string, unknown>)) return null;
  const shape = dim && BREAKDOWN_DIM_SHAPE[dim];
  if (shape && !shape.test(v)) return null;
  const vocab = dim && VOCAB_SETS[dim];
  if (vocab && !vocab.has(v)) return null;
  return v;
}

// Make room for a new bucket in a dimension that is at its cap, or return
// false to refuse it.
//
// The cap has to hold — it is the document-growth bound D7's arithmetic
// rests on — but WHICH buckets hold the slots was first-come-first-served,
// and that is what made the dimension attackable: a bucket below the floor
// is suppressed from every publish, so it occupies a slot while showing
// nobody anything. 24 of those arriving early blanked `city` permanently,
// and no vocabulary can prevent it there because the catalogue is ~11k
// places against 24 slots — the attacker only needs real city names.
//
// So a sub-floor bucket is evictable and a publishable one is not. The
// smallest goes, and only if it is genuinely below the floor; once every
// slot holds a cohort large enough to publish, the cap refuses again and the
// long tail degrades exactly as it always did.
//
// What eviction costs, stated because it is a real loss and not a rounding
// one: the evicted bucket's partial count is discarded, so a value that
// re-appears restarts from zero and undercounts by up to `floor - 1`. That
// is bounded, it only ever applies to counts no reader has seen, and the
// alternative it replaces is a dimension that shows nothing at all for the
// life of the question.
//
// AMONG EQUALS IT IS FIRST-IN-FIRST-OUT, and that is not incidental — the
// scan keeps the first key at the minimum (`<`, not `<=`), and insertion
// order is Firestore's map order. So a dimension whose buckets all sit at one
// answer does churn, oldest out. That has to be true for this to work at all:
// the attack state IS 24 buckets of one answer each, and a rule that
// protected incumbents there would protect exactly the junk.
//
// What it costs is the long tail, which is where the cap was already
// documented to degrade. What it buys is that recurrence wins: a value that
// comes back grows past the churn and, at the floor, stops being evictable at
// all. Nothing published can be taken away.
// The eviction threshold — a bucket holding FEWER than this many answers
// may be dropped to make room for a new one; at or above it, nothing
// published is ever taken away.
//
// This used to be AGG_MIN_N, and reusing the k-floor here was a coincidence
// of numbers rather than a shared idea. D98 deleted the k-floor, and
// threading 0 or dropping the parameter would have made NOTHING evictable —
// silently restoring the cap-exhaustion attack this function exists to stop
// (24 junk `city` values permanently blanking the city dimension for a
// question), with every test still green.
//
// So it gets its own name and its own reason. This is a DOCUMENT-GROWTH
// bound: Firestore caps the map, the cap is a scarce resource, and churn
// among one-answer buckets is how a recurring real value beats a burst of
// junk. It has nothing to do with who may see what.
export const BUCKET_EVICT_BELOW = 5;

function evictForNewBucket(
  byDim: Record<string, Record<string, number>>,
): boolean {
  const keys = Object.keys(byDim);
  if (keys.length < BREAKDOWN_MAX_BUCKETS) return true;
  let victim: string | null = null;
  let victimTotal: number = BUCKET_EVICT_BELOW;
  for (const k of keys) {
    const n = bucketTotal(byDim[k]);
    if (n < victimTotal) {
      victim = k;
      victimTotal = n;
    }
  }
  if (victim === null) return false;
  delete byDim[victim];
  return true;
}

// Fold one answer's anchors into the running breakdown. Mutates and returns
// `into` so the trigger can keep this inside its existing transaction.
//
// Took a `floor` argument until D98, threaded through to the bucket
// eviction above. The eviction now names its own constant, and there is no
// other floor left in this path — every cell folded here is published.
export function foldAnchors(
  into: BreakdownCounts,
  anchors: unknown,
  optionIdx: number,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const byDim = into[dim] || (into[dim] = {});
    if (!byDim[bucket] && !evictForNewBucket(byDim)) continue;
    const cell = byDim[bucket] || (byDim[bucket] = {});
    const k = String(optionIdx);
    cell[k] = (cell[k] || 0) + 1;
  }
  return into;
}

// ── the edit delta (D86) ────────────────────────────────────────
//
// An answer edit is a -old/+new move with the total UNCHANGED — the person
// was already counted, they just hold a different option now. Two helpers
// rather than one because the two maps carry different guarantees and fail
// differently when the old vote is not where it should be.

// Move one vote between options in the exact counts. Returns false —
// WITHOUT touching the map — when the old option holds no votes, which has
// exactly one honest meaning: this edit's create event has not folded yet
// (Eventarc orders nothing between a doc's create and update deliveries).
// The caller throws on false so the platform's retry re-delivers the edit
// after the create lands. Applying blindly instead would clamp at zero and
// corrupt: -old/+new and +old commute ONLY while no step clamps.
export function retargetCounts(
  counts: Record<string, number>,
  fromIdx: number,
  toIdx: number,
): boolean {
  const from = String(fromIdx);
  if (!((counts[from] || 0) >= 1)) return false;
  counts[from] -= 1;
  // A zero count never occurs on the create path (keys are minted by
  // incrementing), so keep that invariant rather than shipping 0-rows.
  if (counts[from] === 0) delete counts[from];
  const to = String(toIdx);
  counts[to] = (counts[to] || 0) + 1;
  return true;
}

// Move one vote between options inside the breakdown, in exactly the cells
// the create-time fold used: the anchors SNAPSHOT is frozen on the answer
// doc (rules refuse changing it), so recomputing the bucket per dim lands
// on the same cell without any per-answer fold receipt existing anywhere.
//
// Bucket totals are invariant under this — the floor's quantity does not
// move, so nothing published can be un-earned by an edit.
//
// Where the old vote is NOT represented — bucket missing (create-time cap
// skip, or evicted since) or the cell's old-option count empty (the bucket
// was evicted and re-minted by other people's answers) — the dimension is
// SKIPPED entirely, increment included. Incrementing anyway would inflate
// the bucket total by an answer that is not in it, which breaks the one
// guarantee the fold keeps under cap churn. The skip means an edited vote
// can stay filed under its old option in a slice its create folded into:
// bounded to ±1 per cell, the same documented degradation the eviction cap
// already accepts, and self-correcting when the bucket next churns.
// (Unlike retargetCounts this is NOT a retry signal — absence here is a
// legitimate permanent state, and a throw would retry forever against it.)
export function retargetAnchors(
  into: BreakdownCounts,
  anchors: unknown,
  fromIdx: number,
  toIdx: number,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  const from = String(fromIdx);
  const to = String(toIdx);
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const cell = (into[dim] || {})[bucket];
    if (!cell || !((cell[from] || 0) >= 1)) continue;
    cell[from] -= 1;
    if (cell[from] === 0) delete cell[from];
    cell[to] = (cell[to] || 0) + 1;
  }
  return into;
}

// ── the edit-flow matrix (D226) ─────────────────────────────────
//
// Beside the -old/+new move, the edit itself is a published fact: a
// from → to count matrix on the same aggregate docs, so "what people first
// voted before they moved" is a number a report can print instead of a
// story nobody recorded (docs/PAID-PLAN.md §3 — this is its aggregate
// half; the per-voter mark stays deliberately unbuilt).
//
// It counts MOVES, not people: someone who edits twice appears twice,
// under two pairs, because moves are what the trigger actually sees —
// stitching them into per-person journeys would need the per-answer
// receipt the fold deliberately does not keep. A diagonal cell cannot
// occur (the trigger returns before folding when from == to), and unlike
// the counts beside it this map only ever grows: an edit is an event that
// happened, so there is no -old/+new to commute and no clamp to guard.
// Erasure posture is the counts' own — deleting an account does not
// unwind aggregates (index.ts phase 1b) — and the fake-ring correction
// path can reconstruct a uid's pairs from the ledger's per-event entries
// (`at`-stamped create idx, then each edit's toIdx) while they live.
export type EditFlow = Record<string, Record<string, number>>;

export function foldEditFlow(
  into: EditFlow,
  fromIdx: number,
  toIdx: number,
): EditFlow {
  const from = String(fromIdx);
  const row = into[from] || (into[from] = {});
  const to = String(toIdx);
  row[to] = (row[to] || 0) + 1;
  return into;
}

// A bucket's total across every option — the quantity the floor is applied
// to. Named for the bucket rather than the "cell" this used to say, because
// `cell` was doing duty for both this and the per-option numbers inside it,
// and the two have different guarantees (see constraint 2 above).
function bucketTotal(bucket: Record<string, number>): number {
  let n = 0;
  for (const k of Object.keys(bucket)) n += bucket[k];
  return n;
}

// Since D98 there is no publishable VIEW distinct from the fold: the
// breakdown the trigger accumulates is the breakdown it publishes, whole,
// on every answer.
//
// What stood here, and what each piece defended, so the reasoning is not
// simply lost:
//
//   publishableBreakdown  dropped every bucket under the k-floor, then
//                         applied COMPLEMENTARY SUPPRESSION — if exactly
//                         one bucket was hidden, the smallest survivor went
//                         too, because one hole plus a known total is a
//                         subtraction away from being no floor at all — and
//                         omitted a dimension left with fewer than two
//                         buckets, since one surviving bucket is a
//                         population statement rather than a split.
//   steppedBreakdown      re-emitted a bucket's PREVIOUS published value
//                         until it had grown by k, because the publish
//                         cadence was counted in answers to the question
//                         while the number on screen was a count per
//                         bucket — so one anchored answer in a window moved
//                         all six dimensions at once and disclosed a whole
//                         {ageBand, gender, city, country, education,
//                         relationship} tuple joined to one option.
//   publishBreakdown      composed the two in one place, because the trigger
//                         once stored one and published the other and a
//                         bucket suppressed at first publication then needed
//                         twice the floor to ever appear (caught by the e2e).
//   shouldPublishAgg      bounded how often the public document was
//                         rewritten, so a snapshot-watcher could not
//                         attribute a single step to a single person.
//
// Every one of those defends against reconstructing an individual's answer
// from an aggregate. D98 publishes the answers themselves, so all four
// defended a door standing next to an open wall — at the cost of a lagging,
// hole-punched breakdown that made the Mirror look broken.

// ─── catalog questions: key validation + the leaderboard fold ───────────
//
// docs/CATALOG-QUESTIONS.md. A catalog answer is one pick from a shipped
// catalogue of ~1,025 entities, stored as the entry's integer key (0 is the
// "Not listed" bucket). A favourite-of-a-thousand has no 52/48 to stage, so
// the reveal is a canon, not a split: the top N entities, and ONE
// "everyone else" bucket for the tail. Since D98 that cut is a DISPLAY
// size — a board of 1,025 rows is unreadable — and no longer a floor.

/**
 * How a domain's catalogue defines its key space. Contiguous catalogues
 * (pokedex) need only a ceiling; QID-keyed catalogues (films, artists —
 * D15) are sparse, so membership is the only honest test — a range would
 * admit every integer between two real QIDs, and each junk key an attacker
 * lands mints a bucket in the private doc forever (the document-growth
 * constraint the breakdown cap exists for).
 */
export type CatalogSpec =
  | { max: number }
  | { keys: ReadonlySet<number> };

/**
 * The stored form of a catalog answer's entity, or null to never
 * aggregate. 0 ("Not listed") is valid in every domain. Parameter-pure
 * like meetsKFloor: the specs live in v2.ts (CATALOG_DOMAINS), the
 * committed catalogues are cross-checked against them by
 * scripts/check-pokedex.mjs and scripts/check-catalogs.mjs.
 */
export function catalogEntityKey(value: unknown, spec: CatalogSpec): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0) return null;
  if (value !== 0) {
    if ("max" in spec) {
      if (value > spec.max) return null;
    } else if (!spec.keys.has(value)) {
      return null;
    }
  }
  return String(value);
}

export type CanonCounts = Record<string, number>;

/**
 * The publishable leaderboard: entities at or above the floor, capped at
 * topN, everything else folded into `rest`. Null means nothing finer than
 * the total may be published.
 *
 * Three rules beyond the plain floor, each with a reader in mind:
 *
 * - Key "0" ("Not listed") is counted but NEVER enumerated — the moment it
 *   would lead a board, the catalogue is stale, not newsworthy.
 * - Ties at the topN boundary fold entirely: publishing 2 of 4 entities
 *   that share the boundary count would rank equals arbitrarily, and the
 *   arbitrary half would look like a standing.
 * - Complementary suppression, tie-group flavoured: exactly one folded
 *   entity is recoverable as `total - published`, so the smallest published
 *   COUNT (the whole tie group at that count, to keep the no-split rule)
 *   folds with it. Conservative on purpose: a nonzero "Not listed" count
 *   inside `rest` would often mask the hole, but "often" is not a floor.
 */
// The published leaderboard: the `topN` biggest entities, with everything
// else summed into `rest`.
//
// This was `publishableCanon`, and it did three more things, all of which
// D98 deleted:
//   · dropped every entity below the k-floor;
//   · folded a boundary TIE GROUP whole, so equals were never ranked
//     arbitrarily by which side of the floor they fell;
//   · folded one extra row whenever exactly one entity had been hidden,
//     because a single hole is recoverable as `total - published`.
// Every one of those is a disclosure rule. With answers public, `rest`
// means what a reader always assumed it meant — the tail outside the top
// N — and an entity with one vote is as publishable as one with a
// thousand.
//
// It can no longer return null: there is nothing left that can suppress
// every row, so an empty board is just an empty catalogue question.
export function canonTopN(
  ent: CanonCounts,
  topN: number,
): { top: CanonCounts; rest: number } {
  let total = 0;
  for (const k of Object.keys(ent)) total += ent[k];
  const rows = Object.keys(ent)
    .filter((k) => k !== "0")
    .map((k) => ({ k, n: ent[k] }))
    .filter((r) => r.n > 0);
  // Count desc; key asc only so equal inputs give equal outputs — the
  // published map is unordered and the client re-sorts anyway.
  rows.sort((a, b) => b.n - a.n || Number(a.k) - Number(b.k));
  const kept = rows.slice(0, topN);
  const top: CanonCounts = {};
  let shown = 0;
  for (const r of kept) {
    top[r.k] = r.n;
    shown += r.n;
  }
  return { top, rest: total - shown };
}

// ─── rank answers: the order fold (D12 → D233) ──────────────────────────
//
// A ranking is an order, not an index. The published aggregate is one
// number per item — the SUM of the (0-based) positions every answerer
// gave it — plus the total, and that pair is enough to publish a crowd
// order (sort by mean position, ascending). A full permutation histogram
// stays unpublished for document-size and honesty-of-display reasons:
// n! cells is not a reveal, and D12's original disclosure argument for
// withholding it dissolved with the floors at D98.
//
// Element validation lives here rather than in rules because rules can
// bound a list but not iterate it (no forall) — the same trust boundary
// catalog keys cross. Null means "never aggregate this": wrong length,
// non-integers, out-of-range indexes and duplicates are all the same
// wrong shape, and a fold that guessed at repairs would be counting
// answers nobody gave.
export function validRankOrder(order: unknown, itemCount: number): number[] | null {
  if (!Array.isArray(order) || order.length !== itemCount || itemCount < 2) return null;
  const seen = new Set<number>();
  for (const v of order) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= itemCount) return null;
    if (seen.has(v)) return null;
    seen.add(v);
  }
  return order as number[];
}

/** Fold one validated order into the per-item position sums, in place. */
export function foldRankOrder(pos: number[], order: number[]): number[] {
  for (let p = 0; p < order.length; p++) pos[order[p]] += p;
  return pos;
}

// ─── catalog breakdowns: how each segment orders the canon (D17) ────────
//
// D14 deferred per-anchor breakdowns for catalog questions with the
// arithmetic, and named the one viable form: breakdowns for the published
// top-N only — 10 entities × 6 dims is the same cell count a vote
// question already handles. Demand appeared (2026-07-30), so this is that
// form: each segment shows how IT orders the global board, never a board
// of its own.
//
// Write side: the same fold as vote questions, transposed — cells hold
// per-ENTITY counts instead of per-option counts. Options are bounded at
// 20 by rules; entities are not, so without a per-cell cap one
// (dim, bucket) cell could hold the whole 1,025-entry catalogue and the
// document-growth constraint above collapses. Same cap semantics as the
// bucket cap: first come, known entities keep counting, the long tail
// degrades. A capped-out entity that later becomes popular undercounts in
// that cell — visible only if it also reaches the global top 10, and 32
// is far above the 10 the publish path can ever show.
export const CANON_BY_MAX_ENTITIES = 32;

export function foldCanonAnchors(
  into: BreakdownCounts,
  anchors: unknown,
  entityKey: string,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const byDim = into[dim] || (into[dim] = {});
    // Same bucket cap and the same eviction rule as foldAnchors — the
    // slots are just as attackable here, and for the same reason.
    if (!byDim[bucket] && !evictForNewBucket(byDim)) continue;
    const cell = byDim[bucket] || (byDim[bucket] = {});
    if (!cell[entityKey] && Object.keys(cell).length >= CANON_BY_MAX_ENTITIES) continue;
    cell[entityKey] = (cell[entityKey] || 0) + 1;
  }
  return into;
}

/**
 * The publishable form of a catalog breakdown: every cell restricted to
 * the entities the canon actually published — a segment ordering for an
 * entity absent from the board has nothing to order. Bounding the
 * document is now its only job (D98 removed the floors that used to
 * follow it).
 *
 * Two deliberate conservatisms, recorded in D17:
 * - the floor then applies to the SHOWN total (top-N answers in the
 *   bucket), not the bucket's true cohort — a bucket can be suppressed
 *   more than strictly necessary, never less;
 * - entities outside the global top-N do not exist here. A segment's own
 *   favourite that never made the global board is not published — the
 *   D14 arithmetic, not an oversight.
 */
export function canonBreakdownFor(
  entBy: BreakdownCounts,
  top: CanonCounts,
): BreakdownCounts {
  const out: BreakdownCounts = {};
  for (const dim of Object.keys(entBy)) {
    const buckets = entBy[dim] || {};
    const dimOut: Record<string, Record<string, number>> = {};
    for (const bucket of Object.keys(buckets)) {
      const cell = buckets[bucket];
      const kept: Record<string, number> = {};
      for (const k of Object.keys(cell)) {
        if (top[k] !== undefined) kept[k] = cell[k];
      }
      if (Object.keys(kept).length > 0) dimOut[bucket] = kept;
    }
    if (Object.keys(dimOut).length > 0) out[dim] = dimOut;
  }
  return out;
}

// ─── FCM token registration (registerPushToken, v2social.ts) ────────────
//
// Token writes used to be a direct client merge onto the profile doc.
// The threat that moved them behind a callable: fcmTokens is where the
// reveal sender fans out to, and the ruleset could only check the SHAPE
// of the array — so any signed-in script could plant a token it did not
// own on its own account and route reveal pushes to someone else's
// device. The callable runs behind App Check (the caller must be the
// real app, where the only token you can obtain is your own device's),
// and these two pure pieces keep the rest testable.
//
// Honest scope: this binds token→uid by attestation, not by cryptographic
// possession proof. If that is ever needed, the shape is a nonce sent TO
// the token that the device echoes back — a place this callable leaves
// room for.

// A plausible FCM registration token: an instance id, a colon, and an
// APA91… blob. Bounds chosen from observed tokens (~140–200 chars) with
// slack for format drift; the point is rejecting garbage and truncation,
// not modelling FCM's internals.
export function isPlausibleFcmToken(t: unknown): t is string {
  if (typeof t !== "string") return false;
  if (t.length < 100 || t.length > 400) return false;
  return /^[A-Za-z0-9_:%.-]+$/.test(t);
}

// The next fcmTokens array: `remove` dropped (a rotated predecessor),
// `add` appended if absent, oldest evicted past `cap`. Mirrors the
// arrayRemove+arrayUnion pair the client used to issue, in one
// deterministic step the server can transaction.
export function nextFcmTokens(
  current: unknown,
  add: string,
  remove: string | null,
  cap: number,
): string[] {
  const base = Array.isArray(current)
    ? current.filter((x): x is string => typeof x === "string" && x !== remove && x !== add)
    : [];
  base.push(add);
  return base.length > cap ? base.slice(base.length - cap) : base;
}

// ─── moderation: queue fold + verdict validation (docs/MODERATION.md) ───
//
// Both sides of the moderation run's confinement are pure and tested:
// the SERVER picks the targets (buildModQueueFrom — the run judges what
// the queue hands it, never chooses), and the verdict channel accepts
// exactly one shape (modVerdictError — anything else is rejected before
// it touches a document). The policy lines are H1–H5 in
// docs/MODERATION.md; a `remove` without a line, or a line on a
// non-remove, is invalid by construction so every removal is citable.

export const MOD_POLICY_LINES = ["H1", "H2", "H3", "H4", "H5"] as const;

/**
 * Tally one flag per takeId.
 *
 * A Map rather than an object literal, because the KEY IS CLIENT-CHOSEN: the
 * flag's `takeId` is the take's document id, and firestore.rules lets any
 * circle member pick that id when they create the take (the rules constrain
 * its fields, never its name). On a plain object, `counts[takeId] || 0` reads
 * back through the prototype for `constructor`, `toString`, `valueOf` and the
 * rest — so `counts["constructor"] = (counts["constructor"] || 0) + 1` yields
 * the string `"function Object() { [native code] }1111111111"`, every
 * comparison in buildModQueueFrom against it is NaN-false, and the take is
 * never queued however many people flag it. A take that cannot enter the
 * queue cannot be moderated at all: permanent immunity, chosen at post time,
 * with nothing logged.
 *
 * Firestore's own reserved-id rule (`__.*__`) is the only reason "__proto__"
 * is not also reachable here, which is not a guarantee this module should be
 * resting on.
 *
 * Pure, so the shape is pinned without an emulator — the emulator run that
 * found this had to create a take called `constructor` to see it.
 */
export function tallyFlags(takeIds: readonly unknown[]): Record<string, number> {
  return Object.fromEntries(tallyFlagsInto(new Map(), takeIds));
}

/**
 * The same tally, one page at a time.
 *
 * `v2_flags` has no upper bound, so the caller pages through it and folds
 * each page in rather than materialising the collection.
 *
 * The reason is NOT that nothing deletes flags. This said MOD_ADVISORY made
 * the keep-verdict sweep dead code — true when it was written, false since
 * D83, and never true of the settled-target sweep in the nightly build,
 * which has never consulted that flag. What is actually unbounded is what
 * never SETTLES: an escalated take's flags are kept as the evidence a human
 * will read, and a flagged take below the queue floor is never judged. Add
 * no TTL and the growing set of takes ever flagged, and the ceiling is
 * still absent — for a different reason than this paragraph gave.
 *
 * What is retained here is one entry per DISTINCT take, which is smaller
 * than the flag count by however many people flagged the same take, and is
 * the smallest thing the queue can be built from.
 */
export function tallyFlagsInto(
  counts: Map<string, number>,
  takeIds: readonly unknown[],
): Map<string, number> {
  for (const takeId of takeIds) {
    if (typeof takeId !== "string" || !takeId) continue;
    counts.set(takeId, (counts.get(takeId) || 0) + 1);
  }
  return counts;
}

/**
 * The earliest flag time per take, folded a page at a time beside the tally.
 *
 * Exists for the queue's TIE-BREAK, and the tie-break is a control rather
 * than a tidiness: at the flag floor most takes sit on exactly `minFlags`,
 * so whatever breaks that tie decides the whole queue below the busy head.
 * That used to be the take id ascending — and a take id is CLIENT-CHOSEN
 * (`qid + "_" + uid`, with qid a free 1-120 char string), so anyone could
 * mint `!`-prefixed ids and sort themselves to the front of every
 * generation for the price of three flags each.
 *
 * `at` is server-written (`request.resource.data.at == request.time` in the
 * flag create rule), so it is the one field on a flag the flagger cannot
 * choose. EARLIEST, not latest: oldest-waiting-first is FIFO, it drains a
 * backlog instead of starving it, and — the reason it is not the other
 * direction — an attacker with fresh accounts can always make a take
 * NEWLY flagged and can never make it older.
 *
 * Non-numeric and missing stamps are skipped rather than defaulted: a take
 * with no usable time sorts last among its tie (Infinity below) instead of
 * jumping the queue on a zero.
 */
export function tallyFirstFlagInto(
  firstAt: Map<string, number>,
  flags: readonly { takeId: unknown; at: unknown }[],
): Map<string, number> {
  for (const f of flags) {
    if (typeof f.takeId !== "string" || !f.takeId) continue;
    if (typeof f.at !== "number" || !Number.isFinite(f.at)) continue;
    const held = firstAt.get(f.takeId);
    if (held === undefined || f.at < held) firstAt.set(f.takeId, f.at);
  }
  return firstAt;
}

/**
 * Fold raw flag counts into the queue: takes at or above the flag
 * threshold, most-flagged first, capped at k.
 *
 * Ties break on the earliest flag (tallyFirstFlagInto, above) and then on
 * the id, so equal inputs still give equal queues. `firstAt` is optional
 * only so the pinned cases that predate it keep reading as they were
 * written; the live caller always passes it.
 *
 * WHAT k IS NOT: the queue size. Entries whose target has vanished or is
 * already hidden are dropped by the CALLER, which is the only side that can
 * see a take document — so cutting to the queue size here handed those
 * slots to nobody (moderation.ts sliced 25, then `continue`d past the dead
 * ones and queued fewer). k is the CANDIDATE window; the caller stops at
 * the real size once it has that many live entries.
 */
export function buildModQueueFrom(
  flagCounts: Record<string, number>,
  minFlags: number,
  k: number,
  firstAt?: ReadonlyMap<string, number>,
): { takeId: string; flags: number }[] {
  const at = (id: string): number => firstAt?.get(id) ?? Infinity;
  // Subtraction would be wrong here, not merely inelegant: two takes with
  // no usable stamp are both Infinity and `Infinity - Infinity` is NaN,
  // which is falsy, so the id tie-break would fire by accident rather than
  // by decision. Comparing gives a total order with no NaN in it.
  const byAge = (x: string, y: string): number => {
    const ax = at(x), ay = at(y);
    return ax === ay ? 0 : ax < ay ? -1 : 1;
  };
  return Object.keys(flagCounts)
    .map((takeId) => ({ takeId, flags: flagCounts[takeId] }))
    .filter((r) => r.flags >= minFlags)
    .sort((a, b) => b.flags - a.flags
      || byAge(a.takeId, b.takeId)
      || (a.takeId < b.takeId ? -1 : 1))
    .slice(0, k);
}

/**
 * The verdict log's document id: one entry per (take, QUEUE GENERATION).
 *
 * Keyed by takeId alone, the log doubled as a lock that never released —
 * the first verdict on a take made every later one impossible. That reads
 * as correct right up until you notice the queue is REBUILT WHOLESALE on
 * every run: in advisory mode nothing is hidden and no flags are cleared,
 * so the same take is back in tomorrow's queue, the run judges it again,
 * and the submission dies `already-exists`. The daily re-judgement is not
 * an edge case — it is the material the trust ladder is made of.
 *
 * `escalate` had it worst. It is the one verdict that deliberately KEEPS
 * the entry queued for a human, so "come back to this" was precisely the
 * decision that could never be come back to.
 *
 * The generation is the queue entry's own `queuedAt`, not a counter: an
 * entry is written exactly once per build, so its timestamp already names
 * the build that picked it — no second collection, no shared sequence.
 * The moderation run never names it either. It submits the same
 * `{ takeId, verdict, policyLine? }` as before and the SERVER reads the
 * generation off the server-picked queue entry, so confinement is
 * unchanged: the run can address the take in front of it, never a
 * generation of its choosing.
 *
 * Unknown generation falls back to the bare takeId, which is fail-SAFE
 * rather than fail-open — a verdict already in the log keeps blocking a
 * second one. The reverse default would let a queue entry with no usable
 * timestamp re-open a settled take.
 */
export function modVerdictId(takeId: string, gen: number): string {
  return Number.isFinite(gen) && gen > 0 ? `${takeId}__${gen}` : takeId;
}

/**
 * How many times a take has been escalated, carried across a queue
 * rebuild. Takes the PREVIOUS queue entry's fields; returns the count to
 * stamp on the new one.
 *
 * Escalation is the policy's safety valve — "uncertain → escalate", and
 * docs/MODERATION.md promises escalations reach a human in BOTH phases.
 * Nothing carried them. `submitModVerdict` marked the queue entry and
 * `runBuildModQueue` rebuilds that collection wholesale, so the mark lived
 * until the next daily build and then vanished; the verdict log kept the
 * row, but nothing reads the log yet (the digest is unbuilt), so the valve
 * had no outlet at all.
 *
 * It was worse than a 24-hour window in the phase the system is actually
 * in. Under MOD_ADVISORY the callable returns after writing
 * `advisoryVerdict`, so the `escalated` flag was never set — meaning the
 * `escalated` field `fetchModQueue` hands the run was permanently false
 * today. Both spellings are read here, so the signal means one thing in
 * both phases.
 *
 * A COUNT rather than a flag: a take the run keeps escalating is a
 * different signal from one it escalated once, and it is the signal the
 * digest wants. Monotonic across rebuilds, and the fresh generation is
 * left alone — an escalated take is still re-judgeable, deliberately. A
 * second escalation is information, not a duplicate.
 *
 * Known limit, stated rather than engineered around: the chain is
 * entry-to-entry, so a take that drops out of the top-MOD_QUEUE_SIZE and
 * later returns comes back at zero. The verdict log holds the real history
 * for the digest; this number is the run's cheap in-queue hint, not the
 * record.
 */
export function carriedEscalations(prior: {
  escalations?: unknown;
  escalated?: unknown;
  advisoryVerdict?: unknown;
} | null | undefined): number {
  if (!prior) return 0;
  const base =
    typeof prior.escalations === "number" &&
    Number.isInteger(prior.escalations) &&
    prior.escalations > 0
      ? prior.escalations
      : 0;
  const escalatedThisGeneration =
    prior.escalated === true || prior.advisoryVerdict === "escalate";
  return escalatedThisGeneration ? base + 1 : base;
}

/**
 * Why a submitted verdict is invalid, or null when it is well-formed.
 * Returns the reason as text so the callable can hand it back verbatim.
 */
export function modVerdictError(value: unknown): string | null {
  if (!value || typeof value !== "object") return "verdict must be an object";
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(",");
  if (keys !== "policyLine,takeId,verdict" && keys !== "takeId,verdict") {
    return "unexpected fields — takeId, verdict, and policyLine only";
  }
  if (typeof v.takeId !== "string" || !v.takeId || v.takeId.length > 128) {
    return "takeId must be a non-empty string";
  }
  if (v.verdict !== "remove" && v.verdict !== "keep" && v.verdict !== "escalate") {
    return "verdict must be remove, keep, or escalate";
  }
  if (v.verdict === "remove") {
    if (!MOD_POLICY_LINES.includes(v.policyLine as never)) {
      return "a removal must cite a policy line (H1–H5)";
    }
  } else if (v.policyLine != null) {
    return "only removals carry a policy line";
  }
  return null;
}

// ── seed diffing (v2 content seed) ──────────────────────────────
//
// The seed used to write all 369 question docs and bump `contentRev`
// on every run, unconditionally. Both halves were waste, and the second
// was expensive: `contentRev` keys the client's whole-bank cache
// (live.ts), so every bump made every returning device re-read the
// entire bank — 369 billable reads for content that had usually not
// moved at all. docs/COSTS.md carries the arithmetic.
//
// So the seed now asks this: does the stored doc already say what we are
// about to say? Only the fields the client actually consumes are
// compared. `active` is deliberately NOT among them — it is the
// operational kill switch, owned by whoever flipped it in the console,
// and the seed only ever writes it on create.
export const SEEDED_FIELDS = [
  "surface", "seq", "type", "domain", "prompt", "options", "topic", "axis", "test",
  // The continuum forms' range/plane copy (D114). Array-valued entries
  // (ends/ax/ay) ride the same element-wise compare options does; the
  // emit-when-set payloads leave them undefined off the feed dial/field
  // entries, and undefined-vs-missing compares equal below, so the other
  // ~493 docs stay untouched.
  "lo", "hi", "unit", "ends", "ax", "ay",
  // Crossroads' story (D136). `nodes` and `endings` are OBJECTS, which is
  // why the comparison below grew a structural arm — without one they
  // compare by reference, never match, and the seed rewrites both path docs
  // on every run while reporting them as changes.
  //
  // They belong here for the same reason `prompt` does: the tree is the
  // question. A fixed typo in a fork, or a reworded ending line, is a
  // content change that has to reach production, and a field the seed does
  // not compare is a field an edit can never move. (The ending NAMES are
  // the doc's `options`, already compared and already frozen by D52 — so
  // renaming one is refused rather than written, which is correct: every
  // stored walk is one of those names.)
  "title", "intro", "hue", "nodes", "endings",
  // The rest of what the payload writes (D234). Three of these were
  // always in the payload and never here (`mode`, `branch`, `sub`) — an
  // edit to a daily's subject path could not reach a stored doc, because
  // a field the compare ignores is a field the skip below freezes at
  // create. The other nine were in neither place: SCHEMA-V2.md promised
  // them on the doc and every client reader (isCore, the Scores tag/rates
  // pair, the feed's until/sponsor/also) read hydrated docs that could
  // not carry them — dark in production while every test seeded its own
  // fixtures green. `sponsor` and `rubric` are objects and ride the same
  // structural arm nodes/endings forced; `also`/array values ride the
  // element-wise compare. Adding compare fields makes the next reseed
  // rewrite exactly the docs whose stored form lacks them — the one-time
  // repair, not a phantom.
  "mode", "branch", "sub", "tag", "rates", "core", "until", "also",
  "sponsor", "tier", "resolvesAt", "rubric",
  // `from` (D231's window-open, the `until` twin) joined at the D231/D234
  // merge: it arrived in a parallel thread with exactly the D234 gap —
  // promised by the schema, read by the client's serving filter, written
  // by nothing — and the merge is where the two threads first saw each
  // other.
  "from",
  // The card's background (D281) and the learn card's own metadata
  // (D284). Both were live in the generator and in neither the payload
  // nor this list — D234's exact failure, twice more, and the second one
  // would have emptied Learn on every live device: the client drops a
  // card with no `c` rather than guessing an answer key, and no card
  // would ever have got one. Held here now by `check:seed-fields`, which
  // compares this list against what gen-v2content actually emits.
  "bg", "c", "t", "p", "k", "w",
] as const;

/**
 * Structural equality for a seeded field.
 *
 * Deliberately NOT `JSON.stringify(a) === JSON.stringify(b)`: Firestore does
 * not promise key order on read, and two objects that say the same thing in
 * a different order would compare unequal — which is the phantom-rewrite
 * failure this function exists to avoid, wearing a disguise.
 *
 * Strict about null vs undefined at the leaves for the reason
 * `seedDocMatches` records: a doc seeded before a field existed reads it
 * back as undefined, and treating that as equal to null would leave old
 * docs permanently un-upgraded.
 */
function seedValueMatches(a: unknown, b: unknown): boolean {
  if (Array.isArray(b)) {
    if (!Array.isArray(a) || a.length !== b.length) return false;
    return b.every((v, i) => seedValueMatches((a as unknown[])[i], v));
  }
  if (b && typeof b === "object") {
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    return bk.every((k) => k in ao && seedValueMatches(ao[k], bo[k]));
  }
  return (a ?? null) === (b ?? null);
}

/**
 * True when `existing` already carries every seeded field of `desired`.
 * `existing` is null/undefined for a doc that does not exist yet.
 *
 * Array-valued fields (`options`) compare element-wise; everything else
 * is a scalar or null. Deliberately strict about null vs undefined:
 * Firestore round-trips an explicit null as null, and a doc seeded
 * before a field existed reads it back as undefined — treating those as
 * equal would leave old docs permanently un-upgraded.
 */
export function seedDocMatches(
  existing: Record<string, unknown> | null | undefined,
  desired: Record<string, unknown>,
): boolean {
  if (!existing) return false;
  for (const f of SEEDED_FIELDS) {
    if (!seedValueMatches(existing[f], desired[f])) return false;
  }
  return true;
}

// ── the one seeded field that may never be edited (D52) ─────────
//
// Answers store `(qid, optionIdx)` and nothing else — that is what makes
// them cheap, and it is why D52 records "shipped option sets are never
// edited" as an invariant rather than a preference. Swap two options on a
// live question and every historical vote silently changes meaning: the
// counts do not move, the aggregates do not recompute, and nothing anywhere
// reports that the answer to "which do you prefer?" now says the opposite.
// It is the D30 re-key class, applied retroactively to data already
// collected.
//
// Until now that invariant was enforced by a human reading the diff. The
// seed itself would take an edited `options` array straight through
// `seedDocMatches` (which returns false on ANY changed field, including this
// one) and `batch.set(…, { merge: true })` it over the live doc. A content
// review that got it right every time so far is a record, not a mechanism.
//
// Deliberately narrow. `prompt` edits ARE allowed — D52's own fix list is
// mostly prompt rewrites that preserve a question's meaning, and a prompt
// carries no index that an answer refers to. Only `options` re-keys stored
// data. Length changes count: appending an option changes no existing
// index, but it changes what a question means to everyone who already
// answered it without that choice, and D52's appends are to BANKS (new
// questions), never to a shipped question's option list.
export interface SeedOptionConflict {
  qid: string;
  /**
   * Which frozen field changed. Absent means `options`, which is what every
   * conflict was until catalogue questions turned out to have none — see
   * the `domain` and `type` arms below.
   */
  field?: "options" | "domain" | "type";
  stored: string[];
  desired: string[];
}

/**
 * The option-set edit `desired` would make to an already-stored question,
 * or null when there is none. `stored` is undefined for a doc that does not
 * exist yet — a create is never a conflict, only a rewrite is.
 *
 * Non-array or absent stored options are treated as "nothing to protect":
 * a question seeded before the field existed has no votes keyed to an
 * index it never had.
 */
export function seedOptionConflict(
  qid: string,
  stored: Record<string, unknown> | null | undefined,
  desired: Record<string, unknown>,
): SeedOptionConflict | null {
  if (!stored) return null;
  const a = stored.options;
  const b = desired.options;
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  if (!same) return { qid, field: "options", stored: a.map(String), desired: b.map(String) };

  // …AND THE CATALOGUE DOMAIN, because for the one surface whose answers
  // are catalogue keys the options check above can never fire.
  //
  // A catalog question ships `options: []` on both sides by construction,
  // so `same` is true and the freeze returned null — for exactly the
  // questions whose stored answers are keys rather than indices. `domain`
  // IS seeded (it is in SEEDED_FIELDS), so a re-domained pick card passed
  // the freeze and every stored `entity` silently re-keyed against a
  // different catalogue. The small key spaces overlap — pokemon 1–1025,
  // elements 1–118, dogs 1–554 — so "35" that meant Clefairy comes back as
  // Bromine, in the trigger's validation and in the client's name
  // resolution alike. That is precisely the failure D52's mechanism exists
  // to prevent, one field over.
  //
  // Absent, null and "" are one value here: a question that never carried
  // a domain and still does not has nothing to protect, and refusing that
  // would wedge the seed for every non-catalogue question in the bank.
  const dStored = typeof stored.domain === "string" ? stored.domain : "";
  const dDesired = typeof desired.domain === "string" ? desired.domain : "";
  if (dStored !== dDesired) {
    return { qid, field: "domain", stored: [dStored || "(none)"], desired: [dDesired || "(none)"] };
  }

  // …AND THE TYPE, which is the outermost of the three: it decides what a
  // stored answer even IS. `optionIdx` for vote/binary/choice, an order
  // string for rank, `entity` for catalog, a bucket for dial. Change it on
  // a question people have answered and every stored answer is re-read
  // under the new rule — a catalogue key becomes an option index, a rank's
  // order becomes nonsense, and the published aggregate is folded from
  // then on as though it had always been the new form.
  //
  // Nothing else catches it. `options` is equal on both sides for a
  // vote→catalog change (a catalog question ships `options: []`, so does
  // an emptied vote), and `domain` is equal whenever neither side is a
  // catalogue. It reaches the rules too: `isCatalogAnswer` gates on
  // `type == "catalog"`, so a retyped question changes which answer shapes
  // production accepts, silently and immediately.
  //
  // Same argument as `domain` one field over, and the same measurement
  // behind it: across all 33 commits that have ever touched the feed bank,
  // no existing question's type has changed once. This refuses something
  // that has never legitimately happened, which is what a freeze is for.
  const tStored = typeof stored.type === "string" ? stored.type : "";
  const tDesired = typeof desired.type === "string" ? desired.type : "";
  if (tStored !== tDesired) {
    return { qid, field: "type", stored: [tStored || "(none)"], desired: [tDesired || "(none)"] };
  }
  return null;
}

/** One line per conflict, for the log and the operator's error. */
export function describeSeedOptionConflicts(
  conflicts: readonly SeedOptionConflict[],
): string {
  return conflicts
    // The field is named only when it is NOT options, so the line an
    // operator has read a hundred times is unchanged and the new one says
    // which freeze it tripped.
    .map((c) => {
      const where = c.field && c.field !== "options" ? ` (${c.field})` : "";
      return `${c.qid}${where}: [${c.stored.join(" | ")}] -> [${c.desired.join(" | ")}]`;
    })
    .join("; ");
}

// ── presence cells (D84 — Near by radius) ───────────────────────────
//
// The server half of the ~200 m presence grid. The CLIENT computes a cell
// from a fix and discards the coordinate (src/v2/data/geo.ts); what
// arrives here is only the cell id, and these two functions are the whole
// vocabulary the server has for it: is it a legal cell, and which nine
// cells make up "around you". The grid contract (0.002° since D175, "la_lo"
// ids) is
// pinned to the same vectors on both sides by the two test suites — the
// floor.ts drift pattern, because a client and server disagreeing about
// cell shape fails soft (empty counts) and would read as "nobody nearby".

// 0.002° since D175 — see src/v2/data/geo.ts for why the grid could not
// move before the location permission did.
const PRESENCE_CELL_DEG = 0.002;
const PRESENCE_LAT_MIN = Math.floor(-90 / PRESENCE_CELL_DEG);   // -45000
const PRESENCE_LAT_MAX = Math.ceil(90 / PRESENCE_CELL_DEG) - 1; //  44999
const PRESENCE_LON_MIN = Math.floor(-180 / PRESENCE_CELL_DEG);  // -90000
const PRESENCE_LON_SPAN = 180000;

export function presenceCellOk(cell: unknown): boolean {
  if (typeof cell !== "string" || !/^-?\d{1,5}_-?\d{1,5}$/.test(cell)) return false;
  const [la, lo] = cell.split("_").map(Number);
  return la >= PRESENCE_LAT_MIN && la <= PRESENCE_LAT_MAX
    && lo >= PRESENCE_LON_MIN && lo < PRESENCE_LON_MIN + PRESENCE_LON_SPAN;
}

/**
 * The 3×3 neighborhood around a cell — the query set for "around you".
 * Longitude wraps at the antimeridian; latitude rows beyond the poles are
 * dropped rather than wrapped (there is nothing on the far side of a pole
 * but the same hemisphere again, and a presence count is not worth the
 * cleverness).
 */
export function presenceNeighbors(cell: string): string[] {
  if (!presenceCellOk(cell)) return [];
  const [la, lo] = cell.split("_").map(Number);
  const out: string[] = [];
  for (let dLa = -1; dLa <= 1; dLa++) {
    const nla = la + dLa;
    if (nla < PRESENCE_LAT_MIN || nla > PRESENCE_LAT_MAX) continue;
    for (let dLo = -1; dLo <= 1; dLo++) {
      let nlo = lo + dLo;
      if (nlo < PRESENCE_LON_MIN) nlo += PRESENCE_LON_SPAN;
      if (nlo >= PRESENCE_LON_MIN + PRESENCE_LON_SPAN) nlo -= PRESENCE_LON_SPAN;
      out.push(`${nla}_${nlo}`);
    }
  }
  return out;
}

/**
 * How long a position outlives the beat that wrote it — the LINGER.
 *
 * It is not a freshness tolerance, it is the feature. Everyone's phone is
 * in their pocket, so presence that existed only while the app was open
 * would show an empty room at a full party: you would open Near, and
 * everyone else's app would be shut. Find My and Snap Map keep a
 * last-known position for the same reason.
 *
 * Three hours is long enough that a venue stays populated between
 * pocket-checks and short enough that closing the app in bed does not
 * leave you at home all night. It is one number and is meant to be
 * re-tuned from real use rather than defended.
 *
 * THE STALENESS IS SHOWN, NOT HIDDEN, and that is a safety property
 * rather than an apology: a blurred WHEN protects as well as a blurred
 * WHERE. The smear that keeps a party populated is the same smear that
 * makes a trail unreadable.
 *
 * This is the CEILING the rules enforce on a client's `until`. What each
 * doc actually claims is its own `until` field, which is what the count
 * filters on — see nearbyCountV2.
 */
export const PRESENCE_LINGER_MIN = 180;

/**
 * The "visible for a while" option's length (D174's middle state).
 *
 * Shorter than the linger on purpose: the session is a promise about
 * WHEN YOU STOP BEING VISIBLE, and `until` is what makes it exact. A
 * client in session mode clamps every `until` it writes to the session's
 * deadline, so closing the app ten minutes before the deadline cannot
 * leave the position standing for a further linger.
 */
export const PRESENCE_SESSION_MIN = 120;

/**
 * Typed phones a neighbourhood needs before the room's mix is drawn at all
 * (D176). Below it the callable returns `null` and the client says nothing.
 *
 * The FLOOR IS NOT THE WHOLE DEFENCE and would be weak alone. A composition
 * that moves as people arrive tells you an individual's type by
 * subtraction, and no floor this side of a stadium stops that on its own.
 * Three things do it together:
 *
 *   1. this floor, so a room of three has no reading;
 *   2. RANKED WORDS, not shares — `roomMix` returns names in order and no
 *      percentages, so learning one person's type needs a rank to FLIP,
 *      which one arrival rarely does;
 *   3. no on-demand refresh — the reading rides the four-minute beat, so
 *      an observer's sampling rate is the app's, not theirs.
 *
 * Matched to `data/typeMix.ts`'s TYPE_THIN, which is the same judgement
 * about the same instrument one layer up: below eight, a type count is
 * listed rather than ranked. Eight is a judgement, not arithmetic — it is
 * a real gathering and one person is an eighth of it.
 */
export const ROOM_MIN_TYPED = 8;

/**
 * How many presence docs one fold may read, across the whole 3x3.
 *
 * A ranking of three names does not get more true past sixty samples, and
 * roomMixFor's note records the probe showing the sixty are drawn evenly
 * across the neighbourhood rather than out of one corner of it.
 *
 * What the cap DOES cost is the basis: past sixty, `n` is a floor on the
 * typed crowd rather than its size, which is why `capped` exists below.
 */
export const ROOM_SAMPLE_CAP = 60;

/**
 * How many presence docs one fold may SCAN before it samples.
 *
 * THE BUG THIS EXISTS FOR is the one roomMixFor's own note warned about
 * and then walked into: "Firestore orders a query with no explicit
 * `orderBy` by document id… Key presence by something ordered (a cell
 * prefix, a timestamp) and this stops being true silently." The query
 * carries `where("until", ">", now)`, and an inequality IS an ordering —
 * Firestore sorts by that field first — so the limit took the N
 * SOONEST-EXPIRING presences, not a sample. Probed on the emulator (360
 * docs over nine cells, `until` spread 5–179 minutes out): the sixty
 * returned were exactly the sixty smallest, topping out at 33 minutes
 * against a population reaching 179. At a festival — the case this
 * feature exists for — that is a reading of the people about to leave,
 * presented as the room.
 *
 * So the fold scans wider and samples from what it scanned. Five times
 * the mix's sample and twelve times the roster's, which moves the point
 * where the bias returns from 60 and 24 to 300, and costs presence reads
 * only: these documents are one per person, and the roster's expensive
 * half — every sampled person's answers — still folds over
 * ROOM_PEOPLE_CAP people.
 *
 * IT DOES NOT ABOLISH THE BIAS, and the no-silent-caps rule means saying
 * so: above 300 present phones in one 3x3 block the scan is still the
 * soonest-expiring 300, and the sample is drawn from those. What the
 * reading already declares is `capped`, which stays exactly as true.
 */
export const ROOM_SCAN_CAP = 300;

/**
 * A deterministic uniform sample of `n` from `items`.
 *
 * Seeded rather than `Math.random()` so a fold is testable and so two
 * calls inside one beat window agree — the cached document is what a
 * second caller reads, but a cache miss that races must not produce a
 * visibly different room.
 *
 * Partial Fisher-Yates: only the first `n` positions have to be settled,
 * so this is O(n) rather than O(items). Returns a copy, never the input.
 */
export function sampleN<T>(items: readonly T[], n: number, seed: string): T[] {
  if (n <= 0 || !items.length) return [];
  if (items.length <= n) return items.slice();
  // FNV-1a over the seed, then xorshift32. Neither is cryptographic and
  // neither needs to be: nobody bets on this, and the property wanted is
  // "uncorrelated with expiry time", which any decent mixer gives.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 1;
  const rnd = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
  const out = items.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rnd() * (out.length - i));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out.slice(0, n);
}

export interface RoomMix {
  /** Type names, most common first, at most three. No shares, ever. */
  top: string[];
  /** Typed phones behind it — the mix's OWN basis, not the headline count. */
  n: number;
  /**
   * The sample hit ROOM_SAMPLE_CAP, so `n` is a FLOOR on the typed crowd
   * rather than its size — read it as "60+", and say so on screen.
   *
   * The same rule D102 applied to the who-voted sheet, which says "the
   * latest 200 of N" when its cap binds: a truncation presented as the
   * room is the honesty failure, not the truncation. Absent below the cap,
   * where `n` is exact.
   */
  capped?: true;
}

/**
 * The room's composition, from the types the phones nearby wrote for
 * themselves.
 *
 * Ranked NAMES and a basis, and deliberately nothing else. A share would
 * be the whole differencing attack handed over — "62% Hosts" moves
 * visibly when one person walks in, where "mostly Hosts and Explorers"
 * does not until a rank changes.
 *
 * `n` is the count of phones that CARRIED a type, which is not the
 * headline count of phones nearby: plenty of people have not taken the
 * test. Returning the smaller number beside the reading is what stops the
 * mix borrowing authority from a population it did not measure.
 */
export function roomMix(
  types: readonly (string | undefined | null)[],
  floor: number = ROOM_MIN_TYPED,
  cap: number = ROOM_SAMPLE_CAP,
): RoomMix | null {
  const tally = new Map<string, number>();
  for (const t of types) {
    if (typeof t !== "string") continue;
    const name = t.trim();
    if (!name) continue;
    tally.set(name, (tally.get(name) || 0) + 1);
  }
  let n = 0;
  for (const c of tally.values()) n += c;
  if (n < floor) return null;
  const top = [...tally.entries()]
    // Count first, then name — a stable order matters more than it looks:
    // two types tied at the same count must not swap between beats, or the
    // reading flickers and every flicker is a signal an observer can read.
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name]) => name);
  // Counted on the SAMPLE, not on `n`: the cap bounds how many documents
  // were read, and untyped ones are read too. Sixty presence docs of which
  // nine carried a type is a capped sample with n=9 — the ranking is drawn
  // from a slice either way, so it is the slice that has to be declared.
  return types.length >= cap ? { top, n, capped: true } : { top, n };
}

// ── the room, read (D177) ───────────────────────────────────────────
//
// D176 gave Near a composition; this gives it a POPULATION you can read
// the way every other Mirror stop is read — who is here, how they
// answered, where you part company with them. The difference from City or
// World is that the cohort is not a published aggregate: it is a set of
// phones, and `v2_presence` is unreadable, so the fold can only happen
// server-side and every number below crosses a wire the client cannot
// recompute.

/**
 * How many present people one room reading is drawn from.
 *
 * ONE sample serves both the roster and the answer fold, deliberately.
 * Two caps would mean People showed a set of people and Compare described
 * a different one, and "you against this room" is only true if the two
 * words mean the same crowd.
 *
 * Smaller than ROOM_SAMPLE_CAP because the reads are not comparable: the
 * mix reads one presence doc per person (a ranking wants samples and they
 * are cheap), while this reads every sampled person's ANSWER to every
 * question in view. 24 is a room you could look around, and it bounds the
 * fold at 24 x ROOM_QUESTION_CAP documents.
 */
export const ROOM_PEOPLE_CAP = 24;

/**
 * How many questions one call may ask the room about.
 *
 * The client sends the day's deck, which is the same list for everybody
 * (computeDeckIds is a pure function of the day), so the per-cell cache
 * is shared rather than per-viewer. The cap is what stops a modified
 * client asking for five hundred.
 */
export const ROOM_QUESTION_CAP = 8;

/**
 * How many questions ONE CELL'S WINDOW may accumulate.
 *
 * `ROOM_QUESTION_CAP` bounds a single call; nothing bounded the window.
 * The cell's cached map gains a key for every distinct question anybody
 * asks about until the four-minute window turns over, and each new key
 * costs a batched read over `ROOM_PEOPLE_CAP` people — so the ceiling was
 * the whole question bank, seven hundred keys on a document every caller
 * in that cell reads, and about seventeen thousand billed reads to get
 * there. Eight at a time, from any signed-in account, with nothing
 * refusing.
 *
 * 64 is generous for the honest case and still bounds the window: the
 * day's deck is the same list for everyone, callers differ only in how
 * far through it they have scrolled, and a window is four minutes. It
 * bounds a cell-window at 64 × 24 reads rather than at the bank.
 *
 * A SOFT bound, deliberately. Past it the room serves what it has already
 * folded instead of refusing the call — an honest client never reaches it,
 * and one that does gets a slightly thinner grid rather than an error on a
 * surface whose own failure rule is "leave the stop with its number".
 */
export const ROOM_WINDOW_QUESTION_CAP = 64;

/** A qid → {optionIdx → count} map, the shape v2_question_aggs uses. */
export type RoomCounts = Record<string, Record<string, number>>;

/**
 * The questions one call may fold, given what the cell's window already holds.
 *
 * A FUNCTION, and it takes the window's OWN map, because the bound above
 * shipped as arithmetic at the call site and the arithmetic was dead. It
 * measured the headroom against the cached entries this call had asked for
 * — an intersection with the request, so at most `ROOM_QUESTION_CAP` of
 * them — and then trimmed a list that was already shorter than the limit it
 * was trimming to. `64 - 8` never cut anything, so the window still grew a
 * key per novel question until it held the bank: the exact ceiling the
 * constant was added to close.
 *
 * The window's size is the size of what the CELL holds, which is the map on
 * the document. Nothing else can measure it, which is why this takes it.
 */
export function roomWindowMisses(
  qids: readonly string[],
  held: Readonly<Record<string, unknown>> | null | undefined,
  cap: number = ROOM_WINDOW_QUESTION_CAP,
): string[] {
  const have = new Set(held ? Object.keys(held) : []);
  // A window already at the cap folds nothing new — it serves what it has,
  // which is the soft bound the constant's own note describes.
  const room = Math.max(0, cap - have.size);
  return qids.filter((q) => !have.has(q)).slice(0, room);
}

/**
 * Tally one question's picks into the aggregate shape.
 *
 * The same `{ "0": 3, "2": 1 }` map the published aggregates carry, and
 * that is not a coincidence — the client already turns exactly this into
 * an option array (`opts.map((_, i) => cell[String(i)] || 0)`), so the
 * room's counts arrive in a shape four surfaces already read. Returning
 * an ARRAY would have meant agreeing with the client about how many
 * options a question has, over a wire, with a length nobody validates.
 *
 * NO FLOOR HERE, and that is a decision rather than an omission — see the
 * decision record. A floor on an answer split protects the answer, and
 * answers have been public since D98: the room's roster is disclosed by
 * the People tab anyway, so hiding a 2-person split would conceal nothing
 * that a reader could not get by tapping a name. What a small split needs
 * is its `n` shown beside it, which is the post-D98 rule everywhere else.
 */
export function tallyPicks(picks: readonly (number | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of picks) {
    // Integers only, and non-negative: an optionIdx is an index. A float
    // or a -1 (the client's "unanswered") would key a bucket the option
    // list has no slot for, and the client's `cell[String(i)]` walk would
    // simply never look at it — a count that exists, is wrong, and is
    // invisible.
    if (typeof p !== "number" || !Number.isInteger(p) || p < 0 || p > 99) continue;
    const k = String(p);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/**
 * The qids a room call may fold, cleaned of everything it must not.
 *
 * Client-supplied, so this is the door: shape-checked, de-duplicated (a
 * repeated qid would fold twice and pay twice for one answer) and capped.
 * Firestore document ids may not contain "/" and may not be "." or "..";
 * a bad one here would be a path injection into a getAll, so it is
 * refused rather than escaped.
 */
export function roomQids(
  raw: unknown,
  cap: number = ROOM_QUESTION_CAP,
  known?: (qid: string) => boolean,
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const q of raw) {
    if (typeof q !== "string") continue;
    const id = q.trim();
    if (!id || id.length > 120 || id.includes("/") || id === "." || id === "..") continue;
    // MUST NAME A QUESTION, when the caller can say what one is.
    //
    // The shape checks above are not a bound on cost. Each id the room has
    // not already folded costs a getAll over ROOM_PEOPLE_CAP answer refs —
    // and Firestore bills a missing document in a batchGet — so eight
    // unknown ids are ~192 billed reads. A folded id is CACHED, which is
    // what makes the honest case cheap and the dishonest one unbounded: a
    // caller sending eight FRESH invented ids every time never hits the
    // cache and pays the full fold on every call, from one anonymous
    // account, with no rate limit on this path.
    //
    // The same strings also become field names on the shared, server-only
    // room document, which the fold merges into — so invented ids grow a
    // document every caller in that cell reads, eight at a time, until it
    // passes 1 MiB and the write starts failing into a catch that
    // swallows it.
    //
    // The caller passes the bank, so this is a lookup rather than a guess.
    if (known && !known(id)) continue;
    seen.add(id);
    if (seen.size >= cap) break;
  }
  return [...seen];
}

// ── push fan-out (v2social) ─────────────────────────────────────

/**
 * Bounds on a stored FCM token, applied before it reaches FCM.
 *
 * WHAT ACTUALLY ENFORCES THE REST, because this said "rules cap the token
 * array at 10 entries but never check what is IN them, so a client can
 * store ten ~1MB strings in its own profile" and both halves stopped
 * being true at D98. Tokens left the profile for
 * `v2_users/{uid}/push/tokens`, which is `allow read, write: if false` —
 * no client can store anything there at all (firestore.rules, and
 * rules.test.ts pins both the shut door and the profile not keeping a
 * back way in). There is no rules clause capping the array; the cap of
 * ten is a server literal, `nextFcmTokens(…, 10)` in v2social.ts,
 * reachable only through `registerPushToken`, which already rejects
 * anything failing `isPlausibleFcmToken`.
 *
 * So this is the second, looser bound, applied at SEND time to whatever
 * is already stored — length only, no format regex, which is the part
 * most likely to silently kill every notification the day FCM changes
 * its token shape. It bounds send cost, not what is stored.
 */
export const FCM_TOKEN_MIN = 20;
export const FCM_TOKEN_MAX = 4096;

/** FCM's own per-call ceiling for sendEachForMulticast. */
export const FCM_BATCH = 500;

export interface PushFanout {
  /**
   * token -> the uids whose push document carries it.
   *
   * A LIST, not one uid: the same device can hold tokens for more than
   * one account, and a token FCM reports dead has to be pruned from every
   * document it lives on. Otherwise the array grows one ghost per
   * reinstall/rotation forever and every send fans out to them.
   */
  owners: Map<string, string[]>;
  /** uids that carried at least one token this refused — the caller logs them. */
  malformed: string[];
}

/**
 * Collect the tokens a multicast should target, from one entry per uid.
 *
 * Pairing uid to tokens is the CALLER's job and deliberately so: the
 * reveal sender reads push subdocuments whose every id is the literal
 * string "tokens" (D98), so there the uid is recoverable only from
 * getAll's preserved ordering. That subtlety belongs at its call site,
 * not in here.
 *
 * Pure, so the bounds and the dedupe are testable without an emulator —
 * and worth testing, because both failures are silent: an over-long token
 * fails the whole batch, and a token counted twice is a duplicate push.
 */
export function fcmFanout(entries: readonly { uid: string; tokens: unknown }[]): PushFanout {
  const owners = new Map<string, string[]>();
  const malformed: string[] = [];
  for (const { uid, tokens } of entries) {
    if (!Array.isArray(tokens)) continue;
    let bad = false;
    for (const t of tokens as unknown[]) {
      if (typeof t !== "string" || t.length < FCM_TOKEN_MIN || t.length > FCM_TOKEN_MAX) {
        bad = true;
        continue;
      }
      const list = owners.get(t) || [];
      // A uid listed twice for one token would prune it twice and, worse,
      // read as two devices in any future per-recipient accounting.
      if (!list.includes(uid)) list.push(uid);
      owners.set(t, list);
    }
    if (bad) malformed.push(uid);
  }
  return { owners, malformed };
}

/** Split tokens into FCM-sized batches. Never truncates — see FCM_BATCH. */
export function fcmBatches(tokens: readonly string[], size: number = FCM_BATCH): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < tokens.length; i += size) out.push(tokens.slice(i, i + size));
  return out;
}
