// patterns-core.js — the math engine under the Patterns tab. ONE synthetic
// population (latent-factor model whose marginals match the feed's real vote
// splits) powers three lenses:
//   Oracle  — naive Bayes guesses YOUR next answer from your past ones;
//             surprisal (−log2 p) measures how hard you are to read, in bits.
//   Threads — mutual information between question pairs: answers that travel
//             together across unrelated topics.
//   Field   — PCA of everyone's answer vectors: the population as a plane,
//             distance = disagreement. Twin and antipode fall out of it.
// Everything is deterministic (hash-seeded); your answers persist.
window.PAT = (function () {
  const LS = 'insight.patterns.v1';
  function h01(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 8) % 100000) / 100000; }
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const clamp01 = (p) => Math.max(1e-4, Math.min(1 - 1e-4, p));
  const logit = (p) => Math.log(clamp01(p) / (1 - clamp01(p)));
  const log2 = (x) => Math.log(x) / Math.LN2;

  // ── questions: every 2-option vote/duel in the world pool, round-robin across
  // topics so no subject dominates, capped at 24 ──
  let _qs = null;
  function qs() {
    if (_qs) return _qs;
    const all = (window.WORLD_FEED_QS || []).filter((q) => (q.type === 'vote' || q.type === 'duel') && q.options && q.options.length === 2);
    const byCat = new Map();
    all.forEach((q) => { if (!byCat.has(q.cat)) byCat.set(q.cat, []); byCat.get(q.cat).push(q); });
    const cats = [...byCat.keys()]; const out = [];
    // the FULL eligible pool, round-robin across topics (order keeps the first
    // eight stable — they are the seed history). A heavy feed-voter must always
    // have fresh questions left for the Oracle; the math stays cheap at ~85.
    for (let r = 0; ; r++) {
      let hit = false;
      cats.forEach((c) => { const q = byCat.get(c)[r]; if (q) { out.push(q); hit = true; } });
      if (!hit) break;
    }
    return (_qs = out);
  }

  // ── latent structure: 3 hidden factors; each question loads on them. The
  // factors are what make the correlations REAL rather than noise. ──
  const K = 3;
  let _load = null;
  function loads() {
    if (_load) return _load;
    return (_load = qs().map((q) => { const v = []; for (let k = 0; k < K; k++) { const u = h01('ld' + k + q.id) * 2 - 1; v.push(Math.abs(u) < 0.34 ? u * 0.25 : u); } return v; }));
  }

  // ── the population: 560 people = 4 loose clusters in factor space; each
  // answer sampled at sigmoid(base-rate logit + factors·loadings) ──
  const N = 560;
  const CITIES = ['Lagos', 'Oslo', 'Seoul', 'Lima', 'Toronto', 'Naples', 'Jakarta', 'Kyiv', 'Austin', 'Nairobi', 'Porto', 'Osaka', 'Tbilisi', 'Bogotá', 'Marseille', 'Tampere', 'Cape Town', 'Hanoi', 'Kraków', 'Valparaíso', 'Beirut', 'Adelaide', 'Reykjavík', 'Montevideo'];
  // countries carry a small factor tilt of their own — so a link that holds in
  // Norway can genuinely break worldwide, not just get noisier
  const COUNTRIES = ['Norway', 'Brazil', 'Japan', 'USA', 'Kenya', 'Poland', 'India', 'Australia'];
  const CO = COUNTRIES.map((c, k) => { const r = rng(400 + k); return [(r() * 2 - 1) * 0.55, (r() * 2 - 1) * 0.55, (r() * 2 - 1) * 0.55]; });
  const MYCO = (window.IS_DATA && window.IS_DATA.me && COUNTRIES.indexOf(window.IS_DATA.me.country) >= 0) ? window.IS_DATA.me.country : 'Norway';
  let _pop = null;
  function pop() {
    if (_pop) return _pop;
    const Q = qs(), L = loads(), r = rng(77);
    const centers = []; for (let c = 0; c < 4; c++) { const v = []; for (let k = 0; k < K; k++) v.push((r() * 2 - 1) * 1.25); centers.push(v); }
    _pop = [];
    for (let i = 0; i < N; i++) {
      const ci = Math.floor(h01('co' + i) * COUNTRIES.length);
      const cn = centers[i % 4]; const f = cn.map((v, k) => v + (r() * 2 - 1) * 0.85 + CO[ci][k] * 0.6);
      const a = Q.map((q, j) => {
        const base = q.options[0].count / (q.options[0].count + q.options[1].count);
        let z = logit(base) * 0.55; for (let k = 0; k < K; k++) z += f[k] * L[j][k] * 1.35;
        return h01('p' + i + q.id) < sig(z) ? 0 : 1;
      });
      _pop.push({ id: 'x' + i, f, a, co: COUNTRIES[ci], city: CITIES[Math.floor(h01('ct' + i) * CITIES.length)], age: 18 + Math.floor(h01('ag' + i) * 52) });
    }
    return _pop;
  }
  // your circle — the named friends, answers drawn near your own factor profile
  let _cir = null;
  function circle() {
    if (_cir) return _cir;
    const Q = qs(), L = loads();
    let names = [];
    try {
      const ids = window.FRIENDS ? window.FRIENDS.list() : [];
      const ppl = (window.IS_DATA && window.IS_DATA.people) || [];
      names = ids.map((id) => { const p = ppl.find((x) => x.id === id); return p && p.name; }).filter(Boolean);
    } catch (e) {}
    const FALL = ['Sofia', 'Marcus', 'Priya', 'Leo', 'Hannah', 'Noah', 'Olivia', 'Ethan', 'Ava', 'Liam', 'Chloe', 'Ben', 'Zoe', 'Adam', 'Grace', 'Nina'];
    names = [...new Set(names.concat(FALL))].slice(0, 16);
    const FME = [0.95, -0.55, 0.35];
    _cir = names.map((nm, i) => {
      const r = rng(900 + i);
      const f = FME.map((v) => v + (r() * 2 - 1) * 0.75);
      const a = Q.map((q, j) => {
        const base = q.options[0].count / (q.options[0].count + q.options[1].count);
        let z = logit(base) * 0.55; for (let k = 0; k < K; k++) z += f[k] * L[j][k] * 1.35;
        return h01('c' + nm + q.id) < sig(z) ? 0 : 1;
      });
      return { id: 'c' + i, name: nm, f, a };
    });
    return _cir;
  }
  const _mem = {};
  const members = (popId) => {
    const pid = popId || 'world';
    if (_mem[pid]) return _mem[pid];
    return (_mem[pid] = pid === 'circle' ? circle() : pid === 'country' ? pop().filter((p) => p.co === MYCO) : pop());
  };
  // per-population answer COLUMNS (Uint8Array) — the hot loops below run on
  // these flat arrays, not on per-person closures; that is the whole speed story
  const _cols = {};
  function colsOf(popId) {
    const pid = popId || 'world';
    if (_cols[pid]) return _cols[pid];
    const P = members(pid), m = qs().length, cols = [];
    for (let j = 0; j < m; j++) { const c = new Uint8Array(P.length); for (let i = 0; i < P.length; i++) c[i] = P[i].a[j]; cols.push(c); }
    return (_cols[pid] = cols);
  }
  function counts(j, popId) { const c = colsOf(popId), col = c[j]; let c0 = 0; for (let i = 0; i < col.length; i++) if (col[i] === 0) c0++; return [c0, col.length - c0]; }

  // ── mutual information over all pairs, per population; cross-topic first ──
  let _links = {};
  function links(popId) {
    const pid = popId || 'world';
    if (_links[pid]) return _links[pid];
    const Q = qs(), n = members(pid).length, cols = colsOf(pid), out = [];
    for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) {
      const ci = cols[i], cj = cols[j];
      let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
      for (let k = 0; k < n; k++) { if (ci[k] === 0) { if (cj[k] === 0) n00++; else n01++; } else { if (cj[k] === 0) n10++; else n11++; } }
      const c = [[n00, n01], [n10, n11]];
      const pi = [(c[0][0] + c[0][1]) / n, (c[1][0] + c[1][1]) / n], pj = [(c[0][0] + c[1][0]) / n, (c[0][1] + c[1][1]) / n];
      let mi = 0;
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { const pxy = c[x][y] / n; if (pxy > 0) mi += pxy * log2(pxy / (pi[x] * pj[y])); }
      // the strongest directional read with decent support — the human sentence
      let best = null;
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
        const sup = pi[x]; if (sup < 0.18) continue;
        const cond = c[x][y] / (c[x][0] + c[x][1]), base = pj[y], lift = cond / Math.max(1e-6, base);
        if (lift > 1 && (!best || lift > best.lift)) best = { x, y, cond, base, lift };
      }
      out.push({ i, j, mi, best, cross: Q[i].cat !== Q[j].cat });
    }
    out.sort((a, b) => b.mi - a.mi);
    const cross = out.filter((l) => l.cross && l.best).slice(0, 12);
    const top = (cross.length < 12 ? cross.concat(out.filter((l) => !l.cross && l.best).slice(0, 12 - cross.length)) : cross).sort((a, b) => b.mi - a.mi);
    return (_links[pid] = { all: out, top, n });
  }

  // ── state: your answers + the oracle's record ──
  // Three answer sources merge into one view of you (eff):
  //   seeds (deterministic persona history, recomputed — never lets the tab open
  //   empty) < your REAL World-feed votes on these same questions < answers
  //   given here. The tab is a lens on the app, not a separate quiz.
  let S = null; const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) {} });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} fire(); };
  // the seed persona (matches Mira's cluster) — first 8 questions arrive answered,
  // the last 5 of them already called by the oracle, so the tab never opens empty
  function personaAnswer(q, j) {
    const f = [0.95, -0.55, 0.35], L = loads();
    const base = q.options[0].count / (q.options[0].count + q.options[1].count);
    let z = logit(base) * 0.55; for (let k = 0; k < K; k++) z += f[k] * L[j][k] * 1.35;
    return sig(z) >= 0.5 ? 0 : 1;
  }
  function init() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { S = null; }
    if (!S || typeof S !== 'object' || !S.a) S = { a: {}, log: [], v: 2 };
    if (S.v !== 2) {
      // migration: seeds used to live in S.a — drop them (they are deterministic
      // and recomputed), so real feed votes can shine through
      qs().slice(0, 8).forEach((q, idx) => { if (S.a[q.id] === personaAnswer(q, idx)) delete S.a[q.id]; });
      S.v = 2; save();
    }
    if (!S.log.length && !Object.keys(S.a).length) {
      // first run: the last 5 seeded answers arrive already called by the oracle
      const sa = seedA();
      qs().slice(3, 8).forEach((q) => {
        const rest = {}; Object.keys(sa).forEach((id) => { if (id !== q.id) rest[id] = sa[id]; });
        const o = _oracle(q.id, rest);
        S.log.push({ q: q.id, pred: o.pred, conf: +o.conf.toFixed(2), mine: sa[q.id], bits: +(-log2(o.post[sa[q.id]])).toFixed(2) });
      });
      save();
    }
    return S;
  }
  // the deterministic seed history — recomputed, never persisted
  let _seedA = null;
  function seedA() {
    if (_seedA) return _seedA;
    _seedA = {};
    qs().slice(0, 8).forEach((q, idx) => { _seedA[q.id] = personaAnswer(q, idx); });
    return _seedA;
  }
  // your REAL votes from the World feed, on these same questions (0/1 only)
  let _fv = { t: 0, v: {} };
  function feedVotes() {
    const now = Date.now();
    if (now - _fv.t < 800) return _fv.v;
    let raw; try { raw = JSON.parse(localStorage.getItem('insight.feedVotes.v1') || '{}'); } catch (e) { raw = {}; }
    const v = {};
    qs().forEach((q) => { const x = raw && raw[q.id]; if (x === 0 || x === 1) v[q.id] = x; });
    _fv = { t: now, v };
    return v;
  }
  // the one view of you every lens reads
  function eff() { init(); return Object.assign({}, seedA(), feedVotes(), S.a); }

  // ── the Oracle: naive Bayes over your answered questions, damped so 20 weak
  // features can't fake certainty; posterior capped at 95% ──
  // Shape matters here: this runs on every prediction, so it reads the flat
  // Uint8Array columns (one sequential pass per feature, bucketed by the
  // target's own column) rather than walking 560 person objects per feature,
  // and question ids resolve through a Map instead of a findIndex scan per
  // answered question. Same numbers, O(answered × voters) with a small
  // constant instead of O(answered × questions + answered × voters) with a
  // pointer chase. (The scalable end state is scoring from the QMAP factor
  // model — O(K) per candidate — rather than counting voters at all.)
  let _qix = null;
  function qix() {
    if (_qix) return _qix;
    _qix = new Map(); qs().forEach((q, j) => _qix.set(q.id, j));
    return _qix;
  }
  function _oracle(qid, ans) {
    const Q = qs(), IX = qix(), t = IX.has(qid) ? IX.get(qid) : -1;
    const A = ans || eff();
    const answered = Object.keys(A).map((id) => (IX.has(id) ? IX.get(id) : -1)).filter((j) => j >= 0 && j !== t);
    const C = colsOf('world'), tcol = C[t], n = tcol.length;
    let n1 = 0; for (let i = 0; i < n; i++) if (tcol[i] === 1) n1++;
    const sz = [n - n1, n1];
    const lg = [0, 1].map((c) => Math.log((sz[c] + 1) / (n + 2)));
    // per-feature contribution toward the eventual call — the "tell"
    const contrib = [];
    answered.forEach((j) => {
      const mine = A[Q[j].id], col = C[j];
      let m0 = 0, m1 = 0;
      for (let i = 0; i < n; i++) if (col[i] === mine) { if (tcol[i] === 0) m0++; else m1++; }
      const d = [0.5 * Math.log((m0 + 1) / (sz[0] + 2)), 0.5 * Math.log((m1 + 1) / (sz[1] + 2))];
      lg[0] += d[0]; lg[1] += d[1];
      contrib.push({ j, d: d[0] - d[1] });
    });
    const mx = Math.max(lg[0], lg[1]), e0 = Math.exp(lg[0] - mx), e1 = Math.exp(lg[1] - mx);
    let p0 = Math.min(0.95, Math.max(0.05, e0 / (e0 + e1)));
    const pred = p0 >= 0.5 ? 0 : 1, sgn = pred === 0 ? 1 : -1;
    const ev = contrib.map((c) => ({ j: c.j, w: c.d * sgn })).filter((c) => c.w > 0.015).sort((a, b) => b.w - a.w).slice(0, 2).map((c) => c.j);
    // mass = how much your answers actually discriminate on THIS question, i.e.
    // how much evidence the call rests on (0 on a cold start). The Oracle lens
    // draws it as the disc's ink density, so a guess made on nothing looks like
    // a guess made on nothing.
    const mass = contrib.reduce((s, c) => s + Math.abs(c.d), 0);
    return { pred, conf: Math.max(p0, 1 - p0), post: [p0, 1 - p0], ev, mass, nf: answered.length };
  }
  // ── the tell: ONE piece of evidence, counted directly, only when asked.
  // Among world voters who answered the evidence question the way YOU did, how
  // do they split on this one? One pass over two columns, on demand — same
  // bargain as the Map's say().
  function tell(qid, evId) {
    init(); const Q = qs(), IX = qix();
    if (!IX.has(qid) || !IX.has(evId)) return null;
    const t = IX.get(qid), j = IX.get(evId); if (t === j) return null;
    const mine = eff()[evId]; if (mine == null) return null;
    const C = colsOf('world'), tc = C[t], jc = C[j], n = tc.length;
    let m = 0; const c = [0, 0];
    for (let i = 0; i < n; i++) if (jc[i] === mine) { m++; c[tc[i]]++; }
    if (m < 12) return null;
    return { q: Q[j], side: mine, share: [c[0] / m, c[1] / m], n: m };
  }
  function answer(qid, side) {
    init(); if (eff()[qid] != null && seedA()[qid] == null) return null;
    if (S.a[qid] != null) return null;
    // the ripple — capture where you stood before this answer lands
    const me0 = mePoint(), kin0 = kin();
    const o = _oracle(qid);
    const rec = { q: qid, pred: o.pred, conf: +o.conf.toFixed(2), mine: side, bits: +(-log2(o.post[side])).toFixed(2), ev: o.ev.map((j) => qs()[j].id) };
    S.a[qid] = side; S.log.push(rec); _mePt = null;
    const me1 = mePoint(), kin1 = kin();
    rec.rip = { x0: me0.x, y0: me0.y, x1: me1.x, y1: me1.y, tw0: kin0 ? Math.round(kin0.twin.agree * 100) : 0, tw1: kin1 ? Math.round(kin1.twin.agree * 100) : 0, twMoved: !!(kin0 && kin1 && kin0.twin.i !== kin1.twin.i) };
    save();
    return rec;
  }
  const nextQ = () => { init(); const A = eff(); return qs().find((q) => A[q.id] == null && seedA()[q.id] == null) || null; };
  function meter() {
    init(); const L = S.log; if (!L.length) return { n: 0, avg: 0, acc: 0, streak: 0 };
    let stk = 0; for (let i = L.length - 1; i >= 0 && L[i].pred !== L[i].mine; i--) stk++;
    return { n: L.length, avg: L.reduce((s, r) => s + r.bits, 0) / L.length, acc: L.filter((r) => r.pred === r.mine).length / L.length, streak: stk };
  }

  // ── PCA: power iteration on the centered ±1 answer matrix; k-means(4) on the
  // projection tints the clusters; top-loading question names each axis ──
  let _pca = null, _mePt = null;
  function pca() {
    if (_pca) return _pca;
    const Q = qs(), P = pop(), n = P.length, m = Q.length;
    const mean = new Float64Array(m);
    for (let i = 0; i < n; i++) { const a = P[i].a; for (let j = 0; j < m; j++) mean[j] += a[j] === 0 ? 1 : -1; }
    for (let j = 0; j < m; j++) mean[j] /= n;
    // flat matrix + indexed loops — no closures in the hot path
    const Xf = new Float64Array(n * m);
    for (let i = 0; i < n; i++) { const a = P[i].a, off = i * m; for (let j = 0; j < m; j++) Xf[off + j] = (a[j] === 0 ? 1 : -1) - mean[j]; }
    function pc(v0, prev) {
      let v = Float64Array.from(v0);
      for (let it = 0; it < 50; it++) {
        const w = new Float64Array(m);
        for (let i = 0; i < n; i++) {
          const off = i * m; let d = 0;
          for (let j = 0; j < m; j++) d += Xf[off + j] * v[j];
          for (let j = 0; j < m; j++) w[j] += d * Xf[off + j];
        }
        if (prev) { let d = 0; for (let j = 0; j < m; j++) d += w[j] * prev[j]; for (let j = 0; j < m; j++) w[j] -= d * prev[j]; }
        let nn = 0; for (let j = 0; j < m; j++) nn += w[j] * w[j]; nn = Math.sqrt(nn) || 1;
        for (let j = 0; j < m; j++) v[j] = w[j] / nn;
      }
      return v;
    }
    const r = rng(9);
    const v1 = pc(Array.from({ length: m }, () => r() * 2 - 1), null);
    const v2 = pc(Array.from({ length: m }, () => r() * 2 - 1), v1);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const off = i * m; let x = 0, y = 0;
      for (let j = 0; j < m; j++) { x += Xf[off + j] * v1[j]; y += Xf[off + j] * v2[j]; }
      pts.push([x, y]);
    }
    let mx = 0; pts.forEach((p) => { mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1])); });
    const sc = 1 / (mx || 1);
    const pts2 = pts.map((p, i) => ({ x: p[0] * sc, y: p[1] * sc, p: P[i] }));
    let cs = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
    const asg = new Array(n).fill(0);
    for (let it = 0; it < 16; it++) {
      pts2.forEach((p, i) => { let b = 0, bd = 1e9; cs.forEach((c, k) => { const d = (p.x - c[0]) ** 2 + (p.y - c[1]) ** 2; if (d < bd) { bd = d; b = k; } }); asg[i] = b; });
      cs = cs.map((c, k) => { let sx = 0, sy = 0, ct = 0; pts2.forEach((p, i) => { if (asg[i] === k) { sx += p.x; sy += p.y; ct++; } }); return ct ? [sx / ct, sy / ct] : c; });
    }
    // each cluster's defining answer — the option it over-indexes on most
    const cnames = cs.map((_, k) => {
      let bj = 0, bd = 0;
      for (let j = 0; j < m; j++) {
        let inC = 0, nC = 0, all = 0;
        for (let i = 0; i < n; i++) { const z = P[i].a[j] === 0 ? 1 : 0; all += z; if (asg[i] === k) { inC += z; nC++; } }
        const d = inC / (nC || 1) - all / n;
        if (Math.abs(d) > Math.abs(bd)) { bd = d; bj = j; }
      }
      const q = Q[bj];
      return { lab: bd > 0 ? q.options[0].label : q.options[1].label };
    });
    function axis(v) {
      let bj = 0; for (let j = 1; j < m; j++) if (Math.abs(v[j]) > Math.abs(v[bj])) bj = j;
      const q = Q[bj];
      return { pos: v[bj] > 0 ? q.options[0].label : q.options[1].label, neg: v[bj] > 0 ? q.options[1].label : q.options[0].label, q };
    }
    return (_pca = { pts: pts2, asg, v1, v2, mean, sc, ax1: axis(v1), ax2: axis(v2), cs, cnames });
  }
  // the field's dots for one population — same basis for all, so the axes and
  // your own position never jump when you switch
  function fieldPts(popId) {
    const C = pca();
    if (!popId || popId === 'world') return C.pts.map((p, i) => ({ x: p.x, y: p.y, asg: C.asg[i], p: p.p }));
    if (popId === 'country') { const out = []; C.pts.forEach((p, i) => { if (p.p.co === MYCO) out.push({ x: p.x, y: p.y, asg: C.asg[i], p: p.p }); }); return out; }
    return circle().map((c) => {
      let x = 0, y = 0;
      c.a.forEach((a, j) => { const v = (a === 0 ? 1 : -1) - C.mean[j]; x += v * C.v1[j]; y += v * C.v2[j]; });
      x *= C.sc; y *= C.sc;
      let b = 0, bd = 1e9; C.cs.forEach((cc, k) => { const d = (x - cc[0]) ** 2 + (y - cc[1]) ** 2; if (d < bd) { bd = d; b = k; } });
      return { x, y, asg: b, p: c };
    });
  }
  function mePoint() {
    init();
    const C = pca(), Q = qs(), A = eff();
    const k = JSON.stringify(A);
    if (_mePt && _mePt.k === k) return _mePt;
    let x = 0, y = 0;
    Q.forEach((q, j) => { if (A[q.id] == null) return; const v = (A[q.id] === 0 ? 1 : -1) - C.mean[j]; x += v * C.v1[j]; y += v * C.v2[j]; });
    return (_mePt = { x: x * C.sc, y: y * C.sc, n: Object.keys(A).length, k });
  }
  function kin(popId) {
    init(); const Q = qs(), P = members(popId || 'world'), A = eff();
    const ids = Q.map((q, j) => j).filter((j) => A[Q[j].id] != null);
    if (!ids.length || !P.length) return null;
    const scored = P.map((p) => { let eq = 0; ids.forEach((j) => { if (p.a[j] === A[Q[j].id]) eq++; }); return eq / ids.length; });
    let ti = 0, ai = 0; scored.forEach((s, i) => { if (s > scored[ti]) ti = i; if (s < scored[ai]) ai = i; });
    return { twin: { i: ti, agree: scored[ti] }, anti: { i: ai, agree: scored[ai] } };
  }
  // one tapped member vs you: agreement share + the rarest place you split
  function compare(i, popId) {
    init(); const Q = qs(), p = members(popId || 'world')[i], A = eff();
    if (!p) return null;
    const ids = Q.map((q, j) => j).filter((j) => A[Q[j].id] != null);
    let eq = 0; const diffs = [];
    ids.forEach((j) => { if (p.a[j] === A[Q[j].id]) eq++; else diffs.push(j); });
    let top = null;
    diffs.forEach((j) => { const [c0, c1] = counts(j, popId); const share = (p.a[j] === 0 ? c0 : c1) / (c0 + c1); if (!top || share < top.share) top = { j, share, their: p.a[j], mine: A[Q[j].id] }; });
    return { agree: ids.length ? eq / ids.length : 0, n: ids.length, top };
  }
  function pairIn(i, j, popId) { return links(popId).all.find((l) => l.i === i && l.j === j) || null; }

  // ── the fingerprint: the fewest of YOUR answers that single you out of the
  // world. Greedy — at each step take the answer that prunes hardest without
  // emptying the room, so the funnel walks 560 → … → 1 and stops. ──
  let _fp = null;
  function fingerprint() {
    init();
    const A = eff(), key = JSON.stringify(A);
    if (_fp && _fp.key === key) return _fp;
    const Q = qs(), cols = colsOf('world'), start = members('world').length;
    const answered = Q.map((q, j) => j).filter((j) => A[Q[j].id] != null);
    let idx = Array.from({ length: start }, (_, i) => i);
    const steps = [], used = new Set();
    while (idx.length > 1) {
      let bj = -1, bk = null;
      for (let t = 0; t < answered.length; t++) {
        const j = answered[t]; if (used.has(j)) continue;
        const col = cols[j], mine = A[Q[j].id], keep = idx.filter((i) => col[i] === mine);
        if (keep.length >= 1 && (bk === null || keep.length < bk.length)) { bk = keep; bj = j; }
      }
      if (bj < 0) break;
      used.add(bj); idx = bk; steps.push({ j: bj, left: idx.length });
    }
    return (_fp = { key, start, steps, left: idx.length, unique: idx.length <= 1 });
  }

  // ── your defiances: the strong crowd patterns you fall into and DON'T follow ──
  let _def = { key: null };
  function defiances(popId) {
    const pid = popId || 'world';
    const A = eff(), key = pid + JSON.stringify(A);
    if (_def.key === key) return _def.v;
    const Q = qs(), L = links(pid), out = [];
    let strong = 0;
    L.all.forEach((l) => {
      const b = l.best; if (!b || b.cond < 0.62) return;
      const mi = A[Q[l.i].id], mj = A[Q[l.j].id];
      if (mi !== b.x || mj == null) return;
      strong++;
      if (mj !== b.y) out.push({ i: l.i, j: l.j, x: b.x, y: b.y, mine: mj, cond: b.cond, lift: b.lift });
    });
    out.sort((a, b) => b.cond - a.cond);
    _def = { key, v: { broke: out, strong } };
    return _def.v;
  }

  // ── the fork: which WAY the next answer tilts you. Your point is a sum over
  // dozens of answers, so one more shifts it by ~0.03 units — a distance smaller
  // than your own dot. So this returns a DIRECTION (unit vector) and the camp
  // each side leans into, read a fixed step out along that line; the tab draws
  // it at a legible radius. Only genuine forks survive — if both sides of the
  // line lean into the same camp there is no fork, and nothing is drawn. ──
  const PULL_OFF = 0.21;
  function pull() {
    init();
    const C = pca(), Q = qs(), A = eff(), me = mePoint();
    const asg = (x, y) => { let b = 0, bd = 1e9; C.cs.forEach((c, k) => { const d = (x - c[0]) ** 2 + (y - c[1]) ** 2; if (d < bd) { bd = d; b = k; } }); return b; };
    let best = null;
    Q.forEach((q, j) => {
      if (A[q.id] != null) return;
      let dx = C.v1[j] * C.sc, dy = C.v2[j] * C.sc;
      const len = Math.hypot(dx, dy); if (len < 1e-9) return;
      dx /= len; dy /= len;
      const g0 = asg(me.x + dx * PULL_OFF, me.y + dy * PULL_OFF);
      const g1 = asg(me.x - dx * PULL_OFF, me.y - dy * PULL_OFF);
      if (g0 === g1) return;
      if (!best || len > best.len) best = { q, j, dir: [dx, dy], g0, g1, len };
    });
    return best;
  }
  // your path across the Field — one segment per answer given HERE (from the ripples)
  function trail() { init(); const t = []; S.log.forEach((r) => { if (r.rip) { if (!t.length) t.push([r.rip.x0, r.rip.y0]); t.push([r.rip.x1, r.rip.y1]); } }); return t; }
  function reset() { try { localStorage.removeItem(LS); } catch (e) {} S = null; _mePt = null; init(); fire(); }

  return {
    qs, pop, links, counts, pca, fieldPts, mePoint, kin, compare, answer, nextQ, meter, reset, pairIn, trail, fingerprint, defiances, pull, tell, myco: () => MYCO,
    pops: () => [{ id: 'circle', label: 'Circle', n: circle().length }, { id: 'country', label: MYCO, n: members('country').length }, { id: 'world', label: 'World', n: N }],
    oracleFor: (qid) => { init(); return _oracle(qid); },
    log: () => { init(); return S.log.slice(); },
    answers: () => eff(),
    // the shared header: one dataset, three lenses
    stats: () => { const A = eff(); return { total: qs().length, answered: Object.keys(A).length, fromFeed: Object.keys(feedVotes()).length, people: N + 1 }; },
    sub: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
