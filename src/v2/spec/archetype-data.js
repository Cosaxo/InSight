// Ported from design/spec-modules/archetype-data.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_TEST_AVG } from './test-definitions.js';

// archetype-data.js — named type systems per test. Each type has a signature
// vector on the test's dims, a one-line definition (`line`), and a realistic
// `share` (% of people who land there — sums to ~100 per set, common types big,
// rare ones genuinely rare). Your result maps to the NEAREST type live.
// Signatures are deliberately EXTREME on each type's 1–2 defining dims and
// near-neutral elsewhere, so nearest-type matching stays stable.
// Converted off the shared-global bridge (D39, "convert on touch"):
// type-marks.jsx imports this by name. The window mirror stays for the
// consumers that have not moved.
export const IS_ARCHETYPES = {
  big5: { list: [
    { name: 'The Enthusiast',      share: 6,  line: 'Says yes first, plans later.',                    sig: { O: 88, C: 40, E: 75, A: 55, N: 45 } },
    { name: 'The Planner',         share: 5,  line: 'Builds the system, then trusts it.',              sig: { O: 80, C: 90, E: 32, A: 42, N: 35 } },
    { name: 'The Diplomat',        share: 7,  line: 'Meets new ideas and new people halfway.',         sig: { O: 82, C: 55, E: 50, A: 82, N: 42 } },
    { name: 'The Dependable',      share: 12, line: 'Keeps things steady for everyone else.'   ,        sig: { O: 42, C: 85, E: 42, A: 80, N: 28 } },
    { name: 'The Live Wire',       share: 8,  line: 'Brings the energy the room was missing.',         sig: { O: 60, C: 32, E: 90, A: 58, N: 45 } },
    { name: 'The Host',            share: 10, line: 'Makes any room feel like a living room.',         sig: { O: 52, C: 62, E: 85, A: 85, N: 35 } },
    { name: 'The Lookout',         share: 9,  line: 'Sees the risk before anyone else does.',          sig: { O: 32, C: 80, E: 42, A: 52, N: 70 } },
    { name: 'The Drifter',         share: 6,  line: 'Allergic to routine, drawn to whatever is new.',  sig: { O: 85, C: 22, E: 62, A: 62, N: 50 } },
    { name: 'The Reader',          share: 8,  line: 'Reads the room before anyone speaks.',            sig: { O: 60, C: 48, E: 42, A: 90, N: 65 } },
    { name: 'The Plain Speaker',   share: 9,  line: "Says the thing everyone's dancing around.",       sig: { O: 45, C: 62, E: 62, A: 22, N: 32 } },
    { name: 'The Quiet One',       share: 11, line: 'Notices everything, announces nothing.',          sig: { O: 72, C: 55, E: 15, A: 58, N: 50 } },
    { name: 'The Sensitive',       share: 6,  line: 'Feels everything, shows a fraction.',             sig: { O: 62, C: 50, E: 25, A: 65, N: 78 } },
    { name: 'The Hothead',         share: 3,  line: 'Runs on intensity, in every direction.',          sig: { O: 58, C: 35, E: 75, A: 42, N: 85 } },
  ]},
  political: { list: [
    { name: 'Solidarity Left',             share: 7,  line: 'Fairness first, markets on a leash.',          sig: { econ: 15, auth: 35, foreign: 55, env: 70, tech: 45, estab: 65 } },
    { name: 'Green Left',                  share: 4,  line: 'Climate-urgent, borders open, act now.',       sig: { econ: 35, auth: 25, foreign: 70, env: 85, tech: 60, estab: 55 } },
    { name: 'Social Democrat',             share: 16, line: 'Markets are fine — with a strong safety net.', sig: { econ: 32, auth: 48, foreign: 55, env: 65, tech: 55, estab: 30 } },
    { name: 'Liberal Centrist',            share: 18, line: 'Liberal instincts, pragmatic doses.',          sig: { econ: 50, auth: 40, foreign: 60, env: 60, tech: 65, estab: 25 } },
    { name: 'Techno-Optimist',             share: 3,  line: 'The future is a build problem.',               sig: { econ: 55, auth: 30, foreign: 70, env: 55, tech: 90, estab: 50 } },
    { name: 'Libertarian',                 share: 5,  line: 'The state should mostly get out of the way.',  sig: { econ: 78, auth: 12, foreign: 55, env: 40, tech: 80, estab: 70 } },
    { name: 'Market Liberal',              share: 12, line: 'Open markets, open society.',                  sig: { econ: 68, auth: 42, foreign: 65, env: 50, tech: 75, estab: 30 } },
    { name: 'Communitarian',               share: 11, line: 'Community before both market and self.',      sig: { econ: 40, auth: 62, foreign: 40, env: 60, tech: 40, estab: 55 } },
    { name: 'Traditional Conservative',    share: 14, line: 'What has lasted deserves to lead.',            sig: { econ: 60, auth: 75, foreign: 35, env: 40, tech: 45, estab: 35 } },
    { name: 'National Populist',           share: 10, line: 'Home and its people come first.',              sig: { econ: 45, auth: 72, foreign: 20, env: 35, tech: 50, estab: 85 } },
  ]},
  values: { list: [
    { name: 'The Tempered Optimist', share: 12, line: 'Hopeful, with both eyes open.',            sig: { future: 58, circle: 48, hedonism: 52, meaning: 70, moral: 45, beauty: 75 } },
    { name: 'The Romantic',          share: 6,  line: 'Beauty and meaning over comfort.',         sig: { future: 50, circle: 45, hedonism: 60, meaning: 78, moral: 40, beauty: 92 } },
    { name: 'The Provider',          share: 16, line: 'Duty to your own comes first.',            sig: { future: 48, circle: 22, hedonism: 40, meaning: 60, moral: 70, beauty: 50 } },
    { name: 'The Rationalist',       share: 7,  line: 'Right answers exist — go find them.',      sig: { future: 60, circle: 55, hedonism: 45, meaning: 45, moral: 88, beauty: 30 } },
    { name: 'The Builder',           share: 9,  line: 'Betting on the future, actively.',         sig: { future: 88, circle: 50, hedonism: 50, meaning: 50, moral: 55, beauty: 45 } },
    { name: 'The Utilitarian',       share: 3,  line: 'The most good, wherever it lands.',        sig: { future: 60, circle: 92, hedonism: 45, meaning: 55, moral: 70, beauty: 40 } },
    { name: 'The Worried Idealist',  share: 10, line: 'High ideals, low expectations.',           sig: { future: 20, circle: 62, hedonism: 40, meaning: 72, moral: 50, beauty: 60 } },
    { name: 'The Traditionalist',    share: 16, line: 'The old weights still hold.',              sig: { future: 40, circle: 28, hedonism: 35, meaning: 65, moral: 78, beauty: 55 } },
    { name: 'The Hedonist',          share: 13, line: 'Life is for enjoying, now.',               sig: { future: 55, circle: 40, hedonism: 88, meaning: 28, moral: 35, beauty: 65 } },
    { name: 'The Wanderer',          share: 8,  line: 'Pleasure and beauty, few obligations.',    sig: { future: 55, circle: 45, hedonism: 72, meaning: 55, moral: 22, beauty: 72 } },
  ]},
  attachment: { list: [
    { name: 'The Constant',      share: 11, line: 'Shows up warm, stays for years.',             sig: { warm: 80, loyal: 85, open: 60, play: 55, easy: 60 } },
    { name: 'The Loyalist',      share: 9,  line: 'Loyalty is the whole point.',                 sig: { warm: 60, loyal: 90, open: 45, play: 45, easy: 50 } },
    { name: 'The Cheerleader',   share: 9,  line: 'Your loudest fan in any room.',               sig: { warm: 85, loyal: 60, open: 70, play: 80, easy: 65 } },
    { name: 'The Fixture',       share: 12, line: 'Unshakeable, unfussy, always there.',         sig: { warm: 50, loyal: 85, open: 35, play: 35, easy: 75 } },
    { name: 'The Confidant',     share: 8,  line: 'The friend the real stuff goes to.',          sig: { warm: 70, loyal: 75, open: 85, play: 45, easy: 55 } },
    { name: 'The Open Book',     share: 6,  line: 'Nothing held back, nothing hidden.',          sig: { warm: 65, loyal: 55, open: 90, play: 60, easy: 55 } },
    { name: 'The Comic Relief',  share: 9,  line: 'Keeps the group laughing through anything.',  sig: { warm: 55, loyal: 55, open: 50, play: 90, easy: 60 } },
    { name: 'The Floater',       share: 6,  line: 'Knows everyone, owned by no one.',            sig: { warm: 70, loyal: 30, open: 55, play: 80, easy: 75 } },
    { name: 'The Chill One',     share: 12, line: 'No drama, no scorekeeping.',                  sig: { warm: 55, loyal: 50, open: 50, play: 65, easy: 90 } },
    { name: 'The Overinvested',  share: 4,  line: 'All in, all the time.',                       sig: { warm: 75, loyal: 60, open: 75, play: 75, easy: 30 } },
    { name: 'The Slow Burn',     share: 10, line: 'Hard to earn, harder to lose.',               sig: { warm: 45, loyal: 70, open: 40, play: 35, easy: 65 } },
    { name: 'The Small Circle',  share: 4,  line: 'A small circle, fiercely kept.',              sig: { warm: 40, loyal: 80, open: 25, play: 40, easy: 45 } },
  ]},
  // ── the role instruments (D201) ──────────────────────────────────────
  // Same discipline as the four above: extreme on the 1–2 dims that DEFINE
  // the type, near-neutral elsewhere, shares summing to 100 — all three are
  // assumptions `IS_archScores` makes (it weights by |sig − 50| and taxes
  // rare types by log(maxShare/share)).
  duo: { list: [
    { name: 'The Mind Reader', share: 7,  line: 'Calls their answer before they do.',                 sig: { read: 92, seen: 52, like: 55, steady: 68 } },
    { name: 'The Open Book',   share: 12, line: 'Easy to call, and fine with it.',                    sig: { read: 52, seen: 92, like: 58, steady: 62 } },
    { name: 'The Poker Face',  share: 8,  line: 'Nobody\u2019s guess lands.',                          sig: { read: 55, seen: 10, like: 45, steady: 60 } },
    { name: 'The Two-Way',     share: 6,  line: 'You read each other equally well.',                  sig: { read: 86, seen: 86, like: 66, steady: 72 } },
    { name: 'The Stranger',    share: 9,  line: 'Two people still guessing.',                         sig: { read: 18, seen: 20, like: 42, steady: 45 } },
    { name: 'The Twin',        share: 13, line: 'Same answer before either of you guesses.',          sig: { read: 64, seen: 64, like: 94, steady: 70 } },
    { name: 'The Wildcard',    share: 10, line: 'Right, wrong, right \u2014 no pattern to hold.',       sig: { read: 55, seen: 48, like: 50, steady: 8 } },
    { name: 'The Opposite',    share: 11, line: 'Never the same answer \u2014 you read each other anyway.', sig: { read: 72, seen: 68, like: 8, steady: 60 } },
    { name: 'The Watcher',     share: 9,  line: 'Reads more than gets read.',                         sig: { read: 82, seen: 24, like: 50, steady: 66 } },
    { name: 'The Steady Hand', share: 15, line: 'Same call, week after week.',                        sig: { read: 60, seen: 60, like: 55, steady: 94 } },
  ] },
  // SIX, not the prototype's nine. `cast` (how often the group crowns you)
  // has no live source — it reads a demo-only scenario generator — so
  // data/roles.ts does not compute it, and three of the nine types cannot
  // survive its removal: "The First Pick" (cast 94) and "The Spark" (78)
  // are DEFINED by it, and "The Floater" was only distinguishable from the
  // neutral by a low one (16) — without it its signature is 46/46/44,
  // which `IS_archScores` weights by |sig − 50| and can therefore never
  // pick. A type that cannot win is dead weight in a table the rarity tax
  // reads as a distribution, so all three are dropped rather than kept
  // hollow and the shares renormalised from 83 back to 100.
  group: { list: [
    { name: 'The Anchor',         share: 19, line: 'Where the group lands, you already were.',  sig: { own: 12, pull: 84, settle: 86 } },
    { name: 'The Contrarian',     share: 13, line: 'The one vote against, most weeks.',         sig: { own: 92, pull: 28, settle: 58 } },
    { name: 'The Bellwether',     share: 18, line: 'Vote with you and you vote with everyone.', sig: { own: 20, pull: 92, settle: 66 } },
    { name: 'The Wildcard',       share: 16, line: 'In with them, then out, no rhythm.',        sig: { own: 58, pull: 44, settle: 8 } },
    { name: 'The Quiet Majority', share: 24, line: 'With the group, never at the front.',       sig: { own: 10, pull: 68, settle: 78 } },
    { name: 'The Outlier',        share: 10, line: 'Your own answer, every time.',              sig: { own: 88, pull: 10, settle: 54 } },
  ] },
};

