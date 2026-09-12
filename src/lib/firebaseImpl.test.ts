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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  native: false,
  // COUNTED, not merely stubbed. It was `() => Promise.resolve()` and
  // nothing read it — see the case at the bottom of this file.
  attestCalls: 0,
  getAuthCalls: 0,
  authStateSubs: 0,
  idTokenSubs: 0,
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
  currentUser: null as { uid: string; isAnonymous?: boolean } | null,
  // Every argument `initializeFirestore` was called with. The mock used
  // to capture NONE of them, so the database id and the offline cache —
  // two decisions this module exists to make — could both be deleted with
  // every runner green.
  firestoreCalls: [] as Array<{ settings: Record<string, unknown>; dbId: unknown }>,
  // The email door. `emailCreate` chooses between UPGRADING the anonymous
  // session and starting a fresh account, and these are how a case tells
  // which it did.
  emailCredentials: [] as Array<Record<string, unknown>>,
  createdAccounts: [] as Array<Record<string, unknown>>,
  emailSignIns: [] as Array<Record<string, unknown>>,
  verifyMails: 0,
  appsMade: 0,
  appsDeleted: [] as unknown[],
  // Set to make `initializeFirestore` throw once — the shape of a build
  // that gets past `initializeApp` and dies after it.
  firestoreThrowsOnce: false,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => h.native },
}));

