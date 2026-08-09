// The aggregate floor and publish cadence — CLIENT COPY of AGG_MIN_N and
// PUBLISH_EVERY in functions/src/v2.ts. The two constants live in different
// tsconfig projects, so no compiler can relate them; floor.test.ts reads
// both source files and fails on drift, the same pattern LiveCohortBody's
// printed-floor test established. These numbers are SHOWN to users and
// shape what the copy may claim, so drift here is a lie about the floor
// rather than a cosmetic bug.
//
// Both sit at 1 while D81's launch pause holds (counts publish from the
// first answer, exactly, per answer). When the pause ends they return to 5
// with the server's — the drift test names this file in that commit.
export const AGG_FLOOR = 1;
export const AGG_PUBLISH_EVERY = 1;

// While the cadence is 1 the published total is exact, so surfaces that
// append "+" to mark a batched lower bound must not (a "12+" over an exact
// 12 claims an inaccuracy that is not there). When the cadence returns to
// 5 this flips back and the "+" becomes the honest reading again.
export const AGG_COUNT_IS_EXACT = AGG_PUBLISH_EVERY === 1;
