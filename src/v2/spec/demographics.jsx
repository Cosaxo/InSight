// Ported from design/spec-modules/demographics.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { TabSection } from './primitives.jsx';

// demographics.jsx — one reusable "who they are" card, driven by audience id.
// Age histogram (with a YOU pin), a gender split bar, and an audience-specific
// third breakdown (origin / continent / relation / circle).
const { useState: useDemoState } = React;

// One hue, graded tints — no multi-color coding.
const GENDER_TINTS = [
  'color-mix(in oklch, var(--accent) 85%, var(--surface-2))',
  'color-mix(in oklch, var(--accent) 42%, var(--surface-2))',
  'color-mix(in oklch, var(--accent) 16%, var(--surface-2))',
];

function GenderBar({ gender }) {
  const G = window.DEMOGRAPHICS.GENDER;
  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', border: '0.5px solid var(--rule)' }}>
        {G.map((g, i) => {
          const v = gender[g.k] || 0;
          if (v <= 0) return null;
          return <div key={g.k} title={`${g.label} ${v}%`} style={{ width: v + '%', background: GENDER_TINTS[i] }} />;
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        {G.map((g, i) => {
          const v = gender[g.k] || 0;
          if (v <= 0) return null;
          return (
            <span key={g.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GENDER_TINTS[i], flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.04em', color: 'var(--ink-2)' }}>{g.label.toUpperCase()}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)' }}>{v % 1 ? v.toFixed(1) : v}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AgeHistogram({ age, youBand }) {
  const bands = window.DEMOGRAPHICS.AGE_BANDS;
  const total = age.reduce((a, b) => a + b, 0) || 1;
  const pct = age.map(v => (v / total) * 100);
  const max = Math.max(...pct, 1);
  const H = 70;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: H }}>
        {pct.map((p, i) => {
          const you = i === youBand;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              {you && <div style={{ fontFamily: 'var(--sans)', fontSize: 8.5, color: 'var(--accent)', letterSpacing: '0.06em', marginBottom: 2 }}>YOU</div>}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: you ? 'var(--accent)' : 'var(--ink-3)', marginBottom: 3 }}>{Math.round(p)}</div>
              <div style={{
                width: '100%', height: Math.max(2, (p / max) * (H - 26)), borderRadius: 3,
                background: you ? 'var(--accent)' : 'var(--surface-3)',
                border: you ? 'none' : '0.5px solid var(--rule)',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
        {bands.map((b, i) => (
          <div key={b} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 8, letterSpacing: '0.01em', color: i === youBand ? 'var(--accent)' : 'var(--ink-3)' }}>{b}</div>
        ))}
      </div>
    </div>
  );
}

function ThirdBars({ rows }) {
  const max = Math.max(...rows.map(r => r.v), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 132, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{r.k}</div>
          <div style={{ flex: 1, height: 12, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', border: '0.5px solid var(--rule)' }}>
            <div style={{ width: (r.v / max) * 100 + '%', height: '100%', background: 'var(--accent)', borderRadius: 999, opacity: 0.75 }} />
          </div>
          <div style={{ width: 30, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>{r.v}%</div>
        </div>
      ))}
    </div>
  );
}

function DemographicsCard({ audId }) {
  const d = window.DEMOGRAPHICS.byAudience(audId);
  if (!d) return null;
  return (
    <div>
      <TabSection title={d.title} sub={d.sub} />
      <div className="card" style={{ marginBottom: 14 }}>
        {/* headline */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '0.5px solid var(--rule)' }}>
          <div>
            <div className="fig-num" style={{ fontSize: 30 }}><em>{d.count}</em></div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--ink-3)', marginTop: 2 }}>{d.countLabel.toUpperCase()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fig-num" style={{ fontSize: 30 }}><em>{d.medianAge}</em></div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--ink-3)', marginTop: 2 }}>MEDIAN AGE</div>
          </div>
        </div>

        {/* age */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 10 }}>AGE · % OF GROUP</div>
          <AgeHistogram age={d.age} youBand={d.youBand} />
        </div>

        {/* gender */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>GENDER</div>
          <GenderBar gender={d.gender} />
        </div>

        {/* third dimension */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 10 }}>{d.thirdLabel}</div>
          <ThirdBars rows={d.third} />
        </div>

        {d.note && (
          <div className="margin-note" style={{ fontSize: 15, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--rule)', lineHeight: 1.5 }}>
            {d.note}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { DemographicsCard });

;globalThis.GenderBar = typeof GenderBar === 'undefined' ? globalThis.GenderBar : GenderBar;
;globalThis.AgeHistogram = typeof AgeHistogram === 'undefined' ? globalThis.AgeHistogram : AgeHistogram;
;globalThis.ThirdBars = typeof ThirdBars === 'undefined' ? globalThis.ThirdBars : ThirdBars;
;globalThis.DemographicsCard = typeof DemographicsCard === 'undefined' ? globalThis.DemographicsCard : DemographicsCard;
;globalThis.GENDER_TINTS = typeof GENDER_TINTS === 'undefined' ? globalThis.GENDER_TINTS : GENDER_TINTS;
