/* eslint-disable */
// ported from design/spec-modules/test-feed-data.js — do not hand-edit load order assumptions
import React from 'react';

// test-feed-data.js — each core test's OWN questions, surfaced as marked cards
// in the World feed (round-robin across tests, seeded prefix skipped — those
// were already answered in the demo). Answering one advances that test only.
window.TEST_FEED_QS = (function () {
  const P = window.PASSIVE, TESTS = window.IS_TESTS || {};
  if (!P) return [];
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

