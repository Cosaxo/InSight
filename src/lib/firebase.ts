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
  InboundImpression,
  Impression,
  Job,
  Language,
  Meal,
  Milestone,
  MoodEntry,
  Person,
  RemoteBodySnapshot,
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

// ── Interests (the new, simpler concept replacing skills) ───────

export function subscribeInterests(
  uid: string,
  cb: (items: import("./firebaseImpl").RemoteInterest[]) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeInterests(uid, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function addInterest(
  uid: string,
  interest: import("./firebaseImpl").RemoteInterest,
): Promise<void> {
  const m = await impl();
  return m.addInterest(uid, interest);
}

export async function deleteInterest(uid: string, id: string): Promise<void> {
  const m = await impl();
  return m.deleteInterest(uid, id);
}

export async function fetchPublicProfiles(
  uids: string[],
): Promise<Array<{
  uid: string;
  interestNames?: string[];
  personality?: number[];
  gender?: string;
  age?: number;
  country?: string;
}>> {
  const m = await impl();
  return m.fetchPublicProfiles(uids);
}

export type { RemoteInterest } from "./firebaseImpl";

// ── Community interest items (voting) ───────────────────────────

export function subscribeInterestItems(
  interestSlug: string,
  type: import("./firebaseImpl").InterestItemType,
  cb: (items: import("./firebaseImpl").InterestItem[]) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeInterestItems(interestSlug, type, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function checkUserVotes(
  itemIds: string[],
  voterUid: string,
): Promise<Set<string>> {
  const m = await impl();
  return m.checkUserVotes(itemIds, voterUid);
}

export async function addInterestItem(
  uid: string,
  interestSlug: string,
  type: import("./firebaseImpl").InterestItemType,
  name: string,
  description?: string,
): Promise<string> {
  const m = await impl();
  return m.addInterestItem(uid, interestSlug, type, name, description);
}

export async function deleteInterestItem(itemId: string): Promise<void> {
  const m = await impl();
  return m.deleteInterestItem(itemId);
}

export async function upvoteInterestItem(
  itemId: string,
  voterUid: string,
): Promise<void> {
  const m = await impl();
  return m.upvoteInterestItem(itemId, voterUid);
}

export async function removeInterestVote(
  itemId: string,
  voterUid: string,
): Promise<void> {
  const m = await impl();
  return m.removeInterestVote(itemId, voterUid);
}

export function slugifyInterest(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type {
  InterestItem,
  InterestItemType,
} from "./firebaseImpl";

// Lazy accessor for the Firestore instance. Used by hooks that need
// to construct doc/onSnapshot refs against arbitrary paths (the
// thin firebase.ts wrappers don't cover every collection by hand).
export async function getDb(): Promise<import("firebase/firestore").Firestore> {
  const m = await impl();
  return m.getDbInstance();
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

// Inbound (cross-user)
export function subscribeInboundImpressions(
  recipientUid: string,
  cb: (items: InboundImpression[]) => void,
): () => void {
  return lazySubscribe(
    (m) => m.subscribeInboundImpressions,
    recipientUid,
    cb,
  );
}

export async function sendInboundImpression(
  recipientUid: string,
  i: InboundImpression,
): Promise<void> {
  const m = await impl();
  return m.sendInboundImpression(recipientUid, i);
}

export async function deleteInboundImpression(
  recipientUid: string,
  id: string,
): Promise<void> {
  const m = await impl();
  return m.deleteInboundImpression(recipientUid, id);
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

// ── Daily reports ───────────────────────────────────────────────

export function subscribeDailyReport(
  uid: string,
  date: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeDailyReport(uid, date, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribeAllDailyReports(
  uid: string,
  cb: (reports: RemoteDailyReport[]) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeAllDailyReports(uid, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function upsertDailyReport(
  uid: string,
  date: string,
  report: RemoteDailyReport,
): Promise<void> {
  const m = await impl();
  return m.upsertDailyReport(uid, date, report);
}

export async function deleteDailyReport(
  uid: string,
  date: string,
): Promise<void> {
  const m = await impl();
  return m.deleteDailyReport(uid, date);
}

// ── Body / wearable snapshots ────────────────────────────────────

export function subscribeBodySnapshot(
  uid: string,
  date: string,
  cb: (snap: RemoteBodySnapshot | null) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeBodySnapshot(uid, date, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function upsertBodySnapshot(
  uid: string,
  date: string,
  snap: RemoteBodySnapshot,
): Promise<void> {
  const m = await impl();
  return m.upsertBodySnapshot(uid, date, snap);
}

export async function migrateLegacyDailyReport(uid: string): Promise<boolean> {
  const m = await impl();
  return m.migrateLegacyDailyReport(uid);
}

// ── Daily-photo cloud sync (opt-in) ─────────────────────────────

export async function uploadDailyPhoto(
  uid: string,
  date: string,
  dataUrl: string,
): Promise<string> {
  const m = await impl();
  return m.uploadDailyPhoto(uid, date, dataUrl);
}

export async function downloadDailyPhoto(
  uid: string,
  date: string,
): Promise<string | null> {
  const m = await impl();
  return m.downloadDailyPhoto(uid, date);
}

export async function deleteDailyPhoto(
  uid: string,
  date: string,
): Promise<void> {
  const m = await impl();
  return m.deleteDailyPhoto(uid, date);
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
    personality?: number[];
    political?: { econ: number; social: number } | null;
    bio?: string | null;
    role?: string | null;
    age?: number | null;
    interestNames?: string[] | null;
    gender?: string | null;
    country?: string | null;
    acceptImpressionsFrom?: string | null;
    blockedImpressionTraits?: string[] | null;
    shareImpressionsAbout?: string | null;
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

// ── Relations: follow / friend / block ──────────────────────────

export async function followUser(actorUid: string, targetUid: string): Promise<void> {
  const m = await impl();
  return m.followUser(actorUid, targetUid);
}

export async function unfollowUser(actorUid: string, targetUid: string): Promise<void> {
  const m = await impl();
  return m.unfollowUser(actorUid, targetUid);
}

export async function sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
  const m = await impl();
  return m.sendFriendRequest(fromUid, toUid);
}

export async function checkOutgoingFriendRequest(
  fromUid: string,
  toUid: string,
): Promise<boolean> {
  const m = await impl();
  return m.checkOutgoingFriendRequest(fromUid, toUid);
}

export async function acceptFriendRequest(
  ownerUid: string,
  requesterUid: string,
): Promise<void> {
  const m = await impl();
  return m.acceptFriendRequest(ownerUid, requesterUid);
}

export async function declineFriendRequest(
  ownerUid: string,
  requesterUid: string,
): Promise<void> {
  const m = await impl();
  return m.declineFriendRequest(ownerUid, requesterUid);
}

export async function cancelFriendRequest(
  ownerUid: string,
  recipientUid: string,
): Promise<void> {
  const m = await impl();
  return m.cancelFriendRequest(ownerUid, recipientUid);
}

export async function unfriend(actorUid: string, otherUid: string): Promise<void> {
  const m = await impl();
  return m.unfriend(actorUid, otherUid);
}

export async function blockUser(actorUid: string, blockedUid: string): Promise<void> {
  const m = await impl();
  return m.blockUser(actorUid, blockedUid);
}

export async function unblockUser(actorUid: string, blockedUid: string): Promise<void> {
  const m = await impl();
  return m.unblockUser(actorUid, blockedUid);
}

// ── Subscriptions for relation lists ────────────────────────────

import type { RelationDoc } from "./firebaseImpl";
export type { RelationDoc };

function lazyRelationSub(
  method: "subscribeFollowers" | "subscribeFollowing" | "subscribeFriendRequests" | "subscribeCircle" | "subscribeBlocks",
  uid: string,
  cb: (items: RelationDoc[]) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m[method](uid, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribeFollowers(uid: string, cb: (items: RelationDoc[]) => void) {
  return lazyRelationSub("subscribeFollowers", uid, cb);
}
export function subscribeFollowing(uid: string, cb: (items: RelationDoc[]) => void) {
  return lazyRelationSub("subscribeFollowing", uid, cb);
}
export function subscribeFriendRequests(uid: string, cb: (items: RelationDoc[]) => void) {
  return lazyRelationSub("subscribeFriendRequests", uid, cb);
}
export function subscribeCircle(uid: string, cb: (items: RelationDoc[]) => void) {
  return lazyRelationSub("subscribeCircle", uid, cb);
}
export function subscribeBlocks(uid: string, cb: (items: RelationDoc[]) => void) {
  return lazyRelationSub("subscribeBlocks", uid, cb);
}

export function subscribeFriendDailyReport(
  friendUid: string,
  date: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;
  impl().then((m) => {
    if (cancelled) return;
    unsub = m.subscribeFriendDailyReport(friendUid, date, cb);
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

// ── Account deletion ────────────────────────────────────────────

export async function reauthWithPassword(password: string): Promise<void> {
  const m = await impl();
  return m.reauthWithPassword(password);
}

export async function callDeleteAccount(): Promise<{
  ok: boolean;
  ownSubtree: number;
  discoverable: number;
  othersInbound: number;
  othersRelations: number;
}> {
  const m = await impl();
  return m.callDeleteAccount();
}
