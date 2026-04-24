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

// ── Ambient (weather / AQI) ──

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string; // "Oslo, Norway" — filled from reverse geocode if available
}

export interface AirQuality {
  co?: number;
  o3?: number;
  no2?: number;
  so2?: number;
  pm2_5?: number;
  pm10?: number;
  usEpaIndex?: number; // 1..6
  gbDefraIndex?: number; // 1..10
}

export interface Ambient {
  fetchedAt: number; // ms epoch
  location: string;
  tempC: number;
  feelsLikeC: number;
  conditionText: string;
  conditionCode: number; // WeatherAPI code
  isDay: boolean;
  humidity: number;
  pressureMb: number;
  windKph: number;
  windMph: number;
  windDir: string; // "NW"
  windDegree: number;
  uv: number;
  cloudPct: number;
  precipMm: number;
  air?: AirQuality;
}

// ── Celestial ──

export type PlanetName = "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn";

export interface BodyState {
  name: string;
  altitudeDeg: number; // negative = below horizon
  azimuthDeg: number;
  magnitude?: number; // brightness (lower = brighter)
  isUp: boolean;
  isNakedEye: boolean; // alt > 5° and mag < 5
  nextRise?: Date | null;
  nextSet?: Date | null;
}

export interface MoonState extends BodyState {
  phaseName: string; // e.g., "Waxing Gibbous"
  illuminationPct: number; // 0..100
}

// WeatherAPI also gives pre-computed sunrise/sunset strings, but we derive
// everything from astronomy-engine for consistency — hence SunState is a
// plain BodyState for now.
export type SunState = BodyState;

export interface MeteorShower {
  name: string;
  peakMonth: number; // 1..12
  peakDay: number; // day of month
  startDay: string; // "MM-DD" window start
  endDay: string; // "MM-DD" window end
  peakZhr: number; // expected meteors/hour at peak
  radiant: string; // constellation
}

export interface ActiveShower extends MeteorShower {
  daysToPeak: number; // negative if past peak
}

export interface CelestialSnapshot {
  computedAt: number; // ms epoch
  observer: GeoPoint;
  sun: SunState;
  moon: MoonState;
  planets: BodyState[];
  activeShowers: ActiveShower[];
}
