// Ported from design/InSight_standalone_15.html (learn-data.js, 2026-07-31
// revision). THIS file is the live source of the BEHAVIOR; the card bank
// itself moved to content/learn-questions.json when Learn went live (D32) —
// one source feeds both this module and the seeded Firestore bank via
// scripts/gen-v2content.mjs, so the demo cards and the live docs can never
// drift apart. (A static JSON import, not a cross-module import — the spec
// layer's no-imports convention bans load-order coupling between modules,
// which data has none of.)
// OFF THE GLOBAL BRIDGE (D109): the five names below are named exports.
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

// ── the display order ───────────────────────────────────────────────────────
// MEASURED 2026-08-12, and it was a shipped defect rather than a nicety: the
// correct answer was authored at index 0 on all 96 cards then in the bank, and
// the trap at index 1 on 79 of them. Nothing shuffled — renderKnow mapped
// `card.a` straight down the screen — so "tap the top option" scored 100% and
// Learn tested reading position, not knowledge. That also quietly voided the
// measurement the whole mode rests on: D32 promises the reveal's split IS the
// crowd's real first-attempt rate once the aggregate lands, and a crowd tapping
// a free win measures nothing. The scorecard's calibration section (authored
// `p` vs measured) would have graded every card as wildly under-estimated and
// aimed the lane at the wrong fix.
//
// Cards written since vary their `c`, which is belt and braces rather than the
// fix — the permutation is what makes authored position invisible either way,
// and a bank with varied indices merely degrades instead of collapsing if this
// function is ever removed.
//
// Why permute at RENDER rather than re-author `c` across the bank: answers are
// stored as (qid, optionIdx) forever — `learn-<id>` docs whose `counts` are
// keyed by the authored index — so reordering an `a` array silently re-keys
// every answer already given and every aggregate cell built from them. That is
// the D30 re-key failure class the farm manual bans by name, and re-authoring
// 96 cards would be it ninety-six times over. A permutation applied on the way
// to the screen leaves the stored key space untouched: the buttons map back to
// authored indices before anything is recorded.
//
// Deterministic from the card id, like LEARN_SPLIT's own hash below, for the
// reason result-card.jsx gives for its scatter: a stable order means a card
// re-served by the scheduler (the spaced repeat, the check-in) does not
// rearrange itself under a returning reader, and tests can pin it. Stability
// costs nothing here — the tell was positional across the BANK, and a
// per-card permutation is what breaks that.
function learnHash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // Avalanche before use. The ×31 accumulator is the one LEARN_SPLIT already
  // uses and it is fine as a bucket hash, but near-identical ids ("cell1",
  // "cell2") land on near-identical seeds, and one xorshift round from
  // near-identical seeds is not one round from independent ones: a 20k sweep
  // over sequential synthetic ids drew slot 3 at 28% against an expected 25%
  // before this line and 25.0% after. The real bank is flat either way — this
  // holds as the bank grows into id runs longer than today's eight per field.
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
export function LEARN_ORDER(card) {
  const n = card.a.length;
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  // Fisher–Yates, stepping xorshift32 and drawing from the HIGH bits. Both
  // details are measured, not taste. The first draft stepped an LCG and took
  // `h % (i + 1)`: an LCG modulo 2^32 has period 2 in its lowest bit, so the
  // final swap (j = h % 2) fired on every card regardless of the seed, and
  // the correct answer landed in slot 0 exactly 0 times out of 96 — "never
  // tap the top", which is the same exploitable tell as the one being fixed,
  // just inverted. xorshift32 mixes all 32 bits and the high-bit draw avoids
  // the low-bit structure modulo has to trust.
  let h = learnHash(card.id) || 1; // xorshift32 is a fixed point at 0
  for (let i = n - 1; i > 0; i--) {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    const j = Math.floor((h / 0x100000000) * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

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

/**
 * The one number three surfaces outside the reveal want: the share of the
 * crowd who get this card RIGHT, and where it came from.
 *
 * D133. LEARN_SPLIT above is the whole distribution and the reveal reads
 * it carefully — it renders the measurement when there is one and says
 * "our estimate" when there is not. Every OTHER surface read the authored
 * `card.p` directly and printed it as a finished fact: the map node
 * ("84% of people get this right"), the ⓘ sheet's Crowd row, and the
 * "who knows this" panel's headline. So the same card said "our estimate"
 * in the feed and stated a measurement two taps away, and the authored
 * number — a content-authoring difficulty hint — was the one wearing the
 * authority.
 *
 * `card.c` is safe as the index into a measured split: LEARN_ORDER
 * permutes on the way to the SCREEN and the buttons map back to authored
 * indices before anything is recorded (see its note above), so the
 * aggregate's cells are keyed the way the definition is.
 */
export function LEARN_RATE(card) {
  const measured = learnMeasured(card);
  return measured
    ? { pct: measured[card.c], src: 'measured' }
    : { pct: card.p, src: 'estimate' };
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
