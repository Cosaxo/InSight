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
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type {
  CityRating,
  CityRatings,
  CoreValues,
  Habit,
  Hero,
  Meal,
  MediaMap,
  MoodEntry,
  Person,
  Political,
  RemoteDailyReport,
  Transaction,
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

export interface RemoteProfile {
  personality?: number[];
  political?: Political;
  cv?: CoreValues;
  media?: MediaMap;
  likes?: string[];
  dislikes?: string[];
  heroes?: Hero[];
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
  dailyReport?: RemoteDailyReport | null;
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function init(config: FirebaseConfig): void {
  if (app) return;
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
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

// ── Daily reports (Phase 4) ─────────────────────────────────────

export function subscribeDailyReport(
  uid: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  // Single "today" doc — overwritten each time the user edits today's
  // report. Past days could be stored under their own date key in a
  // future iteration.
  return onSnapshot(
    subDocRef(uid, "insight_daily", "today"),
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

export async function upsertDailyReport(
  uid: string,
  report: RemoteDailyReport,
): Promise<void> {
  await setDoc(
    subDocRef(uid, "insight_daily", "today"),
    { ...report, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteDailyReport(uid: string): Promise<void> {
  await deleteDoc(subDocRef(uid, "insight_daily", "today"));
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

  for (const mood of payload.moods) {
    await setDoc(subDocRef(uid, "insight_moods", mood.date), mood);
  }

  for (const [cityName, rating] of Object.entries(payload.cityRatings)) {
    await setDoc(subDocRef(uid, "insight_cityratings", cityName), rating);
  }

  if (payload.dailyReport) {
    await setDoc(subDocRef(uid, "insight_daily", "today"), {
      ...payload.dailyReport,
      updatedAt: serverTimestamp(),
    });
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
