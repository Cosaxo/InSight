// people-lens.jsx — the People lens: the crowd as a shared field with no centre.
// The Mirror is radial (you at the origin, closer = more like you); this is
// deliberately the OTHER grammar — one plane that exists whether you look or
// not, and you sit wherever your answers put you. Honesty rules, as drawn:
//   position   · the only geometry — no axes, no rings, no lines between people
//   every dot  · a real member of the population; zero decorative dots or mist
//   colour     · says ONE thing in three plain steps: mostly agrees with you,
//                split, mostly disagrees — counted over the answers you share
//   size       · two steps — bigger = more answers in common; under 4, not drawn
//   numbers    · every claim states its basis ("agrees 9 of 12")
// The card says all of this in words above and below the field.
(function () {
  const S = 352,
    C = 176,
    RMAX = 150;
  const MIN_SHARED = 4,
    MIN_CROWD = 8,
    MIN_ANSWERED = 5;
  function h01(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 8) % 100000 / 100000;
  }
  const NAMES = ['Maya', 'Jon', 'Priya', 'Tunde', 'Aiko', 'Lena', 'Marco', 'Zoe', 'Ravi', 'Nia', 'Ines', 'Kofi', 'Elif', 'Stig', 'Rosa', 'Dev', 'Hana', 'Omar', 'Vera', 'Milo', 'Sana', 'Piotr', 'June', 'Ana', 'Teo', 'Freya', 'Yuki', 'Carl', 'Dara', 'Liv', 'Noor', 'Emil'];
  const first = s => String(s || '').split(' ')[0];
  const band = a => a < 25 ? '18–24' : a < 35 ? '25–34' : a < 45 ? '35–44' : '45+';
  const f1 = v => Math.round(v * 10) / 10;
  // the three agreement colours, lifted for the dusk field (paper swaps them)
  const paper = () => !!document.querySelector('.app.lens-paper');
  const AG = () => paper() ? {
    yes: 'oklch(0.50 0.13 282)',
    mid: 'oklch(0.74 0.02 282)',
    no: 'oklch(0.62 0.13 20)'
  } : {
    yes: 'oklch(0.84 0.10 282)',
    mid: 'oklch(0.60 0.035 282)',
    no: 'oklch(0.76 0.10 20)'
  };
  const stepOf = p => {
    const a = p.agree / Math.max(1, p.shared.length);
    return a > 0.6 ? 'yes' : a < 0.4 ? 'no' : 'mid';
  };

  // ── who is on this plane, and where ── memoized per population + your answers
  const _memo = {};
  function crowd(popId) {
    const PAT = window.PAT,
      Q = PAT.qs(),
      A = PAT.answers();
    const key = Object.keys(A).sort().join(',');
    const hit = _memo[popId];
    if (hit && hit.key === key) return hit.v;
    const mine = Q.map((q, j) => ({
      j,
      id: q.id,
      a: A[q.id]
    })).filter(x => x.a != null);
    // the bar for "placed" rises with your own history — sharing 4 answers means
    // something when you've given 6, little when you've given 20. This also keeps
    // the world field an honest constellation (~40-60) instead of a carpet.
    const minShared = Math.max(MIN_SHARED, Math.round(mine.length * 0.32));
    const placed = [];
    PAT.fieldPts(popId).forEach(pt => {
      const p = pt.p,
        pid = p.id;
      const act = popId === 'circle' ? 0.8 : 0.02 + 0.55 * Math.pow(h01('act' + pid), 6);
      const shared = mine.filter(x => h01('sh' + pid + x.id) < act);
      if (shared.length < minShared) return;
      let agree = 0;
      shared.forEach(x => {
        if (p.a[x.j] === x.a) agree++;
      });
      const t = Math.max(0, Math.min(1, (shared.length - minShared) / Math.max(1, mine.length - minShared)));
      placed.push({
        id: pid,
        mem: p,
        name: p.name ? first(p.name) : NAMES[Math.floor(h01('nm' + pid) * NAMES.length)],
        px: pt.x,
        py: pt.y,
        r: t > 0.5 ? 5 : 3.4,
        many: t > 0.5,
        shared,
        agree,
        chips: p.name ? ['your circle'] : [p.city, band(p.age)]
      });
    });
    const meP = PAT.mePoint();
    // plane → the disc, framed by the people actually shown (plus you)
    let mx = 0.2;
    placed.forEach(p => {
      mx = Math.max(mx, Math.hypot(p.px, p.py));
    });
    mx = Math.max(mx, Math.hypot(meP.x, meP.y));
    const X = v => C + v / mx * RMAX,
      Y = v => C + v / mx * RMAX;
    placed.forEach(p => {
      p.x = X(p.px);
      p.y = Y(p.py);
    });
    const me = {
      x: X(meP.x),
      y: Y(meP.y),
      r: 6
    };
    // nudge overlaps apart — position stays the data, only crowding is eased
    const all = placed.concat([me]);
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
        const P1 = all[a],
          P2 = all[b];
        let dx = P1.x - P2.x,
          dy = P1.y - P2.y,
          d = Math.hypot(dx, dy);
        const need = P1.r + P2.r + 5.5;
        if (d < need) {
          moved = true;
          if (d < 0.01) {
            dx = 1;
            dy = 0;
            d = 1;
          }
          const push = (need - d) / 2;
          P1.x += dx / d * push;
          P1.y += dy / d * push;
          P2.x -= dx / d * push;
          P2.y -= dy / d * push;
        }
      }
      if (!moved) break;
    }
    all.forEach(p => {
      const d = Math.hypot(p.x - C, p.y - C),
        lim = C - p.r - 12;
      if (d > lim) {
        p.x = C + (p.x - C) * lim / d;
        p.y = C + (p.y - C) * lim / d;
      }
    });
    // name the nearest five — a label takes the least crowded of four spots
    const near = placed.slice().sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    const rects = [{
      x0: me.x + 12,
      x1: me.x + 40,
      y0: me.y - 7,
      y1: me.y + 6
    }];
    const used = new Set();
    let labeled = 0;
    for (const p of near) {
      if (labeled >= 5) break;
      if (used.has(p.name)) continue;
      const w = p.name.length * 6.6 + 4,
        hh = 11;
      const cands = [{
        x: p.x,
        y: p.y + p.r + 3,
        anchor: 'middle'
      }, {
        x: p.x,
        y: p.y - p.r - 14,
        anchor: 'middle'
      }, {
        x: p.x + p.r + 5,
        y: p.y - 5.5,
        anchor: 'start'
      }, {
        x: p.x - p.r - 5,
        y: p.y - 5.5,
        anchor: 'end'
      }];
      let best = null;
      cands.forEach(c => {
        const x0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'start' ? c.x : c.x - w;
        const rc = {
          x0,
          x1: x0 + w,
          y0: c.y,
          y1: c.y + hh
        };
        let s = Math.hypot(rc.x0 + w / 2 - C, rc.y0 + hh / 2 - C) > C - 8 ? 100 : 0;
        if (rects.some(o => rc.x0 < o.x1 && rc.x1 > o.x0 && rc.y0 < o.y1 && rc.y1 > o.y0)) s += 100;
        if (rects.some(o => rc.x0 < o.x1 + 14 && rc.x1 > o.x0 - 14 && rc.y0 < o.y1 + 14 && rc.y1 > o.y0 - 14)) s += 2;
        all.forEach(q => {
          if (q !== p && q.x > rc.x0 - 1 && q.x < rc.x1 + 1 && q.y > rc.y0 - 1 && q.y < rc.y1 + 1) s += 1;
        });
        if (!best || s < best.s) best = {
          s,
          rc,
          c
        };
      });
      rects.push(best.rc);
      p.lab = {
        x: f1(best.c.x),
        y: f1(best.c.y + 9),
        anchor: best.c.anchor
      };
      used.add(p.name);
      labeled++;
    }
    const v = {
      placed,
      me,
      nMine: mine.length,
      minShared,
      near: near.filter(p => p.lab).slice(0, 5)
    };
    _memo[popId] = {
      key,
      v
    };
    return v;
  }

  // the strongest tie: the rarest answer you share — counted, with its basis
  function tieFor(p, popId) {
    const Q = window.PAT.qs();
    let best = null;
    p.shared.forEach(x => {
      if (p.mem.a[x.j] !== x.a) return;
      const c = window.PAT.counts(x.j, popId);
      const share = (x.a === 0 ? c[0] : c[1]) / Math.max(1, c[0] + c[1]);
      if (!best || share < best.share) best = {
        label: Q[x.j].options[x.a].label,
        share
      };
    });
    return best;
  }
  function PLEmpty({
    head,
    line,
    cta
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        minHeight: 330,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px 36px',
        gap: 8,
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: '-0.02em'
      }
    }, head), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: 'var(--ink-2)',
        lineHeight: 1.5,
        textWrap: 'pretty',
        maxWidth: 250
      }
    }, line), cta || null);
  }
  function PeopleLens({
    pop,
    onUse,
    onOracle
  }) {
    const [sel, setSel] = React.useState(null);
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => window.PAT.sub(force), []);
    React.useEffect(() => {
      setSel(null);
    }, [pop]);
    const st = window.PAT.stats();
    if (st.answered < MIN_ANSWERED) {
      return /*#__PURE__*/React.createElement(PLEmpty, {
        head: "Not placed yet",
        line: "Answer a few more questions and the map can place you.",
        cta: /*#__PURE__*/React.createElement("button", {
          onClick: () => {
            if (window.HAPTIC) window.HAPTIC.tick();
            if (onOracle) onOracle();
          },
          style: {
            marginTop: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--ink)',
            color: 'var(--surface-2)',
            fontFamily: 'var(--sans)',
            fontSize: 13.5,
            fontWeight: 800,
            padding: '11px 20px',
            borderRadius: 999
          }
        }, "Ask the Oracle")
      });
    }
    const popId = pop || 'world';
    const {
      placed,
      me,
      near,
      minShared
    } = crowd(popId);
    if (placed.length < MIN_CROWD) {
      return /*#__PURE__*/React.createElement(PLEmpty, {
        head: "Crowd too thin",
        line: "Too few people share your questions yet. The map fills as the crowd answers."
      });
    }
    const ag = AG();
    const selP = sel == null ? null : placed.find(p => p.id === sel);
    const pick = p => {
      setSel(s => s === p.id ? null : p.id);
      if (window.HAPTIC) window.HAPTIC.tick();
      if (onUse) onUse();
    };
    const tie = selP ? tieFor(selP, popId) : null;
    const meLeft = me.x > S - 46; // keep the "you" word inside the field
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "card ln-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ln-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ln-title"
    }, "Where you sit in the crowd"), /*#__PURE__*/React.createElement("div", {
      className: "ln-sub"
    }, "Each dot is a person who answered some of the same questions as you. The closer two dots, the more alike their answers.")), /*#__PURE__*/React.createElement("div", {
      className: "ln-field"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "ln-svg",
      viewBox: '0 0 ' + S + ' ' + S,
      role: "img",
      "aria-label": "People who share your questions, placed by their answers; colour says whether they mostly agree with you",
      onClick: () => {
        if (sel != null) setSel(null);
      }
    }, placed.map(p => {
      const on = p.id === sel;
      const dim = selP && !on;
      return /*#__PURE__*/React.createElement("g", {
        key: p.id,
        onClick: e => {
          e.stopPropagation();
          pick(p);
        },
        style: {
          cursor: 'pointer',
          opacity: dim ? 0.22 : 1,
          transition: 'opacity .25s ease'
        }
      }, /*#__PURE__*/React.createElement("circle", {
        cx: f1(p.x),
        cy: f1(p.y),
        r: Math.max(p.r + 8, 15),
        fill: "transparent"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: f1(p.x),
        cy: f1(p.y),
        r: p.r,
        fill: ag[stepOf(p)]
      }), on && /*#__PURE__*/React.createElement("circle", {
        cx: f1(p.x),
        cy: f1(p.y),
        r: p.r + 5,
        fill: "none",
        stroke: "var(--ln-beacon)",
        strokeWidth: "1.8"
      }));
    }), placed.map(p => p.lab && (selP == null || p.id === sel) ? /*#__PURE__*/React.createElement("text", {
      key: 'l' + p.id,
      x: p.lab.x,
      y: p.lab.y,
      textAnchor: p.lab.anchor,
      fill: "var(--ln-ink)",
      stroke: "var(--ln-halo)",
      strokeWidth: "3",
      strokeLinejoin: "round",
      paintOrder: "stroke",
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        pointerEvents: 'none'
      }
    }, p.name) : null), /*#__PURE__*/React.createElement("g", {
      style: {
        opacity: selP ? 0.35 : 1,
        transition: 'opacity .25s ease'
      }
    }, /*#__PURE__*/React.createElement("circle", {
      cx: f1(me.x),
      cy: f1(me.y),
      r: "11",
      fill: "none",
      stroke: "var(--ln-beacon)",
      strokeWidth: "1.6"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: f1(me.x),
      cy: f1(me.y),
      r: "6",
      fill: "var(--ln-me)"
    }), /*#__PURE__*/React.createElement("text", {
      x: f1(meLeft ? me.x - 14 : me.x + 14),
      y: f1(me.y + 3.5),
      textAnchor: meLeft ? 'end' : 'start',
      fill: "var(--ln-ink)",
      stroke: "var(--ln-halo)",
      strokeWidth: "3",
      strokeLinejoin: "round",
      paintOrder: "stroke",
      style: {
        fontSize: 11,
        fontWeight: 800
      }
    }, "you")))), /*#__PURE__*/React.createElement("div", {
      className: "ln-key",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-dot",
      style: {
        width: 9,
        height: 9,
        background: ag.yes
      }
    }), "mostly agrees with you"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-dot",
      style: {
        width: 9,
        height: 9,
        background: ag.mid
      }
    }), "split"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      className: "k-dot",
      style: {
        width: 9,
        height: 9,
        background: ag.no
      }
    }), "mostly disagrees"), /*#__PURE__*/React.createElement("span", null, "bigger dot = more answers in common")), /*#__PURE__*/React.createElement("div", {
      className: "ln-hint"
    }, selP ? 'Tap the field to see everyone again.' : 'Tap anyone to see what you share.'), /*#__PURE__*/React.createElement("div", {
      className: "ln-rail",
      role: "list",
      "aria-label": "The people most like you"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ln-rail-lab"
    }, "Most like you"), near.map(p => /*#__PURE__*/React.createElement("button", {
      key: p.id,
      role: "listitem",
      className: 'ln-chip' + (sel === p.id ? ' is-on' : ''),
      onClick: () => pick(p)
    }, /*#__PURE__*/React.createElement("span", {
      className: "c-av",
      style: {
        background: 'oklch(0.52 0.11 282)'
      }
    }, p.name[0]), /*#__PURE__*/React.createElement("span", {
      className: "c-name"
    }, p.name), /*#__PURE__*/React.createElement("span", {
      className: "c-sub"
    }, "agrees ", p.agree, " of ", p.shared.length))))), selP ? /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: '14px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: ag[stepOf(selP)],
        border: '1px solid var(--rule)',
        flex: 'none'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: '-0.02em'
      }
    }, selP.name), selP.chips.map((c, k) => /*#__PURE__*/React.createElement("span", {
      key: k,
      className: "pt-cat",
      style: {
        background: 'color-mix(in oklab, var(--accent) 10%, var(--surface-2))',
        color: 'var(--accent-ink)'
      }
    }, c))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 11,
        fontSize: 13.5,
        fontWeight: 650
      }
    }, "Agrees with you on ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 800
      }
    }, selP.agree, " of ", selP.shared.length), " answers you both gave"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        height: 8,
        borderRadius: 99,
        background: 'var(--surface-3)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        display: 'block',
        width: Math.round(selP.agree / selP.shared.length * 100) + '%',
        height: '100%',
        borderRadius: 99,
        background: 'color-mix(in oklab, var(--accent) 55%, var(--surface-2))',
        transition: 'width .3s var(--ease-out)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 7,
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        textWrap: 'pretty'
      }
    }, "That count alone places them ", '\u00b7', " closer only ever means more agreement."), tie ? /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 11,
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-2)'
      }
    }, "You both said ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, tie.label), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ink-3)'
      }
    }, "\xB7 ", Math.round(tie.share * 100), "% here do")) : /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 11,
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-2)'
      }
    }, "You split on everything you share.")) : /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: '14px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 34,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1
      }
    }, placed.length), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: 'var(--ink-2)',
        lineHeight: 1.4,
        textWrap: 'pretty'
      }
    }, "people are placed here: everyone who answered at least ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink)',
        fontWeight: 700
      }
    }, minShared, " of your ", st.answered), " questions. More appear as the crowd answers."))));
  }
  Object.assign(window, {
    PeopleLens
  });
})();