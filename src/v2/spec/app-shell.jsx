/* eslint-disable */
// ported from design/spec-modules/app-shell.jsx — do not hand-edit load order assumptions
import React from 'react';


const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "compact",
  "dark": false,
  "tab": "track",
  "mirrorPop": "near",
  "lensStyle": "underline",
  "worldZoom": "world"
}/*EDITMODE-END*/;

// Hand-drawn-feel SVG glyphs — each one a small ink illustration
function NavGlyph({ id, active }) {
  const stroke = active ? 'var(--ink)' : 'var(--ink-3)';
  const sw = 1.2;
  if (id === 'track') {
    // A tracked line — days joined into a rising thread, today inked at the end
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18.5 C6.2 18.2 6.4 12.6 9.5 12.8 C12.2 13 12.4 15.6 14.8 14.6 C17.6 13.4 18 7.4 20.6 6"></path>
        <circle cx="3" cy="18.5" r="1.1" fill={stroke} stroke="none"></circle>
        <circle cx="9.5" cy="12.8" r="1.1" fill={stroke} stroke="none"></circle>
        <circle cx="14.8" cy="14.6" r="1.1" fill={stroke} stroke="none"></circle>
        <circle cx="20.6" cy="6" r="2.6" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
      </svg>
    );
  }
  if (id === 'mirror') {
    // Two lenses overlapping — you, inked; the population, still sketched
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <circle cx="9" cy="12" r="6.4" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.12"></circle>
        <circle cx="15" cy="12" r="6.4" strokeDasharray="1.5 1.8"></circle>
      </svg>
    );
  }
  return null;
}

// Two tabs: daily · mirror — act, then see.
// (Internal ids keep their historical names; only labels are user-facing.)
const TABS = [
  { id: 'track',  label: 'daily'  },
  { id: 'mirror', label: 'mirror' },
];

const MIRROR_POP_IDS = ['you', 'circle', 'groups', 'near', 'world'];
const WORLD_ZOOM_IDS = ['city', 'country', 'world'];

// Overlays that ship.
const LIVE_OVERLAYS = ['profile', 'test', 'search', 'relmap'];

