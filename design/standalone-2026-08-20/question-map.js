// question-map.js — the map under Patterns, built the way it would have to be
// built for a million questions rather than eighty-five.
//
// The naive version of this file computed phi for every pair (O(n²): 3,570
// pairs here, 500 billion at a million questions), ran MDS on that matrix, then
// relaxed it with an all-pairs spring pass. Correct at this size, dead at any
// other. Nothing below is quadratic in the number of questions.
//
// EMBEDDING FIRST. The correlations were never really pairwise — they come from
// a handful of latent factors. So the pool is factored once (truncated SVD by
// power iteration on the vote matrix, O(voters × questions × k) per pass, and
// in production a streaming/incremental fit over the vote log), and every
// question keeps K numbers. From there:
//
//   sim(i,j)   cosine of two loading vectors            O(K)
//   pos(i)     the first two factors, projected          O(1) — a new question
//              is placeable the moment it exists; no global re-layout
//   near(i,k)  k-nearest by sign-hash buckets (LSH),     ~O(candidates)
//              rescored exactly. The swap point for a real ANN index (HNSW).
//   edges()    each question's top few neighbours,       O(n·k)
//              deduped — the drawn web, never an all-pairs sweep
//   hub(i)     ‖loadings‖ — how much of the question is  O(1)
//              shared structure rather than its own noise
//   say(i,j)   the 2×2 table for ONE pair, on demand.    O(voters)
//              Exact conditional probabilities are computed only for the
//              three links you are actually reading, never for all pairs.
//
// The statistical argument matters more than the speed one: past a few thousand
// questions almost no two share enough voters for a direct correlation to mean
// anything, and the factor model is the only honest estimator — it pools
// evidence across questions instead of trusting a pair with a dozen overlapping
// votes. Layout decluttering runs on a uniform grid (neighbouring cells only),
// so even that stays linear; at real scale it becomes map tiles by zoom.
window.QMAP = (function () {
  const PAT = () => window.PAT;
  const K = 8;                 // latent factors kept
  const SHRINK = 0.92;         // no pair reads as a perfect proxy

  // ── the vote matrix, oriented so index 0 is the MAJORITY pick. Option order
  // in the pool is arbitrary; without this the sign of a correlation is noise.
  let _raw = null, _flip = null, _p = null;
  function cols() {
    if (_raw) return _raw;
    const Q = PAT().qs(), pop = PAT().pop(), n = pop.length, m = Q.length;
    _raw = []; _flip = []; _p = new Float64Array(m);
    for (let j = 0; j < m; j++) {
      const c = new Uint8Array(n);
      let z = 0;
      for (let i = 0; i < n; i++) { c[i] = pop[i].a[j]; if (c[i] === 0) z++; }
      _raw.push(c);
      _flip.push(z < n / 2);
      _p[j] = (_flip[j] ? n - z : z) / n;      // share on the majority side
    }
    return _raw;
  }

  // ── the factorisation: top-K right singular vectors of the centred,
  // oriented vote matrix, by power iteration with Gram-Schmidt deflation.
  // Cost per iteration is voters × questions — LINEAR in the pool size.
  let _emb = null;
  function embed() {
    if (_emb) return _emb;
    const C = cols(), m = C.length, n = C[0].length, F = _flip, P = _p;
    // the centred, oriented matrix, once, flat: the inner loops below run tens
    // of thousands of times, and a function call per cell was the whole cost
    const X = new Float64Array(m * n);
    for (let j = 0; j < m; j++) { const c = C[j], f = F[j], p = P[j], off = j * n; for (let i = 0; i < n; i++) X[off + i] = (f ? 1 - c[i] : c[i]) - p; }
    const V = [];                                                 // K vectors in question space
    const w = new Float64Array(n), v2 = new Float64Array(m), prev = new Float64Array(m);      // reused each pass
    for (let k = 0; k < K; k++) {
      let v = new Float64Array(m);
      for (let j = 0; j < m; j++) v[j] = Math.sin((j + 1) * (k + 1) * 1.7) + 0.11;  // deterministic seed
      let sv = 0;
      for (let t = 0; t < 26; t++) {
        // orthogonalise against the factors already found
        for (let q = 0; q < V.length; q++) { let d = 0; for (let j = 0; j < m; j++) d += v[j] * V[q].u[j]; for (let j = 0; j < m; j++) v[j] -= d * V[q].u[j]; }
        let nv = 0; for (let j = 0; j < m; j++) nv += v[j] * v[j];
        nv = Math.sqrt(nv) || 1; for (let j = 0; j < m; j++) v[j] /= nv;
        // converged? the direction stopped moving, so 26 passes were 14 wasted
        let drift = 0; for (let j = 0; j < m; j++) { const d = v[j] - prev[j]; drift += d * d; }
        prev.set(v);
        if (t > 1 && drift < 1e-14) break;
        // w = Xv  (per voter), then v' = Xᵀw  (per question)
        w.fill(0);
        for (let j = 0; j < m; j++) { const vj = v[j]; if (!vj) continue; const off = j * n; for (let i = 0; i < n; i++) w[i] += X[off + i] * vj; }
        for (let j = 0; j < m; j++) { let s = 0; const off = j * n; for (let i = 0; i < n; i++) s += X[off + i] * w[i]; v2[j] = s; }
        sv = 0; for (let j = 0; j < m; j++) sv += v2[j] * v2[j];
        sv = Math.sqrt(sv) || 1;
        v = Float64Array.from(v2);
      }
      for (let q = 0; q < V.length; q++) { let d = 0; for (let j = 0; j < m; j++) d += v[j] * V[q].u[j]; for (let j = 0; j < m; j++) v[j] -= d * V[q].u[j]; }
      let nv = 0; for (let j = 0; j < m; j++) nv += v[j] * v[j];
      nv = Math.sqrt(nv) || 1;
      const u = new Float64Array(m); for (let j = 0; j < m; j++) u[j] = v[j] / nv;
      V.push({ u, s: Math.sqrt(sv) });
    }
    // per-question loading vector: K numbers, and its unit twin for cosines
    const L = [], U = [], hub = new Float64Array(m);
    const smax = V[0].s || 1;
    for (let j = 0; j < m; j++) {
      const l = new Float64Array(K);
      for (let k = 0; k < K; k++) l[k] = V[k].u[j] * (V[k].s / smax);
      let nl = 0; for (let k = 0; k < K; k++) nl += l[k] * l[k];
      nl = Math.sqrt(nl);
      const un = new Float64Array(K);
      for (let k = 0; k < K; k++) un[k] = nl ? l[k] / nl : 0;
      L.push(l); U.push(un); hub[j] = nl;
    }
    const hmax = Math.max(...hub) || 1;
    for (let j = 0; j < m; j++) hub[j] /= hmax;
    return (_emb = { V, L, U, hub, m, n });
  }

  const sim = (i, j) => { const E = embed(); let s = 0; for (let k = 0; k < K; k++) s += E.U[i][k] * E.U[j][k]; return Math.max(-1, Math.min(1, s * SHRINK)); };
  const hubs = () => embed().hub;

  // ── neighbour index: sign hash of the leading factors. A question's bucket is
  // computable from its own vector, so inserting one costs nothing and the
  // query never touches the whole pool. Below EXACT_MAX the pool is small
  // enough that one exact pass beats probing — and with 32 buckets an 85-
  // question pool would fall through to the full scan on nearly every call
  // anyway, which made the index decorative. So the threshold is explicit:
  // exact k-NN while small, LSH probing (production: HNSW) above it.
  const HB = 5;
  const EXACT_MAX = 512;
  let _idx = null;
  function index() {
    if (_idx) return _idx;
    const E = embed(), buckets = new Map();
    const code = (j) => { let c = 0; for (let k = 0; k < HB; k++) if (E.U[j][k] > 0) c |= (1 << k); return c; };
    const codes = new Int32Array(E.m);
    for (let j = 0; j < E.m; j++) { const c = code(j); codes[j] = c; if (!buckets.has(c)) buckets.set(c, []); buckets.get(c).push(j); }
    return (_idx = { buckets, codes });
  }
  // top-k by |sim|, kept in a k-slot array — no full sort, no array of every pair
  function topk(i, want, cand) {
    const best = [];
    const push = (j) => {
      const r = sim(i, j), a = Math.abs(r);
      if (best.length === want && a <= Math.abs(best[best.length - 1].r)) return;
      let p = best.length; while (p > 0 && Math.abs(best[p - 1].r) < a) p--;
      best.splice(p, 0, { j, r });
      if (best.length > want) best.pop();
    };
    if (cand) cand.forEach(push); else { const m = embed().m; for (let j = 0; j < m; j++) if (j !== i) push(j); }
    return best;
  }
  function near(i, k) {
    const E = embed(), want = k || 3;
    if (E.m <= EXACT_MAX) return topk(i, want, null);
    const I = index();
    const seen = new Set(), cand = [];
    const take = (c) => { const b = I.buckets.get(c); if (b) b.forEach((j) => { if (j !== i && !seen.has(j)) { seen.add(j); cand.push(j); } }); };
    take(I.codes[i]);
    for (let b = 0; b < HB; b++) take(I.codes[i] ^ (1 << b));              // one bit out
    for (let b = 0; b < HB && cand.length < want * 6; b++) for (let c = b + 1; c < HB; c++) take(I.codes[i] ^ (1 << b) ^ (1 << c));  // two bits out
    return topk(i, want, cand);
  }

  // ── the drawn web: every question's own strongest few, deduped. O(n·k) —
  // the edge count grows with the pool, not with its square.
  let _edges = null;
  function edges(per) {
    const kk = per || 3;
    if (_edges && _edges.kk === kk) return _edges.out;
    const E = embed(), seen = new Set(), out = [];
    for (let i = 0; i < E.m; i++) near(i, kk).forEach((x) => {
      const a = Math.min(i, x.j), b = Math.max(i, x.j), key = a * E.m + b;
      if (seen.has(key)) return;
      seen.add(key); out.push({ i: a, j: b, r: x.r });
    });
    out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    _edges = { kk, out };
    return out;
  }

  // ── position: the first two factors, projected. O(1) per question — a new
  // one lands in its place without moving anything else. The passes after it
  // are only decluttering, and both run on a grid, never all-pairs.
  let _plane = null;
  function plane(w, h, pad) {
    const W = w || 344, H = h || 330, P = pad || 16;
    const ck = W + 'x' + H + 'x' + P;
    if (_plane && _plane.ck === ck) return _plane;
    const E = embed(), Q = PAT().qs();
    const pts = Q.map((q, i) => ({ i, id: q.id, cat: q.cat, x: E.L[i][0], y: E.L[i][1] }));
    const fit = () => {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const sx = (W - P * 2) / (x1 - x0 || 1), sy = (H - P * 2) / (y1 - y0 || 1);
      pts.forEach((p) => { p.x = P + (p.x - x0) * sx; p.y = P + (p.y - y0) * sy; });
    };
    fit();
    // communities of the drawn web (label propagation, O(n·k) per pass) become
    // islands: members pull toward their island's centre, centres push out from
    // the middle — the archipelago the raw factor plane refuses to draw itself
    const lab = (() => {
      const m = pts.length, l = new Int32Array(m);
      for (let i = 0; i < m; i++) l[i] = i;
      const adj = Array.from({ length: m }, () => []);
      edges(3).forEach((e) => { const w = Math.abs(e.r); adj[e.i].push({ j: e.j, w }); adj[e.j].push({ j: e.i, w }); });
      for (let t = 0; t < 14; t++) {
        let moved = 0;
        for (let i = 0; i < m; i++) {
          const sc = new Map();
          adj[i].forEach((x) => sc.set(l[x.j], (sc.get(l[x.j]) || 0) + x.w));
          let best = l[i], bs = 0;
          sc.forEach((s, k2) => { if (s > bs) { bs = s; best = k2; } });
          if (best !== l[i]) { l[i] = best; moved++; }
        }
        if (!moved) break;
      }
      return l;
    })();
    const isle = new Map();
    pts.forEach((p, i) => { const k2 = lab[i]; if (!isle.has(k2)) isle.set(k2, { x: 0, y: 0, n: 0 }); const c = isle.get(k2); c.x += p.x; c.y += p.y; c.n++; });
    isle.forEach((c) => { c.x /= c.n; c.y /= c.n; });
    let gx = 0, gy = 0;
    pts.forEach((p) => { gx += p.x; gy += p.y; }); gx /= pts.length; gy /= pts.length;
    // exaggerate once, then hold each point to its island through the relax
    const anchor = pts.map((p, i) => {
      const c = isle.get(lab[i]);
      const cx2 = gx + (c.x - gx) * 1.55, cy2 = gy + (c.y - gy) * 1.55;
      p.x = cx2 + (p.x - c.x) * 0.6; p.y = cy2 + (p.y - c.y) * 0.6;
      return { x: cx2, y: cy2 };
    });
    const MIN = 10.5; // just enough to stay tappable — tight clusters ARE the signal
    // grid declutter: each point tests its own cell and the eight around it
    const relax = (iters, springs, anch) => {
      for (let t = 0; t < iters; t++) {
        if (anch) { const g = 0.026; pts.forEach((p, i2) => { p.x += (anch[i2].x - p.x) * g; p.y += (anch[i2].y - p.y) * g; }); }
        if (springs) {
          const k = 0.075 * (1 - t / (iters * 1.6));
          springs.forEach((e) => {
            const a = pts[e.i], b = pts[e.j];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
            const s = ((d - e.len) / d) * k;
            a.x += dx * s; a.y += dy * s; b.x -= dx * s; b.y -= dy * s;
          });
        }
        const cell = new Map();
        const key = (cx, cy) => cx * 100003 + cy;
        pts.forEach((p) => { const c = key(Math.floor(p.x / MIN), Math.floor(p.y / MIN)); if (!cell.has(c)) cell.set(c, []); cell.get(c).push(p); });
        pts.forEach((a) => {
          const cx = Math.floor(a.x / MIN), cy = Math.floor(a.y / MIN);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const b0 = cell.get(key(cx + ox, cy + oy));
            if (!b0) continue;
            for (let q = 0; q < b0.length; q++) {
              const b = b0[q];
              if (b === a || b.i < a.i) continue;
              let dx = b.x - a.x, dy = b.y - a.y;
              const d = Math.hypot(dx, dy);
              if (d >= MIN) continue;
              if (d < 0.001) { dx = (a.i % 2 ? 1 : -1) * 0.5; dy = 0.5; }
              const s = ((MIN - d) / (d || 1)) * 0.24;
              a.x -= dx * s; a.y -= dy * s; b.x += dx * s; b.y += dy * s;
            }
          }
        });
        pts.forEach((p) => { p.x = Math.max(P * 0.6, Math.min(W - P * 0.6, p.x)); p.y = Math.max(P * 0.6, Math.min(H - P * 0.6, p.y)); });
      }
    };
    // the same edges the map draws also do the tightening — a tie you can see
    const rmax = Math.max(...edges(3).map((e) => Math.abs(e.r))) || 1;
    relax(150, edges(3).map((e) => ({ i: e.i, j: e.j, len: 19 + (1 - Math.abs(e.r) / rmax) * 66 })), anchor);
    fit();
    relax(30, null, null);
    return (_plane = { ck, W, H, pts });
  }

  // ── the sentence. The ONLY place a pair is counted directly, and only for
  // the two or three links on screen: one pass over the voters, on demand.
  const _saidCache = new Map();
  // the counted part is cached; the "and what did YOU do" part is read fresh,
  // since your answers change under it
  function dress(i, j, best) {
    const Q = PAT().qs(), from = Q[i], to = Q[j], A = PAT().answers();
    return {
      from, to,
      pick: from.options[best.x].label,
      then: to.options[best.y].label,
      pct: Math.round(best.cond * 100),
      base: Math.round(best.base * 100),
      r: sim(i, j),
      youPicked: A[from.id] === best.x,
      youFollowed: A[from.id] === best.x && A[to.id] != null ? A[to.id] === best.y : null,
      other: A[to.id] != null ? to.options[A[to.id]].label : null,
    };
  }
  function say(i, j) {
    const ck = i + ':' + j;
    if (_saidCache.has(ck)) { const b = _saidCache.get(ck); return b && dress(i, j, b); }
    const C = cols(), a = C[i], b = C[j], n = a.length;
    let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
    for (let k = 0; k < n; k++) { if (a[k] === 0) { if (b[k] === 0) n00++; else n01++; } else { if (b[k] === 0) n10++; else n11++; } }
    const rows = [[n00, n01], [n10, n11]];
    const mi = [(n00 + n01) / n, (n10 + n11) / n], mj = [(n00 + n10) / n, (n01 + n11) / n];
    let best = null;
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
      if (mi[x] < 0.18) continue;
      const cond = rows[x][y] / (rows[x][0] + rows[x][1]);
      const lift = cond / Math.max(1e-6, mj[y]);
      if (lift > 1 && (!best || lift > best.lift)) best = { x, y, cond, base: mj[y], lift };
    }
    _saidCache.set(ck, best);
    return best && dress(i, j, best);
  }

  return { embed, sim, near, edges, hubs, plane, say, K };
})();
