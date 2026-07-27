// ported from design/spec-modules/test-viz.jsx — do not hand-edit load order assumptions
import React from 'react';

// ─── Test result visualizations — one unified language for every test ───
// "Radar": a polygon plotted across one axis per dimension; the filled shape
// is your profile, a dashed polygon marks the typical person where known.
// One coherent system across all eight tests + the hub cards.

const { useState: useStateTV } = React;

// Warm-anchored, cohesive palette — same lightness/chroma, hue varies per
// dimension. Mapped by a dimension's position in its test, so colours stay
// stable between the dial and the comparison list below it.
const BLOOM_PAL = [
  'oklch(0.64 0.135 40)',   // terracotta
  'oklch(0.70 0.130 72)',   // amber
  'oklch(0.74 0.125 98)',   // gold
  'oklch(0.66 0.110 145)',  // moss
  'oklch(0.62 0.095 205)',  // teal-blue
  'oklch(0.56 0.115 258)',  // indigo
  'oklch(0.58 0.130 305)',  // plum
  'oklch(0.62 0.140 14)',   // rose
];
const bloomColor = (i) => BLOOM_PAL[i % BLOOM_PAL.length];
// id → colour map, keyed by the original dim order so list + dial agree.
function bloomPalette(dims) {
  const m = {};
  (dims || []).forEach((d, i) => { m[d.id] = bloomColor(i); });
  return m;
}

// ── The chart · you vs the typical person ──────────────────────
function VizRange({ R, accent, compact }) {
  const order = R.dims || [];
  if (!order.length) return null;
  const pal = bloomPalette(order);
  const dims = [...order].sort((a, b) => b.value - a.value);
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const pos = (v) => 4 + (clamp(v) / 100) * 92;   // inset so edge dots stay inside
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 12 : 16, width: '100%' }}>
      {dims.map((d, idx) => {
        const col = pal[d.id] || accent;
        const you = clamp(d.value);
        const typ = d.avg != null ? clamp(d.avg) : null;
        const lead = idx === 0;
        const delta = typ != null ? Math.round(d.value - d.avg) : null;
        return (
          <div key={d.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: lead ? 16 : 14.5, color: lead ? col : 'var(--ink)' }}>{d.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                {delta != null && Math.abs(delta) >= 3 && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: delta > 0 ? col : 'var(--ink-3)' }}>{delta > 0 ? '+' : '−'}{Math.abs(delta)}</span>
                )}
                <span style={{ fontFamily: 'var(--serif)', fontSize: lead ? 18 : 15.5, color: 'var(--ink)', lineHeight: 1 }}>{d.value}</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 16 }}>
              <div style={{ position: 'absolute', left: '4%', right: '4%', top: '50%', height: 1, background: 'var(--rule)', transform: 'translateY(-50%)' }} />
              {typ != null && (
                <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 2.5, borderRadius: 2, background: col, opacity: 0.4, left: `${Math.min(pos(you), pos(typ))}%`, width: `${Math.abs(pos(you) - pos(typ))}%` }} />
              )}
              {typ != null && (
                <span style={{ position: 'absolute', top: '50%', left: `${pos(typ)}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)' }} />
              )}
              <span style={{ position: 'absolute', top: '50%', left: `${pos(you)}%`, transform: 'translate(-50%,-50%)', width: lead ? 14 : 12, height: lead ? 14 : 12, borderRadius: '50%', background: col, border: '2px solid var(--surface-2)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Saved-result card (reusable) — dial + colour-keyed legend ──
function TestVizCard({ testKey, accent }) {
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  if (!R) return null;
  const a = accent || R.accent;
  const avg = (window.IS_TEST_AVG || {})[testKey] || {};
  const Rx = { ...R, dims: R.dims.map(d => ({ ...d, avg: avg[d.id] })) };
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 14 }}>
        <Kicker>{R.title} · saved result</Kicker>
      </div>
      <VizRange R={Rx} accent={a} compact />
    </div>
  );
}

Object.assign(window, { TestVizCard });

;globalThis.bloomPalette = typeof bloomPalette === 'undefined' ? globalThis.bloomPalette : bloomPalette;
;globalThis.VizRange = typeof VizRange === 'undefined' ? globalThis.VizRange : VizRange;
;globalThis.TestVizCard = typeof TestVizCard === 'undefined' ? globalThis.TestVizCard : TestVizCard;
;globalThis.BLOOM_PAL = typeof BLOOM_PAL === 'undefined' ? globalThis.BLOOM_PAL : BLOOM_PAL;
;globalThis.bloomColor = typeof bloomColor === 'undefined' ? globalThis.bloomColor : bloomColor;
