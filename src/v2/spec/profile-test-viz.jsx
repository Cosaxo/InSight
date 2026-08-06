// Ported from design/spec-modules/profile-test-viz.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { Kicker } from './primitives.jsx';

// profile-test-viz.jsx — distinctive visuals for the per-test profile tabs.
// Each test gets a recognizable hero chart rather than the generic dot-line:
//   · Social     → a five-spoke radar of the kind of friend & partner you are
//   · Cognitive  → a four-axis radar of thinking styles
// All read from window.IS_TEST_RESULTS so they stay in sync with retakes.

const { useState: usePTV } = React;

// shared: pull a test result + its sorted dims
function ptvResult(testKey) {
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  if (!R) return null;
  return R;
}

// ── A small "dominant" hero row — circle with the top score, name, blurb ──
function TestHeroRow({ R, accent, taken }) {
  const top = [...R.dims].sort((a, b) => b.value - a.value)[0];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${accent}`, color: accent,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>{top.value}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', marginTop: 2 }}>/ 100</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Strongest</div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 2 }}>{top.label}</div>
        {top.blurb ? <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>{top.blurb}</div> : null}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SOCIAL · five-spoke radar — the kind of friend & partner you are
// ═══════════════════════════════════════════════════════════════
const SOCIAL_NOTE = {
  warm:  'Warm above all — you lead with affection and make people feel cared for.',
  loyal: 'Loyal to the core — steady and dependable, the friend who stays.',
  open:  'Open — you let people in and say what you actually feel.',
  play:  'Playful — you keep things light and easy to be around.',
  easy:  'Easygoing — low drama, and generous with space.',
};
function AttachmentCard({ accent }) {
  const R = ptvResult('attachment');
  if (!R) return null;
  const a = accent || R.accent;
  const top = [...R.dims].sort((m, n) => n.value - m.value)[0];
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <Kicker>The friend you are</Kicker>
      </div>
      <TestHeroRow R={R} accent={a} />
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {[...R.dims].sort((m, n) => n.value - m.value).map(d => {
          const t = ((window.IS_TEST_AVG || {}).attachment || {})[d.id];
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 74, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
              <span style={{ position: 'relative', flex: 1, height: 14, display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '100%', height: 7, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${d.value}%`, background: a, borderRadius: 99 }}></span>
                </span>
                {t != null ? <span aria-hidden="true" style={{ position: 'absolute', left: `${t}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 13, borderRadius: 2, background: 'color-mix(in oklch, var(--ink-3) 70%, transparent)' }}></span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}><span style={{ width: 15, height: 7, borderRadius: 99, background: a }}></span>you</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}><span style={{ width: 2, height: 12, borderRadius: 2, background: 'color-mix(in oklch, var(--ink-3) 70%, transparent)' }}></span>most people</span>
      </div>
      <div style={{
        marginTop: 13, paddingTop: 12, borderTop: '0.5px solid var(--rule)',
        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty',
      }}>
        {SOCIAL_NOTE[top.id] || <>You lead with <span style={{ color: a }}>{top.label.toLowerCase()}</span>.</>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VALUES · six tensions as one diverging "fingerprint"
// Each row is a pole-to-pole axis; your dot sits where you lean, a
// hollow ring marks where most people sit. The poles ARE the label —
// no separate axis name, so the whole card reads as a single shape.
// ═══════════════════════════════════════════════════════════════
const VALUE_TENSIONS = [
  { id: 'future',   poles: ['pessimist', 'hopeful'] },
  { id: 'circle',   poles: ['close', 'wide'] },
  { id: 'hedonism', poles: ['duty', 'pleasure'] },
  { id: 'meaning',  poles: ['happiness', 'suffering'] },
  { id: 'moral',    poles: ['relativist', 'objectivist'] },
  { id: 'beauty',   poles: ['truth', 'beauty'] },
];
// evocative phrase for whichever pole you lean toward — used in the headline
const VALUE_LEAD = {
  future:   ['the future darkens', 'the future brightens'],
  circle:   ['your own come first', 'strangers count too'],
  hedonism: ['duty over pleasure', 'pleasure over duty'],
  meaning:  ['happiness is enough', 'suffering has meaning'],
  moral:    ['morals are relative', 'morals are objective'],
  beauty:   ['truth over beauty', 'beauty has weight'],
};

function ValuesTiltCard({ me, accent }) {
  const a = accent || 'var(--c-people)';
  const morals = me.morals || {};
  // "most people" baseline, from the saved-test averages (0..100 → −100..100)
  const avg = (window.IS_TEST_AVG || {}).values || {};
  const typ = (id) => (avg[id] != null ? avg[id] * 2 - 100 : null);

  const clamp = (n) => Math.max(0, Math.min(100, n));
  const pos = (v) => 6 + (clamp((v + 100) / 2) / 100) * 88;   // inset so dots stay in

  const rows = VALUE_TENSIONS.map(t => ({ ...t, v: morals[t.id] || 0, t: typ(t.id) }));
  // the strongest pull — headline + the only row drawn large
  const lead = [...rows].sort((m, n) => Math.abs(n.v) - Math.abs(m.v))[0];
  const leadPhrase = (VALUE_LEAD[lead.id] || lead.poles)[lead.v >= 0 ? 1 : 0];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 14 }}>
        <Kicker>Six tensions</Kicker>
      </div>

      {/* headline — the overall label + the single strongest pull */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: `color-mix(in oklch, ${a} 13%, var(--surface-2))`,
          border: `1px solid color-mix(in oklch, ${a} 38%, var(--rule))`,
          color: a, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{GL('◇')}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15, textTransform: 'capitalize' }}>{me.moralLabel}</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-3)', marginTop: 3 }}>{leadPhrase}</div>
        </div>
      </div>

      {/* the six axes — a continuous center spine unifies them into one shape */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 17 }}>
        {/* shared spine */}
        <div style={{ position: 'absolute', left: '50%', top: 4, bottom: 4, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }} />
        {rows.map(r => {
          const isLead = r.id === lead.id;
          const youPct = pos(r.v);
          const leanRight = r.v >= 0;
          const barLo = Math.min(50, youPct), barHi = Math.max(50, youPct);
          const poleStyle = (side) => {
            const isLean = leanRight ? side === 1 : side === -1;
            return {
              fontFamily: 'var(--sans)', fontSize: 12.5, whiteSpace: 'nowrap', letterSpacing: '0.01em',
              fontWeight: isLean ? 700 : 500,
              color: isLean ? a : 'var(--ink-3)',
              transition: 'color .15s',
            };
          };
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...poleStyle(-1), width: 72, flexShrink: 0, textAlign: 'right' }}>{r.poles[0]}</span>
              <div style={{ position: 'relative', flex: 1, height: 16 }}>
                {/* magnitude bar from center toward your lean */}
                <span style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: isLead ? 4 : 3, borderRadius: 999,
                  left: `${barLo}%`, width: `${barHi - barLo}%`,
                  background: `linear-gradient(${leanRight ? '90deg' : '270deg'}, color-mix(in oklch, ${a}, transparent 82%), ${a})`,
                }} />
                {/* where most people sit */}
                {r.t != null && (
                  <span style={{ position: 'absolute', top: '50%', left: `${pos(r.t)}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: '1.4px solid var(--ink-3)', opacity: 0.65 }} />
                )}
                {/* you */}
                <span style={{ position: 'absolute', top: '50%', left: `${youPct}%`, transform: 'translate(-50%,-50%)', width: isLead ? 15 : 12, height: isLead ? 15 : 12, borderRadius: '50%', background: a, border: '2px solid var(--surface)', boxShadow: '0 1px 4px -1px rgba(20,20,40,0.3)' }} />
              </div>
              <span style={{ ...poleStyle(1), width: 72, flexShrink: 0, textAlign: 'left' }}>{r.poles[1]}</span>
            </div>
          );
        })}
      </div>

      {/* one read-once key */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: a, border: '2px solid var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)' }} />you
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: '1.4px solid var(--ink-3)' }} />most people
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { AttachmentCard, TestHeroRow, ValuesTiltCard });

;globalThis.ptvResult = typeof ptvResult === 'undefined' ? globalThis.ptvResult : ptvResult;
;globalThis.TestHeroRow = typeof TestHeroRow === 'undefined' ? globalThis.TestHeroRow : TestHeroRow;
;globalThis.AttachmentCard = typeof AttachmentCard === 'undefined' ? globalThis.AttachmentCard : AttachmentCard;
;globalThis.ValuesTiltCard = typeof ValuesTiltCard === 'undefined' ? globalThis.ValuesTiltCard : ValuesTiltCard;
;globalThis.SOCIAL_NOTE = typeof SOCIAL_NOTE === 'undefined' ? globalThis.SOCIAL_NOTE : SOCIAL_NOTE;
;globalThis.VALUE_TENSIONS = typeof VALUE_TENSIONS === 'undefined' ? globalThis.VALUE_TENSIONS : VALUE_TENSIONS;
;globalThis.VALUE_LEAD = typeof VALUE_LEAD === 'undefined' ? globalThis.VALUE_LEAD : VALUE_LEAD;
