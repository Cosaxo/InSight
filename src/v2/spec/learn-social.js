// Ported from design/InSight_standalone_15.html (learn-social.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// learn-social.js — the friend layer for Learn. Deterministic per (friend, card)
// so a standing never shifts between sittings, and derived from the card's own
// crowd rate: a friend is likelier to have got an easy card right, exactly as
// the crowd is. Nothing here is stored — it is read off the friend list.
window.LEARN_SOCIAL = (function () {
  function h2(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }
  const people = () => (window.IS_DATA && window.IS_DATA.people) || [];
  function friends() {
    const F = window.FRIENDS;
    const ids = F ? F.list() : [];
    const by = {};
    people().forEach((p) => { by[p.id] = p; });
    return ids.map((id) => by[id]).filter(Boolean);
  }

  // who has answered this card, and did they get it
  function onCard(card) {
    if (!card) return [];
    // Live mode renders honest absence (the D11 structural pattern): these
    // standings are derived from demo people, and until a real friend
    // layer exists there is nothing true to show.
    if (window.LIVE && window.LIVE.enabled) return [];
    return friends()
      .filter((p) => h2(p.id + '|seen|' + card.id) < 0.62)
      .map((p) => ({ id: p.id, name: p.name, init: p.init, hue: p.hue, ok: h2(p.id + '|ok|' + card.id) < (card.p / 100) * (0.78 + h2(p.id + '|sk') * 0.5) }));
  }

  // the field standing: who else is learning it, how far each has got, and how
  // many sit level with you
  function field(fid, yourKnown) {
    const L = window.LEARN;
    if (!L) return null;
    // Same live gate as onCard — synthetic standings stay demo-only.
    if (window.LIVE && window.LIVE.enabled) return null;
    const total = L.total(fid);
    if (!total) return null;
    const rows = friends()
      .filter((p) => h2(p.id + '|f|' + fid) < 0.72)
      .map((p) => ({ id: p.id, name: p.name, init: p.init, hue: p.hue, known: Math.min(total, Math.round(total * (0.1 + h2(p.id + '|k|' + fid) * 0.98))) }))
      .sort((a, b) => b.known - a.known);
    const done = rows.filter((r) => r.known >= total).length;
    const near = rows.filter((r) => Math.abs(r.known - (yourKnown || 0)) <= Math.max(1, Math.round(total * 0.15))).length;
    return { rows, total, done, near };
  }

  return { onCard, field, friends };
})();
