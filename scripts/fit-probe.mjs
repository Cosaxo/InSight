// fit-probe.mjs — measure the shipped Patterns fit against baselines on a
// synthetic vote log shaped like the app's own traffic.
//
//   npm run probe:fit                        (the app-shaped world, launch size)
//   npm run probe:fit -- --people 20000      (traction size)
//   npm run probe:fit -- --world test --people 120 --days 60 --perDay 2 --active 1 --repeats
//                                            (patternsFit.test.ts's own world and regime)
//   npm run probe:fit -- --loadings doc.json (the LIVE doc, as plain JSON {k, q}, against its seeds)
//
// WHY THIS EXISTS. `functions/src/patternsFit.test.ts` proves the fit
// recovers a two-factor structure from a synthetic crowd — 120 people
// answering two questions a day for sixty days, drawn from a bank of ten,
// so each person answers each question about twelve times. The app never
// produces that log: an answer is create-only (D5), so a person answers a
// question at most once, and the eligible corpus is 113 questions. The
// test's regime and the app's regime are different worlds, and this probe
// runs the SAME engine — `foldUserDay`, imported, untouched — in both, and
// scores it with the same one-step-ahead surprisal the fit publishes on
// its own scorecard (D325). docs/ALGORITHM-REFLECTION.md §1 has what it
// found on 2026-09-06 and what follows from it; this file is how those
// numbers are reproduced rather than trusted.
//
// ENGINES, so the columns can be read:
//   truth     surprisal under the generating parameters — the floor no
//             engine can beat
//   marginal  p(option 0) from the question's running marginal alone —
//             the ceiling any loading vector must beat to be carrying
//             information beyond the question's popularity
//   shipped   functions/src/patternsFit.ts, byte-identical
//   shippedF  the shipped step re-implemented with the question step
//             floored at 0.01 (a constants change, nothing else)
//   shippedT  …with seeds ×10 and the floor at 0.02 (constants only)
//   als       the shipped ARCHITECTURE with a batch solve: centred ±1
//             residuals, alternating ridge least squares over every
//             observation so far, warm-started nightly, weighted-λ
//             regularisation; the person's vector re-solved at prediction
//             time by the device's own ridge (patternsMap.estimateTheta's
//             shape, λ from --lambdaU, default 0.5 as shipped)
//   logit     a logistic factor model (item vector + intercept), nightly
//             alternating Newton refit. Included as a second candidate
//             shape; as written here it is NOT competitive, and the
//             reflection says so rather than tuning it into the table
//
// COLUMNS. Bits are mean prequential surprisal per answer over the first
// and second halves of the run. `sim Pearson` correlates the estimated
// pairwise |cosine| with the generating one over every question pair —
// the Map's own reading. `top-edge∈true-top3` is the share of questions
// whose strongest drawn edge lands on one of its three true nearest
// neighbours (chance is 3/(Q−1)). `mean‖L‖` says whether the loadings
// have left their hash seeds (the seed norm is ≈0.08).
//
// WORLDS. "app": Gaussian traits in dTrue dimensions, items of mixed
// strength (norm 0.2–1.5) with skewed intercepts, one shared daily
// question per day plus feed picks, a person never re-answers. "test":
// the unit test's world exactly — two factors, ±1 traits, five questions
// each, a person answers with their trait's side 85% of the time — and
// `--repeats` reproduces its re-answering regime. Both worlds are
// deterministic (one LCG seed), so a run reproduces bit for bit.
//
// Node 22 runs the TypeScript import with --experimental-strip-types,
// which the npm script passes; the flag prints a warning the script also
// silences. No dependencies: `npm ci` is not needed to run this.
import {
  emptyModel, emptyUser, foldUserDay, emptyDayScore, PATTERNS_K,
  PATTERNS_ETA_USER, PATTERNS_LAMBDA, seedLoading, loadingCosine,
} from "../functions/src/patternsFit.ts";

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const PEOPLE = Number(arg("people", 2000));
const DAYS = Number(arg("days", 60));
const PER_DAY = Number(arg("perDay", 4));      // world answers per active person per day (COSTS.md: ~4)
const ACTIVE = Number(arg("active", 0.3));     // share of people active on a day (DAU/MAU ≈ 1/3, COSTS.md)
const Q0 = Number(arg("Q", 113));              // the eligible corpus, 2026-09-06 (PATTERNS_QIDS)
const D_TRUE = Number(arg("dTrue", 4));        // true latent dimension of the app world
const ENGINES = String(arg("engines", "truth,marginal,shipped,shippedF,shippedT,als,logit")).split(",");
const REPEATS = process.argv.includes("--repeats"); // the unit test's regime: a person may answer a question again
const LAMBDA_U = Number(arg("lambdaU", 0.5));        // the device solve's ridge (estimateTheta's default)
const WORLD = String(arg("world", "app"));
const LOADINGS = arg("loadings", null);              // a plain JSON dump of v2_patterns/loadings ({k, q}) — diagnose and exit
const K = PATTERNS_K;

