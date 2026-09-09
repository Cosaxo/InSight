const { useState, useEffect } = React;

// Settled experiments have been folded into the design; what stays here is
// live state (which tab, which population) plus the two demo controls.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "compact",
  "tab": "patterns",
  "mirrorPop": "circle",
  "worldZoom": "world",
  "pulseHistory": "typical",
  "friendVotes": "rows"
}/*EDITMODE-END*/;

// the world feed's card set, all shipped
const FEED_OPTS = { reveal: true, ripple: true, pass: true, clock: true, v2: true, signals: true, crossfire: true, counter: true, why: true, hier: true, paid: true };

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
  if (id === 'patterns') {
    // a constellation — points of data, joined into a figure
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17.5 L11.5 13.5 L18.5 15.5 M11.5 13.5 L10 6.5 M11.5 13.5 L19 5.5" opacity="0.42"></path>
        <circle cx="5" cy="17.5" r="1.4" fill={stroke} stroke="none"></circle>
        <circle cx="10" cy="6.5" r="1.4" fill={stroke} stroke="none"></circle>
        <circle cx="18.5" cy="15.5" r="1.4" fill={stroke} stroke="none"></circle>
        <circle cx="11.5" cy="13.5" r="1.4" fill={stroke} stroke="none"></circle>
        <circle cx="19" cy="5.5" r="2.4" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
      </svg>
    );
  }
  return null;
}

// patterns · daily · mirror — the daily sits in the middle, so a swipe either way
// lands somewhere: left into what your answers add up to, right into who else.
// (Internal ids keep their historical names; only labels are user-facing.)
const TABS = [
  { id: 'patterns', label: 'patterns' },
  { id: 'track',    label: 'daily'    },
  { id: 'mirror',   label: 'mirror'   },
];

const MIRROR_POP_IDS = ['you', 'circle', 'groups', 'near', 'world'];
const WORLD_ZOOM_IDS = ['city', 'country', 'world'];

// one axis for every jump between daily modes and tabs — swipe gestures and
// cross-links both go through window.goNav with these keys
const NAV_ONE = [
  { key: 'patterns',    tab: 'patterns'               },
  { key: 'track:world', tab: 'track',  mode: 'world'  },
  { key: 'track:group', tab: 'track',  mode: 'group'  },
  { key: 'track:duo',   tab: 'track',  mode: 'duo'    },
  { key: 'mirror',      tab: 'mirror'                 },
];

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