// Which named type each of your people landed on, per test (by person id).
//
// Every id in IS_DATA.people belongs in all five maps: `sameType` on the
// result card reads this by person, so a person missing here is simply
// absent from the "landed on the same type as you" row — invisible, and
// indistinguishable from a person who genuinely landed elsewhere. Every
// value has to be a name from IS_ARCHETYPES above for the same reason: a
// typo matches nobody and fails silently. src/v2/test/sample-people.test.js
// holds both properties.
window.IS_FRIEND_TYPES = {
  big5: {
    f1: 'The Quiet One', f2: 'The Live Wire', f3: 'The Planner', f4: 'The Diplomat', f5: 'The Quiet One', f6: 'The Reader', f7: 'The Sensitive',
    f8: 'The Enthusiast', f9: 'The Dependable', f10: 'The Lookout', f11: 'The Live Wire', f12: 'The Diplomat', f13: 'The Quiet One',
    f14: 'The Plain Speaker', f15: 'The Host', f16: 'The Drifter', f17: 'The Planner', f18: 'The Quiet One', f19: 'The Dependable',
    f20: 'The Host', f21: 'The Plain Speaker', f22: 'The Reader', f23: 'The Drifter', f24: 'The Sensitive',
  },
  political: {
    f1: 'Social Democrat', f2: 'Liberal Centrist', f3: 'Market Liberal', f4: 'Social Democrat', f5: 'Green Left', f6: 'Communitarian', f7: 'Solidarity Left',
    f8: 'Liberal Centrist', f9: 'Traditional Conservative', f10: 'Social Democrat', f11: 'Social Democrat', f12: 'Green Left', f13: 'Liberal Centrist',
    f14: 'Solidarity Left', f15: 'Market Liberal', f16: 'Libertarian', f17: 'Social Democrat', f18: 'Green Left', f19: 'Communitarian',
    f20: 'Communitarian', f21: 'National Populist', f22: 'Liberal Centrist', f23: 'Techno-Optimist', f24: 'Green Left',
  },
  values: {
    f1: 'The Tempered Optimist', f2: 'The Hedonist', f3: 'The Rationalist', f4: 'The Provider', f5: 'The Romantic', f6: 'The Traditionalist', f7: 'The Worried Idealist',
    f8: 'The Hedonist', f9: 'The Traditionalist', f10: 'The Provider', f11: 'The Builder', f12: 'The Builder', f13: 'The Rationalist',
    f14: 'The Romantic', f15: 'The Wanderer', f16: 'The Hedonist', f17: 'The Utilitarian', f18: 'The Romantic', f19: 'The Provider',
    f20: 'The Utilitarian', f21: 'The Traditionalist', f22: 'The Tempered Optimist', f23: 'The Wanderer', f24: 'The Worried Idealist',
  },
  attachment: {
    f1: 'The Slow Burn', f2: 'The Constant', f3: 'The Confidant', f4: 'The Cheerleader', f5: 'The Chill One', f6: 'The Constant', f7: 'The Confidant',
    f8: 'The Comic Relief', f9: 'The Fixture', f10: 'The Fixture', f11: 'The Open Book', f12: 'The Constant', f13: 'The Small Circle',
    f14: 'The Open Book', f15: 'The Chill One', f16: 'The Floater', f17: 'The Loyalist', f18: 'The Confidant', f19: 'The Fixture',
    f20: 'The Cheerleader', f21: 'The Floater', f22: 'The Slow Burn', f23: 'The Chill One', f24: 'The Overinvested',
  },
};

