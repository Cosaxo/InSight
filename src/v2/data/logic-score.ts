// Scoring and persistence for the Logic overlay — extracted from
// src/v2/spec/logic-test.jsx (2026-08-06 review), where all of it was
// private to the IIFE and therefore unpinnable: the percentile curve is
// load-bearing (logic-gen's ramp template is calibrated so "k of 12" keeps
// meaning what the retired hand-authored bank meant, with this curve's
// midpoint as the reference), and nothing could assert its values.
//
// Everything HERE is a MODEL — the logistic below, the lens formulas the
// overlay draws — and the result screen discloses it (LOGIC_FIELD_NOTE /
// LOGIC_VERIFIED_NOTE / LOGIC_MEASURED_NOTE). Practice attempts stay
// on-device and always score against the modelled curve. Verified
// attempts (D57) are seeded and scored server-side, and since D60 their
// percentile FLIPS to a measurement once the anonymous histogram clears
// its floor: the server compares the score against the verified first
// attempts counted so far and the result arrives with source "measured"
// and the population size `n`. Below the floor the server still applies
// the same logistic as this file (pinned equal in both suites), so the
// number means the same thing wherever it was computed.

export interface LogicResult {
  /** payload version: absent = pre-generator (v1), 2 = generator era */
  v?: number;
  /** the seed the attempt's form was generated from (v2) */
  seed?: number;
  /** generator version the seed means something under (v2) */
  gv?: number;
  /** D57: scored server-side — marks and pctile are the server's */
  verified?: boolean;
  /** where the percentile came from: "model", or "measured" once the
   *  histogram clears the D60 floor */
  source?: string;
  /** the measured comparison's population size — the verified first
   *  attempts this score was ranked against (present iff measured) */
  n?: number;
  /** the likely range round `pctile`: the score ± LOGIC_SEM_ITEMS read
   *  through the same curve or count (D402). The server's for verified
   *  results; logicBandFor's for practice ones */
  band?: [number, number];
  /** server-observed attempt duration (verified results only) */
  durationMs?: number;
  marks: boolean[];
  /** per-puzzle solve time in ms, reveal delay already subtracted (v2).
   *  Stays device-local even for verified results — the server never
   *  receives per-item timings, only its own observed duration */
  times?: number[];
  /** per-item family weights, saved so the Answers lens can place rows on
   *  the ramp without re-deriving the form */
  diffs?: number[];
  pctile: number;
  when: number;
}

export const LKEY = "insight.logicTest.v1";

/** modelled median seconds per puzzle — the Pace lens's yardstick */
export const FIELD_MED = 17;

// pctile = share of players this score beats. A logistic per FORM LENGTH —
// each generator era's ramp is its own calibration, so each carries its
// own chosen midpoint and slope, pinned in logic-score.test.ts:
//
//   12 items (v1/v2 forms, D53): midpoint 62 (~7.4 of 12), slope 14.
//     chance (2/12, six options) → 4 · 6/12 → 30 · 12/12 → 94.
//     The 94 ceiling is DELIBERATE: a curve cannot rank perfect scores,
//     so the honest modelled claim stops at the instrument's ceiling.
//   25 items (v3 forms, D61): midpoint 54 (~13.5 of 25 — the modelled
//     median solver clears the low bands and roughly half the middle),
//     slope 12. chance (~4.2/25) → 4 · 20/25 → 90 · 25/25 → 98: the
//     tail-heavy ramp earns the model more ceiling than D53's 94,
//     still capped below 99 for the same reason.
//
// Both are MODELS and both are only the bootstrap: once the verified
// histogram clears the D60 floor, the server ranks against real players
// and none of this applies to verified results.
const CURVES: Record<number, { mid: number; slope: number }> = {
  12: { mid: 62, slope: 14 },
  25: { mid: 54, slope: 12 },
};

export const logicPctileFor = (frac: number, items: number): number => {
  // Unknown lengths fall back by era: anything shorter than the v3 form
  // is legacy 12-item-era material (v1 back-fills reach here with the odd
  // truncated payload), and only 25+ means the tail-heavy ramp.
  const c = CURVES[items] || (items >= 25 ? CURVES[25] : CURVES[12]);
  return Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-((frac * 100) - c.mid) / c.slope)))));
};

// The 12-item curve under its historic name: loadResult's v1 back-fill
// below depends on it meaning exactly what it meant.
export const logicPctile = (frac: number): number => logicPctileFor(frac, 12);

// The likely range (D402): one standard error of measurement, in items,
// read through the same curve as the number it qualifies. Spearman–Brown
// puts a 25-item form's reliability near 0.87, which with the modelled
// raw-score spread is ≈ 1.8 items, rounded up. A test that prints a
// percentile without its range claims a precision a 25-item form does not
// have; this is the qualifier that names the limit (docs/COPY.md §3).
// functions/src/logic.ts carries the same constant for verified results,
// where the range is read off the histogram once the reading is measured.
export const LOGIC_SEM_ITEMS = 2;
export const logicBandFor = (k: number, items: number): [number, number] => [
  logicPctileFor(Math.max(0, k - LOGIC_SEM_ITEMS) / items, items),
  logicPctileFor(Math.min(items, k + LOGIC_SEM_ITEMS) / items, items),
];

export function loadResult(): LogicResult | null {
  try {
    const r = JSON.parse(localStorage.getItem(LKEY) || "null") as LogicResult | null;
    if (r && Array.isArray(r.marks) && r.marks.length) {
      // a v1 result predates the percentile being stored — back-fill it so
      // every consumer reads one shape, through the curve that matches the
      // result's own length
      if (r.pctile == null) {
        r.pctile = logicPctileFor(r.marks.filter(Boolean).length / r.marks.length, r.marks.length);
      }
      // a practice result saved before the range existed gets the same
      // range a fresh one would; a verified result's range is the
      // server's to compute, so an old one simply has none
      if (r.band == null && !r.verified) {
        r.band = logicBandFor(r.marks.filter(Boolean).length, r.marks.length);
      }
      return r;
    }
  } catch {
    /* corrupt or absent — the overlay starts a fresh attempt */
  }
  return null;
}

export function saveResult(r: LogicResult): void {
  try {
    localStorage.setItem(LKEY, JSON.stringify(r));
  } catch {
    /* best-effort: private mode, quota */
  }
}

/** mean seconds per puzzle; a result saved before timing existed reads as
 *  the modelled median rather than as instant */
export function logicSecs(r: LogicResult | null): number {
  return r && Array.isArray(r.times) && r.times.length
    ? r.times.reduce((a, b) => a + b, 0) / r.times.length / 1000
    : FIELD_MED;
}
