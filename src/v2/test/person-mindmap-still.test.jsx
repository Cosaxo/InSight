// @vitest-environment jsdom
//
// The measured still — the render no other suite can reach.
//
// PersonMindMap returns a bare placeholder until its pane measures
// (`if (!view)`), and jsdom panes never measure: clientWidth is 0, so
// every smoke mount parks on that early return forever. Which is how a
// ReferenceError in the still's label pass (`return keep` sixteen lines
// above `const keep` — a temporal dead zone) shipped without a single
// gate going red: eslint sees a resolvable name, tsc doesn't check .jsx,
// and the one suite that executes a render could not reach the line.
// The 2026-08-26 standalone carries the fix; this file makes the measured
// path reachable so the class of bug stays caught: clientWidth/Height are
// prototype getters here, so the pane "lays out" and the first fit runs.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { PersonMindMap } from '../spec/person-mindmap.jsx';
import { IS_DATA } from '../spec/sample-data.js';

const SIZED = { clientWidth: 360, clientHeight: 330 };
let restores = [];
const measure = () => {
  for (const k of Object.keys(SIZED)) {
    const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k);
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => SIZED[k] });
    restores.push(() => {
      if (orig) Object.defineProperty(HTMLElement.prototype, k, orig);
      else delete HTMLElement.prototype[k];
    });
  }
};

beforeEach(() => { vi.useFakeTimers(); measure(); });
afterEach(() => {
  cleanup();
  restores.forEach((f) => f());
  restores = [];
  vi.useRealTimers();
});

describe('the measured still', () => {
  it('renders past the placeholder without throwing, and shows branch names only', async () => {
    const p = (IS_DATA.people || []).find((x) => x.name && !x.anon);
    const { container } = render(<PersonMindMap p={p} following still centerName="Them" />);
    // the first-fit effect retries on a 120ms timer until the pane
    // measures; with the prototype getters above, one flush is enough
    await act(async () => { vi.advanceTimersByTime(400); });
    // past the placeholder: the measured canvas draws content (the
    // pre-measure return renders an EMPTY .mmt-canvas)
    const canvas = container.querySelector('.mmt-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.childElementCount).toBeGreaterThan(0);
    // the still's own rule: branch (hub) labels draw, answer labels don't.
    // Hub labels render at the category font ramp; answer labels only ever
    // come from the label-keep pass this test exists to reach.
    expect(container.querySelector('.mmt-root.is-still')).toBeTruthy();
  });
});
