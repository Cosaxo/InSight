// Ported from design/spec-modules/suggestions.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// suggestions.js — "Suggest a question": a community suggestion board.
// People propose questions; the most-upvoted, once they clear review, get
// promoted into the Daily for everyone. NOT an infinite feed — a bounded board
// you visit on purpose. Moderation is faked here (statuses are baked); the
// user's own submissions + upvotes persist to localStorage.
(function () {
  // seeded community suggestions (newest activity varies; a few already picked)
  const SEED = [
    { id: 'sg01', prompt: 'Beach holiday or city break?', type: 'binary', options: ['Beach', 'City break'], by: 'Henrik V.', hue: 200, votes: 1846, status: 'picked', ago: '3d' },
    { id: 'sg02', prompt: 'Is it ever okay to read a partner’s messages?', type: 'dilemma', options: ['Never', 'Only if worried', 'Yes'], by: 'Aud K.', hue: 305, votes: 1622, status: 'picked', ago: '5d' },
    { id: 'sg03', prompt: 'Dogs or cats?', type: 'binary', options: ['Dogs', 'Cats'], by: 'Petra S.', hue: 35, votes: 1490, status: 'picked', ago: '2d' },
    { id: 'sg04', prompt: 'Would you take a pill that removed the need for sleep?', type: 'binary', options: ['Yes', 'No'], by: 'Sondre L.', hue: 255, votes: 1204, status: 'review', ago: '1d' },
    { id: 'sg05', prompt: 'How much does a place’s weather shape who you are?', type: 'rating', by: 'Iben M.', hue: 150, votes: 1098, status: 'review', ago: '4d' },
    { id: 'sg06', prompt: 'The book or the film?', type: 'binary', options: ['The book', 'The film'], by: 'Tobias R.', hue: 78, votes: 980, status: 'review', ago: '6d' },
    { id: 'sg07', prompt: 'Money can buy happiness.', type: 'scale', by: 'Nina D.', hue: 165, votes: 902, status: 'review', ago: '2d' },
    { id: 'sg08', prompt: 'You can keep one memory forever — which kind?', type: 'choice', options: ['A person', 'A place', 'A feeling', 'A day'], by: 'Sofie A.', hue: 320, votes: 814, status: 'review', ago: '1d' },
    { id: 'sg09', prompt: 'Tea or coffee — be honest.', type: 'binary', options: ['Tea', 'Coffee'], by: 'Lars V.', hue: 30, votes: 760, status: 'review', ago: '3d' },
    { id: 'sg10', prompt: 'Is talent or hard work more important?', type: 'binary', options: ['Talent', 'Hard work'], by: 'Kari T.', hue: 240, votes: 642, status: 'review', ago: '7d' },
    { id: 'sg11', prompt: 'Would you want to live to 150 if you stayed healthy?', type: 'binary', options: ['Yes', 'No'], by: 'Jonas E.', hue: 12, votes: 528, status: 'review', ago: '5d' },
  ];

  const LS = 'insight.suggestions.v1';
  let saved = { mine: [], up: {} };
  try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) saved = { mine: j.mine || [], up: j.up || {} }; } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
  const listeners = new Set();
  function persist() { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } listeners.forEach((f) => f()); }

  const TYPE_LABEL = { binary: 'this or that', choice: 'multiple choice', scale: 'agree / disagree', rating: 'rate 1–10', dilemma: 'dilemma' };

  function all() {
    // user's own submissions are first-class; live vote = base + (you upvoted ? 1 : 0)
    const list = saved.mine.map((s) => ({ ...s, mine: true })).concat(SEED)
      .map((s) => ({ ...s, voted: !!saved.up[s.id], liveVotes: s.votes + (saved.up[s.id] ? 1 : 0), days: s.ago === 'just now' ? -1 : (parseInt(s.ago, 10) || 99) }));
    list.sort((a, b) => b.liveVotes - a.liveVotes);
    return list;
  }

  const api = {
    all,
    typeLabel: (t) => TYPE_LABEL[t] || t,
    counts() { const a = all(); return { total: a.length, picked: a.filter((s) => s.status === 'picked').length, mine: a.filter((s) => s.mine).length }; },
    hasVoted: (id) => !!saved.up[id],
    toggleVote(id) { if (saved.up[id]) delete saved.up[id]; else saved.up[id] = true; persist(); },
    submit({ prompt, type, options, topic, hue }) {
      const id = 'sgu' + Date.now().toString(36);
      const s = {
        id, prompt: String(prompt || '').trim(), type: type || 'binary',
        options: (options || []).filter(Boolean), topic: (topic || '').trim() || null,
        by: 'You', hue: hue != null ? hue : 282, votes: 1, status: 'review', ago: 'just now',
      };
      saved.mine.unshift(s);
      saved.up[id] = true; // you back your own
      persist();
      return id;
    },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
  };
  // The purge (data/live.ts, D48): drop the in-memory copy too, or the next
  // toggleVote()'s persist writes the previous account's submissions back
  // under the new uid — authored questions rendered as "You". Notify
  // without re-creating the purged key.
  window.addEventListener('insight:local-purge', () => { saved = { mine: [], up: {} }; listeners.forEach((f) => f()); });
  window.SUGGESTIONS = api;
})();

