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
    { id: 'roles',      label: 'Roles' },
    { id: 'lenses',     label: 'Lenses' },
  ];
  // remember the last-visited subtab, so returning from a tracker lands back on it
  const validSub = (id) => SUBTABS.some(s => s.id === id) ? id : 'general';
  const [sub, setSubRaw] = React.useState(validSub(window.__profileSub));
  const setSub = (id) => { window.__profileSub = id; setSubRaw(id); };
  // Keep the active chip fully visible: seven chips are wider than the frame, so
  // the last two are off-rail until it scrolls. A single smooth scrollTo on mount
  // lost the race — the tab re-mount resets scrollLeft after the effect runs — so
  // place it after layout and again on a beat, instantly, and clamp to the rail.
  const navRef = React.useRef(null);
  React.useEffect(() => {
    const sc = navRef.current;
    if (!sc) return;
    const put = () => {
      const btn = sc.querySelector('.subnav-btn.is-on');
      if (!btn) return;
      const max = sc.scrollWidth - sc.clientWidth;
      if (max <= 0) return;
      const want = Math.max(0, Math.min(max, btn.offsetLeft - (sc.clientWidth - btn.offsetWidth) / 2));
      if (Math.abs(sc.scrollLeft - want) > 2) sc.scrollLeft = want;
    };
    const raf = requestAnimationFrame(put);
    const t1 = setTimeout(put, 140);
    const t2 = setTimeout(put, 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
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
    const taken = !!(window.IS_TEST_RESULTS || {})[k];
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
      : (window.AttachmentCard ? <window.AttachmentCard /> : <TestResultCard testKey="attachment" />)
  );

  return (
    <div className="overlay surface-tint" style={{ '--accent': 'var(--c-people)' }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">Your <em>profile</em></div>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>
      <div className="app-body" style={{ paddingTop: 0 }}>
        {/* compact identity row — the content is the star, not the header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <Av init={me.initials} hue={38} size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{me.name}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{me.location} · {me.country}</div>
          </div>
        </div>

        {/* sticky sub-tab nav — frosted so content scrolls beneath it */}
        <div className="profile-subnav">
          <div ref={navRef} className="subnav subnav--scroll" style={{ maxWidth: '100%' }}>
            {SUBTABS.map(s => (
              <button key={s.id} onClick={() => setSub(s.id)} className={"subnav-btn" + (s.id === sub ? ' is-on' : '')}>{s.label}</button>
            ))}
          </div>
        </div>

        <div key={sub} className="tab-swap" style={{ marginTop: 4 }}>
          {sub === 'general' && <window.GeneralPanel onGo={setSub} />}
          {sub === 'big5' && <><Big5Panel /><TestCTA k="big5" /></>}
          {sub === 'politics' && <><PoliticsPanel /><TestCTA k="political" /></>}
          {sub === 'values' && <><ValuesPanel /><TestCTA k="values" /></>}
          {sub === 'attachment' && <><AttachmentPanel /><TestCTA k="attachment" /></>}
          {sub === 'roles' && window.RolesPanel && <window.RolesPanel />}
          {sub === 'lenses' && window.LensesPanel && <window.LensesPanel boxed={lensBoxed} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProfileOverlay });
