// mirror-answers.jsx — "The daily record" on Mirror: every daily question,
// answered by the population the mirror currently reflects. Category chips
// filter; sort by newest / most divisive / most agreed; a row expands into
// the full answer distribution with your own answer marked.
(function () {
  const {
    useState,
    useEffect,
    useReducer
  } = React;

  // ── helpers ────────────────────────────────────────────────────────────────
  const topIdx = d => d.reduce((t, v, i) => v > d[t] ? i : t, 0);
  const topShare = d => d[topIdx(d)];
  function useDailySub() {
    const [, bump] = useReducer(x => x + 1, 0);
    useEffect(() => window.DAILYQ.subscribe(bump), []);
  }

  // ── collapsed stack: notched pill segments, topic-hued, you in accent ─────
  function MAStack({
    q,
    dist,
    mine,
    tint
  }) {
    const lead = topIdx(dist);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        height: 12,
        gap: 3
      }
    }, dist.map((v, i) => {
      const isMine = mine === i;
      return /*#__PURE__*/React.createElement("span", {
        key: i,
        style: {
          flexGrow: v,
          minWidth: isMine ? 10 : 3,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isMine ? 'var(--accent)' : i === lead ? `color-mix(in oklch, ${tint} 62%, var(--surface-3))` : `color-mix(in oklch, ${tint} 15%, var(--surface-3))`
        }
      }, isMine && /*#__PURE__*/React.createElement("span", {
        style: {
          width: 4.5,
          height: 4.5,
          borderRadius: '50%',
          background: 'var(--surface)'
        }
      }));
    }));
  }

  // ── expanded: option bars (choice / binary / scale / dilemma) ─────────────
  function MABars({
    q,
    dist,
    mine,
    tint,
    tintInk
  }) {
    const lead = topIdx(dist);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 12
      }
    }, q.options.map((o, i) => {
      const isMine = mine === i;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 9
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 104,
          flexShrink: 0,
          textAlign: 'right',
          fontFamily: 'var(--sans)',
          fontSize: 11.5,
          fontWeight: isMine ? 800 : 500,
          color: isMine ? 'var(--ink)' : 'var(--ink-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }, o), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          height: 10,
          background: `color-mix(in oklch, ${tint} 9%, var(--surface-3))`,
          borderRadius: 999,
          overflow: 'hidden'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: Math.max(dist[i], 1) + '%',
          height: '100%',
          borderRadius: 999,
          background: isMine ? 'var(--accent)' : i === lead ? tint : `color-mix(in oklch, ${tint} 34%, var(--surface-3))`
        }
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          width: 32,
          flexShrink: 0,
          textAlign: 'right',
          fontFamily: 'var(--sans)',
          fontSize: 10.5,
          color: isMine ? 'var(--accent-ink)' : tintInk,
          fontWeight: 700
        }
      }, isMine || mine == null && i === lead ? dist[i] + '%' : ''));
    }));
  }

  // ── expanded: 1–10 rating histogram ────────────────────────────────────────
  function MAHisto({
    q,
    dist,
    mine,
    tint,
    tintInk
  }) {
    const max = Math.max(...dist, 1);
    const avg = (dist.reduce((a, p, i) => a + p * (i + 1), 0) / 100).toFixed(1);
    const H = 48;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        height: H
      }
    }, dist.map((v, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: Math.max(3, v / max * H),
        borderRadius: 3,
        background: mine === i ? 'var(--accent)' : `color-mix(in oklch, ${tint} 55%, var(--surface-3))`
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        marginTop: 4
      }
    }, dist.map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center'
      }
    }, mine === i ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: 'var(--accent)'
      }
    }) : i === 0 || i === 9 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--ink-3)'
      }
    }, i + 1) : null))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-2)'
      }
    }, "average ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: tintInk,
        fontWeight: 800
      }
    }, avg), " / 10"));
  }

  // ── one question row ───────────────────────────────────────────────────────
  function MARow({
    q,
    audId,
    open,
    onToggle,
    showDate
  }) {
    const DQ = window.DAILYQ;
    const dist = q.dist[audId];
    const mine = DQ.myAnswer(q);
    const hue = (DQ.catMeta(DQ.categoryPath(q)[0]) || {}).hue || 250;
    const tint = `oklch(0.55 0.13 ${hue})`;
    const tintInk = `oklch(0.47 0.13 ${hue})`;
    const anon = mine != null && DQ.isAnon && DQ.isAnon(q.id);
    const anonGlyph = sz => /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: sz,
      height: sz,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      style: {
        flexShrink: 0
      }
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
    const head = DQ.headline(q, audId);
    const yvt = open ? DQ.youVsThem(q, audId) : null;
    const mineLabel = mine != null ? q.type === 'rating' ? q.options[mine] + '/10' : q.options[mine] : null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '14px 0'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onToggle,
      className: "press",
      style: {
        display: 'block',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: 0,
        textAlign: 'left',
        cursor: 'pointer',
        color: 'inherit'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'var(--sans)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '-0.015em',
        color: 'var(--ink)',
        lineHeight: 1.32
      }
    }, q.prompt), showDate && /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.09em',
        color: 'var(--ink-3)'
      }
    }, q.dateLabel.toUpperCase())), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        maxWidth: '46%',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 800,
        fontSize: 13.5,
        color: tintInk
      }
    }, head.big, head.unit || ''), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        color: 'var(--ink-2)'
      }
    }, " ", head.sub)), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 44
      }
    }, /*#__PURE__*/React.createElement(MAStack, {
      q: q,
      dist: dist,
      mine: mine,
      tint: tint
    })), mineLabel && /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-2)',
        maxWidth: '32%'
      }
    }, anon ? anonGlyph(12) : /*#__PURE__*/React.createElement("span", {
      style: {
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: 'var(--surface)'
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, mineLabel)))), open && /*#__PURE__*/React.createElement("div", {
      className: "fade-in"
    }, q.type === 'rating' ? /*#__PURE__*/React.createElement(MAHisto, {
      q: q,
      dist: dist,
      mine: mine,
      tint: tint,
      tintInk: tintInk
    }) : /*#__PURE__*/React.createElement(MABars, {
      q: q,
      dist: dist,
      mine: mine,
      tint: tint,
      tintInk: tintInk
    }), yvt && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 7,
        padding: '7px 11px 7px 9px',
        borderRadius: 10,
        background: 'color-mix(in oklch, var(--accent) 8%, var(--surface-2))',
        fontFamily: 'var(--sans)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--accent-ink)',
        lineHeight: 1.4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: 'var(--surface)'
      }
    })), /*#__PURE__*/React.createElement("span", null, yvt.text)), anon && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 9,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, anonGlyph(12), /*#__PURE__*/React.createElement("span", null, "answered anonymously \u2014 hidden when others view your map"))));
  }

  // ── sort modes ─────────────────────────────────────────────────────────────
  const MA_SORTS = [{
    id: 'new',
    label: 'Newest',
    fn: (a, b) => a.idx - b.idx
  }, {
    id: 'split',
    label: 'Divisive',
    fn: null
  },
  // resolved per-audience below
  {
    id: 'agree',
    label: 'Agreed',
    fn: null
  }];

  // ── the section ────────────────────────────────────────────────────────────
  const PA_PLACE = {
    city: 'Oslo',
    country: 'Norway',
    world: 'the world'
  };
  const paPill = ink => ({
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    fontFamily: 'var(--sans)',
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.13em',
    ...(ink ? {
      background: 'var(--ink)',
      color: 'var(--surface)',
      padding: '3px 8px'
    } : {
      border: '1px solid var(--rule)',
      color: 'var(--ink-3)',
      padding: '2px 8px'
    })
  });
  // "Asked for {place}" — the paid tail on a place's Answers lens: bought
  // questions + running metrics only (never the daily record), and the door
  // to the catalog. Tail, never core (law 02), so it sits under the record.
  function PlaceAsked({
    audId
  }) {
    const P = window.WF_PAID;
    if (!P) return null;
    const place = PA_PLACE[audId];
    const paid = (P.items || []).filter(q => q.scope === audId);
    const mets = (P.CATALOG || []).filter(m => m.scope === audId && m.place === place && m.state === 'active');
    const n = paid.length + mets.length;
    const rowStyle = i => ({
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 0',
      background: 'none',
      border: 'none',
      borderTop: i ? '0.5px solid var(--rule)' : 'none',
      cursor: 'pointer',
      textAlign: 'left',
      WebkitAppearance: 'none'
    });
    const tTxt = {
      display: 'block',
      fontFamily: 'var(--sans)',
      fontSize: 13.5,
      fontWeight: 650,
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
      color: 'var(--ink)'
    };
    const mTxt = {
      display: 'block',
      marginTop: 3,
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    };
    const chev = /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        flexShrink: 0,
        fontFamily: 'var(--sans)',
        fontSize: 15,
        color: 'var(--ink-3)'
      }
    }, "\u203A");
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TabSection, {
      title: 'Asked for ' + place,
      sub: "bought questions and running metrics \u2014 the paid tail, in one place"
    }), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 14,
        padding: '2px 14px'
      }
    }, paid.map((q, i) => /*#__PURE__*/React.createElement("button", {
      key: q.id,
      className: "press",
      onClick: () => window.openPaidReport && window.openPaidReport(q),
      style: rowStyle(i)
    }, /*#__PURE__*/React.createElement("span", {
      style: paPill(true)
    }, "PAID"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: tTxt
    }, q.prompt), /*#__PURE__*/React.createElement("span", {
      style: mTxt
    }, (q.paid.buyer ? q.paid.buyer + ' · ' : '') + (q.paid.closed ? 'closed — final report public' : 'asked for ' + q.paid.window))), chev)), mets.map((m, i) => /*#__PURE__*/React.createElement("button", {
      key: m.id,
      className: "press",
      onClick: () => window.openCatalog && window.openCatalog(),
      style: rowStyle(i + paid.length)
    }, /*#__PURE__*/React.createElement("span", {
      style: paPill(false)
    }, "METRIC"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: tTxt
    }, m.q), /*#__PURE__*/React.createElement("span", {
      style: mTxt
    }, 'scoring ' + m.score + ' · funded by ' + m.seats + ' · rates monthly')), chev)), !n && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 0 2px',
        fontFamily: 'var(--sans)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--ink-3)',
        lineHeight: 1.45
      }
    }, "Nothing runs for ", place, " right now \u2014 the catalog takes pledges."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 0 13px',
        borderTop: n ? '0.5px solid var(--rule)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => window.openCatalog && window.openCatalog(),
      style: {
        minHeight: 36,
        padding: '0 15px',
        borderRadius: 999,
        cursor: 'pointer',
        WebkitAppearance: 'none',
        border: '1px solid var(--ink)',
        background: 'var(--surface)',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 800,
        flexShrink: 0
      }
    }, "Ask ", place, " a question \u2192"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        lineHeight: 1.4
      }
    }, "catalog & rate card \u2014 no checkout"))));
  }
  function MirrorAnswers({
    audId
  }) {
    useDailySub();
    const DQ = window.DAILYQ;
    const [cat, setCat] = useState('all');
    const [sort, setSort] = useState('new');
    const [open, setOpen] = useState('\u0000first');
    const [all, setAll] = useState(false);
    const [browse, setBrowse] = useState(false);
    const isPlace = audId === 'city' || audId === 'country' || audId === 'world';
    const aud = DQ.audience(audId) || {};
    const qs = DQ.questions;

    // every topic in the pool, biggest first, with question counts
    const counts = {};
    qs.forEach(q => {
      const t = DQ.categoryPath(q)[0];
      counts[t] = (counts[t] || 0) + 1;
    });
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    const catHue = c => `oklch(0.55 0.13 ${(DQ.catMeta(c) || {}).hue || 250})`;
    let list = cat === 'all' ? qs.slice() : qs.filter(q => DQ.categoryPath(q)[0] === cat);
    if (sort === 'split') list.sort((a, b) => topShare(a.dist[audId]) - topShare(b.dist[audId]));else if (sort === 'agree') list.sort((a, b) => topShare(b.dist[audId]) - topShare(a.dist[audId]));else list.sort((a, b) => a.idx - b.idx);
    const LIMIT = 7;
    const shown = all ? list : list.slice(0, LIMIT);
    const anyMine = shown.some(q => DQ.myAnswer(q) != null);
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TabSection, {
      title: "What they answered",
      sub: `every daily question, as ${aud.label || 'they'} answered it`
    }), /*#__PURE__*/React.createElement("div", {
      className: browse ? '' : 'subnav--scroll',
      style: {
        display: 'flex',
        gap: 7,
        overflowX: browse ? 'visible' : 'auto',
        flexWrap: browse ? 'wrap' : 'nowrap',
        padding: '2px 4px',
        margin: '0 -4px 8px'
      }
    }, ['all', ...cats].map(c => {
      const on = cat === c;
      return /*#__PURE__*/React.createElement("button", {
        key: c,
        className: "pill press",
        onClick: () => {
          setCat(c);
          setAll(false);
          setOpen('\u0000first');
        },
        style: {
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: on ? 'var(--accent)' : 'var(--surface)',
          color: on ? 'var(--surface)' : 'var(--ink-2)',
          borderColor: on ? 'var(--accent)' : 'var(--rule)',
          fontWeight: on ? 700 : 500
        }
      }, c !== 'all' && /*#__PURE__*/React.createElement("span", {
        style: {
          width: 7,
          height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          background: on ? 'var(--surface)' : catHue(c)
        }
      }), c === 'all' ? 'All' : c, browse && c !== 'all' && /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 600,
          fontSize: 10.5,
          opacity: 0.65
        }
      }, counts[c]));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10
      }
    }, anyMine && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 3.5,
        height: 3.5,
        borderRadius: '50%',
        background: 'var(--surface)'
      }
    })), "you"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => setBrowse(!browse),
      "aria-label": browse ? 'Collapse topics' : 'Show all topics',
      title: browse ? 'Collapse topics' : 'Show all topics',
      style: {
        background: 'none',
        border: 'none',
        padding: '2px 0',
        cursor: 'pointer',
        flexShrink: 0,
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: browse ? 750 : 500,
        color: browse ? 'var(--ink)' : 'var(--ink-3)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
      }
    }, "Topics ", /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        fontSize: 8.5,
        transform: browse ? 'rotate(180deg)' : 'none',
        display: 'inline-block'
      }
    }, '\u25BC')), MA_SORTS.map(s => {
      const on = sort === s.id;
      return /*#__PURE__*/React.createElement("button", {
        key: s.id,
        className: "press",
        onClick: () => {
          setSort(s.id);
          setAll(false);
        },
        style: {
          background: 'none',
          border: 'none',
          padding: '2px 0',
          cursor: 'pointer',
          flexShrink: 0,
          fontFamily: 'var(--sans)',
          fontSize: 11.5,
          fontWeight: on ? 750 : 500,
          color: on ? 'var(--ink)' : 'var(--ink-3)',
          borderBottom: on ? '1.5px solid var(--accent)' : '1.5px solid transparent'
        }
      }, s.label);
    })), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 14,
        paddingTop: 3,
        paddingBottom: 3
      }
    }, shown.map((q, i) => {
      const m = (q.dateLabel || '').split(' ')[1] || '';
      const pm = i > 0 ? (shown[i - 1].dateLabel || '').split(' ')[1] || '' : null;
      const isOpen = open === '\u0000first' ? i === 0 : open === q.id;
      return /*#__PURE__*/React.createElement("div", {
        key: q.id,
        style: {
          borderTop: i === 0 ? 'none' : '0.5px solid var(--rule)'
        }
      }, sort === 'new' && m !== pm && /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'sticky',
          top: 0,
          zIndex: 3,
          background: 'var(--surface-2)',
          padding: '9px 0 5px',
          fontFamily: 'var(--sans)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)'
        }
      }, m), /*#__PURE__*/React.createElement(MARow, {
        q: q,
        audId: audId,
        open: isOpen,
        onToggle: () => setOpen(isOpen ? '' : q.id),
        showDate: sort !== 'new'
      }));
    }), list.length > LIMIT && !all && /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => setAll(true),
      style: {
        width: '100%',
        padding: '11px 0 13px',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        borderTop: '0.5px solid var(--rule)',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-2)'
      }
    }, "Show ", list.length - LIMIT, " more")), isPlace && /*#__PURE__*/React.createElement(PlaceAsked, {
      audId: audId
    }));
  }
  Object.assign(window, {
    MirrorAnswers
  });
})();