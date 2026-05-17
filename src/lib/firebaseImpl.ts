// Firebase implementation module. Everything here statically imports the
// Firebase SDK, so the bundler puts it in its own chunk. The module is only
// reachable via dynamic import from `./firebase.ts`, meaning the SDK never
// lands in the initial bundle.
//
// Don't import this file anywhere except via the lazy wrapper.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  getFirestore,
  GeoPoint,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString,
  type FirebaseStorage,
} from "firebase/storage";
import { distanceBetween, geohashQueryBounds } from "geofire-common";
import { initAppCheck } from "./appcheck";
import type {
  Book,
  CityRating,
  CityRatings,
  CoreValues,
  DayBlock,
  Dream,
  Habit,
  Hero,
  Home,
  InboundImpression,
  Impression,
  Job,
  Language,
  Meal,
  MediaMap,
  Milestone,
  MoodEntry,
  Person,
  Political,
  RemoteDailyReport,
  Specimen,
  TimeBlock,
  Transaction,
  Visit,
  Weighin,
  Workout,
} from "../types";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

export type ShareLevel = "nobody" | "circle" | "city" | "world";

export interface RemoteProfile {
  personality?: number[];
  political?: Political;
  cv?: CoreValues;
  media?: MediaMap;
  likes?: string[];
  dislikes?: string[];
  heroes?: Hero[];
  // Physical / vital stats — optional, used by LifeOverlay to scale
  // the mass-by-tissue breakdown and the years-lived counters. When
  // missing, LifeOverlay shows a prompt to fill them in instead of
  // displaying made-up numbers.
  weightKg?: number;
  birthYear?: number;
  // User's typical-day clock — an ordered list of slices the rhythms
  // tab in LifeOverlay renders as a 24-hour DayClock. Sits on the
  // profile rather than a subcollection because it's a single
  // small array that the user edits as a whole.
  dayTemplate?: DayBlock[];
  // Per-category sharing prefs. Keys match SHARE_KEYS in
  // SharingOverlay; values are one of the four ShareLevel rungs.
  // Currently only `daily_report` is enforced at the Firestore rule
  // layer — the other entries set user intent for when more
  // cross-user reads land. Absent or unknown keys fall back to the
  // per-category default in SharingOverlay.
  sharePrefs?: Record<string, ShareLevel>;
  // Display currency for FinanceTab — ISO 4217 code (USD / EUR /
  // NOK / GBP / JPY / etc). Drives both the symbol shown and the
  // locale-aware digit grouping. Falls back to USD when missing.
  currency?: string;
  // Opt-in cloud backup of daily-report photos. Off by default —
  // the existing privacy contract is "photos stay on this device."
  // When true, useDailyReport uploads each new photo to Firebase
  // Storage under users/{uid}/dailyPhotos/{date}.jpg and writes
  // the resulting path back into the daily report's photoPath
  // field so other devices can fetch it. Toggling off does not
  // auto-delete already-uploaded photos — the user has to clear
  // them explicitly.
  cloudPhotos?: boolean;
}

export interface MigrationPayload {
  profile: RemoteProfile;
  relations: Person[];
  cityRatings: CityRatings;
  moods: MoodEntry[];
  habits: Habit[];
  workouts: Workout[];
  meals: Meal[];
  transactions: Transaction[];
  // Today's daily report (legacy single-entry). Migrated to a real
  // date doc via `dailyReportHistory` when available.
  dailyReport?: RemoteDailyReport | null;
  // Full daily-report history — each entry becomes
  // insight_daily/{date} on the remote side.
  dailyReportHistory?: RemoteDailyReport[];
  // Subcollections added since the original migration was written.
  // All are arrays of typed-item docs that map straight into
  // insight_users/{uid}/insight_X/{id}. Empty arrays are a no-op
  // for that stream.
  specimens?: Specimen[];
  dreams?: Dream[];
  impressions?: Impression[];
  weighins?: Weighin[];
  books?: Book[];
  visits?: Visit[];
  homes?: Home[];
  languages?: Language[];
  jobs?: Job[];
  milestones?: Milestone[];
  timeBlocks?: TimeBlock[];
  // Skills don't have a typed import here yet (the GroupsTab hook
  // defines its own shape); migration passes through as opaque docs
  // with an id field.
  skills?: { id: string; [k: string]: unknown }[];
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function init(config: FirebaseConfig): void {
  if (app) return;
  app = initializeApp(config);
  // Attest this client before the first Firestore / callable
  // request. Fire-and-forget: the App Check token attaches to
  // subsequent requests once it resolves; queries issued before
  // resolution still work but are unattested.
  void initAppCheck();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  // Storage instance is lazy — only constructed when first asked
  // for via storage(). Most signed-in sessions never touch it
  // (cloud photos are opt-in).
  storageInstance = null;
}

function storage(): FirebaseStorage {
  if (!app) throw new Error("Firebase not initialised");
  if (!storageInstance) storageInstance = getStorage(app);
  return storageInstance;
}

function auth(): Auth {
  if (!authInstance) throw new Error("Firebase not initialised");
  return authInstance;
}

function db(): Firestore {
  if (!dbInstance) throw new Error("Firebase not initialised");
  return dbInstance;
}

// ── Auth ────────────────────────────────────────────────────────

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

// ── Paths ───────────────────────────────────────────────────────

function userDoc(uid: string) {
  return doc(db(), "insight_users", uid);
}

function sub(uid: string, name: string) {
  return collection(db(), "insight_users", uid, name);
}

function subDocRef(uid: string, name: string, id: string) {
  return doc(db(), "insight_users", uid, name, id);
}

function stripId<T extends { id?: string }>(obj: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...obj };
  delete copy.id;
  return copy as Omit<T, "id">;
}

