// traitLinks.ts — the web BETWEEN the tests (v28 §13): known cross-trait
// correlations (openness↔authority, extraversion↔warmth…) checked against
// the viewer's OWN results. Where a pair travels the usual way, the thread
// holds; where it doesn't, you break a rule — and the rule you break is
// the most individual thing the data can say about you. Rendered by
// ui/TraitWebCard on the profile's General panel.
//
// Ported from design/standalone-v28/trait-links.js. The LINKS are
// AUTHORED editorial claims about how traits usually travel — the same
// status as a question's wording, not a folded population figure — and
// the fold reads nothing but the two results the device already holds:
// no read, no collection, no per-cohort claim (which is what keeps it
// outside D157's Art. 9 scope — nothing here reads anyone else's
// politics/values/attachment results).
//
// Pure over an injected `dimOf`, because the two builds source a
// dimension differently (live: parsed LIVE.myTestResults; demo: the
// design's IS_TEST_RESULTS) and a fold that reached for either would be
// right in exactly one mode.

/** [testA, dimA, testB, dimB, sign, rule (the usual pattern), breakLine]
 * sign +1: the pair usually rises together · −1: one usually sinks the other */
export const TRAIT_LINKS: readonly (readonly [string, string, string, string, 1 | -1, string, string])[] = [
  ["big5", "O", "political", "auth", -1, "curiosity pulls away from command", "a curious mind that keeps the chain of command"],
  ["big5", "O", "values", "beauty", 1, "open minds and an eye for beauty travel together", "openness without the eye for beauty"],
  ["big5", "O", "political", "foreign", 1, "curiosity looks outward", "an open mind that stays home"],
  ["big5", "C", "values", "hedonism", -1, "order keeps pleasure on a leash", "disciplined — and devoted to pleasure anyway"],
  ["big5", "E", "attachment", "warm", 1, "warmth usually rides with extraversion", "reserved people are rarely this warm"],
  ["big5", "E", "attachment", "play", 1, "playfulness feeds on company", "the quiet joker"],
  ["big5", "A", "attachment", "warm", 1, "agreeable people run warm", "kind at the core, cool at the surface"],
  ["big5", "A", "political", "econ", -1, "soft hearts lean left on money", "warm-hearted, hard-nosed on markets"],
  ["big5", "N", "values", "future", -1, "sensitivity dims the view ahead", "feels everything, still bets on tomorrow"],
  ["big5", "N", "attachment", "easy", -1, "steady nerves give easy space", "anxious, but easygoing all the same"],
  ["attachment", "open", "big5", "O", 1, "open to ideas, open to people", "open to ideas, guarded with people"],
];

export interface TraitDimRef {
  /** the dimension's value, 0–100 */
  v: number;
  label: string;
  /** the display color of the test the dimension belongs to (already
   * through the palette gate — the card mixes threads from it) */
  color: string;
}

export interface TraitRow {
  id: string;
  a: TraitDimRef;
  b: TraitDimRef;
  /** a's value, and b's laid on the SAME rail — b flipped when the usual
   * pull is opposite, so "following the pattern" always lands the two
   * dots together and the gap is the tension. */
  pa: number;
  pb: number;
  gap: number;
  sign: 1 | -1;
  rule: string;
  breakLine: string;
  state: "break" | "holds";
}

/**
 * One row per link both tests can answer, strongest tension first.
 *
 * A break needs BOTH a wide gap (≥24 on the shared rail) and at least one
 * dimension actually away from the middle (≥12 off 50): two mid-scale
 * scores can sit 24 apart without either being a trait to speak of, and
 * calling that "the most individual thing about you" would be reading
 * noise as character.
 */
export function traitRows(
  dimOf: (test: string, dim: string) => TraitDimRef | null,
): TraitRow[] {
  const out: TraitRow[] = [];
  for (const L of TRAIT_LINKS) {
    const a = dimOf(L[0], L[1]);
    const b = dimOf(L[2], L[3]);
    if (!a || !b) continue;
    const pa = a.v;
    const pb = L[4] < 0 ? 100 - b.v : b.v;
    const gap = Math.abs(pa - pb);
    const off = Math.max(Math.abs(a.v - 50), Math.abs(b.v - 50));
    out.push({
      id: L[0] + L[1] + L[2] + L[3],
      a, b, pa, pb, gap, sign: L[4], rule: L[5], breakLine: L[6],
      state: gap >= 24 && off >= 12 ? "break" : "holds",
    });
  }
  return out.sort((m, n) => n.gap - m.gap);
}
