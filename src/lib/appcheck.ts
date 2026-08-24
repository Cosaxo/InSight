// appcheck.ts — Firebase App Check init.
//
// What App Check is for: signing every Firebase request (Firestore,
// Auth-callable Functions, etc.) with an attestation proving the
// call came from a legitimate build of our app, not a script
// pulling our config out of the JS bundle and replaying requests
// against the project.
//
// Enforcement status: the user-facing callables enforce this token
// server-side (functions/src/ops.ts, ENFORCE_APP_CHECK — on in prod,
// off under the emulator). Firestore/Storage enforcement is flipped
// in the Firebase console — see SHIP-CHECKLIST. Until the console
// switch is on, direct Firestore access from scripts remains
// possible; the rules are the real gate there.
//
// Platform providers (auto-selected by the Capacitor plugin):
//   - iOS:     DeviceCheck (or App Attest on iOS 14+ if entitled).
//   - Android: Play Integrity.
//   - Web:     reCAPTCHA v3 via the site key in VITE_APPCHECK_RECAPTCHA_SITE_KEY.
//
// Configuration is env-gated. On web, if the site key isn't set we
// skip App Check entirely so localhost dev works without per-dev
// reCAPTCHA keys. On native, the plugin auto-selects a provider
// based on platform; we always call initialize().
//
// One important Firebase rule: App Check must be initialised AFTER
// initializeApp() but BEFORE the first request that needs the
// token. We hook it into the same init() that initializeApp lives
// in, so the order is guaranteed.
//
// AND ON NATIVE THAT WAS NOT ENOUGH (D275). The plugin above attests
// through the NATIVE Firebase SDK. Every request this app actually
// makes — Firestore, and every callable — is made by the Firebase JS
// SDK inside the WebView, and the JS SDK knows nothing about a token
// the native one holds: `firebase/app-check` was never initialised at
// all, so `httpsCallable` sent no `X-Firebase-AppCheck` header. With
// enforcement on (functions/src/ops.ts, on by default in prod) that is
// firebase-functions' `tokenStatus.app === "MISSING"` branch, which
// answers 401 with the single word **Unauthenticated** — reported from
// a device as a red line under the handle field on the account-setup
// screen, the first callable a new account reaches.
//
// So the native token is bridged into the JS SDK with a CustomProvider,
// which is what the plugin's own firebase-js-sdk guide prescribes:
// `getToken()` asks the native side, the JS SDK attaches the answer. On
// web the plugin's own web implementation already calls the JS SDK's
// `initializeAppCheck` for us, so this half is native-only — calling it
// twice is what Firebase refuses.
//
// It degrades exactly as before if attestation itself is unconfigured:
// `getToken()` rejects, the JS SDK sends no header, and the request is
// as unattested as it was. What it cannot do any more is be attested on
// one side of a bridge nobody built.

import { Capacitor } from "@capacitor/core";
import type { FirebaseApp } from "firebase/app";
// Imported under an npm ALIAS, not its published name — this is
// `@capacitor-firebase/app-check`, installed into
// node_modules/capacitor-firebase-app-check by package.json.
//
// SwiftPM derives a package's IDENTITY from the last component of its path.
// At the published path that identity is `app-check`, which collides with
// github.com/google/app-check — a transitive dependency of GoogleSignIn (via
// @capacitor-firebase/authentication). SwiftPM prefers the local package, so
// GoogleSignIn then cannot find the `AppCheckCore` product and the entire
// iOS build fails to resolve its dependencies. Renaming the install
// directory renames the identity and the collision is gone.
//
// The alias is therefore load-bearing: reverting it to the scoped name
// re-breaks the iOS build. check-appcheck-alias.mjs guards it. See D10.
import { FirebaseAppCheck } from "capacitor-firebase-app-check";

let initialized = false;

/**
 * How long a native token is assumed good for when the platform does not
 * say. `expireTimeMillis` is documented as Android/iOS-only and the plugin
 * does return it there, so this is the belt on a value that should always
 * arrive — but a MISSING expiry parsed as NaN would make the JS SDK's
 * refresh scheduler unusable, and every later request unattested. Short on
 * purpose: an early refresh costs a cached native call, a late one costs a
 * rejected request.
 */
const ASSUMED_TTL_MS = 30 * 60 * 1000;

/**
 * Hand the JS SDK a provider that asks the native one (D275).
 *
 * Native only, and after `FirebaseAppCheck.initialize()` — the plugin is
 * what activates the native provider this reads from.
 */
async function bridgeNativeToken(app: FirebaseApp): Promise<void> {
  const { initializeAppCheck, CustomProvider } = await import("firebase/app-check");
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        const { token, expireTimeMillis } = await FirebaseAppCheck.getToken();
        return {
          token,
          expireTimeMillis: expireTimeMillis || Date.now() + ASSUMED_TTL_MS,
        };
      },
    }),
    // The native side refreshes on its own; this is the JS side's copy of
    // the same setting, so a token the WebView holds cannot go stale while
    // a valid one sits one bridge call away.
    isTokenAutoRefreshEnabled: true,
  });
}

export async function initAppCheck(app: FirebaseApp): Promise<void> {
  if (initialized) return;
  const isNative = Capacitor.isNativePlatform();
  const webSiteKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_SITE_KEY as
    | string
    | undefined;
  // On web with no site key configured, skip — App Check is opt-in
  // for dev so we don't force every contributor to provision their
  // own reCAPTCHA registration.
  if (!isNative && !webSiteKey) return;
  try {
    await FirebaseAppCheck.initialize({
      // Auto-refresh keeps the token valid for the lifetime of the
      // session without us juggling expiry.
      isTokenAutoRefreshEnabled: true,
      // Site key is only consulted by the web provider; ignored on
      // iOS / Android where the plugin auto-selects DeviceCheck /
      // Play Integrity.
      ...(webSiteKey ? { siteKey: webSiteKey } : {}),
      // Debug provider — opt-in via env var. In a debug build, the
      // plugin prints a token to the device log that you then
      // register in the Firebase console to allow that build past
      // App Check. Never set this in production builds.
      ...(import.meta.env.VITE_APPCHECK_DEBUG === "true"
        ? { debugToken: true }
        : {}),
    });
    initialized = true;
    // The half the WebView needs. Inside the same try: a bridge that
    // throws must not be louder than the attestation it is bridging, and
    // the fallback is identical either way — an unattested request, which
    // is exactly what shipped before it existed.
    if (isNative) await bridgeNativeToken(app);
  } catch (err) {
    // Failing init should not block the app — we still want sign-in
    // + Firestore reads/writes to attempt and surface their own
    // errors. The relevant failure mode here is misconfiguration,
    // which logs noisily but doesn't tank the session.
    console.warn("[appcheck] initialize failed:", err);
  }
}
