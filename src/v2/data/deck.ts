// Pure deck-shaping logic for the v2 live data layer — extracted from
// live.ts so it can be unit-tested without Firebase or a browser. Every
// function here takes explicit inputs (no module state, no window, no
// firebase imports); live.ts passes its store state in.
import type { CallRubric, CallSnapshot } from "./callRubric";

export interface LiveOption {
  id: string;
  label: string;
  count: number;
  color: string;
}

export interface LiveQuestion {
  id: string;
  cat: string | null;
  text: string;
  dayLabel: string;
  options: LiveOption[];
  comments: never[];
  friends: never[];
  live: true;
  // Renamed from `tooSmall` at D98. It used to mean "withheld — this
  // cohort is under the k-floor"; it now means "nobody has answered this
  // yet, so there is no split to draw". Renamed rather than reused
  // because the two are opposite claims about the same false value, and a
  // surface reading the old name would have gone on saying "withheld".
  noCountsYet: boolean;
  test?: string | null;
  // Carried through from the bank so the Mirror's Answers lens can group
  // by subject and its Scores lens can tell an ordinal question from a
  // categorical one (D100). Both undefined for a doc seeded before D100.
  branch?: string;
  sub?: string;
  type?: string;
  // The bank's short label, and which place a question RATES (D187).
  // `rates` is what makes the Scores card a scorecard of its stop rather
  // than of every ordinal question in the archive; `tag` is the noun that
  // card draws instead of the prompt. Both undefined for every question
  // that rates no place, and for any doc seeded before D187.
  tag?: string;
  rates?: string;
  // The card's background paragraph (D281). Carried since D306 so the
  // daily's About sheet can lead with it the way the feed's does — the
  // field was seeded and the feed read it, while this deck dropped it.
  bg?: string;
  // Whether a COHORT reading may fold this question (D161) — resolved by
  // isCore() at build time rather than carried raw, because the raw flag
  // is feed-only and every other surface is core by construction. A view
  // model that carried `core?: boolean` would hand every consumer the same
  // trap: `q.core` reads false for the daily, which empties a panel
  // instead of filtering it. Resolved, it is a plain boolean that means
  // what it says everywhere.
  coreCorpus: boolean;
}

