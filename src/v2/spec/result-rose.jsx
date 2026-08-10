// Ported from design/spec-modules/result-rose.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// result-rose.jsx — the "results profile" treatment for the per-test
// profile tabs. Every test speaks one visual language:
//   1. a tinted archetype banner (each test owns a hue family)
//   2. a petal rose — petal length = score, one hue per trait
//   3. pole rows — the same scores on their bipolar axes, vs most people
// Colours link chart ↔ rows, so almost no labels are repeated.

// ── Per-test config: banner colour, hue per dimension, pole pairs ──
export const RP_TESTS = {
  big5: {
    banner: 'oklch(0.48 0.11 30)',
    kicker: 'Personality · Big Five',
    hues: { O: 50, C: 75, E: 95, A: 25, N: 0 },
    poles: {
      O: ['practical', 'curious'],
      C: ['flexible', 'disciplined'],
      E: ['reserved', 'outgoing'],
      A: ['direct', 'warm'],
      N: ['steady', 'sensitive'],
    },
  },
  political: {
    banner: 'oklch(0.46 0.095 240)',
    kicker: 'Politics · Six axes',
    bipolar: true,
    hues: { econ: 235, auth: 265, foreign: 195, env: 170, tech: 215, estab: 285 },
    poles: {
      econ:    ['left', 'right'],
      auth:    ['liberty', 'order'],
      foreign: ['national', 'global'],
      env:     ['growth', 'green'],
      tech:    ['caution', 'optimism'],
      estab:   ['establishment', 'outsider'],
    },
  },
  values: {
    banner: 'oklch(0.45 0.10 320)',
    kicker: 'Values · Six tensions',
    bipolar: true,
    hues: { future: 322, circle: 344, hedonism: 6, meaning: 28, moral: 282, beauty: 312 },
    poles: {
      future:   ['pessimist', 'hopeful'],
      circle:   ['close', 'wide'],
      hedonism: ['duty', 'pleasure'],
      meaning:  ['happiness', 'suffering'],
      moral:    ['relativist', 'objectivist'],
      beauty:   ['truth', 'beauty'],
    },
  },
  attachment: {
    banner: 'oklch(0.47 0.09 155)',
    kicker: 'Social · The friend you are',
    hues: { warm: 120, loyal: 150, open: 180, play: 95, easy: 205 },
    poles: {
      warm:  ['reserved', 'warm'],
      loyal: ['light-touch', 'loyal'],
      open:  ['guarded', 'open'],
      play:  ['grounded', 'playful'],
      easy:  ['invested', 'easygoing'],
    },
  },
  // Added with the cognitive question bank (2026-08-10). This entry is not
  // decoration: ResultProfileCard returns null on a missing cfg, so without
  // it finishing the new test lands on a screen with a CTA and no result.
  // Not bipolar — the four modes are each their own 0..100 and most people
  // run two of them together, so |v−50| would read a genuine two-mode
  // thinker as having no style at all.
  cognitive: {
    banner: 'oklch(0.46 0.10 220)',
    kicker: 'Thinking · Four modes',
    hues: { analyst: 215, systems: 250, empath: 185, maker: 285 },
    poles: {
      analyst: ['intuitive', 'analytic'],
      systems: ['detail', 'systems'],
      empath:  ['detached', 'attuned'],
      maker:   ['planner', 'maker'],
    },
  },
};

// hue → petal fill / deep text / dot colours (same L+C family everywhere)
const rpPetal = (h) => `oklch(0.64 0.115 ${h})`;
const rpDeep  = (h) => `oklch(0.46 0.13 ${h})`;

