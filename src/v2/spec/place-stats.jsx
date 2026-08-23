// Ported from design/InSight_standalone_15.html (place-stats.jsx). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { PLACESTATS } from './place-stats.js';

// place-stats.jsx — the scorecard for City / Country / World tabs.
// Sorted best → worst on one shared 0–10 baseline, so the eight rows read as a
// single shape: what this place is proud of at the top, what it is not at the
// bottom. Labels hold their own right-aligned column — a fixed reading edge that
// bars and rings can never collide with. Colour carries pride vs complaint (full
// accent above the halfway mark, pale below), so no row needs a number.
const PS_LW = 140;              // label column — sized to the longest label ("Openness to newcomers" needs 134)
const PS_GAP = 10;
function PlaceStatsCard({ scope, accent }) {
  const [, tick] = React.useState(0);
  // Imported since D242, so the load-order guards are gone: an imported
  // binding cannot be unset, and the effect now always returns the
  // unsubscriber rather than `undefined` on the frame the module had not
  // loaded. `if (!S)` below stays — an unknown scope is a DATA condition.
  React.useEffect(() => PLACESTATS.subscribe(() => tick((t) => t + 1)), []);
  const PS = PLACESTATS;
  const S = PS.SCOPES[scope];
  if (!S) return null;
  const col = accent || 'var(--c-world)';
  const deep = `color-mix(in oklch, ${col} 80%, var(--ink))`;
  const pale = `color-mix(in oklch, ${col} 32%, transparent)`;
  const rows = S.cats.slice().sort((a, b) => b.avg - a.avg);
  const overall = rows.reduce((a, c) => a + c.avg, 0) / rows.length;
  const ratedAny = rows.some((c) => PS.myScore(scope, c.id) != null);
  const mid = `calc(${PS_LW}px + ${PS_GAP}px + (100% - ${PS_LW}px - ${PS_GAP}px) / 2)`;
  return (
    <div className="card" style={{ padding: '16px 16px 14px', margin: '16px 0 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, paddingBottom: 13, borderBottom: '0.5px solid var(--rule)', marginBottom: 13 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: deep, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{overall.toFixed(1)}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>/ 10</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{S.raters} ratings</span>
      </div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${PS_LW}px 1fr`, columnGap: PS_GAP, rowGap: 9, alignItems: 'center' }}>
        {/* halfway — the line between what a place is praised for and what it isn't */}
        <span aria-hidden="true" style={{ position: 'absolute', left: mid, top: -2, bottom: -2, width: 1, background: 'color-mix(in oklch, var(--ink-3) 30%, transparent)' }}></span>
        {rows.map((c) => {
          const my = PS.myScore(scope, c.id);
          const a = c.avg * 10, m = my != null ? my * 10 : null;
          const lo = m == null ? 0 : Math.min(a, m), hi = m == null ? 0 : Math.max(a, m);
          return (
            <React.Fragment key={c.id}>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: a < 50 ? 'var(--ink-2)' : 'var(--ink)' }}>{c.label}</span>
              <span style={{ position: 'relative', height: 15, display: 'block' }}>
                <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -4.5, left: 0, right: 0, height: 9, borderRadius: 99, background: 'color-mix(in oklch, var(--ink-3) 11%, transparent)' }}></span>
                <span style={{ position: 'absolute', top: '50%', marginTop: -4.5, left: 0, width: `${a}%`, height: 9, borderRadius: 99, background: a < 50 ? pale : col }}></span>
                {m != null && hi - lo > 3 ? <span style={{ position: 'absolute', top: '50%', marginTop: -1.5, height: 3, left: `${lo}%`, width: `${hi - lo}%`, borderRadius: 99, background: deep, opacity: 0.5 }}></span> : null}
                {m != null ? <span style={{ position: 'absolute', top: '50%', marginTop: -6, left: `calc(${m}% - ${(m / 100) * 12}px)`, width: 12, height: 12, borderRadius: '50%', background: 'var(--surface)', border: `2.5px solid ${deep}`, boxSizing: 'border-box' }}></span> : null}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 11, borderTop: '0.5px solid var(--rule)' }}>
        {ratedAny ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--surface)', border: `2.5px solid ${deep}`, boxSizing: 'border-box' }}></span>your score
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
