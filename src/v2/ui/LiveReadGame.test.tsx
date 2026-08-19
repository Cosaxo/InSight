// @vitest-environment jsdom
//
// The reading game's feed placement (D196). Three properties, and the
// first is the one the whole "hidden until enough data" instruction comes
// down to:
//
//   1. Below the gate it renders NOTHING — no teaser, no frame, no
//      "coming soon". A game that announces itself and cannot be played is
//      worse than one that is simply not there yet.
//   2. Above the gate it renders the real game, and states its SCOPE once.
//      That was the standing objection to putting this in the feed (the
//      lens row used to say which population you were reading); one line
//      answers it, and it has to be there.
//   3. It never appears in a demo build.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AggDoc, LiveQuestion } from "../data/deck";

const BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function q(id: string): LiveQuestion {
  return {
    id, cat: "culture", text: `Question ${id}`, dayLabel: "Today",
    options: [
      { id: "0", label: "Yes", count: 60, color: "" },
      { id: "1", label: "No", count: 40, color: "" },
    ],
    comments: [], friends: [], live: true, noCountsYet: false, coreCorpus: true,
  };
}

function agg(bands: number): AggDoc {
  const cells: Record<string, Record<string, number>> = {};
  for (let i = 0; i < bands; i++) cells[BANDS[i % BANDS.length]] = { "0": 30, "1": 4 };
  return { counts: { "0": 60, "1": 40 }, total: 100, by: { ageBand: cells } };
}

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  aggregated: (): unknown[] => [],
  aggFor: (): unknown => null,
  loadForesight: () => Promise.resolve(),
  foresightLog: (): Record<string, unknown> | null => ({}),
  foresightLoading: () => false,
  scoreForesight: () => Promise.resolve(),
}));

vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: LiveReadGame } = await import("./LiveReadGame");

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.foresightLog = () => ({});
});
afterEach(cleanup);

describe("below the gate", () => {
  it("renders nothing at all on an empty corpus", () => {
    LIVE.aggregated = () => [];
    LIVE.aggFor = () => null;
    const { container } = render(<LiveReadGame />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing on a thin one, even though every read in it is fair", () => {
    // Four scoreable reads. Each one could be asked honestly; four of them
    // cannot carry the per-dimension record the game exists for.
    LIVE.aggregated = () => [q("a"), q("b")];
    LIVE.aggFor = () => agg(2);
    const { container } = render(<LiveReadGame />);
    expect(container.textContent).toBe("");
  });
});

describe("above the gate", () => {
  beforeEach(() => {
    LIVE.aggregated = () => [q("a"), q("b")];
    LIVE.aggFor = () => agg(6);
  });

  it("renders the game", () => {
    render(<LiveReadGame />);
    expect(screen.getByText("read the room")).toBeTruthy();
  });

  it("states the scope once, which is what the feed placement owes", () => {
    render(<LiveReadGame />);
    expect(screen.getByText(/Slices of everyone who answered/)).toBeTruthy();
  });

  it("draws the record's own load state rather than inventing one", () => {
    // The engine's honesty rules survive the move: a log that could not be
    // read says so, and does not render as an empty record.
    LIVE.foresightLog = () => null;
    render(<LiveReadGame />);
    expect(screen.getByText(/Couldn’t load your record/)).toBeTruthy();
  });
});

describe("a demo build", () => {
  it("renders nothing — there is no crowd to read", () => {
    LIVE.enabled = false;
    LIVE.aggregated = () => [q("a"), q("b")];
    LIVE.aggFor = () => agg(6);
    const { container } = render(<LiveReadGame />);
    expect(container.textContent).toBe("");
  });
});
