// result-card.jsx — test profile cards: each test keeps the shared banner
// language but owns its NATIVE geometry:
//   big5 → petal rose · politics → 2D compass plane · values → tension spine
//   social → orbit field (closer to centre = more you)
// Banner: rarity as a lit 100-dot field + the two types you nearly were.
// Second section: "where you differ" — only the dims where you deviate most.

(function () {
  if (document.getElementById('rpv2-style')) return;
  const s = document.createElement('style');
  s.id = 'rpv2-style';
  s.textContent = `@keyframes rpv2In{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
.rpv2-pop{animation:rpv2In .55s cubic-bezier(.2,.85,.3,1.08) backwards}
@keyframes rpv2Fade{from{opacity:0}to{opacity:1}}
.rpv2-fade{animation:rpv2Fade .5s ease backwards}
@keyframes rpv2Bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.rpv2-bar{animation:rpv2Bar .6s cubic-bezier(.25,.8,.3,1) backwards}`;
  document.head.appendChild(s);
})();

// ── result privacy — same contract as anonymous answers: default public; a
// private result stays yours (hidden when others view your map).
window.TEST_PRIVACY = window.TEST_PRIVACY || function () {
  const LS = 'insight.testPrivate.v1';
  let m = {};
  try {
    m = JSON.parse(localStorage.getItem(LS) || '{}') || {};
  } catch (e) {
    m = {};
  }
  const subs = new Set();
  const save = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(m));
    } catch (e) {}
  };
  return {
    isPrivate: k => !!m[k],
    set(k, on) {
      if (on) m[k] = true;else delete m[k];
      save();
      subs.forEach(f => f());
    },
    toggle(k) {
      this.set(k, !m[k]);
    },
    subscribe(f) {
      subs.add(f);
      return () => subs.delete(f);
    }
  };
}();
// the same glasses glyph the questions' anonymous dot uses
function rpv2Glasses(sz) {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: sz,
    height: sz,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4.5 12.5h15"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.5 12.5l1.3-5a1.8 1.8 0 0 1 1.75-1.35h2.9a1.8 1.8 0 0 1 1.75 1.35l1.3 5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.6",
    cy: "16.7",
    r: "2.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15.4",
    cy: "16.7",
    r: "2.1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.7 16.7h2.6"
  }));
}
const rpv2Deep = h => `oklch(0.46 0.13 ${h})`;
const rpv2Dot = h => `oklch(0.55 0.13 ${h})`;

// ── rarity, about YOU: a 100-person dot field, yours lit. The speckle IS the
// sentence — the numeral is a whisper. Seeded shuffle so the scatter is stable.
const rpv2Order = (() => {
  const idx = Array.from({
    length: 100
  }, (_, i) => i);
  let s = 48271;
  for (let i = 99; i > 0; i--) {
    s = s * 16807 % 2147483647;
    const j = s % (i + 1);
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx;
})();
function RarityField({
  pct,
  label,
  color,
  title
}) {
  const lit = new Set(rpv2Order.slice(0, Math.max(1, Math.min(100, Math.round(pct)))));
  return /*#__PURE__*/React.createElement("div", {
    className: "rpv2-fade",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexShrink: 0,
      animationDelay: 'var(--rv-2)'
    },
    title: title
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(25, 3px)',
      gap: 2
    }
  }, Array.from({
    length: 100
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 3,
      height: 3,
      borderRadius: '50%',
      background: lit.has(i) ? color : `color-mix(in oklch, ${color} 16%, var(--surface-3))`
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      fontWeight: 700,
      color: color,
      whiteSpace: 'nowrap'
    }
  }, label));
}

