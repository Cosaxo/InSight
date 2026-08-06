// Ported from design/spec-modules/test-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { TypeMark } from './type-marks.jsx';
import { ResultProfileCard } from './result-card.jsx';
import { ExplainBtn, ExplainSheet, EX_GLYPH } from './explain-sheet.jsx';
import { RP_TESTS, RoseMini } from './result-rose.jsx';
import { Kicker, useDialog } from './primitives.jsx';
import { IS_TESTS, IS_TEST_AVG, IS_TEST_RESULTS, persistTestResult } from './test-definitions.js';
import { PASSIVE } from './passive-progress.js';

// InSight — TestOverlay: pick a test, answer, see the result. Question banks
// and persistence live in test-defs.js. Results autosave the moment the last
// question lands, and a finished test opens its saved result (ResultProfileCard
// — the same treatment the profile tabs use) instead of sitting inert.
const TEST_PROGRESS_KEY = 'insight.testProgress.v1';

// One tick per question — filled = answered, here or passively in the feed.
// The same strip runs across a picker card and above the questions, so
// "how far in am I" needs no number.
function TickStrip({ n, filled, accent, height = 3, gap = 2, cur = -1 }) {
  return (
    <div style={{ display: 'flex', gap }} aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height, borderRadius: height > 2 ? 999 : 0,
          background: i < filled ? accent : i === cur ? `color-mix(in oklch, ${accent} 45%, var(--surface-3))` : `color-mix(in oklch, ${accent} 12%, var(--surface-3))`,
          transition: 'background 0.25s ease',
        }} />
      ))}
    </div>
  );
}

// The likert scale, drawn as a scale: mark size = how strong, fill = which way.
// Both ends are emphatic, the middle is small — so the row of marks reads
// before any of the words do.
const IS_SCALE = [
  { label: 'Strongly disagree', side: -1, strong: true },
  { label: 'Disagree', side: -1 },
  { label: 'Neither', side: 0 },
  { label: 'Agree', side: 1 },
  { label: 'Strongly agree', side: 1, strong: true },
];

