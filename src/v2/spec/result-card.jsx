// Ported from design/spec-modules/result-card.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { Av } from './primitives.jsx';

// result-card.jsx — test profile cards: each test keeps the shared banner
// language but owns its NATIVE geometry:
//   big5 → petal rose · politics → 2D compass plane · values → tension spine
//   social → orbit field (closer to centre = more you)
// Banner: rarity as a lit 100-dot field + the two types you nearly were.
// Second section: "where you differ" — only the dims where you deviate most.

(function(){ if(document.getElementById('rpv2-style')) return; const s=document.createElement('style'); s.id='rpv2-style';
s.textContent=`@keyframes rpv2In{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
.rpv2-pop{animation:rpv2In .55s cubic-bezier(.2,.85,.3,1.08) backwards}
@keyframes rpv2Fade{from{opacity:0}to{opacity:1}}
.rpv2-fade{animation:rpv2Fade .5s ease backwards}
@keyframes rpv2Bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.rpv2-bar{animation:rpv2Bar .6s cubic-bezier(.25,.8,.3,1) backwards}`;
document.head.appendChild(s); })();

const rpv2Deep = (h) => `oklch(0.46 0.13 ${h})`;
const rpv2Dot  = (h) => `oklch(0.55 0.13 ${h})`;

// ── rarity, about YOU: a 100-person dot field, yours lit. The speckle IS the
// sentence — the numeral is a whisper. Seeded shuffle so the scatter is stable.
const rpv2Order = (() => { const idx = Array.from({ length: 100 }, (_, i) => i); let s = 48271; for (let i = 99; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; } return idx; })();
function RarityField({ pct, label, color, title }) {
  const lit = new Set(rpv2Order.slice(0, Math.max(1, Math.min(100, Math.round(pct)))));
  return (
    <div className="rpv2-fade" style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, animationDelay: '200ms' }} title={title}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(25, 3px)', gap: 2 }}>
        {Array.from({ length: 100 }, (_, i) => (
          <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: lit.has(i) ? color : `color-mix(in oklch, ${color} 16%, var(--surface-3))` }}></span>
        ))}
      </div>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: color, whiteSpace: 'nowrap', opacity: 0.8 }}>{label}</span>
    </div>
  );
}

// ── signature emblem — the type rendered as its own shape, tone-on-tone in the
// test hue. Defining dims read darker; same-type friends orbit the rim.
function SigEmblem({ testKey, sig, color, people, typeName }) {
  const mark = typeName && window.TypeMark ? window.TypeMark : null;
  const cfg = (window.RP_TESTS || {})[testKey];
  const ids = cfg ? Object.keys(cfg.hues).filter(id => sig && sig[id] != null) : [];
  if (!cfg || !ids.length) return null;
  const size = 170, C = size / 2, R = C - 3, r0 = 6, n = ids.length, slice = 360 / n, gapD = n > 6 ? 10 : 14;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (a, r) => [C + Math.cos(rad(a)) * r, C + Math.sin(rad(a)) * r];
  const gid = 'rpv2-emb-' + testKey;
  const ppl = (people || []).slice(0, 4);
  return (
    <div style={{ position: 'absolute', right: -28, top: '50%', transform: 'translateY(-50%)', width: size, height: size, pointerEvents: 'none' }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs><radialGradient id={gid}><stop offset="0%" stopColor={color} stopOpacity="0.15"></stop><stop offset="100%" stopColor={color} stopOpacity="0"></stop></radialGradient></defs>
        <circle cx={C} cy={C} r={R} fill={`url(#${gid})`}></circle>
        {mark ? null : ids.map((id, i) => {
          const raw = sig[id];
          const v = Math.max(16, cfg.bipolar ? Math.min(100, Math.abs(raw - 50) * 2) : raw);
          const a0 = -90 + i * slice + gapD / 2, a1 = -90 + (i + 1) * slice - gapD / 2;
          const r = r0 + (v / 100) * (R - 14 - r0);
          const [xa, ya] = pt(a0, r0), [xb, yb] = pt(a0, r), [xc, yc] = pt(a1, r), [xd, yd] = pt(a1, r0);
          const op = 0.15 + (Math.abs(raw - 50) / 50) * 0.22;
          return <path key={id} className="rpv2-pop" style={{ transformOrigin: `${C}px ${C}px`, animationDelay: `${i * 60}ms` }} d={`M ${xa.toFixed(1)} ${ya.toFixed(1)} L ${xb.toFixed(1)} ${yb.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xc.toFixed(1)} ${yc.toFixed(1)} L ${xd.toFixed(1)} ${yd.toFixed(1)} A ${r0} ${r0} 0 0 0 ${xa.toFixed(1)} ${ya.toFixed(1)} Z`} fill={color} opacity={op}></path>;
        })}
      </svg>
      {mark ? <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'inline-flex' }}><span className="rpv2-pop" style={{ display: 'inline-flex', animationDelay: '80ms' }}>{React.createElement(mark, { testKey, name: typeName, size: 82 })}</span></span> : null}
      {/* The `window.Av &&` guard this used to carry is gone with D39: Av is
          an import now, so it cannot be undefined at render. The guard was
          never about `ppl` — an empty list maps to nothing on its own. */}
      {ppl.map((p, i) => {
        const [x, y] = pt(132 + i * 33, R - 5);
        return <span key={p.id} className="rpv2-pop" style={{ position: 'absolute', left: x - 10, top: y - 10, borderRadius: '50%', boxShadow: '0 0 0 2px var(--surface-2)', display: 'inline-flex', animationDelay: `${300 + i * 70}ms` }}><Av init={p.init} hue={p.hue} size={20} /></span>;
      })}
    </div>
  );
}

