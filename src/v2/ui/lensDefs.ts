// Types and labels for the Mirror's live lens row (D99).
//
// A separate module for a mechanical reason worth stating: eslint's
// react-refresh rule requires a component file to export only components,
// and LiveMirrorLenses.tsx needs to share both a label map and a question
// shape with its host. The rule is right — a constant re-exported from a
// component file breaks fast refresh for everything that imports it.
import type { ByMap } from "../data/cohort";

export type LensId = "people" | "compare" | "explore";

export const LENS_LABEL: Record<LensId, string> = {
  people: "People",
  compare: "Compare",
  explore: "Explore",
};

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
}
