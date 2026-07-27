// Thin, always-synchronous public API over the lazily-loaded Firebase
// SDK. The heavy implementation (src/lib/firebaseImpl.ts) is
// dynamic-imported on first use so signed-out/mock sessions never
// download it. v2 surface only — the journal-era API was removed with
// the legacy app.

import type { User } from "firebase/auth";
import type { FirebaseConfig } from "./firebaseImpl";

export type { User } from "firebase/auth";

const env = import.meta.env;

const config: FirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const required: (keyof FirebaseConfig)[] = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

export const firebaseEnabled = required.every(
  (k) => typeof config[k] === "string" && (config[k] as string).length > 0,
);

// Single cached promise — the SDK loads exactly once, even if several
// call sites race to reach it.
type Impl = typeof import("./firebaseImpl");
let implPromise: Promise<Impl> | null = null;

function impl(): Promise<Impl> {
  if (!firebaseEnabled) {
    return Promise.reject(new Error("Firebase not configured"));
  }
  if (!implPromise) {
    implPromise = import("./firebaseImpl").then((m) => {
      m.init(config);
      return m;
    });
  }
  return implPromise;
}

// ── Auth (anonymous-first, decision D3) ─────────────────────────

export async function anonSignIn(): Promise<string> {
  const m = await impl();
  return m.anonSignIn();
}

export async function linkGoogle(): Promise<void> {
  const m = await impl();
  return m.linkGoogle();
}

export async function googleSignIn(): Promise<void> {
  const m = await impl();
  return m.googleSignIn();
}

export async function googleSignOut(): Promise<void> {
  const m = await impl();
  return m.googleSignOut();
}

// Returns a synchronous unsubscribe; defers the real subscription
// until the SDK has loaded.
export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeToAuth(cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

// ── Firestore instance (the v2 data layer builds on this) ───────

export async function getDb(): Promise<import("firebase/firestore").Firestore> {
  const m = await impl();
  return m.getDbInstance();
}
