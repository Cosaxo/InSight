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
// attempts (D57) are seeded and scored server-side, and since D58 their
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
   *  histogram clears the D58 floor */
  source?: string;
  /** the measured comparison's population size — the verified first
   *  attempts this score was ranked against (present iff measured) */
  n?: number;
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

// pctile = share of players this score beats. A logistic with midpoint 62%
// (~7.4 of 12) and slope 14 — chosen values, pinned in logic-score.test.ts:
//   chance (2 of 12 with six options) → 4 · 6/12 → 30 · 12/12 → 94.
//
// The 94 ceiling is DELIBERATE (D53): a perfect score is the test's
// ceiling, and a ceiling cannot distinguish "better than 94%" from "better
// than 99%" — the honest claim stops where the instrument does. The floor
// clamps to 1 for the symmetric reason.
export const logicPctile = (frac: number): number =>
  Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-((frac * 100) - 62) / 14)))));

export function loadResult(): LogicResult | null {
  try {
    const r = JSON.parse(localStorage.getItem(LKEY) || "null") as LogicResult | null;
    if (r && Array.isArray(r.marks) && r.marks.length) {
      // a v1 result predates the percentile being stored — back-fill it so
      // every consumer reads one shape
      if (r.pctile == null) r.pctile = logicPctile(r.marks.filter(Boolean).length / r.marks.length);
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
