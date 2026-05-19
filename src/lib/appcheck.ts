// appcheck.ts — Firebase App Check init.
//
// What App Check is for: signing every Firebase request (Firestore,
// Auth-callable Functions, etc.) with an attestation proving the
// call came from a legitimate build of our app, not a script
// pulling our config out of the JS bundle and replaying requests
// against the project. Without it, anybody who scrapes the env
// vars can hit our rules-protected reads + writes from curl.
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
import { FirebaseAppCheck } from "@capacitor-firebase/app-check";

let initialized = false;

export async function initAppCheck(): Promise<void> {
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
  } catch (err) {
    // Failing init should not block the app — we still want sign-in
    // + Firestore reads/writes to attempt and surface their own
    // errors. The relevant failure mode here is misconfiguration,
    // which logs noisily but doesn't tank the session.
    console.warn("[appcheck] initialize failed:", err);
  }
}
