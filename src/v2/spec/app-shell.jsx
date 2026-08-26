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
import { useTweaks } from '../data/tweaks.jsx';
import { reportError } from '../../lib/sentry';
// The typed cue that opens the Map on a branch (v28 §5, D207 — the shape
// window.goTrends would have been): the caller stores WHERE, this shell
// answers with the navigation, map-tab reads the where. ESM on all three
// sides, so the coupling ratchet never counts it.
import { onMapCue } from '../data/mapCue.ts';
import LIVE from '../data/live';
import { patternsEarned } from '../data/patternsReady';
import { closeTopBackLayer } from '../data/backLayers';
import { registerNav } from '../data/nav';
// The buyer's room (PAID-PLAN §7, D288) — its own lazy chunk, not part of
// the spec overlay group: typed, and nothing on first paint pays for it.
const AskedByYouLazy = React.lazy(() => import('../ui/AskedByYouOverlay'));
// R2/D270: the anonymous feature tally — a no-op until initLive arms it,
// so every demo mount and jsdom suite stays silent without a test flag.
import * as engagement from '../data/engagement';
import { useDialog } from './primitives.jsx';

// The third tab, ON TRIAL (D166 §1) and MOUNTED ON THE DATA (D265) — lazy
// by requirement, not taste: check:bundle has no eager headroom, and the
// trial clause wants the reversal to be one import site and one TABS
// entry. React.lazy is the same pattern daily-split uses for its typed
// panels; the chunk loads on the first visit to the tab and never before —
// which, since D265, is the first visit a gate opened for.
//
// D217 unmounted this outright for the v1 release and priced the remount
// at three joints; this is the first of them. It comes back conditional
// rather than unconditional: `usePatternsTab` below decides whether the
// tab exists at all, from what the nightly fit has published and what the
// viewer has answered (data/patternsReady.ts). Below that line the entry
// is not in TABS, so nothing here ever renders and the chunk never loads.
const PatternsTabLazy = React.lazy(() => import('../ui/PatternsTab.tsx'));

// The Tweaks panel is DESIGN-TIME tooling and production cannot open it —
// its only setOpen(true) is behind `if (!import.meta.env.DEV) return`. It
// used to share a module with useTweaks, so ~11.8 KB of controls, drag
// handling and a 6.7 KB stylesheet string rode into the ENTRY chunk, where
// check:bundle has the least headroom in the repo (D223).
//
// The ternary is what makes it free: `import.meta.env.DEV` is a literal at
// build time, so a production build has no import of src/dev/ at all and
// rolldown drops the file whole rather than emitting an unreachable chunk.
const DevTweaks = import.meta.env.DEV
  ? React.lazy(() => import('../../dev/TweaksPanel.jsx').then((m) => ({
    default: function DevTweaksBody({ t, setTweak, onResetToday }) {
      return (
        <m.TweaksPanel>
          <m.TweakSection label="Display" />
          <m.TweakRadio label="Density" value={t.density} options={['compact', 'regular']}
            onChange={(v) => setTweak('density', v)} />
          <m.TweakSection label="Daily" />
          <m.TweakButton label="Reset today's answers" secondary onClick={onResetToday} />
        </m.TweaksPanel>
      );
    },
  })))
  : null;

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
  if (id === 'patterns') {
    // A small constellation — places joined by their ties, one inked
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <path d="M6 17.5 L11.5 8.5 L18.5 13.5"></path>
        <path d="M6 17.5 L18.5 13.5" strokeDasharray="1.5 2"></path>
        <circle cx="6" cy="17.5" r="1.6" fill={stroke} stroke="none"></circle>
        <circle cx="18.5" cy="13.5" r="1.6" fill={stroke} stroke="none"></circle>
        <circle cx="11.5" cy="8.5" r="2.6" fill={active ? 'var(--ink)' : 'transparent'} fillOpacity="0.14"></circle>
        <circle cx="11.5" cy="8.5" r="1.6" fill={active ? stroke : 'none'} stroke={stroke}></circle>
      </svg>
    );
  }
  // 'groups' and 'duo' glyphs left with the bar nav (v28 §10) — only the
  // tab bar renders glyphs, and it knows 'patterns', 'track' and 'mirror'.
  return null;
}

