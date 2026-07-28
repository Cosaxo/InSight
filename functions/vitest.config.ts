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
  },
});
