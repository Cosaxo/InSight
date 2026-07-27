/* eslint-disable */
// ported from design/spec-modules/passive-meter.jsx — do not hand-edit load order assumptions
import React from 'react';

// passive-meter.jsx — UI for the passive test progress: PassiveRing (one
// conic ring per test), PassiveMeter (persistent indicator by the feed chips;
// tap → sheet), PassiveTag (the per-card mark on a test's own feed questions).
const PM_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

function usePassive() {
  const [, tick] = React.useState(0);
  React.useEffect(() => (window.PASSIVE ? window.PASSIVE.subscribe(() => tick((t) => t + 1)) : undefined), []);
  return window.PASSIVE;
}

function PassiveRing({ k, size = 15, thick = 3, hole = 'var(--surface-2)' }) {
  const P = window.PASSIVE; if (!P) return null;
  const m = P.META[k], p = P.pct(k);
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${m.accent} ${p * 3.6}deg, color-mix(in oklch, var(--ink-3) 24%, transparent) 0)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s ease' }}>
      <span style={{ width: size - thick * 2, height: size - thick * 2, borderRadius: '50%', background: hole }}></span>
    </span>
  );
}

// the always-there indicator: four rings, one per test, filling as you answer
function PassiveMeter() {
  const P = usePassive();
  const [open, setOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  if (!P) return null;
  const close = () => { if (closing) return; setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 230); };
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  return (
    <React.Fragment>
      <button onClick={() => setOpen(true)} aria-label="Your four profiles — mapping as you answer" title="Your four profiles — mapping as you answer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--rule), var(--ink) 22%)', background: 'var(--surface-2)', padding: '5px 9px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>
        {P.KEYS.map((k) => <PassiveRing key={k} k={k} size={13} thick={3.2}></PassiveRing>)}
      </button>
      {open && host && ReactDOM.createPortal(
        <div className={'wf-scrim' + (closing ? ' is-closing' : '')} onClick={close}>
          <div className="wf-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="wf-sheet-grab"></div>
            <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flex: 1 }}>Your four profiles</span>
              <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u2715'}</button>
            </div>
            <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.5, paddingBottom: 2 }}>Each test's own questions surface as marked cards in the feed — answer them there, or finish one in a single sitting.</div>
              {P.KEYS.map((k) => {
                const m = P.META[k], full = P.complete(k), nLeft = P.needed(k) - P.done(k);
                const go = () => { close(); setTimeout(() => { if (window.openTest) window.openTest(k); else if (window.openOverlay) window.openOverlay('test'); }, 240); };
                return (
                  <button key={k} onClick={full ? undefined : go} disabled={full} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: PM_LINE, borderRadius: 14, background: 'var(--surface)', padding: '12px 14px', cursor: full ? 'default' : 'pointer', WebkitAppearance: 'none' }}>
                    <PassiveRing k={k} size={22} thick={5} hole="var(--surface)"></PassiveRing>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{m.label}</span>
                        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, color: full ? m.accent : 'var(--ink-3)', whiteSpace: 'nowrap' }}>{full ? 'complete' : nLeft + ' to go'}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: 'color-mix(in oklch, var(--ink-3) 18%, transparent)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: P.pct(k) + '%', borderRadius: 999, background: m.accent, transition: 'width .3s ease' }}></div>
                      </div>
                    </div>
                    {!full && <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink-2)', flexShrink: 0 }}>Finish {'\u203A'}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>, host)}
    </React.Fragment>
  );
}

// per-card mark on a test's own feed questions: ring + progress; only q.test cards get one
function PassiveTag({ q, answered, style }) {
  const P = usePassive(); if (!P) return null;
  const k = P.testFor(q); const m = k && P.META[k]; if (!m) return null;
  const done = P.done(k), n = P.needed(k);
  return (
    <span title={'One of the ' + m.label + " test's own questions — " + done + ' of ' + n + ' answered'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', color: answered ? `color-mix(in oklch, ${m.accent} 75%, var(--ink-2))` : 'var(--ink-3)', flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .25s ease', ...style }}>
      <PassiveRing k={k} size={13} thick={3.2}></PassiveRing>
      {done}/{n}
    </span>
  );
}

Object.assign(window, { PassiveRing, PassiveMeter, PassiveTag });

;globalThis.usePassive = typeof usePassive === 'undefined' ? globalThis.usePassive : usePassive;
;globalThis.PassiveRing = typeof PassiveRing === 'undefined' ? globalThis.PassiveRing : PassiveRing;
;globalThis.PassiveMeter = typeof PassiveMeter === 'undefined' ? globalThis.PassiveMeter : PassiveMeter;
;globalThis.PassiveTag = typeof PassiveTag === 'undefined' ? globalThis.PassiveTag : PassiveTag;
;globalThis.PM_LINE = typeof PM_LINE === 'undefined' ? globalThis.PM_LINE : PM_LINE;