export interface QuestionDoc {
  surface: string;
  seq: number;
  type: string;
  prompt: string;
  options: string[];
  topic: string | null;
  // The catalogue key space a `type: "catalog"` question's `entity`
  // answers validate against — pokemon/emoji/elements/… (D14/D15). The
  // seed transports it on every doc; non-null only on catalog docs.
  domain?: string | null;
  // The daily bank's [branch, sub-branch] subject path (D100) — "Mind" /
  // "Outlook". Absent on every other surface, and absent from any daily
  // doc seeded before D100 until the next seed run, so every reader has
  // to tolerate undefined rather than assume the bank is current.
  branch?: string;
  sub?: string;
  // The daily bank's short label ("Nature access") and, on the questions
  // that rate a place, which Mirror stop may fold them — "city" |
  // "country" | "world" (D187). Daily-only, and absent from any doc
  // seeded before D187; a bank that predates it simply has no place
  // scorecard, which is what every bank had until it.
  tag?: string;
  rates?: string;
  test: string | null;
  active: boolean;
  // Current-events serving window (docs/NEXT-FUNCTIONALITY.md §1, D231): a
  // feed entry is OFFERED only between these two inclusive UTC day keys;
  // answers and aggregate persist either way. `until` alone is legal and
  // is what a sponsored slot carries (D195) — a paid window announces
  // itself in a band rather than drawing a ring, so it needs no start.
  from?: string;
  until?: string;
  // What the card's `i` opens (D281): the facts a reader needs before the
  // question is answerable, never the arguments. Optional on every
  // surface and absent from most — a question that needs no context
  // carries none, and the button says "About this question" instead.
  bg?: string;
  // The learn card's own fields (D284): the index of the correct option,
  // the trap, the authored difficulty, the map label and the optional why
  // line. Learn-only, and absent from any document seeded before D284 —
  // which is why the client drops a card without `c` rather than guessing
  // one (live.ts's publishLearnBank).
  //
  // They live on the document because the alternative was the whole card
  // bank compiled into the app: `spec/learn-data.js` imported it, and
  // `check:bundle` had about thirty-nine cards of headroom left.
  c?: number;
  t?: number;
  p?: number;
  k?: string;
  w?: string;
  // Core/tail (D161). Feed-only, and ABSENT MEANS TAIL — a question is in
  // the Mirror's corpus only if it says so. Every other surface is core by
  // construction and carries no key, which is why readers must go through
  // `isCore()` below rather than testing this field directly.
  core?: boolean;
  // Bought reach (D313). Set only by the paying webhook, on a question
  // written into the bank at runtime — which is exactly the question no
  // published order can carry, because `rankBankV2` builds the feed's
  // order from the COMPILED bank. Absent on every seeded question, so
  // like `core` it is emit-when-set and absence means "not this".
  //
  // The client's boot fetch asks for it beside `until`, so a bought
  // question ships whole for the length of the window it was bought for
  // (live.ts) — the delivery D313 sells and D316/D321 would otherwise
  // have left with no route to a device.
  paid?: boolean;
  // Doors (docs/TAGS-PLAN.md §1): the topics a feed question ALSO belongs
  // to, beside its `topic` home. Feed-only, emit-when-set, and reach-only —
  // the feed's filter, stock and search read topic ∪ also, while everything
  // that PLACES the card (Map branch, kicker, stream grouping) stays on
  // `topic`. Absent everywhere else and on any doc seeded before it landed.
  also?: string[];
  // Pool scope for duel questions (D40 part 4): absent = the shared pool;
  // "romantic" = served only to duos whose doc says duoMode: "romantic".
  // Absent everywhere else — the seed emits it only when set.
  mode?: string;
  // The continuum forms' range/plane copy (D114): what the client renders
  // the dial track and the field plane from. Present only on feed
  // dial/field docs; their `options` are synthesized bucket/cell labels,
  // and a stored answer's optionIdx is a position on this range.
  lo?: number;
  hi?: number;
  unit?: string;
  ends?: string[];
  ax?: string[];
  ay?: string[];
  // Crossroads' story (D136), on feed `path` docs only. Same design as the
  // continuum copy above, one step further: the tree is what the client
  // walks, and a finished walk's optionIdx is one of the eight endings —
  // whose NAMES are this doc's synthesized `options`, in PATH_ENDINGS
  // order. The authored branch shares the demo pool carries are not here:
  // live, the crowd is the aggregate.
  title?: string;
  intro?: string;
  hue?: number;
  nodes?: Record<string, { q: string; a: Array<{ t: string }> }>;
  endings?: Record<string, { name: string; line: string }>;
  // Foresight CALL (D194), on `call` docs only: the admitted grading tier,
  // the earliest UTC day the resolver may grade, and the expression it
  // RUNS. The outcome is deliberately not here — it is written by the
  // resolver into v2_call_outcomes, which the seed never touches.
  tier?: string;
  resolvesAt?: string;
  rubric?: CallRubric;
  // Sponsored questions (D195), on feed docs only: who bought the question,
  // and at most one coarse audience tag the DEVICE matches against its own
  // anchors. The window is `until` above rather than a field here, so the
  // label the disclosure prints and the filter that stops serving the card
  // are one value.
  sponsor?: { buyer: string; audience?: Record<string, string> };
}

/** One published grade — `v2_call_outcomes/{qid}`, admin-written (D194). */
export interface CallOutcome {
  /** The winning option, or CALL_VOID (-1): nobody is scored. */
  outcomeIdx: number;
  resolvedBy?: string;
  /** What the grader SAW, so the device can re-run the same arithmetic. */
  inputs?: CallSnapshot | null;
  note?: string;
}

export interface AggDoc {
  counts?: Record<string, number>;
  total?: number;
  // Rank questions' aggregate (D233): per-item POSITION SUMS — pos[i] is
  // the sum of the 0-based positions every answerer gave item i — from
  // which the crowd order derives (rankCrowdFor below). Present only on
  // rank questions' aggregates, which carry no counts and no by.
  pos?: number[];
  // The catalog canon (D14): the published board — the CANON_TOP_N biggest
  // entities as key → count — and everything outside it summed into
  // `rest`. Present only on catalog questions' aggregates, whose `by` maps
  // hold entity keys (cut to the board's own entities, D17) rather than
  // option indexes.
  top?: Record<string, number>;
  rest?: number;
  // Per-anchor breakdown, exact and complete (functions/src/pure.ts, D8
  // for the shape, D98 for the exactness). A cell that is absent here has
  // no answers in it — nothing is suppressed, so absent means zero and the
  // UI may draw it as such.
  by?: Record<string, Record<string, Record<string, number>>>;
  // The edit-flow matrix (D226): from-option → to-option → count of D86
  // edits, folded server-side beside the -old/+new move. Counts MOVES,
  // not people (an answer edited twice appears under two pairs). Present
  // only once a question has ever been edited — absent means "never
  // edited", and nothing in the client renders it yet: it is here so the
  // published doc's shape is stated where every other field's is.
  edits?: Record<string, Record<string, number>>;
}