// ── Profile ─────────────────────────────────────────────────────

export async function loadProfile(uid: string): Promise<RemoteProfile | null> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  return snap.data() as RemoteProfile;
}

export async function profileExists(uid: string): Promise<boolean> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists();
}

export async function saveProfile(
  uid: string,
  patch: RemoteProfile,
): Promise<void> {
  await setDoc(
    userDoc(uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── Generic sub-collection subscribe ────────────────────────────

function subscribeList<T>(
  uid: string,
  name: string,
  onChange: (items: T[]) => void,
): () => void {
  return onSnapshot(
    sub(uid, name),
    (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
    },
    (err) => console.error(`[firebaseImpl] ${name}:`, err),
  );
}

// ── Relations ───────────────────────────────────────────────────

export function subscribeRelations(
  uid: string,
  cb: (items: Person[]) => void,
): () => void {
  return subscribeList<Person>(uid, "relations", cb);
}

export async function addRelation(uid: string, person: Person): Promise<void> {
  await addDoc(sub(uid, "relations"), {
    ...stripId(person),
    addedAt: serverTimestamp(),
  });
}

export async function updateRelation(
  uid: string,
  id: string,
  patch: Partial<Person>,
): Promise<void> {
  await updateDoc(subDocRef(uid, "relations", id), stripId(patch));
}

export async function deleteRelation(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "relations", id));
}

// ── City ratings ────────────────────────────────────────────────

export function subscribeCityRatings(
  uid: string,
  cb: (ratings: CityRatings) => void,
): () => void {
  return onSnapshot(
    sub(uid, "insight_cityratings"),
    (snap) => {
      const out: CityRatings = {};
      snap.docs.forEach((d) => {
        out[d.id] = d.data() as CityRating;
      });
      cb(out);
    },
    (err) => console.error("[firebaseImpl] cityratings:", err),
  );
}

export async function setCityRating(
  uid: string,
  cityName: string,
  key: keyof CityRating,
  value: number,
): Promise<void> {
  await setDoc(
    subDocRef(uid, "insight_cityratings", cityName),
    { [key]: value },
    { merge: true },
  );
}

// ── Moods ───────────────────────────────────────────────────────

// COST NOTE: the mood collection grows by one doc/day forever. Bound
// the subscription to the most recent ~60 days — the Insights mood
// chart only needs the last 30, and 60 keeps a small buffer for stats
// that look slightly past the window. After a year of daily logging
// this reduces per-snapshot reads from 365 to 60 (~6× cheaper).
const MOODS_WINDOW = 60;

export function subscribeMoods(
  uid: string,
  cb: (items: MoodEntry[]) => void,
): () => void {
  return onSnapshot(
    query(sub(uid, "insight_moods"), orderBy("date", "desc"), limit(MOODS_WINDOW)),
    (snap) => {
      cb(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as unknown as MoodEntry,
        ),
      );
    },
    (err) => console.error("[firebaseImpl] moods:", err),
  );
}

export async function upsertMood(
  uid: string,
  entry: MoodEntry,
): Promise<void> {
  await setDoc(subDocRef(uid, "insight_moods", entry.date), entry);
}

export async function deleteMood(uid: string, date: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_moods", date));
}

// ── Habits ──────────────────────────────────────────────────────

export function subscribeHabits(
  uid: string,
  cb: (items: Habit[]) => void,
): () => void {
  return subscribeList<Habit>(uid, "insight_habits", cb);
}

export async function addHabit(uid: string, habit: Habit): Promise<void> {
  await setDoc(subDocRef(uid, "insight_habits", habit.id), stripId(habit));
}

export async function updateHabit(
  uid: string,
  id: string,
  patch: Partial<Habit>,
): Promise<void> {
  await updateDoc(subDocRef(uid, "insight_habits", id), patch);
}

