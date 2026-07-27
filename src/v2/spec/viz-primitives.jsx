/* eslint-disable */
// ported from design/spec-modules/viz-primitives.jsx — do not hand-edit load order assumptions
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

// ─── Annotated 2-axis scatter / political-style compass ───
function Compass2D({ x, y, label = 'you', xLabel = ['Tradition', 'Change'], yLabel = ['Individual', 'Collective'], comparePoints = [], size = 220, accent = 'var(--sienna)' }) {
  // x, y are -100..100
  const s = size, pad = 22;
  const px = pad + ((x + 100) / 200) * (s - pad * 2);
  const py = pad + ((100 - y) / 200) * (s - pad * 2);
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width="100%" style={{ display: 'block', maxWidth: s }}>
      {/* quadrants tinted */}
      <rect x={pad} y={pad} width={(s - 2 * pad) / 2} height={(s - 2 * pad) / 2} fill="var(--sienna)" opacity="0.04" />
      <rect x={s / 2} y={s / 2} width={(s - 2 * pad) / 2} height={(s - 2 * pad) / 2} fill="var(--sage)" opacity="0.06" />
      {/* grid */}
      <rect x={pad} y={pad} width={s - 2 * pad} height={s - 2 * pad} fill="none" stroke="var(--rule)" strokeWidth="0.5" />
      <line x1={s / 2} y1={pad} x2={s / 2} y2={s - pad} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={pad} y1={s / 2} x2={s - pad} y2={s / 2} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="2 2" />
      {/* compare points */}
      {comparePoints.map((p, i) => {
        // clamp to the grid so off-scale points never clip outside the frame
        const vx = Math.max(-100, Math.min(100, p.x));
        const vy = Math.max(-100, Math.min(100, p.y));
        const cx = pad + ((vx + 100) / 200) * (s - pad * 2);
        const cy = pad + ((100 - vy) / 200) * (s - pad * 2);
        // labels flip to the left side near the right edge so they stay legible
        const flip = cx > s * 0.6;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3.2" fill={p.color || 'var(--ink-3)'} opacity="0.7" />
            {p.label && <text x={flip ? cx - 6 : cx + 6} y={cy + 3} textAnchor={flip ? 'end' : 'start'} style={{ font: '600 8.5px Hanken Grotesk, sans-serif', fill: 'var(--ink-3)', stroke: 'var(--surface)', strokeWidth: 2.5, paintOrder: 'stroke', strokeLinejoin: 'round' }}>{p.label}</text>}
          </g>
        );
      })}
      {/* you */}
      <circle cx={px} cy={py} r="9" fill={accent} fillOpacity="0.18" />
      <circle cx={px} cy={py} r="4" fill={accent} />
      <text x={px > s * 0.6 ? px - 9 : px + 8} y={py - 7} textAnchor={px > s * 0.6 ? 'end' : 'start'} style={{ font: '600 11px Hanken Grotesk, sans-serif', fill: 'var(--ink)' }}>{label}</text>
      {/* axis labels — uniform sans caps, no typewriter mono */}
      <text x={pad - 2} y={s / 2 - 4} textAnchor="start" style={{ font: '600 9.5px Hanken Grotesk, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fill: 'var(--ink-3)' }}>{xLabel[0]}</text>
      <text x={s - pad + 2} y={s / 2 - 4} textAnchor="end" style={{ font: '600 9.5px Hanken Grotesk, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fill: 'var(--ink-3)' }}>{xLabel[1]}</text>
      <text x={s / 2 + 4} y={pad + 8} style={{ font: '600 9.5px Hanken Grotesk, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fill: 'var(--ink-3)' }}>{yLabel[0]}</text>
      <text x={s / 2 + 4} y={s - pad - 2} style={{ font: '600 9.5px Hanken Grotesk, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fill: 'var(--ink-3)' }}>{yLabel[1]}</text>
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

Object.assign(window, { RadarChart, Compass2D, Donut });

;globalThis.RadarChart = typeof RadarChart === 'undefined' ? globalThis.RadarChart : RadarChart;
;globalThis.Compass2D = typeof Compass2D === 'undefined' ? globalThis.Compass2D : Compass2D;
;globalThis.Donut = typeof Donut === 'undefined' ? globalThis.Donut : Donut;