// The viewer-relative slice of store state a card needs: the question's
// public aggregate, the viewer's own vote ("0","1",…) if any, and
// whether that vote is still optimistic (not yet folded into the agg).
export interface VoteContext {
  agg: AggDoc | undefined;
  mine: string | undefined;
  pending: boolean;
}

// The spec's option palette, cycled by index so live cards look native.
export const OPTION_COLORS = [
  "var(--c-around)",
  "var(--c-today)",
  "var(--c-likeness)",
  "var(--c-world)",
  "var(--c-people)",
];

export const DECK_DAYS = 7; // today + the recent past, like the demo pager
export const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function utcDayIndex(nowMs: number): number {
  return Math.floor(nowMs / 86400000);
}

export function gHash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h;
}

export function dayIndex(now: Date): number {
  // The LOCAL CALENDAR day number, so "today" rolls over with the user's
  // clock. Read off the local Y/M/D and numbered in UTC — the local parts
  // are what makes it local; the UTC arithmetic is what keeps it a
  // calendar count.
  //
  // It used to be `new Date(y, m, d).getTime() / 86400000` — local midnight
  // as a UTC INSTANT — which leaks the zone's offset into the day number.
  // East of UTC that instant falls on the previous UTC day, so the index
  // came out one lower; at UTC and west it did not. Constant per zone, and
  // therefore invisible… except in the zones whose offset CROSSES ZERO at a
  // DST transition: the UK, Ireland, mainland Portugal, the Canaries,
  // Casablanca. There the constant changes twice a year, and the day number
  // stalls or jumps with it. Measured under TZ=Europe/London:
  //
  //   2026-03-29 → 20541, 2026-03-30 → 20541   (delta 0)
  //   2026-10-25 → 20750, 2026-10-26 → 20752   (delta 2)
  //
  // Spring, the daily question does not change: `vote()` is create-only, so
  // the card renders answered and there is no daily question that day, and
  // "Yesterday" points at the wrong card. Autumn, a bank question is skipped
  // and never served. `state.deckDay !== dayIndex()` also fails to fire at
  // local midnight, and `dayLabel` below uses setDate, which is
  // calendar-correct — so the two disagreed about what day it was.
  //
  // Date.UTC on local parts is stable across every transition because it
  // never consults the offset at all.
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

export function dayLabel(back: number, now: Date): string {
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - back);
  return WEEKDAY[d.getDay()];
}

// Counts shown to the viewer EXCLUDE their own vote (the UI layer adds
// its own +1 for "you"; including it here would double-count — review
// finding, Phase 2). Shared by the daily deck (buildS) and the feed
// (feedCounts in live.ts).
export function countsFor(options: string[], ctx: VoteContext): number[] {
  const counts = (ctx.agg || {}).counts || {};
  return options.map((_, i) => {
    let count = counts[String(i)] || 0;
    // Exclude the viewer's own vote: once the trigger has folded it in
    // (optimistic flag cleared), subtract it back out — the UI layer
    // adds its own +1 for the viewer's option.
    if (!ctx.pending && ctx.mine === String(i) && count > 0) count -= 1;
    return count;
  });
}

