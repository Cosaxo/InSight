// Ported from design/InSight_standalone_13.html (feed-read.js). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// feed-read.js — the feed's memory.
//
// Every answered question logs one bit: did you land with the crowd (and, on
// predict cards, did you call the split). That lets the feed show a running
// strip of your last answers, spot a streak, and name a pattern back to you —
// so votes accumulate into something instead of evaporating.
//
// Everything here is YOUR OWN answers, held in localStorage on your device.
// It reports no one else's behaviour, so it needs no k-anonymity floor and no
// server surface: the honest half of the prototype's "read the room".
//
// DELIBERATELY NOT PORTED: the prototype's `feedInsight()`, which picked "the
// most surprising split" out of demographic rows — women vs men, left vs
// right. Those rows are `hash(qid:dim:bucket)` in the prototype: invented, to
// make a demo room feel populated. Shipping them would put fabricated
// population statistics behind a product whose claim is that its counts are
// real and k-floored. The idea is a good one and is planned properly (real
// per-anchor aggregation with a floor per cell, inside the existing
// v2_aggs_private doc so D7's write ceiling does not move) — it just cannot
// be lifted from the prototype, so it is not here.
(function () {
  const LS = 'insight.readRoom.v1';
  const subs = [];
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(LS) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch { return {}; }
  }
  let S = load();
  if (!Array.isArray(S.log)) S.log = [];
  function save() {
    try { localStorage.setItem(LS, JSON.stringify(S)); } catch { /* best-effort: private mode, quota */ }
    subs.forEach((f) => { try { f(); } catch { /* one bad listener must not stop the others */ } });
  }

  window.FEEDREAD = {
    // maj = you were with the majority · pred = you called the winner
    // (null when the card had no predict stage). First write per question
    // wins — answers are immutable server-side (D5), so the memory of one
    // must be too, or the strip and the aggregate could tell different
    // stories about the same vote.
    log(id, rec) {
      if (S.log.some((r) => r.id === id)) return;
      S.log.push({ id, maj: !!rec.maj, pred: rec.pred == null ? null : !!rec.pred });
      // 80 is ~9 strips of history: enough for every streak this reads, and
      // small enough that the JSON stays trivial to parse on every boot.
      if (S.log.length > 80) S.log = S.log.slice(-80);
      save();
    },
    stats() {
      const L = S.log, n = L.length;
      const withMaj = L.filter((r) => r.maj).length;
      let streak = 0, majStreak = 0;
      for (let i = L.length - 1; i >= 0; i--) { if (!L[i].maj) streak++; else break; }
      for (let i = L.length - 1; i >= 0; i--) { if (L[i].maj) majStreak++; else break; }
      const preds = L.filter((r) => r.pred != null);
      return {
        n, withMaj, rate: n ? withMaj / n : 0, streak, majStreak,
        recent: L.slice(-9),
        predN: preds.length, predHit: preds.filter((r) => r.pred).length,
      };
    },
    // a named pattern retires once acknowledged, so the feed cannot nag
    dismissed(k) { return !!(S.seen && S.seen[k]); },
    dismiss(k) { S.seen = S.seen || {}; S.seen[k] = 1; save(); },
    reset() { S = { log: [] }; save(); },
    subscribe(f) {
      subs.push(f);
      return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); };
    },
  };
})();
