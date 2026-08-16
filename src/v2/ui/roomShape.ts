// The Near room's pure shape functions (D176).
//
// Split out of LiveRoomTabs for the reason lensDefs is split out of
// LiveMirrorLenses: eslint's react-refresh rule wants a component file to
// export only components, and it is right — a function re-exported from
// one breaks fast refresh for everything that imports it. These are also
// the half worth testing without a DOM.
//
// Not in the entry chunk: the only importers are the lazy tab module and
// its test.
import type { LiveQuestion } from "../data/deck";
import type { LensQuestion } from "./lensDefs";
import type { AnswerRow } from "./LiveAnswerRows";

/** The noun every sentence in these three tabs puts the crowd in. */
export const ROOM_WHOM = "this room";

/**
 * The room's questions, assembled once for all three tabs.
 *
 * TODAY'S DECK, not the whole archive, and the reason is the server's: the
 * fold reads a document per person per question, so the question set has
 * to be small AND the same for everybody, or the per-cell cache stops
 * being shared and every viewer pays for their own fold. `computeDeckIds`
 * is a pure function of the day, so the deck is already identical on every
 * device — it is the one list that satisfies both.
 *
 * Questions the server returned NO counts for are kept with zeroes rather
 * than dropped: "nobody here has answered this one" is a fact about the
 * room, and dropping the row would make an unanswered question look like a
 * question that was never asked.
 */
export function roomQuestions(
  deck: readonly LiveQuestion[],
  qs: Record<string, Record<string, number>>,
  votes: Record<string, string>,
): LensQuestion[] {
  return deck.map((q) => {
    const cell = qs[q.id] || {};
    const counts = q.options.map((_, i) => Number(cell[String(i)]) || 0);
    const mineRaw = votes[q.id];
    const mine = mineRaw === undefined ? -1 : Number(mineRaw);
    return {
      id: q.id,
      text: q.text,
      options: q.options.map((o) => o.label),
      counts,
      // Explore is the only lens that reads `all`, and the room does not
      // offer it — so this is the room's own counts rather than a globe
      // fetched to satisfy a field nothing here looks at.
      all: counts,
      by: undefined,
      mine: Number.isFinite(mine) ? mine : -1,
      type: q.type,
      branch: q.branch,
    };
  });
}

/** The same list in the Answers tab's shape. */
export function roomRows(qs: LensQuestion[]): AnswerRow[] {
  return qs.map((q) => ({
    qid: q.id,
    text: q.text,
    options: q.options,
    counts: q.counts,
    n: q.counts.reduce((a, b) => a + b, 0),
    branch: q.branch,
    type: q.type,
    mine: q.mine,
  }));
}

