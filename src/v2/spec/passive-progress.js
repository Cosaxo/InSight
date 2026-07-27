/* eslint-disable */
// ported from design/spec-modules/passive-progress.js — do not hand-edit load order assumptions
import React from 'react';

// passive-progress.js — progress for the four core tests. Only a test's OWN
// questions count: they surface as marked cards in the World feed (TEST_FEED_QS)
// or get answered in the test itself. Regular feed questions carry no signal.
// Staggered demo seeds included. Plain script.
window.PASSIVE = (function () {
  const LS = 'insight.passive.v1';
  const META = {
    big5:       { label: 'Big 5',    accent: 'var(--c-around)' },
    political:  { label: 'Politics', accent: 'var(--c-world)' },
    values:     { label: 'Values',   accent: 'var(--c-people)' },
    attachment: { label: 'Social',   accent: 'oklch(0.58 0.12 320)' },
  };
  const KEYS = Object.keys(META);
  // demo stagger: how many of each test's own questions you've already answered
  const SEED = { big5: 1, political: 0.7, values: 0.45, attachment: 0.2 };
  let st = load();
  const subs = [];
  function load() {
    try { const v = JSON.parse(localStorage.getItem(LS) || '{}'); return { seen: (v && v.seen) || {}, full: (v && v.full) || {} }; }
    catch (e) { return { seen: {}, full: {} }; }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} }
  function needed(k) { const T = (window.IS_TESTS || {})[k]; return T && T.questions ? T.questions.length : 0; }
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
    const T = (window.IS_TESTS || {})[k]; if (!T) return [];
    const R = (window.IS_TEST_RESULTS || {})[k];
    const dimV = {}; if (R && R.dims) R.dims.forEach((d) => { dimV[d.id] = d.value; });
    return T.questions.slice(0, passiveDone(k)).map((q) => {
      const v = dimV[q.d] != null ? dimV[q.d] : 50;
      let a = Math.round(v / 25); if (q.invert) a = 4 - a;
      return Math.max(0, Math.min(4, a));
    });
  }
  function markComplete(k) { if (!st.full[k]) { st.full[k] = true; save(); notify(); } }
  function subscribe(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
  function notify() { subs.forEach((f) => { try { f(); } catch (e) {} }); }
  return { META, KEYS, needed, done, passiveDone, pct, complete, testFor, seedCount, record, prefill, markComplete, subscribe, poke: notify };
})();

