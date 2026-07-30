// Ported from design/InSight_standalone_15.html (place-stats.jsx). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// place-stats.jsx — the scorecard card for City / Country / World tabs.
// Members' averages as bars (best → worst), your own feed ratings as ring
// markers. Everything visual: length is the score, the ring is you.
function PlaceStatsCard({ scope, accent }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => (window.PLACESTATS ? window.PLACESTATS.subscribe(() => tick((t) => t + 1)) : undefined), []);
  const PS = window.PLACESTATS;
  if (!PS) return null;
  const S = PS.SCOPES[scope];
  if (!S) return null;
  const col = accent || 'var(--c-world)';
  const deep = `color-mix(in oklch, ${col} 80%, var(--ink))`;
  const rows = S.cats.slice().sort((a, b) => b.avg - a.avg);
  const overall = rows.reduce((a, c) => a + c.avg, 0) / rows.length;
  const ratedAny = rows.some((c) => PS.myScore(scope, c.id) != null);
  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 13, borderBottom: '0.5px solid var(--rule)', marginBottom: 15 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: deep, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{overall.toFixed(1)}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>/ 10 overall</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>~{S.raters} members rating</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((c, i) => {
          const my = PS.myScore(scope, c.id);
          return (
            <div key={c.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 650, color: 'var(--ink)' }}>{c.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
                  {my != null ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>you {my}</span> : null}
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 800, color: deep, fontVariantNumeric: 'tabular-nums' }}>{c.avg.toFixed(1)}</span>
                </span>
              </div>
              <div style={{ position: 'relative', height: my != null ? 14 : 8 }}>
                <span style={{ position: 'absolute', top: '50%', marginTop: -4, height: 8, left: 0, right: 0, borderRadius: 999, background: `color-mix(in oklch, ${col} 9%, var(--surface-3))` }}></span>
                <span className="rpv2-bar" style={{ position: 'absolute', top: '50%', marginTop: -4, height: 8, left: 0, width: (c.avg * 10) + '%', borderRadius: 999, transformOrigin: 'left', animationDelay: `${i * 55}ms`, background: `linear-gradient(90deg, color-mix(in oklch, ${col}, transparent 60%), ${col})` }}></span>
                {my != null ? <span style={{ position: 'absolute', top: '50%', left: `calc(${my * 10}% - ${my * 1.4}px)`, transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', border: `3px solid ${col}`, boxSizing: 'border-box', boxShadow: '0 0 0 1.5px var(--surface)' }}></span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 15, paddingTop: 11, borderTop: '0.5px solid var(--rule)', display: 'flex', justifyContent: 'center' }}>
        {ratedAny ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--ink-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 6, borderRadius: 999, background: col }}></span>MEMBERS</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--surface)', border: `3px solid ${col}`, boxSizing: 'border-box' }}></span>YOU</span>
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>Score these in the World feed — your marks land here.</span>
        )}
      </div>
    </div>
  );
}
Object.assign(window, { PlaceStatsCard });

;globalThis.PlaceStatsCard = typeof PlaceStatsCard === 'undefined' ? globalThis.PlaceStatsCard : PlaceStatsCard;
