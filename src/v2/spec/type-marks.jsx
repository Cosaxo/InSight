// Ported from design/InSight_standalone_17.html (type-marks.jsx). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import ReactDOM from 'react-dom';
import { RP_TESTS } from './result-rose.jsx';
import { Sheet } from './primitives.jsx';
import { IS_ARCHETYPES } from './archetype-data.js';

// type-marks.jsx — data-true type marks. A type's mark IS its signature.
// Archetype signatures are built EXTREME on 1–2 defining axes and near-neutral
// elsewhere, so the mark is built from those two axes only — never all six.
// Each axis owns a hue and a position on a clock. Three forms, tweakable:
//   ring  — two arcs on a faint circle: where = which axis, length = how hard,
//           pushed out for the high pole / pulled in for the low one.
//   slice — one two-tone disc: the split angle is the defining axis, the darker
//           share is how much it dominates. Pure colour + angle; reads at 16px.
//   dots  — the original six-row signature plot (kept for comparison).
// Exported by name (D39, "convert on touch") alongside the window bag.
export // Which of the three forms the marks draw in. Pushed in by the shell rather
// than read off a global, so this module owns the setting it uses.
let markStyle = 'slice';
export function setMarkStyle(m) { markStyle = ['ring', 'slice', 'dots'].includes(m) ? m : 'slice'; }

// Exported by name (D39, "convert on touch") alongside the window bag below.
export function TypeMark({ testKey, name, values, size = 20, plate = true, style, title }) {
  const cfg = RP_TESTS[testKey];
  let sig = values;
  if (!sig && name) { const sys = IS_ARCHETYPES[testKey]; const a = sys && sys.list.find(t => t.name === name); sig = a && a.sig; }
  if (!cfg || !sig) return null;
  const ids = Object.keys(cfg.hues).filter(id => sig[id] != null);
  if (!ids.length) return null;
  const mode = markStyle;
  const pad = 3.4, span = 24 - pad * 2, n = ids.length, half = span / 2;
  const rows = ids.map((id, i) => {
    const v = Math.max(0, Math.min(100, sig[id]));
    return { id, v, i, st: Math.abs(v - 50) / 50, hue: cfg.hues[id], hi: v >= 50, y: pad + (i + 0.5) * (span / n), sign: v >= 50 ? 1 : -1 };
  });
  const ranked = rows.slice().sort((a, b) => b.st - a.st);
  const ang = (r) => (-90 + r.i * (360 / n)) * Math.PI / 180;   // each axis owns a clock position
  const deep = (h) => `oklch(0.52 0.14 ${h})`;
  const lift = (h) => `oklch(0.79 0.08 ${h})`;

  if (mode === 'ring' || mode === 'slice') {
    const P = (a, r) => [(12 + Math.cos(a) * r).toFixed(2), (12 + Math.sin(a) * r).toFixed(2)];
    let body;
    if (mode === 'ring') {
      const keep = ranked.filter((r) => r.st >= 0.3).slice(0, 2);
      if (!keep.length) keep.push(ranked[0]);
      body = <>
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="var(--ink-3)" strokeWidth="0.9" opacity="0.16"></circle>
        {keep.map((r, k) => {
          const rad = 8.2 + (r.hi ? 1.15 : -1.15);
          const w = (22 + r.st * 42) * Math.PI / 360;   // half-span in radians
          const a0 = ang(r) - w, a1 = ang(r) + w;
          const [x0, y0] = P(a0, rad), [x1, y1] = P(a1, rad);
          return <path key={r.id} d={`M ${x0} ${y0} A ${rad} ${rad} 0 0 1 ${x1} ${y1}`} fill="none" stroke={k === 0 ? deep(r.hue) : `oklch(0.62 0.125 ${r.hue})`} strokeWidth={k === 0 ? 3.1 : 2.6} strokeLinecap="round"></path>;
        })}
      </>;
    } else {
      const A = ranked[0], B = ranked[1] || ranked[0];
      const R = 9.4;
      const th = ang(A) + (A.hi ? 0 : Math.PI);
      const ratio = Math.max(0.52, Math.min(0.8, 0.54 + 0.6 * (A.st - B.st)));
      const d = R * (1 - 2 * ratio);
      const al = Math.acos(Math.max(-1, Math.min(1, d / R)));
      const [x0, y0] = P(th - al, R), [x1, y1] = P(th + al, R);
      body = <>
        <circle cx="12" cy="12" r={R} fill={lift(B.hue)}></circle>
        <path d={`M ${x0} ${y0} A ${R} ${R} 0 ${2 * al > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`} fill={deep(A.hue)}></path>
        <circle cx="12" cy="12" r={R} fill="none" stroke="var(--ink)" strokeWidth="0.6" opacity="0.1"></circle>
      </>;
    }
    return (
      <span title={title} aria-hidden={title ? undefined : true} style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size, ...style }}>
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>{body}</svg>
      </span>
    );
  }

  const inner = plate ? Math.round(size * 0.76) : size;
  const base = n > 5 ? 1.45 : 1.65;
  return (
    <span title={title} aria-hidden={title ? undefined : true} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: size, height: size, borderRadius: '28%', background: plate ? `color-mix(in oklch, ${cfg.banner} 12%, var(--surface-2))` : 'none', border: plate ? `0.5px solid color-mix(in oklch, ${cfg.banner} 30%, var(--rule))` : 'none', boxSizing: 'border-box', ...style }}>
      <svg width={inner} height={inner} viewBox="0 0 24 24" style={{ display: 'block' }}>
        <line x1="12" y1={pad - 0.6} x2="12" y2={24 - pad + 0.6} stroke="var(--ink-3)" strokeWidth="0.9" opacity="0.32"></line>
        {rows.map((r) => (
          <g key={r.id}>
            <line x1={pad} y1={r.y} x2={24 - pad} y2={r.y} stroke="var(--ink-3)" strokeWidth="0.8" opacity="0.18"></line>
            <circle cx={pad + (r.v / 100) * span} cy={r.y} r={base * (0.78 + 0.5 * r.st)} fill={`oklch(0.5 0.13 ${r.hue})`} opacity={0.45 + 0.55 * r.st}></circle>
          </g>
        ))}
      </svg>
    </span>
  );
}
// The hue a type's mark is built from — its strongest-leaning axis. Anything
// that wants to colour-match a named type (progress dots, its label) reads it
// from here, so a type and its row can't drift to different colours.
function typeHue(testKey, name, values) {
  const cfg = RP_TESTS[testKey];
  let sig = values;
  if (!sig && name) { const sys = IS_ARCHETYPES[testKey]; const a = sys && sys.list.find(t => t.name === name); sig = a && a.sig; }
  if (!cfg || !sig) return null;
  const ids = Object.keys(cfg.hues).filter(id => sig[id] != null);
  if (!ids.length) return null;
  const best = ids
    .map((id) => ({ hue: cfg.hues[id], st: Math.abs(Math.max(0, Math.min(100, sig[id])) - 50) / 50 }))
    .sort((a, b) => b.st - a.st)[0];
  return best.hue;
}
export function typeColor(testKey, name, values, fallback) {
  const h = typeHue(testKey, name, values);
  return h == null ? (fallback || 'var(--accent)') : `oklch(0.52 0.14 ${h})`;
}
// The same two-tone split the slice mark draws: the dominant axis' deep hue
// takes `ratio` of the shape, the runner-up's lighter hue takes the rest. Any
// element that wants to wear a type's signature (the progress dots) can lay
// this over its own shape and stay in lockstep with the mark.
export function typeSplit(testKey, name, values) {
  const cfg = RP_TESTS[testKey];
  let sig = values;
  if (!sig && name) { const sys = IS_ARCHETYPES[testKey]; const a = sys && sys.list.find(t => t.name === name); sig = a && a.sig; }
  if (!cfg || !sig) return null;
  const ids = Object.keys(cfg.hues).filter(id => sig[id] != null);
  if (!ids.length) return null;
  const ranked = ids
    .map((id) => ({ hue: cfg.hues[id], st: Math.abs(Math.max(0, Math.min(100, sig[id])) - 50) / 50 }))
    .sort((a, b) => b.st - a.st);
  const A = ranked[0], B = ranked[1] || ranked[0];
  const ratio = Math.max(0.52, Math.min(0.8, 0.54 + 0.6 * (A.st - B.st)));
  // the mark's pale second tone is enclosed by a stroke at 18px; a bare 10px
  // pill needs it a step deeper or the minor share reads as an EMPTY segment.
  return { ratio, deep: `oklch(0.52 0.14 ${A.hue})`, lift: `oklch(0.68 0.115 ${B.hue})` };
}

