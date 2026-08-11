// Ported from design/spec-modules/scenes.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA } from './sample-data.js';
import { WPAL } from './world-palette.js';
// The offers() gate below — the imported binding, not window.LIVE, for the
// D39 meter's reason, and already in the eager graph via map-anchors.js so
// this import defers nothing that was deferred.
import LIVE from '../data/live';

// scenes.js — Scenes are the one follow list shared by the whole app: the orbit
// (Mirror) is where you see and manage them, the World feed chip row is the same
// list acting as filter. A scene is a community (members, match, vibe — defs live
// in data.js groups) that also feeds you its questions. Persisted locally.
(function () {
  const LS = 'insight.scenes.v1';
  // A live build starts with ZERO followed scenes. The demo seed below
  // (sample-data's `joined` groups) is what put Tennis, Swimming and
  // Writing on a release user's feed chips and profile orbit as follows
  // they never chose — the D66 class again, as preferences instead of
  // people. Gated on the build flag rather than window.LIVE.enabled for
  // the reason learn-progress.js records: the default can be derived
  // before the live boot has attached, and a live build must not seed
  // demo follows in that window either (demoInProd included).
  const LIVE_BUILD = import.meta.env && import.meta.env.VITE_V2_LIVE === 'true';
  let set = null;
  function ensure() {
    if (set) return set;
    try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); if (Array.isArray(v)) set = new Set(v); } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
    if (!set) set = LIVE_BUILD ? new Set() : new Set((IS_DATA.groups || []).filter((g) => g.joined).map((g) => g.id));
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
  const colorOf = (id) => { const h = hueOf(id); return h == null ? 'var(--accent)' : WPAL.c(`oklch(0.52 0.12 ${h})`); };
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify([...ensure()])); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } listeners.forEach((f) => f()); };
  // The purge (data/live.ts, D51): null the cache and ensure() re-derives
  // from storage — now empty, so the sample-data default — instead of the
  // previous account's follow list surviving to be persisted back.
  window.addEventListener('insight:local-purge', () => { set = null; listeners.forEach((f) => f()); });
  window.SCENES = {
    topicOf: (id) => TOPIC[id] || null,
    subOf: (id) => SUB[id] || null,
    hueOf, colorOf,
    defs: () => (IS_DATA.groups || []),
    // What a surface may ADVERTISE, as opposed to look up. Every group above
    // is sample data — members, match and vibe are claims about nobody — so
    // a live build offers none of them: "Swimming · 3.2K people" with a
    // Follow button is the D1 fabrication as an invitation (owner's device,
    // 2026-08-11; D95). demoInProd included: a real user in the mock
    // fallback is still a real user. Runtime, not the build flag, because
    // offers are read at render time — after live.ts has attached — and the
    // mount tests drive exactly this seam. defs() stays whole underneath:
    // it is the dictionary that existing follows and scene-tagged cards
    // resolve labels against, not an offer.
    offers: () => (LIVE.enabled || LIVE.demoInProd ? [] : (IS_DATA.groups || [])),
    mine: () => (IS_DATA.groups || []).filter((g) => ensure().has(g.id)),
    list: () => [...ensure()],
    has: (id) => ensure().has(id),
    follow: (id) => { ensure().add(id); persist(); },
    unfollow: (id) => { ensure().delete(id); persist(); },
    toggle: (id) => { const s = ensure(); if (s.has(id)) s.delete(id); else s.add(id); persist(); return s.has(id); },
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();