// The bar: daily · mirror, and patterns in front of them once the data
// can carry it (D265). v28 §1 wanted three with the daily in the middle so
// a swipe either way lands somewhere; D217 unmounted the third for the v1
// release; this is that entry back, on a condition instead of on a flag.
//
// TWO LISTS RATHER THAN A FILTER, because the bar's own arithmetic reads
// the list — `TABS.length`, `TABS.some`, `TABS.map` — and a list with a
// hole in it is the shape that ends up rendering a gap. `tabsFor` is the
// only place that decides, and every consumer takes what it returns.
// (Internal ids keep their historical names; only labels are user-facing.)
const TABS_CORE = [
  { id: 'track',  label: 'daily'  },
  { id: 'mirror', label: 'mirror' },
];
const PATTERNS_TAB = { id: 'patterns', label: 'patterns' };
const tabsFor = (patternsOpen) => (patternsOpen ? [PATTERNS_TAB, ...TABS_CORE] : TABS_CORE);

const MIRROR_POP_IDS = ['you', 'circle', 'groups', 'near', 'world'];
const WORLD_ZOOM_IDS = ['city', 'country', 'world'];

// The one nav-key axis: any tab-or-mode destination, from anywhere. The bar
// nav that rendered these as buttons left with the v28 teardown (§10); the
// entries survive because goNav (below, registered into data/nav) and the
// swipe gestures still
// address the app by these keys.
const NAV_ONE = [
  // Refused while the gate is shut — goNav checks the live tab list, so a
  // stale caller (a remembered gesture, an old deep link) lands nowhere
  // rather than on a tab that is not in the bar.
  { key: 'patterns',    tab: 'patterns'              },
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
    // …and the tally counts it (R2/D270): Sentry holds the crash EVENT,
    // the shard holds the anonymous denominator a crash RATE needs.
    engagement.note('errors');
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

// The update-required blocker (D250) — its own component because
// `useDialog` is a hook and this dialog renders conditionally.
//
// WHAT THE HOOK ADDS THAT HAND-WRITTEN ARIA COULD NOT. This had
// `role="dialog" aria-modal="true" aria-label` and an `autoFocus`, so it
// announced itself correctly and took focus — and then TAB WALKED STRAIGHT
// OUT of it into the app behind, which is still fully in the DOM under an
// absolutely positioned overlay. Focus containment is runtime behaviour, so
// `jsx-a11y` cannot see it and `check:a11y` reported this file as one
// deliberate `autoFocus` and nothing else. D24 gave the eight overlays
// `useDialog` for exactly this; the blocker was written inline and missed
// the sweep.
//
// `onClose` is a NO-OP on purpose. There is nothing to close to — the
// server has said this build may not talk to it — and `useDialog` wires
// Escape to `onClose`, so passing an empty function is what makes Escape
// swallowed rather than dismissing a blocker the user cannot re-summon.
//
// `autoFocus` is gone with it, and that is a fix rather than a removal:
// the hook focuses the first focusable inside on mount (this button) and
// restores focus to the opener on unmount, which the prop never did.
// Exported for `test/dialog.test.jsx`, which asserts the trap this exists
// for. Not published to global scope: nothing renders it but `App` below.
export function UpdateRequiredBlocker() {
  const dlg = useDialog(() => {}, 'Update required');
  return (
    <div {...dlg} style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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
  );
}

/**
 * Whether the Patterns tab exists in this session (D265).
 *
 * The tab is absent until the nightly fit has published enough to draw
 * and the viewer has answered enough to be drawn in it — both numbers
 * come off `LIVE.patternsSignal()` for free, and `data/patternsReady.ts`
 * holds the verdict and the reasoning for each threshold.
 *
 * ONCE EARNED IT STAYS, FOR THIS ACCOUNT. Crossing the floor is
 * remembered (`patternsEarned`, data/patternsReady.ts) rather than
 * recomputed from scratch on every launch, and the reason is not the
 * flicker — it is that `mine` is NOT the monotone quantity it looks like.
 * The device counts answers against the bank it is holding, and a
 * question can LEAVE that bank: `active: false` is the question farm's
 * own recommendation for a landslide, which is exactly a question most
 * people have already answered. Recomputed every launch, retiring one
 * could take the tab back off someone who had it yesterday, while the
 * fit's own count — which never prunes — was unchanged. The memory is
 * account state like any `insight.*` key and goes with the purge.
 *
 * WHICH IS ALSO THE ONE THING THAT CLOSES THE GATE. `purgeLocalTrace`
 * fires `insight:local-purge` on deletion and on a uid change, with no
 * reload behind it (data/live.ts), and `resetForNewUid` empties the vote
 * mirror in place. Without this arm the next account would inherit a tab
 * it has not earned — zero answers, an Oracle with no evidence, and "you"
 * at the origin of the People lens, which is precisely what the gate
 * exists to refuse.
 *
 * On a first launch the initial read runs before boot, and boot is what
 * fills both numbers: `hydrate()` reads the meta document and the vote
 * mirror, then calls `notify()`. So a first cold start paints two tabs
 * and the third arrives with the rest of the live data — the behaviour
 * the owner asked for, said out loud: it appears when there is enough.
 * Later launches paint three from the first frame.
 */
function usePatternsTab() {
  const [open, setOpen] = useState(() => patternsEarned(LIVE.patternsSignal()));
  useEffect(() => {
    // The purge arm runs in BOTH states — an open gate is exactly the one
    // that has to hear this.
    // The key itself is dropped by patternsReady's own arm on this same
    // event; this one drops the shell's copy of the answer.
    const shut = () => setOpen(false);
    window.addEventListener('insight:local-purge', shut);
    const off = open ? null : LIVE.subscribe(() => {
      if (patternsEarned(LIVE.patternsSignal())) setOpen(true);
    });
    // Once before the subscription can matter: boot can land between the
    // initial state and this effect, and a notify() nobody was listening
    // for is one this session would never hear again.
    if (!open && patternsEarned(LIVE.patternsSignal())) setOpen(true);
    return () => { window.removeEventListener('insight:local-purge', shut); if (off) off(); };
  }, [open]);
  return open;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const patternsOpen = usePatternsTab();
  const TABS = tabsFor(patternsOpen);
  const validTab = (id) => (TABS.some(x => x.id === id) ? id : 'track');
  const [tab, setTab] = useState(validTab(t.tab));
  // The nav effect below is mount-only and registers closures that outlive
  // this render; the tab list stopped being a constant at D265, so they
  // read it through a ref for the same reason `backState` exists.
  const tabsRef = React.useRef(TABS);
  tabsRef.current = TABS;
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
  // The gate closes in exactly one case — the account changed under us
  // (usePatternsTab's purge arm) — and a viewer standing on the tab when
  // it does would otherwise be left on one the bar no longer carries: a
  // bar with nothing marked current over a body nothing mounts. Land them
  // on the daily, which is where a purge leaves everything else.
  // `setTweak` is in the deps rather than suppressed: it is recreated every
  // render, so this runs after each one — two comparisons, and the body is
  // a no-op unless the gate just closed under someone standing on the tab.
  // A suppression here would have cost the react-hooks ratchet a line for
  // an effect that does not need one.
  useEffect(() => {
    if (!patternsOpen && tab === 'patterns') { setTab('track'); setTweak('tab', 'track'); }
  }, [patternsOpen, tab, setTweak]);

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
    // Bottom sheets first, because they sit on top of everything below —
    // a sheet can be opened FROM a person overlay, never the other way
    // round. They are not in `backState` because each Sheet holds its own
    // open state inside whichever module rendered it; data/backLayers.ts
    // is the one place that knows one is up, and what back did before it
    // existed was quit the app (its header has the path).
    if (closeTopBackLayer()) return true;
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
    const openSuggestions = () => openDeferred(() => { setOv('suggest'); });
    const openLogicTest = () => openDeferred(() => { closeAll(); setOv('logic'); });
    // The buyer's room is its own lazy chunk (React.lazy below), not part
    // of the spec overlay group — no loadOverlays() gate to await.
    const openAskedByYou = () => { setOv('askedby'); };
    // Registered (D248) rather than published: these are closures over this
    // shell's state, so the registry is what lets a consumer import a door
    // without importing the shell that owns it — see data/nav.ts on why an
    // import would have drawn a real cycle here.
    return registerNav({ openSuggestions, openLogicTest, openAskedByYou });
  }, [openDeferred]);

  useEffect(() => {
    const openOverlay = (key) => {
      if (!LIVE_OVERLAYS.includes(key)) return;
      const from = ovRef.current;
      const show = () => {
        closeAll(); setOv(key);
        setOvBack(from === 'profile' && key !== 'profile' ? 'profile' : null);
      };
      // EVERY one of these awaits the deferred chunk now, and the comment
      // that stood here said the opposite: "All three are eager." That
      // stopped being true at D200, which moved relmap.jsx into
      // loadOverlays while leaving it in LIVE_OVERLAYS — so
      // openOverlay('relmap') called show() with no await. It was safe only
      // by accident: the sole opener lives inside the deferred chunk
      // itself, so by the time anything could call it the chunk was loaded.
      // A second opener anywhere else would have rendered nothing, and the
      // render site is a bare identifier rather than the `window.X &&`
      // form, so it would have been a ReferenceError.
      //
      // Awaiting unconditionally costs an already-resolved promise for a
      // module that is already in, and removes the class of bug entirely
      // rather than tracking which member of the list is in which chunk.
      return openDeferred(show);
    };
    // Open the profile ON one of its tabs. The passive meter's rows used
    // to open the sit-down flow for an instrument; they open its profile
    // page instead, which needs a way to name the page. __profileSub is
    // the overlay's own memory of the last tab, so writing it before the
    // open is exactly what a returning visit does.
    const openProfileTab = (subId) => {
      if (typeof subId === 'string' && subId) window.__profileSub = subId;
      // The local, not the registry: this shell's own door, called
      // directly, so a teardown race cannot make it a no-op mid-flight.
      return openOverlay('profile');
    };
    const goTab = (id) => {
      closeAll();
      if (MIRROR_POP_IDS.includes(id)) { setTweak('mirrorPop', id); setTab('mirror'); return; }
      // The ref, not TABS: this closure is registered once (the effect is
      // mount-only) and the tab list is now runtime state, so reading the
      // captured list would refuse 'patterns' forever after the gate
      // opened.
      if (tabsRef.current.some(x => x.id === id)) setTab(id);
    };
    // one axis for the bottom bar: any nav key, from anywhere (swipe gestures use this)
    //
    // Answers whether it NAVIGATED (D265). Every caller but one ignores it;
    // daily-split's near-end exit does not, because a swipe that reaches
    // for a tab the gate has not opened must spring back like any other
    // edge rather than sit where the finger left it. `patterns` is the
    // only key that can be refused, and it is refused by the live tab list
    // rather than by a second copy of the condition.
    const goNav = (key) => {
      const it = NAV_ONE.find(x => x.key === key);
      if (!it) return false;
      if (!tabsRef.current.some(x => x.id === it.tab)) return false;
      // a cross-tab jump ends the gesture that caused it: trackpad momentum kept
      // arriving after the switch and stepped the daily one stop further
      markNav();
      closeAll();
      if (it.tab === 'mirror') { setTweak('mirrorPop', 'you'); setTab('mirror'); return true; }
      if (it.tab === 'patterns') { setTab('patterns'); return true; }
      setDailyMode(it.mode); setTab('track');
      return true;
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
    const openCity = (name) => {
      const c = (IS_DATA.cities || []).find(x => x.name === name);
      if (c) return openDeferred(() => { closeAll(); setCity(c); });
    };
    // cross-link: open a person's profile (record, or id/name lookup)
    const openPerson = (who) => {
      const list = IS_DATA.people || [];
      const p = typeof who === 'object' ? who : list.find(x => x.id === who || x.name === who);
      if (p) return openDeferred(() => { closeAll(); setPerson(p); });
    };
    // a Map cue lands on the Mirror's You stop; map-tab itself reads the
    // where (data/mapCue's take-once) — this shell only does the walking
    const offCue = onMapCue(() => { closeAll(); setTweak('mirrorPop', 'you'); setTab('mirror'); });
    // D248: registered, not published. `openProfileTab` joins them here —
    // it used to be assigned in this same effect and torn down with the
    // rest by name.
    const offNav = registerNav({ openOverlay, openProfileTab, goTab, goNav, openCity, openPerson });
    return () => { offCue(); offNav(); };
    // Mount-only by design: this registers the window.* cross-link
    // handlers once and tears them down on unmount. Re-running it on every
    // setTweak identity change would re-register the same closures for no
    // benefit, and the handlers read fresh state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // R2/D270: the shell's three tally seams — which tab, which Mirror
  // stop, which overlay. These are the ONLY three axes of shell state the
  // shard's vocabulary reads, and one effect per axis means each fires on
  // its own change alone. Counts, not routes: note() is a memory
  // increment on an armed live session and a no-op everywhere else.
  // (In dev, StrictMode's double-invoked effects can double a count; the
  // production build fires once, and the tally ships from production.)
  useEffect(() => {
    // Three tabs since the D265 remount, mapped by name and never by
    // elimination — a future tab counts nothing until the vocabulary
    // learns it, rather than inflating a neighbour's figure.
    const k = tab === 'mirror' ? 'tabMirror' : tab === 'patterns' ? 'tabPatterns'
      : tab === 'track' ? 'tabDaily' : null;
    if (k) engagement.note(k);
  }, [tab]);
  useEffect(() => { if (ov) engagement.note('overlays'); }, [ov]);
  useEffect(() => {
    if (tab !== 'mirror') return;
    const k = {
      you: 'stopYou', near: 'stopNear', circle: 'stopCircle', groups: 'stopGroups',
      city: 'stopCity', country: 'stopCountry', world: 'stopWorld',
    }[mirrorPop];
    if (k) engagement.note(k);
  }, [tab, mirrorPop]);

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
      <div className={appClasses} data-tab={tab} data-view={tab === 'track' ? 'track:' + dailyMode : tab === 'patterns' ? 'patterns' : 'mirror:' + mirrorPop} data-lens-style="underline" data-docked={tab === 'track' && docked ? '' : undefined} data-mpop={tab === 'mirror' ? mirrorPop : undefined} style={tab === 'mirror' ? { '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)' } : tab === 'patterns' ? { '--accent': 'var(--c-today)' } : undefined}>

        <header className="app-header">
          <button aria-label="Profile" className={"avatar-btn" + (ov === 'profile' ? ' is-on' : '')} onClick={() => { if (ov === 'profile') { setOv(null); } else { openDeferred(() => { closeAll(); setOv('profile'); }); } }}>
            {ov === 'profile' ? '✕' : (liveInitials != null ? liveInitials : me.initials)}
          </button>
          {/* The switcher is in flow (the ruler), so this centre carries the
              wordmark until the ruler scrolls away — then the two crossfade
              and a compact ruler takes over. */}
          <div className="h-center">
            <div className="h-title">
              {/* The compact iris, not the full mark: at 21px the outer
                  ring muddies (D302 — full mark above ~24px, compact
                  below). Fills are the live tokens rather than baked hex,
                  so a palette retune cannot strand this the way it
                  stranded the old icon's sienna. The wordmark span is
                  load-bearing: h-title is a flex row, and bare text here
                  would let the gap split "In" from "Sight". */}
              <svg viewBox="0 0 100 100" width="21" height="21" aria-hidden="true">
                <path d="M50 24 L72.5 37 L72.5 63 L50 76 L27.5 63 L27.5 37 Z" fill="none" stroke="oklch(0.62 0.012 70)" strokeWidth="3.4" strokeLinejoin="round"/>
                <circle cx="50" cy="24" r="10" fill="var(--c-today)"/>
                <circle cx="72.5" cy="37" r="10" fill="var(--c-people)"/>
                <circle cx="72.5" cy="63" r="10" fill="var(--c-groups)"/>
                <circle cx="50" cy="76" r="10" fill="var(--c-world)"/>
                <circle cx="27.5" cy="63" r="10" fill="var(--c-around)"/>
                <circle cx="27.5" cy="37" r="10" fill="var(--c-likeness)"/>
                <circle cx="50" cy="50" r="12.5" fill="var(--ink)"/>
              </svg>
              <span>In<em>Sight</em></span>
            </div>
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
            {/* compose — the ask-a-question door (the paid path, D288 §1),
                one tap from anywhere; same openDeferred synchronisation as
                the cross-links that reached it before it had a button */}
            <button className="icon-btn" aria-label="Ask a question" onClick={() => openDeferred(() => { closeAll(); setOv('suggest'); })}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button className="icon-btn" aria-label="Search" onClick={() => openDeferred(() => { closeAll(); setOv('search'); })}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
            </button>
          </div>
        </header>

        {liveOn && window.LIVE.updateRequired && <UpdateRequiredBlocker />}
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
              {/* Suspense fallback null, PulseCard's rule: nothing rather
                  than a blank card — the chunk arrives inside the tap's
                  own beat, and the ErrorBoundary above owns a failed one.
                  Unreachable while the gate is shut: 'patterns' is not in
                  TABS then, so no tap and no swipe can set it (D265). */}
              {tab === 'patterns' && (
                <React.Suspense fallback={null}>
                  <PatternsTabLazy />
                </React.Suspense>
              )}
            </div>
          </ErrorBoundary>
        </div>

        {/* Tabbar */}
        <nav className="tabbar" data-n={TABS.length}>
          <div className="tab-group">
            {TABS.map(({ id, label }) => (
              <button key={id} className={"tab-btn" + (tab === id ? ' is-active' : '')}
                // The app's primary navigation was the only ruler in the tree
                // with no current-tab semantics: `is-active` is a CSS class
                // and the glyph takes a prop, both invisible to a screen
                // reader. Eight other rulers use role="tab"/aria-selected and
                // seven secondary pickers use aria-current; this is the one
                // that told nobody where they were. `page` rather than `true`
                // because these are destinations, not tabs over one panel —
                // there is no tablist here and claiming one would promise
                // arrow-key navigation this does not implement.
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => {
                  if (tab !== id) HAPTIC.tick();
                  markNav();
                  // the daily's scale runs World · Circle · 1v1, with Mirror just
                  // past its far end and Patterns past the near one — so arriving
                  // from either lands on the stop that sits next to it, not on
                  // whatever you last had open
                  if (id === 'track' && tab === 'mirror') setDailyMode('duo');
                  if (id === 'track' && tab === 'patterns') setDailyMode('world');
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
          {/* Some below read their component off window rather than as a
              bare identifier: they ship in the after-first-paint overlay
              chunk (loadOverlays, spec-index.js), and a bare name would be a
              ReferenceError rather than a blank if the chunk ever failed.
              The openers await the chunk, so in practice these are never
              false while their state is set — see openDeferred above.

              `profile` and `search` joined that chunk at D223 and KEPT the
              bare identifier, deliberately: the `window.X &&` form costs two
              shared-global references where a bare name costs one, and
              check:globals rule 4 only moves down. What makes them safe is
              the same thing that makes the guard redundant — every path that
              sets `ov` now goes through openDeferred, including the two
              header buttons, so the module is in before the state that
              mounts it. */}
          {person && window.PersonOverlay && <window.PersonOverlay p={person} me={me} onClose={() => setPerson(null)} />}
          {city && window.CityOverlay && <window.CityOverlay city={city} onClose={() => setCity(null)} />}
          {ov === 'profile' && <ProfileOverlay onClose={() => setOv(null)} me={me} />}
          {ov === 'suggest' && window.SuggestOverlay && <window.SuggestOverlay onClose={() => setOv(null)} />}
          {/* null fallback like the tabs' lazies: the room's own first frame
              is its header, and a spinner in front of that is one loading
              state too many. A failed chunk lands in this ErrorBoundary. */}
          {ov === 'askedby' && (
            <React.Suspense fallback={null}>
              <AskedByYouLazy onClose={() => setOv(null)} />
            </React.Suspense>
          )}
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

      {DevTweaks && (
        <React.Suspense fallback={null}>
          <DevTweaks t={t} setTweak={setTweak}
            onResetToday={() => { DUELS.resetToday(); setDailyKey((k) => k + 1); }} />
        </React.Suspense>
      )}
    </IOSDevice>
  );
}



;globalThis.ErrorBoundary = typeof ErrorBoundary === 'undefined' ? globalThis.ErrorBoundary : ErrorBoundary;
;globalThis.App = typeof App === 'undefined' ? globalThis.App : App;
;globalThis.TWEAK_DEFAULTS = typeof TWEAK_DEFAULTS === 'undefined' ? globalThis.TWEAK_DEFAULTS : TWEAK_DEFAULTS;