// Standout phrases per dim: [below-average phrase, above-average phrase]
window.IS_STANDOUT = {
  big5: {
    O: ['more practical-minded than most', 'more curious than most people'],
    C: ['looser with plans than most', 'more disciplined than most'],
    E: ['more inward than most', 'more outgoing than most'],
    A: ['blunter than most', 'warmer and quicker to trust than most'],
    N: ['steadier under stress than most', 'feels the bumps more than most'],
  },
  political: {
    econ:    ['further left on money than most', 'further right on money than most'],
    auth:    ['values personal liberty more than most', 'values order more than most'],
    foreign: ['more nation-first than most', 'more globally minded than most'],
    env:     ['less alarmed about climate than most', 'treats climate as urgent, far more than most'],
    tech:    ['warier of tech than most', 'more tech-optimistic than most'],
    estab:   ['trusts the system more than most', 'more anti-establishment than most'],
  },
  values: {
    future:   ['darker about the future than most', 'more hopeful about the future than most'],
    circle:   ['keeps care closer to home than most', 'draws the circle wider than most'],
    hedonism: ['more duty-bound than most', 'gives pleasure more weight than most'],
    meaning:  ['chases happiness more than most', 'finds more meaning in struggle than most'],
    moral:    ['more of a relativist than most', 'more certain of right answers than most'],
    beauty:   ['more truth-first than most', 'puts beauty higher than almost anyone'],
  },
  attachment: {
    warm:  ['more reserved than most', 'openly warmer than most'],
    loyal: ['lighter-touch with friendships than most', 'more loyal than most people'],
    open:  ['more guarded than most', 'lets people in more than most'],
    play:  ['more grounded than most', 'keeps it lighter than most'],
    easy:  ['more invested than most', 'more easygoing than most'],
  },
};

