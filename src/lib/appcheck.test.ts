// The bridge between the two App Check SDKs a Capacitor build runs (D275).
//
// WHY THIS FILE EXISTS. A device reported the account-setup screen refusing
// to close, with the word **Unauthenticated** in red under the handle
// field. That word is not this app's — `functions/src/v2social.ts` says
// "must be signed in" — it is firebase-functions', and it comes out of
// exactly three branches: an invalid auth token, an invalid App Check
// token, and a MISSING App Check token with enforcement on. Enforcement is
// on in production by default (functions/src/ops.ts).
//
// It was the third. `@capacitor-firebase/app-check` attests the NATIVE
// Firebase SDK; every request this app makes is made by the Firebase JS
// SDK in the WebView, and nothing had ever called the JS SDK's
// `initializeAppCheck` on native — so `httpsCallable` sent no App Check
// header at all, and every enforced callable was 401 for every iOS and
// Android build. The first callable a new account meets is the handle
// claim, on the first screen.
//
// The mocks are name-level, like firebaseImpl.test.ts's, and for the same
// reason: whether DeviceCheck attests is Apple's contract and not something
// jsdom can execute. What this owns is the line that was wrong — that the
// JS SDK is handed a provider on native, is NOT handed a second one on web
// (where the plugin already did it, and Firebase refuses the second), and
// that the provider passes the native token through with an expiry the
// refresh scheduler can read.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  native: false,
  initCalls: [] as Array<Record<string, unknown>>,
  token: { token: "native-jwt", expireTimeMillis: 1_700_000_000_000 } as {
    token: string; expireTimeMillis?: number;
  },
  jsProviders: [] as Array<{ getToken: () => Promise<{ token: string; expireTimeMillis: number }> }>,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => h.native },
}));

vi.mock("capacitor-firebase-app-check", () => ({
  FirebaseAppCheck: {
    initialize: (opts: Record<string, unknown>) => {
      h.initCalls.push(opts);
      return Promise.resolve();
    },
    getToken: () => Promise.resolve(h.token),
  },
}));

vi.mock("firebase/app-check", () => ({
  // The provider is a plain carrier here: what matters is that the JS SDK
  // is handed one, and what its getToken answers.
  CustomProvider: class {
    getToken: () => Promise<{ token: string; expireTimeMillis: number }>;
    constructor(opts: { getToken: () => Promise<{ token: string; expireTimeMillis: number }> }) {
      this.getToken = opts.getToken;
    }
  },
  initializeAppCheck: (_app: unknown, opts: { provider: { getToken: () => Promise<{ token: string; expireTimeMillis: number }> } }) => {
    h.jsProviders.push(opts.provider);
    return {};
  },
}));

const APP = { __app: true } as never;

// The module memoises `initialized`, so each case needs its own copy.
const freshInit = async () => {
  vi.resetModules();
  return (await import("./appcheck")).initAppCheck;
};

beforeEach(() => {
  h.native = false;
  h.initCalls = [];
  h.jsProviders = [];
  h.token = { token: "native-jwt", expireTimeMillis: 1_700_000_000_000 };
  vi.unstubAllEnvs();
});

describe("native", () => {
  it("hands the JS SDK a provider, or every callable is Unauthenticated", async () => {
    h.native = true;
    const initAppCheck = await freshInit();
    await initAppCheck(APP);

    // Both halves: the native SDK is activated, and the SDK that makes the
    // requests is told how to ask it.
    expect(h.initCalls).toHaveLength(1);
    expect(h.jsProviders).toHaveLength(1);
  });

  it("passes the native token through, expiry and all", async () => {
    h.native = true;
    const initAppCheck = await freshInit();
    await initAppCheck(APP);

    const got = await h.jsProviders[0].getToken();
    expect(got.token).toBe("native-jwt");
    expect(got.expireTimeMillis).toBe(1_700_000_000_000);
  });

  it("assumes an expiry when the platform gives none", async () => {
    // Documented as Android/iOS-only, so it should always be there — but
    // NaN here would make the JS SDK's refresh scheduler unusable and
    // every later request unattested, which is the bug this file is about
    // wearing a different hat.
    h.native = true;
    h.token = { token: "native-jwt" };
    const initAppCheck = await freshInit();
    await initAppCheck(APP);

    const got = await h.jsProviders[0].getToken();
    expect(Number.isFinite(got.expireTimeMillis)).toBe(true);
    expect(got.expireTimeMillis).toBeGreaterThan(Date.now());
  });

  it("survives an attestation that is not configured", async () => {
    // DeviceCheck unregistered, or the plugin missing: the app must still
    // boot. What it loses is attestation, which is what it had anyway.
    h.native = true;
    const initAppCheck = await freshInit();
    const boom = vi.fn(() => Promise.reject(new Error("no provider")));
    const mod = await import("capacitor-firebase-app-check");
    const real = mod.FirebaseAppCheck.initialize;
    (mod.FirebaseAppCheck as { initialize: unknown }).initialize = boom;
    try {
      await expect(initAppCheck(APP)).resolves.toBeUndefined();
      expect(h.jsProviders).toHaveLength(0);
    } finally {
      (mod.FirebaseAppCheck as { initialize: unknown }).initialize = real;
    }
  });
});

describe("web", () => {
  it("does not initialise the JS SDK a second time", async () => {
    // The plugin's own web implementation calls `initializeAppCheck` with a
    // reCAPTCHA provider. Firebase allows that once per app, so a bridge
    // here would be the call that throws.
    vi.stubEnv("VITE_APPCHECK_RECAPTCHA_SITE_KEY", "site-key");
    const initAppCheck = await freshInit();
    await initAppCheck(APP);

    expect(h.initCalls).toHaveLength(1);
    expect(h.initCalls[0].siteKey).toBe("site-key");
    expect(h.jsProviders).toHaveLength(0);
  });

  it("skips App Check entirely with no site key", async () => {
    // Dev on localhost: nobody should need their own reCAPTCHA
    // registration to run the app.
    const initAppCheck = await freshInit();
    await initAppCheck(APP);
    expect(h.initCalls).toHaveLength(0);
    expect(h.jsProviders).toHaveLength(0);
  });
});
