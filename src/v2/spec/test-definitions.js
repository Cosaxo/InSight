// Ported from design/spec-modules/test-definitions.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// InSight — test definitions & saved results: demo data, typical-person
// baselines, the question banks, and result persistence. No JSX — plain script.
// ─── Saved test results · pre-computed for the demo ───
window.IS_TEST_RESULTS = {
  big5: {
    title: 'Big Five',
    taken: '10 days ago',
    accent: 'var(--c-around)',
    dims: [
      { id: 'O', label: 'Openness',          value: 78, blurb: 'curious, wide-ranging' },
      { id: 'C', label: 'Conscientiousness', value: 62, blurb: 'mostly orderly, sometimes loose' },
      { id: 'E', label: 'Extraversion',      value: 48, blurb: 'middle — selective social' },
      { id: 'A', label: 'Agreeableness',     value: 71, blurb: 'warm, slow to judge' },
      { id: 'N', label: 'Sensitivity',       value: 42, blurb: 'steadier side of middle' },
    ],
  },
  political: {
    title: 'Politics',
    taken: '3 weeks ago',
    accent: 'var(--c-world)',
    dims: [
      { id: 'econ',    label: 'Economic',    value: 38, blurb: 'centre-left' },
      { id: 'auth',    label: 'Authority',   value: 24, blurb: 'liberty-minded, flat' },
      { id: 'foreign', label: 'Foreign',     value: 68, blurb: 'open, internationalist' },
      { id: 'env',     label: 'Environment', value: 82, blurb: 'urgent action' },
      { id: 'tech',    label: 'Technology',  value: 64, blurb: 'cautious optimist' },
      { id: 'estab',   label: 'Populism',    value: 56, blurb: 'healthy scepticism' },
    ],
  },
  values: {
    title: 'Values',
    taken: 'last month',
    accent: 'var(--c-people)',
    dims: [
      { id: 'future',   label: 'Future',   value: 58, blurb: 'cautiously hopeful' },
      { id: 'circle',   label: 'Circle',   value: 46, blurb: 'leans close — family first' },
      { id: 'hedonism', label: 'Pleasure', value: 52, blurb: 'middle, slight pleasure' },
      { id: 'meaning',  label: 'Meaning',  value: 71, blurb: 'struggle has weight' },
      { id: 'moral',    label: 'Ethics',   value: 44, blurb: 'lean relativist' },
      { id: 'beauty',   label: 'Beauty',   value: 78, blurb: 'beauty matters' },
    ],
  },
  attachment: {
    title: 'Social style',
    taken: '2 weeks ago',
    accent: 'oklch(0.58 0.12 320)',
    dims: [
      { id: 'warm',  label: 'Warm',      value: 78, blurb: 'openly affectionate' },
      { id: 'loyal', label: 'Loyal',     value: 84, blurb: 'few and deep, kept for years' },
      { id: 'open',  label: 'Open',      value: 64, blurb: 'lets people in' },
      { id: 'play',  label: 'Playful',   value: 56, blurb: 'keeps it light' },
      { id: 'easy',  label: 'Easygoing', value: 62, blurb: 'gives space' },
    ],
  },
  cognitive: {
    title: 'How you think',
    taken: 'a month ago',
    accent: 'oklch(0.50 0.12 220)',
    dims: [
      { id: 'analyst', label: 'Analyst', value: 62, blurb: '' },
      { id: 'systems', label: 'Systems', value: 78, blurb: 'patterns first' },
      { id: 'empath',  label: 'Empath',  value: 56, blurb: '' },
      { id: 'maker',   label: 'Maker',   value: 64, blurb: '' },
    ],
  },
};

// Typical-person baselines per dimension — used to show "you vs. most people".
// Grounded, not precise: enough to give every score a reference point.
window.IS_TEST_AVG = {
  big5:       { O: 60, C: 58, E: 52, A: 65, N: 48 },
  political:  { econ: 50, auth: 52, foreign: 48, env: 55, tech: 60, estab: 55 },
  values:     { future: 52, circle: 45, hedonism: 55, meaning: 58, moral: 55, beauty: 60 },
  attachment: { warm: 64, loyal: 66, open: 56, play: 58, easy: 60 },
};