export async function deleteHabit(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_habits", id));
}

// ── Scrapbook ───────────────────────────────────────────────────

export function subscribeScrapbook(
  uid: string,
  cb: (items: Specimen[]) => void,
): () => void {
  return subscribeList<Specimen>(uid, "insight_scrapbook", cb);
}

export async function addSpecimen(uid: string, s: Specimen): Promise<void> {
  await setDoc(subDocRef(uid, "insight_scrapbook", s.id), stripId(s));
}

export async function updateSpecimen(
  uid: string,
  id: string,
  patch: Partial<Specimen>,
): Promise<void> {
  await updateDoc(subDocRef(uid, "insight_scrapbook", id), patch);
}

export async function deleteSpecimen(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_scrapbook", id));
}

// ── The ledger (books / visits / homes / languages / jobs) ───────
// Each entity has the same five-op surface (subscribe / add / update
// / delete / list). The shared `addLedger` / `removeLedger` helpers
// would deduplicate this further, but explicit functions per type
// keep the wire-up legible from the call sites.

export function subscribeBooks(
  uid: string,
  cb: (items: Book[]) => void,
): () => void {
  return subscribeList<Book>(uid, "insight_books", cb);
}
export async function addBook(uid: string, b: Book): Promise<void> {
  await setDoc(subDocRef(uid, "insight_books", b.id), stripId(b));
}
export async function deleteBook(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_books", id));
}

export function subscribeVisits(
  uid: string,
  cb: (items: Visit[]) => void,
): () => void {
  return subscribeList<Visit>(uid, "insight_visits", cb);
}
export async function addVisit(uid: string, v: Visit): Promise<void> {
  await setDoc(subDocRef(uid, "insight_visits", v.id), stripId(v));
}
export async function deleteVisit(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_visits", id));
}

export function subscribeHomes(
  uid: string,
  cb: (items: Home[]) => void,
): () => void {
  return subscribeList<Home>(uid, "insight_homes", cb);
}
export async function addHome(uid: string, h: Home): Promise<void> {
  await setDoc(subDocRef(uid, "insight_homes", h.id), stripId(h));
}
export async function deleteHome(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_homes", id));
}

export function subscribeLanguages(
  uid: string,
  cb: (items: Language[]) => void,
): () => void {
  return subscribeList<Language>(uid, "insight_languages", cb);
}
export async function addLanguage(uid: string, l: Language): Promise<void> {
  await setDoc(subDocRef(uid, "insight_languages", l.id), stripId(l));
}
export async function deleteLanguage(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_languages", id));
}

export function subscribeJobs(
  uid: string,
  cb: (items: Job[]) => void,
): () => void {
  return subscribeList<Job>(uid, "insight_jobs", cb);
}
export async function addJob(uid: string, j: Job): Promise<void> {
  await setDoc(subDocRef(uid, "insight_jobs", j.id), stripId(j));
}
export async function deleteJob(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_jobs", id));
}

// ── Milestones + Time blocks ────────────────────────────────────

export function subscribeMilestones(
  uid: string,
  cb: (items: Milestone[]) => void,
): () => void {
  return subscribeList<Milestone>(uid, "insight_milestones", cb);
}
export async function addMilestone(uid: string, m: Milestone): Promise<void> {
  await setDoc(subDocRef(uid, "insight_milestones", m.id), stripId(m));
}
export async function deleteMilestone(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_milestones", id));
}

export function subscribeTimeBlocks(
  uid: string,
  cb: (items: TimeBlock[]) => void,
): () => void {
  return subscribeList<TimeBlock>(uid, "insight_time_blocks", cb);
}
export async function addTimeBlock(uid: string, t: TimeBlock): Promise<void> {
  await setDoc(subDocRef(uid, "insight_time_blocks", t.id), stripId(t));
}
export async function deleteTimeBlock(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_time_blocks", id));
}

// ── Weigh-ins ───────────────────────────────────────────────────

export function subscribeWeighins(
  uid: string,
  cb: (items: Weighin[]) => void,
): () => void {
  return subscribeList<Weighin>(uid, "insight_weighins", cb);
}

export async function addWeighin(uid: string, w: Weighin): Promise<void> {
  await setDoc(subDocRef(uid, "insight_weighins", w.id), stripId(w));
}

export async function deleteWeighin(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_weighins", id));
}

// ── Dreams ──────────────────────────────────────────────────────

export function subscribeDreams(
  uid: string,
  cb: (items: Dream[]) => void,
): () => void {
  return subscribeList<Dream>(uid, "insight_dreams", cb);
}

export async function addDream(uid: string, d: Dream): Promise<void> {
  await setDoc(subDocRef(uid, "insight_dreams", d.id), stripId(d));
}

