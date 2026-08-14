// @vitest-environment jsdom
//
// Crossroads (D136): the branching-story card and the store under it.
//
// WHY THIS EXISTS, beyond "the new thing should have a test". Two of the
// three things asserted here are load-bearing in a way a reader of the
// component would not guess:
//
//   1. THE CARD IS DEMO-ONLY, and the gate is one `!LIVE.enabled` in
//      world-feed.jsx — a single token, in a file of 3,500 lines, that is
//      the only thing standing between a live build and a card printing
//      authored crowd figures ("you and 12% ended here") beside real ones.
//      D1 forbids exactly that, and nothing else in the tree would notice
//      if the token were dropped in a merge: the card renders fine, the
//      numbers look fine, and they are invented. So the gate is pinned
//      here as behaviour rather than trusted as source.
//
//   2. THE STORE PERSISTS, so a walk survives the card unmounting — which
//      is what makes "Walk again" a reset rather than a no-op, and what
//      makes a half-finished walk resumable when the feed re-renders
//      around it.
//
// The tree's geometry is not asserted. It is 8 cubic paths whose widths
// come from flowOf, and pinning path `d` strings would fail on any visual
// change while catching nothing a reader would call a bug.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PATHS } from "../spec/paths-data.js";
import { PathsCard } from "../spec/paths-card.jsx";

afterEach(() => { cleanup(); });

describe("Crossroads · the card", () => {
  beforeEach(() => {
    localStorage.clear();
    PATHS.stories().forEach((s) => PATHS.reset(s.id));
  });

  const choose = (label) => fireEvent.click(screen.getByRole("button", { name: label }));

  it("walks three forks and reveals the ending", () => {
    render(<PathsCard />);
    const st = PATHS.stories()[0];
    // The intro is on screen before the first fork, and the first node's
    // question with it — the prototype shows both, so the opening card is
    // the only one carrying two lines of prose.
    expect(screen.getByText(st.intro)).toBeTruthy();

    choose(st.nodes[""].a[0].t);
    choose(st.nodes["A"].a[0].t);
    // Two forks in, still walking: no ending yet.
    expect(screen.queryByText(st.endings["AAA"].line)).toBeNull();
    choose(st.nodes["AA"].a[0].t);

    // Three forks in, the ending is named and its line is drawn.
    expect(PATHS.walkOf(st.id)).toBe("AAA");
    // getAllBy, deliberately: the ending's name appears TWICE by design —
    // once as the heading under the tree, once as the label on the tree's
    // own end node — and a getBy here would fail on the second one as
    // though something were wrong.
    expect(screen.getAllByText(st.endings["AAA"].name).length).toBe(2);
    expect(screen.getByText(st.endings["AAA"].line)).toBeTruthy();
    // …and the tree with it, labelled for a screen reader by where it ends.
    expect(screen.getByRole("img", { name: new RegExp(st.endings["AAA"].name) })).toBeTruthy();
  });

  it("keeps the walk when the card unmounts, and Walk again clears it", () => {
    const st = PATHS.stories()[0];
    const { unmount } = render(<PathsCard />);
    choose(st.nodes[""].a[1].t);
    expect(PATHS.walkOf(st.id)).toBe("B");
    unmount();

    // Re-mounting resumes rather than restarting — the feed re-renders
    // around this card constantly, and a walk that reset on every one of
    // those would be unfinishable.
    render(<PathsCard />);
    expect(screen.getByText(st.nodes["B"].q)).toBeTruthy();
    choose(st.nodes["B"].a[0].t);
    choose(st.nodes["BA"].a[0].t);
    expect(screen.getAllByText(st.endings["BAA"].name).length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Walk again" }));
    expect(PATHS.walkOf(st.id)).toBe("");
    expect(screen.getByText(st.intro)).toBeTruthy();
  });

  it("refuses a fourth choice", () => {
    // Not reachable through the UI — the finished card draws no choices —
    // but `choose` is the store's public surface and a caller that lost
    // track of the walk length would otherwise write 'AAAA' and put the
    // card into a state with no ending to look up.
    const st = PATHS.stories()[0];
    PATHS.choose(st.id, 0); PATHS.choose(st.id, 0); PATHS.choose(st.id, 0);
    expect(PATHS.choose(st.id, 1)).toBe("AAA");
    expect(PATHS.walkOf(st.id)).toBe("AAA");
  });
});

describe("Crossroads · the crowd numbers are authored, and the card knows it", () => {
  it("derives a branch's share from the authored shares above it", () => {
    const st = PATHS.stories()[0];
    const a = st.nodes[""].a[0].p / 100;
    const aa = st.nodes["A"].a[0].p / 100;
    expect(PATHS.flowOf(st.id, "A")).toBeCloseTo(a, 10);
    expect(PATHS.flowOf(st.id, "AA")).toBeCloseTo(a * aa, 10);
    // Every root branch together is the whole crowd — the property that
    // makes "1 in N walks your road" arithmetic rather than decoration.
    expect(PATHS.flowOf(st.id, "A") + PATHS.flowOf(st.id, "B")).toBeCloseTo(1, 10);
  });

  // The demo-only GATE is not asserted here, and that is a decision rather
  // than an omission. A source read (`expect(src).toContain("!LIVE.enabled")`)
  // was the first draft and was dropped: it passes for a token sitting in a
  // comment and fails for a rewrite that keeps the behaviour — a pin on the
  // spelling of the guard, wearing a behaviour test's clothes. Both halves
  // are pinned on real mounts instead, where the feed is actually assembled:
  //   · smoke-daily.test.jsx  "puts Crossroads at the head of the demo feed"
  //   · smoke-live.test.jsx   "keeps Crossroads out of a live feed"
  // Together they catch a dropped gate AND an inverted one; neither could.
});
