// @vitest-environment jsdom
//
// The Mirror's live lens BODIES (D99). The arithmetic has its own suite in
// data/cohort.test.ts; what these cases hold is the part a fold test
// cannot see — what a lens SAYS, and what it costs.
//
// Controlled since D119: the row is the stop's tab bar and lives with the
// host (LiveCohortBody), so each case names its lens rather than tapping
// for it. The claims below are unchanged — every one of them was always
// about a lens body, never about the row that opened it.
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
import type { LensId, LensQuestion } from "./lensDefs";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  loadKindred: vi.fn(async () => {}),
  kindred: () => [] as Array<{ uid: string; name: string; like: { shared: number; same: number; pct: number } }>,
  kindredLoading: () => false as boolean,
  kindredDepth: () => 12,
  // The follow control (D101) rides on every named row. Stubbed
  // unfollowed — the button's own behaviour has its own cases.
  isFollowing: () => false,
  setFollowing: vi.fn(async () => {}),
  // The types-here card (D140) reads the same voter sample Kindred does,
  // plus your own result and anchors for the basis label. Stubbed empty:
  // the card's empty state renders and the lens cases stay about lenses.
  kindredPeople: () => [] as unknown[],
  myTestResults: () => ({}) as Record<string, unknown>,
  anchors: () => ({}) as Record<string, string>,
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

// The row moved to the host at D119 (it is LiveCohortBody's tab bar now),
// so a lens is chosen by prop rather than by tapping. `open` still drives
// the controls INSIDE a lens — the dimension chips.
const mount = (lens: LensId, qs: LensQuestion[] = [Q], shortName = "Oslo") =>
  render(<LiveMirrorLenses lens={lens} qs={qs} shortName={shortName} />);
const open = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.loadKindred = vi.fn(async () => {});
  LIVE.kindred = () => [];
  LIVE.kindredLoading = () => false;
});
afterEach(cleanup);

describe("the lens bodies · cost", () => {
  // The GATE moved to the host at D119: the row is LiveCohortBody's tab
  // bar and a lens body exists only while its tab is open, which
  // LiveCohortBody.test.tsx holds. What is still this file's to prove is
  // the other half — that mounting People is what costs, so the host's
  // gate is gating something real.
  it("fetches Kindred when People mounts, and never for another lens", () => {
    mount("compare");
    expect(LIVE.loadKindred).not.toHaveBeenCalled();
    cleanup();
    mount("people");
    expect(LIVE.loadKindred).toHaveBeenCalledTimes(1);
  });

  it("renders nothing at all in demo mode", () => {
    LIVE.enabled = false;
    const { container } = mount("people");
    expect(container.textContent).toBe("");
  });
});

describe("People", () => {
  it("shows the mix, and calls it answers rather than people", () => {
    mount("people");
    expect(screen.getByText("25-34")).toBeTruthy();
    expect(screen.getByText("35-44")).toBeTruthy();
    expect(screen.getByText(/answers, not people/i)).toBeTruthy();
  });

  it("names Kindred with the metric spelled out beside it", () => {
    LIVE.kindred = () => [{ uid: "u2", name: "Ada", like: { shared: 6, same: 5, pct: 83 } }];
    mount("people");
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("5/6 the same")).toBeTruthy();
    expect(screen.getByText("83%")).toBeTruthy();
    // A likeness number nobody can explain is a number nobody should
    // trust, so the definition ships next to it.
    expect(screen.getByText(/share of the questions you have both answered/i)).toBeTruthy();
  });

  it("renders an unnamed account as Someone", () => {
    LIVE.kindred = () => [{ uid: "u9", name: "", like: { shared: 4, same: 4, pct: 100 } }];
    mount("people");
    expect(screen.getByText("Someone")).toBeTruthy();
    expect(screen.queryByText(/u9/)).toBeNull();
  });

  it("distinguishes 'still working' from 'nobody overlaps'", () => {
    LIVE.kindredLoading = () => true;
    mount("people");
    expect(screen.getByText(/working out who answers like you/i)).toBeTruthy();
    expect(screen.queryByText(/nobody has answered enough/i)).toBeNull();

    cleanup();
    LIVE.kindredLoading = () => false;
    mount("people");
    expect(screen.getByText(/nobody has answered enough/i)).toBeTruthy();
  });

  it("says which dimension is empty, not just 'no data'", () => {
    mount("people");
    open(/^Education$/);
    expect(screen.getByText(/nobody here has filled in their education/i)).toBeTruthy();
  });
});

