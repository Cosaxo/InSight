// Ported from design/InSight_standalone_15.html (world-subtopics.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
// The pool's own live/demo guard, defined once there — see demoPoolOpen.
import { demoPoolOpen } from './world-feed-data.js';

// world-subtopics.js — the second level of the topic tree. A topic (Sport) can
// split into subtopics (Tennis, Football, Running) once each can be STOCKED;
// a thin subtopic would feel like a broken room, so the taxonomy is content-led.
//
// Rules the rest of the app relies on:
//   · colour = family (the parent topic's hue) · label = the leaf. One pill.
//   · a subtopic is followable exactly like a topic — it sits in the chip row as
//     an equal, and depth lives only in the discover sheet.
//   · following a parent gives you everything under it; following a leaf gives
//     you only the leaf.
const WORLD_SUBTOPICS = [
  { id: 'sub_tennis',   parent: 'sport', label: 'Tennis' },
  { id: 'sub_football', parent: 'sport', label: 'Football' },
  { id: 'sub_running',  parent: 'sport', label: 'Running' },
];

// ── background knowledge ────────────────────────────────────────────────────
// Only for questions that cannot be answered honestly without a fact. Rules:
// definitions and events, never arguments (those live in the reveal), and never
// more than ~40 words. If a question needs more than that, rewrite the question.
// Converted (D249). No window mirror: world-feed.jsx was the only reader.
export const WORLD_BG = {
  // ── main pool ──
  f06: 'E-sports were a medal event at the 2022 Asian Games, and the IOC has run separate Olympic Esports events since 2021 without adding them to the Olympic programme.',
  f11: 'Cultivated meat is grown from animal cells in a tank, with no slaughter. Singapore approved sale in 2020 and the US in 2023; volumes are tiny and costs still far above farmed meat.',
  f23: 'Vinyl is analogue: a continuous groove, with surface noise and less dynamic range than digital. Most records since the 1990s are cut from digital masters, so differences owe as much to mastering as to format.',
  f26: 'Brain-computer interfaces read neural signals through implanted electrodes. Trial participants with paralysis have moved cursors and robotic arms and produced speech. The implants require brain surgery and remain research, not products.',
  f32: 'US federal law lets employers pay tipped staff as little as $2.13 an hour if tips make up the rest. In much of Europe and Japan, service is included in the listed price.',
  f45: 'About two dozen countries require voting, and roughly half of those enforce it — Australia and Belgium fine non-voters. Turnout in those countries runs far above comparable voluntary systems.',
  f47: 'Pontevedra, Ghent and Oslo among others have closed their centres to most cars, with permits for residents and deliveries. Measured effects: less traffic and cleaner air, and disputes over shop takings.',
  f52: 'Determinism holds that every choice follows from prior causes; compatibilism holds that free will can still be real in such a world. Brain studies find activity preceding a reported decision, which both camps read differently.',
  f53: 'Astronomers have confirmed nearly 6,000 planets around other stars, several of them potentially temperate. No evidence of life beyond Earth has been found, and no candidate signal has survived follow-up checks.',
  f54: 'Studies track income against self-reported wellbeing. A 2010 study found happiness flattening above a middle income; a 2021 one found it still rising slowly at high incomes. Both rest on people rating their own lives.',
  f04: 'Video assistant referees review four things only: goals, penalties, red cards and mistaken identity. Introduced at the 2018 World Cup and in the Premier League from 2019.',
  f27: 'Several countries have restricted phones in schools nationally, others leave it to each school. Studies point both ways: less distraction, but also fewer chances to teach digital habits.',
  f31: 'Driverless taxis carry paying passengers in a handful of cities, with remote operators on standby. They are cleared only inside mapped service areas, and are pulled after incidents.',
  f46: 'Trials in Iceland, the UK and elsewhere cut hours with no cut in pay. Most reported steady output and lower burnout; the trials were small, and mostly office work.',
  t04: 'Electronic line calling uses ball-tracking cameras and a recorded voice instead of line judges. The tour has moved towards it since 2020; some events now have no line judges at all.',
  t12: 'Grand slams once played out long final sets. All four now end with a final-set tie-break, though the exact format has changed more than once since 2019.',
  b05: 'For decades a tie level on aggregate went to whoever scored more away goals. UEFA scrapped the rule in its club competitions from the 2021\u201322 season.',
  b09: 'Limb-tracking cameras build a 3D model of each player to flag offside automatically; a human referee still confirms the call. Used at the 2022 World Cup to cut VAR delays.',
  b10: 'England banned standing at top-flight grounds after the 1989 Hillsborough disaster. Licensed \u201csafe standing\u201d areas with rail seats have been allowed again on a trial basis since 2022.',
  // ── scenes ──
  s10: 'A ship has every plank replaced, one at a time. The puzzle is attributed to Plutarch, writing on the ship of Theseus kept in Athens; it tests what makes a thing the same thing over time.',
  s11: 'Philosophers call the two positions moral realism — moral facts exist and are found — and anti-realism, where morality is something humans construct. Both have serious defenders; neither is settled.',
  s13: 'Chess time controls: blitz gives each player 3–5 minutes for the whole game, rapid 10–60, classical 90 minutes or more plus added time. Ratings are kept separately for each.',
  s17: 'Both are fermented drinks: kombucha is sweetened tea fermented by a bacteria-and-yeast culture; kefir is milk or water fermented by kefir grains. Kefir carries more microbial strains, kombucha more acid.',
  r02: 'Thick foam midsoles with a stiff carbon plate return enough energy to have reset road records since 2017. World Athletics now caps road-shoe sole thickness and allows one plate.',
};
// the tennis scene asks t04's question in its own words — same fact behind it
WORLD_BG.s03 = WORLD_BG.t04;

