import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
  // through the shared global scope by design, so no-undef would fire
  // on every cross-module reference — off. no-unused-vars stays off
  // for the same reason: modules "export" by defining globals the
  // linter can't see being consumed. Everything else (hooks rules,
  // no-dupe-keys, no-unreachable, …) applies.
  {
    files: ['src/v2/**/*.{js,jsx}'],
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
      'no-undef': 'off',
      'no-unused-vars': 'off',
      // The spec layer round-trips UI state through window globals by
      // design (__profileSub etc.) — the compiler-strict immutability
      // rule flags every such write. Typed code (ts/tsx) keeps it on.
      'react-hooks/immutability': 'off',
    },
  },
])
