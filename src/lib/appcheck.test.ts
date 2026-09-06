// The App Check token has to reach the JavaScript SDK, and on a phone it
// does not get there on its own.
//
// WHY THIS FILE EXISTS. For three weeks the App Check console read 0%
// verified over thousands of Firestore requests, and every reading of it
// was explained as "browsers and CI without debug tokens" — while the
// TestFlight build was in daily use. The cause was one layer down:
// `FirebaseAppCheck.initialize()` configures the NATIVE App Check SDK on
// iOS and Android, but every request this app makes is made by the
// JavaScript SDK inside the WebView, and that SDK only attaches a token
// from an App Check instance registered on its own FirebaseApp. The
// plugin's web implementation registers one; its native implementations
// do not, and the plugin's docs say to bridge the two with a
// CustomProvider over the native getToken(). Nothing did. So no phone ever
// sent a token, the enforced callables refused every phone, and the
// enforcement flip the runbook was soaking for could never have been safe
// (D387).
//
// The mocks are name-level, like firebaseImpl.test.ts: whether the SDK
// honours a CustomProvider is Firebase's contract. What this owns is that
// on native the app REGISTERS one, that its token IS the native token, and
// that on web it does not register a second instance on top of the
// plugin's — the real initializeAppCheck throws on the second call.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  native: false,
  pluginInit: [] as Array<Record<string, unknown>>,
  jsInit: [] as Array<{ app: unknown; opts: Record<string, unknown> }>,
  nativeToken: {
    token: "native-token",
    expireTimeMillis: 1_700_000_000_000 as number | undefined,
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => h.native },
}));

vi.mock("capacitor-firebase-app-check", () => ({
  FirebaseAppCheck: {
    initialize: async (opts: Record<string, unknown>) => { h.pluginInit.push(opts); },
    getToken: async () => h.nativeToken,
  },
}));

vi.mock("firebase/app", () => ({
  getApp: () => ({ __app: true }),
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: (app: unknown, opts: Record<string, unknown>) => {
    h.jsInit.push({ app, opts });
    return {};
  },
  CustomProvider: class CustomProvider {
    readonly opts: { getToken: () => Promise<unknown> };
    constructor(opts: { getToken: () => Promise<unknown> }) { this.opts = opts; }
  },
}));

// The mocked class above, not the SDK's: tsc types `import("firebase/app-check")`
// against the real declaration, which has no public `opts`.
type MockProvider = { opts: { getToken: () => Promise<unknown> } };

beforeEach(() => {
  vi.resetModules();
  h.native = false;
  h.pluginInit.length = 0;
  h.jsInit.length = 0;
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_APPCHECK_RECAPTCHA_SITE_KEY", "");
  vi.stubEnv("VITE_APPCHECK_DEBUG", "");
});

describe("initAppCheck on native", () => {
  it("registers a JS App Check instance whose provider hands over the native token", async () => {
    h.native = true;
    const { initAppCheck } = await import("./appcheck");
    await initAppCheck();

    expect(h.pluginInit, "the native SDK was not initialised").toHaveLength(1);
    expect(h.jsInit, "no App Check instance on the JS SDK — the pre-fix shape").toHaveLength(1);

    const { CustomProvider } = await import("firebase/app-check");
    const provider = h.jsInit[0].opts.provider as MockProvider;
    expect(provider).toBeInstanceOf(CustomProvider);
    // The token the JS SDK will attach IS the native attestation, fields
    // intact — not a rebuilt object that could drop one.
    await expect(provider.opts.getToken()).resolves.toEqual(h.nativeToken);
    expect(h.jsInit[0].opts.isTokenAutoRefreshEnabled).toBe(true);
    expect(h.jsInit[0].app).toEqual({ __app: true });
  });

  it("reads the expiry off the JWT when the plugin omits it, and never invents one", async () => {
    // The plugin types expireTimeMillis optional; the SDK requires it and
    // holds the token valid until then, so a wrong value is a token that
    // goes stale in the headers and a 0 is a refresh loop. The claim the
    // field is derived from is in the token itself.
    h.native = true;
    const { initAppCheck } = await import("./appcheck");
    await initAppCheck();
    const provider = h.jsInit[0].opts.provider as MockProvider;

    const exp = 1_800_000_000;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    h.nativeToken = { token: `eyJhbGciOiJSUzI1NiJ9.${payload}.sig`, expireTimeMillis: undefined };
    await expect(provider.opts.getToken()).resolves.toEqual({
      token: h.nativeToken.token,
      expireTimeMillis: exp * 1000,
    });

    h.nativeToken = { token: "opaque", expireTimeMillis: undefined };
    await expect(provider.opts.getToken()).rejects.toThrow(/no expiry/);
    h.nativeToken = { token: "native-token", expireTimeMillis: 1_700_000_000_000 };
  });

  it("initialises once, however often init() is reached", async () => {
    h.native = true;
    const { initAppCheck } = await import("./appcheck");
    await initAppCheck();
    await initAppCheck();
    expect(h.pluginInit).toHaveLength(1);
    expect(h.jsInit).toHaveLength(1);
  });
});

describe("initAppCheck on web", () => {
  it("does nothing with neither a site key nor a debug token", async () => {
    const { initAppCheck } = await import("./appcheck");
    await initAppCheck();
    expect(h.pluginInit).toHaveLength(0);
    expect(h.jsInit).toHaveLength(0);
  });

  it("with a debug token, leaves the JS instance to the plugin's web implementation", async () => {
    vi.stubEnv("VITE_APPCHECK_DEBUG", "11111111-2222-4333-8444-555555555555");
    const { initAppCheck } = await import("./appcheck");
    await initAppCheck();

    expect(h.pluginInit).toHaveLength(1);
    expect(h.pluginInit[0].debugToken).toBe("11111111-2222-4333-8444-555555555555");
    expect(h.pluginInit[0]).toHaveProperty("provider");
    // The plugin's web implementation calls initializeAppCheck itself; a
    // second call from here would throw in the real SDK.
    expect(h.jsInit).toHaveLength(0);
  });
});
