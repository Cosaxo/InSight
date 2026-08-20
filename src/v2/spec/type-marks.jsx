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
import { IS_TEST_RESULTS } from './test-definitions.js';
import LIVE from '../data/live';
// How common a type actually is, counted (D157) — see TypeIndexSheet.
import { myTypeOn, typeSharesOn } from '../data/typeMix.ts';

// type-marks.jsx — data-true type marks. A type's mark IS its signature.
// Archetype signatures are built EXTREME on 1–2 defining axes and near-neutral
// elsewhere, so the mark is built from those two axes only — never all six.
// Each axis owns a hue and a position on a clock, drawn as a SLICE: one
// two-tone disc whose split angle is the defining axis and whose darker share
// is how much it dominates. Pure colour + angle; reads at 16px. The judged
// alternatives (ring, dots) left with the v28 teardown (§10) — the slice won.
// Exported by name (D39, "convert on touch") alongside the window bag below.
export function TypeMark({ testKey, name, values, size = 20, style, title }) {
  const cfg = RP_TESTS[testKey];
  let sig = values;
  if (!sig && name) { const sys = IS_ARCHETYPES[testKey]; const a = sys && sys.list.find(t => t.name === name); sig = a && a.sig; }
  if (!cfg || !sig) return null;
  const ids = Object.keys(cfg.hues).filter(id => sig[id] != null);
  if (!ids.length) return null;
  const n = ids.length;
  const rows = ids.map((id, i) => {
    const v = Math.max(0, Math.min(100, sig[id]));
    return { id, v, i, st: Math.abs(v - 50) / 50, hue: cfg.hues[id], hi: v >= 50 };
  });
  const ranked = rows.slice().sort((a, b) => b.st - a.st);
  const ang = (r) => (-90 + r.i * (360 / n)) * Math.PI / 180;   // each axis owns a clock position
  const deep = (h) => `oklch(0.52 0.14 ${h})`;
  const lift = (h) => `oklch(0.79 0.08 ${h})`;

  const P = (a, r) => [(12 + Math.cos(a) * r).toFixed(2), (12 + Math.sin(a) * r).toFixed(2)];
  const A = ranked[0], B = ranked[1] || ranked[0];
  const R = 9.4;
  const th = ang(A) + (A.hi ? 0 : Math.PI);
  const ratio = Math.max(0.52, Math.min(0.8, 0.54 + 0.6 * (A.st - B.st)));
  const d = R * (1 - 2 * ratio);
  const al = Math.acos(Math.max(-1, Math.min(1, d / R)));
  const [x0, y0] = P(th - al, R), [x1, y1] = P(th + al, R);
  return (
    <span title={title} aria-hidden={title ? undefined : true} style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
        <circle cx="12" cy="12" r={R} fill={lift(B.hue)}></circle>
        <path d={`M ${x0} ${y0} A ${R} ${R} 0 ${2 * al > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`} fill={deep(A.hue)}></path>
        <circle cx="12" cy="12" r={R} fill="none" stroke="var(--ink)" strokeWidth="0.6" opacity="0.1"></circle>
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
//
// "How common" was `IS_ARCHETYPES[].share` until D157: hand-authored
// percentages, drawn as a bar chart under the heading `bar = how common`,
// on the sheet you open from a card that has just named your own type.
// The same defect D149 took off the learn reveal, and the same fix —
// `typeSharesOn` counts the session's cached sample and the sheet says
// what it counted, or the column is not there at all.
//
// Three states, and the middle one is the release this was reported
// against:
//   demo          the authored share, because the whole population there
//                 is authored and there is nothing to measure
//   live, thin    no share column, one line saying why. Not a bar at 0%:
//                 that reads as "nobody is this type", which is a much
//                 stronger claim than "we have not counted anyone yet"
//   live, counted the measured count and share over the stated basis
//
// The measured fold is Big Five only, which is the Art. 9 scope
// docs/data-inventory.md draws and `typeMix.TYPE_TEST` enforces. So the
// politics, values and social sheets lose their shares in a live build
// and gain nothing — the alternative was keeping a fabricated number on
// three sheets to avoid noticing it was fabricated on the fourth.
function TypeIndexSheet({ testKey, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 230); };
  const sys = IS_ARCHETYPES[testKey];
  const cfg = RP_TESTS[testKey];
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  if (!sys || !host) return null;
  const R = IS_TEST_RESULTS[testKey];
  const arch = R && R.dims && window.IS_matchArchetype ? window.IS_matchArchetype(testKey, R.dims) : null;
  const yours = arch ? arch.list[arch.idx].name : (LIVE.enabled ? myTypeOn(testKey) : null);
  // Measured counts, keyed by name, or null when there is no measurement
  // to be had. `typedN` 0 is a real answer and not the same as null: it
  // means the sample was read and nobody in it carries a result.
  const shares = typeSharesOn(testKey);
  const counted = !!shares && shares.typedN > 0;
  const byName = counted ? Object.fromEntries(shares.rows.map((r) => [r.name, r])) : null;
  const list = sys.list.slice().sort(counted
    ? (a, b) => (byName[b.name].n - byName[a.name].n) || a.name.localeCompare(b.name)
    // Live-but-thin keeps the authored ORDER rather than the authored
    // number: an order is not a percentage and nothing on screen reads it
    // as one, while alphabetising thirteen types would be a worse sheet
    // for no honesty gained.
    : (a, b) => (b.share || 0) - (a.share || 0));
  const top = counted ? Math.max(1, ...shares.rows.map((r) => r.n)) : (list[0].share || 1);
  const banner = cfg ? cfg.banner : 'var(--accent)';
  // What the right-hand column is measured over — said once in the
  // header, so no row has to carry a denominator.
  const caption = counted
    ? `of ${shares.typedN} ${shares.typedN === 1 ? 'person' : 'people'} counted`
    : LIVE.enabled ? null : 'bar = how common';
  return ReactDOM.createPortal(
    <Sheet onClose={close} closing={closing} label={`The ${list.length} types`}>
        <div style={{ padding: '10px 18px 4px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flex: 1 }}>The {list.length} types</span>
          {caption ? <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{caption}</span> : null}
          <button className="tap44" onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, alignSelf: 'center', WebkitAppearance: 'none' }}>{'\u2715'}</button>
        </div>
        <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column' }}>
          {LIVE.enabled && !counted ? (
            <div style={{ padding: '4px 2px 12px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, textWrap: 'pretty' }}>
              {/* Before D202 this branch was the Art. 9 refusal and said so
                  ("only counted for the Big Five"). D202 made every
                  instrument in TYPE_SYSTEMS answer, so for the four this
                  sheet can render it is now unreachable — `typeSharesOn`
                  returns null only for a key the archetype module does not
                  define. The guard stays as the D72 posture (null rather
                  than a fabricated fold) and the copy stops naming a scope
                  that is no longer the reason. */}
              {!shares
                ? 'Not counted on this one.'
                : shares.sampleN === 0
                  ? 'Open a question’s who-voted sheet and this fills in.'
                  : `${shares.sampleN} counted so far, none with a result yet.`}
            </div>
          ) : null}
          {list.map((a, i) => {
            const you = a.name === yours;
            const row = byName ? byName[a.name] : null;
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
                {/* The count leads and the share follows it, the same way
                    the learn reveal carries both (D149): "3 people" is a
                    fact, "23%" of an unstated denominator is not. A type
                    nobody carries reads "none" rather than "0%" — the bar
                    is then genuinely empty, not a sliver rounding to
                    nothing. */}
                {row ? (
                  <div style={{ flexShrink: 0, width: 66, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} title={`${row.n} of the ${shares.typedN} ${shares.typedN === 1 ? 'person' : 'people'} counted here`}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{row.n === 0 ? 'none' : row.n + ' · ' + row.pct + '%'}</span>
                    <span style={{ width: '100%', height: 4, borderRadius: 999, background: 'color-mix(in oklch, var(--ink-3) 16%, transparent)' }}><span style={{ display: 'block', width: (row.n / top) * 100 + '%', height: '100%', borderRadius: 999, background: you ? banner : `color-mix(in oklch, ${banner} 55%, var(--ink-3))` }}></span></span>
                  </div>
                ) : LIVE.enabled ? null : (
                  <div style={{ flexShrink: 0, width: 58, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} title={a.share + '% of people land here'}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{a.share}%</span>
                    <span style={{ width: '100%', height: 4, borderRadius: 999, background: 'color-mix(in oklch, var(--ink-3) 16%, transparent)' }}><span style={{ display: 'block', width: Math.max(6, (a.share / top) * 100) + '%', height: '100%', borderRadius: 999, background: you ? banner : `color-mix(in oklch, ${banner} 55%, var(--ink-3))` }}></span></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </Sheet>, host);
}
Object.assign(window, { TypeMark, TypeIndexSheet });

;globalThis.TypeMark = typeof TypeMark === 'undefined' ? globalThis.TypeMark : TypeMark;
;globalThis.TypeIndexSheet = typeof TypeIndexSheet === 'undefined' ? globalThis.TypeIndexSheet : TypeIndexSheet;