// traitLinks.ts — the web BETWEEN the tests (v28 §13): cross-trait pairs
// (openness↔authority, extraversion↔warmth…) checked against the viewer's
// OWN results. Where a pair travels the usual way, the thread holds; where
// it doesn't, you break a rule — and the rule you break is the most
// individual thing the data can say about you. Rendered by
// ui/TraitWebCard on the profile's General panel.
//
// Ported from design/standalone-v28/trait-links.js. THE "USUAL PATTERN"
// HAS TWO SOURCES, and the build decides which one draws (D393):
//
//   demo   the AUTHORED sign in TRAIT_LINKS. The design's persona is the
//          content there and its population is invented by construction —
//          the same split D149 and D157 drew through the learn and norm
//          seams.
//   live   a sign MEASURED over the session's cached voter sample — the
//          same real people with real parsed results testNorms.ts counts
//          percentiles over (`LIVE.kindredPeople()`), correlated pair by
//          pair. A pair whose direction the sample cannot state is not
//          drawn at all.
//
// Until D393 the authored sign drew in both builds, and the card called it
// "the usual pattern" and "a rule you break": a claim about how people's
// traits travel that this app had never measured, printed with the
// authority of the surface it sat on. That is D157's shape exactly — a
// screen that could not get the true number drew a plausible one — and the
// owner's rule is that nothing in the app is invented. The authored words
// stay where the measurement AGREES with them (they are then a true
// sentence in the design's voice); where it disagrees, a neutral sentence
// is generated from the two labels, because hiding a measured link is the
// one thing this app does not do.
//
// The fold reads nothing beyond what the device already holds: the sample
// is public results (D98) the similarity surfaces already fetched, and a
// politics result is in it only where its owner turned the compass on
// (D330/D331). One number per pair comes out, and nobody is named.
//
// Pure over an injected `dimOf` and an optional basis, because the two
// builds source a dimension differently (live: parsed LIVE.myTestResults;
// demo: the design's IS_TEST_RESULTS) and a fold that reached for either
// would be right in exactly one mode.

/** [testA, dimA, testB, dimB, sign, rule (the usual pattern), breakLine]
 * sign +1: the pair usually rises together · −1: one usually sinks the other
 *
 * In a LIVE build the sign here is the EXPECTATION the authored words were
 * written for, not what is drawn: `traitRows` takes the drawn sign from
 * the measured basis and uses these words only when the two agree. */
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

/** The row id every consumer keys on — the four link fields run together. */
export const linkId = (L: readonly [string, string, string, string, ...unknown[]]): string =>
  L[0] + L[1] + L[2] + L[3];

/**
 * People a pair needs before its direction is stated.
 *
 * testNorms' NORM_MIN_ANSWERS, in the unit this fold counts: a correlation
 * is a claim about how two readings move across people, and thirty is
 * where its sign stops flipping with each new one. Not a disclosure floor
 * (D98 removed those, and nothing here publishes) — a MEANING floor, the
 * kind testNorms.ts keeps for the same reason.
 */
export const TRAIT_MIN_PEOPLE = 30;
/**
 * …and how far from zero the correlation must sit, in standard errors:
 * t = r·√(n−2) / √(1−r²) ≥ 2, the ordinary two-sided line at the floor
 * above (|r| ≈ 0.36 at thirty people, ≈ 0.2 at a hundred). A sign the
 * sample cannot separate from noise is not a pattern anyone breaks.
 */
export const TRAIT_MIN_T = 2;

/** One person's parsed results — test → dim → 0..100 (similarity's
 * ParsedResults, spelled structurally so this module stays import-free). */
export type TraitSamplePerson = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface TraitBasis {
  /** Pearson r over the people holding both dimensions; 0 under three. */
  r: number;
  /** People the pair was correlated over — the stated basis. */
  n: number;
  /** The measured direction, or null where the sample cannot state one. */
  sign: 1 | -1 | null;
}

/**
 * Correlate every link over a sample of real people — the live build's
 * source for the usual pattern.
 *
 * A person counts toward a pair only with BOTH dimensions readable, so a
 * sample of a hundred Big Five results and ten values results states the
 * Big Five pairs and not the values ones. Pearson over the raw 0..100
 * values; sums rather than two passes because the sample is the app's
 * heaviest fold (`kindredPeople`) and this runs on the profile's render.
 */
