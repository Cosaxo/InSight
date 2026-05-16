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
  Book,
  CityRating,
  CityRatings,
  Dream,
  Habit,
  Home,
  Impression,
  Job,
  Language,
  Meal,
  Milestone,
  MoodEntry,
  Person,
  RemoteDailyReport,
  Specimen,
  TimeBlock,
  Transaction,
  Visit,
  Weighin,
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
  RemoteSkill,
  ShareLevel,
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

export function subscribeSkills(
  uid: string,
  cb: (items: import("./firebaseImpl").RemoteSkill[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeSkills, uid, cb);
}

export async function addSkill(
  uid: string,
  skill: import("./firebaseImpl").RemoteSkill,
): Promise<void> {
  const m = await impl();
  return m.addSkill(uid, skill);
}

export async function updateSkill(
  uid: string,
  id: string,
  patch: Partial<import("./firebaseImpl").RemoteSkill>,
): Promise<void> {
  const m = await impl();
  return m.updateSkill(uid, id, patch);
}

export async function deleteSkill(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteSkill(uid, id);
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

export async function deleteHabit(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteHabit(uid, id);
}

export async function updateHabit(
  uid: string,
  id: string,
  patch: Partial<Habit>,
): Promise<void> {
  const m = await impl();
  return m.updateHabit(uid, id, patch);
}

export function subscribeScrapbook(
  uid: string,
  cb: (items: Specimen[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeScrapbook, uid, cb);
}

export async function addSpecimen(uid: string, s: Specimen): Promise<void> {
  const m = await impl();
  return m.addSpecimen(uid, s);
}

export async function updateSpecimen(
  uid: string,
  id: string,
  patch: Partial<Specimen>,
): Promise<void> {
  const m = await impl();
  return m.updateSpecimen(uid, id, patch);
}

export async function deleteSpecimen(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteSpecimen(uid, id);
}

// ── The ledger ──────────────────────────────────────────────────

export function subscribeBooks(
  uid: string,
  cb: (items: Book[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeBooks, uid, cb);
}
export async function addBook(uid: string, b: Book): Promise<void> {
  const m = await impl();
  return m.addBook(uid, b);
}
export async function deleteBook(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteBook(uid, id);
}

export function subscribeVisits(
  uid: string,
  cb: (items: Visit[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeVisits, uid, cb);
}
export async function addVisit(uid: string, v: Visit): Promise<void> {
  const m = await impl();
  return m.addVisit(uid, v);
}
export async function deleteVisit(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteVisit(uid, id);
}

export function subscribeHomes(
  uid: string,
  cb: (items: Home[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeHomes, uid, cb);
}
export async function addHome(uid: string, h: Home): Promise<void> {
  const m = await impl();
  return m.addHome(uid, h);
}
export async function deleteHome(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteHome(uid, id);
}

export function subscribeLanguages(
  uid: string,
  cb: (items: Language[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeLanguages, uid, cb);
}
export async function addLanguage(uid: string, l: Language): Promise<void> {
  const m = await impl();
  return m.addLanguage(uid, l);
}
export async function deleteLanguage(
  uid: string,
  id: string,
): Promise<void> {
  const m = await impl();
  return m.deleteLanguage(uid, id);
}

export function subscribeJobs(
  uid: string,
  cb: (items: Job[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeJobs, uid, cb);
}
export async function addJob(uid: string, j: Job): Promise<void> {
  const m = await impl();
  return m.addJob(uid, j);
}
export async function deleteJob(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteJob(uid, id);
}

// ── Milestones + time blocks ────────────────────────────────────

export function subscribeMilestones(
  uid: string,
  cb: (items: Milestone[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeMilestones, uid, cb);
}
export async function addMilestone(uid: string, m: Milestone): Promise<void> {
  const impl_ = await impl();
  return impl_.addMilestone(uid, m);
}
export async function deleteMilestone(
  uid: string,
  id: string,
): Promise<void> {
  const impl_ = await impl();
  return impl_.deleteMilestone(uid, id);
}

export function subscribeTimeBlocks(
  uid: string,
  cb: (items: TimeBlock[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeTimeBlocks, uid, cb);
}
export async function addTimeBlock(
  uid: string,
  t: TimeBlock,
): Promise<void> {
  const impl_ = await impl();
  return impl_.addTimeBlock(uid, t);
}
export async function deleteTimeBlock(
  uid: string,
  id: string,
): Promise<void> {
  const impl_ = await impl();
  return impl_.deleteTimeBlock(uid, id);
}

export function subscribeWeighins(
  uid: string,
  cb: (items: Weighin[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeWeighins, uid, cb);
}

export async function addWeighin(uid: string, w: Weighin): Promise<void> {
  const m = await impl();
  return m.addWeighin(uid, w);
}

export async function deleteWeighin(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteWeighin(uid, id);
}

export function subscribeDreams(
  uid: string,
  cb: (items: Dream[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeDreams, uid, cb);
}

export async function addDream(uid: string, d: Dream): Promise<void> {
  const m = await impl();
  return m.addDream(uid, d);
}

export async function updateDream(
  uid: string,
  id: string,
  patch: Partial<Dream>,
): Promise<void> {
  const m = await impl();
  return m.updateDream(uid, id, patch);
}

export async function deleteDream(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteDream(uid, id);
}

export function subscribeImpressions(
  uid: string,
  cb: (items: Impression[]) => void,
): () => void {
  return lazySubscribe((m) => m.subscribeImpressions, uid, cb);
}

export async function addImpression(
  uid: string,
  i: Impression,
): Promise<void> {
  const m = await impl();
  return m.addImpression(uid, i);
}

export async function updateImpression(
  uid: string,
  id: string,
  patch: Partial<Impression>,
): Promise<void> {
  const m = await impl();
  return m.updateImpression(uid, id, patch);
}

export async function deleteImpression(
  uid: string,
  id: string,
): Promise<void> {
  const m = await impl();
  return m.deleteImpression(uid, id);
}

export async function addWorkout(
  uid: string,
  workout: Workout,
): Promise<void> {
  const m = await impl();
  return m.addWorkout(uid, workout);
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteWorkout(uid, id);
}

export async function addMeal(uid: string, meal: Meal): Promise<void> {
  const m = await impl();
  return m.addMeal(uid, meal);
}

export async function deleteMeal(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteMeal(uid, id);
}

export async function addTransaction(
  uid: string,
  tx: Transaction,
): Promise<void> {
  const m = await impl();
  return m.addTransaction(uid, tx);
}

export async function deleteTransaction(
  uid: string,
  id: string,
): Promise<void> {
  const m = await impl();
  return m.deleteTransaction(uid, id);
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

export async function loadActiveCities(limitN = 50) {
  const m = await impl();
  return m.loadActiveCities(limitN);
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

// ── Circle (friend daily-report access) ─────────────────────────

export async function grantCircleAccess(
  ownerUid: string,
  viewerUid: string,
): Promise<void> {
  const m = await impl();
  return m.grantCircleAccess(ownerUid, viewerUid);
}

export async function revokeCircleAccess(
  ownerUid: string,
  viewerUid: string,
): Promise<void> {
  const m = await impl();
  return m.revokeCircleAccess(ownerUid, viewerUid);
}

export function subscribeFriendDailyReport(
  friendUid: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeFriendDailyReport(friendUid, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}
