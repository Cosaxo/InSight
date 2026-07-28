// Ported from design/InSight_standalone_13.html (reveal-clock.js). THIS file
// is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// reveal-clock.js — one live countdown to the daily reveal (local midnight).
// Only the newest card wears it; everything else stays quiet.
//
// Local midnight, deliberately, even though the reveal is keyed on a UTC day
// (`utcDayKey`, functions/src/v2social.ts). The two disagree by up to 14
// hours, so this is a "your evening is nearly over" cue rather than a
// promise about the server. Consumers word it that way — "reveals in 4h",
// never "reveals at 00:00" — and the reveal itself stays server-materialised
// (D5). If this ever needs to be exact, it has to read the UTC boundary and
// the group's reveal schedule, not the device clock.
(function () {
  function msToMidnight() {
    const now = new Date();
    const n = new Date(now);
    n.setHours(24, 0, 0, 0);
    return n - now;
  }
  function fmt(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(m / 60);
    return h > 0 ? h + 'h ' + (m % 60) + 'm' : m + 'm';
  }
  function RevealClock({ prefix = 'Reveals in', suffix = '', style }) {
    const [, bump] = React.useReducer((x) => x + 1, 0);
    // 30s cadence: the display's finest unit is a minute, so anything faster
    // is a re-render nobody can see. One interval per mounted clock, and only
    // the newest card mounts one.
    React.useEffect(() => {
      const t = setInterval(bump, 30000);
      return () => clearInterval(t);
    }, []);
    return React.createElement('span', { style }, prefix + ' ' + fmt(msToMidnight()) + suffix);
  }
  window.RevealClock = RevealClock;
})();
