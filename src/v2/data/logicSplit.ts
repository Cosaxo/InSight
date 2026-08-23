// How each LOGIC BAND answered one question — the who-voted sheet's second
// client fold (D227), built on exactly the rails D146's type cut laid.
//
// THE READING. The session already holds, for a question it has opened:
// who answered, what they picked (the bounded voter sample, D102), and —
// since the same profile document that resolves a name carries
// `testResults` whole (D112: the web SDK has no field mask) — each voter's
// verified logic result. Grouping the sample by score band is arithmetic
// on data in hand: no new read, no new dim, no schema change. The owner's
// ask this implements is PAID-PLAN.md §4: the logic score as a cut on who
// voted, at zero extra reads.
//
// BANDS, NOT SCORES, and the grain is the honesty. A split between
// "pctile 63" and "pctile 64" voters is noise dressed as insight, and a
// roster ranked by score would read as a leaderboard of strangers'
// intelligence — which is not what anyone opened a result to see. Four
// quarters is the coarsest cut that can still disagree with itself, and
// the same floors the type cut earned (`TYPE_THIN` to rank a band,
// `TYPE_SPLIT_SMALL` for shares) carry over unchanged: four bands divide
// the same bounded sample less finely than the archetypes do, so floors
// sized for the finer cut hold a fortiori here.
//
// THE PERCENTILE, NOT THE MARKS. Marks depend on the form era (12- and
// 25-item scores never mix, D61); the percentile is the number the server
// computed to be comparable, and it is server-written (D57) — rules
// refuse client mutation — so unlike the four instruments' self-written
// dims there is nothing here to parse defensively beyond shape. A voter
// with no verified result is NOT a band: they thin the basis and are
// reported as the gap between `sampleN` and `scoredN`, the `typedN`
// pattern, never bucketed as "untested" ranking against real bands.
//
// THE DISCLOSURE THIS WIDENS, named here because this file is the code
// half of it. `web/privacy.html` promised that only the Big Five groups
// answers; since D227 that sentence says "the Big Five and, separately,
// your verified logic score, in broad bands" — `check:policy-claims` pins
// both halves, and the politics/values/attachment refusal is untouched
// (typeSplit.ts SPLIT_TEST still owns the instrument scope; this fold
// never reads dims at all).
//
// Pure — no Firebase, no window, no LIVE. The caller joins voters to the
// cached percentiles and hands the rows in, the way typeSplit takes its
// input from `LIVE.voterScores`.
import { TYPE_THIN, TYPE_SPLIT_SMALL, typeDivergence } from "./typeSplit";
// The parse lives in similarity.ts beside parseTestResults — same
// defensive-cross-user-read job, and putting it THERE is what keeps
// voters.ts from importing this module, whose typeSplit → typeMix chain
// reads LIVE and would hand live.ts its first import cycle.
export { parseLogicPct } from "./similarity";

/** Rank floor and shares floor — the type cut's, on purpose (see header). */
export const LOGIC_THIN = TYPE_THIN;
export const LOGIC_SPLIT_SMALL = TYPE_SPLIT_SMALL;

/**
 * The four bands, top first — the order the chips render in, so the row
 * reads as a scale rather than as a shuffle. `lo` is inclusive.
 */
export const LOGIC_BANDS = [
  { id: "top", label: "Top quarter", lo: 75 },
  { id: "upper", label: "Upper middle", lo: 50 },
  { id: "lower", label: "Lower middle", lo: 25 },
  { id: "bottom", label: "Bottom quarter", lo: 0 },
] as const;
export type LogicBandId = (typeof LOGIC_BANDS)[number]["id"];

/** The band a percentile falls in, or null for the untested.
 *
 * The guard is a type test, not a null test, so a row that never carried
 * the field (a caller predating D227, a stale mock) reads as untested —
 * the falling-through alternative would file every such person in the
 * bottom quarter, which is the one wrong answer worse than none. */
