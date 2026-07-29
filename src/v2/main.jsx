// InSight v2 entry — the ported standalone_9 spec running under Vite.
// The spec modules communicate through the shared global scope (a faithful
// stand-in for the prototype's babel-standalone script tags); spec-index.js
// loads them in the original order, then App is picked up from globalThis.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './spec-index.js';
import { initLive } from './data/live';
// side effect: publishes window.registerBackHandler for the shell
import './data/back';
// side effect: publishes globalThis.PLACES for the profile's city picker.
// Import only — the ~269 KB catalogue itself is fetched lazily on first
// open, so this costs nothing on a cold start.
import './data/places';
// side effect: publishes globalThis.LOCATE for the picker's location button.
import './data/locate';
import { sentryInit } from '../lib/sentry';

// Crash reporting first, so a boot error is the first thing captured.
// No-op without VITE_SENTRY_DSN and honours the local telemetry opt-in.
sentryInit();

// Live mode (VITE_V2_LIVE=true + Firebase config) hydrates before first
// render so the daily deck opens on real questions; on timeout or any
// boot failure the mock deck renders instead and live can attach later.
initLive().finally(() => {
  const App = globalThis.App;
  createRoot(document.getElementById('root')).render(<App />);
  // Native: drop the splash only now that real content is painted —
  // launchAutoHide is off so hydration happens behind the splash
  // instead of a blank WebView (capacitor.config.ts).
  import('@capacitor/core').then(({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return;
    return import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide());
  }).catch(() => { /* web or plugin unavailable — nothing to hide */ });
});
