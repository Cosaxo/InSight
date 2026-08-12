// @vitest-environment jsdom
//
// The Foresight lens (D102). The engine's arithmetic has its own suite in
// data/foresight.test.ts; what these cases hold is the part a fold test
// cannot see — the clock, and what the card SAYS when you are wrong.
//
// Three properties matter more than the rest:
//
//   1. Running out of time scores as a MISS and is written like any other
//      verdict. If a timeout were free, waiting would be the best play
//      whenever you were unsure, and the clock would be decoration.
//   2. A verdict is written ONCE. The rules refuse a rewrite, but the UI
//      must not attempt one either — a second write on the same slice is
//      a bug that only shows up as a permission error in the field.
//   3. A miss shows the slice's real split AND what everyone else said,
//      because most misses are people answering with the overall number
//      instead of the slice's.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ForesightSource } from "../data/foresight";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  loadForesight: vi.fn(async () => {}),
  foresightLog: () => ({}) as Record<string, unknown> | null,
  foresightLoading: () => false as boolean,
  scoreForesight: vi.fn(async () => {}),
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveForesightLens } = await import("./LiveForesightLens");

// 25-34 goes hard against the crowd: overall says No, the slice says Yes.
const Q: ForesightSource = {
  id: "q1",
  text: "Pineapple on pizza?",
  options: ["Yes", "No"],
  counts: [30, 70],
  by: { ageBand: { "25-34": { "0": 18, "1": 2 } } },
};

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.foresightLog = () => ({});
  LIVE.foresightLoading = () => false;
  LIVE.loadForesight = vi.fn(async () => {});
  LIVE.scoreForesight = vi.fn(async () => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the card", () => {
  it("asks about a named slice and offers the question's options", () => {
    render(<LiveForesightLens qs={[Q]} />);
    expect(screen.getByText(/25-34/)).toBeTruthy();
    expect(screen.getByText("Pineapple on pizza?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No" })).toBeTruthy();
  });

  it("scores a hit against the published cell, not against the crowd", () => {
    // The crowd says No; the slice says Yes. Answering "Yes" is right,
    // and that is only true because the cell is real (D98) — the
    // prototype scored this against a hash of the question id.
    render(<LiveForesightLens qs={[Q]} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Read it.")).toBeTruthy();
    expect(LIVE.scoreForesight).toHaveBeenCalledWith(
      "q1__ageBand__25-34", "q1", "ageBand", "25-34", 0, 0, 20,
    );
  });

  it("shows the real split and what everyone else said, on a miss", () => {
    render(<LiveForesightLens qs={[Q]} />);
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByText("Missed.")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
    expect(screen.getByText(/25-34 picked this/)).toBeTruthy();
    expect(screen.getByText(/you said this/)).toBeTruthy();
    // The teaching half: this slice went against the crowd.
    expect(screen.getByText(/Everyone else said/)).toBeTruthy();
  });
});

describe("the clock", () => {
  it("expires as a MISS, and writes the verdict like any other", () => {
    vi.useFakeTimers();
    render(<LiveForesightLens qs={[Q]} />);
    act(() => { vi.advanceTimersByTime(11000); });
    expect(screen.getByText("Out of time.")).toBeTruthy();
    // -1 is the guess, and it is written. A timeout that wrote nothing
    // would let a player farm the deck for free by never answering.
    expect(LIVE.scoreForesight).toHaveBeenCalledWith(
      "q1__ageBand__25-34", "q1", "ageBand", "25-34", -1, 0, 20,
    );
  });

  it("writes exactly one verdict when an answer beats the clock", () => {
    vi.useFakeTimers();
    render(<LiveForesightLens qs={[Q]} />);
    act(() => { vi.advanceTimersByTime(4000); });
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    act(() => { vi.advanceTimersByTime(20000); });
    // The expiry must not fire behind the answer. The rules refuse the
    // second write, so this bug would only ever surface as a permission
    // error on a real device.
    expect(LIVE.scoreForesight).toHaveBeenCalledTimes(1);
  });

  it("does not double-write when the same option is tapped twice", () => {
    render(<LiveForesightLens qs={[Q]} />);
    const yes = screen.getByRole("button", { name: "Yes" });
    fireEvent.click(yes);
    fireEvent.click(yes);
    expect(LIVE.scoreForesight).toHaveBeenCalledTimes(1);
  });
});

describe("what it says when there is nothing to ask", () => {
  it("names the fairness rule rather than saying 'no data'", () => {
    // A three-answer slice is not withheld — Explore draws it — it is
    // just not a fair thing to be scored on.
    const thin: ForesightSource = { ...Q, by: { ageBand: { "25-34": { "0": 2, "1": 1 } } } };
    render(<LiveForesightLens qs={[thin]} />);
    expect(screen.getByText(/fair read/i)).toBeTruthy();
    expect(screen.getByText(/coin\s*toss/i)).toBeTruthy();
  });

  it("distinguishes a failed load from an empty record", () => {
    LIVE.foresightLog = () => null;
    LIVE.foresightLoading = () => false;
    render(<LiveForesightLens qs={[Q]} />);
    expect(screen.getByText(/couldn.t load your record/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Yes" })).toBeNull();

    cleanup();
    LIVE.foresightLoading = () => true;
    render(<LiveForesightLens qs={[Q]} />);
    expect(screen.getByText(/loading your record/i)).toBeTruthy();
  });

  it("says you have read everything once the deck is exhausted", () => {
    LIVE.foresightLog = () => ({
      "q1__ageBand__25-34": { id: "x", qid: "q1", dim: "ageBand", bucket: "25-34", guess: 0, correct: true, at: 1 },
    });
    render(<LiveForesightLens qs={[Q]} />);
    expect(screen.getByText(/every slice big enough/i)).toBeTruthy();
  });
});

describe("the record", () => {
  it("counts hits and names the run", () => {
    // The miss lands FIRST, so the two hits after it are a live streak.
    // Ordering by `at` rather than by key order is what makes that true
    // on every device — data/foresight.test.ts pins the fold itself.
    LIVE.foresightLog = () => ({
      c: { id: "c", qid: "q", dim: "gender", bucket: "b", guess: 1, correct: false, at: 1 },
      a: { id: "a", qid: "q", dim: "ageBand", bucket: "b", guess: 0, correct: true, at: 2 },
      b: { id: "b", qid: "q", dim: "ageBand", bucket: "b", guess: 0, correct: true, at: 3 },
    });
    const { container } = render(<LiveForesightLens qs={[Q]} />);
    expect(container.textContent).toContain("of 3 right");
    expect(container.textContent).toContain("2 in a row");
  });

  it("breaks the record down by which cut you were reading", () => {
    // The reading this feature exists for, and one no other surface can
    // produce: "you read age well and gender badly" is a fact about you.
    LIVE.foresightLog = () => ({
      a: { id: "a", qid: "q", dim: "ageBand", bucket: "b", guess: 0, correct: true, at: 1 },
      b: { id: "b", qid: "q", dim: "gender", bucket: "b", guess: 1, correct: false, at: 2 },
    });
    render(<LiveForesightLens qs={[Q]} />);
    expect(screen.getByText(/which cuts you read well/i)).toBeTruthy();
    expect(screen.getByText("Age")).toBeTruthy();
    expect(screen.getByText("Gender")).toBeTruthy();
  });
});