describe("Compare", () => {
  it("counts how often you went with the majority, against this population", () => {
    mount("compare");
    // Own pick is option 1 ("No") at 40% — the minority — so 0 of 1.
    expect(screen.getByText(/against Oslo/i)).toBeTruthy();
    expect(screen.getByText(/40% here agreed/i)).toBeTruthy();
  });

  it("asks you to answer something rather than showing an empty frame", () => {
    mount("compare", [{ ...Q, mine: -1 }]);
    expect(screen.getByText(/answer a few of today's questions/i)).toBeTruthy();
  });
});

describe("Scores", () => {
  // A 1-10 rating: two 3s and two 9s, so the mean is 6 exactly.
  const RATED: LensQuestion = {
    id: "r1", type: "rating",
    text: "How optimistic are you about the next ten years?",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    counts: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
    by: {}, mine: 8, // index 8 → a score of 9
  };

  it("averages an ordinal question and shows the scale it is out of", () => {
    mount("scores", [RATED]);
    expect(screen.getByText("6")).toBeTruthy();
    // "6.2" means opposite things out of 10 and out of 5, and one list
    // can hold both — so the denominator ships with every number.
    expect(screen.getByText("/ 10")).toBeTruthy();
  });

  it("places your own score against theirs, with the direction named", () => {
    mount("scores", [RATED]);
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText(/3 above them/)).toBeTruthy();
  });

  it("says so when you have not rated one, rather than implying a zero", () => {
    mount("scores", [{ ...RATED, mine: -1 }]);
    expect(screen.getByText(/you have not rated this/i)).toBeTruthy();
  });

  it("REFUSES to average a categorical question", () => {
    // The property this lens most needs. Q is a binary — "Yes" and "No"
    // are different, not ordered — and a mean of it would render as a
    // confident number about nothing. The filter is on the bank's type,
    // because nothing in `counts` could tell the two apart.
    mount("scores");
    expect(screen.getByText(/nothing rated yet/i)).toBeTruthy();
    expect(screen.queryByText("/ 2")).toBeNull();
  });

  it("distinguishes 'no rated questions' from 'nobody answered them'", () => {
    // Two different emptinesses. Collapsing them into one "no data" is
    // the habit the withheld-cell era left behind (D98).
    mount("scores", [{ ...RATED, counts: [0,0,0,0,0,0,0,0,0,0] }]);
    expect(screen.getByText(/nobody here has answered a rated question/i)).toBeTruthy();
  });

  it("ranks by share of the scale, so a 5-point and a 10-point compare fairly", () => {
    // 4/5 (0.8) must outrank 7/10 (0.7). Ranking on the raw mean would
    // put the 7 first and quietly sort by which scale a question used.
    const likert: LensQuestion = {
      id: "s1", type: "scale", text: "Rest is fine.",
      options: ["1", "2", "3", "4", "5"], counts: [0, 0, 0, 3, 0], by: {}, mine: -1,
    };
    const rating: LensQuestion = { ...RATED, id: "r2", text: "Curiosity?", counts: [0,0,0,0,0,0,3,0,0,0], mine: -1 };
    mount("scores", [rating, likert]);
    const texts = screen.getAllByText(/Rest is fine\.|Curiosity\?/).map((n) => n.textContent);
    expect(texts).toEqual(["Rest is fine.", "Curiosity?"]);
  });
});

describe("Explore", () => {
  it("shows a slice's split and names the gap in points and direction", () => {
    mount("explore");
    // The biggest age bucket leads; 25-34 is 90/10 against an overall
    // 60/40, so it is 30 points MORE likely to say Yes.
    expect(screen.getByText(/30 points/)).toBeTruthy();
    expect(screen.getByText(/more/)).toBeTruthy();
  });

  it("says 'same as everyone' rather than inventing a difference", () => {
    mount("explore");
    open(/^Gender$/);
    // Both gender buckets match the overall split exactly.
    expect(screen.getByText(/same as everyone/i)).toBeTruthy();
  });

  it("says the dimension is empty when nobody carries it", () => {
    mount("explore");
    open(/^City$/);
    expect(screen.getByText(/no answers carry a city yet/i)).toBeTruthy();
  });
});