// ── the production diagnostic ────────────────────────────────────────
// A fit that has learned nothing is still publishing 113 vectors with
// four decimals each, and nothing on the scorecard compares them to
// anything. Given the live doc as JSON, print how far each loading has
// travelled from the hash seed it was born with: cosine near 1 and a
// norm near 0.08 is a fit at its seeds; a fit that has learned shows
// both moving with n.
if (LOADINGS) {
  const { readFileSync } = await import("node:fs");
  const doc = JSON.parse(readFileSync(LOADINGS, "utf8"));
  const k = doc.k ?? K;
  const rows = Object.entries(doc.q ?? {}).map(([qid, L]) => {
    const seed = seedLoading(qid, k);
    return { qid, n: L.n ?? 0, norm: Math.hypot(...L.v), cos: loadingCosine(seed, L.v) };
  }).sort((a, b) => b.n - a.n);
  const mean = (f) => (rows.length ? rows.reduce((a, r) => a + f(r), 0) / rows.length : 0);
  console.log(`${rows.length} loadings, k=${k}; seed norm ≈ ${(0.05 * Math.sqrt(k / 3)).toFixed(3)}`);
  console.log(`mean |cos(seed, L)| ${mean((r) => Math.abs(r.cos)).toFixed(3)} · share above 0.9: ${(rows.filter((r) => Math.abs(r.cos) > 0.9).length / Math.max(1, rows.length)).toFixed(2)} · mean ‖L‖ ${mean((r) => r.norm).toFixed(3)}`);
  console.log("qid                      n   ‖L‖   cos(seed)");
  for (const r of rows.slice(0, 20)) console.log(`${r.qid.padEnd(22)} ${String(r.n).padStart(5)}  ${r.norm.toFixed(3)}  ${r.cos.toFixed(3)}`);
  if (rows.length > 20) console.log(`… ${rows.length - 20} more (sorted by n, these are the most-answered)`);
  process.exit(0);
}

// ── deterministic RNG ────────────────────────────────────────────────
let s = 20260906 >>> 0;
const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
const randn = () => { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const clampP = (p) => Math.max(0.05, Math.min(0.95, p));
const bits = (p0, x) => -Math.log2(Math.max(1e-6, x === 1 ? p0 : 1 - p0));
const dot = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) t += a[i] * b[i]; return t; };

// ── the world ────────────────────────────────────────────────────────
const TEST_WORLD = WORLD === "test";
const Q = TEST_WORLD ? 10 : Q0;
const DT = TEST_WORLD ? 2 : D_TRUE;
const qids = TEST_WORLD
  ? [...Array.from({ length: 5 }, (_, i) => `a${i}`), ...Array.from({ length: 5 }, (_, i) => `b${i}`)]
  : Array.from({ length: Q }, (_, i) => `q${String(i).padStart(3, "0")}`);
const trueA = TEST_WORLD
  ? qids.map((_, i) => (i < 5 ? [1, 0] : [0, 1]))
  : qids.map(() => { const v = Array.from({ length: DT }, randn); const n = Math.hypot(...v); const scale = 0.2 + 1.3 * rand(); return v.map((x) => (x / n) * scale); });
