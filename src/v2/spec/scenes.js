// Ported from design/spec-modules/scenes.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA } from './sample-data.js';

// scenes.js — Scenes are the one follow list shared by the whole app: the orbit
// (Mirror) is where you see and manage them, the World feed chip row is the same
// list acting as filter. A scene is a community (members, match, vibe — defs live
// in data.js groups) that also feeds you its questions. Persisted locally.
(function () {
  const LS = 'insight.scenes.v1';
  let set = null;
  function ensure() {
    if (set) return set;
    try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); if (Array.isArray(v)) set = new Set(v); } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
    if (!set) set = new Set((IS_DATA.groups || []).filter((g) => g.joined).map((g) => g.id));
    return set;
  }
  // the broad feed topic each scene pulls general questions from
  // (null = the scene has only its own questions)
  const TOPIC = { tennis: 'sport', swim: 'sport', football: 'sport', trail: 'sport', yoga: 'sport', ferment: 'food', writers: 'culture', philos: 'bigq', chess: null, fjord: 'music', press: 'culture', civic_g: 'event', makers: 'tech' };
  // …but where a subtopic exists, the scene pulls THAT leaf instead of the whole
  // parent: following the Tennis community should not flood you with football.
  const SUB = { tennis: 'sub_tennis', football: 'sub_football', trail: 'sub_running' };
  // topic hue per scene (from its interest category) — shared by the orbit and the feed chips
  const hueOf = (id) => {
    const g = (IS_DATA.groups || []).find((x) => x.id === id);
    const c = g && (IS_DATA.interestCats || []).find((x) => x.id === g.cat);
    return c ? c.hue : null;
  };
  const colorOf = (id) => { const h = hueOf(id); return h == null ? 'var(--accent)' : `color-mix(in oklch, var(--accent) 45%, oklch(0.60 0.12 ${h}))`; };
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify([...ensure()])); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } listeners.forEach((f) => f()); };
  window.SCENES = {
    topicOf: (id) => TOPIC[id] || null,
    subOf: (id) => SUB[id] || null,
    hueOf, colorOf,
    defs: () => (IS_DATA.groups || []),
    mine: () => (IS_DATA.groups || []).filter((g) => ensure().has(g.id)),
    list: () => [...ensure()],
    has: (id) => ensure().has(id),
    follow: (id) => { ensure().add(id); persist(); },
    unfollow: (id) => { ensure().delete(id); persist(); },
    toggle: (id) => { const s = ensure(); if (s.has(id)) s.delete(id); else s.add(id); persist(); return s.has(id); },
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();

