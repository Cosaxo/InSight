// @vitest-environment jsdom
//
// The post-vote beat's Skip control, as an INTERACTION rather than as a role
// attribute.
//
// WHY THIS EXISTS. D21 deferred the spec layer's remaining a11y findings on
// the rule that they land *behind* interaction tests rather than ahead of
// them, and dialog.test.jsx is the precedent for what that means here. This
// is the same trade for the last non-autofocus finding in the layer:
// consequence-beat.jsx's skip affordance carried `role="button"` and an
// aria-label, which is everything a source-reading gate can check, and was
// still unreachable — no tabIndex, so it never took focus, and no key
// handler, so Enter and Space did nothing.
//
// WHAT THAT COSTS A USER, and why it is worth a suite of its own. The beat
// is a 320px animation that covers the result for several seconds after a
// vote (daily-split.jsx renders it in place of the split; world-feed.jsx
// does the same on a feed card). Skip is the only way past it. A keyboard
// or switch user could not press it, so the one control on screen was the
// one control they could not reach — while `check:a11y`, `check:labels`
// and `npm run lint` all stayed green, because each of them can see the
// role and none of them can see the focus.
//
// Reduced motion was already handled and is pinned here so it stays that
// way: the component finishes itself after 400ms rather than animating, so
// the skip control is a convenience there and a necessity otherwise.

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import "../spec/consequence-beat.jsx";

const ConsequenceBeat = globalThis.ConsequenceBeat;

// The props daily-split.jsx passes at the real call site, minus the height.
const PROPS = {
  seed: "q-test",
  options: [
    { label: "Absolutely", color: "oklch(0.52 0.14 40)" },
    { label: "Never", color: "oklch(0.52 0.14 8)" },
  ],
  pcts: [61, 39],
  mineIdx: 0,
};

afterEach(cleanup);

// The verdict the beat says out loud, which is a claim about VOTES while
// the number beside it is a percentage.
//
// `sharePcts` never inverts two counts but it can round them to the same
// integer, so deciding "you're with them" off the percentages told a voter
// with strictly fewer votes that they had won. The line under the card was
// fixed earlier the same night; a beat still reading percentages would
// have contradicted the line it is shown two seconds before.
describe("the consequence beat's verdict", () => {
  // Options must match the vector's width — the animation lays out one
  // camp per option and reads `camps[i]`, so a mismatched pair throws
  // rather than misreporting.
  const opts = (n) => Array.from({ length: n }, (_, i) => ({
    label: ["Absolutely", "Never", "Depends"][i] || `Option ${i}`,
    color: "oklch(0.52 0.14 40)",
  }));
  const say = (pcts, counts, mineIdx) => {
    const { container } = render(
      <ConsequenceBeat {...PROPS} options={opts(pcts.length)} pcts={pcts}
        counts={counts} mineIdx={mineIdx} onDone={() => {}} />,
    );
    return container.textContent;
  };

  it("asks the counts, not the drawn percentages", () => {
    // 449 and 451 both draw 45%. The voter on 449 did not win.
    expect(say([45, 45, 10], [449, 451, 100], 0)).toContain("you among them");
    expect(say([45, 45, 10], [449, 451, 100], 1)).toContain("you\u2019re with them");
  });

  it("still prints the percentage it was given", () => {
    // The number and the verdict answer different questions, and only the
    // verdict moved. A beat that started printing counts would be a
    // different bug.
    expect(say([45, 45, 10], [449, 451, 100], 0)).toContain("45% chose");
  });

  it("a real tie in counts is with them, on both sides", () => {
    expect(say([50, 50], [7, 7], 0)).toContain("you\u2019re with them");
    expect(say([50, 50], [7, 7], 1)).toContain("you\u2019re with them");
  });

  it("degrades to the percentages when no counts are passed", () => {
    // The prop is optional on purpose: a caller without counts must behave
    // exactly as before rather than throw.
    expect(say([61, 39], undefined, 0)).toContain("you\u2019re with them");
    expect(say([61, 39], undefined, 1)).toContain("rare side");
  });
});

describe("the consequence beat's skip control", () => {
  it("is a real control: focusable, and named", () => {
    render(<ConsequenceBeat {...PROPS} onDone={() => {}} />);
    const skip = screen.getByRole("button", { name: "Skip" });

    // The half no static gate can see. `role="button"` satisfies every
    // source-reading check in this repo; tabIndex is what actually lets a
    // keyboard reach it. A native <button> carries both, which is why this
    // asserts the behaviour rather than the tag.
    skip.focus();
    expect(document.activeElement).toBe(skip);
    expect(skip.getAttribute("aria-disabled")).toBeNull();
  });

  it("is a native button, which is what makes Enter and Space work at all", () => {
    render(<ConsequenceBeat {...PROPS} onDone={() => {}} />);
    const skip = screen.getByRole("button", { name: "Skip" });

    // Asserting the ELEMENT, not a keystroke, and the reason is a real
    // limitation rather than a shortcut: jsdom does not implement a
    // button's default activation behaviour, so `fireEvent.keyDown(el,
    // {key:'Enter'})` produces no click no matter how correct the markup
    // is. A first draft papered over that with `if (!called) click()`,
    // which passed against the unfixed div — the exact shape of vacuous
    // test src/v2/README.md warns about under Panel tests.
    //
    // So this pins the thing that carries the guarantee. `<button>` gets
    // Enter and Space from the platform; a div with role="button" gets
    // neither, and no static gate in this repo can tell the two apart.
    // Reverting to the div fails here.
    expect(skip.tagName).toBe("BUTTON");
    // …and not a submit button, which inside any future <form> would
    // navigate instead of skipping.
    expect(skip.getAttribute("type")).toBe("button");
  });

  it("still dismisses on a pointer, which is what it always did", () => {
    const onDone = vi.fn();
    render(<ConsequenceBeat {...PROPS} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone at most once, however it is dismissed", () => {
    // doneRef guards this. A double-fire would advance the daily twice.
    const onDone = vi.fn();
    render(<ConsequenceBeat {...PROPS} onDone={onDone} />);
    const skip = screen.getByRole("button", { name: "Skip" });
    fireEvent.click(skip);
    fireEvent.click(skip);
    fireEvent.keyDown(skip, { key: "Enter" });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("finishes itself under prefers-reduced-motion, without needing the control", () => {
    vi.useFakeTimers();
    const mm = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    });
    try {
      const onDone = vi.fn();
      render(<ConsequenceBeat {...PROPS} onDone={onDone} />);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400);
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = mm;
      vi.useRealTimers();
    }
  });
});
