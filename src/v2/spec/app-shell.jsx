// Ported from design/spec-modules/app-shell.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA } from './sample-data.js';
import { DUELS } from './duels-data.js';
import { HAPTIC } from './haptics.js';
import { markNav } from './swipe-back.js';
import { WPAL } from './world-palette.js';
import { setMarkStyle } from './type-marks.jsx';
import { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakButton } from './tweaks-panel.jsx';
import { reportError } from '../../lib/sentry';


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
  accents: "now",
  worldZoom: "world",
  lensBoxed: false,
  quietGround: true,
  // v17's nav and palette keys. Every value here is the SHIPPING one — the
  // alternatives ('pill', 'bar', 'ring', 'dots', 'family', 'one') exist so the
  // three navs and the two palettes can still be judged against each other,
  // which is what the standalone keeps them for. The feed's own flags stay
  // out: world-feed.jsx defaults them ON and nothing here passes them.
  navMode: "ruler",
  dockRuler: true,
  mirrorLensTop: false,
  feedHier: true,
  markStyle: "slice",
  wpal: "full",
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
  if (id === 'groups') {
    // three ties, one circle — a named group
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <path d="M12 6.6 L6.6 15.6 M12 6.6 L17.4 15.6 M6.6 15.6 L17.4 15.6" opacity="0.42"></path>
        <circle cx="12" cy="6.6" r="2.5" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
        <circle cx="6.6" cy="15.6" r="2.5" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
        <circle cx="17.4" cy="15.6" r="2.5" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
      </svg>
    );
  }
  if (id === 'duo') {
    // two, joined — one on one
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <path d="M8.6 12 H15.4" opacity="0.42"></path>
        <circle cx="6" cy="12" r="3.1" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
        <circle cx="18" cy="12" r="3.1" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
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

// nav v2 — ONE primary nav. The three daily modes and the mirror are the same
// kind of choice, so they live on the same bar instead of at two altitudes.
const NAV_ONE = [
  { key: 'track:world', tab: 'track',  mode: 'world', label: 'daily',  glyph: 'track' },
  { key: 'track:group', tab: 'track',  mode: 'group', label: 'groups', glyph: 'groups' },
  { key: 'track:duo',   tab: 'track',  mode: 'duo',   label: '1v1',    glyph: 'duo' },
  { key: 'mirror',      tab: 'mirror',                label: 'mirror', glyph: 'mirror' },
];

// The daily's scale, compact, for the header once the in-flow ruler scrolls away.
const DOCK_STOPS = [
  { id: 'world', label: 'World', acc: 'var(--c-around)' },
  { id: 'group', label: 'Circle', acc: 'var(--c-likeness)' },
  { id: 'duo', label: '1v1', acc: 'var(--c-people)' },
];

// Overlays that ship. `test` left this list at D121 with the sit-down
// flow it opened; `logic` was never in it (LogicOverlay opens through its
// own path).
const LIVE_OVERLAYS = ['profile', 'search', 'relmap'];

// One exception in any of the ~450 components should cost a card, not the app.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    console.error('[InSight] boundary caught:', err, info && info.componentStack);
    // React swallows what a boundary catches, so Sentry's global handlers
    // never see these — and a screen dying to "This view hit a snag" is the
    // most user-visible failure the app has. Report it explicitly; the send
    // site itself honours the telemetry opt-out (D76).
    reportError(err, { where: 'ErrorBoundary', componentStack: info && info.componentStack });
  }
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
  const [dailyMode, setDailyMode] = useState('world');
  // true once the daily feed has scrolled past its ruler — the wordmark steps
  // aside and the ruler takes the header
  const [docked, setDocked] = useState(false);
  // The `testKind` state that stood here chose which test TestOverlay
  // opened on. D121 removed the overlay: the four core instruments fill
  // from the feed and only from the feed, so there is no test to open.
  // (LogicOverlay stays — it is a sit-down instrument by construction,
  // procedurally generated and server-scored, D57.)

  useEffect(() => { if (tab !== 'track') setDocked(false); }, [tab]);

  const mirrorPop = MIRROR_POP_IDS.includes(t.mirrorPop) ? t.mirrorPop : 'you';
  const worldZoom = WORLD_ZOOM_IDS.includes(t.worldZoom) ? t.worldZoom : 'world';

  const closeAll = () => { setOv(null); setPerson(null); setCity(null); };

  // ── Android back ──────────────────────────────────────────────────
  // Without this the system back gesture calls finish() and quits the app
  // from anywhere — including with an overlay open, which reads as a crash.
  //
  // Peels ONE layer per press, in the order they sit on screen, and mirrors
  // each overlay's own onClose rather than calling closeAll: an overlay
  // opened from the profile has to land back on the profile (backOv), not
  // on the tab, exactly as its close button does. Returning false means
  // nothing was left to close, and back at the root should exit — which is
  // what Android users expect.
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
  // Sentry's reportError: main.jsx already reports the loadOverlays failure
  // once when the chunk dies, and one failure should not re-report per tap.
  // (The ErrorBoundary above DOES report — its crashes have no other
  // reporter — see D76.)
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
      // All three are eager. `test` was the one that waited on the
      // deferred overlay chunk, and it is gone (D121).
      return show();
    };
    // Open the profile ON one of its tabs. The passive meter's rows used
    // to open the sit-down flow for an instrument; they open its profile
    // page instead, which needs a way to name the page. __profileSub is
    // the overlay's own memory of the last tab, so writing it before the
    // open is exactly what a returning visit does.
    window.openProfileTab = (subId) => {
      if (typeof subId === 'string' && subId) window.__profileSub = subId;
      return window.openOverlay('profile');
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
      markNav();
      closeAll();
      if (it.tab === 'mirror') { setTweak('mirrorPop', 'you'); setTab('mirror'); return; }
      setDailyMode(it.mode); setTab('track');
    };
    // `window.openTest` stood here (D121). Every caller is gone with it —
    // the profile's per-test CTA, the passive meter's sheet rows — and it
    // is not left as a no-op: a global that resolves to a function which
    // does nothing is how a dead affordance survives a deletion.
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
    return () => { delete window.openOverlay; delete window.goTab; delete window.goNav; delete window.openCity; delete window.openPerson; };
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

  const appClasses = `app surface-tint acc-${t.accents || 'now'} ${t.density || 'regular'} ${t.quietGround !== false ? 'quiet-ground' : ''}`;
  // three ways to navigate, so they can be judged against each other:
  //   ruler — two tabs; the daily's three stops are a scale (World · Circle · 1v1)
  //   pill  — two tabs; the original segmented switcher in the header
  //   bar   — one flat bar of four: daily · groups · 1v1 · mirror
  const navMode = ['ruler', 'pill', 'bar'].includes(t.navMode) ? t.navMode : 'ruler';
  const navBar = navMode === 'bar';
  const navKey = tab === 'mirror' ? 'mirror' : 'track:' + dailyMode;
  // How archetype marks draw, and how far World's many topic hues are pulled
  // toward the tab accent. Both are settings the shell PUSHES into the module
  // that owns them, rather than globals those modules read back — see
  // type-marks.jsx and world-palette.js.
  setMarkStyle(t.markStyle);
  WPAL.setMode(t.wpal);

  return (
    <IOSDevice width={402} height={874}>
      <div className={appClasses} data-tab={tab} data-view={tab === 'track' ? 'track:' + dailyMode : 'mirror:' + mirrorPop} data-lens-style={t.lensStyle || 'underline'} data-docked={tab === 'track' && docked ? '' : undefined} data-mpop={tab === 'mirror' ? mirrorPop : undefined} style={tab === 'mirror' ? { '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)' } : undefined}>

        <header className="app-header">
          <button aria-label="Profile" className={"avatar-btn" + (ov === 'profile' ? ' is-on' : '')} onClick={() => { if (ov === 'profile') { setOv(null); } else { closeAll(); setOv('profile'); } }}>
            {ov === 'profile' ? '✕' : (liveInitials != null ? liveInitials : me.initials)}
          </button>
          {/* Under `pill`, the header IS the mode switcher: DailySplit portals
              its World/Group/1v1 row into this slot, which is why the feed has
              no second tab row. The slot must be a plain empty div — the
              portal target is looked up by id at mount.

              Under `ruler` (the shipping nav) the switcher is in flow instead,
              and this centre carries the wordmark until the ruler scrolls
              away — then the two crossfade and a compact ruler takes over. */}
          {tab === 'track' && navMode === 'pill' ? <div className="h-modeslot" id="daily-mode-slot"></div> : (
            <div className="h-center">
              <div className="h-title">in<em>Sight</em></div>
              {tab === 'track' && navMode === 'ruler' && t.dockRuler !== false && (
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
              {/* The key carries the nav shape as well as the reset counter:
                  `ruler` and `dock` decide which listeners DailySplit installs
                  at mount, so flipping either from the Tweaks panel has to
                  remount it rather than leave a stale watcher behind. */}
              {tab === 'track' && <DailySplit key={dailyKey + ':' + navMode + ':' + (t.dockRuler !== false)}
                mode={dailyMode} onMode={setDailyMode} onDock={setDocked}
                hideSwitcher={navBar} ruler={navMode === 'ruler'} dock={t.dockRuler !== false}
                feedHier={!!t.feedHier} feedOpts={{ hier: !!t.feedHier }} />}
              {/* The prototype drove the sparse first-run mirror from a Tweaks
                  switch (`mirrorFirstRun`); the panel that hosted it is gone.
                  Gate it on the real signal instead — feed-read's header names
                  it: the sparse Mirror uses the answer count to know how well
                  the feed has read you. 8 matches MFSparse's `need`. Live
                  builds only: the demo keeps the prototype's default (full
                  field), so style-diff still compares like with like. */}
              {tab === 'mirror' && <MirrorTab onPerson={setPerson} pop={mirrorPop} onPop={(v) => setTweak('mirrorPop', v)} worldZoom={worldZoom} onZoom={(v) => setTweak('worldZoom', v)}
                firstRun={!!(window.LIVE && window.LIVE.enabled && window.FEEDREAD && window.FEEDREAD.stats().n < 8)}
                topNav={!!t.mirrorLensTop} backKey={'track:duo'} />}
            </div>
          </ErrorBoundary>
        </div>

        {/* Tabbar */}
        <nav className="tabbar" data-n={navBar ? 4 : 2}>
          <div className="tab-group">
            {navBar ? NAV_ONE.map((it) => (
              <button key={it.key} className={"tab-btn" + (navKey === it.key ? ' is-active' : '')}
                onClick={() => {
                  if (navKey !== it.key) HAPTIC.tick();
                  markNav();
                  closeAll();
                  if (it.tab === 'mirror') { setTab('mirror'); setTweak('mirrorPop', 'you'); return; }
                  setDailyMode(it.mode); setTab('track');
                }}>
                <span className="glyph"><NavGlyph id={it.glyph} active={navKey === it.key} /></span>
                <span>{it.label}</span>
              </button>
            )) : TABS.map(({ id, label }) => (
              <button key={id} className={"tab-btn" + (tab === id ? ' is-active' : '')}
                onClick={() => {
                  if (tab !== id) HAPTIC.tick();
                  markNav();
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
          {/* samplePeople: the overlay's people rows are sample-data personas
              with invented relationships ("sister", "% match"), so they must
              not render in live mode — the gate rides down as a prop from the
              liveOn this shell already computes, rather than a window.LIVE
              read in the overlay, so the spec layer's coupling meter (D39
              rule 4) stays flat. This said "live mode has no person graph at
              all (D3)" until D200; D101 gave it one, and what the gate is
              about is that these particular people are made up. */}
          {ov === 'search' && <SearchOverlay onClose={() => setOv(null)} samplePeople={!liveOn} onPerson={(p) => { setOv(null); setPerson(p); }} onCity={(c) => { setOv(null); setCity(c); }} />}
          {ov === 'logic' && window.LogicOverlay && <window.LogicOverlay onClose={() => setOv(null)} />}
          {/* The one overlay here NOT read off window, though its module is
              deferred like the rest (D200). Reachable only from the embedded
              map's own expand button — which exists only once the chunk that
              defines this component has loaded — so `ov` cannot be 'relmap'
              with the name unbound. If a second opener ever appears it must
              go through openDeferred like the others, and this line becomes
              `window.RelationshipMapOverlay && …`; until then the
              ErrorBoundary above is the backstop rather than the plan. */}
          {ov === 'relmap' && <RelationshipMapOverlay onClose={() => setOv(null)} />}
        </ErrorBoundary>
      </div>

      <TweaksPanel>
        <TweakSection label="Navigation" />
        <TweakRadio label="Nav" value={navMode} options={['ruler', 'pill', 'bar']} onChange={(v) => setTweak('navMode', v)} />
        <TweakToggle label="Ruler docks on scroll" value={t.dockRuler !== false} onChange={(v) => setTweak('dockRuler', v)} />
        <TweakToggle label="Mirror: lenses on top" value={!!t.mirrorLensTop} onChange={(v) => setTweak('mirrorLensTop', v)} />
        <TweakToggle label="Feed hierarchy" value={!!t.feedHier} onChange={(v) => setTweak('feedHier', v)} />
        <TweakSection label="Aesthetic" />
        <TweakRadio label="Accents" value={t.accents || 'now'} options={['now', 'daily', 'family']} onChange={(v) => setTweak('accents', v)} />
        <TweakToggle label="Quiet ground" value={t.quietGround !== false} onChange={(v) => setTweak('quietGround', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular']} onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Lens tabs" value={t.lensStyle || 'segmented'} options={['segmented', 'underline', 'chips']} onChange={(v) => setTweak('lensStyle', v)} />
        <TweakRadio label="Type marks" value={t.markStyle || 'slice'} options={['slice', 'ring', 'dots']} onChange={(v) => setTweak('markStyle', v)} />
        <TweakToggle label="Lenses: boxed cards" value={!!t.lensBoxed} onChange={(v) => setTweak('lensBoxed', v)} />
        <TweakSection label="Daily" />
        <TweakButton label="Reset today's answers" secondary onClick={() => { DUELS.resetToday(); setDailyKey((k) => k + 1); }} />
        <TweakSection label="World feed" />
        <TweakRadio label="Palette" value={t.wpal || 'full'} options={['full', 'family', 'one']} onChange={(v) => setTweak('wpal', v)} />
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
;globalThis.NAV_ONE = typeof NAV_ONE === 'undefined' ? globalThis.NAV_ONE : NAV_ONE;
;globalThis.DOCK_STOPS = typeof DOCK_STOPS === 'undefined' ? globalThis.DOCK_STOPS : DOCK_STOPS;