function ScaleMark({ side, strong, accent }) {
  const d = side === 0 ? 9 : strong ? 20 : 14;
  const base = { width: d, height: d, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box' };
  if (side === 0) return <span style={{ ...base, border: '1.5px solid var(--ink-3)', opacity: 0.55 }}></span>;
  if (side < 0) return <span style={{ ...base, border: `${strong ? 2.5 : 2}px solid color-mix(in oklch, ${accent} 62%, var(--rule))` }}></span>;
  return <span style={{ ...base, background: strong ? accent : `color-mix(in oklch, ${accent} 62%, var(--surface))` }}></span>;
}

function TestOverlay({ onClose, onComplete, kind: initialKind }) {
  // One call, spread onto BOTH return branches below (the picker and the
  // running test). Hooks cannot be called per-branch, and only one branch
  // is mounted at a time, so a single ref is correct.
  const dlg = useDialog(onClose, 'Tests');
  const [kind, setKind] = React.useState(null);
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState([]);
  const [dir, setDir] = React.useState(1); // +1 forward, -1 back — drives the slide direction
  const [explain, setExplain] = React.useState(null); // testKey whose ⓘ sheet is open
  const [savedView, setSavedView] = React.useState(false); // viewing a stored result
  const entry = React.useRef(initialKind ? 'direct' : 'pick').current;

  // one sheet spec for every test: what it measures, how to read its marks
  const explainSheet = (k) => {
    const T2 = tests[k], cfg = RP_TESTS[k];
    if (!T2) return null;
    const dims = T2.dims.map((d) => ({ ...d, poles: cfg && cfg.poles ? cfg.poles[d.id] : null }));
    const G = EX_GLYPH;
    return (
      <ExplainSheet title={T2.title} kicker="test" dimKey={k} dims={dims}
        keyRows={[
          [G.you(T2.accent), 'The solid dot is you.'],
          [G.most(), 'The hollow ring is where most people sit.'],
          [G.petal(T2.accent), cfg && cfg.bipolar ? 'Petal length is how far from the middle you sit — a long petal is a strong stance either way.' : 'Petal length is how strongly the trait shows.'],
        ]}
        onClose={() => setExplain(null)} />
    );
  };

  // record an answer at the current step (replacing if revisited) and advance.
  // The last answer also SAVES the result then and there — closing with ✕ no
  // longer throws it away (completion was recorded either way).
  const choose = (i) => {
    const next = answers.slice(); next[step] = i;
    setAnswers(next);
    setDir(1); setStep(step + 1);
    const TT = tests[kind];
    if (TT && step + 1 >= TT.questions.length) {
      persistTestResult(kind, {
        title: TT.title, taken: 'just now', accent: TT.accent,
        dims: scoreTest(TT, next, kind),
      });
    }
  };
  const goBack = () => { setDir(-1); setStep(s => Math.max(0, s - 1)); };

  // Keyboard: 1–5 to answer, ←/Backspace to revisit (active only during questions)
  React.useEffect(() => {
    const onKey = (e) => {
      if (!kind || savedView) return;
      const TT = tests[kind]; if (!TT) return;
      if (step >= TT.questions.length) return;
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault(); choose(+e.key - 1);
      } else if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && step > 0) {
        e.preventDefault(); goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [kind, step, savedView]);

  // Resume an unfinished test, or start clean, when a test is picked.
  // `fresh` forces a full retake — no resume, no passive prefill.
  const startTest = (k, fresh) => {
    let resume = null;
    if (!fresh) {
      try {
        const p = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
        if (p[k] && Array.isArray(p[k].answers) && p[k].answers.length) resume = p[k];
      } catch (e) { /* ignore */ }
    }
    // no explicit progress → resume past what the feed already mapped
    // (a complete test starts clean = retake)
    let pre = null;
    if (!fresh && !resume && !PASSIVE.complete(k) && PASSIVE.passiveDone(k) > 0) pre = PASSIVE.prefill(k);
    setSavedView(false);
    setKind(k);
    setAnswers(resume ? resume.answers : (pre || []));
    setStep(resume ? resume.step : (pre ? pre.length : 0));
    setDir(1);
  };

  // Jump straight into a specific test when opened with one (resumes saved
  // progress; a finished test opens its result instead of restarting).
  React.useEffect(() => {
    if (!initialKind) return;
    if (IS_TEST_RESULTS[initialKind]) { setKind(initialKind); setSavedView(true); }
    else startTest(initialKind);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, []);

  // Save in-progress answers so a refresh mid-test doesn't lose them.
  React.useEffect(() => {
    if (!kind || savedView) return;
    const TT = tests[kind]; if (!TT) return;
    try {
      const p = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
      if (step >= TT.questions.length || answers.length === 0) delete p[kind];
      else p[kind] = { step, answers };
      localStorage.setItem(TEST_PROGRESS_KEY, JSON.stringify(p));
    } catch (e) { /* ignore */ }
    if (step >= TT.questions.length) PASSIVE.markComplete(kind); else PASSIVE.poke();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [kind, step, answers, savedView]);

  const tests = IS_TESTS;

  // ─── result helpers ───
  function scoreTest(t, ans, k) {
    const totals = {};
    const counts = {};
    t.questions.forEach((q, i) => {
      const v = ans[i] ?? 2; // default neutral
      const norm = q.invert ? 4 - v : v;       // 0..4
      totals[q.d] = (totals[q.d] || 0) + norm;
      counts[q.d] = (counts[q.d] || 0) + 1;
    });
    const pop = IS_TEST_AVG[k] || {};
    return t.dims.map(d => {
      const a = counts[d.id] ? totals[d.id] / counts[d.id] : 2;
      return { ...d, value: Math.round((a / 4) * 100), avg: pop[d.id] ?? 50 };
    });
  }

  const finished = !!(kind && !savedView && tests[kind] && step >= tests[kind].questions.length);

  // ─── selection screen ───
  if (!kind) {
    const SAVED = IS_TEST_RESULTS;
    const minutesFor = (T) => Math.max(4, Math.round(T.questions.length * 0.7));
    let PROGRESS = {};
    try { PROGRESS = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}'); } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
    return (
      <div className="overlay surface-tint" {...dlg}>
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>✕</button>
          <div className="h-title">Take a <em>test</em></div>
          <div style={{ width: 32, flexShrink: 0 }} />
        </div>
        <div className="app-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(tests).map(([k, T]) => {
              const saved = SAVED[k];
              const rp = RP_TESTS[k];
              const bip = !!(rp && rp.bipolar);
              // for bipolar tests "strongest" = most pronounced lean, not max score
              const top = saved ? [...saved.dims].sort((a, b) => bip ? (Math.abs(b.value - 50) - Math.abs(a.value - 50)) : (b.value - a.value))[0] : null;
              const prog = PROGRESS[k];
              const inProgress = !saved && prog && prog.answers && prog.answers.length;
              const nQ = T.questions.length;
              const mapped = PASSIVE.done(k);
              const partial = !!(saved && !PASSIVE.complete(k));
              const chipBg = `color-mix(in oklch, ${T.accent} 9%, var(--surface-2))`;
              const chipBd = `color-mix(in oklch, ${T.accent} 28%, var(--rule))`;
              const chipFg = `color-mix(in oklch, ${T.accent} 55%, var(--ink-2))`;
              // a test with any result opens that result — the remaining
              // questions arrive through the feed, not a grind screen
              const go = () => saved ? (setKind(k), setSavedView(true)) : startTest(k);
              return (
                // A div with role="button", not a <button>: v17 puts the ⓘ
                // inside the card, and a button cannot nest in a button.
                // role + tabIndex + onKeyDown keep it keyboard-reachable,
                // which is what the <button> conversion was for.
                <div key={k} onClick={go} role="button" tabIndex={0}
                  className="card test-pick-card"
                  aria-label={saved
                    ? `${T.title} result`
                    : `${inProgress ? 'Continue' : 'Start'} ${T.title} — about ${minutesFor(T)} minutes`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
                  style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                  {/* how much of this test is mapped — no percentage needed */}
                  <TickStrip n={nQ} filled={mapped} accent={T.accent} height={3} gap={1.5} />
                  <div style={{ padding: '13px 14px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, textWrap: 'balance' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.accent, flexShrink: 0 }}></span>
                        {T.title}
                        <ExplainBtn onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); setExplain(k); }} label={'What ' + T.title + ' measures'} />
                      </div>
                      <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: saved ? chipFg : 'var(--ink-3)' }}>
                        {saved ? saved.taken : inProgress ? 'in progress' : `~${minutesFor(T)} min`}
                      </span>
                    </div>
                    {!saved && <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', marginTop: 5 }}>{T.tag}</div>}
                    {!saved && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                      {T.dims.map(d => (
                        <span key={d.id} style={{
                          fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
                          padding: '3px 9px', background: chipBg, border: `0.5px solid ${chipBd}`,
                          borderRadius: 999, color: chipFg,
                        }}>{d.label.toLowerCase()}</span>
                      ))}
                    </div>}
                  </div>
                  {/* saved-result footer: strongest trait + type mark */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    borderTop: `0.5px solid ${chipBd}`,
                    background: `color-mix(in oklch, ${T.accent} 5%, var(--surface-2))`,
                  }}>
                    {saved ? (
                      <>
                        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{partial ? 'Early read' : bip ? 'Strongest lean' : 'Strongest'}</span>
                          <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: chipFg, lineHeight: 1.1 }}>{(() => {
                            if (!bip) return <>{top.label} <span style={{ fontWeight: 800, fontSize: 13 }}>{top.value}</span></>;
                            const word = (rp.poles[top.id] || ['low','high'])[top.value >= 50 ? 1 : 0];
                            return word.toLowerCase() === top.label.toLowerCase() ? top.label : <>{top.label} · <span style={{ fontWeight: 800 }}>{word}</span></>;
                          })()}</span>
                        </div>
                        {(() => { const mt = TypeMark && window.IS_matchArchetype && saved.dims ? window.IS_matchArchetype(k, saved.dims) : null; return mt ? React.createElement(TypeMark, { testKey: k, name: mt.list[mt.idx].name, size: 38, title: mt.list[mt.idx].name }) : (RoseMini ? React.createElement(RoseMini, { testKey: k, dims: saved.dims, size: 44 }) : null); })()}
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: chipFg, flexShrink: 0, textTransform: 'uppercase' }}>{'\u2192'}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, color: 'var(--ink-3)' }}>{inProgress ? `${prog.step} of ${nQ} answered` : 'Not taken yet'}</span>
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: chipFg, textTransform: 'uppercase' }}>{inProgress ? 'Resume →' : 'Start →'}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {explain && explainSheet(explain)}
      </div>
    );
  }

  const T = tests[kind];
  const qs = T.questions;
  const showResult = savedView || finished;
  const P = PASSIVE;
  const nLeft = Math.max(0, P.needed(kind) - P.done(kind));
  // a just-finished test is complete by definition — PASSIVE catches up in an
  // effect, so don't let its stale count offer to "finish" what just finished
  const partial = !finished && !P.complete(kind) && nLeft > 0;
  const backToPick = () => { setSavedView(false); setKind(null); setStep(0); setAnswers([]); };

  // ── result: one canonical treatment (the same card the profile tabs show),
  // then a single dark CTA for whatever comes next ──
  if (showResult) {
    // No "finish the test" nudge — a partial picture fills itself in from the
    // feed. Retaking is only offered once the picture is whole.
    const cta = partial ? null
      : finished
      ? { text: 'Done', act: onComplete }
      : { text: 'Retake the test →', act: () => startTest(kind, true) };
    return (
      <div className="overlay surface-tint">
        <div className="app-header">
          <button className="avatar-btn" onClick={entry === 'pick' ? backToPick : onClose}>{entry === 'pick' ? '←' : '✕'}</button>
          <div className="h-title">{T.title}</div>
          <div style={{ width: 32, flexShrink: 0 }} />
        </div>
        <div className="app-body" style={{ paddingBottom: 32 }}>
          {ResultProfileCard
            ? <ResultProfileCard testKey={kind} archetype={T.title} />
            : null}
          {cta && <button className="press" onClick={cta.act} style={{
            width: '100%', padding: '13px', cursor: 'pointer',
            WebkitAppearance: 'none', appearance: 'none',
            background: 'var(--ink)', color: 'var(--surface)',
            border: 'none', borderRadius: 14,
            fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
          }}>{cta.text}</button>}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: cta ? 14 : 4 }}>
            <button onClick={backToPick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>Another test</button>
            {!finished && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>Close</button>}
            {finished && !partial && <button onClick={() => startTest(kind, true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>Retake</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── questions ──
  return (
    <div className="overlay surface-tint" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">{T.title}</div>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>
      <div className="app-body" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 32 }}>
        <div style={{ marginTop: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* progress — one tick per question. The only count on the screen. */}
          <TickStrip n={qs.length} filled={step} cur={step} accent={T.accent} height={3} gap={3} />
          <div style={{ margin: 'auto 0', paddingBottom: 20 }}>
            <div key={step} className={`q-slide ${dir < 0 ? 'q-slide-back' : 'q-slide-fwd'}`}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 25, lineHeight: 1.15, letterSpacing: '-0.02em', textWrap: 'pretty', marginTop: 26 }}>
                {qs[step].q}
              </div>
              <div role="radiogroup" aria-label="How much do you agree" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 }}>
                {IS_SCALE.map((o, i) => {
                  const selected = answers[step] === i;
                  const away = o.strong ? 11 : o.side === 0 ? 4 : 7; // tint ramps with strength, both ways
                  return (
                    <button key={o.label} className="press" onClick={() => choose(i)}
                      role="radio" aria-checked={selected}
                      style={{
                        padding: '13px 15px', textAlign: 'left',
                        background: selected ? `color-mix(in oklch, ${T.accent} 17%, var(--surface))` : `color-mix(in oklch, ${T.accent} ${away}%, var(--surface))`,
                        border: selected ? `1.5px solid ${T.accent}` : `1px solid color-mix(in oklch, ${T.accent} ${o.strong ? 40 : 28}%, var(--rule))`,
                        borderRadius: 16, cursor: 'pointer', boxShadow: 'none', WebkitAppearance: 'none',
                        fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 700,
                        color: 'var(--ink)', display: 'flex', gap: 13, alignItems: 'center'
                      }}>
                      <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <ScaleMark side={o.side} strong={o.strong} accent={T.accent} />
                      </span>
                      <span style={{ flex: 1 }}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              {step > 0 ? (
                <button onClick={goBack} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', padding: 0,
                }}>← Back</button>
              ) : <span />}
              <span className="kb-hint" style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}>press 1–5 · ← to revisit</span>
            </div>
          </div>
        </div>
      </div>
      {explain && explainSheet(explain)}
    </div>
  );
}

