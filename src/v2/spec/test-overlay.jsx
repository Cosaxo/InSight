// Ported from design/spec-modules/test-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { Kicker, useDialog } from './primitives.jsx';

// InSight — TestOverlay: pick a test, answer, see the result. Question banks
// and persistence live in test-defs.js.
const TEST_PROGRESS_KEY = 'insight.testProgress.v1';

function TestOverlay({ onClose, onComplete, kind: initialKind }) {
  // One call, spread onto BOTH return branches below (the picker and the
  // running test). Hooks cannot be called per-branch, and only one branch
  // is mounted at a time, so a single ref is correct.
  const dlg = useDialog(onClose, 'Tests');
  const [kind, setKind] = React.useState(null);
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState([]);
  const [dir, setDir] = React.useState(1); // +1 forward, -1 back — drives the slide direction

  // record an answer at the current step (replacing if revisited) and advance
  const choose = (i) => {
    setAnswers(a => { const n = a.slice(); n[step] = i; return n; });
    setDir(1); setStep(s => s + 1);
  };
  const goBack = () => { setDir(-1); setStep(s => Math.max(0, s - 1)); };

  // Keyboard: 1–5 to answer, ←/Backspace to revisit (active only during questions)
  React.useEffect(() => {
    const onKey = (e) => {
      if (!kind) return;
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
  }, [kind, step]);

  // Resume an unfinished test, or start clean, when a test is picked.
  const startTest = (k) => {
    let resume = null;
    try {
      const p = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
      if (p[k] && Array.isArray(p[k].answers) && p[k].answers.length) resume = p[k];
    } catch (e) { /* ignore */ }
    // no explicit progress → resume past what the feed already mapped
    // (a complete test starts clean = retake)
    let pre = null;
    if (!resume && window.PASSIVE && !window.PASSIVE.complete(k) && window.PASSIVE.passiveDone(k) > 0) pre = window.PASSIVE.prefill(k);
    setKind(k);
    setAnswers(resume ? resume.answers : (pre || []));
    setStep(resume ? resume.step : (pre ? pre.length : 0));
    setDir(1);
  };

  // Jump straight into a specific test when opened with one (resumes saved progress)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  React.useEffect(() => { if (initialKind) startTest(initialKind); }, []);

  // Save in-progress answers so a refresh mid-test doesn't lose them.
  React.useEffect(() => {
    if (!kind) return;
    const TT = tests[kind]; if (!TT) return;
    try {
      const p = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
      if (step >= TT.questions.length || answers.length === 0) delete p[kind];
      else p[kind] = { step, answers };
      localStorage.setItem(TEST_PROGRESS_KEY, JSON.stringify(p));
    } catch (e) { /* ignore */ }
    if (window.PASSIVE) { if (step >= TT.questions.length) window.PASSIVE.markComplete(kind); else window.PASSIVE.poke(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, [kind, step, answers]);

  const tests = window.IS_TESTS;

  // ─── result helpers ───
  function scoreTest(t, ans) {
    const totals = {};
    const counts = {};
    t.questions.forEach((q, i) => {
      const v = ans[i] ?? 2; // default neutral
      const norm = q.invert ? 4 - v : v;       // 0..4
      totals[q.d] = (totals[q.d] || 0) + norm;
      counts[q.d] = (counts[q.d] || 0) + 1;
    });
    const pop = (window.IS_TEST_AVG || {})[kind] || {};
    return t.dims.map(d => {
      const a = counts[d.id] ? totals[d.id] / counts[d.id] : 2;
      return { ...d, value: Math.round((a / 4) * 100), avg: pop[d.id] ?? 50 };
    });
  }

  // ─── selection screen ───
  if (!kind) {
    const SAVED = window.IS_TEST_RESULTS || {};
    const minutesFor = (T) => Math.max(4, Math.round(T.questions.length * 0.7));
    const total = Object.keys(tests).length;
    let PROGRESS = {};
    try { PROGRESS = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}'); } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
    return (
      <div className="overlay surface-tint" {...dlg}>
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>✕</button>
          <div className="h-title">Take a <em>test</em></div>
          <div style={{ width: 36 }} />
        </div>
        <div className="app-body">
          {/* completion meter — the bars say it all */}
          <div style={{ marginBottom: 6 }}>
            <Kicker>Your profile</Kicker>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
            {Object.entries(tests).map(([k, T]) => {
              const p = window.PASSIVE ? window.PASSIVE.pct(k) : (SAVED[k] ? 100 : 0);
              return (
                <div key={k} style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--surface-2)', border: p >= 100 ? 'none' : '0.5px solid var(--rule)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p}%`, borderRadius: 999, background: T.accent }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(tests).map(([k, T]) => {
              const saved = SAVED[k];
              const rp = (window.RP_TESTS || {})[k];
              const bip = !!(rp && rp.bipolar);
              // for bipolar tests "strongest" = most pronounced lean, not max score
              const top = saved ? [...saved.dims].sort((a, b) => bip ? (Math.abs(b.value - 50) - Math.abs(a.value - 50)) : (b.value - a.value))[0] : null;
              const prog = PROGRESS[k];
              const inProgress = !saved && prog && prog.answers && prog.answers.length;
              const p = window.PASSIVE ? window.PASSIVE.pct(k) : (saved ? 100 : 0);
              const partial = !!(saved && window.PASSIVE && !window.PASSIVE.complete(k));
              const chipBg = `color-mix(in oklch, ${T.accent} 9%, var(--surface-2))`;
              const chipBd = `color-mix(in oklch, ${T.accent} 28%, var(--rule))`;
              const chipFg = `color-mix(in oklch, ${T.accent} 55%, var(--ink-2))`;
              return (
                <button type="button" key={k} onClick={() => startTest(k)}
                  className="card test-pick-card"
                  aria-label={`${T.title} — ${saved ? 'retake' : 'start'}, about ${minutesFor(T)} minutes`}
                  style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 14px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, textWrap: 'balance' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.accent, flexShrink: 0 }}></span>
                        {T.title}
                      </div>
                      {saved && !partial ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: chipFg }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: T.accent, color: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✓</span>
                          {saved.taken}
                        </span>
                      ) : partial ? (
                        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: chipFg }}>{p}% mapped in the feed</span>
                      ) : inProgress ? (
                        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: chipFg }}>{prog.step}/{T.questions.length} done</span>
                      ) : (
                        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--ink-3)' }}>~{minutesFor(T)} min</span>
                      )}
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
                  {/* saved-result footer: strongest trait + distribution + retake */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    borderTop: `0.5px solid ${chipBd}`,
                    background: `color-mix(in oklch, ${T.accent} 5%, var(--surface-2))`,
                  }}>
                    {saved ? (
                      <>
                        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{partial ? 'Early read' : bip ? 'Strongest lean' : 'Strongest'}</span>
                          <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: chipFg, lineHeight: 1.1 }}>{(() => {
                            if (!bip) return <>{top.label} <span style={{ fontWeight: 800, fontSize: 13 }}>{top.value}</span></>;
                            const word = (rp.poles[top.id] || ['low','high'])[top.value >= 50 ? 1 : 0];
                            return word.toLowerCase() === top.label.toLowerCase() ? top.label : <>{top.label} · <span style={{ fontWeight: 800 }}>{word}</span></>;
                          })()}</span>
                        </div>
                        {(() => { const mt = window.TypeMark && window.IS_matchArchetype && saved.dims ? window.IS_matchArchetype(k, saved.dims) : null; return mt ? React.createElement(window.TypeMark, { testKey: k, name: mt.list[mt.idx].name, size: 38, title: mt.list[mt.idx].name }) : (window.RoseMini ? React.createElement(window.RoseMini, { testKey: k, dims: saved.dims, size: 44 }) : null); })()}
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: chipFg, flexShrink: 0, textTransform: 'uppercase' }}>{partial ? 'Finish →' : 'Retake →'}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, color: 'var(--ink-3)' }}>{inProgress ? 'In progress' : 'Not taken yet'}</span>
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: chipFg, textTransform: 'uppercase' }}>{inProgress ? 'Resume →' : 'Start →'}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const T = tests[kind];
  const qs = T.questions;
  const done = step >= qs.length;
  const results = done ? scoreTest(T, answers) : null;
  const rpCfg = (window.RP_TESTS || {})[kind];
  const bipT = !!(rpCfg && rpCfg.bipolar);
  const leanWord = (d) => (rpCfg && rpCfg.poles[d.id] || ['low', 'high'])[d.value >= 50 ? 1 : 0];
  const strength = (d) => bipT ? Math.abs(d.value - 50) : d.value;
  const topDim = results ? [...results].sort((a, b) => strength(b) - strength(a))[0] : null;

  return (
    <div className="overlay surface-tint" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">{T.title}</div>
        <div className="h-meta">{Math.min(step + 1, qs.length)}/{qs.length}</div>
      </div>
      <div className="app-body" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 32 }}>
        {!done ? (
          <div style={{ marginTop: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* progress — one tick per question, filled as you go */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 22 }}>
              {qs.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 999,
                  background: i < step ? T.accent : i === step ? `color-mix(in oklch, ${T.accent} 45%, var(--surface-2))` : 'var(--surface-2)',
                  border: i >= step ? '0.5px solid var(--rule)' : 'none',
                  transition: 'background 0.25s ease',
                }} />
              ))}
            </div>
            <div style={{ margin: 'auto 0', paddingBottom: 20 }}>
            <div key={step} className={`q-slide ${dir < 0 ? 'q-slide-back' : 'q-slide-fwd'}`}>
              <div className="kicker">Question {String(step + 1).padStart(2, '0')} of {qs.length}</div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 24, lineHeight: 1.15, letterSpacing: '-0.02em', textWrap: 'pretty', marginTop: 14 }}>
                {qs[step].q}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 }}>
                {['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree'].map((label, i) => {
                  const selected = answers[step] === i;
                  return (
                    <button key={label} className="press" onClick={() => choose(i)}
                      style={{
                        padding: '14px 16px', textAlign: 'left',
                        background: selected ? `color-mix(in oklch, ${T.accent} 18%, var(--surface))` : `color-mix(in oklch, ${T.accent} 10%, var(--surface))`,
                        border: selected ? `1.5px solid ${T.accent}` : `1px solid color-mix(in oklch, ${T.accent} 45%, var(--rule))`,
                        borderRadius: 16, cursor: 'pointer', boxShadow: 'none', WebkitAppearance: 'none',
                        fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 700,
                        color: 'var(--ink)', display: 'flex', gap: 12, alignItems: 'center'
                      }}>
                      <span style={{ flex: 1 }}>{label}</span>
                      {selected
                        ? <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800, color: T.accent }}>✓</span>
                        : null}
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
        ) : (
          /* ── results breakdown ── */
          <div style={{ marginTop: 10 }}>
            <Kicker>Result · {T.title}</Kicker>
            {(() => {
              const flat = bipT
                ? results.every(d => Math.abs(d.value - 50) <= 8)
                : Math.max(...results.map(d => d.value)) - Math.min(...results.map(d => d.value)) <= 8;
              return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, marginBottom: 18, padding: 14, background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{flat ? 'Your shape' : bipT ? 'Strongest lean' : 'Strongest'}</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 20, marginTop: 2 }}>{flat ? 'Evenly balanced' : bipT && leanWord(topDim).toLowerCase() !== topDim.label.toLowerCase() ? <>{topDim.label} · <span style={{ color: T.accent }}>{leanWord(topDim)}</span></> : topDim.label}</div>
                <div className="margin-note" style={{ fontSize: 15, marginTop: 2 }}>{flat ? 'no single trait stands out — you sit near the middle across the board' : topDim.blurb}</div>
              </div>
            </div>
              );
            })()}

            {/* you vs. most people — the SAME rose + pole rows the profile keeps */}
            {(() => {
              const cfg = (window.RP_TESTS || {})[kind];
              if (!cfg || !window.TestRose) return null;
              const hueOf = (id, i) => (cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
              const avgMap = Object.fromEntries(results.map(d => [d.id, d.avg]));
              return (
                <div style={{ padding: '6px 16px 16px', marginBottom: 16, background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 12 }}>
                  <window.TestRose testKey={kind} dims={results} animate={true} />
                  <div style={{ marginTop: 4, paddingTop: 16, borderTop: '0.5px solid var(--rule)' }}>
                    <window.PoleRows dims={results} poles={cfg.poles} hueOf={hueOf} avg={avgMap} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 15, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                      <span style={{ width: 11, height: 11, borderRadius: '50%', background: T.accent, border: '2px solid var(--surface-2)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span>YOU
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)' }}></span>MOST PEOPLE
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* plain-language read — strongest + biggest gap from typical */}
            {(() => {
              const ranked = [...results].sort((a, b) => strength(b) - strength(a));
              const gap = [...results].sort((a, b) => Math.abs(b.value - b.avg) - Math.abs(a.value - a.avg))[0];
              const d = gap.value - gap.avg;
              const dir = d >= 0 ? 'above' : 'below';
              const flat = bipT
                ? results.every(x => Math.abs(x.value - 50) <= 8)
                : Math.max(...results.map(x => x.value)) - Math.min(...results.map(x => x.value)) <= 8;
              return (
                <div style={{ marginBottom: 6, fontFamily: 'var(--sans)', fontSize: 16, lineHeight: 1.5, color: 'var(--ink-2)', textWrap: 'pretty' }}>
                  {flat
                    ? <>Your profile is <em style={{ color: T.accent, fontStyle: 'inherit' }}>balanced</em> — no single {bipT ? 'lean' : 'trait'} dominates.</>
                    : bipT
                    ? <><em style={{ color: T.accent, fontStyle: 'inherit' }}>{ranked[0].label}</em> is your most pronounced lean — toward {leanWord(ranked[0])}.</>
                    : <><em style={{ color: T.accent, fontStyle: 'inherit' }}>{ranked[0].label}</em> leads your profile at {ranked[0].value}.</>}
                  {Math.abs(d) >= 6 && <> You sit <strong style={{ fontWeight: 600, fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 14 }}>{Math.abs(d)} {dir}</strong> the typical person on {gap.label.toLowerCase()}.</>}
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              <button onClick={() => setKind(null)} style={{
                flex: 1, padding: '13px', background: 'var(--surface-2)', color: 'var(--ink)',
                border: '0.5px solid var(--rule)', borderRadius: 14, cursor: 'pointer',
                fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
              }}>Another test</button>
              <button onClick={() => {
                window.IS_persistTestResult(kind, { title: T.title, taken: 'just now', accent: T.accent, dims: results });
                onComplete();
              }} style={{
                flex: 1, padding: '13px', background: 'var(--ink)', color: 'var(--surface)',
                border: 'none', borderRadius: 14, cursor: 'pointer',
                fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
              }}>Save & close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── A reusable card showing a saved test result (or a CTA to take it) ───
function TestResultCard({ testKey, accent }) {
  const R = (window.IS_TEST_RESULTS || {})[testKey];
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

Object.assign(window, { TestOverlay, TestResultCard });

;globalThis.TestOverlay = typeof TestOverlay === 'undefined' ? globalThis.TestOverlay : TestOverlay;
;globalThis.TestResultCard = typeof TestResultCard === 'undefined' ? globalThis.TestResultCard : TestResultCard;
;globalThis.TEST_PROGRESS_KEY = typeof TEST_PROGRESS_KEY === 'undefined' ? globalThis.TEST_PROGRESS_KEY : TEST_PROGRESS_KEY;
