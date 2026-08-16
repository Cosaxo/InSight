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
  // D177: every named surface draws a face now, so a LIVE stand-in
  // that lacks this crashes the row rather than falling back to
  // initials. "" is the no-photo shape, which is most accounts.
  faceFor: () => "",
  myFace: () => "",
  setAvatar: async () => ({ ok: true }),
  removeAvatar: async () => {},
  flagAvatar: async () => {},
  flaggedAvatar: () => false,
  enabled: true,
  subscribe: () => () => {},
  loadKindred: vi.fn(async () => {}),
  kindredLoading: () => false as boolean,
  kindredDepth: () => 12,
  // The follow control (D101) rides on every named row. Stubbed
  // unfollowed — the button's own behaviour has its own cases.
  isFollowing: () => false,
  setFollowing: vi.fn(async () => {}),
  // Kindred itself (D152) and the types-here card (D141) read the SAME
  // list: `kindredPeople` carries the ranking's people with their frozen
  // anchors and parsed scores, so a card can say who someone is without a
  // read the ranking has not already paid for. Stubbed empty by default —
  // both empty states render and the lens cases stay about lenses.
  kindredPeople: () => [] as Array<Record<string, unknown>>,
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
  // Explore's baseline (D169). Equal to `counts` in this fixture on
  // purpose: these cases are about what a lens SAYS, and the case that
  // holds the two APART lives in LiveCohortBody.test.tsx, where the
  // wiring that fills them is.
  all: [12, 8],
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

// A ranked person as `kindredPeople` hands one back.
const kin = (over: Record<string, unknown> = {}) => ({
  uid: "u2", name: "Ada", city: "Oslo, NO", results: null,
  like: { shared: 6, same: 5, pct: 83 },
  anchors: { city: "Oslo, NO", ageBand: "25-34", profession: "Ceramicist" },
  ...over,
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.loadKindred = vi.fn(async () => {});
  LIVE.kindredPeople = () => [];
  LIVE.kindredLoading = () => false;
  LIVE.anchors = () => ({});
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
  // D152 rebuilt this lens to the prototype's shape: a "Who's here" card —
  // the population's size, its age SHAPE, its gender split — over Kindred
  // drawn as cards rather than listed as names. The claims below are the
  // ones that survived the redraw plus the ones it added.

  it("shows the population's own shape, and calls it answers not people", () => {
    mount("people");
    expect(screen.getByText(/who.s here/i)).toBeTruthy();
    // The age histogram is in scale order, so it reads as a distribution
    // rather than a ranking. getAllBy because the median band figure
    // above it names a band too, which is the point of having one.
    expect(screen.getAllByText("25-34").length).toBeGreaterThan(0);
    expect(screen.getByText("35-44")).toBeTruthy();
    expect(screen.getByText(/answers, not people/i)).toBeTruthy();
  });

  it("marks your own age band rather than annotating it", () => {
    // How you find yourself in a histogram without reading a label.
    LIVE.anchors = () => ({ ageBand: "35-44" });
    mount("people");
    const you = screen.getAllByText(/^you$/i);
    expect(you.length).toBeGreaterThan(0);
  });

  it("reports a median BAND, never an invented age", () => {
    // The anchor is a band. "33" would be a number nobody measured — the
    // prototype's figure, and the exact shape D1 refuses.
    mount("people");
    expect(screen.getByText(/median band/i)).toBeTruthy();
    expect(screen.queryByText(/median age/i)).toBeNull();
  });

  it("says who a kindred stranger IS, not only how alike they are", () => {
    // The headline is the interesting half: a profession and an age band
    // tell you something a name does not.
    LIVE.kindredPeople = () => [kin()];
    mount("people");
    expect(screen.getByText("Ceramicist · 25-34")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("5 of 6 the same")).toBeTruthy();
    // A likeness number nobody can explain is a number nobody should
    // trust, so the definition ships next to it.
    expect(screen.getByText(/share of the questions you have both answered/i)).toBeTruthy();
    expect(screen.getByText(/the fuller the ring, the closer/i)).toBeTruthy();
  });

  it("falls back to the name when there is no profession to lead with", () => {
    LIVE.kindredPeople = () => [kin({ anchors: { ageBand: "25-34" } })];
    mount("people");
    // The band becomes the headline; the name is not repeated under it.
    expect(screen.getAllByText("25-34").length).toBeGreaterThan(1);
    expect(screen.getByText("Ada")).toBeTruthy();
  });

  it("renders an account with neither name nor anchors as Someone", () => {
    LIVE.kindredPeople = () => [kin({ uid: "u9", name: "", anchors: {} })];
    mount("people");
    expect(screen.getByText("Someone")).toBeTruthy();
    expect(screen.queryByText(/u9/)).toBeNull();
  });

  it("badges a type only where the person finished the instrument", () => {
    // typeOfPerson returns null without a Big Five result, and no badge is
    // drawn rather than a guess at one.
    LIVE.kindredPeople = () => [kin()];
    const { container } = mount("people");
    expect(container.textContent).not.toMatch(/The /);
  });

  it("draws the type's own mark on the badge, not a decorative dot", () => {
    // D156's sweep against the v25 sample. The badge wore a dot coloured by
    // `angleHash(uid)` — decorative, and sitting in the one place on the
    // card a reader would take for a reading. TypeMark is the glyph the
    // TypeMix card draws each type with, so a badge on a person and a row
    // in the population became the same object.
    LIVE.kindredPeople = () => [kin({
      results: { big5: { O: 88, C: 40, E: 75, A: 55, N: 45 } },
    })];
    const { container } = mount("people");
    const badge = [...container.querySelectorAll("span")]
      .find((el) => /^The /.test(el.textContent || "") && el.querySelector("svg"));
    expect(badge, "the type badge drew no mark").toBeTruthy();
  });

  it("drops anyone below the shared-question floor", () => {
    // One shared question is a coin flip, not an overlap — and a 100% over
    // one would otherwise head the list.
    LIVE.kindredPeople = () => [
      kin({ uid: "thin", name: "Thin", like: { shared: 1, same: 1, pct: 100 } }),
    ];
    mount("people");
    expect(screen.queryByText("Thin")).toBeNull();
    expect(screen.getByText(/nobody has answered enough/i)).toBeTruthy();
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

  it("says the card is empty rather than drawing an empty shape", () => {
    mount("people", [{ ...Q, by: {} }]);
    expect(screen.getByText(/nobody here has filled in their age or gender/i)).toBeTruthy();
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
    all: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
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
      options: ["1", "2", "3", "4", "5"], counts: [0, 0, 0, 3, 0], all: [0, 0, 0, 3, 0], by: {}, mine: -1,
    };
    const rating: LensQuestion = { ...RATED, id: "r2", text: "Curiosity?", counts: [0,0,0,0,0,0,3,0,0,0], all: [0,0,0,0,0,0,3,0,0,0], mine: -1 };
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
