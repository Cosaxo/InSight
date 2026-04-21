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
