// Thin, always-synchronous public API over the lazily-loaded Firebase
// SDK. The heavy implementation (src/lib/firebaseImpl.ts) is
// dynamic-imported on first use. v2 surface only — the journal-era API
// was removed with the legacy app.
//
// THIS HEADER USED TO END "so signed-out/mock sessions never download
// it", and that had stopped being true (D106). `src/v2/data/live.ts`
// imported `firebase/firestore` and `firebase/functions` STATICALLY, and
// live.ts is eager — so the SDK sat in the first-paint graph of every
// build, including one with no `VITE_FIREBASE_*` configured at all, which
// is the exact case the sentence named. Measured on a mock-mode build:
// the 292 KB Firestore chunk was `modulepreload`ed from index.html.
//
// The claim is true again, and `getFirestoreApi()` / `getFunctionsApi()`
// below are how: the API surfaces come through the same memoised
// `impl()` promise as everything else here, so nothing reaches
// `firebase/*` except through a dynamic import. `check:bundle`'s
// eager-graph ceiling is what keeps it true — the two gates that were
// watching when this broke could not see it (both were green the whole
// time, and one of them read the regression as an improvement).

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

// ── The SDK surfaces (D106) ─────────────────────────────────────
//
// Same memoised `impl()` promise as everything else here, which is what
// makes the ordering a non-question for callers: a consumer can only reach
// these by awaiting, and `getDb()` awaits the identical promise — so any
// code holding a `Firestore` is, by construction, running after the API is
// available. `live.ts` leans on exactly that, and it is why its 73 call
// sites did not have to change when they stopped being static imports.

export async function getFirestoreApi(): Promise<Impl["fsApi"]> {
  return (await impl()).fsApi;
}

export async function getFunctionsApi(): Promise<Impl["fnsApi"]> {
  return (await impl()).fnsApi;
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
