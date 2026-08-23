// Ported from design/spec-modules/test-feed-data.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_TESTS } from './test-definitions.js';
import { PASSIVE } from './passive-progress.js';

// test-feed-data.js — each core test's OWN questions, surfaced as marked cards
// in the World feed (round-robin across tests, seeded prefix skipped — those
// were already answered in the demo). Answering one advances that test only.
// No window mirror (D232): world-feed.jsx was the only reader.
export const TEST_FEED_QS = (function () {
  const P = PASSIVE, TESTS = IS_TESTS;
  function h(s) { let x = 9; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 387420489); return ((x ^ (x >>> 9)) >>> 0) / 4294967295; }
  const SCALE = ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'];
  const perTest = P.KEYS.map((k) => {
    const T = TESTS[k]; if (!T) return [];
    const from = P.seedCount(k);
    return T.questions.slice(from).map((q, i) => {
      const id = 'tq-' + k + '-' + (from + i);
      const peak = Math.floor(h(id) * SCALE.length); // where the crowd leans
      const options = SCALE.map((label, oi) => {
        const w = 1 / (1 + Math.abs(oi - peak)) + h(id + ':' + oi) * 0.45;
        return { label, count: Math.round(260 + w * 2600) };
      });
      return { id, test: k, cat: 'test', type: 'vote', prompt: q.q, options };
    });
  });
  const out = [];
  for (let i = 0; perTest.some((l) => i < l.length); i++) perTest.forEach((l) => { if (i < l.length) out.push(l[i]); });
  return out;
})();

