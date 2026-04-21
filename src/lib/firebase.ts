// Env-driven Firebase bootstrap.
// If any of the required VITE_FIREBASE_* vars is missing the app runs in
// local-only mode (no auth, no Firestore, data lives in localStorage).

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const required: (keyof typeof config)[] = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

export const firebaseEnabled = required.every(
  (k) => typeof config[k] === "string" && config[k],
);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

if (firebaseEnabled) {
  app = initializeApp(config as Required<typeof config>);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export const fbApp = app;
export const fbAuth = authInstance;
export const fbDb = dbInstance;

export async function googleSignIn(): Promise<void> {
  if (!fbAuth) throw new Error("Firebase not configured");
  await signInWithPopup(fbAuth, new GoogleAuthProvider());
}

export async function googleSignOut(): Promise<void> {
  if (!fbAuth) return;
  await fbSignOut(fbAuth);
}