// ── Petal rose — petal length encodes the score, 0–100 ──
function RosePetals({ dims, hueOf, subOf, animate }) {
  const W = 360, H = 330, cx = 180, cy = 168, R = 92, labelR = 106, r0 = 9;
  const n = dims.length, slice = 360 / n, gapD = n > 6 ? 9 : 12;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (aDeg, r) => [cx + Math.cos(rad(aDeg)) * r, cy + Math.sin(rad(aDeg)) * r];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Trait scores as petals; longer petal = higher score">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--rule)" strokeWidth="1"></circle>
      <circle cx={cx} cy={cy} r={R / 2} fill="none" stroke="var(--rule)" strokeWidth="1" opacity="0.5"></circle>
      {dims.map((d, i) => {
        const a0 = -90 + i * slice + gapD / 2;
        const a1 = -90 + (i + 1) * slice - gapD / 2;
        const mid = (a0 + a1) / 2;
        const v = Math.max(0, Math.min(100, d.value));
        const r = r0 + (v / 100) * (R - r0);
        const [x0i, y0i] = pt(a0, r0), [x0, y0] = pt(a0, r);
        const [x1, y1] = pt(a1, r), [x1i, y1i] = pt(a1, r0);
        const hue = hueOf(d.id, i);
        const s = Math.sin(rad(mid)), c = Math.cos(rad(mid));
        const [lx, ly0] = pt(mid, labelR);
        const anchor = c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle';
        // keep labels inside the viewBox — clamp x, and nudge clamped labels
        // vertically so they clear the petal tip
        const estW = d.label.length * 6.2;
        let lx2 = lx, nudge = 0;
        if (anchor === 'start' && lx + estW > W - 4) { lx2 = W - 4 - estW; nudge = s >= 0 ? 13 : -13; }
        else if (anchor === 'end' && lx - estW < 4) { lx2 = 4 + estW; nudge = s >= 0 ? 13 : -13; }
        else if (anchor === 'middle') { lx2 = Math.max(4 + estW / 2, Math.min(W - 4 - estW / 2, lx)); }
        const sub = subOf ? subOf(d) : '';
        const ly = ly0 + (s < -0.4 ? -10 : s > 0.4 ? 10 : -3) + nudge + (sub ? 0 : 5);
        return (
          <g key={d.id}>
            <path className={animate ? 'rp-petal' : undefined} style={animate ? { transformOrigin: `${cx}px ${cy}px`, animationDelay: `calc(var(--rv-row) * ${i})` } : undefined} d={`M ${x0i.toFixed(1)} ${y0i.toFixed(1)} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x1i.toFixed(1)} ${y1i.toFixed(1)} A ${r0} ${r0} 0 0 0 ${x0i.toFixed(1)} ${y0i.toFixed(1)} Z`} fill={rpPetal(hue)}></path>
            <text x={lx2} y={ly} textAnchor={anchor} style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, fill: 'var(--ink)' }}>{d.label}</text>
            {sub ? <text x={lx2} y={ly + 13} textAnchor={anchor} style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, fill: rpDeep(hue) }}>{sub}</text> : null}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={4} fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.5"></circle>
    </svg>
  );
}

// ── RoseMini — tiny label-free rose for list cards (same encoding as TestRose) ──
export function RoseMini({ testKey, dims, size = 46 }) {
  const cfg = RP_TESTS[testKey];
  if (!cfg || !dims || !dims.length) return null;
  const hueOf = (id, i) => (cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
  const ds = cfg.bipolar ? dims.map(d => ({ ...d, value: Math.min(100, Math.abs(d.value - 50) * 2) })) : dims;
  const C = size / 2, R = C - 1, r0 = 3, n = ds.length, slice = 360 / n, gapD = n > 6 ? 10 : 14;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (a, r) => [C + Math.cos(rad(a)) * r, C + Math.sin(rad(a)) * r];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
      {ds.map((d, i) => {
        const a0 = -90 + i * slice + gapD / 2, a1 = -90 + (i + 1) * slice - gapD / 2;
        const v = Math.max(14, Math.min(100, d.value));
        const r = r0 + (v / 100) * (R - r0);
        const [xa, ya] = pt(a0, r0), [xb, yb] = pt(a0, r), [xc, yc] = pt(a1, r), [xd, yd] = pt(a1, r0);
        return <path key={d.id} d={`M ${xa.toFixed(1)} ${ya.toFixed(1)} L ${xb.toFixed(1)} ${yb.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xc.toFixed(1)} ${yc.toFixed(1)} L ${xd.toFixed(1)} ${yd.toFixed(1)} A ${r0} ${r0} 0 0 0 ${xa.toFixed(1)} ${ya.toFixed(1)} Z`} fill={rpPetal(hueOf(d.id, i))}></path>;
      })}
    </svg>
  );
}

// ── TestRose — the rose with per-test encoding. Bipolar tests (politics,
// values) encode petal length as CONVICTION (distance from centre) and label
// each petal with the pole it leans toward — a raw 13-of-100 is a strong
// stance, not a short petal. Unipolar tests keep score = length. ──
export function TestRose({ testKey, dims, animate }) {
  const cfg = RP_TESTS[testKey];
  if (!cfg || !dims || !dims.length) return null;
  const hueOf = (id, i) => (cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
  const roseDims = cfg.bipolar
    ? dims.map(d => ({ ...d, raw: d.value, value: Math.min(100, Math.abs(d.value - 50) * 2) }))
    : dims;
  const subOf = cfg.bipolar
    ? (d) => { const w = (cfg.poles[d.id] || ['low', 'high'])[(d.raw != null ? d.raw : d.value) >= 50 ? 1 : 0]; return w.toLowerCase() === d.label.toLowerCase() ? '' : w; }
    : null;
  return <RosePetals dims={roseDims} hueOf={hueOf} subOf={subOf} animate={animate} />;
}
