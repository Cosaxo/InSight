// Ported from design/spec-modules/app-shell.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA } from './sample-data.js';


const { useState, useEffect } = React;

// Startup values for the Tweaks panel. The EDITMODE-BEGIN/END sentinels
// that used to wrap this were prototype tooling: the host editor rewrote
// the block on disk when a tweak changed. No host exists any more, so they
// were markers for a machine that stopped reading them — a plain object
// now, edited by hand like any other constant.
//
// The v15 revision removed the dark-mode switch outright (the `.dark`
// styles survive in styles.css with nothing setting the class). Dark mode
// stays tracked as its own piece of work — resurrecting it means wiring
// prefers-color-scheme, not just re-adding a key here.
const TWEAK_DEFAULTS = {
  density: "compact",
  tab: "track",
  mirrorPop: "you",
  lensStyle: "underline",
  worldZoom: "world",
  lensBoxed: false,
  quietGround: true,
};

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

  const mirrorPop = MIRROR_POP_IDS.includes(t.mirrorPop) ? t.mirrorPop : 'you';
  const worldZoom = WORLD_ZOOM_IDS.includes(t.worldZoom) ? t.worldZoom : 'world';

  const closeAll = () => { setOv(null); setPerson(null); setCity(null); setTestKind(null); };

  // ── Android back ──────────────────────────────────────────────────
  // Without this the system back gesture calls finish() and quits the app
  // from anywhere — including with an overlay open, which reads as a crash.
  //
  // Peels ONE layer per press, in the order they sit on screen, and mirrors
  // each overlay's own onClose rather than calling closeAll: `test` opened
  // from the profile has to land back on the profile (backOv), not on the
  // tab, exactly as its close button does. Returning false means nothing
  // was left to close, and back at the root should exit — which is what
  // Android users expect.
  //
  // Refs, not state: the listener is registered once, so reading `person`
  // or `ov` directly would close over their first values forever. backOv
  // and setTweak ride along for the same reason — both are recreated each
  // render, so listing them as deps would re-register the listener on every
  // render instead of once.
  const backState = React.useRef({});
  backState.current = { person, city, ov, tab, backOv, setTweak };
  useEffect(() => (window.registerBackHandler ? window.registerBackHandler(() => {
    const s = backState.current;
    if (s.person) { setPerson(null); return true; }
    if (s.city) { setCity(null); return true; }
    if (s.ov === 'test') { setTestKind(null); s.backOv(); return true; }
    if (s.ov) { s.backOv(); return true; }
    // A non-default tab is a level of its own: back should return to the
    // daily before it offers to leave.
    if (s.tab !== 'track') { setTab('track'); s.setTweak('tab', 'track'); return true; }
    return false;
  }) : undefined), []);

  // The no-button overlays live in a chunk that loads after first paint
  // (loadOverlays, spec-index.js), so every opener below AWAITS it before
  // setting the state that mounts one. That await is the synchronisation,
  // not the `window.X &&` guards at the render sites: setting `ov` with the
  // chunk still in flight renders nothing and schedules nothing to re-read
  // the global, so the overlay would stay blank until an unrelated state
  // change. The guards are the second line, for a chunk that never arrives.
  //
  // Failing to load must not leave a dead button, so each opener logs and
  // returns rather than opening onto nothing. console.error rather than
  // Sentry's reportError: this layer has no import path to src/lib, and the
  // ErrorBoundary above logs the same way.
  //
  // window.loadOverlays is published by spec-index.js, which is where the
  // dynamic imports live (check:globals rule 2 matches the './spec/…'
  // strings in that file) — see the note there for why it is a global
  // rather than an import from either spec-index or data/.
  //
  // A missing loader throws here and is caught: that is a wiring bug, and
  // opening onto an overlay whose module never arrives is worse than not
  // opening, because the guards below would render a blank screen with no
  // way back to the tab.
  const openDeferred = React.useCallback(async (open) => {
    try {
      await window.loadOverlays();
    } catch (e) {
      console.error('[InSight] overlay chunk failed to load:', e);
      return;
    }
    open();
  }, []);

  useEffect(() => {
    window.openSuggestions = () => openDeferred(() => { setOv('suggest'); });
    window.openLogicTest = () => openDeferred(() => { closeAll(); setOv('logic'); });
    return () => { delete window.openSuggestions; delete window.openLogicTest; };
  }, [openDeferred]);

  useEffect(() => {
    window.openOverlay = (key) => {
      if (!LIVE_OVERLAYS.includes(key)) return;
      const from = ovRef.current;
      const show = () => {
        closeAll(); setOv(key);
        setOvBack(from === 'profile' && key !== 'profile' ? 'profile' : null);
      };
      // `profile`, `search` and `relmap` are eager; only `test` waits.
      return key === 'test' ? openDeferred(show) : show();
    };
    window.goTab = (id) => {
      closeAll();
      if (MIRROR_POP_IDS.includes(id)) { setTweak('mirrorPop', id); setTab('mirror'); return; }
      if (TABS.some(x => x.id === id)) setTab(id);
    };
    // open the test flow — straight into a specific test, or the picker
    window.openTest = (k) => {
      const from = ovRef.current;
      return openDeferred(() => {
        closeAll();
        setTestKind(k || null);
        setOv('test');
        setOvBack(from === 'profile' ? 'profile' : null);
      });
    };
    // cross-link: any component can open a city's profile by name
    //
    // The lookup stays OUTSIDE openDeferred: a name that matches nothing
    // should not pay for a chunk, and — more to the point — should not
    // resolve to "loaded, then nothing happened", which is indistinguishable
    // from a failed load. Same for openPerson below.
    window.openCity = (name) => {
      const c = (IS_DATA.cities || []).find(x => x.name === name);
      if (c) return openDeferred(() => { closeAll(); setCity(c); });
    };
    // cross-link: open a person's profile (record, or id/name lookup)
    window.openPerson = (who) => {
      const list = IS_DATA.people || [];
      const p = typeof who === 'object' ? who : list.find(x => x.id === who || x.name === who);
      if (p) return openDeferred(() => { closeAll(); setPerson(p); });
    };
    return () => { delete window.openOverlay; delete window.goTab; delete window.openCity; delete window.openPerson; };
    // Mount-only by design: this registers the window.* cross-link
    // handlers once and tears them down on unmount. Re-running it on every
    // setTweak identity change would re-register the same closures for no
    // benefit, and the handlers read fresh state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = IS_DATA.me;
  // live identity: initials from the real display name (demo persona off)
  const liveOn = window.LIVE && window.LIVE.enabled;
  const liveInitials = liveOn
    ? (((window.LIVE.displayName || '').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()) || '·')
    : null;
  const [, liveTick] = useState(0);
  const this_dismissedUpdate = () => { try { return sessionStorage.getItem('insight.updateDismissed') === String(window.LIVE && window.LIVE.latestBuild); } catch (e) { return false; } };
  useEffect(() => (window.LIVE ? window.LIVE.subscribe(() => liveTick((t) => t + 1)) : undefined), []);

  // Sync tab tweak <-> state (so Tweaks panel can drive it).
  // These are the two halves of a deliberate two-way sync, and each one
  // must depend on ONLY its own source. Adding the other side's value to
  // either dep array closes the loop and they re-trigger each other; the
  // `if` guards stop the ping-pong at runtime, but the missing dep is the
  // thing that keeps it from starting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const v = validTab(t.tab); if (v !== tab) setTab(v); }, [t.tab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (t.tab !== tab) setTweak('tab', tab); }, [tab]);

  const appClasses = `app surface-tint ${t.density || 'regular'} ${t.quietGround !== false ? 'quiet-ground' : ''}`;

  return (
    <IOSDevice width={402} height={874}>
      <div className={appClasses} data-tab={tab} data-lens-style={t.lensStyle || 'underline'} data-mpop={tab === 'mirror' ? mirrorPop : undefined} style={tab === 'mirror' ? { '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)' } : undefined}>

        <header className="app-header">
          <button aria-label="Profile" className={"avatar-btn" + (ov === 'profile' ? ' is-on' : '')} onClick={() => { if (ov === 'profile') { setOv(null); } else { closeAll(); setOv('profile'); } }}>
            {ov === 'profile' ? '✕' : (liveInitials != null ? liveInitials : me.initials)}
          </button>
          {/* On the Daily tab the header IS the mode switcher: DailySplit
              portals its World/Group/1v1 row into this slot, which is why the
              feed has no second tab row. Mirror has no modes, so it keeps the
              wordmark. The slot must be a plain empty div — the portal target
              is looked up by id at mount. */}
          {tab === 'track'
            ? <div className="h-modeslot" id="daily-mode-slot"></div>
            : <div className="h-title">in<em>Sight</em></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* the passive lens ring rides in the header, not in the feed's
                chip row — it reports across tabs, not just the feed */}
            {window.PassiveMeter && <window.PassiveMeter></window.PassiveMeter>}
            <button className="icon-btn" aria-label="Search" onClick={() => { closeAll(); setOv('search'); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
            </button>
          </div>
        </header>

        {liveOn && window.LIVE.updateRequired && (
          <div role="dialog" aria-modal="true" aria-label="Update required" style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="card" style={{ maxWidth: 320, textAlign: 'center', padding: '26px 20px' }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Update needed</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 }}>
                This version can no longer talk to the server safely. Grab the latest and you're back in.
              </div>
              <button className="press" autoFocus onClick={() => { const u = window.LIVE.updateUrl; if (u) window.open(u, '_blank'); else location.reload(); }}
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
            <button aria-label="Dismiss update notice" onClick={() => { try { sessionStorage.setItem('insight.updateDismissed', String(window.LIVE.latestBuild)); } catch { /* best-effort */ } liveTick((t) => t + 1); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, padding: 0 }}>✕</button>
          </div>
        )}
        <div className="app-body">
          <ErrorBoundary key={'tab-' + tab} onReset={() => { setTab('track'); setTweak('tab', 'track'); }}>
            <div className="tab-swap" key={tab}>
              {tab === 'track' && <DailySplit key={dailyKey} />}
              {/* The prototype drove the sparse first-run mirror from a Tweaks
                  switch (`mirrorFirstRun`); the panel that hosted it is gone.
                  Gate it on the real signal instead — feed-read's header names
                  it: the sparse Mirror uses the answer count to know how well
                  the feed has read you. 8 matches MFSparse's `need`. Live
                  builds only: the demo keeps the prototype's default (full
                  field), so style-diff still compares like with like. */}
              {tab === 'mirror' && <MirrorTab onPerson={setPerson} pop={mirrorPop} onPop={(v) => setTweak('mirrorPop', v)} worldZoom={worldZoom} onZoom={(v) => setTweak('worldZoom', v)}
                firstRun={!!(window.LIVE && window.LIVE.enabled && window.FEEDREAD && window.FEEDREAD.stats().n < 8)} />}
            </div>
          </ErrorBoundary>
        </div>

        {/* Tabbar */}
        <nav className="tabbar">
          <div className="tab-group">
            {TABS.map(({ id, label }) => (
              <button key={id} className={"tab-btn" + (tab === id ? ' is-active' : '')}
                onClick={() => { setTab(id); closeAll(); if (id === 'mirror') setTweak('mirrorPop', 'you'); }}>
                <span className="glyph"><NavGlyph id={id} active={tab === id} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Overlays — one at a time, keyed by `ov` */}
        <ErrorBoundary key={'ov-' + (ov || 'none') + (person ? '-p' : '') + (city ? '-c' : '')} onReset={closeAll}>
          {/* The five below read their component off window rather than as a
              bare identifier: they ship in the after-first-paint overlay
              chunk (loadOverlays, spec-index.js), and a bare name would be a
              ReferenceError rather than a blank if the chunk ever failed.
              The openers await the chunk, so in practice these are never
              false while their state is set — see openDeferred above.
              `logic` was already written this way and is unchanged. */}
          {person && window.PersonOverlay && <window.PersonOverlay p={person} me={me} onClose={() => setPerson(null)} />}
          {city && window.CityOverlay && <window.CityOverlay city={city} onClose={() => setCity(null)} />}
          {ov === 'profile' && <ProfileOverlay onClose={() => setOv(null)} me={me} lensBoxed={!!t.lensBoxed} />}
          {ov === 'suggest' && window.SuggestOverlay && <window.SuggestOverlay onClose={() => setOv(null)} />}
          {ov === 'search' && <SearchOverlay onClose={() => setOv(null)} onPerson={(p) => { setOv(null); setPerson(p); }} onCity={(c) => { setOv(null); setCity(c); }} />}
          {ov === 'test' && window.TestOverlay && <window.TestOverlay kind={testKind} onClose={() => { setTestKind(null); backOv(); }} onComplete={() => { setTestKind(null); backOv(); }} />}
          {ov === 'logic' && window.LogicOverlay && <window.LogicOverlay onClose={() => setOv(null)} />}
          {ov === 'relmap' && <RelationshipMapOverlay onClose={() => setOv(null)} />}
        </ErrorBoundary>
      </div>

      <TweaksPanel>
        <TweakSection label="Aesthetic" />
        <TweakToggle label="Quiet ground" value={t.quietGround !== false} onChange={(v) => setTweak('quietGround', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular']} onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Lens tabs" value={t.lensStyle || 'segmented'} options={['segmented', 'underline', 'chips']} onChange={(v) => setTweak('lensStyle', v)} />
        <TweakToggle label="Lenses: boxed cards" value={!!t.lensBoxed} onChange={(v) => setTweak('lensBoxed', v)} />
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
