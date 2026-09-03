// Ported from design/spec-modules/person-mindmap.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { DAILYQ } from './daily-questions.js';
// MTSwipeRow arrives as an import, not the v28 patch's window.MTSwipeRow: a
// new cross-module global read would raise check:globals' rule-4 ratchet,
// and the checker's remedy is the ESM import (D39, "convert on touch").
import { MTSwipeRow } from './map-bottom-card.jsx';
// The other three map-family reads converted when the Map went lazy (v28
// §5): this overlay used to lean on spec-index's eager list having
// evaluated them, and once that list stopped carrying the family the
// window reads here were one unvisited Mirror away from a ReferenceError.
// The imports are the guarantee the load order used to be — and they pull
// nothing extra: rollup shares these modules between the map chunk and
// this overlay chunk, both past first paint.
import { MapTabLayout } from './map-layout.js';
import { MAP_GROUPS } from './map-groups.js';
import { MTBranchChips } from './map-chiprow.jsx';
import { MapStats } from './map-group-stats.js';
import { MapLens } from './map-branches.js';

// InSight — PersonMindMap: a read-only map of someone else's answers, grown
// from the SAME daily-question pool as your own map: same branches, same
// sub-topics, same cluster layout engine, same territory fields — so their map
// reads exactly like yours. Their answers are deterministic per person and
// lean toward yours in proportion to your affinity; tapping an answer shows
// how it compares to what YOU said. Some details stay hidden until you're
// friends. (styles.css, MapLens hues, MapTabLayout clusters)
// `PersonMindMap` is exported by name (D39, "convert on touch") — the person
// overlay renders it twice, as a still and full-screen, and imports it. The
// rest of this module still publishes through the window bag, so the export
// is hoisted out of the IIFE rather than the IIFE unwound.
let PersonMindMapImpl;
(function () {
const { useState, useRef, useEffect, useMemo } = React;

// Bare read — the `(window.X && …) || 0.5` fallback was a load-order
// guard, and an imported binding cannot be unset (D108's rule).
const PMM_ZLAB = MapTabLayout.MT_ZLAB;
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
  const D = DAILYQ;
  const seedCats = MapLens.CATS.slice();
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
    // `q.liveId`, not `q.id` — the same two-id-space trap map-tab.jsx
    // carried until 2026-09-02, in the file that found the LAST class of
    // this kind. MapStats reads LIVE.aggFor in a live build, which is
    // keyed by the seeded bank id; `q.id` is daily-questions.js's own demo
    // calendar id, and the two spaces are disjoint. Passing the wrong one
    // returns null for every question, so `typ` and `maj` both fell back
    // to the deterministic hash and this map placed nobody by any real
    // agreement. Falls back on a demo build, where the demo id is the only
    // id there is. (MapStats is the imported binding since D354's sweep.)
    const qid = q.liveId || q.id;
    const gd = MapStats.dist(qid, 'all', n, mineIdx);
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
      id: 'pmq-' + q.id, parentId: parent, daily: true, qid,
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
// `still` renders the map as a portrait, not a workspace: no pan/zoom/taps, no
// chrome, no answer labels, fit whole with generous air so nothing clips — and
// every answer dot carries the ONE thing a profile is for: solid where the two
// of you said the same, hollow where you diverged, faint where there's nothing
// to compare. Tapping the still opens this same map full-screen and live.
function PersonMindMap({ p, following, centerName, still }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  const built = useMemo(() => pmmBuild(p), [p && p.id, following]);
  const allCats = built.CATS, nodes0 = built.nodes, seed = built.seed, counts = built.counts;
  // Same ladder as your own map: them → group → branch → sub → answer. At the
  // top level the hubs are the over-categories and the answers stay as
  // unlabelled mass inside them; drilling into one opens its branches.
  const GRP = MAP_GROUPS;
  const [openGroup, setOpenGroup] = useState(null);
  const topOfId = useMemo(() => {
    const parent = {};
    allCats.forEach((c) => { parent[c.id] = 'root'; });
    nodes0.forEach((n) => { parent[n.id] = n.parentId; });
    const m = {};
    nodes0.forEach((n) => {
      let cur = n.id, guard = 0;
      while (parent[cur] && parent[cur] !== 'root' && guard++ < 8) cur = parent[cur];
      m[n.id] = cur;
    });
    return m;
  }, [nodes0, allCats]);
  const groups = useMemo(() => {
    const ct = {};
    allCats.forEach((c) => { const g = GRP.of(c.id); ct[g] = (ct[g] || 0) + (counts[c.id] || 0); });
    return GRP.all().filter((g) => ct[g.id] > 0).map((g) => ({ ...g, ct: ct[g.id] }));
  }, [GRP, allCats, counts]);
  // the `!!GRP` / `GRP &&` arms that stood in the next two lines were
  // load-order guards on the old window read — dead now (D108)
  const grouped = groups.length > 1 && !openGroup;
  const openGroupDef = openGroup ? GRP.get(openGroup) : null;
  const CATS = grouped ? groups : (openGroup ? allCats.filter((c) => GRP.of(c.id) === openGroup) : allCats);
  const nodes = useMemo(() => {
    if (openGroup) return nodes0.filter((n) => GRP.of(topOfId[n.id]) === openGroup);
    if (!grouped) return nodes0;
    return nodes0.filter((n) => !n.sub).map((n) => {
      const gid = GRP.of(topOfId[n.id]);
      return { ...n, parentId: gid, gid, sub: false, quiet: true };
    });
  }, [nodes0, topOfId, grouped, openGroup, GRP]);
  const catCount = (id) => (grouped ? ((groups.find((g) => g.id === id) || {}).ct || 0) : (counts[id] || 0));
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
  // the ring-320 load-order fallback that stood here left with the
  // conversion — the import cannot miss (D108)
  const laid = useMemo(() => MapTabLayout.mtClusterLayout(nodes, CATS), [CATS, nodes]);
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
    let x0 = -220, y0 = -220, x1 = 220, y1 = 220;
    if (still) { x0 = y0 = Infinity; x1 = y1 = -Infinity; }   // no empty seed frame to pad out
    for (const k in pos) {
      const pt = pos[k];
      x0 = Math.min(x0, pt.x); y0 = Math.min(y0, pt.y);
      x1 = Math.max(x1, pt.x); y1 = Math.max(y1, pt.y);
    }
    if (!isFinite(x0)) return null;
    // a still hides every answer label, so it only needs air for the handful of
    // branch names — the label-clearance padding the live map wants would shrink
    // the whole constellation past the point where a hollow dot reads as hollow
    const padX = still ? 60 : 130, padY = still ? 54 : 110;
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    const z = Math.min(still ? 1 : 0.8, w / (x1 - x0), h / (y1 - y0));
    fitZRef.current = z;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: w / 2 - cx * z, y: h / 2 - cy * z, z };
  };

  // first fit — retry until the pane is measurable (capped, so a pane that
  // never lays out can't leave a timer bouncing for the life of the session)
  useEffect(() => {
    if (view) return;
    let cancelled = false, tries = 0;
    const tryFit = () => {
      if (cancelled) return;
      const t = fitAllTarget();
      if (t) setView(t);
      else if (++tries < 60) setTimeout(tryFit, 120);
    };
    tryFit();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
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

  // drilling in or out rebuilds the constellation — re-frame it
  const lvlRef = useRef(openGroup);
  useEffect(() => {
    if (lvlRef.current === openGroup) return;
    lvlRef.current = openGroup;
    if (!view) return;
    const t = fitAllTarget();
    if (t) tweenTo(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [openGroup, pos]);

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
    if (!el || still) return;
    const handler = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
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
    // at the top level a hub is a door, not a card
    if (grouped) { setSel(null); setHlCat(null); setOpenGroup(id); return; }
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
    if (openGroup) { setOpenGroup(null); return; }
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

  const catScale = Math.max(1, Math.min(3.2, 0.78 / view.z));
  const itemScale = Math.max(1, Math.min(2.8, 0.85 / view.z));
  const centerScale = Math.max(1, Math.min(2.2, 0.5 / view.z));
  // labels counter-scale so on-screen type never drops below reading size
  const hubFs = Math.min(48, Math.max(13, 13 / (catScale * view.z)));
  const centerFs = Math.min(48, Math.max(13.5, 13.5 / (centerScale * view.z)));
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
      kept.push({ x0: sx - 22, x1: sx + 22, y: pt.y * z });   // the hub dot itself is keep-out
    });
    const cands = [];
    // A still shows branch names only — return the EMPTY set, not `keep`:
    // `keep` is declared with `const` sixteen lines down, so reading it here
    // is a temporal-dead-zone ReferenceError and every measured still render
    // crashed to the overlay's boundary. No jsdom test can reach this line —
    // the pre-measure `if (!view)` return above is where a zero-size
    // container parks forever — which is why the crash shipped silently
    // (2026-08-26 standalone carries the same fix; the regression test
    // measures the container by hand).
    if (still) return new Set();
    nodes.forEach((n) => {
      const pt = pos[n.id];
      if (!pt || hidden(n) || n.quiet) return;   // group level: mass without labels
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

  const Chips = MTBranchChips;
  const maxCt = Math.max(1, ...CATS.map((c) => catCount(c.id)));
  // small same/different chip for the answer card
  const sameChip = (n) => n.mine == null ? null : (
    <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)' }}>
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: 'var(--surface)', background: 'var(--ink)' }}>you · {n.mine}</span>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: n.same ? 'var(--c-likeness)' : 'var(--ochre)' }}>{n.same ? 'same answer' : 'you differ'}</span>
    </div>
  );

  return (
    <div className={'mmt-root' + (openGroup ? ' is-ingroup' : '') + (still ? ' is-still' : '')} data-screen-label="their-map">
      <div
        className="mmt-canvas is-dots"
        ref={ref}
        onPointerDown={still ? undefined : onPointerDown}
        onPointerMove={still ? undefined : onPointerMove}
        onPointerUp={still ? undefined : onPointerUp}
        onPointerCancel={still ? undefined : onPointerUp}
      >
        <div className="mmt-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          {/* the boundary's radius — see map-tab.jsx. A stranger with three
              answers is the small-map case at its worst, and this map opens on
              exactly that; `is-still` only hides the line in the portrait. */}
          <div className="mmt-ground" style={{ '--ring': laid.ring + 'px' }} aria-hidden="true"></div>
          {laid.fields.map((f) => {
            const cat = CATS.find((c) => c.id === f.id);
            if (!cat) return null;
            const sz = (f.r + 70) * 2;
            const fop = hlCat && hlCat !== f.id ? 0.12 : 0.5 + 0.5 * (catCount(f.id) / maxCt);
            return (
              <div key={f.id} className="mmt-field" aria-hidden="true"
                style={{ '--hue': cat.hue, width: sz, height: sz, opacity: fop, transform: `translate(${f.x}px, ${f.y}px) translate(-50%, -50%)` }}></div>
            );
          })}
          <svg className="mmt-edges" viewBox="-1800 -1800 3600 3600" style={{ left: -1800, top: -1800, width: 3600, height: 3600 }}>
            {/* spokes: them → each branch hub — the same gravity lines the You map
                draws, so the branches read as one system instead of islands */}
            {CATS.map((c) => {
              if (!pos[c.id] || !pos.root) return null;
              const dim = hlCat && hlCat !== c.id;
              return (
                <path key={'sp' + c.id} className="mmt-limb mmt-spoke" style={{ '--hue': c.hue }}
                  d={`M ${pos.root.x} ${pos.root.y} L ${pos[c.id].x} ${pos[c.id].y}`}
                  fill="none" opacity={dim ? 0.07 : 0.5} strokeWidth={1.6} strokeLinecap="round"></path>
              );
            })}
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
          <button
            type="button"
            className={'mmt-node mmt-center is-solo' + (openGroupDef ? ' is-group' : '')}
            style={{ '--hue': openGroupDef ? openGroupDef.hue : undefined, transform: `translate(0px, 0px) translate(-50%, -50%) scale(${centerScale})` }}
            aria-label={openGroup ? 'Leave the group view' : `${centerName || 'Them'} — their map, clear the selection`}
            onClick={(e) => { e.stopPropagation(); if (openGroup) { setSel(null); setHlCat(null); setOpenGroup(null); return; } clearSel(); }}
          >
            <div className="mmt-halo" aria-hidden="true"></div>
            <div className="mmt-center-disc">
              {openGroupDef ? null : <span className="mmt-center-name">{String(centerName || 'Them').split(' ')[0]}</span>}
            </div>
            {openGroupDef ? <span className="mmt-center-glabel" style={{ fontSize: centerFs }}>{openGroupDef.label}</span> : null}
          </button>

          {/* branch hubs */}
          {CATS.map((c) => {
            const pt = pos[c.id];
            if (!pt) return null;
            const hubSz = 13 + Math.min(catCount(c.id), 12) * 1.5;
            const dim = hlCat && hlCat !== c.id;
            return (
              <button
                type="button"
                key={c.id}
                className={'mmt-node mmt-hub' + (sel === c.id ? ' is-sel' : '') + (dim ? ' is-dim' : '')}
                data-screen-label={c.label}
                style={{ '--hue': c.hue, transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%) scale(${catScale})` }}
                // .is-dim is pointer-events:none — see map-tab.jsx.
                tabIndex={dim ? -1 : undefined}
                aria-hidden={dim || undefined}
                aria-pressed={sel === c.id}
                aria-label={c.label}
                onClick={(e) => { e.stopPropagation(); sel === c.id && !grouped ? clearSel() : selectCat(c.id); }}
              >
                <span className="mmt-hub-dot" style={{ width: hubSz, height: hubSz }}></span>
                <span className="mmt-hub-label" style={{ fontSize: hubFs }}>{c.label}</span>
              </button>
            );
          })}

          {/* sub-topics and answers */}
          {nodes.map((n) => {
            const pt = pos[n.id];
            if (!pt) return null;
            const cat = catOf(n);
            const isHid = hidden(n);
            const sz = n.sub ? 9 : n.daily ? (still ? 15 : 12.5) : 11 + pmmHash(seed + n.id) * 3;
            const showLab = !still && !n.quiet && labKeep.has(n.id);
            const labL = (pt.x * view.z + view.x) > (ref.current ? ref.current.clientWidth : 480) / 2;
            const dim = !inHl(n);
            return (
              <button
                type="button"
                key={n.id}
                className={'mmt-node mmt-dotnode' + (n.sub ? ' is-leaf' : '') + (sel === n.id ? ' is-sel' : '') + (showLab ? ' is-showlab' : '') + (dim ? ' is-dim' : '') + (labL ? ' is-labL' : '') + (!still && n.daily && !n.maj ? ' is-rare' : '') + (still && n.same === false ? ' is-differ' : '')}
                style={{
                  '--hue': cat ? cat.hue : 250,
                  width: sz, height: sz,
                  opacity: isHid ? 0.22 : (still && !n.sub && n.same == null ? 0.3 : undefined),
                  pointerEvents: isHid ? 'none' : undefined,
                  transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%) scale(${itemScale})`,
                }}
                title={isHid ? undefined : n.label}
                // Hidden and dimmed dots already opt out of pointer events;
                // keep them out of the tab order too, or the map traps a
                // keyboard user on targets they cannot see.
                tabIndex={isHid || dim ? -1 : undefined}
                aria-hidden={isHid || dim || undefined}
                aria-pressed={sel === n.id}
                aria-label={n.label}
                onClick={(e) => { e.stopPropagation(); if (isHid) return; if (n.quiet) { setSel(null); setHlCat(null); setOpenGroup(n.gid); } else selectNode(n); }}
              >
                <span className="mmt-ddot"></span>
                <span className="mmt-dlab" style={{ fontSize: n.sub ? dotFs * 0.9 : dotFs }}>{n.tag || n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* floating chrome — same rail as the Map tab. The `Chips &&` arm
          left with the conversion: an imported binding cannot be unset. */}
      {!still ? (
        <Chips
          cats={CATS}
          activeCat={activeCat}
          atHome={atHome}
          onPick={(id) => { if (grouped) { setSel(null); setHlCat(null); setOpenGroup(id); } else if (activeCat === id) { clearSel(); } else { selectCat(id); } }}
          onHome={() => { if (openGroup) { setSel(null); setHlCat(null); setOpenGroup(null); } else clearSel(); }}
        ></Chips>
      ) : null}
      {lockedN > 0 && !sel && !still ? (
        <div className="mmt-hint mmt-ui">{lockedN} details hidden · friends see everything</div>
      ) : null}
      <div className="mmt-zoomctl mmt-ui" style={still ? { display: 'none' } : undefined}>
        {/* pinch / double-tap / wheel handle zoom — only "fit" needs a button */}
        <button className="fitb" onClick={() => { const t = fitAllTarget(); if (t) tweenTo(t); }} aria-label="Fit map">⌖</button>
      </div>
      {recenter && !still ? (
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
      {still ? null : selCat ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          <div className="mmt-slim">
            <span className="mmt-dot"></span>
            <span className="mmt-slim-name">{selCat.label}</span>
            <span className="mmt-slim-ct">{underCat(selCat.id).filter((n) => !n.sub && !hidden(n)).length}</span>
          </div>
          <MTSwipeRow items={underCat(selCat.id).filter((n) => !n.sub && !hidden(n)).map((n) => ({ id: n.id, q: n.prompt || n.label, ans: n.ans || n.tag || n.label, hue: cardHue }))} onPick={(id) => selectNode(byId[id])}></MTSwipeRow>
          {underCat(selCat.id).some(hidden) ? (
            <div className="mmt-meta">{underCat(selCat.id).filter(hidden).length} more once you're friends</div>
          ) : null}
        </div>
      ) : selNode && selNode.sub ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          <div className="mmt-slim">
            <span className="mmt-dot"></span>
            <span className="mmt-slim-name">{selNode.label}</span>
            <span className="mmt-slim-ct">{(byParent[selNode.id] || []).filter((n) => !hidden(n)).length}</span>
          </div>
          <MTSwipeRow items={(byParent[selNode.id] || []).filter((n) => !hidden(n)).map((n) => ({ id: n.id, q: n.prompt || n.label, ans: n.ans || n.tag || n.label, hue: cardHue }))} onPick={(id) => selectNode(byId[id])}></MTSwipeRow>
          {(byParent[selNode.id] || []).some(hidden) ? (
            <div className="mmt-meta">{(byParent[selNode.id] || []).filter(hidden).length} more once you're friends</div>
          ) : null}
        </div>
      ) : selNode ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          <div className="mmt-kicker">{selNodeCat ? selNodeCat.label : ''} · their map</div>
          <div className="mmt-title">{selNode.label}</div>
          {selNode.daily && selNode.prompt ? <div className="mmt-note">{selNode.prompt}</div> : selNode.note ? <div className="mmt-note">{selNode.note}</div> : null}
          {selNode.daily && !selNode.maj ? <div className="mmt-meta">a rare take</div> : null}
          {selNode.daily ? sameChip(selNode) : null}
        </div>
      ) : null}
    </div>
  );
}

window.PersonMindMap = PersonMindMap;

  PersonMindMapImpl = PersonMindMap;
})();


// A live binding, not a wrapper component: the IIFE assigns it during module
// evaluation, so every consumer sees the real component rather than an extra
// render boundary around it.
export { PersonMindMapImpl as PersonMindMap };
