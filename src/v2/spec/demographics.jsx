// Ported from design/spec-modules/demographics.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { TabSection } from './primitives.jsx';
import { DEMOGRAPHICS } from './demographics.js';

// demographics.jsx — one reusable "who they are" card, driven by audience id.
// Age histogram (with a YOU band), a gender split bar, and an audience-specific
// third breakdown (origin / continent / relation / circle).
//
// Nothing here is annotated in 8px type: the age bars carry their value as
// height alone, the gender shares ride inside their own segments, and each
// third-dimension figure sits at the end of its bar. One read-once key ("you")
// stands in for every label the chart used to print over itself.
const { useState: useDemoState } = React;

// One hue, graded tints — no multi-color coding. The first step is deep enough
// to carry a light numeral; the other two carry ink.
const GENDER_TINTS = [
  'color-mix(in oklch, var(--accent) 96%, var(--surface-2))',
  'color-mix(in oklch, var(--accent) 40%, var(--surface-2))',
  'color-mix(in oklch, var(--accent) 15%, var(--surface-2))',
];
// a share narrower than this can't hold its own numeral — it reads in the key
const FITS = 15;

function GenderBar({ gender }) {
  const segs = DEMOGRAPHICS.GENDER
    .map((g, i) => ({ ...g, v: gender[g.k] || 0, tint: GENDER_TINTS[i], deep: i === 0 }))
    .filter((s) => s.v > 0);
  const fmt = (v) => (v % 1 ? v.toFixed(1) : v) + '%';
  return (
    <div>
      <div style={{ display: 'flex', height: 26, borderRadius: 999, overflow: 'hidden', border: '0.5px solid var(--rule)' }}>
        {segs.map((s) => (
          <div key={s.k} title={`${s.label} ${fmt(s.v)}`} style={{ width: s.v + '%', background: s.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {s.v >= FITS && <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, letterSpacing: '-0.01em', color: s.deep ? 'var(--surface-2)' : 'var(--ink)' }}>{fmt(s.v)}</span>}
          </div>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 9 }}>
        {segs.map((s) => (
          <span key={s.k} style={{ '--lgc': s.tint }}>
            <span className="lg-dot"></span>{s.label}{s.v < FITS ? ' ' + fmt(s.v) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function AgeHistogram({ age, youBand }) {
  const bands = DEMOGRAPHICS.AGE_BANDS;
  const total = age.reduce((a, b) => a + b, 0) || 1;
  const pct = age.map((v) => (v / total) * 100);
  const max = Math.max(...pct, 1);
  const H = 82;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: H }}>
        {pct.map((p, i) => {
          const you = i === youBand;
          return (
            <div key={i} title={`${bands[i]} · ${Math.round(p)}%`} style={{
              flex: 1, height: Math.max(3, (p / max) * H), borderRadius: '5px 5px 2px 2px',
              background: you ? 'var(--accent)' : 'var(--surface-3)',
              border: you ? 'none' : '0.5px solid var(--rule)',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
        {bands.map((b, i) => (
          <div key={b} className={'klabel' + (i === youBand ? ' klabel--accent' : '')}
            style={{ flex: 1, minWidth: 0, textAlign: 'center', letterSpacing: '0.01em', fontWeight: i === youBand ? 800 : 700 }}>{b}</div>
        ))}
      </div>
    </div>
  );
}

function ThirdBars({ rows }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  const fill = 'color-mix(in oklch, var(--accent) 58%, var(--surface-2))';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => {
        const w = (r.v / max) * 100;
        const inside = w >= 30;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 118, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', lineHeight: 1.2, textWrap: 'pretty' }}>{r.k}</div>
            <div style={{ flex: 1, minWidth: 0, height: 22, position: 'relative', background: 'var(--surface-3)', borderRadius: 999, border: '0.5px solid var(--rule)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: w + '%', background: fill, borderRadius: 999 }} />
              <span style={{
                position: 'absolute', top: 0, bottom: 0, left: w + '%', display: 'flex', alignItems: 'center',
                transform: inside ? 'translateX(-100%)' : 'none',
                padding: inside ? '0 9px 0 0' : '0 0 0 8px',
                fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em',
                color: inside ? 'var(--ink)' : 'var(--ink-3)',
              }}>{r.v}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// the card's one key: accent means you. Read once, covers every chart below.
function YouKey() {
  return (
    <span className="legend">
      <span style={{ '--lgc': 'var(--accent)' }}><span className="lg-dot"></span>you</span>
    </span>
  );
}

export function DemographicsCard({ audId }) {
  const d = DEMOGRAPHICS.byAudience(audId);
  if (!d) return null;
  return (
    <div>
      <TabSection title={d.title} sub={d.sub} />
      <div className="card" style={{ marginBottom: 14 }}>
        {/* headline */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--rule)' }}>
          <div style={{ minWidth: 0 }}>
            <div className="fig-num" style={{ fontSize: 30 }}><em>{d.count}</em></div>
            <div className="klabel" style={{ marginTop: 3 }}>{d.countLabel}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="fig-num" style={{ fontSize: 30 }}><em>{d.medianAge}</em></div>
            <div className="klabel" style={{ marginTop: 3 }}>Median age</div>
          </div>
        </div>

        {/* age */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 11 }}>
            <span className="klabel">Age</span>
            <YouKey />
          </div>
          <AgeHistogram age={d.age} youBand={d.youBand} />
        </div>

        {/* gender */}
        <div style={{ marginTop: 18 }}>
          <div className="klabel" style={{ marginBottom: 9 }}>Gender</div>
          <GenderBar gender={d.gender} />
        </div>

        {/* third dimension */}
        <div style={{ marginTop: 18 }}>
          <div className="klabel" style={{ marginBottom: 10 }}>{d.thirdLabel}</div>
          <ThirdBars rows={d.third} />
        </div>
      </div>
    </div>
  );
}


