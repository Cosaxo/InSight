// Types and labels for the Mirror's live lens row (D99).
//
// A separate module for a mechanical reason worth stating: eslint's
// react-refresh rule requires a component file to export only components,
// and LiveMirrorLenses.tsx needs to share both a label map and a question
// shape with its host. The rule is right — a constant re-exported from a
// component file breaks fast refresh for everything that imports it.
import type { ByMap } from "../data/cohort";

export type LensId = "people" | "compare" | "explore" | "scores" | "foresight";

export const LENS_LABEL: Record<LensId, string> = {
  people: "People",
  compare: "Compare",
  explore: "Explore",
  scores: "Scores",
  // v19's own feature, and the only lens here that is a GAME rather than
  // a reading (D102). It sits last because it is the one you play after
  // the others have taught you what a population looks like.
  foresight: "Foresight",
};

/**
 * The question types whose option INDEX carries magnitude, and so the
 * only ones Scores may average (D100).
 *
 * `rating` is the bank's 1-10 scale and `scale` its 5-point Likert. A
 * `binary`, `choice` or `dilemma` has options that are merely different
 * from each other — averaging "Messi" and "Ronaldo" produces a number
 * with no referent, and it would look exactly as confident as a real one.
 */
export const ORDINAL_TYPES = new Set(["rating", "scale"]);

/**
 * A question as the lenses need it: the prompt, its options, the published
 * counts and breakdown, and the viewer's own pick (-1 when unanswered).
 *
 * Assembled ONCE by the host rather than by each lens — all three walk
 * every question in the deck, and three copies of that walk is three
 * chances for them to disagree about which questions are in view.
 */
export interface LensQuestion {
  id: string;
  text: string;
  options: string[];
  counts: number[];
  by: ByMap | undefined;
  mine: number;
  /** The bank's question type — Scores filters on ORDINAL_TYPES (D100). */
  type?: string;
  /** The bank's subject branch (D100); undefined on a pre-D100 seed. */
  branch?: string;
}
