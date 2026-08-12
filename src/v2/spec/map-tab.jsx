// Ported from design/spec-modules/map-tab.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { DAILYQ } from './daily-questions.js';
import { DUELS } from './duels-data.js';
import { LEARN } from './learn-progress.js';
import { list as anchorList } from './map-anchors.js';

// InSight — Map tab: a constellation of every Daily-Question answer around a
// ring of profile anchors (age · work · study · the test results). Tap an
// anchor to see how often you answer like people who share that trait; tap an
// answer to see how any of those groups answered it. Group stats live in
// map-group-stats.js; the branch list in map-lens.js; the layout engine in
// map-tab-layout.js; the chip row in map-tab-chips.jsx.
const { mtSlug, mtHash, mtTopCat, mtClusterLayout, MT_ZLAB } = window.MapTabLayout;

// ── the tab ─────────────────────────────────────────────────────────────────
function MapTab({ rail = true, anchorsOn = true, recency = true, fields: fieldsOn = true }) {
  const { useState, useEffect, useMemo, useRef } = React;

  // editable branch labels (persisted)
  const LS_CATNAMES = 'insight.mapCatNames.v1';
  const [catNames, setCatNames] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_CATNAMES) || '{}'); } catch (e) { return {}; } });

  // ── nodes: every daily answer, filed by its question's branch path ────────
  const [dqv, setDqv] = useState(0);
  useEffect(() => {
    if (DAILYQ.subscribe) return DAILYQ.subscribe(() => setDqv((x) => x + 1));
  }, []);
  useEffect(() => LEARN.subscribe(() => setDqv((x) => x + 1)), []);
  useEffect(() => DUELS.subscribe(() => setDqv((x) => x + 1)), []);
  // ── anchors: the profile ring at the centre ───────────────────────────────
  // State fed by the store's own event, not a mount-once memo. The mock list
  // is a constant and `useMemo(…, [])` was fine for it; the live one is not
  // — anchors and test results both arrive from data/live.ts's hydrate,
  // which lands after first paint, so a mount-once read on a cold start
  // pins the ring to an empty profile forever.
  //
  // DAILYQ.subscribe above does NOT cover this: its liveSync fires listeners
  // only when a vote or an aggregate actually moved, and both of the things
  // this ring is built from can land without either.
  //
  // State rather than a version counter because `anchors` is itself a memo
  // dependency below — recomputing it every render would give the layout a
  // new array identity each time and rebuild the force layout with it.
  const [anchors, setAnchors] = useState(anchorList);
  useEffect(() => {
    const on = () => setAnchors(anchorList());
    window.addEventListener('insight-live-update', on);
    return () => window.removeEventListener('insight-live-update', on);
  }, []);
  const built = useMemo(() => {
    const D = DAILYQ;
    const out = []; const subSeen = new Map(); const topSeen = new Map(); const counts = {};
    if (D) D.answered().forEach((q) => {
      const idx = D.myAnswer(q);
      const ans = q.type === 'rating' ? (idx + 1) + '/10'
        : (q.options && q.options[idx] != null) ? q.options[idx] : '—';
      const prompt = q.prompt.replace(/[.\s]+$/, '');
      const path = D.categoryPath(q);
      const meta = D.catMeta(path[0]);
      if (!topSeen.has(meta.catId)) topSeen.set(meta.catId, { id: meta.catId, label: path[0], hue: meta.hue });
      counts[meta.catId] = (counts[meta.catId] || 0) + 1;
      // how typical your answer is among everyone — drives layout + dot style
      const nOpt = Math.max(2, q.options ? q.options.length : 10);
      const gd = window.MapStats ? window.MapStats.dist(q.id, 'all', nOpt, idx) : null;
      const typ = gd ? gd[idx] / 100 : 0.5;
      const maj = gd ? gd.indexOf(Math.max(...gd)) === idx : true;
      let parent = meta.catId;
      if (path[1]) {
        const key = meta.catId + '|' + path[1];
        let sub = subSeen.get(key);
        if (!sub) { sub = { id: 'dqsub-' + mtSlug(meta.catId + '-' + path[1]), parentId: meta.catId, label: path[1], sub: true, age: 999 }; subSeen.set(key, sub); out.push(sub); }
        sub.age = Math.min(sub.age, q.idx);
        sub.age0 = Math.max(sub.age0 || 0, q.idx);
        parent = sub.id;
      }
      out.push({
        id: 'dq-' + q.id, parentId: parent, qid: q.id, top: path[0], daily: true,
        label: prompt + ' → ' + ans, tag: q.tag || prompt, ans, prompt, note: q.dateLabel, age: q.idx,
        qtype: q.type, opts: q.options || null, aidx: idx, typ, maj,
      });
    });
    // ── knowledge: only what you have MASTERED reaches the map. Cards still in
    // the three-in-a-row queue stay off it — a map you cannot trust is furniture.
    // Subject is the branch, field the sub-branch, the fact the leaf; typicality
    // is the share of the crowd who get it right, so hard-won facts sit outward.
    // Braces without a condition: `if (window.LEARN)` was a load-order guard,
    // and an imported binding cannot be unset — but the block scopes `got`/`n`,
    // and de-indenting 23 lines to drop it would bury this change in a
    // whitespace diff (D108). An empty `mastered()` was always a no-op here.
    {
      const got = LEARN.mastered();
      const n = got.length;
      got.forEach((m, i) => {
        const c = m.card;
        const fd = LEARN.field(c.f);
        const sj = fd ? LEARN.subject(fd.subject) : null;
        if (!fd || !sj) return;
        const catId = 'lrn-' + sj.id;
        if (!topSeen.has(catId)) topSeen.set(catId, { id: catId, label: sj.label, hue: sj.hue });
        counts[catId] = (counts[catId] || 0) + 1;
        const subId = 'lrnsub-' + fd.id;
        let sub = subSeen.get(subId);
        if (!sub) { sub = { id: subId, parentId: catId, fid: fd.id, label: fd.label, sub: true, learn: true, age: 999 }; subSeen.set(subId, sub); out.push(sub); }
        const age = n - 1 - i;
        sub.age = Math.min(sub.age, age);
        sub.age0 = Math.max(sub.age0 || 0, age);
        out.push({
          id: 'lrn-' + c.id, parentId: subId, cid: c.id, qid: c.id, top: sj.label,
          daily: true, learn: true, label: c.k, tag: c.k, ans: c.a[c.c], prompt: c.q,
          note: 'known', age, typ: c.p / 100, maj: true,
        });
      });
    }
    // single-answer sub-topics collapse into the answer itself — the sub card
    // and the answer card would be the same card, so keep only one step
    const kidCt = {};
    out.forEach((n) => { if (n.daily) kidCt[n.parentId] = (kidCt[n.parentId] || 0) + 1; });
    const solo = new Map(); // sub id → sub node
    out.forEach((n) => { if (n.sub && (kidCt[n.id] || 0) < 2) solo.set(n.id, n); });
    const kept = out.filter((n) => !solo.has(n.id));
    kept.forEach((n) => {
      const s = n.daily ? solo.get(n.parentId) : null;
      if (s) { n.subLabel = s.label; n.parentId = s.parentId; }
    });
    // (people you've dueled with now live on the Circle map, not here)
    return { nodes: kept, tops: Array.from(topSeen.values()), counts };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [dqv]);
  const nodes0 = built.nodes;
  const allAnswers = useMemo(() => nodes0.filter((n) => n.daily), [nodes0]);

  // active branches: any that hold at least one answer — renames applied
  const allCats = useMemo(() => {
    const base = window.MapLens.CATS.concat(built.tops);
    const seen = new Set(); const out = [];
    base.forEach((c) => {
      if (seen.has(c.id) || !(built.counts[c.id] > 0)) return;
      seen.add(c.id);
      out.push(catNames[c.id] ? { ...c, label: catNames[c.id] } : c);
    });
    return out;
  }, [built, catNames]);

  // ── the grouping level ──────────────────────────────────────────
  // You → group → branch → sub → answer, navigated by drilling. At the top level
  // the ring is groups and the answers stay as unlabelled dots inside them: the
  // constellation's silhouette survives, only the competing labels go.
  const GRP = window.MAP_GROUPS;
  const [openGroup, setOpenGroup] = useState(() => {
    // Learn's “See it” hands the map the group to land on
    const g = typeof window !== 'undefined' ? window.MAP_OPEN_GROUP : null;
    if (g) { try { delete window.MAP_OPEN_GROUP; } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } return g; }
    return null;
  });

  // each node's branch, resolved without needing the level-specific byId
  const topOf = useMemo(() => {
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
    if (!GRP) return [];
    const ct = {};
    allCats.forEach((c) => { const g = GRP.of(c.id); ct[g] = (ct[g] || 0) + (built.counts[c.id] || 0); });
    return GRP.all().filter((g) => ct[g.id] > 0).map((g) => ({ ...g, ct: ct[g.id] }));
  }, [GRP, allCats, built]);

  const grouped = !!GRP && groups.length > 1 && !openGroup;
  const openGroupDef = openGroup && GRP ? GRP.get(openGroup) : null;
  const cats = grouped ? groups : (openGroup ? allCats.filter((c) => GRP.of(c.id) === openGroup) : allCats);
  const nodes = useMemo(() => {
    if (openGroup) return nodes0.filter((n) => GRP.of(topOf[n.id]) === openGroup);
    if (!grouped) return nodes0;
    return nodes0.filter((n) => n.daily).map((n) => {
      const gid = GRP.of(topOf[n.id]);
      return { ...n, parentId: gid, gid, sub: false, quiet: true };
    });
  }, [nodes0, topOf, grouped, openGroup, GRP]);
  const answers = useMemo(() => nodes.filter((n) => n.daily && !n.quiet), [nodes]);
  const catCount = (id) => (grouped ? ((groups.find((g) => g.id === id) || {}).ct || 0) : (built.counts[id] || 0));
  const byId = useMemo(() => {
    const m = { root: { id: 'root', parentId: null } };
    cats.forEach((c) => (m[c.id] = { id: c.id, parentId: 'root' }));
    nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [nodes, cats]);

  const AR = 170;
  const laid = useMemo(() => {
    const { pos: p, fields: f } = mtClusterLayout(nodes, cats);
    anchors.forEach((a, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / (anchors.length || 1);
      p['ax-' + a.id] = { x: Math.cos(ang) * AR, y: Math.sin(ang) * AR };
    });
    return { pos: p, fields: f };
  }, [nodes, cats, anchors]);
  const pos = laid.pos;

  // ── selection ──────────────────────────────────────────────────────────────
  const [sel, setSel] = useState(null);     // 'root' | catId | nodeId | 'ax-<anchor>'
  const [cut, setCut] = useState(null);     // time-scrub position (null = off)
  const scrubAnim = useRef(null);
  const [hlCat, setHlCat] = useState(null); // spotlit branch id
  const [pairA, setPairA] = useState(null); // active group filter on the answer card

  const selCat = cats.find((c) => c.id === sel) || null;
  const selAnchor = sel && String(sel).indexOf('ax-') === 0 ? anchors.find((a) => 'ax-' + a.id === sel) : null;
  const selNode = sel && sel !== 'root' && !selCat && !selAnchor ? byId[sel] : null;
  const selIsSub = selNode && selNode.sub;
  // the answer card's active group filter — sticky across answers
  const effFilter = selNode && selNode.daily && !selNode.learn ? (pairA || (anchors[0] && anchors[0].id)) : null;
  const anchorRows = selAnchor ? allAnswers.slice().sort((a, b) => a.age - b.age) : [];

  const hlSet = useMemo(() => {
    if (hlCat) {
      const s = new Set([hlCat]);
      nodes.forEach((n) => { if (mtTopCat(n, byId) === hlCat) s.add(n.id); });
      return s;
    }
    return null;
  }, [hlCat, nodes, byId]);

  // oldest answer — the far end of the time scrub
  const maxAge = useMemo(() => allAnswers.reduce((m, n) => Math.max(m, n.age || 0), 0), [allAnswers]);

  // ---- view: pan / pinch / wheel ----
  const ref = useRef(null);
  const [view, setView] = useState(null);
  const viewRef = useRef(null);
  viewRef.current = view;
  const posRef = useRef(pos);
  posRef.current = pos;
  const drag = useRef(null);
  // while the view moves the world layer is compositor-promoted; at rest the
  // promotion drops so text re-rasterizes sharp at the final scale
  const [moving, setMoving] = useState(false);
  const moveT = useRef(null);
  const bumpMove = () => { setMoving(true); clearTimeout(moveT.current); moveT.current = setTimeout(() => setMoving(false), 240); };
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const fitZRef = useRef(null);
  const lastTap = useRef(null);   // double-tap detection
  const tapTimer = useRef(null);  // delayed single-tap (waits out a double)
  // the near-miss adopter (assigned per render, below the state it reads —
  // the viewRef precedent). Ref rather than a direct call because
  // onPointerUp is defined above `hidden`/`ringOpen` in this body and the
  // finder needs both.
  const nearestRef = useRef(null);
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  const fitAllTarget = () => {
    const el = ref.current;
    if (!el) return null;
    const w = el.clientWidth, h = el.clientHeight;
    if (w < 10 || h < 10) return null;
    let x0 = -220, y0 = -220, x1 = 220, y1 = 220;
    Object.keys(pos).forEach((k) => {
      const p = pos[k];
      if (!p) return;
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    });
    x0 -= 130; x1 += 130; y0 -= 110; y1 += 110;
    const z = Math.min(0.8, w / (x1 - x0), h / (y1 - y0));
    fitZRef.current = z;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: w / 2 - cx * z, y: h / 2 - cy * z, z };
  };

  // first fit — retry until the pane is measurable (capped, so a pane that
  // never lays out can't leave a timer bouncing for the life of the session).
  // This one is the Mirror tab's default `you` population, so an uncapped
  // loop here is ~30k wake-ups/hour of dwell, each forcing a layout read in
  // fitAllTarget — same cap, same 60, same reason as the sibling copy of
  // this construct in person-mindmap.jsx, which was capped and this was not.
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
    const t0 = performance.now(), dur = 520;
    let done = false;
    const step = () => {
      if (done) return;
      cancelAnimationFrame(animRef.current);
      clearTimeout(timerRef.current);
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      bumpMove();
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

  // the ring stage reserves its own strip: the branch rail is hidden above and
  // the anchor card runs to its cap below, so the ring is fitted between the two
  // rather than into a blind fraction of the canvas — no anchor under chrome.
  // Tighter padding buys back the size the smaller strip costs.
  //
  // top 56, not 14: the Mirror's stop ruler sits immediately ABOVE this
  // canvas, and with the old strip the top anchor's hit area ended a few
  // px under it — a thumb aiming at Age landed on the ruler and switched
  // stops ("navigating me somewhere else", the 2026-08-11 report). The
  // clearance costs a slightly smaller ring; a mis-tap that changes tabs
  // costs the whole screen.
  const RING_FIT = { padX: 56, padY: 46, top: 56, bottomFrac: 0.635 };
  const fitTo = (ids, maxZ, opts) => {
    const el = ref.current;
    if (!el) return;
    const o = opts || {};
    const padX = o.padX != null ? o.padX : 170, padY = o.padY != null ? o.padY : 150;
    const top = o.top || 0;
    const w = el.clientWidth;
    // bottom card cover — either an explicit reserve or the legacy fraction
    const h = (o.bottomFrac != null ? el.clientHeight * (1 - o.bottomFrac) : el.clientHeight * (o.viewFrac || 0.55)) - top;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
    ids.forEach((id) => {
      const p = pos[id];
      if (!p) return;
      any = true;
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    });
    if (!any) return;
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    const z = Math.min(maxZ || 0.9, w / (x1 - x0), h / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    tweenTo({ x: w / 2 - cx * z, y: top + h / 2 - cy * z, z });
  };
  const fitRing = () => fitTo(['root', ...anchors.map((a) => 'ax-' + a.id)], 0.85, RING_FIT);

  // drilling in or out rebuilds the whole constellation — re-frame it
  const lvlRef = useRef(openGroup);
  useEffect(() => {
    if (lvlRef.current === openGroup) return;
    lvlRef.current = openGroup;
    if (!view) return;
    const t = fitAllTarget();
    if (t) tweenTo(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [openGroup, pos]);

  // ---- pan / zoom limits ----
  const contentBounds = () => {
    const P = posRef.current;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k in P) {
      const p = P[k];
      if (!p) continue;
      if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y;
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
      const p = P[k];
      if (!p) continue;
      const d = (p.x - wcx) * (p.x - wcx) + (p.y - wcy) * (p.y - wcy);
      if (d < best) { best = d; bx = p.x; by = p.y; }
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
    if (!el || !b) return 0.12;
    const fit = Math.min(el.clientWidth / ((b.x1 - b.x0) + 280), el.clientHeight / ((b.y1 - b.y0) + 280));
    return Math.max(0.12, fit * 0.62);
  };

  const zoomAt = (cx, cy, factor) => {
    cancelAnimationFrame(animRef.current);
    bumpMove();
    const minZ = zoomFloor();
    setView((v) => {
      if (!v) return v;
      const z = Math.min(1.6, Math.max(minZ, v.z * factor));
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
      bumpMove();
      const z = Math.min(1.6, Math.max(zoomFloor(), v0.z * (d / d0)));
      const w = { x: (c0.x - v0.x) / v0.z, y: (c0.y - v0.y) / v0.z };
      setView(clampView({ x: mid.x - w.x * z, y: mid.y - w.y * z, z }));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) { bumpMove(); setView((v) => clampView({ ...v, x: d.vx + dx, y: d.vy + dy })); }
  };
  // animated zoom step around a canvas point (double-tap / two-finger tap)
  const stepZoom = (cx, cy, factor) => {
    const v = viewRef.current;
    if (!v) return;
    const z = Math.min(1.6, Math.max(zoomFloor(), v.z * factor));
    const k = z / v.z;
    tweenTo(clampView({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z }));
  };

  const onPointerUp = (e) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2 && pinch.current) {
      const p = pinch.current;
      pinch.current = null;
      // two-finger tap — quick, no real pinch → step the zoom out
      if (performance.now() - p.t0 < 300 && (p.maxDelta || 0) < 0.06) stepZoom(p.c0.x, p.c0.y, 0.55);
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
    // A tap that MISSED every button (pointer-down on a .mmt-node never
    // reaches here) but landed within a fingertip of one adopts it instead
    // of stepping back. The dots are ~15px at fit zoom, so a miss by a few
    // px used to fire stepBack — which re-zooms or leaves the group, and
    // reads as "the map navigated somewhere else" (2026-08-11). Resolved
    // NOW (positions at tap time) but fired on the same delay stepBack
    // uses, so a double-tap still wins the race and zooms.
    const near = nearestRef.current ? nearestRef.current(pt) : null;
    tapTimer.current = setTimeout(near ? near.go : stepBack, 300);
  };

  // ---- time scrub — replay the map growing answer-by-answer ----
  const closeScrub = () => { cancelAnimationFrame(scrubAnim.current); setCut(null); };
  const openScrub = () => {
    clearSel();
    cancelAnimationFrame(scrubAnim.current);
    const t0 = performance.now(), dur = Math.min(6000, 900 + answers.length * 150);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      setCut(k * maxAge);
      if (k < 1) scrubAnim.current = requestAnimationFrame(step);
    };
    setCut(0);
    scrubAnim.current = requestAnimationFrame(step);
  };

  // ---- selection ----
  const clearSel = () => {
    const had = hlCat || sel;
    setSel(null);
    setHlCat(null);
    if (had) { const t = fitAllTarget(); if (t) tweenTo(t); }
  };
  const selectCat = (id) => {
    closeScrub();
    // at the top level a hub is a door, not a card — tapping it opens the group
    if (grouped) { setSel(null); setHlCat(null); setOpenGroup(id); return; }
    setSel(id);
    setHlCat(id);
    const ids = [id];
    nodes.forEach((n) => { if (mtTopCat(n, byId) === id) ids.push(n.id); });
    fitTo(ids, 0.9);
  };
  const selectItem = (id) => {
    closeScrub();
    setSel(id);
    setHlCat(null);
    const n = byId[id];
    if (n) fitTo([id, n.parentId], 0.7);
  };
  const selectAnchor = (aid) => {
    closeScrub();
    setSel('ax-' + aid);
    setHlCat(null);
    fitRing();
  };

  // semantic back — one level out per tap: answer → its branch → group → all groups
  const stepBack = () => {
    if (selNode) {
      const catId = mtTopCat(selNode, byId);
      if (catId) { selectCat(catId); return; }
    }
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
        <div className="mmt-canvas" ref={ref}></div>
      </div>
    );
  }

  const catScale = Math.max(1, Math.min(3.2, 0.78 / view.z));
  const centerScale = Math.max(1, Math.min(2.2, 0.5 / view.z));
  const itemScale = Math.max(1, Math.min(2.8, 0.85 / view.z));
  const aScale = Math.max(1, Math.min(2.7, 0.6 / view.z));
  const showALab = view.z > (fitZRef.current || 0.22) * 1.35;
  // the profile ring steps back while a branch holds the stage
  const ringRecede = !!hlCat && !selNode;
  // the ring is a mode, not furniture — closed until You or an answer asks for it
  const ringOpen = sel === 'root' || !!selAnchor || !!(selNode && selNode.daily && !selNode.learn);
  // labels counter-scale so on-screen type never drops below reading size
  const hubFs = Math.min(48, Math.max(13, 13 / (catScale * view.z)));
  const centerFs = Math.min(48, Math.max(13.5, 13.5 / (centerScale * view.z)));
  const dotFs = Math.min(30, Math.max(10.5, 12 / (itemScale * view.z)));
  const aFs = Math.min(26, Math.max(10, 11.5 / (aScale * view.z)));

  // time scrub — answers newer than the cutoff haven't "happened" yet
  const thr = cut != null ? maxAge - cut : null;
  const hidden = thr == null || thr <= 0 ? null
    : new Set(nodes.filter((n) => (n.daily ? n.age : (n.age0 ?? 0)) < thr - 1e-6).map((n) => n.id));

  // the near-miss adopter for onPointerUp (via nearestRef): the closest
  // TAPPABLE thing within ~30px of a canvas tap, with the same action its
  // own button would run. Candidates mirror the buttons' own gates — a
  // folded ring, a dimmed hub, a scrubbed-out dot are not tappable and must
  // not become tappable through the side door.
  nearestRef.current = (pt) => {
    const v = viewRef.current;
    if (!v) return null;
    const P = posRef.current;
    const cands = [];
    if (anchorsOn && !openGroup && ringOpen) {
      anchors.forEach((a) => {
        const p = P['ax-' + a.id];
        if (!p) return;
        cands.push({
          x: p.x, y: p.y,
          go: () => { if (selAnchor && selAnchor.id === a.id) clearSel(); else selectAnchor(a.id); },
        });
      });
    }
    cats.forEach((c) => {
      if (hlSet && !hlSet.has(c.id)) return;
      const p = P[c.id];
      if (!p) return;
      cands.push({ x: p.x, y: p.y, go: () => selectCat(c.id) });
    });
    nodes.forEach((n) => {
      if (hlSet && !hlSet.has(n.id)) return;
      if (hidden && hidden.has(n.id)) return;
      const p = P[n.id];
      if (!p) return;
      cands.push({
        x: p.x, y: p.y,
        go: () => { if (n.quiet) { setSel(null); setHlCat(null); setOpenGroup(n.gid); } else selectItem(n.id); },
      });
    });
    let best = null, bd = 30 * 30;
    cands.forEach((c) => {
      const dx = c.x * v.z + v.x - pt.x, dy = c.y * v.z + v.y - pt.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  };

  // label collision pass — greedy keep, in screen space. Hub labels are
  // seeded first so nothing ever buries a branch name; topic labels beat
  // answer chips; newer answers beat older ones.
  const labKeep = (() => {
    const z = view.z;
    const kept = [];
    // branch names are always on — everything else keeps clear of them
    cats.forEach((c) => {
      const p = pos[c.id];
      if (!p) return;
      const w = 18 + String(c.label).length * 8;
      const sx = p.x * z + view.x;
      kept.push({ x0: sx - w / 2, x1: sx + w / 2, y: p.y * z + 16 });
      kept.push({ x0: sx - 22, x1: sx + 22, y: p.y * z });   // the hub dot itself is keep-out
    });
    const cands = [];
    nodes.forEach((n) => {
      const p = pos[n.id];
      if (!p) return;
      if (n.quiet) return;   // group level: mass without labels
      // a spotlit branch owns the stage — never let dimmed branches' labels ghost through
      if (hlSet && !hlSet.has(n.id) && sel !== n.id) return;
      // topic labels surface a beat earlier than answer chips — structure first
      const zThr = n.sub ? MT_ZLAB * 0.6 : MT_ZLAB;
      if (!(z >= zThr || sel === n.id || (hlSet && hlSet.has(n.id)))) return;
      const txt = String(n.daily ? n.tag : n.label);
      const w = n.sub ? 14 + txt.length * 6 : 20 + txt.length * 6.8;
      // the real label is side-anchored: it hangs left or right of the dot
      const sx = p.x * z + view.x;
      const labL = sx > (ref.current ? ref.current.clientWidth : 480) / 2;
      const x0 = labL ? sx - 8 - w : sx + 8;
      const pri = sel === n.id ? -1e6 : n.sub ? -1e5 + (n.age ?? 0) : (n.age ?? 999);
      cands.push({ id: n.id, x0, x1: x0 + w, y: p.y * z, pri });
    });
    cands.sort((a, b) => a.pri - b.pri);
    const keep = new Set();
    cands.forEach((c) => {
      const ok = kept.every((k) => Math.abs(c.y - k.y) > 18 || c.x0 > k.x1 + 6 || c.x1 < k.x0 - 6);
      if (ok) { keep.add(c.id); kept.push(c); }
    });
    return keep;
  })();

  // edges: branch → sub → answer — trunks to topics, twigs to answers
  const edges = [];
  // spokes: You → each branch hub — faint gravity lines so the whole map reads
  // as one system radiating from You, not a scatter of unconnected islands
  cats.forEach((c) => {
    if (!pos[c.id] || !pos.root) return;
    edges.push({ from: 'root', to: c.id, hue: c.hue, w: 1.6, spoke: true });
  });
  nodes.forEach((n) => {
    if (!pos[n.id] || !pos[n.parentId]) return;
    const catId = mtTopCat(n, byId);
    const cat = cats.find((c) => c.id === catId);
    edges.push({ from: n.parentId, to: n.id, hue: cat ? cat.hue : 250, w: n.sub ? 2.2 : 1.3 });
  });

  // ---- card ----
  const tok = (n) => ({ id: n.id, ans: n.ans, note: n.note, q: n.prompt, hue: (cats.find((c) => c.id === mtTopCat(n, byId)) || { hue: 250 }).hue });
  const selNodeCat = selNode ? cats.find((c) => c.id === mtTopCat(selNode, byId)) : null;
  const cardHue = selAnchor ? selAnchor.hue : selCat ? selCat.hue : selNodeCat ? selNodeCat.hue : 282;
  const activeCat = hlCat || (selCat ? selCat.id : selNode ? mtTopCat(selNode, byId) : null);
  const atHome = !activeCat && (!sel || sel === 'root');

  // "You" drifted off-screen — an edge pill points the way back
  let recenter = null;
  if (ref.current) {
    const W = ref.current.clientWidth, H = ref.current.clientHeight;
    const cx = view.x, cy = view.y; // screen position of the centre
    if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) {
      const px = Math.min(Math.max(cx, 46), W - 46);
      const py = Math.min(Math.max(cy, 64), sel ? H * 0.38 : H - 64);
      recenter = { x: px, y: py, deg: (Math.atan2(cy - py, cx - px) * 180) / Math.PI };
    }
  }

  const ringStage = sel === 'root' || !!selAnchor;
  return (
    <div className={'mmt-root' + (ringStage ? ' is-ringstage' : '') + (openGroup ? ' is-ingroup' : '')} data-screen-label="map-tab">
      <div
        className="mmt-canvas is-dots"
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={'mmt-world' + (moving ? ' is-moving' : '')} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          <div className="mmt-ground" aria-hidden="true"></div>
          {fieldsOn ? laid.fields.map((f) => {
            const cat = cats.find((c) => c.id === f.id);
            if (!cat) return null;
            const sz = (f.r + 70) * 2;
            // tint deepens where you've answered most
            const maxCt = Math.max(1, ...cats.map((c) => catCount(c.id)));
            const fop = hlSet && !hlSet.has(f.id) ? 0.12 : 0.5 + 0.5 * (catCount(f.id) / maxCt);
            return (
              <div
                key={f.id}
                className="mmt-field"
                style={{ '--hue': cat.hue, width: sz, height: sz, opacity: fop, transform: `translate(${f.x}px, ${f.y}px) translate(-50%, -50%)` }}
                aria-hidden="true"
              ></div>
            );
          }) : null}
          <svg className="mmt-edges" viewBox="-1800 -1800 3600 3600" style={{ left: -1800, top: -1800, width: 3600, height: 3600 }}>
            {edges.map((e, i) => {
              let op = 0.75;
              if (hlSet && !(hlSet.has(e.from) || hlSet.has(e.to))) op = 0.1;
              if (hidden && hidden.has(e.to)) op = 0;
              if (e.spoke) op *= 0.7; // gravity lines stay quieter than trunks
              return (
                <path
                  key={i}
                  className={e.spoke ? 'mmt-limb mmt-spoke' : 'mmt-limb'}
                  style={{ '--hue': e.hue }}
                  d={`M ${pos[e.from].x} ${pos[e.from].y} L ${pos[e.to].x} ${pos[e.to].y}`}
                  fill="none"
                  opacity={op}
                  strokeWidth={e.w}
                  strokeLinecap="round"
                ></path>
              );
            })}
          </svg>

          {/* centre — you, ringed by your profile anchors. The ring line's
              transform is STATIC (the fold group below owns the open/close
              motion): a transform that changes per state on an element with
              a transform transition is the wobble the anchors just lost. */}
          {anchorsOn && !openGroup ? (
            <div className={'mmt-ringline' + (ringRecede ? ' is-recede' : '') + (ringOpen ? '' : ' is-closed')} style={{ width: AR * 2, height: AR * 2, transform: 'translate(-50%, -50%)' }} aria-hidden="true"></div>
          ) : null}
          <button
            type="button"
            className={'mmt-node mmt-center' + (openGroupDef ? ' is-group' : '') + (sel === 'root' ? ' is-sel' : '') + (selAnchor || ringRecede ? ' is-recede' : '') + (ringOpen ? '' : ' is-solo')}
            style={{ '--hue': openGroupDef ? openGroupDef.hue : undefined, transform: `translate(0px, 0px) translate(-50%, -50%) scale(${centerScale})` }}
            aria-label={openGroup ? 'Leave the group view' : 'You — centre the map on your own anchors'}
            onClick={(e) => {
              e.stopPropagation();
              // inside a group the centre is the way back out
              if (openGroup) { setSel(null); setHlCat(null); setOpenGroup(null); return; }
              setSel('root'); setHlCat(null); fitRing();
            }}
          >
            <div className="mmt-halo" aria-hidden="true"></div>
            <div className="mmt-center-disc">
              {openGroupDef ? null : <span className="mmt-center-name">You</span>}
            </div>
            {openGroupDef ? <span className="mmt-center-glabel" style={{ fontSize: centerFs }}>{openGroupDef.label}</span> : null}
          </button>
          {/* the fold wrapper owns the closed-ring collapse (scale 0.12 ↔ 1),
              so each anchor's own transform — which tracks the per-frame
              zoom counter-scale (aScale) — carries NO transition. When the
              transition sat on the buttons themselves, every frame of a fit
              tween re-targeted it and the anchors wobbled visibly the whole
              time the card was open ("the dots shake" — 2026-08-11). */}
          {anchorsOn && !openGroup ? (
            <div className={'mmt-ringfold' + (ringOpen ? '' : ' is-closed')}>
              {anchors.map((a) => {
                const p = pos['ax-' + a.id];
                if (!p) return null;
                const isSel = selAnchor && selAnchor.id === a.id;
                const isFilter = effFilter === a.id;
                const soft = (selAnchor && !isSel) || ringRecede;
                const lab = showALab || isSel || sel === 'root' || !!selNode;
                return (
                  <button
                    type="button"
                    key={a.id}
                    className={'mmt-node mmt-anchor' + (isSel ? ' is-sel' : '') + (soft ? ' is-soft' : '') + (lab ? '' : ' is-nolab') + (isFilter ? ' is-pulse' : '') + (ringOpen ? '' : ' is-closed')}
                    data-screen-label={'anchor-' + a.id}
                    style={{ '--hue': a.hue, transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${aScale})` }}
                    aria-pressed={!!isSel}
                    aria-label={a.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSel) clearSel();
                      else selectAnchor(a.id);
                    }}
                  >
                    <span className="mmt-anchor-dot"></span>
                    <span className="mmt-anchor-label" style={{ fontSize: aFs }}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* branch hubs */}
          {cats.map((c) => {
            const p = pos[c.id];
            if (!p) return null;
            const isSel = sel === c.id;
            const cnt = catCount(c.id);
            const hubSz = 13 + Math.min(cnt, 12) * 1.5;
            // branch names always on — the map should read at a glance
            const hubLab = true;
            const hubDim = !!(hlSet && !hlSet.has(c.id));
            return (
              <button
                type="button"
                key={c.id}
                className={'mmt-node mmt-hub' + (isSel ? ' is-sel' : '') + (hubDim ? ' is-dim' : '') + (hubLab ? '' : ' is-nolab')}
                data-screen-label={c.label}
                style={{ '--hue': c.hue, transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${catScale})` }}
                // .is-dim is pointer-events:none, so a dimmed hub is already
                // dead to a mouse. As a <button> it would still take tab focus
                // — keyboard users would land on targets nobody can click.
                tabIndex={hubDim ? -1 : undefined}
                aria-hidden={hubDim || undefined}
                aria-pressed={!!isSel}
                aria-label={c.label}
                onClick={(e) => { e.stopPropagation(); selectCat(c.id); }}
              >
                <span className="mmt-hub-dot" style={{ width: hubSz, height: hubSz }}></span>
                <span className="mmt-hub-label" style={{ fontSize: hubFs }}>{c.label}</span>
              </button>
            );
          })}

          {/* answers */}
          {nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const catId = mtTopCat(n, byId);
            const cat = cats.find((c) => c.id === catId);
            const dim = hlSet && !hlSet.has(n.id);
            const age = n.age ?? 30;
            const fresh = recency && n.daily && age <= 7;
            const off = hidden && hidden.has(n.id);
            // strict size ladder — hub > answer > topic; new dots land large and settle
            const sz = n.person ? 17 : (n.sub ? 9 : 14) + (recency && n.daily ? (age <= 2 ? 4 : age <= 7 ? 2 : 0) : 0);
            const showLab = !n.quiet && labKeep.has(n.id);
            const labL = (p.x * view.z + view.x) > (ref.current ? ref.current.clientWidth : 480) / 2;
            return (
              <button
                type="button"
                key={n.id}
                className={'mmt-node mmt-dotnode' + (n.sub ? ' is-leaf' : '') + (n.person ? ' is-person' : '') + (sel === n.id ? ' is-sel' : '')
                  + (showLab ? ' is-showlab' : '') + (dim ? ' is-dim' : '') + (off ? ' is-off' : '') + (labL ? ' is-labL' : '')
                  + (fresh ? ' is-fresh' : '') + (n.daily && !n.learn && !n.maj ? ' is-rare' : '') + (n.learn && !n.sub ? ' is-known' : '') + (n.daily && n.age === 0 ? ' is-today' : '')}
                style={{
                  '--hue': cat ? cat.hue : 250,
                  width: sz, height: sz,
                  transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${itemScale})`,
                }}
                title={n.label}
                // .is-dim and .is-off are both pointer-events:none, and
                // .is-off is opacity:0 — a focusable invisible target is the
                // worst version of this, so keep both out of the tab order.
                tabIndex={dim || off ? -1 : undefined}
                aria-hidden={dim || off || undefined}
                aria-pressed={sel === n.id}
                aria-label={n.label}
                onClick={(e) => { e.stopPropagation(); if (n.quiet) { setSel(null); setHlCat(null); setOpenGroup(n.gid); } else selectItem(n.id); }}
              >
                {n.person
                  ? <span className="mmt-pdot" style={{ '--deg': Math.round((n.score || 0) * 360) + 'deg' }}></span>
                  : <span className="mmt-ddot"></span>}
                <span className="mmt-dlab" style={{ fontSize: n.sub ? dotFs * 0.9 : dotFs }}>{n.daily ? n.tag : n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* floating chrome */}
      {rail ? (
        <MTBranchChips
          cats={cats}
          activeCat={activeCat}
          atHome={atHome}
          onPick={(id) => { if (grouped) { setSel(null); setHlCat(null); setOpenGroup(id); } else if (activeCat === id) { clearSel(); } else { selectCat(id); } }}
          onHome={() => { if (openGroup) { setSel(null); setHlCat(null); setOpenGroup(null); } else clearSel(); }}
        ></MTBranchChips>
      ) : (
        <div className="mmt-chip mmt-ui">{allAnswers.length} answers · {cats.length} branches</div>
      )}
      {!rail && (hlCat || selAnchor) ? (
        <button className="mmt-clearhl mmt-ui" onClick={clearSel}>✕ full map</button>
      ) : null}
      <div className="mmt-zoomctl mmt-ui">
        {/* pinch / double-tap / wheel handle zoom — only "fit" needs a button */}
        <button className="fitb" onClick={() => { const t = fitAllTarget(); if (t) tweenTo(t); }} aria-label="Fit map">⌖</button>
        {answers.length > 1 && maxAge > 0 ? (
          <button className="fitb" onClick={() => (cut == null ? openScrub() : closeScrub())} aria-label={cut == null ? 'Replay the map' : 'Close replay'}>{cut == null ? '↺' : '✕'}</button>
        ) : null}
      </div>
      {recenter ? (
        <button
          className="mmt-recenter mmt-ui"
          style={{ left: recenter.x, top: recenter.y }}
          onClick={() => { const t = fitAllTarget(); if (t) tweenTo(t); }}
          aria-label="Back to the whole map"
        >
          <span>You</span>
          <span className="mmt-recenter-arrow" style={{ transform: `rotate(${recenter.deg}deg)` }} aria-hidden="true">→</span>
        </button>
      ) : null}

      {/* time scrub — drag through the map's history */}
      {cut != null ? (
        <div className="mmt-scrub mmt-ui">
          <input
            type="range" min="0" max={maxAge} step="0.01" value={cut}
            aria-label="Map history"
            onChange={(e) => { cancelAnimationFrame(scrubAnim.current); setCut(parseFloat(e.target.value)); }}
          />
        </div>
      ) : null}

      {/* bottom card */}
      {sel ? (
        <div className="mmt-card mmt-ui" style={{ '--hue': cardHue }}>
          <button className="mmt-card-x" onClick={clearSel} aria-label="Close">✕</button>
          {sel === 'root' ? (
            <MTRootCard count={allAnswers.length} anchorCount={anchors.length}></MTRootCard>
          ) : selAnchor ? (
            <MTAnchorCard anchor={selAnchor} items={anchorRows} onPick={selectItem} anchors={anchors} onAnchor={selectAnchor} key={selAnchor.id}></MTAnchorCard>
          ) : selCat ? (
            selCat.id === 'circle-read' && window.MTPeopleCard ? (
              <MTPeopleCard onPick={selectItem} key="people"></MTPeopleCard>
            ) : (
            <MTBranchCard
              cat={selCat}
              items={answers.filter((n) => mtTopCat(n, byId) === selCat.id).sort((a, b) => a.age - b.age).map(tok)}
              onPick={selectItem}
            ></MTBranchCard>
            )
          ) : selIsSub ? (
            selNode.learn && window.MTLearnSubCard ? (
              <MTLearnSubCard
                node={selNode}
                rows={answers.filter((n) => n.parentId === selNode.id).sort((a, b) => a.age - b.age)}
                onPick={selectItem}
                key={selNode.id}
              ></MTLearnSubCard>
            ) : (
            <MTSubCard
              node={selNode}
              cat={selNodeCat}
              rows={answers.filter((n) => n.parentId === selNode.id).sort((a, b) => a.age - b.age)}
              anchors={anchors}
              activeA={pairA || (anchors[0] && anchors[0].id)}
              onFilter={(aid) => setPairA(aid)}
            ></MTSubCard>
            )
          ) : selNode ? (
            selNode.learn && window.MTLearnCard ? (
              <MTLearnCard node={selNode} key={selNode.id}></MTLearnCard>
            ) : selNode.person && window.MTPersonCard ? (
              <MTPersonCard node={selNode} key={selNode.id}></MTPersonCard>
            ) : (
            <MTAnswerCard
              node={selNode}
              cat={selNodeCat}
              anchors={anchors}
              activeA={effFilter}
              onFilter={(aid) => setPairA(aid)}
            ></MTAnswerCard>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

window.MapTab = MapTab;

;globalThis.MapTab = typeof MapTab === 'undefined' ? globalThis.MapTab : MapTab;
