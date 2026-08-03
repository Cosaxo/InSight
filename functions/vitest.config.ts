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
    // Report-only, scoped to the two modules whose branches ARE the privacy
    // guarantees: pure.ts holds the k-anon floor, complementary suppression
    // and the publish cadence (D7, D8, D18), and deviceBind.ts holds the
    // month rule (D29). An untested branch in either is where a number that
    // should have been withheld gets published — and "87 tests pass" cannot
    // tell you which branch that is, while a coverage report can.
    //
    // v2content.ts is excluded by omission: 6.1k lines of GENERATED question
    // data (check:content proves it matches /content byte for byte), so its
    // coverage number would measure how much of a data file the tests happen
    // to read. No thresholds, for the reason in the root vite.config.ts.
    coverage: {
      provider: "v8",
      include: ["src/pure.ts", "src/deviceBind.ts"],
      reporter: ["text", "html"],
    },
  },
});