// ── signature emblem — the type rendered as its own shape, tone-on-tone in the
// test hue. Defining dims read darker; same-type friends orbit the rim.
function SigEmblem({
  testKey,
  sig,
  color,
  people,
  typeName,
  brief
}) {
  const mark = typeName && window.TypeMark ? window.TypeMark : null;
  const cfg = (window.RP_TESTS || {})[testKey];
  const ids = cfg ? Object.keys(cfg.hues).filter(id => sig && sig[id] != null) : [];
  if (!cfg || !ids.length) return null;
  const size = brief ? 76 : 170,
    C = size / 2,
    R = C - 3,
    r0 = brief ? 4 : 6,
    n = ids.length,
    slice = 360 / n,
    gapD = n > 6 ? 10 : 14;
  const rad = d => d * Math.PI / 180;
  const pt = (a, r) => [C + Math.cos(rad(a)) * r, C + Math.sin(rad(a)) * r];
  const gid = 'rpv2-emb-' + testKey;
  const ppl = brief ? [] : (people || []).slice(0, 4);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: brief ? 14 : -28,
      top: '50%',
      transform: 'translateY(-50%)',
      width: size,
      height: size,
      pointerEvents: 'none'
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
    id: gid
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: color,
    stopOpacity: "0.15"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: color,
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("circle", {
    cx: C,
    cy: C,
    r: R,
    fill: `url(#${gid})`
  }), mark ? null : ids.map((id, i) => {
    const raw = sig[id];
    const v = Math.max(16, cfg.bipolar ? Math.min(100, Math.abs(raw - 50) * 2) : raw);
    const a0 = -90 + i * slice + gapD / 2,
      a1 = -90 + (i + 1) * slice - gapD / 2;
    const r = r0 + v / 100 * (R - 14 - r0);
    const [xa, ya] = pt(a0, r0),
      [xb, yb] = pt(a0, r),
      [xc, yc] = pt(a1, r),
      [xd, yd] = pt(a1, r0);
    const op = 0.15 + Math.abs(raw - 50) / 50 * 0.22;
    return /*#__PURE__*/React.createElement("path", {
      key: id,
      className: "rpv2-pop",
      style: {
        transformOrigin: `${C}px ${C}px`,
        animationDelay: `calc(var(--rv-row) * ${i})`
      },
      d: `M ${xa.toFixed(1)} ${ya.toFixed(1)} L ${xb.toFixed(1)} ${yb.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xc.toFixed(1)} ${yc.toFixed(1)} L ${xd.toFixed(1)} ${yd.toFixed(1)} A ${r0} ${r0} 0 0 0 ${xa.toFixed(1)} ${ya.toFixed(1)} Z`,
      fill: color,
      opacity: op
    });
  })), mark ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "rpv2-pop",
    style: {
      display: 'inline-flex',
      animationDelay: '80ms'
    }
  }, React.createElement(mark, {
    testKey,
    name: typeName,
    size: brief ? 52 : 82
  }))) : null, window.Av ? ppl.map((p, i) => {
    const [x, y] = pt(132 + i * 33, R - 5);
    return /*#__PURE__*/React.createElement("span", {
      key: p.id,
      className: "rpv2-pop",
      style: {
        position: 'absolute',
        left: x - 10,
        top: y - 10,
        borderRadius: '50%',
        boxShadow: '0 0 0 2px var(--surface-2)',
        display: 'inline-flex',
        animationDelay: `${300 + i * 70}ms`
      }
    }, /*#__PURE__*/React.createElement(window.Av, {
      init: p.init,
      hue: p.hue,
      size: 20
    }));
  }) : null);
}

