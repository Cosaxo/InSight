// Ported from design/InSight_standalone_14.html (world-feed-counters.js).
// THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// DEMO DATA. Every name here is invented, exactly like world-feed-comments.js
// beside it. It exists so the prototype's rooms read as arguments rather than
// as empty boxes, and it must never reach a live card: world-feed.jsx's
// renderEngage returns the k-floored breakdown alone when q.live, so takes and
// their counters are structurally unreachable there (D1 — free-text and named
// who-voted are circle-scoped only).
// world-feed-counters.js — the reply that argues back.
// Each key is "questionId:takeIndex"; the counter is written by someone who
// voted the OTHER way, so every hot take ships with an argument attached.
const WORLD_FEED_COUNTERS = {
  'f01:0': [
    { name: 'Dana W.', init: 'DW', opt: 1, time: '2h', ups: 96, text: 'The ad breaks are when the room actually talks to each other. That IS the event.' },
    { name: 'Priya S.', init: 'PS', opt: 1, time: '5h', ups: 61, text: 'Flow is why nobody who didn\u2019t grow up with it can follow a word of it.' },
  ],
  'f01:1': { name: 'Lukas F.', init: 'LF', opt: 0, time: '4h', ups: 71, text: 'Naming the concert as the best part rather proves the game is second.' },
  'f02:0': { name: 'Tom A.', init: 'TA', opt: 1, time: '1h', ups: 88, text: 'Yours alone is exactly the problem. Nobody else remembers where they were.' },
  'f04:0': { name: 'Aisha B.', init: 'AB', opt: 0, time: '1h', ups: 104, text: 'Four minutes once a match, against a whole season decided by a wrong armpit.' },
  'f05:0': { name: 'Marcus T.', init: 'MT', opt: 1, time: '2h', ups: 63, text: '80,000 people also means you watch it on a screen. From inside the stadium.' },
  'f06:0': { name: 'Karl B.', init: 'KB', opt: 1, time: '3h', ups: 82, text: 'Reaction time is elite in air traffic control too. Still not a sport.' },
  'f08:0': { name: 'Ken T.', init: 'KT', opt: 1, time: '1h', ups: 77, text: 'Counting shapes isn\u2019t range. It\u2019s one idea in forty costumes.' },
  'f09:0': { name: 'Ben A.', init: 'BA', opt: 1, time: '3h', ups: 44, text: 'You calibrate by pouring less milk. No physics required.' },
  'f11:0': { name: 'Ivo R.', init: 'IR', opt: 1, time: '2h', ups: 69, text: '\u201cOnly weird culturally\u201d is doing a lot of work. Culture is how food works.' },
  'f12:0': { name: 'Leo C.', init: 'LC', opt: 0, time: '1h', ups: 58, text: 'You want the table, not the cooking. Those can be separated.' },
  'f15:0': { name: 'Ruth E.', init: 'RE', opt: 0, time: '2h', ups: 61, text: 'One famous exception. Name the next four.' },
  'f18:0': { name: 'Pete R.', init: 'PR', opt: 1, time: '1h', ups: 92, text: 'At 1.5\u00d7 I finish the ones I\u2019d otherwise abandon. More watched, not less.' },
  'f20:0': { name: 'Dev M.', init: 'DM', opt: 0, time: '1h', ups: 74, text: 'Guarding it assumes surprise is the point. Mostly the second read is better.' },
  'f21:0': { name: 'June O.', init: 'JO', opt: 0, time: '2h', ups: 68, text: 'You hum the melody because you already know the words by heart.' },
  'f26:0': [
    { name: 'Leo C.', init: 'LC', opt: 0, time: '1h', ups: 79, text: 'You said the same about the phone once. Now it sleeps on your pillow.' },
    { name: 'Yuki T.', init: 'YT', opt: 0, time: '4h', ups: 55, text: 'Outside your skull it can be taken from you. Inside, it can\u2019t.' },
  ],
  'f27:0': { name: 'Diego V.', init: 'DV', opt: 1, time: '2h', ups: 84, text: 'Detention slips also banned calculators, novels and ballpoint pens.' },
  'f30:0': { name: 'Luc F.', init: 'LF', opt: 0, time: '1h', ups: 91, text: 'You already pay in data for far less. This one folds the laundry.' },
  'f32:0': { name: 'Femi A.', init: 'FA', opt: 1, time: '2h', ups: 57, text: 'Print the real price and half those rooms close. Then nobody gets paid.' },
  'f38:0': { name: 'Dan O.', init: 'DO', opt: 0, time: '1h', ups: 66, text: 'Friendships survive unsaid things because we can\u2019t check. We\u2019d adapt.' },
  'f39:0': { name: 'Diego V.', init: 'DV', opt: 0, time: '2h', ups: 73, text: 'Laws exist because we already accept distant harm daily. Ours just has a button.' },
  'f41:0': { name: 'Priya S.', init: 'PS', opt: 1, time: '1h', ups: 98, text: 'You hate your job and can leave any Tuesday. That\u2019s the whole difference.' },
  'f42:0': [
    { name: 'Ben A.', init: 'BA', opt: 0, time: '2h', ups: 112, text: 'One edit, early, small. The people stay. You just arrive richer.' },
    { name: 'Marta K.', init: 'MK', opt: 0, time: '6h', ups: 74, text: 'Small edits are the ones that erase people. Ask any time-travel plot.' },
  ],
  'f52:0': { name: 'Sofia B.', init: 'SB', opt: 1, time: '2h', ups: 87, text: 'Nothing is left except the deciding \u2014 which is the only part anyone meant.' },
  'f54:0': [
    { name: 'Ingrid M.', init: 'IM', opt: 1, time: '1h', ups: 94, text: 'Sleep, safety and dentists are the flat part of the graph. Above that, nothing.' },
    { name: 'Rosa P.', init: 'RP', opt: 1, time: '3h', ups: 68, text: 'Everyone I know who got rich just found more expensive things to worry about.' },
  ],
  'f55:0': { name: 'Hana K.', init: 'HK', opt: 1, time: '2h', ups: 81, text: 'Every generation was also wrong about how much time they had.' },
  'tq-political-8:0': { name: 'Bea L.', init: 'BL', opt: 3, time: '1h', ups: 78, text: 'She calls because she moved an ocean away. The tool solves a problem it made.' },
  'tq-values-5:0': { name: 'Theo J.', init: 'TJ', opt: 4, time: '2h', ups: 64, text: 'The dishes will still be there. The mood you\u2019re in right now will not.' },
};

// Two derived signals per take, stable per key: how many people it moved, and
// how much of its support came from the other side. Sits in data so the view
// stays a view.
window.WF_TAKE_SIG = function (key, ups) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = ((h >>> 0) % 10000) / 10000;
  const r2 = (((h >>> 7) >>> 0) % 10000) / 10000;
  const hasCounter = !!WORLD_FEED_COUNTERS[key];
  const cross = 0.14 + r * 0.62 + (hasCounter ? 0.06 : 0);
  return { mind: Math.max(1, Math.round((ups || 40) * (0.04 + r2 * 0.22))), cross: Math.min(0.86, cross) };
};

// counters normalise to a list — a take can draw several rebuttals, shown one
// at a time. Strongest (by minds moved) first.
window.WF_COUNTERS = function (key) {
  const v = WORLD_FEED_COUNTERS[key];
  if (!v) return [];
  const list = (Array.isArray(v) ? v : [v]).map((x, i) => ({ ...x, sig: window.WF_TAKE_SIG(key + '#' + i, x.ups), ckey: key + '#' + i }));
  return list.sort((a, b) => b.sig.mind - a.sig.mind);
};
