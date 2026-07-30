import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { collectSpecGlobals } from './scripts/spec-globals.mjs'

// The spec layer's globals, scanned from the source rather than
// hand-listed — the same scan check:globals runs. Seeding no-undef with
// these is what lets the rule be ON for ~18.5kLOC of shared-global JSX.
const { defined: SPEC_GLOBALS, RUNTIME_ALLOWLIST } = collectSpecGlobals()
const specGlobals = Object.fromEntries([
  ...[...SPEC_GLOBALS].map((n) => [n, 'readonly']),
  ...[...RUNTIME_ALLOWLIST].map((n) => [n, 'readonly']),
])

export default defineConfig([
  // functions/lib is tsc output — linting generated JS reports errors no
  // one can fix in source, and only on machines that have built functions.
  globalIgnores(['dist', 'functions/lib']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // The ported spec layer (src/v2/spec + its loaders). Files talk
  // through the shared global scope by design, so a bare cross-module
  // reference is normal here and eslint cannot resolve one on its own.
  //
  // The answer is NOT to switch the rules off — it is to tell eslint
  // what the globals are. `specGlobals` above seeds them from the same
  // scanner check:globals uses, which is what lets `no-undef` stay ON
  // (see the rules block below, and the note there before touching it).
  //
  // `no-unused-vars` is the one that genuinely cannot work: modules
  // "export" by defining globals the linter never sees consumed, so
  // every one of them reads as unused. Everything else — hooks rules,
  // no-dupe-keys, no-unreachable, … — applies.
  //
  // This comment used to say no-undef was off, and said it for as long
  // as the line below has read 'error'. If you change one, change both.
  {
    files: ['src/v2/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...specGlobals },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // ON, seeded from the scanner above. It was off because every
      // cross-module reference in this layer is a bare identifier that
      // eslint could not know about — but that also meant nothing caught
      // a genuinely undefined one. Two ReferenceErrors (ReactDOM at six
      // createPortal sites; a bare `sign` in the profile editor) and a
      // dead <GroupLevelTab> shipped behind that `off`.
      //
      // If this starts firing on a legitimate global, the fix is to make
      // the scanner see it — not to add an exception here. A name eslint
      // cannot find is one check:globals cannot find either, and that is
      // the actual bug.
      'no-undef': 'error',
      'no-unused-vars': 'off',
      // The spec layer round-trips UI state through window globals by
      // design (__profileSub etc.) — the compiler-strict immutability
      // rule flags every such write. Typed code (ts/tsx) keeps it on.
      'react-hooks/immutability': 'off',
    },
  },
])