export function logicBandOf(pct: number | null): LogicBandId | null {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  for (const b of LOGIC_BANDS) if (pct >= b.lo) return b.id;
  return "bottom"; // negative input — clamped upstream, banded floor here
}

/** One band's reading of the question — typeSplit's row shape, re-keyed. */
export interface LogicSplitRow {
  band: LogicBandId;
  label: string;
  /** Scored voters of this band whose answer landed in a column. */
  n: number;
  /** Dense per-option counts, to the question's own option count. */
  counts: number[];
}

export interface LogicSplit {
  /** Bands with enough behind them to rank — kept in scale order, top
   * first, because a score scale re-sorted by popularity stops being a
   * scale. (The type cut ranks by n; its axis has no order to keep.) */
  ranked: LogicSplitRow[];
  /** Seen but under LOGIC_THIN — listed with counts, never ranked. */
  thin: LogicSplitRow[];
  /** Bands nobody in the sample occupies. Named, never drawn. */
  absent: LogicBandId[];
  /** Voters the session holds for this question — the outer basis. */
  sampleN: number;
  /** Of those, the ones carrying a verified logic score — the real basis. */
  scoredN: number;
  /** The scored sample's own split — what divergence subtracts against
   * (the census stays on screen as "Everyone"; typeSplit.ts has the
   * arithmetic argument, and it is the same trap here). */
  overall: number[];
  /** The viewer's own band, when they hold a verified score. */
  mine: LogicBandId | null;
  /** True once `scoredN` is enough for shares to mean anything. */
  enough: boolean;
}

/** A voter as this fold needs them — `LIVE.voterScores`' join. */
export interface LogicVoter {
  uid: string;
  optionIdx: number;
  /** Verified percentile, or null for the untested. */
  logic: number | null;
}

const dense = (n: number): number[] => Array.from({ length: Math.max(0, n) }, () => 0);
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Group a question's cached voters by their verified logic band. */
export function logicSplitFor(
  voters: readonly LogicVoter[],
  optionCount: number,
  minePct: number | null = null,
): LogicSplit {
  const counts = new Map<LogicBandId, number[]>();
  const overall = dense(optionCount);
  let scoredN = 0;

  for (const v of voters) {
    const band = logicBandOf(v.logic);
    if (!band) continue; // untested: thins the basis, never a band
    scoredN += 1;
    let row = counts.get(band);
    if (!row) {
      row = dense(optionCount);
      counts.set(band, row);
    }
    // Same column rule as the type cut: an out-of-range index is a scored
    // person in no column, and n stays the column sum so the header never
    // claims people the bars do not show.
    if (v.optionIdx >= 0 && v.optionIdx < optionCount) {
      row[v.optionIdx] += 1;
      overall[v.optionIdx] += 1;
    }
  }

  const rows: LogicSplitRow[] = LOGIC_BANDS.map((b) => ({
    band: b.id,
    label: b.label,
    n: counts.has(b.id) ? sum(counts.get(b.id)!) : 0,
    counts: counts.get(b.id) || dense(optionCount),
  }));

  return {
    ranked: rows.filter((r) => r.n >= LOGIC_THIN),
    thin: rows.filter((r) => r.n > 0 && r.n < LOGIC_THIN),
    absent: rows.filter((r) => r.n === 0).map((r) => r.band),
    sampleN: voters.length,
    scoredN,
    overall,
    mine: logicBandOf(minePct),
    enough: scoredN >= LOGIC_SPLIT_SMALL,
  };
}

/**
 * Where a band parts company with the scored sample — the type cut's own
 * arithmetic, reused rather than restated, so "parts company" cannot come
 * to mean two things on one sheet.
 */
export function logicDivergence(
  row: LogicSplitRow,
  overall: readonly number[],
): { optionIdx: number; gap: number; higher: boolean } | null {
  return typeDivergence({ type: row.band, n: row.n, counts: row.counts }, overall);
}
