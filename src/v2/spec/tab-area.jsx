/* eslint-disable */
// ported from design/spec-modules/tab-area.jsx — do not hand-edit load order assumptions
import React from 'react';

// tab-area.jsx — "Area": one tab that telescopes from your corner out to the world.
// Combines the old around / city / world tabs behind a single scale selector.
// Accent is the city's green throughout; the hero's corner illustration and the
// reach widget both change with the chosen scale.
const { useState: useStateAr } = React;

// ─── accent per scale — Near stays sage-green; the World zoom stops go indigo ───
const areaAccent = (id) => id === 'near' ? 'var(--c-city)' : 'var(--c-world)';

// ─── number formatting ───
const arFmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(n >= 100e6 ? 0 : 1).replace(/\.0$/, '') + 'M'
  : n >= 1e3 ? Math.round(n / 1e3) + 'k'
  : n.toLocaleString();

// ─── the five scales, from your corner outward ───
const AREA_SCALES = [
  {
    id: 'near', label: 'Near', kicker: 'AROUND YOU', extent: '5 KM RADIUS',
    place: 'Near', line1: 'NORWAY · GRÜNERLØKKA', line2: '2,847 people within reach',
    emblem: 'radar', agg: 'around',
    kin: { who: '312', top: 96 },
    reach: { label: 'REACH', bands: [
      { k: 'here', sub: '< 1 km', n: 184 },
      { k: 'close', sub: '< 3 km', n: 1240 },
      { k: 'wider', sub: '< 5 km', n: 2847 },
    ] },
    places: { label: 'POCKETS NEAR YOU', cap: 'people in reach', mode: 'count', rows: [
      { name: 'Grünerløkka', v: 980 }, { name: 'Sofienberg', v: 640 },
      { name: 'St. Hanshaugen', v: 590 }, { name: 'Sentrum', v: 410 },
    ] },
  },
  {
    id: 'city', label: 'City', kicker: 'YOUR CITY', extent: '454 KM²',
    place: 'Oslo', line1: 'NORWAY · 59.9°N 10.7°E', line2: '709,000 residents',
    emblem: 'city', agg: 'city',
    kin: { who: '1 in 8', top: 97 },
    reach: { label: 'REACH', bands: [
      { k: 'centre', sub: '< 2 km', n: 38000 },
      { k: 'inner', sub: '< 6 km', n: 286000 },
      { k: 'greater', sub: '< 15 km', n: 709000 },
    ] },
    places: { label: 'DISTRICTS OF OSLO', cap: 'residents', mode: 'count', rows: [
      { name: 'Grünerløkka', v: 62000 }, { name: 'Frogner', v: 59000 },
      { name: 'Gamle Oslo', v: 58000 }, { name: 'St. Hanshaugen', v: 38000 },
      { name: 'Sentrum', v: 14000 },
    ] },
  },
  {
    id: 'country', label: 'Country', kicker: 'YOUR COUNTRY', extent: '5.5M PEOPLE',
    place: 'Norway', line1: 'NORTHERN EUROPE · KINGDOM', line2: '5.5M across 11 cities',
    emblem: 'country', agg: 'country',
    kin: { who: '1 in 9', top: 97 },
    reach: { label: 'REACH', bands: [
      { k: 'east', sub: 'the østland', n: 1500000 },
      { k: 'south', sub: 'below Trondheim', n: 3800000 },
      { k: 'all', sub: 'the kingdom', n: 5500000 },
    ] },
    places: { label: 'CITIES OF NORWAY', cap: 'residents', mode: 'count', rows: [
      { name: 'Oslo', v: 709000 }, { name: 'Bergen', v: 290000 },
      { name: 'Trondheim', v: 215000 }, { name: 'Stavanger', v: 148000 },
      { name: 'Tromsø', v: 78000 },
    ] },
  },
  {
    id: 'world', label: 'World', kicker: 'YOUR WORLD', extent: 'POP 8.21B',
    place: 'Earth', line1: 'NORTHERN HEMISPHERE', line2: 'spring · 8.21B alive',
    emblem: 'globe', agg: 'world',
    kin: { who: '1 in 9', top: 98 },
    reach: { label: 'REACH', bands: [
      { k: 'timezone', sub: 'your hours', n: 1100000000 },
      { k: 'hemisphere', sub: 'the north', n: 6740000000 },
      { k: 'everyone', sub: 'all alive', n: 8210000000 },
    ] },
    places: { label: "WHERE YOU'D BELONG", cap: 'life-fit', mode: 'pct', rows: [
      { name: 'Lisbon', v: 88 }, { name: 'Copenhagen', v: 87 },
      { name: 'Kyoto', v: 85 }, { name: 'Vancouver', v: 84 },
      { name: 'Ljubljana', v: 83 },
    ] },
  },
];

