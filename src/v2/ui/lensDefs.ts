// Types and constants for the Mirror's live lens BODIES (D99).
//
// A separate module for a mechanical reason worth stating: eslint's
// react-refresh rule requires a component file to export only components,
// and LiveMirrorLenses.tsx needs to share a question shape and a type
// filter with its host. The rule is right — a constant re-exported from a
// component file breaks fast refresh for everything that imports it.
import type { ByMap } from "../data/cohort";

/**
 * The five lenses LiveMirrorLenses renders.
 *
 * Their LABELS are not here. This module is imported at runtime only by
 * the lazy lens chunk; the tab row is entry-side, and a label map read
 * from both would hoist this file into a shared chunk the entry has to
 * preload — measured at +2 KB on the eager graph, which is over budget
 * (check:bundle). The labels live in ./lensTabs, which only the row
 * imports. The TYPE crossing that seam is free — it is erased.
 */
// `foresight` left this union at D136, when the owner took the lens off the
// Mirror. The ENGINE did not go with it: data/foresight.ts, its verdict
// rules and LiveForesightLens.tsx all stand, tested, waiting for the
// placement D126 already named as the open follow-on — the feed, where the
// prototype puts it. Re-adding the lens is re-adding this member and the
// three lines that read it.
export type LensId = "people" | "compare" | "explore" | "scores";

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
  /**
   * The counts of the STOP THIS LENS IS STANDING ON — the City stop's
   * city cell, the Country stop's country cell, the World stop's globe.
   *
   * It was the globe on every stop until D170, while Compare and Scores
   * printed the stop's name over it ("against Oslo", "How Oslo rated
   * it"). Not a fabricated number — a real one describing a crowd it
   * never counted, which is D157's failure one tab over. It was visible
   * from the app: Answers said "1 more question has no answers from Oslo
   * yet" while Compare drew that same question at 50/50.
   */
  counts: number[];
  /**
   * The published GLOBE, whatever stop this is — Explore's baseline and
   * only Explore's.
   *
   * Explore is global by construction and says so: its slices are
   * `by[dim]` buckets across everyone (there is no city × age cell to
   * read), and its sentence is "25-34 are 12 points more likely…
   * Same as everyone." So its comparison must stay against everyone,
   * which is why the globe survives as its own field rather than being
   * replaced by the scope cell.
   */
  all: number[];
  by: ByMap | undefined;
  mine: number;
  /** The bank's question type — Scores filters on ORDINAL_TYPES (D100). */
  type?: string;
  /** The bank's subject branch (D100); undefined on a pre-D100 seed. */
  branch?: string;
  /**
   * The bank's short label — "Nature access", "Getting around" (D186).
   *
   * Scores draws this instead of the prompt, because a scorecard is a
   * column of nouns beside one baseline and a column of questions is a
   * list you read one at a time. Undefined outside the daily bank and on
   * a pre-D186 seed, so the card falls back to the prompt.
   */
  tag?: string;
  /**
   * Which Mirror stop's scorecard may fold this question — "city" |
   * "country" | "world" (D186), absent on every question that rates no
   * place, which is most of the bank.
   *
   * THE POINT OF THE FIELD is that a place scorecard has to be about the
   * place. Until D186 Scores drew every ordinal question the archive
   * held, headed "How Oslo rated them" — so a city's scorecard led with
   * "Breakfast is the best meal of the day", which is a true average of
   * a real crowd and says nothing whatever about Oslo. The subject is
   * not derivable from the counts, the type or the branch; it is a
   * property of the QUESTION, so the question declares it.
   */
  rates?: string;
}