// Whether this question has published counts to show yet.
//
// D98 retired the k-floor, so the server no longer writes a `tooSmall`
// flag and nothing is ever withheld for being small — but the question
// "is there an aggregate here at all?" survives, because a question
// nobody has answered has no document. What used to be a DISCLOSURE test
// is now an EXISTENCE test.
//
// The old predicate defaulted ON — anything but an explicit
// `tooSmall === false` hid the counts. That default was deliberately
// fail-closed, and it is exactly why this function had to change in the
// same commit as the trigger: with the server no longer writing the flag,
// a client still reading it would blank every count in the app.
/**
 * May a cohort reading fold this question? (D161)
 *
 * The Mirror's population claims — "this is how Oslo answered" — are only
 * true if everyone in Oslo could have been ASKED. Once the tail is ordered
 * by an interest model (D163), a tail question's split describes the
 * people it was shown to, not the place. The arithmetic stays correct and
 * the sentence stops being.
 *
 * So: feed questions are core only when they say so, and **every other
 * surface is core by construction** — the daily is one globally shared
 * question, test items are what Scores and the similarity fields are
 * computed from, duels never become world aggregates, learn cards are
 * knowledge rather than opinion. That asymmetry is why this is a function
 * and not a field test at each call site: `q.core` alone reads as false
 * for the daily, which would empty the Mirror rather than filter it.
 *
 * NOT a serving filter. A tail question is offered, answered, and
 * publishes its own aggregate like any other; its card shows its own
 * split. This governs one thing — whether a COHORT fold may include it.
 * Nor does it apply to a person's own answer list, which must always show
 * everything they answered.
 */
export function isCore(q: { surface: string; core?: boolean }): boolean {
  return q.surface === "feed" ? q.core === true : true;
}

export function hasPublishedCounts(agg: AggDoc | undefined): boolean {
  return !!agg && typeof agg.total === "number" && agg.total > 0;
}

// The published pick board's size — MUST equal CANON_TOP_N in
// functions/src/v2.ts, which cuts what the fold publishes. One constant
// client-side (pickCanon's slice and the card's "N of 10 spots" copy both
// read it, directly or through pickSrc), and vote.test.ts pins it against
// the functions source text — the dialBucketMid twin-math precedent: two
// layers that cannot import each other, held equal by a test instead of
// by hope.
export const CANON_BOARD_N = 10;

/**
 * The crowd's 1-based rank per item for a rank question (D233), derived
 * from the published position sums — EXCLUDING the viewer's own folded
 * order, the same subtract-own convention countsFor keeps. The demo's
 * crowd is authored strangers; live, a "crowd" that is mostly you would
 * make the reveal's match line a mirror, so the comparison is you
 * against everyone else. `mine` is the viewer's stored order (null when
 * unanswered); once the trigger folds it (`pending` false) its positions
 * come back out here and the card compares against the remainder.
 *
 * Null means NO CROWD: nobody has ranked, or only the viewer has — the
 * card's first-voter state, not an error. Ties break by item index so
 * equal sums render identically on every device.
 */
export function rankCrowdFor(
  agg: AggDoc | undefined,
  mine: number[] | null,
  pending: boolean,
): number[] | null {
  const pos = agg?.pos;
  const total = agg?.total ?? 0;
  if (!Array.isArray(pos) || pos.length < 2 || total <= 0) return null;
  let rest = [...pos];
  let n = total;
  if (mine && !pending && mine.length === rest.length) {
    // The same staleness countsFor clamps with `count > 0`: a cached
    // aggregate from BEFORE this device's fold (another device answered,
    // or the top-up has not landed) does not contain the viewer, and
    // subtracting anyway would invert the crowd or manufacture a false
    // "You're first". A sum driven negative is proof the order was never
    // in these numbers — keep the whole aggregate and compare against it
    // as the crowd it actually is; the post-vote refresh converges it.
    const sub = [...rest];
    for (let p = 0; p < mine.length; p++) {
      const item = mine[p];
      if (Number.isInteger(item) && item >= 0 && item < sub.length) sub[item] -= p;
    }
    if (sub.every((v) => v >= 0)) {
      rest = sub;
      n -= 1;
    }
  }
  if (n <= 0) return null;
  const byMean = [...rest.keys()].sort((a, b) => rest[a] - rest[b] || a - b);
  const crowd = new Array<number>(rest.length).fill(0);
  byMean.forEach((item, i) => { crowd[item] = i + 1; });
  return crowd;
}

export function buildS(
  q: QuestionDoc & { id: string },
  // Null for a question that is not on the pager at all — the Mirror's
  // archive (LIVE.aggregated) reaches questions from any day, and a
  // dayLabel of "Today" on all of them would be a claim rather than a
  // blank. The pager itself always passes a number.
  back: number | null,
  ctx: VoteContext,
  now: Date,
): LiveQuestion {
  const counts = countsFor(q.options, ctx);
  return {
    id: q.id,
    cat: q.topic,
    text: q.prompt,
    dayLabel: back == null ? "" : dayLabel(back, now),
    branch: q.branch,
    sub: q.sub,
    type: q.type,
    tag: q.tag,
    rates: q.rates,
    options: q.options.map((label, i) => ({
      id: String(i),
      label,
      count: counts[i],
      color: OPTION_COLORS[i % OPTION_COLORS.length],
    })),
    comments: [],
    friends: [],
    live: true,
    bg: q.bg,
    noCountsYet: !hasPublishedCounts(ctx.agg),
    test: q.test,
    coreCorpus: isCore(q),
  };
}

