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
  tooSmall: boolean;
  test?: string | null;
}

export interface QuestionDoc {
  surface: string;
  seq: number;
  type: string;
  prompt: string;
  options: string[];
  topic: string | null;
  test: string | null;
  active: boolean;
  // Pool scope for duel questions (D40 part 4): absent = the shared pool;
  // "romantic" = served only to duos whose doc says duoMode: "romantic".
  // Absent everywhere else — the seed emits it only when set.
  mode?: string;
}

export interface AggDoc {
  counts?: Record<string, number>;
  total?: number;
  tooSmall?: boolean;
  // Per-anchor breakdown, already k-floored per cell with complementary
  // suppression applied server-side (functions/src/pure.ts, D8). A cell
  // that is absent here is WITHHELD, not zero — the UI must say so rather
  // than draw an empty bar.
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

// tooSmall defaults ON: only an agg doc that explicitly says
// tooSmall === false reveals counts (missing doc / missing flag hides).
export function isTooSmall(agg: AggDoc | undefined): boolean {
  return (agg || {}).tooSmall !== false;
}

export function buildS(
  q: QuestionDoc & { id: string },
  back: number,
  ctx: VoteContext,
  now: Date,
): LiveQuestion {
  const counts = countsFor(q.options, ctx);
  return {
    id: q.id,
    cat: q.topic,
    text: q.prompt,
    dayLabel: dayLabel(back, now),
    options: q.options.map((label, i) => ({
      id: String(i),
      label,
      count: counts[i],
      color: OPTION_COLORS[i % OPTION_COLORS.length],
    })),
    comments: [],
    friends: [],
    live: true,
    tooSmall: isTooSmall(ctx.agg),
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
// (promotion adds ~12/week against 7 days/week — D30 records the
// arithmetic), so the mod never wraps and appending questions changes no
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
