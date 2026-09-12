// The feed's SITTING — one visit to the feed, and the unit a refresh is
// measured in.
//
// THE PROBLEM, which was two problems pointing opposite ways (the owner,
// 2026-09-12: *"the feed should refresh when you navigate somewhere else
// for long enough or close the app"*).
//
//   · It rebuilt when it should not have. `app-shell.jsx` keys `.tab-swap`
//     by tab, so a hop to Mirror and back unmounts the whole daily tab and
//     mounts a new one. Every per-mount field in world-feed.jsx therefore
//     reset on a two-second round trip: the answered snapshot (`_sunk`),
//     which is what keeps a card you just voted on in its place while you
//     read its reveal, and the deferral snapshot (`_heldAtBuild`), which is
//     what makes "later · undo" reachable. Both were written to last "this
//     sitting" and both lasted until you glanced at another tab.
//
//   · It never produced anything new when it should have. The order is a
//     pure function of a stable pool — `wfStreamMix` round-robins the
//     streams in first-appearance order — so a rebuild deals the same cards
//     in the same order, and `scroll-memory.js` then puts you back at the
//     same scroll offset. Nothing about a return read as a refresh, however
//     long you had been gone.
//
// So the mount is the wrong clock. A sitting is the right one: it survives
// the hop, and it ENDS when you are actually away.
//
// WHAT A NEW SITTING IS, and it is deliberately only three things — the
// feed is not reloaded, nothing is re-fetched, and no network read is paid
// (`wake()` in live.ts owns that question and answers it on its own terms):
//
//   1. the answered cards you have piled up leave the stream for the
//      Answered expander,
//   2. the mix rotates, so you open on a different topic and a different
//      question rather than on the head you have met every visit,
//   3. the remembered scroll offset is dropped, so you start at the top.
//
// WHY A COUNTER AND NOT A CLOCK READ AT RENDER. The rotation has to be
// stable across every render inside one sitting — a value derived from
// `Date.now()` would reorder the feed under the thumb on any re-render, and
// re-renders happen on every vote. One integer, bumped at the boundary.
//
// WHAT THIS IS NOT, stated because the feed's order is load-bearing for a
// sale. The paid places (D195, D377) are re-inserted after this ordering,
// one per `SPONSOR_EVERY` cards, so the count of paid slots is
// `floor(n / SPONSOR_EVERY)` in every rotation — the density is the unit of
// sale and the rotation cannot move it. And the counter is CLOCK-derived,
// never behaviour-derived: nothing here reads what you answered, skipped,
// dwelled on or opened, nothing is recorded and nothing is sent. That is
// the line `MONITORING.md` draws at "per-user content selection" and
// `ATTENTION.md` at its cost rule, and this stays on the safe side of both
// by knowing exactly one fact — whether you have been gone a minute.

/**
 * How long away ends a sitting.
 *
 * A minute, and the number is borrowed rather than invented: `live.ts`
 * already uses `IDLE_DETACH_MS = 60_000` to tell "they actually left" from
 * "the ten-second app swap `wake()` is written around", and this is the
 * same distinction asked by a different surface. Two surfaces answering
 * one question with two numbers is how they drift apart; if the store's
 * idea of "away" ever moves, this should move with it.
 */
export const AWAY_MS = 60_000;

/** Where the counter survives a relaunch. Swept by the D51 purge with
 * every other `insight.*` key, by prefix — which is correct rather than
 * incidental: a new account should not inherit the previous one's place
 * in the rotation. */
const LS = "insight.feedSitting.v1";

