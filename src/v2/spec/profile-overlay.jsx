// Ported from design/spec-modules/profile-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { Av, useDialog } from './primitives.jsx';
import { IS_TEST_RESULTS } from './test-definitions.js';

// InSight — ProfileOverlay (your own profile) + the Politics cards.
// The test flow lives in test-overlay.jsx; question banks in test-defs.js.

function ProfileOverlay({ onClose, me, lensBoxed }) {
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
  // CTA only when a test has never been taken. A partial picture needs no
  // nudge: the feed keeps filling it in as you answer.
  const TestCTA = ({ k }) => {
    const taken = !!IS_TEST_RESULTS[k];
    if (taken) return null;
    return (
      <button onClick={() => window.openTest ? window.openTest(k) : window.openOverlay('test')} style={{
        width: '100%', padding: '13px', marginBottom: 14, cursor: 'pointer',
        WebkitAppearance: 'none', appearance: 'none',
        background: 'var(--ink)', color: 'var(--surface)',
        border: 'none', borderRadius: 14,
        fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
      }}>Take this test →</button>
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
      ? <window.ResultProfileCard testKey="attachment" archetype="The Constant" tagline="steady and affectionate — the friend who stays" />
      // Third fallback reads off window like the two before it, because
      // TestResultCard now ships in the after-first-paint overlay chunk
      // (loadOverlays) while this overlay is eager — a bare identifier
      // would be a ReferenceError rather than a blank. Unreachable today:
      // ResultProfileCard and AttachmentCard are both eager, so the first
      // branch always wins. Written defensively anyway, because "the other
      // two are eager" is a fact about load order, and load order in this
      // layer is exactly what changes.
      : (window.AttachmentCard ? <window.AttachmentCard /> : (window.TestResultCard ? <window.TestResultCard testKey="attachment" /> : null))
  );

  const dlg = useDialog(onClose, 'Your profile');
  return (
    <div className="overlay surface-tint" {...dlg} style={{ '--accent': 'var(--c-people)' }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">Your <em>profile</em></div>
        <div style={{ width: 32, flexShrink: 0 }} />
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
          <div className="subnav subnav--scroll" style={{ maxWidth: '100%' }}>
            {SUBTABS.map(s => (
              <button key={s.id} onClick={() => setSub(s.id)} className={"subnav-btn" + (s.id === sub ? ' is-on' : '')}>{s.label}</button>
            ))}
          </div>
        </div>

        <div key={sub} className="tab-swap" style={{ marginTop: 4 }}>
          {sub === 'general' && window.LIVE && window.LIVE.enabled && window.LivePrivacyPanel && <window.LivePrivacyPanel />}
          {sub === 'general' && <window.GeneralPanel onGo={setSub} />}
          {sub === 'big5' && <><Big5Panel /><TestCTA k="big5" /></>}
          {sub === 'politics' && <><PoliticsPanel /><TestCTA k="political" /></>}
          {sub === 'values' && <><ValuesPanel /><TestCTA k="values" /></>}
          {sub === 'attachment' && <><AttachmentPanel /><TestCTA k="attachment" /></>}
          {sub === 'lenses' && window.LensesPanel && <window.LensesPanel boxed={lensBoxed} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProfileOverlay });

;globalThis.ProfileOverlay = typeof ProfileOverlay === 'undefined' ? globalThis.ProfileOverlay : ProfileOverlay;
