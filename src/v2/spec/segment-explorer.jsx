/* eslint-disable */
// Ported from design/spec-modules/segment-explorer.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// segment-explorer.jsx — the World's Explore lens: pick trait chips (age,
// gender, politics, place) and see what that slice of the world believes —
// led by where it DIFFERS from everyone. Every bar carries an Everyone
// baseline tick; your own answer shows as a dot. Splits derive from the same
// deterministic hash the feed's who-voted breakdowns use.
(function () {
  const { useState, useMemo } = React;
  const SX_DIMS = [
    ['age', ['18–24', '25–34', '35–44', '45+']],
    ['gender', ['Women', 'Men', 'Nonbinary']],
    ['politics', ['Left', 'Center', 'Right']],
    ['where', ['Americas', 'Europe', 'Asia', 'Elsewhere']],
  ];
  function sxHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }
  function sxVotes() { try { const v = JSON.parse(localStorage.getItem('insight.feedVotes.v1') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  const sxTopic = (cat) => (window.WORLD_TOPICS || []).find((t) => t.id === cat) || { color: 'var(--accent)' };
  const sxCount = (sel) => SX_DIMS.reduce((n, [d]) => n + (sel && sel[d] != null ? 1 : 0), 0);
  // Rough share of world the slice covers: each picked trait keeps ~1/groups of people.
  const sxShare = (sel) => SX_DIMS.reduce((f, [d, gs]) => sel && sel[d] != null ? f / gs.length : f, 1);

  function sxRows(sel) {
    const qs = (window.WORLD_FEED_QS || []).filter((q) => q.type === 'vote' || q.type === 'duel');
    return qs.map((q) => {
      const w = q.options.map((o, oi) => {
        let v = o.count;
        SX_DIMS.forEach(([dim]) => {
          const gi = sel[dim];
          if (gi != null) v *= 0.55 + sxHash(q.id + ':' + dim + ':' + gi + ':' + oi);
        });
        return v;
      });
      const total = w.reduce((a, b) => a + b, 0) || 1;
      const shares = w.map((x) => x / total);
      const top = shares.indexOf(Math.max(...shares));
      return { q, top, topShare: shares[top], shares };
    });
  }

  // One question bar. base = Everyone's share of THIS row's top option (tick).
  // vote = user's picked option index (dot: filled when with the slice).
  function SXBar({ q, shares, top, divided, base, vote }) {
    const color = sxTopic(q.cat).color;
    const pct = Math.round(shares[top] * 100);
    const you = vote != null && (
      <span title="you" style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: vote === top ? 'var(--ink)' : 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--ink)' }}></span>
    );
    return (
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.3, textWrap: 'pretty' }}>{q.prompt}</div>
        <div style={{ position: 'relative', height: 28, borderRadius: 9, background: 'var(--surface-3)', overflow: 'hidden', marginTop: 6 }}>
          {divided
            ? (() => {
                const seam = (shares[0] / ((shares[0] + shares[1]) || 1)) * 100;
                return (<>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: seam + '%', background: 'color-mix(in oklch, ' + color + ' 55%, var(--surface-3))' }}></div>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: seam + '%', right: 0, background: 'color-mix(in oklch, ' + color + ' 22%, var(--surface-3))' }}></div>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, background: 'color-mix(in oklch, var(--ink) 35%, transparent)' }}></div>
                </>);
              })()
            : (<>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct + '%', borderRadius: 9, background: 'color-mix(in oklch, ' + color + ' 45%, var(--surface-3))' }}></div>
                {base != null && Math.abs(base - shares[top]) > 0.015 && <div title="everyone" style={{ position: 'absolute', top: 3, bottom: 3, left: 'calc(' + (base * 100) + '% - 1px)', width: 2, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 45%, transparent)' }}></div>}
              </>)}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: divided ? '48%' : undefined }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.options[divided ? 0 : top].label}</span>
              {!divided && vote === top && you}
            </span>
            {divided
              ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48%' }}>{q.options[1].label}</span>
              : <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {vote != null && vote !== top && you}
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>{pct + '%'}</span>
                </span>}
          </div>
        </div>
      </div>
    );
  }

  const SX_B = 'oklch(0.58 0.12 250)'; // slice B accent — cool blue, distinct from any topic hue
  const sxName = (sel, fallback) => { const n = SX_DIMS.flatMap(([dim, gs]) => sel[dim] != null ? [gs[sel[dim]]] : []); return n.length ? n.join(' · ') : fallback; };

  // A vs B — one question, two bars sharing a scale
  function SXDuoBar({ q, a, b }) {
    const row = (shares, top, color) => (
      <div style={{ position: 'relative', height: 24, borderRadius: 8, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.round(shares[top] * 100) + '%', borderRadius: 8, background: 'color-mix(in oklch, ' + color + ' 45%, var(--surface-3))' }}></div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 9px' }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.options[top].label}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0 }}>{Math.round(shares[top] * 100)}%</span>
        </div>
      </div>
    );
    return (
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.3, textWrap: 'pretty' }}>{q.prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {row(a.shares, a.top, 'var(--accent)')}
          {row(b.shares, b.top, SX_B)}
        </div>
      </div>
    );
  }

  // Slice size — a strip of 24 dots; lit dots ≈ the slice's share of the world.
  function SXSizeDots({ share, accent }) {
    const lit = Math.max(1, Math.round(share * 24));
    return (
      <div title={'~' + Math.max(1, Math.round(share * 100)) + '% of the world'} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: i < lit ? 'color-mix(in oklch, ' + accent + ' 75%, transparent)' : 'var(--surface-3)', transition: 'background 200ms' }}></span>
        ))}
      </div>
    );
  }

  function SXChips({ sel, setSel, accent }) {
    const chip = (on) => ({
      border: on ? '1.5px solid color-mix(in oklch, ' + accent + ' 55%, transparent)' : '0.5px solid var(--rule)',
      background: on ? 'color-mix(in oklch, ' + accent + ' 10%, transparent)' : 'var(--surface)',
      color: on ? 'var(--ink)' : 'var(--ink-3)',
      fontFamily: 'var(--sans)', fontWeight: on ? 800 : 600, fontSize: 12,
      padding: '5px 12px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap',
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {SX_DIMS.map(([dim, gs]) => (
          <div key={dim} className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {gs.map((g, gi) => {
              const on = sel[dim] === gi;
              return <button key={g} onClick={() => setSel((s) => ({ ...s, [dim]: on ? null : gi }))} aria-pressed={on} style={chip(on)}>{g}</button>;
            })}
          </div>
        ))}
      </div>
    );
  }

  const SX_PRESETS = [
    ['Gen Z Europe', { age: 0, where: 1 }],
    ['45+ Right', { age: 3, politics: 2 }],
    ['Women · Asia', { gender: 0, where: 2 }],
    ['Left · Americas', { politics: 0, where: 0 }],
  ];

  function SegmentExplorer() {
    const [sel, setSel] = useState({});
    const [selB, setSelB] = useState(null); // null = single-slice mode
    const [editing, setEditing] = useState('a');
    const [open, setOpen] = useState(true); // picker expanded?
    const votes = useMemo(sxVotes, []);
    const rows = useMemo(() => sxRows(sel), [JSON.stringify(sel)]);
    const baseRows = useMemo(() => sxRows({}), []);
    const baseByQ = useMemo(() => { const m = {}; baseRows.forEach((r) => { m[r.q.id] = r; }); return m; }, [baseRows]);
    const duo = selB != null;
    const rowsB = useMemo(() => duo ? sxRows(selB) : null, [duo && JSON.stringify(selB)]);
    const nameA = sxName(sel, 'Everyone'), nameB = duo ? sxName(selB, 'Everyone') : null;
    const hasSel = sxCount(sel) > 0;
    const pick = (s) => { setSel(s); setEditing('a'); setOpen(false); };
    const seg = (on, accent) => ({
      border: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 999,
      fontFamily: 'var(--sans)', fontSize: 12, fontWeight: on ? 800 : 600,
      background: on ? 'color-mix(in oklch, ' + accent + ' 14%, var(--surface-2))' : 'transparent',
      color: on ? 'var(--ink)' : 'var(--ink-3)',
      boxShadow: on ? 'inset 0 0 0 1.5px color-mix(in oklch, ' + accent + ' 50%, transparent)' : 'none',
      maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    });
    const kicker = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' };
    let body;
    if (!duo) {
      // Lead with difference from Everyone when a slice is picked.
      const byDiff = rows.map((r) => ({ ...r, diff: baseByQ[r.q.id] ? r.topShare - baseByQ[r.q.id].shares[r.top] : 0 }));
      const unlike = hasSel ? byDiff.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 4) : [];
      const unlikeIds = new Set(unlike.map((r) => r.q.id));
      const agree = rows.filter((r) => !unlikeIds.has(r.q.id)).sort((a, b) => b.topShare - a.topShare).slice(0, hasSel ? 4 : 5);
      const split = rows.filter((r) => !unlikeIds.has(r.q.id)).sort((a, b) => a.topShare - b.topShare).slice(0, 3);
      body = (<>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 16 }}>
          {hasSel && <span style={kicker}>Most unlike everyone</span>}
          {unlike.map((r) => <SXBar key={r.q.id} q={r.q} shares={r.shares} top={r.top} base={baseByQ[r.q.id] && baseByQ[r.q.id].shares[r.top]} vote={votes[r.q.id]}></SXBar>)}
          <span style={{ ...kicker, marginTop: hasSel ? 4 : 0 }}>Agree most on</span>
          {agree.map((r) => <SXBar key={r.q.id} q={r.q} shares={r.shares} top={r.top} base={hasSel ? baseByQ[r.q.id] && baseByQ[r.q.id].shares[r.top] : null} vote={votes[r.q.id]}></SXBar>)}
          <span style={{ ...kicker, marginTop: 4 }}>Most divided</span>
          {split.map((r) => <SXBar key={r.q.id} q={r.q} shares={r.shares} top={r.top} divided></SXBar>)}
        </div>
      </>);
    } else {
      const pairs = rows.map((a, i) => ({ a, b: rowsB[i], q: a.q }));
      const shared = pairs.filter((p) => p.a.top === p.b.top).sort((x, y) => (y.a.topShare + y.b.topShare) - (x.a.topShare + x.b.topShare)).slice(0, 4);
      const differ = pairs.filter((p) => p.a.top !== p.b.top).sort((x, y) => (y.a.topShare + y.b.topShare) - (x.a.topShare + x.b.topShare)).slice(0, 4);
      const nShared = pairs.filter((p) => p.a.top === p.b.top).length;
      const overlap = Math.round((nShared / (pairs.length || 1)) * 100);
      body = (<>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800, letterSpacing: '-0.015em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--accent)' }}>{nameA}</span>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}> vs </span>
            <span style={{ color: SX_B }}>{nameB}</span>
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{overlap}% overlap</span>
        </div>
        <div style={{ position: 'relative', height: 7, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', marginTop: 8 }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: overlap + '%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), ' + SX_B + ')', opacity: 0.8 }}></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 14 }}>
          <span style={kicker}>Where they meet</span>
          {shared.map((p) => <SXDuoBar key={p.q.id} q={p.q} a={p.a} b={p.b}></SXDuoBar>)}
          <span style={{ ...kicker, marginTop: 4 }}>Where they part</span>
          {differ.map((p) => <SXDuoBar key={p.q.id} q={p.q} a={p.a} b={p.b}></SXDuoBar>)}
        </div>
      </>);
    }
    const editSel = (!duo || editing === 'a') ? sel : selB;
    const editAccent = (!duo || editing === 'a') ? 'var(--accent)' : SX_B;
    return (
      <div>
        <TabSection title="Explore" sub={duo ? 'two slices of the world — where they meet, where they part' : 'pick traits — see what that slice of the world agrees on'} />
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 999, background: 'var(--surface-3)', maxWidth: '100%' }}>
              <button onClick={() => { if (duo && editing !== 'a') { setEditing('a'); setOpen(true); } else setOpen(!open); }} style={seg(!duo || editing === 'a', 'var(--accent)')}>{nameA}</button>
              {duo && <button onClick={() => { if (editing !== 'b') { setEditing('b'); setOpen(true); } else setOpen(!open); }} style={seg(editing === 'b', SX_B)}>{nameB}</button>}
              <button onClick={() => { if (duo) { setSelB(null); setEditing('a'); } else { setSelB({}); setEditing('b'); setOpen(true); } }} title={duo ? 'back to one slice' : 'compare with a second slice'} style={{
                border: 'none', WebkitAppearance: 'none', cursor: 'pointer', background: 'transparent', flexShrink: 0,
                fontFamily: 'var(--sans)', fontSize: duo ? 15 : 11.5, fontWeight: 800, color: 'var(--ink-3)', padding: duo ? '3px 9px' : '4px 10px', lineHeight: 1, letterSpacing: duo ? 0 : '0.02em',
              }}>{duo ? '×' : 'vs +'}</button>
            </div>
            <SXSizeDots share={duo ? sxShare(editSel) : sxShare(sel)} accent={editAccent}></SXSizeDots>
          </div>
          {open && <div style={{ marginTop: 10 }}>
            <SXChips sel={editSel} setSel={(!duo || editing === 'a') ? setSel : setSelB} accent={editAccent}></SXChips>
            {!duo && !hasSel && <div className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--rule)' }}>
              {SX_PRESETS.map(([label, s]) => (
                <button key={label} onClick={() => pick(s)} style={{
                  border: '0.5px solid var(--rule)', WebkitAppearance: 'none', cursor: 'pointer', background: 'var(--surface-2)',
                  fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>}
          </div>}
          {body}
        </div>
      </div>
    );
  }

  Object.assign(window, { SegmentExplorer });
})();