// ── generic bipolar rows: centre spine, pull toward your pole, avg ring ──
function TensionSpine({
  dims,
  poles,
  hues,
  avg,
  lead
}) {
  const pos = v => 5 + Math.max(0, Math.min(100, v)) / 100 * 90;
  const leadId = lead ? [...dims].sort((m, n) => Math.abs(n.value - 50) - Math.abs(m.value - 50))[0].id : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: 3,
      bottom: 3,
      width: 1,
      background: 'var(--rule)',
      transform: 'translateX(-50%)'
    }
  }), dims.map((d, i) => {
    const pp = poles && poles[d.id] || ['low', 'high'];
    const hue = hues && hues[d.id] != null ? hues[d.id] : (30 + i * 47) % 360;
    const col = rpv2Dot(hue);
    const right = d.value >= 50,
      youP = pos(d.value);
    const isLead = d.id === leadId;
    const lo = Math.min(50, youP),
      hi = Math.max(50, youP);
    const t = avg && avg[d.id] != null ? pos(avg[d.id]) : null;
    const poleStyle = isLean => ({
      fontFamily: 'var(--sans)',
      fontSize: isLead ? 12.5 : 11.5,
      whiteSpace: 'nowrap',
      fontWeight: isLean ? 700 : 500,
      color: isLean ? rpv2Deep(hue) : 'var(--ink-3)'
    });
    return /*#__PURE__*/React.createElement("div", {
      key: d.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...poleStyle(!right),
        width: 68,
        flexShrink: 0,
        textAlign: 'right'
      }
    }, pp[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        flex: 1,
        height: 15
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "rpv2-bar",
      style: {
        position: 'absolute',
        top: '50%',
        marginTop: isLead ? -2.5 : -1.5,
        height: isLead ? 5 : 3,
        borderRadius: 999,
        left: `${lo}%`,
        width: `${hi - lo}%`,
        transformOrigin: right ? 'left' : 'right',
        animationDelay: `calc(var(--rv-row) * ${i})`,
        background: `linear-gradient(${right ? '90deg' : '270deg'}, color-mix(in oklch, ${col}, transparent 80%), ${col})`
      }
    }), t != null && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: `${t}%`,
        transform: 'translate(-50%,-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--surface-2)',
        border: '1.4px solid var(--ink-3)',
        opacity: 0.6
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "rpv2-pop",
      style: {
        position: 'absolute',
        top: '50%',
        left: `${youP}%`,
        transform: 'translate(-50%,-50%)',
        width: isLead ? 15 : 12,
        height: isLead ? 15 : 12,
        borderRadius: '50%',
        background: col,
        border: '2px solid var(--surface-2)',
        boxShadow: '0 1px 4px -1px rgba(20,20,40,0.3)',
        animationDelay: `${i * 60 + 150}ms`
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        ...poleStyle(right),
        width: 68,
        flexShrink: 0,
        textAlign: 'left'
      }
    }, pp[1]));
  }));
}

