// Ported from design/spec-modules/passive-progress.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
//
// CONVERTED off the shared-global bridge (D39): `PASSIVE` is a named export
// and this file publishes nothing to globalThis. `window.LIVE` stays a
// global read — data/live.ts's published surface, which is the convention
// working as intended.
//
// This module was the real half of src/v2/README.md's cycle warning, and it
// was a multi-writer artifact rather than a dependency: its one reference
// into daily-split.jsx was reading IS_TEST_RESULTS, which daily-split also
// ASSIGNED — in a fallback branch that only ran when test-definitions.js had
// not loaded. Importing the name from its real owner removed the edge, and
// converting test-definitions.js made that fallback dead code, so it went too.
import React from 'react';
import { IS_TESTS, IS_TEST_RESULTS } from './test-definitions.js';

// passive-progress.js — progress for the four core tests. Only a test's OWN
// questions count: they surface as marked cards in the World feed (TEST_FEED_QS)
// or get answered in the test itself. Regular feed questions carry no signal.
// Staggered demo seeds included. Plain script.
export const PASSIVE = (function () {
  const LS = 'insight.passive.v1';
  const META = {
    big5:       { label: 'Big 5',    accent: 'var(--c-around)' },
    political:  { label: 'Politics', accent: 'var(--c-world)' },
    values:     { label: 'Values',   accent: 'var(--c-people)' },
    attachment: { label: 'Social',   accent: 'oklch(0.52 0.13 320)' },
  };
  const KEYS = Object.keys(META);
  // demo stagger: how many of each test's own questions you've already answered
  const DEMO_SEED = { big5: 1, political: 0.7, values: 0.45, attachment: 0.2 };
  // live mode starts every test at its real zero — the stagger exists
  // only so the demo shows all progress states at once
  const SEED = new Proxy(DEMO_SEED, {
    get(t, k) { return (window.LIVE && window.LIVE.enabled) ? 0 : t[k]; },
  });
  let st = load();
  const subs = [];
  function load() {
    try { const v = JSON.parse(localStorage.getItem(LS) || '{}'); return { seen: (v && v.seen) || {}, full: (v && v.full) || {} }; }
    catch (e) { return { seen: {}, full: {} }; }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch { /* best-effort */ } }
  // The `(window.IS_TESTS || {})` guard here was a load-order guard, not a
  // missing-data one — an imported binding cannot be unset, so it is gone.
  // The inner `T && T.questions` stays: that guards an unknown test key.
  function needed(k) { const T = IS_TESTS[k]; return T && T.questions ? T.questions.length : 0; }
  function explicitN(k) {
    try { const p = JSON.parse(localStorage.getItem('insight.testProgress.v1') || '{}')[k]; return p && Array.isArray(p.answers) ? p.answers.length : 0; }
    catch (e) { return 0; }
  }
  function passiveDone(k) {
    const n = needed(k);
    const extra = Object.keys(st.seen).filter((id) => st.seen[id] === k).length;
    return Math.min(n, Math.round((SEED[k] || 0) * n) + extra);
  }
  // explicit fast-path progress embeds the passive prefix, so take the max
  function done(k) { const n = needed(k); if (st.full[k] || (SEED[k] || 0) >= 1) return n; return Math.min(n, Math.max(passiveDone(k), explicitN(k))); }
  function pct(k) { const n = needed(k); return n ? Math.round(done(k) / n * 100) : 100; }
  function complete(k) { return needed(k) > 0 && done(k) >= needed(k); }
  // only cards carrying q.test (a test's own question) map to a test
  function testFor(q) { return q && q.test && META[q.test] ? q.test : null; }
  function seedCount(k) { return Math.round((SEED[k] || 0) * needed(k)); }
  // a test question in the feed was answered — one more of that test done
  function record(q) {
    const k = testFor(q);
    if (!k || !META[k] || !q.id) return null;
    if (st.seen[q.id] != null) return null;
    st.seen[q.id] = k; save(); notify();
    return k;
  }
  // synthesize likert answers for the already-answered stretch from the saved
  // result, so a resumed fast path scores consistently
  function prefill(k) {
    const T = IS_TESTS[k]; if (!T) return [];
    const R = IS_TEST_RESULTS[k];
    const dimV = {}; if (R && R.dims) R.dims.forEach((d) => { dimV[d.id] = d.value; });
    return T.questions.slice(0, passiveDone(k)).map((q) => {
      const v = dimV[q.d] != null ? dimV[q.d] : 50;
      let a = Math.round(v / 25); if (q.invert) a = 4 - a;
      return Math.max(0, Math.min(4, a));
    });
  }
  function markComplete(k) { if (!st.full[k]) { st.full[k] = true; save(); notify(); } }
  function subscribe(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
  function notify() { subs.forEach((f) => { try { f(); } catch { /* best-effort */ } }); }
  // The purge (data/live.ts, D50): the key is already gone; drop the
  // in-memory seen/full maps too, or the next record()'s save() writes the
  // previous account's test progress back under the new uid — inflating the
  // new account's rings with answers it never gave. notify() without
  // save(): do not re-create the purged key.
  window.addEventListener('insight:local-purge', () => { st = { seen: {}, full: {} }; notify(); });
  return { META, KEYS, needed, done, passiveDone, pct, complete, testFor, seedCount, record, prefill, markComplete, subscribe, poke: notify };
})();

