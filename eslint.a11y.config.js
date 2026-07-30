// Accessibility rules, kept OUT of the main eslint config on purpose.
//
// `npm run lint` carries `--max-warnings 0`, which is load-bearing: four
// hook warnings had become background noise once, so the next one would have
// landed silently. That leaves no "warn" tier to put a11y findings in — they
// would either fail the build on day one or need a blanket disable, and
// src/v2/README.md is explicit that a blanket disable is the failure mode
// this repo has already been bitten by.
//
// So they run as their own gate, `npm run check:a11y`, which ratchets:
// the current findings are recorded per file and the check fails when a file
// gains one. See scripts/check-a11y.mjs for why a ratchet rather than a
// clean sweep.
//
// This config is deliberately jsx-a11y ONLY. It does not extend the main
// config — running the whole rule set twice would double CI time to
// re-report what `npm run lint` already covers.

import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { collectSpecGlobals } from './scripts/spec-globals.mjs'

// The spec layer's shared-global names, from the same scanner the main
// config and check:globals use. Without them the parse is fine but every
// bare cross-module reference reads as undefined, which is noise here.
const { defined: SPEC_GLOBALS, RUNTIME_ALLOWLIST } = collectSpecGlobals()
const specGlobals = Object.fromEntries([
  ...[...SPEC_GLOBALS].map((n) => [n, 'readonly']),
  ...[...RUNTIME_ALLOWLIST].map((n) => [n, 'readonly']),
])

export default defineConfig([
  globalIgnores(['dist', 'functions/lib', 'design']),
  // The ported layer: plain JSX, espree parses it.
  {
    files: ['src/**/*.jsx'],
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...specGlobals },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // The hand-written panels. A SEPARATE block because they need the
  // TypeScript parser — and this is not a detail.
  //
  // The first version of this config matched `src/**/*.{jsx,tsx}` under
  // espree alone. Every .tsx then failed to parse, and a parse failure
  // reports as a fatal message with `ruleId: null`, which the ratchet's
  // "only count jsx-a11y/*" filter discarded. The result read as
  // "src/v2/ui has zero accessibility findings" when the truth was that
  // nothing had looked at it. check-a11y.mjs now fails on any fatal message
  // for exactly that reason.
  {
    files: ['src/**/*.tsx'],
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...specGlobals },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
])