// The rotation is anchored to a launch-day epoch, not to the raw day
// number. Raw `today` is ~20,600 — deep in wrap territory for any bank —
// so `today mod n` remaps EVERY visible day whenever n changes, including
// the 7-day history pager: after a weekly promotion reseed (D30), a user's
// answered "Yesterday" card would be replaced by a different question whose
// vote state (keyed by qid) doesn't match, rendering unanswered. Rebased on
// the epoch, the index stays below n while the bank outgrows the calendar
// (promotion outpaces the calendar's 7/week — D30 recorded 12/week, D97
// targets ≥14), so the mod never wraps and appending questions changes no
// past or present day's mapping at all. Residual limit, recorded: if
// promotion lapses for longer than the bank's runway (n days after epoch),
// the wrap returns and one reseed remaps history once.
// 2026-08-01 as a dayIndex, the day D30 landed.
//
// UNCHANGED by the DST fix above, and now true for the first time: 20666 is
// the calendar day number for 2026-08-01, which is what dayIndex returns for
// that date in EVERY zone. Under the old offset-leaking formula it was what
// dayIndex returned at UTC and west of it, and one too high for everyone
// east — so the constant matched its own description only for some readers.
//
// Re-deriving it cannot preserve both halves, because the old error was a
// per-zone shift rather than a constant: +1 here would hold east-of-UTC
// rotations still and move UTC and west instead. Keeping 20666 leaves UTC
// and the Americas exactly where they were and moves everyone east by one
// position, ONCE. That is the remap the paragraph above already accounts
// for, and the direction is the right way round: east of UTC is where the
// index was wrong.
export const DECK_EPOCH = 20666;

// One card per day, walking the bank backwards from `today` with a
// double-mod so a negative (today - epoch - back) still wraps into [0, n)
// (possible in the epoch's own first week, and again only if the wrap
// above ever returns).
export function computeDeckIds(
  questionIds: string[],
  today: number,
  deckDays = DECK_DAYS,
): string[] {
  // Defensive: callers derive this from server data, and a non-array here
  // would throw inside the Array.from below rather than degrading.
  if (!Array.isArray(questionIds)) return [];
  const n = questionIds.length;
  if (!n) return [];
  return Array.from({ length: Math.min(deckDays, n) }, (_, back) => {
    const idx = (((today - DECK_EPOCH - back) % n) + n) % n;
    return questionIds[idx];
  });
}

