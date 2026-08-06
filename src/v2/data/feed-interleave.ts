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
  } = streams;
  const out: T[] = [];
  let ti = 0;
  let li = 0;
  let ki = 0;
  world.forEach((q, i) => {
    out.push(q);
    if (knowEvery && (i + 1) % knowEvery === 0 && ki < know.length) out.push(know[ki++]);
    if ((i + 1) % testEvery === 0 && ti < tests.length) out.push(tests[ti++]);
    if ((i + 1) % lensEvery === 0 && li < lenses.length) out.push(lenses[li++]);
  });
  // Mute every opinion topic and the knowledge stream should still be there —
  // it is a subscription of its own, not a garnish on the others.
  if (knowEvery && world.length < knowEvery) while (ki < know.length) out.push(know[ki++]);
  return out;
}
