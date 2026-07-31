// Ported from design/InSight_standalone_15.html (lens-cards.jsx, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// lens-cards.jsx — the profile's Lenses tab. Chrome-free: no card boxes, no
// per-lens buttons. Each lens is a hairline-separated reading in the idiom its
// shape deserves — ranked bars (moral) · domain columns (risk) · tension spine
// (trust, taste, tier 2) · discount curve (time). One Sharpen queue at the top
// walks whichever lens is thinnest, so the charts are the only ink on screen.
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
  const prov = (h) => `oklch(0.74 0.055 ${h})`;               // provisional: same hue, no conviction
  const soft = (h) => `color-mix(in oklch, oklch(0.56 0.13 ${h}), transparent 82%)`;
  const track = (h) => `color-mix(in oklch, oklch(0.56 0.13 ${h}) 7%, var(--surface-3))`;
  const lbl = { fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' };
  const tiny = { fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' };
  // one grammar for every scale in the app: solid = you, hollow = most people
  const typ = 'color-mix(in oklch, var(--ink-3) 70%, transparent)';

  // an unanswered dimension has no value at all — not a zero. `has` is the
  // guard every viz below reads before drawing anything positional.
  const has = (v, id) => typeof v[id] === 'number';
  const NOREAD = { fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', opacity: 0.75 };

  // the value in words — the axis furthest from typical, which is the only
  // thing a 0–100 score actually means. Replaces the static tagline.
  // Unread dimensions are skipped: they have no gap to speak of.
  function reading(lens, v) {
    let best = null;
    lens.dims.forEach((d) => { if (!has(v, d.id)) return; const g = v[d.id] - d.demo; if (!best || Math.abs(g) > Math.abs(best.g)) best = { d, g }; });
    if (!best || Math.abs(best.g) <= 6) return lens.lead;   // nothing stands out yet — the lens's own line
    if (best.d.poles) return `Leans “${best.d.poles[best.g > 0 ? 1 : 0]}” more than most.`;
    const far = Math.abs(best.g) > 18 ? 'well ' : '';
    return `${best.d.label} runs ${far}${best.g > 0 ? 'above' : 'below'} typical.`;
  }

  // ── ranked magnitude bars — length alone carries the order ──
  function Ranked({ dims, v, hue, fill }) {
    // unread dimensions sink to the bottom rather than sorting as zeroes
    const rows = [...dims].sort((a, b) => (has(v, b.id) ? v[b.id] : -1) - (has(v, a.id) ? v[a.id] : -1));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((d) => {
          const read = has(v, d.id);
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...lbl, width: 70, flexShrink: 0, opacity: read ? 1 : 0.6 }}>{d.label}</span>
              <span style={{ position: 'relative', flex: 1, height: 14, display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '100%', height: 8, borderRadius: 99, background: track(hue), overflow: 'hidden' }}>
                  {read && <span style={{ display: 'block', height: '100%', width: `${v[d.id]}%`, background: fill, borderRadius: 99 }}></span>}
                </span>
                {read && Math.abs(v[d.id] - d.demo) >= 2 ? <span aria-hidden="true" style={{ position: 'absolute', left: `${d.demo}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 14, borderRadius: 2, background: typ }}></span> : null}
              </span>
              {!read && <span style={{ ...NOREAD, width: 12, flexShrink: 0 }}>—</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── domain columns — a skyline read as a shape, not as numbers ──
  function Columns({ dims, v, hue, fill }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dims.length}, 1fr)`, gap: 9, alignItems: 'end' }}>
        {dims.map((d) => {
          const read = has(v, d.id);
          return (
            <div key={d.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
              <span style={{ position: 'relative', width: '100%', height: 88, borderRadius: 8, background: track(hue), display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                {read
                  ? <span style={{ display: 'block', width: '100%', height: `${Math.max(3, v[d.id])}%`, background: fill, borderRadius: '6px 6px 0 0' }}></span>
                  : <span style={{ ...NOREAD, alignSelf: 'center' }}>—</span>}
                {read && Math.abs(v[d.id] - d.demo) >= 2 ? <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${d.demo}%`, height: 2, background: typ }}></span> : null}
              </span>
              <span style={{ ...tiny, whiteSpace: 'nowrap', opacity: read ? 1 : 0.6 }}>{d.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── tension spine — pole to pole, your dot on the line ──
  function Spine({ dims, v, hue, fill, compact }) {
    const pos = (x) => 5 + (Math.max(0, Math.min(100, x)) / 100) * 90;
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: compact ? 14 : 17 }}>
        <div style={{ position: 'absolute', left: '50%', top: 2, bottom: 2, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }}></div>
        {dims.map((d) => {
          const read = has(v, d.id);
          // with no reading the dot has nowhere honest to sit — a dashed
          // hollow marker holds the centre instead of claiming a side
          const x = read ? v[d.id] : 50, p = pos(x);
          const lo = Math.min(50, p), hi = Math.max(50, p);
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...tiny, width: 66, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', opacity: read ? 1 : 0.6 }}>{d.poles[0]}</span>
              <div style={{ position: 'relative', flex: 1, height: 12 }}>
                <span style={{ position: 'absolute', top: '50%', left: '2%', right: '2%', height: 2, marginTop: -1, borderRadius: 999, background: track(hue) }}></span>
                {read && <span style={{ position: 'absolute', top: '50%', marginTop: -1.5, height: 3, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, background: fill }}></span>}
                {read && Math.abs(x - d.demo) >= 2 ? <span aria-hidden="true" style={{ position: 'absolute', top: '50%', left: `${pos(d.demo)}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: `1.4px solid ${typ}` }}></span> : null}
                {read
                  ? <span style={{ position: 'absolute', top: '50%', left: `${p}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: fill, border: '2px solid var(--surface)' }}></span>
                  : <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', border: `1.5px dashed color-mix(in oklch, ${col(hue)} 55%, var(--rule))`, background: 'var(--surface)', boxSizing: 'border-box' }}></span>}
              </div>
              <span style={{ ...tiny, width: 66, flexShrink: 0, textAlign: 'left', whiteSpace: 'nowrap', opacity: read ? 1 : 0.6 }}>{d.poles[1]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── discount curve — how fast a future reward loses its pull ──
  function Curve({ dims, v, hue, fill }) {
    const W = 260, H = 86;
    const pts = (horizon) => {
      const k = 0.16 * Math.pow(2.6, (60 - horizon) / 30);   // steeper when now-focused
      const a = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, y = Math.exp(-k * t * 10); a.push([t * W, H - y * (H - 6) - 3]); }
      return a;
    };
    const line = (p) => p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    // no reading yet → draw only the typical curve; a "your" line at some
    // default horizon would be a claim about you that nothing supports
    const readYou = has(v, dims[0].id);
    const yp = readYou ? pts(v[dims[0].id]) : null, end = yp ? yp[yp.length - 1] : null;
    const gid = 'lensfill-' + hue;
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fill} stopOpacity="0.18"></stop><stop offset="100%" stopColor={fill} stopOpacity="0"></stop></linearGradient></defs>
          <line x1="0" y1={H - 3} x2={W} y2={H - 3} stroke="var(--rule)" strokeWidth="1"></line>
          {yp && <path d={`${line(yp)} L ${W} ${H - 3} L 0 ${H - 3} Z`} fill={`url(#${gid})`} stroke="none"></path>}
          <path d={line(pts(50))} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.45"></path>
          {yp && <path d={line(yp)} fill="none" stroke={fill} strokeWidth="2.4" strokeLinecap="round"></path>}
          {end && <circle cx={end[0]} cy={end[1]} r="3.6" fill={fill} stroke="var(--surface)" strokeWidth="1.6"></circle>}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={tiny}>today</span>
          {!readYou && <span style={NOREAD}>typical person — yours fills in</span>}
          <span style={tiny}>ten years out</span>
        </div>
        <div style={{ marginTop: 15 }}><Spine dims={dims.slice(1)} v={v} hue={hue} fill={fill} compact /></div>
      </div>
    );
  }

  function Mini(p) {
    return p.dims[0].poles ? <Spine {...p} compact /> : <Ranked {...p} />;
  }

  const VIZ = { ranked: Ranked, columns: Columns, spine: Spine, curve: Curve, mini: Mini };

  // ── the asker — five steps, two words of scale, nothing else ──
  const DOTS = [7, 9, 11, 13, 15];
  function Asker({ lens, onDone }) {
    const L = window.LENSES;
    const i = L.nextIdx(lens.id);
    if (i < 0) return null;
    const q = lens.questions[i];
    return (
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: deep(lens.hue) }}>{lens.title}</div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', textWrap: 'pretty', marginTop: 7 }}>{q.q}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ ...tiny, fontSize: 11, whiteSpace: 'nowrap' }}>no</span>
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            {DOTS.map((sz, k) => (
              <button key={k} onClick={() => { L.answer(lens.id, i, k); onDone && onDone(); }} aria-label={'answer ' + (k + 1)} style={{
                cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', background: 'none', border: 'none',
                padding: '10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ width: sz, height: sz, borderRadius: '50%', border: `1.5px solid ${col(lens.hue)}`, background: k > 2 ? col(lens.hue) : 'transparent', opacity: k === 2 ? 0.5 : 1, display: 'block' }}></span>
              </button>
            ))}
          </div>
          <span style={{ ...tiny, fontSize: 11, whiteSpace: 'nowrap' }}>yes</span>
        </div>
      </div>
    );
  }

  function Ring({ pct, hue, size = 20 }) {
    const r = size / 2 - 2, C = 2 * Math.PI * r;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="2.6"></circle>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col(hue)} strokeWidth="2.6" strokeLinecap="round"
          strokeDasharray={`${(C * pct) / 100} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}></circle>
      </svg>
    );
  }

  // ── one reading — title, optional lead, chart. No box. ──
  function LensRow({ lens, first, onTick }) {
    const L = window.LENSES;
    const [asking, setAsking] = useState(false);
    const pct = L.pct(lens.id), full = L.complete(lens.id);
    const v = L.score(lens.id);
    const Viz = VIZ[lens.viz] || Mini;
    const t2 = lens.tier === 2;
    const fill = pct < 60 ? prov(lens.hue) : col(lens.hue);
    // live mode with nothing answered: say so instead of a chart of dashes
    const blank = lens.dims.every((d) => !has(v, d.id));
    const head = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: t2 ? 13 : 15 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: t2 ? 14.5 : 16, fontWeight: 700, letterSpacing: '-0.015em' }}>{lens.title}</div>
          <div style={{ ...tiny, marginTop: 3, fontWeight: 500, color: 'var(--ink-2)' }}>{reading(lens, v)}</div>
        </div>
        {!full && <Ring pct={pct} hue={lens.hue} />}
      </div>
    );
    return (
      <div style={{ padding: t2 ? '17px 2px' : '21px 2px', borderTop: first ? 'none' : '0.5px solid var(--rule)' }}>
        {full ? head : (
          <button onClick={() => setAsking(a => !a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', color: 'inherit' }}>{head}</button>
        )}
        {blank
          ? <div style={{ ...NOREAD, padding: '2px 2px 2px', lineHeight: 1.5, textWrap: 'pretty' }}>No reading yet — this fills in as its questions come round in the feed, or answer a few now.</div>
          : <Viz dims={lens.dims} v={v} hue={lens.hue} fill={fill} />}
        {asking && !full && (
          <div style={{ marginTop: 16, padding: '14px 15px 4px', borderRadius: 14, background: `color-mix(in oklch, ${col(lens.hue)} 5%, var(--surface-2))` }}>
            <Asker lens={lens} onDone={() => { onTick(); if (L.complete(lens.id)) setAsking(false); }} />
          </div>
        )}
      </div>
    );
  }

  // ── the one sharpen affordance: a queue across every lens, thinnest first ──
  function Queue({ onTick }) {
    const L = window.LENSES;
    const [open, setOpen] = useState(false);
    const left = L.all.reduce((n, l) => n + (L.needed(l.id) - L.done(l.id)), 0);
    const next = L.all.filter(l => !L.complete(l.id)).sort((a, b) => L.pct(a.id) - L.pct(b.id) || a.tier - b.tier)[0];
    if (!next || left <= 0) return null;
    if (!open) return (
      <button className="press" onClick={() => setOpen(true)} style={{
        width: '100%', margin: '16px 0 4px', padding: '13px 16px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
        background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 14, color: 'var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em',
      }}><span>Sharpen a lens</span><span style={{ ...tiny, fontWeight: 600 }}>{left} questions left</span></button>
    );
    return (
      <div style={{ margin: '16px 0 4px', padding: '15px 16px 5px', borderRadius: 16, background: 'var(--surface-2)', border: '0.5px solid var(--rule)' }}>
        <Asker key={next.id + L.done(next.id)} lens={next} onDone={onTick} />
      </div>
    );
  }

  // ── boxed variant, kept behind a tweak for comparison ──
  function LensCard({ lens, onTick }) {
    const L = window.LENSES;
    const [asking, setAsking] = useState(false);
    const pct = L.pct(lens.id), full = L.complete(lens.id);
    const Viz = VIZ[lens.viz] || Mini;
    const t2 = lens.tier === 2;
    const fill = pct < 60 ? prov(lens.hue) : col(lens.hue);
    return (
      <div className="card" style={{ marginBottom: 12, padding: t2 ? '14px 16px' : '16px 18px', background: `linear-gradient(180deg, color-mix(in oklch, ${col(lens.hue)} 5%, var(--surface-2)), var(--surface-2) 110px)`, borderColor: `color-mix(in oklch, ${col(lens.hue)} 13%, var(--rule))` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: t2 ? 12 : 15 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: t2 ? 14.5 : 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{lens.title}</div>
            <div style={{ ...tiny, marginTop: 2, fontWeight: 500 }}>{lens.lead}</div>
          </div>
          {!full && <Ring pct={pct} hue={lens.hue} />}
        </div>
        <Viz dims={lens.dims} v={L.score(lens.id)} hue={lens.hue} fill={fill} />
        {!full && (asking
          ? <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}><Asker lens={lens} onDone={() => { onTick(); if (L.complete(lens.id)) setAsking(false); }} /></div>
          : <button onClick={() => setAsking(true)} style={{
              marginTop: 14, width: '100%', padding: '10px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
              background: `color-mix(in oklch, ${col(lens.hue)} 4%, transparent)`, border: `0.5px solid color-mix(in oklch, ${col(lens.hue)} 24%, var(--rule))`, borderRadius: 12, color: deep(lens.hue),
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
            }}>Sharpen it — {L.needed(lens.id) - L.done(lens.id)} left</button>)}
      </div>
    );
  }

  function LensesPanel({ boxed }) {
    const L = window.LENSES;
    const [tick, setTick] = useState(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    useEffect(() => L.subscribe(() => setTick(t => t + 1)), []);
    const bump = () => setTick(t => t + 1);
    if (boxed) return (
      <div style={{ paddingBottom: 8 }}>
        <div style={{ ...tiny, fontSize: 13.5, lineHeight: 1.5, margin: '14px 2px 16px', fontWeight: 500, textWrap: 'pretty' }}>
          Smaller readings than the four tests. They fill in slowly from the feed.
        </div>
        {L.all.map(l => <LensCard key={l.id} lens={l} onTick={bump} />)}
      </div>
    );
    const t1 = L.all.filter(l => l.tier === 1), t2 = L.all.filter(l => l.tier === 2);
    return (
      <div style={{ paddingBottom: 12 }}>
        <Queue onTick={bump} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 2px 0' }}>
          <span style={{ ...tiny, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 15, height: 7, borderRadius: 99, background: 'var(--ink-2)' }}></span>you</span>
          <span style={{ ...tiny, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 12, borderRadius: 2, background: typ }}></span>most people</span>
        </div>
        <div style={{ marginTop: 13, borderTop: '0.5px solid var(--rule)' }}>
          {t1.map((l, i) => <LensRow key={l.id} lens={l} first={i === 0} onTick={bump} />)}
        </div>
        <div style={{ marginTop: 14, borderTop: '0.5px solid var(--rule)' }}>
          {t2.map((l, i) => <LensRow key={l.id} lens={l} first={i === 0} onTick={bump} />)}
        </div>
      </div>
    );
  }

  Object.assign(window, { LensesPanel, LensCard, LensRow });
})();
