// politicsTaxonomy.ts — reference data for the political compass.
//
// These three constants used to live in `seedData.ts` alongside fake
// user-state seeds (avgCircle, avgWorld, made-up "your circle"
// aggregates). They're not fake — they're the standard taxonomy the
// political test renders against:
//
//   IDEOLOGIES      — named ideologies placed on the 2D econ × social
//                     compass for landmark/closest-match calculation.
//   IDEOLOGY_MARKS  — canonical thinker positions (Marx, Locke,
//                     Hobbes…) drawn as small marks on the compass
//                     for orientation.
//   POLITICAL_AXES  — the 6 axis ids + display labels. The pole
//                     names come from SUB_LABELS in politics.tsx.
//
// Moving them here separates "taxonomy we ship" from "fake data we
// used to invent." The legacy `IS_DATA.ideologies` etc. paths still
// work because seedData.ts re-spreads these constants — that lets
// the few remaining IS_DATA consumers (GroupsTab, etc.) migrate at
// their own pace.

export interface Ideology {
  id: string;
  name: string;
  econ: number;
  social: number;
}

export interface IdeologyMark {
  name: string;
  econ: number;
  social: number;
}

export interface PoliticalAxis {
  id: string;
  label: string;
  poles: [string, string];
}

export const IDEOLOGIES: Ideology[] = [
  { id: "soc-dem", name: "Social Democrat", econ: -34, social: -10 },
  { id: "green-left", name: "Green-Left", econ: -50, social: -45 },
  { id: "liberal", name: "Liberal", econ: 10, social: -34 },
  { id: "libertarian", name: "Libertarian", econ: 72, social: -68 },
  { id: "conservat", name: "Conservative", econ: 40, social: 46 },
  { id: "communit", name: "Communitarian", econ: -28, social: 44 },
  { id: "anarcho", name: "Anarchist", econ: -78, social: -78 },
  { id: "tech-prog", name: "Technoprogressive", econ: 18, social: -22 },
];

export const IDEOLOGY_MARKS: IdeologyMark[] = [
  { name: "Mill", econ: 20, social: -55 },
  { name: "Marx", econ: -82, social: -8 },
  { name: "Rand", econ: 84, social: -76 },
  { name: "Hobbes", econ: 10, social: 78 },
  { name: "Solnit", econ: -56, social: -52 },
  { name: "Rawls", econ: -28, social: -18 },
];

export const POLITICAL_AXES: PoliticalAxis[] = [
  { id: "econ", label: "economic", poles: ["state", "market"] },
  { id: "social", label: "social", poles: ["liberty", "authority"] },
  { id: "foreign", label: "foreign", poles: ["cooperative", "sovereign"] },
  { id: "env", label: "environment", poles: ["extractive", "protective"] },
  { id: "tech", label: "technology", poles: ["precaution", "acceleration"] },
  { id: "auth", label: "authority", poles: ["horizontal", "hierarchical"] },
];