const trueB = qids.map(() => (TEST_WORLD ? 0 : 0.8 * randn()));
const theta = Array.from({ length: PEOPLE }, () => Array.from({ length: DT }, () => (TEST_WORLD ? (rand() < 0.5 ? 1 : -1) : randn())));
const pTrue = (u, q) => (TEST_WORLD ? (dot(trueA[q], theta[u]) > 0 ? 0.85 : 0.15) : sigmoid(trueB[q] + dot(trueA[q], theta[u])));

// one shared daily question per day in rotation, plus feed picks; a person
// answers each question at most once unless --repeats
const answered = Array.from({ length: PEOPLE }, () => new Set());
const days = [];
for (let d = 0; d < DAYS; d++) {
  const dailyQ = d % Q;
  const rows = [];
  for (let u = 0; u < PEOPLE; u++) {
    if (rand() >= ACTIVE) continue;
    const picks = [];
    if (REPEATS || !answered[u].has(dailyQ)) picks.push(dailyQ);
    let guard = 0;
    while (picks.length < PER_DAY && guard++ < 50) {
      const q = Math.floor(rand() * Q);
      if ((REPEATS || !answered[u].has(q)) && !picks.includes(q)) picks.push(q);
    }
    for (const q of picks) { answered[u].add(q); rows.push({ u, q, x: rand() < pTrue(u, q) ? 1 : -1 }); }
  }
  rows.sort((a, b) => a.u - b.u || a.q - b.q); // the fold's own order: by person, then by qid
  days.push(rows);
}
const totalObs = days.reduce((a, r) => a + r.length, 0);
const perPerson = answered.reduce((a, st) => a + st.size, 0) / PEOPLE;

// ── K×K ridge solve, the device's own shape (patternsMap.estimateTheta) ──
function solve(A, b) {
  const k = b.length; const M = A.map((r) => [...r]); const v = [...b];
  for (let c = 0; c < k; c++) {
    let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]]; [v[c], v[piv]] = [v[piv], v[c]];
    const d = M[c][c] || 1e-9;
    for (let r = c + 1; r < k; r++) { const f = M[r][c] / d; for (let j = c; j < k; j++) M[r][j] -= f * M[c][j]; v[r] -= f * v[c]; }
  }
  const x = new Array(k).fill(0);
  for (let r = k - 1; r >= 0; r--) { let t = v[r]; for (let j = r + 1; j < k; j++) t -= M[r][j] * x[j]; x[r] = t / (M[r][r] || 1e-9); }
  return x;
}
function ridge(obs, k, lambda) {
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? lambda : 0)));
  const b = new Array(k).fill(0);
  for (const o of obs) for (let i = 0; i < k; i++) { b[i] += o.r * o.L[i]; for (let j = 0; j < k; j++) A[i][j] += o.L[i] * o.L[j]; }
  return solve(A, b);
}

