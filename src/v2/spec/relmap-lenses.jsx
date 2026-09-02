// Ported from design/spec-modules/relmap-lenses.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import { IS_DATA } from './sample-data.js';
import { IS_TEST_RESULTS } from './test-definitions.js';

// RMLenses — the four test lenses for the Circle map.
// Each lens: axes (with pole words), an overall "type" per person, a diverging
// spectrum for single-axis focus, and stable mock per-person values seeded
// from each person's name (+ their existing 1–5 political/personality traits).
// Exported (D353's sweep) — relmap.jsx and vote-cuts.js import it.
export let RMLenses;
(function () {
  function h(s) {
    let x = 9;
    for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) % 9973;
    return x / 9973;
  }
  const clamp = (v) => Math.max(3, Math.min(97, Math.round(v)));

  // ── lens definitions ────────────────────────────────────────────────────
  const TESTS = {
    big5: {
      label: 'Big 5', full: 'Big Five', hues: [295, 70],
      axes: [
        { id: 'O', label: 'Openness',      lo: 'grounded',   hi: 'curious' },
        { id: 'C', label: 'Discipline',    lo: 'spontaneous', hi: 'ordered' },
        { id: 'E', label: 'Extraversion',  lo: 'introvert',  hi: 'extrovert' },
        { id: 'A', label: 'Warmth',        lo: 'direct',     hi: 'warm' },
        { id: 'N', label: 'Sensitivity',   lo: 'steady',     hi: 'sensitive' },
      ],
      types: [
        { id: 'O', label: 'Explorer',   hue: 265 },
        { id: 'C', label: 'Organiser',  hue: 85 },
        { id: 'E', label: 'Energiser',  hue: 40 },
        { id: 'A', label: 'Harmoniser', hue: 150 },
        { id: 'N', label: 'Feeler',     hue: 330 },
      ],
      typeOf: (v) => domType(TESTS.big5, v),
    },
    politics: {
      label: 'Politics', full: 'Politics', hues: [256, 25],
      axes: [
        { id: 'econ',    label: 'Economic',    lo: 'left',       hi: 'right' },
        { id: 'auth',    label: 'Authority',   lo: 'liberty',    hi: 'order' },
        { id: 'foreign', label: 'Foreign',     lo: 'closed',     hi: 'open' },
        { id: 'env',     label: 'Environment', lo: 'relaxed',    hi: 'urgent' },
        { id: 'tech',    label: 'Technology',  lo: 'precaution', hi: 'accelerate' },
        { id: 'estab',   label: 'Populism',    lo: 'establishment', hi: 'outsider' },
      ],
      // overall type = the classic left–right composite, same bands as before
      types: [
        { id: 'p1', label: 'Progressive',  v: 8 },
        { id: 'p2', label: 'Leans left',   v: 30 },
        { id: 'p3', label: 'Moderate',     v: 50 },
        { id: 'p4', label: 'Leans right',  v: 70 },
        { id: 'p5', label: 'Conservative', v: 92 },
      ].map((t) => ({ ...t, color: div(t.v, 256, 25) })),
      typeOf: (v) => {
        const comp = (v.econ + v.auth) / 2;
        const i = Math.min(4, Math.floor(comp / 20));
        return TESTS.politics.types[i];
      },
    },
    values: {
      label: 'Values', full: 'Values', hues: [305, 130],
      axes: [
        { id: 'future',   label: 'Future',   lo: 'pessimist', hi: 'hopeful' },
        { id: 'circle',   label: 'Circle',   lo: 'close',     hi: 'wide' },
        { id: 'hedonism', label: 'Pleasure', lo: 'duty',      hi: 'pleasure' },
        { id: 'meaning',  label: 'Meaning',  lo: 'happiness', hi: 'struggle' },
        { id: 'moral',    label: 'Ethics',   lo: 'relative',  hi: 'objective' },
        { id: 'beauty',   label: 'Beauty',   lo: 'truth',     hi: 'beauty' },
      ],
      types: [
        { id: 'optimist',  label: 'Optimist',     hue: 130 },
        { id: 'family',    label: 'Family-first', hue: 40 },
        { id: 'pleasure',  label: 'Epicurean',    hue: 350 },
        { id: 'seeker',    label: 'Seeker',       hue: 280 },
        { id: 'universal', label: 'Universalist', hue: 210 },
      ],
      typeOf: (v) => {
        const scores = {
          optimist:  v.future * 2,
          family:    (100 - v.circle) * 2,
          pleasure:  v.hedonism + (100 - v.meaning),
          seeker:    v.meaning + v.beauty,
          universal: v.circle + v.moral,
        };
        let best = 'optimist';
        Object.keys(scores).forEach((k) => { if (scores[k] > scores[best]) best = k; });
        return TESTS.values.types.find((t) => t.id === best);
      },
    },
    social: {
      label: 'Social', full: 'Social', hues: [250, 20],
      axes: [
        { id: 'warm',  label: 'Warm',      lo: 'reserved', hi: 'warm' },
        { id: 'loyal', label: 'Loyal',     lo: 'light-touch', hi: 'loyal' },
        { id: 'open',  label: 'Open',      lo: 'guarded',  hi: 'open' },
        { id: 'play',  label: 'Playful',   lo: 'grounded', hi: 'playful' },
        { id: 'easy',  label: 'Easygoing', lo: 'invested', hi: 'easygoing' },
      ],
      types: [
        { id: 'warm',  label: 'The warm one',      hue: 20 },
        { id: 'loyal', label: 'The loyal one',     hue: 230 },
        { id: 'open',  label: 'The open book',     hue: 280 },
        { id: 'play',  label: 'The playful one',   hue: 85 },
        { id: 'easy',  label: 'The easygoing one', hue: 150 },
      ],
      typeOf: (v) => domType(TESTS.social, v),
    },
  };
  // dominant-axis type (big5, social) — types listed in the same order as axes
  function domType(T, v) {
    let best = T.axes[0].id;
    T.axes.forEach((a) => { if (v[a.id] > v[best]) best = a.id; });
    return T.types[T.axes.findIndex((a) => a.id === best)];
  }
  TESTS.big5.types.forEach((t) => { t.color = 'oklch(0.62 0.115 ' + t.hue + ')'; });
  TESTS.values.types.forEach((t) => { t.color = 'oklch(0.62 0.115 ' + t.hue + ')'; });
  TESTS.social.types.forEach((t) => { t.color = 'oklch(0.62 0.115 ' + t.hue + ')'; });

  // ── diverging spectrum for a single axis (0..100) ───────────────────────
  function div(v, hueLo, hueHi) {
    const t = Math.max(0, Math.min(1, v / 100));
    const hue = t < 0.5 ? hueLo : hueHi;
    const c = (0.02 + 0.135 * Math.abs(t - 0.5) * 2).toFixed(3);
    return 'oklch(0.62 ' + c + ' ' + hue + ')';
  }
  function axisColor(testKey, v) {
    const T = TESTS[testKey];
    return div(v, T.hues[0], T.hues[1]);
  }
  // 5 legend bands, low pole → high pole
  function axisBands(testKey, axis) {
    const T = TESTS[testKey];
    const a = T.axes.find((x) => x.id === axis);
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    return [
      { key: 'b1', lo: 0,  hi: 20,  label: cap(a.lo),          v: 8 },
      { key: 'b2', lo: 20, hi: 40,  label: 'Leans ' + a.lo,    v: 30 },
      { key: 'b3', lo: 40, hi: 60,  label: 'Between',          v: 50 },
      { key: 'b4', lo: 60, hi: 80,  label: 'Leans ' + a.hi,    v: 70 },
      { key: 'b5', lo: 80, hi: 101, label: cap(a.hi),          v: 92 },
    ].map((b) => ({ ...b, color: div(b.v, T.hues[0], T.hues[1]) }));
  }

  // ── stable per-person values ────────────────────────────────────────────
  // seeded from name; politics/extraversion stay coherent with the person's
  // existing 1–5 traits so the old and new lenses never contradict.
  function personVals(name, testKey, political, personality) {
    const T = TESTS[testKey];
    const out = {};
    const polBase = political != null ? ((political - 1) / 4) * 100 : 50; // 0=progressive
    const extBase = personality != null ? ((personality - 1) / 4) * 100 : 50;
    T.axes.forEach((a) => {
      const j = (h(a.id + '|' + testKey + '|' + name) - 0.5) * 56; // ±28 jitter
      let base = 50;
      if (testKey === 'politics') {
        if (a.id === 'econ' || a.id === 'auth') base = polBase;
        else if (a.id === 'foreign' || a.id === 'env') base = 100 - polBase;
        else base = 50;
      } else if (testKey === 'big5' && a.id === 'E') {
        base = 25 + extBase * 0.5;
      } else if (testKey === 'social' && a.id === 'warm') {
        base = 30 + extBase * 0.4; // extroverts read a touch warmer
      }
      out[a.id] = clamp(base * 0.72 + 50 * 0.28 + j);
    });
    return out;
  }

  // your real results, normalised to 0..100 per axis
  function youVals(testKey) {
    const me = IS_DATA.me || {};
    if (testKey === 'big5' && me.personality) return { ...me.personality };
    if (testKey === 'politics' && me.political) {
      const o = {};
      Object.keys(me.political).forEach((k) => { o[k] = Math.round((me.political[k] + 100) / 2); });
      return o;
    }
    if (testKey === 'values' && me.morals) {
      const o = {};
      Object.keys(me.morals).forEach((k) => { o[k] = Math.round((me.morals[k] + 100) / 2); });
      return o;
    }
    if (testKey === 'social') {
      const R = IS_TEST_RESULTS.attachment;
      if (R && R.dims) { const o = {}; R.dims.forEach((d) => { o[d.id] = d.value; }); return o; }
      return { warm: 78, loyal: 84, open: 64, play: 52, easy: 58 };
    }
    return null;
  }

  function meanVals(list, testKey) {
    const T = TESTS[testKey];
    const o = {};
    T.axes.forEach((a) => {
      o[a.id] = list.length ? Math.round(list.reduce((s, v) => s + v[a.id], 0) / list.length) : 50;
    });
    return o;
  }

  RMLenses = { TESTS, axisColor, axisBands, personVals, youVals, meanVals, div };
})();

