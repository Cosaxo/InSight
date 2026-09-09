// catalog-sheet.jsx — the in-app shop window (PAID-PLAN E, mobile): metrics
// grouped by place, the posted rate card, pledges, and the contract path.
// Read-only by law 07 — commerce stays off the app, so the sheet ends in a
// mail address, never a checkout. focus="author" leads with the author path.
(function () {
  const { useState, useEffect } = React;
  const useCur = () => { const [, b] = useState(0); useEffect(() => { const f = () => b((x) => x + 1); window.addEventListener('is-currency', f); return () => window.removeEventListener('is-currency', f); }, []); };
  const K = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };
  const Sub = ({ children }) => <div style={{ marginTop: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>{children}</div>;
  const Kicker = ({ children }) => <div style={{ margin: '18px 4px 8px', ...K }}>{children}</div>;

  // one metric: state dot · prompt + one meta line · the live score when it has one
  function MetricRow({ m, first }) {
    const P = window.WF_PAID;
    const on = m.state === 'active';
    const pledged = m.state === 'pledged';
    const per = P.fmt(P.SUB.perPeriod(m.scope));
    const meta = on
      ? (m.seats === 1 ? 'funded by 1 · full ' + per + ' — a second seat halves it' : 'funded by ' + m.seats + ' · a seat is ' + P.fmt(P.SUB.seat(m.scope, m.seats)) + ' of ' + per + ' / period')
      : pledged ? P.fmt(m.pledgedEur) + ' of ' + per + ' pledged — live the day it\u2019s covered'
      : 'inactive — a seat (' + per + ' / period) or pledges turn it on';
    return (
      <div style={{ display: 'flex', gap: 10, padding: '11px 0', borderTop: first ? 'none' : '0.5px solid var(--rule)', alignItems: 'flex-start' }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5.5, boxSizing: 'border-box', background: on ? 'var(--c-city)' : 'var(--surface)', border: on ? 'none' : '1.5px solid ' + (pledged ? 'var(--c-city)' : 'var(--ink-3)') }}></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3, color: on ? 'var(--ink)' : 'var(--ink-2)', textWrap: 'pretty' }}>{m.q}</span>
          <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>{meta}</span>
        </span>
        {on && m.score && (
          <span style={{ flexShrink: 0, textAlign: 'right' }}>
            <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'color-mix(in oklch, var(--c-city) 82%, var(--ink))' }}>{m.score}</span>
            <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--sans)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>this month</span>
          </span>
        )}
      </div>
    );
  }

  function PlaceGroup({ g }) {
    return (
      <div className="card" style={{ marginTop: 8, padding: '12px 14px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingBottom: 9, borderBottom: '0.5px solid var(--rule)' }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{g.place === 'the world' ? 'The world' : g.place}</span>
          <span style={K}>rates: {g.scope}</span>
        </div>
        {g.items.map((m, i) => <MetricRow key={m.id} m={m} first={i === 0} />)}
      </div>
    );
  }

  function CatalogSheet({ onClose, focus }) {
    useCur();
    const P = window.WF_PAID;
    if (!P || !P.SUB) return null;
    const M = P.MARKET;
    const groups = [];
    (P.CATALOG || []).forEach((m) => {
      let g = groups.find((x) => x.place === m.place);
      if (!g) { g = { place: m.place, scope: m.scope, items: [] }; groups.push(g); }
      g.items.push(m);
    });
    const rows = [
      { c: 'Oslo', b: Math.round(M.booked.city * 100) + '%', i: '×' + M.idx.city, r: M.rate('city') },
      { c: 'Oslo ∩ 25–34', b: '—', i: 'max ×' + M.idx.city, r: M.rate(['city', 'age']) },
      { c: 'Norway', b: Math.round(M.booked.country * 100) + '%', i: '×' + M.idx.country, r: M.rate('country') },
      { c: 'Everyone', b: Math.round(M.booked.world * 100) + '%', i: '×' + M.idx.world + ' ceil', r: M.rate('world') },
    ];
    const author = (
      <div className="card" style={{ marginTop: 8, padding: '13px 14px', borderColor: 'color-mix(in oklch, var(--ink) 22%, var(--rule))' }}>
        <span style={K}>author a metric</span>
        <Sub>Written ahead, kept neutral by editorial, priced like everything else — a new metric lists inactive and runs once funded or pledged. The scorecard set stays editorial and unbuyable.</Sub>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 15px', borderRadius: 999, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800 }}>metrics@insight.app</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>no checkout here, deliberately</span>
        </div>
      </div>
    );
    return (
      <div className="overlay surface-tint">
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose} aria-label="Close">✕</button>
          <div className="h-title">Catalog <em>&amp; rate card</em></div>
          {window.CurSwitch ? <window.CurSwitch /> : null}
        </div>
        <div className="app-body" style={{ paddingTop: 0 }}>
          <div style={{ margin: '14px 2px 0', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Measure a place, ask a cohort. Buying adds a question, never a private cut — the numbers stay public for everyone.
          </div>
          {focus === 'author' && <React.Fragment><Kicker>start here</Kicker>{author}</React.Fragment>}
          <Kicker>the catalog — subscribable metrics</Kicker>
          {groups.map((g) => <PlaceGroup key={g.place} g={g} />)}
          <div className="card" style={{ marginTop: 8, padding: '12px 14px' }}>
            <span style={K}>how a subscription prices</span>
            <Sub>≈ 1 350 (city) · 4 300 (country) · 20 000 (world) answers a period × the posted line, −20% for the standing commitment: {P.fmt(P.SUB.perPeriod('city'))} · {P.fmt(P.SUB.perPeriod('country'))} · {P.fmt(P.SUB.perPeriod('world'))} today. Subscribers split it evenly ({P.fmt(P.SUB.seatFloor)} seat floor) — a second seat halves the bill instead of buying it twice.</Sub>
          </div>
          {focus !== 'author' && author}
          <Kicker>the market — one-off questions</Kicker>
          <div className="card" style={{ marginTop: 8, padding: '12px 14px 3px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingBottom: 8, borderBottom: '0.5px solid var(--rule)' }}>
              <span style={{ flex: 1.6, ...K }}>cohort</span>
              <span style={{ flex: 0.8, textAlign: 'right', ...K }}>booked</span>
              <span style={{ flex: 1, textAlign: 'right', ...K }}>index</span>
              <span style={{ flex: 1, textAlign: 'right', ...K }}>/ answer</span>
            </div>
            {rows.map((r) => (
              <div key={r.c} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '10px 0', borderTop: r.c === 'Oslo' ? 'none' : '0.5px solid var(--rule)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ flex: 1.6, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{r.c}</span>
                <span style={{ flex: 0.8, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{r.b}</span>
                <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{r.i}</span>
                <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{P.fmt(r.r)}</span>
              </div>
            ))}
            <div style={{ padding: '9px 0 11px', borderTop: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
              {P.fmt(M.base)} × demand, floored ×{M.floorX}, ceilinged ×{M.ceilX}. Intersections pay the max over parents — a thin cell is never a discount. Minimum ticket: the {M.floorWeek}-answer floor × the line ({P.fmt(M.minTicket('city'))} in Oslo). Your line locks at booking.
            </div>
          </div>
          <div className="card" style={{ marginTop: 8, padding: '13px 14px', borderColor: 'color-mix(in oklch, var(--ink) 22%, var(--rule))' }}>
            <span style={K}>v1 commerce is a contract</span>
            <Sub>Hand-sold at the published price — price decides who gets the scarce window; delivery is identical whatever was paid. Short at close: extend free or settle for what arrived, your pick at booking.</Sub>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 15px', borderRadius: 999, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800 }}>sales@insight.app</span>
              {window.openAskedByYou && (
                <button className="press" onClick={() => window.openAskedByYou()} style={{ minHeight: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700 }}>Asked by you →</button>
              )}
            </div>
          </div>
          <div style={{ margin: '14px 8px 24px', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textAlign: 'center', textWrap: 'pretty' }}>
            One paid thing in the feed, ever — demand moves the price, never the slot count.
          </div>
        </div>
      </div>
    );
  }
  window.CatalogSheet = CatalogSheet;
})();