// ── engines ──────────────────────────────────────────────────────────
function runTruth() {
  return { perDay: days.map((rows) => (rows.length ? rows.reduce((a, { u, q, x }) => a + bits(clampP(pTrue(u, q)), x), 0) / rows.length : 0)) };
}
function runMarginal() {
  const n = new Array(Q).fill(0), sum = new Array(Q).fill(0);
  const perDay = [];
  for (const rows of days) {
    let b = 0;
    for (const { q, x } of rows) { const m = n[q] > 0 ? sum[q] / n[q] : 0; b += bits(clampP((1 + m) / 2), x); n[q] += 1; sum[q] += x; }
    perDay.push(rows.length ? b / rows.length : 0);
  }
  return { perDay };
}
function runShipped({ etaFloor = 0, seedScale = 1 } = {}) {
  const model = emptyModel(K);
  const users = new Map();
  const perDay = [];
  const reimpl = etaFloor > 0 || seedScale !== 1;
  // The variants re-implement the shipped step with two constants moved;
  // the plain row calls the shipped fold and nothing else.
  const step = reimpl ? (m, user, obs, score) => {
    for (const o of obs) {
      let L = m.q[o.qid];
      if (!L) { L = { v: seedLoading(o.qid, K).map((x) => x * seedScale), n: 0, sum: 0 }; m.q[o.qid] = L; }
      let dt = 0; for (let i = 0; i < K; i++) dt += user.v[i] * L.v[i];
      const mPrev = L.n > 0 ? L.sum / L.n : 0;
      score.n += 1; score.bits += bits(clampP((1 + mPrev + dt) / 2), o.x);
      L.n += 1; L.sum += o.x;
      const r = o.x - L.sum / L.n; const e = r - dt;
      const eq = Math.max(etaFloor, 0.5 / (20 + L.n));
      for (let i = 0; i < K; i++) { const ui = user.v[i], li = L.v[i]; user.v[i] = ui + PATTERNS_ETA_USER * (e * li - PATTERNS_LAMBDA * ui); L.v[i] = li + eq * (e * ui - PATTERNS_LAMBDA * li); }
      user.n += 1;
    }
  } : (m, user, obs, score) => foldUserDay(m, user, obs, score);
  for (const rows of days) {
    const score = emptyDayScore();
    let i = 0;
    while (i < rows.length) {
      const u = rows[i].u; const obs = [];
      while (i < rows.length && rows[i].u === u) { obs.push({ qid: qids[rows[i].q], x: rows[i].x }); i++; }
      const user = users.get(u) ?? emptyUser(K);
      step(model, user, obs, score);
      users.set(u, user);
    }
    perDay.push(score.n ? score.bits / score.n : 0);
  }
  const L = qids.map((id) => model.q[id]?.v ?? new Array(K).fill(0));
  return { perDay, L };
}
// The shipped architecture, batch-solved: r = x − mean_q, r ≈ θ·a.
// Weighted-λ regularisation (λ scaled by each row's observation count —
// the Netflix-prize ALS form) so a question with twenty answers stays
// shrunk while one with two thousand is free to fit; item norms clamped
// at 1 because |r| ≤ 2 and θ is unit-scale, so a longer vector is
// overfitting by construction.
function runALS({ sweeps = 3, lam = 0.15 } = {}) {
  const A = qids.map((id) => seedLoading(id, K).map((x) => x * 4));
  const n = new Array(Q).fill(0), sum = new Array(Q).fill(0);
  const hist = Array.from({ length: PEOPLE }, () => []);
  const thetaHat = Array.from({ length: PEOPLE }, () => new Array(K).fill(0));
  const perDay = [];
  const mean = (q) => (n[q] > 0 ? sum[q] / n[q] : 0);
  for (const rows of days) {
    let b = 0, i = 0;
    while (i < rows.length) {
      const u = rows[i].u; const todays = [];
      while (i < rows.length && rows[i].u === u) {
        const row = rows[i];
        // the device's solve: the person's own history, centred by the
        // marginals as published last night, including earlier today —
        // the same information the shipped fold's online theta has
        const obs = [...hist[u], ...todays].map((h) => ({ L: A[h.q], r: h.x - mean(h.q) }));
        const th = ridge(obs, K, LAMBDA_U);
        b += bits(clampP((1 + mean(row.q) + dot(A[row.q], th)) / 2), row.x);
        todays.push(row); i++;
      }
      for (const r of todays) hist[u].push(r);
    }
    for (const r of rows) { n[r.q] += 1; sum[r.q] += r.x; }
    perDay.push(rows.length ? b / rows.length : 0);
    // the night: alternate person and item ridge solves over everything
    const byQ = Array.from({ length: Q }, () => []);
    for (let u = 0; u < PEOPLE; u++) for (const h of hist[u]) byQ[h.q].push({ u, x: h.x });
    for (let sw = 0; sw < sweeps; sw++) {
      for (let u = 0; u < PEOPLE; u++) if (hist[u].length) thetaHat[u] = ridge(hist[u].map((h) => ({ L: A[h.q], r: h.x - mean(h.q) })), K, lam * hist[u].length + 0.5);
      for (let q = 0; q < Q; q++) {
        if (!byQ[q].length) continue;
        const a = ridge(byQ[q].map((o) => ({ L: thetaHat[o.u], r: o.x - mean(q) })), K, lam * byQ[q].length + 0.5);
        const nn = Math.hypot(...a);
        A[q] = nn > 1 ? a.map((x) => x / nn) : a;
      }
    }
  }
  return { perDay, L: A };
}
// A logistic factor model: p(option 0) = σ(b_q + a_q·θ_u). Damped Newton
// on both sides; a second candidate SHAPE, kept so the table shows one.
function capStep(d, cap) { const m = Math.hypot(...d); return m > cap ? d.map((x) => (x * cap) / m) : d; }
function newtonTheta(obs, A, B, lambda = 1.0) {
  const th = new Array(K).fill(0);
  for (let it = 0; it < 8; it++) {
    const H = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => (i === j ? lambda : 0)));
    const g = th.map((t) => lambda * t);
    for (const { q, x } of obs) {
      const p = sigmoid(B[q] + dot(A[q], th)); const y = x === 1 ? 1 : 0; const w = p * (1 - p) + 1e-6;
      for (let i = 0; i < K; i++) { g[i] += (p - y) * A[q][i]; for (let j = 0; j < K; j++) H[i][j] += w * A[q][i] * A[q][j]; }
    }
    const d = capStep(solve(H, g), 1.0); let mv = 0;
    for (let i = 0; i < K; i++) { th[i] -= d[i]; mv += d[i] * d[i]; }
    if (mv < 1e-8) break;
  }
  return th;
}
function newtonItem(obs, thetas, a0, b0, lambda = 4.0) {
  let a = [...a0], b = b0;
  for (let it = 0; it < 8; it++) {
    const n = K + 1;
    const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j && i < K ? lambda : 0)));
    const g = [...a.map((t) => lambda * t), 0];
    for (let o = 0; o < obs.length; o++) {
      const th = thetas[o]; const p = sigmoid(b + dot(a, th)); const y = obs[o] === 1 ? 1 : 0; const w = p * (1 - p) + 1e-6; const err = p - y;
      for (let i = 0; i < K; i++) { g[i] += err * th[i]; for (let j = 0; j < K; j++) H[i][j] += w * th[i] * th[j]; H[i][K] += w * th[i]; H[K][i] += w * th[i]; }
      g[K] += err; H[K][K] += w;
    }
    const d = capStep(solve(H, g), 0.5); let mv = 0;
    for (let i = 0; i < K; i++) { a[i] -= d[i]; mv += d[i] * d[i]; }
    b -= d[K]; mv += d[K] * d[K];
    b = Math.max(-4, Math.min(4, b));
    if (mv < 1e-8) break;
  }
  return { a, b };
}
function runLogit({ sweeps = 2 } = {}) {
  const A = qids.map((id) => seedLoading(id, K).map((x) => x * 4));
  const B = new Array(Q).fill(0);
  const hist = Array.from({ length: PEOPLE }, () => []);
  const thetaHat = Array.from({ length: PEOPLE }, () => new Array(K).fill(0));
  const perDay = [];
  for (const rows of days) {
    let b = 0, i = 0;
    while (i < rows.length) {
      const u = rows[i].u; const todays = [];
      while (i < rows.length && rows[i].u === u) {
        const row = rows[i];
        const th = newtonTheta([...hist[u], ...todays], A, B);
        b += bits(clampP(sigmoid(B[row.q] + dot(A[row.q], th))), row.x);
        todays.push(row); i++;
      }
      for (const r of todays) hist[u].push(r);
    }
    perDay.push(rows.length ? b / rows.length : 0);
    const byQ = Array.from({ length: Q }, () => []);
    for (let u = 0; u < PEOPLE; u++) for (const h of hist[u]) byQ[h.q].push({ u, x: h.x });
    for (let sw = 0; sw < sweeps; sw++) {
      for (let u = 0; u < PEOPLE; u++) if (hist[u].length) thetaHat[u] = newtonTheta(hist[u], A, B);
      for (let q = 0; q < Q; q++) {
        if (!byQ[q].length) continue;
        const r = newtonItem(byQ[q].map((o) => o.x), byQ[q].map((o) => thetaHat[o.u]), A[q], B[q]);
        A[q] = r.a; B[q] = r.b;
      }
    }
  }
  return { perDay, L: A };
}