// Compact direction words per dim — used on "nearly" chips: "if {word}"
window.IS_DIM_WORD = {
  big5: { O: ['more practical', 'more curious'], C: ['looser', 'more disciplined'], E: ['quieter', 'more outgoing'], A: ['blunter', 'warmer'], N: ['steadier', 'more sensitive'] },
  political: { econ: ['further left on money', 'further right on money'], auth: ['more liberty-minded', 'more order-minded'], foreign: ['more nation-first', 'more global'], env: ['cooler on climate', 'more climate-urgent'], tech: ['warier of tech', 'more tech-hopeful'], estab: ['more system-trusting', 'more anti-establishment'] },
  values: { future: ['darker on the future', 'more hopeful'], circle: ['more family-first', 'more stranger-minded'], hedonism: ['more duty-bound', 'more pleasure-first'], meaning: ['more happiness-first', 'more struggle-friendly'], moral: ['more relativist', 'more certain'], beauty: ['more truth-first', 'more beauty-first'] },
  attachment: { warm: ['more reserved', 'warmer'], loyal: ['lighter-touch', 'more loyal'], open: ['more guarded', 'more open'], play: ['more grounded', 'more playful'], easy: ['more invested', 'more easygoing'] },
  duo: { read: ['harder to read them', 'sharper on them'], seen: ['harder to read', 'easier to read'], like: ['further apart', 'closer together'], steady: ['streakier', 'steadier'] },
  group: { own: ['more with the room', 'more your own'], pull: ['further from the middle', 'closer to the middle'], settle: ['streakier', 'steadier'] },
};