// ─── adaptive corner illustration — engraved, ink-on-paper, per scale ───
function AreaEmblem({ kind, accent }) {
  const cx = 56, cy = 56, R = 46;
  const frame = <circle cx={cx} cy={cy} r={R} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="0.9" />;
  const clipId = 'areaClip_' + kind;
  const clip = <clipPath id={clipId}><circle cx={cx} cy={cy} r={R} /></clipPath>;

  let inner = null;
  if (kind === 'radar') {
    // concentric radar with scattered nearby dots + center pulse
    const dots = [[44, 40], [70, 46], [62, 70], [40, 66], [50, 52], [74, 62], [36, 50]];
    inner = (<g>
      {[0.4, 0.72, 1].map((k, i) => <circle key={i} cx={cx} cy={cy} r={R * k - 2} fill="none" stroke="var(--rule)" strokeWidth="0.5" strokeDasharray={i < 2 ? '2 2.5' : 'none'} opacity={i === 2 ? 0.7 : 0.5} />)}
      <line x1={cx - R + 4} y1={cy} x2={cx + R - 4} y2={cy} stroke="var(--rule)" strokeWidth="0.4" />
      <line x1={cx} y1={cy - R + 4} x2={cx} y2={cy + R - 4} stroke="var(--rule)" strokeWidth="0.4" />
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill={accent} opacity="0.75" />)}
      <circle cx={cx} cy={cy} r="3" fill="none" stroke={accent} strokeWidth="0.9">
        <animate attributeName="r" values="3;9;3" dur="3.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0;0.7" dur="3.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r="3" fill={accent} stroke="var(--surface)" strokeWidth="0.8" />
    </g>);
  } else if (kind === 'city') {
    // skyline silhouette
    const blds = [[28, 64, 9, 22], [39, 58, 8, 28], [48, 48, 9, 38], [58, 56, 8, 30], [67, 62, 9, 24], [76, 68, 7, 18]];
    inner = (<g clipPath={`url(#${clipId})`}>
      <circle cx="72" cy="40" r="6" fill="none" stroke={accent} strokeWidth="0.9" opacity="0.7" />
      {blds.map(([x, y, w, h], i) => (<g key={i}>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke="var(--ink-2)" strokeWidth="0.8" />
        {Array.from({ length: Math.floor(h / 7) }).map((_, r) => <line key={r} x1={x + 1.5} y1={y + 5 + r * 7} x2={x + w - 1.5} y2={y + 5 + r * 7} stroke="var(--rule)" strokeWidth="0.4" />)}
      </g>))}
      <rect x="48" y="48" width="9" height="38" fill={accent} opacity="0.14" />
      <line x1="22" y1="86" x2="90" y2="86" stroke="var(--ink-2)" strokeWidth="0.8" />
    </g>);
  } else if (kind === 'country') {
    // a flag on a pole — a universal "nation" emblem that works for any country
    inner = (<g clipPath={`url(#${clipId})`}>
      {/* soft ground */}
      <path d="M20 84 Q56 76 92 84 L92 100 L20 100 Z" fill={accent} fillOpacity="0.08" />
      <path d="M20 84 Q56 76 92 84" fill="none" stroke="var(--ink-2)" strokeWidth="0.8" />
      {/* pole */}
      <line x1="42" y1="30" x2="42" y2="83" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="42" cy="27" r="2.6" fill={accent} stroke="var(--surface)" strokeWidth="0.8" />
      {/* waving banner */}
      <path d="M42 33 Q58 28 75 33 Q70.5 41 75 49 Q58 44 42 49 Z"
        fill={accent} fillOpacity="0.2" stroke="var(--ink-2)" strokeWidth="0.95" strokeLinejoin="round" />
      {/* field stripe */}
      <path d="M42 41 Q58 36.5 75 41" fill="none" stroke="var(--rule)" strokeWidth="0.7" />
    </g>);
  } else { // globe
    inner = (<g clipPath={`url(#${clipId})`} stroke="var(--ink-3)" strokeWidth="0.5" fill="none" opacity="0.6">
      {[-30, -15, 0, 15, 30, 45].map(d => {
        const yy = cy - (d / 90) * R, rx = R * Math.cos((d / 90) * Math.PI / 2);
        return <ellipse key={d} cx={cx} cy={yy} rx={rx} ry={R * 0.12} />;
      })}
      {[0, 1, 2, 3].map(i => { const rx = R * Math.cos((i / 4) * Math.PI / 2 * 0.9 + 0.05); return <ellipse key={i} cx={cx} cy={cy} rx={Math.max(3, rx)} ry={R} />; })}
      <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} />
    </g>);
  }

  return (
    <svg viewBox="0 0 112 112" width="96" height="96" style={{ flexShrink: 0 }}>
      <defs>{clip}</defs>
      {frame}
      {inner}
      {kind === 'globe' && (<>
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="var(--ink-3)" strokeWidth="0.7" opacity="0.7" />
        <circle cx={cx + 6} cy={cy - R + 0.28 * 2 * R} r="3" fill="none" stroke={accent} strokeWidth="0.9" opacity="0.6">
          <animate attributeName="r" values="3;7.5;3" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0;0.7" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx + 6} cy={cy - R + 0.28 * 2 * R} r="3" fill={accent} stroke="var(--surface)" strokeWidth="0.8" />
      </>)}
    </svg>
  );
}

