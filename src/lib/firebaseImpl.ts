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
import { distanceBetween, geohashQueryBounds } from "geofire-common";
import type {
  CityRating,
  CityRatings,
  CoreValues,
  Habit,
  Hero,
  Impression,
  Meal,
  MediaMap,
  MoodEntry,
  Person,
  Political,
  RemoteDailyReport,
  Specimen,
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
  // Physical / vital stats — optional, used by LifeOverlay to scale
  // the mass-by-tissue breakdown and the years-lived counters. When
  // missing, LifeOverlay shows a prompt to fill them in instead of
  // displaying made-up numbers.
  weightKg?: number;
  birthYear?: number;
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

// Subscribe to a *friend's* daily report. Wraps subscribeDailyReport
// so callers don't have to know that the subscription itself works on
// any uid — the rule enforces access. Read failure manifests as a
// "permission-denied" snapshot error, which the cb receives as null.
export function subscribeFriendDailyReport(
  friendUid: string,
  cb: (report: RemoteDailyReport | null) => void,
): () => void {
  return onSnapshot(
    doc(db(), "insight_users", friendUid, "insight_daily", "today"),
    (snap) => cb(snap.exists() ? (snap.data() as RemoteDailyReport) : null),
    () => cb(null), // permission denied or other error → treat as no report
  );
}
