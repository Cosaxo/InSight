// traitsFit.ts — the trait cube's arithmetic (D330), pure.
//
// No Firestore, no firebase-functions, no I/O: the patternsFit.ts /
// axesFit.ts contract, so the whole fold is testable at a desk and the
// sweep in traits.ts is only a reader and a writer around it.
//
// WHAT THIS COMPUTES. For one person's public `testResults`, the bucket
// they fall in on each of the 27 cuts — four instruments' matched
// archetype, twenty-two axis bands, one logic band — and then folds one
// answer into a cube shaped exactly like `v2_question_aggs.by`
// (dim → bucket → optionIdx → count), so the client reads it through
// data/cohort.ts unchanged and no second arithmetic for "what a cohort's
// split is" ever exists.
//
// WHY THE NUMBERS ARE GENERATED RATHER THAN AUTHORED HERE. The client
// types a person in `src/v2/spec/archetype-data.js`; this runs in
// `functions/`, which cannot import across that boundary. So
// `traitsContent.ts` is generated from the client's own modules and
// `check:traits` refuses a stale copy — and `TRAIT_GOLDEN` carries
// profiles typed by the CLIENT matcher at generation time, which
// traitsFit.test.ts replays through the matcher below. Two
// implementations in two runtimes is the classic drift failure; the
// fixture is the only thing that can see it.
//
// EVERY DIM ALWAYS YIELDS A BUCKET. Absence is `untested`, never a
// skipped fold — which is what makes `Σ buckets per dim === the
// question's folded total` hold for all 27, and that identity is what
// lets the sheet draw the published census as its header bar instead of
// carrying a second denominator the way the sampled cut it replaces had
// to (data/typeSplit.ts's `overall`).
import {
  TRAIT_KINDS, TRAIT_ARCH, TRAIT_AVG, TRAIT_AXES, UNTESTED,
  ARCH_W_FLOOR, ARCH_SHARE_PULL, RULE_REAL, RULE_STRONG,
  type TraitKind,
} from "./traitsContent";

/** dim → bucket → optionIdx (as a string) → count. `v2_question_aggs.by`'s
 *  shape exactly, so `cohort.ts` folds it with no new code. */
export type TraitCube = Record<string, Record<string, Record<string, number>>>;

/** The logic bands (D227), floor-first — logicSplit.ts's table. */
export const LOGIC_BANDS = [
  { id: "top", lo: 75 },
  { id: "upper", lo: 50 },
  { id: "lower", lo: 25 },
  { id: "bottom", lo: 0 },
] as const;

/** The axis dim key for an instrument's axis. `_` only: nothing in
 *  `breakdownBucket`'s rejected class, nothing on Object.prototype. */
export const axisDim = (kind: TraitKind, axis: string): string => `${kind}_${axis}`;

/**
 * The 27 cut keys, in the order the sheet shows them: each instrument's
 * type dim followed by its axis dims, then logic.
 *
 * The CLIENT holds the same list (src/v2/data/traitDims.ts) and
 * `check:traits` rule 4 holds the two equal in values and order — the
 * COHORT_DIMS ↔ BREAKDOWN_DIMS pair, finally with a script behind it.
 */
export const TRAIT_DIMS: readonly string[] = (() => {
  const out: string[] = [];
  for (const kind of TRAIT_KINDS) {
    out.push(kind);
    for (const axis of TRAIT_AXES[kind]) out.push(axisDim(kind, axis));
  }
  out.push("logic");
  return out;
})();

/** One parsed axis reading. */
export interface TraitDim { id: string; value: number }

/**
 * `similarity.parseTestResults`' defensive read, one instrument's arm.
 *
 * Deliberately identical to `scripts/report-lib.parseTestDims`, including
 * the LAST-WINS collapse of a duplicated dim id: the app's axes map keeps
 * first-seen position and last value, so feeding the matcher both copies
 * would double-weight the dim and could type a crafted profile
 * differently here than on the device. The 12-entry cap and the 0..100
 * clamp are the same parse's, and they are what make a hostile
 * `testResults` (the rules validate only the key set) fold to `untested`
 * rather than to NaN.
 */
