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
//   plane     position seeds from the first two factors, then springs on
//             the drawn edges and a grid declutter — never all-pairs
//
// Pure and deterministic given the loadings (no RNG anywhere — the
// prototype's declutter jitter is index-parity, kept), so the layout is
// testable without a device. The prototype's LSH path (EXACT_MAX = 512)
// is deliberately not ported: the core corpus is bounded (D161) and two
// orders of magnitude under the swap point; the exact pass IS the cheap
// one here, and the ANN index can arrive with the corpus that needs it.
export const PATTERNS_SIM_SHRINK = 0.92;
/** Dots closer than this on the drawn plane get pushed apart. 17 until the
 * 2026-08-20 standalone tightened it: just enough to stay tappable — tight
 * clusters ARE the signal the archipelago pass below exists to show. */
export const PATTERNS_MIN_GAP = 10.5;

export interface MapNode {
  id: string;
  /** The loading vector, as published. */
  L: readonly number[];
  /** Answers folded into it — the basis a caller states or refuses on. */
  n: number;
}

export interface MapEdge { i: number; j: number; r: number }
export interface MapPoint { i: number; id: string; x: number; y: number }

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

/**
 * Positions: seed from the first two factors, fit to the box, then the
 * 2026-08-20 standalone's ARCHIPELAGO passes: communities of the drawn web
 * (label propagation over the same edges the map draws, O(n·k) per pass)
 * become islands — members pull toward their island's centre, centres push
 * out from the middle — the separation the raw factor plane refuses to
 * draw itself. Then springs on the drawn edges (strong tie → short rest
 * length) with each point held to its island, grid-declutter, clamp, fit,
 * settle. Deterministic throughout: same vectors, same picture.
 */
export function planeOf(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  W = 344, H = 330, P = 16,
): MapPoint[] {
  const pts: MapPoint[] = nodes.map((q, i) => ({ i, id: q.id, x: q.L[0] ?? 0, y: q.L[1] ?? 0 }));
  const fit = () => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = (W - P * 2) / (x1 - x0 || 1), sy = (H - P * 2) / (y1 - y0 || 1);
    for (const p of pts) { p.x = P + (p.x - x0) * sx; p.y = P + (p.y - y0) * sy; }
  };
  if (!pts.length) return pts;
  fit();
  // communities of the drawn web → islands, then anchors that hold each
  // point to its exaggerated island through the relax
  const m = pts.length;
  const lab = new Int32Array(m);
  for (let i = 0; i < m; i++) lab[i] = i;
  const adj: { j: number; w: number }[][] = Array.from({ length: m }, () => []);
  for (const e of edges) {
    const w = Math.abs(e.r);
    adj[e.i].push({ j: e.j, w });
    adj[e.j].push({ j: e.i, w });
  }
  for (let t = 0; t < 14; t++) {
    let moved = 0;
    for (let i = 0; i < m; i++) {
      const sc = new Map<number, number>();
      for (const x of adj[i]) sc.set(lab[x.j], (sc.get(lab[x.j]) || 0) + x.w);
      let best = lab[i], bs = 0;
      sc.forEach((s, k2) => { if (s > bs) { bs = s; best = k2; } });
      if (best !== lab[i]) { lab[i] = best; moved++; }
    }
    if (!moved) break;
  }
  const isle = new Map<number, { x: number; y: number; n: number }>();
  pts.forEach((p, i) => {
    const k2 = lab[i];
    let c = isle.get(k2);
    if (!c) isle.set(k2, (c = { x: 0, y: 0, n: 0 }));
    c.x += p.x; c.y += p.y; c.n++;
  });
  isle.forEach((c) => { c.x /= c.n; c.y /= c.n; });
  let gx = 0, gy = 0;
  for (const p of pts) { gx += p.x; gy += p.y; }
  gx /= m; gy /= m;
  // exaggerate once, then hold each point to its island through the relax
  const anchor = pts.map((p, i) => {
    const c = isle.get(lab[i]) as { x: number; y: number; n: number };
    const cx2 = gx + (c.x - gx) * 1.55, cy2 = gy + (c.y - gy) * 1.55;
    p.x = cx2 + (p.x - c.x) * 0.6; p.y = cy2 + (p.y - c.y) * 0.6;
    return { x: cx2, y: cy2 };
  });
  const MIN = PATTERNS_MIN_GAP;
  const relax = (
    iters: number,
    springs: { i: number; j: number; len: number }[] | null,
    anch: { x: number; y: number }[] | null,
  ) => {
    for (let t = 0; t < iters; t++) {
      if (anch) {
        const g = 0.026;
        pts.forEach((p, i2) => { p.x += (anch[i2].x - p.x) * g; p.y += (anch[i2].y - p.y) * g; });
      }
      if (springs) {
        const k = 0.075 * (1 - t / (iters * 1.6));
        for (const e of springs) {
          const a = pts[e.i], b = pts[e.j];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
          const s = ((d - e.len) / d) * k;
          a.x += dx * s; a.y += dy * s; b.x -= dx * s; b.y -= dy * s;
        }
      }
      const cell = new Map<number, MapPoint[]>();
      const key = (cx: number, cy: number) => cx * 100003 + cy;
      for (const p of pts) {
        const c = key(Math.floor(p.x / MIN), Math.floor(p.y / MIN));
        const bucket = cell.get(c);
        if (bucket) bucket.push(p); else cell.set(c, [p]);
      }
      for (const a of pts) {
        const cx = Math.floor(a.x / MIN), cy = Math.floor(a.y / MIN);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const bucket = cell.get(key(cx + ox, cy + oy));
          if (!bucket) continue;
          for (const b of bucket) {
            if (b === a || b.i < a.i) continue;
            let dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d >= MIN) continue;
            if (d < 0.001) { dx = (a.i % 2 ? 1 : -1) * 0.5; dy = 0.5; }
            const s = ((MIN - d) / (d || 1)) * 0.24;
            a.x -= dx * s; a.y -= dy * s; b.x += dx * s; b.y += dy * s;
          }
        }
      }
      for (const p of pts) {
        p.x = Math.max(P * 0.6, Math.min(W - P * 0.6, p.x));
        p.y = Math.max(P * 0.6, Math.min(H - P * 0.6, p.y));
      }
    }
  };
  // the same edges the map draws also do the tightening — a tie you can see
  const rmax = Math.max(...edges.map((e) => Math.abs(e.r)), 0) || 1;
  relax(150, edges.map((e) => ({ i: e.i, j: e.j, len: 19 + (1 - Math.abs(e.r) / rmax) * 66 })), anchor);
  fit();
  relax(30, null, null);
  return pts;
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
