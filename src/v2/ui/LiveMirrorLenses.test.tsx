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
  // D178: every named surface draws a face now, so a LIVE stand-in
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
  // Compare's own reads since D193: the bank's test items, the cells this
  // stop folds them over, and your side of the comparison. Stubbed empty
  // by default, which is the "fills in as you answer" arm — the cases
  // that want a drawing supply all four.
  myCity: "Oslo, NO",
  myVotes: () => ({}) as Record<string, string>,
  testFeedItems: () => [] as Array<Record<string, unknown>>,
  aggFor: (qid: string) => { void qid; return null as Record<string, unknown> | null; },
  loadNames: vi.fn(async () => {}),
  scoresFor: (uid: string) => { void uid; return null as Record<string, Record<string, number>> | null; },
  loadSimilarity: vi.fn(async () => {}),
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveMirrorLenses } = await import("./LiveMirrorLenses");
// The instrument definitions the Compare fold joins the bank to. Read
// rather than fabricated: the join runs on PROMPT TEXT (similarity.ts
// testItemMeta), so a hand-written prompt would silently match nothing
// and every Compare case would pass by drawing the empty state.
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField pattern)
const { IS_TESTS } = await import("../spec/test-definitions.js");

// One question, 60/40 overall, split hard by age and not at all by gender.
const Q: LensQuestion = {
  id: "q1",
  text: "Pineapple on pizza?",
  options: ["Yes", "No"],
  counts: [12, 8],
  // Explore's baseline (D170). Equal to `counts` in this fixture on
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
// `scope` is Scores' own filter since D187 — it draws the questions that
// rate THIS stop — so the mount has to be able to stand somewhere other
// than the city. Defaulted, because every other lens ignores it.
const mount = (
  lens: LensId,
  qs: LensQuestion[] = [Q],
  shortName = "Oslo",
  scope: "city" | "country" | "world" = "city",
) => render(<LiveMirrorLenses lens={lens} qs={qs} shortName={shortName} scope={scope} />);
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
  // Compare's four (D193), back to the empty arm between cases — the
  // suite is shared and a fixture left standing would make the next
  // describe's Compare draw a card nobody set up.
  LIVE.myVotes = () => ({});
  LIVE.testFeedItems = () => [];
  LIVE.myTestResults = () => ({});
  LIVE.aggFor = () => null;
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

  it("shows the population's own shape, and counts it in answers", () => {
    mount("people");
    expect(screen.getByText(/who.s here/i)).toBeTruthy();
    // The age histogram is in scale order, so it reads as a distribution
    // rather than a ranking. getAllBy because the median band figure
    // above it names a band too, which is the point of having one.
    expect(screen.getAllByText("25-34").length).toBeGreaterThan(0);
    expect(screen.getByText("35-44")).toBeTruthy();
    expect(screen.getByText(/answers with an age/i)).toBeTruthy();
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
    expect(screen.getByText("5/6 alike")).toBeTruthy();
    // A likeness number nobody can explain is a number nobody should
    // trust, so the definition ships next to it.
    expect(screen.getByText(/same picks ÷ shared/i)).toBeTruthy();
    expect(screen.getByText(/who answers most like you/i)).toBeTruthy();
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
    expect(screen.getByText(/fills in as you answer more/i)).toBeTruthy();
  });

  it("distinguishes 'still working' from 'nobody overlaps'", () => {
    LIVE.kindredLoading = () => true;
    mount("people");
    expect(screen.getByText(/^Matching…$/)).toBeTruthy();
    expect(screen.queryByText(/fills in as you answer more/i)).toBeNull();

    cleanup();
    LIVE.kindredLoading = () => false;
    mount("people");
    expect(screen.getByText(/fills in as you answer more/i)).toBeTruthy();
  });

  it("says the card is empty rather than drawing an empty shape", () => {
    mount("people", [{ ...Q, by: {} }]);
    expect(screen.getByText(/no ages or genders here yet/i)).toBeTruthy();
  });
});

