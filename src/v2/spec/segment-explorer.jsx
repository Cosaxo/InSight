// Ported from design/spec-modules/segment-explorer.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// segment-explorer.jsx — the World's Explore lens: pick trait chips (age,
// gender, politics, place) and see what that slice of the world believes —
// led by where it DIFFERS from everyone. Splits derive from the same
// deterministic hash the feed's who-voted breakdowns use.
//
// Visual rules for this view (kept deliberately narrow):
//   · ONE hue — the population accent. Bar LENGTH is the encoder; fill weight
//     ramps with it so a strong majority also reads heavier at a glance.
//   · the first finding of the leading section is a HERO bar (same grammar,
//     scaled up) — it carries the read-once key for the everyone caliper.
//   · numbers live INSIDE the fill, so the right edge stays a clean gutter for
//     the "you differ" ring. No micro-label lines under rows.
//   · the picker is one control, not a wall: dimension tabs open one chip row.
(function () {
  const { useState, useMemo } = React;
  const SX_DIMS = [
    ['age', ['18–24', '25–34', '35–44', '45+']],
    ['gender', ['Women', 'Men', 'Nonbinary']],
    ['politics', ['Left', 'Center', 'Right']],
    ['where', ['Americas', 'Europe', 'Asia', 'Elsewhere']],
  ];
  const SX_DIMLABEL = { age: 'Age', gender: 'Gender', politics: 'Politics', where: 'Place' };
  function sxHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }
  function sxVotes() { try { const v = JSON.parse(localStorage.getItem('insight.feedVotes.v1') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
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

  // Tint the accent by rewriting its lightness/chroma — NOT color-mix with a
  // neutral: --surface-3 carries a warm hue, so mixing interpolates the hue and
  // an indigo accent came out green. `oklch(from …)` keeps the hue exact.
  // With a share, weight ramps 50%→95% so length is double-encoded as density.
  const sxRamp = (s) => Math.min(1, Math.max(0, (s - 0.5) / 0.45));
  const sxFill = (c, s) => s == null
    ? 'oklch(from ' + c + ' 0.815 0.07 h)'
    : 'oklch(from ' + c + ' ' + (0.875 - 0.115 * sxRamp(s)).toFixed(3) + ' ' + (0.05 + 0.045 * sxRamp(s)).toFixed(3) + ' h)';
  const sxFillSoft = (c) => 'oklch(from ' + c + ' 0.935 0.026 h)';
  const sxPrompt = { fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.32, textWrap: 'pretty' };
  const sxAnswer = { fontFamily: 'var(--sans)', fontWeight: 800, letterSpacing: '-0.012em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const sxIn = { fontFamily: 'var(--sans)', fontWeight: 800, color: 'color-mix(in oklch, var(--ink) 62%, transparent)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' };
  const SX_GUTTER = 15; // right column reserved for the "you differ" ring

  // One question. base = Everyone's share of THIS row's top option, drawn as a
  // caliper mark taller than the track. big = hero treatment.
  function SXBar({ q, shares, top, divided, base, vote, color, big, baseKey }) {
    const c = color || 'var(--accent)';
    const pct = Math.round(shares[top] * 100);
    const differs = vote != null && vote !== top;
    const h = big ? 36 : 23;
    const inside = pct >= 34;
    return (
      <div>
        <div style={{ ...sxPrompt, fontSize: big ? 14.5 : 13.5, fontWeight: big ? 650 : 600, color: big ? 'var(--ink)' : 'var(--ink-2)' }}>{q.prompt}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: big ? 9 : 6 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', height: h, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
              {divided
                ? (() => {
                    const seam = (shares[0] / ((shares[0] + shares[1]) || 1)) * 100;
                    return (<>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: seam + '%', background: sxFill(c, 0.72) }}></div>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: seam + '%', right: 0, background: sxFillSoft(c) }}></div>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, marginLeft: -0.75, background: 'color-mix(in oklch, var(--ink) 26%, transparent)' }}></div>
                    </>);
                  })()
                : <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct + '%', borderRadius: 999, background: sxFill(c, shares[top]), transition: 'width 320ms var(--ease-out, ease)' }}></div>}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: big ? '0 14px' : '0 11px' }}>
                <span style={{ ...sxAnswer, fontSize: big ? 15.5 : 12.5, maxWidth: divided ? '48%' : '100%' }}>{q.options[divided ? 0 : top].label}</span>
                {divided && <span style={{ ...sxAnswer, fontSize: big ? 15.5 : 12.5, maxWidth: '48%', opacity: 0.72 }}>{q.options[1].label}</span>}
                {!divided && inside && <span style={{ ...sxIn, fontSize: big ? 20 : 12.5 }}>{pct}<span style={{ fontSize: big ? 12 : 9.5 }}>%</span></span>}
              </div>
            </div>
            {!divided && base != null && Math.abs(base - shares[top]) > 0.015 && (
              <span title="everyone" style={{ position: 'absolute', left: 'calc(' + (base * 100) + '% - 1px)', top: -3.5, bottom: -3.5, width: 2, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 50%, transparent)' }}></span>
            )}
          </div>
          {!divided && !inside && <span style={{ ...sxIn, fontSize: 12.5, color: 'var(--ink-3)', width: 28, textAlign: 'right' }}>{pct}<span style={{ fontSize: 9.5 }}>%</span></span>}
          {/* right gutter: a ring only when your answer isn't this slice's */}
          <span style={{ width: SX_GUTTER, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            {differs && !divided && <span title={'you said ' + q.options[vote].label} style={{ width: 9, height: 9, borderRadius: 999, boxShadow: 'inset 0 0 0 1.6px color-mix(in oklch, var(--ink) 40%, transparent)' }}></span>}
          </span>
        </div>
        {/* hero only: name the caliper once, with everyone's value on it */}
        {big && baseKey && base != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, paddingLeft: 2 }}>
            <span style={{ width: 2, height: 11, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 50%, transparent)' }}></span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 650, color: 'var(--ink-3)' }}>everyone {Math.round(base * 100)}%</span>
          </div>
        )}
      </div>
    );
  }

  // Slice B accent — a WARM hue, deliberately far from every population accent
  // (the World's is 235). A and B fills share lightness+chroma, so hue distance
  // is the only thing telling them apart: 15° would read as one colour.
  const SX_B = 'oklch(0.62 0.145 55)';
  const sxName = (sel, fallback) => { const n = SX_DIMS.flatMap(([dim, gs]) => sel[dim] != null ? [gs[sel[dim]]] : []); return n.length ? n.join(' · ') : fallback; };

  // A vs B — one question, two bars sharing a scale
  function SXDuoBar({ q, a, b }) {
    const row = (shares, top, color) => {
      const pct = Math.round(shares[top] * 100);
      return (
        <div style={{ position: 'relative', height: 21, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct + '%', borderRadius: 999, background: sxFill(color, shares[top]) }}></div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 11px' }}>
            <span style={{ ...sxAnswer, fontSize: 12.5 }}>{q.options[top].label}</span>
            <span style={{ ...sxIn, fontSize: 12 }}>{pct}<span style={{ fontSize: 9.5 }}>%</span></span>
          </div>
        </div>
      );
    };
    return (
      <div>
        <div style={sxPrompt}>{q.prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 7, paddingRight: SX_GUTTER + 7 }}>
          {row(a.shares, a.top, 'var(--accent)')}
          {row(b.shares, b.top, SX_B)}
        </div>
      </div>
    );
  }

  // Slice size — lit dots ≈ the slice's share of the world. Only worth showing
  // once a slice is actually narrower than everyone.
  function SXSizeDots({ share, accent }) {
    const lit = Math.max(1, Math.round(share * 16));
    return (
      <div title={'~' + Math.max(1, Math.round(share * 100)) + '% of the world'} style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} style={{ width: 4.5, height: 4.5, borderRadius: 999, flexShrink: 0, background: i < lit ? 'color-mix(in oklch, ' + accent + ' 75%, transparent)' : 'var(--surface-3)', transition: 'background 200ms' }}></span>
        ))}
      </div>
    );
  }

  const SX_FADE = { maskImage: 'linear-gradient(90deg, #000 calc(100% - 26px), transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 26px), transparent)' };

  // The picker: dimension tabs open ONE chip row, instead of stacking four.
  function SXChips({ sel, setSel, accent }) {
    const firstOpen = (SX_DIMS.find(([d]) => sel[d] != null) || SX_DIMS[0])[0];
    const [dim, setDim] = useState(firstOpen);
    const gs = (SX_DIMS.find(([d]) => d === dim) || SX_DIMS[0])[1];
    return (
      <div>
        <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)' }}>
          {SX_DIMS.map(([d]) => {
            const on = d === dim, picked = sel[d] != null;
            return (
              <button key={d} onClick={() => setDim(d)} style={{
                position: 'relative', flex: 1, border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                padding: '7px 2px 9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 650, color: on ? 'var(--ink)' : 'var(--ink-3)',
              }}>
                {picked && <span style={{ width: 5, height: 5, borderRadius: 999, background: accent, flexShrink: 0 }}></span>}
                {SX_DIMLABEL[d]}
                {on && <span style={{ position: 'absolute', left: '50%', bottom: -0.5, width: 26, marginLeft: -13, height: 2.5, borderRadius: 99, background: accent }}></span>}
              </button>
            );
          })}
        </div>
        <div className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10, ...SX_FADE }}>
          {gs.map((g, gi) => {
            const on = sel[dim] === gi;
            return (
              <button key={g} onClick={() => setSel((s) => ({ ...s, [dim]: on ? null : gi }))} aria-pressed={on} style={{
                border: on ? 'none' : '0.5px solid var(--rule)',
                background: on ? accent : 'var(--surface)',
                color: on ? 'var(--surface)' : 'var(--ink-2)',
                fontFamily: 'var(--sans)', fontWeight: on ? 800 : 600, fontSize: 12.5,
                padding: '6px 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap',
                boxShadow: on ? '0 1px 5px color-mix(in oklch, ' + accent + ' 34%, transparent)' : 'none',
                transition: 'background 160ms, color 160ms',
              }}>{g}</button>
            );
          })}
        </div>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    const rows = useMemo(() => sxRows(sel), [JSON.stringify(sel)]);
    const baseRows = useMemo(() => sxRows({}), []);
    const baseByQ = useMemo(() => { const m = {}; baseRows.forEach((r) => { m[r.q.id] = r; }); return m; }, [baseRows]);
    const duo = selB != null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    const rowsB = useMemo(() => duo ? sxRows(selB) : null, [duo && JSON.stringify(selB)]);
    const nameA = sxName(sel, 'Everyone'), nameB = duo ? sxName(selB, 'Everyone') : null;
    const hasSel = sxCount(sel) > 0;
    const pick = (s) => { setSel(s); setEditing('a'); setOpen(false); };
    const seg = (on, accent) => ({
      border: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 999,
      fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600,
      background: on ? 'color-mix(in oklch, ' + accent + ' 14%, var(--surface-2))' : 'transparent',
      color: on ? 'var(--ink)' : 'var(--ink-3)',
      boxShadow: on ? 'inset 0 0 0 1.5px color-mix(in oklch, ' + accent + ' 50%, transparent)' : 'none',
      maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    });
    const kicker = { fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', letterSpacing: '0.075em', textTransform: 'uppercase' };
    const group = { display: 'flex', flexDirection: 'column', gap: 15 };
    const sect = (label, first) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: first ? 20 : 26, marginBottom: 3 }}>
        <span style={kicker}>{label}</span>
        <span style={{ flex: 1, height: '0.5px', background: 'color-mix(in oklch, var(--rule), transparent 25%)' }}></span>
      </div>
    );
    let body, keyRing = false;
    if (!duo) {
      // Lead with difference from Everyone when a slice is picked.
      const byDiff = rows.map((r) => ({ ...r, diff: baseByQ[r.q.id] ? r.topShare - baseByQ[r.q.id].shares[r.top] : 0 }));
      const unlike = hasSel ? byDiff.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3) : [];
      const unlikeIds = new Set(unlike.map((r) => r.q.id));
      const agree = rows.filter((r) => !unlikeIds.has(r.q.id)).sort((a, b) => b.topShare - a.topShare).slice(0, hasSel ? 3 : 4);
      const split = rows.filter((r) => !unlikeIds.has(r.q.id)).sort((a, b) => a.topShare - b.topShare).slice(0, 3);
      keyRing = [...unlike, ...agree].some((r) => votes[r.q.id] != null && votes[r.q.id] !== r.top);
      const bar = (r, i, showBase) => (
        <SXBar key={r.q.id} q={r.q} shares={r.shares} top={r.top} big={i === 0} baseKey={i === 0}
          base={showBase ? baseByQ[r.q.id] && baseByQ[r.q.id].shares[r.top] : null} vote={votes[r.q.id]}></SXBar>
      );
      body = (<>
        {hasSel && sect('Most unlike everyone', true)}
        {hasSel && <div style={group}>{unlike.map((r, i) => bar(r, i, true))}</div>}
        {sect('Agree most on', !hasSel)}
        <div style={group}>{agree.map((r, i) => bar(r, hasSel ? i + 1 : i, hasSel))}</div>
        {sect('Most divided')}
        <div style={group}>
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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800, letterSpacing: '-0.015em', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: sxFill('var(--accent)', 0.95), flexShrink: 0 }}></span>
            <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</span>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>vs</span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: sxFill(SX_B, 0.95), flexShrink: 0 }}></span>
            <span style={{ color: SX_B, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</span>
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{overlap}% overlap</span>
        </div>
        <div style={{ position: 'relative', height: 7, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', marginTop: 8 }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: overlap + '%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), ' + SX_B + ')', opacity: 0.8 }}></div>
        </div>
        {sect('Where they meet')}
        <div style={group}>
          {shared.map((p) => <SXDuoBar key={p.q.id} q={p.q} a={p.a} b={p.b}></SXDuoBar>)}
        </div>
        {sect('Where they part')}
        <div style={group}>
          {differ.map((p) => <SXDuoBar key={p.q.id} q={p.q} a={p.a} b={p.b}></SXDuoBar>)}
        </div>
      </>);
    }
    const editSel = (!duo || editing === 'a') ? sel : selB;
    const editAccent = (!duo || editing === 'a') ? 'var(--accent)' : SX_B;
    return (
      <div>
        <TabSection title="Explore" sub={duo ? 'two slices of the world — where they meet, where they part' : 'pick a slice — see what it believes'} />
        {/* the card IS the control; findings live on the ground below it */}
        <div className="card" style={{ padding: '11px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 999, background: 'var(--surface-3)', minWidth: 0 }}>
              <button onClick={() => { if (duo && editing !== 'a') { setEditing('a'); setOpen(true); } else setOpen(!open); }} style={seg(!duo || editing === 'a', 'var(--accent)')}>{nameA}</button>
              {duo && <button onClick={() => { if (editing !== 'b') { setEditing('b'); setOpen(true); } else setOpen(!open); }} style={seg(editing === 'b', SX_B)}>{nameB}</button>}
              <button onClick={() => { if (duo) { setSelB(null); setEditing('a'); } else { setSelB({}); setEditing('b'); setOpen(true); } }} title={duo ? 'back to one slice' : 'compare with a second slice'} style={{
                border: 'none', WebkitAppearance: 'none', cursor: 'pointer', background: 'transparent', flexShrink: 0,
                fontFamily: 'var(--sans)', fontSize: duo ? 15 : 11.5, fontWeight: 800, color: 'var(--ink-3)', padding: duo ? '3px 9px' : '4px 10px', lineHeight: 1, letterSpacing: duo ? 0 : '0.02em',
              }}>{duo ? '×' : 'vs +'}</button>
            </div>
            <span style={{ flex: 1 }}></span>
            {sxCount(editSel) > 0 && <SXSizeDots share={sxShare(editSel)} accent={editAccent}></SXSizeDots>}
            {!duo && hasSel && (
              <button onClick={() => setSel({})} style={{ border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '4px 2px', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>clear</button>
            )}
          </div>
          {open && <div style={{ marginTop: 9 }}>
            <SXChips key={duo ? editing : 'a'} sel={editSel} setSel={(!duo || editing === 'a') ? setSel : setSelB} accent={editAccent}></SXChips>
            {!duo && !hasSel && <div className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 11, paddingTop: 11, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', ...SX_FADE }}>
              {SX_PRESETS.map(([label, s]) => (
                <button key={label} onClick={() => pick(s)} style={{
                  border: '0.5px solid var(--rule)', WebkitAppearance: 'none', cursor: 'pointer', background: 'var(--surface-2)',
                  fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>}
          </div>}
        </div>
        {/* read-once key for the gutter ring — replaces a "you said …" line per row */}
        {keyRing && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12, paddingRight: 3 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, boxShadow: 'inset 0 0 0 1.6px color-mix(in oklch, var(--ink) 40%, transparent)' }}></span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 650, color: 'var(--ink-3)' }}>you answered otherwise</span>
          </div>
        )}
        {body}
      </div>
    );
  }

  Object.assign(window, { SegmentExplorer });
})();

