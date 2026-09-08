// Firebase implementation layer — v2 surface only.
// The journal-era CRUD that used to live here was removed with the
// legacy app (git history has it); what remains is exactly what the v2
// client uses: app init with emulator wiring, the anonymous-first auth
// (D3) with Google linking, and the Firestore instance accessor. The
// v2 data layer itself is src/v2/data/live.ts.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  onIdTokenChanged,
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
  deleteField,
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
  startAfter,
  terminate,
  Timestamp,
  updateDoc,
  waitForPendingWrites,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { initAppCheck } from "./appcheck";
import { FUNCTIONS_REGION } from "./region";

// The API surfaces, re-exported so nothing outside this module has to import
// `firebase/*` statically (D110). This file is reached ONLY through
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
// The Firestore database this client talks to (D165). Kept as a named
// constant rather than a literal at the call site so `check:fn-runtime` and
// a human grep both find it, and so the emulator override is one place.
export const FIRESTORE_DB_ID = import.meta.env.VITE_FIRESTORE_DB_ID || "insight";

export const fsApi = {
  clearIndexedDbPersistence, collection, collectionGroup, deleteDoc, deleteField,
  doc, documentId, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, startAfter, terminate, Timestamp, updateDoc,
  // D357: the SDK's own word that its persisted mutation queue has
  // drained — what settles an answer a relaunch restored unacknowledged.
  waitForPendingWrites, where,
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
  //
  // The third argument is the DATABASE ID (D165). The app moved off
  // `(default)` to a single EU region; omit this and the client talks to a
  // database the backend no longer writes to — which looks like an app with
  // no data rather than like an error. Emulator runs override it through
  // the same env var the functions read, so both halves cannot disagree.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache(),
  }, FIRESTORE_DB_ID);
  if (useEmulator) {
    connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(dbInstance, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(getFunctions(app, FUNCTIONS_REGION), EMULATOR_HOST, 5001);
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

// One race, two providers. This was Google's alone and is factored here
// rather than copied for Apple, because the subtle half is the `finally`
// that clears the timer: a second copy is a second place for that to go
// missing, and the symptom (a process kept alive by a stray timer, only
// in the failure path) is one nobody reads a stack trace for.
async function nativeSignIn(
  provider: "Google" | "Apple",
  run: () => Promise<{ credential?: { idToken?: string; nonce?: string } | null }>,
): Promise<{ idToken: string; rawNonce?: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(
            `Native ${provider} sign-in did not respond. Check that the app has its `
            + `Firebase config file and that ${provider} is enabled for this build.`)),
          NATIVE_AUTH_TIMEOUT_MS,
        );
      }),
    ]);
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error(`Native ${provider} sign-in returned no idToken`);
    // Google's exchange ignores this; Apple's cannot — see appleCredential.
    return { idToken, rawNonce: result.credential?.nonce };
  } finally {
    clearTimeout(timer);
  }
}

async function nativeGoogleIdToken(): Promise<string> {
  const { idToken } = await nativeSignIn(
    "Google", () => FirebaseAuthentication.signInWithGoogle(),
  );
  return idToken;
}

// APPLE'S CREDENTIAL IS NOT GOOGLE'S WITH A DIFFERENT NAME, and the
// difference is the nonce. Apple binds the identity token to a nonce so a
// token captured once cannot be replayed: the plugin generates one, sends
// its SHA-256 to Apple, and hands back the RAW value. Firebase re-hashes
// the raw value and compares. Pass the token without it and the exchange
// fails `auth/invalid-credential` — a message that says nothing about
// nonces and sends you looking at the provider config instead.
//
// `rawNonce` and not `nonce`: the JS SDK's field name is the raw one
// precisely because it does the hashing itself, and the two are one
// letter apart in a shape TypeScript will not check for you (the
// provider's credential() takes a loose object).
async function appleCredential() {
  const { idToken, rawNonce } = await nativeSignIn(
    "Apple", () => FirebaseAuthentication.signInWithApple(),
  );
  return new OAuthProvider("apple.com").credential({ idToken, rawNonce });
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

// The Apple pair, mirroring linkGoogle/googleSignIn above — same rule:
// LINK when there is a session to keep, sign in fresh when there is not.
//
// The web branch exists for symmetry and is close to dead in practice:
// Apple's web flow needs a Services ID and a private key registered
// separately from the native app, and D337 records that this app has no
// public web client — the browser paths serve developers and CI. It is a
// popup rather than a thrown "native only" because a developer meeting a
// Firebase config error learns more than one meeting our refusal.
export async function linkApple(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return appleSignIn();
  if (Capacitor.isNativePlatform()) {
    await linkWithCredential(user, await appleCredential());
    return;
  }
  await linkWithPopup(user, new OAuthProvider("apple.com"));
}

export async function appleSignIn(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await signInWithCredential(auth(), await appleCredential());
    return;
  }
  await signInWithPopup(auth(), new OAuthProvider("apple.com"));
}

