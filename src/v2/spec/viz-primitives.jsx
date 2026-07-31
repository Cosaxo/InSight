// Ported from design/spec-modules/viz-primitives.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// Reusable journal-style data viz primitives

// ─── Hand-drawn radar / spider chart ───
function RadarChart({ values, labels, max = 100, size = 240, color = 'var(--sienna)', compareValues, compareColor = 'var(--ink)' }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 28;
  const n = values.length;
  // labels sit at radius 1.18·r; pad the viewBox so side/top labels never clip.
  const padX = 38, padY = 22;
  const pt = (i, v) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = (v / max) * r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  };
  const poly = (vs) => vs.map((v, i) => pt(i, v).join(',')).join(' ');

  return (
    <svg viewBox={`${-padX} ${-padY} ${size + padX * 2} ${size + padY * 2}`} width="100%" style={{ display: 'block' }}>
      {/* concentric rings */}
      {[0.25, 0.5, 0.75, 1].map((k, i) => (
        <polygon key={k} fill="none" stroke="var(--rule)" strokeWidth="0.5"
          opacity={i === 3 ? 0.9 : 0.5}
          points={Array.from({ length: n }, (_, j) => pt(j, max * k).join(',')).join(' ')} />
      ))}
      {/* axes */}
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = pt(i, max);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--rule)" strokeWidth="0.4" strokeDasharray="1.2 1.6" />;
      })}
      {/* compare polygon */}
      {compareValues && (
        <polygon points={poly(compareValues)} fill={compareColor} fillOpacity="0.06" stroke={compareColor} strokeWidth="1" strokeDasharray="3 2" />
      )}
      {/* values polygon */}
      <polygon points={poly(values)} fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.4" />
      {/* dots */}
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="2.4" fill={color} />;
      })}
      {/* labels */}
      {labels.map((l, i) => {
        const [x, y] = pt(i, max * 1.18);
        return (
          <text key={l} x={x} y={y + 3} textAnchor="middle"
            style={{ font: '600 10px Hanken Grotesk, sans-serif', fill: 'var(--ink-2)' }}>
            {l}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Donut ───
function Donut({ value, max = 100, size = 80, color = 'var(--sienna)', label }) {
  const C = 2 * Math.PI * 28;
  const dash = (value / max) * C;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size}>
      <circle cx="40" cy="40" r="28" fill="none" stroke="var(--rule)" strokeWidth="6" />
      <circle cx="40" cy="40" r="28" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`} transform="rotate(-90 40 40)" />
      <text x="40" y="42" textAnchor="middle" style={{ font: '500 16px Hanken Grotesk, sans-serif', fill: 'var(--ink)' }}>{value}</text>
      {label && <text x="40" y="55" textAnchor="middle" style={{ font: '600 10px Hanken Grotesk, sans-serif', letterSpacing: '0.12em', fill: 'var(--ink-3)' }}>{label}</text>}
    </svg>
  );
}

Object.assign(window, { RadarChart, Donut });

;globalThis.RadarChart = typeof RadarChart === 'undefined' ? globalThis.RadarChart : RadarChart;
;globalThis.Donut = typeof Donut === 'undefined' ? globalThis.Donut : Donut;
