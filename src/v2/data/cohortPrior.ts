// cohortPrior.ts — the Oracle's prior from the viewer's own groups (D454,
// PATTERNS-PLAN.md §3).
//
// WHY. The fit centres every question on the WORLD's split and the
// viewer's vector starts at the origin, so before their first answer the
// Oracle's guess is the crowd's base rate — for everybody, whoever they
// are. Yet every question already publishes how each age band, gender,
// country and the rest split on it (`v2_question_aggs.by` — D8 for the
// shape, D98 for the exactness), the Mirror reads those cells today, and
// the device knows the viewer's own anchors. This is the fold that turns
// the two into a prior: the viewer's groups' split, not the world's, is
// where a guess starts, and their own answers move it from there.
//
// THE ARITHMETIC. Each of the viewer's groups is a cell of per-option
// counts. A cell is shrunk toward the world's split by a pseudo-count of
// PRIOR_SHRINK answers — (c_i + s·w_i) / (n + s) — so a cell of three
// people moves nothing and a cell of three hundred speaks for itself.
// The cells combine as naïve Bayes: in log space, the world's share plus
// each cell's log-ratio against the world, normalised. The dims are not
// independent (age and height, city and country), and that is the known
// bias of the shape; it is accepted because the joint cell the exact
// form wants is one the cube does not publish. The one nesting that
// would plainly double-count is handled: a city speaks for itself when
// its cell can carry itself and its country is then skipped; otherwise
// the country speaks and the city is skipped.
//
// WHAT IT IS NOT. Not a claim about the viewer — a prior is where the
// guess starts, and the Oracle's working shows each group that moved it
// with its basis (D146). Not a read: the cells ride the aggregated
// question documents the deck already holds. Not a publication: the
// anchors read here are the viewer's own, on their own device.
//
// Pure on purpose (the peopleMap.ts posture): no Firebase, no window, no
// randomness, so the fold is testable without a device and identical on
// every device.
import { COHORT_DIMS, VOCAB_TAIL, cellFor, type ByMap, type CohortDim } from "./cohort";

/** The pseudo-count of world answers a cell is shrunk toward: n/(n+20)
 * of the cell's own split, the rest the world's. Twenty is the basis at
 * which the pair card and the Oracle's working treat a count as a
 * sentence (their floor is twelve) with a little to spare. */
export const PRIOR_SHRINK = 20;
/** A share is kept off 0 and 1 so its log-ratio is finite — a cell that
 * is unanimous is very sure, not infinitely sure. The guess itself is
 * clamped again, wider, in `oracleGuess`. */
export const PRIOR_CLAMP = 0.02;

/** One group that spoke: the viewer's bucket in a dim, the cell's basis,
 * and its shares after shrinking toward the world's. */
export interface PriorRow {
  dim: CohortDim;
  bucket: string;
  /** Answers in the cell — the basis a caller states or refuses on. */
  n: number;
  /** Per-option shares, shrunk. */
  shares: number[];
}

export interface CohortPrior {
  /** Per-option shares after every row has spoken — the prior. */
  shares: number[];
  /** The world's shares the fold started from, clamped. */
  world: number[];
  /** The groups that spoke, in COHORT_DIMS order. Empty means the prior
   * IS the world — a caller falls back to the row's own marginal then,
   * so the two variants are byte-identical where no group can speak. */
  rows: PriorRow[];
}

const clamp = (p: number): number => Math.min(1 - PRIOR_CLAMP, Math.max(PRIOR_CLAMP, p));
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** The viewer's own value in a dim, or null where it is no group: empty,
 * or one of the opt-out vocabulary entries ("Prefer not to say" is an
 * answer to the profile, not a cohort to be read as). */
const bucketOf = (anchors: Record<string, string>, dim: CohortDim): string | null => {
  const v = (anchors[dim] ?? "").trim();
  return v && !VOCAB_TAIL.has(v) ? v : null;
};

const cellN = (by: ByMap | undefined, dim: string, bucket: string): number => {
  const cell = by?.[dim]?.[bucket];
  return cell ? sum(Object.values(cell)) : 0;
};

/**
 * Which of the viewer's groups may speak on this question: every dim
 * they have a real value in, with the city/country nesting resolved —
 * the city when its cell holds at least `shrink` answers (it can carry
 * itself), else the country. Order is COHORT_DIMS', so the rows a seal
 * records are in the same order on every device.
 */
export function priorBuckets(
  by: ByMap | undefined,
  anchors: Record<string, string>,
  shrink: number = PRIOR_SHRINK,
): { dim: CohortDim; bucket: string }[] {
  const city = bucketOf(anchors, "city");
  const cityCarries = city != null && cellN(by, "city", city) >= shrink;
  const out: { dim: CohortDim; bucket: string }[] = [];
  for (const dim of COHORT_DIMS) {
    if (dim === "city" && !cityCarries) continue;
    if (dim === "country" && cityCarries) continue;
    const bucket = bucketOf(anchors, dim);
    if (bucket) out.push({ dim, bucket });
  }
  return out;
}

/**
 * The prior: the world's per-option shares, moved by each of the
 * viewer's groups that has answers on this question. `world` is the
 * split the fit itself centres by (for a two-option row `[(1+m)/2,
 * (1−m)/2]` off the row's marginal), so where no group speaks the
 * caller can fall back to the row exactly.
 */
export function cohortPrior(
  by: ByMap | undefined,
  anchors: Record<string, string>,
  world: readonly number[],
  shrink: number = PRIOR_SHRINK,
): CohortPrior {
  const k = world.length;
  const wRaw = world.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const wz = sum(wRaw);
  // an empty or degenerate world is uniform — there is no split to start
  // from, and a prior has to start somewhere finite
  const w = wRaw.map((x) => clamp(wz > 0 ? x / wz : 1 / Math.max(1, k)));
  const logs = w.map((x) => Math.log(x));
  const rows: PriorRow[] = [];
  for (const { dim, bucket } of priorBuckets(by, anchors, shrink)) {
    const counts = cellFor(by, dim, bucket, k);
    if (!counts) continue;
    const n = sum(counts);
    if (n <= 0) continue;
    const shares = counts.map((c, i) => (c + shrink * w[i]) / (n + shrink));
    rows.push({ dim, bucket, n, shares });
    for (let i = 0; i < k; i++) logs[i] += Math.log(clamp(shares[i])) - Math.log(w[i]);
  }
  const mx = Math.max(...logs);
  const ex = logs.map((l) => Math.exp(l - mx));
  const z = sum(ex) || 1;
  const clamped = ex.map((e) => clamp(e / z));
  const cz = sum(clamped) || 1;
  return { shares: clamped.map((s) => s / cz), world: w, rows };
}
