// patterns-tab.jsx — PATTERNS: the map, and the oracle.
//   Map    — every question placed by how much its answer predicts the others
//            (question-map.js / .jsx). This is the tab's centre.
//   Oracle — the app guesses your next answer before you give it; beat it.
//            One instrument, no card (oracle.jsx / oracle.css).
// Chrome rules: ONE sub-row under the lens tabs (topic chips on the map, run
// progress on the oracle) so switching never jumps; each lens teaches its own
// marks (the footer legend on the map cards, the one-time hints on the oracle)
// — no separate explainer card; and no type below 10.5px anywhere, in SVG or
// out — anything smaller gets encoded as length, size or colour instead.
const PT_LENSES = [{
  id: 'oracle',
  label: 'Oracle'
}, {
  id: 'map',
  label: 'Question map'
}, {
  id: 'people',
  label: 'People map'
}];
// The same ruler the daily and the mirror wear — one axis, stops on a scale.
// Read left to right it widens: the oracle is one question about you, the
// question map is the whole pool, the people map is the whole crowd.
function PTRuler({
  lens,
  onLens,
  flush
}) {
  const idx = Math.max(0, PT_LENSES.findIndex(s => s.id === lens));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: flush ? 0 : '-6px 0 -2px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      height: 50
    },
    role: "tablist",
    "aria-label": "How wide this lens looks"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 6,
      right: 6,
      bottom: 21,
      height: 1,
      background: 'color-mix(in oklch, var(--rule), transparent 30%)'
    }
  }), PT_LENSES.map((s, i) => {
    const on = i === idx;
    const tick = 11 - i / (PT_LENSES.length - 1) * 5.5;
    return /*#__PURE__*/React.createElement("button", {
      key: s.id,
      role: "tab",
      "aria-selected": on,
      "aria-label": s.label,
      onClick: () => {
        if (s.id !== lens) {
          if (window.HAPTIC) window.HAPTIC.tick();
          onLens(s.id);
        }
      },
      style: {
        flex: 1,
        minWidth: 0,
        position: 'relative',
        height: 50,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        WebkitAppearance: 'none',
        padding: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: '50%',
        bottom: 21,
        transform: 'translateX(-50%)',
        width: on ? 3 : 1.5,
        height: on ? 14 : tick,
        borderRadius: 99,
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--ink-3), transparent 45%)',
        transition: 'height .28s cubic-bezier(0.2,0.8,0.2,1), background .3s, width .2s'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        fontWeight: on ? 700 : 500,
        letterSpacing: '-0.01em',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        transition: 'color .2s'
      }
    }, s.label));
  })));
}
const ptTopic = cat => (window.WORLD_TOPICS || []).find(t => t.id === cat);
function PatternsTab({
  lens: lensProp,
  onLens,
  ruler,
  onDock
}) {
  const [lensState, setLensRaw] = React.useState('map');
  const lens = lensProp || lensState;
  // docking, as on the daily: the in-flow ruler starts on the page. It folds away
  // once it scrolls out of the body OR once you use a lens (the lenses fill the
  // screen, so they rarely scroll); the header dots take over. Scrolling up past
  // the top brings it back. Capture phase because scroll doesn't bubble.
  const rulerEl = React.useRef(null),
    dockRef = React.useRef(false),
    hidRef = React.useRef(false);
  const [hid, setHid] = React.useState(false);
  React.useEffect(() => {
    if (!ruler) return;
    const wrap = wrapRef.current,
      host = wrap && wrap.closest('.app');
    if (!host) return;
    const body = () => wrap.closest('.app-body');
    let last = false;
    const push = () => {
      const v = dockRef.current || hidRef.current;
      if (v !== last) {
        last = v;
        if (onDock) onDock(v);
      }
    };
    const setHidden = v => {
      if (hidRef.current === v) return;
      hidRef.current = v;
      setHid(v);
      push();
    };
    const check = () => {
      const el = rulerEl.current,
        sc = body();
      if (!el || !sc) return;
      const r = el.getBoundingClientRect(),
        s = sc.getBoundingClientRect();
      // hysteresis: gone past the top edge docks, 8px back into view releases
      dockRef.current = dockRef.current ? r.bottom <= s.top + 8 : r.bottom <= s.top + 1;
      push();
    };
    const atTop = () => {
      const sc = body();
      return !sc || sc.scrollTop <= 1;
    };
    const inLens = t => !!(t && t.closest && t.closest('.pt-stack'));
    // after a tap or drag in a lens (pointerup, so the click lands before the layout moves)
    const onUp = e => {
      if (inLens(e.target)) setHidden(true);
    };
    const onWheel = e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (!hidRef.current && e.deltaY > 6 && inLens(e.target)) setHidden(true);else if (hidRef.current && e.deltaY < -6 && atTop()) setHidden(false);
    };
    let ty = 0,
      tx = 0,
      top0 = false;
    const onTS = e => {
      const t = e.touches[0];
      ty = t.clientY;
      tx = t.clientX;
      top0 = atTop();
    };
    const onTM = e => {
      if (!hidRef.current || !top0) return;
      const t = e.touches[0],
        dy = t.clientY - ty,
        dx = Math.abs(t.clientX - tx);
      if (dy > 36 && dx < dy * 0.6) setHidden(false);
    };
    const C = {
        capture: true,
        passive: true
      },
      U = {
        capture: true
      };
    host.addEventListener('scroll', check, C);
    wrap.addEventListener('pointerup', onUp, C);
    wrap.addEventListener('wheel', onWheel, C);
    wrap.addEventListener('touchstart', onTS, C);
    wrap.addEventListener('touchmove', onTM, C);
    return () => {
      host.removeEventListener('scroll', check, U);
      wrap.removeEventListener('pointerup', onUp, U);
      wrap.removeEventListener('wheel', onWheel, U);
      wrap.removeEventListener('touchstart', onTS, U);
      wrap.removeEventListener('touchmove', onTM, U);
      if (last && onDock) onDock(false);
    };
  }, [ruler, !!onDock]);
  // slide the incoming lens from the side you moved toward on the ruler
  const dirRef = React.useRef('');
  const lensRef0 = React.useRef(lens);
  const setLens = id => {
    const cur = lensRef0.current;
    if (id === cur) return;
    const a = PT_LENSES.findIndex(s => s.id === cur),
      b = PT_LENSES.findIndex(s => s.id === id);
    dirRef.current = b > a ? 'r' : 'l';
    if (onLens) onLens(id);else setLensRaw(id);
  };
  const [topic, setTopic] = React.useState('all');
  const [ppop, setPpop] = React.useState('world');
  // the explainer lives behind one i — it used to be a title, a paragraph and a
  // four-item legend above and below every lens
  const [info, setInfo] = React.useState(false);
  // same horizontal axis as the daily and the mirror: the lens body drags with
  // the finger and settles on the next stop of the ruler. Past the far end the
  // axis continues into the daily (patterns is the first nav stop, so a
  // right-swipe on the oracle has nowhere to go and springs back).
  const wrapRef = React.useRef(null),
    stackRef = React.useRef(null),
    lensRef = React.useRef(lens);
  lensRef.current = lens;
  lensRef0.current = lens;
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // a drag that starts inside a scroller or a field belongs to it — but the
    // lenses are tap-only, so a horizontal drag on their discs rides the axis
    const SKIP = 'canvas, .h-scroll, .mmt-swipe, .cb-rail, [data-nopan], input, textarea, .ln-rail';
    const skips = t => !!(t && t.closest && t.closest(SKIP));
    const T = () => stackRef.current;
    const spring = () => {
      const b = T();
      if (!b) return;
      b.style.transition = 'transform .25s cubic-bezier(0.2,0.9,0.2,1), opacity .25s ease';
      b.style.transform = 'translateX(0)';
      b.style.opacity = '1';
    };
    const commit = dir => {
      const i = PT_LENSES.findIndex(s => s.id === lensRef.current),
        ni = i + dir;
      if (ni < 0) {
        spring();
        return;
      }
      if (ni >= PT_LENSES.length) {
        spring();
        if (window.goNav) window.goNav('track:world');
        return;
      }
      const b = T();
      if (b) {
        b.style.transition = 'transform .16s ease, opacity .16s ease';
        b.style.transform = 'translateX(' + (dir > 0 ? -34 : 34) + 'px)';
        b.style.opacity = '0';
      }
      if (window.HAPTIC) window.HAPTIC.tick();
      setTimeout(() => setLens(PT_LENSES[ni].id), 110);
    };
    let sx = 0,
      sy = 0,
      dx = 0,
      horiz = null,
      dragging = false;
    const onStart = e => {
      const t = e.touches[0];
      if (skips(e.target)) {
        dragging = false;
        return;
      }
      sx = t.clientX;
      sy = t.clientY;
      dx = 0;
      horiz = null;
      dragging = true;
      const b = T();
      if (b) b.style.transition = 'none';
    };
    const onMove = e => {
      if (!dragging) return;
      const t = e.touches[0],
        mx = t.clientX - sx,
        my = t.clientY - sy;
      if (horiz === null && (Math.abs(mx) > 9 || Math.abs(my) > 9)) horiz = Math.abs(mx) > Math.abs(my) * 1.4;
      if (!horiz) return;
      e.preventDefault();
      dx = mx;
      const b = T();
      if (b) b.style.transform = 'translateX(' + dx * 0.42 + 'px)';
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const go = horiz && Math.abs(dx) > 56;
      if (go) commit(dx < 0 ? 1 : -1);else spring();
    };
    let wheelLock = false;
    const onWheel = e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) + 4) return;
      if (skips(e.target)) return;
      e.preventDefault();
      if (wheelLock || Math.abs(e.deltaX) < 24) return;
      if (Date.now() - (window.NAV_AT || 0) < 700) return;
      wheelLock = true;
      commit(e.deltaX > 0 ? 1 : -1);
      setTimeout(() => {
        wheelLock = false;
      }, 620);
    };
    el.addEventListener('touchstart', onStart, {
      passive: true
    });
    el.addEventListener('touchmove', onMove, {
      passive: false
    });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, {
      passive: false
    });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => window.PAT.sub(force), []);
  const st = window.PAT.stats();
  // only topics that actually have questions in the pool
  const cats = [...new Set(window.PAT.qs().map(q => q.cat))];
  const chips = [{
    id: 'all',
    label: 'All topics'
  }].concat(cats.map(c => ({
    id: c,
    label: (ptTopic(c) || {}).label || c
  })));
  // what the map holds, said once above it — this line does the legend's work
  const ties = window.QMAP ? window.QMAP.edges(3).length : 0;
  const topicLabel = (chips.find(c => c.id === topic) || chips[0]).label;
  return /*#__PURE__*/React.createElement("div", {
    className: "pt-wrap",
    ref: wrapRef
  }, !onLens && !ruler ? /*#__PURE__*/React.createElement(PTRuler, {
    lens: lens,
    onLens: setLens
  }) : null, ruler ? /*#__PURE__*/React.createElement("div", {
    ref: rulerEl,
    "aria-hidden": hid,
    style: {
      margin: hid ? '-6px 0 -8px' : '-6px 0 -2px',
      height: hid ? 0 : 50,
      opacity: hid ? 0 : 1,
      overflow: 'hidden',
      pointerEvents: hid ? 'none' : 'auto',
      transition: 'height .32s cubic-bezier(.2,.8,.2,1), margin .32s cubic-bezier(.2,.8,.2,1), opacity .18s ease'
    }
  }, /*#__PURE__*/React.createElement(PTRuler, {
    lens: lens,
    onLens: setLens,
    flush: true
  })) : null, /*#__PURE__*/React.createElement("div", {
    className: "pt-sub"
  }, lens === 'map' ? /*#__PURE__*/React.createElement("div", {
    className: "pt-meta"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: 'pt-info' + (info ? ' is-on' : ''),
    "aria-expanded": info,
    "aria-label": "Legend",
    onClick: () => setInfo(!info)
  }, "i"), /*#__PURE__*/React.createElement("label", {
    className: 'pt-topic' + (topic !== 'all' ? ' is-on' : '')
  }, /*#__PURE__*/React.createElement("span", null, topicLabel), /*#__PURE__*/React.createElement("select", {
    value: topic,
    onChange: e => setTopic(e.target.value),
    "aria-label": "Topic"
  }, chips.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.label))))) : lens === 'people' ? /*#__PURE__*/React.createElement("div", {
    className: "pt-meta"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: 'pt-info' + (info ? ' is-on' : ''),
    "aria-expanded": info,
    "aria-label": "Legend",
    onClick: () => setInfo(!info)
  }, "i"), /*#__PURE__*/React.createElement("div", {
    className: "pt-pops h-scroll",
    role: "tablist",
    "aria-label": "Population"
  }, window.PAT.pops().map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    role: "tab",
    "aria-selected": ppop === p.id,
    className: 'pt-pop' + (ppop === p.id ? ' is-on' : ''),
    onClick: () => setPpop(p.id)
  }, p.label)))) : /*#__PURE__*/React.createElement("div", {
    className: "pt-meta"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: 'pt-info' + (info ? ' is-on' : ''),
    "aria-expanded": info,
    "aria-label": "Legend",
    onClick: () => setInfo(!info)
  }, "i"), st.fromFeed > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      fontSize: 12,
      fontWeight: 650,
      color: 'var(--ink-3)',
      whiteSpace: 'nowrap'
    }
  }, st.fromFeed, " from feed votes"))), /*#__PURE__*/React.createElement("div", {
    key: lens,
    ref: stackRef,
    className: (dirRef.current ? 'pt-slide-' + dirRef.current : 'fade-in') + ' pt-stack'
  }, lens === 'map' && /*#__PURE__*/React.createElement(window.QuestionMap, {
    topic: topic,
    guide: info
  }), lens === 'oracle' && /*#__PURE__*/React.createElement(window.OracleLens, {
    guide: info
  }), lens === 'people' && window.PeopleLens && /*#__PURE__*/React.createElement(window.PeopleLens, {
    pop: ppop,
    guide: info,
    onOracle: () => setLens('oracle')
  })));
}
Object.assign(window, {
  PatternsTab
});