// ── the stocked leaves ──────────────────────────────────────────────────────
//
// The questions that make each leaf followable. A module-local const, and
// `installSubtopicStock()` below is what puts them in the pool — this used
// to be an IIFE that pushed at module scope, which is the whole reason a
// 17 KB demo module had to load before first paint.
const WORLD_SUB_QS = [
    // ─── Tennis ───
    { id: 't01', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'The surface that brings out the best tennis?', options: [{ label: 'Clay', count: 1900 }, { label: 'Grass', count: 2400 }, { label: 'Hard', count: 1100 }] },
    { id: 't02', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'Best-of-five sets belongs in the past.', options: [{ label: 'Keep five', count: 2600 }, { label: 'Three is enough', count: 1500 }] },
    { id: 't03', cat: 'sport', sub: 'sub_tennis', type: 'rank', prompt: 'Rank the shot you would most want to own', items: ['A serve nobody reads', 'Backhand down the line', 'Drop shot', 'Forehand winner'], crowd: [2, 1, 4, 3], votes: 1700 },
    { id: 't04', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'Line judges should be gone for good.', options: [{ label: 'Cameras only', count: 2200 }, { label: 'Keep the humans', count: 1400 }] },
    { id: 't05', cat: 'sport', sub: 'sub_tennis', type: 'duel', prompt: 'The final you would rewatch tonight?', options: [{ label: 'A five-set Wimbledon final', count: 2700 }, { label: 'A US Open night session', count: 1300 }] },
    { id: 't06', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'Grunting should be penalised.', options: [{ label: 'Penalise it', count: 1200 }, { label: 'Let them play', count: 2500 }] },
    { id: 't07', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'Doubles deserves the same prize money as singles.', options: [{ label: 'Same money', count: 1500 }, { label: 'Singles earns it', count: 1900 }] },
    { id: 't08', cat: 'sport', sub: 'sub_tennis', type: 'rank', prompt: 'Rank the slams by prestige', items: ['Wimbledon', 'Roland-Garros', 'US Open', 'Australian Open'], crowd: [1, 2, 3, 4], votes: 2300 },
    { id: 't09', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'Coaching from the box mid-match \u2014 fine?', options: [{ label: 'Fine', count: 1600 }, { label: 'It is their problem to solve', count: 1800 }] },
    { id: 't10', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'A 20-year-old winning a slam is more impressive than a 35-year-old winning one.', options: [{ label: 'The kid', count: 1100 }, { label: 'The veteran', count: 2500 }] },
    { id: 't11', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'Would you rather be unbeatable on one surface, or top ten on all three?', options: [{ label: 'King of one', count: 2100 }, { label: 'Top ten everywhere', count: 1600 }] },
    { id: 't12', cat: 'sport', sub: 'sub_tennis', type: 'vote', prompt: 'A tie-break in the final set was the right call.', options: [{ label: 'Right call', count: 2000 }, { label: 'Let it run', count: 1400 }] },

    // ─── Football ───
    { id: 'b01', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'A goalless draw can be a great match.', options: [{ label: 'Absolutely', count: 5100 }, { label: 'Never', count: 3600 }] },
    { id: 'b02', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'Penalty shootouts are a fair way to decide a final.', options: [{ label: 'Fair enough', count: 4200 }, { label: 'Cruel and random', count: 5400 }] },
    { id: 'b03', cat: 'sport', sub: 'sub_football', type: 'rank', prompt: 'Rank what actually wins you a league', items: ['Squad depth', 'A world-class keeper', 'Set pieces', 'A manager who rotates'], crowd: [1, 2, 4, 3], votes: 4400 },
    { id: 'b04', cat: 'sport', sub: 'sub_football', type: 'duel', prompt: 'Better night of football?', options: [{ label: 'A derby in the rain', count: 5900 }, { label: 'A Champions League tie', count: 4700 }] },
    { id: 'b05', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'Away goals should come back.', options: [{ label: 'Bring it back', count: 3300 }, { label: 'Good riddance', count: 4100 }] },
    { id: 'b06', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'Salary caps would make club football better.', options: [{ label: 'Cap them', count: 6100 }, { label: 'Let the market run', count: 2900 }] },
    { id: 'b07', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'Winning ugly counts the same as winning well.', options: [{ label: 'Same three points', count: 6400 }, { label: 'How matters', count: 3100 }] },
    { id: 'b08', cat: 'sport', sub: 'sub_football', type: 'rank', prompt: 'Rank the hardest position to play well', items: ['Goalkeeper', 'Centre-back', 'Holding midfield', 'Winger'], crowd: [2, 3, 1, 4], votes: 3800 },
    { id: 'b09', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'Automated offside fixed offside.', options: [{ label: 'Fixed it', count: 4600 }, { label: 'Still a mess', count: 3900 }] },
    { id: 'b10', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'Standing terraces should be legal again.', options: [{ label: 'Let us stand', count: 5700 }, { label: 'Keep the seats', count: 2400 }] },
    { id: 'b11', cat: 'sport', sub: 'sub_football', type: 'vote', prompt: 'A club belongs to its city, not its owner.', options: [{ label: 'The city', count: 7100 }, { label: 'Whoever pays', count: 1900 }] },

    // ─── Running ───
    { id: 'r01', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'A finished marathon beats a fast 5k.', options: [{ label: 'The marathon', count: 2400 }, { label: 'The 5k', count: 1300 }] },
    { id: 'r02', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Super shoes should be capped harder.', options: [{ label: 'Cap them', count: 1800 }, { label: 'Let the tech run', count: 1600 }] },
    { id: 'r03', cat: 'sport', sub: 'sub_running', type: 'rank', prompt: 'Rank the hardest part of a marathon', items: ['Km 30 to 35', 'The taper', 'The start line', 'The last two km'], crowd: [1, 3, 4, 2], votes: 2100 },
    { id: 'r04', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Train by heart rate, or by pace?', options: [{ label: 'Heart rate', count: 1500 }, { label: 'Pace', count: 1700 }] },
    { id: 'r05', cat: 'sport', sub: 'sub_running', type: 'duel', prompt: 'The better morning?', options: [{ label: 'Trail at sunrise', count: 2600 }, { label: 'Track intervals', count: 900 }] },
    { id: 'r06', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Racing without a watch is better racing.', options: [{ label: 'Ditch the watch', count: 1200 }, { label: 'I need the numbers', count: 2200 }] },
    { id: 'r07', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Treadmill kilometres count.', options: [{ label: 'They count', count: 2300 }, { label: 'Not the same', count: 1400 }] },
    { id: 'r08', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Ultras are more about eating than running.', options: [{ label: 'It is an eating contest', count: 1600 }, { label: 'It is running', count: 1100 }] },
    { id: 'r09', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Almost anyone could run a sub-3 marathon with enough training.', options: [{ label: 'Anyone could', count: 900 }, { label: 'Talent decides', count: 2500 }] },
    { id: 'r10', cat: 'sport', sub: 'sub_running', type: 'vote', prompt: 'Pace groups ruin the race.', options: [{ label: 'They ruin it', count: 800 }, { label: 'They save it', count: 2000 }] },
];

/**
 * Put the leaf stock in the demo pool. Called by `loadWorldFeed()` and by
 * `loadOverlays()` — both, because both groups have a member that needs it
 * and neither may depend on the other having run: the feed renders these
 * cards, and search-overlay.jsx's discover sheet asks `SUBTOPICS.offers()`,
 * which is "only the stocked leaves" and reads the pool to decide. Two
 * callers cost nothing; the work happens once.
 *
 * REFUSED ON A LIVE SESSION, through the same predicate joinDemoPicks uses
 * and for the same reason. This used to run at module scope, before
 * `initLive`, where `buildFeedGlobals` would replace whatever it wrote;
 * `main.jsx` runs `initLive().finally(() => … loadWorldFeed())`, so it runs
 * after the live boot now and would otherwise push thirty demo sport
 * questions into the published pool — IN PLACE, which no later republish
 * would undo, because `push` mutates the array live.ts handed over.
 *
 * `offers()` already tolerates the gap this opens in demo mode: its comment
 * says it recomputes per call "because the pool changes under it at boot".
 * This is that, one loader later.
 */
let stockInstalled = false;
export function installSubtopicStock() {
  if (stockInstalled || !demoPoolOpen()) return;
  stockInstalled = true;
  const pool = (window.WORLD_FEED_QS = window.WORLD_FEED_QS || []);
  const have = new Set(pool.map((q) => q.id));
  WORLD_SUB_QS.forEach((q) => { if (!have.has(q.id)) pool.push(q); });
  // the existing general sport question about VAR is really a football question
  const var04 = pool.find((q) => q.id === 'f04');
  if (var04) var04.sub = 'sub_football';
}

// ── follow state — a leaf is followed exactly like a topic ──────────────────
export const SUBTOPICS = (function () {
  const LS = 'insight.subtopics.v1';
  const ALL = WORLD_SUBTOPICS;
  const BY = {};
  ALL.forEach((s) => { BY[s.id] = s; });
  const listeners = new Set();
  // Same gate as scenes.js, same reason: a live build starts with zero
  // follows — "one leaf followed from day one" is demo furniture, and on a
  // release device it was a subscription the user never chose.
  const SUB_LIVE_BUILD = import.meta.env && import.meta.env.VITE_V2_LIVE === 'true';
  let set = null;
  function ensure() {
    if (set) return set;
    try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); if (Array.isArray(v)) set = new Set(v.filter((id) => BY[id])); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ }
    if (!set) set = SUB_LIVE_BUILD ? new Set() : new Set(['sub_tennis']);        // one leaf followed from day one (demo)
    return set;
  }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify([...ensure()])); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } listeners.forEach((f) => { try { f(); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } }); };
  // The purge (data/live.ts, D51): null the cache and ensure() re-derives
  // from storage — now empty, so the day-one default — instead of the
  // previous account's leaf follows surviving to be saved back.
  window.addEventListener('insight:local-purge', () => { set = null; listeners.forEach((f) => { try { f(); } catch (e) { /* best-effort */ } }); });
  const count = (id) => (window.WORLD_FEED_QS || []).filter((q) => q.sub === id).length;
  return {
    all: () => ALL,
    // Only the stocked leaves — the taxonomy rule at the top of this file,
    // enforced where the offer is made: "a thin subtopic would feel like a
    // broken room", and a ZERO-stock one is one. Live boot replaces the
    // pool with the bank, which tags nothing with `sub` yet, so a live
    // device offered "Tennis · Sport · 0 questions" (2026-08-11; D96).
    // Recomputed per call because the pool changes under it at boot; leaves
    // return by themselves the day live questions carry their tag. all()
    // stays the dictionary for labels, parents and existing follows.
    offers: () => ALL.filter((s) => count(s.id) > 0),
    get: (id) => BY[id] || null,
    parentOf: (id) => (BY[id] ? BY[id].parent : null),
    under: (topic) => ALL.filter((s) => s.parent === topic),
    count,
    mine: () => ALL.filter((s) => ensure().has(s.id)),
    has: (id) => ensure().has(id),
    follow: (id) => { if (BY[id]) { ensure().add(id); save(); } },
    unfollow: (id) => { ensure().delete(id); save(); },
    toggle: (id) => { const s = ensure(); if (s.has(id)) s.delete(id); else s.add(id); save(); return s.has(id); },
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
// The window mirror is gone: search-overlay.jsx imports the binding by name
// now, so nothing looked this up through global scope any more and
// check:globals rule 5 would have called the publication residue.