// ─── A reusable card showing a saved test result (or a CTA to take it) ───
function TestResultCard({ testKey, accent }) {
  const R = IS_TEST_RESULTS[testKey];
  if (!R) return null;
  const top = [...R.dims].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <Kicker>{R.title} · result</Kicker>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{R.taken}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `1.2px solid ${accent || R.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--sans)', fontSize: 18, color: accent || R.accent,
        }}>{top.value}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>STRONGEST</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 16, }}>{top.label}</div>
          <div className="margin-note" style={{ fontSize: 15, marginTop: 1 }}>{top.blurb}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {R.dims.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 90, fontFamily: 'var(--sans)', fontSize: 12 }}>{d.label}</span>
            <div style={{ flex: 1, height: 5, background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 999 }}>
              <div style={{ height: '100%', width: `${d.value}%`, background: accent || R.accent, borderRadius: 999 }} />
            </div>
            <span style={{ width: 26, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TestOverlay, TestResultCard, TickStrip });

;globalThis.TestOverlay = typeof TestOverlay === 'undefined' ? globalThis.TestOverlay : TestOverlay;
;globalThis.TestResultCard = typeof TestResultCard === 'undefined' ? globalThis.TestResultCard : TestResultCard;
;globalThis.TEST_PROGRESS_KEY = typeof TEST_PROGRESS_KEY === 'undefined' ? globalThis.TEST_PROGRESS_KEY : TEST_PROGRESS_KEY;
