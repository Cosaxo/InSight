// The feed's three-stream interleave, extracted so the arithmetic has one
// home and the test exercises the SHIPPED loop.
//
// WHY IT IS OUT HERE. The cadences went wrong once in a way nothing else
// could catch. It shipped as:
//
//   if ((i + 1) % 4 === 0 && ti < tqs.length) push(tqs[ti++]);
//   else if ((i + 1) % 8 === 0 && li < lqs.length) push(lqs[li++]);
//
// Every multiple of 8 is a multiple of 4, so the `else` was unreachable and
// not one lens question ever entered the feed. Nothing failed: tsc, eslint
// and check:globals were all happy and the feed rendered a perfectly good
// list of cards. The only symptom was five missing cards out of sixty-three.
//
// D11 recorded that "the regression cannot come back quietly", and D42 cited
// the extraction as done. It was not: feed-interleave.test.ts declared its
// own TEST_EVERY/LENS_EVERY and its own copy of the loop, so all nine
// assertions exercised the test file. Meanwhile the shipped loop grew a
// THIRD stream — the knowledge cadence (D32) — that the copy never modelled,
// so the copy and the code had already diverged in exactly the direction the
// copy existed to prevent. `.jsx` arithmetic is covered by no gate at all.
//
// Two independent `if`s, and 9 rather than 8, are both load-bearing: 9 is
// coprime with 4, so the two cadences drift past each other instead of
// colliding. The knowledge stream keeps its own independent cadence for the
// same reason.

/** One feed card every this many world questions, per stream. */
export const TEST_EVERY = 4;
export const LENS_EVERY = 9;

/**
 * Where the ONE Crossroads story card sits, counted in feed cards (D340).
 *
 * It held a pinned slot at the head of the feed from D136 until the owner
 * asked for it to ride the stream like everything else. world-feed deals
 * it in ahead of the card at this index — past the first screenful, inside
 * the first window (WF_PAGE), and short of the paid slot (SPONSOR_AT, 6)
 * so the two never stack. A feed too short to reach the slot shows the
 * card at its end instead — the paid slot's own fallback shape, for the
 * same reason: a short feed still holds one story. The constant lives
 * here, beside the cadences, so the test that pins the placement and the
 * render that performs it cannot disagree about the number.
 */
export const PATHS_AT = 5;

/**
 * Stable partition: everything the viewer has NOT answered in `fresh`,
 * everything they have in `done`, each half keeping its incoming order.
 *
 * WHY. The live bank is finite and served in a deterministic order, so
 * without this every session opened on the same head of cards — the ones
 * the user answered first — as a wall of results, with everything fresh
 * buried beneath it. The release feedback came twice and escalated: first
 * "I keep seeing things I have answered" (which sank the done half below
 * the fresh half), then "answered questions shouldn't appear in the feed
 * at all — there should always be fresh questions". So the feed now
 * renders `fresh` alone and parks `done` behind an expander at the
 * bottom — still a partition, never a filter that loses cards, because
 * the answered cards ARE the record (results, takes, and the D86 change
 * affordance all live on them).
 *
 * The caller decides WHEN answered-ness is sampled. world-feed freezes it
 * per mount, so a card answered mid-scroll keeps its place until the next
 * visit — dropping it under the user's thumb would vanish the card whose
 * reveal they are watching.
 */
export function partitionAnswered<T>(
  list: readonly T[],
  isAnswered: (q: T) => boolean,
): { fresh: T[]; done: T[] } {
  const fresh: T[] = [];
  const done: T[] = [];
  for (const q of list) (isAnswered(q) ? done : fresh).push(q);
  return { fresh, done };
}

