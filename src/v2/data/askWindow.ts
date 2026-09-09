// The ask window — what a current-events card knows about its own clock
// (D231, docs/NEXT-FUNCTIONALITY.md §1).
//
// A `now` question carries `from` and `until`, two inclusive UTC day keys,
// and stops being served after `until` (live.ts's `fresh()` filter). This
// module turns that pair into the two things a card needs: how much of the
// window is left, and a word for it.
//
// WHY IT IS ITS OWN MODULE rather than a second export from data/sponsored.
// A sponsored slot's window is a DISCLOSURE — it belongs to the paid band,
// and `windowLabel()` says "until 21 Aug" because a reader of a paid card
// is being told how long somebody bought. This window is the opposite kind
// of fact: it is the question's own deadline, addressed to the reader, and
// the two would drift the moment either changed. They also render nothing
// alike (a band versus a ring), so sharing a module would buy one import
// and cost the reason each exists.
//
// Everything here is pure and takes `now` explicitly, so the tests can put
// the clock where they need it and the card can pass a real one.

/** Both ends of a window, as the bank writes them. */
export interface AskWindowSource {
  from?: string;
  until?: string;
}

export interface AskWindow {
  /** Days the window runs, both ends included. Always ≥ 1. */
  days: number;
  /** Days still to run, today included. 0 once it has closed. */
  daysLeft: number;
  /** daysLeft / days, clamped to 0..1 — the fraction of the ring still drawn. */
  frac: number;
  /** The ring's word: "6d". */
  label: string;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86400000;

/** A UTC day key as milliseconds at midnight, or null if it is not one. */
function dayMs(key: string | undefined): number | null {
  if (!key || !DAY_KEY.test(key)) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The window's state at `now`, or null when the question has none — which
 * is every question but this lane's, so a caller can read the result as
 * "does this card have a clock".
 *
 * Null also for a window that is over. A closed card should never have
 * reached a reader (the bank filter drops it), so this is the second of
 * two answers to the same question rather than a display state: if one
 * ever slips through — a device whose clock crossed midnight mid-session,
 * a cached bank from yesterday — it draws as an ordinary card instead of
 * wearing a ring that has already run out.
 */
export function askWindow(q: AskWindowSource, now: Date = new Date()): AskWindow | null {
  const open = dayMs(q.from);
  const close = dayMs(q.until);
  if (open === null || close === null || close < open) return null;
  // Both ends inclusive: a window opened and closed on one day serves for
  // one day, not zero. The arithmetic is on UTC midnights, so no local
  // offset and no DST hour can move a boundary — the same property the
  // string comparison in `fresh()` rests on.
  const days = Math.round((close - open) / MS_PER_DAY) + 1;
  const today = Date.parse(`${new Date(now.getTime()).toISOString().slice(0, 10)}T00:00:00Z`);
  // Clamped at BOTH ends rather than trusted. Past the close is 0, which
  // returns null below. Before the open is the whole window and not the
  // distance to the close — a card scheduled for next week would otherwise
  // announce "29d" on a seven-day window, and the serving filter
  // (live.ts's `fresh()`) means only a clock-skewed device can see it at
  // all.
  const daysLeft = Math.min(days, Math.max(0, Math.round((close - today) / MS_PER_DAY) + 1));
  if (!daysLeft) return null;
  return {
    days,
    daysLeft,
    frac: daysLeft / days,
    // One shape at every size. "last day" would say more on the final day
    // and read as a rendering bug on the other six, because a slot that
    // changes format is the one thing a reader notices before the number.
    label: `${daysLeft}d`,
  };
}