// ── generic bipolar rows: centre spine, pull toward your pole, avg ring ──
function TensionSpine({ dims, poles, hues, avg, lead }) {
  const pos = (v) => 5 + (Math.max(0, Math.min(100, v)) / 100) * 90;
  const leadId = lead ? [...dims].sort((m, n) => Math.abs(n.value - 50) - Math.abs(m.value - 50))[0].id : null;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }}></div>
      {dims.map((d, i) => {
        const pp = (poles && poles[d.id]) || ['low', 'high'];
        const hue = hues && hues[d.id] != null ? hues[d.id] : (30 + i * 47) % 360;
        const col = rpv2Dot(hue);
        const right = d.value >= 50, youP = pos(d.value);
        const isLead = d.id === leadId;
        const lo = Math.min(50, youP), hi = Math.max(50, youP);
        const t = avg && avg[d.id] != null ? pos(avg[d.id]) : null;
        const poleStyle = (isLean) => ({ fontFamily: 'var(--sans)', fontSize: isLead ? 12.5 : 11.5, whiteSpace: 'nowrap', fontWeight: isLean ? 700 : 500, color: isLean ? rpv2Deep(hue) : 'var(--ink-3)', opacity: isLean ? 1 : 0.65 });
        return (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...poleStyle(!right), width: 68, flexShrink: 0, textAlign: 'right' }}>{pp[0]}</span>
            <div style={{ position: 'relative', flex: 1, height: 15 }}>
              <span className="rpv2-bar" style={{ position: 'absolute', top: '50%', marginTop: isLead ? -2.5 : -1.5, height: isLead ? 5 : 3, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, transformOrigin: right ? 'left' : 'right', animationDelay: `${i * 60}ms`, background: `linear-gradient(${right ? '90deg' : '270deg'}, color-mix(in oklch, ${col}, transparent 80%), ${col})` }}></span>
              {t != null && <span style={{ position: 'absolute', top: '50%', left: `${t}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)', opacity: 0.6 }}></span>}
              <span className="rpv2-pop" style={{ position: 'absolute', top: '50%', left: `${youP}%`, transform: 'translate(-50%,-50%)', width: isLead ? 15 : 12, height: isLead ? 15 : 12, borderRadius: '50%', background: col, border: '2px solid var(--surface-2)', boxShadow: '0 1px 4px -1px rgba(20,20,40,0.3)', animationDelay: `${i * 60 + 150}ms` }}></span>
            </div>
            <span style={{ ...poleStyle(right), width: 68, flexShrink: 0, textAlign: 'left' }}>{pp[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── where you stand — every dim with your score, and the stretch between the
// average person and you drawn as a length. Biggest differences sort to the top.
// σ≈15 dim points across people, so the top row can be read as a percentile.
function rpv2Pctl(diff) {
  const p = 1 / (1 + Math.exp(-1.702 * (diff / 15)));
  const n = Math.max(1, Math.min(9, Math.round((diff > 0 ? p : 1 - p) * 10)));
  return `${diff > 0 ? 'higher' : 'lower'} than ${n} in 10 members`;
}
function DifferRows({ testKey, R, cfg }) {
  const avg = (window.IS_TEST_AVG || {})[testKey];
  const ph = (window.IS_STANDOUT || {})[testKey] || {};
  if (!avg) return null;
  const rows = R.dims.map((d, i) => ({ d, i, diff: avg[d.id] != null ? d.value - avg[d.id] : 0 }))
    .sort((m, n) => Math.abs(n.diff) - Math.abs(m.diff));
  const pos = (v) => 4 + (Math.max(0, Math.min(100, v)) / 100) * 92;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
      {rows.map(({ d, i, diff }, k) => {
        const hue = cfg.hues[d.id] != null ? cfg.hues[d.id] : (30 + i * 47) % 360;
        const col = rpv2Dot(hue), deep = rpv2Deep(hue);
        const a = pos(avg[d.id]), y = pos(d.value);
        const lo = Math.min(a, y), hi = Math.max(a, y);
        const stand = Math.abs(diff) >= 6 && ph[d.id];
        const title = stand ? ph[d.id][diff > 0 ? 1 : 0] : d.label;
        const pp = cfg.poles && cfg.poles[d.id];
        const right = d.value >= 50;
        const f0 = cfg.bipolar ? pos(50) : pos(0);
        const fl = Math.min(f0, y), fw = Math.max(f0, y) - Math.min(f0, y);
        const poleStyle = (isLean) => ({ fontFamily: 'var(--sans)', fontSize: 10.5, whiteSpace: 'nowrap', fontWeight: isLean ? 700 : 500, color: isLean ? deep : 'var(--ink-3)', opacity: isLean ? 1 : 0.6, width: 62, flexShrink: 0 });
        return (
          <div key={d.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{title.charAt(0).toUpperCase() + title.slice(1)}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, color: deep, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }} title={diff === 0 ? 'right at the average' : `${Math.abs(Math.round(diff))} points ${diff > 0 ? 'above' : 'below'} most people`}>{Math.round(d.value)}</span>
            </div>
            {k === 0 && Math.abs(diff) >= 6 ? <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: -3, marginBottom: 7 }}>{rpv2Pctl(diff)}</div> : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pp ? <span style={{ ...poleStyle(!right), textAlign: 'right' }}>{pp[0]}</span> : null}
              <div style={{ position: 'relative', flex: 1, height: 18 }}>
                <span style={{ position: 'absolute', top: 5, bottom: 5, left: 0, right: 0, borderRadius: 999, background: `color-mix(in oklch, ${col} 10%, var(--surface-3))` }}></span>
                <span style={{ position: 'absolute', top: 5, bottom: 5, borderRadius: 999, left: `${fl}%`, width: `${fw}%`, background: `color-mix(in oklch, ${col}, transparent 42%)` }}></span>
                {hi - lo > 1.5 ? <span style={{ position: 'absolute', top: 7, bottom: 7, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, background: deep }}></span> : null}
                {cfg.bipolar ? <span style={{ position: 'absolute', top: 3, bottom: 3, left: '50%', width: 1.5, marginLeft: -0.75, borderRadius: 1, background: 'var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span> : null}
                <span style={{ position: 'absolute', top: '50%', left: `${a}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--ink-3)', boxShadow: '0 0 0 1.5px var(--surface)' }}></span>
                <span style={{ position: 'absolute', top: '50%', left: `${y}%`, transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: col, border: '2.5px solid var(--surface)', boxShadow: `0 1px 5px -1px color-mix(in oklch, ${col}, transparent 40%)` }}></span>
              </div>
              {pp ? <span style={{ ...poleStyle(right), textAlign: 'left' }}>{pp[1]}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── the v2 card: banner (identity + rarity + near-misses) → native chart → differ ──
function ResultProfileCard({ testKey, archetype, tagline }) {
  const [typesOpen, setTypesOpen] = React.useState(false);
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  const cfg = (window.RP_TESTS || {})[testKey];
  if (!R || !cfg || !R.dims || !R.dims.length) return null;
  const arch = window.IS_matchArchetype ? window.IS_matchArchetype(testKey, R.dims) : null;
  const you = arch ? arch.idx : -1;
  const fits = arch ? arch.fits : null;
  const rar = window.IS_profileRarity ? window.IS_profileRarity(testKey, R.dims) : null;
  const ruleParts = arch && window.IS_typeRuleParts ? window.IS_typeRuleParts(testKey, R.dims, arch.list[you]) : [];
  const near = arch ? arch.list.map((a, i) => ({ a, i, d: fits[i], rms: arch.rmsOf[i] })).filter(x => x.i !== you).sort((m, n) => m.d - n.d).slice(0, 2)
    .map((x, k) => ({ ...x, why: window.IS_nearWhy ? window.IS_nearWhy(testKey, R.dims, x.a) : null, border: k === 0 && (x.rms - arch.rms) < 5 })) : [];
  // fit strength, in dim points of separation from the runner-up
  const fit = arch ? (arch.gap < 5 ? 'close' : arch.gap >= 12 && arch.rms < 12 ? 'textbook' : 'clear') : 'clear';
  const streak = fit === 'close' ? near[0].a.name.replace(/^The /, '') : null;
  // people of yours who landed on the same type
  const sameType = (() => {
    if (!arch) return [];
    const map = (window.IS_FRIEND_TYPES || {})[testKey] || {};
    const ppl = ((window.IS_DATA || {}).people) || [];
    return ppl.filter(p => map[p.id] === arch.list[you].name);
  })();
  const typeLine = arch ? arch.list[you].line : null;
  const sigDims = (a) => R.dims.map(d => ({ id: d.id, label: d.id, value: a.sig[d.id] != null ? a.sig[d.id] : 50 }));
  // passive coverage: how much of this test the feed has mapped so far
  const pct = window.PASSIVE ? window.PASSIVE.pct(testKey) : 100;
  const nLeft = window.PASSIVE ? Math.max(0, window.PASSIVE.needed(testKey) - window.PASSIVE.done(testKey)) : 0;
  const avg = (window.IS_TEST_AVG || {})[testKey];
  const hero = window.TestRose ? <window.TestRose testKey={testKey} dims={R.dims} animate={true} /> : null;
  const otherAxes = null;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
      <div title={pct < 100 ? `${nLeft} more answers to fully map this` : 'fully mapped'} style={{ height: 3, background: `color-mix(in oklch, ${cfg.banner} 14%, var(--surface-3))` }}>
        <div className="rpv2-bar" style={{ height: '100%', width: `${pct}%`, background: cfg.banner, transformOrigin: 'left' }}></div>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(115deg, color-mix(in oklch, ${cfg.banner} 17%, var(--surface)) 0%, color-mix(in oklch, ${cfg.banner} 6%, var(--surface)) 78%)`, borderBottom: `0.5px solid color-mix(in oklch, ${cfg.banner} 28%, var(--rule))`, padding: '15px 18px 16px' }}>
        <SigEmblem testKey={testKey} sig={arch ? arch.list[you].sig : R.dims.reduce((o, d) => (o[d.id] = d.value, o), {})} color={cfg.banner} people={sameType} typeName={arch ? arch.list[you].name : null} />
        <div style={{ position: 'relative', zIndex: 1, paddingRight: 96 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span className="kicker" style={{ color: cfg.banner, marginBottom: 0 }}>{cfg.kicker}</span>
            {pct >= 100 && fit === 'textbook' ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: cfg.banner, whiteSpace: 'nowrap' }}>textbook fit</span> : null}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, textTransform: 'capitalize', color: `color-mix(in oklch, ${cfg.banner} 78%, var(--ink))`, marginTop: 9 }}>{arch ? arch.list[you].name : archetype}</div>
          {streak ? <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: `color-mix(in oklch, ${cfg.banner} 72%, var(--ink))`, marginTop: 4, lineHeight: 1.35 }}>with a {streak} streak</div> : null}
          {(typeLine || tagline) ? <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4, textWrap: 'pretty' }}>{typeLine || tagline}</div> : null}
          {ruleParts.length ? (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
              {ruleParts.map(p => {
                const h = cfg.hues[p.id] != null ? cfg.hues[p.id] : 40;
                return (
                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px 3px 8px', borderRadius: 999, background: `color-mix(in oklch, ${rpv2Dot(h)} 11%, var(--surface-2))`, border: `0.5px solid color-mix(in oklch, ${rpv2Dot(h)} 32%, var(--rule))`, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: rpv2Deep(h) }}>
                    <svg width="8" height="7" viewBox="0 0 8 7" style={{ flexShrink: 0, transform: p.high ? 'none' : 'rotate(180deg)' }} role="img" aria-label={p.high ? 'high' : 'low'}><path d="M4 0 L8 7 L0 7 Z" fill={rpv2Dot(h)}></path></svg>{p.text.replace(/^(high|low)\s+/, '')}
                  </span>
                );
              })}
            </div>
          ) : null}
          {rar ? <div style={{ marginTop: 14, opacity: pct < 100 ? 0.75 : 1 }}><RarityField pct={rar.pct} label={rar.label.toLowerCase()} color={cfg.banner} title={`${rar.label.toLowerCase()} sit as far from average as you — also this type: ${sameType.map(p => p.name.split(' ')[0]).join(', ') || 'none of yours'}`} /></div> : null}
        </div>
      </div>
      <div style={{ padding: '10px 16px 16px' }}>
        {hero}
        {arch ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            {near.map(({ a, why, border }) => (
              <span key={a.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 999, background: border ? `color-mix(in oklch, ${cfg.banner} 8%, var(--surface))` : 'var(--surface)', border: `0.5px solid ${border ? `color-mix(in oklch, ${cfg.banner} 45%, var(--rule))` : 'var(--rule)'}`, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                {window.TypeMark ? <window.TypeMark testKey={testKey} name={a.name} size={20} /> : (window.RoseMini ? <window.RoseMini testKey={testKey} dims={sigDims(a)} size={18} /> : null)}{a.name}
                {why ? <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}>if {why}</span> : null}
              </span>
            ))}
            {window.TypeIndexSheet ? <button className="press" onClick={() => setTypesOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 999, background: 'none', border: '0.5px solid var(--rule)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>All {arch.list.length} types <span aria-hidden="true">{'\u203A'}</span></button> : null}
          </div>
        ) : null}
        {typesOpen && window.TypeIndexSheet ? <window.TypeIndexSheet testKey={testKey} onClose={() => setTypesOpen(false)} /> : null}
        {otherAxes ? (
          <div style={{ marginTop: 6, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
            <TensionSpine dims={otherAxes} poles={cfg.poles} hues={cfg.hues} avg={avg} />
          </div>
        ) : null}
        {avg ? (
          <div style={{ marginTop: testKey === 'values' ? 6 : 4, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
            <div className="kicker" style={{ marginBottom: 12 }}>Where you stand</div>
            <DifferRows testKey={testKey} R={R} cfg={cfg} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 15, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: cfg.banner, border: '2px solid var(--surface-2)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span>you
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)' }}></span>most people
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { ResultProfileCard });

;globalThis.RarityField = typeof RarityField === 'undefined' ? globalThis.RarityField : RarityField;
;globalThis.TensionSpine = typeof TensionSpine === 'undefined' ? globalThis.TensionSpine : TensionSpine;
;globalThis.DifferRows = typeof DifferRows === 'undefined' ? globalThis.DifferRows : DifferRows;
;globalThis.ResultProfileCard = typeof ResultProfileCard === 'undefined' ? globalThis.ResultProfileCard : ResultProfileCard;
;globalThis.rpv2Deep = typeof rpv2Deep === 'undefined' ? globalThis.rpv2Deep : rpv2Deep;
;globalThis.rpv2Dot = typeof rpv2Dot === 'undefined' ? globalThis.rpv2Dot : rpv2Dot;
