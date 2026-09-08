// @vitest-environment jsdom
//
// THE MAP'S ANCHOR CARD, AND WHAT ITS PERCENTAGE IS OVER.
//
// Tap the Age dot on the You stop. The card folds your answers against the
// people who share that anchor, and a `thin` guard drops any question
// whose cohort holds fewer than two votes — rightly, since a cohort of one
// is you. But it dropped those rows from the ARITHMETIC and from BOTH
// LISTS while the headline went on saying "of your answers", so:
//
//   100%   of your answers match people your age
//   [████████████████████ full bar]
//   You answered like most of them on every question.
//   ▸ you agree on 1 answer
//
// …off ONE measured row, with nine answers in neither list and nothing on
// screen saying where they went. "On every question" is false about the
// map the reader is looking at, and this is the You stop — the one Mirror
// stop that wears no Preview tag.
//
// The same file's MTVerdict already holds the opposite standard for the
// same data (D146): it refuses below two answers and prints its basis in
// the sentence above two.
//
// MOUNTED THROUGH THE BRIDGE, with MapStats stubbed on the IMPORTED object
// rather than the window property — map-empty-anchors.test.jsx carries the
// full reasoning: they are one object under two names, so stubbing the
// property leaves the card holding the real one.
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import '../spec/map-bottom-card.jsx';
import { MapStats } from '../spec/map-group-stats.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const anchors = [{ id: 'age', label: 'Age' }];

/** Ten binary answers on the map, all of them yours on option 0. */
const items = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`, qid: `q${i}`, prompt: `Question ${i}`,
  n: 2, aidx: 0, ans: 'Yes', opts: ['Yes', 'No'],
}));

/** `thickFor` questions get a real cohort; the rest hold one vote — you. */
const cohorts = (thickFor) => {
  vi.spyOn(MapStats, 'cohortN').mockImplementation((qid) => (thickFor.includes(qid) ? 6 : 1));
  vi.spyOn(MapStats, 'mode').mockReturnValue(0);
  vi.spyOn(MapStats, 'dist').mockReturnValue(null);
  vi.spyOn(MapStats, 'dimVal').mockReturnValue(null);
  vi.spyOn(MapStats, 'groupLabel').mockReturnValue('people your age');
};

const draw = () => {
  const MTAnchorCard = window.MTAnchorCard;
  expect(MTAnchorCard, 'the card is no longer on the bridge — this route is gone').toBeTruthy();
  render(<MTAnchorCard anchor={anchors[0]} items={items} onPick={() => {}}
    anchors={anchors} onAnchor={() => {}} />);
};

describe('the anchor card says what its percentage is over', () => {
  it('names the measured rows when the thin guard has dropped some', () => {
    // One thick cohort out of ten answers.
    cohorts(['q0']);
    draw();
    const text = document.body.textContent || '';
    // The reading itself is unchanged — it is honest about the row it has.
    expect(text).toMatch(/100%/);
    // …and it now says what those 100% are OF.
    expect(
      text,
      'a percentage over one row was labelled "of your answers", with nine unaccounted for',
    ).toMatch(/from 1 of your 10 here/);
    // The all-same line no longer claims the whole map.
    expect(
      text,
      '"on every question" was said about ten questions on the strength of one',
    ).not.toMatch(/on every question/);
    expect(text).toMatch(/on all 1 counted here/);
  });

  it('…and says neither when every row is measured', () => {
    // THE CONTROL. A basis line that always draws is as wrong as one that
    // never does, and with a full map "on every question" is exactly true.
    cohorts(items.map((q) => q.qid));
    draw();
    const text = document.body.textContent || '';
    expect(text).toMatch(/100%/);
    expect(text, 'a complete reading claimed to be partial').not.toMatch(/from \d+ of your/);
    expect(text).toMatch(/on every question/);
  });
});
