// taxonomies.ts — shared taxonomy enums lifted out of the IS_DATA
// `any` blob. Like politicsTaxonomy, these are reference data the
// app legitimately ships (categories, glyphs, hues), not fake user
// state. They sit here so AroundTab / GroupsTab / future surfaces
// can import a typed module instead of indexing into IS_DATA.
//
// seedData.ts re-spreads these constants so any straggling
// `IS_DATA.interestCats` lookup still resolves while consumers
// migrate.

export interface CategoryDef {
  id: string;
  label: string;
  hue: number;
  glyph: string;
}

export interface GroupTestQuestion {
  q: string;
  opts: { t: string; cats: string[] }[];
}

// Categories used by AroundTab person interest pills and PersonOverlay.
export const INTEREST_CATS: CategoryDef[] = [
  { id: "sports", label: "Sports", hue: 12, glyph: "◉" },
  { id: "outdoor", label: "Outdoor", hue: 145, glyph: "△" },
  { id: "fitness", label: "Fitness", hue: 25, glyph: "↗" },
  { id: "literary", label: "Literary", hue: 38, glyph: "✎" },
  { id: "thought", label: "Thought", hue: 250, glyph: "○" },
  { id: "music", label: "Music", hue: 305, glyph: "♪" },
  { id: "art", label: "Art & craft", hue: 80, glyph: "✦" },
  { id: "games", label: "Games", hue: 200, glyph: "♟" },
  { id: "tech", label: "Tech", hue: 260, glyph: "◇" },
  { id: "food", label: "Food", hue: 30, glyph: "◐" },
  { id: "civic", label: "Civic", hue: 220, glyph: "✚" },
  { id: "faith", label: "Faith", hue: 285, glyph: "✟" },
];

// Categories used by the skills surface in life-ledger + the
// GroupsTab "find your circle" questionnaire result.
export const SKILL_CATS: CategoryDef[] = [
  { id: "sport", label: "Sport", hue: 12, glyph: "◉" },
  { id: "outdoor", label: "Outdoor", hue: 145, glyph: "△" },
  { id: "craft", label: "Craft", hue: 38, glyph: "✎" },
  { id: "mind", label: "Mind", hue: 80, glyph: "◇" },
  { id: "language", label: "Language", hue: 220, glyph: "ℒ" },
  { id: "music", label: "Music", hue: 305, glyph: "♪" },
  { id: "kitchen", label: "Kitchen", hue: 60, glyph: "◐" },
  { id: "tech", label: "Tech", hue: 250, glyph: "▢" },
];

// Three-question circle-finder questionnaire in GroupsTab. Each
// option maps to one or more skill-cat ids; the highest cumulative
// score determines the group the user is shown.
export const GROUP_TEST: GroupTestQuestion[] = [
  {
    q: "Best Sunday morning?",
    opts: [
      { t: "Sweat, ball, score", cats: ["sports", "fitness"] },
      { t: "A long swim, then bread", cats: ["outdoor", "food"] },
      { t: "Pages and a window", cats: ["literary", "thought"] },
      { t: "Hands moving, a workshop", cats: ["art", "tech"] },
      { t: "A board, two cups", cats: ["games"] },
    ],
  },
  {
    q: "What you secretly want more of",
    opts: [
      { t: "A racquet, a partner", cats: ["sports"] },
      { t: "Lungs that ache (good)", cats: ["outdoor", "fitness"] },
      { t: "Conversations that turn", cats: ["thought", "literary"] },
      { t: "Songs you can't shake", cats: ["music"] },
      { t: "Pieces that move just so", cats: ["games", "art"] },
    ],
  },
  {
    q: "How you'd rather show up",
    opts: [
      { t: "Kit on, ready", cats: ["sports", "fitness"] },
      { t: "In wool and wet socks", cats: ["outdoor"] },
      { t: "With a notebook", cats: ["literary", "thought"] },
      { t: "With your hands stained", cats: ["art", "food"] },
      { t: "With a folding chair", cats: ["civic", "music"] },
    ],
  },
];