export function traitBasis(
  people: ReadonlyArray<TraitSamplePerson | null | undefined>,
): Record<string, TraitBasis> {
  const out: Record<string, TraitBasis> = {};
  for (const L of TRAIT_LINKS) {
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (const p of people) {
      const a = p?.[L[0]]?.[L[1]];
      const b = p?.[L[2]]?.[L[3]];
      if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      n++;
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
    }
    const id = linkId(L);
    if (n < 3) { out[id] = { r: 0, n, sign: null }; continue; }
    const cov = sab - (sa * sb) / n;
    const va = saa - (sa * sa) / n;
    const vb = sbb - (sb * sb) / n;
    // A constant column has no direction to correlate — r stays 0 and the
    // sign stays null however many people sit in it.
    let r = va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
    r = Math.max(-1, Math.min(1, r));
    const t = Math.abs(r) >= 1 ? Infinity : (Math.abs(r) * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
    const sign: 1 | -1 | null = n >= TRAIT_MIN_PEOPLE && t >= TRAIT_MIN_T ? (r > 0 ? 1 : -1) : null;
    out[id] = { r, n, sign };
  }
  return out;
}

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
  /** The direction DRAWN: measured in a live build, authored in the demo. */
  sign: 1 | -1;
  rule: string;
  breakLine: string;
  state: "break" | "holds";
  /** People the direction was measured over; 0 when it is the authored one. */
  n: number;
  measured: boolean;
}

// The neutral words, for a measured direction the authored line was not
// written for. Plain enough to be true of any pair; the card's headline
// capitalises them.
function neutralRule(a: TraitDimRef, b: TraitDimRef, sign: 1 | -1): string {
  return sign > 0
    ? `${a.label} and ${b.label} usually rise together here`
    : `${a.label} usually runs against ${b.label} here`;
}
function neutralBreak(a: TraitDimRef, b: TraitDimRef, sign: 1 | -1): string {
  if (sign > 0) {
    // the pair usually rises together, so a break is one without the other
    const [hi, lo] = a.v >= b.v ? [a, b] : [b, a];
    return `${hi.label} without ${lo.label}`;
  }
  // the pair usually pulls apart, so a break is both up or both down: on
  // the rail pb = 100 − b.v, and a wide gap means a.v + b.v far from 100
  return `${a.label} and ${b.label}, both ${a.v + b.v > 100 ? "high" : "low"}`;
}

/**
 * One row per link both tests can answer, strongest tension first.
 *
 * `basis` is the live build's measured directions (`traitBasis`); with it,
 * a link draws only where the sample states a sign, and that sign is the
 * one drawn. Without it (the demo, or a caller that has none) the authored
 * sign draws, which is the pre-D393 behaviour and the demo's content.
 *
 * A break needs BOTH a wide gap (≥24 on the shared rail) and at least one
 * dimension actually away from the middle (≥12 off 50): two mid-scale
 * scores can sit 24 apart without either being a trait to speak of, and
 * calling that "the most individual thing about you" would be reading
 * noise as character.
 */
export function traitRows(
  dimOf: (test: string, dim: string) => TraitDimRef | null,
  basis?: Readonly<Record<string, TraitBasis>> | null,
): TraitRow[] {
  const out: TraitRow[] = [];
  for (const L of TRAIT_LINKS) {
    const a = dimOf(L[0], L[1]);
    const b = dimOf(L[2], L[3]);
    if (!a || !b) continue;
    const id = linkId(L);
    let sign: 1 | -1 = L[4];
    let n = 0;
    let measured = false;
    if (basis) {
      const m = basis[id];
      if (!m || m.sign == null) continue;
      sign = m.sign;
      n = m.n;
      measured = true;
    }
    const pa = a.v;
    const pb = sign < 0 ? 100 - b.v : b.v;
    const gap = Math.abs(pa - pb);
    const off = Math.max(Math.abs(a.v - 50), Math.abs(b.v - 50));
    const authored = sign === L[4];
    out.push({
      id, a, b, pa, pb, gap, sign,
      rule: authored ? L[5] : neutralRule(a, b, sign),
      breakLine: authored ? L[6] : neutralBreak(a, b, sign),
      state: gap >= 24 && off >= 12 ? "break" : "holds",
      n, measured,
    });
  }
  return out.sort((m, n) => n.gap - m.gap);
}