// ─── a ring that IS the match figure — arc sweep = how alike you are.
//     Wraps an avatar (or stands alone as a small glyph). No numeral. ───
function MatchRing({ pct, color = 'var(--accent)', size = 50, thick = 2.4, children, title }) {
  const r = (size - thick) / 2;
  const C = 2 * Math.PI * r;
  return (
    <span title={title || `${pct} match`} style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={Math.max(1, thick * 0.55)} opacity="0.8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, pct)) / 100) * C} ${C}`}
          style={{ transition: 'stroke-dasharray 0.4s cubic-bezier(0.2,0.8,0.2,1)' }} />
      </svg>
      {children}
    </span>
  );
}

// ─── the kinship strip — one visual instead of stat pairs. People like you
//     scatter along a match axis, thickening toward the right; the ringed
//     accent dot at the top of the axis is your closest match — its position
//     is the value, so the strip carries no numeral of its own. ───
function AreaKinStrip({ kin, accent = 'var(--c-city)' }) {
  const dots = [12, 19, 25, 32, 38, 43, 49, 54, 60, 66, 72, 79];
  const jit = [4, -3, 1, -4, 3, -1, 4, -3, 0, 3, -3, 1];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
      <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{kin.who} like you</span>
      <div style={{ flex: 1, position: 'relative', height: 26, minWidth: 0 }}>
        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--rule)' }}></span>
        {dots.map((x, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${x}%`, top: `calc(50% + ${jit[i]}px)`, transform: 'translate(-50%, -50%)',
            width: 4.5, height: 4.5, borderRadius: '50%', background: accent,
            opacity: 0.16 + (x / 100) * 0.5,
          }}></span>
        ))}
        <span title={`closest match · ${kin.top}%`} style={{
          position: 'absolute', left: `${kin.top}%`, top: '50%', transform: 'translate(-50%, -50%)',
          width: 11, height: 11, borderRadius: '50%', background: accent,
          border: '2px solid var(--surface)', boxShadow: `0 0 0 1.5px ${accent}`,
        }}></span>
      </div>
    </div>
  );
}

// ─── hero footer: where the people within reach actually are.
//     Folded into the hero (it just breaks the hero's own headcount down by
//     place) instead of living as a second card saying the same thing. ───
function HeroPockets({ places, accent }) {
  const max = Math.max(...places.rows.map(r => r.v));
  return (
    <div style={{ marginTop: 13, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
      <div className="kicker" style={{ marginBottom: 9 }}>{places.label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 18, rowGap: 10 }}>
        {places.rows.slice(0, 4).map(r => (
          <div key={r.name}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
            <div style={{ marginTop: 4, height: 5, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, (r.v / max) * 100)}%`, height: '100%', background: accent, opacity: 0.8, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── adaptive hero, in the world-widget mould, green throughout ───
// zoomCtl: World's telescoping stops render as the hero's footer — not a second nav bar
function AreaHero({ scale, zoomCtl }) {
  const accent = areaAccent(scale.id);
  return (
    <div className="card" style={{
      marginBottom: 14,
      background: `linear-gradient(158deg, var(--surface-2) 0%, color-mix(in oklch, var(--surface-2), ${accent} 8%) 100%)`,
      borderColor: 'var(--rule)', color: 'var(--ink)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -60, right: -50, width: 210, height: 210, borderRadius: '50%', background: `radial-gradient(circle, color-mix(in oklch, ${accent}, transparent 80%), transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '0.5px solid var(--rule)' }}>
          <AreaEmblem kind={scale.emblem} accent={accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.1 }}>{scale.place}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.08em', marginTop: 5 }}>{scale.line1}</div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13.5, color: 'var(--ink-2)', marginTop: 5 }}>{scale.line2}</div>
          </div>
        </div>
        <AreaKinStrip kin={scale.kin} accent={accent} />
        {scale.places && scale.id !== 'world' && <HeroPockets places={scale.places} accent={accent} />}
        {zoomCtl && <div style={{ marginTop: 13, paddingTop: 11, borderTop: '0.5px solid var(--rule)' }}>{zoomCtl}</div>}
      </div>
    </div>
  );
}

// ─── scale-aware reach widget ───
function AreaReach({ scale }) {
  const accent = areaAccent(scale.id);
  const bands = scale.reach.bands;
  const max = Math.max(...bands.map(b => b.n));
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>{scale.reach.label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {bands.map(b => (
          <div key={b.k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 64, flexShrink: 0, fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13.5, color: 'var(--ink-2)' }}>{b.k}</span>
            <span style={{ width: 50, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{b.sub}</span>
            <div style={{ flex: 1, height: 7, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(3, (b.n / max) * 100)}%`, height: '100%', background: accent, borderRadius: 99, opacity: 0.85, transition: 'width 0.35s cubic-bezier(0.2,0.8,0.2,1)' }} />
            </div>
            <span style={{ width: 48, textAlign: 'right', flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)' }}>{arFmt(b.n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── scale-specific "places" list ───
function AreaPlaces({ scale }) {
  const accent = areaAccent(scale.id);
  const P = scale.places;
  const max = Math.max(...P.rows.map(r => P.mode === 'pct' ? 100 : r.v));
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 10 }}><Kicker>{P.label}</Kicker></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {P.rows.map((r, i) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 16, flexShrink: 0, fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13, color: 'var(--ink-3)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)' }}>{r.name}</span>
            <div style={{ width: 92, height: 8, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, ((P.mode === 'pct' ? r.v : r.v) / max) * 100)}%`, height: '100%', background: accent, opacity: 0.75, borderRadius: 99 }} />
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

// ─── political track: you vs the scale ───
function AreaPolBar({ label, left, right, me, them, accent }) {
  const pos = (v) => ((v + 100) / 200) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
        <span>{left}</span><span style={{ color: 'var(--ink-2)' }}>{label}</span><span>{right}</span>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', borderRadius: 99 }}>
        <span style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--rule)' }} />
        <span style={{ position: 'absolute', left: `calc(${pos(them)}% - 5px)`, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--ink-3)' }} title="this scale" />
        <span style={{ position: 'absolute', left: `calc(${pos(me)}% - 5px)`, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: accent, border: '2px solid var(--surface)', transition: 'left 0.35s cubic-bezier(0.2,0.8,0.2,1)' }} title="you" />
      </div>
    </div>
  );
}

// ─── Compare — you vs the people of this scale, across every assessment ───
// The full multi-assessment breakdown lives in CompareBreakdown; here we just
// pick the right population scope + display label for the chosen geo scale.
function AreaCompare({ scale }) {
  const accent = areaAccent(scale.id);
  const scope = AREA_AUD[scale.id]; // near→around, city→city, country/world→world
  const label = scale.id === 'near' ? 'near you' : scale.place;
  return areaEl('CompareBreakdown', { scope, accent, label }) || null;
}

// anonymous nearby-contact avatar — a colored presence dot, no initials
function AreaAnonAv({ hue, size = 42 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `oklch(0.88 0.05 ${hue})`, border: `0.5px solid oklch(0.55 0.13 ${hue})`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: `oklch(0.40 0.13 ${hue})` }} />
    </span>
  );
}

// ─── compact nearby person row (mirrors the old Around list) ───
function AreaPersonRow({ p, onClick }) {
  return (
    <div onClick={onClick} className="card is-tap" style={{ display: 'flex', gap: 13, alignItems: 'center', cursor: 'pointer' }}>
      <MatchRing pct={p.match} color={`oklch(0.5 0.13 ${p.hue})`} size={52} title={`${p.match} match`}>
        <AreaAnonAv hue={p.hue} size={38} />
      </MatchRing>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.015em', textTransform: 'capitalize' }}>{p.gender || p.role}{p.age ? `, ${p.age}` : ''}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontWeight: 500, marginTop: 2 }}>{p.dist}</div>
        <div style={{ marginTop: 5 }}>
          <InterestRun items={(p.interests || []).slice(0, 2)} size={12} style={{ fontFamily: 'var(--sans)', fontStyle: 'normal', fontWeight: 500, letterSpacing: '0' }} />
        </div>
      </div>
    </div>
  );
}

// ─── per-scale lookups: which audience to use ───
const AREA_AUD = { near: 'around', city: 'city', country: 'world', world: 'world' };
const areaEl = (name, props) => typeof window[name] === 'function' ? React.createElement(window[name], props) : null;

// ─── MAIN sub-tab — reach, places, and each scale's signature view ───
function AreaNearSignature({ onPerson }) {
  const D = window.IS_DATA;
  const nearby = D.nearby || [];
  const [allNearby, setAllNearby] = useStateAr(false);
  const shown = allNearby ? nearby : nearby.slice(0, 3);
  return (
    <>
      <TabSection title="Everyone nearby" sub="closest to you right now — the fuller the ring, the more alike" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {shown.map((p) => <AreaPersonRow key={p.id} p={p} onClick={() => onPerson && onPerson(p)} />)}
        {!allNearby && nearby.length > 3 && (
          <button className="press" onClick={() => setAllNearby(true)} style={{
            width: '100%', padding: '11px 0', cursor: 'pointer',
            background: 'none', border: '1px solid var(--rule)', borderRadius: 14,
            fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
          }}>
            Show {nearby.length - 3} more nearby
          </button>
        )}
      </div>
    </>
  );
}

function AreaMain({ scale, onPerson }) {
  return (
    <div className="fade-in">
      {/* places now live in the hero footer (HeroPockets) — no standalone card */}
      {scale.id === 'near' && <AreaNearSignature onPerson={onPerson} />}
      {scale.id === 'city' && (
        <Lazy minHeight={500}>
          <TabSection title="Kindred in Oslo" sub="strangers in the city most aligned with you" />
          {areaEl('KindredInOslo')}
        </Lazy>
      )}
      {scale.id === 'world' && (<>
        <TabSection title="Where you'd belong" sub="if you ever left Oslo — the cities that would feel most like you" />
        {areaEl('WhereYoudBelong')}
      </>)}
    </div>
  );
}

// ─── COMPARE sub-tab — you vs this scale, plus makeup & taste ───
function AreaCompareSection({ scale }) {
  const green = areaAccent(scale.id);
  const aud = AREA_AUD[scale.id];
  const place = scale.id === 'near' ? 'near you' : scale.place.toLowerCase();
  return (
    <div className="fade-in">
      <AreaCompare scale={scale} />
      <Lazy minHeight={520}>
        <TabSection title={`Who's in ${place}`} sub="the demographic shape of this scale" />
        {areaEl('DemographicsCard', { audId: aud })}
      </Lazy>
    </div>
  );
}

// ─── the body of one geographic scale — one flow: hero, places, compare ───
// No sub-tabs: the population picker (in mirror-tab.jsx) is the only axis;
// everything for the chosen scale reads top to bottom.
function AreaBody({ scaleId, onPerson, zoomCtl }) {
  const scale = AREA_SCALES.find(s => s.id === scaleId) || AREA_SCALES[0];

  return (
    <div key={scale.id} className="tab-swap">
      <AreaHero scale={scale} zoomCtl={zoomCtl} />
      <AreaMain scale={scale} onPerson={onPerson} />
      <Lazy minHeight={700}>
        <AreaCompareSection scale={scale} />
      </Lazy>
    </div>
  );
}

Object.assign(window, { AreaBody, AREA_SCALES, MatchRing });

;globalThis.AreaEmblem = typeof AreaEmblem === 'undefined' ? globalThis.AreaEmblem : AreaEmblem;
;globalThis.MatchRing = typeof MatchRing === 'undefined' ? globalThis.MatchRing : MatchRing;
;globalThis.AreaKinStrip = typeof AreaKinStrip === 'undefined' ? globalThis.AreaKinStrip : AreaKinStrip;
;globalThis.HeroPockets = typeof HeroPockets === 'undefined' ? globalThis.HeroPockets : HeroPockets;
;globalThis.AreaHero = typeof AreaHero === 'undefined' ? globalThis.AreaHero : AreaHero;
;globalThis.AreaReach = typeof AreaReach === 'undefined' ? globalThis.AreaReach : AreaReach;
;globalThis.AreaPlaces = typeof AreaPlaces === 'undefined' ? globalThis.AreaPlaces : AreaPlaces;
;globalThis.AreaPolBar = typeof AreaPolBar === 'undefined' ? globalThis.AreaPolBar : AreaPolBar;
;globalThis.AreaCompare = typeof AreaCompare === 'undefined' ? globalThis.AreaCompare : AreaCompare;
;globalThis.AreaAnonAv = typeof AreaAnonAv === 'undefined' ? globalThis.AreaAnonAv : AreaAnonAv;
;globalThis.AreaPersonRow = typeof AreaPersonRow === 'undefined' ? globalThis.AreaPersonRow : AreaPersonRow;
;globalThis.AreaNearSignature = typeof AreaNearSignature === 'undefined' ? globalThis.AreaNearSignature : AreaNearSignature;
;globalThis.AreaMain = typeof AreaMain === 'undefined' ? globalThis.AreaMain : AreaMain;
;globalThis.AreaCompareSection = typeof AreaCompareSection === 'undefined' ? globalThis.AreaCompareSection : AreaCompareSection;
;globalThis.AreaBody = typeof AreaBody === 'undefined' ? globalThis.AreaBody : AreaBody;
;globalThis.areaAccent = typeof areaAccent === 'undefined' ? globalThis.areaAccent : areaAccent;
;globalThis.arFmt = typeof arFmt === 'undefined' ? globalThis.arFmt : arFmt;
;globalThis.AREA_SCALES = typeof AREA_SCALES === 'undefined' ? globalThis.AREA_SCALES : AREA_SCALES;
;globalThis.AREA_AUD = typeof AREA_AUD === 'undefined' ? globalThis.AREA_AUD : AREA_AUD;
;globalThis.areaEl = typeof areaEl === 'undefined' ? globalThis.areaEl : areaEl;
