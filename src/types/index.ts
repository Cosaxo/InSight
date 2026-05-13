// Domain types for the insight dashboard.
// A "profile" is the generic shape that is rendered by PeopleInsightPanel —
// it can describe the World, a city, a community, or a single person.

export type TabId = "around" | "world" | "city" | "groups" | "people";

export type RelationCategory =
  | "family"
  | "close"
  | "friend"
  | "work"
  | "acquaintance";

export interface Political {
  econ: number; // -50 left ... +50 right
  social: number; // -50 lib  ... +50 auth
}

export interface CoreValues {
  indiv: number; // -50 individualist ... +50 collective
  change: number; // -50 stability    ... +50 change
}

export interface InterestBar {
  label: string;
  pct: number;
}

export interface Hero {
  name: string;
  role: string;
  reason: string;
}

export type MediaKey = "music" | "film" | "books" | "podcasts";

export type MediaMap = Record<MediaKey, string[]>;

export interface Profile {
  name: string;
  subtitle?: string;
  color: string;
  personality: number[]; // [O, C, E, A, R] — 0..100
  political: Political;
  cv: CoreValues;
  interests: InterestBar[];
  values: string[];
}

export interface Community extends Profile {
  id: string;
  members: number;
  compat: number;
  topics: string[];
}

export interface Hangout {
  date: string;
  note: string;
}

// A person — either a nearby stranger or someone in the user's relations.
export interface Person {
  id: string;
  name: string;
  init: string;
  color: string;
  personality: number[];
  political: Political;
  cv: CoreValues;
  interests: string[];
  values?: string[];
  category?: RelationCategory;
  match?: number;
  hangouts?: Hangout[];
  media?: MediaMap | null;
  likes?: string[];
  dislikes?: string[];
  heroes?: Hero[];
}

export interface Me {
  personality: number[];
  political: Political;
  cv: CoreValues;
  media: MediaMap;
  likes: string[];
  dislikes: string[];
  heroes: Hero[];
  displayName: string;
  photoURL?: string | null;
}

export type TestType = "personality" | "political" | "values";

export interface TestResult {
  personality?: number[];
  political?: Political;
  cv?: CoreValues;
}

export interface ContextBarItem {
  icon: string;
  label: string;
  value: string;
  color?: string;
  sub?: string;
}

export interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
  bg?: string;
  sub?: string;
}

export interface MediaGenreOption {
  label: string;
  icon: string;
  color: string;
  genres: string[];
}

export type MediaOptionsMap = Record<MediaKey, MediaGenreOption>;

export interface CityRating {
  food?: number;
  nightlife?: number;
  culture?: number;
  architecture?: number;
  safety?: number;
  cost?: number;
  nature?: number;
  transport?: number;
  // Added in Phase 4 — the city-tab star rating UI exposes these too.
  pace?: number;
  openness?: number;
}

export type CityRatings = Record<string, CityRating>;

// ── Personal Insights ──

export interface MoodEntry {
  date: string;
  score: number; // 1..5
  note?: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[]; // ISO YYYY-MM-DD dates
}

// A scrapbook specimen — one row in the user's field journal.
// `category` matches an id in IS_DATA.scrapbookCats (or the legacy
// SCRAP_CATS in ScrapbookOverlay) so the UI can attach glyph + hue.
// `latin` and `note` are optional. `photoData` is an optional
// base64-encoded image kept in localStorage on the user's device
// (we don't sync image blobs to Firestore — too big, and the photo
// stays on the device that took it).
export interface Specimen {
  id: string;
  category: string;
  name: string;
  latin?: string;
  date: string; // free-form display date ("apr 12 · 2026") or ISO
  loc?: string;
  note?: string;
  createdAt: number; // ms epoch, for sorting "recent finds"
}

export type WorkoutIntensity = "Low" | "Medium" | "High";
export type WorkoutType =
  | "Run"
  | "Walk"
  | "Cycle"
  | "Swim"
  | "Strength"
  | "HIIT"
  | "Yoga"
  | "Other";

export interface Workout {
  id: string;
  date: string;
  type: WorkoutType;
  duration: number; // minutes
  intensity: WorkoutIntensity;
  kcal: number;
  notes?: string;
}

export interface Meal {
  id: string;
  date: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  note?: string;
}

export type InsightTabId =
  | "mood"
  | "habits"
  | "fitness"
  | "nutrition"
  | "finance";

// ── Daily report (Phase 4) ────────────────────────────────────────────────
// Persisted at insight_users/{uid}/insight_daily/{date} when signed in,
// or under `insight.dailyReport.v1` in localStorage otherwise. The
// `photo` field is omitted when stored remotely (file uploads not wired)
// — the local photo blob stays in localStorage under
// `insight.dailyReport.photo.v1`.
export interface RemoteDailyReport {
  date: string; // doc id: "today" or an ISO date
  mood: number;
  moodLabel: string;
  one_line: string;
  weather: string;
  hasPhoto: boolean;
  photoId?: string; // a stock-photo key like "fjord"; user-uploaded photos stay local
  shared: string[];
  updatedAt?: unknown; // server timestamp
}