// Why you're NOT that neighbour type: the dim you'd have to shift most, as
// a short "if {word}" phrase — e.g. "if more outgoing".
// Weighted the same way as matching: the gap only counts on dims that DEFINE
// that neighbour, so we never explain a Sentinel as "if more playful".
window.IS_nearWhy = function (testKey, dims, a) {
  const words = (window.IS_DIM_WORD || {})[testKey];
  if (!words || !dims || !a) return null;
  let best = null, bm = 0;
  dims.forEach(d => {
    if (a.sig[d.id] == null || !words[d.id]) return;
    const diff = a.sig[d.id] - d.value;
    const weight = (ARCH_W_FLOOR + Math.abs(a.sig[d.id] - 50)) / 100;
    const m = Math.abs(diff) * weight;
    if (m > bm) { bm = m; best = words[d.id][diff > 0 ? 1 : 0]; }
  });
  return best;
};

// ── matching ────────────────────────────────────────────────────────────────
// Three rules, in order of importance:
//  1. IDENTITY LIVES IN THE DEFINING DIMS. A type's signature is extreme on the
//     1–2 dims that make it that type and near-neutral elsewhere. So each dim's
//     weight is |sig − 50|: missing a type's defining dim is disqualifying,
//     missing a dim it has no opinion about barely counts. Without this, a
//     middling profile lands on whichever signature happens to sit near 50.
//  2. SCORES ARE READ AGAINST THE POPULATION, NOT THE MIDPOINT. Dims have very
//     different baselines (people average A:65 but N:48), so both you and the
//     signature are centred on IS_TEST_AVG before comparing.
//     DELIBERATELY THE AUTHORED BASELINE, not the measured one D157 built.
//     A matcher centred on a live sample would move which type you ARE as
//     the sample grew — the name on your card changing because strangers
//     answered, with nothing on screen to explain it. The constant is a
//     model parameter here; where the same numbers were a CLAIM about
//     other people (the "most people" ring, the percentile, the rarity
//     field) they are now measured or absent.
//  3. COMMON TYPES ARE COMMON. Raw nearest-neighbour lets a 3%-share type win
//     by a rounding error. A share prior (log-odds against the modal type)
//     taxes rare types by a fixed, small penalty — enough to break near-ties
//     toward the plausible answer, never enough to overrule a real match.
const ARCH_W_FLOOR = 6;      // every dim counts a little
const ARCH_SHARE_PULL = 210; // strength of the commonness prior

