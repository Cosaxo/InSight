// Domain types for InSight. Each subscribed Firestore collection
// pairs with a hook in src/lib (useMoods / useHabits / useScrapbook /
// useDreams / useImpressions / useWorkouts / useMeals / useTransactions /
// useDailyReport / useCityRatings / useRelations); the shapes those
// hooks read and write live here.

export type TabId = "around" | "world" | "city" | "interests" | "people";

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

// A single popular item within a scope, with how many people in that
// scope listed it. Produced by the media aggregator Cloud Function.
export interface MediaPopularItem {
  name: string;
  count: number;
}
// Top media per category for a scope (around / city / world). Any
// category may be absent when no one in scope shared it.
export type ScopeMedia = Partial<Record<MediaKey, MediaPopularItem[]>>;

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
  // Current 7-dimension set surfaced by the City tab.
  beauty?: number;
  commute?: number;
  safety?: number;
  culture?: number;
  nature?: number;
  food?: number;
  cost?: number;
  // Legacy fields kept for backwards compatibility — old docs
  // written under the previous schema still parse cleanly. The
  // City-tab UI no longer renders these; the Cloud Function
  // aggregate also ignores them.
  nightlife?: number;
  architecture?: number;
  transport?: number;
  pace?: number;
  openness?: number;
}

export type CityRatings = Record<string, CityRating>;

// One slice of the user's typical-day clock. Stored on the
// profile (dayTemplate: DayBlock[]). `from`/`to` are decimal hours
// 0..24 — 6:30 → 6.5. `hue` is an OKLCH hue 0..360.
export interface DayBlock {
  from: number;
  to: number;
  label: string;
  hue: number;
}

// A life milestone — a single dated event on the personal timeline
// (births, deaths, moves, jobs, trips, "the day I first…"). Stored
// at insight_users/{uid}/insight_milestones/{id}.
export interface Milestone {
  id: string;
  date: string;       // ISO YYYY-MM-DD
  title: string;
  note?: string;
  hue: number;        // OKLCH hue for the timeline dot
  createdAt: number;
}

// A logged time-tracking block — a real session the user spent on
// something (deep work, training, a chore). Stored at
// insight_users/{uid}/insight_time_blocks/{id}. Distinct from
// DayBlock (template) — TimeBlock entries are actual events with
// a real calendar date.
export interface TimeBlock {
  id: string;
  date: string;       // ISO YYYY-MM-DD the block belongs to
  from: number;       // decimal hours 0..24
  to: number;         // decimal hours 0..24
  label: string;
  category?: string;  // optional grouping ("deep work", "rest")
  hue: number;
  createdAt: number;
}

// ── The ledger: life-history entries ────────────────────────────
// Each of the five ledger types lives in its own
// insight_users/{uid}/insight_{kind}/{id} subcollection. They share
// `id` + `createdAt` for sorting and otherwise diverge by entity.
// LifeOverlay's age tab aggregates counts + recent entries from all
// five into a single "the ledger" section.

// A book the user has finished (or abandoned). `date` is when they
// finished it. `rating` is optional 1..5.
export interface Book {
  id: string;
  title: string;
  author?: string;
  date?: string; // ISO YYYY-MM-DD — when finished
  rating?: number; // 1..5
  note?: string;
  createdAt: number;
}

// A trip the user took. `country` is the ISO country name or local
// label; `city` is optional (some trips are wider). `start` is
// required, `end` optional for ongoing trips.
export interface Visit {
  id: string;
  country: string;
  city?: string;
  start: string; // ISO YYYY-MM-DD
  end?: string;  // ISO YYYY-MM-DD
  note?: string;
  createdAt: number;
}

// A place the user has called home — a city / town / neighbourhood,
// with the year range they lived there.
export interface Home {
  id: string;
  place: string;       // free-form ("Oslo, Grünerløkka" or "Bergen")
  startYear: number;
  endYear?: number;    // omitted when this is current
  note?: string;
  createdAt: number;
}

// A language the user speaks (or is learning). Proficiency is a
// coarse 1..5: 1 = a few words, 2 = travel basics, 3 = conversational,
// 4 = fluent, 5 = native. Free-form `note` for context.
export interface Language {
  id: string;
  name: string;
  proficiency: number; // 1..5
  note?: string;
  createdAt: number;
}

// A job (paid or otherwise) the user has held. Same start/end shape
// as Visit. `role` is the title; `org` is the employer / context.
export interface Job {
  id: string;
  role: string;
  org?: string;
  start: string;      // ISO YYYY-MM-DD or YYYY for year-only
  end?: string;       // omitted when current
  note?: string;
  createdAt: number;
}

// A weigh-in — one row in the user's weight history. Stored at
// insight_users/{uid}/insight_weighins/{id} when signed in or in
// localStorage otherwise. The latest weigh-in's kg (sorted by `date`)
// is what LifeOverlay reads to scale tissue mass and what
// ProfileOverlay shows as "current weight". When no weigh-ins
// exist we fall back to the static `profile.weightKg` field, which
// the user can still set directly for the one-shot case.
export interface Weighin {
  id: string;
  date: string;     // ISO YYYY-MM-DD
  kg: number;       // one decimal of precision
  note?: string;    // optional ("after the swim")
  createdAt: number; // ms epoch, for sort
}

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

// An *inbound* impression — anonymous traits left for the recipient
// by someone in their circle. Stored at
// insight_users/{recipientUid}/insight_inbound_impressions/{id}.
// Cross-user write: the Firestore rule allows insert when
// senderUid == request.auth.uid AND the sender is in the
// recipient's circle subcollection (the recipient must have added
// the sender as a relation with linkedUid).
//
// senderUid is in the doc for rule enforcement (anti-spoofing) and
// to let the recipient delete or block. The UI surfaces them as
// anonymous by default — "anonymous · traits only · no longhand."
export interface InboundImpression {
  id: string;
  senderUid: string;
  traits: string[];
  context?: string;   // free-form short label ("after a coffee", "colleague")
  createdAt: number;
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
  // Firebase Storage path when the user has opted into cloud
  // photo backup (profile.cloudPhotos). Other devices fetch the
  // bytes via downloadDailyPhoto and cache to localStorage.
  // Omitted when cloud photos are off.
  photoPath?: string;
  shared: string[];
  updatedAt?: unknown; // server timestamp
}

// Wearable snapshot — one doc per day at
// insight_users/{uid}/insight_body/{YYYY-MM-DD}. Each metric is
// optional so a real native bridge (HealthKit / Health Connect)
// can fill what it has access to; the BodyOverlay UI renders only
// the fields that are present.
export interface RemoteBodySnapshot {
  date: string;
  hrvMs?: number;             // resting HRV, milliseconds (RMSSD)
  restingHrBpm?: number;
  steps?: number;
  vo2Max?: number;
  bodyBattery?: number;       // 0..100 Garmin-style daily energy
  sleepMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  trainingLoad?: number;      // CTL / ATL composite, source-dependent
  stress?: number;            // 0..100
  source?: "mock" | "healthkit" | "health-connect" | "garmin" | "fitbit";
  updatedAt?: unknown;        // server timestamp
}
