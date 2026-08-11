// InSight v2 entry — the ported standalone_9 spec running under Vite.
// The spec modules communicate through the shared global scope (a faithful
// stand-in for the prototype's babel-standalone script tags); spec-index.js
// loads them in the original order, then App is picked up from globalThis.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadWorldFeed, loadOverlays } from './spec-index.js';
import { initLive } from './data/live';
// side effect: publishes window.registerBackHandler for the shell
import './data/back';
// side effect: publishes globalThis.PLACES for the profile's city picker.
// Import only — the ~269 KB catalogue itself is fetched lazily on first
// open, so this costs nothing on a cold start.
import './data/places';
import { reportError, sentryInit } from '../lib/sentry';
import { initDeepLinks } from './data/links';

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
  root.render(<App />);

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
    () => root.render(<App />),
    (err) => reportError(err, { where: 'loadWorldFeed' }),
  );

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
  // Started AFTER loadWorldFeed rather than alongside it: both are pure
  // parse-and-eval off local disk in a native package, so they contend for
  // the same main thread, and the feed is the one a user reaches first.
  loadOverlays().catch((err) => reportError(err, { where: 'loadOverlays' }));
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
