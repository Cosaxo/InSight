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
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => h.native },
}));

vi.mock("firebase/app", () => ({
  initializeApp: () => ({ __app: true }),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => { h.getAuthCalls += 1; return { __auth: "browser" }; },
  initializeAuth: (_app: unknown, opts: Record<string, unknown>) => {
    h.initializeAuthCalls.push(opts);
    return { __auth: "native" };
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
  linkWithCredential: () => Promise.resolve(),
  linkWithPopup: () => Promise.resolve(),
  signInWithCredential: () => Promise.resolve(),
  signInWithPopup: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
}));

vi.mock("firebase/firestore", () => ({
  initializeFirestore: () => ({ __db: true }),
  persistentLocalCache: () => ({}),
  connectFirestoreEmulator: () => {},
  // The rest of `fsApi` (D108). None of it is exercised by this file, and all
  // of it is required: the module builds that object at import time, so a
  // member missing from this mock throws before any case runs. Kept as one
  // block so the next member added to the store lands here in one edit.
  clearIndexedDbPersistence: () => {}, collection: () => {},
  collectionGroup: () => {}, deleteDoc: () => {}, doc: () => {},
  documentId: () => {}, getDoc: () => {}, getDocs: () => {}, limit: () => {},
  onSnapshot: () => {}, orderBy: () => {}, query: () => {},
  serverTimestamp: () => {}, setDoc: () => {}, terminate: () => {},
  Timestamp: {}, updateDoc: () => {}, where: () => {},
}));

vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => {},
  httpsCallable: () => () => Promise.resolve({}),   // fnsApi (D108), as above
}));

vi.mock("@capacitor-firebase/authentication", () => ({
  FirebaseAuthentication: { signInWithGoogle: () => Promise.resolve({}) },
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
