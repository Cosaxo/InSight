// Ported from design/InSight_standalone_17.html (haptics.js). THIS file is the
// live source now, hand-edits and all.
//
// A NEW module, so it never joined the shared-global bridge: `HAPTIC` is an
// ordinary named export and its consumers import it (D39's "convert on
// touch"). It still appears in spec-index.js because check:globals rule 2
// requires every file in spec/ to be listed there.

// haptics.js — the difference between a web page and an app.
//
// Three weights, used sparingly: a tap for committing something, a tick for
// passing through something (tab, chip, step), a reveal for the moment the
// crowd's answer lands. Anything more and the phone buzzes like a toy.
//
// Silent where unsupported (desktop, iOS Safari) and silent under
// prefers-reduced-motion — a vibration is motion.
export const HAPTIC = (function () {
  const can = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  let quiet = false;
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    quiet = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', (e) => { quiet = e.matches; });
  } catch { /* matchMedia is absent in some embedded webviews — stay silent. */ }
  function go(p) { if (!can || quiet) return; try { navigator.vibrate(p); } catch { /* a vibrate the OS refuses is not an error worth surfacing. */ } }
  return {
    tick: () => { go(8); },              // passing through
    tap: () => { go(14); },              // committed
    reveal: () => { go([0, 12, 70, 22]); }, // the crowd arrives
    off: () => !can,
  };
})();
