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
  // reading (D126). Last in the row because it is the one you play after
  // the others have taught you what a population looks like.
  foresight: "Foresight",
};

/** A cohort stop's own two tabs, beside the four lenses. */
export type StopTabId = "answers" | "overview";

/**
 * Overview and Answers, in row order — Overview first, and it is what a
 * stop opens on.
 *
 * REVERSED at D135, by the owner, against the prototype. The note this
 * replaces argued for Answers-first and its reasoning was sound: the
 * prototype's field is never empty because it is drawn from invented
 * people, while the live constellation folds over completed test scores
 * (D112) and stays empty until a population has taken them. Opening the
 * World stop onto "no country has answered the score questions yet" was
 * the case against.
 *
 * What changed is not that argument — it still holds — but what is done
 * about it. The field is the stop's IDENTITY: "you at the centre, them
 * arranged around you, distance = how unlike you" is the sentence the
 * whole Mirror tab is built to say, and burying it one tap behind a list
 * of answer rows made every stop open on the same screen with a different
 * heading. An empty field is answered where it happens — the Overview
 * body says what it is waiting for and points at the tab that is full
 * today (see LiveSimilarityField's sparse arm) — rather than by putting a
 * different tab in front of it.
 */
export const TAB_LABEL: Record<StopTabId, string> = {
  answers: "Answers",
  overview: "Overview",
};

/**
 * Row order for a cohort stop's own two tabs.
 *
 * Exported as a list rather than left to the caller's array literal
 * because the ORDER is the decision above, and a second caller writing it
 * out again is how the two would drift.
 */
export const STOP_TABS: StopTabId[] = ["overview", "answers"];

/** What a cohort stop opens on. */
export const DEFAULT_STOP_TAB: StopTabId = "overview";