window.IS_archScores = function (testKey, dims) {
  const sys = IS_ARCHETYPES[testKey];
  if (!sys || !dims || !dims.length) return null;
  const avg = IS_TEST_AVG[testKey] || {};
  const maxShare = Math.max.apply(null, sys.list.map(a => a.share || 1));
  return sys.list.map(a => {
    let s = 0, w = 0;
    dims.forEach(d => {
      if (a.sig[d.id] == null) return;
      const base = avg[d.id] != null ? avg[d.id] : 50;
      const wt = ARCH_W_FLOOR + Math.abs(a.sig[d.id] - 50);   // rule 1
      const e = (a.sig[d.id] - base) - (d.value - base);      // rule 2
      s += wt * e * e; w += wt;
    });
    const fit = w ? s / w : 1e9;                              // mean weighted sq. error
    const prior = ARCH_SHARE_PULL * Math.log(maxShare / Math.max(1, a.share || 1)); // rule 3
    return { fit, score: fit + prior };
  });
};

// ── rarity that is actually ABOUT YOU ───────────────────────────────────────
// Not "your type is 7% of people" (a fact about the type — identical for every
// member of it) but "how far from the average person do you sit", which is
// yours, differs per test, and moves as the feed maps you. Distance is the RMS
// deviation from IS_TEST_AVG in dim points; people scatter ~15 points per axis,
// so z = rms/15 and the share of people at least this far out follows the
// fitted survival curve exp(−0.916·z^2.33)  (z=1 → ~40%, 1.5 → ~9%, 2 → ~1%).
window.IS_profileRarity = function (testKey, dims) {
  const avg = IS_TEST_AVG[testKey];
  if (!avg || !dims || !dims.length) return null;
  let s = 0, n = 0;
  dims.forEach(d => { if (avg[d.id] != null) { const e = d.value - avg[d.id]; s += e * e; n++; } });
  if (!n) return null;
  const z = Math.sqrt(s / n) / 15;
  const frac = Math.exp(-0.916 * Math.pow(Math.max(0.02, z), 2.33));
  const pct = Math.max(1, Math.min(96, Math.round(frac * 100)));
  // Phrase it to match the dots: a nearly-full grid must not carry a rarity
  // boast, and "1 in 1.4" is not a quantity anyone says. Common → "74 in 100";
  // genuinely unusual → "1 in n", integer, n ≥ 5.
  const common = pct >= 20;
  return { pct, z, common, label: common ? pct + ' IN 100' : '1 IN ' + Math.round(100 / pct) };
};

