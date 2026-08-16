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

/**
 * The four lens bodies, by the name the row shows for each.
 *
 * Foresight was a fifth here from D126 until D136 removed it — an owner
 * decision, not a defect in it. It was the only entry that was a GAME
 * rather than a reading, and the Mirror's row is where a population gets
 * READ; the prototype this tree syncs against puts that game in the feed.
 * The lens body and its engine are untouched (see lensDefs' note).
 */
export const LENS_LABEL: Record<LensId, string> = {
  people: "People",
  compare: "Compare",
  explore: "Explore",
  scores: "Scores",
};

/**
 * Which lenses a cohort stop offers (D152).
 *
 * EXPLORE IS THE WORLD'S, and it always was — the prototype module is
 * named for it (`spec/segment-explorer.jsx`: "the World's Explore lens").
 * The live row offered it at every scope, which reads as a fifth reading
 * of your city and is really the same reading three times: Explore's whole
 * move is to cut a population by a trait and rank where that slice parts
 * company with everyone. At City the population IS a slice — of one
 * city — so the chips re-cut a cut, and the divergence it reports is
 * against the city rather than against everyone, which is not the sentence
 * the lens is written to say. At World the population is everyone, and
 * "everyone" is the only baseline that makes the reading mean what it
 * claims.
 *
 * The other three read the same at every radius: who is here, you against
 * them, their scores. Those are properties of a population, not of its
 * size.
 *
 * A list per scope rather than a filter at the call site, so the answer to
 * "which lenses does this stop have" is in one place and the row and its
 * body cannot disagree about it.
 *
 * THE ORDER IS THE PROTOTYPE'S, AND COMPARE IS LAST (D184). This read
 * `people, compare, scores` and drew `Answers · People · Compare · Scores`,
 * with Explore appended after Scores at World. The prototype pushes
 * `compare` last of all (`mirror-field-pops.jsx` builds answers → people →
 * scores → explore → compare), and the reason survives the port: the first
 * three describe the POPULATION — who is here, how they scored, what they
 * answered — and Compare is the only one that puts you against them, which
 * is where a row that runs from "them" to "you and them" wants to end.
 */
export function lensesFor(scope: "city" | "country" | "world"): LensId[] {
  return scope === "world"
    ? ["people", "scores", "explore", "compare"]
    : ["people", "scores", "compare"];
}

/**
 * A cohort stop's own sections, beside the four lenses.
 *
 * `overview` is still a section with a label — it is just no longer a TAB
 * (D136). It draws above the row, always. Kept in this union because the
 * label is what names its region to a screen reader.
 */
export type StopTabId = "answers" | "overview";

/**
 * The section names. `overview` no longer titles a tab — it titles the
 * region above the row (D136).
 *
 * THE HISTORY, because this line has now moved twice. D119 made the field
 * a tab and put Answers first; D135 reversed the order so a stop opened on
 * the field. D136 takes the step the first two were feeling for: the field
 * stops being a tab at all.
 *
 * The argument D135 recorded is what carries it. The field is the stop's
 * IDENTITY — "you at the centre, them arranged around you, distance = how
 * unlike you" is the sentence the whole Mirror is built to say — and a tab
 * is the wrong furniture for an identity, because a tab is a thing you can
 * be looking away from. Making it the permanent head of the stop is what
 * "Overview leads" was reaching for; a tab that merely happened to be
 * first was the approximation available while the row still owned the
 * whole screen. It is also the prototype's own layout
 * (spec/mirror-field-pops.jsx renders MFHeader → field → lens row), which
 * both tabbed versions had diverged from in opposite directions.
 *
 * The cost note from D135 is unchanged and still the thing to watch:
 * Overview's fold runs on arrival. That is the same call count as before,
 * because a stop already opened on it — `loadSimilarity` early-returns on
 * `similarityLoading` and its getDocs sweep is guarded by
 * `state.testAggsLoaded`, so re-entry stays free. LiveCohortBody.test.tsx
 * pins both halves.
 */
export const TAB_LABEL: Record<StopTabId, string> = {
  answers: "Answers",
  overview: "Overview",
};

/**
 * The stop's own tabs in the row — just Answers, now that the field draws
 * above it (D136).
 *
 * Still a list rather than a caller's array literal: it is what the row is
 * built from, and the next section to join or leave it should change one
 * place. Answers leads for D119's reason, which outlived the tab order it
 * was written for — answer rows publish from the first answer (D98), so it
 * is the section that has something to show on a brand-new population.
 */
export const STOP_TABS: StopTabId[] = ["answers"];

/**
 * What a cohort stop opens on: NOTHING (D155).
 *
 * `DEFAULT_STOP_TAB` used to live here, set to "answers", with a note
 * explaining that closed-by-default would render an empty field above a
 * closed row — "a blank stop", the failure D135 was fixing.
 *
 * The premise was right and the conclusion was not, because the prototype
 * solves it in the layout instead: its row is pinned to the BOTTOM of the
 * screen (`marginTop: auto` in MirrorLenses), so a stop with nothing open
 * is a header, a field, and a tab bar sitting where a tab bar belongs.
 * Nothing reads as missing, because nothing is. Opening a tab then walks
 * the row up to the top of the scroller and the body follows it in.
 *
 * The constant is gone rather than set to "": there is no default to name
 * any more, and a `DEFAULT_STOP_TAB = ""` would be a piece of vocabulary
 * that has to be read twice to mean nothing.
 */