export function parseTestDims(raw: unknown, kind: string): TraitDim[] | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = (raw as Record<string, unknown>)[kind];
  if (!entry || typeof entry !== "object") return null;
  const dims = (entry as { dims?: unknown }).dims;
  if (!Array.isArray(dims)) return null;
  const byId = new Map<string, number>();
  for (const d of dims.slice(0, 12)) {
    if (!d || typeof d !== "object") continue;
    const id = (d as { id?: unknown }).id;
    const value = Number((d as { value?: unknown }).value);
    if (typeof id !== "string" || !id || !Number.isFinite(value)) continue;
    byId.set(id, Math.max(0, Math.min(100, Math.round(value))));
  }
  if (!byId.size) return null;
  return [...byId].map(([id, value]) => ({ id, value }));
}

/**
 * The app's nearest-signature matcher, ported from `IS_archScores` +
 * `IS_matchArchetype` — rule 1 (every dim counts a little, distinctive
 * dims count more), rule 2 (error measured against the POPULATION
 * baseline, not the midpoint), rule 3 (a commonness prior, so a rare type
 * has to earn the win).
 *
 * Only the winner's name is returned: the cube's bucket key is the name,
 * and the fit/gap the client uses to say how well a type fits are the
 * device's business, not the cube's.
 */
export function matchArchetypeName(kind: TraitKind, dims: TraitDim[] | null): string | null {
  const list = TRAIT_ARCH[kind];
  if (!list || !list.length || !dims || !dims.length) return null;
  const avg = TRAIT_AVG[kind] || {};
  let maxShare = 1;
  for (const a of list) maxShare = Math.max(maxShare, a.share || 1);
  let bestIdx = -1;
  let bestScore = Infinity;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let s = 0;
    let w = 0;
    for (const d of dims) {
      const sig = a.sig[d.id];
      if (sig == null) continue;
      const base = typeof avg[d.id] === "number" ? avg[d.id] : 50;
      const wt = ARCH_W_FLOOR + Math.abs(sig - 50);
      const e = (sig - base) - (d.value - base);
      s += wt * e * e;
      w += wt;
    }
    const fit = w ? s / w : 1e9;
    const score = fit + ARCH_SHARE_PULL * Math.log(maxShare / Math.max(1, a.share || 1));
    // Strictly less-than, so ties keep the FIRST listed archetype — the
    // client's `forEach` comparison does the same, and a tie broken the
    // other way would move a person between two runtimes.
    if (score < bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx < 0 ? null : list[bestIdx].name;
}

/**
 * D254's band index, centred on the authored baseline rather than on the
 * midpoint — the reading `IS_typeRuleParts` argues for and the sold report
 * already ships (`report-lib.axisBandIndex`).
 *
 * Fixed 0-20-40-60-80 cut points were the other candidate and do not
 * discriminate on these axes: `attachment.loyal` averages 66 and `big5.A`
 * averages 65, so a fixed middle band on either leaves the centre nearly
 * empty and files most of the room in the top two — the cut stops
 * splitting anything, which is its only job.
 */
export function axisBandIndex(value: number, avg: number | undefined): number {
  const dev = value - (typeof avg === "number" ? avg : 50);
  const mag = Math.abs(dev);
  if (mag >= RULE_STRONG) return dev < 0 ? 0 : 4;
  if (mag >= RULE_REAL) return dev < 0 ? 1 : 3;
  return 2;
}

/**
 * The verified logic percentile's band, or null for the untested.
 *
 * A TYPE test rather than a null test, logicSplit.ts's rule: a profile
 * that never carried the field must read as untested, because falling
 * through would file every such person in the bottom quarter — the one
 * wrong answer worse than none.
 */
export function logicBandOf(pct: unknown): string | null {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  const p = Math.max(0, Math.min(100, pct));
  for (const b of LOGIC_BANDS) if (p >= b.lo) return b.id;
  return "bottom";
}

/**
 * One person's bucket on every one of the 27 dims.
 *
 * Total, by construction: every dim is present in the result, `untested`
 * where the person has no reading. Nothing per-person is persisted from
 * this — the sweep computes it, folds it and drops it (D330's custody
 * rule, held by a test over the write log).
 */
export function traitBucketsFor(rawTestResults: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kind of TRAIT_KINDS) {
    const dims = parseTestDims(rawTestResults, kind);
    out[kind] = matchArchetypeName(kind, dims) ?? UNTESTED;
    const avg = TRAIT_AVG[kind] || {};
    for (const axis of TRAIT_AXES[kind]) {
      const hit = dims ? dims.find((d) => d.id === axis) : null;
      out[axisDim(kind, axis)] = hit ? `b${axisBandIndex(hit.value, avg[axis])}` : UNTESTED;
    }
  }
  const logic = rawTestResults && typeof rawTestResults === "object"
    ? (rawTestResults as { logic?: { pctile?: unknown } }).logic
    : null;
  out.logic = logicBandOf(logic && typeof logic === "object" ? logic.pctile : null) ?? UNTESTED;
  return out;
}