// ── what CONSTITUTES a type, stated as a rule ──────────────────────────────────
// A signature vector is a point, and a point can't be argued with. Read off its
// defining dims instead — "high openness · high warmth" — and the type becomes a
// claim you can agree or disagree with. Derived from the sig, so it can never
// drift out of sync with what the matcher actually rewards.
// Nouns for the rule line — dim labels are adjectives in some sets ("loyal"),
// which reads as broken English after "high". These are always nouns.
window.IS_RULE_WORD = {
  big5:       { O: 'openness', C: 'discipline', E: 'outgoingness', A: 'warmth', N: 'sensitivity' },
  political:  { econ: 'market freedom', auth: 'order', foreign: 'global outlook', env: 'climate urgency', tech: 'tech optimism', estab: 'distrust of the system' },
  values:     { future: 'hope', circle: 'breadth of care', hedonism: 'pleasure', meaning: 'meaning', moral: 'moral certainty', beauty: 'beauty' },
  attachment: { warm: 'warmth', loyal: 'loyalty', open: 'openness', play: 'playfulness', easy: 'ease' },
};

// Adjective per pole — the rule reads as a claim ("very curious + warm"), so it
// needs adjectives, not the nouns the axis labels use. Written out rather than
// derived from IS_DIM_WORD because those are comparatives ("warmer", "looser")
// and don't survive a prefix.
window.IS_RULE_ADJ = {
  big5: { O: ['practical', 'curious'], C: ['loose', 'disciplined'], E: ['reserved', 'outgoing'], A: ['blunt', 'warm'], N: ['unshakeable', 'sensitive'] },
  political: { econ: ['left on money', 'pro-market'], auth: ['liberty-first', 'order-first'], foreign: ['nation-first', 'globally-minded'], env: ['growth-first', 'climate-urgent'], tech: ['tech-wary', 'tech-hopeful'], estab: ['system-trusting', 'anti-system'] },
  values: { future: ['dark on the future', 'hopeful'], circle: ['family-first', 'stranger-minded'], hedonism: ['duty-bound', 'pleasure-first'], meaning: ['happiness-first', 'meaning-seeking'], moral: ['relativist', 'morally certain'], beauty: ['truth-first', 'beauty-first'] },
  attachment: { warm: ['reserved', 'warm'], loyal: ['light-touch', 'loyal'], open: ['guarded', 'open'], play: ['grounded', 'playful'], easy: ['invested', 'easygoing'] },
};

