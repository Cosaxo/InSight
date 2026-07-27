// ported from design/spec-modules/map-group-stats.js — do not hand-edit load order assumptions
import React from 'react';

// InSight — mock group statistics for the Map tab.
// For any (question × anchor-group) pair, returns a plausible, DETERMINISTIC
// distribution of how "people like you" answered. Fake but stable data:
// the same question + group always yields the same numbers.
(function () {
  function h(s) {
    let x = 9;
    for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) % 9973;
    return x / 9973;
  }

  // % per option, integers summing to 100. Biased so the group's most common
  // answer matches YOURS roughly 60% of the time — agreement, not an echo.
  function dist(qid, anchorId, nOpts, myIdx) {
    const n = Math.max(2, nOpts);
    const w = [];
    for (let i = 0; i < n; i++) w.push(0.3 + h(qid + '|' + anchorId + '|' + i));
    const agree = myIdx != null && h(qid + '|' + anchorId + '|m') < 0.6;
    const mode = agree ? myIdx : Math.floor(h(qid + '|' + anchorId + '|k') * n) % n;
    w[mode] += Math.max(...w) * (1.15 + h(qid + anchorId) * 0.8);
    // soft neighbour spill so scales look like real curves
    if (mode > 0) w[mode - 1] += w[mode] * 0.25;
    if (mode < n - 1) w[mode + 1] += w[mode] * 0.25;
    const sum = w.reduce((a, b) => a + b, 0);
    const pct = w.map((x) => Math.max(1, Math.round((x / sum) * 100)));
    let drift = 100 - pct.reduce((a, b) => a + b, 0);
    pct[pct.indexOf(Math.max(...pct))] += drift;
    return pct;
  }

  function mode(qid, anchorId, nOpts, myIdx) {
    const d = dist(qid, anchorId, nOpts, myIdx);
    return d.indexOf(Math.max(...d));
  }

  const LABELS = {
    age: 'people your age',
    job: 'people in your line of work',
    edu: 'people with your education',
    big5: 'similar personalities',
    political: 'your political neighbours',
    values: 'people with your values',
    attachment: 'similar social styles',
  };
  function groupLabel(anchorId) { return LABELS[anchorId] || 'people like you'; }

  // Group's 0..100 score on one test dimension. Deterministic; sits near the
  // user (it's a "people like you" group) with a drift toward the middle.
  function dimVal(anchorId, dimId, myVal) {
    const off = (h(anchorId + '·' + dimId) - 0.5) * 36; // ±18
    const pull = 0.12 + h(dimId + '·' + anchorId) * 0.14; // slight regression to 50
    const v = myVal + off + (50 - myVal) * pull;
    return Math.max(3, Math.min(97, Math.round(v)));
  }

  window.MapStats = { dist, mode, groupLabel, dimVal };
})();