// The per-surface bank split, extracted from live.ts's refresh path so the
// fencing is testable: each bank is an ALLOWLIST, so a mistake in one
// predicate cannot leak a surface into a bank it was never meant to touch —
// a learn card (D32) must never appear in the daily deck or the feed, where
// its "options" would render as an opinion vote with a secretly right
// answer.
//
// Bank docs are hand-editable in the console — the kill switch expects an
// operator in there — and nothing validates them on the way in. A doc
// missing `options` used to throw inside q.options.map, blanking a whole
// tab behind the ErrorBoundary. Drop unusable docs instead. "pick" duel
// questions are the deliberate exception: they carry no bank options
// because their options ARE the group's members.
export function splitBanks(active: Array<QuestionDoc & { id: string }>): {
  daily: Array<QuestionDoc & { id: string }>;
  feed: Array<QuestionDoc & { id: string }>;
  duel: Array<QuestionDoc & { id: string }>;
  learn: Array<QuestionDoc & { id: string }>;
  call: Array<QuestionDoc & { id: string }>;
  pulse: Array<QuestionDoc & { id: string }>;
} {
  const playable = (q: QuestionDoc & { id: string }) =>
    Array.isArray(q.options) && q.options.length >= 2;
  return {
    daily: active.filter((q) => q.surface === "daily" && playable(q)),
    // type "catalog" is the feed lane's deliberate playable() exception,
    // the duel lane's "pick" precedent: a catalog doc carries no options
    // because the shipped catalogue is its answer space (D14), so the
    // options gate that drops malformed docs would drop every pick card.
    // The exception is FEED-NARROW where the plain lane spans test too —
    // catalog questions exist on no other surface (rules and the seed
    // both say feed), and an options-free doc admitted off a wider
    // surface would be a hand-edited console doc this fence exists to
    // drop.
    //
    // Rank rides the plain lane since D233 — D12's exclusion lived here
    // for as long as an answer could not carry an order (served as vote
    // cards, rank docs folded single picks into aggregates that claimed
    // to be rankings). An answer carries one now (`order`, rules + fold +
    // LIVE.voteRank), and buildFeedGlobals maps rank docs to their own
    // card type, so the poisoning D12 pulled them for is structurally
    // gone rather than filtered around.
    feed: active.filter((q) =>
      q.type === "catalog"
        ? q.surface === "feed"
        : (q.surface === "feed" || q.surface === "test") && playable(q)),
    duel: active.filter(
      (q) =>
        (q.surface === "group" || q.surface === "duo") &&
        (playable(q) || q.topic === "pick"),
    ),
    learn: active.filter((q) => q.surface === "learn" && playable(q)),
    // Foresight CALLs (D194). Their own bank rather than a member of the
    // feed's: a call is not dealt into the stream, it is pinned at the head
    // like Crossroads, and — more to the point — its card is the only one
    // that has to read a SECOND document (the outcome) before it can say
    // anything. Keeping it out of `feed` keeps that read off the feed's
    // hot path entirely.
    call: active.filter((q) => q.surface === "call" && playable(q)),
    // The pulse roster (D203). It had no bank until the roster shipped,
    // and the omission cost two live defects rather than one: `data/pulse`
    // paid its own `getDoc` for a template `hydrate()` had already
    // downloaded and cached, AND that read took only `prompt`/`options`,
    // so `active` never reached the client. Flipping a pulse off in the
    // console left a fully rendered, tappable card whose every write the
    // rules refused — the answer appeared and silently vanished. Both are
    // fixed by the pulse being a bank like the others, because `active` is
    // already filtered out of `active` above.
    pulse: active.filter((q) => q.surface === "pulse" && playable(q)),
  };
}

// Every member's client computes the day's question independently — the
// same pure function of (gid, utcDay, bank) on every device: bank[(hash(gid)
// + utcDay) % len] over the matching-surface bank. There is NO server-side
// chooser to mirror: rules only require the answered qid to exist in the
// bank, and the reveal stores the qid the MOST members answered (plurality,
// lexical tie-break — revealQid in functions/src/pure.ts) — so a client that
// drifts from this rotation still reveals coherently, it has just answered a
// different question than its group. It used to store whichever qid the first
// counted answer carried, which made the group's published question depend on
// the order of memberUids; the drifted client is the minority by definition,
// so plurality names the question the group actually played. The drifter's
// vote still appears in the reveal — it is only kept out of the cross-group
// aggregate, which is a claim about one question and must not count answers
// given to another.
// "pick" questions take the members as options.
export function duelQFor(
  g: Record<string, unknown> & { id: string },
  duelBank: Array<QuestionDoc & { id: string }>,
  utcDay: number,
  dayOffset = 0,
): { id: string; prompt: string; options: string[]; kind: string } | null {
  const mode = g.mode === "duo" ? "duo" : "group";
  // A duo draws from exactly one pool (D40 part 4): the romantic pool when
  // its doc says duoMode "romantic", the shared pool otherwise. The two are
  // disjoint by construction — friend pairs must never rotate into the
  // romantic ladder, and flipping duoMode swaps the whole pool (both
  // partners see the same doc, so both flip together). Filtering the
  // romantic pool OUT of the default branch is what keeps existing pairs'
  // rotation unmoved by the pool's arrival — for them the bank is
  // unchanged, so no served day remaps (the D30 growth argument).
  const pool = mode === "duo" && g.duoMode === "romantic" ? "romantic" : null;
  const bank = duelBank.filter(
    (q) => q.surface === mode && (pool ? q.mode === pool : q.mode == null),
  );
  if (!bank.length) return null;
  const q = bank[(gHash(g.id) + utcDay + dayOffset + bank.length * 1000) % bank.length];
  const names = (g.memberNames || {}) as Record<string, string>;
  const memberUids = (g.memberUids || []) as string[];
  const options =
    q.topic === "pick"
      ? memberUids.map((u, i) => names[u] || "Member " + (i + 1))
      : q.options;
  return { id: q.id, prompt: q.prompt, options, kind: q.topic || "classic" };
}
