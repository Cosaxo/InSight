// Ported from design/InSight_standalone_15.html (learn-data.js, 2026-07-31
// revision). THIS file is the live source of the BEHAVIOR; the card bank
// itself moved to content/learn-questions.json when Learn went live (D32) —
// one source feeds both this module and the seeded Firestore bank via
// scripts/gen-v2content.mjs, so the demo cards and the live docs can never
// drift apart. (A static JSON import, not a cross-module import — the spec
// layer's no-imports convention bans load-order coupling between modules,
// which data has none of.)
// OFF THE GLOBAL BRIDGE (D105): the five names below are named exports.
// `learn-progress.js` reads three of them at MODULE SCOPE, so before this
// change the whole Learn mode rested on spec-index.js listing this file one
// line above that one — reorder those two and the card bank is silently
// empty, with no error anywhere. That ordering is now a module-graph
// guarantee, which is the same fragility the `daily-questions.js` conversion
// removed for `map-branches.js`. `window.LIVE` in learnMeasured() stays: it
// is read at CALL time, and it is what the LIVE conversion will take.
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

export const LEARN_SUBJECTS = LEARN_CONTENT.subjects;

export const LEARN_FIELDS = LEARN_CONTENT.fields;

export const LEARN_CARDS = LEARN_CONTENT.cards;

// ── the crowd split ─────────────────────────────────────────────────────────
// Two sources, one seam (D32). In live mode, once a card's k-floored public
// aggregate has cleared the floor, the split IS the measurement — real
// first attempts, normalised to percentages. Until then (and in the demo)
// it falls back to the authored model below: correct takes p%, the rest
// goes mostly to the trap. LEARN_SPLIT_SRC tells the reveal which source
// this card renders from, so the authored number is never shown unlabeled
// (D1) — the reveal's footer copy hangs off it.
function learnMeasured(card) {
  const L = window.LIVE;
  if (!(L && L.enabled && L.learnAgg)) return null;
  const agg = L.learnAgg(card.id);
  if (!agg || !agg.counts) return null;
  const n = card.a.length;
  const counts = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const c = Number(agg.counts[String(i)] || 0);
    counts.push(c);
    total += c;
  }
  if (total <= 0) return null;
  const pcts = counts.map((c) => Math.floor((c / total) * 100));
  let rem = 100 - pcts.reduce((a, b) => a + b, 0);
  for (let i = 0; rem > 0; i = (i + 1) % pcts.length, rem--) pcts[i]++;
  return pcts;
}
export function LEARN_SPLIT_SRC(card) {
  return learnMeasured(card) ? 'measured' : 'estimate';
}
export function LEARN_SPLIT(card) {
  const measured = learnMeasured(card);
  if (measured) return measured;
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
}
