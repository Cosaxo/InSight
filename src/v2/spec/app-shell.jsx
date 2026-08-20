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
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakButton } from './tweaks-panel.jsx';
import { reportError } from '../../lib/sentry';
// The typed cue that opens the Map on a branch (v28 §5, D207 — the shape
// window.goTrends would have been): the caller stores WHERE, this shell
// answers with the navigation, map-tab reads the where. ESM on all three
// sides, so the coupling ratchet never counts it.
import { onMapCue } from '../data/mapCue.ts';

// The patterns tab is UNMOUNTED for v1 (D217) — this is the import site
// the D166 §1 trial clause priced the reversal at. ui/PatternsTab.tsx,
// the patterns data layer and the nightly fit all stand untouched;
// remounting is this React.lazy import back, the TABS entry below, and
// the near-end branch in daily-split.jsx, and the trial resumes.

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
// The v28 teardown (VISION-V28 §10) settled every judged alternative: nav is
// the ruler, marks are slices, the palette is full, lenses underline below
// the field, the ground is quiet, the feed keeps its hierarchy. Each winner
// is hardcoded at its own site now; what remains here is live state (which
// tab, which population, which zoom) plus the one surviving flag, density.
const TWEAK_DEFAULTS = {
  density: "compact",
  tab: "track",
  mirrorPop: "you",
  worldZoom: "world",
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
  // 'groups' and 'duo' glyphs left with the bar nav (v28 §10), and the
  // patterns constellation left with its tab (D217) — only the tab bar
  // renders glyphs, and it knows 'track' and 'mirror'.
  return null;
}

// Two tabs for v1: daily · mirror. v28 §1 made it three with the daily in
// the middle; the patterns entry is unmounted with its import (D217), and
// this list is where it returns.
// (Internal ids keep their historical names; only labels are user-facing.)
const TABS = [
  { id: 'track',  label: 'daily'  },
  { id: 'mirror', label: 'mirror' },
];

const MIRROR_POP_IDS = ['you', 'circle', 'groups', 'near', 'world'];
const WORLD_ZOOM_IDS = ['city', 'country', 'world'];

// The one nav-key axis: any tab-or-mode destination, from anywhere. The bar
// nav that rendered these as buttons left with the v28 teardown (§10); the
// entries survive because window.goNav (below) and the swipe gestures still
// address the app by these keys.
const NAV_ONE = [
  { key: 'track:world', tab: 'track',  mode: 'world' },
  { key: 'track:group', tab: 'track',  mode: 'group' },
  { key: 'track:duo',   tab: 'track',  mode: 'duo'   },
  { key: 'mirror',      tab: 'mirror'                },
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
    // a Map cue lands on the Mirror's You stop; map-tab itself reads the
    // where (data/mapCue's take-once) — this shell only does the walking
    const offCue = onMapCue(() => { closeAll(); setTweak('mirrorPop', 'you'); setTab('mirror'); });
    return () => { offCue(); delete window.openOverlay; delete window.goTab; delete window.goNav; delete window.openCity; delete window.openPerson; };
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

  // acc-now, quiet-ground and the ruler nav are the v28 winners (§10) —
  // literals now, not judged alternatives.
  const appClasses = `app surface-tint acc-now ${t.density || 'regular'} quiet-ground`;

  return (
    <IOSDevice width={402} height={874}>
      <div className={appClasses} data-tab={tab} data-view={tab === 'track' ? 'track:' + dailyMode : 'mirror:' + mirrorPop} data-lens-style="underline" data-docked={tab === 'track' && docked ? '' : undefined} data-mpop={tab === 'mirror' ? mirrorPop : undefined} style={tab === 'mirror' ? { '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)' } : undefined}>

        <header className="app-header">
          <button aria-label="Profile" className={"avatar-btn" + (ov === 'profile' ? ' is-on' : '')} onClick={() => { if (ov === 'profile') { setOv(null); } else { closeAll(); setOv('profile'); } }}>
            {ov === 'profile' ? '✕' : (liveInitials != null ? liveInitials : me.initials)}
          </button>
          {/* The switcher is in flow (the ruler), so this centre carries the
              wordmark until the ruler scrolls away — then the two crossfade
              and a compact ruler takes over. */}
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
              {tab === 'track' && <DailySplit key={dailyKey}
                mode={dailyMode} onMode={setDailyMode} onDock={setDocked}
                feedHier feedOpts={{ hier: true }} />}
              {/* The prototype drove the sparse first-run mirror from a Tweaks
                  switch (`mirrorFirstRun`); the panel that hosted it is gone.
                  Gate it on the real signal instead — feed-read's header names
                  it: the sparse Mirror uses the answer count to know how well
                  the feed has read you. 8 matches MFSparse's `need`. Live
                  builds only: the demo keeps the prototype's default (full
                  field), so style-diff still compares like with like. */}
              {tab === 'mirror' && <MirrorTab onPerson={setPerson} pop={mirrorPop} onPop={(v) => setTweak('mirrorPop', v)} worldZoom={worldZoom} onZoom={(v) => setTweak('worldZoom', v)}
                firstRun={!!(window.LIVE && window.LIVE.enabled && window.FEEDREAD && window.FEEDREAD.stats().n < 8)}
                backKey={'track:duo'} />}
            </div>
          </ErrorBoundary>
        </div>

        {/* Tabbar */}
        <nav className="tabbar" data-n={TABS.length}>
          <div className="tab-group">
            {TABS.map(({ id, label }) => (
              <button key={id} className={"tab-btn" + (tab === id ? ' is-active' : '')}
                onClick={() => {
                  if (tab !== id) HAPTIC.tick();
                  markNav();
                  // the daily's scale runs World · Circle · 1v1, with Mirror just
                  // past its far end — so arriving from it lands on the stop that
                  // sits next to it, not on whatever you last had open. (Patterns
                  // sat past the near end until D217 unmounted it for v1.)
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
          {ov === 'profile' && <ProfileOverlay onClose={() => setOv(null)} me={me} />}
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
        <TweakSection label="Display" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular']} onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Daily" />
        <TweakButton label="Reset today's answers" secondary onClick={() => { DUELS.resetToday(); setDailyKey((k) => k + 1); }} />
      </TweaksPanel>
    </IOSDevice>
  );
}



;globalThis.ErrorBoundary = typeof ErrorBoundary === 'undefined' ? globalThis.ErrorBoundary : ErrorBoundary;
;globalThis.App = typeof App === 'undefined' ? globalThis.App : App;
;globalThis.TWEAK_DEFAULTS = typeof TWEAK_DEFAULTS === 'undefined' ? globalThis.TWEAK_DEFAULTS : TWEAK_DEFAULTS;
