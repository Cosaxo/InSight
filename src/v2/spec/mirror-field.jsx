// Ported from design/spec-modules/mirror-field.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA, fmtPop } from './sample-data.js';
import { Av, Lazy, MatchRing } from './primitives.jsx';
import { WPAL } from './world-palette.js';

// mirror-field.jsx — the Mirror rendered as a FIELD, not a scroll of cards.
// One grammar for every population (borrowed from the Map tab):
//   you at the centre · them arranged around you · distance = how unlike you.
// This file holds the shared canvas, detail card, header and lens chips;
// mirror-field-pops.jsx builds the per-population node lists.

const MF_W = 380, MF_H = 404, MF_CX = 190, MF_CY = 196;

// match (0–100) → radius from you. Fixed mapping so every population reads
// on the same scale.
const mfRadius = (m) => Math.max(46, Math.min(164, 48 + ((95 - m) / 45) * 112));

// scenes carry their topic hue (shared with the feed chips) — one formula everywhere
const mfGroupFill = (hue) => hue != null ? WPAL.c(`oklch(0.52 0.12 ${hue})`) : 'var(--accent)';

// banded radius: the node keeps its likeness ordering but inside a fixed ring band
// (groups: yours inside the dotted threshold, suggested beyond it)
const mfBandR = (n) => { const t = Math.max(0, Math.min(1, ((n.match != null ? n.match : 70) - 58) / 34)); return n.band[1] - t * (n.band[1] - n.band[0]); };

