// question-map.jsx — the Map lens as a RING: every question in the pool is a
// dot on a rim, grouped by topic, and a tie between two questions is a chord
// through the middle. What the picture says, in plain words (and the card says
// them too, above the field):
//   dot        · solid = you answered it, hollow = still open — one size
//   band       · the coloured arc outside the rim names the topic
//   chord      · the two answers go together; dashed = they go opposite ways;
//               thicker = stronger. At rest only the strongest ten speak, the
//               rest whisper — every link at once is a hairball.
//   callout    · the strongest link is written on the field itself
//   hub        · how many of the pool you have answered
// Tap a dot and the field dims to that question's own three ties; the card
// underneath says each one out loud: "Pick this — and 78% pick that."
(function () {
  const S = 352,
    C = 176,
    R = 131,
    RA = 142,
    RL = 158,
    GAP = 2.6,
    FIG_N = 10;
  const f1 = v => Math.round(v * 10) / 10;
  const catHue = cat => {
    const t = (window.WORLD_TOPICS || []).find(x => x.id === cat);
    const m = t && /([-\d.]+)\s*\)\s*$/.exec(t.color);
    return m ? parseFloat(m[1]) : 282;
  };
  const catLabel = cat => ((window.WORLD_TOPICS || []).find(x => x.id === cat) || {}).label || cat || 'other';
  // the field's palette: lifted topic hues on the dusk ground (paper swaps them via .lens-paper)
  const paper = () => !!document.querySelector('.app.lens-paper');
  const dotCol = h => paper() ? 'oklch(0.56 0.10 ' + h + ')' : 'oklch(0.76 0.10 ' + h + ')';
  const arcCol = h => paper() ? 'oklch(0.62 0.11 ' + h + ')' : 'oklch(0.66 0.11 ' + h + ')';
  const labCol = h => paper() ? 'oklch(0.50 0.11 ' + h + ')' : 'oklch(0.80 0.09 ' + h + ')';
  const inkCol = h => 'oklch(0.46 0.11 ' + h + ')'; // hue as text on the light card

  // ── the ring: questions grouped by topic (topic order), gaps between groups ──
  // memoised on the pool's identity — the layout never depends on answers
  let _ring = null;
  function ring(Q) {
    if (_ring && _ring.n === Q.length && _ring.q0 === Q[0] && Q[0]) return _ring;
    const order = (window.WORLD_TOPICS || []).map(t => t.id);
    const cats = [...new Set(Q.map(q => q.cat))].sort((a, b) => {
      const ia = order.indexOf(a),
        ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const groups = cats.map(c => ({
      cat: c,
      idx: Q.map((q, i) => i).filter(i => Q[i].cat === c)
    }));
    const step = Math.PI * 2 / (Q.length + groups.length * GAP);
    const pt = (rad, a) => [f1(C + rad * Math.cos(a)), f1(C + rad * Math.sin(a))];
    const pts = new Array(Q.length),
      arcs = [],
      labels = [];
    let ang = -Math.PI / 2 + step * GAP / 2;
    groups.forEach(g => {
      const a0 = ang;
      g.idx.forEach((i, k) => {
        const a = ang + step * k;
        const [x, y] = pt(R, a);
        pts[i] = {
          i,
          a,
          x,
          y
        };
      });
      const a1 = ang + step * (g.idx.length - 1);
      ang = a1 + step * (1 + GAP);
      const h = catHue(g.cat);
      const [sx, sy] = pt(RA, a0 - step * 0.45),
        [ex, ey] = pt(RA, a1 + step * 0.45);
      const big = a1 - a0 + step * 0.9 > Math.PI ? 1 : 0;
      arcs.push({
        cat: g.cat,
        h,
        d: 'M ' + sx + ' ' + sy + ' A ' + RA + ' ' + RA + ' 0 ' + big + ' 1 ' + ex + ' ' + ey
      });
      const mid = (a0 + a1) / 2,
        [lx, ly] = pt(RL, mid);
      const deg = mid * 180 / Math.PI + (Math.sin(mid) < 0 ? 90 : -90);
      // a short group gets no arc label — it would overrun its own band
      labels.push({
        cat: g.cat,
        h,
        x: lx,
        y: ly,
        tr: 'rotate(' + deg.toFixed(1) + ' ' + lx + ' ' + ly + ')',
        text: catLabel(g.cat).toUpperCase(),
        fits: g.idx.length * step * RL > catLabel(g.cat).length * 7.6 + 8
      });
    });
    return _ring = {
      n: Q.length,
      q0: Q[0],
      pts,
      arcs,
      labels,
      step
    };
  }
  // a chord bundled toward the hub; t = where along it a label may sit
  const chordD = (A, B) => {
    const mx = (A.x + B.x) / 2,
      my = (A.y + B.y) / 2,
      k = 0.2;
    return {
      d: 'M ' + A.x + ' ' + A.y + ' Q ' + f1(C + (mx - C) * k) + ' ' + f1(C + (my - C) * k) + ' ' + B.x + ' ' + B.y,
      qx: C + (mx - C) * k,
      qy: C + (my - C) * k
    };
  };
  const chordAt = (A, B, t) => {
    const c = chordD(A, B);
    return {
      x: (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * c.qx + t * t * B.x,
      y: (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * c.qy + t * t * B.y
    };
  };
  function QuestionMap({
    topic,
    onUse
  }) {
    const [sel, setSel] = React.useState(null);
    const [burst, setBurst] = React.useState(null); // {i, t} — the dot just answered, for the reward beat
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => window.PAT.sub(force), []);
    const Q = window.PAT.qs(),
      A = window.PAT.answers();
    const RG = ring(Q);
    const hubs = window.QMAP.hubs();
    const all = window.QMAP.edges(3);
    const pick = i => {
      setSel(s => s === i ? null : i);
      if (window.HAPTIC) window.HAPTIC.tick();
      if (onUse) onUse();
    };
    const inTopic = i => topic === 'all' || Q[i].cat === topic;

    // the drawn web: at rest the strongest ten at full voice, the rest a whisper;
    // once a question is chosen the field dims to that question's own three.
    const nb = sel == null ? null : window.QMAP.near(sel, 3);
    const near = sel == null ? null : new Set(nb.map(x => x.j));
    const rest = all.filter(l => inTopic(l.i) && inTopic(l.j)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const shown = sel == null ? rest : nb.map(x => ({
      i: sel,
      j: x.j,
      r: x.r
    }));
    const selHue = sel == null ? null : catHue(Q[sel].cat);
    const q = sel == null ? null : Q[sel];
    const say = sel == null ? null : nb.map(x => window.QMAP.say(sel, x.j)).filter(Boolean);
    // the unanswered question most tied to everything else — the best next tap
    let nxt = null;
    if (sel == null) {
      let best = -1;
      Q.forEach((x, i) => {
        if (A[x.id] == null && inTopic(i) && hubs[i] > best) {
          best = hubs[i];
          nxt = i;
        }
      });
    }
    // idle: the strongest tie under the current topic filter, said on the field and below it
    const top = sel == null && rest.length ? rest[0] : null;
    const topSay = top ? window.QMAP.say(top.i, top.j) : null;
    const nAns = Q.filter(x => A[x.id] != null).length;
    const callout = topSay ? (() => {
      const P = chordAt(RG.pts[top.i], RG.pts[top.j], 0.26);
      const text = topSay.pick + ' \u2194 ' + topSay.then + ' \u00b7 ' + topSay.pct + '%';
      const w = Math.min(150, text.length * 6.1 + 18);
      return {
        x: f1(P.x),
        y: f1(P.y),
        w,
        text
      };
    })() : null;
    const topicWord = topic === 'all' ? '' : ' in ' + catLabel(topic);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "card ln-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ln-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ln-title"
    }, "How your questions connect"), /*#__PURE__*/React.createElement("div", {
      className: "ln-sub"
    }, "Every question is a dot. A line joins two questions when how people answer one predicts how they answer the other. Thicker line = stronger link.")), /*#__PURE__*/React.createElement("div", {
      className: "ln-field"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "ln-svg",
      viewBox: '0 0 ' + S + ' ' + S,
      role: "img",
      "aria-label": "Every question on a ring, grouped by topic; lines join questions whose answers predict each other",
      onClick: () => {
        if (sel != null) setSel(null);
      }
    }, /*#__PURE__*/React.createElement("g", null, shown.map((l, k) => {
      const a = RG.pts[l.i],
        b = RG.pts[l.j];
      if (!a || !b) return null;
      const lit = sel != null;
      const fig = !lit && k < FIG_N;
      const bt = lit && burst && burst.i === sel ? burst.t : '';
      const draw = lit && l.r >= 0; // opposite links keep their dashes — the dash IS the meaning
      return /*#__PURE__*/React.createElement("path", {
        key: l.i + '-' + l.j + bt,
        d: chordD(a, b).d,
        fill: "none",
        pathLength: draw ? 1 : undefined,
        className: draw ? 'qm-drawin' : undefined,
        style: draw ? {
          animationDelay: k * 0.07 + 's'
        } : undefined,
        stroke: lit ? dotCol(selHue) : 'var(--ln-line)',
        strokeWidth: lit ? 1.4 + Math.abs(l.r) * 2.6 : fig ? 1.2 + Math.abs(l.r) * 1.6 : 0.8,
        strokeDasharray: l.r < 0 ? '2.5 3.5' : undefined,
        strokeLinecap: "round",
        opacity: lit ? 0.85 : fig ? 0.6 : 0.13
      });
    })), /*#__PURE__*/React.createElement("g", null, RG.arcs.map(a => /*#__PURE__*/React.createElement("path", {
      key: a.cat,
      d: a.d,
      fill: "none",
      stroke: arcCol(a.h),
      strokeWidth: "3",
      strokeLinecap: "round",
      opacity: topic === 'all' || topic === a.cat ? 0.92 : 0.28
    })), RG.labels.map(l => l.fits ? /*#__PURE__*/React.createElement("text", {
      key: l.cat,
      x: l.x,
      y: l.y,
      transform: l.tr,
      fill: labCol(l.h),
      textAnchor: "middle",
      dominantBaseline: "middle",
      opacity: topic === 'all' || topic === l.cat ? 1 : 0.35,
      style: {
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '.11em'
      }
    }, l.text) : null)), /*#__PURE__*/React.createElement("circle", {
      cx: C,
      cy: C,
      r: "42",
      fill: "var(--ln-hub)",
      stroke: "var(--ln-ring)",
      strokeWidth: "1"
    }), /*#__PURE__*/React.createElement("text", {
      x: C,
      y: C - 2,
      fill: "var(--ln-ink)",
      textAnchor: "middle",
      style: {
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: '-0.02em'
      }
    }, nAns, " of ", Q.length), /*#__PURE__*/React.createElement("text", {
      x: C,
      y: C + 14,
      fill: "var(--ln-sub)",
      textAnchor: "middle",
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '.1em'
      }
    }, "ANSWERED"), /*#__PURE__*/React.createElement("g", null, RG.pts.map(p => {
      if (!p) return null;
      const i = p.i,
        answered = A[Q[i].id] != null;
      if (i === nxt) return null; // the beacon draws it on the top layer
      const dim = sel != null ? i !== sel && !near.has(i) : !inTopic(i);
      const h = catHue(Q[i].cat),
        col = dotCol(h);
      return /*#__PURE__*/React.createElement("g", {
        key: i,
        onClick: e => {
          e.stopPropagation();
          pick(i);
        },
        style: {
          cursor: 'pointer'
        }
      }, /*#__PURE__*/React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: "11",
        fill: "transparent"
      }), i === sel && /*#__PURE__*/React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: "8",
        fill: "none",
        stroke: col,
        strokeWidth: "1.4",
        opacity: "0.7"
      }), burst && burst.i === i && /*#__PURE__*/React.createElement("circle", {
        key: 'b' + burst.t,
        className: "qm-bloom",
        cx: p.x,
        cy: p.y,
        r: "9",
        fill: "none",
        stroke: col,
        strokeWidth: "2"
      }), /*#__PURE__*/React.createElement("circle", {
        key: burst && burst.i === i ? 'd' + burst.t : 'd',
        className: burst && burst.i === i ? 'qm-pop' : undefined,
        cx: p.x,
        cy: p.y,
        r: "3.1",
        fill: answered ? col : 'var(--ln-halo)',
        stroke: answered ? 'none' : col,
        strokeWidth: answered ? 0 : 1.3,
        opacity: dim ? 0.22 : answered ? 1 : 0.8
      }));
    })), callout && /*#__PURE__*/React.createElement("g", {
      style: {
        pointerEvents: 'none'
      }
    }, /*#__PURE__*/React.createElement("rect", {
      x: f1(callout.x - callout.w / 2),
      y: callout.y - 10,
      width: callout.w,
      height: "20",
      rx: "10",
      fill: "var(--ln-hub)",
      stroke: "var(--ln-ring)",
      strokeWidth: "1"
    }), /*#__PURE__*/React.createElement("text", {
      x: callout.x,
      y: callout.y,
      fill: "var(--ln-ink)",
      textAnchor: "middle",
      dominantBaseline: "central",
      style: {
        fontSize: 10.5,
        fontWeight: 800
      }
    }, callout.text)), nxt != null && RG.pts[nxt] && (() => {
      const p = RG.pts[nxt];
      const right = p.x > C;
      const lx = f1(C + (R - 14) * Math.cos(p.a)),
        ly = f1(C + (R - 14) * Math.sin(p.a) + 3.5);
      return /*#__PURE__*/React.createElement("g", {
        onClick: e => {
          e.stopPropagation();
          pick(nxt);
        },
        style: {
          cursor: 'pointer'
        }
      }, /*#__PURE__*/React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: "15",
        fill: "transparent"
      }), /*#__PURE__*/React.createElement("circle", {
        className: "ln-pulse",
        cx: p.x,
        cy: p.y,
        r: "6",
        fill: "none",
        stroke: "var(--ln-beacon)",
        strokeWidth: "1.5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: "5",
        fill: "var(--ln-beacon)"
      }), /*#__PURE__*/React.createElement("text", {
        x: lx,
        y: ly,
        textAnchor: right ? 'end' : 'start',
        fill: "var(--ln-beacon)",
        stroke: "var(--ln-halo)",
        strokeWidth: "4",
        strokeLinejoin: "round",
        paintOrder: "stroke",
        style: {
          fontSize: 10.5,
          fontWeight: 800
        }
      }, "Answer next ", '\u2192'));
    })())), /*#__PURE__*/React.createElement("div", {
      className: "ln-key",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-dot"
    }), "you answered it"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-ring"
    }), "not yet"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-line"
    }), "answers go together"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-dash"
    }), "answers go opposite ways")), /*#__PURE__*/React.createElement("div", {
      className: "ln-hint"
    }, sel == null ? 'Tap a dot to light up only its links.' : 'Tap the field to see every link again.')), q ? /*#__PURE__*/React.createElement("div", {
      className: "qm-read"
    }, /*#__PURE__*/React.createElement("div", {
      className: "qm-qhead"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt-cat",
      style: {
        background: window.WPAL.wash('oklch(0.56 0.11 ' + selHue + ')', 16),
        color: inkCol(selHue)
      }
    }, catLabel(q.cat)), A[q.id] != null ? /*#__PURE__*/React.createElement("span", {
      className: "qm-yours"
    }, "you said ", q.options[A[q.id]].label) : null), /*#__PURE__*/React.createElement("div", {
      className: "qm-prompt"
    }, q.prompt), A[q.id] == null && /*#__PURE__*/React.createElement("div", {
      className: "qm-opts"
    }, q.options.map((op, k) => /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "qm-opt",
      onClick: () => {
        window.PAT.answer(q.id, k);
        setBurst({
          i: sel,
          t: Date.now()
        });
        if (window.HAPTIC) window.HAPTIC.tick();
      }
    }, op.label))), /*#__PURE__*/React.createElement("div", {
      className: "qm-says"
    }, say.map((s, k) => /*#__PURE__*/React.createElement("div", {
      className: "qm-say",
      key: k
    }, /*#__PURE__*/React.createElement("span", {
      className: "qm-saytext"
    }, "Pick ", /*#__PURE__*/React.createElement("b", null, s.pick), " here", '\u2009\u2014\u2009', "and ", /*#__PURE__*/React.createElement("b", null, s.pct, "%"), " pick ", /*#__PURE__*/React.createElement("b", null, s.then), " on ", '\u201c' + s.to.prompt + '\u201d'), /*#__PURE__*/React.createElement("span", {
      className: "qm-saybar"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: s.pct + '%',
        background: window.WPAL.wash('oklch(0.56 0.11 ' + selHue + ')', 44)
      }
    }), /*#__PURE__*/React.createElement("em", {
      style: {
        left: s.base + '%'
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "qm-base"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        left: Math.max(12, Math.min(86, s.base)) + '%'
      }
    }, "usually ", s.base, "%")), s.youFollowed === false && /*#__PURE__*/React.createElement("span", {
      className: "qm-break"
    }, "you went ", s.other)))), say.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        paddingTop: 8,
        borderTop: '1px solid color-mix(in oklch, var(--rule), transparent 30%)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        textWrap: 'pretty'
      }
    }, "Each link is a straight count over everyone who answered both ", '\u00b7', " the ", '\u201c', "usually", '\u201d', " mark is how the crowd splits regardless.")) : /*#__PURE__*/React.createElement("div", {
      className: "qm-read"
    }, topSay ? /*#__PURE__*/React.createElement("button", {
      className: "qm-tie2",
      onClick: () => pick(top.i)
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt-kick",
      style: {
        color: 'var(--accent-ink)'
      }
    }, "Strongest link", topicWord), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.5,
        color: 'var(--ink-2)',
        textWrap: 'pretty'
      }
    }, "People who pick ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 800,
        color: inkCol(catHue(Q[top.i].cat))
      }
    }, topSay.pick), " on ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--serif)',
        color: 'var(--ink)'
      }
    }, '\u201c' + topSay.from.prompt + '\u201d'), " mostly go on to pick ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 800,
        color: inkCol(catHue(Q[top.j].cat))
      }
    }, topSay.then), " on ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--serif)',
        color: 'var(--ink)'
      }
    }, '\u201c' + topSay.to.prompt + '\u201d')), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color: 'var(--accent-ink)'
      }
    }, topSay.pct, "%"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "of them do ", '\u00b7', " counted over everyone who answered both ", '\u00b7', " tap to open"))) : /*#__PURE__*/React.createElement("div", {
      className: "qm-idle"
    }, /*#__PURE__*/React.createElement("b", null, all.length), /*#__PURE__*/React.createElement("span", null, "links hold across the ", Q.length, " questions in the pool; the strongest are drawn. Tap any dot to read its own."))));
  }
  Object.assign(window, {
    QuestionMap
  });
})();