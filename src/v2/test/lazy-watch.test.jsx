// @vitest-environment jsdom
//
// One timer for every pending Lazy card (2026-09-08 standalone, D430).
// Each card used to own a 400ms setInterval until it showed; a long feed
// mounts dozens at once. The contract: N pending cards hold ONE interval
// between them, a card that shows or unmounts leaves the set, and the
// interval stops with the last one — so an idle feed runs no timer at all.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { Lazy, lazyPendingCount } from '../spec/primitives.jsx';

// jsdom lays nothing out: a card sits at 0,0 and "shows" at once. Push
// every rect a screen below the fold so the cards stay pending.
let restore;
beforeEach(() => {
  vi.useFakeTimers();
  const orig = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = () => ({ top: 4000, bottom: 4200, left: 0, right: 300, width: 300, height: 200 });
  restore = () => { HTMLElement.prototype.getBoundingClientRect = orig; };
});
afterEach(() => { cleanup(); restore(); vi.useRealTimers(); });

describe('Lazy cards share one timer', () => {
  it('N pending cards, one interval; the last cleanup clears it', () => {
    expect(vi.getTimerCount()).toBe(0);
    const { unmount } = render(
      <div>
        {Array.from({ length: 12 }, (_, i) => <Lazy key={i}><span>card {i}</span></Lazy>)}
      </div>,
    );
    expect(lazyPendingCount()).toBe(12);
    expect(vi.getTimerCount(), 'twelve pending cards must not be twelve intervals').toBe(1);
    // the shared tick runs every pending check without showing a card that
    // is still below the fold
    vi.advanceTimersByTime(1200);
    expect(lazyPendingCount()).toBe(12);
    unmount();
    expect(lazyPendingCount()).toBe(0);
    expect(vi.getTimerCount(), 'the interval stops with the last card').toBe(0);
  });

  it('a card that comes into range shows on the shared tick and leaves the set', () => {
    render(<Lazy><span>the card</span></Lazy>);
    expect(lazyPendingCount()).toBe(1);
    // the fold moves: the next tick finds the card in range
    HTMLElement.prototype.getBoundingClientRect = () => ({ top: 100, bottom: 300, left: 0, right: 300, width: 300, height: 200 });
    act(() => { vi.advanceTimersByTime(450); });
    expect(document.body.textContent).toContain('the card');
    expect(lazyPendingCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