// One exception in any of the ~450 components should cost a card, not the app.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[InSight] boundary caught:', err, info && info.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: '26px 18px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
          <div style={{ fontFamily: 'var(--sans, system-ui)', fontSize: 21, color: 'var(--ink, #20211f)' }}>This view hit a snag.</div>
          <div style={{ fontFamily: 'var(--sans, system-ui)', fontSize: 11, color: 'var(--ink-3, #8a877f)', letterSpacing: '0.04em', margin: '10px 0 16px', wordBreak: 'break-word' }}>
            {String((this.state.err && this.state.err.message) || this.state.err)}
          </div>
          <button onClick={() => { this.setState({ err: null }); if (this.props.onReset) this.props.onReset(); }}
            style={{ padding: '9px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'var(--ink, #20211f)', color: 'var(--surface, #faf8f2)', fontFamily: 'var(--sans, system-ui)', fontSize: 15 }}>
            Take me back
          </button>
        </div>
      </div>
    );
  }
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = (id) => (TABS.some(x => x.id === id) ? id : 'track');
  const [tab, setTab] = useState(validTab(t.tab));
  const [person, setPerson] = useState(null);
  const [city, setCity] = useState(null);
  // ONE overlay key instead of two dozen booleans — closeAll can't drift
  const [ov, setOv] = useState(null);
  // where to return when an overlay closes (e.g. trackers opened from the profile)
  const [ovBack, setOvBack] = useState(null);
  const ovRef = React.useRef(null);
  useEffect(() => { ovRef.current = ov; }, [ov]);
  const backOv = () => { if (ovBack) { setOv(ovBack); setOvBack(null); } else { setOv(null); } };
  const [dailyKey, setDailyKey] = useState(0);
  // which test to open TestOverlay on (null = selection screen)
  const [testKind, setTestKind] = useState(null);

  const mirrorPop = MIRROR_POP_IDS.includes(t.mirrorPop) ? t.mirrorPop : 'near';
  const worldZoom = WORLD_ZOOM_IDS.includes(t.worldZoom) ? t.worldZoom : 'world';

  const closeAll = () => { setOv(null); setPerson(null); setCity(null); setTestKind(null); };

  useEffect(() => {
    window.openSuggestions = () => { setOv('suggest'); };
    window.openLogicTest = () => { closeAll(); setOv('logic'); };
    return () => { delete window.openSuggestions; delete window.openLogicTest; };
  }, []);

  useEffect(() => {
    window.openOverlay = (key) => {
      if (LIVE_OVERLAYS.includes(key)) {
        const from = ovRef.current;
        closeAll(); setOv(key);
        setOvBack(from === 'profile' && key !== 'profile' ? 'profile' : null);
      }
    };
    window.goTab = (id) => {
      closeAll();
      if (MIRROR_POP_IDS.includes(id)) { setTweak('mirrorPop', id); setTab('mirror'); return; }
      if (TABS.some(x => x.id === id)) setTab(id);
    };
    // open the test flow — straight into a specific test, or the picker
    window.openTest = (k) => {
      const from = ovRef.current;
      closeAll();
      setTestKind(k || null);
      setOv('test');
      setOvBack(from === 'profile' ? 'profile' : null);
    };
    // cross-link: any component can open a city's profile by name
    window.openCity = (name) => {
      const c = (window.IS_DATA.cities || []).find(x => x.name === name);
      if (c) { closeAll(); setCity(c); }
    };
    // cross-link: open a person's profile (record, or id/name lookup)
    window.openPerson = (who) => {
      const list = window.IS_DATA.people || [];
      const p = typeof who === 'object' ? who : list.find(x => x.id === who || x.name === who);
      if (p) { closeAll(); setPerson(p); }
    };
    return () => { delete window.openOverlay; delete window.goTab; delete window.openCity; delete window.openPerson; };
  }, []);

  const me = window.IS_DATA.me;
  // live identity: initials from the real display name (demo persona off)
  const liveOn = window.LIVE && window.LIVE.enabled;
  const liveInitials = liveOn
    ? (((window.LIVE.displayName || '').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()) || '·')
    : null;
  const [, liveTick] = useState(0);
  const this_dismissedUpdate = () => { try { return sessionStorage.getItem('insight.updateDismissed') === '1'; } catch (e) { return false; } };
  useEffect(() => (window.LIVE ? window.LIVE.subscribe(() => liveTick((t) => t + 1)) : undefined), []);

  // Sync tab tweak <-> state (so Tweaks panel can drive it)
  useEffect(() => { const v = validTab(t.tab); if (v !== tab) setTab(v); }, [t.tab]);
  useEffect(() => { if (t.tab !== tab) setTweak('tab', tab); }, [tab]);

  const appClasses = `app surface-tint ${t.dark ? 'dark' : ''} ${t.density || 'regular'} voice-sans`;

  return (
    <IOSDevice width={402} height={874} dark={t.dark}>
      <div className={appClasses} data-tab={tab} data-lens-style={t.lensStyle || 'underline'} data-mpop={tab === 'mirror' ? mirrorPop : undefined} style={tab === 'mirror' ? { '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)' } : undefined}>

        <header className="app-header">
          <button className={"avatar-btn" + (ov === 'profile' ? ' is-on' : '')} onClick={() => { if (ov === 'profile') { setOv(null); } else { closeAll(); setOv('profile'); } }}>
            {ov === 'profile' ? '✕' : (liveInitials != null ? liveInitials : me.initials)}
          </button>
          <div className="h-title">in<em>Sight</em></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" aria-label="Search" onClick={() => { closeAll(); setOv('search'); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
            </button>
          </div>
        </header>

        {liveOn && window.LIVE.updateRequired && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="card" style={{ maxWidth: 320, textAlign: 'center', padding: '26px 20px' }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Update needed</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 }}>
                This version can no longer talk to the server safely. Grab the latest and you're back in.
              </div>
              <button className="press" onClick={() => { const u = window.LIVE.updateUrl; if (u) window.open(u, '_blank'); else location.reload(); }}
                style={{ border: 'none', borderRadius: 999, padding: '12px 24px', cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14 }}>
                {window.LIVE.updateUrl ? 'Get the update' : 'Reload'}
              </button>
            </div>
          </div>
        )}
        {liveOn && !window.LIVE.updateRequired && window.LIVE.updateAvailable && !this_dismissedUpdate() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', background: 'color-mix(in oklch, var(--accent, var(--ink)) 9%, var(--surface-2))', borderBottom: '1px solid var(--rule)', fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ flex: 1 }}>A newer version is out.</span>
            <button className="press" onClick={() => { const u = window.LIVE.updateUrl; if (u) window.open(u, '_blank'); else location.reload(); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, color: 'var(--accent, var(--ink))', fontSize: 12.5 }}>
              {window.LIVE.updateUrl ? 'Update' : 'Refresh'}
            </button>
            <button onClick={() => { try { sessionStorage.setItem('insight.updateDismissed', '1'); } catch (e) {} liveTick((t) => t + 1); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, padding: 0 }}>✕</button>
          </div>
        )}
        <div className="app-body">
          <ErrorBoundary key={'tab-' + tab} onReset={() => { setTab('track'); setTweak('tab', 'track'); }}>
            <div className="tab-swap" key={tab}>
              {tab === 'track' && <DailySplit key={dailyKey} />}
              {tab === 'mirror' && <MirrorTab onPerson={setPerson} pop={mirrorPop} onPop={(v) => setTweak('mirrorPop', v)} worldZoom={worldZoom} onZoom={(v) => setTweak('worldZoom', v)} />}
            </div>
          </ErrorBoundary>
        </div>

        {/* Tabbar */}
        <nav className="tabbar">
          <div className="tab-group">
            {TABS.map(({ id, label }) => (
              <button key={id} className={"tab-btn" + (tab === id ? ' is-active' : '')}
                onClick={() => { setTab(id); closeAll(); }}>
                <span className="glyph"><NavGlyph id={id} active={tab === id} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Overlays — one at a time, keyed by `ov` */}
        <ErrorBoundary key={'ov-' + (ov || 'none') + (person ? '-p' : '') + (city ? '-c' : '')} onReset={closeAll}>
          {person && <PersonOverlay p={person} me={me} onClose={() => setPerson(null)} />}
          {city && <CityOverlay city={city} onClose={() => setCity(null)} />}
          {ov === 'profile' && <ProfileOverlay onClose={() => setOv(null)} me={me} />}
          {ov === 'suggest' && <SuggestOverlay onClose={() => setOv(null)} />}
          {ov === 'search' && <SearchOverlay onClose={() => setOv(null)} onPerson={(p) => { setOv(null); setPerson(p); }} onCity={(c) => { setOv(null); setCity(c); }} />}
          {ov === 'test' && <TestOverlay kind={testKind} onClose={() => { setTestKind(null); backOv(); }} onComplete={() => { setTestKind(null); backOv(); }} />}
          {ov === 'logic' && window.LogicOverlay && <window.LogicOverlay onClose={() => setOv(null)} />}
          {ov === 'relmap' && <RelationshipMapOverlay onClose={() => setOv(null)} />}
        </ErrorBoundary>
      </div>

      <TweaksPanel>
        <TweakSection label="Aesthetic" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular']} onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Lens tabs" value={t.lensStyle || 'segmented'} options={['segmented', 'underline', 'chips']} onChange={(v) => setTweak('lensStyle', v)} />
        <TweakSection label="Daily" />
        <TweakButton label="Reset today's answers" secondary onClick={() => { if (window.DUELS) window.DUELS.resetToday(); setDailyKey((k) => k + 1); }} />
      </TweaksPanel>
    </IOSDevice>
  );
}



;globalThis.NavGlyph = typeof NavGlyph === 'undefined' ? globalThis.NavGlyph : NavGlyph;
;globalThis.ErrorBoundary = typeof ErrorBoundary === 'undefined' ? globalThis.ErrorBoundary : ErrorBoundary;
;globalThis.App = typeof App === 'undefined' ? globalThis.App : App;
;globalThis.TWEAK_DEFAULTS = typeof TWEAK_DEFAULTS === 'undefined' ? globalThis.TWEAK_DEFAULTS : TWEAK_DEFAULTS;
;globalThis.TABS = typeof TABS === 'undefined' ? globalThis.TABS : TABS;
;globalThis.MIRROR_POP_IDS = typeof MIRROR_POP_IDS === 'undefined' ? globalThis.MIRROR_POP_IDS : MIRROR_POP_IDS;
;globalThis.WORLD_ZOOM_IDS = typeof WORLD_ZOOM_IDS === 'undefined' ? globalThis.WORLD_ZOOM_IDS : WORLD_ZOOM_IDS;
;globalThis.LIVE_OVERLAYS = typeof LIVE_OVERLAYS === 'undefined' ? globalThis.LIVE_OVERLAYS : LIVE_OVERLAYS;
