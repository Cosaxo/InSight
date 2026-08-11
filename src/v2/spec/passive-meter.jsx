// Ported from design/spec-modules/passive-meter.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { TypeMark, typeColor, typeSplit } from './type-marks.jsx';
import { Sheet } from './primitives.jsx';
import ReactDOM from 'react-dom';
import { IS_TEST_RESULTS } from './test-definitions.js';
import { PASSIVE } from './passive-progress.js';

// passive-meter.jsx — UI for the passive test progress: PassiveRing (one
// conic ring per test), PassiveMeter (persistent indicator by the feed chips;
// tap → sheet), PassiveTag (the per-card mark on a test's own feed questions).
const PM_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

// The sheet's name states the test count in words, and D85 proved a stated
// count goes stale the day a test is added — the title said "four" for a
// day one while five rows sat under it. So it is derived from PASSIVE.KEYS
// rather than maintained by hand: words as far as plausible test counts
// reach, digits beyond, and the day a digit renders is the day this copy
// needs rethinking anyway.
const PM_COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const PM_TITLE = 'Your ' + (PM_COUNT_WORDS[PASSIVE.KEYS.length] || PASSIVE.KEYS.length) + ' profiles';
const PM_CHIP_LABEL = PM_TITLE + ' — mapping as you answer';

function usePassive() {
  const [, tick] = React.useState(0);
  React.useEffect(() => PASSIVE.subscribe(() => tick((t) => t + 1)), []);
  return PASSIVE;
}

// The colour a test currently READS AS: the type you stand at right now, with
// its two-tone split — the same value the open sheet and the type mark use.
// Falls back to the test's category hue before a standing exists.
// A named export rather than a window publish: nothing outside this file reads
// it yet, and the bridge only carries names unmoved consumers actually look up.
export function passiveStanding(k) {
  const m = PASSIVE.META[k];
  const R = IS_TEST_RESULTS[k];
  const mt = (R && R.dims && window.IS_matchArchetype) ? window.IS_matchArchetype(k, R.dims) : null;
  const standing = mt ? mt.list[mt.idx].name : null;
  return {
    standing,
    col: standing ? typeColor(k, standing, null, m.accent) : m.accent,
    sp: standing ? typeSplit(k, standing) : null,
  };
}

function PassiveRing({ k, size = 15, thick = 3, hole = 'var(--surface-2)' }) {
  const p = PASSIVE.pct(k), { col, sp } = passiveStanding(k);
  const deg = p * 3.6;
  // filled arc carries the split as two solid parts, exactly like the sheet's dots
  const fill = sp ? `${sp.deep} 0 ${(deg * sp.ratio).toFixed(2)}deg, ${sp.lift} 0 ${deg.toFixed(2)}deg` : `${col} 0 ${deg.toFixed(2)}deg`;
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${fill}, color-mix(in oklch, var(--ink-3) 24%, transparent) 0)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s ease' }}>
      <span style={{ width: size - thick * 2, height: size - thick * 2, borderRadius: '50%', background: hole }}></span>
    </span>
  );
}

// the always-there indicator: one ring per test, filling as you answer
function PassiveMeter() {
  const P = usePassive();
  const [open, setOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  if (!P) return null;
  const close = () => { if (closing) return; setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 230); };
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  return (
    <React.Fragment>
      <button className="pm-chip" onClick={() => setOpen(true)} aria-label={PM_CHIP_LABEL} title={PM_CHIP_LABEL} style={{ background: 'var(--surface-2)', cursor: 'pointer', WebkitAppearance: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {P.KEYS.map((k) => <PassiveRing key={k} k={k} size={13} thick={3.2}></PassiveRing>)}
        </span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', color: 'var(--ink-3)' }}>profile</span>
      </button>
      {open && host && ReactDOM.createPortal(
        <Sheet onClose={close} closing={closing} label={PM_TITLE}>
            <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flex: 1 }}>{PM_TITLE}</span>
              <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u2715'}</button>
            </div>
            <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.45, padding: '0 2px 10px' }}>Marked cards in the feed fill these in — or finish one in a sitting.</div>
              {P.KEYS.map((k) => {
                const m = P.META[k], full = P.complete(k), n = P.needed(k), done = P.done(k);
                // the row takes the colour of the type you currently ARE, so the mark,
                // its name and the dots read as one thing — the same value the chip's
                // ring outside is already showing
                const { standing, col, sp } = passiveStanding(k);
                const go = () => { close(); setTimeout(() => { if (window.openTest) window.openTest(k); else if (window.openOverlay) window.openOverlay('test'); }, 240); };
                return (
                  <button key={k} onClick={full ? undefined : go} disabled={full} aria-label={m.label + ' \u2014 ' + (standing ? standing + ' \u2014 ' : '') + done + ' of ' + n + (full ? ' \u2014 complete' : ' \u2014 tap to finish')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 11, width: '100%', textAlign: 'left', border: 'none', borderTop: PM_LINE, borderRadius: 0, background: 'none', padding: '15px 2px 17px', cursor: full ? 'default' : 'pointer', WebkitAppearance: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: full ? 'var(--ink-2)' : 'var(--ink)', flex: 1, minWidth: 0 }}>{m.label}</span>
                        {!full && <span aria-hidden="true" style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 19, lineHeight: 1, color: 'var(--ink-3)', flexShrink: 0 }}>{'\u203A'}</span>}
                      </div>
                      {/* where you stand right now — provisional while segments are unfilled */}
                      {standing && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{TypeMark ? <TypeMark testKey={k} name={standing} size={18}></TypeMark> : null}<span style={{ fontFamily: 'var(--sans)', fontWeight: 650, fontSize: 13, letterSpacing: '-0.01em', color: `color-mix(in oklch, ${col} 78%, var(--ink))` }}>{standing}</span></span>}
                    </div>
                    {/* one dot per question — filled is answered. the count IS the visual; no numbers */}
                    <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {Array.from({ length: n }).map((_, i) => (
                        <span key={i} style={{ width: 22, height: 10, borderRadius: 999, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', background: i < done ? (sp ? sp.deep : col) : 'transparent', border: i < done ? 'none' : '1.5px solid color-mix(in oklch, var(--ink-3) 34%, transparent)', transition: 'background .3s ease' }}>
                          {i < done && sp ? <span style={{ marginLeft: 'auto', width: ((1 - sp.ratio) * 100).toFixed(1) + '%', background: sp.lift }}></span> : null}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
        </Sheet>, host)}
    </React.Fragment>
  );
}

// per-card mark on a test's own feed questions: ring + progress; only q.test cards get one
function PassiveTag({ q, answered, style }) {
  const P = usePassive(); if (!P) return null;
  const k = P.testFor(q); const m = k && P.META[k]; if (!m) return null;
  const done = P.done(k), n = P.needed(k), { col } = passiveStanding(k);
  return (
    <span title={'One of the ' + m.label + " test's own questions — " + done + ' of ' + n + ' answered'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', color: answered ? `color-mix(in oklch, ${col} 75%, var(--ink-2))` : 'var(--ink-3)', flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .25s ease', ...style }}>
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