// The daily's scale, compact, for the header once the in-flow ruler scrolls away.
const DOCK_STOPS = [{ id: 'world', label: 'World', acc: 'var(--c-around)' }, { id: 'group', label: 'Circle', acc: 'var(--c-likeness)' }, { id: 'duo', label: '1v1', acc: 'var(--c-people)' }];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = (id) => (TABS.some(x => x.id === id) ? id : 'track');
  const [tab, setTab] = useState(validTab(t.tab));
  const [person, setPerson] = useState(null);
  const [city, setCity] = useState(null);
  // a paid question whose report is open — the card's "what they get", shown whole
  const [paidQ, setPaidQ] = useState(null);
  // ONE overlay key instead of two dozen booleans — closeAll can't drift
  const [ov, setOv] = useState(null);
  // where to return when an overlay closes (e.g. trackers opened from the profile)
  const [ovBack, setOvBack] = useState(null);
  const ovRef = React.useRef(null);
  useEffect(() => { ovRef.current = ov; }, [ov]);
  const backOv = () => { if (ovBack) { setOv(ovBack); setOvBack(null); } else { setOv(null); } };
  const [dailyKey, setDailyKey] = useState(0);
  const [dailyMode, setDailyMode] = useState('world');
  // true once the daily feed has scrolled past its ruler — the wordmark steps
  // aside and the ruler takes the header
  const [docked, setDocked] = useState(false);
  // which test to open TestOverlay on (null = selection screen)
  const [testKind, setTestKind] = useState(null);

  useEffect(() => { if (tab !== 'track') setDocked(false); }, [tab]);

  const mirrorPop = MIRROR_POP_IDS.includes(t.mirrorPop) ? t.mirrorPop : 'you';
  const worldZoom = WORLD_ZOOM_IDS.includes(t.worldZoom) ? t.worldZoom : 'world';

  const closeAll = () => { setOv(null); setPerson(null); setCity(null); setTestKind(null); setPaidQ(null); };

  useEffect(() => {
    window.openSuggestions = () => { setOv('suggest'); };
    window.openLogicTest = () => { closeAll(); setOv('logic'); };
    // the paid card's receipt: the exact report the buyer gets, open to anyone
    window.openPaidReport = (pq) => { closeAll(); setPaidQ(pq); };
    // the buyer's room — every purchase + the report shelf (PAID-PLAN §7)
    window.openAskedByYou = () => { closeAll(); setOv('askedby'); };
    // the shop window — catalog & rate card, read-only in-app (law 07)
    window.openCatalog = (focus) => { closeAll(); setOv(focus === 'author' ? 'catalog-author' : 'catalog'); };
    // the pulse card's own reading — the Pulse branch of your Map, one leaf a day
    window.goTrends = () => { closeAll(); window.MAP_OPEN_GROUP = 'g-self'; window.MAP_SELECT = 'pulse'; setTweak('mirrorPop', 'you'); setTab('mirror'); };
    return () => { delete window.openSuggestions; delete window.openLogicTest; delete window.goTrends; delete window.openPaidReport; delete window.openAskedByYou; delete window.openCatalog; };
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
    // one axis for the bottom bar: any nav key, from anywhere (swipe gestures use this)
    window.goNav = (key) => {
      const it = NAV_ONE.find(x => x.key === key);
      if (!it) return;
      // a cross-tab jump ends the gesture that caused it: trackpad momentum kept
      // arriving after the switch and stepped the daily one stop further
      window.NAV_AT = Date.now();
      closeAll();
      if (it.tab !== 'track') { if (it.tab === 'mirror') setTweak('mirrorPop', 'you'); setTab(it.tab); return; }
      setDailyMode(it.mode); setTab('track');
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
    return () => { delete window.openOverlay; delete window.goTab; delete window.goNav; delete window.openCity; delete window.openPerson; };
  }, []);

  const me = window.IS_DATA.me;

  // Sync tab tweak <-> state (so Tweaks panel can drive it)
  useEffect(() => { const v = validTab(t.tab); if (v !== tab) setTab(v); }, [t.tab]);
  useEffect(() => { if (t.tab !== tab) setTweak('tab', tab); }, [tab]);

  const appClasses = `app surface-tint acc-now ${t.density || 'regular'} quiet-ground`;
  // how archetype marks draw — read by TypeMark during the render below
  window.IS_MARK_STYLE = 'slice';
  // World's many topic hues, at full spread — see world-palette.js
  window.IS_WPAL = 'full';
  // which seeded pulse history the demo runs on — see pulse-data.js
  window.IS_PULSE_HISTORY = ['typical', 'gap', 'day1', 'perfect'].includes(t.pulseHistory) ? t.pulseHistory : 'typical';

  return (
    <IOSDevice width={402} height={874}>
      <div className={appClasses} data-tab={tab} data-view={tab === 'track' ? 'track:' + dailyMode : tab === 'mirror' ? 'mirror:' + mirrorPop : tab} data-lens-style="underline" data-docked={tab === 'track' && docked ? '' : undefined} data-mpop={tab === 'mirror' ? mirrorPop : undefined} style={tab === 'mirror' ? { '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)' } : undefined}>

        <header className="app-header">
          <button className={"avatar-btn" + (ov === 'profile' ? ' is-on' : '')} onClick={() => { if (ov === 'profile') { setOv(null); } else { closeAll(); setOv('profile'); } }}>
            {ov === 'profile' ? '✕' : me.initials}
          </button>
          {(
            <div className="h-center">
              <div className="h-title">in<em>Sight</em></div>
              {tab === 'track' && (
                <div className="h-dockslot">
                  <div className="h-dockruler" role="tablist" aria-label="How far this answer reaches">
                    {DOCK_STOPS.map((s) => (
                      <button key={s.id} role="tab" aria-selected={dailyMode === s.id} tabIndex={docked ? 0 : -1}
                        className={"h-dockstop" + (dailyMode === s.id ? ' is-on' : '')}
                        style={dailyMode === s.id ? { '--dacc': s.acc } : undefined}
                        onClick={() => { setDailyMode(s.id); setDocked(false); }}>{s.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {window.PassiveMeter && <window.PassiveMeter />}
            {/* compose — suggest a question (and the paid door), one tap from anywhere */}
            <button className="icon-btn" aria-label="Ask a question" onClick={() => { closeAll(); setOv('suggest'); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button className="icon-btn" aria-label="Search" onClick={() => { closeAll(); setOv('search'); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
            </button>
          </div>
        </header>

        <div className="app-body">
          <ErrorBoundary key={'tab-' + tab} onReset={() => { setTab('track'); setTweak('tab', 'track'); }}>
            <div className="tab-swap" key={tab}>
              {tab === 'track' && <DailySplit key={dailyKey + ':' + t.pulseHistory} mode={dailyMode} onMode={setDailyMode} onDock={setDocked} hideSwitcher={false} ruler dock feedHier pulse feedOpts={{ ...FEED_OPTS, friends: t.friendVotes || 'rows' }} />}
              {tab === 'patterns' && <window.PatternsTab />}
              {tab === 'mirror' && <MirrorTab key={'mirror-' + t.pulseHistory} onPerson={setPerson} pop={mirrorPop} onPop={(v) => setTweak('mirrorPop', v)} worldZoom={worldZoom} onZoom={(v) => setTweak('worldZoom', v)} firstRun={false} topNav={false} backKey={'track:duo'} />}
            </div>
          </ErrorBoundary>
        </div>

        {/* Tabbar */}
        <nav className="tabbar" data-n={3}>
          <div className="tab-group">
            {TABS.map(({ id, label }) => (
              <button key={id} className={"tab-btn" + (tab === id ? ' is-active' : '')}
                onClick={() => {
                  if (window.HAPTIC && tab !== id) window.HAPTIC.tick();
                  window.NAV_AT = Date.now();
                  // the daily's scale runs World · Circle · 1v1, with Mirror just
                  // past its far end — so arriving from Mirror lands on the stop
                  // that sits next to it, not on whatever you last had open
                  if (id === 'track' && tab === 'mirror') setDailyMode('duo');
                  setTab(id); closeAll(); if (id === 'mirror') setTweak('mirrorPop', 'you');
                }}>
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
          {paidQ && window.PaidReportOverlay && <window.PaidReportOverlay q={paidQ} onClose={() => setPaidQ(null)} />}
          {ov === 'askedby' && window.AskedByYouOverlay && <window.AskedByYouOverlay onClose={() => setOv(null)} />}
          {(ov === 'catalog' || ov === 'catalog-author') && window.CatalogSheet && <window.CatalogSheet onClose={() => setOv(null)} focus={ov === 'catalog-author' ? 'author' : null} />}
          {ov === 'profile' && <ProfileOverlay onClose={() => setOv(null)} me={me} lensBoxed={false} />}
          {ov === 'suggest' && <SuggestOverlay onClose={() => setOv(null)} />}
          {ov === 'search' && <SearchOverlay onClose={() => setOv(null)} onPerson={(p) => { setOv(null); setPerson(p); }} onCity={(c) => { setOv(null); setCity(c); }} />}
          {ov === 'test' && <TestOverlay kind={testKind} onClose={() => { setTestKind(null); backOv(); }} onComplete={() => { setTestKind(null); backOv(); }} />}
          {ov === 'logic' && window.LogicOverlay && <window.LogicOverlay onClose={() => setOv(null)} />}
          {ov === 'relmap' && <RelationshipMapOverlay onClose={() => setOv(null)} />}
        </ErrorBoundary>
      </div>

      <TweaksPanel>
        <TweakSection label="Display" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular']} onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Friend votes" value={t.friendVotes || 'rows'} options={[{ value: 'rows', label: 'On options' }, { value: 'footer', label: 'Footer' }, { value: 'off', label: 'Off' }]} onChange={(v) => setTweak('friendVotes', v)} />
        <TweakSection label="Demo state" />
        <TweakSelect label="Pulse history" value={t.pulseHistory || 'typical'} options={['typical', 'gap', 'day1', 'perfect']} onChange={(v) => setTweak('pulseHistory', v)} />
        <TweakButton label="Reset today's answers" secondary onClick={() => { if (window.DUELS) window.DUELS.resetToday(); setDailyKey((k) => k + 1); }} />
        <TweakButton label="Clear today's pulse" secondary onClick={() => { if (window.PULSE) window.PULSE.clearToday(); }} />
        <TweakButton label="Clear feed memory" secondary onClick={() => { if (window.FEEDREAD) window.FEEDREAD.reset(); setDailyKey((k) => k + 1); }} />
      </TweaksPanel>
    </IOSDevice>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
