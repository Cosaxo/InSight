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
  }
})