// ── Compare ──────────────────────────────────────────────────────────
//
// D193 replaced the reading, not the discipline. What stood here was a
// list of questions with your own pick's share in each — real numbers,
// answering a question docs/MIRROR.md has never said this lens asks, and
// one the Answers tab already answers better. What it draws now is the
// prototype's: your profile and this population's, laid over each other
// per instrument.
//
// The cases that matter are the two the old lens had (which CELL, and
// which emptiness) plus the two the new arithmetic adds (a floor, and an
// instrument only one side has).
describe("Compare", () => {
  // Every big5 item, as the seeded bank carries them. `prompt` comes off
  // IS_TESTS itself because the scoring join matches on prompt text.
  const BIG5 = (IS_TESTS as Record<string, { questions: Array<{ q: string }> }>)
    .big5.questions.map((q, i) => ({
      id: `t_big5_${i}`, prompt: q.q, test: "big5", surface: "test",
      options: ["1", "2", "3", "4", "5"],
    }));
  /**
   * A cell with every answer on the MIDDLE option.
   *
   * Which scores every axis at exactly 50 whether the item is reversed or
   * not — `invert ? 4 - 2 : 2` is 2 either way — so these fixtures cannot
   * accidentally depend on which of the twenty-five items carry the flag.
   */
  const middle = (n: number) => ({ "0": 0, "1": 0, "2": n, "3": 0, "4": 0 });
  /** A finished Big Five, in the shape `testResults` stores one. */
  const MY_BIG5 = {
    big5: { dims: [
      { id: "O", value: 70 }, { id: "C", value: 60 }, { id: "E", value: 50 },
      { id: "A", value: 40 }, { id: "N", value: 30 },
    ] },
  };

  beforeEach(() => {
    LIVE.testFeedItems = () => BIG5;
    LIVE.myTestResults = () => MY_BIG5;
    // Oslo answered the middle; the globe is not the same crowd and says
    // so — every answer at the far end.
    LIVE.aggFor = () => ({
      counts: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 40 },
      by: { city: { "Oslo, NO": middle(20) } },
    });
  });

  it("lays your profile over this population's, one card per instrument", () => {
    mount("compare");
    expect(screen.getByText(/You .* Oslo/)).toBeTruthy();
    // Oslo sits at 50 on all five; your gaps are 20, 10, 0, 10, 20 — mean
    // 12, so 88. `queryAllByText` because the figure is on screen more
    // than once by design — the header's pooled number, the instrument
    // card's own, and the alignment glyph's title — and asserting one
    // occurrence would be asserting the layout rather than the reading.
    expect(screen.queryAllByText(/^88$/).length).toBeGreaterThan(0);
    // The basis it stands on, which is the half a percentage is worthless
    // without.
    expect(screen.getByText(/across 5 axes/)).toBeTruthy();
    expect(screen.getByText("Big Five")).toBeTruthy();
  });

  it("reads THIS stop's cell, never the globe", () => {
    mount("compare");
    // The globe is 100 on every forward axis and 0 on every reversed one,
    // so a lens reading `agg.counts` could not land on 88 — and at the
    // World stop, where the globe IS the stop, the same fixture must.
    expect(screen.queryAllByText(/^88$/).length).toBeGreaterThan(0);
    cleanup();
    mount("compare", [Q], "the world", "world");
    expect(screen.queryAllByText(/^88$/)).toEqual([]);
  });

  it("says nobody here has answered rather than drawing a thin profile", () => {
    // A globe full of answers and no Oslo cell at all — the shape that
    // used to draw a confident split out of a cohort with nothing in it.
    LIVE.aggFor = () => ({ counts: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 40 }, by: {} });
    mount("compare");
    expect(screen.getByText(/Nobody in Oslo has answered a test card yet/i)).toBeTruthy();
  });

  it("refuses an axis the population has too few answers on", () => {
    // Five answers per item is twenty-five per axis, under the floor the
    // result cards' "most people" ring uses (NORM_MIN_ANSWERS).
    LIVE.aggFor = () => ({ counts: {}, by: { city: { "Oslo, NO": middle(5) } } });
    mount("compare");
    expect(screen.getByText(/Nobody in Oslo has answered a test card yet/i)).toBeTruthy();
  });

  it("asks you to answer something rather than showing an empty frame", () => {
    LIVE.myTestResults = () => ({});
    mount("compare");
    expect(screen.getByText(/fills in as you answer the test cards/i)).toBeTruthy();
  });

  it("fills your side in from your own feed answers, with no test finished", () => {
    LIVE.myTestResults = () => ({});
    // The middle on every item, which is 50 on every axis — the same
    // place Oslo is standing.
    LIVE.myVotes = () => Object.fromEntries(BIG5.map((q) => [q.id, "2"]));
    mount("compare");
    expect(screen.queryAllByText(/^100$/).length).toBeGreaterThan(0);
  });
});

