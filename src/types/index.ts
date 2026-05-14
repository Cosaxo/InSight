// Domain types for InSight. Each subscribed Firestore collection
// pairs with a hook in src/lib (useMoods / useHabits / useScrapbook /
// useDreams / useImpressions / useWorkouts / useMeals / useTransactions /
// useDailyReport / useCityRatings / useRelations); the shapes those
// hooks read and write live here.

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

export interface Hero {
  name: string;
  role: string;
  reason: string;
}

export type MediaKey = "music" | "film" | "books" | "podcasts";

export type MediaMap = Record<MediaKey, string[]>;

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

// A dream — one entry in your dream journal. Stored at
// insight_users/{uid}/insight_dreams/{id} when signed in or in
// localStorage otherwise. `tags` doubles as the source for the
// "recurring themes" derivation on the dreams view (top tag
// frequencies → bar list). `lucidity` + `vividness` are 0-5
// sliders; both default to 0 when the user didn't move them.
export interface Dream {
  id: string;
  date: string;       // ISO YYYY-MM-DD
  title: string;
  text: string;       // longhand body — what you remember
  tags: string[];     // free-form theme tags ("water", "flying", "home")
  mood?: string;      // optional one-word mood ("uneasy", "warm")
  lucidity: number;   // 0..5
  vividness: number;  // 0..5
  createdAt: number;  // ms epoch for sort
}

// An impression — your private sketch of a person you've met. The
// "of others" side of the impressions ledger. Stored at
// insight_users/{uid}/insight_impressions/{id}; never shared.
// `color` is a palette key (sienna/sage/ochre/indigo/plum) the UI
// resolves to a CSS var. `traits` is a free list of short labels.
export interface Impression {
  id: string;
  who: string;          // the person's name, free text
  when: string;         // free-form display date ("apr 28 · 2026")
  where?: string;       // location (optional)
  context?: string;     // "first met · coffee" etc (optional)
  warmth: number;       // 0..100
  depth: number;        // 0..100
  energy: number;       // 0..100
  traits: string[];
  note?: string;
  color: string;        // palette key
  createdAt: number;    // ms epoch, for sort
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
