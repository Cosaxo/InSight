// catalog-sheet.jsx — the in-app shop window (PAID-PLAN E, mobile): metrics
// grouped by place, the posted rate card, pledges, and the contract path.
// Read-only by law 07 — commerce stays off the app, so the sheet ends in a
// mail address, never a checkout. focus="author" leads with the author path.
(function () {
  const {
    useState,
    useEffect
  } = React;
  const useCur = () => {
    const [, b] = useState(0);
    useEffect(() => {
      const f = () => b(x => x + 1);
      window.addEventListener('is-currency', f);
      return () => window.removeEventListener('is-currency', f);
    }, []);
  };
  const K = {
    fontFamily: 'var(--sans)',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)'
  };
  const Tok = ({
    children
  }) => /*#__PURE__*/React.createElement("span", {
    style: {
      border: '0.5px solid var(--rule)',
      background: 'var(--surface)',
      borderRadius: 999,
      padding: '3px 9px',
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--ink-2)',
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums'
    }
  }, children);
  const Sub = ({
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontFamily: 'var(--sans)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      textWrap: 'pretty'
    }
  }, children);
  const Kicker = ({
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '18px 4px 8px',
      ...K
    }
  }, children);

  // one metric: state dot · prompt + one meta line · the live score when it has one
  function MetricRow({
    m,
    first
  }) {
    const P = window.WF_PAID;
    const on = m.state === 'active';
    const pledged = m.state === 'pledged';
    const perN = P.SUB.perPeriod(m.scope);
    const per = P.fmt(perN);
    const pct = pledged ? Math.min(100, Math.round(m.pledgedEur / perN * 100)) : 0;
    const meta = on ? m.seats === 1 ? 'funded by 1 · full ' + per + ' — a second seat halves it' : 'funded by ' + m.seats + ' · a seat is ' + P.fmt(P.SUB.seat(m.scope, m.seats)) + ' of ' + per + ' / period' : pledged ? P.fmt(m.pledgedEur) + ' of ' + per + ' pledged — live the day it\u2019s covered' : 'inactive — a seat (' + per + ' / period) or pledges turn it on';
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        padding: '12px 0',
        borderTop: first ? 'none' : '0.5px solid var(--rule)',
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 5.5,
        boxSizing: 'border-box',
        background: on ? 'var(--c-city)' : 'var(--surface)',
        border: on ? 'none' : '1.5px solid ' + (pledged ? 'var(--c-city)' : 'var(--ink-3)'),
        boxShadow: on ? '0 0 0 3px color-mix(in oklch, var(--c-city) 15%, transparent)' : 'none'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontFamily: 'var(--sans)',
        fontSize: 14.5,
        fontWeight: on ? 750 : 650,
        letterSpacing: '-0.015em',
        lineHeight: 1.3,
        color: on ? 'var(--ink)' : 'var(--ink-2)',
        textWrap: 'pretty'
      }
    }, m.q), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginTop: 3,
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        lineHeight: 1.45,
        fontVariantNumeric: 'tabular-nums'
      }
    }, meta), pledged ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginTop: 6,
        maxWidth: 190,
        height: 3,
        borderRadius: 999,
        background: 'var(--surface-3)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        width: pct + '%',
        height: '100%',
        borderRadius: 999,
        background: 'var(--c-city)'
      }
    })) : null), on && m.score && /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontFamily: 'var(--sans)',
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        color: 'color-mix(in oklch, var(--c-city) 82%, var(--ink))'
      }
    }, m.score), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginTop: 3,
        fontFamily: 'var(--sans)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)'
      }
    }, "this month")));
  }
  function PlaceGroup({
    g,
    idx
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card sg-rise",
      style: {
        marginTop: 8,
        padding: '12px 14px 2px',
        animationDelay: (idx || 0) * 60 + 'ms'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        paddingBottom: 9,
        borderBottom: '0.5px solid var(--rule)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 15.5,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: 'var(--ink)'
      }
    }, g.place === 'the world' ? 'The world' : g.place), /*#__PURE__*/React.createElement("span", {
      style: K
    }, "rates: ", g.scope)), g.items.map((m, i) => /*#__PURE__*/React.createElement(MetricRow, {
      key: m.id,
      m: m,
      first: i === 0
    })));
  }
  function CatalogSheet({
    onClose,
    focus
  }) {
    useCur();
    const P = window.WF_PAID;
    if (!P || !P.SUB) return null;
    const M = P.MARKET;
    const groups = [];
    (P.CATALOG || []).forEach(m => {
      let g = groups.find(x => x.place === m.place);
      if (!g) {
        g = {
          place: m.place,
          scope: m.scope,
          items: []
        };
        groups.push(g);
      }
      g.items.push(m);
    });
    const rows = [{
      c: 'Oslo',
      b: Math.round(M.booked.city * 100) + '%',
      i: '×' + M.idx.city,
      r: M.rate('city'),
      t: 'var(--ink-3)'
    }, {
      c: 'Oslo ∩ 25–34',
      b: '—',
      i: 'max ×' + M.idx.city,
      r: M.rate(['city', 'age']),
      t: 'var(--ink-3)'
    }, {
      c: 'Norway',
      b: Math.round(M.booked.country * 100) + '%',
      i: '×' + M.idx.country,
      r: M.rate('country'),
      t: 'var(--ochre-ink)'
    }, {
      c: 'Everyone',
      b: Math.round(M.booked.world * 100) + '%',
      i: '×' + M.idx.world + ' ceil',
      r: M.rate('world'),
      t: 'var(--accent-ink)'
    }];
    const author = /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginTop: 8,
        padding: '13px 14px',
        borderColor: 'color-mix(in oklch, var(--ink) 22%, var(--rule))'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: K
    }, "author a metric"), /*#__PURE__*/React.createElement(Sub, null, "Written ahead, kept neutral by editorial, priced like everything else \u2014 a new metric lists inactive and runs once funded or pledged. The scorecard set stays editorial and unbuyable."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 36,
        padding: '0 15px',
        borderRadius: 999,
        background: 'var(--ink)',
        color: 'var(--surface)',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 800
      }
    }, "metrics@insight.app"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "no checkout here, deliberately")));
    return /*#__PURE__*/React.createElement("div", {
      className: "overlay surface-tint"
    }, /*#__PURE__*/React.createElement("div", {
      className: "app-header"
    }, /*#__PURE__*/React.createElement("button", {
      className: "avatar-btn",
      onClick: onClose,
      "aria-label": "Close"
    }, "\u2715"), /*#__PURE__*/React.createElement("div", {
      className: "h-title"
    }, "Catalog ", /*#__PURE__*/React.createElement("em", null, "& rate card")), window.CurSwitch ? /*#__PURE__*/React.createElement(window.CurSwitch, null) : null), /*#__PURE__*/React.createElement("div", {
      className: "app-body",
      style: {
        paddingTop: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '14px 2px 0',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-2)',
        lineHeight: 1.5,
        textWrap: 'pretty'
      }
    }, "Measure a place, ask a cohort. Buying adds a question, never a private cut \u2014 the numbers stay public for everyone."), focus === 'author' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Kicker, null, "start here"), author), /*#__PURE__*/React.createElement(Kicker, null, "the catalog \u2014 subscribable metrics"), groups.map((g, gi) => /*#__PURE__*/React.createElement(PlaceGroup, {
      key: g.place,
      g: g,
      idx: gi
    })), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginTop: 8,
        padding: '12px 14px 13px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: K
    }, "how a subscription prices"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginTop: 10
      }
    }, [['city', 'city', '≈ 1 350'], ['country', 'country', '≈ 4 300'], ['world', 'everyone', '≈ 20 000']].map(([sc, lab, ans]) => /*#__PURE__*/React.createElement("span", {
      key: sc,
      style: {
        flex: 1,
        minWidth: 0,
        borderRadius: 12,
        border: '0.5px solid var(--rule)',
        background: 'var(--surface)',
        padding: '9px 10px',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontFamily: 'var(--sans)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)'
      }
    }, lab), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginTop: 4,
        fontFamily: 'var(--sans)',
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
      }
    }, P.fmt(P.SUB.perPeriod(sc))), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginTop: 2,
        fontFamily: 'var(--sans)',
        fontSize: 9.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, ans, " answers")))), /*#__PURE__*/React.createElement(Sub, null, "Answers a period \xD7 the posted line, \u221220% for the standing commitment. Subscribers split it evenly (", P.fmt(P.SUB.seatFloor), " seat floor) \u2014 a second seat halves the bill instead of buying it twice.")), focus !== 'author' && author, /*#__PURE__*/React.createElement(Kicker, null, "the market \u2014 one-off questions"), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginTop: 8,
        padding: '12px 14px 3px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
        paddingBottom: 8,
        borderBottom: '0.5px solid var(--rule)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1.6,
        ...K
      }
    }, "cohort"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 0.8,
        textAlign: 'right',
        ...K
      }
    }, "booked"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        textAlign: 'right',
        ...K
      }
    }, "index"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        textAlign: 'right',
        ...K
      }
    }, "/ answer")), rows.map(r => /*#__PURE__*/React.createElement("div", {
      key: r.c,
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
        padding: '10px 0',
        borderTop: r.c === 'Oslo' ? 'none' : '0.5px solid var(--rule)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1.6,
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 750,
        color: 'var(--ink)'
      }
    }, r.c), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 0.8,
        textAlign: 'right',
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, r.b), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        textAlign: 'right',
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 750,
        color: r.t
      }
    }, r.i), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        textAlign: 'right',
        fontFamily: 'var(--sans)',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: 'var(--ink)'
      }
    }, P.fmt(r.r)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 5,
        padding: '10px 0 12px',
        borderTop: '0.5px solid var(--rule)'
      }
    }, [P.fmt(M.base) + ' base', '× demand', 'floor ×' + M.floorX, 'ceiling ×' + M.ceilX, 'intersections pay the max', 'min ticket ' + P.fmt(M.minTicket('city')) + ' (Oslo)', 'locked at booking'].map(t => /*#__PURE__*/React.createElement(Tok, {
      key: t
    }, t)))), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginTop: 8,
        padding: '13px 14px',
        borderColor: 'color-mix(in oklch, var(--ink) 22%, var(--rule))'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: K
    }, "v1 commerce is a contract"), /*#__PURE__*/React.createElement(Sub, null, "Hand-sold at the published price \u2014 price decides who gets the scarce window; delivery is identical whatever was paid. Short at close: extend free or settle for what arrived, your pick at booking."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 36,
        padding: '0 15px',
        borderRadius: 999,
        background: 'var(--ink)',
        color: 'var(--surface)',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 800
      }
    }, "sales@insight.app"), window.openAskedByYou && /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => window.openAskedByYou(),
      style: {
        minHeight: 36,
        padding: '0 14px',
        borderRadius: 999,
        cursor: 'pointer',
        WebkitAppearance: 'none',
        border: '1px solid var(--rule)',
        background: 'var(--surface)',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 700
      }
    }, "Asked by you \u2192"))), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '14px 8px 24px',
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--ink-3)',
        lineHeight: 1.5,
        textAlign: 'center',
        textWrap: 'pretty'
      }
    }, "One paid thing in the feed, ever \u2014 demand moves the price, never the slot count.")));
  }
  window.CatalogSheet = CatalogSheet;
})();