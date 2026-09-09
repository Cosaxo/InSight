// Vitest config for the backend tests.
//
// Exists to STOP the upward config search. Without a config file here,
// vitest walks up from functions/ and loads the repo root's
// vite.config.ts — which imports `vite` and `@vitejs/plugin-react`. That
// works on a dev machine where the root deps happen to be installed, and
// fails in CI's functions-build job, which installs only `functions/`:
//
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite'
//
// The backend tests are pure TypeScript over pure functions; they have no
// business loading the client's bundler config at all.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Report-only, scoped to two modules whose branches decide what a
    // published number SAYS: pure.ts holds the breakdown cap and the canon
    // fold, and deviceBind.ts holds D29's month rule. An untested branch in
    // either is a wrong number published rather than a crash — and "539
    // tests pass" cannot tell you which branch, while a coverage report can.
    //
    // THE SCOPE'S OLD REASON IS GONE, and it is worth saying so rather than
    // quietly editing it: this read "the two modules whose branches ARE the
    // privacy guarantees: pure.ts holds the k-anon floor, complementary
    // suppression and the publish cadence (D7, D8, D18)". D98 retired all
    // three — pure.ts now says in its own words "NO SUPPRESSION OF ANY KIND
    // (D98) … there is no floor and no cadence", and the fold "can no
    // longer return null: there is nothing left that can suppress". So the
    // argument that picked these two files and excluded everything else no
    // longer holds, and whether money (paid.ts) or the moderation queue
    // belongs in scope is an open question, not a settled one.
    //
    // v2content.ts is excluded by omission: a large GENERATED question bank
    // (check:content proves it matches /content byte for byte), so its
    // coverage number would measure how much of a data file the tests
    // happen to read. The line count that used to sit here said "6.1k" for
    // a file of ~14,000 — a hand-kept figure inside the argument it
    // supports, which is this repo's most-repeated documentation error, so
    // it is now stated without one. No thresholds, for the reason in the
    // root vite.config.ts.
    coverage: {
      provider: "v8",
      include: ["src/pure.ts", "src/deviceBind.ts"],
      reporter: ["text", "html"],
    },
  },
});
