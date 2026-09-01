// InSight v2 entry — the ported standalone_9 spec running under Vite.
// The spec modules communicate through the shared global scope (a faithful
// stand-in for the prototype's babel-standalone script tags); spec-index.js
// loads them in the original order, then App is picked up from globalThis.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadWorldFeed, loadMirrorTab, loadMapTab, loadOverlays } from './spec-index.js';
import { initLive } from './data/live';
// side effect: publishes window.registerBackHandler for the shell
import './data/back';
// side effect: publishes globalThis.PLACES for the profile's city picker.
// Import only — the ~269 KB catalogue itself is fetched lazily on first
// open, so this costs nothing on a cold start.
import './data/places';
import { reportError, sentryInit } from '../lib/sentry';
import { initDeepLinks } from './data/links';
// The first-launch account wall, off unless VITE_REQUIRE_SIGNIN=true (D134).
// A pass-through in every other build, and the SCREEN behind it is a
// dynamic import — so what this line costs first paint is the decision,
// not the wall.
import SignInGate from './ui/SignInGate';

// Crash reporting first, so a boot error is the first thing captured.
// No-op without VITE_SENTRY_DSN; on by default with one, honouring the
// local telemetry opt-out (D76 — LivePrivacyPanel has the switch).
sentryInit();

// Invite-link intake: stashes a /join/CODE from the launch URL (web) and
// registers the native appUrlOpen listener. Must precede first render so
// a cold start FROM a link lands with the code already pending.
initDeepLinks();

// Live mode (VITE_V2_LIVE=true + Firebase config) hydrates before first
// render so the daily deck opens on real questions; on timeout or any
// boot failure the mock deck renders instead and live can attach later.
initLive().finally(() => {
  const App = globalThis.App;
  const root = createRoot(document.getElementById('root'));
  // Wrapped on every render below, not only the first: the root element
  // type has to stay identical or React remounts App and it loses its
  // state — the same reason the re-render after loadWorldFeed is written
  // the way it is.
  const tree = () => <SignInGate><App /></SignInGate>;
  root.render(tree());

  // The world feed (85 KB) is deliberately NOT part of that first render —
  // see loadWorldFeed() in spec-index.js. Started here rather than on the
  // first frame that wants it: the feed opens seconds later, when today's
  // card is answered, so this is a defer past first paint rather than a
  // defer until needed, and by the time it can be seen it is there.
  //
  // The re-render is not decoration. daily-split reads `window.WorldFeed`
  // during render, so a user who answers BEFORE the chunk lands would sit
  // on a feedless card with nothing scheduled to re-read the global. Same
  // element type at the root, so React reconciles and App keeps its state.
  //
  // A failed chunk costs the feed, not the app: the guard that makes this
  // lazy load possible is the same one that makes its failure survivable.
  loadWorldFeed().then(
    () => root.render(tree()),
    (err) => reportError(err, { where: 'loadWorldFeed' }),
  );

  // The Mirror (D346) — the second tab, one tap from first paint, so this
  // is a prewarm on the feed's schedule rather than a defer-until-needed:
  // started right behind the feed's fetch, and by the time a thumb reaches
  // the tab bar the namespace is remembered on data/mirrorChunk and
  // app-shell's MirrorSlot renders it in the tap's own tick. No re-render
  // from here — the slot reads the handoff on mount — and loadOverlays
  // below awaits this same promise before any overlay that reads a Mirror
  // global can open. A failed chunk costs the Mirror its body until the
  // next visit re-attempts, not the app.
  loadMirrorTab().catch((err) => reportError(err, { where: 'loadMirrorTab' }));

  // The Map (v28 §5) — the Mirror's landing stop, one tap away, so this is
  // a prewarm rather than a defer-until-needed: by the time a thumb reaches
  // the Mirror the chunk is in the module cache and mirror-tab's lazy body
  // resolves without a visible wait. No re-render needed here — the lazy
  // body holds the module in state and settles itself (unlike daily-split's
  // window.WorldFeed read above). A failed chunk costs the You stop its Map
  // until the next visit re-attempts, not the app — true of THIS loader
  // through retryable(), and true of the stop itself only since MapSlot
  // replaced a React.lazy, which cached its rejection and re-threw it on
  // every later visit.
  loadMapTab().catch((err) => reportError(err, { where: 'loadMapTab' }));

  // The six no-button overlays (~100 KB) follow, for the same reason and on
  // the same schedule: nothing on the first frame can reach any of them.
  //
  // No re-render here, unlike the feed above, and the difference is the
  // point. daily-split reads `window.WorldFeed` during a render nothing
  // would re-trigger, so the feed needs one. Every overlay in this group is
  // reachable ONLY through an app-shell opener, and those await this same
  // memoised promise before setting the state that mounts one — so the
  // await is the synchronisation and a re-render would buy nothing.
  //
  // Started AFTER loadWorldFeed rather than alongside it — and since D346
  // after the Mirror and the Map too: all of these are pure parse-and-eval
  // off local disk in a native package, so they contend for the same main
  // thread, and the order is the order a thumb reaches them. The feed is
  // under today's card, the Mirror and its Map are one tap away, every
  // overlay is two or more.
  loadOverlays().catch((err) => reportError(err, { where: 'loadOverlays' }));

  // The account-creation questions (D151) — the anchors every answer
  // snapshots (D8), asked once, at the top of a new account instead of
  // sitting four taps deep in the profile where nothing pointed at them.
  //
  // DYNAMIC, and it mounts its OWN root rather than wrapping <App />.
  // Both halves are the bundle gate's doing rather than taste: a gate
  // component would have to be imported here statically, and
  // `check:bundle` measured the decision alone at 1 KB over MAX_EAGER_KB —
  // the constant that keeps the Firestore SDK out of first paint, which
  // has no headroom and whose own note says a raise there is the thing to
  // refuse. So the decision travels with the screen, and first paint does
  // not move at all. mountProfileSetup() is a no-op for every account that
  // has answered these or been asked.
  //
  // Last of the three deferrals, not first: the feed is what a user
  // reaches for, and this screen is in front of it either way.
  import('./ui/profileSetup')
    .then((m) => m.mountProfileSetup())
    .catch((err) => reportError(err, { where: 'mountProfileSetup' }));
  // Native: drop the splash only now that real content is painted —
  // launchAutoHide is off so hydration happens behind the splash
  // instead of a blank WebView (capacitor.config.ts).
  import('@capacitor/core').then(({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return;
    // WKWebView pans the document to keep a focused input above the
    // keyboard and does not reliably pan back after dismissal — seen on
    // device: after using a city search, the fixed .native-shell (and the
    // header with it) sits shifted up under the status bar. Nothing in
    // this layout scrolls the document on purpose, so snapping to 0 on
    // every hide corrects the stray offset and can undo nothing wanted.
    import('@capacitor/keyboard')
      .then(({ Keyboard }) => Keyboard.addListener('keyboardDidHide', () => window.scrollTo(0, 0)))
      .catch(() => { /* keyboard plugin unavailable — nothing to correct */ });
    return import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide());
  }).catch(() => { /* web or plugin unavailable — nothing to hide */ });
});
