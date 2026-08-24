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
 *
 * **Returns whether it was answered on the spot** (D278). A mounted feed
 * consumes the request synchronously inside the loop below, so `pending`
 * is already false by the time this returns if one did — which makes the
 * answer a fact about what happened rather than a guess about who is
 * listening. It is the shape the daily ruler's near-end exit already uses
 * (`NAV.goNav` answers whether it navigated, and a refusal springs the
 * card back): the caller asks, and the answer decides what it does next.
 *
 * What the caller does with it: the feed's sheet portals to the app frame
 * at z-index 40 and the profile overlay sits at 20, so a request answered
 * in place opens the list ON TOP of the profile — and the jump D190 added
 * is then not needed at all. Reported twice from a device as being thrown
 * out of the profile to get at a list, which is what D190 fixed the far
 * end of and this fixes the near end of.
 */
export function requestTopicSheet(): boolean {
  pending = true;
  listeners.forEach((f) => {
    // One listener throwing must not swallow the request for the others —
    // the same rule every other store in this tree follows.
    try { f(); } catch { /* a dead listener is not the caller's problem */ }
  });
  return !pending;
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
