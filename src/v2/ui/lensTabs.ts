// The Mirror stop's tab row: its shape and its labels (D119).
//
// Split from ./lensDefs for a reason the bundle gate found rather than a
// reason of taste. lensDefs is imported at runtime ONLY by the lazy lens
// chunk; this row is entry-side. A label map read from both makes the
// bundler hoist its module into a shared chunk that the entry then
// preloads — measured at +2 KB on the eager graph, one over
// check:bundle's ceiling, for two dozen bytes of strings. Types may cross
// that seam freely (they are erased); values may not.
//
// It is also not a .tsx: eslint's react-refresh rule wants a component
// file to export only components, and MirrorLensTabs.tsx is one.
import type { LensId } from "./lensDefs";

/** One stop in the row. */
export interface LensTab {
  id: string;
  label: string;
}

/** The five lens bodies, by the name the row shows for each. */
export const LENS_LABEL: Record<LensId, string> = {
  people: "People",
  compare: "Compare",
  explore: "Explore",
  scores: "Scores",
  // v19's own feature, and the only lens that is a GAME rather than a
  // reading (D125). Last in the row because it is the one you play after
  // the others have taught you what a population looks like.
  foresight: "Foresight",
};

/** A cohort stop's own two tabs, beside the four lenses. */
export type StopTabId = "answers" | "overview";

/**
 * Answers and Overview, in row order — Answers first, and it is what a
 * stop opens on.
 *
 * The prototype's nav v2 puts Overview first. The field IS the screen
 * there, drawn from mirror-field-pops' invented people, so it is never
 * empty. Live, the constellation is a fold over completed test scores
 * (D112) and stays empty until a population has taken them, while the
 * answer rows publish from the first answer (D98). Opening a stop onto a
 * canvas reading "no country has answered the score questions yet" is
 * how the World stop reads today, and it is not what the stop is for.
 * Overview is one tap away and keeps its place directly after.
 */
export const TAB_LABEL: Record<StopTabId, string> = {
  answers: "Answers",
  overview: "Overview",
};
