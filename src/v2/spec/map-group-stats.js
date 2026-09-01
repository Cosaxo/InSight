// Ported from design/spec-modules/map-group-stats.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import LIVE from '../data/live';
import { MAP_ANCHOR_DIM, byOf, typicality } from '../data/cohort';
import { sharePcts } from '../data/pct';

// InSight — group statistics for the Map tab.
//
// For a (question × anchor-group) pair: how did people who share that
// anchor with you answer? Since D99 this is REAL for the two anchors that
// map onto a breakdown dim, and still refuses for the rest.
//
// THE HISTORY MATTERS, because the refusal is what made the fix findable.
// Every number here used to be a hash of the question id — plausible,
// stable, and about nobody. D72 stopped it rendering in live mode rather
// than deleting it, on the grounds that "48% of people your age chose the
// same" sits beside a real answer and a real age band on the one Mirror
// stop that carries no Preview tag. Returning null rather than gating at
// the five call sites was the deliberate part: a consumer that forgot the
// check threw in smoke-live.test.jsx instead of quietly fabricating.
//
// D98 published the per-anchor breakdown exactly, so `age` and `edu` now
// have an arithmetic answer and take it (see data/cohort.ts, typicality).
// `job` joined them at D328 — through the profession's derived FIELD, the
// indirection `age` already takes through `ageBand`. The reason it had
// refused ("free text") had quietly stopped being true: the profile has
// offered a 31-option select for a long time, and the real blocker was
// that 31 is longer than BREAKDOWN_MAX_BUCKETS.
//
// THE OTHER FOUR STILL REFUSE, and not for want of a floor:
//   big5, political, values, attachment
//               are test RESULTS. No cohort aggregate exists for them at
//               all, so "how did similar personalities answer" has no
//               source rather than a withheld one. (Six until D103
//               retired `cognitive`, five until D328 — each time one fewer
//               refusal, not one more thing withheld.)
// A live build therefore still gets null from those, through the same
// fail-loud path — the demo keeps the hash, because in a demo the hash
// IS the content.
//
// `groupLabel` answers in both modes either way: it is a noun for the
// cohort, not a claim about it.
// The export the Map's cards and the person map import (D345's sweep);
// assigned inside the IIFE below, the DAILYQ shape. The window copy stays
// beside it: smoke-live.test.jsx reads `window.MapStats` directly to pin
// the cohort gate, and a test is a reader like any other.
export let MapStats;
(function () {
  // The demo's hash may run whenever we are not live. In live mode an
  // anchor answers only if it maps to a breakdown dim AND the viewer has
  // that anchor filled in AND the cohort has answers — checked per call
  // in liveTypicality below, which returns null for every other case.
  const refuses = () => !!LIVE.enabled;

  // The real reading, or null. Null means "no source" (an anchor that is
  // not a dim, a profile field the user has not filled in) or "no data"
  // (nobody in that cohort has answered this yet) — the caller renders
  // absence for both, because both are honestly "not measured".
  function liveTypicality(qid, anchorId, nOpts, myIdx) {
    const dim = MAP_ANCHOR_DIM[anchorId];
    if (!dim) return null;
    const bucket = (LIVE.anchors() || {})[dim];
    if (!bucket) return null;
    return typicality(byOf(LIVE.aggFor(qid)), dim, bucket, myIdx == null ? -1 : myIdx, nOpts);
  }

  function h(s) {
    let x = 9;
    for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) % 9973;
    return x / 9973;
  }

  // The COUNT vector behind a live reading, or null. The two branches of
  // `dist` below both build one and then throw it away; `mode` needs it
  // kept, so it lives here and both callers share it.
  function liveCounts(qid, anchorId, nOpts, myIdx) {
    const width = Math.max(2, nOpts);
    const pick = (cell) => {
      const counts = Array.from({ length: width }, (_, i) => cell[String(i)] || 0);
      return counts.reduce((a, b) => a + b, 0) ? counts : null;
    };
    // 'all' is EVERYONE — not a cohort, so no anchor and no dim lookup.
    if (anchorId === 'all') return pick((LIVE.aggFor(qid) || {}).counts || {});
    if (!liveTypicality(qid, anchorId, width, myIdx)) return null;
    const dim = MAP_ANCHOR_DIM[anchorId];
    return pick(byOf(LIVE.aggFor(qid))[dim][(LIVE.anchors() || {})[dim]]);
  }

  // % per option, integers summing to 100. Biased so the group's most common
  // answer matches YOURS roughly 60% of the time — agreement, not an echo.
  function dist(qid, anchorId, nOpts, myIdx) {
    if (refuses()) {
      // Live: the published counts, as percentages, through `sharePcts`
      // (data/pct.ts) — the one rounding rule, NOT the
      // round-then-dump-the-residue-on-the-leader shape that used to be
      // here. That shape can hand a bucket a point it did not earn and
      // another one fewer. Measured over 200k random count vectors at ten
      // options — a rating question's width — the expression it replaced
      // drew the leading option below the top percentage 15826 times and
      // drew a smaller count at a larger percentage 12500 times.
      // sharePcts: 0 and 0, at every width tried.
      //
      // The demo branch below keeps its own arithmetic: its numbers are
      // invented from a hash, so their rounding is not a claim about
      // anybody.
      const counts = liveCounts(qid, anchorId, nOpts, myIdx);
      return counts ? sharePcts(counts) : null;
    }
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

  // WHICH OPTION THE GROUP CHOSE — off the COUNTS in live mode, not off
  // the percentages.
  //
  // `sharePcts` guarantees no inversion (a smaller count never draws
  // larger) and that is what the ridge's bar heights rest on. It does not
  // guarantee distinctness: two different counts can print the same
  // integer, and `indexOf(max)` then resolves the tie by INDEX. That made
  // the Map card's "most chose 4" and its "you're with the majority" /
  // "a minority take" verdict answerable by rounding rather than by
  // votes — the same defect the feed's own with-the-majority line had.
  //
  // The demo keeps reading its percentages, because in a demo the hash IS
  // the content and there are no counts behind it.
  function mode(qid, anchorId, nOpts, myIdx) {
    if (refuses()) {
      const counts = liveCounts(qid, anchorId, nOpts, myIdx);
      return counts ? counts.indexOf(Math.max(...counts)) : null;
    }
    const d = dist(qid, anchorId, nOpts, myIdx);
    return d ? d.indexOf(Math.max(...d)) : null;
  }

  // How many answers the live reading rests on — null in demo mode and
  // wherever dist() refuses. The Map uses it to say "of 6" rather than
  // presenting a 50% drawn from two people as though it were a finding.
  function cohortN(qid, anchorId, nOpts, myIdx) {
    if (!refuses()) return null;
    const t = liveTypicality(qid, anchorId, nOpts, myIdx);
    return t ? t.n : null;
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
    if (refuses()) return null;
    const off = (h(anchorId + '·' + dimId) - 0.5) * 36; // ±18
    const pull = 0.12 + h(dimId + '·' + anchorId) * 0.14; // slight regression to 50
    const v = myVal + off + (50 - myVal) * pull;
    return Math.max(3, Math.min(97, Math.round(v)));
  }

  MapStats = window.MapStats = { dist, mode, groupLabel, dimVal, cohortN };
})();

