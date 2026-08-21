// @vitest-environment jsdom
//
// The patterns SHELL's two honest states. The lenses have their own
// suites — this file is what is left of a larger one after the split.
//
// WHAT THIS FILE WAS. It was written when PatternsTab.tsx was the whole
// tab (4.71% branch coverage, no test that rendered either lens), and it
// pinned the two single-character edits that were the entire risk
// surface: the Map's decode of the viewer's own answer, and the Oracle's
// confidence. D214–D216 then split the tab into PatternsMap.tsx,
// PatternsOracle.tsx and PatternsPeople.tsx, each with its own suite, and
// took both cases with them — the Map's `you said …` is pinned in
// PatternsMap.test.tsx, and the confidence moved to PatternsOracle's fill
// (see the case added there, which is this file's second half rehoused
// rather than dropped: the redesign kept the branch and changed only
// where it prints).
//
// WHAT IS STILL ONLY HERE. The shell decides whether ANY lens mounts, and
// the two states below are the ones a wrong answer makes worst:
// "no fit has published" must not become the prototype's invented crowd
// (D166 §1 — live data only), and "still loading" must not become "there
// is nothing". Both are one boolean, and both render plausibly wrong.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  ready: true,
  hasLoadings: true,
}));

vi.mock("../data/patterns", () => ({
  default: {
    ready: () => h.ready,
    hasLoadings: () => h.hasLoadings,
    pool: () => [],
    nextAsk: () => null,
    seal: () => null,
    grade: () => null,
    meter: () => ({ records: [], called: 0, avgBits: 0 }),
    say: () => Promise.resolve(null),
    subscribe: () => () => {},
  },
  ensureLive: () => Promise.resolve(),
}));

vi.mock("../data/live", () => ({
  default: {
    enabled: true,
    subscribe: () => () => {},
    vote: () => {},
    myVotes: () => ({}),
    // The shell reads the frozen city anchor to name the country chip
    // (D216). Absent from a mock, the tab throws before it draws.
    anchors: () => ({}),
  },
}));

beforeEach(() => {
  h.ready = true;
  h.hasLoadings = true;
  localStorage.clear();
});

afterEach(() => cleanup());

const mount = async () => {
  const { default: PatternsTab } = await import("./PatternsTab");
  return render(<PatternsTab />);
};

describe("PatternsTab · the honest states", () => {
  it("says nothing rather than drawing a crowd when no fit has published", async () => {
    // D166 §1: the trial ships LIVE DATA ONLY. The prototype's 560 invented
    // people are exactly what must not appear here.
    h.hasLoadings = false;
    await mount();
    expect(screen.getByText(/No patterns yet/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it("waits quietly while the loadings doc is still in flight", async () => {
    h.ready = false;
    await mount();
    expect(screen.getByText(/Reading the pattern fit/i)).toBeTruthy();
  });
});