// ── the email door ──────────────────────────────────────────────────
//
// Firebase holds the password, hashed, and this app never sees it: the
// three calls below hand it straight to the SDK and keep no copy. That is
// the sentence web/privacy.html makes, and the reason it can.
//
// WHY THE ERRORS ARE TRANSLATED HERE rather than in the screen. Firebase
// codes are stable and its messages are not — "Firebase: Error
// (auth/wrong-password)." is what a user would otherwise read — and the
// design (design/front-door-2026-09-07) gives each failure a way out
// rather than a description. Mapping in one place keeps the screen about
// layout and keeps this list reviewable.
export type EmailFailure =
  | "offline"        // the network, not the credentials
  | "wrong-password" // this address exists, that password does not match
  | "no-account"     // nothing uses this address yet
  | "taken"          // creating, and it already exists
  | "weak"           // creating, and the password is too short
  | "bad-address"    // not an address at all
  | "other";

export class EmailAuthError extends Error {
  readonly failure: EmailFailure;
  constructor(failure: EmailFailure, cause: unknown) {
    super(String((cause instanceof Error && cause.message) || cause));
    this.failure = failure;
  }
}

function emailFailure(err: unknown): EmailFailure {
  const code = String((err as { code?: string })?.code || (err as Error)?.message || "");
  if (/network-request-failed/.test(code)) return "offline";
  if (/email-already-in-use/.test(code)) return "taken";
  if (/weak-password/.test(code)) return "weak";
  if (/invalid-email|missing-email/.test(code)) return "bad-address";
  if (/user-not-found/.test(code)) return "no-account";
  if (/wrong-password/.test(code)) return "wrong-password";
  // EMAIL ENUMERATION PROTECTION COLLAPSES THE TWO, and this is the line
  // to read before "improving" the screen's copy. Firebase projects
  // created recently default it ON, which is correct — it stops an
  // attacker learning which addresses have accounts — and the cost is
  // that a wrong password and an unknown address BOTH answer
  // `auth/invalid-credential`. So the honest mapping is the password
  // message, which offers Forgot password? and is true of the case a real
  // person is overwhelmingly more likely to be in; the design's separate
  // "no account uses this address yet" survives on the CREATE path, where
  // `email-already-in-use` is unambiguous, and its "Create one" way out
  // stays reachable through the toggle. Guessing which of the two it was
  // is exactly the guess the protection exists to prevent.
  if (/invalid-credential|invalid-login/.test(code)) return "wrong-password";
  return "other";
}

async function emailAttempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw new EmailAuthError(emailFailure(err), err);
  }
}

/** Sign in to an account that exists. */
export async function emailSignIn(address: string, password: string): Promise<void> {
  await emailAttempt(() => signInWithEmailAndPassword(auth(), address, password));
}

/**
 * Create an account — LINKING the anonymous session when there is one, so
 * the answers given before the wall appeared survive. Same rule the Google
 * and Apple doors follow, and the reason the gate is affordable at all.
 */
export async function emailCreate(address: string, password: string): Promise<void> {
  const user = auth().currentUser;
  if (user?.isAnonymous) {
    await emailAttempt(() =>
      linkWithCredential(user, EmailAuthProvider.credential(address, password)));
  } else {
    await emailAttempt(() => createUserWithEmailAndPassword(auth(), address, password));
  }
  // After the account exists, never before: a verification mail for an
  // address that failed to register is a mail about nothing.
  await sendVerification();
}

