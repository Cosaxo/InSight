// @vitest-environment jsdom
//
// The OTHER mark on every lens scale — the one labelled "most people".
//
// `d.demo` is an authored number from the prototype's population
// (lens-defs.js), and live mode measures no such thing. The cards read it
// directly at four draw sites, so a real account saw a tick on every axis,
// a legend chip reading "most people", a key row in the explain sheet
// pointing at that tick, and a sentence like "Care runs above typical."
// None of it was measured.
//
// lens-cards.jsx's own header records that the prior was removed from
// `score()` because "live mode has no typical-person prior to fall back
// on … 'you score 0 on Care' is a claim, and a false one". It was taken
// out of your score and left in as the thing your score is drawn against.
//
// LIVE is flipped on the real singleton, not via a second object on
// `window`: lens-defs.js imports the binding, so a `window.LIVE` stand-in
// would leave the module under test reading `enabled: false` while the
// test believed otherwise — the failure live-fixture.ts documents. Copied
// from lens-live.test.ts, which is where this idiom is explained.
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import realLive from "../data/live";
// @ts-expect-error TS7016 — untyped spec module, the house pattern
import { LensesPanel } from "../spec/lens-cards.jsx";
// @ts-expect-error TS7016 — untyped spec module, the house pattern
import { LENSES } from "../spec/lens-defs.js";

const target = realLive;
const saved = new Map();
function setLive(members) {
  for (const [k, v] of Object.entries(members)) {
    if (!saved.has(k)) saved.set(k, Object.getOwnPropertyDescriptor(target, k));
    Object.defineProperty(target, k, { value: v, writable: true, configurable: true, enumerable: true });
  }
}
afterEach(() => {
  cleanup();
  for (const [k, d] of saved) { if (d) Object.defineProperty(target, k, d); else delete target[k]; }
  saved.clear();
  LENSES.reset();
  localStorage.clear();
});

// A real reading on the first lens, so every viz has something to draw and
// the tick has a `read` row to sit beside. Without this the panel would be
// blank and every assertion below would pass for the wrong reason.
const answerFirstLens = () => {
  const moral = LENSES.all[0];
  moral.questions.forEach((_, i) => LENSES.answer(moral.id, i, i % 5));
};

const ticks = (c) => c.querySelectorAll('[aria-hidden="true"]').length;

describe("the lenses tab on a LIVE build", () => {
  it("does not label an authored number 'most people'", () => {
    setLive({ enabled: true });
    answerFirstLens();
    render(<LensesPanel />);
    expect(screen.queryByText(/most people/i),
      "a live build drew a legend for a population it has not measured").toBeNull();
  });

  it("does not say your score runs above or below typical", () => {
    setLive({ enabled: true });
    answerFirstLens();
    const { container } = render(<LensesPanel />);
    expect(container.textContent).not.toMatch(/above typical|below typical|more than most/i);
    // …and it says the lens's own line instead, rather than nothing at all.
    expect(container.textContent).toContain(LENSES.all[0].lead);
  });

  it("stops drawing the ticks themselves, which carry no text", () => {
    // Measured against the SAME live panel with the gate forced open,
    // rather than against the demo panel. Demo draws more marks anyway —
    // its prior fills in dimensions live leaves unread, so more rows are
    // `read` — and a live-vs-demo comparison therefore passes whether the
    // gate works or not. It did: with the gate reverted this case still
    // went green, which is the shape it exists to catch.
    setLive({ enabled: true });
    answerFirstLens();
    const gated = ticks(render(<LensesPanel />).container);
    cleanup();
    const real = LENSES.typicalKnown;
    LENSES.typicalKnown = () => true;
    try {
      const open = ticks(render(<LensesPanel />).container);
      expect(open, "the same live panel drew no more marks with the gate open — the fixture is not exercising the ticks")
        .toBeGreaterThan(gated);
    } finally {
      LENSES.typicalKnown = real;
    }
  });
});

describe("the lenses tab in DEMO mode still draws all of it", () => {
  // THE CONTROL. Without these three, everything above is satisfied by a
  // panel that renders nothing — which is the shape a gate like this is
  // easiest to get wrong into.
  it("keeps the 'most people' legend", () => {
    answerFirstLens();
    render(<LensesPanel />);
    expect(screen.queryByText(/most people/i),
      "the demo legend went away too — the fix is too broad").not.toBeNull();
  });

  it("keeps a typical-relative sentence", () => {
    answerFirstLens();
    const { container } = render(<LensesPanel />);
    expect(container.textContent,
      "demo lost its reading sentence — the fix is too broad").toMatch(/typical|more than most/i);
  });

  it("keeps the tick marks", () => {
    // The mirror of the live case, and for the same reason: `ticks()`
    // counts every aria-hidden mark, including the spine's centre line and
    // the curve's own decoration, so "demo drew some marks" stayed true
    // with every tick removed. Measured against the same demo panel with
    // the gate forced shut instead.
    answerFirstLens();
    const open = ticks(render(<LensesPanel />).container);
    cleanup();
    const real = LENSES.typicalKnown;
    LENSES.typicalKnown = () => false;
    try {
      const shut = ticks(render(<LensesPanel />).container);
      expect(open, "demo drew no more marks with the gate open — its ticks are gone")
        .toBeGreaterThan(shut);
    } finally {
      LENSES.typicalKnown = real;
    }
  });
});
