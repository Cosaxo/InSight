// Firebase implementation layer — v2 surface only.
// The journal-era CRUD that used to live here was removed with the
// legacy app (git history has it); what remains is exactly what the v2
// client uses: app init with emulator wiring, the anonymous-first auth
// (D3) with Google linking, and the Firestore instance accessor. The
// v2 data layer itself is src/v2/data/live.ts.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  clearIndexedDbPersistence,
  collection,
  collectionGroup,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { initAppCheck } from "./appcheck";

// The API surfaces, re-exported so nothing outside this module has to import
// `firebase/*` statically (D109). This file is reached ONLY through
// lib/firebase's memoised `impl()` dynamic import, so anything that arrives
// through here is off the first-paint graph by construction — which is the
// property `src/v2/data/live.ts` broke by importing `firebase/firestore`
// directly, and the property `check:bundle`'s eager-graph ceiling now holds.
//
// EXPLICIT OBJECTS, NOT `export * as fsApi from "firebase/firestore"`. That
// was the first shape and it cost 50 KB, measured: a namespace re-export is a
// use of every export, so rolldown could no longer shake the ~85% of the SDK
// this app never calls, and the total went 2116 → 2166 KB — over
// `check:bundle`'s ceiling, trading 50 KB of lazy weight for the 326 KB of
// eager weight the change was after. Naming the members keeps both wins.
//
// It also pins the surface, in the same way `data/vote.test.ts` pins
// `window.LIVE`'s: live.ts destructures this whole object in one statement, so
// a member added to the store without being added here fails at boot rather
// than at the call.
export const fsApi = {
  clearIndexedDbPersistence, collection, collectionGroup, deleteDoc, doc,
  documentId, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, terminate, Timestamp, updateDoc, where,
};
export const fnsApi = { getFunctions, httpsCallable };

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// Local-development flag: when VITE_USE_EMULATOR=true, every SDK
// instance is pointed at the Firebase Local Emulator Suite on
// 127.0.0.1 instead of the live project. Has no effect in production
// builds (the env var is absent).
const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true";
const EMULATOR_HOST = "127.0.0.1";

export function init(config: FirebaseConfig): void {
  if (app) return;
  app = initializeApp(config);
  // NATIVE MUST NOT USE getAuth(), and the symptom is a hang rather than an
  // error. getAuth() installs the browser popupRedirectResolver, which
  // probes the environment against the authDomain — in a WKWebView served
  // from capacitor://localhost that probe never completes, and because Auth
  // gates EVERY operation on its initialization promise, signInAnonymously
  // then waits forever. Not rejects: waits. No error, no Sentry event, no
  // uid, and boot sits on its first await for the life of the process.
  //
  // That is exactly what the first device produced. `LIVE.bootError` read
  // "still connecting — signing in" (D77, D-below) while
  // identitytoolkit accounts:signUp with the same API key answered 200 from
  // outside the app in milliseconds, and Firebase's user list showed no
  // account created. A request that never leaves and a request that fails
  // look identical from a console you cannot attach.
  //
  // initializeAuth with an explicit persistence and NO resolver is what
  // @capacitor-firebase/authentication documents for native
  // (packages/authentication/docs/firebase-js-sdk.md), and upstream
  // firebase-js-sdk #5615 / #6504 are the same shape: "the promise does not
  // resolve, neither .then nor .catch runs".
  //
  // Web keeps getAuth(): the resolver it installs is the one browsers
  // actually need for linkWithPopup below.
  authInstance = Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : getAuth(app);
  // Persistent (IndexedDB) cache instead of the default memory-only
  // cache: on an offline cold start every getDoc/getDocs otherwise
  // rejects with "client is offline", hydrate() fails, and boot falls
  // back to the demo deck — stranding a returning user whose entire
  // question bank and answer history are sitting in cache. Disk cache
  // also queues votes written while offline so they sync on reconnect.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache(),
  });
  if (useEmulator) {
    connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(dbInstance, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(getFunctions(app, "us-central1"), EMULATOR_HOST, 5001);
  } else {
    // Attest this client before the first Firestore / callable
    // request. Fire-and-forget: the App Check token attaches to
    // subsequent requests once it resolves; queries issued before
    // resolution still work but are unattested. Skipped against the
    // emulator, which doesn't enforce App Check.
    void initAppCheck();
  }
}


function auth(): Auth {
  if (!authInstance) throw new Error("Firebase not initialised");
  return authInstance;
}

export function getDbInstance(): Firestore {
  return db();
}

function db(): Firestore {
  if (!dbInstance) throw new Error("Firebase not initialised");
  return dbInstance;
}

// ── Auth ────────────────────────────────────────────────────────

// Anonymous-first (decision D3): the app works immediately, and Google
// becomes an *upgrade* via account linking so history is never lost to
// a login wall. Returns the signed-in uid.
//
// Waits for persistence restoration before deciding — currentUser is
// always null on cold boot until the SDK finishes restoring the prior
// session, and signing in anonymously at that moment would REPLACE the
// returning user (anon or linked) with a fresh account every launch.
// The restore wait is RACED AGAINST A CLOCK for the same reason
// nativeGoogleIdToken below is: a promise that never settles is worse than
// one that rejects. onAuthStateChanged normally fires within a tick — with
// null on a first run — but it is the SDK's persistence layer that decides
// that, and a WebView whose storage the SDK cannot open has no obligation
// to call back at all. Unguarded, that hangs boot() forever: no uid, no
// error, no Sentry event, and a UI stuck on "Sample questions ·
// reconnecting…" with nothing anywhere saying why. That exact silence cost
// a day of remote guesswork against a device with no console attached.
//
// Falling through to signInAnonymously on timeout rather than throwing:
// the risk this wait exists to avoid is REPLACING a returning user's
// session, and after five seconds of no callback there is no session to
// replace — while refusing to sign in at all guarantees the demo deck.
const AUTH_RESTORE_TIMEOUT_MS = 5_000;

