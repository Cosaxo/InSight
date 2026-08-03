import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // App Check is the only control standing between the public surface and
  // unlimited free anonymous accounts (D3). src/lib/appcheck.ts silently
  // skips init on web when no reCAPTCHA site key is set — deliberate, so
  // contributors need not provision their own registration for dev. The
  // failure mode is that a PRODUCTION web build inherits that skip and
  // ships unattested, and nothing says so until enforcement is flipped on
  // in the console and every web client fails at once.
  //
  // A native build is fine without the key: iOS and Android use
  // DeviceCheck / Play Integrity and never consult it. So this only
  // guards web, and CAPACITOR_BUILD=1 opts a native bundle out.
  const isNativeBuild = env.CAPACITOR_BUILD === '1'
  if (
    mode === 'production' &&
    !isNativeBuild &&
    env.VITE_FIREBASE_API_KEY &&           // mock-mode builds need nothing
    !env.VITE_APPCHECK_RECAPTCHA_SITE_KEY
  ) {
    throw new Error(
      'Production web build has Firebase configured but no '
      + 'VITE_APPCHECK_RECAPTCHA_SITE_KEY. The client would ship without App '
      + 'Check attestation and start failing the moment enforcement is '
      + 'enabled. Set the key, or set CAPACITOR_BUILD=1 for a native bundle '
      + '(DeviceCheck / Play Integrity need no site key).',
    )
  }

  return {
    plugins: [react()],
    define: {
      // Integer build number compared against v2_meta/app.{latestBuild,
      // minBuild} for the in-app update prompts. Bump `appBuild` in
      // package.json with every store release.
      __APP_BUILD__: JSON.stringify(pkg.appBuild ?? 0),
    },
    test: {
      // Most of `--dir src` is pure logic and wants no DOM — a global
      // jsdom environment would slow every one of those files down for
      // the sake of one. Files opt in with the
      // `// @vitest-environment jsdom` docblock instead; smoke.test.jsx
      // is the only one today.
      //
      // setupFiles runs for ALL of them, so it must stay a no-op outside
      // jsdom — see the guard at the top of the file.
      setupFiles: ['./src/v2/test/setup-dom.ts'],
      // Coverage is REPORT-ONLY and deliberately scoped, not a gate.
      //
      // What it is for: src/v2/data is pure, typed, and holds the client
      // half of the honesty rules — the deck shaping, the k-floor display
      // logic, the group-portrait arithmetic. An untested branch there is
      // where a wrong number reaches a screen, and a coverage report names
      // which branch, which no amount of test-counting does.
      //
      // spec/ is EXCLUDED on purpose. It is ~22k lines of ported JSX whose
      // only tests are mount smoke tests (src/v2/README.md), so its number
      // would be both meaningless and an invitation to write assertions
      // that raise it without asserting anything — which the panel-test
      // section of that README records three first drafts already doing.
      // A metric you cannot act on honestly is worse than no metric.
      //
      // No thresholds. A threshold turns a report into a gate, and a gate
      // on a number nobody has calibrated fails a legitimate PR before it
      // catches a real gap. Read `npm run test:coverage` when changing the
      // data layer; raise it to a gate only with a number that came from
      // looking at the report first.
      //
      // `test:coverage` runs `--dir src/v2/data`, NOT the whole of `--dir
      // src` that `test:unit` covers, and that is a timeout fact rather than
      // a preference: v8 instrumentation roughly triples the mount tests, and
      // two smoke-live cases already sit at 8-9 s against a 15 s limit, so
      // the full run fails on time rather than on truth. Scoping to the data
      // tests also makes the number the honest one — "what the data layer's
      // own tests reach", not what a mount test incidentally walks through.
      coverage: {
        provider: 'v8',
        include: ['src/v2/data/**/*.ts'],
        reporter: ['text', 'html'],
      },
    },
  }
})
