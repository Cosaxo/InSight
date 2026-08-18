// The CALL surface's client-side reading (D194) — which call the feed's
// one slot shows, what state it is in, and whether this device agrees with
// the grade it was given.
//
// Pure: no Firebase, no window, no clock. `now` is passed in, the same
// discipline data/foresight.ts keeps for READ — a card that scored
// differently depending on when a test happened to run would be untestable
// in exactly the place it matters.
//
// The arithmetic itself lives in ./callRubric, which is byte-identical to
// the copy inside the deploy. This module is the part that is only ever
// the client's: presentation state, and the re-grade.
import { evalRubric, type CallRubric, type CallSnapshot } from "./callRubric";
import type { CallOutcome, QuestionDoc } from "./deck";

/** One call as the card needs it: the question, the crowd, the grade, you. */
export interface CallCard {
  id: string;
  prompt: string;
  options: string[];
  resolvesAt: string;
  rubric: CallRubric;
  /** How everyone CALLED it — an ordinary aggregate over ordinary answers. */
  counts: number[];
  /** Your own sealed pick, or null. */
  mine: number | null;
  /**
   * The published grade. `null` means fetched-and-ungraded (sealed);
   * `undefined` means nothing has been read yet, which is not a state the
   * card may draw as sealed.
   */
  outcome: CallOutcome | null | undefined;
}

export type CallState =
  /** Nothing read yet — draw nothing rather than a wrong state. */
  | "unread"
  /** Open, and you have not called it. */
  | "open"
  /** You called it; the world has not answered yet. */
  | "sealed"
  /** Graded, and you were right. */
  | "right"
  /** Graded, and you were not. */
  | "wrong"
  /** Graded, and you never called it — the crowd's result, no verdict. */
  | "missed"
  /** Nobody is scored (FORESIGHT-CALLS §7). */
  | "void";

export const CALL_VOID_IDX = -1;

/**
 * What a card is showing. One function, so no two surfaces can disagree.
 *
 * `unread` comes FIRST and is not a variant of "open": until the grades
 * have been read, an apparently-open call may already be graded, and
 * offering the choice would be offering a tap the rules are about to
 * refuse — the same dishonesty as drawing a crowd nobody counted. The card
 * renders nothing in this state and lets its own fetch resolve it.
 */
export function stateOf(card: CallCard): CallState {
  if (card.outcome === undefined) return "unread";
  if (card.outcome === null) return card.mine == null ? "open" : "sealed";
  if (card.outcome.outcomeIdx === CALL_VOID_IDX) return "void";
  if (card.mine == null) return "missed";
  return card.mine === card.outcome.outcomeIdx ? "right" : "wrong";
}

/**
 * Whether THIS DEVICE, re-running the same rubric over the numbers the
 * resolver published, reaches the same answer.
 *
 * The reason the whole feature is allowed to exist. Every other number in
 * the app is a fold the reader can recompute; a resolved call would be the
 * app asserting something — unless the app hands over its working and
 * checks it in front of you. So:
 *
 *   true   the grade reproduces
 *   false  it does NOT, and the card says so rather than hiding it
 *   null   nothing to check (no outcome, a void, or an outcome published
 *          without inputs — which is not a disagreement)
 *
 * A `false` should never happen: one module, held byte-identical across
 * both trees by `npm run check:calls`. That is exactly why it is worth
 * drawing — the case this cannot produce is the case worth seeing if it
 * ever does.
 */
export function recheck(card: CallCard): boolean | null {
  const out = card.outcome;
  if (!out || out.outcomeIdx === CALL_VOID_IDX) return null;
  const inputs = out.inputs as CallSnapshot | null | undefined;
  if (!inputs) return null;
  const got = evalRubric(card.rubric, inputs);
  return got === null ? null : got === out.outcomeIdx;
}

/**
 * Which call the feed's single slot shows, or null when there is none.
 *
 * The order is what a player wants to see next, and each step is a
 * different sentence:
 *
 *   1. A call you have not made, soonest to resolve — the only state with
 *      something to DO.
 *   2. A fresh grade on a call you did make — your verdict, which you have
 *      one visit to notice.
 *   3. A sealed call of yours, soonest to resolve — "waiting on the world".
 *   4. Anything else that is graded, so the surface is not empty while the
 *      bank still has history in it.
 *
 * Deliberately NOT rotate-by-day (the paid card's rule): a call is a thing
 * you did, and hiding your own pending verdict for a day because the
 * calendar said so is the wrong kind of variety.
 */
export function pickCall(cards: readonly CallCard[]): CallCard | null {
  const bySoonest = (a: CallCard, b: CallCard) =>
    a.resolvesAt.localeCompare(b.resolvesAt) || a.id.localeCompare(b.id);
  const open = cards.filter((c) => stateOf(c) === "open").sort(bySoonest);
  if (open.length) return open[0];
  const graded = cards.filter((c) => stateOf(c) === "right" || stateOf(c) === "wrong");
  // Most recent grade first: resolvesAt descending, which is the order they
  // were decided in.
  if (graded.length) return graded.sort((a, b) => bySoonest(b, a))[0];
  const sealed = cards.filter((c) => stateOf(c) === "sealed").sort(bySoonest);
  if (sealed.length) return sealed[0];
  const rest = cards.filter((c) => stateOf(c) !== "unread").sort((a, b) => bySoonest(b, a));
  return rest[0] ?? null;
}

/** Days from `now` until a call resolves; negative once it is past. */
export function daysUntil(resolvesAt: string, now: number): number {
  const at = Date.parse(`${resolvesAt}T00:00:00Z`);
  if (!Number.isFinite(at)) return 0;
  // `|| 0` normalises the -0 Math.ceil returns for anything in the last
  // half-day. It renders as "0" either way; a caller comparing with
  // Object.is would not, and that is a bug waiting rather than a wart.
  return Math.ceil((at - now) / 86_400_000) || 0;
}

/**
 * The crowd's split on the call itself, as whole percentages summing to
 * 100, or null when nobody has called it yet.
 *
 * Null rather than zeroes: "nobody has called this" and "0% called it that
 * way" are different claims, and only one of them is true before the first
 * answer (D1's absent-not-invented rule, applied to a split).
 */
export function callPcts(counts: readonly number[]): number[] | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const ps = counts.map((c) => Math.round((100 * c) / total));
  // Whole percentages do not sum to 100; give the remainder to the leader,
  // the same repair every other split in this app makes.
  const lead = ps.indexOf(Math.max(...ps));
  ps[lead] += 100 - ps.reduce((a, b) => a + b, 0);
  return ps;
}

/** Build the card view models from the bank, the votes and the outcomes. */
export function cardsFrom(
  bank: ReadonlyArray<QuestionDoc & { id: string; counts: number[] }>,
  votes: Readonly<Record<string, string>>,
  outcomes: Readonly<Record<string, CallOutcome | null>> | null,
): CallCard[] {
  return bank
    .filter((q) => q.rubric && q.resolvesAt && (q.options || []).length === 2)
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      resolvesAt: q.resolvesAt as string,
      rubric: q.rubric as CallRubric,
      counts: q.counts,
      mine: q.id in votes ? Number(votes[q.id]) : null,
      outcome: outcomes ? outcomes[q.id] ?? null : undefined,
    }));
}