/** An empty cube. */
export function newTraitCube(): TraitCube {
  return Object.create(null) as TraitCube;
}

/**
 * Fold one answer in, under every dim at once.
 *
 * `optionIdx` outside the question's options increments no column but
 * still counts toward the bucket's presence — `typeSplit.ts`'s rule, so
 * the bucket's `n` stays the column sum and a row never claims people its
 * bars do not show. (A bucket with only out-of-range answers therefore
 * exists with no columns, which `publishableCube` drops.)
 */
export function foldTraits(cube: TraitCube, buckets: Record<string, string>, optionIdx: number): void {
  const ok = Number.isInteger(optionIdx) && optionIdx >= 0 && optionIdx < 20;
  for (const dim of TRAIT_DIMS) {
    const bucket = buckets[dim];
    if (!bucket) continue;
    let byBucket = cube[dim];
    if (!byBucket) { byBucket = Object.create(null); cube[dim] = byBucket; }
    let cells = byBucket[bucket];
    if (!cells) { cells = Object.create(null); byBucket[bucket] = cells; }
    if (ok) {
      const k = String(optionIdx);
      cells[k] = (cells[k] || 0) + 1;
    }
  }
}

/**
 * The cube as a plain object safe to write.
 *
 * `Object.create(null)` maps are what the fold builds (so a bucket named
 * `constructor` or `__proto__` cannot reach a prototype), and the Firestore
 * SDK will not serialise a null-prototype object — so this rebuilds them as
 * plain objects at the boundary. Empty buckets are dropped: a bucket that
 * folded only out-of-range answers has nothing to draw, and an empty map
 * would render as a row of zeros that is not the same claim as "nobody
 * here answered".
 */
export function publishableCube(cube: TraitCube): TraitCube {
  const out: TraitCube = {};
  for (const dim of TRAIT_DIMS) {
    const byBucket = cube[dim];
    if (!byBucket) continue;
    const dimOut: Record<string, Record<string, number>> = {};
    for (const bucket of Object.keys(byBucket)) {
      // `__proto__` cannot occur — every bucket key is server-derived from
      // a closed vocabulary (archetype names, b0..b4, untested) and
      // check:traits rule 3 refuses any key on Object.prototype. It is
      // dropped rather than trusted anyway, because the fold's maps are
      // null-prototype and THIS one is not: a plain-object assignment
      // under that key sets the prototype instead of adding a field, so a
      // vocabulary that ever gained it would corrupt the document rather
      // than fail. Cheaper to make impossible than to reason about.
      if (bucket === "__proto__") continue;
      const cells = byBucket[bucket];
      const cellOut: Record<string, number> = {};
      let any = false;
      for (const k of Object.keys(cells)) {
        if (cells[k] > 0) { cellOut[k] = cells[k]; any = true; }
      }
      if (any) dimOut[bucket] = cellOut;
    }
    if (Object.keys(dimOut).length) out[dim] = dimOut;
  }
  return out;
}
