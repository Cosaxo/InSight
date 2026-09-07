// How Auth is constructed on a native build, and what happens when it
// never answers.
//
// WHY THIS FILE EXISTS. The first device this app ever ran on booted into
// demo mode and stayed there. Not a crash and not an error — `getAuth()`
// installs the browser popupRedirectResolver, which probes the environment
// against the authDomain, and in a WKWebView served from
// capacitor://localhost that probe never completes. Auth gates every
// operation on its initialization promise, so `signInAnonymously` waited
// forever: no uid, no rejection, no Sentry event, and a pill on the daily
// tab reading "still connecting — signing in" while the same
// `accounts:signUp` call answered 200 from outside the app in milliseconds.
//
// Both halves of that are pinned here, because both were needed and only
// one is a fix:
//
//   1. Native constructs Auth with `initializeAuth` + an explicit
//      persistence and NO resolver — what
//      @capacitor-firebase/authentication documents for native, and what
//      firebase-js-sdk #5615 / #6504 describe the absence of.
//   2. A sign-in that never settles becomes an ERROR, not a hang. This is
//      the guard that would have made the original failure diagnosable in
//      thirty seconds instead of a day, and it stays useful whatever the
//      next cause turns out to be.
//
// The mocks are name-level on purpose. Whether `initializeAuth` truly
// avoids the WKWebView probe is Firebase's contract, not something a jsdom
// test can execute — what this owns is that the app ASKS for it on native
// and does not on web, which is the line that was wrong.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  native: false,
  getAuthCalls: 0,
  initializeAuthCalls: [] as Array<Record<string, unknown>>,
  // A signInAnonymously that never settles — the shape the device
  // produced, and the one an unbounded await turns into silence.
  hangSignIn: false,
  // Apple: what the plugin hands back, and what the SDK was given.
  appleResult: {
    credential: { idToken: "apple-id-token", nonce: "raw-nonce" },
  } as { credential: { idToken?: string; nonce?: string } | null },
  oauthProviders: [] as string[],
  oauthCredentials: [] as Array<Record<string, unknown>>,
  signInCredentials: [] as unknown[],
  linkCredentials: [] as unknown[],
  // The signed-in user the Auth instance reports. Null is a real state,
  // not just a fixture default: it is what linkApple/linkGoogle branch on
  // to decide between upgrading a session and starting one.
  currentUser: null as { uid: string } | null,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => h.native },
}));

vi.mock("firebase/app", () => ({
  initializeApp: () => ({ __app: true }),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => { h.getAuthCalls += 1; return { __auth: "browser", get currentUser() { return h.currentUser; } }; },
  initializeAuth: (_app: unknown, opts: Record<string, unknown>) => {
    h.initializeAuthCalls.push(opts);
    return { __auth: "native", get currentUser() { return h.currentUser; } };
  },
  indexedDBLocalPersistence: { __persistence: "indexedDB" },
  connectAuthEmulator: () => {},
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    // Fires immediately with null — a first run with nothing to restore,
    // so the test reaches signInAnonymously rather than the restore wait.
    cb(null);
    return () => {};
  },
  signInAnonymously: () => (h.hangSignIn
    ? new Promise(() => { /* never settles, which is the case */ })
    : Promise.resolve({ user: { uid: "uid_test" } })),
  GoogleAuthProvider: class {},
  // Enough of the real shape to catch the bug this file exists for: the
  // provider id it was constructed with, and the object handed to
  // credential(). A stub that returned a bare token would pass while the
  // nonce went missing, which is the whole failure.
  OAuthProvider: class {
    readonly providerId: string;
    constructor(providerId: string) { this.providerId = providerId; h.oauthProviders.push(providerId); }
    credential(o: Record<string, unknown>) {
      h.oauthCredentials.push(o);
      return { __cred: "apple", ...o };
    }
  },
  linkWithCredential: (_u: unknown, c: unknown) => { h.linkCredentials.push(c); return Promise.resolve(); },
  linkWithPopup: () => Promise.resolve(),
  signInWithCredential: (_a: unknown, c: unknown) => { h.signInCredentials.push(c); return Promise.resolve(); },
  signInWithPopup: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
}));

vi.mock("firebase/firestore", () => ({
  initializeFirestore: () => ({ __db: true }),
  persistentLocalCache: () => ({}),
  connectFirestoreEmulator: () => {},
  // The rest of `fsApi` (D110). None of it is exercised by this file, and all
  // of it is required: the module builds that object at import time, so a
  // member missing from this mock throws before any case runs. Kept as one
  // block so the next member added to the store lands here in one edit.
  clearIndexedDbPersistence: () => {}, collection: () => {},
  collectionGroup: () => {}, deleteDoc: () => {}, deleteField: () => {}, doc: () => {},
  documentId: () => {}, getDoc: () => {}, getDocs: () => {}, limit: () => {},
  onSnapshot: () => {}, orderBy: () => {}, query: () => {}, startAfter: () => {},
  serverTimestamp: () => {}, setDoc: () => {}, terminate: () => {},
  Timestamp: {}, updateDoc: () => {}, waitForPendingWrites: () => {}, where: () => {},
}));

vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => {},
  httpsCallable: () => () => Promise.resolve({}),   // fnsApi (D110), as above
}));

vi.mock("@capacitor-firebase/authentication", () => ({
  FirebaseAuthentication: {
    signInWithGoogle: () => Promise.resolve({}),
    signInWithApple: () => Promise.resolve(h.appleResult),
  },
}));

vi.mock("./appcheck", () => ({ initAppCheck: () => Promise.resolve() }));

const CONFIG = {
  apiKey: "k", authDomain: "d", projectId: "p", appId: "a",
};