// ── recovery: does the estimated geometry match the generating one? ──
function recovery(L) {
  const pt = [], pe = []; let hits = 0;
  for (let i = 0; i < Q; i++) {
    const tr = [], es = [];
    for (let j = 0; j < Q; j++) {
      if (i === j) continue;
      const t = loadingCosine(trueA[i], trueA[j]); const e = loadingCosine(L[i], L[j]);
      tr.push({ j, s: Math.abs(t) }); es.push({ j, s: Math.abs(e) });
      if (j > i) { pt.push(t); pe.push(e); }
    }
    tr.sort((a, b) => b.s - a.s); es.sort((a, b) => b.s - a.s);
    if (new Set(tr.slice(0, 3).map((x) => x.j)).has(es[0].j)) hits += 1;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mt = mean(pt), me = mean(pe); let cov = 0, vt = 0, ve = 0;
  for (let i = 0; i < pt.length; i++) { cov += (pt[i] - mt) * (pe[i] - me); vt += (pt[i] - mt) ** 2; ve += (pe[i] - me) ** 2; }
  const norm = mean(L.map((v) => Math.hypot(...v)));
  // the unit test's own metric, in its own world: same-factor pairs
  // against cross-factor pairs, mean |cos|
  let same = 0, sameN = 0, cross = 0, crossN = 0;
  if (TEST_WORLD) for (let i = 0; i < Q; i++) for (let j = i + 1; j < Q; j++) {
    const c = Math.abs(loadingCosine(L[i], L[j]));
    if ((i < 5) === (j < 5)) { same += c; sameN++; } else { cross += c; crossN++; }
  }
  return { pearson: cov / Math.sqrt(vt * ve || 1), top1in3: hits / Q, norm, same: sameN ? same / sameN : 0, cross: crossN ? cross / crossN : 0 };
}

const t0 = Date.now();
const half = (pd, which) => { const h = Math.floor(pd.length / 2); const part = which === 0 ? pd.slice(0, h) : pd.slice(h); return part.reduce((a, b) => a + b, 0) / part.length; };
const fmt = (x) => x.toFixed(3);
console.log(`world=${WORLD} repeats=${REPEATS} lambdaU=${LAMBDA_U} people=${PEOPLE} days=${DAYS} perDay=${PER_DAY} active=${ACTIVE} Q=${Q} dTrue=${DT} K=${K} obs=${totalObs} (${(totalObs / DAYS).toFixed(0)}/day, ${(totalObs / DAYS / Q).toFixed(1)} per question per day, ${perPerson.toFixed(1)} answers per person by the end)`);
console.log("engine     bits 1st half  bits 2nd half | sim Pearson  top-edge∈true-top3  mean‖L‖");
const runners = {
  truth: () => runTruth(), marginal: () => runMarginal(), shipped: () => runShipped(),
  shippedF: () => runShipped({ etaFloor: 0.01 }), shippedT: () => runShipped({ etaFloor: 0.02, seedScale: 10 }),
  als: () => runALS(), logit: () => runLogit(),
};
for (const name of ENGINES) {
  if (!runners[name]) { console.log(`${name}: unknown engine`); continue; }
  const t = Date.now();
  const r = runners[name]();
  const rec = r.L ? recovery(r.L) : null;
  const tail = rec && TEST_WORLD ? `  same|cos| ${fmt(rec.same)} cross|cos| ${fmt(rec.cross)}` : "";
  console.log(`${name.padEnd(9)}  ${fmt(half(r.perDay, 0)).padStart(13)}  ${fmt(half(r.perDay, 1)).padStart(13)} | ${rec ? fmt(rec.pearson).padStart(11) : "          –"}  ${rec ? fmt(rec.top1in3).padStart(18) : "                 –"}  ${rec ? fmt(rec.norm).padStart(7) : "      –"}${tail}   (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s total)`);
