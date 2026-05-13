// Thin, always-synchronous public API. The real Firebase SDK + implementation
// lives in `./firebaseImpl.ts` and is dynamic-imported on first use so the
// initial bundle stays small.
//
// Shape:
//   firebaseEnabled      — sync env check. Never loads the SDK.
//   googleSignIn / Out   — async; loads the SDK on first call.
//   subscribeToAuth      — sync unsubscribe handle; defers the real
//                          subscription until the SDK has loaded.
//   saveProfile / …      — async CRUD wrappers.
//   subscribeX           — sync unsubscribe handle wrappers.

import type { User } from "firebase/auth";
import type {
  CityRating,
  CityRatings,
  Habit,
  Meal,
  MoodEntry,
  Person,
  RemoteDailyReport,
  Transaction,
  Workout,
} from "../types";
import type {
  FirebaseConfig,
  MigrationPayload,
  RemoteProfile,
} from "./firebaseImpl";

export type {
  RemoteProfile,
  MigrationPayload,
  RemoteCity,
  RemoteDiscoverable,
} from "./firebaseImpl";
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

// Single cached promise — the SDK loads exactly once, even if several call
// sites race to reach it.
type Impl = typeof import("./firebaseImpl");
let implPromise: Promise<Impl> | null = null;

function impl(): Promise<Impl> {
  if (!firebaseEnabled) {
    return Promise.reject(new Error("Firebase not configured"));
  }
  if (!implPromise) {
    implPromise = import("./firebaseImpl").then(async (m) => {
      m.init(config);
      return m;
    });
  }
  return implPromise;
}

// Eagerly warm the chunk when Firebase is enabled. Call this from App mount
// so the SDK is fetched in parallel with first render, reducing the
// perceived latency on the first `signIn` / `subscribeToAuth` call.
export function warmFirebase(): void {
  if (firebaseEnabled) void impl();
}

// ── Auth ────────────────────────────────────────────────────────

export async function googleSignIn(): Promise<void> {
  const m = await impl();
  return m.googleSignIn();
}

export async function googleSignOut(): Promise<void> {
  const m = await impl();
  return m.googleSignOut();
}

// Returns a synchronous unsubscribe. If the impl isn't loaded yet it queues
// the subscription and unsubscribes once loaded.
export function subscribeToAuth(
  cb: (user: User | null) => void,
): () => void {
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

// ── Profile ─────────────────────────────────────────────────────

export async function loadProfile(uid: string): Promise<RemoteProfile | null> {
  const m = await impl();
  return m.loadProfile(uid);
}

export async function profileExists(uid: string): Promise<boolean> {
  const m = await impl();
  return m.profileExists(uid);
}

export async function saveProfile(
  uid: string,
  patch: RemoteProfile,
): Promise<void> {
  const m = await impl();
  return m.saveProfile(uid, patch);
}

export async function migrateFromLocal(
  uid: string,
  payload: MigrationPayload,
): Promise<boolean> {
  const m = await impl();
  return m.migrateFromLocal(uid, payload);
}

// ── Sync-unsubscribe wrappers ───────────────────────────────────

function lazySubscribe<T>(
  factory: (m: Impl) => (uid: string, cb: (v: T) => void) => () => void,
  uid: string,
  cb: (v: T) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = factory(m)(uid, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribeRelations(
  uid: string,
  cb: (items: Person[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeRelations, uid, cb);
}

export function subscribeCityRatings(
  uid: string,
  cb: (ratings: CityRatings) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeCityRatings, uid, cb);
}

export function subscribeMoods(
  uid: string,
  cb: (items: MoodEntry[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeMoods, uid, cb);
}

export function subscribeHabits(
  uid: string,
  cb: (items: Habit[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeHabits, uid, cb);
}

export function subscribeWorkouts(
  uid: string,
  cb: (items: Workout[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeWorkouts, uid, cb);
}

export function subscribeMeals(
  uid: string,
  cb: (items: Meal[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeMeals, uid, cb);
}

export function subscribeTransactions(
  uid: string,
  cb: (items: Transaction[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeTransactions, uid, cb);
}

// ── Sub-collection mutations ────────────────────────────────────

export async function addRelation(
  uid: string,
  person: Person,
): Promise<void> {
  const m = await impl();
  return m.addRelation(uid, person);
}

export async function updateRelation(
  uid: string,
  id: string,
  patch: Partial<Person>,
): Promise<void> {
  const m = await impl();
  return m.updateRelation(uid, id, patch);
}

export async function deleteRelation(
  uid: string,
  id: string,
): Promise<void> {
  const m = await impl();
  return m.deleteRelation(uid, id);
}

export async function setCityRating(
  uid: string,
  cityName: string,
  key: keyof CityRating,
  value: number,
): Promise<void> {
  const m = await impl();
  return m.setCityRating(uid, cityName, key, value);
}

export async function upsertMood(
  uid: string,
  entry: MoodEntry,
): Promise<void> {
  const m = await impl();
  return m.upsertMood(uid, entry);
}

export async function deleteMood(uid: string, date: string): Promise<void> {
  const m = await impl();
  return m.deleteMood(uid, date);
}

export async function addHabit(uid: string, habit: Habit): Promise<void> {
  const m = await impl();
  return m.addHabit(uid, habit);
}

export async function updateHabit(
  uid: string,
  id: string,
  patch: Partial<Habit>,
): Promise<void> {
  const m = await impl();
  return m.updateHabit(uid, id, patch);
}

export async function addWorkout(
  uid: string,
  workout: Workout,
): Promise<void> {
  const m = await impl();
  return m.addWorkout(uid, workout);
}

export async function addMeal(uid: string, meal: Meal): Promise<void> {
  const m = await impl();
  return m.addMeal(uid, meal);
}

export async function addTransaction(
  uid: string,
  tx: Transaction,
): Promise<void> {
  const m = await impl();
  return m.addTransaction(uid, tx);
}

// ── Daily reports (Phase 4) ─────────────────────────────────────

export function subscribeDailyReport(
  uid: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeDailyReport(uid, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function upsertDailyReport(
  uid: string,
  report: RemoteDailyReport,
): Promise<void> {
  const m = await impl();
  return m.upsertDailyReport(uid, report);
}

export async function deleteDailyReport(uid: string): Promise<void> {
  const m = await impl();
  return m.deleteDailyReport(uid);
}

// ── Geo discovery (cities + nearby users) ───────────────────────

export async function findNearbyCities(
  center: { latitude: number; longitude: number },
  radiusKm: number,
) {
  const m = await impl();
  return m.findNearbyCities(center, radiusKm);
}

export async function findNearbyDiscoverable(
  center: { latitude: number; longitude: number },
  maxRadiusKm: number,
  excludeUid?: string,
) {
  const m = await impl();
  return m.findNearbyDiscoverable(center, maxRadiusKm, excludeUid);
}

export async function upsertDiscoverable(
  uid: string,
  data: {
    latitude: number;
    longitude: number;
    geohash: string;
    displayName?: string;
    photoColor?: string;
  },
): Promise<void> {
  const m = await impl();
  return m.upsertDiscoverable(uid, data);
}

export async function deleteDiscoverable(uid: string): Promise<void> {
  const m = await impl();
  return m.deleteDiscoverable(uid);
}
