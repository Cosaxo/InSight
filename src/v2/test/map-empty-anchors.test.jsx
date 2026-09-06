// @vitest-environment jsdom
// The Map's answer card with NO anchor ring.
//
// An empty ring is a legitimate live result — map-anchors.js says so and
// names the two callers that handle it. MTAnswerBody was the third and did
// not: it picks an anchor with `find(...) || anchors[0]` and reads `.id`
// two lines later with nothing between, so with no anchors it threw a
// TypeError before rendering anything. app-shell wraps every tab in a
// boundary, so what that costs is the whole Mirror tab, not one card.
//
// Reachable on an ordinary account: somebody who skipped the Basics card
// and has taken no test has nothing to filter by.
//
// MOUNTED THROUGH THE BRIDGE. MTAnswerBody is module-private and
// MTAnswerCard is published on `window` rather than exported, so the
// module is imported for its side effect and the component read off the
// global — which is also the only way to reach the private body at all.
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import '../spec/map-bottom-card.jsx';
import { MapStats } from '../spec/map-group-stats.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// The anchored path reaches MTGroupBars, which asks MapStats for the
// group reading. Null is its refusal answer (D72's shape — null rather
// than a fabricated number), so the card draws without one.
//
// STUBBED ON THE IMPORTED OBJECT, not on `window.MapStats`. This case
// arrived written the second way, and it worked on the branch it was
// written on, where map-bottom-card read the bridge. D354's sweep made
// that read an import — and `map-group-stats.js` assigns
// `MapStats = window.MapStats = {…}`, ONE object under two names, so
// reassigning the window property swaps what `window.MapStats` points at
// and leaves the binding the card holds pointing at the real one. The
// stub reached nothing and the control passed on the live reading, which
// is the shape of a test that is green for a reason it does not state.
const noStats = () => {
  for (const m of ['dist', 'mode', 'cohortN', 'dimVal']) vi.spyOn(MapStats, m).mockReturnValue(null);
  vi.spyOn(MapStats, 'groupLabel').mockReturnValue('Age');
};

const node = { id: 'daily-000', prompt: 'Coffee or tea?', qid: 'daily-000', n: 2, aidx: 0 };

describe('the Map answer card with no anchors', () => {
  it('draws the question instead of throwing the Mirror tab away', () => {
    const MTAnswerCard = window.MTAnswerCard;
    expect(MTAnswerCard, 'the card is no longer published on the bridge — this route is gone').toBeTruthy();
    // The whole case: this render used to throw before producing anything.
    render(<MTAnswerCard node={node} cat={{ id: 'c', label: 'Cat' }} anchors={[]} activeA={null} onFilter={() => {}} />);
    expect(
      screen.getByText('Coffee or tea?'),
      'the card drew nothing — the question does not depend on an anchor',
    ).toBeTruthy();
  });

  it('still draws the chips when there IS a ring, so the guard is not the whole card', () => {
    // The control. Without it the case above passes the day somebody makes
    // the body return early unconditionally.
    noStats();
    const MTAnswerCard = window.MTAnswerCard;
    render(<MTAnswerCard node={node} cat={{ id: 'c', label: 'Cat' }}
      anchors={[{ id: 'age', label: 'Age' }]} activeA="age" onFilter={() => {}} />);
    expect(screen.getByText('Coffee or tea?')).toBeTruthy();
    expect(
      document.querySelectorAll('[data-chip], .mmt-chip, button').length,
      'the anchored card drew no controls either — the guard is swallowing the real card',
    ).toBeGreaterThan(0);
  });
});
