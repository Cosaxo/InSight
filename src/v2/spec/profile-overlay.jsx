// Ported from design/spec-modules/profile-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// InSight — ProfileOverlay (your own profile) + the Politics cards.
// The test flow lives in test-overlay.jsx; question banks in test-defs.js.

function ProfileOverlay({ onClose, me }) {
  const dims = [
    { label: 'Openness', v: me.personality.O },
    { label: 'Conscientiousness', v: me.personality.C },
    { label: 'Extraversion', v: me.personality.E },
    { label: 'Agreeableness', v: me.personality.A },
    { label: 'Sensitivity', v: me.personality.N },
  ];
  const SUBTABS = [
    { id: 'general',    label: 'General' },
    { id: 'big5',       label: 'Big 5' },
    { id: 'politics',   label: 'Politics' },
    { id: 'values',     label: 'Values' },
    { id: 'attachment', label: 'Social' },
    // the minor instruments. Last on purpose: the four core tests are the
    // profile, lenses are the footnotes that explain it.
    { id: 'lenses',     label: 'Lenses' },
  ];
  // remember the last-visited subtab, so returning from a tracker lands back on it
  const validSub = (id) => SUBTABS.some(s => s.id === id) ? id : 'general';
  const [sub, setSubRaw] = React.useState(validSub(window.__profileSub));
  const setSub = (id) => { window.__profileSub = id; setSubRaw(id); };
  // keep the active chip fully visible in the scrollable subnav
  React.useEffect(() => {
    const btn = document.querySelector('.profile-subnav .subnav-btn.is-on');
    if (btn && btn.parentElement) {
      const sc = btn.parentElement;
      sc.scrollTo({ left: btn.offsetLeft - (sc.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [sub]);

  const top = [...dims].sort((a, b) => b.v - a.v)[0];

  const labels = {
    Openness: { name: 'The Seeker', tag: 'open, curious, drawn to the new', glyph: '✶' },
    Conscientiousness: { name: 'The Steady', tag: 'ordered, deliberate, finishes what begins', glyph: '◆' },
    Extraversion: { name: 'The Spark', tag: 'energised by people, warm in company', glyph: '☀' },
    Agreeableness: { name: 'The Kind', tag: 'gentle, trusting, slow to judge', glyph: '✿' },
    Sensitivity: { name: 'The Sensitive', tag: 'feels deeply, weather close to the skin', glyph: '☾' },
  };
  const meta = labels[top.label];

  // ── one tab per test — the unified "results profile" card ──
  // take/retake button, at the foot of each test's tab
  const TestCTA = ({ k }) => {
    const P = window.PASSIVE;
    const taken = !!(window.IS_TEST_RESULTS || {})[k];
    const nLeft = P && !P.complete(k) ? P.needed(k) - P.done(k) : 0;
    return (
      <button onClick={() => window.openTest ? window.openTest(k) : window.openOverlay('test')} style={{
        width: '100%', padding: '13px', marginBottom: 14, cursor: 'pointer',
        WebkitAppearance: 'none', appearance: 'none',
        background: taken && !nLeft ? 'var(--surface-2)' : 'var(--ink)',
        color: taken && !nLeft ? 'var(--ink)' : 'var(--surface)',
        border: taken && !nLeft ? '0.5px solid var(--rule)' : 'none', borderRadius: 14,
        fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
      }}>{nLeft ? `Finish the test — ${nLeft} question${nLeft === 1 ? '' : 's'} left` : taken ? 'Retake this test' : 'Take this test'} →</button>
    );
  };

  const Big5Panel = () => (
    window.ResultProfileCard
      ? <window.ResultProfileCard testKey="big5" archetype={meta.name} tagline={meta.tag} />
      : <TestVizCard testKey="big5" />
  );

  const PoliticsPanel = () => (
    <>
      {window.ResultProfileCard && <window.ResultProfileCard testKey="political" archetype={me.politicalIdentity.name} tagline={me.politicalIdentity.tag} />}
    </>
  );

  const ValuesPanel = () => (
    window.ResultProfileCard
      ? <window.ResultProfileCard testKey="values" archetype={me.moralLabel} tagline="beauty and meaning pull hardest" />
      : (window.ValuesTiltCard ? <window.ValuesTiltCard me={me} /> : null)
  );

  const AttachmentPanel = () => (
    window.ResultProfileCard
      ? <window.ResultProfileCard testKey="attachment" archetype="The Warm Loyalist" tagline="steady and affectionate — the friend who stays" />
      : (window.AttachmentCard ? <window.AttachmentCard /> : <TestResultCard testKey="attachment" />)
  );

  return (
    <div className="overlay surface-tint" style={{ '--accent': 'var(--c-people)' }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">Your <em>profile</em></div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body" style={{ paddingTop: 0 }}>
        {/* compact identity row — the content is the star, not the header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          {(() => {
            const live = window.LIVE && window.LIVE.enabled;
            const nm = live ? (window.LIVE.displayName || 'You') : me.name;
            const init = live
              ? ((nm.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()) || '·')
              : me.initials;
            const sub = live ? 'anonymous session — link Google below to keep it' : (me.location + ' · ' + me.country);
            return (
              <>
                <Av init={init} hue={38} size={52} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{nm}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>
                </div>
              </>
            );
          })()}
        </div>

        {/* sticky sub-tab nav — frosted so content scrolls beneath it */}
        <div className="profile-subnav">
          <div className="subnav" style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-3)', borderRadius: 999, padding: 3, border: '0.5px solid var(--rule)', maxWidth: '100%', overflowX: 'auto', flexWrap: 'nowrap', justifyContent: 'flex-start', scrollbarWidth: 'none' }}>
            {SUBTABS.map(s => {
              const on = s.id === sub;
              return (
                <button key={s.id} onClick={() => setSub(s.id)} className={"subnav-btn" + (on ? ' is-on' : '')} style={{
                  flex: '0 0 auto', padding: '8px 11px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  WebkitAppearance: 'none', appearance: 'none',
                  fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap',
                }}>{s.label}</button>
              );
            })}
          </div>
        </div>

        <div key={sub} className="tab-swap" style={{ marginTop: 4 }}>
          {sub === 'general' && window.LIVE && window.LIVE.enabled && window.LivePrivacyPanel && <window.LivePrivacyPanel />}
          {sub === 'general' && <window.GeneralPanel onGo={setSub} />}
          {sub === 'big5' && <><Big5Panel /><TestCTA k="big5" /></>}
          {sub === 'politics' && <><PoliticsPanel /><TestCTA k="political" /></>}
          {sub === 'values' && <><ValuesPanel /><TestCTA k="values" /></>}
          {sub === 'attachment' && <><AttachmentPanel /><TestCTA k="attachment" /></>}
          {sub === 'lenses' && window.LensesPanel && <window.LensesPanel />}
        </div>
      </div>
    </div>
  );
}

function PoliticsCompass({ me }) {
  const D = window.IS_DATA;
  const axes = D.politicalAxes;

  // 6-axis radar — your values + your circle's avg
  const youVals    = axes.map(a => (me.political[a.id] + 100) / 2);
  const circleVals = axes.map(a => (a.avgCircle + 100) / 2);

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>Six axes</Kicker>

      {/* hex radar */}
      <div style={{ marginTop: 6 }}>
        <RadarChart
          values={youVals}
          compareValues={circleVals}
          compareColor="var(--ink-3)"
          labels={axes.map(a => a.label)}
          color="var(--accent)"
          size={260}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 4 }}>
        <span><span style={{ display:'inline-block', width:10, height:2, background:'var(--accent)', verticalAlign:'middle', marginRight:5 }} />YOU</span>
        <span><span style={{ display:'inline-block', width:10, height:2, background:'var(--ink-3)', verticalAlign:'middle', marginRight:5 }} />YOUR CIRCLE</span>
      </div>

      {/* 2D compass with ideology landmarks */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6 }}>Econ × social</div>
        <Compass2D
          x={me.political.econ} y={me.political.social * -1}
          label="you"
          xLabel={['Left', 'Right']} yLabel={['Liberty', 'Authority']}
          size={260}
          accent="var(--accent)"
          comparePoints={D.ideologies.map(io => ({
            x: io.econ, y: -io.social, label: io.name,
            color: 'oklch(0.55 0.10 250)',
          }))}
        />
      </div>
    </div>
  );
}

Object.assign(window, { ProfileOverlay, PoliticsCompass });

;globalThis.ProfileOverlay = typeof ProfileOverlay === 'undefined' ? globalThis.ProfileOverlay : ProfileOverlay;
;globalThis.PoliticsCompass = typeof PoliticsCompass === 'undefined' ? globalThis.PoliticsCompass : PoliticsCompass;
