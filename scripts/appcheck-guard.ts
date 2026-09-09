// The one build-time refusal in this repo, lifted out of vite.config.ts so
// that it can be executed by something other than a release.
//
// WHAT IT GUARDS. App Check is the only control standing between the public
// surface and unlimited free anonymous accounts (D3). src/lib/appcheck.ts
// silently skips init on web when no reCAPTCHA site key is set — deliberate,
// so contributors need not provision their own registration for dev. The
// failure mode is that a PRODUCTION web build inherits that skip and ships
// unattested, and nothing says so until enforcement is flipped on in the
// console and every web client fails at once.
//
// WHY IT IS ITS OWN MODULE. Inline in vite.config.ts, the condition could
// only ever run during a build, and no build in this repo could reach it:
//
//   ci.yml       typecheck-build  → VITE_FIREBASE_API_KEY is never set, so
//                                   the `env.VITE_FIREBASE_API_KEY &&` term
//                                   short-circuits and the throw is dead
//   ios-release  CAPACITOR_BUILD=1 → a native build, correctly exempt
//   screenshots  CAPACITOR_BUILD=1 → likewise
//
// So the guard was unreachable everywhere, while ci.yml's own comment said
// of CAPACITOR_BUILD that "setting it here would waive a guard this job
// wants enforced". That comment was right about the variable and wrong about
// the outcome. A predicate in a module is testable in both directions for
// nothing, which is what appcheck-guard.test.ts does.

export interface BuildEnv {
  /** Vite's mode — only "production" is gated. */
  mode: string;
  /** CAPACITOR_BUILD=1. Native uses DeviceCheck / Play Integrity (D3). */
  isNativeBuild: boolean;
  /** VITE_FIREBASE_API_KEY. Absent means a mock-mode build, which needs nothing. */
  apiKey?: string;
  /** VITE_APPCHECK_RECAPTCHA_SITE_KEY. */
  siteKey?: string;
  /** VITE_APPCHECK_DEBUG. Any non-empty value arms the debug provider. */
  debug?: string;
}

/**
 * True when this build would ship a web bundle that talks to a real Firebase
 * project with no App Check attestation — the one case that must not build.
 */
export function shipsUnattested({ mode, isNativeBuild, apiKey, siteKey }: BuildEnv): boolean {
  if (mode !== "production") return false;
  // A native build is fine without the key: iOS and Android use DeviceCheck
  // and Play Integrity and never consult it.
  if (isNativeBuild) return false;
  // Mock-mode builds have no project to attest to.
  if (!apiKey) return false;
  return !siteKey;
}

/**
 * True when this build would carry the App Check DEBUG provider — which is a
 * bypass, not an attestation: whoever holds the token gets past App Check on
 * every request, and revoking it is a console action nobody watching a store
 * build would think to take.
 *
 * The second refusal, added when src/lib/appcheck.ts learned to run the debug
 * provider on web WITHOUT a site key. Before that change the two guards were
 * the same guard — no key meant no App Check at all, and `shipsUnattested`
 * caught it. Now a build can have no key and still initialise, so the shape
 * that ships a bypass is reachable and needs its own refusal. A change that
 * opens a hole pays for it in the same commit.
 *
 * NO EXEMPTIONS BEYOND MODE, deliberately, and the native one is the tempting
 * one to add: on iOS and Android the plugin takes its debug token from
 * platform environment variables rather than from this one, so `CAPACITOR_BUILD=1`
 * looks like it makes the flag inert. It does not make it inert for the build
 * that matters — the screenshot job sets that variable and runs the result in
 * a BROWSER, on the web path, which is exactly where the bypass is real. An
 * exemption whose reasoning is false for its own biggest user is worse than no
 * exemption, so the capture build carries its own `--mode` instead.
 */
export function shipsDebugToken({ mode, debug }: BuildEnv): boolean {
  if (mode !== "production") return false;
  return Boolean(debug);
}

export const DEBUG_TOKEN_MESSAGE =
  "Production build has VITE_APPCHECK_DEBUG set. The App Check debug "
  + "provider is a bypass, not an attestation — every client built this way "
  + "gets past App Check, and anyone holding the token can too. Unset it, or "
  + "build with a non-production --mode if this bundle is not for users "
  + "(the screenshot job does exactly that).";

export const UNATTESTED_MESSAGE =
  "Production web build has Firebase configured but no "
  + "VITE_APPCHECK_RECAPTCHA_SITE_KEY. The client would ship without App "
  + "Check attestation and start failing the moment enforcement is "
  + "enabled. Set the key, or set CAPACITOR_BUILD=1 for a native bundle "
  + "(DeviceCheck / Play Integrity need no site key).";
