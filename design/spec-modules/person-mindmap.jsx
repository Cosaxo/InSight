// InSight — PersonMindMap: a read-only map of someone else's answers, grown
// from the SAME daily-question pool as your own map: same branches, same
// sub-topics, same cluster layout engine, same territory fields — so their map
// reads exactly like yours. Their answers are deterministic per person and
// lean toward yours in proportion to your affinity; tapping an answer shows
// how it compares to what YOU said. Some details stay hidden until you're
// friends. (map-tab.css, MapLens hues, MapTabLayout clusters)
(function () {
const { useState, useRef, useEffect, useMemo } = React;

const PMM_ZLAB = 0.5;
function pmmHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 8) % 100000) / 100000;
}
function pmmRng(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pmmCap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pmmSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// believable texture for branches the questions haven't reached yet
const PMM_POOLS = {
  health: [['Morning runs', 'rain or not'], ['Climbing gym', ''], ['Winter swims', 'ten minutes, max'], ['Cycling everywhere', ''], ['Long walks', 'the thinking kind']],
  craft: [['Analogue photography', ''], ['Sketching', 'a pocket notebook'], ['Woodwork', 'a bench, slowly'], ['Guitar', 'three chords, honest'], ['Bookbinding', '']],
  home: [['Old flat, good light', ''], ['Balcony garden', ''], ['Two cats', ''], ['Market Saturdays', ''], ['Ten minutes to the water', '']],
  story: [['Grew up by the sea', ''], ['Lived abroad a while', 'came back changed'], ['Changed careers once', ''], ['Studied philosophy', 'still shows']],
  goals: [['Write a book', 'someday, honestly'], ['Learn to sail', ''], ['See Patagonia', ''], ['A year off', 'the quiet plan']],
  values: [['Buys less, keeps longer', ''], ['Slow mornings', ''], ['Honesty over comfort', ''], ['Repair before replace', '']],
  interests: [['Used bookshops', ''], ['Old cinema', ''], ['Vinyl', '']],
};

// ── their node set — the real question pool, answered deterministically ─────
function pmmBuild(p) {
  const D = window.DAILYQ;
  const seedCats = (window.MapLens ? window.MapLens.CATS : []).slice();
  const seed = String(p.id || p.init || p.name || 'x');
  const H = (s) => pmmHash(seed + '|' + s);
  const nodes = [];
  const topSeen = new Map(); const subSeen = new Map(); const counts = {};
  const bump = (cid) => { counts[cid] = (counts[cid] || 0) + 1; };

  // affinity → how often the two of you answered alike
  const agreeP = Math.min(0.9, Math.max(0.35, (p.match || 60) / 100 - 0.05));
  const ansText = (q, idx) => q.type === 'rating' ? (idx + 1) + '/10' : (q.options && q.options[idx] != null) ? q.options[idx] : '—';

  (D ? D.questions : []).forEach((q) => {
    if (H('has' + q.id) > 0.68) return; // one they haven't answered
    const n = Math.max(2, q.type === 'rating' ? 10 : q.type === 'binary' ? 2 : q.type === 'scale' ? 5 : (q.options || []).length || 2);
    const mineIdx = D.myAnswer(q);
    const gd = window.MapStats ? window.MapStats.dist(q.id, 'all', n, mineIdx) : null;
    const majIdx = gd ? gd.indexOf(Math.max(...gd)) : Math.floor(H('mj' + q.id) * n);
    let aidx;
    if (mineIdx != null && H('agree' + q.id) < agreeP) aidx = mineIdx;
    else {
      aidx = H('majb' + q.id) < 0.6 ? majIdx : Math.floor(H('pick' + q.id) * n);
      // an intended disagreement shouldn't collapse back onto your answer
      if (mineIdx != null && aidx === mineIdx) aidx = (aidx + 1 + Math.floor(H('shift' + q.id) * (n - 1))) % n;
    }
    const typ = gd ? gd[aidx] / 100 : 0.3 + H('typ' + q.id) * 0.5;
    const maj = gd ? majIdx === aidx : H('m2' + q.id) < 0.6;
    const prompt = q.prompt.replace(/[.\s]+$/, '');
    const path = D.categoryPath(q);
    const meta = D.catMeta(path[0]);
    if (!topSeen.has(meta.catId)) topSeen.set(meta.catId, { id: meta.catId, label: path[0], hue: meta.hue });
    bump(meta.catId);
    let parent = meta.catId;
    if (path[1]) {
      const key = meta.catId + '|' + path[1];
      let sub = subSeen.get(key);
      if (!sub) { sub = { id: 'pmsub-' + pmmSlug(meta.catId + '-' + path[1]), parentId: meta.catId, label: path[1], sub: true }; subSeen.set(key, sub); nodes.push(sub); }
      parent = sub.id;
    }
    nodes.push({
      id: 'pmq-' + q.id, parentId: parent, daily: true, qid: q.id,
      label: ansText(q, aidx), tag: q.tag || prompt, ans: ansText(q, aidx), prompt, typ, maj,
      mine: mineIdx != null ? ansText(q, mineIdx) : null,
      same: mineIdx != null ? aidx === mineIdx : null,
    });
  });

  // real signals — their craft and their declared interests
  if (p.role) { nodes.push({ id: 'pm-role', parentId: 'craft', label: pmmCap(p.role), note: 'their craft', real: true }); bump('craft'); }
  (p.interests || []).slice(0, 5).forEach((it, k) => { nodes.push({ id: 'pm-int' + k, parentId: 'interests', label: pmmCap(typeof it === 'string' ? it : it.t), real: true }); bump('interests'); });

  // light texture where the questions haven't reached
  const rng = pmmRng('pmm|' + seed);
  seedCats.forEach((c) => {
    const pool = (PMM_POOLS[c.id] || []).slice();
    if (!pool.length) return;
    const have = counts[c.id] || 0;
    const want = Math.max(0, 2 - have + (rng() < 0.35 ? 1 : 0));
    for (let k = 0; k < want && pool.length; k++) {
      const [label, note] = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      nodes.push({ id: 'pmf-' + c.id + k, parentId: c.id, label, note });
      bump(c.id);
    }
  });

  // branches with anything in them — seed cats first, then emergent topics
  const catsAll = seedCats.concat([...topSeen.values()].filter((t) => !seedCats.some((c) => c.id === t.id)));
  const CATS = catsAll.filter((c) => counts[c.id] > 0);

  // some of what the app inferred stays hidden until you're friends
  const rng2 = pmmRng('lock|' + seed);
  nodes.forEach((n) => { n.locked = !n.real && !n.sub && rng2() < 0.42; });
  return { CATS, nodes, seed, counts };
}

// ── the component ────────────────────────────────────────────────────────────
function PersonMindMap({ p, following, centerName }) {
  const { CATS, nodes, seed, counts } = useMemo(() => pmmBuild(p), [p && p.id, following]);
  const byParent = useMemo(() => {
    const m = {};
    nodes.forEach((n) => { (m[n.parentId] = m[n.parentId] || []).push(n); });
    return m;
  }, [nodes]);
  const byId = useMemo(() => {
    const m = {};
    nodes.forEach((n) => { m[n.id] = n; });
    return m;
  }, [nodes]);
  // same cluster engine as the You map (sub-topic spirals, typicality drift)
  const laid = useMemo(() => {
    if (window.MapTabLayout) return window.MapTabLayout.mtClusterLayout(nodes, CATS);
    return { pos: { root: { x: 0, y: 0 } }, fields: [] };
  }, [CATS, nodes]);
  const pos = laid.pos;
  const topOf = (n) => { let c = n; while (c && c.parentId && CATS.every((x) => x.id !== c.parentId)) c = byId[c.parentId]; return c ? c.parentId : n.parentId; };
  const catOf = (n) => CATS.find((c) => c.id === topOf(n));
  const hidden = (n) => n.locked && !following;
  const lockedN = nodes.filter(hidden).length;
  // everything under a branch (subs + their answers)
  const underCat = (cid) => {
    const out = [];
    (byParent[cid] || []).forEach((n) => { out.push(n); (byParent[n.id] || []).forEach((k) => out.push(k)); });
    return out;
  };

  const [sel, setSel] = useState(null);      // node id | cat id | null
  const [hlCat, setHlCat] = useState(null);

  // ---- view: pan / pinch / wheel / taps ----
  const ref = useRef(null);
  const [view, setView] = useState(null);
  const viewRef = useRef(null);
  viewRef.current = view;
  const posRef = useRef(pos);
  posRef.current = pos;
  const drag = useRef(null);
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const fitZRef = useRef(null);
  const lastTap = useRef(null);   // double-tap detection
  const tapTimer = useRef(null);  // delayed single-tap (waits out a double)
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  const fitAllTarget = () => {
    const el = ref.current;
    if (!el) return null;
    const w = el.clientWidth, h = el.clientHeight;
    if (w < 10 || h < 10) return null;
    let x0 = -140, y0 = -140, x1 = 140, y1 = 140;
    for (const k in pos) {
      const pt = pos[k];
      x0 = Math.min(x0, pt.x); y0 = Math.min(y0, pt.y);
      x1 = Math.max(x1, pt.x); y1 = Math.max(y1, pt.y);
    }
    x0 -= 110; x1 += 110; y0 -= 95; y1 += 95;
    const z = Math.min(0.62, w / (x1 - x0), h / (y1 - y0));
    fitZRef.current = z;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: w / 2 - cx * z, y: h / 2 - cy * z, z };
  };

  // first fit — retry until the pane is measurable
  useEffect(() => {
    if (view) return;
    let cancelled = false;
    const tryFit = () => {
      if (cancelled) return;
      const t = fitAllTarget();
      if (t) setView(t);
      else setTimeout(tryFit, 120);
    };
    tryFit();
    return () => { cancelled = true; };
  }, [pos, view]);

  const tweenTo = (target) => {
    cancelAnimationFrame(animRef.current);
    clearTimeout(timerRef.current);
    const from = viewRef.current;
    if (!from) return;
    // hidden documents suspend rAF — apply the target instantly and be done
    if (document.hidden) { setView(target); return; }
    const t0 = performance.now(), dur = 480;
    let done = false;
    const step = () => {
      if (done) return;
      cancelAnimationFrame(animRef.current);
      clearTimeout(timerRef.current);
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setView({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        z: from.z + (target.z - from.z) * e,
      });
      if (k < 1) {
        // race rAF against a timer so a mid-tween tab-hide can't strand the view
        animRef.current = requestAnimationFrame(step);
        timerRef.current = setTimeout(step, 32);
      } else {
        done = true;
      }
    };
    step();
  };

  const fitTo = (ids, maxZ) => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight * 0.6; // bottom card cover
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
    ids.forEach((id) => {
      const pt = pos[id];
      if (!pt) return;
      any = true;
      x0 = Math.min(x0, pt.x); y0 = Math.min(y0, pt.y);
      x1 = Math.max(x1, pt.x); y1 = Math.max(y1, pt.y);
    });
    if (!any) return;
    x0 -= 130; x1 += 130; y0 -= 110; y1 += 110;
    const z = Math.min(maxZ || 0.8, w / (x1 - x0), h / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    tweenTo({ x: w / 2 - cx * z, y: h / 2 - cy * z, z });
  };

  // ---- pan / zoom limits — the map can't be lost off-screen ----
  const contentBounds = () => {
    const P = posRef.current;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k in P) {
      const pt = P[k];
      if (!pt) continue;
      if (pt.x < x0) x0 = pt.x; if (pt.y < y0) y0 = pt.y;
      if (pt.x > x1) x1 = pt.x; if (pt.y > y1) y1 = pt.y;
    }
    return isFinite(x0) ? { x0, y0, x1, y1 } : null;
  };

  const clampView = (v) => {
    const el = ref.current, P = posRef.current;
    if (!el || !v || !P) return v;
    const W = el.clientWidth, H = el.clientHeight;
    const wcx = (W / 2 - v.x) / v.z, wcy = (H / 2 - v.y) / v.z;
    let best = Infinity, bx = 0, by = 0;
    for (const k in P) {
      const pt = P[k];
      if (!pt) continue;
      const d = (pt.x - wcx) * (pt.x - wcx) + (pt.y - wcy) * (pt.y - wcy);
      if (d < best) { best = d; bx = pt.x; by = pt.y; }
    }
    if (!isFinite(best)) return v;
    best = Math.sqrt(best);
    const reach = (Math.min(W, H) / v.z) * 0.42;
    if (best <= reach) return v;
    const t = (best - reach) / best;
    const cx = wcx + (bx - wcx) * t, cy = wcy + (by - wcy) * t;
    return { ...v, x: W / 2 - cx * v.z, y: H / 2 - cy * v.z };
  };

  const zoomFloor = () => {
    const el = ref.current;
    const b = contentBounds();
    if (!el || !b) return 0.1;
    const fit = Math.min(el.clientWidth / ((b.x1 - b.x0) + 260), el.clientHeight / ((b.y1 - b.y0) + 260));
    return Math.max(0.1, fit * 0.62);
  };

  const zoomAt = (cx, cy, factor) => {
    cancelAnimationFrame(animRef.current);
    const minZ = zoomFloor();
    setView((v) => {
      if (!v) return v;
      const z = Math.min(1.5, Math.max(minZ, v.z * factor));
      const k = z / v.z;
      return clampView({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z });
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const canvasXY = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e) => {
    if (!view || e.target.closest('.mmt-node')) return;
    cancelAnimationFrame(animRef.current);
    ptrs.current.set(e.pointerId, canvasXY(e));
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ptrs.current.size === 2) {
      const [p1, p2] = [...ptrs.current.values()];
      pinch.current = {
        d0: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        c0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        v0: { ...view },
        t0: performance.now(), maxDelta: 0,
      };
      drag.current = null;
    } else {
      drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
  };
  const onPointerMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) {
      if (!drag.current) return;
    } else {
      ptrs.current.set(e.pointerId, canvasXY(e));
    }
    if (pinch.current && ptrs.current.size === 2) {
      const [p1, p2] = [...ptrs.current.values()];
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const { d0, c0, v0 } = pinch.current;
      pinch.current.maxDelta = Math.max(pinch.current.maxDelta || 0, Math.abs(d / d0 - 1));
      const z = Math.min(1.5, Math.max(zoomFloor(), v0.z * (d / d0)));
      const w = { x: (c0.x - v0.x) / v0.z, y: (c0.y - v0.y) / v0.z };
      setView(clampView({ x: mid.x - w.x * z, y: mid.y - w.y * z, z }));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) setView((v) => clampView({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };

  // animated zoom step around a canvas point (double-tap / two-finger tap)
  const stepZoom = (cx, cy, factor) => {
    const v = viewRef.current;
    if (!v) return;
    const z = Math.min(1.5, Math.max(zoomFloor(), v.z * factor));
    const k = z / v.z;
    tweenTo(clampView({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z }));
  };

  const onPointerUp = (e) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2 && pinch.current) {
      const pn = pinch.current;
      pinch.current = null;
      // two-finger tap — quick, no real pinch → step the zoom out
      if (performance.now() - pn.t0 < 300 && (pn.maxDelta || 0) < 0.06) stepZoom(pn.c0.x, pn.c0.y, 0.55);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // a plain tap on the canvas — double-tap zooms in, single tap steps back
    const pt = canvasXY(e);
    const now = performance.now();
    const lt = lastTap.current;
    if (lt && now - lt.t < 280 && Math.hypot(pt.x - lt.x, pt.y - lt.y) < 40) {
      clearTimeout(tapTimer.current);
      lastTap.current = null;
      stepZoom(pt.x, pt.y, 2.0);
      return;
    }
    lastTap.current = { t: now, x: pt.x, y: pt.y };
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(stepBack, 300);
  };

  // ---- selection ----
  const clearSel = () => {
    const had = sel || hlCat;
    setSel(null); setHlCat(null);
    if (had) { const t = fitAllTarget(); if (t) tweenTo(t); }
  };
  const selectCat = (id) => {
    setSel(id); setHlCat(id);
    const ids = [id].concat(underCat(id).map((n) => n.id));
    fitTo(ids, 0.72);
  };
  const selectNode = (n) => {
    setSel(n.id);
    setHlCat(topOf(n));
    if (n.sub) fitTo([n.id].concat((byParent[n.id] || []).map((k) => k.id)), 0.75);
    else fitTo([n.id, n.parentId], 0.7);
  };

  // semantic back — one level out per tap: detail → its branch → whole map
  const stepBack = () => {
    const cur = sel && byId[sel];
    if (cur) { selectCat(topOf(cur)); return; }
    if (sel || hlCat) { clearSel(); return; }
    // nothing selected but zoomed in — settle back to the full map
    const v = viewRef.current;
    if (v && v.z > (fitZRef.current || 0.2) * 1.25) {
      const t = fitAllTarget();
      if (t) tweenTo(t);
    }
  };

  if (!view) {
    return (
      <div className="mmt-root">
        <div className="mmt-canvas is-dots" ref={ref}></div>
      </div>
    );
  }

  const catScale = Math.max(1, Math.min(2.8, 0.78 / view.z));
  const itemScale = Math.max(1, Math.min(2.4, 0.85 / view.z));
  const centerScale = Math.max(1, Math.min(2.0, 0.5 / view.z));
  // labels counter-scale so on-screen type never drops below reading size
  const hubFs = Math.min(48, Math.max(13, 13 / (catScale * view.z)));
  const dotFs = Math.min(30, Math.max(10.5, 12 / (itemScale * view.z)));

  const selCat = CATS.find((c) => c.id === sel);
  const selNode = sel && !selCat ? byId[sel] : null;
  const selNodeCat = selNode ? catOf(selNode) : null;
  const cardHue = selCat ? selCat.hue : selNodeCat ? selNodeCat.hue : 282;
  const activeCat = hlCat || (selCat ? selCat.id : selNode ? topOf(selNode) : null);
  const atHome = !activeCat && !sel;
  const inHl = (n) => !hlCat || topOf(n) === hlCat;

  // label collision pass — greedy keep, in screen space. Hub labels are
  // seeded first so nothing ever buries a branch name; the selection wins,
  // then sub-topic names, then rare takes.
  const labKeep = (() => {
    const z = view.z;
    const kept = [];
    CATS.forEach((c) => {
      const pt = pos[c.id];
      if (!pt) return;
      const w = 18 + String(c.label).length * 8;
      const sx = pt.x * z + view.x;
      kept.push({ x0: sx - w / 2, x1: sx + w / 2, y: pt.y * z + 16 });
    });
    const cands = [];
    nodes.forEach((n) => {
      const pt = pos[n.id];
      if (!pt || hidden(n)) return;
      const zThr = n.sub ? PMM_ZLAB * 0.6 : PMM_ZLAB;
      if (!(z >= zThr || sel === n.id || hlCat === topOf(n))) return;
      const txt = String(n.tag || n.label);
      const w = (n.sub ? 14 : 20) + txt.length * (n.sub ? 6 : 6.8);
      // the label is side-anchored: it hangs left or right of the dot
      const sx = pt.x * z + view.x;
      const labL = sx > (ref.current ? ref.current.clientWidth : 480) / 2;
      const x0 = labL ? sx - 8 - w : sx + 8;
      const pri = sel === n.id ? -1e6 : n.sub ? -1e5 : n.real ? -200 + pmmHash(seed + n.id) : (n.daily && !n.maj ? -100 : 0) + pmmHash(seed + n.id);
      cands.push({ id: n.id, x0, x1: x0 + w, y: pt.y * z, pri });
    });
    cands.sort((a, b) => a.pri - b.pri);
    const keep = new Set();
    cands.forEach((c) => {
      const ok = kept.every((k) => Math.abs(c.y - k.y) > 18 || c.x0 > k.x1 + 6 || c.x1 < k.x0 - 6);
      if (ok) { keep.add(c.id); kept.push(c); }
    });
    return keep;
  })();

  // centre drifted off-screen — an edge pill points the way back
  let recenter = null;
  if (ref.current) {
    const W = ref.current.clientWidth, H = ref.current.clientHeight;
    const cx = view.x, cy = view.y;
    if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) {
      const px = Math.min(Math.max(cx, 70), W - 70);
      const py = Math.min(Math.max(cy, 76), sel ? H * 0.38 : H - 96);
      recenter = { x: px, y: py, deg: (Math.atan2(cy - py, cx - px) * 180) / Math.PI };
    }
  }

  const Chips = window.MTBranchChips;
  const maxCt = Math.max(1, ...CATS.map((c) => counts[c.id] || 0));
  // small same/different chip for the answer card
  const sameChip = (n) => n.mine == null ? null : (
    <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)' }}>
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: 'var(--surface)', background: 'var(--ink)' }}>you · {n.mine}</span>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: n.same ? 'var(--c-likeness)' : 'var(--ochre)' }}>{n.same ? 'same answer' : 'you differ'}</span>
    </div>
  );

  return (
    <div className="mmt-root" data-screen-label="their-map">
      <div
        className="mmt-canvas is-dots"
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mmt-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          <div className="mmt-ground" aria-hidden="true"></div>
          {laid.fields.map((f) => {
            const cat = CATS.find((c) => c.id === f.id);
            if (!cat) return null;
            const sz = (f.r + 70) * 2;
            const fop = hlCat && hlCat !== f.id ? 0.12 : 0.5 + 0.5 * ((counts[f.id] || 0) / maxCt);
            return (
              <div key={f.id} className="mmt-field" aria-hidden="true"
                style={{ '--hue': cat.hue, width: sz, height: sz, opacity: fop, transform: `translate(${f.x}px, ${f.y}px) translate(-50%, -50%)` }}></div>
            );
          })}
          <svg className="mmt-edges" viewBox="-1800 -1800 3600 3600" style={{ left: -1800, top: -1800, width: 3600, height: 3600 }}>
            {nodes.map((n) => {
              if (!pos[n.id] || !pos[n.parentId] || hidden(n)) return null;
              const cat = catOf(n);
              let op = n.sub ? 0.85 : 0.75;
              if (!inHl(n)) op = 0.1;
              return (
                <path
                  key={n.id}
                  className="mmt-limb"
                  style={{ '--hue': cat ? cat.hue : 250 }}
                  d={`M ${pos[n.parentId].x} ${pos[n.parentId].y} L ${pos[n.id].x} ${pos[n.id].y}`}
                  fill="none"
                  opacity={op}
                  strokeWidth={n.sub ? 2.2 : 1.4}
                  strokeLinecap="round"
                ></path>
              );
            })}
          </svg>

          {/* centre — them */}
          <div
            className="mmt-node mmt-center"
            style={{ transform: `translate(0px, 0px) translate(-50%, -50%) scale(${centerScale})` }}
            onClick={(e) => { e.stopPropagation(); clearSel(); }}
          >
            <div className="mmt-halo" aria-hidden="true"></div>
            <div className="mmt-center-disc">
              <span className="mmt-center-name">{centerName || 'Them'}</span>
              <span className="mmt-center-sub">their map</span>
            </div>
          </div>

          {/* branch hubs */}
          {CATS.map((c) => {
            const pt = pos[c.id];
            if (!pt) return null;
            const hubSz = 13 + Math.min(counts[c.id] || 0, 10) * 1.6;
            const dim = hlCat && hlCat !== c.id;
            return (
              <div
                key={c.id}
                className={'mmt-node mmt-hub' + (sel === c.id ? ' is-sel' : '') + (dim ? ' is-dim' : '')}
                data-screen-label={c.label}
                style={{ '--hue': c.hue, transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%) scale(${catScale})` }}
                onClick={(e) => { e.stopPropagation(); sel === c.id ? clearSel() : selectCat(c.id); }}
              >
                <span className="mmt-hub-dot" style={{ width: hubSz, height: hubSz }}></span>
                <span className="mmt-hub-label" style={{ fontSize: hubFs }}>{c.label}</span>
              </div>
            );
          })}

          {/* sub-topics and answers */}
          {nodes.map((n) => {
            const pt = pos[n.id];
            if (!pt) return null;
            const cat = catOf(n);
            const isHid = hidden(n);
            const sz = n.sub ? 9 : n.daily ? 12.5 : 11 + pmmHash(seed + n.id) * 3;
            const showLab = labKeep.has(n.id);
            const labL = (pt.x * view.z + view.x) > (ref.current ? ref.current.clientWidth : 480) / 2;
            const dim = !inHl(n);
            return (
              <div
                key={n.id}
                className={'mmt-node mmt-dotnode' + (n.sub ? ' is-leaf' : '') + (sel === n.id ? ' is-sel' : '') + (showLab ? ' is-showlab' : '') + (dim ? ' is-dim' : '') + (labL ? ' is-labL' : '') + (n.daily && !n.maj ? ' is-rare' : '')}
                style={{
                  '--hue': cat ? cat.hue : 250,
                  width: sz, height: sz,
                  opacity: isHid ? 0.22 : undefined,
                  pointerEvents: isHid ? 'none' : undefined,
                  transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%) scale(${itemScale})`,
                }}
                title={isHid ? undefined : n.label}
                onClick={(e) => { e.stopPropagation(); selectNode(n); }}
              >
                <span className="mmt-ddot"></span>
                <span className="mmt-dlab" style={{ fontSize: n.sub ? dotFs * 0.9 : dotFs }}>{n.tag || n.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* floating chrome — same rail as the Map tab */}
      {Chips ? (
        <Chips
          cats={CATS}
          activeCat={activeCat}
          atHome={atHome}
          onPick={(id) => { if (activeCat === id) { clearSel(); } else { selectCat(id); } }}
          onHome={clearSel}
        ></Chips>
      ) : null}
      {lockedN > 0 && !sel ? (
        <div className="mmt-hint mmt-ui">{lockedN} details hidden · friends see everything</div>
      ) : null}
      <div className="mmt-zoomctl mmt-ui">
        {/* pinch / double-tap / wheel handle zoom — only "fit" needs a button */}
        <button className="fitb" onClick={() => { const t = fitAllTarget(); if (t) tweenTo(t); }} aria-label="Fit map">⌖</button>
      </div>
      {recenter ? (
        <button
          className="mmt-recenter mmt-ui"
          style={{ left: recenter.x, top: recenter.y }}
          onClick={() => { const t = fitAllTarget(); if (t) tweenTo(t); }}
          aria-label="Back to the whole map"
        >
          <span>{centerName || 'Them'}</span>
          <span className="mmt-recenter-arrow" style={{ transform: `rotate(${recenter.deg}deg)` }} aria-hidden="true">→</span>
        </button>
      ) : null}

      {/* read-only detail card */}
      {selCat ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          <div className="mmt-kicker">{selCat.label} · their map</div>
          <div className="mmt-chiprow" style={{ marginTop: 8 }}>
            {underCat(selCat.id).filter((n) => !n.sub && !hidden(n)).map((n) => (
              <button key={n.id} className="mmt-mini" onClick={() => selectNode(n)}>
                <span className="mmt-dot"></span>{n.tag || n.label}
              </button>
            ))}
          </div>
          {underCat(selCat.id).some(hidden) ? (
            <div className="mmt-meta">{underCat(selCat.id).filter(hidden).length} more once you're friends</div>
          ) : null}
        </div>
      ) : selNode && selNode.sub ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          <div className="mmt-kicker">{selNodeCat ? selNodeCat.label : ''} · {selNode.label}</div>
          <div className="mmt-chiprow" style={{ marginTop: 8 }}>
            {(byParent[selNode.id] || []).filter((n) => !hidden(n)).map((n) => (
              <button key={n.id} className="mmt-mini" onClick={() => selectNode(n)}>
                <span className="mmt-dot"></span>{n.tag || n.label}
              </button>
            ))}
          </div>
          {(byParent[selNode.id] || []).some(hidden) ? (
            <div className="mmt-meta">{(byParent[selNode.id] || []).filter(hidden).length} more once you're friends</div>
          ) : null}
        </div>
      ) : selNode ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          <div className="mmt-kicker">{selNodeCat ? selNodeCat.label : ''} · their map</div>
          <div className="mmt-title mmt-title-serif">{selNode.label}</div>
          {selNode.daily && selNode.prompt ? <div className="mmt-note">{selNode.prompt}</div> : selNode.note ? <div className="mmt-note">{selNode.note}</div> : null}
          {selNode.daily && !selNode.maj ? <div className="mmt-meta">a rare take</div> : null}
          {selNode.daily ? sameChip(selNode) : null}
        </div>
      ) : null}
    </div>
  );
}

window.PersonMindMap = PersonMindMap;

})();
