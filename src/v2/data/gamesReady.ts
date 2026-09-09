// When the reading game may be OFFERED (D196), and the number behind the
// word "hidden".
//
// The read game is the only surface in this app that MARKS A PERSON WRONG.
// Everything else reports what people answered; this takes your guess and
// scores it. That is what gives it a precondition on the DATA rather than
// only on the reading.
//
// `data/foresight.ts` already refuses an individual read that is not
// decidable — READ_MIN_N answers in the slice, READ_MIN_LEAD points of
// lead. What it cannot refuse is the CORPUS. A bank with three fair reads
// in it is not a game; it is three questions and a scoreboard that means
// nothing, and the per-dimension accuracy the whole feature exists for
// ("you read age well and education badly") would be one dimension deep.
//
// THIS IS NOT A PRIVACY FLOOR, and the numbers look like one, so: nothing
// is withheld from anybody. Every cell these read is published exactly and
// at any size (D98), and the Explore lens draws the same cells with no
// threshold at all. What is withheld is the GAME, from the player, until
// the game can be honest — the same distinction READ_MIN_N's own comment
// draws.
//
// Pure: no Firebase, no window, no clock.
import { readsFrom, type ForesightSource, type Read } from "./foresight";
import type { AggDoc, LiveQuestion } from "./deck";

/**
 * Fair reads that must exist before the game is offered at all.
 *
 * Twelve, and the reason is `byDim` rather than difficulty: the payoff is
 * "which cuts of the population you read well", which needs several reads
 * across several dims before it is a fact instead of a coincidence. Below
 * that the game can be played and its record cannot be believed — which is
 * the same objection READ_MIN_LEAD makes about a single 51/49 slice, one
 * level up.
 *
 * Raising it makes the game arrive later and mean more on arrival;
 * lowering it makes the record it produces thinner. It is an honesty
 * number, not a difficulty one.
 */
export const READ_MIN_POOL = 12;

/**
 * Turn the questions the store already holds into the engine's input.
 *
 * BOTH HALVES COME OFF THE PUBLISHED AGGREGATE, and that is the whole
 * point of this function. `counts` used to come off the view model's own
 * options — "the same numbers the card behind them draws" — which is a
 * DIFFERENT POPULATION from `by`: the card's counts have the viewer's own
 * vote subtracted (`countsFor` in ./deck, so the UI can add its own +1
 * for "you"), and a published `by` cell does not. `readsFrom` then
 * compared an overall without you against slices with you in them, and
 * called the difference a surprise.
 *
 * That is not a rounding error at the sizes this game plays at. One
 * bucket holding the same seven people as the whole crowd reads 43/57 in
 * the slice against 50/50 overall, `surprise: true`, and the card says
 * "Everyone else said X — this slice went the other way" over a basis
 * line counted on the other population. With `mine` unset it agrees with
 * itself.
 *
 * A question with no aggregate is dropped rather than zero-filled: it has
 * no slices to read, and a zero-filled one would be a question the game
 * could ask and never score. Same for one with a `by` but no `counts` —
 * a catalog or rank aggregate, whose cells are not option indexes at all.
 */
export function readSourcesFrom(
  questions: readonly LiveQuestion[],
  aggFor: (qid: string) => AggDoc | null,
): ForesightSource[] {
  const out: ForesightSource[] = [];
  for (const q of questions) {
    const agg = aggFor(q.id);
    if (!agg || !agg.by || !agg.counts) continue;
    const counts = agg.counts;
    out.push({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => o.label),
      counts: q.options.map((_, i) => counts[String(i)] || 0),
      by: agg.by,
    });
  }
  return out;
}

/**
 * Every fair read available right now, and whether that is enough to play.
 *
 * The pool comes back with the verdict so a caller about to render the
 * game does not fold it a second time.
 */
export function readsReady(
  questions: readonly ForesightSource[],
  dims: readonly string[],
  minPool = READ_MIN_POOL,
): { ready: boolean; pool: Read[] } {
  const pool = readsFrom(questions, dims);
  return { ready: pool.length >= minPool, pool };
}
