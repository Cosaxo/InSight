// The one cross-link INTO the Map: "open the Mirror's You stop on this
// branch or leaf" (v28 §5's `window.goTrends`, D207). Typed and ESM
// instead of the prototype's three window globals (goTrends,
// MAP_OPEN_GROUP, MAP_SELECT) — a new shared-global READ anywhere in the
// scanned set would raise check:globals' rule-4 ratchet, and this route
// needs none: the caller (ui/PulseTrends) imports cueMap, app-shell
// imports onMapCue to do the tab switch, and map-tab imports takeMapCue
// to open on the cued spot.
//
// take-once on purpose: a cue is a navigation, not a setting. Whichever
// consumer reaches it first (the freshly-mounted MapTab's initializer, or
// an already-mounted MapTab's subscription) consumes it, and a Map opened
// by hand five minutes later starts neutral. Session-only state, no
// insight.* key — nothing here for the purge to sweep.

export interface MapCue {
  /** MAP_GROUPS id to open drilled-in (e.g. "g-self"), or none. */
  group?: string;
  /** map-tab selection — a branch id ("pulse") or a leaf id ("pulse-…"). */
  sel?: string;
}

let cue: MapCue | null = null;
const subs = new Set<() => void>();

export function cueMap(c: MapCue): void {
  cue = c;
  subs.forEach((f) => { try { f(); } catch { /* a broken listener must not stop the rest */ } });
}

/** Read AND clear the pending cue — the first consumer wins. */
export function takeMapCue(): MapCue | null {
  const c = cue;
  cue = null;
  return c;
}

export function onMapCue(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
