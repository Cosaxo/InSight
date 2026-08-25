// Ported from design/InSight_standalone_15.html (place-stats.jsx). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { PLACESTATS } from './place-stats.js';
import { HAPTIC } from './haptics.js';

// place-stats.jsx — the scorecard for City / Country / World tabs.
// City and country hold two crowds on one 0–10 axis since the 2026-08-24
// standalone: a filled dot for the people who live there, a ring for
// everyone else. The bar between them IS the story — where the dots sit
// together the place is what it looks like; where they pull apart, one
// side is seeing something the other isn't (Oslo's prices, Norway's
// welcome). Sorted best → worst on the whole-crowd mean, so the eight
// rows read as one shape. The crowds are named "live there" / "from
// elsewhere" — the prototype said "locals/visitors", and the live card
// cannot know who visited (D288 §2), so the demo previews the claim the
// product actually makes. The fore chips are a viewing lens over the
// same marks, transient like the live lens's own — never a claim about
// you, and your tick draws the same whichever crowd is fore.
const PS_LW = 140;              // label column — sized to the longest label ("Openness to newcomers" needs 134)
const PS_GAP = 10;
// a dot on the axis: filled = live there, ring = from elsewhere. Inset-
// scaled so a 10 sits inside the track instead of hanging off its end.
function PSDot({ x, col, ring, dim }) {
  const s = 11;
  return <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -s / 2, left: `calc(${x}% - ${(x / 100) * s}px)`, width: s, height: s, borderRadius: '50%', boxSizing: 'border-box', background: ring ? 'var(--surface)' : col, border: ring ? `2.5px solid ${col}` : 'none', opacity: dim ? 0.42 : 1, transition: 'opacity .25s ease, left .5s var(--ease-out)' }}></span>;
}
function PlaceStatsCard({ scope, accent }) {
  const [, tick] = React.useState(0);
  // which crowd the reading leads with — a lens, not a claim (D288 §2)
  const [fore, setFore] = React.useState('here');
  // Imported since D247, so the load-order guards are gone: an imported
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
  const span = `color-mix(in oklch, ${col} 52%, var(--surface-3))`;
  const split = !!S.split;
  const rows = S.cats.slice().sort((a, b) => b.avg - a.avg);
  const overall = (pick) => {
    const vs = rows.map((c) => pick(c)).filter((v) => v != null);
    return vs.length ? vs.reduce((a, v) => a + v, 0) / vs.length : null;
  };
  const ratedAny = rows.some((c) => PS.myScore(scope, c.id) != null);
  const mid = `calc(${PS_LW}px + ${PS_GAP}px + (100% - ${PS_LW}px - ${PS_GAP}px) / 2)`;
  const num = (v, dim) => <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: split ? 27 : 32, letterSpacing: '-0.03em', color: dim ? 'var(--ink-2)' : deep, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{v.toFixed(1)}</span>;
  const word = (s) => <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: 'var(--ink-3)' }}>{s}</span>;
  const glyph = (ring) => <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', background: ring ? 'var(--surface)' : deep, border: ring ? `2.5px solid ${deep}` : 'none' }}></span>;
  return (
    <div className="card" style={{ padding: '16px 16px 14px', margin: '16px 0 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: split ? 16 : 7, paddingBottom: 13, borderBottom: '0.5px solid var(--rule)', marginBottom: split ? 15 : 13 }}>
        {split ? (
          <React.Fragment>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{glyph(false)}{num(overall((c) => c.loc), fore === 'away')}{word('live there')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{glyph(true)}{num(overall((c) => c.vis), fore === 'here')}{word('from elsewhere')}</span>
          </React.Fragment>
        ) : (
          <React.Fragment>{num(overall((c) => c.avg), false)}{word('/ 10')}</React.Fragment>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{S.raters} ratings</span>
      </div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${PS_LW}px 1fr`, columnGap: PS_GAP, rowGap: split ? 10 : 9, alignItems: 'center' }}>
        {/* halfway — the line between what a place is praised for and what it isn't */}
        <span aria-hidden="true" style={{ position: 'absolute', left: mid, top: -2, bottom: -2, width: 1, background: 'color-mix(in oklch, var(--ink-3) 26%, transparent)' }}></span>
        {rows.map((c) => {
          const my = PS.myScore(scope, c.id);
          if (!split) {
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
          }
          const a = c.loc * 10, b = c.vis * 10;
          const lo = Math.min(a, b), hi = Math.max(a, b);
          return (
            <React.Fragment key={c.id}>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: (lo + hi) / 2 < 50 ? 'var(--ink-2)' : 'var(--ink)' }}>{c.label}</span>
              <span style={{ position: 'relative', height: 20, display: 'block' }}>
                <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -0.5, left: 0, right: 0, height: 1, background: 'color-mix(in oklch, var(--ink-3) 16%, transparent)' }}></span>
                <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -2, left: `${lo}%`, width: `${Math.max(hi - lo, 0.6)}%`, height: 4, borderRadius: 99, background: span, transition: 'left .5s var(--ease-out), width .5s var(--ease-out)' }}></span>
                <PSDot x={a} col={col} dim={fore === 'away'}></PSDot>
                <PSDot x={b} col={col} ring={true} dim={fore === 'here'}></PSDot>
                {my != null && <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${my * 10}% - ${(my * 10 / 100) * 3}px)`, width: 3, borderRadius: 2, background: deep }}></span>}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: split ? 15 : 14, paddingTop: split ? 12 : 11, borderTop: '0.5px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {split && (
          <div style={{ display: 'flex', gap: 7 }}>
            {[['here', 'live there', false], ['away', 'from elsewhere', true]].map(([id, label, ring]) => {
              const on = fore === id;
              return (
                <button key={id} className="press" onClick={() => { HAPTIC.tick(); setFore(id); }} aria-pressed={on}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 650, border: on ? `1px solid ${deep}` : '1px solid var(--rule)', background: on ? `color-mix(in oklch, ${col} 12%, var(--surface))` : 'var(--surface)', color: on ? deep : 'var(--ink-3)' }}>
                  {glyph(ring)}{label}
                </button>
              );
            })}
          </div>
        )}
        {ratedAny ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
            {split
              ? <span aria-hidden="true" style={{ width: 3, height: 14, borderRadius: 2, background: deep }}></span>
              : <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--surface)', border: `2.5px solid ${deep}`, boxSizing: 'border-box' }}></span>}
            your score
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
