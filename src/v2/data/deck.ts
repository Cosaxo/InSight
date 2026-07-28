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

// One card per day, walking the bank backwards from `today` with a
// double-mod so a negative (today - back) still wraps into [0, n).
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
    const idx = (((today - back) % n) + n) % n;
    return questionIds[idx];
  });
}

// The client mirrors the server's deterministic rotation: the day's
// question for a group is bank[(hash(gid) + utcDay) % len] over the
// matching-surface bank. "pick" questions take the members as options.
export function duelQFor(
  g: Record<string, unknown> & { id: string },
  duelBank: Array<QuestionDoc & { id: string }>,
  utcDay: number,
  dayOffset = 0,
): { id: string; prompt: string; options: string[]; kind: string } | null {
  const mode = g.mode === "duo" ? "duo" : "group";
  const bank = duelBank.filter((q) => q.surface === mode);
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
