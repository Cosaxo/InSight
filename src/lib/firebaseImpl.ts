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
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import { initAppCheck } from "./appcheck";

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
  authInstance = getAuth(app);
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
export async function anonSignIn(): Promise<string> {
  const a = auth();
  const restored = await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(a, (u) => {
      unsub();
      resolve(u);
    });
  });
  if (restored) return restored.uid;
  const cred = await signInAnonymously(a);
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

