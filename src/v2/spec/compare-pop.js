/* eslint-disable */
// ported from design/spec-modules/compare-pop.js — do not hand-edit load order assumptions
import React from 'react';

// compare-pop.js — plausible population averages per scale, for the Compare
// breakdown. Every assessment is on the same 0..100-per-dimension scale as the
// user's own results in IS_TEST_RESULTS, so "you vs them" reads consistently.
//
// Scopes: around (near you) · city (Oslo) · world (Earth) · circle (close ties)
//         · groups (an interest circle). Tuned, not random: your close ties
// resemble you most, the world least. Big-Five / econ-social numbers stay in
// step with IS_DATA.aggregates so the rest of the app agrees.
window.IS_COMPARE_POP = {
  around: {
    label: 'near you', n: 312,
    big5:       { O: 70, C: 60, E: 50, A: 68, N: 40 },
    political:  { econ: 40, auth: 30, foreign: 64, env: 78, tech: 60, estab: 50 },
    values:     { future: 56, circle: 48, hedonism: 54, meaning: 66, moral: 46, beauty: 72 },
    attachment: { warm: 66, loyal: 64, open: 60, play: 58, easy: 62 },
    cognitive:  { analyst: 58, systems: 70, empath: 58, maker: 60 },
  },
  city: {
    label: 'Oslo', n: 1840,
    big5:       { O: 64, C: 65, E: 47, A: 62, N: 44 },
    political:  { econ: 46, auth: 37, foreign: 58, env: 70, tech: 58, estab: 48 },
    values:     { future: 54, circle: 45, hedonism: 56, meaning: 60, moral: 50, beauty: 66 },
    attachment: { warm: 60, loyal: 66, open: 54, play: 54, easy: 60 },
    cognitive:  { analyst: 60, systems: 62, empath: 54, maker: 56 },
  },
  country: {
    label: 'Norway', n: 12400,
    big5:       { O: 60, C: 63, E: 50, A: 61, N: 46 },
    political:  { econ: 49, auth: 42, foreign: 53, env: 64, tech: 57, estab: 52 },
    values:     { future: 53, circle: 42, hedonism: 56, meaning: 59, moral: 54, beauty: 63 },
    attachment: { warm: 59, loyal: 63, open: 55, play: 57, easy: 59 },
    cognitive:  { analyst: 59, systems: 58, empath: 56, maker: 55 },
  },
  world: {
    label: 'the world', n: 184000,
    big5:       { O: 56, C: 60, E: 54, A: 60, N: 48 },
    political:  { econ: 52, auth: 55, foreign: 46, env: 56, tech: 56, estab: 58 },
    values:     { future: 52, circle: 39, hedonism: 56, meaning: 58, moral: 60, beauty: 60 },
    attachment: { warm: 58, loyal: 60, open: 56, play: 60, easy: 58 },
    cognitive:  { analyst: 58, systems: 52, empath: 58, maker: 54 },
  },
  circle: {
    label: 'your circle', n: 9,
    big5:       { O: 74, C: 60, E: 52, A: 72, N: 38 },
    political:  { econ: 40, auth: 27, foreign: 66, env: 80, tech: 62, estab: 48 },
    values:     { future: 58, circle: 48, hedonism: 54, meaning: 70, moral: 46, beauty: 76 },
    attachment: { warm: 76, loyal: 82, open: 66, play: 58, easy: 64 },
    cognitive:  { analyst: 60, systems: 74, empath: 60, maker: 62 },
  },
  groups: {
    label: 'this circle', n: 140,
    big5:       { O: 72, C: 58, E: 54, A: 66, N: 40 },
    political:  { econ: 42, auth: 31, foreign: 62, env: 74, tech: 66, estab: 46 },
    values:     { future: 60, circle: 48, hedonism: 56, meaning: 64, moral: 44, beauty: 70 },
    attachment: { warm: 68, loyal: 64, open: 62, play: 64, easy: 60 },
    cognitive:  { analyst: 64, systems: 72, empath: 52, maker: 66 },
  },
};