// deterministic tiny PRNG for the background "mist" of everyone else
function mfRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ─── layout: radius is the DATA (match); only angles get nudged apart ───
function mfLayout(nodes, seedDeg = -84) {
  const GA = 137.508;
  const sectors = new Map();
  nodes.forEach((n) => {
    if (n.sector != null) {
      if (!sectors.has(n.sector)) sectors.set(n.sector, []);
      sectors.get(n.sector).push(n);
    }
  });
  let gi = 0;
  const pts = nodes.map((n) => {
    let deg;
    if (n.sector != null) {
      const grp = sectors.get(n.sector);
      const k = grp.indexOf(n), m = grp.length;
      deg = n.sector + (m > 1 ? (k - (m - 1) / 2) * (44 / Math.max(1, m - 1)) : 0);
    } else {
      deg = seedDeg + gi * GA; gi += 1;
    }
    return { n, deg, r: n.band ? mfBandR(n) : mfRadius(n.match) };
  });
  const xy = (p) => ({
    x: MF_CX + Math.cos(p.deg * Math.PI / 180) * p.r,
    y: MF_CY + Math.sin(p.deg * Math.PI / 180) * p.r,
  });
  for (let it = 0; it < 90; it++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const A = pts[a], B = pts[b], pa = xy(A), pb = xy(B);
        const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        let need = (A.n.size || 13) + (B.n.size || 13) + 9;
        if (A.n.label && B.n.label) need += 24; // room for the name labels too
        if (A.n.kind === 'group' && B.n.kind === 'group') need += 12; // scene names run wide
        if (d < need) {
          const da = ((A.deg - B.deg + 540) % 360) - 180;
          const push = da >= 0 ? 1.7 : -1.7;
          A.deg += push; B.deg -= push; moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return pts.map((p) => ({ ...p.n, ...xy(p) }));
}

// ─── one node on the field ───
// One dot language for every kind — the same solid dot + surface gap-halo the
// You-map wears. Solid = yours / them; a quiet ring = suggested. No outlines,
// no dashes, no polygons.
function MFNode({ n, on, onTap, i, hideLabel }) {
  const size = n.size || 13;
  const dim = hideLabel && !on;
  // colour carries match too — a deeper accent = more like you (reinforces radius,
  // so hue never reads as random decoration)
  const mix = Math.round(Math.max(62, Math.min(100, n.match != null ? n.match : 70)));
  // the neutral end of the mix carries the node's own hue, so far dots drift
  // toward their individuality while near dots stay deep accent
  const dot = `color-mix(in oklch, var(--accent) ${mix}%, ${n.hue != null ? `oklch(0.72 0.06 ${n.hue})` : 'var(--surface-3)'})`;
  const labelFill = on ? 'var(--ink)' : n.faint ? 'var(--ink-3)' : 'var(--ink-2)';
  // deterministic per-node drift — tiny, slow, desynced
  const sd = (n.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), i * 7);
  const r1 = (sd % 97) / 97, r2 = (sd % 61) / 61, r3 = (sd % 43) / 43;
  return (
    <g className="mf-node" onClick={(e) => { e.stopPropagation(); onTap(n); }} style={{
      cursor: 'pointer', transformBox: 'fill-box', transformOrigin: 'center',
      // unlabelled dots sit back a step, so the labelled few read as an edited
      // choice rather than an unfinished one
      opacity: dim ? 0.62 : 1, transition: 'opacity .3s ease',
      '--dx': (r1 * 6 - 3).toFixed(1) + 'px', '--dy': (r2 * 6 - 3).toFixed(1) + 'px',
      animation: `mfIn 0.5s cubic-bezier(0.2,0.8,0.2,1) ${0.06 + i * 0.045}s both, mfDrift ${(4.5 + r3 * 3).toFixed(1)}s ease-in-out ${(0.7 + r1 * 2).toFixed(1)}s infinite alternate`,
    }}>
      {/* generous invisible hit target */}
      <circle cx={n.x} cy={n.y} r={Math.max(size + 8, 22)} fill="transparent"></circle>
      {/* surface gap-halo — same white ring the Map's dots wear */}
      <circle cx={n.x} cy={n.y} r={size + 2.5} fill="var(--surface-2)"></circle>
      {on && <circle cx={n.x} cy={n.y} r={size + 5} fill="none" stroke="var(--accent)" strokeWidth="1.8"></circle>}
      {n.kind === 'person' && (<>
        <circle cx={n.x} cy={n.y} r={size} fill={dot}></circle>
        <text x={n.x} y={n.y + 3.8} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5" fontWeight="700" fill="#fff">{n.init}</text>
      </>)}
      {n.kind === 'anon' && (<>
        <circle cx={n.x} cy={n.y} r={size} fill={dot}></circle>
        {/* anonymous — a solid silhouette where a named dot carries initials */}
        <g fill="var(--surface-2)" opacity="0.95">
          <circle cx={n.x} cy={n.y - size * 0.30} r={size * 0.27}></circle>
          <path d={`M ${n.x - size * 0.52} ${n.y + size * 0.66} a ${size * 0.52} ${size * 0.46} 0 0 1 ${size * 1.04} 0 Z`}></path>
        </g>
      </>)}
      {n.kind === 'group' && (
        n.faint
          ? <g>
              <circle cx={n.x} cy={n.y} r={size} fill="var(--surface-2)"
                stroke={`color-mix(in oklch, ${mfGroupFill(n.hue)} 70%, transparent)`} strokeWidth="1.6"></circle>
              <path d={`M ${n.x - 3.4} ${n.y} H ${n.x + 3.4} M ${n.x} ${n.y - 3.4} V ${n.y + 3.4}`}
                stroke={mfGroupFill(n.hue)} strokeWidth="1.8" strokeLinecap="round"></path>
            </g>
          : <circle cx={n.x} cy={n.y} r={size} fill={mfGroupFill(n.hue)}></circle>
      )}
      {n.kind === 'city' && (<>
        {n.home && <circle cx={n.x} cy={n.y} r={12} fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.55"></circle>}
        <circle cx={n.x} cy={n.y} r={7} fill={dot}></circle>
      </>)}
      {n.label && (!hideLabel || on) && (
        <text x={n.x} y={n.y + size + 12.5} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5"
          fontWeight={on ? 800 : 600} fill={labelFill} letterSpacing="-0.01em"
          stroke="var(--surface)" strokeWidth="3" strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>{n.label}</text>
      )}
    </g>
  );
}

// ─── the field canvas ───
function MFCanvas({ nodes, selId, onSel, seedDeg, mist = 0, mistSeed = 7, tall = false, stretch: stretchProp, maxLabels }) {
  // The field FILLS its frame: the wrapper takes the leftover column space and the
  // svg (absolutely placed, so it can never feed back into that measurement) gets a
  // viewBox matched to the measured aspect. Radii stay circular — only the amount of
  // field around you grows, so there is no dead sky under a sparse population.
  const wrapRef = React.useRef(null);
  const [box, setBox] = React.useState(null);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 8 && r.height > 8) setBox({ w: r.width, h: r.height }); };
    read();
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const key = nodes.map((n) => n.id + ':' + n.match + (n.faint ? 'f' : '')).join('|');
  // Keyed on the content hash above, not on `nodes` — the array identity
  // changes every render while the layout only needs to move when a node's
  // id/match/faint actually changes. That part is deliberate.
  //
  // `seedDeg` is the loose end: it is not in `key`, so changing it alone
  // will not relayout. Every caller currently passes it as a constant per
  // field, so it cannot bite today — fold it into `key` before making it
  // dynamic. Recorded rather than widened because there is no DOM test here.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above
  const placed = React.useMemo(() => mfLayout(nodes, seedDeg), [key]);
  // viewBox: content extent, then grown to the measured aspect ratio
  const ext = React.useMemo(() => {
    let top = MF_CY - 46, bot = MF_CY + 46;
    placed.forEach((n) => { const s = n.size || 13; top = Math.min(top, n.y - s - 10); bot = Math.max(bot, n.y + s + (n.label ? 22 : 10)); });
    const contentH = bot - top, cc = (top + bot) / 2;
    const aspectH = box ? MF_W * (box.h / box.w) : (tall ? 470 : MF_H);
    const h = Math.max(contentH, aspectH);
    return { y: cc - h / 2, h };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [key, box, tall]);
  // how far the crowd reaches vertically — derived from the frame, not a magic number
  const stretch = stretchProp || (mist ? Math.max(1, Math.min(2.3, (ext.h / 2 - 14) / 178)) : 1);
  const mistDots = React.useMemo(() => {
    if (!mist) return [];
    const n = Math.round(mist * Math.min(1.7, Math.max(1, stretch)));
    const rnd = mfRand(mistSeed * 7919 + 17);
    return Array.from({ length: n }, () => {
      const t = Math.pow(rnd(), 1.4);
      const r = 60 + 118 * t;
      const a = rnd() * Math.PI * 2;
      return { x: MF_CX + Math.cos(a) * r, y: MF_CY + Math.sin(a) * r * stretch, o: (0.5 - t * 0.2) + rnd() * 0.12, s: 1.9 + rnd() * 1 };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [mist, mistSeed, Math.round(stretch * 20)]);
  const sel = placed.find((n) => n.id === selId);
  // only the strongest few wear their name — the rest are read by position and
  // give up their name on tap
  const named = React.useMemo(() => {
    if (!maxLabels) return null;
    return new Set([...nodes].sort((a, b) => (b.match || 0) - (a.match || 0)).slice(0, maxLabels).map((n) => n.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [key, maxLabels]);
  return (
    <div ref={wrapRef} className="mf-canvaswrap" style={{ margin: '4px -6px 0' }}>
      <style>{`@keyframes mfIn { from { opacity: 0; transform: scale(0.45); } } @keyframes mfDrift { to { transform: translate(var(--dx), var(--dy)); } } @keyframes mfBreathe { 0%, 100% { opacity: 0.07; } 50% { opacity: 0.17; } } @keyframes mfBreathe2 { 0%, 100% { opacity: 0.03; } 50% { opacity: 0.10; } } @keyframes mfRing { 0%, 100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.45; } } @media (prefers-reduced-motion: reduce) { .mf-node, .mf-you-halo, .mf-ring, .mf-mist { animation: none !important; } }`}</style>
      <svg viewBox={`0 ${ext.y} ${MF_W} ${ext.h}`} preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} onClick={() => onSel(null)}>
        <defs>
          <radialGradient id="mfGlow" cx="50%" cy="48%" r="55%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.07"></stop>
            <stop offset="75%" stopColor="var(--accent)" stopOpacity="0"></stop>
          </radialGradient>
        </defs>
        <rect x="0" y={ext.y} width={MF_W} height={ext.h} fill="url(#mfGlow)"></rect>

        {/* likeness rings — closer to you = more alike */}
        {[88, 62].map((m, i) => (
          <circle key={m} className="mf-ring" cx={MF_CX} cy={MF_CY} r={mfRadius(m)} fill="none" stroke={`color-mix(in oklch, var(--accent) ${54 - i * 18}%, var(--rule))`}
            strokeWidth="1.2" strokeDasharray={i === 0 ? 'none' : '2 6'} opacity={0.95 - i * 0.22}
            style={{ animation: `mfRing ${(7 + i * 1.8).toFixed(1)}s ease-in-out ${(i * 1.1).toFixed(1)}s infinite` }}></circle>
        ))}

        {/* the crowd you can't name — a quiet mist */}
        {mistDots.map((d, i) => (
          <circle key={i} className="mf-mist" cx={d.x} cy={d.y} r={d.s} fill="color-mix(in oklch, var(--accent) 45%, var(--ink-3))" opacity={d.o}
            style={{ '--dx': (((i % 5) - 2) * 1.7) + 'px', '--dy': (((i % 7) - 3) * 1.3) + 'px', animation: `mfDrift ${(7 + (i % 5) * 2.1).toFixed(1)}s ease-in-out ${(-(i % 9) * 1.4).toFixed(1)}s infinite alternate` }}></circle>
        ))}

        {/* selection spoke — the distance being read */}
        {sel && (
          <line x1={MF_CX} y1={MF_CY} x2={sel.x} y2={sel.y} stroke="var(--accent)"
            strokeWidth="1" strokeDasharray="2.5 3.5" opacity="0.55"></line>
        )}

        {/* you — twin breathing halos, offset phases, for a bit of depth */}
        <circle className="mf-you-halo" cx={MF_CX} cy={MF_CY} r="40" fill="var(--accent)" opacity="0.05" style={{ animation: 'mfBreathe2 6.5s ease-in-out 1.4s infinite' }}></circle>
        <circle className="mf-you-halo" cx={MF_CX} cy={MF_CY} r="27" fill="var(--accent)" opacity="0.10" style={{ animation: 'mfBreathe 4.2s ease-in-out infinite' }}></circle>
        <circle cx={MF_CX} cy={MF_CY} r="17.5" fill="var(--ink)"></circle>
        <text x={MF_CX} y={MF_CY + 4} textAnchor="middle" fontFamily="var(--sans)" fontSize="11.5" fontWeight="700" fill="var(--surface)">you</text>

        {placed.map((n, i) => (
          <MFNode key={n.id} n={n} i={i} on={n.id === selId} onTap={onSel} hideLabel={!!named && !named.has(n.id)}></MFNode>
        ))}
      </svg>
    </div>
  );
}

// ─── quiet key under the field — always shown so the distance encoding stays readable ───
function MFKey({ items }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 14, padding: '6px 14px',
        background: 'var(--surface)', border: '0.5px solid var(--rule)', borderRadius: 999,
      }}>
        {items.map((it, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
            {it.glyph === 'ring'
              ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.6px solid color-mix(in oklch, var(--accent) 60%, transparent)', flexShrink: 0, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>+</span>
              : <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}></span>}
            {it.label}
          </span>
        ))}
      </span>
    </div>
  );
}

// ─── the sparse mirror: a population you can see, a likeness you haven't earned ───
// You + the rings + the crowd's mist are honest with no answers at all; the
// placed dots are not, so they stay away until there is signal. Progress reads
// as dots, not a sentence about dots.
function MFSparse({ done = 0, need = 8 }) {
  const left = Math.max(0, need - done);
  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {Array.from({ length: need }).map((_, i) => (
          <span key={i} style={{
            width: 9, height: 9, borderRadius: '50%', boxSizing: 'border-box',
            background: i < done ? 'var(--accent)' : 'transparent',
            border: i < done ? 'none' : '1.3px solid color-mix(in oklch, var(--accent) 45%, var(--rule))',
          }}></span>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', maxWidth: 250, lineHeight: 1.25, textWrap: 'pretty' }}>
        {left} more answers and they take their places.
      </div>
      <button className="press" onClick={() => window.goTab && window.goTab('track')} style={{
        border: 'none', borderRadius: 999, padding: '11px 20px', cursor: 'pointer', WebkitAppearance: 'none',
        background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
      }}>Answer today's</button>
    </div>
  );
}

// ─── compact header above the canvas ───
function MFHeader({ kicker, fig, unit, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, margin: '4px 2px 0' }}>
      <div style={{ minWidth: 0 }}>
        {kicker && <div className="kicker">{kicker}</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: kicker ? 3 : 0 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 29, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>{fig}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{unit}</span>
        </div>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ─── small anonymous avatar (near-field detail) ───
function MFAnonAv({ hue, size = 40 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `oklch(0.88 0.05 ${hue})`, border: `0.5px solid oklch(0.55 0.13 ${hue})`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} style={{ display: 'block' }}
        fill="none" stroke={`oklch(0.40 0.13 ${hue})`} strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="8.6" r="3.7"></circle>
        <path d="M 5.6 20 a 6.4 6.2 0 0 1 12.8 0"></path>
      </svg>
    </span>
  );
}

// ─── the tapped node, unfolded — one card, appears only on demand ───
function MFDetail({ node, onPerson, onJoin, onLeave, joined }) {
  if (!node) return null;
  const d = node.data || {};
  const hue = node.hue != null ? node.hue : 200;
  const btn = (label, onClick, primary) => (
    <button className="press" onClick={onClick} style={{
      flexShrink: 0, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
      background: primary ? 'var(--accent)' : 'var(--surface)',
      color: primary ? 'var(--surface)' : 'var(--ink-2)',
      border: primary ? 'none' : '0.5px solid var(--rule)',
      fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em',
    }}>{label}</button>
  );
  let av = null, title = '', sub = '', chips = null, action = null;

  if (node.kind === 'person') {
    av = <MatchRing pct={node.match} color={`oklch(0.5 0.13 ${hue})`} size={52}><Av init={node.init} hue={hue} size={38}></Av></MatchRing>;
    title = d.name || node.label;
    sub = [d.rel, d.since ? `since ${d.since}` : null, d.hood, d.dist].filter(Boolean).join(' · ');
    if (d.shared) chips = d.shared;
    if (d.id && onPerson) action = btn('Portrait →', () => onPerson(d));
  } else if (node.kind === 'anon') {
    av = <MatchRing pct={node.match} color={`oklch(0.5 0.13 ${hue})`} size={52}><MFAnonAv hue={hue} size={38}></MFAnonAv></MatchRing>;
    title = `${(d.role || '').replace(/^\w/, (c) => c.toUpperCase())}, ${d.age}`;
    sub = d.dist && d.dist.includes('km') ? 'nearby' : (d.dist || 'nearby');
    chips = (d.interests || []).slice(0, 3).map((x) => x.t);
    if (d.id && onPerson) action = btn('Portrait →', () => onPerson(d));
  } else if (node.kind === 'group') {
    const gcol = mfGroupFill(node.hue);
    av = (
      <MatchRing pct={node.match} color={gcol} size={52}>
        <span style={{
          width: 17, height: 17, borderRadius: '50%', boxSizing: 'border-box',
          background: joined ? gcol : 'var(--surface-2)',
          border: joined ? 'none' : `1.6px solid color-mix(in oklch, ${gcol} 70%, transparent)`,
        }}></span>
      </MatchRing>
    );
    title = d.name;
    sub = `${fmtPop(d.members)} people · ${d.vibe}`;
    action = joined
      ? btn('Unfollow', () => onLeave(d.id))
      : btn('Follow', () => onJoin(d.id), true);
  } else if (node.kind === 'city') {
    av = <MatchRing pct={node.match} color={`oklch(0.5 0.13 ${hue})`} size={52}><span style={{ width: 13, height: 13, borderRadius: '50%', background: `oklch(0.63 0.13 ${hue})` }}></span></MatchRing>;
    title = d.name || node.label;
    sub = node.home ? 'where you live now' : [d.country, d.mood].filter(Boolean).join(' · ');
    const known = IS_DATA.cities && IS_DATA.cities.some((c) => c.name === title);
    if (known && window.openCity) action = btn('Explore →', () => window.openCity(title));
  }

  return (
    <div className="card fade-in" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 13 }}>
      {av}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
        {chips && chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {chips.map((c) => (
              <span key={c} style={{
                fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 500, color: `oklch(0.34 0.13 ${hue})`,
                padding: '2px 8px', borderRadius: 99, background: `oklch(0.95 0.03 ${hue})`, border: `0.5px solid oklch(0.85 0.05 ${hue})`,
              }}>{c}</span>
            ))}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── nav v2: the lens row alone, promoted to the top of the screen. The row is
// real tabs and "Overview" is the field itself, so all navigation sits above
// the content instead of hiding at the bottom edge.
// Exported by name (D39, "convert on touch"): the Mirror bodies import it.
// It stayed on the window bag as well until D137, for sites that had all
// already moved — group-mirror.jsx and mirror-field-pops.jsx import it.
export function MirrorLensRow({ lenses, open, onOpen }) {
  const idx = lenses.findIndex((l) => l.id === open);
  // six stops have to fit a phone without clipping — the row never scrolls
  const fs = lenses.length >= 6 ? 11.5 : lenses.length === 5 ? 13 : 14.5;
  return (
    <div className="mm-lensrow mm-lensrow-top" role="tablist" aria-label="Lenses" style={{ '--n': lenses.length }}>
      <span className={'mm-lensthumb' + (idx < 0 ? ' is-off' : '')} style={{ transform: `translateX(${Math.max(0, idx) * 100}%)` }} aria-hidden="true"></span>
      {lenses.map((l) => (
        <button key={l.id} data-lens={l.id} role="tab" aria-selected={open === l.id}
          className={'mm-lensbtn' + (open === l.id ? ' is-on' : '')} style={{ fontSize: fs, padding: '10px 3px' }}
          onClick={() => onOpen(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}

// ─── lens chips — the old sections, now opt-in layers under the field ───
//
// DOCKED (D182). The row and the open lens used to share one
// `marginTop: 'auto'` wrapper, which put the row at the bottom of the view
// only while nothing was open — opening a lens grew the wrapper past the
// fold and the row rode up with it, and the effect below then scrolled it
// to the TOP of the scroller. Two positions for one bar, plus a slide
// between them.
//
// They are two elements now: the row in `.mm-lensdock`, which is pinned to
// the bottom of the view in both states, and the lens as its own sibling
// above it. Same split, and the same class, as the live stops
// (ui/LiveCohortBody). The parent is `.mf-stage`, already the filling flex
// column the dock needs.
function MirrorLenses({ lenses }) {
  const [open, setOpen] = React.useState(null);
  const cur = lenses.find((l) => l.id === open);
  const idx = lenses.findIndex((l) => l.id === open);
  // The open lens, not the row: the row is on screen already, and the lens
  // opens below the field where nobody can see it.
  const lensRef = React.useRef(null);
  React.useEffect(() => {
    if (!open || !lensRef.current) return;
    const lens = lensRef.current;
    let sp = lens.parentElement;
    while (sp && !(sp.scrollHeight > sp.clientHeight && /(auto|scroll)/.test(getComputedStyle(sp).overflowY))) sp = sp.parentElement;
    if (!sp) return;
    const t = setTimeout(() => {
      const top = lens.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - 12;
      sp.scrollTo({ top, behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <React.Fragment>
      <div className="mm-lensdock">
        <div className="mm-lensrow mm-lensrow-top" role="tablist" aria-label="Lenses" style={{ '--n': lenses.length }}>
          <span className={'mm-lensthumb' + (idx < 0 ? ' is-off' : '')} style={{ transform: `translateX(${Math.max(0, idx) * 100}%)` }} aria-hidden="true"></span>
          {lenses.map((l) => (
            <button key={l.id} data-lens={l.id} role="tab" aria-selected={open === l.id}
              className={'mm-lensbtn' + (open === l.id ? ' is-on' : '')}
              onClick={() => setOpen(open === l.id ? null : l.id)}>{l.label}</button>
          ))}
        </div>
      </div>
      {cur && (
        <div ref={lensRef} key={cur.id} className="fade-in">
          <Lazy minHeight={480}>{cur.render()}</Lazy>
        </div>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { MFCanvas, MFDetail, MFHeader, MFKey, MFSparse, MirrorLenses, mfRadius });


;globalThis.mfRand = typeof mfRand === 'undefined' ? globalThis.mfRand : mfRand;
;globalThis.mfLayout = typeof mfLayout === 'undefined' ? globalThis.mfLayout : mfLayout;
;globalThis.MFNode = typeof MFNode === 'undefined' ? globalThis.MFNode : MFNode;
;globalThis.MFCanvas = typeof MFCanvas === 'undefined' ? globalThis.MFCanvas : MFCanvas;
;globalThis.MFKey = typeof MFKey === 'undefined' ? globalThis.MFKey : MFKey;
;globalThis.MFHeader = typeof MFHeader === 'undefined' ? globalThis.MFHeader : MFHeader;
;globalThis.MFAnonAv = typeof MFAnonAv === 'undefined' ? globalThis.MFAnonAv : MFAnonAv;
;globalThis.MFDetail = typeof MFDetail === 'undefined' ? globalThis.MFDetail : MFDetail;
;globalThis.MirrorLenses = typeof MirrorLenses === 'undefined' ? globalThis.MirrorLenses : MirrorLenses;
;globalThis.MF_W = typeof MF_W === 'undefined' ? globalThis.MF_W : MF_W;
;globalThis.mfRadius = typeof mfRadius === 'undefined' ? globalThis.mfRadius : mfRadius;
;globalThis.mfGroupFill = typeof mfGroupFill === 'undefined' ? globalThis.mfGroupFill : mfGroupFill;
;globalThis.mfBandR = typeof mfBandR === 'undefined' ? globalThis.mfBandR : mfBandR;
;globalThis.MF_H = typeof MF_H === 'undefined' ? globalThis.MF_H : MF_H;
;globalThis.MFSparse = typeof MFSparse === 'undefined' ? globalThis.MFSparse : MFSparse;