// ── Persist completed results so a retake (or reload) keeps what you scored ──
// (v2: axes changed — politics merged liberty/order + gained populism; values
// merged duty+altruism into one moral-circle tension. Old v1 results would
// carry retired dims, so they are simply not read.)
const TEST_RESULTS_KEY = 'insight.testResults.v2';
try {
  const saved = JSON.parse(localStorage.getItem(TEST_RESULTS_KEY) || '{}');
  Object.keys(saved).forEach(k => { window.IS_TEST_RESULTS[k] = saved[k]; });
} catch (e) { /* ignore corrupt storage */ }

function persistTestResult(kind, result) {
  window.IS_TEST_RESULTS[kind] = result;
  if (window.LIVE && window.LIVE.enabled && window.LIVE.saveTestResult) window.LIVE.saveTestResult(kind, result);
  try {
    const saved = JSON.parse(localStorage.getItem(TEST_RESULTS_KEY) || '{}');
    saved[kind] = result;
    localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(saved));
  } catch (e) { /* ignore */ }
}

// Each question maps answer values (0..4) to dimension deltas via `dims`
// Result is computed by summing values per dimension, normalised to 0..100
// (module scope — the Daily tab's Test mode reads this via window.IS_TESTS)
const IS_TESTS = {
    big5: {
      title: 'Big Five',
      tag: 'personality · 10 questions · 5 traits',
      accent: 'var(--c-around)',
      dims: [
        { id: 'O', label: 'Openness',          blurb: 'curiosity & range' },
        { id: 'C', label: 'Conscientiousness', blurb: 'order & follow-through' },
        { id: 'E', label: 'Extraversion',      blurb: 'energy from people' },
        { id: 'A', label: 'Agreeableness',     blurb: 'warmth & trust' },
        { id: 'N', label: 'Sensitivity',       blurb: 'steady ←→ sensitive' },
      ],
      questions: [
        { q: "I find new ideas more interesting than familiar ones.", d: 'O' },
        { q: "I enjoy thinking about abstract concepts.",              d: 'O' },
        { q: "I keep appointments and rarely run late.",               d: 'C' },
        { q: "I finish what I start, even when it gets dull.",         d: 'C' },
        { q: "I feel energised by spending time with strangers.",       d: 'E' },
        { q: "I prefer a loud party to a quiet evening.",              d: 'E' },
        { q: "I try to keep the peace, even at some cost.",            d: 'A' },
        { q: "I trust people until they give me reason not to.",       d: 'A' },
        { q: "I worry about things I can't control.",                  d: 'N' },
        { q: "Small setbacks throw off my whole day.",                 d: 'N' },
      ],
    },
    political: {
      title: 'Politics',
      tag: 'compass · 12 questions · 6 axes',
      accent: 'var(--c-world)',
      dims: [
        { id: 'econ',    label: 'Economic',   blurb: 'left ←→ right' },
        { id: 'auth',    label: 'Authority',  blurb: 'liberty ←→ order' },
        { id: 'foreign', label: 'Foreign',    blurb: 'closed ←→ open' },
        { id: 'env',     label: 'Environment',blurb: 'low ←→ high urgency' },
        { id: 'tech',    label: 'Technology', blurb: 'precaution ←→ accelerate' },
        { id: 'estab',   label: 'Populism',   blurb: 'establishment ←→ outsider' },
      ],
      questions: [
        { q: "Markets, left to themselves, distribute fairly.",        d: 'econ' },
        { q: "A society is judged by how it treats the weakest.",      d: 'econ', invert: true },
        { q: "Some speech is harmful enough to restrict.",             d: 'auth' },
        { q: "The state should keep out of private life.",             d: 'auth', invert: true },
        { q: "My country should help others before its own poor.",     d: 'foreign' },
        { q: "Borders should be more open than they are now.",         d: 'foreign' },
        { q: "Climate action is worth real economic cost.",            d: 'env' },
        { q: "Green rules should hold even when jobs are on the line.", d: 'env' },
        { q: "New technology, on balance, makes life better.",         d: 'tech' },
        { q: "Some technologies should be slowed down on purpose.",    d: 'tech', invert: true },
        { q: "Strong leaders matter more than strong institutions.",   d: 'estab' },
        { q: "The system is rigged against ordinary people.",          d: 'estab' },
      ],
    },
    values: {
      title: 'Values',
      tag: '12 questions · six tensions',
      accent: 'var(--c-people)',
      dims: [
        { id: 'future',   label: 'Future',   blurb: 'pessimist ←→ optimist' },
        { id: 'circle',   label: 'Circle',   blurb: 'close ←→ wide' },
        { id: 'hedonism', label: 'Pleasure', blurb: 'duty ←→ pleasure' },
        { id: 'meaning',  label: 'Meaning',  blurb: 'happiness ←→ struggle' },
        { id: 'moral',    label: 'Ethics',   blurb: 'relative ←→ objective' },
        { id: 'beauty',   label: 'Beauty',   blurb: 'truth only ←→ beauty too' },
      ],
      questions: [
        { q: "Future generations will live better than ours.",                  d: 'future' },
        { q: "Most of what's changing right now is change for the better.",     d: 'future' },
        { q: "What I owe my family weighs more than what I owe strangers.",     d: 'circle', invert: true },
        { q: "I'd sacrifice comfort now for a stranger's future.",              d: 'circle' },
        { q: "Pleasure needs no justification.",                                d: 'hedonism' },
        { q: "Obligations come before enjoyment.",                              d: 'hedonism', invert: true },
        { q: "Suffering can give life meaning, not just pain.",                 d: 'meaning' },
        { q: "A hard life spent on something big beats an easy one.",           d: 'meaning' },
        { q: "There are objective right answers in ethics.",                    d: 'moral' },
        { q: "Some things are wrong in every era and every culture.",           d: 'moral' },
        { q: "Beauty matters as much as truth.",                                d: 'beauty' },
        { q: "A beautiful thing needs no other use.",                           d: 'beauty' },
      ],
    },
    attachment: {
      title: 'Social',
      tag: '10 questions · what kind of friend you are',
      accent: 'oklch(0.58 0.12 320)',
      dims: [
        { id: 'warm',  label: 'Warm',      blurb: 'reserved ←→ warm' },
        { id: 'loyal', label: 'Loyal',     blurb: 'many & light ←→ few & deep' },
        { id: 'open',  label: 'Open',      blurb: 'guarded ←→ open book' },
        { id: 'play',  label: 'Playful',   blurb: 'grounded ←→ playful' },
        { id: 'easy',  label: 'Easygoing', blurb: 'invested ←→ easygoing' },
      ],
      questions: [
        { q: "I show people I care without being asked.",             d: 'warm' },
        { q: "I'm quick with a hug or a kind word.",                  d: 'warm' },
        { q: "Friends know I'll show up when it matters.",            d: 'loyal' },
        { q: "Once you're my friend, you're my friend for years.",    d: 'loyal' },
        { q: "I say what I'm feeling rather than keeping it in.",      d: 'open' },
        { q: "I let people see the messy parts of me.",               d: 'open' },
        { q: "I'm usually the one keeping things light and fun.",     d: 'play' },
        { q: "I'd rather joke around than be too serious.",           d: 'play' },
        { q: "Little gets under my skin in a friendship.",            d: 'easy' },
        { q: "I give people room and don't keep score.",              d: 'easy' },
      ],
    },
};
window.IS_TESTS = IS_TESTS;
window.IS_persistTestResult = persistTestResult;

;globalThis.persistTestResult = typeof persistTestResult === 'undefined' ? globalThis.persistTestResult : persistTestResult;
;globalThis.TEST_RESULTS_KEY = typeof TEST_RESULTS_KEY === 'undefined' ? globalThis.TEST_RESULTS_KEY : TEST_RESULTS_KEY;
;globalThis.IS_TESTS = typeof IS_TESTS === 'undefined' ? globalThis.IS_TESTS : IS_TESTS;