// ── the dims that EARN the name, as a claim you can agree or disagree with ──
// Three corrections over reading |sig − 50|:
//  1. DISTINCTIVENESS IS MEASURED AGAINST PEOPLE, NOT THE MIDPOINT. Dims have
//     different baselines (people average A:65, N:48), so a signature at A:80 is
//     only mildly warm for a person while A:50 is genuinely cold — the midpoint
//     reading calls the first defining and the second an absence of opinion.
//  2. ALWAYS AT LEAST TWO. A fixed magnitude cut starves exactly the types that
//     need explaining most: the modal, moderate ones (Liberal Centrist, 18% of
//     people) clear it on one dim, while extreme rare types clear it on three.
//     Rank by deviation and take the top 2, with a 3rd when it's still real.
//  3. MODERATION IS A POSITION. A type sitting at the population average on a
//     dim gets said out loud ("even on money"), not dropped.
const RULE_STRONG = 18;  // dim points from the population — a defining lean
const RULE_REAL = 8;     // ...a lean worth naming at all

window.IS_typeRuleParts = function (testKey, dims, a, max) {
  if (!a || !dims) return [];
  const nouns = (window.IS_RULE_WORD || {})[testKey] || {};
  const adjs = (window.IS_RULE_ADJ || {})[testKey] || {};
  const avg = IS_TEST_AVG[testKey] || {};
  const cap = max || 3;
  const scored = dims.filter(d => a.sig[d.id] != null).map(d => {
    const base = avg[d.id] != null ? avg[d.id] : 50;
    return { d, dev: a.sig[d.id] - base };
  }).sort((x, y) => Math.abs(y.dev) - Math.abs(x.dev));
  // top 2 always; a 3rd only if it is still a real lean
  const picked = scored.slice(0, Math.min(cap, Math.max(2, scored.filter(x => Math.abs(x.dev) >= RULE_REAL).length)));
  return picked.map(x => {
    const mag = Math.abs(x.dev);
    const band = mag >= RULE_STRONG ? 'strong' : mag >= RULE_REAL ? 'lean' : 'even';
    const pair = adjs[x.d.id];
    const noun = nouns[x.d.id] || String(x.d.label || x.d.id).toLowerCase();
    const adj = pair ? pair[x.dev > 0 ? 1 : 0] : (x.dev > 0 ? 'high ' : 'low ') + noun;
    return {
      id: x.d.id, high: x.dev > 0, band, dev: x.dev,
      text: band === 'even' ? 'even on ' + noun : band === 'strong' ? 'very ' + adj : adj,
    };
  });
};

// Nearest type → { list, idx, dists (priored), fits (raw), rms, gap }
window.IS_matchArchetype = function (testKey, dims) {
  const sys = IS_ARCHETYPES[testKey];
  const sc = window.IS_archScores(testKey, dims);
  if (!sc) return null;
  let best = 0;
  sc.forEach((x, i) => { if (x.score < sc[best].score) best = i; });
  // Fit strength measured in DIM POINTS so the bands are readable: `rms` is your
  // typical miss against your own type's signature, `gap` is how many points
  // worse the runner-up is. gap ≥ 12 = a country mile; < 5 = effectively a tie.
  const rmsOf = sc.map(x => Math.sqrt(Math.max(0, x.fit)));
  const up = sc.map((x, i) => ({ i, s: x.score })).filter(x => x.i !== best).sort((a, b) => a.s - b.s)[0];
  return {
    list: sys.list, idx: best, rmsOf,
    dists: sc.map(x => x.score), fits: sc.map(x => x.fit),
    rms: rmsOf[best], gap: up ? rmsOf[up.i] - rmsOf[best] : 99,
  };
};

window.IS_ARCHETYPES = IS_ARCHETYPES;

// Named exports for typed consumers (data/typeMix.ts, D141) — ADDITIVE:
// the globals above stay until this module's full conversion, existing
// spec consumers keep reading them, and the coupling ratchet counts
// references, which an import is not.
export const ARCHETYPES = IS_ARCHETYPES;
export const matchArchetype = window.IS_matchArchetype;