export async function updateDream(
  uid: string,
  id: string,
  patch: Partial<Dream>,
): Promise<void> {
  await updateDoc(subDocRef(uid, "insight_dreams", id), patch);
}

export async function deleteDream(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_dreams", id));
}

// ── Inbound impressions (cross-user) ────────────────────────────
//
// A *recipient* subscribes to their own inbox. A *sender* writes
// directly into the recipient's subcollection — the rule enforces
// (a) senderUid == auth.uid (anti-spoof) and (b) sender is in
// recipient's circle.

export function subscribeInboundImpressions(
  recipientUid: string,
  cb: (items: InboundImpression[]) => void,
): () => void {
  return subscribeList<InboundImpression>(
    recipientUid,
    "insight_inbound_impressions",
    cb,
  );
}

export async function sendInboundImpression(
  recipientUid: string,
  i: InboundImpression,
): Promise<void> {
  await setDoc(
    subDocRef(recipientUid, "insight_inbound_impressions", i.id),
    stripId(i),
  );
}

export async function deleteInboundImpression(
  recipientUid: string,
  id: string,
): Promise<void> {
  await deleteDoc(subDocRef(recipientUid, "insight_inbound_impressions", id));
}

// ── Impressions ─────────────────────────────────────────────────

export function subscribeImpressions(
  uid: string,
  cb: (items: Impression[]) => void,
): () => void {
  return subscribeList<Impression>(uid, "insight_impressions", cb);
}

export async function addImpression(
  uid: string,
  i: Impression,
): Promise<void> {
  await setDoc(subDocRef(uid, "insight_impressions", i.id), stripId(i));
}

export async function updateImpression(
  uid: string,
  id: string,
  patch: Partial<Impression>,
): Promise<void> {
  await updateDoc(subDocRef(uid, "insight_impressions", id), patch);
}

export async function deleteImpression(
  uid: string,
  id: string,
): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_impressions", id));
}

// ── Skills (Groups tab) ─────────────────────────────────────────

export interface RemoteSkill {
  id: string;
  name: string;
  cat: string;
  level: number;
  hours: number;
  lastPracticed?: string;
  joined: boolean;
  vibe?: string;
}

export function subscribeSkills(
  uid: string,
  cb: (items: RemoteSkill[]) => void,
): () => void {
  return subscribeList<RemoteSkill>(uid, "insight_skills", cb);
}

export async function addSkill(uid: string, skill: RemoteSkill): Promise<void> {
  await setDoc(subDocRef(uid, "insight_skills", skill.id), stripId(skill));
}

export async function updateSkill(
  uid: string,
  id: string,
  patch: Partial<RemoteSkill>,
): Promise<void> {
  await updateDoc(subDocRef(uid, "insight_skills", id), patch);
}

export async function deleteSkill(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_skills", id));
}

// ── Workouts ────────────────────────────────────────────────────

export function subscribeWorkouts(
  uid: string,
  cb: (items: Workout[]) => void,
): () => void {
  return subscribeList<Workout>(uid, "insight_workouts", cb);
}

export async function addWorkout(
  uid: string,
  workout: Workout,
): Promise<void> {
  await setDoc(subDocRef(uid, "insight_workouts", workout.id), stripId(workout));
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_workouts", id));
}

// ── Meals ───────────────────────────────────────────────────────

export function subscribeMeals(
  uid: string,
  cb: (items: Meal[]) => void,
): () => void {
  return subscribeList<Meal>(uid, "insight_meals", cb);
}

export async function addMeal(uid: string, meal: Meal): Promise<void> {
  await setDoc(subDocRef(uid, "insight_meals", meal.id), stripId(meal));
}

export async function deleteMeal(uid: string, id: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_meals", id));
}

// ── Transactions ────────────────────────────────────────────────

export function subscribeTransactions(
  uid: string,
  cb: (items: Transaction[]) => void,
): () => void {
  return subscribeList<Transaction>(uid, "insight_transactions", cb);
}

export async function addTransaction(
  uid: string,
  tx: Transaction,
): Promise<void> {
  await setDoc(subDocRef(uid, "insight_transactions", tx.id), stripId(tx));
}

export async function deleteTransaction(
  uid: string,
  id: string,
): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_transactions", id));
}

// ── Daily reports ───────────────────────────────────────────────
//
// Schema: one doc per day at insight_users/{uid}/insight_daily/{YYYY-MM-DD}.
// The doc id IS the calendar date. The `date` field on the doc was
// the legacy "today" placeholder; it's redundant now (id is the
// canonical date) but harmless to keep.
//
// Reads:
//   - subscribeDailyReport(uid, date, cb) — single-day subscription
//   - subscribeAllDailyReports(uid, cb)   — full archive, newest first
// Writes:
//   - upsertDailyReport(uid, date, report)
//   - deleteDailyReport(uid, date)
//
// Migration: migrateLegacyDailyReport reads the old "today" doc
// (Phase 4 schema), copies it into a real date doc keyed off its
// own updatedAt timestamp, and deletes the legacy doc. Idempotent —
// safe to call on every mount.

