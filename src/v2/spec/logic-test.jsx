// Ported from design/spec-modules/logic-test.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { useDialog } from './primitives.jsx';
import { generateForm } from '../data/logic-gen';
import { FIELD_MED, loadResult, logicPctile, logicSecs, saveResult } from '../data/logic-score';

// ─────────────────────────────────────────────────────────────
// Logic · Raven's-matrices-style test, run as a full overlay
// (like the other tests). Twelve 3×3 matrices on a difficulty
// ramp, GENERATED fresh per attempt by src/v2/data/logic-gen.ts
// (a direct import since D53 — this file was the global's only
// consumer) from a random seed — the bank of hardcoded puzzles
// (and its answer key in the bundle) is gone, and since D54 the
// family sequence is drawn per attempt too, so no two attempts
// are the same and there is nothing to memorize, not even the
// order of rules. Each puzzle is timed (D54): the cap
// standardises the administration and bounds what a mid-item
// consult can buy. No per-question feedback — score + percentile
// at the end, persisted via data/logic-score.ts, where the curve
// is typed and pinned. The General tab shows it as a fifth ring
// in "Your tests".
// ─────────────────────────────────────────────────────────────
(function () {
  const { useState, useRef, useEffect } = React;

  // How long the picked-answer state shows before advancing.
  const PICK_DELAY = 240;
  // Per-puzzle time budget (D54). Matrix tests are administered timed; a
  // cap also bounds a stalled or wandering attempt. 90s is >5× the
  // modelled median (FIELD_MED), so a careful solver is never rushed — an
  // expired puzzle settles as unanswered. The countdown surfaces only in
  // the final 20s: it should read as a bound, not a stopwatch.
  const ITEM_CAP = 90000;
  const COUNTDOWN_AT = 20000;

  // ── glyph model ──
  // A cell is an array of layers. Layer: {s: shape, z: size, f: 'n'|'s'}
  // Shapes: 'c' circle · 'q' square · 'd' diamond · 't' triangle · '.' dots{n}
  // Cells come from the generator; the renderers below draw whatever its
  // vocabulary produces (logic-gen's renderability test pins the match).
  const rad = (z) => 2.5 + 6.5 * z;

  const DOTS = {
    1: [[36, 36]],
    2: [[26, 46], [46, 26]],
    3: [[24, 48], [36, 36], [48, 24]],
    4: [[26, 26], [46, 26], [26, 46], [46, 46]],
    5: [[24, 24], [48, 24], [36, 36], [24, 48], [48, 48]],
    6: [[26, 22], [26, 36], [26, 50], [46, 22], [46, 36], [46, 50]],
  };

  function Prim({ s, z, f, n }) {
    const ink = 'var(--ink-2)';
    const fill = f === 's' ? ink : 'none';
    const R = rad(z || 3);
    if (s === '.') {
      return <g>{(DOTS[n] || []).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill={ink} />)}</g>;
    }
    if (s === 'c') return <circle cx="36" cy="36" r={R} fill={fill} stroke={ink} strokeWidth="2" />;
    if (s === 'q') { const h = R * 0.85; return <rect x={36 - h} y={36 - h} width={2 * h} height={2 * h} fill={fill} stroke={ink} strokeWidth="2" />; }
    if (s === 'd') return <polygon points={`36,${36 - R} ${36 + R},36 36,${36 + R} ${36 - R},36`} fill={fill} stroke={ink} strokeWidth="2" strokeLinejoin="round" />;
    if (s === 't') return <polygon points={`36,${36 - R} ${36 + R * 0.87},${36 + R * 0.5} ${36 - R * 0.87},${36 + R * 0.5}`} fill={fill} stroke={ink} strokeWidth="2" strokeLinejoin="round" />;
    return null;
  }

  function Glyph({ cell }) {
    return (
      <svg viewBox="0 0 72 72" style={{ width: '100%', height: '100%', display: 'block' }}>
        {cell.map((l, i) => <Prim key={i} {...l} />)}
      </svg>
    );
  }

  // ── per-attempt form ──
  // The twelve matrices come from the generator, seeded fresh at every
  // start. The seed is saved with the result so a future lens (or a bug
  // report) can reconstruct exactly the form a score was earned on —
  // the generator version travels with it so a generator change can never
  // silently reinterpret an old seed.
  const newSeed = () => {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (c && c.getRandomValues) {
      const u = new Uint32Array(1);
      c.getRandomValues(u);
      return u[0] >>> 0;
    }
    // Seed quality is irrelevant (this is variety, not security) — but
    // crypto is the one source that cannot produce the same form for two
    // players who opened the overlay in the same millisecond.
    return Math.floor(Math.random() * 4294967296) >>> 0;
  };
  const makeForm = () => generateForm(newSeed());

  // ── tiles ──
  const tileBase = {
    aspectRatio: '1', borderRadius: 10, boxSizing: 'border-box',
    background: 'var(--surface)', border: '1px solid var(--rule)', padding: 6,
  };

  function Matrix({ cells }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, width: '100%', maxWidth: 258, margin: '0 auto' }}>
        {cells.map((c, i) => <div key={i} style={tileBase}><Glyph cell={c} /></div>)}
        <div style={{
          ...tileBase, background: 'transparent', border: '1.5px solid color-mix(in oklch, var(--rule), var(--ink) 14%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 600, color: 'var(--ink-3)',
        }}>?</div>
      </div>
    );
  }

  function pillBtn(primary) {
    return {
      cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
      padding: '10px 22px', borderRadius: 999,
      border: '1px solid ' + (primary ? 'var(--ink)' : 'var(--rule)'),
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--surface)' : 'var(--ink-2)',
      fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, letterSpacing: '0.01em',
    };
  }

  // ── the overlay ──
  const LOGIC_COL = 'var(--c-likeness)';

  // ── Answers lens: per puzzle, how each scoring range did — four bars, lower → top
  //    scorers; solve-rates derived from the difficulty ramp. Your dot at right. ──
  const BAND_ABILITY = [0.3, 0.52, 0.74, 0.95];
  // Ramp position is 0..1 along the saved per-item difficulties (v2
  // results); a v1 result carried none, so its index stands in — the old
  // bank WAS index-ordered. Both fixes here were latent bugs: the divisor
  // used to be a hardcoded /11, and the rows mapped over the puzzle bank
  // instead of the saved marks, so a result of any other length would have
  // rendered against the wrong items.
  const solveRate = (pos, a) => Math.max(0.05, Math.min(0.97, a * 0.85 + 0.35 - pos * 0.75));
  function QBands({ marks, diffs }) {
    const BH = 16;
    const n = marks.length;
    const pos = (i) => {
      if (Array.isArray(diffs) && diffs.length === n) {
        const lo = Math.min(...diffs), hi = Math.max(...diffs);
        return hi > lo ? (diffs[i] - lo) / (hi - lo) : 0.5;
      }
      return n > 1 ? i / (n - 1) : 0.5;
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 2 }}>
          <span>solved by: lower → top scorers</span><span>● = you</span>
        </div>
        {marks.map((_, qi) => (
          <div key={qi} style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', width: 26, flexShrink: 0 }}>{qi + 1}</span>
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: BH }}>
              {BAND_ABILITY.map((a, bi) => (
                <span key={bi} style={{ width: 9, height: Math.max(2, Math.round(solveRate(pos(qi), a) * BH)), borderRadius: 2, background: LOGIC_COL, opacity: 0.3 + bi * 0.22 }}></span>
              ))}
            </span>
            <span style={{ flex: 1 }}></span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box', marginBottom: 3, background: marks[qi] ? LOGIC_COL : 'transparent', border: '1.5px solid ' + (marks[qi] ? 'transparent' : 'var(--ink-3)'), opacity: marks[qi] ? 1 : 0.5 }}></span>
          </div>
        ))}
      </div>
    );
  }

  // ── Field lens: everyone who played, as one curve — just you against the field ──
  function FieldCurve({ pctile }) {
    const W = 300, H = 128, base = 100;
    const yOf = (x) => base - 74 * Math.exp(-Math.pow(x - 52, 2) / (2 * 20 * 20));
    let dArea = `M 0 ${base}`;
    for (let x = 0; x <= 100; x += 2) dArea += ` L ${(x / 100) * W} ${yOf(x).toFixed(1)}`;
    dArea += ` L ${W} ${base} Z`;
    const px = (pctile / 100) * W, py = yOf(pctile);
    return (
      <div style={{ width: '100%' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
          <path d={dArea} fill="var(--surface-3)" opacity="0.8"></path>
          <path d={dArea.replace(/ Z$/, '')} fill="none" stroke="var(--ink-3)" strokeWidth="1" opacity="0.5"></path>
          <line x1="0" y1={base} x2={W} y2={base} stroke="var(--rule)" strokeWidth="1"></line>
          <line x1={px} y1={py - 4} x2={px} y2={base} stroke={LOGIC_COL} strokeWidth="1.5"></line>
          <circle cx={px} cy={py - 4} r="4.5" fill={LOGIC_COL}></circle>
          <text x={Math.min(px, W - 22)} y={py - 14} textAnchor="middle" fontFamily="var(--sans)" fontSize="11" fontWeight="700" fill="var(--ink)">you</text>
        </svg>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.45 }}>Everyone who played, as one field — no one else is ever singled out.</div>
      </div>
    );
  }

  // ── Compare lens: large populations only — nothing traceable to a person ──
  function CompareRows({ pctile }) {
    const rows = [
      { label: 'You', v: pctile, solid: true },
      { label: 'Your city', v: 57 },
      { label: 'Your country', v: 53 },
      { label: 'The world', v: 50 },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15, width: '100%' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: r.solid ? 'var(--ink)' : 'var(--ink-3)', width: 78, flexShrink: 0 }}>{r.label}</span>
            <span style={{ position: 'relative', flex: 1, height: 14 }}>
              <span style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 2, borderRadius: 2, background: 'var(--surface-3)' }}></span>
              <span style={{ position: 'absolute', top: 1, left: `calc(${r.v}% - 6px)`, width: 12, height: 12, borderRadius: '50%', boxSizing: 'border-box', background: r.solid ? LOGIC_COL : 'var(--surface)', border: r.solid ? 'none' : '2px solid var(--ink-3)' }}></span>
            </span>
          </div>
        ))}
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>Large populations only — no circle, no named compares.</div>
      </div>
    );
  }

  // ── Ceiling lens: the puzzles as a ramp from easy to hard, with your
  //    solves on it. Where the filled dots stop is your ceiling — readable
  //    in one glance, no numerals. ──
  const fieldRate = (i, n) => 0.94 - 0.74 * (i / Math.max(1, n - 1));
  function RampDots({ marks }) {
    const n = marks.length, W = 300, H = 118, top = 16, base = 92;
    const xOf = (i) => 18 + (i / Math.max(1, n - 1)) * (W - 36);
    const yOf = (i) => base - fieldRate(i, n) * (base - top);
    let d = `M ${xOf(0)} ${base}`;
    for (let i = 0; i < n; i++) d += ` L ${xOf(i).toFixed(1)} ${yOf(i).toFixed(1)}`;
    d += ` L ${xOf(n - 1)} ${base} Z`;
    let last = -1; marks.forEach((m, i) => { if (m) last = i; });
    return (
      <div style={{ width: '100%' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
          <path d={d} fill="var(--surface-3)" opacity="0.9"></path>
          <line x1="0" y1={base} x2={W} y2={base} stroke="var(--rule)" strokeWidth="1"></line>
          {last >= 0 && <line x1={xOf(last)} y1={yOf(last)} x2={xOf(last)} y2={base} stroke={LOGIC_COL} strokeWidth="1.5" opacity="0.55"></line>}
          {marks.map((m, i) => (
            <circle key={i} cx={xOf(i)} cy={yOf(i)} r={m ? 5 : 4}
              fill={m ? LOGIC_COL : 'var(--surface)'} stroke={m ? 'none' : 'var(--ink-3)'} strokeWidth="1.5" opacity={m ? 1 : 0.5}></circle>
          ))}
          <text x="18" y={H - 2} fontFamily="var(--sans)" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">easy</text>
          <text x={W - 18} y={H - 2} textAnchor="end" fontFamily="var(--sans)" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">hard</text>
        </svg>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.45 }}>Filled = you solved it. The band is the expected difficulty curve.</div>
      </div>
    );
  }

  // ── Pace lens: speed against accuracy. The percentile alone cannot tell
  //    you whether you got there quickly or by grinding, which is the one
  //    thing this adds. ──
  const seeded = (s) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
  function PacePlot({ pctile, secs }) {
    const W = 300, H = 172, PL = 16, PR = 14, PT = 14, PB = 26;
    const xp = (v) => PL + v * (W - PL - PR);
    const yp = (v) => (H - PB) - v * (H - PB - PT);
    const xv = Math.max(0.05, Math.min(0.95, secs / (FIELD_MED * 2)));
    const yv = Math.max(0.05, Math.min(0.95, pctile / 100));
    // The scatter behind you is drawn from a fixed seed, not from other
    // players — see the note under LOGIC_LENSES. It is a backdrop that
    // gives the axes a sense of scale, and it is deterministic so it does
    // not shimmer between renders as if it were live.
    const cloud = [];
    for (let i = 0; i < 46; i++) {
      const a = (seeded(i + 1) + seeded(i + 40) + seeded(i + 90)) / 3;
      const b = (seeded(i + 160) + seeded(i + 211)) / 2;
      const cx = Math.max(0.06, Math.min(0.94, 0.16 + a * 0.72));
      const cy = Math.max(0.06, Math.min(0.94, 0.8 - cx * 0.5 + (b - 0.5) * 0.4));
      cloud.push([cx, cy]);
    }
    const read = (xv < 0.5 ? 'Quick' : 'Deliberate') + ' and ' + (yv >= 0.5 ? 'accurate' : 'still building') + '.';
    return (
      <div style={{ width: '100%' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
          <line x1={xp(0.5)} y1={PT} x2={xp(0.5)} y2={H - PB} stroke="var(--rule)" strokeWidth="1" strokeDasharray="3 4"></line>
          <line x1={PL} y1={yp(0.5)} x2={W - PR} y2={yp(0.5)} stroke="var(--rule)" strokeWidth="1" strokeDasharray="3 4"></line>
          {cloud.map(([cx, cy], i) => <circle key={i} cx={xp(cx)} cy={yp(cy)} r="3" fill="var(--ink-3)" opacity="0.22"></circle>)}
          <circle cx={xp(xv)} cy={yp(yv)} r="10" fill={LOGIC_COL} opacity="0.15"></circle>
          <circle cx={xp(xv)} cy={yp(yv)} r="5" fill={LOGIC_COL}></circle>
          <text x={PL} y={H - 6} fontFamily="var(--sans)" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">faster</text>
          <text x={W - PR} y={H - 6} textAnchor="end" fontFamily="var(--sans)" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">slower</text>
          <text x={PL} y={PT - 3} fontFamily="var(--sans)" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">more solved</text>
        </svg>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 10 }}>{read}</div>
      </div>
    );
  }

  // EVERY "field" in this test is a MODEL, not a measurement: logicPctile is
  // a logistic curve, solveRate and fieldRate are formulas, FieldCurve is a
  // Gaussian, and PacePlot's scatter comes from a fixed seed. No other
  // player's result is read, stored or aggregated anywhere — there is no
  // backend for this test at all.
  //
  // That is defensible for a self-test (the comparison is a yardstick, not a
  // population statistic) but it was previously unsaid, and this file now
  // draws five of them. The result screen says so once, in LOGIC_FIELD_NOTE,
  // rather than letting five charts imply five measurements. The curve and
  // the persistence live in data/logic-score.ts, typed and pinned.

  const LOGIC_FIELD_NOTE = 'Comparisons here are a modelled yardstick, not other players’ results — this test sends nothing anywhere.';

  const LOGIC_LENSES = [
    { id: 'answers', label: 'Answers' },
    { id: 'ceiling', label: 'Ceiling' },
    { id: 'pace', label: 'Pace' },
    { id: 'field', label: 'Field' },
    { id: 'compare', label: 'Compare' },
  ];
  function LogicOverlay({ onClose }) {
    const dlg = useDialog(onClose, 'Logic test');
    const [result, setResult] = useState(loadResult);
    // The attempt's generated form. Created on open when there is no saved
    // result (the overlay starts straight in the test), and on every
    // Retake. The generator is a direct import (D53), so "module missing"
    // is a build failure now, not a render-time one.
    const [form, setForm] = useState(() => (result ? null : makeForm()));
    const [qi, setQi] = useState(result ? -1 : 0); // -1 = result screen
    const [marks, setMarks] = useState([]);
    const [picked, setPicked] = useState(null);
    const [lens, setLens] = useState('answers');
    // How long each puzzle took, in ms. Local to the run and saved beside
    // the marks; the Pace lens is the only reader. Nothing leaves the
    // device — this test has no backend.
    const [times, setTimes] = useState([]);
    // Seconds left on the current puzzle, rendered only inside the final
    // stretch (null = hidden). Driven by the interval below.
    const [countdown, setCountdown] = useState(null);
    // Stamped in an effect rather than during render: Date.now() in a render
    // body is impure and eslint's react-hooks/purity rule rightly refuses it.
    // Keyed on qi, so it re-arms as each puzzle appears — including the first,
    // which start() never sees when the overlay opens straight into the test.
    const askedAt = useRef(0);
    // The expiry path needs the CURRENT marks/times/qi, not the ones from
    // the render that armed the interval — the latest-closure ref pattern.
    const timeUpRef = useRef(() => {});
    useEffect(() => {
      timeUpRef.current = () => {
        if (picked !== null || qi < 0) return;
        setPicked(-1); // no option highlighted — the clock ran out
        settle(false);
      };
    });
    useEffect(() => {
      if (qi < 0) { setCountdown(null); return undefined; }
      askedAt.current = Date.now();
      setCountdown(null);
      // Deadline arithmetic, not tick counting: a backgrounded tab throttles
      // intervals, but the next tick after return still lands on the truth —
      // which also stops backgrounding from buying unbounded think time
      // (the D53 accepted limit on Pace-lens timing, now capped).
      const id = setInterval(() => {
        const left = askedAt.current + ITEM_CAP - Date.now();
        if (left <= 0) timeUpRef.current();
        else setCountdown(left <= COUNTDOWN_AT ? Math.ceil(left / 1000) : null);
      }, 500);
      return () => clearInterval(id);
    }, [qi]);

    const start = () => { setForm(makeForm()); setMarks([]); setTimes([]); setPicked(null); setQi(0); };
    // Shared by a pick and an expiry: records the mark, then advances (or
    // saves) after the reveal delay.
    const settle = (ok) => {
      const next = [...marks, ok];
      // Deliberately never cancelled on unmount (D53): this timeout is also
      // the final item's save, so closing the overlay 200ms after the last
      // pick must still keep the score. Mid-test, the late callback's
      // setState is a no-op on an unmounted component — a 240ms timer is
      // the whole cost, and losing a finished attempt would be the bug.
      setTimeout(() => {
        // Read the clock here, not in the caller's body — same purity rule.
        // The reveal delay is subtracted because it is the animation's time,
        // not the solver's; left in, every puzzle would read 0.24s slow. The
        // cap bounds what an expired (or backgrounded) puzzle records.
        const nt = [...times, askedAt.current ? Math.min(ITEM_CAP, Math.max(0, Date.now() - askedAt.current - PICK_DELAY)) : FIELD_MED * 1000];
        setPicked(null);
        if (qi + 1 < form.items.length) { setMarks(next); setTimes(nt); setQi(qi + 1); }
        else {
          const k = next.filter(Boolean).length;
          const r = {
            v: 2, seed: form.seed, gv: form.version,
            marks: next, times: nt, diffs: form.items.map((it) => it.diff),
            pctile: logicPctile(k / next.length), when: Date.now(),
          };
          saveResult(r); setResult(r); setMarks([]); setTimes([]); setQi(-1);
        }
      }, PICK_DELAY);
    };
    const pick = (i) => {
      if (picked !== null) return;
      setPicked(i);
      settle(i === form.items[qi].a);
    };

    const inTest = qi >= 0;
    const p = inTest ? form.items[qi] : null;
    const k = result ? result.marks.filter(Boolean).length : 0;

    return (
      <div className="overlay surface-tint" {...dlg}>
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>✕</button>
          <div className="h-title">Logic</div>
          <div style={{ width: 32, flexShrink: 0 }}></div>
        </div>
        <div className="app-body">
          {inTest && (
            <div style={{ maxWidth: 258, margin: '10px auto 0' }}>
              {/* the countdown sits in the bar's margin (absolute), so its
                  late appearance never shifts the puzzle mid-solve */}
              <div style={{ position: 'relative', display: 'flex', gap: 4, marginBottom: 18 }}>
                {form.items.map((_, i) => (
                  <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < qi ? 'var(--ink)' : i === qi ? LOGIC_COL : 'var(--rule)', transition: 'background 0.2s ease' }}></span>
                ))}
                {countdown != null && (
                  <span role="timer" aria-label={countdown + ' seconds left on this puzzle'} style={{ position: 'absolute', right: 0, top: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: countdown <= 5 ? LOGIC_COL : 'var(--ink-3)' }}>{countdown}s</span>
                )}
              </div>
              <div role="img" aria-label="3 by 3 puzzle grid, bottom-right tile missing">
                <Matrix cells={p.cells} />
              </div>
              <div style={{ height: 1, background: 'var(--rule)', margin: '18px 0 16px' }}></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {p.opts.map((o, i) => (
                  <button key={i} onClick={() => pick(i)} aria-label={'Answer ' + (i + 1) + ' of ' + p.opts.length} style={{
                    ...tileBase, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
                    borderColor: picked === i ? LOGIC_COL : 'var(--rule)',
                    boxShadow: picked === i ? `0 0 0 3px color-mix(in oklch, ${LOGIC_COL} 18%, transparent)` : 'none',
                    transition: 'border-color 0.14s ease, box-shadow 0.14s ease',
                  }}><Glyph cell={o} /></button>
                ))}
              </div>
            </div>
          )}
          {!inTest && result && (
            <div style={{ maxWidth: 340, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 22, paddingBottom: 30 }}>
              {(() => { const R = 48, C = 2 * Math.PI * R; return (
                <svg width="128" height="128" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="9"></circle>
                  <circle cx="64" cy="64" r={R} fill="none" stroke={LOGIC_COL} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(result.pctile / 100) * C} ${C}`} transform="rotate(-90 64 64)"></circle>
                  <text x="64" y="60" textAnchor="middle" fontFamily="var(--sans)" fontSize="22" fontWeight="800" fill="var(--ink)" letterSpacing="-0.02em">{'top ' + (100 - result.pctile) + '%'}</text>
                  <text x="64" y="79" textAnchor="middle" fontFamily="var(--sans)" fontSize="11.5" fontWeight="600" fill="var(--ink-3)">{k + ' of ' + result.marks.length}</text>
                </svg>
              ); })()}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 240, lineHeight: 1.45 }}>
                Sharper than {result.pctile}% of players.
              </div>
              <div data-lens-style="underline" style={{ width: '100%', marginTop: 4 }}>
                <div className="mm-lensrow" role="tablist" aria-label="Logic lenses" style={{ '--n': LOGIC_LENSES.length }}>
                  <span className="mm-lensthumb" style={{ transform: `translateX(${LOGIC_LENSES.findIndex((l) => l.id === lens) * 100}%)` }} aria-hidden="true"></span>
                  {LOGIC_LENSES.map((l) => (
                    <button key={l.id} data-lens={l.id} role="tab" aria-selected={lens === l.id}
                      className={'mm-lensbtn' + (lens === l.id ? ' is-on' : '')}
                      onClick={() => setLens(l.id)}>{l.label}</button>
                  ))}
                </div>
                <div style={{ padding: '18px 16px 16px', marginTop: 2, background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 12 }}>
                  {lens === 'answers' && <QBands marks={result.marks} diffs={result.diffs} />}
                  {lens === 'ceiling' && <RampDots marks={result.marks} />}
                  {/* a result saved before timing was recorded has no
                      `times`; fall back to the modelled median rather than
                      plotting a zero and calling it "instant" */}
                  {lens === 'pace' && <PacePlot pctile={result.pctile} secs={logicSecs(result)} />}
                  {lens === 'field' && <FieldCurve pctile={result.pctile} />}
                  {lens === 'compare' && <CompareRows pctile={result.pctile} />}
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.45, borderTop: '0.5px solid var(--rule)', paddingTop: 10 }}>{LOGIC_FIELD_NOTE}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={start} style={pillBtn(false)}>Retake</button>
                <button onClick={onClose} style={pillBtn(true)}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.LogicOverlay = LogicOverlay;
  window.LOGIC = { load: loadResult, color: LOGIC_COL };
})();