describe("Scores", () => {
  // A 1-10 rating of the city this stop is standing in: two 3s and two
  // 9s, so the mean is 6 exactly.
  const RATED: LensQuestion = {
    id: "r1", type: "rating", rates: "city", tag: "Safety",
    text: "How safe do you feel walking home at night?",
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
    expect(screen.getByText(/you have not rated it/i)).toBeTruthy();
  });

  // ── D187: the card is about the PLACE ──
  //
  // The three cases below are the ones that were green while the release
  // drew a city scorecard led by "Breakfast is the best meal of the day".
  // Nothing in the counts, the type or the branch could have caught it —
  // the average was correct, of the wrong question.

  it("REFUSES a question that rates no place, however ordinal it is", () => {
    const outlook: LensQuestion = {
      ...RATED, id: "o1", tag: "Doing nothing", text: "It's okay to do nothing sometimes.",
      rates: undefined,
    };
    mount("scores", [outlook]);
    expect(screen.queryByText("Doing nothing")).toBeNull();
    expect(screen.getByText(/questions that rate Oslo land here/i)).toBeTruthy();
  });

  it("draws the stop it is standing on, not another stop's questions", () => {
    const country: LensQuestion = { ...RATED, id: "c1", rates: "country", tag: "Healthcare" };
    mount("scores", [RATED, country]);
    expect(screen.getByText("Safety")).toBeTruthy();
    expect(screen.queryByText("Healthcare")).toBeNull();
    // …and the same pair one stop out reverses, so this is a filter
    // rather than an ordering that happens to put the city first.
    cleanup();
    mount("scores", [RATED, country], "Norway", "country");
    expect(screen.getByText("Healthcare")).toBeTruthy();
    expect(screen.queryByText("Safety")).toBeNull();
  });

  it("REFUSES to average a categorical question", () => {
    // The type filter still does its own work under the subject filter. A
    // place question written as a `choice` — "Yes" and "No" are different,
    // not ordered — would otherwise render a confident number about
    // nothing, and nothing in `counts` could tell the two apart.
    mount("scores", [{ ...RATED, type: "choice", options: ["Yes", "No"], counts: [12, 8] }]);
    expect(screen.queryByText("/ 2")).toBeNull();
    expect(screen.getByText(/nobody here has scored Oslo yet/i)).toBeTruthy();
  });

  it("labels a row with the bank's noun rather than its prompt", () => {
    // A scorecard is a column of nouns beside one baseline; a column of
    // questions is a list you read one at a time, and the best-first sort
    // that makes the shape readable is wasted on it (docs/COPY.md).
    mount("scores", [RATED]);
    expect(screen.getByText("Safety")).toBeTruthy();
    expect(screen.queryByText(/walking home at night/)).toBeNull();
  });

  it("distinguishes 'no scored questions' from 'nobody answered them'", () => {
    // Two different emptinesses. Collapsing them into one "no data" is
    // the habit the withheld-cell era left behind (D98).
    mount("scores", [{ ...RATED, counts: [0,0,0,0,0,0,0,0,0,0] }]);
    expect(screen.getByText(/nobody here has scored Oslo yet/i)).toBeTruthy();
  });

  it("ranks by share of the scale, so a 5-point and a 10-point compare fairly", () => {
    // 4/5 (0.8) must outrank 7/10 (0.7). Ranking on the raw mean would
    // put the 7 first and quietly sort by which scale a question used.
    const likert: LensQuestion = {
      id: "s1", type: "scale", rates: "city", tag: "Rest", text: "Rest is fine.",
      options: ["1", "2", "3", "4", "5"], counts: [0, 0, 0, 3, 0], all: [0, 0, 0, 3, 0], by: {}, mine: -1,
    };
    const rating: LensQuestion = { ...RATED, id: "r2", tag: "Curiosity", counts: [0,0,0,0,0,0,3,0,0,0], all: [0,0,0,0,0,0,3,0,0,0], mine: -1 };
    mount("scores", [rating, likert]);
    const texts = screen.getAllByText(/Rest|Curiosity/).map((n) => n.textContent);
    expect(texts).toEqual(["Rest", "Curiosity"]);
  });
});

describe("Explore", () => {
  it("shows a slice's split and names the gap in points and direction", () => {
    mount("explore");
    // The biggest age bucket leads; 25-34 is 90/10 against an overall
    // 60/40, so it is 30 points MORE likely to say Yes.
    expect(screen.getByText(/30 pts/)).toBeTruthy();
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

// ── who may score the place (D205) ──────────────────────────────────────
//
// The scorecard reads ONE pre-summed cell, so a reader whose scores are
// not in it cannot be shown that by absence — nothing on the card would
// look different. The card says it instead, and only where it is true:
// City, live, and the phone has never agreed with the anchor.
describe("Scores · the confirmed-city note", () => {
  const RATED_CITY: LensQuestion = {
    id: "d1", type: "rating", rates: "city", tag: "Safety",
    text: "How safe do you feel walking home at night?",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    counts: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
    all: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
    by: {}, mine: 8,
  };
  const setCity = (city: string, ok: string) => {
    LIVE.anchors = () => ({ city });
    localStorage.setItem("insight.profileGeneral.v2", JSON.stringify({ vitals: { city, cityOk: ok } }));
  };
  afterEach(() => { localStorage.clear(); });

  it("tells an unconfirmed reader why their scores are not in the number", () => {
    setCity("Oslo, NO", "");
    mount("scores", [RATED_CITY], "Oslo", "city");
    expect(screen.getByText(/Confirm your city in your profile/)).toBeTruthy();
  });

  it("says nothing once the device's own fix has agreed", () => {
    setCity("Oslo, NO", "Oslo, NO");
    mount("scores", [RATED_CITY], "Oslo", "city");
    expect(screen.queryByText(/Confirm your city in your profile/)).toBeNull();
  });

  it("stays off the Country stop — only the city anchor is gated", () => {
    // `country` is coarse enough that D90's timezone hint already lands
    // it, and gating it would be a second decision dressed as a
    // consequence of this one.
    setCity("Oslo, NO", "");
    mount("scores", [{ ...RATED_CITY, id: "c9", rates: "country", tag: "Healthcare" }], "Norway", "country");
    expect(screen.queryByText(/Confirm your city in your profile/)).toBeNull();
  });
});
