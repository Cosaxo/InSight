// @vitest-environment jsdom
//
// A CROWD OF ONE, DRAWN AS A SPREAD — on the Map's answer card.
//
// Tap a rating answer on the You stop, pick the Age (or Work, or Study)
// anchor, and the card reads, correctly: "Yours is the only answer here
// yet — nobody else has answered this in your cell." Directly under that
// sentence it drew a ten-column ridge with one column at full height and
// nine at the floor, labelled "you · 7" — a picture of a crowd's
// distribution that is one person, and the one Mirror stop that wears no
// Preview tag.
//
// `MTVerdict` refuses below two answers and says so in its own comment;
// `MTGroupBars` rendered the ridge unconditionally from `MapStats.dist`,
// whose one-answer cell is [0,…,100,…,0], so the heights came out
// [7,100,7,7,7,7,7,7,7,7].
//
// The same defect the daily's rating card shipped and had fixed on
// 2026-09-07 (the ridge flattens while the count is withheld), on a
// different surface. It survived that sweep because nobody had mounted
// this card's ridge at all — the audit that found it could prove the data
// path and said outright that the render was unverified.
//
// MOUNTED THROUGH THE BRIDGE, and stubbed on the IMPORTED MapStats rather
// than on `window.MapStats` — map-empty-anchors.test.jsx has the full
// reasoning: they are one object under two names, so reassigning the
// window property leaves the card holding the real one.
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import '../spec/map-bottom-card.jsx';
import { MapStats } from '../spec/map-group-stats.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// A rating answer: ten steps, the reader on step 7.
const node = {
  id: 'daily-001', prompt: 'Is a promise still binding?', qid: 'daily-001',
  n: 10, aidx: 6, qtype: 'rating',
};
const anchors = [{ id: 'age', label: 'Age' }];

/** The cell as the store hands it over, for a cohort of `cohortN`. */
const cohort = (cohortN, dist) => {
  vi.spyOn(MapStats, 'dist').mockReturnValue(dist);
  vi.spyOn(MapStats, 'mode').mockReturnValue(dist.indexOf(Math.max(...dist)));
  vi.spyOn(MapStats, 'cohortN').mockReturnValue(cohortN);
  vi.spyOn(MapStats, 'dimVal').mockReturnValue(null);
  vi.spyOn(MapStats, 'groupLabel').mockReturnValue('Age');
};

const heights = () => [...document.querySelectorAll('.mmt-ridge-col i')]
  .map((el) => el.style.height);

const draw = () => {
  const MTAnswerCard = window.MTAnswerCard;
  expect(MTAnswerCard, 'the card is no longer on the bridge — this route is gone').toBeTruthy();
  render(<MTAnswerCard node={node} cat={{ id: 'c', label: 'Cat' }}
    anchors={anchors} activeA="age" onFilter={() => {}} />);
};

describe("the Map's rating ridge, when the cohort is you alone", () => {
  it('draws no spread under a line saying nobody else has answered', () => {
    // One answer — yours, on step 7. This is what `dist` returns for it.
    cohort(1, [0, 0, 0, 0, 0, 0, 100, 0, 0, 0]);
    draw();
    // The verdict block's refusal is what makes the ridge a contradiction
    // rather than merely thin, so it is asserted here too: if this line
    // ever stops appearing, the case below is about a different screen.
    expect(screen.getByText(/only answer here yet/i)).toBeTruthy();
    const h = heights();
    expect(h.length, 'the ridge drew no columns').toBe(10);
    expect(
      new Set(h).size,
      `one person was drawn as a distribution: ${h.join(', ')}`,
    ).toBe(1);
    // …and the card makes no claim about where "most" went, either.
    expect(document.body.textContent).not.toMatch(/most chose/i);
  });

  it('…and draws the real spread as soon as there is a crowd', () => {
    // THE CONTROL. Every assertion above is about sameness, which is also
    // what a ridge that stopped drawing looks like — and flattening a real
    // crowd would cost this card the reading it exists for.
    cohort(24, [0, 4, 8, 12, 20, 16, 24, 8, 4, 4]);
    draw();
    expect(screen.queryByText(/only answer here yet/i), 'a crowd of 24 got the lonely line').toBeNull();
    const h = heights();
    expect(h.length).toBe(10);
    expect(new Set(h).size, 'a published crowd was flattened').toBeGreaterThan(1);
    // The peak is a real reading again: the mode is step 7 and the reader
    // is on step 7, so there is nothing to say about "most" — asserted
    // through a cohort whose peak is elsewhere instead.
    cleanup();
    cohort(24, [0, 4, 8, 40, 20, 16, 4, 8, 4, 4]);
    draw();
    expect(screen.getByText(/most chose 4/i)).toBeTruthy();
  });
});

// ── and the same card's ORDINARY VOTE branch, which the fix missed ──
//
// The refusal above was computed inside `if (node.qtype === 'rating')`,
// so the branch below it — a plain choice, which is most of the bank —
// never saw it. `d` for a single answer is [100, 0], so the segments came
// out at flexGrow 100 against 1.2: a full-width fill with "100%" and "0%"
// printed under it, directly beneath the line saying nobody else has
// answered in this cell.
//
// `world-feed.jsx` states the standard this violated where it draws its
// own bars: gating the numeral but not the fill "would publish the split
// geometrically instead of numerically, which is the same disclosure in a
// different alphabet". Both are gated here.
const voteNode = {
  id: 'daily-002', prompt: 'Would you tell them?', qid: 'daily-002',
  n: 2, aidx: 0, qtype: 'binary',
};

const drawVote = () => {
  const MTAnswerCard = window.MTAnswerCard;
  render(<MTAnswerCard node={voteNode} cat={{ id: 'c', label: 'Cat' }}
    anchors={anchors} activeA="age" onFilter={() => {}} />);
};

const grows = () => [...document.querySelectorAll('.mmt-dbar-seg')]
  .map((el) => el.style.flexGrow);

describe("the Map's option bar, when the cohort is you alone", () => {
  it('draws no split, and prints no percentage, under the same line', () => {
    cohort(1, [100, 0]);
    drawVote();
    expect(screen.getByText(/only answer here yet/i)).toBeTruthy();
    const g = grows();
    expect(g.length, 'the bar drew no segments').toBe(2);
    expect(new Set(g).size, `one answer was drawn as a split: ${g.join(', ')}`).toBe(1);
    // The numeral is the same claim in the other alphabet.
    expect(document.body.textContent).not.toMatch(/\d+%/);
    // …and nothing names a majority that one answer cannot have.
    expect(document.querySelector('.mmt-dbar-mark.is-most')).toBeNull();
    // The reader's own answer is still named and still marked — the point
    // is that the CROWD claim goes, not the row.
    expect(document.querySelector('.mmt-dbar-mark.is-you')).toBeTruthy();
  });

  it('…and draws the real split as soon as there is a crowd', () => {
    // The control, for the same reason the ridge has one: every assertion
    // above is about sameness, which is also what a bar that stopped
    // drawing looks like.
    cohort(30, [70, 30]);
    drawVote();
    expect(screen.queryByText(/only answer here yet/i), 'a crowd of 30 got the lonely line').toBeNull();
    const g = grows();
    expect(new Set(g).size, 'a published split was flattened').toBeGreaterThan(1);
    expect(document.body.textContent).toMatch(/70%/);
  });
});
