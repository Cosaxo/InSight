// Ported from design/InSight_standalone_13.html (lens-cards.jsx). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// lens-cards.jsx — the profile's Lenses tab. One compact card per minor
// instrument, each with the visual idiom its shape deserves:
//   ranked bars (moral foundations) · domain columns (risk) · tension spine
//   (trust, taste) · discount curve (time) · condensed rows (tier 2).
// No archetype banner, no rarity field — those stay with the four core tests.
//
// DIVERGENCE FROM THE PROTOTYPE: LENSES.score() returns null for a dimension
// you have not answered for, because live mode has no typical-person prior to
// fall back on (lens-defs.js says why). Every viz below therefore has to draw
// "no reading yet" as its own state. Drawing null as 0 would be worse than
// the prior it replaced — "you score 0 on Care" is a claim, and a false one.
(function () {
  const { useState, useEffect } = React;
  const col = (h) => `oklch(0.56 0.13 ${h})`;
  const deep = (h) => `oklch(0.44 0.13 ${h})`;
  const soft = (h) => `color-mix(in oklch, oklch(0.56 0.13 ${h}), transparent 82%)`;
  const track = (h) => `color-mix(in oklch, oklch(0.56 0.13 ${h}) 9%, var(--surface-3))`;
  const lbl = { fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' };

  // an unanswered dimension has no value at all — not a zero. `has` is the
  // guard every viz below reads before drawing anything positional.
  const has = (v, id) => typeof v[id] === 'number';
  const val = (v, id) => (has(v, id) ? v[id] : 0);
  const NOREAD = { fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', opacity: 0.75 };

  // ── ranked magnitude bars — the weight each thing carries, in order ──
  function Ranked({ dims, v, hue, dim }) {
    // unread dimensions sink to the bottom rather than sorting as zeroes
    const rows = [...dims].sort((a, b) => (has(v, b.id) ? v[b.id] : -1) - (has(v, a.id) ? v[a.id] : -1));
    const max = Math.max(...rows.filter(r => has(v, r.id)).map(r => v[r.id]), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, opacity: dim ? 0.55 : 1 }}>
        {rows.map((d, i) => {
          const read = has(v, d.id);
          const lead = read && i === 0;
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ ...lbl, width: 76, flexShrink: 0, fontWeight: lead ? 700 : 600, color: lead ? deep(hue) : 'var(--ink-2)', opacity: read ? 1 : 0.6 }}>{d.label}</span>
              <span style={{ flex: 1, height: lead ? 9 : 7, borderRadius: 99, background: track(hue), overflow: 'hidden' }}>
                {read && <span className="rpv2-bar" style={{ display: 'block', height: '100%', width: `${(v[d.id] / max) * 100}%`, background: `linear-gradient(90deg, ${col(hue)}, ${deep(hue)})`, borderRadius: 99, transformOrigin: 'left', animationDelay: `${i * 55}ms` }}></span>}
              </span>
              {!read && <span style={{ ...NOREAD, width: 12, flexShrink: 0 }}>—</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── domain columns — a skyline you read as a shape, not as numbers ──
  function Columns({ dims, v, hue, dim }) {
    const top = dims.reduce((a, d) => (val(v, d.id) > val(v, a.id) ? d : a), dims[0]);
    const topRead = has(v, top.id);
    return (
      <div style={{ position: 'relative', opacity: dim ? 0.55 : 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dims.length}, 1fr)`, gap: 10, alignItems: 'end' }}>
          {dims.map((d, i) => {
            const read = has(v, d.id);
            const lead = read && topRead && d.id === top.id;
            return (
              <div key={d.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ position: 'relative', width: '100%', height: 78, borderRadius: 9, background: track(hue), display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                  {read
                    ? <span className="rpv2-bar" style={{ display: 'block', width: '100%', height: `${v[d.id]}%`, background: `linear-gradient(180deg, ${col(hue)}, ${soft(hue)})`, borderRadius: '7px 7px 2px 2px', transformOrigin: 'bottom', animationDelay: `${i * 55}ms` }}></span>
                    : <span style={{ ...NOREAD, alignSelf: 'center', marginBottom: 30 }}>—</span>}
                </span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: lead ? 700 : 600, color: lead ? deep(hue) : 'var(--ink-3)', whiteSpace: 'nowrap', opacity: read ? 1 : 0.6 }}>{d.label}</span>
              </div>
            );
          })}
        </div>
        <span style={{ position: 'absolute', left: 2, right: 2, top: 39, height: 0, borderTop: '1px dashed color-mix(in oklch, var(--ink-3) 45%, transparent)', pointerEvents: 'none' }}></span>
      </div>
    );
  }

  // ── tension spine — pole to pole, your dot on the line ──
  function Spine({ dims, v, hue, dim, compact }) {
    const pos = (x) => 5 + (Math.max(0, Math.min(100, x)) / 100) * 90;
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: compact ? 13 : 16, opacity: dim ? 0.55 : 1 }}>
        <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }}></div>
        {dims.map((d, i) => {
          const read = has(v, d.id);
          const x = val(v, d.id), right = read && x >= 50, p = pos(x);
          const lo = Math.min(50, p), hi = Math.max(50, p);
          // with no reading, neither pole leans — both stay quiet
          const pole = (lean) => ({ fontFamily: 'var(--sans)', fontSize: 12, whiteSpace: 'nowrap', fontWeight: read && lean ? 700 : 500, color: read && lean ? deep(hue) : 'var(--ink-3)', opacity: read ? (lean ? 1 : 0.7) : 0.5 });
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ ...pole(!right), width: 70, flexShrink: 0, textAlign: 'right' }}>{d.poles[0]}</span>
              <div style={{ position: 'relative', flex: 1, height: 14 }}>
                <span style={{ position: 'absolute', top: '50%', left: '2%', right: '2%', height: 2, marginTop: -1, borderRadius: 999, background: track(hue) }}></span>
                {read && <span className="rpv2-bar" style={{ position: 'absolute', top: '50%', marginTop: -1.5, height: 3, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, transformOrigin: right ? 'left' : 'right', animationDelay: `${i * 55}ms`, background: col(hue) }}></span>}
                {read
                  ? <span className="rpv2-pop" style={{ position: 'absolute', top: '50%', left: `${p}%`, transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: col(hue), border: '2px solid var(--surface-2)', boxShadow: `0 0 0 3.5px ${soft(hue)}, 0 1px 4px -1px rgba(20,20,40,0.25)`, animationDelay: `${i * 55 + 120}ms` }}></span>
                  : <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', border: `1.5px dashed color-mix(in oklch, ${col(hue)} 55%, var(--rule))`, background: 'var(--surface-2)', boxSizing: 'border-box' }}></span>}
              </div>
              <span style={{ ...pole(right), width: 70, flexShrink: 0, textAlign: 'left' }}>{d.poles[1]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── discount curve — how fast a future reward loses its pull ──
  function Curve({ dims, v, hue, dim }) {
    const W = 260, H = 84;
    const pts = (horizon) => {
      const k = 0.16 * Math.pow(2.6, (60 - horizon) / 30);   // steeper when now-focused
      const a = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, y = Math.exp(-k * t * 10); a.push([t * W, H - y * (H - 6) - 3]); }
      return a;
    };
    const line = (p) => p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    // no reading yet → draw only the typical curve, no "your" line to imply
    const readYou = has(v, dims[0].id);
    const you = val(v, dims[0].id), yp = pts(you), end = yp[yp.length - 1];
    const gid = 'lensfill-' + hue;
    return (
      <div style={{ opacity: dim ? 0.55 : 1 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col(hue)} stopOpacity="0.2"></stop><stop offset="100%" stopColor={col(hue)} stopOpacity="0"></stop></linearGradient></defs>
          <line x1="0" y1={H - 3} x2={W} y2={H - 3} stroke="var(--rule)" strokeWidth="1"></line>
          {readYou && <path d={`${line(yp)} L ${W} ${H - 3} L 0 ${H - 3} Z`} fill={`url(#${gid})`} stroke="none"></path>}
          <path d={line(pts(50))} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.5"></path>
          {readYou && <path d={line(yp)} fill="none" stroke={col(hue)} strokeWidth="2.4" strokeLinecap="round"></path>}
          {readYou && <circle className="rpv2-pop" cx={end[0]} cy={end[1]} r="3.6" fill={col(hue)} stroke="var(--surface-2)" strokeWidth="1.6" style={{ animationDelay: '250ms' }}></circle>}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
          <span>today</span>
          {!readYou && <span style={NOREAD}>typical person — yours fills in</span>}
          <span>ten years out</span>
        </div>
        <div style={{ marginTop: 13 }}><Spine dims={dims.slice(1)} v={v} hue={hue} compact /></div>
      </div>
    );
  }

  // ── condensed rows for the tier-2 lenses ──
  function Mini({ dims, v, hue, dim }) {
    const bipolar = dims[0].poles;
    if (bipolar) return <Spine dims={dims} v={v} hue={hue} dim={dim} compact />;
    return <Ranked dims={dims} v={v} hue={hue} dim={dim} />;
  }

  const VIZ = { ranked: Ranked, columns: Columns, spine: Spine, curve: Curve, mini: Mini };

  // ── the inline asker — five steps, two words of scale, nothing else ──
  const DOTS = [7, 9, 11, 13, 15];
  function Asker({ lens, onDone }) {
    const L = window.LENSES;
    const i = L.nextIdx(lens.id);
    if (i < 0) return null;
    const q = lens.questions[i];
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', textWrap: 'pretty' }}>{q.q}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>no</span>
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            {DOTS.map((sz, k) => (
              <button key={k} onClick={() => { L.answer(lens.id, i, k); onDone && onDone(); }} aria-label={'answer ' + (k + 1)} style={{
                cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', background: 'none', border: 'none',
                padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ width: sz, height: sz, borderRadius: '50%', border: `1.5px solid ${col(lens.hue)}`, background: k > 2 ? col(lens.hue) : 'transparent', opacity: k === 2 ? 0.5 : 1, display: 'block' }}></span>
              </button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>yes</span>
        </div>
      </div>
    );
  }

  function Ring({ pct, hue, size = 22 }) {
    const r = size / 2 - 2.2, C = 2 * Math.PI * r;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3"></circle>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col(hue)} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(C * pct) / 100} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}></circle>
      </svg>
    );
  }

  function LensCard({ lens, tick, onTick }) {
    const L = window.LENSES;
    const [asking, setAsking] = useState(false);
    const pct = L.pct(lens.id), full = L.complete(lens.id);
    const v = L.score(lens.id);
    const Viz = VIZ[lens.viz] || Mini;
    const t2 = lens.tier === 2;
    // nothing answered at all: say so in words rather than drawing a chart of
    // dashes. In live mode this is what every lens looks like on day one.
    const blank = lens.dims.every((d) => !has(v, d.id));
    return (
      <div className="card" style={{ marginBottom: 12, padding: t2 ? '14px 16px' : '16px 18px', background: `linear-gradient(180deg, color-mix(in oklch, ${col(lens.hue)} 5%, var(--surface-2)), var(--surface-2) 110px)`, borderColor: `color-mix(in oklch, ${col(lens.hue)} 13%, var(--rule))` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: t2 ? 12 : 15 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: t2 ? 14.5 : 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{lens.title}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{lens.lead}</div>
          </div>
          {!full && <Ring pct={pct} hue={lens.hue} />}
        </div>
        {blank
          ? <div style={{ ...NOREAD, padding: '10px 2px 2px', lineHeight: 1.5, textWrap: 'pretty' }}>No reading yet — this fills in as its questions come round in the feed, or answer a few now.</div>
          : <Viz dims={lens.dims} v={v} hue={lens.hue} dim={!full && pct < 60} />}
        {!full && (asking
          ? <Asker lens={lens} onDone={() => { onTick(); if (L.complete(lens.id)) setAsking(false); }} />
          : <button onClick={() => setAsking(true)} style={{
              marginTop: 14, width: '100%', padding: '10px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
              background: `color-mix(in oklch, ${col(lens.hue)} 4%, transparent)`, border: `0.5px solid color-mix(in oklch, ${col(lens.hue)} 24%, var(--rule))`, borderRadius: 12, color: deep(lens.hue),
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
            }}>Sharpen it — {L.needed(lens.id) - L.done(lens.id)} left</button>)}
      </div>
    );
  }

  function Chapter({ children }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '24px 2px 14px' }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{children}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--rule)' }}></span>
      </div>
    );
  }

  function LensesPanel() {
    const L = window.LENSES;
    const [tick, setTick] = useState(0);
    // L is window.LENSES — a module-level singleton, so this reference is
    // stable across renders and the effect still runs exactly once.
    useEffect(() => L.subscribe(() => setTick(t => t + 1)), [L]);
    const bump = () => setTick(t => t + 1);
    const t1 = L.all.filter(l => l.tier === 1), t2 = L.all.filter(l => l.tier === 2);
    return (
      <div style={{ paddingBottom: 8 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: '14px 2px 16px', textWrap: 'pretty' }}>
          Smaller readings than the four tests. They fill in slowly from the feed.
        </div>
        {t1.map(l => <LensCard key={l.id} lens={l} tick={tick} onTick={bump} />)}
        <Chapter>Narrower still</Chapter>
        {t2.map(l => <LensCard key={l.id} lens={l} tick={tick} onTick={bump} />)}
      </div>
    );
  }

  Object.assign(window, { LensesPanel, LensCard });
})();
