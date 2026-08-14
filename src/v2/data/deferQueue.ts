// "Not now" for a question that has to come back (D121).
//
// The feed already had a skip, and it was deliberately withheld from test
// and lens cards. world-feed.jsx's own words: *never on a test/lens
// question — those fill an instrument, so a silent skip would read as a
// gap in your own results rather than a question you passed on.* That was
// the right call about the skip it had, which is permanent: a passed world
// card sinks to a slim row and stays there.
//
// It is the wrong call about the question the user actually asked, which
// is "let me not answer this one *right now*". With no skip at all, an
// item you do not want to answer sits at the same place in the stream
// every session until you do — and the instruments are the cards you are
// most likely to want to pass on, because they are personal.
//
// So a DEFERRAL rather than a pass: the card leaves the feed, and comes
// back. Nothing is recorded anywhere but this device (a deferral is not an
// answer, D5), the instrument's denominator does not move, and the profile
// still says the axis is thin — because it is.
//
// Pure and unit-tested here; world-feed.jsx holds the map in state and
// mirrors it to localStorage, the same shape as its pass list.

/**
 * How long a deferred question stays out of the feed.
 *
 * TWENTY HOURS, which is "tomorrow" in the only unit this app actually
 * has. The daily is one question a day and the feed is finite, so a
 * deferral measured in cards would either expire inside the same sitting
 * (no wait at all) or outlast the pool (a pass by another name). Twenty
 * rather than twenty-four so that a user who opens the app at roughly the
 * same time each day finds the card waiting rather than four hours short
 * of it — the same reason a daily streak is not enforced to the minute.
 */
export const DEFER_MS = 20 * 60 * 60 * 1000;

/** id → wall-clock ms after which the question may be served again. */
export type DeferMap = Record<string, number>;

/** When a question deferred at `now` becomes servable again. */
export function deferUntil(now: number): number {
  return now + DEFER_MS;
}

/**
 * Is this question currently being held back?
 *
 * A malformed or missing entry is NOT deferred. The map is device-local
 * JSON that any past version of this app may have written, and the
 * fail-safe direction is unambiguous: showing a question one more time
 * costs a scroll, while treating garbage as a live deferral could hide an
 * instrument's item forever.
 */
export function isDeferred(map: DeferMap | undefined, id: string, now: number): boolean {
  const until = map?.[id];
  return typeof until === "number" && Number.isFinite(until) && until > now;
}

/**
 * Drop every entry that has come due, so the stored map does not grow for
 * the life of the install.
 *
 * Returns the SAME object when nothing expired — the caller writes to
 * localStorage only on a change, and an identity check is the cheapest
 * way to know there was one.
 */
export function pruneDeferred(map: DeferMap, now: number): DeferMap {
  let stale = false;
  for (const id of Object.keys(map)) {
    if (!isDeferred(map, id, now)) { stale = true; break; }
  }
  if (!stale) return map;
  const out: DeferMap = {};
  for (const id of Object.keys(map)) {
    if (isDeferred(map, id, now)) out[id] = map[id];
  }
  return out;
}