// ── the type index: every type in a test — mark, one-liner, how common ──
function TypeIndexSheet({ testKey, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 230); };
  const sys = IS_ARCHETYPES[testKey];
  const cfg = RP_TESTS[testKey];
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  if (!sys || !host) return null;
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  const arch = R && R.dims && window.IS_matchArchetype ? window.IS_matchArchetype(testKey, R.dims) : null;
  const yours = arch ? arch.list[arch.idx].name : null;
  const list = sys.list.slice().sort((a, b) => (b.share || 0) - (a.share || 0));
  const maxShare = list[0].share || 1;
  const banner = cfg ? cfg.banner : 'var(--accent)';
  return ReactDOM.createPortal(
    <Sheet onClose={close} closing={closing} label={`The ${list.length} types`}>
        <div style={{ padding: '10px 18px 4px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flex: 1 }}>The {list.length} types</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>bar = how common</span>
          <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, alignSelf: 'center', WebkitAppearance: 'none' }}>{'\u2715'}</button>
        </div>
        <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column' }}>
          {list.map((a, i) => {
            const you = a.name === yours;
            return (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', borderTop: i === 0 ? 'none' : '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', background: you ? `linear-gradient(90deg, color-mix(in oklch, ${banner} 9%, transparent), transparent 70%)` : 'none', borderRadius: you ? 10 : 0 }}>
                <TypeMark testKey={testKey} name={a.name} size={38}></TypeMark>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontFamily: 'var(--sans)', fontWeight: 750, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{a.name}</span>
                    {you ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', padding: '1.5px 7px', borderRadius: 999, background: banner, color: 'var(--surface)' }}>YOU</span> : null}
                  </div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.35, marginTop: 2, textWrap: 'pretty' }}>{a.line}</div>
                </div>
                <div style={{ flexShrink: 0, width: 58, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} title={a.share + '% of people land here'}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{a.share}%</span>
                  <span style={{ width: '100%', height: 4, borderRadius: 999, background: 'color-mix(in oklch, var(--ink-3) 16%, transparent)' }}><span style={{ display: 'block', width: Math.max(6, (a.share / maxShare) * 100) + '%', height: '100%', borderRadius: 999, background: you ? banner : `color-mix(in oklch, ${banner} 55%, var(--ink-3))` }}></span></span>
                </div>
              </div>
            );
          })}
        </div>
    </Sheet>, host);
}
Object.assign(window, { TypeMark, TypeIndexSheet, IS_typeColor: typeColor, IS_typeSplit: typeSplit });

;globalThis.TypeMark = typeof TypeMark === 'undefined' ? globalThis.TypeMark : TypeMark;
;globalThis.TypeIndexSheet = typeof TypeIndexSheet === 'undefined' ? globalThis.TypeIndexSheet : TypeIndexSheet;
