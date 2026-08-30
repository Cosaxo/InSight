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
  //
  // coverage/ is the same class and bites harder: v8's HTML reporter ships
  // its own prettify/sorter scripts carrying eslint-disable comments, so
  // `npm run lint` (which runs --report-unused-disable-directives) fails on
  // vendored files nobody wrote — and only on machines that have run
  // test:coverage. Gitignoring them is not enough; eslint does not read
  // .gitignore.
  globalIgnores(['dist', 'functions/lib', 'coverage', 'functions/coverage']),
  // Node tooling: the guard-rail scripts, the emulator suites, and the flat
  // configs themselves. Measured with eslint's own resolver, every file
  // under scripts/ resolved to ZERO rules while src/lib/firebase.ts got 106
  // — so `--max-warnings 0` said nothing at all about the code whose whole
  // job is saying things about other code.
  //
  // Browser globals as well as node: gen-screenshots.mjs and
  // gen-feature-graphic.mjs pass callbacks to page.evaluate(), which runs
  // them in the page. Without them that is six false no-undef errors and a
  // red CI for code that is correct.
  {
    files: [
      'scripts/**/*.mjs',
      'firestore-tests/**/*.mjs',
      '*.config.js',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
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
  // The dev-only tweaks panel. Ordinary ESM JSX — outside the spec layer's
  // global bridge, and outside src/v2, which is the only JS/JSX glob any
  // block below names. So it resolved to ZERO rules, for exactly the reason
  // scripts/ did before the block above existed: `npm run lint` walked it,
  // reported nothing, and said nothing. Measured with eslint's own resolver
  // ("File ignored because no matching configuration was supplied").
  //
  // Not folded into the spec-layer block underneath: that one seeds the
  // shared globals and switches `no-unused-vars` off because a spec module
  // exports by publishing a name. Neither is true here, and both would cost
  // this file the two rules most likely to catch something in it.
  {
    files: ['src/dev/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // OFF, and for a reason that is not the spec layer's. The base
      // `no-unused-vars` does not count a name used as a JSX TAG — that
      // takes eslint-plugin-react's `jsx-uses-vars`, which this repo does
      // not carry (the .tsx block gets it free from typescript-eslint's
      // own scope analysis). With it on, this file reports seven
      // components as unused while five of them render inside the ones
      // above; every report would be false. Everything else applies —
      // no-undef, the hooks rules, no-dupe-keys, no-unreachable — and
      // those are the rules with something to catch here. Adding
      // eslint-plugin-react is what turns this back on.
      'no-unused-vars': 'off',
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
