// "Open the topic list" — a request one screen makes of another (D190).
//
// WHAT IT FIXES. The profile's scenes card, with nothing followed, drew the
// empty field and a button reading "Pick topics →". The button called
// `goNav('track:world')`, which closes the profile and lands you in the
// daily feed — and then stops. Reported from a device as exactly that: it
// navigates to the feed instead of opening the interest list. A door that
// puts you in the room and does not point at the thing you asked for is a
// door that has to be followed by a search.
//
// WHY IT IS A REQUEST RATHER THAN A SECOND LIST. The list lives inside the
// feed's own sheet (`WorldFeed.renderAdd`) and is built out of the feed's
// pool: it counts the bank's questions per topic and how many of them you
// have answered, and it carries the mute the chip row has. A copy of it in
// the profile would be a second list to keep in step with the first — and
// D173's whole point is that there is ONE place a topic is tuned. So the
// profile asks for that place to open, and it opens.
//
// A ONE-SHOT, and consumed rather than read: the same shape as
// `consumeJoinCode` in links.ts, for the same reason — a flag that stays
// set is a sheet that reopens the next time anything mounts.
//
// A MODULE RATHER THAN A `window.` FLAG. Both ends are spec-layer .jsx, and
// a shared global read from them is exactly what `check:globals` rule 4
// counts and refuses to let grow (D39). An ESM import is not coupling the
// ratchet has to carry — see `world-feed.jsx` → `world-feed-math.js` for
// the long-standing case.

let pending = false;
const listeners = new Set<() => void>();

/**
 * Ask for the topic list. Wakes a feed that is already mounted, and is
 * picked up on mount by one that is not — both happen: the profile can be
 * open over the daily tab (where the feed is mounted and stays mounted
 * through the jump) or over the Mirror (where it mounts fresh).
 */
export function requestTopicSheet(): void {
  pending = true;
  listeners.forEach((f) => {
    // One listener throwing must not swallow the request for the others —
    // the same rule every other store in this tree follows.
    try { f(); } catch { /* a dead listener is not the caller's problem */ }
  });
}

/** True once per request, for the screen that answers it. */
export function consumeTopicSheet(): boolean {
  const was = pending;
  pending = false;
  return was;
}

export function subscribeTopicSheet(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