const readCounter = (): number => {
  try {
    const n = Number(localStorage.getItem(LS));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch { return 0; }
};

const writeCounter = (n: number): void => {
  try { localStorage.setItem(LS, String(n)); } catch { /* private mode — holds for the session */ }
};

/**
 * A FRESH MODULE INSTANCE IS A COLD LAUNCH, which is the other half of the
 * owner's sentence ("or close the app") and needs no lifecycle hook to
 * detect: this initialiser runs once per load of the feed chunk, and a
 * relaunch is the only thing that runs it twice. Reserving here rather
 * than bumping on the first `enter()` is what makes a relaunch rotate even
 * when the app was killed while the feed was on screen and no `leave()`
 * was ever recorded.
 *
 * READ-THEN-RESERVE, rather than bump-then-read, and the difference is a
 * first impression. A device with nothing stored reads 0, and 0 is the
 * identity rotation — so the first feed anybody ever sees is the bank's
 * own order, the one the content lanes wrote and the one every ordering
 * test in this tree is written against. What is written back is the NEXT
 * launch's number, which is why this is a launch counter rather than a
 * launch count: it is only ever used to be different from last time.
 */
let counter = readCounter();
writeCounter(counter + 1);

/** When the feed was last left. Null means it has not been left in this
 * sitting — the state a cold launch starts in, and the reason `enter()`
 * cannot start a second new sitting on top of the one above. */
let lastLeft: number | null = null;

/** The answered-ness each card was first seen with, sampled once per
 * SITTING. See world-feed.jsx's `sunk` for what it buys; what it buys HERE
 * is that a tab hop no longer spends it. */
const sunk = new Map<string, boolean>();

/** The deferrals in force when the sitting opened. Null until the feed
 * builds once, because the feed is what holds the deferral state — the
 * store is `world-feed.jsx`'s own `state.deferred`, and all this module
 * does is keep the snapshot alive across a mount. */
let held: Record<string, number> | null = null;

const subs = new Set<() => void>();
const notify = (): void => subs.forEach((f) => {
  try { f(); } catch { /* a broken listener must not stop the rest */ }
});

/** The current sitting's number. The rotation's only input. */
export function sitting(): number { return counter; }

/**
 * Entering the feed: a mount, or the app coming back to the foreground
 * with the feed already on screen. Returns whether this STARTED a new
 * sitting, so a caller can do the things a module cannot — scroll to the
 * top, drop a remembered offset.
 *
 * Idempotent within a sitting: called twice without a `leave()` between,
 * the second call answers false and changes nothing.
 */
export function enter(now: number = Date.now()): boolean {
  if (lastLeft == null || now - lastLeft < AWAY_MS) { lastLeft = null; return false; }
  lastLeft = null;
  counter += 1;
  writeCounter(counter + 1);
  sunk.clear();
  held = null;
  notify();
  return true;
}

/**
 * Leaving the feed: an unmount, or the app going to the background.
 *
 * Stamps the time and nothing else. The decision is `enter()`'s, because
 * leaving is not what ends a sitting — being away for a minute is, and
 * that is only knowable on the way back.
 *
 * The FIRST leave wins while away: a tab hop unmounts the feed (stamp),
 * then hiding the app fires again a moment later, and re-stamping would
 * restart the minute every time the phone did something. What is being
 * measured is time since the feed was last on screen.
 */
export function leave(now: number = Date.now()): void {
  if (lastLeft == null) lastLeft = now;
}

/** The sitting's answered snapshot — the live Map, by design: the feed
 * samples into it as cards are first seen. */
export function sunkMap(): Map<string, boolean> { return sunk; }

/** The sitting's deferral snapshot, taken from `take` the first time the
 * feed builds in this sitting and held until the sitting ends. */
export function heldAtBuild(take: () => Record<string, number>): Record<string, number> {
  if (!held) held = { ...take() };
  return held;
}

export function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** Test seam. The module's whole point is state that outlives a mount, so
 * a suite that could not reset it would carry one case's sitting into the
 * next — and every case here is about a boundary. */
export function __resetForTests(at = 0): void {
  counter = at;
  lastLeft = null;
  sunk.clear();
  held = null;
}

export default { AWAY_MS, sitting, enter, leave, sunkMap, heldAtBuild, subscribe };