/**
 * Send the address a link that proves it is theirs.
 *
 * WHY ONLY THE PASSWORD DOOR NEEDS THIS. Apple and Google both hand
 * Firebase an address they have already verified, so `emailVerified` is
 * true the moment those links complete. A password account's address is
 * whatever someone typed, which is the case this exists for: a typo locks
 * the account out of its own reset, and a stranger's address gets reset
 * mail it never asked for.
 *
 * Best-effort by design. A create that succeeded and a verification mail
 * that did not send is a person with an account, and the gate's verify
 * screen carries a Resend for exactly that; throwing here would instead
 * report the whole sign-up as failed, which is worse and untrue.
 */
export async function sendVerification(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;
  try {
    await sendEmailVerification(user);
  } catch (err) {
    // console, not reportError: this module does not import the Sentry
    // helper, and the bare name resolves to the DOM's one-argument
    // global — which tsc caught. Same shape as appcheck.ts's warning.
    console.warn("[auth] verification mail failed to send:", err);
  }
}

/**
 * Ask the server again whether the address has been confirmed.
 *
 * `reload` and not a cached read: `emailVerified` is a property of the
 * local user object, and following the link happens in a MAIL APP — no
 * token refresh reaches this process on its own, so a person who verified
 * correctly would sit on the screen forever waiting for a flag that only
 * a round trip can move.
 */
export async function refreshVerification(): Promise<boolean> {
  const user = auth().currentUser;
  if (!user) return false;
  await reload(user);
  return !!auth().currentUser?.emailVerified;
}

/**
 * Send a reset link.
 *
 * Resolves even when nothing uses the address, and that is Firebase's
 * choice rather than ours: answering "no such account" here would hand an
 * attacker the enumeration the protection above denies them. The screen
 * says a link was sent, because that is what was attempted, and the
 * design's confirmation is deliberately about the inbox rather than about
 * the account.
 */
export async function emailReset(address: string): Promise<void> {
  await emailAttempt(() => sendPasswordResetEmail(auth(), address));
}

export async function googleSignOut(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Sign out of both sides so the native account picker forgets the
    // session too — otherwise the next sign-in skips the account chooser.
    await FirebaseAuthentication.signOut();
  }
  await signOut(auth());
}

/**
 * The app's one view of who is signed in.
 *
 * `onIdTokenChanged`, NOT `onAuthStateChanged`, and the difference is a
 * bug that shipped in build 33: after a successful Google sign-in the
 * account wall stayed up until the app was force-quit and relaunched.
 *
 * READ OUT OF THE SDK, not reasoned about
 * (`@firebase/auth` → `notifyAuthListeners`):
 *
 *     this.idTokenSubscription.next(this.currentUser);      // always
 *     const currentUid = this.currentUser?.uid ?? null;
 *     if (this.lastNotifiedUid !== currentUid) {            // only on a
 *       this.lastNotifiedUid = currentUid;                  // UID CHANGE
 *       this.authStateSubscription.next(this.currentUser);
 *     }
 *
 * Linking an anonymous session KEEPS THE UID — that is the whole point of
 * linking, and D3's reason the wall is affordable at all — so
 * `authStateSubscription` never fires for it. The user object flips
 * `isAnonymous` to false and nothing tells the app. A relaunch then
 * restores a non-anonymous user as a fresh sign-in, the uid goes null →
 * value, and the wall finally drops. Hence "close and reopen to advance".
 *
 * D134's own comment one file over describes half of this — "the
 * anonymous → Google upgrade keeps the uid, so this callback set `linked`
 * and then fell past every branch below without a notify()" — and fixed
 * the notify. It could not have fixed the callback, because with
 * `onAuthStateChanged` the callback does not run at all. Every test
 * stayed green because the store's tests drive this subscription directly
 * and the gate's tests stub `LIVE.linked`: nothing anywhere exercised the
 * REAL SDK's choice about when to call us.
 *
 * The cost of the wider subscription is one callback per hourly token
 * refresh and per `reload()`. live.ts's observer was already written for
 * exactly that ("only on a CHANGE") and notifies nobody unless a flag
 * moved — so the guard that existed for a condition that could not happen
 * is what makes the fix free.
 */
export function subscribeToAuth(
  cb: (user: User | null) => void,
): () => void {
  return onIdTokenChanged(auth(), cb);
}

