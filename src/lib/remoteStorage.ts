// Firestore driver. Layout under `insight_users/{uid}`:
//   (top-level doc)       profile fields (personality, political, cv, media,
//                         likes, dislikes, heroes, updatedAt)
//   relations/{id}
//   insight_cityratings/{cityName}
//   insight_moods/{id}
//   insight_habits/{id}
//   insight_workouts/{id}
//   insight_meals/{id}
//   insight_transactions/{id}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { fbDb } from "./firebase";
import type {
  CityRating,
  CityRatings,
  Habit,
  Hero,
  Meal,
  MediaMap,
  MoodEntry,
  Person,
  Political,
  CoreValues,
  Transaction,
  Workout,
} from "../types";

export interface RemoteProfile {
  personality?: number[];
  political?: Political;
  cv?: CoreValues;
  media?: MediaMap;
  likes?: string[];
  dislikes?: string[];
  heroes?: Hero[];
}

// ── Paths ──

function userDoc(uid: string) {
  if (!fbDb) throw new Error("Firestore not initialised");
  return doc(fbDb, "insight_users", uid);
}

function sub(uid: string, name: string) {
  if (!fbDb) throw new Error("Firestore not initialised");
  return collection(fbDb, "insight_users", uid, name);
}

function subDoc(uid: string, name: string, id: string) {
  if (!fbDb) throw new Error("Firestore not initialised");
  return doc(fbDb, "insight_users", uid, name, id);
}

// ── Profile ──

export async function loadProfile(uid: string): Promise<RemoteProfile | null> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  return snap.data() as RemoteProfile;
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

// ── Generic sub-collection subscribe (unordered) ──

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
    (err) => console.error(`[remoteStorage] ${name}:`, err),
  );
}

// ── Relations ──

export function subscribeRelations(
  uid: string,
  cb: (items: Person[]) => void,
): () => void {
  return subscribeList<Person>(uid, "relations", cb);
}

export async function addRelation(uid: string, person: Person): Promise<void> {
  const body = stripId(person);
  await addDoc(sub(uid, "relations"), { ...body, addedAt: serverTimestamp() });
}

export async function updateRelation(
  uid: string,
  id: string,
  patch: Partial<Person>,
): Promise<void> {
  const body = stripId(patch);
  await updateDoc(subDoc(uid, "relations", id), body);
}

function stripId<T extends { id?: string }>(obj: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...obj };
  delete copy.id;
  return copy as Omit<T, "id">;
}

export async function deleteRelation(uid: string, id: string): Promise<void> {
  await deleteDoc(subDoc(uid, "relations", id));
}

// ── City ratings (one doc per city, keyed by name) ──

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
    (err) => console.error("[remoteStorage] cityratings:", err),
  );
}

export async function setCityRating(
  uid: string,
  cityName: string,
  key: keyof CityRating,
  value: number,
): Promise<void> {
  await setDoc(
    subDoc(uid, "insight_cityratings", cityName),
    { [key]: value },
    { merge: true },
  );
}

// ── Moods ──

export function subscribeMoods(
  uid: string,
  cb: (items: MoodEntry[]) => void,
): () => void {
  return subscribeList<MoodEntry & { id?: string }>(uid, "insight_moods", cb);
}

export async function upsertMood(
  uid: string,
  entry: MoodEntry,
): Promise<void> {
  // Keyed by ISO date so updating today's mood overwrites rather than appending
  await setDoc(subDoc(uid, "insight_moods", entry.date), entry);
}

export async function deleteMood(uid: string, date: string): Promise<void> {
  await deleteDoc(subDoc(uid, "insight_moods", date));
}

// ── Habits ──

export function subscribeHabits(
  uid: string,
  cb: (items: Habit[]) => void,
): () => void {
  return subscribeList<Habit>(uid, "insight_habits", cb);
}

export async function addHabit(uid: string, habit: Habit): Promise<void> {
  const { id, ...body } = habit;
  await setDoc(subDoc(uid, "insight_habits", id), body);
}

export async function updateHabit(
  uid: string,
  id: string,
  patch: Partial<Habit>,
): Promise<void> {
  await updateDoc(subDoc(uid, "insight_habits", id), patch);
}

// ── Workouts ──

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
  const { id, ...body } = workout;
  await setDoc(subDoc(uid, "insight_workouts", id), body);
}

// ── Meals ──

export function subscribeMeals(
  uid: string,
  cb: (items: Meal[]) => void,
): () => void {
  return subscribeList<Meal>(uid, "insight_meals", cb);
}

export async function addMeal(uid: string, meal: Meal): Promise<void> {
  const { id, ...body } = meal;
  await setDoc(subDoc(uid, "insight_meals", id), body);
}

// ── Transactions ──

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
  const { id, ...body } = tx;
  await setDoc(subDoc(uid, "insight_transactions", id), body);
}

// ── First sign-in migration ──

export interface MigrationPayload {
  profile: RemoteProfile;
  relations: Person[];
  cityRatings: CityRatings;
  moods: MoodEntry[];
  habits: Habit[];
  workouts: Workout[];
  meals: Meal[];
  transactions: Transaction[];
}

// Seeds the user's subtree with local state when they sign in for the first
// time (profile doc doesn't yet exist). Returns true when migration ran.
export async function migrateFromLocal(
  uid: string,
  payload: MigrationPayload,
): Promise<boolean> {
  const existing = await getDoc(userDoc(uid));
  if (existing.exists()) return false;

  await saveProfile(uid, payload.profile);

  const sc = async <T extends { id: string }>(name: string, items: T[]) => {
    for (const item of items) {
      const { id, ...body } = item;
      await setDoc(subDoc(uid, name, id), body);
    }
  };

  await sc("relations", payload.relations);
  await sc("insight_habits", payload.habits);
  await sc("insight_workouts", payload.workouts);
  await sc("insight_meals", payload.meals);
  await sc("insight_transactions", payload.transactions);

  for (const mood of payload.moods) {
    await setDoc(subDoc(uid, "insight_moods", mood.date), mood);
  }

  for (const [cityName, rating] of Object.entries(payload.cityRatings)) {
    await setDoc(subDoc(uid, "insight_cityratings", cityName), rating);
  }

  return true;
}

// Check-only helper used before running a migration.
export async function profileExists(uid: string): Promise<boolean> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists();
}

// Useful for one-off reads (e.g. diagnostics).
export async function snapshotSubCollection<T>(
  uid: string,
  name: string,
): Promise<T[]> {
  const snap = await getDocs(sub(uid, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}
