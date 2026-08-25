// The feed's test-card pool, and which build's version of it the feed gets.
//
// WHAT WENT WRONG, because this module exists only to stop it happening
// again. `spec/test-feed-data.js` builds the DEMO test pool: each core
// test's own items, with option counts synthesized from a hash of the
// question id (`260 + w * 2600`, so a card totals somewhere near 10k
// invented votes). `data/live.ts` builds the LIVE one out of the seeded
// bank, with counts that are the published aggregate. For as long as the
// feed read `window.TEST_FEED_QS`, the second simply overwrote the first
// at hydrate and a live device saw real numbers.
//
// D249 took `world-feed.jsx` off the shared-global bridge and converted
// that read to a static `import { TEST_FEED_QS } from './test-feed-data.js'`.
// The conversion was correct about the spec layer — no spec module reads
// the name — and blind to the fact that the PROVIDER was `live.ts`, whose
// write is a `(window as unknown as Record<string, unknown>)` cast that no
// scanner can see. An ESM binding cannot be reassigned from outside its
// module, so the live pool stopped arriving: a live build served the demo
// cards, with fabricated counts, invented takes keyed to the demo ids
// (`tq-political-8` in `world-feed-comments.js`), and no `live: true` — so
// every gate that keys on that flag stood down as well. Reported from a
// device as "there seems to be sample data shown for how many answered
// different options", which is exactly what it was, and exactly what D1
// forbids.
//
// WHY A MODULE AND NOT THE GLOBAL BACK. `check:globals` rule 4 only ever
// moves down, and re-adding the bridge read would raise it to buy back a
// seam that an import expresses better. The direction is the one the tree
// already has — `spec/` imports `data/`, never the reverse — so the
// override lives here, in `data/`, and both ends reach it by name:
// `live.ts` publishes, `world-feed.jsx` asks. `topicSheet.ts` is the same
// shape for the same reason (D190).
//
// WHY IT TAKES THE DEMO POOL AS AN ARGUMENT rather than importing it.
// `data/` cannot import the spec layer, and the fallback belongs to the
// caller anyway: the demo pool is what a demo build IS, not a default this
// module should hold an opinion about.

/**
 * The shape both pools agree on. Deliberately loose — the feed reads more
 * than this off a card, and the two builds carry different extras (`live`
 * and the aggregate-derived counts on one side, nothing on the other).
 * What this module promises is only that a pool is a list of cards with an
 * id and an instrument key, which is all it has to know to hand one over.
 */
export interface TestFeedCard {
  id: string;
  // `string | null` and not just `string`: a bank doc's `test` is null on
  // every surface but this one (QuestionDoc), and the store hands the
  // mapped row straight through rather than re-narrowing a field it has
  // already filtered on.
  test?: string | null;
  [k: string]: unknown;
}

// Null until a live build publishes, which is the whole state machine: a
// demo build never calls the publisher, so the demo pool is what
// `testFeedPool` hands back, and there is no build flag to keep in step.
let livePool: TestFeedCard[] | null = null;

/**
 * Hand the feed the bank's test items. Called from `buildFeedGlobals()`
 * once per hydrate — and the feed does not render at all in a live build
 * until `LIVE.feedReady` (daily-split.jsx), which is set on the line after
 * it, so there is no window in which the demo pool can reach a live
 * screen.
 */
export function publishTestFeed(qs: TestFeedCard[]): void {
  livePool = qs;
}

/**
 * The pool this build should serve: the live one where it has been
 * published, the caller's demo pool otherwise.
 */
export function testFeedPool(demo: TestFeedCard[]): TestFeedCard[] {
  return livePool ?? demo;
}

/**
 * Drop back to the demo pool. Only the test fixtures need this — nothing
 * in the app un-publishes, because nothing in the app un-hydrates.
 */
export function resetTestFeed(): void {
  livePool = null;
}
