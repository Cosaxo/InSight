// Pure deck-shaping logic for the v2 live data layer — extracted from
// live.ts so it can be unit-tested without Firebase or a browser. Every
// function here takes explicit inputs (no module state, no window, no
// firebase imports); live.ts passes its store state in.

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
}

export interface QuestionDoc {
  surface: string;
  seq: number;
  type: string;
  prompt: string;
  options: string[];
  topic: string | null;
  // The daily bank's [branch, sub-branch] subject path (D100) — "Mind" /
  // "Outlook". Absent on every other surface, and absent from any daily
  // doc seeded before D100 until the next seed run, so every reader has
  // to tolerate undefined rather than assume the bank is current.
  branch?: string;
  sub?: string;
  test: string | null;
  active: boolean;
  // Current-events serving window (D-plan §1): a feed entry past this
  // UTC day stops being OFFERED; answers and aggregate persist.
  until?: string;
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
}

export interface AggDoc {
  counts?: Record<string, number>;
  total?: number;
  // Per-anchor breakdown, exact and complete (functions/src/pure.ts, D8
  // for the shape, D98 for the exactness). A cell that is absent here has
  // no answers in it — nothing is suppressed, so absent means zero and the
  // UI may draw it as such.
  by?: Record<string, Record<string, Record<string, number>>>;
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
  // Local-midnight day number so "today" rolls over with the user's clock.
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local.getTime() / 86400000);
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
export function hasPublishedCounts(agg: AggDoc | undefined): boolean {
  return !!agg && typeof agg.total === "number" && agg.total > 0;
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
    options: q.options.map((label, i) => ({
      id: String(i),
      label,
      count: counts[i],
      color: OPTION_COLORS[i % OPTION_COLORS.length],
    })),
    comments: [],
    friends: [],
    live: true,
    noCountsYet: !hasPublishedCounts(ctx.agg),
    test: q.test,
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
// 2026-08-01 as a local-midnight day number (dayIndex), the day D30 landed.
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
} {
  const playable = (q: QuestionDoc & { id: string }) =>
    Array.isArray(q.options) && q.options.length >= 2;
  return {
    daily: active.filter((q) => q.surface === "daily" && playable(q)),
    // type "rank" is excluded from the LIVE feed on purpose. The bank seeds
    // 8 of them, and buildFeedGlobals used to serve them as single-choice
    // vote cards — folding single options into aggregates that claim to be
    // a ranking. Wrong-shaped answers are worse than no card (the same
    // honesty rule as D5); the full arithmetic is in D12.
    feed: active.filter(
      (q) =>
        (q.surface === "feed" || q.surface === "test") &&
        playable(q) &&
        q.type !== "rank",
    ),
    duel: active.filter(
      (q) =>
        (q.surface === "group" || q.surface === "duo") &&
        (playable(q) || q.topic === "pick"),
    ),
    learn: active.filter((q) => q.surface === "learn" && playable(q)),
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
