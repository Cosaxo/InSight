// Ported from design/InSight_standalone_15.html (learn-feed.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import { LEARN } from './learn-progress.js';

// learn-feed.js — knowledge questions as a stream in the World feed rather than
// a room of their own. The feed turns out to be a better spacing engine than a
// study session: repetition wants gaps, and a session is massed practice. A feed
// you open daily spaces the three-in-a-row rule for free.
//
// Frequency is coarse and lives where follows live. It is deliberately not a
// slider: the number of knowledge fields you follow is already an intensity
// control, and a continuous dial is a settings-shaped answer to a design
// question — almost nobody moves it, so the default is the product.
export const LEARN_FEED = (function () {
  const LS = 'insight.learnFreq.v1';
  const RATE = { off: 0, some: 7, lots: 3 };   // one knowledge card every N feed cards
  let f = 'some';
  try { const v = localStorage.getItem(LS); if (v && RATE[v] !== undefined) f = v; } catch (e) { /* absent or corrupt payload — keep the default above */ }
  const subs = new Set();
  const toQ = (c) => ({ id: 'lrn-' + c.id, type: 'know', learn: c.id, f: c.f, cat: 'lrn-' + c.f, prompt: c.q, options: c.a.map((t) => ({ label: t, count: 0 })) });
  // The purge (data/live.ts, D51): a frequency is thin as personal data
  // goes, but it is still the previous account's setting — drop to the
  // default the purged key loads as. Directly on `f`, not via setFreq():
  // that would write the key the purge just removed straight back.
  window.addEventListener('insight:local-purge', () => { f = 'some'; subs.forEach((fn) => { try { fn(); } catch (e) { /* one listener throwing must not stop the others */ } }); });
  return {
    LEVELS: ['off', 'some', 'lots'],
    freq: () => f,
    setFreq: (v) => { if (RATE[v] === undefined) return; f = v; try { localStorage.setItem(LS, v); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } subs.forEach((fn) => { try { fn(); } catch (e) { /* a subscriber that throws must not stop the others — one broken listener would silence the store for every screen watching it. NOT storage: the comment here said localStorage for years, pasted from the save() above. */ } }); },
    every: () => RATE[f],
    // n cards from the fields you follow, minus any chip you've muted
    cards: (n, muted) => {
      if (!RATE[f] || n <= 0) return [];
      const live = LEARN.mine().filter((fd) => !muted || muted['lrn-' + fd.id] !== false).map((fd) => fd.id);
      if (!live.length) return [];
      const out = [], seen = {};
      // Answerable cards only: fresh, or a repeat the scheduler is ready to
      // credit (LEARN.due — the waited-out GAP repeat and the check-in). plan()'s
      // slow/warm fallbacks exist so the standalone next() never runs dry,
      // but in the feed they re-served cards whose next answer could not
      // count yet — which rendered as last sitting's reveal, frozen (D95).
      // Fewer than n cards back is the honest result of a thin pool.
      LEARN.plan(n * 4).forEach((c) => { if (out.length < n && !seen[c.id] && live.indexOf(c.f) >= 0 && (!LEARN.stateOf(c.id) || LEARN.due(c.id))) { seen[c.id] = 1; out.push(toQ(c)); } });
      return out;
    },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
  };
})();
