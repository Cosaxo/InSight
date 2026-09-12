// Ported from design/spec-modules/logic-test.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { useDialog } from './primitives.jsx';
import { FIELD_MED, loadResult, logicSecs, saveResult } from '../data/logic-score';
import { startPractice, submitPractice, startVerified, submitVerified, nextPractice, nextVerified, isScore, verifyErrorMessage } from '../data/logic-verify';
import { SHAPES, PALETTE_ORDER, STROKE, FAMILIES, familyOf, bitsOf, cellOf, ELEMENTS } from '../data/omib-shapes';
import { HAPTIC } from './haptics.js';

// ─────────────────────────────────────────────────────────────
// Logic · matrix reasoning on the Open Matrices Item Bank (D471,
// D473), run as a full overlay like the other tests. Twenty-five
// 3×3 matrices, each a form the SERVER draws from a seed — a
// stratified sample of a published, calibrated bank — and each
// answered by BUILDING the missing cell out of twenty shapes rather
// than picking one of six tiles (design/logic-build-cell-2026-09-12/,
// visual request 14). The device never holds an answer: both modes
// send the constructed cells to the server, which scores them by
// ability θ against the bank's calibration (functions/src/irt.ts)
// and returns the percentile. Practice differs from Verified only in
// what COUNTS — practice is scored and forgotten, verified is scored
// and folded into the norms once (D57, D472). Each puzzle is timed
// (D56); the clock standardises the administration and is the one
// the bank itself ships. No per-question feedback — score + percentile
// at the end, persisted via data/logic-score.ts. The General tab shows
// it as a fifth ring in "Your tests".
// ─────────────────────────────────────────────────────────────
// The saved-result reader profile-general imports (D354's sweep);
// assigned inside the IIFE below. LogicOverlay stays published: app-shell
// mounts it by name after awaiting loadOverlays().
export let LOGIC;
(function () {
  const { useState, useRef, useEffect } = React;

  // How long the committed state shows before the next item is in place —
  // the design's "half a second later item 4 is in its place".
  const COMMIT_DELAY = 520;
  // Per-puzzle time budget (D56): 90s is what the bank's own reference
  // administers (docs/OMIB-PLAN.md §1), and the server enforces the total.
  // The segment for the current item drains over it; the numeral surfaces
  // only in the final 20s, so it reads as a bound rather than a stopwatch.
  const ITEM_CAP = 90000;
  const COUNTDOWN_AT = 20000;
  const TICK = 250;
  const EMPTY = cellOf([]);

  const LOGIC_COL = 'var(--c-likeness)';

  // ── the twenty shapes, and a cell ──
  // A cell is a 20-bit string, element 0 first (the bank's convention);
  // omib-shapes.ts holds the path for each bit, derived from the bank's own
  // geometry so what a solver sees here is what 2,572 people were
  // calibrated on. Ink is the cell's own: the accent while a cell is being
  // built, plain ink once it is committed or was given.
  function Cell({ bits, ink }) {
    return (
      <svg viewBox="0 0 72 72" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        {bits.map((id) => {
          const s = SHAPES[id];
          const fill = s.k === 'fill' ? ink : 'none';
          const stroke = s.k === 'fill' ? 'none' : ink;
          const sw = s.k === 'line' ? STROKE.line : STROKE.stroke;
          return <path key={id} d={s.d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </svg>
    );
  }
  const MEMBER = {
    corner: ['top-left', 'bottom-left', 'bottom-right', 'top-right'],
    line: ['upper-left', 'lower-left', 'lower-right', 'upper-right'],
    box: ['top', 'left', 'bottom', 'right'],
    centre: ['filled square', 'outlined square', 'filled circle', 'outlined circle'],
    arrow: ['up', 'left', 'down', 'right'],
  };
  const shapeName = (id) => {
    const fam = familyOf(id);
    return fam === 'centre' ? MEMBER.centre[id % 4] : fam + ' ' + MEMBER[fam][id % 4];
  };

  // ── the board ──
  // The puzzle reads as ONE object — a recessed board — with the goal cell
  // wearing the test's accent so the eye lands on what is asked. The goal
  // composes live from `goal` (the ids placed so far); `phase` decides its
  // frame: dashed while empty, solid once something is placed, plain ink
  // once committed (the design's four states).
  const tileBase = {
    aspectRatio: '1', borderRadius: 10, boxSizing: 'border-box',
    background: 'var(--surface)', border: '1px solid var(--rule)', padding: 6,
  };
  function Board({ code, goal, phase, solved }) {
    const cells = code.split(',').slice(0, 8).map(bitsOf);
    const boardCell = { ...tileBase, border: '1px solid color-mix(in oklch, var(--rule), transparent 45%)' };
    const committed = phase === 'committed' || solved;
    const goalStyle = {
      ...boardCell,
      background: committed ? 'var(--surface)' : 'transparent',
      border: committed
        ? boardCell.border
        : (goal.length ? '1.5px solid ' : '1.5px dashed ') + 'color-mix(in oklch, ' + LOGIC_COL + ' 55%, var(--rule))',
      boxShadow: !committed && goal.length ? `0 0 0 3px color-mix(in oklch, ${LOGIC_COL} 14%, transparent)` : 'none',
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease',
    };
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7,
        width: '100%', maxWidth: 258, margin: '0 auto', boxSizing: 'border-box',
        padding: 9, borderRadius: 14,
        background: 'color-mix(in oklch, var(--surface-3) 45%, var(--surface))',
      }}>
        {cells.map((c, i) => <div key={i} style={boardCell}><Cell bits={c} ink="var(--ink-2)" /></div>)}
        <div style={goalStyle}><Cell bits={goal} ink={committed ? 'var(--ink-2)' : LOGIC_COL} /></div>
      </div>
    );
  }

  // ── the palette ──
  // The alphabet the grid is written in, laid out as one: column = family,
  // row = member (PALETTE_ORDER), every tile drawn in the cell's own frame.
  // Tap to place, tap again to remove; a lit tile and the goal cell share
  // the one accent, so the link between them needs no arrow. Buttons are
  // sized by the grid (five across a 366px column is ≈ 68px), well over
  // the 44px floor check:tap-targets holds.
  function Palette({ selected, onToggle, disabled }) {
    return (
      <div role="group" aria-label="Shapes to build the missing cell from" style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
        width: '100%', maxWidth: 258, margin: '0 auto',
        opacity: disabled ? 0.45 : 1, transition: 'opacity 0.3s ease',
      }}>
        {PALETTE_ORDER.map((id) => {
          const on = selected.includes(id);
          return (
            <button key={id} type="button" onClick={() => onToggle(id)} disabled={disabled}
              aria-pressed={on} aria-label={shapeName(id)} style={{
                ...tileBase, padding: 5, cursor: disabled ? 'default' : 'pointer',
                WebkitAppearance: 'none', appearance: 'none',
                borderColor: on ? LOGIC_COL : 'var(--rule)',
                background: on ? `color-mix(in oklch, ${LOGIC_COL} 10%, var(--surface))` : 'var(--surface)',
                boxShadow: on ? `0 0 0 3px color-mix(in oklch, ${LOGIC_COL} 14%, transparent)` : 'var(--shadow-card)',
                transition: 'border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease',
              }}>
              <Cell bits={[id]} ink={on ? LOGIC_COL : 'var(--ink-2)'} />
            </button>
          );
        })}
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

  // ── the worked example (visual request 8, answered in the same artboard
  //    as 13) ── one solved matrix before item 1, so nobody spends scored
  // items learning the format. The design's own addition puzzle, not a bank
  // item — so it teaches without leaking. Shown with the answer already in
  // the goal cell; Start begins a practice attempt and no clock runs here.
  const EXAMPLE = '10000000000000000000,00000000000000100000,10000000000000100000,00000000100000000000,00000001000000000000,00000001100000000000,00100000000000000100,00000000000001000000,00100000000001000100';
  const EXAMPLE_LINE = 'Row by row, the third cell holds the first two. Tap a shape to place it; tap it again to remove it.';

  // ── Answers lens: per puzzle, how each scoring range did — four bars, lower → top
  //    scorers; solve-rates derived from the difficulty ramp. Your dot at right. ──
  const BAND_ABILITY = [0.3, 0.52, 0.74, 0.95];
  // Ramp position is 0..1 along the saved per-item difficulties — the
  // bank's published b in form order for an OMIB result, the generator's
  // family weights for a v2 one; a v1 result carried none, so its index
  // stands in — the old bank WAS index-ordered.
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
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.45 }}>Everyone who played, as one field.</div>
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
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>Large populations only.</div>
      </div>
    );
  }

  // ── Ceiling lens: the puzzles as a ramp from easy to hard, with your
  //    solves on it. Where the filled dots stop is your ceiling — readable
  //    in one glance, no numerals. An OMIB form IS ordered easy → hard by
  //    published difficulty (functions/src/omib.ts), so the ramp is real. ──
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

  // EVERY "field" chart in this test is a MODEL, not a measurement:
  // solveRate and fieldRate are formulas, FieldCurve is a Gaussian, and
  // PacePlot's scatter comes from a fixed seed. That is defensible for a
  // self-test (the comparison is a yardstick, not a population statistic),
  // and the result screen says so once rather than letting five charts
  // imply five measurements.
  //
  // The NUMBER is a different matter since D473, and the notes below say
  // what it is. Both modes are scored on the server against the bank's
  // calibration; the percentile is Φ(θ̂) — the share of the 2,572 people
  // the bank was calibrated on who sit below you — until the verified
  // histogram clears the D60 floor, after which it arrives MEASURED (source
  // "measured", ranked against the n verified first attempts counted so
  // far). A typical taker reads below that calibration sample's median,
  // which is a fact about the sample, so the sentence names it (COPY.md §3:
  // a claim, not a caption). A practice attempt sends its cells to be
  // scored and is held nowhere; a verified one is counted once and goes on
  // the profile in four broad bands. Old generator-era results (v ≤ 2)
  // keep their old notes.
  const CALIBRATION_N = 2572;
  const CALIBRATED_ON = 'the ' + CALIBRATION_N + ' people this test was calibrated on';
  const LOGIC_PRACTICE_NOTE = 'Practice: scored on the server against a calibrated bank, counted nowhere. Until enough verified players exist here, the percentile is against ' + CALIBRATED_ON + '.';
  const LOGIC_VERIFIED_NOTE = 'Verified: scored on the server, counted once. Until enough verified players exist here, the percentile is against ' + CALIBRATED_ON + '.';
  const LOGIC_MEASURED_NOTE = 'Measured: your percentile is ranked against verified players so far. The charts around it are still modelled sketches.';
  // The generator era's notes, kept for results saved under it.
  const LOGIC_FIELD_NOTE_V2 = 'Comparisons are a modelled yardstick — this practice result sent nothing anywhere.';
  const LOGIC_VERIFIED_NOTE_V2 = 'Verified: scored on the server, counted once. Comparisons stay a modelled yardstick until enough verified scores exist.';
  // WHAT VERIFIED SENDS, and it is a consent notice — a claim, not a word
  // count (COPY.md §3). It names where the score goes: `logicSubmitV2`
  // writes testResults.logic onto v2_users/{uid}, and firestore.rules
  // opens that document to every signed-in reader; web/privacy.html says
  // the same in as many words.
  const LOGIC_VERIFY_DISCLOSURE = 'Your cells are scored on the server and join an anonymous count. Your score goes on your profile, in four broad bands, where anyone signed in can read it.';
  const LOGIC_PRACTICE_DISCLOSURE = 'Practice sends your cells to the server to be scored and keeps nothing.';

  const LOGIC_LENSES = [
    { id: 'answers', label: 'Answers' },
    { id: 'ceiling', label: 'Ceiling' },
    { id: 'pace', label: 'Pace' },
    { id: 'field', label: 'Field' },
    { id: 'compare', label: 'Compare' },
  ];
  const noteFor = (r) => {
    if (r.bank !== 'omib') return r.verified ? LOGIC_VERIFIED_NOTE_V2 : LOGIC_FIELD_NOTE_V2;
    if (r.source === 'measured') return LOGIC_MEASURED_NOTE;
    return r.verified ? LOGIC_VERIFIED_NOTE : LOGIC_PRACTICE_NOTE;
  };
  const populationFor = (r) => {
    if (r.source === 'measured' && r.n) return r.n + ' verified players';
    return r.bank === 'omib' ? CALIBRATED_ON : 'players';
  };

  function LogicOverlay({ onClose }) {
    const dlg = useDialog(onClose, 'Logic test');
    const [result, setResult] = useState(loadResult);
    // What the screen shows when no attempt is running: the worked example
    // on a first open (no saved result), the result screen otherwise. The
    // example is reachable again from a row on the result screen.
    const [screen, setScreen] = useState(() => (result ? 'result' : 'example'));
    // The attempt's form, as served: { mode, items: [{code}], total, seed?,
    // practice?, verified? }. Under "stratified" `items` is the whole form;
    // under "adaptive" (D474) it is the items served SO FAR — one more
    // arrives with each answer — and `total` is the form's length.
    const [form, setForm] = useState(null);
    const [qi, setQi] = useState(-1); // -1 = no item on screen
    // The ids placed in the goal cell so far, in the order placed.
    const [goal, setGoal] = useState([]);
    // 'building' | 'committed' — the design's states; untouched/partial/
    // complete are `goal.length` under 'building'.
    const [phase, setPhase] = useState('building');
    const [lens, setLens] = useState('answers');
    // How long each puzzle took, in ms. Local to the run and saved beside
    // the marks; the Pace lens is the only reader. Device-local in BOTH
    // modes: neither attempt sends per-item timings.
    const [times, setTimes] = useState([]);
    // The constructed cell per puzzle — the payload in both modes: the
    // client cannot mark what it cannot know.
    const [picks, setPicks] = useState([]);
    // Round-trip lifecycle, one state: null, or
    // {phase:'starting', mode} | {phase:'start-error', msg}
    // | {phase:'sending'} | {phase:'send-error', msg, picks, times}
    // | {phase:'next-error', msg, picks, times} — an adaptive pick the
    //   server did not answer; Retry sends the same pick again.
    const [net, setNet] = useState(null);
    // Milliseconds left on the current puzzle (drives the draining segment
    // and, inside the final stretch, the numeral) and on the whole sitting.
    const [left, setLeft] = useState(ITEM_CAP);
    const [testLeft, setTestLeft] = useState(null);
    // Stamped in effects rather than during render: Date.now() in a render
    // body is impure and eslint's react-hooks/purity rule rightly refuses it.
    const askedAt = useRef(0);
    const startedAt = useRef(0);
    // The expiry path needs the CURRENT goal/phase/qi, not the ones from the
    // render that armed the interval — the latest-closure ref pattern.
    const timeUpRef = useRef(() => {});
    useEffect(() => {
      timeUpRef.current = () => {
        if (phase !== 'building' || qi < 0) return;
        // The clock ran out: the cell commits AS IT STANDS — a partial build
        // is the answer, an empty one is a miss. Nothing else advances on
        // its own (the design), and no haptic: it should not feel like a
        // tap you made.
        commit(true);
      };
    });
    useEffect(() => {
      if (qi < 0) { setLeft(ITEM_CAP); return undefined; }
      askedAt.current = Date.now();
      setLeft(ITEM_CAP);
      // Deadline arithmetic, not tick counting: a backgrounded tab throttles
      // intervals, but the next tick after return still lands on the truth —
      // which also stops backgrounding from buying unbounded think time.
      const id = setInterval(() => {
        const now = Date.now();
        const l = askedAt.current + ITEM_CAP - now;
        setTestLeft(Math.max(0, startedAt.current + form.total * ITEM_CAP - now));
        if (l <= 0) timeUpRef.current();
        else setLeft(l);
      }, TICK);
      return () => clearInterval(id);
    }, [qi]); // eslint-disable-line react-hooks/exhaustive-deps -- `form` is fixed for the life of an attempt; keyed on qi so it re-arms as each puzzle appears

    const arm = (f) => {
      setForm(f); setPicks([]); setTimes([]); setGoal([]); setPhase('building'); setNet(null);
      startedAt.current = Date.now();
      setTestLeft(f.total * ITEM_CAP);
      setScreen('item'); setQi(0);
    };
    // What a start says the form is. `mode` and `total` are the server's
    // since D474; the fallbacks are for the deploy window in which a new
    // client meets the old start shape, and read it as what it was.
    const served = (s) => ({ mode: s.mode || 'stratified', items: s.items, total: s.total || s.items.length });
    // ── practice round trip (D472): the server mints and holds nothing ──
    const beginPractice = () => {
      setNet({ phase: 'starting', mode: 'practice' });
      startPractice().then(
        (s) => arm({ ...served(s), seed: s.seed, practice: true }),
        (err) => setNet({ phase: 'start-error', msg: verifyErrorMessage(err) }),
      );
    };
    // ── verified round trip (D57): the server mints and keeps the seed ──
    const beginVerified = () => {
      setNet({ phase: 'starting', mode: 'verified' });
      startVerified().then(
        (s) => arm({ ...served(s), verified: true }),
        (err) => setNet({ phase: 'start-error', msg: verifyErrorMessage(err) }),
      );
    };
    // The server's marks, θ and percentile ARE the result; the local
    // per-item times ride along for the Pace lens only. seed+gv+bank come
    // back post-scoring so the result stays reconstructable (D31) — with
    // `mode` saying whether that takes the seed alone or the picks too —
    // and `diffs`, the form's published difficulties, so the Answers lens
    // can rank its rows on the real ramp.
    const scored = (f, res, nt) => {
      const r = {
        v: 3, bank: 'omib', mode: res.mode || f.mode, ...(f.verified ? { verified: true } : {}),
        seed: res.seed, gv: res.gv,
        marks: res.marks, times: nt, diffs: res.diffs,
        theta: res.theta, se: res.se,
        pctile: res.pctile,
        ...(Array.isArray(res.band) ? { band: res.band } : {}),
        source: res.source || 'model',
        ...(res.n ? { n: res.n } : {}),
        ...(res.durationMs != null ? { durationMs: res.durationMs } : {}),
        when: Date.now(),
      };
      saveResult(r); setResult(r); setNet(null); setScreen('result');
    };
    const send = (f, pk, nt) => {
      setNet({ phase: 'sending' });
      const call = f.verified ? submitVerified(pk) : submitPractice(f.seed, pk);
      call.then(
        (res) => scored(f, res, nt),
        (err) => setNet({ phase: 'send-error', msg: verifyErrorMessage(err), picks: pk, times: nt }),
      );
    };
    // ── the adaptive round trip, one per item (D474) ──
    // The pick for item `pk.length - 1` goes to the server and the next item
    // comes back — or, on the last, the result. A verified attempt sends the
    // one pick with its index; practice, holding nothing server-side, sends
    // every pick so far with its seed.
    const askNext = (f, pk) => (f.verified ? nextVerified(pk.length - 1, pk[pk.length - 1]) : nextPractice(f.seed, pk));
    const arrived = (f, res, pk, nt) => {
      setPicks(pk); setTimes(nt); setGoal([]); setNet(null);
      if (isScore(res)) { setQi(-1); setScreen('result'); scored(f, res, nt); return; }
      // the next item joins the form; the clock re-arms as it appears (the
      // effect keyed on qi), so the round trip never costs solving time
      setForm({ ...f, items: [...f.items, ...res.items] });
      setPhase('building');
      setQi(pk.length);
    };
    const retryNext = () => {
      const { picks: pk, times: nt } = net;
      setNet(null);
      askNext(form, pk).then(
        (res) => arrived(form, res, pk, nt),
        (err) => setNet({ phase: 'next-error', msg: verifyErrorMessage(err), picks: pk, times: nt }),
      );
    };

    // Done, or the clock: the goal cell as it stands becomes the pick.
    // Records the cell and the solve time, shows the committed state for
    // the reveal delay, then advances or submits.
    const commit = (expired) => {
      if (phase !== 'building') return;
      // The design's weights (VR 14): Done is the committed weight; the
      // clock's commit is silent — a buzz at zero would read as a verdict.
      if (!expired) HAPTIC.tap();
      const pick = cellOf(goal);
      // Read the clock here, in the handler, not in render (purity). The
      // cap bounds what an expired (or backgrounded) puzzle records.
      const t = expired ? ITEM_CAP : Math.min(ITEM_CAP, Math.max(0, Date.now() - askedAt.current));
      const pk = [...picks, pick];
      const nt = [...times, t];
      setPhase('committed');
      if (form.mode === 'adaptive') {
        // The pick leaves NOW, under the reveal delay, so the round trip and
        // the animation overlap: the next item is shown when both are done.
        // The committed board is the waiting state; a slow network shows
        // the landed cell a little longer, never a spinner.
        const delay = new Promise((resolve) => setTimeout(resolve, COMMIT_DELAY));
        Promise.all([askNext(form, pk), delay]).then(
          ([res]) => arrived(form, res, pk, nt),
          (err) => setNet({ phase: 'next-error', msg: verifyErrorMessage(err), picks: pk, times: nt }),
        );
        return;
      }
      // Deliberately never cancelled on unmount (D53): this timeout is also
      // the final item's submit, so closing the overlay half a second after
      // the last Done must still keep the score. Mid-test, the late
      // callback's setState is a no-op on an unmounted component.
      setTimeout(() => {
        setPicks(pk); setTimes(nt); setGoal([]); setPhase('building');
        if (qi + 1 < form.items.length) setQi(qi + 1);
        else { setQi(-1); setScreen('result'); send(form, pk, nt); }
      }, COMMIT_DELAY);
    };
    const toggle = (id) => {
      if (phase !== 'building') return;
      // Placing is the light weight; removing is silent. The module has no
      // weight softer than `tick`, so the softest thing it can say is
      // nothing — and felt-versus-not is the difference the design's
      // grading (place light, remove softer) was there to make.
      if (!goal.includes(id)) HAPTIC.tick();
      setGoal((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
    };
    const clear = () => { if (phase === 'building') setGoal([]); };

    const inTest = screen === 'item' && qi >= 0 && form;
    const item = inTest ? form.items[qi] : null;
    const k = result ? result.marks.filter(Boolean).length : 0;
    // The likely range, as a clause on the claim it qualifies (D402): the
    // person's own standard error read through the same rank as the number.
    // Omitted when the range collapses to a point — at the clamps it says
    // nothing the number did not.
    const likely = result && Array.isArray(result.band) && result.band[0] < result.band[1]
      ? ' (likely ' + result.band[0] + '–' + result.band[1] + ')'
      : '';
    const countdown = inTest && left <= COUNTDOWN_AT ? Math.ceil(left / 1000) : null;
    const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const sending = net && (net.phase === 'sending' || net.phase === 'send-error');

    return (
      <div className="overlay surface-tint" {...dlg}>
        <div className="app-header">
          <button className="avatar-btn" aria-label="Close" onClick={onClose}>✕</button>
          <div className="h-title">Logic</div>
          {/* the whole sitting's remainder — small, tabular, never bigger than a shape */}
          <div style={{ width: 48, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>
            {inTest && testLeft != null ? mmss(testLeft) : ''}
          </div>
        </div>
        <div className="app-body">
          {screen === 'example' && (
            <div style={{ maxWidth: 258, margin: '10px auto 0' }}>
              <div className="kicker" style={{ marginBottom: 14 }}>Worked example · not timed</div>
              <div role="img" aria-label="A solved 3 by 3 puzzle grid">
                <Board code={EXAMPLE} goal={bitsOf(EXAMPLE.split(',')[8])} phase="committed" solved />
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink-2)', margin: '14px 0 10px' }}>{EXAMPLE_LINE}</div>
              <Palette selected={bitsOf(EXAMPLE.split(',')[8])} onToggle={() => {}} disabled />
              <button onClick={beginPractice} disabled={net && net.phase === 'starting'} style={{ ...pillBtn(true), width: '100%', marginTop: 16, height: 52, borderRadius: 999, opacity: net && net.phase === 'starting' ? 0.6 : 1 }}>
                {net && net.phase === 'starting' ? 'Preparing…' : 'Start'}
              </button>
              {net && net.phase === 'start-error' && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.45, marginTop: 10 }}>{net.msg}</div>
              )}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5, marginTop: 10 }}>{LOGIC_PRACTICE_DISCLOSURE}</div>
              {result && (
                <button onClick={() => setScreen('result')} className="tap44" style={{ ...pillBtn(false), display: 'block', margin: '12px auto 0', padding: '6px 14px', fontSize: 12 }}>Back to your result</button>
              )}
            </div>
          )}
          {inTest && (
            <div style={{ maxWidth: 258, margin: '10px auto 0' }}>
              {/* the strip: one segment per item; done ones filled, the
                  current one draining over its cap; the numeral surfaces in
                  the margin only for the final stretch, so its appearance
                  never shifts the puzzle mid-solve */}
              <div style={{ position: 'relative', display: 'flex', gap: 3, marginBottom: 18 }}>
                {Array.from({ length: form.total }, (_, i) => (
                  <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', background: i < qi ? 'var(--ink)' : 'var(--rule)' }}>
                    {i === qi && <span style={{ display: 'block', height: '100%', width: (100 * left / ITEM_CAP) + '%', background: LOGIC_COL, transition: 'width 0.25s linear' }}></span>}
                  </span>
                ))}
                {countdown != null && (
                  <span role="timer" aria-label={countdown + ' seconds left on this puzzle'} style={{ position: 'absolute', right: 0, top: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: countdown <= 5 ? LOGIC_COL : 'var(--ink-3)' }}>{countdown}s</span>
                )}
              </div>
              <div role="img" aria-label="3 by 3 puzzle grid, bottom-right cell to build">
                <Board code={item.code} goal={goal} phase={phase} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: 26, margin: '6px 0 4px' }}>
                {/* appears only once something is placed: one tap empties the cell */}
                {goal.length > 0 && phase === 'building' && (
                  <button onClick={clear} className="tap44" style={{ cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', border: 'none', background: 'none', padding: '2px 4px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--ink-3)' }}>Clear</button>
                )}
              </div>
              <Palette selected={goal} onToggle={toggle} disabled={phase !== 'building'} />
              {/* Done is dormant until something is placed and wakes with the
                  first shape; it stays pressable throughout, because an item
                  a taker cannot solve is skipped by committing the empty cell
                  rather than by waiting out the clock. The screen never
                  infers "complete": only Done says so. */}
              <button onClick={() => commit(false)} disabled={phase !== 'building'} style={{
                ...pillBtn(goal.length > 0), width: '100%', marginTop: 16, height: 52, borderRadius: 999,
                opacity: phase !== 'building' ? 0.6 : goal.length > 0 ? 1 : 0.7,
                transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
              }}>Done</button>
              {net && net.phase === 'next-error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 14, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{net.msg}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* the cell is held: retry sends the same pick again, and the
                        server answers a repeat with the same next item */}
                    <button onClick={retryNext} style={pillBtn(true)}>Retry</button>
                    <button onClick={() => { setNet(null); setQi(-1); setScreen(result ? 'result' : 'example'); }} style={pillBtn(false)}>Discard</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {screen === 'result' && sending && (
            <div style={{ maxWidth: 300, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 60, textAlign: 'center' }}>
              {net.phase === 'sending' ? (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>Scoring on the server…</div>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{net.msg}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* the cells are held in this state, so a flaky network
                        never costs a finished attempt — retry resubmits the
                        same answers, whatever the form's length is */}
                    <button onClick={() => send(form, net.picks, net.times)} style={pillBtn(true)}>Retry</button>
                    <button onClick={() => { setNet(null); if (!result) setScreen('example'); }} style={pillBtn(false)}>Discard</button>
                  </div>
                </>
              )}
            </div>
          )}
          {screen === 'result' && !sending && result && (
            <div style={{ maxWidth: 340, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 22, paddingBottom: 30 }}>
              {(() => { const R = 48, C = 2 * Math.PI * R; return (
                <svg width="128" height="128" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="9"></circle>
                  <circle cx="64" cy="64" r={R} fill="none" stroke={LOGIC_COL} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(result.pctile / 100) * C} ${C}`} transform="rotate(-90 64 64)"></circle>
                  <text x="64" y="60" textAnchor="middle" fontFamily="var(--sans)" fontSize="22" fontWeight="800" fill="var(--ink)" letterSpacing="-0.02em">{'top ' + (100 - result.pctile) + '%'}</text>
                  <text x="64" y="79" textAnchor="middle" fontFamily="var(--sans)" fontSize="11.5" fontWeight="600" fill="var(--ink-3)">{k + ' of ' + result.marks.length}</text>
                </svg>
              ); })()}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 260, lineHeight: 1.45 }}>
                Sharper than {result.pctile}% of {populationFor(result)}{likely}.
                {result.verified && (
                  <span style={{ display: 'inline-block', marginLeft: 7, padding: '1.5px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--surface)', background: LOGIC_COL, verticalAlign: '1px' }}>verified</span>
                )}
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
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.45, borderTop: '0.5px solid var(--rule)', paddingTop: 10 }}>{noteFor(result)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={beginPractice} disabled={net && net.phase === 'starting'} style={{ ...pillBtn(false), opacity: net && net.phase === 'starting' && net.mode === 'practice' ? 0.5 : 1 }}>
                  {net && net.phase === 'starting' && net.mode === 'practice' ? 'Preparing…' : 'Retake'}
                </button>
                <button onClick={beginVerified} disabled={net && net.phase === 'starting'} style={{ ...pillBtn(false), opacity: net && net.phase === 'starting' && net.mode === 'verified' ? 0.5 : 1 }}>
                  {net && net.phase === 'starting' && net.mode === 'verified' ? 'Preparing…' : 'Verified attempt'}
                </button>
                <button onClick={onClose} style={pillBtn(true)}>Done</button>
              </div>
              {net && net.phase === 'start-error' && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.45 }}>{net.msg}</div>
              )}
              {/* consent is a sentence, not a dialog: what Verified sends is
                  stated where the button is, before it is ever pressed */}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>{LOGIC_VERIFY_DISCLOSURE}</div>
              <button onClick={() => setScreen('example')} className="tap44" style={{ ...pillBtn(false), padding: '6px 14px', fontSize: 12 }}>See how a puzzle works</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.LogicOverlay = LogicOverlay;
  LOGIC = { load: loadResult, color: LOGIC_COL, elements: ELEMENTS, families: FAMILIES };
})();
