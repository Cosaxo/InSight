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

export const UNATTESTED_MESSAGE =
  "Production web build has Firebase configured but no "
  + "VITE_APPCHECK_RECAPTCHA_SITE_KEY. The client would ship without App "
  + "Check attestation and start failing the moment enforcement is "
  + "enabled. Set the key, or set CAPACITOR_BUILD=1 for a native bundle "
  + "(DeviceCheck / Play Integrity need no site key).";
