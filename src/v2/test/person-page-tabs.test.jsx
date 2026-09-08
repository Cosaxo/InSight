// @vitest-environment jsdom
//
// The person's page as four tabs (2026-09-08 standalone, D430). What a
// person can see or reach, so a later polish that keeps the behaviour is
// free to move the pixels:
//
//   1. Match · Answers · Together · Map are the page's tabs; Match is open
//      on arrival, and the hero carries the answers' lead sentence.
//   2. A horizontal throw on the body steps the tab; a short one springs
//      back; a wheel with a sideways delta steps it too. The gesture is the
//      overlay's own — NAV is never asked (D166's joint is the daily's).
//   3. Answers is a listbox of one option per shared question, the first
//      split selected on arrival, and the tapped option is read in a card
//      as `both X` or `you X · Ada Y`.
//   4. The Map tab's still is the person's own (`own`), its door opens the
//      full map, and the full map's key says what THAT map encodes — with
//      the crowd / a rarer take — not the still's same / differ.
//   5. The lead sentence has three shapes and never a blank.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { IS_DATA } from '../spec/sample-data.js';
import { registerNav } from '../data/nav';
import { receiptLead } from '../spec/person-overlay.jsx';

const someone = () => (IS_DATA.people || []).find((x) => x.name && !x.anon && x.id);
const openFor = (p) => render(<window.PersonOverlay p={p} me={IS_DATA.me} onClose={() => {}} />);
const body = () => document.querySelector('.overlay .app-body');
const tab = (label) => screen.getByRole('button', { name: label });
const onTab = () => document.querySelector('.subnav-btn.is-on').textContent;
const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

let offNav;
let goNav;
beforeEach(() => {
  localStorage.clear();
  goNav = vi.fn(() => true);
  offNav = registerNav({ goNav });
});
afterEach(() => { cleanup(); offNav?.(); vi.useRealTimers(); });

describe('the four tabs', () => {
  it('arrives on Match with the lead sentence in the hero, and Map is always there', () => {
    openFor(someone());
    expect(onTab()).toBe('Match');
    expect(screen.getByText('What makes the number')).toBeTruthy();
    expect(tab('Map')).toBeTruthy();
    expect(screen.getByText(/^(Same answer|Different answers)/)).toBeTruthy();
    fireEvent.click(tab('Map'));
    expect(onTab()).toBe('Map');
  });

  it('a throw on the body steps the tab, a short drag springs back, and NAV is never asked', () => {
    vi.useFakeTimers();
    openFor(someone());
    const sc = body();
    // a 120px leftward throw: right of the current tab
    fireEvent.touchStart(sc, touch(200, 300));
    fireEvent.touchMove(sc, touch(140, 302));
    fireEvent.touchMove(sc, touch(80, 304));
    fireEvent.touchEnd(sc);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTab()).not.toBe('Match');
    const after = onTab();
    // a 30px drag: below the throw, the panel springs back and nothing moves
    fireEvent.touchStart(sc, touch(200, 300));
    fireEvent.touchMove(sc, touch(185, 300));
    fireEvent.touchMove(sc, touch(170, 300));
    fireEvent.touchEnd(sc);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTab()).toBe(after);
    // a vertical drag is a scroll, not a step
    fireEvent.touchStart(sc, touch(200, 100));
    fireEvent.touchMove(sc, touch(205, 200));
    fireEvent.touchMove(sc, touch(210, 320));
    fireEvent.touchEnd(sc);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTab()).toBe(after);
    // the rightward throw comes back
    fireEvent.touchStart(sc, touch(80, 300));
    fireEvent.touchMove(sc, touch(140, 300));
    fireEvent.touchMove(sc, touch(220, 300));
    fireEvent.touchEnd(sc);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTab()).toBe('Match');
    expect(goNav).not.toHaveBeenCalled();
  });

  it('a sideways wheel steps once per gesture', () => {
    vi.useFakeTimers();
    openFor(someone());
    const sc = body();
    fireEvent.wheel(sc, { deltaX: 60, deltaY: 2 });
    fireEvent.wheel(sc, { deltaX: 60, deltaY: 2 }); // inside the lock: ignored
    act(() => { vi.advanceTimersByTime(200); });
    const after = onTab();
    expect(after).not.toBe('Match');
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.wheel(sc, { deltaX: -60, deltaY: 0 });
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTab()).toBe('Match');
    // a vertical wheel is the page's scroll
    fireEvent.wheel(sc, { deltaX: 2, deltaY: 80 });
    act(() => { vi.advanceTimersByTime(900); });
    expect(onTab()).toBe('Match');
  });
});

describe('Answers', () => {
  it('is a listbox of the shared questions, the first split selected, and a tap reads the question', () => {
    openFor(someone());
    fireEvent.click(tab('Answers'));
    const list = screen.getByRole('listbox');
    expect(list.getAttribute('aria-label')).toMatch(/^\d+ questions you both answered$/);
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(4);
    expect(options.length).toBe(Number(list.getAttribute('aria-label').split(' ')[0]));
    const selected = options.filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
    // the selected one is a split, when there is any split to select
    const split = options.find((o) => /you differ/.test(o.getAttribute('aria-label')));
    if (split) expect(selected[0].getAttribute('aria-label')).toMatch(/you differ/);
    // every option names its prompt and its verdict
    for (const o of options) expect(o.getAttribute('aria-label')).toMatch(/ — (same answer|you differ)$/);
    // tapping a same-answer option reads it as `both X`
    const same = options.find((o) => /same answer$/.test(o.getAttribute('aria-label')));
    if (same) {
      fireEvent.click(same);
      expect(screen.getByText('both')).toBeTruthy();
      expect(same.getAttribute('aria-selected')).toBe('true');
    }
    // the key says the two encodings
    expect(screen.getByText('same answer')).toBeTruthy();
    expect(screen.getByText('you differ')).toBeTruthy();
  });
});

describe('Map', () => {
  it("is the person's own still with one door, and the full map's key describes the full map", () => {
    const p = someone();
    openFor(p);
    fireEvent.click(tab('Map'));
    const first = p.name.split(' ')[0];
    expect(screen.getByText(`${first}’s map`)).toBeTruthy();
    // the still is the portrait (`own`), drawn inside the door. jsdom never
    // measures a pane, so the map parks on its pre-measure canvas here — the
    // measured render, and `own`'s rule, are person-mindmap-still's to pin.
    expect(document.querySelectorAll('.mmt-canvas').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: `Open ${first}'s map` }));
    expect(screen.getByText('with the crowd')).toBeTruthy();
    expect(screen.getByText('a rarer take')).toBeTruthy();
    expect(screen.queryByText('same answer')).toBeNull();
  });
});

describe('the lead sentence', () => {
  const rows = (same, split) => [
    ...Array.from({ length: same }, (_, i) => ({ id: 's' + i, same: true })),
    ...Array.from({ length: split }, (_, i) => ({ id: 'd' + i, same: false })),
  ];
  it('has three shapes and names the splits when they are the story', () => {
    expect(receiptLead(rows(35, 0))).toBe('Same answer on all 35.');
    expect(receiptLead(rows(0, 35))).toBe('Different answers on all 35.');
    expect(receiptLead(rows(34, 1))).toBe('Same answer 34 times out of 35. One split.');
    expect(receiptLead(rows(33, 2))).toBe('Same answer 33 times out of 35. Two splits.');
    expect(receiptLead(rows(20, 15))).toBe('Same answer 20 times out of 35.');
    // two splits among few matches are not "the story" — the count alone
    expect(receiptLead(rows(5, 2))).toBe('Same answer 5 times out of 7.');
  });
});
