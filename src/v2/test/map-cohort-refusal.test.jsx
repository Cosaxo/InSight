// @vitest-environment jsdom
//
// WHICH ABSENCE THE MAP'S CARD IS DESCRIBING.
//
// Tap an anchor whose reading is missing and the card says so. There are
// two reasons it can be missing and they need different sentences:
//
//   age · education · work   map onto a breakdown dim, so a missing cell
//                            really is a matter of more people answering.
//   big five · politics ·    are test RESULTS. Nothing aggregates them per
//   values · social style    cohort, so there is no source at all, and no
//                            number of answers will ever produce one.
//
// One sentence covered both — "it needs more people on this question
// first" — which is a promise the app cannot keep for four of the seven
// anchors, on the You stop, the one Mirror stop that wears no Preview tag.
// `map-group-stats.js` says exactly this in its own header: those four
// have "no source rather than a withheld one".
//
// Stubbed on the IMPORTED MapStats, not the window property, for the
// reason map-anchor-basis.test.jsx gives: one object, two names.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import '../spec/map-bottom-card.jsx';
import { MapStats } from '../spec/map-group-stats.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const items = Array.from({ length: 4 }, (_, i) => ({
  id: `q${i}`, qid: `q${i}`, prompt: `Question ${i}`,
  n: 2, aidx: 0, ans: 'Yes', opts: ['Yes', 'No'],
}));

beforeEach(() => {
  // The live refusal: no distribution for any question, whatever the
  // anchor — which is what a live build returns for all seven.
  vi.spyOn(MapStats, 'dist').mockReturnValue(null);
  vi.spyOn(MapStats, 'mode').mockReturnValue(null);
  vi.spyOn(MapStats, 'dimVal').mockReturnValue(null);
  vi.spyOn(MapStats, 'cohortN').mockReturnValue(0);
});

const draw = (anchor) => {
  const MTAnchorCard = window.MTAnchorCard;
  expect(MTAnchorCard, 'the card is no longer on the bridge — this route is gone').toBeTruthy();
  render(<MTAnchorCard anchor={anchor} items={items} onPick={() => {}}
    anchors={[anchor]} onAnchor={() => {}} />);
  return document.body.textContent || '';
};

describe('a cohort the app cannot read', () => {
  it('does not tell the reader to wait for people who would not help', () => {
    vi.spyOn(MapStats, 'measurable').mockImplementation((id) => id !== 'big5');
    vi.spyOn(MapStats, 'groupLabel').mockReturnValue('similar personalities');
    const text = draw({ id: 'big5', label: 'Big Five' });
    expect(text, 'a permanent absence was described as a queue').not.toMatch(/needs more people/);
    expect(text).toMatch(/isn’t something this app counts/);
    // the half that is true of both stays
    expect(text).toMatch(/Your answer is on the map/);
  });

  it('…and still says it for an anchor more people really would fix — the control', () => {
    vi.spyOn(MapStats, 'measurable').mockImplementation((id) => id !== 'big5');
    vi.spyOn(MapStats, 'groupLabel').mockReturnValue('people your age');
    const text = draw({ id: 'age', label: 'Age' });
    expect(text).toMatch(/needs more people on this question first/);
    expect(text, 'a pending cell was called uncountable').not.toMatch(/isn’t something this app counts/);
  });
});
