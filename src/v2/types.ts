// InSight v2 — the domain contract, started from the prototype's data shapes
// (design/spec-modules/sample-data.js) and the extracted launch content
// (/content/*.json). This file is the seam the live data layer (Phase 2)
// implements; spec components migrate onto these types incrementally.

// ── Core question shapes ────────────────────────────────────────

export type DailyQuestionType = "scale" | "binary" | "choice" | "rating";

export interface DailyQuestion {
  type: DailyQuestionType;
  prompt: string;
  /** present for binary/choice; scale uses the shared 5-point agree scale */
  options?: string[];
  /** trait word the question loads on (drives "you vs them" phrasing) */
  axis?: string;
  tone?: "light" | "deep" | "blend";
}

export interface FeedOption {
  label: string;
  /** live count — synthetic in the prototype, real aggregates in production */
  count?: number;
}

export interface FeedQuestion {
  id: string;
  /** topic id (chip row) — or "test" for a test's own item surfaced in the feed */
  cat: string;
  type: "vote" | "duel" | "ranking" | "scale";
  prompt: string;
  options: FeedOption[] | string[];
  /** set only on a test's own questions — the test it advances (decision: sa9 fix) */
  test?: TestKey;
  /** scene id when the question comes from a followed scene */
  scene?: string;
}

// ── Duels (the "know each other" layer) ─────────────────────────

export type GroupQuestionKind = "classic" | "pick" | "us";

export interface GroupQuestion {
  id: string;
  /** classic: options[]; pick: options are the group members; us: about the group */
  kind?: GroupQuestionKind;
  prompt: string;
  options?: string[];
}

export interface DuoQuestion {
  prompt: string;
  options: [string, string] | string[];
}

// ── Tests & archetypes ──────────────────────────────────────────

export type TestKey = "big5" | "political" | "values" | "attachment";

export interface TestItem {
  q: string;
  /** dimension the item loads on (e.g. O/C/E/A/N for big5) */
  d: string;
  /** reverse-scored item */
  rev?: boolean;
}

export interface TestDef {
  label: string;
  dims: Record<string, string>;
  questions: TestItem[];
}

export interface Archetype {
  name: string;
  /** population share, percent — honest rarity, sums ≈100 per test */
  share: number;
  line: string;
  /** signature vector on the test's dims; nearest-type matching */
  sig: Record<string, number>;
}

// ── People & populations ────────────────────────────────────────

export interface Scene {
  id: string;
  name: string;
  sub?: string | null;
  joined?: boolean;
}

export type MirrorPopulation = "you" | "circle" | "groups" | "near" | "world";
export type WorldZoom = "city" | "country" | "world";

export interface Person {
  id: string;
  name: string;
  init: string;
  hue: number;
  rel?: string;
  /** 0–100 similarity to the viewer, when computed */
  match?: number;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}