// ── where you stand — every dim with your score, and the stretch between the
// average person and you drawn as a length. Biggest differences sort to the top.
// σ≈15 dim points across people, so the top row can be read as a percentile.
function rpv2Pctl(diff) {
  const p = 1 / (1 + Math.exp(-1.702 * (diff / 15)));
  const n = Math.max(1, Math.min(9, Math.round((diff > 0 ? p : 1 - p) * 10)));
  return `${diff > 0 ? 'higher' : 'lower'} than ${n} in 10 members`;
}
function DifferRows({
  testKey,
  R,
  cfg
}) {
  const avg = (window.IS_TEST_AVG || {})[testKey];
  const ph = (window.IS_STANDOUT || {})[testKey] || {};
  if (!avg) return null;
  const rows = R.dims.map((d, i) => ({
    d,
    i,
    diff: avg[d.id] != null ? d.value - avg[d.id] : 0
  })).sort((m, n) => Math.abs(n.diff) - Math.abs(m.diff));
  const pos = v => 4 + Math.max(0, Math.min(100, v)) / 100 * 92;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 17
    }
  }, rows.map(({
    d,
    i,
    diff
  }, k) => {
    const hue = cfg.hues[d.id] != null ? cfg.hues[d.id] : (30 + i * 47) % 360;
    const col = rpv2Dot(hue),
      deep = rpv2Deep(hue);
    const a = pos(avg[d.id]),
      y = pos(d.value);
    const lo = Math.min(a, y),
      hi = Math.max(a, y);
    const stand = Math.abs(diff) >= 6 && ph[d.id];
    const title = stand ? ph[d.id][diff > 0 ? 1 : 0] : d.label;
    const pp = cfg.poles && cfg.poles[d.id];
    const right = d.value >= 50;
    const f0 = cfg.bipolar ? pos(50) : pos(0);
    const fl = Math.min(f0, y),
      fw = Math.max(f0, y) - Math.min(f0, y);
    const poleStyle = isLean => ({
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      whiteSpace: 'nowrap',
      fontWeight: isLean ? 700 : 500,
      color: isLean ? deep : 'var(--ink-3)',
      width: 62,
      flexShrink: 0
    });
    return /*#__PURE__*/React.createElement("div", {
      key: d.id
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--ink)',
        lineHeight: 1.3
      }
    }, title.charAt(0).toUpperCase() + title.slice(1)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 15,
        fontWeight: 800,
        color: deep,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0
      },
      title: diff === 0 ? 'right at the average' : `${Math.abs(Math.round(diff))} points ${diff > 0 ? 'above' : 'below'} most people`
    }, Math.round(d.value))), k === 0 && Math.abs(diff) >= 6 ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        marginTop: -3,
        marginBottom: 7
      }
    }, rpv2Pctl(diff)) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, pp ? /*#__PURE__*/React.createElement("span", {
      style: {
        ...poleStyle(!right),
        textAlign: 'right'
      }
    }, pp[0]) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        flex: 1,
        height: 18
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 5,
        bottom: 5,
        left: 0,
        right: 0,
        borderRadius: 999,
        background: `color-mix(in oklch, ${col} 10%, var(--surface-3))`
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 5,
        bottom: 5,
        borderRadius: 999,
        left: `${fl}%`,
        width: `${fw}%`,
        background: `color-mix(in oklch, ${col}, transparent 42%)`
      }
    }), hi - lo > 1.5 ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 7,
        bottom: 7,
        borderRadius: 999,
        left: `${lo}%`,
        width: `${hi - lo}%`,
        background: deep
      }
    }) : null, cfg.bipolar ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 3,
        bottom: 3,
        left: '50%',
        width: 1.5,
        marginLeft: -0.75,
        borderRadius: 1,
        background: 'var(--surface)',
        boxShadow: '0 0 0 0.5px var(--rule)'
      }
    }) : null, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: `${a}%`,
        transform: 'translate(-50%,-50%)',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: 'var(--surface)',
        border: '1.5px solid var(--ink-3)',
        boxShadow: '0 0 0 1.5px var(--surface)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: `${y}%`,
        transform: 'translate(-50%,-50%)',
        width: 15,
        height: 15,
        borderRadius: '50%',
        background: col,
        border: '2.5px solid var(--surface)',
        boxShadow: `0 1px 5px -1px color-mix(in oklch, ${col}, transparent 40%)`
      }
    })), pp ? /*#__PURE__*/React.createElement("span", {
      style: {
        ...poleStyle(right),
        textAlign: 'left'
      }
    }, pp[1]) : null));
  }));
}

