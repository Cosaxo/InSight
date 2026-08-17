// @vitest-environment jsdom
//
// The CALL card's four states, and two properties that are decisions
// rather than styling — both of which read as tidy-able by someone with
// only this file open (D193):
//
//   1. AN UNREAD CALL DRAWS NOTHING. Until the published grades have been
//      fetched, an apparently-open call may already be graded, and the
//      rules refuse an answer once it is. Rendering the options "while it
//      loads" would offer a tap the server is about to reject.
//   2. THE CARD NEVER SHOWS THE TARGET QUESTION'S CURRENT NUMBERS while
//      the call is open. Those numbers are exactly what the player is
//      being asked to predict; putting them on the card turns the
//      prediction into a lookup.
//
// Plus the one that justifies the feature existing: the card re-runs the
// grade on the device and PRINTS THE DISAGREEMENT when the numbers do not
// reproduce the verdict.
//
// `../data/live` is mocked rather than booted — it imports Firebase, and
// what this card consumes is three members.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CallOutcome } from "../data/deck";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  loadCallOutcomes: () => Promise.resolve(),
  myVotes: (): Record<string, string> => ({}),
  callOutcomes: (): Record<string, CallOutcome | null> | null => ({}),
  callQs: () => [{
    id: "call-c01",
    surface: "call",
    seq: 0,
    type: "call",
    prompt: "Will it end up lopsided?",
    options: ["It will", "It stays close"],
    topic: null,
    test: null,
    active: true,
    tier: "A",
    resolvesAt: "2026-10-01",
    rubric: { kind: "agg" as const, qid: "feed-f01", test: "topShareAtLeast" as const, threshold: 60 },
    counts: [30, 10],
  }],
  vote: vi.fn(),
}));

vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: LiveCallCard } = await import("./LiveCallCard");

const INPUTS = { qid: "feed-f01", total: 100, counts: { "0": 70, "1": 30 } };

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.myVotes = () => ({});
  LIVE.callOutcomes = () => ({});
  LIVE.vote = vi.fn();
});
afterEach(cleanup);

describe("an open call", () => {
  it("offers both options and nothing else to go on", () => {
    render(<LiveCallCard />);
    expect(screen.getByText("Will it end up lopsided?")).toBeTruthy();
    fireEvent.click(screen.getByText("It will"));
    expect(LIVE.vote).toHaveBeenCalledWith("call-c01", "0");
  });

  it("never prints the target question's own numbers", () => {
    // The whole point of a prediction. `feed-f01` is what the rubric reads;
    // its current split appears nowhere, and neither does the qid.
    const { container } = render(<LiveCallCard />);
    expect(container.textContent).not.toContain("feed-f01");
    expect(container.textContent).not.toContain("60%");
  });
});

describe("before the grades are read", () => {
  it("draws nothing at all — never an open call that might already be graded", () => {
    LIVE.callOutcomes = () => null;
    const { container } = render(<LiveCallCard />);
    expect(container.textContent).toBe("");
  });
});

describe("a sealed call", () => {
  it("shows your pick and the crowd's split on the CALL, not on its target", () => {
    LIVE.myVotes = () => ({ "call-c01": "1" });
    render(<LiveCallCard />);
    expect(screen.getByText("sealed")).toBeTruthy();
    // 30/10 on the call itself → 75/25.
    expect(screen.getByText("75%")).toBeTruthy();
  });
});

describe("a graded call", () => {
  const graded = (outcomeIdx: number, inputs: unknown = INPUTS): Record<string, CallOutcome> => ({
    "call-c01": { outcomeIdx, resolvedBy: "auto", inputs: inputs as CallOutcome["inputs"] },
  });

  it("names the outcome and the verdict", () => {
    LIVE.myVotes = () => ({ "call-c01": "0" });
    LIVE.callOutcomes = () => graded(0);
    render(<LiveCallCard />);
    expect(screen.getByText(/It landed/)).toBeTruthy();
    expect(screen.getByText("You called it")).toBeTruthy();
  });

  it("says what you said when you were wrong, rather than only that you were", () => {
    LIVE.myVotes = () => ({ "call-c01": "1" });
    LIVE.callOutcomes = () => graded(0);
    render(<LiveCallCard />);
    expect(screen.getByText("You said It stays close")).toBeTruthy();
  });

  it("publishes the working: the test, the numbers, and its own re-run", () => {
    LIVE.myVotes = () => ({ "call-c01": "0" });
    LIVE.callOutcomes = () => graded(0);
    const { container } = render(<LiveCallCard />);
    fireEvent.click(screen.getByText(/how this was graded/));
    // The basis names the target question — the reader's next move is to
    // open it — and the count the grade was made from.
    expect(container.textContent).toContain("feed-f01");
    expect(container.textContent).toContain("100 answers");
    expect(container.textContent).toContain("got the same answer");
  });

  it("SAYS SO when the device's re-run disagrees with the published grade", () => {
    // 70% clears the 60% threshold, so a published "No" contradicts the
    // numbers published beside it. The card must not defer to the server.
    LIVE.myVotes = () => ({ "call-c01": "1" });
    LIVE.callOutcomes = () => graded(1);
    const { container } = render(<LiveCallCard />);
    fireEvent.click(screen.getByText(/how this was graded/));
    expect(container.textContent).toContain("DIFFERENT answer");
  });
});

describe("a void", () => {
  it("scores nobody and prints the reason", () => {
    LIVE.myVotes = () => ({ "call-c01": "0" });
    LIVE.callOutcomes = () => ({
      "call-c01": { outcomeIdx: -1, resolvedBy: "auto", inputs: null, note: "feed-f01 could not answer this call" },
    });
    render(<LiveCallCard />);
    expect(screen.getByText(/Void — nobody is scored/)).toBeTruthy();
    expect(screen.getByText(/could not answer this call/)).toBeTruthy();
    // Picking the winning side of a void is not a win.
    expect(screen.queryByText("You called it")).toBeNull();
  });
});

describe("a demo build", () => {
  it("renders nothing — a call has no authored pool to fall back to", () => {
    LIVE.enabled = false;
    const { container } = render(<LiveCallCard />);
    expect(container.textContent).toBe("");
  });
});
