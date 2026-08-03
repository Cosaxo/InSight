// Ported from design/spec-modules/follows.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// follows.js — friendships (mutual). Your friends ARE your circle: they feed the
// 1v1s, the groups, and the circle populations. Adding someone sends a request;
// in this prototype the other side accepts after a short, believable delay.
// Persisted locally.
//
// The IIFE is vestigial under ESM (D39) and stays only because unwrapping it
// re-indents the file for no behavioural gain; the binding is hoisted out.
// Same shape as daily-questions.js — see the note there.
export let FRIENDS;

(function () {
  const LS = 'insight.friends.v1';
  const SEED = ['f1', 'f2', 'f4', 'f6', 'f3'];
  let S;
  try { S = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.friends)) S = { friends: SEED.slice(), invited: {} };
  S.invited = S.invited && typeof S.invited === 'object' ? S.invited : {};
  const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) { /* one listener throwing must not stop the others being notified. */ } });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } fire(); };
  // deterministic per-person acceptance delay (10–30 s) — "they saw it on their phone"
  function delayMs(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return 10000 + (h % 20000); }
  function sweep() {
    const now = Date.now(); let hit = false;
    Object.keys(S.invited).forEach((id) => {
      if (now - S.invited[id] >= delayMs(id)) { delete S.invited[id]; if (!S.friends.includes(id)) S.friends.push(id); hit = true; }
    });
    if (hit) save();
  }
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => { if (!Object.keys(S.invited).length) { clearInterval(timer); timer = null; return; } sweep(); }, 2500);
  }
  if (Object.keys(S.invited).length) ensureTimer();
  FRIENDS = {
    status: (id) => (S.friends.includes(id) ? 'friends' : S.invited[id] != null ? 'invited' : 'none'),
    isFriend: (id) => S.friends.includes(id),
    invite: (id) => { if (id && !S.friends.includes(id) && S.invited[id] == null) { S.invited[id] = Date.now(); ensureTimer(); save(); } },
    cancel: (id) => { delete S.invited[id]; save(); },
    unfriend: (id) => { S.friends = S.friends.filter((x) => x !== id); delete S.invited[id]; save(); },
    list: () => S.friends.slice(),
    invitedList: () => Object.keys(S.invited),
    count: () => S.friends.length,
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();

