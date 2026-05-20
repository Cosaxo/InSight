// Design tokens ported from the prototype.
// These replicate the "refined" palette — less saturated hues paired with
// pastel section backgrounds so each insight dimension is colour-coded.

export const C = {
  bg: "#f5f7fa",
  card: "#ffffff",
  divider: "#e8edf5",
  navy: "#0f172a",
  text: "#1e293b",
  muted: "#7a8eab",
  dim: "#eef1f8",

  teal: "#0f766e",
  coral: "#ea580c",
  purple: "#6d28d9",
  green: "#15803d",
  amber: "#92400e",
  red: "#be123c",
  pink: "#be185d",
  cyan: "#0e7490",
  blue: "#1d4ed8",
  indigo: "#3730a3",
  rose: "#be123c",
  lime: "#3f6212",

  shadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 20px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)",
} as const;

// Pastel hue presets — each section maps to one.
const HUE = {
  violet: { bg: "#faf8ff", border: "#ddd6fe", accent: "#6d28d9" },
  amber: { bg: "#fefce8", border: "#fde68a", accent: "#92400e" },
  teal: { bg: "#f0fdf9", border: "#99f6e4", accent: "#0f766e" },
  green: { bg: "#f0fdf4", border: "#bbf7d0", accent: "#15803d" },
  blue: { bg: "#eff6ff", border: "#bfdbfe", accent: "#1d4ed8" },
  orange: { bg: "#fff8f1", border: "#fed7aa", accent: "#c2410c" },
  rose: { bg: "#fff1f2", border: "#fecaca", accent: "#be123c" },
  cyan: { bg: "#ecfeff", border: "#a5f3fc", accent: "#0e7490" },
} as const;

export type SectionKey =
  | "personality"
  | "political"
  | "values"
  | "interests"
  | "media"
  | "likes"
  | "dislikes"
  | "heroes"
  | "mood"
  | "habits"
  | "fitness"
  | "nutrition"
  | "finance"
  | "around"
  | "world"
  | "city"
  | "people";

export interface SectionStyle {
  bg: string;
  border: string;
  accent: string;
  label: string;
}

export const SEC: Record<SectionKey, SectionStyle> = {
  personality: { ...HUE.violet, label: "Personality" },
  political: { ...HUE.amber, label: "Political" },
  values: { ...HUE.teal, label: "Core Values" },
  interests: { ...HUE.green, label: "Interests" },
  media: { ...HUE.blue, label: "Media" },
  likes: { ...HUE.green, label: "Likes" },
  dislikes: { ...HUE.rose, label: "Dislikes" },
  heroes: { ...HUE.violet, label: "Heroes" },
  mood: { ...HUE.orange, label: "Mood" },
  habits: { ...HUE.teal, label: "Habits" },
  fitness: { ...HUE.cyan, label: "Fitness" },
  nutrition: { ...HUE.rose, label: "Nutrition" },
  finance: { ...HUE.violet, label: "Finance" },
  around: { ...HUE.teal, label: "Around" },
  world: { ...HUE.blue, label: "World" },
  city: { ...HUE.amber, label: "City" },
  people: { ...HUE.green, label: "People" },
};

// Refined colours for FAB actions — each action gets a distinct hue.
export const FAB_COLORS = {
  insights: "#6d28d9",
  connect: "#2563eb",
  filter: "#0f766e",
  search: "#be123c",
  map: "#b45309",
  add: "#c2410c",
  rate: "#0e7490",
  info: "#0369a1",
  discover: "#a16207",
  create: "#1e40af",
} as const;

export const RAINBOW_GRADIENT =
  "conic-gradient(from 0deg, #0d9488, #2563eb, #7c3aed, #db2777, #f97316, #d97706, #16a34a, #0d9488)";

export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";