export interface InterleaveStreams<T> {
  /** The core tests' questions. */
  tests: readonly T[];
  /** The minor lenses' questions. */
  lenses: readonly T[];
  /** The knowledge stream (D32); `knowEvery` of 0 disables it. */
  know?: readonly T[];
  knowEvery?: number;
  testEvery?: number;
  lensEvery?: number;
  /**
   * The ONE sponsored card, or null (D195).
   *
   * A single card rather than a stream, and that is the design rather than
   * a simplification: the cap on paid inventory is what makes a slot
   * sellable at all (docs/SCALE-PLAN.md §5 — naming a cohort's attention
   * as finite makes the cap the unit of sale, so inventory cannot be
   * quietly inflated without visibly devaluing what was already sold).
   * `data/sponsored.ts` picks it; this only places it.
   */
  sponsored?: T | null;
  /** Which world card it lands after. */
  sponsorAt?: number;
}

/**
 * Weave the side streams into the sorted world list.
 *
 * Order inside a slot is knowledge, then test, then lens — the order the
 * feed has always pushed them in, kept because a card's position is what a
 * returning user recognises.
 */
export function interleaveFeed<T>(world: readonly T[], streams: InterleaveStreams<T>): T[] {
  const {
    tests, lenses, know = [], knowEvery = 0,
    testEvery = TEST_EVERY, lensEvery = LENS_EVERY,
    sponsored = null, sponsorAt = 0,
  } = streams;
  const out: T[] = [];
  let ti = 0;
  let li = 0;
  let ki = 0;
  let paidPlaced = false;
  world.forEach((q, i) => {
    out.push(q);
    // The paid slot fires ONCE, at a fixed depth, before the side streams'
    // cadences — a card that could land twice is inventory the seller did
    // not sell and the reader did not agree to.
    if (sponsored && !paidPlaced && i + 1 >= sponsorAt) { out.push(sponsored); paidPlaced = true; }
    if (knowEvery && (i + 1) % knowEvery === 0 && ki < know.length) out.push(know[ki++]);
    if ((i + 1) % testEvery === 0 && ti < tests.length) out.push(tests[ti++]);
    if ((i + 1) % lensEvery === 0 && li < lenses.length) out.push(lenses[li++]);
  });
  // Mute every opinion topic and the knowledge stream should still be there —
  // it is a subscription of its own, not a garnish on the others.
  if (knowEvery && world.length < knowEvery) while (ki < know.length) out.push(know[ki++]);
  // A world list shorter than the slot depth still owes the buyer their
  // card — the alternative is a window that silently delivers nothing to
  // anyone with a heavily muted feed, which is the measurement asymmetry
  // billing-on-answers exists to avoid. It lands at the end, not at the
  // top: a paid card must never be the first thing in the stream.
  if (sponsored && !paidPlaced) out.push(sponsored);
  return out;
}

/**
 * Round-robin a pool across the instrument each item belongs to (D155).
 *
 * WHY THIS EXISTS. The four core tests are filled passively, by marked
 * cards woven into the feed — and the live pool arrived in BANK order.
 * `content/tests.json` is keyed by instrument, so the generator emits all
 * 25 Big Five items, then 30 Politics, then 30 Values, then 25 Social, and
 * the feed serves them in that order. Twenty-five marked cards in, a real
 * account had one instrument filling and three at absolute zero — which is
 * exactly what a device reported, and what the profile sheet showed: one
 * bar with progress and three empty.
 *
 * The demo pool never had the bug: spec/test-feed-data.js round-robins its
 * four lists as it builds them. This is that loop, in one place both sides
 * can share, applied to the pool the live store publishes.
 *
 * DETERMINISTIC and order-preserving WITHIN an instrument: the pool is
 * rebuilt on every feed render, so a shuffle would move a card out from
 * under a thumb. Items whose key is missing keep their relative order and
 * ride in a group of their own rather than being dropped — the pool is
 * content, and content nobody classified is still content.
 */
export function roundRobinBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const g = groups.get(k);
    if (g) g.push(item);
    else groups.set(k, [item]);
  }
  // Insertion order, which is bank order — so the FIRST card of a fresh
  // account is still the bank's first, and only what follows it changes.
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}