beforeEach(() => {
  vi.resetModules();
  h.native = false;
  h.getAuthCalls = 0;
  h.initializeAuthCalls.length = 0;
  h.hangSignIn = false;
  h.appleResult = { credential: { idToken: "apple-id-token", nonce: "raw-nonce" } };
  h.oauthProviders.length = 0;
  h.oauthCredentials.length = 0;
  h.signInCredentials.length = 0;
  h.linkCredentials.length = 0;
  h.currentUser = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Auth construction", () => {
  it("uses initializeAuth with an explicit persistence on native, never getAuth", async () => {
    h.native = true;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);

    expect(h.initializeAuthCalls).toHaveLength(1);
    expect(h.initializeAuthCalls[0]).toHaveProperty("persistence");
    // getAuth is the whole bug: its resolver is what never settles here.
    expect(h.getAuthCalls, "getAuth() was called on a native build").toBe(0);
  });

  it("keeps getAuth on web, where the resolver is the one browsers need", async () => {
    h.native = false;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);

    expect(h.getAuthCalls).toBe(1);
    expect(h.initializeAuthCalls).toHaveLength(0);
  });
});

describe("anonSignIn deadline", () => {
  it("rejects with a readable reason when sign-in never settles", async () => {
    // The property that matters is REJECTS AT ALL. Before this, the same
    // promise sat unresolved for the life of the process and the app had
    // nothing to show but "reconnecting…".
    vi.useFakeTimers();
    h.native = true;
    h.hangSignIn = true;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);

    const pending = m.anonSignIn();
    // Surface the rejection before advancing, or the runner sees an
    // unhandled rejection rather than the assertion below.
    const settled = pending.then(() => null, (e: Error) => e);
    await vi.advanceTimersByTimeAsync(31_000);

    const err = await settled;
    expect(err, "anonSignIn resolved or is still pending").toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Anonymous sign-in did not respond within 30s/);
    // Names where to look, because the reason reaches a user's screen and
    // a stack trace does not.
    expect((err as Error).message).toMatch(/init\(\)/);
  });

  it("returns the uid when sign-in answers", async () => {
    // The deadline must not fire on the happy path, and a Promise.race
    // that leaks its timer is how a test suite starts hanging.
    h.native = true;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await expect(m.anonSignIn()).resolves.toBe("uid_test");
  });
});

describe("a synchronous auth callback", () => {
  // The mock above fires onAuthStateChanged SYNCHRONOUSLY, and that is what
  // caught the second bug: `const unsub = onAuthStateChanged(a, () =>
  // unsub())` throws ReferenceError from inside its own initialiser, the
  // throw lands in Firebase's observer dispatch, and the promise hangs with
  // nothing logged — the same symptom, a different cause, in the same three
  // lines.
  //
  // Named as its own case so the coverage cannot be lost by someone making
  // the mock asynchronous "to be more realistic". An Auth instance whose
  // state is already resolved is entitled to call back synchronously, and
  // whether it does is the SDK's business, not ours to assume.
  it("resolves rather than throwing ReferenceError from its own initialiser", async () => {
    h.native = true;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    // Fails as "promise rejected ReferenceError: Cannot access 'unsub'
    // before initialization" against the pre-fix shape.
    await expect(m.anonSignIn()).resolves.toBe("uid_test");
  });
});

describe("Sign in with Apple", () => {
  // WHY THESE ARE HERE. Apple binds its identity token to a nonce: the
  // plugin hashes one for the native request and returns the RAW value,
  // and Firebase re-hashes it to check the token was minted for this
  // request. Drop it and the exchange fails `auth/invalid-credential`,
  // which names neither Apple nor the nonce and sends you reading the
  // provider config. Nothing else in the stack would notice: the field is
  // optional in the plugin's type and the SDK's credential() takes a
  // loose object, so tsc, eslint and a hand test on a device that happens
  // to succeed all stay quiet.
  it("exchanges the native token WITH its raw nonce", async () => {
    h.native = true;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await m.appleSignIn();

    expect(h.oauthProviders).toEqual(["apple.com"]);
    // rawNonce, not nonce: the SDK's field is the raw one because it does
    // the hashing, and the two names are one letter apart.
    expect(h.oauthCredentials).toEqual([
      { idToken: "apple-id-token", rawNonce: "raw-nonce" },
    ]);
    expect(h.signInCredentials).toHaveLength(1);
  });

  it("LINKS rather than replacing when a session already exists", async () => {
    // The property the whole wall rests on: a person who answered before
    // the gate appeared keeps every answer, because the anonymous uid is
    // upgraded rather than abandoned.
    h.native = true;
    h.currentUser = { uid: "uid_test" };
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await m.linkApple();

    expect(h.linkCredentials, "linkApple signed in fresh instead of linking").toHaveLength(1);
    expect(h.signInCredentials).toHaveLength(0);
  });

  it("signs in fresh when there is no session to keep", async () => {
    // The other half of the same branch, and the one a first launch takes:
    // the gate renders before initLive() has an anonymous session on a
    // cold start, so linkApple has to work with nothing to upgrade.
    h.native = true;
    h.currentUser = null;
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await m.linkApple();

    expect(h.signInCredentials).toHaveLength(1);
    expect(h.linkCredentials).toHaveLength(0);
  });

  it("fails readably when the plugin returns no token", async () => {
    // A misconfigured build does not open the sheet at all. Callers set a
    // busy flag and await, so a silent failure is a frozen screen with
    // nothing to show — the same reason the Google path has a deadline.
    h.native = true;
    h.appleResult = { credential: null };
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await expect(m.appleSignIn()).rejects.toThrow(/Apple sign-in returned no idToken/);
  });
});
