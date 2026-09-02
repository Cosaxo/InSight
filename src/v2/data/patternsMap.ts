// patternsMap.ts — the Patterns Map's arithmetic (v28 §2, trial D166 §1),
// over the loading vectors the nightly server fit publishes
// (functions/src/patterns.ts → v2_patterns/loadings). Ported from
// design/standalone-v28/question-map.js with the fit step removed — the
// prototype recovered its vectors from 560 invented people by truncated
// SVD; here they arrive real, and everything below is the same reading:
//
//   sim(i,j)  cosine over unit loadings, shrunk ×0.92 so no pair reads as
//             a perfect proxy — how much two answers predict each other
//   hub       ‖L‖ normalised — how tied a question is to everything else
//   edges     each question's own strongest few, deduped — the drawn web
//
// The PLANE this file also computed (position seeded from the first two
// factors, springs on the drawn edges, a grid declutter) went with the
// 2026-09-02 redesign: the Map is a RING now, so position is topic
// membership and the chords carry every claim (VISION-2026-09-02 §1.2).
// `planeOf` and `PATTERNS_MIN_GAP` were kept alive by their own tests
// alone and are deleted rather than annotated — git history has them, and
// a layout engine no surface draws is the residue this tree removes.
//
// Pure and deterministic given the loadings (no RNG anywhere — the
// prototype's declutter jitter is index-parity, kept), so the layout is
// testable without a device. The prototype's LSH path (EXACT_MAX = 512)
// is deliberately not ported: the core corpus is bounded (D161) and two
// orders of magnitude under the swap point; the exact pass IS the cheap
// one here, and the ANN index can arrive with the corpus that needs it.
export const PATTERNS_SIM_SHRINK = 0.92;

export interface MapNode {
  id: string;
  /** The loading vector, as published. */
  L: readonly number[];
  /** Answers folded into it — the basis a caller states or refuses on. */
  n: number;
}

export interface MapEdge { i: number; j: number; r: number }

const norm = (v: readonly number[]): number => Math.sqrt(v.reduce((a, x) => a + x * x, 0));

/** Unit twins and normalised hubs, computed once per pool. */
export function mapGeometry(nodes: readonly MapNode[]): { U: number[][]; hub: number[] } {
  const norms = nodes.map((q) => norm(q.L));
  const hmax = Math.max(...norms, 0) || 1;
  return {
    U: nodes.map((q, i) => (norms[i] ? q.L.map((x) => x / norms[i]) : q.L.map(() => 0))),
    hub: norms.map((h) => h / hmax),
  };
}

export function simOf(U: readonly number[][], i: number, j: number): number {
  let s = 0;
  for (let k = 0; k < U[i].length; k++) s += U[i][k] * U[j][k];
  return Math.max(-1, Math.min(1, s * PATTERNS_SIM_SHRINK));
}

/** A question's strongest `k` neighbours by |sim| — sign-agnostic, an
 * anti-correlation is as strong a tie as a correlation. Exact pass. */
export function nearOf(U: readonly number[][], i: number, k = 3): { j: number; r: number }[] {
  const out: { j: number; r: number }[] = [];
  for (let j = 0; j < U.length; j++) {
    if (j === i) continue;
    out.push({ j, r: simOf(U, i, j) });
  }
  out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return out.slice(0, k);
}

/** The drawn web: every question's own top-`per`, deduped, strongest
 * first. O(n·k) in pairs kept, per the plan's complexity contract. */
export function edgesOf(U: readonly number[][], per = 3): MapEdge[] {
  const seen = new Set<number>();
  const out: MapEdge[] = [];
  const m = U.length;
  for (let i = 0; i < m; i++) {
    for (const x of nearOf(U, i, per)) {
      const a = Math.min(i, x.j), b = Math.max(i, x.j);
      const key = a * m + b;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ i: a, j: b, r: x.r });
    }
  }
  out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return out;
}

// ── the Oracle's own arithmetic ─────────────────────────────────────────

/**
 * The viewer's latent vector, estimated on the DEVICE from their own
 * answers and the published loadings: ridge regression, K×K, closed
 * form. Nothing leaves the phone — the guess is a fold over two things
 * the phone already holds.
 *
 * obs.r is the centred encoded answer (±1 minus the question's marginal),
 * matching the server fit's own residual.
 */
export function estimateTheta(
  obs: readonly { L: readonly number[]; r: number }[],
  k: number,
  lambda = 0.5,
): number[] {
  // A = Σ L Lᵀ + λI ; b = Σ r·L ; θ = A⁻¹ b, by Gaussian elimination —
  // K is 8, the solve is nothing.
  const A: number[][] = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => (i === j ? lambda : 0)));
  const b: number[] = Array.from({ length: k }, () => 0);
  for (const o of obs) {
    for (let i = 0; i < k; i++) {
      b[i] += o.r * (o.L[i] ?? 0);
      for (let j = 0; j < k; j++) A[i][j] += (o.L[i] ?? 0) * (o.L[j] ?? 0);
    }
  }
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let row = col + 1; row < k; row++) if (Math.abs(A[row][col]) > Math.abs(A[piv][col])) piv = row;
    if (piv !== col) { [A[col], A[piv]] = [A[piv], A[col]]; [b[col], b[piv]] = [b[piv], b[col]]; }
    const d = A[col][col] || 1e-9;
    for (let row = col + 1; row < k; row++) {
      const f = A[row][col] / d;
      for (let j = col; j < k; j++) A[row][j] -= f * A[col][j];
      b[row] -= f * b[col];
    }
  }
  const theta = Array.from({ length: k }, () => 0);
  for (let row = k - 1; row >= 0; row--) {
    let s = b[row];
    for (let j = row + 1; j < k; j++) s -= A[row][j] * theta[j];
    theta[row] = s / (A[row][row] || 1e-9);
  }
  return theta;
}

/** The sealed guess: P(option 0), from the question's own marginal plus
 * what the viewer's other answers predict. Clamped to [0.05, 0.95] — the
 * prototype's cap, so twenty weak signals cannot fake certainty. */
export function oracleGuess(
  theta: readonly number[],
  L: readonly number[],
  marginal: number,
): { p0: number; pred: 0 | 1; conf: number } {
  let dot = 0;
  for (let i = 0; i < theta.length; i++) dot += theta[i] * (L[i] ?? 0);
  const xhat = marginal + dot; // expected encoded answer, in [-1, 1]-ish
  const p0 = Math.max(0.05, Math.min(0.95, (1 + xhat) / 2));
  const pred = p0 >= 0.5 ? 0 : 1;
  return { p0, pred, conf: pred === 0 ? p0 : 1 - p0 };
}

/** Surprisal of the actual answer under the sealed guess, in bits — a
 * tall bar is a time you were unreadable. */
export function surprisalBits(p0: number, actual: 0 | 1): number {
  const p = actual === 0 ? p0 : 1 - p0;
  return -Math.log2(Math.max(1e-6, p));
}