vi.mock("firebase/app", () => ({
  initializeApp: () => { h.appsMade += 1; return { __app: true, n: h.appsMade }; },
  // The teardown a half-built init owes. `initializeApp` refuses a second
  // call under the same name, so without this a retry after a partial
  // failure could not even start.
  deleteApp: async (a: unknown) => { h.appsDeleted.push(a); },
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
    h.authStateSubs += 1;
    cb(null);
    return () => {};
  },
  // The SDK's OTHER observer, and the one the app must watch. Counted
  // rather than ignored so the case below can tell which registry
  // subscribeToAuth joined — see its assertion for why that is the whole
  // difference between a wall that lifts and one that needs a relaunch.
  onIdTokenChanged: (_a: unknown, cb: (u: null) => void) => {
    h.idTokenSubs += 1;
    cb(null);
    return () => {};
  },
  signInAnonymously: () => (h.hangSignIn
    ? new Promise(() => { /* never settles, which is the case */ })
    : Promise.resolve({ user: { uid: "uid_test" } })),
  GoogleAuthProvider: class {},
  // A static, like the real one. It records the credential so a case can
  // tell a LINK (the anonymous session upgraded) from a fresh account.
  EmailAuthProvider: {
    credential: (email: string, password: string) => {
      const c = { __cred: "password", email, password };
      h.emailCredentials.push(c);
      return c;
    },
  },
  createUserWithEmailAndPassword: (_a: unknown, email: string, password: string) => {
    h.createdAccounts.push({ email, password });
    return Promise.resolve({ user: { uid: "uid_new" } });
  },
  signInWithEmailAndPassword: (_a: unknown, email: string, password: string) => {
    h.emailSignIns.push({ email, password });
    return Promise.resolve({ user: { uid: "uid_other" } });
  },
  sendEmailVerification: () => { h.verifyMails += 1; return Promise.resolve(); },
  sendPasswordResetEmail: () => Promise.resolve(),
  reload: () => Promise.resolve(),
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
  initializeFirestore: (_app: unknown, settings: Record<string, unknown>, dbId: unknown) => {
    if (h.firestoreThrowsOnce) { h.firestoreThrowsOnce = false; throw new Error("firestore boom"); }
    h.firestoreCalls.push({ settings, dbId });
    return { __db: true };
  },
  persistentLocalCache: () => ({ __persistent: true }),
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

vi.mock("./appcheck", () => ({
  initAppCheck: () => { h.attestCalls += 1; return Promise.resolve(); },
}));

const CONFIG = {
  apiKey: "k", authDomain: "d", projectId: "p", appId: "a",
};

beforeEach(() => {
  vi.resetModules();
  h.native = false;
  h.getAuthCalls = 0;
  h.authStateSubs = 0;
  h.idTokenSubs = 0;
  h.initializeAuthCalls.length = 0;
  h.hangSignIn = false;
  h.appleResult = { credential: { idToken: "apple-id-token", nonce: "raw-nonce" } };
  h.oauthProviders.length = 0;
  h.oauthCredentials.length = 0;
  h.signInCredentials.length = 0;
  h.linkCredentials.length = 0;
  h.currentUser = null;
  h.firestoreCalls.length = 0;
  h.appsMade = 0;
  h.appsDeleted.length = 0;
  h.firestoreThrowsOnce = false;
  h.emailCredentials.length = 0;
  h.createdAccounts.length = 0;
  h.emailSignIns.length = 0;
  h.verifyMails = 0;
  h.attestCalls = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a build that dies half-way is rebuilt, not reported as done", () => {
  it("a retry after a partial failure builds the module again", async () => {
    // `impl()` in firebase.ts clears its memo before rethrowing so the
    // next caller calls `init` again — its own comment says the retry "is
    // cheap when the failure was in `init` rather than the fetch". It was
    // not cheap, it was inert: `init` opened with `if (app) return`, and
    // `app` is set by the FIRST line of the build. So a throw anywhere
    // after it left auth and db null, and the retry returned immediately
    // reporting success on a module that had neither.
    const m = await import("./firebaseImpl");

    h.firestoreThrowsOnce = true;
    expect(() => m.init(CONFIG), "the failure did not reach the caller").toThrow(/firestore boom/);
    expect(h.appsMade, "the first attempt never got as far as the app").toBe(1);
    // Nothing half-built left behind, and the app torn down so a second
    // `initializeApp` is legal at all.
    expect(h.appsDeleted, "the failed attempt kept its app — a rebuild cannot start").toHaveLength(1);

    // The retry: a whole build this time.
    m.init(CONFIG);
    expect(h.appsMade, "the retry returned early on the dead app").toBe(2);
    expect(h.firestoreCalls, "the retry did not rebuild the database handle").toHaveLength(1);
    expect(() => m.getDbInstance(), "the module still reports itself uninitialised").not.toThrow();
  });

  it("a second init on a WHOLE module still does nothing", async () => {
    // The property the old guard had and this must keep: init is called
    // on every `impl()` and must not rebuild a working module.
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    m.init(CONFIG);
    expect(h.appsMade, "a healthy module was rebuilt").toBe(1);
    expect(h.firestoreCalls).toHaveLength(1);
  });
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

describe("Sign in with email and password", () => {
  it("emailCreate LINKS the anonymous session — the property the wall rests on", async () => {
    // Apple has had this pair since it shipped; the email door had none,
    // and that asymmetry is what let it go untested. Measured before this
    // case existed: inverting the branch to `user && !user.isAnonymous` —
    // so an anonymous session gets a brand-new account and its answers are
    // stranded — left tsc -b, eslint and the whole unit suite (192 files,
    // 2874 tests) green.
    //
    // It is not a small property. `web/privacy.html` promises signing in
    // "attaches an identity to that same session rather than starting a
    // new one — so anything you answered before signing in is kept", and
    // D414's whole argument for a wall at all is that answers survive it.
    h.currentUser = { uid: "uid_test", isAnonymous: true };
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await m.emailCreate("someone@example.com", "hunter22");

    expect(h.linkCredentials, "emailCreate started a new account instead of upgrading the anonymous one").toHaveLength(1);
    expect(h.emailCredentials[0]).toMatchObject({ email: "someone@example.com", password: "hunter22" });
    expect(h.createdAccounts, "emailCreate created a second account beside the session it should have upgraded").toHaveLength(0);
    // After the account exists, never before — a verification mail for an
    // address that failed to register is a mail about nothing.
    expect(h.verifyMails, "no verification mail followed the create").toBe(1);
  });

  it("emailCreate signs in fresh when the session is already linked", async () => {
    // The other half of the same branch. A non-anonymous user cannot be
    // linked to a second password credential, so this must NOT try.
    h.currentUser = { uid: "uid_test", isAnonymous: false };
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    await m.emailCreate("someone@example.com", "hunter22");

    expect(h.createdAccounts).toHaveLength(1);
    expect(h.linkCredentials, "emailCreate tried to link a password onto an account that already has an identity").toHaveLength(0);
    expect(h.verifyMails).toBe(1);
  });
});

// ── which observer the app watches (build 33's wall bug) ────────────
//
// Build 33 shipped the account wall, and a tester who signed in with
// Google had to force-quit and relaunch before the app would let them
// past. This is why.
//
// READ OUT OF THE SDK rather than reasoned about — `@firebase/auth`'s
// `notifyAuthListeners`:
//
//     this.idTokenSubscription.next(this.currentUser);      // always
//     const currentUid = this.currentUser?.uid ?? null;
//     if (this.lastNotifiedUid !== currentUid) {            // only on a
//       this.lastNotifiedUid = currentUid;                  // UID CHANGE
//       this.authStateSubscription.next(this.currentUser);
//     }
//
// LINKING KEEPS THE UID. That is the whole point of linking and the
// reason D3 says the wall is affordable — every answer given before it
// survives under the same uid. So `onAuthStateChanged` cannot fire for
// the one event the wall is waiting on, and the app sat there with a
// `linked` flag nobody had updated.
//
// A NAME-LEVEL TEST, deliberately, and the same argument appcheck.test.ts
// makes: whether the SDK honours its own two registries is Firebase's
// contract. What this file owns is WHICH ONE the app joined — and that is
// exactly the fact no other test could see, because live.ts's tests drive
// the subscription callback directly and the gate's tests stub
// `LIVE.linked`. Both are green with the wrong observer.
describe("subscribeToAuth", () => {
  it("watches the ID-token registry, not the auth-state one", async () => {
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    // Reset AFTER init: init's own restore wait uses onAuthStateChanged
    // legitimately (it waits for a user to EXIST, which is a uid change),
    // and counting it here would hide the thing this asserts.
    h.authStateSubs = 0;
    h.idTokenSubs = 0;
    m.subscribeToAuth(() => {});
    expect(h.idTokenSubs, "subscribeToAuth did not use onIdTokenChanged — "
      + "a link keeps the uid, so the wall will not lift until relaunch").toBe(1);
    expect(h.authStateSubs, "subscribeToAuth used onAuthStateChanged").toBe(0);
  });

  it("hands the callback through, and returns something that unsubscribes", async () => {
    // The counter above says which registry; this says the wiring is real
    // rather than a subscription to nothing.
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    const seen: Array<unknown> = [];
    const off = m.subscribeToAuth((u) => seen.push(u));
    expect(seen).toEqual([null]);
    expect(typeof off).toBe("function");
    off();
  });
});

// ── FIRESTORE CONSTRUCTION ──────────────────────────────────────────
//
// The same class of hole as the Auth half above, on the other client this
// module builds — and it was open. `init()` passes `initializeFirestore`
// two things beyond the app, both of them decisions with a silent failure
// mode, and the mock above captured neither:
//
//   1. THE DATABASE ID (D165). The app moved off `(default)` to one EU
//      database. Drop the third argument and the client talks to a
//      database the backend no longer writes to — which, as the source's
//      own comment says, "looks like an app with no data rather than like
//      an error". Nothing else in the tree holds it on the CLIENT:
//      `check:fn-runtime` pins `database: FIRESTORE_DB_ID` on the server
//      triggers only.
//   2. THE OFFLINE CACHE. Without `persistentLocalCache` a returning
//      device with its whole bank and answer history on disk fails
//      hydrate() the moment it is offline and falls back to the demo
//      deck, and votes written offline are not queued for reconnect.
//
// Measured before writing this: both mutations — the two-argument
// `initializeFirestore(app, {...})`, and the settings object with
// `localCache` removed — left `tsc -b`, eslint, `check:globals` and all
// four suites under src/lib green.
describe("Firestore construction", () => {
  it("names the database id, so the client is not left on `(default)`", async () => {
    const m = await import("./firebaseImpl");
    m.init(CONFIG);

    expect(h.firestoreCalls).toHaveLength(1);
    expect(
      h.firestoreCalls[0].dbId,
      "initializeFirestore was called without a database id — the client would read `(default)`, which the backend does not write to",
    ).toBe(m.FIRESTORE_DB_ID);
    // Not merely "some string": "insight" is what an unset environment
    // means, and it is the value the SERVER also defaults to — through a
    // different variable (`FIRESTORE_DB_ID`, not `VITE_FIRESTORE_DB_ID`),
    // which is why the two agreeing is a coincidence of defaults rather
    // than a mechanism. The source comment beside the call says so.
    expect(m.FIRESTORE_DB_ID).toBe("insight");
  });

  it("asks for the persistent local cache, so a returning device boots offline", async () => {
    const m = await import("./firebaseImpl");
    m.init(CONFIG);

    expect(
      h.firestoreCalls[0].settings.localCache,
      "initializeFirestore was called with no localCache — an offline boot falls back to the demo deck with the real bank on disk",
    ).toEqual({ __persistent: true });
  });
});

// ── THE NATIVE PROVIDER LIST IS PART OF THE SIGN-IN PATH ─────────────
//
// `@capacitor-firebase/authentication` builds a handler per provider and
// only for the ones named in `capacitor.config.ts`:
//
//     if config.providers.contains(ProviderId.apple) {
//       self.appleAuthProviderHandler = AppleAuthProviderHandler(self)
//     }
//
// and every entry point guards on it — `signInWithApple` and
// `linkWithApple` both `call.reject("Apple sign-in provider is not
// enabled")` when the handler is null. Android is byte-for-byte the same
// shape.
//
// Apple was missing from that list while `LiveSignInGate` rendered
// "Sign in with Apple" as the FIRST door on iOS, which guideline 4.8 is
// the reason for. On device the primary button on the account wall
// rejected; on web nothing was wrong, because `appleSignIn`/`linkApple`
// take `signInWithPopup` off-native and never reach the plugin. So no
// test here could see it: every case in this file mocks the plugin.
//
// Derived rather than listed, so the next provider cannot be added to
// the app and forgotten in the config — the shape the overlay coverage
// table uses. The ids are the PLUGIN'S OWN, copied from its definitions:
// Game Center is "gc.apple.com", not "gamecenter", which is what this map
// said when it was written. Inert, because nothing calls Game Center —
// and exactly the trap the map exists to prevent, since the entry would
// have demanded a string the plugin never compares against and gone green
// on a config loading nothing.
//
// An unrecognised provider call FAILS rather than being skipped. The
// first version filtered to the names it knew (`c in PROVIDER_ID`), so a
// new `signInWithMicrosoft` would have passed quietly — the comment here
// claimed the opposite. `NOT_A_PROVIDER` is the deliberate exception
// list: plugin methods that need no `providers` entry because the plugin
// builds no handler for them.
describe("the native sign-in providers", () => {
  const PROVIDER_ID: Record<string, string> = {
    signInWithApple: "apple.com",
    linkWithApple: "apple.com",
    signInWithGoogle: "google.com",
    linkWithGoogle: "google.com",
    signInWithFacebook: "facebook.com",
    signInWithGameCenter: "gc.apple.com",
  };
  /** Calls that are not a loadable provider — no handler, no config entry. */
  const NOT_A_PROVIDER = new Set([
    "signOut", "signInWithCustomToken", "signInWithEmailLink",
    "signInWithEmailAndPassword", "createUserWithEmailAndPassword",
    "linkWithEmailAndPassword", "signInAnonymously", "getCurrentUser",
    "getIdToken", "updateProfile", "deleteUser", "sendEmailVerification",
    "sendPasswordResetEmail", "confirmPasswordReset", "useEmulator",
    "addListener", "removeAllListeners", "reload", "unlink",
  ]);

  it("names every provider the app asks the native plugin for", () => {
    const impl = readFileSync(resolve(cwd(), "src/lib/firebaseImpl.ts"), "utf8");
    const called = [...new Set(
      [...impl.matchAll(/FirebaseAuthentication\.(\w+)\(/g)].map((m) => m[1]),
    )];
    // Loud, not silent: a native call this map has never heard of is a
    // provider nobody has decided about, and skipping it is how the
    // config would go stale again.
    for (const c of called) {
      expect(
        c in PROVIDER_ID || NOT_A_PROVIDER.has(c),
        `firebaseImpl calls FirebaseAuthentication.${c}, which this map does not know. `
        + "Add its provider id to PROVIDER_ID, or to NOT_A_PROVIDER if the plugin loads no handler for it.",
      ).toBe(true);
    }
    const needed = [...new Set(
      called.filter((c) => c in PROVIDER_ID).map((c) => PROVIDER_ID[c]),
    )];
    expect(needed.length, "no native provider calls found — the pattern stopped matching")
      .toBeGreaterThan(0);

    const config = readFileSync(resolve(cwd(), "capacitor.config.ts"), "utf8");
    const listed = (config.match(/providers:\s*\[([^\]]*)\]/)?.[1] ?? "")
      .split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

    for (const id of needed) {
      expect(
        listed,
        `firebaseImpl calls the native plugin for ${id}, but capacitor.config.ts does not load it — `
        + "the plugin rejects with \"provider is not enabled\" on device, and only on device",
      ).toContain(id);
    }
  });

  it("…and the app really does ask for Apple, not only Google", () => {
    // The control. The case above passes vacuously if the call-site scan
    // ever stops finding Apple — which is exactly what a refactor to the
    // web popup everywhere would look like, and would be a different bug.
    const impl = readFileSync(resolve(cwd(), "src/lib/firebaseImpl.ts"), "utf8");
    expect(impl).toMatch(/FirebaseAuthentication\.signInWithApple\(/);
    expect(impl).toMatch(/FirebaseAuthentication\.signInWithGoogle\(/);
  });
});

describe("App Check attestation", () => {
  // NOTHING HELD THIS CALL SITE. `void initAppCheck()` is the only thing
  // that attests this client, and `ENFORCE_APP_CHECK` is on in production —
  // every callable refuses an unattested caller. The mock above existed and
  // returned a resolved promise; no case ever asked whether it was called.
  //
  // Measured: moving the call into the emulator branch, so no production
  // client attests at all, left all four `src/lib` suites, `tsc -b`,
  // eslint, `check:globals`, `check:appcheck` and `test:unit` green. That
  // is D388's shape exactly — three weeks at 0% verified, with every gate
  // reporting success — and `check:appcheck` cannot see it, because it
  // guards the SERVER half: which callables demand attestation, never
  // whether the client ever produces one.
  it("attests the client on a real build", async () => {
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    expect(h.attestCalls, "no client ever attests; every callable refuses it").toBe(1);
  });

  it("does not attest against the emulator, which does not enforce it", async () => {
    vi.stubEnv("VITE_USE_EMULATOR", "true");
    vi.resetModules();
    const m = await import("./firebaseImpl");
    m.init(CONFIG);
    expect(h.attestCalls).toBe(0);
    vi.unstubAllEnvs();
  });
});
