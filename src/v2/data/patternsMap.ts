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

/** The device ridge the shipped `estimateTheta` was written at. The
 * loadings doc publishes the ridge its scorecard was measured at as
 * `lambdaU` (D395) and callers pass it through; this is the fallback for
 * a document that predates the field. */
export const DEFAULT_LAMBDA_U = 0.5;

/**
 * The viewer's latent vector AND the posterior precision it came with,
 * estimated on the DEVICE from their own answers and the published
 * loadings: ridge regression, K×K, closed form. Nothing leaves the phone
 * — the solve is a fold over two things the phone already holds.
 *
 * `obs.r` is the centred encoded answer (±1 minus the question's marginal
 * for a two-option item; the standardised index for an ordinal one; the
 * centred pick for a one-hot pseudo-item — D395's `items` metadata says
 * which), matching the server fit's own residual.
 *
 * `invA` is (Σ L Lᵀ + λI)⁻¹ — the posterior covariance up to the noise
 * scale. `Lᵀ invA L` for a candidate loading is how much of that loading
 * the viewer's answers leave UNDETERMINED, which is what the
 * information rule (`mostInformative`) ranks by. Measured 2026-09-06
 * before this shipped: using the same quantity to SHRINK the guess helps
 * at λ = 0.5 (0.946 → 0.902 bits on the probe's world) and hurts once λ
 * is tuned up (0.903 → 0.909 at λ = 2) — the two are one knob twice, and
 * the nightly sweep already tunes λ by the scorecard — so the guess stays
 * `marginal + θ·L` and the precision serves the question choice alone.
 */
export function ridgeSolve(
  obs: readonly { L: readonly number[]; r: number }[],
  k: number,
  lambda = DEFAULT_LAMBDA_U,
): { theta: number[]; invA: number[][] } {
  // A = Σ L Lᵀ + λI ; b = Σ r·L ; θ = A⁻¹ b, and A⁻¹ itself by Gauss–Jordan
  // on [A | I] — K is 8, the whole thing is a few hundred multiplies.
  const M: number[][] = Array.from({ length: k }, (_, i) =>
    Array.from({ length: 2 * k }, (_, j) => (j === i ? lambda : j === k + i ? 1 : 0)));
  const b: number[] = Array.from({ length: k }, () => 0);
  for (const o of obs) {
    for (let i = 0; i < k; i++) {
      const li = o.L[i] ?? 0;
      b[i] += o.r * li;
      for (let j = 0; j < k; j++) M[i][j] += li * (o.L[j] ?? 0);
    }
  }
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let row = col + 1; row < k; row++) if (Math.abs(M[row][col]) > Math.abs(M[piv][col])) piv = row;
    if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-9;
    for (let j = 0; j < 2 * k; j++) M[col][j] /= d;
    for (let row = 0; row < k; row++) {
      if (row === col) continue;
      const f = M[row][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * k; j++) M[row][j] -= f * M[col][j];
    }
  }
  const invA = M.map((r) => r.slice(k));
  const theta = Array.from({ length: k }, (_, i) => {
    let s = 0;
    for (let j = 0; j < k; j++) s += invA[i][j] * b[j];
    return s;
  });
  return { theta, invA };
}

/** The viewer's latent vector alone — the shape every existing caller
 * reads; `ridgeSolve` is the same solve with its precision kept. */
export function estimateTheta(
  obs: readonly { L: readonly number[]; r: number }[],
  k: number,
  lambda = DEFAULT_LAMBDA_U,
): number[] {
  return ridgeSolve(obs, k, lambda).theta;
}

/** How much of a loading the viewer's answers leave undetermined —
 * `Lᵀ invA L`, the predictive variance of θ·L up to the noise scale.
 * Large for a direction no answered question points along; small once
 * the answers have pinned it. */
export function undetermined(invA: readonly number[][], L: readonly number[]): number {
  const k = invA.length;
  let s = 0;
  for (let i = 0; i < k; i++) {
    let row = 0;
    for (let j = 0; j < k; j++) row += invA[i][j] * (L[j] ?? 0);
    s += (L[i] ?? 0) * row;
  }
  return s;
}

/**
 * Which question to ask next: the one whose loading points where the
 * viewer's vector is least determined — the information rule (the
 * owner's call, 2026-09-06, on ALGORITHM-REFLECTION §5.3). Ties keep the
 * candidates' order, so the choice is deterministic. Returns the index
 * into `candidates`, or −1 for none.
 *
 * It makes the Oracle learn the viewer fastest and, for a while, look
 * worst — it deliberately asks what it cannot yet call. The meter is
 * honest about that either way; the opposite rule flatters the meter and
 * learns slowly.
 */
export function mostInformative(invA: readonly number[][], candidates: readonly { L: readonly number[] }[]): number {
  let best = -1;
  let bestGain = -Infinity;
  candidates.forEach((c, i) => {
    const g = undetermined(invA, c.L);
    if (g > bestGain + 1e-12) { bestGain = g; best = i; }
  });
  return best;
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
