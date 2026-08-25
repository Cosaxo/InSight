// Ported from design/spec-modules/test-viz.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { Kicker } from './primitives.jsx';
import { IS_TEST_RESULTS } from './test-definitions.js';
// The measured "most people" baseline (D157). `VizRange` reads `d.avg` per
// row and skips the typical-person mark where it is undefined, so an empty
// map draws your own values alone rather than a fabricated comparison.
import { testAvg } from '../data/testNorms.ts';

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
  'oklch(0.60 0.125 358)', // berry — was moss 145 until the 2026-08-24 standalone swapped the wheel's one green out
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
        return (
          <div key={d.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: lead ? 14.5 : 13.5, fontWeight: lead ? 700 : 600, color: lead ? col : 'var(--ink)' }}>{d.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: lead ? 15.5 : 14, fontWeight: 700, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{d.value}</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 16 }}>
              <div style={{ position: 'absolute', left: '4%', right: '4%', top: '50%', height: 1, background: 'var(--rule)', transform: 'translateY(-50%)' }} />
              {typ != null && (
                <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 3, borderRadius: 2, background: col, opacity: 0.55, left: `${Math.min(pos(you), pos(typ))}%`, width: `${Math.abs(pos(you) - pos(typ))}%` }} />
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
  const R = IS_TEST_RESULTS[testKey];
  if (!R) return null;
  const a = accent || R.accent;
  const avg = testAvg(testKey);
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



