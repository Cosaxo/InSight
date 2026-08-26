// The one cross-link INTO the two daily viewers: "open the 1v1 with this
// person" / "open this group" (the 2026-08-26 standalone's Play together
// card). Typed and ESM instead of the prototype's two window globals
// (DUO_FOCUS, GROUP_FOCUS) and its two window events — the exact shape
// data/mapCue.ts already set for the same problem: a new shared-global
// READ anywhere in the scanned set would raise check:globals' rule-4
// ratchet, and this route needs none. The caller (person-overlay) cues
// and navigates through NAV.goNav; each viewer takes its own cue on
// mount, or on the subscription when it is already mounted.
//
// take-once on purpose: a cue is a navigation, not a setting. Whichever
// render reaches it first consumes it, and a viewer opened by hand five
// minutes later starts neutral. Session-only state, no insight.* key —
// nothing here for the purge to sweep.

export interface DuelCue {
  /** Which viewer the cue is for — each takes only its own. */
  mode: "duo" | "group";
  /** The partner's person id, or the group id. */
  id: string;
}

let cue: DuelCue | null = null;
const subs = new Set<() => void>();

export function cueDuel(c: DuelCue): void {
  cue = c;
  subs.forEach((f) => { try { f(); } catch { /* a broken listener must not stop the rest */ } });
}

/** Read AND clear the pending cue — only when it names this mode. */
export function takeDuelCue(mode: DuelCue["mode"]): string | null {
  if (!cue || cue.mode !== mode) return null;
  const id = cue.id;
  cue = null;
  return id;
}

export function onDuelCue(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
