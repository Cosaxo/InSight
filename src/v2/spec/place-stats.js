// Ported from design/InSight_standalone_15.html (place-stats.js). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// place-stats.js — the member scorecards for Oslo / Norway / the world.
// Baked averages + counts keep the cards full from day one; your own scores
// come from 'rate' questions in the World feed and overlay live.
(function () {
  const LS = 'insight.placeRatings.v1';
  let mine = {};
  try { mine = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { mine = {}; }
  const subs = new Set();

  const SCOPES = {
    city: { label: 'Oslo', raters: '9.2k', cats: [
      { id: 'nature', label: 'Nature access', avg: 9.1, n: 7900 },
      { id: 'transit', label: 'Getting around', avg: 8.6, n: 7300 },
      { id: 'safety', label: 'Safety', avg: 8.2, n: 6100 },
      { id: 'food', label: 'Food scene', avg: 7.1, n: 5800 },
      { id: 'nightlife', label: 'Nightlife', avg: 6.4, n: 5200 },
      { id: 'friendly', label: 'Friendliness', avg: 5.8, n: 6600 },
      { id: 'dating', label: 'Dating', avg: 4.9, n: 4400 },
      { id: 'cost', label: 'Affordability', avg: 3.2, n: 8000 },
    ] },
    country: { label: 'Norway', raters: '61k', cats: [
      { id: 'nature', label: 'Nature', avg: 9.4, n: 41000 },
      { id: 'safety', label: 'Safety', avg: 8.8, n: 38000 },
      { id: 'balance', label: 'Work–life balance', avg: 8.5, n: 35000 },
      { id: 'health', label: 'Healthcare', avg: 7.9, n: 33000 },
      { id: 'services', label: 'Public services', avg: 7.6, n: 29000 },
      { id: 'newcomers', label: 'Openness to newcomers', avg: 5.6, n: 27000 },
      { id: 'weather', label: 'Weather', avg: 4.1, n: 39000 },
      { id: 'cost', label: 'Affordability', avg: 3.6, n: 40000 },
    ] },
    world: { label: 'the world', raters: '640k', cats: [
      { id: 'food', label: 'What we eat', avg: 7.4, n: 380000 },
      { id: 'music', label: 'Music right now', avg: 7.0, n: 350000 },
      { id: 'kindness', label: 'Kindness of strangers', avg: 6.9, n: 410000 },
      { id: 'future', label: 'Where it\u2019s heading', avg: 5.1, n: 430000 },
      { id: 'nature', label: 'State of nature', avg: 4.8, n: 440000 },
      { id: 'honesty', label: 'Public honesty', avg: 4.6, n: 340000 },
      { id: 'fairness', label: 'Fairness', avg: 4.2, n: 390000 },
      { id: 'leaders', label: 'Leadership', avg: 3.4, n: 460000 },
    ] },
  };

  const key = (s, c) => s + ':' + c;
  const api = {
    SCOPES,
    cat(scope, catId) { const S = SCOPES[scope]; return S ? S.cats.find((c) => c.id === catId) || null : null; },
    myScore(scope, catId) { const v = mine[key(scope, catId)]; return v == null ? null : v; },
    rate(scope, catId, score) {
      mine[key(scope, catId)] = score;
      try { localStorage.setItem(LS, JSON.stringify(mine)); } catch { /* best-effort: private mode, quota */ }
      subs.forEach((f) => f());
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
  // The purge (data/live.ts, D51): drop your ratings too, or the next
  // rate()'s save writes the previous account's back under the new uid.
  // Notify without re-creating the purged key.
  window.addEventListener('insight:local-purge', () => { mine = {}; subs.forEach((f) => f()); });
  window.PLACESTATS = api;

  // the feed questions that fill the scorecards — one per (scope, category)
  const P = [
    ['pr01', 'city', 'safety', 'How safe does Oslo feel?'],
    ['pr02', 'city', 'transit', 'Getting around Oslo \u2014 how good is it?'],
    ['pr03', 'city', 'cost', 'Can a normal person afford Oslo?'],
    ['pr04', 'city', 'friendly', 'How friendly are Oslo people, really?'],
    ['pr05', 'city', 'nightlife', 'Rate Oslo after dark.'],
    ['pr06', 'country', 'nature', 'Norway\u2019s nature \u2014 rate it.'],
    ['pr07', 'country', 'weather', 'The Norwegian weather. Be honest.'],
    ['pr08', 'country', 'balance', 'Work\u2013life balance in Norway?'],
    ['pr09', 'country', 'newcomers', 'How open is Norway to newcomers?'],
    ['pr10', 'world', 'leaders', 'The world\u2019s leadership right now?'],
    ['pr11', 'world', 'kindness', 'How kind are strangers these days?'],
    ['pr12', 'world', 'future', 'Where the world is heading \u2014 rate it.'],
    ['pr13', 'world', 'nature', 'The state of nature worldwide?'],
  ];
  window.PLACE_RATE_QS = P.map(([id, scope, catId, prompt]) => {
    const c = api.cat(scope, catId) || { n: 0 };
    return { id, cat: 'places', type: 'rate', scope, catId, prompt, n: c.n };
  });
})();
