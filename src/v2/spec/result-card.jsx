/* eslint-disable */
// ported from design/spec-modules/result-card.jsx — do not hand-edit load order assumptions
import React from 'react';

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

// ── rarity: 100 dots, `share` of them lit ──
function RarityField({ share, color }) {
  return (
    <div style={{ flexShrink: 0, textAlign: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 5px)', gap: 2.5, justifyContent: 'center' }}>
        {Array.from({ length: 100 }, (_, i) => (
          <span key={i} className={i < share ? 'rpv2-fade' : undefined} style={{ width: 5, height: 5, borderRadius: '50%', background: i < share ? color : 'color-mix(in oklch, var(--ink-3) 26%, transparent)', animationDelay: `${150 + i * 22}ms` }}></span>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: color, marginTop: 5, whiteSpace: 'nowrap' }}>{share} IN 100</div>
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

// ── where you differ — only the dims with the biggest gap vs most people ──
function DifferRows({ testKey, R, cfg }) {
  const avg = (window.IS_TEST_AVG || {})[testKey];
  const ph = (window.IS_STANDOUT || {})[testKey] || {};
  if (!avg) return null;
  const rows = R.dims.map((d, i) => ({ d, i, diff: avg[d.id] != null ? d.value - avg[d.id] : 0 }))
    .filter(r => Math.abs(r.diff) >= 6).sort((m, n) => Math.abs(n.diff) - Math.abs(m.diff)).slice(0, 3);
  const pos = (v) => 5 + (Math.max(0, Math.min(100, v)) / 100) * 90;
  if (!rows.length) return (
    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>Close to most people on every axis — rarer than it sounds.</div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map(({ d, i, diff }, k) => {
        const hue = cfg.hues[d.id] != null ? cfg.hues[d.id] : (30 + i * 47) % 360;
        const col = rpv2Dot(hue);
        const a = pos(avg[d.id]), y = pos(d.value);
        const lo = Math.min(a, y), hi = Math.max(a, y);
        const phrase = ph[d.id] ? ph[d.id][diff > 0 ? 1 : 0] : d.label;
        return (
          <div key={d.id}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{phrase.charAt(0).toUpperCase() + phrase.slice(1)}</div>
            <div style={{ position: 'relative', height: 14 }}>
              <span style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: 2, marginTop: -1, borderRadius: 999, background: 'var(--surface-3)' }}></span>
              <span className="rpv2-bar" style={{ position: 'absolute', top: '50%', marginTop: -1.5, height: 3, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, transformOrigin: diff > 0 ? 'left' : 'right', animationDelay: `${k * 90}ms`, background: col }}></span>
              <span style={{ position: 'absolute', top: '50%', left: `${a}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface)', border: '1.4px solid var(--ink-3)', opacity: 0.7 }}></span>
              <span className="rpv2-pop" style={{ position: 'absolute', top: '50%', left: `${y}%`, transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: col, border: '2px solid var(--surface)', boxShadow: '0 1px 4px -1px rgba(20,20,40,0.3)', animationDelay: `${k * 90 + 200}ms` }}></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── the v2 card: banner (identity + rarity + near-misses) → native chart → differ ──
function ResultProfileCard({ testKey, archetype, tagline }) {
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  const cfg = (window.RP_TESTS || {})[testKey];
  if (!R || !cfg || !R.dims || !R.dims.length) return null;
  const arch = window.IS_matchArchetype ? window.IS_matchArchetype(testKey, R.dims) : null;
  const standout = window.IS_standoutLine ? window.IS_standoutLine(testKey, R.dims) : null;
  const you = arch ? arch.idx : -1;
  const dist = (a) => { let s = 0, n = 0; R.dims.forEach(d => { if (a.sig[d.id] != null) { const e = a.sig[d.id] - d.value; s += e * e; n++; } }); return n ? s / n : 1e9; };
  const youD = arch ? dist(arch.list[you]) : 0;
  const near = arch ? arch.list.map((a, i) => ({ a, i, d: dist(a) })).filter(x => x.i !== you).sort((m, n) => m.d - n.d).slice(0, 2)
    .map((x, k) => ({ ...x, why: window.IS_nearWhy ? window.IS_nearWhy(testKey, R.dims, x.a) : null, border: k === 0 && x.d < Math.max(youD * 1.3, youD + 25) })) : [];
  // fit strength: how decisive the nearest-type match is
  const fit = near.length ? (near[0].border ? 'close' : (near[0].d > Math.max(youD * 2.2, youD + 80) ? 'textbook' : 'clear')) : 'clear';
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
      <div style={{ background: `color-mix(in oklch, ${cfg.banner} 10%, var(--surface))`, borderBottom: `0.5px solid color-mix(in oklch, ${cfg.banner} 28%, var(--rule))`, padding: '15px 18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span className="kicker" style={{ color: cfg.banner, marginBottom: 0 }}>{cfg.kicker}</span>
          {pct < 100
            ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: cfg.banner, whiteSpace: 'nowrap', background: `color-mix(in oklch, ${cfg.banner} 13%, var(--surface))`, border: `0.5px solid color-mix(in oklch, ${cfg.banner} 35%, var(--rule))`, borderRadius: 999, padding: '3px 9px' }}>early read · {pct}% mapped</span>
            : (fit === 'textbook' ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: cfg.banner, whiteSpace: 'nowrap' }}>textbook fit</span> : null)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, textTransform: 'capitalize', color: 'var(--ink)' }}>{arch ? arch.list[you].name : archetype}</div>
            {streak ? <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: `color-mix(in oklch, ${cfg.banner} 72%, var(--ink))`, marginTop: 4, lineHeight: 1.35 }}>with a {streak} streak</div> : null}
            {(typeLine || tagline) ? <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.4, textWrap: 'pretty' }}>{typeLine || tagline}</div> : null}
            {standout ? <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4, textWrap: 'pretty' }}>You: {standout.charAt(0).toLowerCase() + standout.slice(1)}</div> : null}
          </div>
          {arch ? <div style={{ opacity: pct < 100 ? 0.45 : 1 }}><RarityField share={arch.list[you].share} color={cfg.banner} /></div> : null}
        </div>
        {pct < 100 ? (
          <div style={{ marginTop: 13 }}>
            <div style={{ height: 3, borderRadius: 999, background: `color-mix(in oklch, ${cfg.banner} 18%, transparent)`, overflow: 'hidden' }}>
              <div className="rpv2-bar" style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: cfg.banner, transformOrigin: 'left' }}></div>
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 6 }}>its questions surface in the World feed · {nLeft} to go</div>
          </div>
        ) : null}
      </div>
      <div style={{ padding: '10px 16px 16px' }}>
        {hero}
        {near.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)' }}>NEARLY</span>
            {near.map(({ a, why, border }) => (
              <span key={a.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 999, background: border ? `color-mix(in oklch, ${cfg.banner} 8%, var(--surface))` : 'var(--surface)', border: `0.5px solid ${border ? `color-mix(in oklch, ${cfg.banner} 45%, var(--rule))` : 'var(--rule)'}`, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                {window.RoseMini ? <window.RoseMini testKey={testKey} dims={sigDims(a)} size={18} /> : null}{a.name}
                {why ? <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}>if {why}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        {sameType.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)' }}>ALSO</span>
            {sameType.map(p => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 4px', borderRadius: 999, background: 'var(--surface)', border: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                {window.Av ? <window.Av init={p.init} hue={p.hue} size={18} /> : null}{p.name.split(' ')[0]}
              </span>
            ))}
          </div>
        ) : null}
        {otherAxes ? (
          <div style={{ marginTop: 6, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
            <TensionSpine dims={otherAxes} poles={cfg.poles} hues={cfg.hues} avg={avg} />
          </div>
        ) : null}
        {avg ? (
          <div style={{ marginTop: testKey === 'values' ? 6 : 4, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
            <div className="kicker" style={{ marginBottom: 12 }}>Where you differ</div>
            <DifferRows testKey={testKey} R={R} cfg={cfg} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 15, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: cfg.banner, border: '2px solid var(--surface-2)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span>YOU
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)' }}></span>MOST PEOPLE
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
