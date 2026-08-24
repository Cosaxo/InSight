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
      // `// @vitest-environment jsdom` docblock instead — the mount suites
      // (`test/smoke-*.test.jsx`) and the panel suites carry it.
      //
      // setupFiles runs for ALL of them, so it must stay a no-op outside
      // jsdom — see the guard at the top of the file.
      setupFiles: ['./src/v2/test/setup-dom.ts'],
      // Worker threads, not child processes — and this is a bug fix, not
      // a preference.
      //
      // On the default `forks` pool, `test:unit` exits 1 with 779/779
      // PASSED and one unhandled
      // `[vitest-worker]: Timeout calling "onTaskUpdate"`. A green suite
      // reported as a failure is the worst shape a gate can take: the
      // next person to see it reaches for the re-run button, and the
      // button eventually works, and the gate quietly stops meaning
      // anything.
      //
      // WHY IT HAPPENS. `onTaskUpdate` is not in the fire-and-forget
      // `eventNames` list (vitest/dist/chunks/rpc.*.js), so a worker
      // AWAITS an ack for every task-state change. The forks pool
      // carries that over Node's child-process IPC — `process.send` and
      // a serialized pipe — and `smoke.test.jsx` mounts the whole spec
      // layer 35 times for ~85 s of an ~87 s run. Under that load the
      // pipe backs up and an ack misses its window. The threads pool
      // uses a MessageChannel instead and does not.
      //
      // MEASURED, not reasoned about: forks failed 3/3 locally (and
      // twice on CI), threads passed 2/2 on the same tree, same machine,
      // same minute. Two cheaper candidates were tried first and BOTH
      // FAILED, which is why neither is here — `--reporter=dot` (the
      // ack is sent whatever the reporter does) and capping the pool to
      // two workers, which made it worse by lengthening the run and is
      // what first reproduced it off CI.
      //
      // The honest cost: threads share a process, so a test that leaks a
      // global leaks it further than it used to. Nothing in this suite
      // does — jsdom is per-file via the environment docblock — but if a
      // strange cross-file failure ever appears, start here.
      pool: 'threads',
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
      // `test:coverage` runs the WHOLE of `--dir src`, and only the
      // `include` below scopes what is reported. It ran `--dir src/v2/data`
      // until 2026-08-24, on the ground that v8 instrumentation triples the
      // mount tests and the full run would fail on time rather than on
      // truth. That was true, and it had exactly one cause: `learn-reserve`'s
      // D95 case spent ~10 s of its 15 s budget in a `growFeed` loop that
      // could not converge (see src/v2/test/mount-app.jsx). With that fixed
      // the instrumented run completes — measured, 129 files and 1921 tests
      // green under `--coverage`.
      //
      // The old scope was ALSO reporting the wrong numbers, which is why
      // widening it matters more than the tidiness. A data module exercised
      // by a `ui/` or `test/` suite scored only what its own tests reached:
      // 11 of 45 modules read 5+ points low, `mutes.ts` read 0% against a
      // real 81.5%, and `patternsReady.ts` — the D265 gate — read 64%
      // against 96%. A report that names the wrong branch sends the next
      // person to write a test for code that already has one.
      coverage: {
        provider: 'v8',
        include: ['src/v2/data/**/*.ts'],
        reporter: ['text', 'html'],
      },
    },
  }
})
