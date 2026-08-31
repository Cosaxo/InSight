// Ported from design/InSight_standalone_15.html (world-feed-report.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// world-feed-report.js — reporting a take. The reason list is short on purpose:
// a long list is a form, and nobody fills in a form about a stranger. One tap
// sends it and takes the take out of your feed. Reports persist locally.
export const WF_REPORT = (function () {
  const LS = 'insight.reports.v1';
  let S = {};
  try { S = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { S = {}; }
  const listeners = new Set();
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } listeners.forEach((f) => { try { f(); } catch (e) { /* a subscriber that throws must not stop the others — one broken listener would silence the store for every screen watching it. NOT storage: the comment here said localStorage for years, pasted from the save() above. */ } }); };
  // The purge (data/live.ts, D51): drop the report history too, or the next
  // report()'s save writes the previous account's back under the new uid.
  window.addEventListener('insight:local-purge', () => { S = {}; listeners.forEach((f) => { try { f(); } catch (e) { /* best-effort */ } }); });
  return {
    REASONS: ['Abuse or hate', 'Harassment', 'Spam', 'Misleading'],
    has: (k) => !!S[k],
    reasonOf: (k) => (S[k] ? S[k].reason : null),
    report: (k, reason) => { if (k) { S[k] = { reason: reason, at: Date.now() }; save(); } },
    undo: (k) => { delete S[k]; save(); },
    count: () => Object.keys(S).length,
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
// The mirror stays for daily-split.jsx, which has not moved.
window.WF_REPORT = WF_REPORT;
