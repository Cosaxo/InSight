// The Learn mode's card bank, and which build's version of it the engine
// gets (D280). `testFeed.ts`'s shape, one surface over, for a related
// reason and a different cause.
//
// WHY IT EXISTS. `spec/learn-data.js` imported the whole of
// `content/learn-questions.json`, so every learn card was compiled into the
// JavaScript. Measured 2026-08-24: 146 cards were 33 KiB inside a 34.5 kB
// chunk, and `check:bundle`'s total budget had ~13 kB left — about
// thirty-nine more cards, against a lane whose own target is 288. The build
// would have failed roughly a fortnight out, naming the bundle rather than
// the bank, and nothing connected the two.
//
// So the bundle carries a FIXED demo sample now (`content/learn-sample.json`,
// five cards a field, generated) and a live build reads the seeded bank,
// which `hydrate()` has already fetched — no extra read, and the bundle
// stops tracking the bank's size at all.
//
// WHY THE ENGINE CANNOT JUST READ `state.learnBank`. `spec/` may import
// `data/`, never the reverse, and `learn-progress.js` builds its indexes at
// module scope, long before a live boot has fetched anything. So the store
// PUBLISHES here and the engine SUBSCRIBES — the same direction, and the
// same "a cast onto `window` is a seam no scanner can read" lesson, that
// D276 paid for.
//
// The subscription is the part `testFeed.ts` does not need: the feed asks
// for its pool every time it rebuilds, while the learn engine indexes once
// and holds it. A live bank arriving after that has to be able to say so.

/**
 * A learn card as the engine wants it — the authored shape, which is what
 * `content/learn-questions.json` holds and what the seed now carries.
 *
 * `c` and `t` are indexes into `a`, and they are the whole reason this
 * type exists rather than the bank's `QuestionDoc`: a seeded document is
 * `{ prompt, options, topic }` in the bank's vocabulary, and the engine
 * speaks `{ q, a, f }`. The translation lives at the publisher (live.ts),
 * so nothing downstream has to know there are two spellings.
 */
export interface LearnCard {
  /** The card's own id — `cell1`, NOT the bank's `learn-cell1`. */
  id: string;
  /** Field id: `cell`, `solar`, … */
  f: string;
  q: string;
  a: string[];
  /** Index of the correct option. */
  c: number;
  /** Index of the trap — the wrong answer people actually pick. */
  t: number;
  /** Authored difficulty: the % of the crowd expected to get it right. */
  p: number;
  /** The fact in a few words — the label its dot wears on the map. */
  k: string;
  /** One line of why, only where the fact is counter-intuitive. */
  w?: string;
}

// Null until a live build publishes, which is the whole state machine: a
// demo build never calls the publisher, so the sample the caller passes is
// what it gets, and there is no build flag to keep in step.
let livePool: LearnCard[] | null = null;
const listeners = new Set<() => void>();

/**
 * Hand the engine the bank's cards. Called once per hydrate, from
 * `buildFeedGlobals()`.
 */
export function publishLearnBank(cards: LearnCard[]): void {
  livePool = cards;
  notify();
}

/**
 * The cards this build should serve: the live bank where one has been
 * published, the caller's demo sample otherwise.
 *
 * `??` and not `||`: a live bank with no learn documents must serve
 * NOTHING, not fall through to the sample. That is the state a project
 * seeded before Learn existed is actually in, and the fallback would put
 * sixty demo cards on a real device with no aggregate behind any of them.
 */
export function learnCards(demo: LearnCard[]): LearnCard[] {
  return livePool ?? demo;
}

/**
 * Told when the pool changes. The engine indexes its cards once at module
 * scope — before any live boot has fetched a thing — so it needs to be
 * woken rather than polled.
 */
export function subscribeLearnBank(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Drop back to the demo sample. Only the test fixtures need this. */
export function resetLearnBank(): void {
  livePool = null;
  notify();
}

function notify(): void {
  listeners.forEach((f) => {
    // One listener throwing must not swallow the change for the others —
    // the rule every other store in this tree follows.
    try { f(); } catch { /* a dead listener is not the publisher's problem */ }
  });
}
