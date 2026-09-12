const {
  mtSlug,
  mtHash,
  mtTopCat,
  mtClusterLayout,
  MT_ZLAB
} = window.MapTabLayout;
function MapTab({
  rail = true,
  anchorsOn = true,
  recency = true,
  fields: fieldsOn = true,
  onExit
}) {
  const {
    useState,
    useEffect,
    useMemo,
    useRef
  } = React;
  const HAP = window.HAPTIC || {
    tick() {},
    tap() {}
  };
  const LS_CATNAMES = "insight.mapCatNames.v1";
  const [catNames, setCatNames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_CATNAMES) || "{}");
    } catch (e) {
      return {};
    }
  });
  const [dqv, setDqv] = useState(0);
  useEffect(() => {
    if (window.DAILYQ && window.DAILYQ.subscribe) return window.DAILYQ.subscribe(() => setDqv(x => x + 1));
  }, []);
  useEffect(() => {
    if (window.LEARN && window.LEARN.subscribe) return window.LEARN.subscribe(() => setDqv(x => x + 1));
  }, []);
  useEffect(() => {
    if (window.DUELS && window.DUELS.subscribe) return window.DUELS.subscribe(() => setDqv(x => x + 1));
  }, []);
  useEffect(() => {
    if (window.PREDICT && window.PREDICT.subscribe) return window.PREDICT.subscribe(() => setDqv(x => x + 1));
  }, []);
  useEffect(() => {
    if (window.PATHS && window.PATHS.sub) return window.PATHS.sub(() => setDqv(x => x + 1));
  }, []);
  useEffect(() => {
    if (window.PULSE && window.PULSE.subscribe) return window.PULSE.subscribe(() => setDqv(x => x + 1));
  }, []);
  const built = useMemo(() => {
    const D = window.DAILYQ;
    const out = [];
    const subSeen = new Map();
    const topSeen = new Map();
    const counts = {};
    if (D) D.answered().forEach(q => {
      const idx = D.myAnswer(q);
      const ans = q.type === "rating" ? idx + 1 + "/10" : q.options && q.options[idx] != null ? q.options[idx] : "—";
      const prompt = q.prompt.replace(/[.\s]+$/, "");
      const path = D.categoryPath(q);
      const meta = D.catMeta(path[0]);
      if (!topSeen.has(meta.catId)) topSeen.set(meta.catId, {
        id: meta.catId,
        label: path[0],
        hue: meta.hue
      });
      counts[meta.catId] = (counts[meta.catId] || 0) + 1;
      const nOpt = Math.max(2, q.options ? q.options.length : 10);
      const gd = window.MapStats ? window.MapStats.dist(q.id, "all", nOpt, idx) : null;
      const typ = gd ? gd[idx] / 100 : 0.5;
      const maj = gd ? gd.indexOf(Math.max(...gd)) === idx : true;
      let parent = meta.catId;
      if (path[1]) {
        const key = meta.catId + "|" + path[1];
        let sub = subSeen.get(key);
        if (!sub) {
          sub = {
            id: "dqsub-" + mtSlug(meta.catId + "-" + path[1]),
            parentId: meta.catId,
            label: path[1],
            sub: true,
            age: 999
          };
          subSeen.set(key, sub);
          out.push(sub);
        }
        sub.age = Math.min(sub.age, q.idx);
        sub.age0 = Math.max(sub.age0 || 0, q.idx);
        parent = sub.id;
      }
      out.push({
        id: "dq-" + q.id,
        parentId: parent,
        qid: q.id,
        top: path[0],
        daily: true,
        label: prompt + " → " + ans,
        tag: q.tag || prompt,
        ans,
        prompt,
        note: q.dateLabel,
        age: q.idx,
        qtype: q.type,
        opts: q.options || null,
        aidx: idx,
        typ,
        maj
      });
    });
    const L = window.LEARN;
    if (L) {
      const got = L.mastered();
      const n = got.length;
      got.forEach((m, i) => {
        const c = m.card;
        const fd = L.field(c.f);
        const sj = fd ? L.subject(fd.subject) : null;
        if (!fd || !sj) return;
        const catId = "lrn-" + sj.id;
        if (!topSeen.has(catId)) topSeen.set(catId, {
          id: catId,
          label: sj.label,
          hue: sj.hue
        });
        counts[catId] = (counts[catId] || 0) + 1;
        const subId = "lrnsub-" + fd.id;
        let sub = subSeen.get(subId);
        if (!sub) {
          sub = {
            id: subId,
            parentId: catId,
            fid: fd.id,
            label: fd.label,
            sub: true,
            learn: true,
            age: 999
          };
          subSeen.set(subId, sub);
          out.push(sub);
        }
        const age = n - 1 - i;
        sub.age = Math.min(sub.age, age);
        sub.age0 = Math.max(sub.age0 || 0, age);
        out.push({
          id: "lrn-" + c.id,
          parentId: subId,
          cid: c.id,
          qid: c.id,
          top: sj.label,
          daily: true,
          learn: true,
          label: c.k,
          tag: c.k,
          ans: c.a[c.c],
          prompt: c.q,
          note: "known",
          age,
          typ: c.p / 100,
          maj: true
        });
      });
    }
    const PR = window.PREDICT;
    if (PR) {
      const tree = PR.mapTree();
      const use = {};
      tree.nodes.forEach(n => {
        out.push(n);
        use[n.parentId] = (use[n.parentId] || 0) + 1;
      });
      tree.cats.forEach(c => {
        if (use[c.id]) {
          topSeen.set(c.id, c);
          counts[c.id] = use[c.id];
        }
      });
    }
    const PW = window.PATHS;
    if (PW && PW.mapTree) {
      const tree = PW.mapTree();
      const use = {};
      tree.nodes.forEach(n => {
        out.push(n);
        use[n.parentId] = (use[n.parentId] || 0) + 1;
      });
      tree.cats.forEach(c => {
        if (use[c.id]) {
          topSeen.set(c.id, c);
          counts[c.id] = use[c.id];
        }
      });
    }
    const PU = window.PULSE;
    if (PU && PU.mapTree) {
      const tree = PU.mapTree();
      const use = {};
      tree.nodes.forEach(n => {
        out.push(n);
        use[n.parentId] = (use[n.parentId] || 0) + 1;
      });
      tree.cats.forEach(c => {
        if (use[c.id]) {
          topSeen.set(c.id, c);
          counts[c.id] = use[c.id];
        }
      });
    }
    const kidCt = {};
    out.forEach(n => {
      if (n.daily) kidCt[n.parentId] = (kidCt[n.parentId] || 0) + 1;
    });
    const solo = new Map();
    out.forEach(n => {
      if (n.sub && (kidCt[n.id] || 0) < 2) solo.set(n.id, n);
    });
    const kept = out.filter(n => !solo.has(n.id));
    kept.forEach(n => {
      const s = n.daily ? solo.get(n.parentId) : null;
      if (s) {
        n.subLabel = s.label;
        n.parentId = s.parentId;
      }
    });
    return {
      nodes: kept,
      tops: Array.from(topSeen.values()),
      counts
    };
  }, [dqv]);
  const nodes0 = built.nodes;
  const allAnswers = useMemo(() => nodes0.filter(n => n.daily && !n.fore && !n.walk && !n.pulse), [nodes0]);
  const allCats = useMemo(() => {
    const base = window.MapLens.CATS.concat(built.tops);
    const seen = new Set();
    const out = [];
    base.forEach(c => {
      if (seen.has(c.id) || !(built.counts[c.id] > 0)) return;
      seen.add(c.id);
      out.push(catNames[c.id] ? {
        ...c,
        label: catNames[c.id]
      } : c);
    });
    return out;
  }, [built, catNames]);
  const GRP = window.MAP_GROUPS;
  const [openGroup, setOpenGroup] = useState(() => {
    const g = typeof window !== "undefined" ? window.MAP_OPEN_GROUP : null;
    if (g) {
      try {
        delete window.MAP_OPEN_GROUP;
      } catch (e) {}
      return g;
    }
    return null;
  });
  const enterFrom = useRef(null);
  const leaveTo = useRef(null);
  const pendingSel = useRef(null);
  const LS_HINTS = "insight.mapHints.v1";
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem(LS_HINTS) ? 2 : 0;
    } catch (e) {
      return 2;
    }
  });
  const hintDone = () => {
    setHint(2);
    try {
      localStorage.setItem(LS_HINTS, "1");
    } catch (e) {}
  };
  useEffect(() => {
    if (hint === 0) {
      const t = setTimeout(() => setHint(0.5), 9000);
      return () => clearTimeout(t);
    }
    if (hint === 1) {
      const t = setTimeout(hintDone, 9000);
      return () => clearTimeout(t);
    }
  }, [hint]);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fWeek, setFWeek] = useState(false);
  const [fRare, setFRare] = useState(false);
  const [cardMode, setCardMode] = useState("half");
  const topOf = useMemo(() => {
    const parent = {};
    allCats.forEach(c => {
      parent[c.id] = "root";
    });
    nodes0.forEach(n => {
      parent[n.id] = n.parentId;
    });
    const m = {};
    nodes0.forEach(n => {
      let cur = n.id,
        guard = 0;
      while (parent[cur] && parent[cur] !== "root" && guard++ < 8) cur = parent[cur];
      m[n.id] = cur;
    });
    return m;
  }, [nodes0, allCats]);
  const groups = useMemo(() => {
    if (!GRP) return [];
    const ct = {};
    allCats.forEach(c => {
      const g = GRP.of(c.id);
      ct[g] = (ct[g] || 0) + (built.counts[c.id] || 0);
    });
    return GRP.all().filter(g => ct[g.id] > 0).map(g => ({
      ...g,
      ct: ct[g.id]
    }));
  }, [GRP, allCats, built]);
  const grouped = !!GRP && groups.length > 1 && !openGroup;
  const openGroupDef = openGroup && GRP ? GRP.get(openGroup) : null;
  const cats = grouped ? groups : openGroup ? allCats.filter(c => GRP.of(c.id) === openGroup) : allCats;
  const nodes = useMemo(() => {
    if (openGroup) {
      const list = nodes0.filter(n => GRP.of(topOf[n.id]) === openGroup);
      const byCat = {};
      list.forEach(n => {
        if (!n.daily || n.fore || n.walk || n.pulse) return;
        (byCat[topOf[n.id]] = byCat[topOf[n.id]] || []).push(n);
      });
      const t2 = new Set();
      Object.values(byCat).forEach(a => a.slice().sort((x, y) => (x.age ?? 999) - (y.age ?? 999)).slice(0, 2).forEach(n => t2.add(n.id)));
      return list.map(n => t2.has(n.id) ? {
        ...n,
        top2: true
      } : n);
    }
    if (!grouped) return nodes0;
    const best = {};
    nodes0.forEach(n => {
      if (!n.daily || n.fore || n.walk || n.pulse) return;
      const gid = GRP.of(topOf[n.id]);
      if (!best[gid] || (n.age ?? 999) < (best[gid].age ?? 999)) best[gid] = n;
    });
    const peek = new Set(Object.values(best).map(n => n.id));
    return nodes0.filter(n => n.daily).map(n => {
      const gid = GRP.of(topOf[n.id]);
      return {
        ...n,
        parentId: gid,
        gid,
        sub: false,
        quiet: true,
        peek: peek.has(n.id)
      };
    });
  }, [nodes0, topOf, grouped, openGroup, GRP]);
  const answers = useMemo(() => nodes.filter(n => n.daily && !n.quiet), [nodes]);
  const catCount = id => grouped ? (groups.find(g => g.id === id) || {}).ct || 0 : built.counts[id] || 0;
  const byId = useMemo(() => {
    const m = {
      root: {
        id: "root",
        parentId: null
      }
    };
    cats.forEach(c => m[c.id] = {
      id: c.id,
      parentId: "root"
    });
    nodes.forEach(n => m[n.id] = n);
    return m;
  }, [nodes, cats]);
  const anchors = useMemo(() => window.MapAnchors ? window.MapAnchors.list() : [], []);
  const AR = 170;
  const laid = useMemo(() => {
    const {
      pos: p,
      fields: f,
      rings: rg
    } = mtClusterLayout(nodes, cats);
    if (openGroup && cats.length === 1 && p[cats[0].id]) {
      const c0 = p[cats[0].id],
        dx = -c0.x,
        dy = -c0.y;
      Object.keys(p).forEach(k => {
        if (k !== "root") p[k] = {
          x: p[k].x + dx,
          y: p[k].y + dy
        };
      });
      (f || []).forEach(fl => {
        fl.x += dx;
        fl.y += dy;
      });
      (rg || []).forEach(r => {
        r.x += dx;
        r.y += dy;
      });
    }
    anchors.forEach((a, i) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / (anchors.length || 1);
      p["ax-" + a.id] = {
        x: Math.cos(ang) * AR,
        y: Math.sin(ang) * AR
      };
    });
    return {
      pos: p,
      fields: f,
      rings: rg || []
    };
  }, [nodes, cats, anchors]);
  const pos = laid.pos;
  const [sel, setSel] = useState(() => {
    const s = typeof window !== "undefined" ? window.MAP_SELECT : null;
    if (s) {
      try {
        delete window.MAP_SELECT;
      } catch (e) {}
      return s;
    }
    return null;
  });
  const cardTouch = useRef(null);
  const [cut, setCut] = useState(null);
  const scrubAnim = useRef(null);
  const [hlCat, setHlCat] = useState(null);
  const [pairA, setPairA] = useState(null);
  const selCat = cats.find(c => c.id === sel) || null;
  const selAnchor = sel && String(sel).indexOf("ax-") === 0 ? anchors.find(a => "ax-" + a.id === sel) : null;
  const selNode = sel && sel !== "root" && !selCat && !selAnchor ? byId[sel] : null;
  const selIsSub = selNode && selNode.sub;
  const effFilter = selNode && selNode.daily && !selNode.learn ? pairA || anchors[0] && anchors[0].id : null;
  const anchorRows = selAnchor ? allAnswers.slice().sort((a, b) => a.age - b.age) : [];
  const catSet = useMemo(() => {
    if (hlCat) {
      const s = new Set([hlCat]);
      nodes.forEach(n => {
        if (mtTopCat(n, byId) === hlCat) s.add(n.id);
      });
      return s;
    }
    return null;
  }, [hlCat, nodes, byId]);
  const closeFind = () => {
    setFindOpen(false);
    setQuery("");
    setFWeek(false);
    setFRare(false);
  };
  const openFind = () => {
    closeScrub();
    if (sel || hlCat) clearSel();
    setFindOpen(true);
  };
  const findActive = findOpen && (query.trim().length > 0 || fWeek || fRare);
  const matches = useMemo(() => {
    if (!findActive) return null;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return allAnswers.filter(n => {
      if (fWeek && !((n.age ?? 999) <= 7)) return false;
      if (fRare && !(n.daily && !n.learn && !n.maj)) return false;
      if (!words.length) return true;
      const hay = [n.prompt, n.ans, n.tag, n.label, n.subLabel, n.top].filter(Boolean).join(" ").toLowerCase();
      return words.every(w => hay.indexOf(w) >= 0);
    }).sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
  }, [findActive, query, fWeek, fRare, allAnswers]);
  const findSet = useMemo(() => {
    if (!matches) return null;
    const by = {};
    nodes0.forEach(n => {
      by[n.id] = n;
    });
    const s = new Set();
    matches.forEach(n => {
      s.add(n.id);
      let cur = by[n.id],
        g = 0;
      while (cur && cur.parentId && g++ < 6) {
        s.add(cur.parentId);
        cur = by[cur.parentId];
      }
      const gid = GRP ? GRP.of(topOf[n.id]) : null;
      if (gid) s.add(gid);
    });
    return s;
  }, [matches, nodes0, topOf, GRP]);
  const hlSet = findSet || catSet;
  const enterGroup = id => {
    closeScrub();
    setSel(null);
    setHlCat(null);
    const v = viewRef.current,
      p = posRef.current && posRef.current[id];
    if (v && p) enterFrom.current = {
      x: p.x * v.z + v.x,
      y: p.y * v.z + v.y,
      z: v.z
    };
    HAP.tap();
    if (hint < 1) setHint(1);
    setOpenGroup(id);
  };
  const leaveGroup = () => {
    closeScrub();
    setSel(null);
    setHlCat(null);
    leaveTo.current = openGroup;
    HAP.tap();
    if (hint === 1) hintDone();
    setOpenGroup(null);
  };
  const goToNode = id => {
    if (byId[id] && !byId[id].quiet) {
      selectItem(id);
      return;
    }
    const gid = GRP ? GRP.of(topOf[id]) : null;
    if (!gid || gid === openGroup) {
      selectItem(id);
      return;
    }
    pendingSel.current = id;
    enterGroup(gid);
  };
  const maxAge = useMemo(() => allAnswers.reduce((m, n) => Math.max(m, n.age || 0), 0), [allAnswers]);
  const ref = useRef(null);
  const [view, setView] = useState(null);
  const viewRef = useRef(null);
  viewRef.current = view;
  const posRef = useRef(pos);
  posRef.current = pos;
  const drag = useRef(null);
  const [moving, setMoving] = useState(false);
  const moveT = useRef(null);
  const bumpMove = () => {
    setMoving(true);
    clearTimeout(moveT.current);
    moveT.current = setTimeout(() => setMoving(false), 240);
  };
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const fitZRef = useRef(null);
  const lastTap = useRef(null);
  const tapTimer = useRef(null);
  useEffect(() => () => clearTimeout(tapTimer.current), []);
  const fitAllTarget = () => {
    const el = ref.current;
    if (!el) return null;
    const w = el.clientWidth,
      h = el.clientHeight;
    if (w < 10 || h < 10) return null;
    let x0 = -220,
      y0 = -220,
      x1 = 220,
      y1 = 220;
    Object.keys(pos).forEach(k => {
      const p = pos[k];
      if (!p) return;
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    });
    x0 -= 130;
    x1 += 130;
    y0 -= 110;
    y1 += 110;
    const z = Math.min(0.8, w / (x1 - x0), h / (y1 - y0));
    fitZRef.current = z;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    return {
      x: w / 2 - cx * z,
      y: h / 2 - cy * z,
      z
    };
  };
  useEffect(() => {
    if (view) return;
    let cancelled = false;
    const tryFit = () => {
      if (cancelled) return;
      const t = fitAllTarget();
      if (t) setView(t);else setTimeout(tryFit, 120);
    };
    tryFit();
    return () => {
      cancelled = true;
    };
  }, [pos, view]);
  const tweenTo = target => {
    cancelAnimationFrame(animRef.current);
    clearTimeout(timerRef.current);
    const from = viewRef.current;
    if (!from) return;
    if (document.hidden) {
      setView(target);
      return;
    }
    const t0 = performance.now(),
      dur = 520;
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
        z: from.z + (target.z - from.z) * e
      });
      if (k < 1) {
        animRef.current = requestAnimationFrame(step);
        timerRef.current = setTimeout(step, 32);
      } else {
        done = true;
      }
    };
    step();
  };
  const RING_FIT = {
    padX: 56,
    padY: 46,
    top: 14,
    bottomFrac: 0.635
  };
  const fitTo = (ids, maxZ, opts) => {
    const el = ref.current;
    if (!el) return;
    const o = opts || {};
    const padX = o.padX != null ? o.padX : 170,
      padY = o.padY != null ? o.padY : 150;
    const top = o.top || 0;
    const w = el.clientWidth;
    const h = (o.bottomFrac != null ? el.clientHeight * (1 - o.bottomFrac) : el.clientHeight * (o.viewFrac || 0.55)) - top;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity,
      any = false;
    ids.forEach(id => {
      const p = pos[id];
      if (!p) return;
      any = true;
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    });
    if (!any) return;
    x0 -= padX;
    x1 += padX;
    y0 -= padY;
    y1 += padY;
    const z = Math.min(maxZ || 0.9, w / (x1 - x0), h / (y1 - y0));
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    tweenTo({
      x: w / 2 - cx * z,
      y: top + h / 2 - cy * z,
      z
    });
  };
  const fitRing = () => fitTo(["root", ...anchors.map(a => "ax-" + a.id)], 0.85, RING_FIT);
  const lvlRef = useRef(openGroup);
  useEffect(() => {
    if (lvlRef.current === openGroup) return;
    lvlRef.current = openGroup;
    if (!view) return;
    const v = viewRef.current;
    const ef = enterFrom.current,
      lt = leaveTo.current;
    enterFrom.current = null;
    leaveTo.current = null;
    let start = null;
    if (ef) start = {
      x: ef.x,
      y: ef.y,
      z: ef.z
    };else if (lt && pos[lt] && v) start = {
      x: v.x - pos[lt].x * v.z,
      y: v.y - pos[lt].y * v.z,
      z: v.z
    };
    if (start) {
      viewRef.current = start;
      setView(start);
    }
    const pend = pendingSel.current;
    if (pend && pos[pend]) {
      pendingSel.current = null;
      setTimeout(() => selectItem(pend), start ? 40 : 0);
      return;
    }
    pendingSel.current = null;
    const t = fitAllTarget();
    if (t) {
      if (start) setTimeout(() => tweenTo(t), 60);else tweenTo(t);
    }
  }, [openGroup, pos]);
  const contentBounds = () => {
    const P = posRef.current;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const k in P) {
      const p = P[k];
      if (!p) continue;
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
    return isFinite(x0) ? {
      x0,
      y0,
      x1,
      y1
    } : null;
  };
  const clampView = v => {
    const el = ref.current,
      P = posRef.current;
    if (!el || !v || !P) return v;
    const W = el.clientWidth,
      H = el.clientHeight;
    const wcx = (W / 2 - v.x) / v.z,
      wcy = (H / 2 - v.y) / v.z;
    let best = Infinity,
      bx = 0,
      by = 0;
    for (const k in P) {
      const p = P[k];
      if (!p) continue;
      const d = (p.x - wcx) * (p.x - wcx) + (p.y - wcy) * (p.y - wcy);
      if (d < best) {
        best = d;
        bx = p.x;
        by = p.y;
      }
    }
    if (!isFinite(best)) return v;
    best = Math.sqrt(best);
    const reach = Math.min(W, H) / v.z * 0.42;
    if (best <= reach) return v;
    const t = (best - reach) / best;
    const cx = wcx + (bx - wcx) * t,
      cy = wcy + (by - wcy) * t;
    return {
      ...v,
      x: W / 2 - cx * v.z,
      y: H / 2 - cy * v.z
    };
  };
  const zoomFloor = () => {
    const el = ref.current;
    const b = contentBounds();
    if (!el || !b) return 0.12;
    const fit = Math.min(el.clientWidth / (b.x1 - b.x0 + 280), el.clientHeight / (b.y1 - b.y0 + 280));
    return Math.max(0.12, fit * 0.62);
  };
  const zoomAt = (cx, cy, factor) => {
    cancelAnimationFrame(animRef.current);
    bumpMove();
    const minZ = zoomFloor();
    setView(v => {
      if (!v) return v;
      const z = Math.min(1.6, Math.max(minZ, v.z * factor));
      const k = z / v.z;
      return clampView({
        x: cx - (cx - v.x) * k,
        y: cy - (cy - v.y) * k,
        z
      });
    });
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    };
    el.addEventListener("wheel", handler, {
      passive: false
    });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  const canvasXY = e => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    };
  };
  const onPointerDown = e => {
    if (!view || e.target.closest(".mmt-node")) return;
    cancelAnimationFrame(animRef.current);
    ptrs.current.set(e.pointerId, canvasXY(e));
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ptrs.current.size === 2) {
      const [p1, p2] = [...ptrs.current.values()];
      pinch.current = {
        d0: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        c0: {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2
        },
        v0: {
          ...view
        },
        t0: performance.now(),
        maxDelta: 0
      };
      drag.current = null;
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      drag.current = {
        sx: e.clientX,
        sy: e.clientY,
        vx: view.x,
        vy: view.y,
        moved: false,
        edge: e.clientX - r.left < 26
      };
    }
  };
  const onPointerMove = e => {
    if (!ptrs.current.has(e.pointerId)) {
      if (!drag.current) return;
    } else {
      ptrs.current.set(e.pointerId, canvasXY(e));
    }
    if (pinch.current && ptrs.current.size === 2) {
      const [p1, p2] = [...ptrs.current.values()];
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const mid = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };
      const {
        d0,
        c0,
        v0
      } = pinch.current;
      pinch.current.maxDelta = Math.max(pinch.current.maxDelta || 0, Math.abs(d / d0 - 1));
      bumpMove();
      const z = Math.min(1.6, Math.max(zoomFloor(), v0.z * (d / d0)));
      const w = {
        x: (c0.x - v0.x) / v0.z,
        y: (c0.y - v0.y) / v0.z
      };
      setView(clampView({
        x: mid.x - w.x * z,
        y: mid.y - w.y * z,
        z
      }));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx,
      dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) {
      bumpMove();
      if (d.edge) {
        setView(v => ({
          ...v,
          x: d.vx + Math.max(0, dx) * 0.35
        }));
        return;
      }
      setView(v => clampView({
        ...v,
        x: d.vx + dx,
        y: d.vy + dy
      }));
    }
  };
  const stepZoom = (cx, cy, factor) => {
    const v = viewRef.current;
    if (!v) return;
    const z = Math.min(1.6, Math.max(zoomFloor(), v.z * factor));
    const k = z / v.z;
    tweenTo(clampView({
      x: cx - (cx - v.x) * k,
      y: cy - (cy - v.y) * k,
      z
    }));
  };
  const onPointerUp = e => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2 && pinch.current) {
      const p = pinch.current;
      pinch.current = null;
      if (performance.now() - p.t0 < 300 && (p.maxDelta || 0) < 0.06) stepZoom(p.c0.x, p.c0.y, 0.55);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (d && d.edge && d.moved) {
      const dx = e.clientX - d.sx,
        dy = e.clientY - d.sy;
      const back = {
        ...viewRef.current,
        x: d.vx,
        y: d.vy
      };
      if (dx > 62 && Math.abs(dy) < dx * 0.7) {
        HAP.tap();
        viewRef.current = back;
        setView(back);
        stepBack();
      } else tweenTo(back);
      return;
    }
    if (!d || d.moved) return;
    const pt = canvasXY(e);
    const now = performance.now();
    const lt = lastTap.current;
    if (lt && now - lt.t < 280 && Math.hypot(pt.x - lt.x, pt.y - lt.y) < 40) {
      clearTimeout(tapTimer.current);
      lastTap.current = null;
      stepZoom(pt.x, pt.y, 2);
      return;
    }
    lastTap.current = {
      t: now,
      x: pt.x,
      y: pt.y
    };
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(tapEmpty, 300);
  };
  const closeScrub = () => {
    cancelAnimationFrame(scrubAnim.current);
    setCut(null);
  };
  const openScrub = () => {
    clearSel();
    cancelAnimationFrame(scrubAnim.current);
    const t0 = performance.now(),
      dur = Math.min(6000, 900 + answers.length * 150);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      setCut(k * maxAge);
      if (k < 1) scrubAnim.current = requestAnimationFrame(step);
    };
    setCut(0);
    scrubAnim.current = requestAnimationFrame(step);
  };
  const clearSel = () => {
    const had = hlCat || sel;
    setSel(null);
    setHlCat(null);
    if (had) {
      const t = fitAllTarget();
      if (t) tweenTo(t);
    }
  };
  const selectCat = id => {
    closeScrub();
    if (grouped) {
      enterGroup(id);
      return;
    }
    HAP.tick();
    setSel(id);
    setHlCat(id);
    const ids = [id];
    nodes.forEach(n => {
      if (mtTopCat(n, byId) === id) ids.push(n.id);
    });
    fitTo(ids, 0.9);
  };
  const selectItem = id => {
    closeScrub();
    HAP.tick();
    setSel(id);
    setHlCat(null);
    const n = byId[id];
    if (n) fitTo([id, n.parentId], 0.7);
  };
  const selectAnchor = aid => {
    closeScrub();
    HAP.tick();
    setSel("ax-" + aid);
    setHlCat(null);
    fitRing();
  };
  const swipeNext = dir => {
    const cur = sel ? nodes.find(n => n.id === sel && !n.quiet) : null;
    if (!cur || !pos[cur.id]) return;
    const p0 = pos[cur.id];
    const pick = list => {
      let best = null,
        bd = Infinity;
      list.forEach(n => {
        if (n.id === cur.id || n.quiet || !pos[n.id]) return;
        const dx = (pos[n.id].x - p0.x) * dir;
        if (dx < 8) return;
        const d = dx + Math.abs(pos[n.id].y - p0.y) * 1.6;
        if (d < bd) {
          bd = d;
          best = n;
        }
      });
      return best;
    };
    const hit = pick(nodes.filter(n => n.parentId === cur.parentId)) || pick(nodes);
    if (hit) selectItem(hit.id);
  };
  const stepBack = () => {
    if (findOpen && !sel) {
      closeFind();
      return;
    }
    if (selNode) {
      const catId = mtTopCat(selNode, byId);
      if (catId && !findOpen) {
        selectCat(catId);
        return;
      }
      clearSel();
      return;
    }
    if (sel || hlCat) {
      clearSel();
      return;
    }
    if (openGroup) {
      leaveGroup();
      return;
    }
    if (onExit) onExit();
  };
  const tapEmpty = () => {
    if (sel || hlCat) {
      clearSel();
      return;
    }
    const v = viewRef.current;
    if (v && v.z > (fitZRef.current || 0.2) * 1.25) {
      const t = fitAllTarget();
      if (t) tweenTo(t);
    }
  };
  if (!view) {
    return React.createElement("div", {
      className: "mmt-root"
    }, React.createElement("div", {
      className: "mmt-canvas",
      ref: ref
    }));
  }
  const catScale = Math.max(1, Math.min(3.2, 0.78 / view.z));
  const centerScale = Math.max(1, Math.min(2.2, 0.5 / view.z));
  const itemScale = Math.max(1, Math.min(2.8, 0.85 / view.z));
  const aScale = Math.max(1, Math.min(2.7, 0.6 / view.z));
  const showALab = view.z > (fitZRef.current || 0.22) * 1.35;
  const ringRecede = !!hlCat && !selNode;
  const ringOpen = sel === "root" || !!selAnchor || !!(selNode && selNode.daily && !selNode.learn);
  const ringShrink = ringOpen ? 0.5 + 0.5 * Math.max(0, Math.min(1, (view.z - 0.22) / 0.3)) : 1;
  const hubFs = Math.min(48, Math.max(13, 13 / (catScale * view.z)));
  const centerFs = Math.min(48, Math.max(13.5, 13.5 / (centerScale * view.z)));
  const dotFs = Math.min(30, Math.max(10.5, 12 / (itemScale * view.z)));
  const aFs = Math.min(26, Math.max(10, 11.5 / (aScale * view.z)));
  const thr = cut != null ? maxAge - cut : null;
  const hidden = thr == null || thr <= 0 ? null : new Set(nodes.filter(n => (n.daily ? n.age : n.age0 ?? 0) < thr - 0.000001).map(n => n.id));
  const labKeep = (() => {
    const z = view.z;
    const kept = [];
    cats.forEach(c => {
      const p = pos[c.id];
      if (!p) return;
      const w = 18 + String(c.label).length * 8;
      const sx = p.x * z + view.x;
      kept.push({
        x0: sx - w / 2,
        x1: sx + w / 2,
        y: p.y * z + 16
      });
      kept.push({
        x0: sx - 22,
        x1: sx + 22,
        y: p.y * z
      });
    });
    const cands = [];
    nodes.forEach(n => {
      const p = pos[n.id];
      if (!p) return;
      if (n.quiet && !n.peek && !(findSet && findSet.has(n.id))) return;
      if (hlSet && !hlSet.has(n.id) && sel !== n.id) return;
      const zThr = n.peek || n.top2 ? 0 : n.ext ? MT_ZLAB * 0.45 : n.fore && n.gi != null ? MT_ZLAB * 1.5 : n.sub ? MT_ZLAB * 0.6 : MT_ZLAB;
      if (!(z >= zThr || sel === n.id || hlSet && hlSet.has(n.id))) return;
      const txt = String(n.daily ? n.tag : n.label);
      const w = (n.sub ? 14 + txt.length * 6 : 20 + txt.length * 6.8) + (n.ctx ? 6 + n.ctx.length * 5 : 0);
      const sx = p.x * z + view.x;
      const labL = sx > (ref.current ? ref.current.clientWidth : 480) / 2;
      const x0 = labL ? sx - 8 - w : sx + 8;
      const pri = sel === n.id ? -1000000 : n.peek || n.top2 ? -500000 + (n.age ?? 0) : n.ext ? -200000 + (n.age ?? 0) : n.sub ? -100000 + (n.age ?? 0) : n.age ?? 999;
      cands.push({
        id: n.id,
        x0,
        x1: x0 + w,
        y: p.y * z,
        pri
      });
    });
    cands.sort((a, b) => a.pri - b.pri);
    const keep = new Set();
    cands.forEach(c => {
      const ok = kept.every(k => Math.abs(c.y - k.y) > 18 || c.x0 > k.x1 + 6 || c.x1 < k.x0 - 6);
      if (ok) {
        keep.add(c.id);
        kept.push(c);
      }
    });
    return keep;
  })();
  const soloCat = openGroup && cats.length === 1 ? cats[0].id : null;
  const edges = [];
  cats.forEach(c => {
    if (!pos[c.id] || !pos.root || c.id === soloCat) return;
    edges.push({
      from: "root",
      to: c.id,
      hue: c.hue,
      w: 1.6,
      spoke: true
    });
  });
  nodes.forEach(n => {
    if (!pos[n.id] || !pos[n.parentId]) return;
    const catId = mtTopCat(n, byId);
    const cat = cats.find(c => c.id === catId);
    edges.push({
      from: n.parentId,
      to: n.id,
      hue: !n.quiet && n.hue != null ? n.hue : cat ? cat.hue : 250,
      w: n.sub ? 2.2 : 1.3
    });
  });
  const tok = n => ({
    id: n.id,
    ans: n.ans,
    note: n.note,
    q: n.prompt,
    hue: (cats.find(c => c.id === mtTopCat(n, byId)) || {
      hue: 250
    }).hue
  });
  const selNodeCat = selNode ? cats.find(c => c.id === mtTopCat(selNode, byId)) : null;
  const cardHue = selAnchor ? selAnchor.hue : selCat ? selCat.hue : selNodeCat ? selNodeCat.hue : 282;
  const activeCat = hlCat || (selCat ? selCat.id : selNode ? mtTopCat(selNode, byId) : null);
  const atHome = !activeCat && (!sel || sel === "root");
  const crumbs = [{
    id: "home",
    label: "You"
  }];
  if (openGroupDef) crumbs.push({
    id: openGroupDef.id,
    label: openGroupDef.label,
    hue: openGroupDef.hue
  });
  const hintTxt = hint === 0 && !openGroup ? "Pinch to zoom · tap a branch to open it" : hint === 1 && openGroup ? "‹ You in the trail steps back out" : null;
  const hueOf = id => {
    const cid = topOf[id];
    const c = allCats.find(x => x.id === cid);
    if (openGroup || !grouped) return c ? c.hue : 250;
    const g = GRP ? GRP.get(GRP.of(cid)) : null;
    return g ? g.hue : c ? c.hue : 250;
  };
  const sibNav = (() => {
    if (!selNode || selIsSub || selNode.quiet) return null;
    const same = answers.filter(n => n.parentId === selNode.parentId && !n.sub);
    const cid = mtTopCat(selNode, byId);
    const list = (same.length > 1 ? same : answers.filter(n => mtTopCat(n, byId) === cid)).slice().sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
    const i = list.findIndex(n => n.id === selNode.id);
    if (i < 0 || list.length < 2) return null;
    const par = byId[selNode.parentId];
    const ctx = same.length > 1 && par && par.sub ? par.label : selNodeCat ? selNodeCat.label : "";
    return {
      i,
      n: list.length,
      ctx,
      onPrev: i > 0 ? () => selectItem(list[i - 1].id) : null,
      onNext: i < list.length - 1 ? () => selectItem(list[i + 1].id) : null
    };
  })();
  let recenter = null;
  if (ref.current) {
    const W = ref.current.clientWidth,
      H = ref.current.clientHeight;
    const cx = view.x,
      cy = view.y;
    if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) {
      const px = Math.min(Math.max(cx, 46), W - 46);
      const py = Math.min(Math.max(cy, 64), sel ? H * 0.38 : H - 64);
      recenter = {
        x: px,
        y: py,
        deg: Math.atan2(cy - py, cx - px) * 180 / Math.PI
      };
    }
  }
  const ringStage = sel === "root" || !!selAnchor;
  return React.createElement("div", {
    className: "mmt-root" + (ringStage ? " is-ringstage" : "") + (openGroup ? " is-ingroup" : ""),
    "data-screen-label": "map-tab"
  }, React.createElement("div", {
    className: "mmt-canvas is-dots",
    "data-nopan": "",
    ref: ref,
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerUp
  }, React.createElement("div", {
    className: "mmt-world" + (moving ? " is-moving" : ""),
    style: {
      transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`
    }
  }, React.createElement("div", {
    className: "mmt-ground",
    "aria-hidden": "true"
  }), fieldsOn ? laid.fields.map(f => {
    const cat = cats.find(c => c.id === f.id);
    if (!cat) return null;
    const sz = (f.r + 70) * 2;
    const maxCt = Math.max(1, ...cats.map(c => catCount(c.id)));
    const fop = hlSet && !hlSet.has(f.id) ? 0.12 : 0.5 + 0.5 * (catCount(f.id) / maxCt);
    return React.createElement("div", {
      key: f.id,
      className: "mmt-field",
      style: {
        "--hue": cat.hue,
        width: sz,
        height: sz,
        opacity: fop,
        transform: `translate(${f.x}px, ${f.y}px) translate(-50%, -50%)`
      },
      "aria-hidden": "true"
    });
  }) : null, laid.rings.map(rg => {
    const rcat = cats.find(c => c.id === rg.id);
    const rdim = hlSet && !hlSet.has(rg.id);
    return rg.radii.map((r, i) => React.createElement("div", {
      key: rg.id + "-" + i,
      className: "mmt-ring",
      style: {
        "--hue": rcat ? rcat.hue : 300,
        width: r * 2,
        height: r * 2,
        opacity: rdim ? 0.15 : 1 - i * 0.28,
        transform: `translate(${rg.x}px, ${rg.y}px) translate(-50%, -50%)`
      },
      "aria-hidden": "true"
    }));
  }), React.createElement("svg", {
    className: "mmt-edges",
    viewBox: "-1800 -1800 3600 3600",
    style: {
      left: -1800,
      top: -1800,
      width: 3600,
      height: 3600
    }
  }, edges.map((e, i) => {
    let op = 0.75;
    if (hlSet && !(hlSet.has(e.from) || hlSet.has(e.to))) op = 0.1;
    if (hidden && hidden.has(e.to)) op = 0;
    if (e.spoke) op *= 0.7;
    return React.createElement("path", {
      key: i,
      className: e.spoke ? "mmt-limb mmt-spoke mmt-ink" : "mmt-limb mmt-ink",
      pathLength: 1,
      style: {
        "--hue": e.hue,
        animationDelay: (e.spoke ? 0.05 : 0.22) + i % 7 * 0.04 + "s"
      },
      d: `M ${pos[e.from].x} ${pos[e.from].y} L ${pos[e.to].x} ${pos[e.to].y}`,
      fill: "none",
      opacity: op,
      strokeWidth: e.w,
      strokeLinecap: "round"
    });
  })), anchorsOn && !openGroup ? React.createElement("div", {
    className: "mmt-ringline" + (ringRecede ? " is-recede" : "") + (ringOpen ? "" : " is-closed"),
    style: {
      width: AR * 2,
      height: AR * 2,
      transform: `translate(-50%, -50%) scale(${ringOpen ? ringShrink : 0.3})`
    },
    "aria-hidden": "true"
  }) : null, React.createElement("div", {
    className: "mmt-node mmt-center" + (openGroupDef ? " is-group" : "") + (sel === "root" ? " is-sel" : "") + (selAnchor || ringRecede ? " is-recede" : "") + (ringOpen ? "" : " is-solo"),
    style: {
      "--hue": openGroupDef ? openGroupDef.hue : undefined,
      transform: `translate(0px, 0px) translate(-50%, -50%) scale(${centerScale})`
    },
    onClick: e => {
      e.stopPropagation();
      if (openGroup) {
        leaveGroup();
        return;
      }
      if (findOpen) closeFind();
      HAP.tick();
      setSel("root");
      setHlCat(null);
      fitRing();
    }
  }, React.createElement("div", {
    className: "mmt-halo",
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "mmt-center-disc"
  }, openGroupDef ? null : React.createElement("span", {
    className: "mmt-center-name"
  }, "You")), openGroupDef ? React.createElement("span", {
    className: "mmt-center-glabel",
    style: {
      fontSize: centerFs
    }
  }, openGroupDef.label) : null), anchorsOn && !openGroup ? anchors.map(a => {
    const p = pos["ax-" + a.id];
    if (!p) return null;
    const isSel = selAnchor && selAnchor.id === a.id;
    const isFilter = effFilter === a.id;
    const soft = selAnchor && !isSel || ringRecede;
    const lab = showALab || isSel || sel === "root" || !!selNode;
    const rk = ringOpen ? ringShrink : 0.12;
    return React.createElement("div", {
      key: a.id,
      className: "mmt-node mmt-anchor" + (isSel ? " is-sel" : "") + (soft ? " is-soft" : "") + (lab ? "" : " is-nolab") + (isFilter ? " is-pulse" : "") + (ringOpen ? "" : " is-closed"),
      "data-screen-label": "anchor-" + a.id,
      style: {
        "--hue": a.hue,
        transform: `translate(${p.x * rk}px, ${p.y * rk}px) translate(-50%, -50%) scale(${aScale})`
      },
      onClick: e => {
        e.stopPropagation();
        if (isSel) clearSel();else selectAnchor(a.id);
      }
    }, React.createElement("span", {
      className: "mmt-anchor-dot"
    }), React.createElement("span", {
      className: "mmt-anchor-label",
      style: {
        fontSize: aFs
      }
    }, a.label));
  }) : null, cats.map(c => {
    const p = pos[c.id];
    if (!p || c.id === soloCat) return null;
    const isSel = sel === c.id;
    const cnt = catCount(c.id);
    const hubSz = 13 + Math.min(cnt, 12) * 1.5;
    const hubLab = true;
    return React.createElement("div", {
      key: c.id,
      className: "mmt-node mmt-hub" + (isSel ? " is-sel" : "") + (hlSet && !hlSet.has(c.id) ? " is-dim" : "") + (hubLab ? "" : " is-nolab") + (c.waiting ? " is-wait" : ""),
      "data-screen-label": c.label,
      style: {
        "--hue": c.hue,
        transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${catScale})`
      },
      onClick: e => {
        e.stopPropagation();
        selectCat(c.id);
      }
    }, React.createElement("span", {
      className: "mmt-hub-dot",
      style: {
        width: hubSz,
        height: hubSz
      }
    }), React.createElement("span", {
      className: "mmt-hub-label",
      style: {
        fontSize: hubFs
      }
    }, c.label), c.badge ? React.createElement("span", {
      className: "mmt-hub-badge",
      style: {
        fontSize: Math.max(9.5, hubFs * 0.7)
      }
    }, c.badge) : null);
  }), nodes.map(n => {
    const p = pos[n.id];
    if (!p) return null;
    const catId = mtTopCat(n, byId);
    const cat = cats.find(c => c.id === catId);
    const dim = hlSet && !hlSet.has(n.id);
    const age = n.age ?? 30;
    const fresh = recency && n.daily && age <= 7;
    const off = hidden && hidden.has(n.id);
    const sz = n.person ? 17 : n.ev != null ? 9 + Math.min(n.ev, 24) * 0.3 : (n.sub ? 9 : 14) + (recency && n.daily ? age <= 2 ? 4 : age <= 7 ? 2 : 0 : 0);
    const showLab = labKeep.has(n.id);
    const labL = p.x * view.z + view.x > (ref.current ? ref.current.clientWidth : 480) / 2;
    return React.createElement("div", {
      key: n.id,
      className: "mmt-node mmt-dotnode" + (n.sub ? " is-leaf" : "") + (n.person ? " is-person" : "") + (sel === n.id ? " is-sel" : "") + (showLab ? " is-showlab" : "") + (dim ? " is-dim" : "") + (off ? " is-off" : "") + (labL ? " is-labL" : "") + (fresh ? " is-fresh" : "") + (n.daily && !n.learn && !n.maj ? " is-rare" : "") + (n.learn && !n.sub ? " is-known" : "") + (n.daily && n.age === 0 ? " is-today" : "") + (findSet && n.daily && findSet.has(n.id) ? " is-hit" : ""),
      style: {
        "--hue": !n.quiet && n.hue != null ? n.hue : cat ? cat.hue : 250,
        animationDelay: 0.12 + Math.min(0.45, Math.hypot(p.x, p.y) / 1500) + "s",
        width: sz,
        height: sz,
        transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${itemScale})`
      },
      title: n.label,
      onClick: e => {
        e.stopPropagation();
        if (n.quiet) goToNode(n.id);else selectItem(n.id);
      }
    }, n.person ? React.createElement("span", {
      className: "mmt-pdot",
      style: {
        "--deg": Math.round((n.score || 0) * 360) + "deg"
      }
    }) : React.createElement("span", {
      className: "mmt-ddot"
    }), React.createElement("span", {
      className: "mmt-dlab",
      style: {
        fontSize: n.sub ? dotFs * 0.9 : dotFs
      }
    }, n.daily ? n.tag : n.label, n.ctx ? React.createElement("span", {
      className: "mmt-dlab-ctx"
    }, " · " + n.ctx) : null));
  }))), rail ? React.createElement(MTBranchChips, {
    cats: cats,
    activeCat: activeCat,
    atHome: atHome,
    crumbs: crumbs,
    onCrumb: id => {
      if (hint === 1) hintDone();
      if (id === "home") {
        if (openGroup) leaveGroup();else {
          clearSel();
          if (!sel && !hlCat) {
            const t = fitAllTarget();
            if (t) tweenTo(t);
          }
        }
      } else clearSel();
    },
    onPick: id => {
      if (grouped) {
        enterGroup(id);
      } else if (activeCat === id) {
        clearSel();
      } else {
        selectCat(id);
      }
    },
    findOpen: findOpen,
    onFind: () => findOpen ? closeFind() : openFind(),
    query: query,
    onQuery: setQuery,
    fWeek: fWeek,
    fRare: fRare,
    onWeek: () => setFWeek(v => !v),
    onRare: () => setFRare(v => !v)
  }) : React.createElement("div", {
    className: "mmt-chip mmt-ui"
  }, allAnswers.length, " answers · ", cats.length, " branches"), !rail && (hlCat || selAnchor) ? React.createElement("button", {
    className: "mmt-clearhl mmt-ui",
    onClick: clearSel
  }, "✕ full map") : null, React.createElement("div", {
    className: "mmt-zoomctl mmt-ui"
  }, React.createElement("button", {
    className: "fitb",
    onClick: () => {
      const t = fitAllTarget();
      if (t) tweenTo(t);
    },
    "aria-label": "Fit map"
  }, "⌖"), answers.length > 1 && maxAge > 0 ? React.createElement("button", {
    className: "fitb",
    onClick: () => cut == null ? openScrub() : closeScrub(),
    "aria-label": cut == null ? "Replay the map" : "Close replay"
  }, cut == null ? "↺" : "✕") : null), hintTxt && !sel && !findOpen && cut == null ? React.createElement("button", {
    className: "mmt-hint mmt-coach mmt-ui",
    onClick: () => hint === 0 ? setHint(0.5) : hintDone()
  }, hintTxt) : null, recenter ? React.createElement("button", {
    className: "mmt-recenter mmt-ui",
    style: {
      left: recenter.x,
      top: recenter.y
    },
    onClick: () => {
      const t = fitAllTarget();
      if (t) tweenTo(t);
    },
    "aria-label": "Back to the whole map"
  }, React.createElement("span", null, "You"), React.createElement("span", {
    className: "mmt-recenter-arrow",
    style: {
      transform: `rotate(${recenter.deg}deg)`
    },
    "aria-hidden": "true"
  }, "→")) : null, cut != null ? React.createElement("div", {
    className: "mmt-scrub mmt-ui"
  }, React.createElement("input", {
    type: "range",
    min: "0",
    max: maxAge,
    step: "0.01",
    value: cut,
    "aria-label": "Map history",
    onChange: e => {
      cancelAnimationFrame(scrubAnim.current);
      setCut(parseFloat(e.target.value));
    }
  })) : null, sel || findOpen ? React.createElement("div", {
    className: "mmt-card mmt-ui is-" + cardMode,
    style: {
      "--hue": cardHue
    },
    onTouchStart: e => {
      cardTouch.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    },
    onTouchEnd: e => {
      const t0 = cardTouch.current;
      cardTouch.current = null;
      if (!t0 || !e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - t0.x,
        dy = e.changedTouches[0].clientY - t0.y;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) swipeNext(dx < 0 ? 1 : -1);
    }
  }, React.createElement("button", {
    className: "mmt-card-x",
    onClick: () => sel ? clearSel() : closeFind(),
    "aria-label": "Close"
  }, "✕"), React.createElement(window.MTCardGrab, {
    mode: cardMode,
    onMode: setCardMode
  }), sibNav ? React.createElement(window.MTCardNav, sibNav) : null, sel === "root" ? React.createElement(MTRootCard, {
    count: allAnswers.length,
    anchorCount: anchors.length
  }) : selAnchor ? React.createElement(MTAnchorCard, {
    anchor: selAnchor,
    items: anchorRows,
    onPick: selectItem,
    anchors: anchors,
    onAnchor: selectAnchor,
    key: selAnchor.id
  }) : selCat ? selCat.id === "circle-read" && window.MTPeopleCard ? React.createElement(MTPeopleCard, {
    onPick: selectItem,
    key: "people"
  }) : selCat.pulse && window.MTPulseCard ? React.createElement(window.MTPulseCard, {
    cat: selCat,
    count: catCount(selCat.id),
    key: "pulse"
  }) : selCat.fore && window.MTForeBranchCard ? React.createElement(MTForeBranchCard, {
    cat: selCat,
    onPick: selectItem,
    key: selCat.id
  }) : React.createElement(MTBranchCard, {
    cat: selCat,
    items: answers.filter(n => mtTopCat(n, byId) === selCat.id).sort((a, b) => a.age - b.age).map(tok),
    onPick: selectItem
  }) : selIsSub ? selNode.fore && window.MTForeDimCard ? React.createElement(window.MTForeDimCard, {
    node: selNode,
    onPick: selectItem,
    key: selNode.id
  }) : selNode.learn && window.MTLearnSubCard ? React.createElement(MTLearnSubCard, {
    node: selNode,
    rows: answers.filter(n => n.parentId === selNode.id).sort((a, b) => a.age - b.age),
    onPick: selectItem,
    key: selNode.id
  }) : React.createElement(MTSubCard, {
    node: selNode,
    cat: selNodeCat,
    rows: answers.filter(n => n.parentId === selNode.id).sort((a, b) => a.age - b.age),
    anchors: anchors,
    activeA: pairA || anchors[0] && anchors[0].id,
    onFilter: aid => setPairA(aid)
  }) : selNode ? selNode.fore && window.MTForeCard ? React.createElement(MTForeCard, {
    node: selNode,
    key: selNode.id
  }) : selNode.pulse && window.MTPulseCard ? React.createElement(window.MTPulseCard, {
    node: selNode,
    key: selNode.id
  }) : selNode.walk && window.MTPathsCard ? React.createElement(window.MTPathsCard, {
    node: selNode,
    key: selNode.id
  }) : selNode.learn && window.MTLearnCard ? React.createElement(MTLearnCard, {
    node: selNode,
    key: selNode.id
  }) : selNode.person && window.MTPersonCard ? React.createElement(MTPersonCard, {
    node: selNode,
    key: selNode.id
  }) : React.createElement(MTAnswerCard, {
    node: selNode,
    cat: selNodeCat,
    anchors: anchors,
    activeA: effFilter,
    onFilter: aid => setPairA(aid)
  }) : findOpen ? React.createElement(window.MTFindCard, {
    matches: matches,
    total: allAnswers.length,
    active: findActive,
    hueOf: hueOf,
    onPick: goToNode,
    key: "find"
  }) : null) : null);
}
window.MapTab = MapTab;
