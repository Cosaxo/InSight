// Ported from design/InSight_standalone_15.html (place-stats.js). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// place-stats.js — the member scorecards for Oslo / Norway / the world.
// Baked averages + counts keep the cards full from day one; your own scores
// come from 'rate' questions in the World feed and overlay live.
// City and country carry TWO crowds since the 2026-08-24 standalone: the
// people who live there (`loc`/`locN`) and everyone else (`vis`/`visN`) —
// named "live there" / "from elsewhere" here rather than the prototype's
// "locals/visitors", because that is what the LIVE card can honestly know
// (D288 §2) and the demo must not preview a claim the product refuses.
// The world has no elsewhere.
// Hoisted `export let`, assigned inside the IIFE — the shape DAILYQ,
// FRIENDS and PICKS were converted with (D39, "convert on touch").
//
// The whole pair is past first paint now: this module and place-stats.jsx
// load in `loadWorldFeed()`, which is also where the scorecard's own cards
// come from. Nothing on the first frame reads either.
// `PLACE_RATE_QS` converted with the same move. It stayed on window because
// world-feed-data.js concatenated it at MODULE SCOPE — a real load-order
// dependency, and the last thing holding this pair in the first-paint
// graph. `joinDemoStock()` takes the binding from `loadWorldFeed()` now.
export let PLACESTATS;
export let PLACE_RATE_QS;

(function () {
  const LS = 'insight.placeRatings.v1';
  let mine = {};
  try { mine = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { mine = {}; }
  const subs = new Set();

  const SCOPES = {
    // avg/n stay the whole-crowd numbers (world-feed's counters read them);
    // loc/vis carry the split the two-crowd card draws, with each crowd's
    // own n — the gaps are the design's (a visitor's Oslo is safer and
    // much more expensive than a resident's).
    city: { label: 'Oslo', raters: '9.2k', split: true, cats: [
      { id: 'nature', label: 'Nature access', avg: 9.1, n: 7900, loc: 9.0, vis: 9.5, locN: 4900, visN: 3000 },
      { id: 'transit', label: 'Getting around', avg: 8.6, n: 7300, loc: 8.7, vis: 8.3, locN: 4600, visN: 2700 },
      { id: 'safety', label: 'Safety', avg: 8.2, n: 6100, loc: 8.0, vis: 8.9, locN: 3900, visN: 2200 },
      { id: 'food', label: 'Food scene', avg: 7.1, n: 5800, loc: 7.2, vis: 6.7, locN: 3600, visN: 2200 },
      { id: 'nightlife', label: 'Nightlife', avg: 6.4, n: 5200, loc: 6.6, vis: 5.3, locN: 3300, visN: 1900 },
      { id: 'friendly', label: 'Friendliness', avg: 5.8, n: 6600, loc: 6.3, vis: 4.7, locN: 4200, visN: 2400 },
      { id: 'dating', label: 'Dating', avg: 4.9, n: 4400, loc: 4.8, vis: 5.6, locN: 3100, visN: 1300 },
      { id: 'cost', label: 'Affordability', avg: 3.2, n: 8000, loc: 3.5, vis: 2.0, locN: 5000, visN: 3000 },
    ] },
    country: { label: 'Norway', raters: '61k', split: true, cats: [
      { id: 'nature', label: 'Nature', avg: 9.4, n: 41000, loc: 9.3, vis: 9.6, locN: 24000, visN: 17000 },
      { id: 'safety', label: 'Safety', avg: 8.8, n: 38000, loc: 8.7, vis: 9.1, locN: 22000, visN: 16000 },
      { id: 'balance', label: 'Work–life balance', avg: 8.5, n: 35000, loc: 8.6, vis: 8.1, locN: 21000, visN: 14000 },
      { id: 'health', label: 'Healthcare', avg: 7.9, n: 33000, loc: 7.7, vis: 8.4, locN: 20000, visN: 13000 },
      { id: 'services', label: 'Public services', avg: 7.6, n: 29000, loc: 7.4, vis: 8.2, locN: 17000, visN: 12000 },
      { id: 'newcomers', label: 'Openness to newcomers', avg: 5.6, n: 27000, loc: 6.2, vis: 4.6, locN: 16000, visN: 11000 },
      { id: 'weather', label: 'Weather', avg: 4.1, n: 39000, loc: 4.4, vis: 3.4, locN: 23000, visN: 16000 },
      { id: 'cost', label: 'Affordability', avg: 3.6, n: 40000, loc: 3.9, vis: 2.4, locN: 24000, visN: 16000 },
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
  PLACESTATS = api;

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
  PLACE_RATE_QS = P.map(([id, scope, catId, prompt]) => {
    const c = api.cat(scope, catId) || { n: 0 };
    return { id, cat: 'places', type: 'rate', scope, catId, prompt, n: c.n };
  });
})();
