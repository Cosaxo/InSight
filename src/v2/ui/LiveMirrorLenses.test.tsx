// @vitest-environment jsdom
//
// The Mirror's live lens row (D99). The arithmetic has its own suite in
// data/cohort.test.ts; what these cases hold is the part a fold test
// cannot see — what the row SAYS, and what it costs.
//
// Three properties are worth more than the rest:
//
//   1. Nothing loads until a lens is opened. People pays for voter lists
//      the user has not opened, so a row that fetched on mount would
//      charge every visit to the Mirror for a tab nobody tapped.
//   2. An empty reading says which KIND of empty it is. "Nobody has
//      filled in their age" and "nobody in 25-34 answered these" are
//      different facts and a single "no data" would collapse them —
//      which is the habit the withheld-cell era left behind.
//   3. The mix is labelled as ANSWERS, not people. It double-counts
//      anyone who answered twice, and saying "population" would be a
//      small lie of exactly the kind this app is built not to tell.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LensQuestion } from "./lensDefs";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  loadKindred: vi.fn(async () => {}),
  kindred: () => [] as Array<{ uid: string; name: string; like: { shared: number; same: number; pct: number } }>,
  kindredLoading: () => false as boolean,
  kindredDepth: () => 12,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveMirrorLenses } = await import("./LiveMirrorLenses");

// One question, 60/40 overall, split hard by age and not at all by gender.
const Q: LensQuestion = {
  id: "q1",
  text: "Pineapple on pizza?",
  options: ["Yes", "No"],
  counts: [12, 8],
  by: {
    ageBand: { "25-34": { "0": 9, "1": 1 }, "35-44": { "0": 3, "1": 7 } },
    gender: { Woman: { "0": 6, "1": 4 }, Man: { "0": 6, "1": 4 } },
  },
  mine: 1,
};

const open = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.loadKindred = vi.fn(async () => {});
  LIVE.kindred = () => [];
  LIVE.kindredLoading = () => false;
});
afterEach(cleanup);

describe("the lens row · cost", () => {
  it("shows three lenses and opens none of them by default", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    expect(screen.getByRole("button", { name: "People" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compare" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explore" })).toBeTruthy();
    // Collapsed: no lens body rendered, and nothing fetched.
    expect(screen.queryByText(/most like you/i)).toBeNull();
    expect(LIVE.loadKindred).not.toHaveBeenCalled();
  });

  it("fetches Kindred only once People is opened", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    expect(LIVE.loadKindred).not.toHaveBeenCalled();
    open(/People/);
    expect(LIVE.loadKindred).toHaveBeenCalledTimes(1);
  });

  it("renders nothing at all in demo mode", () => {
    LIVE.enabled = false;
    const { container } = render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    expect(container.textContent).toBe("");
  });
});

describe("People", () => {
  it("shows the mix, and calls it answers rather than people", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/People/);
    expect(screen.getByText("25-34")).toBeTruthy();
    expect(screen.getByText("35-44")).toBeTruthy();
    expect(screen.getByText(/answers, not people/i)).toBeTruthy();
  });

  it("names Kindred with the metric spelled out beside it", () => {
    LIVE.kindred = () => [{ uid: "u2", name: "Ada", like: { shared: 6, same: 5, pct: 83 } }];
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/People/);
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("5/6 the same")).toBeTruthy();
    expect(screen.getByText("83%")).toBeTruthy();
    // A likeness number nobody can explain is a number nobody should
    // trust, so the definition ships next to it.
    expect(screen.getByText(/share of the questions you have both answered/i)).toBeTruthy();
  });

  it("renders an unnamed account as Someone", () => {
    LIVE.kindred = () => [{ uid: "u9", name: "", like: { shared: 4, same: 4, pct: 100 } }];
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/People/);
    expect(screen.getByText("Someone")).toBeTruthy();
    expect(screen.queryByText(/u9/)).toBeNull();
  });

  it("distinguishes 'still working' from 'nobody overlaps'", () => {
    LIVE.kindredLoading = () => true;
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/People/);
    expect(screen.getByText(/working out who answers like you/i)).toBeTruthy();
    expect(screen.queryByText(/nobody has answered enough/i)).toBeNull();

    cleanup();
    LIVE.kindredLoading = () => false;
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/People/);
    expect(screen.getByText(/nobody has answered enough/i)).toBeTruthy();
  });

  it("says which dimension is empty, not just 'no data'", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/People/);
    open(/^Education$/);
    expect(screen.getByText(/nobody here has filled in their education/i)).toBeTruthy();
  });
});

describe("Compare", () => {
  it("counts how often you went with the majority, against this population", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/Compare/);
    // Own pick is option 1 ("No") at 40% — the minority — so 0 of 1.
    expect(screen.getByText(/against Oslo/i)).toBeTruthy();
    expect(screen.getByText(/40% here agreed/i)).toBeTruthy();
  });

  it("asks you to answer something rather than showing an empty frame", () => {
    render(<LiveMirrorLenses qs={[{ ...Q, mine: -1 }]} shortName="Oslo" />);
    open(/Compare/);
    expect(screen.getByText(/answer a few of today's questions/i)).toBeTruthy();
  });
});

describe("Explore", () => {
  it("shows a slice's split and names the gap in points and direction", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/Explore/);
    // The biggest age bucket leads; 25-34 is 90/10 against an overall
    // 60/40, so it is 30 points MORE likely to say Yes.
    expect(screen.getByText(/30 points/)).toBeTruthy();
    expect(screen.getByText(/more/)).toBeTruthy();
  });

  it("says 'same as everyone' rather than inventing a difference", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/Explore/);
    open(/^Gender$/);
    // Both gender buckets match the overall split exactly.
    expect(screen.getByText(/same as everyone/i)).toBeTruthy();
  });

  it("says the dimension is empty when nobody carries it", () => {
    render(<LiveMirrorLenses qs={[Q]} shortName="Oslo" />);
    open(/Explore/);
    open(/^City$/);
    expect(screen.getByText(/no answers carry a city yet/i)).toBeTruthy();
  });
});
