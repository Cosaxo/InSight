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

import { Capacitor } from "@capacitor/core";
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
// re-breaks the iOS build. `scripts/check-ios-spm.mjs` (`npm run
// check:ios-spm`) guards it. See D10.
import { FirebaseAppCheck } from "capacitor-firebase-app-check";

let initialized = false;

// The plugin types `expireTimeMillis` optional and the SDK's AppCheckToken
// requires it — and requires it to be RIGHT: the SDK holds a token valid
// while `expireTimeMillis > Date.now()` and schedules the refresh off it,
// so 0 is "expired, fetch again" in a loop and a made-up hour is a token
// that goes stale in the request headers under enforcement. Both native
// implementations set the field (iOS from `result.expirationDate`), so the
// branches below serve the type rather than the plugin: the JWT's own `exp`
// claim is what the field is derived from, and a token with neither is
// refused here so the SDK sends the request unattested — what it did
// before the bridge — rather than with a time this file invented.
function expiryOf(token: string, expireTimeMillis: number | undefined): number {
  if (typeof expireTimeMillis === "number" && expireTimeMillis > 0) return expireTimeMillis;
  const payload = token.split(".")[1];
  if (payload) {
    try {
      const claims = JSON.parse(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
      ) as { exp?: unknown };
      if (typeof claims.exp === "number") return claims.exp * 1000;
    } catch { /* not a JWT — fall through to the refusal */ }
  }
  throw new Error("[appcheck] native token carried no expiry");
}

export async function initAppCheck(): Promise<void> {
  if (initialized) return;
  const isNative = Capacitor.isNativePlatform();
  const webSiteKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_SITE_KEY as
    | string
    | undefined;
  // VITE_APPCHECK_DEBUG carries two shapes and the difference matters.
  // "true" asks the SDK to MINT a token and print it for you to register
  // once — right for a developer's browser, useless for CI, where a fresh
  // token every run would need registering every run. Any other non-empty
  // value IS a token, already registered, which is the only form a job can
  // use. `debugToken` takes both (plugin definitions.d.ts: boolean | string).
  const debugRaw = import.meta.env.VITE_APPCHECK_DEBUG as string | undefined;
  const debugToken: boolean | string | undefined = !debugRaw
    ? undefined
    : debugRaw === "true"
      ? true
      : debugRaw;
  // On web, App Check needs either a real reCAPTCHA registration or a debug
  // token; with neither, skip — it stays opt-in for dev so a contributor
  // need not provision their own registration. The debug half of this
  // condition is what lets a browser keep reading Firestore after console
  // enforcement is flipped on (LAUNCH-RUNBOOK 3.4), which is the moment an
  // unattested dev browser and the screenshot job both stop working.
  if (!isNative && !webSiteKey && !debugToken) return;
  // The plugin demands a `provider` or a `siteKey` on web and builds a
  // ReCaptchaV3Provider out of the latter. In debug mode that provider is
  // never asked for a token — @firebase/app-check short-circuits getToken to
  // the debug exchange — but initializeAppCheck still calls
  // provider.initialize(), which loads Google's reCAPTCHA script. With no
  // real registration that means a script fetch and a console error for an
  // answer nothing reads, so hand it a provider that cannot be consulted
  // rather than a placeholder key. Imported dynamically, here and in the
  // native bridge below, so the entry chunk does not carry it.
  let webProvider: unknown;
  if (!isNative && debugToken && !webSiteKey) {
    const { CustomProvider } = await import("firebase/app-check");
    webProvider = new CustomProvider({
      getToken: () =>
        Promise.reject(
          new Error(
            "[appcheck] debug mode: the provider must never be consulted.",
          ),
        ),
    });
  }
  try {
    await FirebaseAppCheck.initialize({
      // Auto-refresh keeps the token valid for the lifetime of the
      // session without us juggling expiry.
      isTokenAutoRefreshEnabled: true,
      // Site key is only consulted by the web provider; ignored on
      // iOS / Android where the plugin auto-selects DeviceCheck /
      // Play Integrity. `provider` wins over `siteKey` in the plugin, and
      // only exists on the debug-without-a-key path above.
      ...(webProvider
        ? { provider: webProvider }
        : webSiteKey
          ? { siteKey: webSiteKey }
          : {}),
      // Debug provider — opt-in via env var, and a BYPASS rather than an
      // attestation: whoever holds the token gets past App Check. Never set
      // it in a build that reaches users; `shipsDebugToken` in
      // scripts/appcheck-guard.ts refuses one at build time.
      ...(debugToken !== undefined ? { debugToken } : {}),
    });
    // On iOS and Android the call above configures the NATIVE App Check
    // SDK and nothing else. Every Firestore read, every callable and the
    // avatar upload here go through the JavaScript SDK inside the WebView,
    // and that SDK attaches a token only from an App Check instance
    // registered on ITS FirebaseApp — which the plugin creates on web (its
    // web implementation calls initializeAppCheck itself) and not on
    // native. The plugin's own docs bridge the two with a CustomProvider
    // over the native getToken() (packages/app-check/docs/firebase-js-sdk.md).
    // Without this bridge no phone ever sent a token: three weeks of App
    // Check metrics read 0% verified, and the callables that enforce in
    // production refused every phone that called them (D388). Under
    // UNENFORCED Firestore a failed native attestation costs nothing more
    // than it did before — the SDK sends the request without a token.
    if (isNative) {
      const [{ getApp }, { initializeAppCheck, CustomProvider }] = await Promise.all([
        import("firebase/app"),
        import("firebase/app-check"),
      ]);
      initializeAppCheck(getApp(), {
        provider: new CustomProvider({
          getToken: async () => {
            const { token, expireTimeMillis } = await FirebaseAppCheck.getToken();
            return { token, expireTimeMillis: expiryOf(token, expireTimeMillis) };
          },
        }),
        isTokenAutoRefreshEnabled: true,
      });
    }
    initialized = true;
  } catch (err) {
    // Failing init should not block the app — we still want sign-in
    // + Firestore reads/writes to attempt and surface their own
    // errors. The relevant failure mode here is misconfiguration,
    // which logs noisily but doesn't tank the session.
    console.warn("[appcheck] initialize failed:", err);
  }
}
