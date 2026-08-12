// Ported from design/spec-modules/segment-explorer.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { TabSection } from './primitives.jsx';
import { IS_DATA } from './sample-data.js';
import { IS_TEST_RESULTS } from './test-definitions.js';

// segment-explorer.jsx — the World's Explore lens: pick trait chips (age,
// gender, politics, place) and see what that slice of the world believes —
// led by where it DIFFERS from everyone. Splits derive from the same
// deterministic hash the feed's who-voted breakdowns use.
//
// Visual rules for this view (kept deliberately narrow):
//   · NO TRACK, NO PILL. A row is: quiet question / answer as real type /
//     a solid rule whose LENGTH is the share. Two marks, not five — the old
//     grey track + reversed-out lozenge made four rows read as one texture.
//   · ONE hue — the population accent, at full strength. Length is the only
//     encoder; it doesn't need a density ramp to help it.
//   · the leading finding is a HERO: 30px answer, 26px number, 8px rule.
//   · length measures the majority ABOVE 40%: real answers cluster at 77–88%
//     and full-scale bars made a ranking look like four identical rows.
//   · the picker is ONE LINE until tapped. Expanded, it's dimension tabs over
//     a single chip row — never a wall of four rows.
(function () {
  const { useState, useMemo } = React;

  // Every test you have taken becomes a slice axis. Each dimension splits into
  // its two named poles — the same ends the test itself reports — so "people who
  // scored like this" is a slice you can pick, and the pole YOUR result sits on
  // is marked. Without this the explorer knew four demographic facts about the
  // world and nothing about the person using it.
  const SX_TESTS = [
    ['personality', 'Personality', 'big5', { O: ['Open', 'Grounded'], C: ['Orderly', 'Loose'], E: ['Outgoing', 'Reserved'], A: ['Warm', 'Blunt'], N: ['Sensitive', 'Steady'] }],
    ['politics', 'Politics', 'political', { econ: ['Market', 'Left'], auth: ['Order', 'Liberty'], foreign: ['Open', 'Closed'], env: ['Green', 'Sceptic'], tech: ['Tech-first', 'Cautious'], estab: ['Outsider', 'Establishment'] }],
    ['values', 'Values', 'values', { future: ['Hopeful', 'Wary'], circle: ['Wide circle', 'Close circle'], hedonism: ['Pleasure', 'Duty'], meaning: ['Meaning', 'Happiness'], moral: ['Objective', 'Relative'], beauty: ['Beauty', 'Truth only'] }],
    ['social', 'Social', 'attachment', { warm: ['Warm', 'Reserved'], loyal: ['Few & deep', 'Many & light'], open: ['Open book', 'Guarded'], play: ['Playful', 'Grounded'], easy: ['Easygoing', 'Invested'] }],
  ];

  // frac = the share of people a group keeps, used for the slice-size dots.
  // A test pole is roughly the top or bottom third, not one of N equal boxes.
  function sxBuildDims() {
    const me = IS_DATA.me || {};
    const age = (me.stats && me.stats.age) || 34;
    const bands = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
    const mineBand = age < 25 ? 0 : age < 35 ? 1 : age < 45 ? 2 : age < 55 ? 3 : age < 65 ? 4 : 5;
    const plain = (labels, frac) => labels.map((l) => ({ label: l, frac: frac || 1 / labels.length }));
    const dims = [
      { id: 'age', label: 'Age', groups: bands.map((l, i) => ({ label: l, frac: 1 / bands.length, mine: i === mineBand })) },
      { id: 'gender', label: 'Gender', groups: [{ label: 'Women', frac: 0.49 }, { label: 'Men', frac: 0.48 }, { label: 'Nonbinary', frac: 0.03 }] },
      { id: 'where', label: 'Place', groups: plain(['Americas', 'Europe', 'Africa', 'Asia', 'Middle East', 'Oceania']) },
      // NOTE: no 'Living' (urban/rural) or 'Life' (studying/working/retired) axis
      // — the app collects neither, and a slice built on a fact nobody has given
      // is a lie with a chip around it. Worth adding later: where someone lives on
      // the city–countryside line is one of the strongest splitters there is, and
      // it would only take one profile question or one daily to earn it.
    ];
    SX_TESTS.forEach(([id, label, key, poles]) => {
      const R = IS_TEST_RESULTS[key];
      if (!R || !R.dims) return;
      const groups = [];
      R.dims.forEach((d) => {
        const p = poles[d.id];
        if (!p) return;
        const dist = Math.abs(d.value - 50);
        groups.push({ label: p[0], frac: 0.34, mine: d.value >= 56, dist, axis: d.label });
        groups.push({ label: p[1], frac: 0.34, mine: d.value <= 44, dist, axis: d.label });
      });
      if (groups.length) dims.push({ id, label, groups, fromTest: key });
    });
    return dims;
  }
  // Rebuilt whenever a test result changes — tests are retaken in-app, and a
  // picker that keeps showing last month's poles is the bug this view was
  // meant to fix. The signature is cheap; the rebuild is not, so it is cached.
  let SX_CACHE = null, SX_SIG = null;
  const sxSig = () => {
    const R = IS_TEST_RESULTS;
    let s = '';
    for (const k in R) { const d = R[k] && R[k].dims; if (d) for (let i = 0; i < d.length; i++) s += k + d[i].id + d[i].value + ';'; }
    return s;
  };
  const sxDims = () => { const sig = sxSig(); if (!SX_CACHE || sig !== SX_SIG) { SX_SIG = sig; SX_CACHE = sxBuildDims(); } return SX_CACHE; };
  const sxDim = (id) => sxDims().find((d) => d.id === id) || sxDims()[0];
  // your own result, as a slice: the three poles you sit furthest out on
  function sxLikeMe() {
    const picks = [];
    sxDims().forEach((d) => {
      const c = d.groups.map((g, i) => ({ g, i })).filter((x) => x.g.mine).sort((a, b) => (b.g.dist || 0) - (a.g.dist || 0))[0];
      if (c) picks.push({ dim: d.id, i: c.i, dist: c.g.dist != null ? c.g.dist : 99 });
    });
    picks.sort((a, b) => b.dist - a.dist);
    const s = {};
    picks.slice(0, 3).forEach((p) => { s[p.dim] = p.i; });
    return s;
  }
  const sxHasMine = () => sxDims().some((d) => d.groups.some((g) => g.mine));
  function sxHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }
  function sxVotes() { try { const v = JSON.parse(localStorage.getItem('insight.feedVotes.v1') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  const sxCount = (sel) => sxDims().reduce((n, d) => n + (sel && sel[d.id] != null ? 1 : 0), 0);
  // Rough share of world the slice covers — each picked trait keeps its own frac.
  const sxShare = (sel) => sxDims().reduce((f, d) => (sel && sel[d.id] != null && d.groups[sel[d.id]]) ? f * d.groups[sel[d.id]].frac : f, 1);

  function sxRows(sel) {
    const qs = (window.WORLD_FEED_QS || []).filter((q) => q.type === 'vote' || q.type === 'duel');
    return qs.map((q) => {
      const w = q.options.map((o, oi) => {
        let v = o.count;
        sxDims().forEach((d) => {
          const gi = sel[d.id];
          if (gi != null) v *= 0.55 + sxHash(q.id + ':' + d.id + ':' + gi + ':' + oi);
        });
        return v;
      });
      const total = w.reduce((a, b) => a + b, 0) || 1;
      const shares = w.map((x) => x / total);
      const top = shares.indexOf(Math.max(...shares));
      return { q, top, topShare: shares[top], shares };
    });
  }

  // The unfilled half of a divided rule. Tinted by rewriting lightness/chroma —
  // NOT color-mix with a neutral: --surface-3 carries a warm hue, so mixing
  // interpolates the hue and an indigo accent came out green.
  const sxWash = (c) => 'oklch(from ' + c + ' 0.895 0.045 h)';
  const sxQ = { fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.35, textWrap: 'pretty' };
  const sxAns = { fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 800, letterSpacing: '-0.022em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const sxPct = { fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 800, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 };
  // Length = majority above this floor. The exact share sits beside the answer,
  // so length is free to carry the RANKING instead of the absolute.
  const SX_FLOOR = 0.4;
  const sxW = (s) => Math.max(4, Math.min(100, ((s - SX_FLOOR) / (1 - SX_FLOOR)) * 100));
  const sxRing = (t) => (
    <span title={t} style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, boxShadow: 'inset 0 0 0 1.6px color-mix(in oklch, var(--ink) 40%, transparent)' }}></span>
  );

  // One question. base = Everyone's share of THIS row's top option, drawn as a
  // tick standing proud of the rule. big = hero treatment.
  function SXBar({ q, shares, top, divided, base, vote, color, big }) {
    const c = color || 'var(--accent)';
    const pct = Math.round(shares[top] * 100);
    const differs = vote != null && vote !== top;
    const h = big ? 8 : 5;
    if (divided) {
      const seam = (shares[0] / ((shares[0] + shares[1]) || 1)) * 100;
      return (
        <div>
          <div style={sxQ}>{q.prompt}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
            <span style={{ ...sxAns, fontSize: 16, flex: 1, minWidth: 0 }}>{q.options[0].label}</span>
            <span style={{ ...sxAns, fontSize: 16, color: 'var(--ink-3)', flex: 1, minWidth: 0, textAlign: 'right' }}>{q.options[1].label}</span>
          </div>
          <div style={{ position: 'relative', height: 5, borderRadius: 999, background: sxWash(c), marginTop: 8, overflow: 'hidden' }}>
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: seam + '%', borderRadius: 999, background: c, transition: 'width 320ms var(--ease-out, ease)' }}></span>
          </div>
        </div>
      );
    }
    return (
      <div>
        <div style={{ ...sxQ, fontSize: big ? 13 : 12.5 }}>{q.prompt}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: big ? 4 : 2 }}>
          <span style={{ ...sxAns, fontSize: big ? 30 : 17, letterSpacing: big ? '-0.032em' : '-0.022em', lineHeight: big ? 1.05 : 1.25 }}>{q.options[top].label}</span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
            {differs && sxRing('you said ' + q.options[vote].label)}
            <span style={{ ...sxPct, fontSize: big ? 26 : 14, letterSpacing: big ? '-0.03em' : 0, color: big ? 'var(--accent-ink)' : 'var(--ink-2)' }}>
              {pct}{big && <span style={{ fontSize: 15 }}>%</span>}
            </span>
          </span>
        </div>
        <div style={{ position: 'relative', marginTop: big ? 10 : 7, height: h }}>
          <div style={{ height: h, width: sxW(shares[top]) + '%', borderRadius: 999, background: c, transition: 'width 320ms var(--ease-out, ease)' }}></div>
          {base != null && Math.abs(base - shares[top]) > 0.015 && (
            <span title={'everyone ' + Math.round(base * 100) + '%'} style={{ position: 'absolute', left: 'calc(' + sxW(base) + '% - 1px)', top: -4, bottom: -4, width: 2, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 45%, transparent)' }}></span>
          )}
        </div>
        {/* hero only: name the tick once, with everyone's value on it */}
        {big && base != null && Math.abs(base - shares[top]) > 0.015 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ width: 2, height: 11, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 45%, transparent)' }}></span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 650, color: 'var(--ink-3)' }}>everyone {Math.round(base * 100)}%</span>
          </div>
        )}
      </div>
    );
  }

  // Slice B accent — a WARM hue, deliberately far from every population accent
  // (the World's is 235). A and B rules share weight, so hue distance is the
  // only thing telling them apart: 15° would read as one colour.
  const SX_B = 'oklch(0.62 0.145 55)';
  const sxName = (sel, fallback) => { const n = sxDims().flatMap((d) => (sel[d.id] != null && d.groups[sel[d.id]]) ? [d.groups[sel[d.id]].label] : []); return n.length ? n.join(' · ') : fallback; };

  // A vs B — one question, two rules sharing a scale
  function SXDuoBar({ q, a, b }) {
    const row = (shares, top, color) => (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...sxAns, fontSize: 15, display: 'block' }}>{q.options[top].label}</span>
          <span style={{ display: 'block', height: 5, marginTop: 5, width: sxW(shares[top]) + '%', borderRadius: 999, background: color }}></span>
        </span>
        <span style={{ ...sxPct, fontSize: 13, width: 24, textAlign: 'right' }}>{Math.round(shares[top] * 100)}</span>
      </div>
    );
    return (
      <div>
        <div style={sxQ}>{q.prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 5 }}>
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

  // Rails fade only on a side that still has content — edge-fade.js sets
  // data-ef on .h-scroll and styles.css owns the mask.

  // Expanded picker: dimension tabs open ONE chip row, instead of stacking four.
  // Tabs scroll now that the tests are axes too; a chip whose pole matches your
  // own result is outlined, so your answers are visible inside the picker.
  function SXChips({ sel, setSel, accent }) {
    const dims = sxDims();
    const firstOpen = (dims.find((d) => sel[d.id] != null) || dims[0]).id;
    const [dim, setDim] = useState(firstOpen);
    const D = sxDim(dim);
    return (
      <div>
        <div className="h-scroll" style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)' }}>
          {dims.map((d) => {
            const on = d.id === D.id, picked = sel[d.id] != null;
            return (
              <button key={d.id} onClick={() => setDim(d.id)} style={{
                position: 'relative', flex: 'none', border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                padding: '7px 10px 9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap',
                fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 650, color: on ? 'var(--ink)' : 'var(--ink-3)',
              }}>
                {picked && <span style={{ width: 5, height: 5, borderRadius: 999, background: accent, flexShrink: 0 }}></span>}
                {d.label}
                {on && <span style={{ position: 'absolute', left: '50%', bottom: -0.5, width: 26, marginLeft: -13, height: 2.5, borderRadius: 99, background: accent }}></span>}
              </button>
            );
          })}
        </div>
        <div className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10, paddingBottom: 2 }}>
          {D.groups.map((g, gi) => {
            const on = sel[D.id] === gi;
            return (
              <button key={g.label + gi} onClick={() => setSel((s) => ({ ...s, [D.id]: on ? null : gi }))} aria-pressed={on} title={g.axis || ''} style={{
                border: on ? 'none' : '0.5px solid ' + (g.mine ? 'color-mix(in oklch, ' + accent + ' 58%, transparent)' : 'var(--rule)'),
                background: on ? accent : 'var(--surface-2)',
                color: on ? 'var(--surface)' : g.mine ? 'var(--ink)' : 'var(--ink-2)',
                fontFamily: 'var(--sans)', fontWeight: on ? 800 : g.mine ? 750 : 600, fontSize: 12.5,
                padding: '6px 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: on ? '0 1px 5px color-mix(in oklch, ' + accent + ' 34%, transparent)' : 'none',
                transition: 'background 160ms, color 160ms',
              }}>
                {g.mine && !on && <span style={{ width: 4.5, height: 4.5, borderRadius: 999, background: accent, flexShrink: 0 }}></span>}
                {g.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const SXCaret = ({ open }) => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms var(--ease-out, ease)' }}>
      <path d="M1 1l4 4 4-4" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round"></path>
    </svg>
  );

  function SegmentExplorer() {
    const [sel, setSel] = useState({});
    const [selB, setSelB] = useState(null); // null = single-slice mode
    const [editing, setEditing] = useState('a');
    const [open, setOpen] = useState(true); // picker expanded? open by default — the filters ARE the tool
    const votes = useMemo(sxVotes, []);
    const sig = sxSig();   // test results are mutable — re-derive when they move
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    const rows = useMemo(() => sxRows(sel), [JSON.stringify(sel), sig]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` is read inside sxRows via the module-level dim cache it invalidates, not in this callback
    const baseRows = useMemo(() => sxRows({}), [sig]);
    const baseByQ = useMemo(() => { const m = {}; baseRows.forEach((r) => { m[r.q.id] = r; }); return m; }, [baseRows]);
    const duo = selB != null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    const rowsB = useMemo(() => duo ? sxRows(selB) : null, [duo && JSON.stringify(selB), sig]);
    const nameA = sxName(sel, 'Everyone'), nameB = duo ? sxName(selB, 'Everyone') : null;
    const hasSel = sxCount(sel) > 0;
    // Slice name — plain type when it's Everyone, an accent pill once picked.
    const nameChip = (name, picked, accent, on) => ({
      border: 'none', WebkitAppearance: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
      fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', minWidth: 0,
      padding: picked ? '4px 12px' : '4px 0', borderRadius: 999,
      background: picked ? (on ? accent : 'color-mix(in oklch, ' + accent + ' 14%, transparent)') : 'transparent',
      color: picked ? (on ? 'var(--surface-2)' : 'var(--ink)') : (on ? 'var(--ink)' : 'var(--ink-3)'),
      opacity: on ? 1 : 0.75,
    });
    const kick = { fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', letterSpacing: '0.075em', textTransform: 'uppercase' };
    const group = { display: 'flex', flexDirection: 'column', gap: 20 };
    // Section = a hairline the group hangs from + its name. No trailing rule:
    // the label and the whitespace above it are enough of a break.
    const sect = (label, first, right) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: first ? 24 : 30, paddingTop: first ? 0 : 20, borderTop: first ? 'none' : '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', marginBottom: 12 }}>
        <span style={kick}>{label}</span>
        <span style={{ flex: 1 }}></span>
        {right}
      </div>
    );
    let body;
    if (!duo) {
      // Lead with difference from Everyone when a slice is picked.
      const byDiff = rows.map((r) => ({ ...r, diff: baseByQ[r.q.id] ? r.topShare - baseByQ[r.q.id].shares[r.top] : 0 }));
      const unlike = hasSel ? byDiff.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3) : [];
      const unlikeIds = new Set(unlike.map((r) => r.q.id));
      const agree = rows.filter((r) => !unlikeIds.has(r.q.id)).sort((a, b) => b.topShare - a.topShare).slice(0, hasSel ? 3 : 4);
      const split = rows.filter((r) => !unlikeIds.has(r.q.id)).sort((a, b) => a.topShare - b.topShare).slice(0, 3);
      // read-once key, parked on the first section header that actually has rings
      let keyLeft = [...unlike, ...agree].some((r) => votes[r.q.id] != null && votes[r.q.id] !== r.top);
      const ringKey = () => {
        if (!keyLeft) return null;
        keyLeft = false;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {sxRing()}
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: 'var(--ink-3)' }}>you differ</span>
          </span>
        );
      };
      const bar = (r, i, showBase) => (
        <SXBar key={r.q.id} q={r.q} shares={r.shares} top={r.top} big={i === 0}
          base={showBase ? baseByQ[r.q.id] && baseByQ[r.q.id].shares[r.top] : null} vote={votes[r.q.id]}></SXBar>
      );
      body = (<>
        {hasSel && sect('Most unlike everyone', true, ringKey())}
        {hasSel && <div style={group}>{unlike.map((r, i) => bar(r, i, true))}</div>}
        {sect('Agree most on', !hasSel, ringKey())}
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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 22 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800, letterSpacing: '-0.015em', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }}></span>
            <span style={{ color: 'var(--accent-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</span>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>vs</span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: SX_B, flexShrink: 0 }}></span>
            <span style={{ color: SX_B, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</span>
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{overlap}% overlap</span>
        </div>
        <div style={{ position: 'relative', height: 5, borderRadius: 999, background: sxWash('var(--accent)'), overflow: 'hidden', marginTop: 8 }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: overlap + '%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), ' + SX_B + ')' }}></div>
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
    const tapName = (which) => {
      if (duo && editing !== which) { setEditing(which); setOpen(true); return; }
      setOpen(!open);
    };
    return (
      <div>
        <TabSection title="Explore" sub={duo ? 'two slices of the world — where they meet, where they part' : 'pick a slice — see what it believes'} />
        {/* the control is ONE LINE until tapped — in the default state the
            findings, not the picker, own the top of the screen */}
        <div style={{ marginTop: -4, paddingBottom: 13, borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 20%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <button onClick={() => tapName('a')} style={nameChip(nameA, hasSel, 'var(--accent)', !duo || editing === 'a')}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</span>
            </button>
            {duo && <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', flexShrink: 0 }}>vs</span>}
            {duo && (
              <button onClick={() => tapName('b')} style={nameChip(nameB, sxCount(selB) > 0, SX_B, editing === 'b')}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</span>
              </button>
            )}
            <button onClick={() => setOpen(!open)} aria-label="change slice" style={{ border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '6px 2px', display: 'inline-flex', flexShrink: 0 }}>
              <SXCaret open={open}></SXCaret>
            </button>
            <span style={{ flex: 1 }}></span>
            <button onClick={() => { if (duo) { setSelB(null); setEditing('a'); } else { setSelB({}); setEditing('b'); setOpen(true); } }} style={{
              border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '4px 0 4px 12px', flexShrink: 0,
              fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: duo ? 'var(--ink-3)' : 'var(--accent-ink)',
            }}>{duo ? 'done' : 'compare'}</button>
          </div>
          {/* the meter and the slice actions sit UNDER the name — on one line the
              16-dot meter ate more width than the name it was describing */}
          {(sxCount(editSel) > 0 || sxHasMine()) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, minWidth: 0 }}>
              {sxCount(editSel) > 0 && <SXSizeDots share={sxShare(editSel)} accent={editAccent}></SXSizeDots>}
              <span style={{ flex: 1 }}></span>
              {sxCount(editSel) > 0 ? (
                <button onClick={() => ((!duo || editing === 'a') ? setSel : setSelB)({})} style={{ border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '2px 0 2px 10px', flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>clear</button>
              ) : (
                /* your own results, as a slice — the poles you sit furthest out on */
                <button onClick={() => { ((!duo || editing === 'a') ? setSel : setSelB)(sxLikeMe()); setOpen(true); }} style={{ border: 'none', background: 'none', WebkitAppearance: 'none', cursor: 'pointer', padding: '2px 0 2px 10px', flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: editAccent }}>like me</button>
              )}
            </div>
          )}
          {open && (
            <div style={{ marginTop: 12 }}>
              <SXChips key={duo ? editing : 'a'} sel={editSel} setSel={(!duo || editing === 'a') ? setSel : setSelB} accent={editAccent}></SXChips>
            </div>
          )}
        </div>
        {body}
      </div>
    );
  }

  Object.assign(window, { SegmentExplorer });
})();
