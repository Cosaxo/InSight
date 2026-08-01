// Ported from design/InSight_standalone_15.html (learn-data.js, 2026-07-31
// revision). THIS file is the live source of the BEHAVIOR; the card bank
// itself moved to content/learn-questions.json when Learn went live (D32) —
// one source feeds both this module and the seeded Firestore bank via
// scripts/gen-v2content.mjs, so the demo cards and the live docs can never
// drift apart. (A static JSON import, not a cross-module import — the spec
// layer's no-imports convention bans load-order coupling between modules,
// which data has none of.)
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import LEARN_CONTENT from '../../../content/learn-questions.json';

// learn-data.js — the Learn mode's content. Three levels of nesting, and only
// the bottom two are taxonomy: Learn is the MODE (a question with a right
// answer), subject is tier 2 (Biology), field is tier 3 (Cell biology). That
// reuses the topic → subtopic shape the World feed already has, so nothing in
// the existing taxonomy has to bend.
//
// A card carries:
//   q  the question · a  the options · c  index of the correct one
//   t  index of the TRAP — the wrong answer people actually pick. This is what
//      makes a knowledge question an InSight question: the split of wrong
//      answers is a map of common misconceptions, not noise.
//   p  % of the crowd who get it right. Doubles as difficulty (low p = hard),
//      so "on your level" runs on real crowd data, not invented 1–5 labels.
//   k  the fact in three words — the label the mastered dot wears on your map.
//   w  optional one line of why. Only where the fact is genuinely counter-
//      intuitive; never an argument, never more than ~20 words.

window.LEARN_SUBJECTS = LEARN_CONTENT.subjects;

window.LEARN_FIELDS = LEARN_CONTENT.fields;

window.LEARN_CARDS = LEARN_CONTENT.cards;

// ── the crowd split ─────────────────────────────────────────────────────────
// The correct answer takes p%. The rest goes mostly to the trap — a wrong
// answer that lots of people pick is the interesting part of the card, and the
// same instrument the app uses for opinions reads it. Deterministic, so the
// split never shifts between sittings.
window.LEARN_SPLIT = function (card) {
  const n = card.a.length;
  let h = 0;
  for (let i = 0; i < card.id.length; i++) h = (h * 31 + card.id.charCodeAt(i)) >>> 0;
  const out = new Array(n).fill(0);
  out[card.c] = card.p;
  let rest = 100 - card.p;
  const wrong = [];
  for (let i = 0; i < n; i++) if (i !== card.c) wrong.push(i);
  const trap = card.t != null && card.t !== card.c ? card.t : wrong[0];
  const trapShare = Math.round(rest * (0.5 + ((h % 18) / 100)));   // 50–68% of the misses
  out[trap] = trapShare;
  rest -= trapShare;
  const others = wrong.filter((i) => i !== trap);
  others.forEach((i, k) => {
    const last = k === others.length - 1;
    const share = last ? rest : Math.round(rest / (others.length - k) * (0.8 + (((h >> (k + 2)) % 40) / 100)));
    out[i] = Math.max(0, Math.min(rest, share));
    rest -= out[i];
  });
  if (rest > 0) out[trap] += rest;
  return out;
};
