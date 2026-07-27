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
  getFirestore,
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
  dbInstance = getFirestore(app);
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

// Upgrade the current (anonymous) account to Google, keeping the uid —
// and with it every answer document. Falls back to a plain sign-in when
// there is no current user to link.
export async function linkGoogle(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return googleSignIn();
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error("Native Google sign-in returned no idToken");
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
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw new Error("Native Google sign-in returned no idToken");
    }
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