export function subscribeDailyReport(
  uid: string,
  date: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  return onSnapshot(
    subDocRef(uid, "insight_daily", date),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb(snap.data() as RemoteDailyReport);
    },
    (err) => console.error("[firebaseImpl] dailyReport:", err),
  );
}

export function subscribeAllDailyReports(
  uid: string,
  cb: (reports: RemoteDailyReport[]) => void,
): () => void {
  return onSnapshot(
    sub(uid, "insight_daily"),
    (snap) => {
      const items: RemoteDailyReport[] = [];
      snap.forEach((d) => {
        // Skip the legacy "today" doc if it hasn't been migrated yet.
        if (d.id === "today") return;
        items.push({ ...(d.data() as RemoteDailyReport), date: d.id });
      });
      // Sort newest first — Firestore returns docs in id order which
      // is already newest-last for ISO dates; we reverse and ship.
      items.sort((a, b) => b.date.localeCompare(a.date));
      cb(items);
    },
    (err) => console.error("[firebaseImpl] subscribeAllDailyReports:", err),
  );
}

export async function upsertDailyReport(
  uid: string,
  date: string,
  report: RemoteDailyReport,
): Promise<void> {
  await setDoc(
    subDocRef(uid, "insight_daily", date),
    { ...report, date, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteDailyReport(
  uid: string,
  date: string,
): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_daily", date));
}

// ─── Daily-photo cloud sync (opt-in) ──────────────────────────────
//
// Photos for a daily report sit under
// users/{uid}/dailyPhotos/{date}.jpg in Firebase Storage. The Storage
// rules (see storage.rules) constrain reads + writes to the owner.
//
// The Firestore daily-report doc carries `photoPath` (the full
// Storage path) when the user has opted in to cloud photos. Other
// devices recognise that, download the bytes via the Storage SDK,
// and cache the resulting data URL to localStorage like a
// locally-captured photo.

function dailyPhotoPath(uid: string, date: string): string {
  return `users/${uid}/dailyPhotos/${date}.jpg`;
}

// Upload a photo data-URL for the given date. Returns the canonical
// Storage path the caller should persist in the daily-report doc.
// `dataUrl` must be a base64 data URL (e.g. "data:image/jpeg;base64,…")
// — the Storage SDK's uploadString handles the decode.
export async function uploadDailyPhoto(
  uid: string,
  date: string,
  dataUrl: string,
): Promise<string> {
  const path = dailyPhotoPath(uid, date);
  const ref = storageRef(storage(), path);
  await uploadString(ref, dataUrl, "data_url");
  return path;
}

// Fetch a photo back from Storage as a data URL the existing UI can
// render directly. Returns null when the file is missing (caller
// then falls back to whatever the photoId / stock-photo lookup
// resolves to).
export async function downloadDailyPhoto(
  uid: string,
  date: string,
): Promise<string | null> {
  try {
    const ref = storageRef(storage(), dailyPhotoPath(uid, date));
    const url = await getDownloadURL(ref);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    // 404 from getDownloadURL is the common case (cloud photos
    // off, or upload hasn't happened yet) — fall back to null
    // rather than bubbling a noisy error.
    return null;
  }
}

// Remove a single uploaded photo. Used when the user clears their
// photo for a day or toggles cloud photos off and elects to wipe.
export async function deleteDailyPhoto(
  uid: string,
  date: string,
): Promise<void> {
  try {
    const ref = storageRef(storage(), dailyPhotoPath(uid, date));
    await deleteObject(ref);
  } catch {
    // Already gone is fine.
  }
}

// Migrate the legacy `today` doc (Phase 4 schema) to a per-day doc.
// Reads the legacy doc, derives the real date from its updatedAt
// timestamp (falling back to current ISO date if the timestamp is
// missing), copies the payload to insight_daily/{date}, then deletes
// the legacy doc. Returns whether a migration happened.
//
// Idempotent: if the legacy doc doesn't exist, returns false silently.
// Safe to call on every useDailyReport mount — costs one read.
export async function migrateLegacyDailyReport(
  uid: string,
): Promise<boolean> {
  const legacyRef = subDocRef(uid, "insight_daily", "today");
  const snap = await getDoc(legacyRef);
  if (!snap.exists()) return false;
  const data = snap.data() as RemoteDailyReport & {
    updatedAt?: { toDate?: () => Date };
  };

  // Derive the calendar day. Prefer the serverTimestamp the legacy
  // saver wrote (it's a Firestore Timestamp object); fall back to
  // current ISO if it's missing or unparseable.
  let dateIso = "";
  if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
    try {
      const d = data.updatedAt.toDate();
      dateIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      // ignore
    }
  }
  if (!dateIso) {
    const d = new Date();
    dateIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Don't clobber an existing per-day doc — the user might have
  // already written today through the new schema after a session
  // restart. Bail out, but still delete the legacy doc to keep
  // things tidy.
  const targetRef = subDocRef(uid, "insight_daily", dateIso);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) {
    const { updatedAt: _drop, ...payload } = data;
    void _drop;
    await setDoc(targetRef, {
      ...payload,
      date: dateIso,
      updatedAt: serverTimestamp(),
    });
  }
  await deleteDoc(legacyRef);
  return true;
}

// ── First sign-in migration ─────────────────────────────────────

export async function migrateFromLocal(
  uid: string,
  payload: MigrationPayload,
): Promise<boolean> {
  const existing = await getDoc(userDoc(uid));
  if (existing.exists()) return false;

  await saveProfile(uid, payload.profile);

  const writeMany = async <T extends { id: string }>(
    name: string,
    items: T[],
  ) => {
    for (const item of items) {
      await setDoc(subDocRef(uid, name, item.id), stripId(item));
    }
  };

  await writeMany("relations", payload.relations);
  await writeMany("insight_habits", payload.habits);
  await writeMany("insight_workouts", payload.workouts);
  await writeMany("insight_meals", payload.meals);
  await writeMany("insight_transactions", payload.transactions);

  // New typed-item subcollections (added since first-pass migration
  // was written). Each block is optional — empty arrays are a
  // no-op via writeMany's per-item setDoc loop.
  if (payload.specimens) await writeMany("insight_scrapbook", payload.specimens);
  if (payload.dreams) await writeMany("insight_dreams", payload.dreams);
  if (payload.impressions)
    await writeMany("insight_impressions", payload.impressions);
  if (payload.weighins) await writeMany("insight_weighins", payload.weighins);
  if (payload.books) await writeMany("insight_books", payload.books);
  if (payload.visits) await writeMany("insight_visits", payload.visits);
  if (payload.homes) await writeMany("insight_homes", payload.homes);
  if (payload.languages)
    await writeMany("insight_languages", payload.languages);
  if (payload.jobs) await writeMany("insight_jobs", payload.jobs);
  if (payload.milestones)
    await writeMany("insight_milestones", payload.milestones);
  if (payload.timeBlocks)
    await writeMany("insight_time_blocks", payload.timeBlocks);
  if (payload.skills) await writeMany("insight_skills", payload.skills);

  for (const mood of payload.moods) {
    await setDoc(subDocRef(uid, "insight_moods", mood.date), mood);
  }

  for (const [cityName, rating] of Object.entries(payload.cityRatings)) {
    await setDoc(subDocRef(uid, "insight_cityratings", cityName), rating);
  }

  // Daily-report history (per-day archive). Each entry uses its
  // own `date` field as the doc id. If the legacy single-report
  // payload exists and isn't already covered by history, also
  // migrate it (Phase 4 schema → per-day schema bridge).
  const dailyHistory = payload.dailyReportHistory ?? [];
  const historyDates = new Set(dailyHistory.map((r) => r.date));
  const now = new Date();
  const fallbackIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  for (const r of dailyHistory) {
    const isIso = /^\d{4}-\d{2}-\d{2}$/.test(r.date);
    const docId = isIso ? r.date : fallbackIso;
    await setDoc(subDocRef(uid, "insight_daily", docId), {
      ...r,
      date: docId,
      updatedAt: serverTimestamp(),
    });
  }
  if (payload.dailyReport) {
    const dr = payload.dailyReport;
    const isIso = /^\d{4}-\d{2}-\d{2}$/.test(dr.date);
    const docId = isIso ? dr.date : fallbackIso;
    if (!historyDates.has(docId)) {
      await setDoc(subDocRef(uid, "insight_daily", docId), {
        ...dr,
        date: docId,
        updatedAt: serverTimestamp(),
      });
    }
  }

  return true;
}

export async function snapshotSubCollection<T>(
  uid: string,
  name: string,
): Promise<T[]> {
  const snap = await getDocs(sub(uid, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

// ── Geo discovery (cities + nearby users) ───────────────────────
//
// Both queries follow the standard GeoFire pattern: compute the
// geohash prefix ranges that cover the search circle, run those as
// parallel Firestore range queries, then filter the results back
// down to the actual radius with haversine on the client. False-
// positives are normal — geohash bounds are squarish, the radius
// circle is round.

export interface RemoteCity {
  uid: string;
  name: string;
  latitude: number;
  longitude: number;
  geohash: string;
  distanceKm: number;
  // `currentlyActive` is present on the docs from the user's existing
  // Firebase project — a running count of users in that city. Used by
  // the World tab to surface "where life is happening."
  currentlyActive?: number;
}

export interface RemoteDiscoverable {
  uid: string;
  displayName?: string;
  photoColor?: string;
  latitude: number;
  longitude: number;
  geohash: string;
  distanceKm: number;
  lastSeen?: number; // ms since epoch
}

// Read the `location` map regardless of which Firestore representation
// it came back as (GeoPoint instance vs. raw object — Capacitor's
// Firestore JS SDK uses GeoPoint instances; the FlutterFlow tooling
// sometimes wrote plain { latitude, longitude } maps).
function readLocation(
  raw: unknown,
): { latitude: number; longitude: number; geohash: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const loc = raw as {
    geohash?: unknown;
    geopoint?: unknown;
  };
  if (typeof loc.geohash !== "string") return null;
  const gp = loc.geopoint;
  if (gp instanceof GeoPoint) {
    return { latitude: gp.latitude, longitude: gp.longitude, geohash: loc.geohash };
  }
  if (
    gp &&
    typeof gp === "object" &&
    typeof (gp as { latitude?: unknown }).latitude === "number" &&
    typeof (gp as { longitude?: unknown }).longitude === "number"
  ) {
    const o = gp as { latitude: number; longitude: number };
    return { latitude: o.latitude, longitude: o.longitude, geohash: loc.geohash };
  }
  return null;
}

export async function findNearbyCities(
  center: { latitude: number; longitude: number },
  radiusKm: number,
): Promise<RemoteCity[]> {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const radiusM = radiusKm * 1000;
  const bounds = geohashQueryBounds(centerArr, radiusM);
  // Collection name matches the user's existing Firebase project.
  const citiesCol = collection(db(), "Cities");
  const snaps = await Promise.all(
    bounds.map((b) =>
      getDocs(
        query(
          citiesCol,
          orderBy("location.geohash"),
          startAt(b[0]),
          endAt(b[1]),
        ),
      ),
    ),
  );
  const results: RemoteCity[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const data = d.data() as {
        Name?: string;
        location?: unknown;
        currentlyActive?: number;
      };
      const loc = readLocation(data.location);
      if (!loc) continue;
      const dKm = distanceBetween([loc.latitude, loc.longitude], centerArr);
      if (dKm > radiusKm) continue;
      results.push({
        uid: d.id,
        name: data.Name ?? d.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        geohash: loc.geohash,
        distanceKm: dKm,
        currentlyActive: data.currentlyActive ?? 0,
      });
    }
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

// Top-N cities by activity. Used by the World tab — one indexed query,
// at most `limitN` reads, cached by the caller at module level so
// repeated tab visits don't re-spend reads.
//
// Requires a Firestore index on `currentlyActive` desc.
export async function loadActiveCities(limitN = 50): Promise<RemoteCity[]> {
  const citiesCol = collection(db(), "Cities");
  const snap = await getDocs(
    query(citiesCol, orderBy("currentlyActive", "desc"), limit(limitN)),
  );
  const results: RemoteCity[] = [];
  for (const d of snap.docs) {
    const data = d.data() as {
      Name?: string;
      location?: unknown;
      currentlyActive?: number;
    };
    const loc = readLocation(data.location);
    if (!loc) continue;
    results.push({
      uid: d.id,
      name: data.Name ?? d.id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      geohash: loc.geohash,
      distanceKm: 0,
      currentlyActive: data.currentlyActive ?? 0,
    });
  }
  return results;
}

const DISCOVERABLE_COLLECTION = "insight_discoverable";

// Expanding-ring search — keep widening until we have enough or hit
// the user-supplied ceiling. Mirrors the original Flutter approach.
export async function findNearbyDiscoverable(
  center: { latitude: number; longitude: number },
  maxRadiusKm: number,
  excludeUid?: string,
): Promise<RemoteDiscoverable[]> {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const rings = [0.5, 3, 10, maxRadiusKm].filter(
    (r, i, arr) => r <= maxRadiusKm && arr.indexOf(r) === i,
  );
  if (rings.length === 0 || rings[rings.length - 1] < maxRadiusKm) {
    rings.push(maxRadiusKm);
  }

  const seen = new Map<string, RemoteDiscoverable>();
  const col = collection(db(), DISCOVERABLE_COLLECTION);

  for (const r of rings) {
    const radiusM = r * 1000;
    const bounds = geohashQueryBounds(centerArr, radiusM);
    const snaps = await Promise.all(
      bounds.map((b) =>
        getDocs(
          query(
            col,
            orderBy("location.geohash"),
            startAt(b[0]),
            endAt(b[1]),
            limit(30),
          ),
        ),
      ),
    );
    for (const snap of snaps) {
      for (const d of snap.docs) {
        if (d.id === excludeUid) continue;
        if (seen.has(d.id)) continue;
        const data = d.data() as {
          displayName?: string;
          photoColor?: string;
          location?: unknown;
          lastSeen?: number;
        };
        const loc = readLocation(data.location);
        if (!loc) continue;
        const dKm = distanceBetween([loc.latitude, loc.longitude], centerArr);
        if (dKm > r) continue;
        seen.set(d.id, {
          uid: d.id,
          displayName: data.displayName,
          photoColor: data.photoColor,
          latitude: loc.latitude,
          longitude: loc.longitude,
          geohash: loc.geohash,
          distanceKm: dKm,
          lastSeen: data.lastSeen,
        });
      }
    }
    if (seen.size >= 20) break; // mirror Flutter's "enough" threshold
  }

  const out = [...seen.values()];
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, 20);
}

// Upsert / delete the current user's own discoverable doc. Owner-only
// write (enforced in firestore.rules); read is open to any signed-in
// user so nearby-search works.
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
  await setDoc(
    doc(db(), DISCOVERABLE_COLLECTION, uid),
    {
      displayName: data.displayName ?? null,
      photoColor: data.photoColor ?? null,
      location: {
        geohash: data.geohash,
        geopoint: new GeoPoint(data.latitude, data.longitude),
      },
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteDiscoverable(uid: string): Promise<void> {
  await deleteDoc(doc(db(), DISCOVERABLE_COLLECTION, uid));
}

// ── Circle (cross-user daily-report read access) ────────────────
//
// Presence of /insight_users/{ownerUid}/circle/{viewerUid} means
// "viewerUid is allowed to read ownerUid's daily report" (enforced in
// firestore.rules via exists() — viewers themselves cannot list the
// circle collection, so this is privacy-preserving).
//
// Convention: when A adds B to their relations (linkedUid set), A
// calls grantCircleAccess(A, B) — A is sharing their daily with B.
// To see B's daily, B must independently call grantCircleAccess(B, A).

export async function grantCircleAccess(
  ownerUid: string,
  viewerUid: string,
): Promise<void> {
  await setDoc(
    doc(db(), "insight_users", ownerUid, "circle", viewerUid),
    { grantedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function revokeCircleAccess(
  ownerUid: string,
  viewerUid: string,
): Promise<void> {
  await deleteDoc(doc(db(), "insight_users", ownerUid, "circle", viewerUid));
}

// Subscribe to a *friend's* daily report for a specific date. Wraps
// subscribeDailyReport so callers don't have to know that the
// subscription itself works on any uid — the rule enforces access.
// Read failure manifests as a "permission-denied" snapshot error,
// which the cb receives as null. The friend feed in useFriendDailies
// calls this with today's ISO; if the friend hasn't written today,
// snap.exists() is false and the cb fires with null (silently
// omitted from the feed).
export function subscribeFriendDailyReport(
  friendUid: string,
  date: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  return onSnapshot(
    doc(db(), "insight_users", friendUid, "insight_daily", date),
    (snap) => cb(snap.exists() ? (snap.data() as RemoteDailyReport) : null),
    () => cb(null), // permission denied or other error → treat as no report
  );
}

// ── Account deletion ────────────────────────────────────────────
//
// Re-auths the user (Firebase requires recent sign-in for any
// destructive op on the auth account) then invokes the deleteAccount
// Cloud Function, which wipes Firestore data + the auth account.
//
// reauthForDeletion handles the common providers:
//   - email/password: needs the password again
//   - everything else (Apple / Google / etc.): we can't construct
//     the credential client-side here for every provider; instead
//     we throw a clear error asking the user to sign out + back in
//     and retry within 5 minutes. Per-provider re-auth flows can
//     be added later.

export async function reauthWithPassword(password: string): Promise<void> {
  const u = auth().currentUser;
  if (!u || !u.email) {
    throw new Error("Not signed in with an email account");
  }
  const cred = EmailAuthProvider.credential(u.email, password);
  await reauthenticateWithCredential(u, cred);
}

export async function callDeleteAccount(): Promise<{
  ok: boolean;
  ownSubtree: number;
  discoverable: number;
  othersInbound: number;
  othersRelations: number;
}> {
  if (!app) throw new Error("Firebase not initialised");
  const fns = getFunctions(app, "us-central1");
  const fn = httpsCallable<
    Record<string, never>,
    {
      ok: boolean;
      ownSubtree: number;
      discoverable: number;
      othersInbound: number;
      othersRelations: number;
    }
  >(fns, "deleteAccount");
  const res = await fn({});
  return res.data;
}