// ── the v2 card: banner (identity + rarity + near-misses) → native chart → differ ──
function ResultProfileCard({
  testKey,
  archetype,
  tagline,
  brief
}) {
  const [typesOpen, setTypesOpen] = React.useState(false);
  const [explain, setExplain] = React.useState(false);
  // brief: banner + rose only; the deep sections unfold on demand
  const [full, setFull] = React.useState(false);
  const [, bumpPriv] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => window.TEST_PRIVACY ? window.TEST_PRIVACY.subscribe(bumpPriv) : undefined, []);
  const deep = !brief || full;
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  const cfg = (window.RP_TESTS || {})[testKey];
  if (!R || !cfg || !R.dims || !R.dims.length) return null;
  const arch = window.IS_matchArchetype ? window.IS_matchArchetype(testKey, R.dims) : null;
  const you = arch ? arch.idx : -1;
  const fits = arch ? arch.fits : null;
  const rar = window.IS_profileRarity ? window.IS_profileRarity(testKey, R.dims) : null;
  const ruleParts = arch && window.IS_typeRuleParts ? window.IS_typeRuleParts(testKey, R.dims, arch.list[you]) : [];
  const near = arch ? arch.list.map((a, i) => ({
    a,
    i,
    d: fits[i],
    rms: arch.rmsOf[i]
  })).filter(x => x.i !== you).sort((m, n) => m.d - n.d).slice(0, 2).map((x, k) => ({
    ...x,
    why: window.IS_nearWhy ? window.IS_nearWhy(testKey, R.dims, x.a) : null,
    border: k === 0 && x.rms - arch.rms < 5
  })) : [];
  // fit strength, in dim points of separation from the runner-up
  const fit = arch ? arch.gap < 5 ? 'close' : arch.gap >= 12 && arch.rms < 12 ? 'textbook' : 'clear' : 'clear';
  const streak = fit === 'close' ? near[0].a.name.replace(/^The /, '') : null;
  // 'an Outlier streak', not 'a Outlier streak'
  const streakArt = streak && /^[aeiou]/i.test(streak) ? 'an' : 'a';
  // people of yours who landed on the same type
  const sameType = (() => {
    if (!arch) return [];
    const map = (window.IS_FRIEND_TYPES || {})[testKey] || {};
    const ppl = (window.IS_DATA || {}).people || [];
    return ppl.filter(p => map[p.id] === arch.list[you].name);
  })();
  const typeLine = arch ? arch.list[you].line : null;
  const sigDims = a => R.dims.map(d => ({
    id: d.id,
    label: d.id,
    value: a.sig[d.id] != null ? a.sig[d.id] : 50
  }));
  // passive coverage: how much of this test the feed has mapped so far
  const pct = window.PASSIVE ? window.PASSIVE.pct(testKey) : 100;
  const nLeft = window.PASSIVE ? Math.max(0, window.PASSIVE.needed(testKey) - window.PASSIVE.done(testKey)) : 0;
  const avg = (window.IS_TEST_AVG || {})[testKey];
  const hero = window.TestRose ? /*#__PURE__*/React.createElement(window.TestRose, {
    testKey: testKey,
    dims: R.dims,
    animate: true,
    compact: brief && !full
  }) : null;
  const otherAxes = null;
  const TP = window.TEST_PRIVACY;
  const priv = TP ? TP.isPrivate(testKey) : false;
  return /*#__PURE__*/React.createElement("div", {
    className: "rpv2-page",
    style: {
      padding: 0,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    title: pct < 100 ? `${nLeft} more answers to fully map this` : 'fully mapped',
    style: {
      height: 2,
      borderRadius: 99,
      background: `color-mix(in oklch, ${cfg.banner} 14%, var(--surface-3))`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rpv2-bar",
    style: {
      height: '100%',
      width: `${pct}%`,
      background: cfg.banner,
      transformOrigin: 'left',
      borderRadius: 99
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderBottom: '1px solid var(--rule)',
      padding: brief ? '14px 0 14px' : '16px 0 18px'
    }
  }, /*#__PURE__*/React.createElement(SigEmblem, {
    testKey: testKey,
    sig: arch ? arch.list[you].sig : R.dims.reduce((o, d) => (o[d.id] = d.value, o), {}),
    color: cfg.banner,
    people: sameType,
    typeName: arch ? arch.list[you].name : null,
    brief: brief
  }), TP ? /*#__PURE__*/React.createElement("button", {
    className: "press tap44",
    onClick: e => {
      e.stopPropagation();
      TP.toggle(testKey);
    },
    "aria-pressed": priv,
    "aria-label": priv ? 'Private — this result is hidden when others view your map' : 'Keep this result private',
    title: priv ? 'Private — hidden when others view your map' : 'Keep this result private — it won\u2019t show when others view your map',
    style: {
      position: 'absolute',
      top: 12,
      right: 0,
      zIndex: 2,
      width: 20,
      height: 20,
      borderRadius: '50%',
      border: priv ? 'none' : '0.5px solid var(--rule)',
      background: priv ? 'var(--ink)' : 'transparent',
      color: priv ? 'var(--surface)' : 'var(--ink-3)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      WebkitAppearance: 'none',
      padding: 0,
      transition: 'background .15s ease, color .15s ease'
    }
  }, rpv2Glasses(12)) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      paddingRight: brief ? 88 : 96
    }
  }, !brief ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker",
    style: {
      color: cfg.banner,
      marginBottom: 0
    }
  }, cfg.kicker), window.ExplainBtn && /*#__PURE__*/React.createElement(window.ExplainBtn, {
    onClick: () => setExplain(true),
    label: "What this measures"
  })), pct >= 100 && fit === 'textbook' ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      color: cfg.banner,
      whiteSpace: 'nowrap'
    }
  }, "textbook fit") : null) : null, false && ruleParts.length && deep ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      flexWrap: 'wrap',
      marginTop: 10
    }
  }, ruleParts.map((p, i) => {
    const h = cfg.hues[p.id] != null ? cfg.hues[p.id] : 40;
    const w = p.band === 'strong' ? 9 : 7,
      hh = p.band === 'strong' ? 8 : 6;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: p.id
    }, i ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--ink-3)'
      }
    }, "+") : null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: '-0.005em',
        color: rpv2Deep(h)
      }
    }, p.band === 'even' ? /*#__PURE__*/React.createElement("svg", {
      width: "9",
      height: "8",
      viewBox: "0 0 9 8",
      style: {
        flexShrink: 0
      },
      role: "img",
      "aria-label": "average"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "0",
      y: "3",
      width: "9",
      height: "2",
      fill: rpv2Dot(h)
    })) : /*#__PURE__*/React.createElement("svg", {
      width: w,
      height: hh,
      viewBox: `0 0 ${w} ${hh}`,
      style: {
        flexShrink: 0,
        transform: p.high ? 'none' : 'rotate(180deg)'
      },
      role: "img",
      "aria-label": p.high ? 'above average' : 'below average'
    }, /*#__PURE__*/React.createElement("path", {
      d: `M${w / 2} 0 L${w} ${hh} L0 ${hh} Z`,
      fill: rpv2Dot(h)
    })), p.text));
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--ink-3)',
      opacity: 0.7
    }
  }, '\u2192')) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 31,
      fontWeight: 500,
      letterSpacing: '-0.015em',
      lineHeight: 1.1,
      textTransform: 'capitalize',
      color: `color-mix(in oklch, ${cfg.banner} 78%, var(--ink))`
    }
  }, arch ? arch.list[you].name : archetype), brief && window.ExplainBtn ? /*#__PURE__*/React.createElement(window.ExplainBtn, {
    onClick: () => setExplain(true),
    label: "What this measures"
  }) : null), streak ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 12.5,
      fontWeight: 600,
      color: `color-mix(in oklch, ${cfg.banner} 72%, var(--ink))`,
      marginTop: 4,
      lineHeight: 1.35
    }
  }, "with ", streakArt, " ", streak, " streak") : null, typeLine || tagline ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 16,
      color: 'var(--ink-2)',
      marginTop: 7,
      lineHeight: 1.4,
      textWrap: 'pretty'
    }
  }, typeLine || tagline) : null, rar && deep ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(RarityField, {
    pct: rar.pct,
    label: rar.label.toLowerCase(),
    color: cfg.banner,
    title: `${rar.label.toLowerCase()} sit as far from average as you — also this type: ${sameType.map(p => p.name.split(' ')[0]).join(', ') || 'none of yours'}`
  })) : null)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 0 4px'
    }
  }, hero, hero && deep ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontFamily: 'var(--sans)',
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-3)'
    }
  }, cfg.bipolar ? 'petal length = how far from the middle you sit' : 'petal length = how strongly the trait shows') : null, arch && deep ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: 'var(--sans)',
      fontSize: 13,
      lineHeight: 1.55,
      color: 'var(--ink-2)',
      textWrap: 'pretty'
    }
  }, near.map(({
    a,
    why
  }, i) => /*#__PURE__*/React.createElement("span", {
    key: a.name
  }, i ? ' \u00b7 ' : '', why ? /*#__PURE__*/React.createElement(React.Fragment, null, why.charAt(0).toUpperCase() + why.slice(1), " and you'd be ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 700
    }
  }, a.name)) : /*#__PURE__*/React.createElement(React.Fragment, null, "Close to ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 700
    }
  }, a.name)))), window.TypeIndexSheet ? /*#__PURE__*/React.createElement(React.Fragment, null, " ", '\u00b7', " ", /*#__PURE__*/React.createElement("button", {
    className: "press",
    onClick: () => setTypesOpen(true),
    style: {
      border: 'none',
      background: 'none',
      padding: 0,
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: 700,
      color: cfg.banner,
      WebkitAppearance: 'none'
    }
  }, "all ", arch.list.length, " types ", '\u2192')) : null) : null, typesOpen && window.TypeIndexSheet ? /*#__PURE__*/React.createElement(window.TypeIndexSheet, {
    testKey: testKey,
    onClose: () => setTypesOpen(false)
  }) : null, otherAxes ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      paddingTop: 14,
      borderTop: '0.5px solid var(--rule)'
    }
  }, /*#__PURE__*/React.createElement(TensionSpine, {
    dims: otherAxes,
    poles: cfg.poles,
    hues: cfg.hues,
    avg: avg
  })) : null, avg && deep ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: testKey === 'values' ? 6 : 4,
      paddingTop: 14,
      borderTop: '0.5px solid var(--rule)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "kicker",
    style: {
      marginBottom: 12
    }
  }, "Where you stand"), /*#__PURE__*/React.createElement(DifferRows, {
    testKey: testKey,
    R: R,
    cfg: cfg
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginTop: 15,
      paddingTop: 12,
      borderTop: '0.5px solid var(--rule)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--sans)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: cfg.banner,
      border: '2px solid var(--surface-2)',
      boxShadow: '0 0 0 0.5px var(--rule)'
    }
  }), "you"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--sans)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--surface-2)',
      border: '1.4px solid var(--ink-3)'
    }
  }), "most people"))) : null, brief ? /*#__PURE__*/React.createElement("button", {
    className: "press",
    onClick: () => setFull(f => !f),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
      marginTop: 12,
      padding: '8px 0',
      borderRadius: 10,
      background: 'none',
      border: '0.5px solid var(--rule)',
      cursor: 'pointer',
      fontFamily: 'var(--sans)',
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink-3)',
      WebkitAppearance: 'none'
    }
  }, full ? 'Less' : 'Full breakdown', " ", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      transform: full ? 'rotate(180deg)' : 'none',
      transition: 'transform .18s'
    }
  }, '\u25be')) : null), explain && window.ExplainSheet ? /*#__PURE__*/React.createElement(window.ExplainSheet, {
    title: R.title,
    kicker: "test",
    dimKey: testKey,
    dims: R.dims.map(d => ({
      ...d,
      poles: cfg.poles ? cfg.poles[d.id] : null
    })),
    keyRows: [[window.EX_GLYPH.you(cfg.banner), 'The solid dot is you.'], [window.EX_GLYPH.most(), 'The hollow ring is where most people sit.'], [window.EX_GLYPH.petal(cfg.banner), cfg.bipolar ? 'Petal length is how far from the middle you sit — a long petal is a strong stance either way.' : 'Petal length is how strongly the trait shows.']],
    onClose: () => setExplain(false)
  }) : null);
}
Object.assign(window, {
  ResultProfileCard
});