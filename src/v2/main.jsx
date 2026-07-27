/* eslint-disable */
// InSight v2 entry — the ported standalone_9 spec running under Vite.
// The spec modules communicate through the shared global scope (a faithful
// stand-in for the prototype's babel-standalone script tags); spec-index.js
// loads them in the original order, then App is picked up from globalThis.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './spec-index.js';
import { initLive } from './data/live';
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
});