// And a deadline on the sign-in itself. The restore wait above was guarded
// first and it was not enough: the WKWebView hang sat on Auth's
// initialization promise, which gates signInAnonymously too, so boot moved
// from one unbounded await to the next and still never produced a word.
// Firebase's own request timeout never applied because no request was ever
// made.
//
// 30s because this is a real network call on a phone — a slow train
// tunnel is not a bug and must not be reported as one — and because the
// only thing past this deadline is an honest error instead of silence.
// Every one of these three timeouts exists for the same reason, now
// written once: an await with no clock turns a diagnosable failure into
// an app that says nothing.
const SIGN_IN_TIMEOUT_MS = 30_000;

function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(
          `${what} did not respond within ${Math.round(ms / 1000)}s. The request `
          + "never completed and never failed, which on a native build usually "
          + "means Firebase Auth was initialised the browser way — see init().",
        )),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function anonSignIn(): Promise<string> {
  const a = auth();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // `unsub` is a LET declared outside, and that is load-bearing rather than
  // style. It read `const unsub = onAuthStateChanged(a, (u) => { unsub(); … })`
  // for as long as this function has existed, which is fine only while the
  // callback is asynchronous: fire it SYNCHRONOUSLY — which an Auth
  // instance that has already resolved its state is entitled to do — and
  // `unsub()` runs inside its own initialiser and throws
  // `ReferenceError: Cannot access 'unsub' before initialization`. The
  // throw lands inside Firebase's observer dispatch, `resolve` on the next
  // line never runs, and the promise hangs with nothing logged.
  //
  // A hang with no error is the symptom the first device produced, so this
  // is a second sufficient cause of it standing in the same three lines as
  // the first. Found by the test below rather than by reading, which is
  // why the test drives a synchronous callback specifically.
  let unsub: (() => void) | undefined;
  let settled = false;
  const restored = await new Promise<User | null>((resolve) => {
    const done = (u: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Undefined when the callback fired synchronously — the trailing
      // call below tears the subscription down once assignment completes.
      unsub?.();
      resolve(u);
    };
    unsub = onAuthStateChanged(a, done);
    timer = setTimeout(() => done(null), AUTH_RESTORE_TIMEOUT_MS);
  });
  // Idempotent, and the only path that unsubscribes a synchronous fire.
  unsub?.();
  if (restored) return restored.uid;
  const cred = await withDeadline(
    signInAnonymously(a), SIGN_IN_TIMEOUT_MS, "Anonymous sign-in",
  );
  return cred.user.uid;
}

// The native sheet resolves only once the user picks an account or
// cancels — but a *misconfigured* build never opens it at all and the
// promise then never settles: on iOS a missing GoogleService-Info.plist
// or an unreplaced REVERSED_CLIENT_ID, on Android a build without
// rgcfaIncludeGoogle. Callers set a busy flag and await this, so an
// unsettled promise freezes the panel with no error to show. Fail loudly
// instead — a wrong config should look like a bug, not a hang.
const NATIVE_AUTH_TIMEOUT_MS = 90_000;

async function nativeGoogleIdToken(): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      FirebaseAuthentication.signInWithGoogle(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(
            "Native Google sign-in did not respond. Check that the app has its "
            + "Firebase config file and that Google is enabled for this build.")),
          NATIVE_AUTH_TIMEOUT_MS,
        );
      }),
    ]);
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error("Native Google sign-in returned no idToken");
    return idToken;
  } finally {
    clearTimeout(timer);
  }
}

// Upgrade the current (anonymous) account to Google, keeping the uid —
// and with it every answer document. Falls back to a plain sign-in when
// there is no current user to link.
export async function linkGoogle(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return googleSignIn();
  if (Capacitor.isNativePlatform()) {
    const idToken = await nativeGoogleIdToken();
    await linkWithCredential(user, GoogleAuthProvider.credential(idToken));
    return;
  }
  await linkWithPopup(user, new GoogleAuthProvider());
}

export async function googleSignIn(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // On iOS / Android we open the native Google Sign-In sheet via the
    // Capacitor Firebase Authentication plugin, then exchange the
    // resulting ID token for a Firebase credential on the JS SDK so
    // every other Firestore call still goes through the same auth
    // instance the rest of the app already uses.
    const idToken = await nativeGoogleIdToken();
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth(), credential);
    return;
  }
  // Web fallback — popup flow (or installed PWA on Android, which
  // still uses the web auth runtime).
  await signInWithPopup(auth(), new GoogleAuthProvider());
}

export async function googleSignOut(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Sign out of both sides so the native account picker forgets the
    // session too — otherwise the next sign-in skips the account chooser.
    await FirebaseAuthentication.signOut();
  }
  await signOut(auth());
}

export function subscribeToAuth(
  cb: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth(), cb);
}

