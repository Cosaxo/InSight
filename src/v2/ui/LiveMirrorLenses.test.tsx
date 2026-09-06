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
  budgetPaused: false as boolean,
  subscribe: () => () => {},
  loadKindred: vi.fn(async () => {}),
  kindredLoading: () => false as boolean,
  kindredDepth: () => 12,
  // The follow control (D101) rides on every named row. Stubbed
  // unfollowed — the button's own behaviour has its own cases.
  isFollowing: () => false,
  // The follow buttons ask for this set now: `isFollowing` reads the
  // circle when the Circle stop has loaded it and the follow set
  // otherwise, which is the state every surface but that one is in.
  loadFollows: async () => {},
  follows: () => null as string[] | null,
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
  // The Scores lens's ask rows (D307) and the vote they cast through the
  // ordinary path. Empty/spy by default; the ask cases supply both.
  placeAsks: (scope: string) => { void scope; return [] as Array<{ id: string; text: string; optionCount: number }>; },
  placeAskTotal: (scope: string): number => { void scope; return 0; },
  vote: vi.fn((qid: string, optionId: string) => { void qid; void optionId; }),
  testFeedItems: () => [] as Array<Record<string, unknown>>,
  aggFor: (qid: string) => { void qid; return null as Record<string, unknown> | null; },
  // The cells basis asks whether the test aggregates have been READ before
  // it states that a place has answered nothing. Stubbed "ready" here —
  // these cases are about what the fold says once the data is in; the
  // loading and failed arms have their own cases.
  testAggsState: () => "ready" as "loading" | "ready" | "failed",
  // Its people twin — every surface that mounts a similarity field
  // reads it now, so the stub belongs beside its sibling.
  kindredState: (): "loading" | "ready" | "failed" => "ready",
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
  LIVE.budgetPaused = false;
  // Reset with the rest — two cases below drive it, and a leak turns the
  // next case's empty state into a failure message.
  LIVE.testAggsState = () => "ready" as "loading" | "ready" | "failed";
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
  LIVE.placeAsks = () => [];
  LIVE.placeAskTotal = () => 0;
  LIVE.vote = vi.fn();
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

  it("Kindred says PAUSED under the read breaker, not 'fills in as you answer' (D332)", () => {
    // The refused fetch cannot fill anything in, however much is answered
    // — the promise would be false the moment it rendered.
    LIVE.budgetPaused = true;
    mount("people");
    expect(screen.getByText(/costs in check/i)).toBeTruthy();
    expect(screen.queryByText(/Fills in as you answer more/i)).toBeNull();
  });
});

describe("People", () => {
  // D152 rebuilt this lens to the prototype's shape: a "Who's here" card —
  // the population's size, its age SHAPE, its gender split — over Kindred
  // drawn as cards rather than listed as names. The claims below are the
  // ones that survived the redraw plus the ones it added.

  it("does not put the world's portrait under the name of a city", () => {
    // `by` is one dimension deep — `dim → bucket → counts`, so there is no
    // age×city cross and an age histogram for Oslo is not in the published
    // data. `mixFor(by, "ageBand")` sums every bucket, which is everyone.
    // The card printed that under "in Oslo" on the City and Country stops:
    // a different population, presented as the one you are standing in.
    mount("people", [Q], "Oslo", "city");
    expect(screen.queryByText("in Oslo")).toBe(null);
    expect(screen.getByText("everyone, not just Oslo")).toBeTruthy();
    cleanup();

    mount("people", [Q], "Norway", "country");
    expect(screen.getByText("everyone, not just Norway")).toBeTruthy();
  });

  it("still says `in` at World, where the numbers are the stop", () => {
    // The other direction, and the reason this is a label fix and not a
    // deletion: at World the fold and the stop are the same population,
    // so the qualifier would be the restating clause D182 deletes.
    mount("people", [Q], "the world", "world");
    // getAll, not get: the mix footer says "in the world" too, and a
    // getByText that started passing because a second element appeared
    // would be a test about the wrong node.
    expect(screen.getAllByText("in the world").length).toBeGreaterThan(0);
    expect(screen.queryByText(/everyone, not just/)).toBe(null);
  });

  it("draws the SAME numbers on every stop, which is what the label is for", () => {
    // If the figures moved with the stop the label would be the wrong
    // fix. They do not — the card cannot cut them — so this pins the
    // premise the sentence above rests on. 20 answers carry an age in the
    // fixture, on all three.
    const totals = (["city", "country", "world"] as const).map((sc) => {
      cleanup();
      mount("people", [Q], "Oslo", sc);
      return screen.getByText("answers with an age").parentElement?.textContent;
    });
    expect(totals[0]).toBe(totals[2]);
    expect(totals[1]).toBe(totals[2]);
    expect(totals[2]).toMatch(/20/);
  });

  it("draws a gender split that adds up to a hundred", () => {
    // The bar is 100%-STACKED: the same number is each segment's width
    // and the label printed inside it, so a set that does not sum to 100
    // is visible as a gap at the end of the track — the container clips
    // and paints no background, so the card shows through it.
    //
    // Rounding each bucket on its own does not sum. Three equal buckets
    // is the plainest case: 33 + 33 + 33 = 99. `sharePcts` (data/pct.ts)
    // is this app's one rounding rule and it is a largest-remainder one,
    // which sums by construction.
    const thirds = {
      ...Q,
      by: {
        ...Q.by,
        gender: {
          Woman: { "0": 1, "1": 0 },
          Man: { "0": 1, "1": 0 },
          "Non-binary": { "0": 1, "1": 0 },
        },
      },
    };
    mount("people", [thirds]);
    const printed = screen.getAllByTitle(/·\s*\d+%$/)
      .map((el) => Number(/(\d+)%$/.exec(el.getAttribute("title") || "")?.[1] ?? 0));
    expect(printed.length, "the gender bar drew no segments — the fixture missed it").toBe(3);
    expect(
      printed.reduce((a, b) => a + b, 0),
      `a 100%-stacked bar drew ${printed.join(" + ")} — the track has a gap in it`,
    ).toBe(100);
  });

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
    // "…here yet" read as the stop on a stop this card is not cut to —
    // "nobody in Oslo" where the fact is "nobody anywhere". Same defect
    // as the subtitle above, one arm over.
    mount("people", [{ ...Q, by: {} }], "Oslo", "city");
    expect(screen.getByText(/nobody has filled in an age or gender yet/i)).toBeTruthy();
    expect(screen.queryByText(/here yet/i)).toBe(null);
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

  it("says it is still reading rather than that a city has answered nothing", () => {
    // The stop folds published CELLS, and the reading flag beside it is
    // wired to the people basis only — its key is "" here — so the first
    // frame after opening City → Compare stated an absence about a whole
    // city from aggregates the device had not read. `loadSimilarity` is
    // what fills them, and it runs after first paint.
    LIVE.aggFor = () => null;
    LIVE.testAggsState = () => "loading";
    mount("compare");
    expect(screen.queryByText(/Nobody in Oslo has answered a test card yet/i),
      "an unread aggregate was drawn as a city that has answered nothing").toBeNull();
    expect(screen.getByText(/Reading…/i)).toBeTruthy();
  });

  it("says the read failed rather than saying it is still running", () => {
    // `loadSimilarity` sets `testAggsLoaded` INSIDE its try, so a throw
    // leaves it false for the life of the mount. Without the third state
    // that is indistinguishable from "not asked yet", and the lens would
    // say "Reading…" forever — the trap LiveCompareLens's own effect
    // comment describes for the other basis.
    LIVE.aggFor = () => null;
    LIVE.testAggsState = () => "failed";
    mount("compare");
    expect(screen.queryByText(/Nobody in Oslo has answered a test card yet/i)).toBeNull();
    expect(screen.queryByText(/Reading…/i), "a failed read kept saying it was still reading").toBeNull();
    expect(screen.getByText(/Couldn’t read the scores here/i)).toBeTruthy();
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

  it("does not say nobody scored it to the person who scored it", () => {
    // `scored` drops a row when neither crowd has a mean, and your own
    // score is not a crowd — so rating a place nobody else has rated yet,
    // or rating one in the seconds before the fold lands, empties this
    // card. It then printed "Nobody here has scored Oslo yet." over a
    // score you had just given it.
    const onlyMine: LensQuestion = {
      ...RATED,
      counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      all: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      mine: 8,
    };
    mount("scores", [onlyMine]);
    expect(screen.getByText(/just your score so far/i)).toBeTruthy();
    expect(screen.queryByText(/nobody here has scored/i)).toBeNull();
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
    // the habit the withheld-cell era left behind (D98). "Nobody" means
    // nobody ANYWHERE since D288 §2 — a city cell at zero with answers
    // from elsewhere is the ring-only case below, not this one.
    //
    // `mine: -1`, which this case needed all along and did not say: it
    // spread RATED's `mine: 8`, so it was asserting "nobody here has
    // scored Oslo" for a viewer who HAD scored it — the defect the case
    // above now holds, sitting inside the case that names the distinction.
    // "Nobody anywhere" has never included the reader.
    mount("scores", [{ ...RATED, counts: [0,0,0,0,0,0,0,0,0,0], all: [0,0,0,0,0,0,0,0,0,0], mine: -1 }]);
    expect(screen.getByText(/nobody here has scored Oslo yet/i)).toBeTruthy();
    expect(screen.queryByText(/just your score so far/i)).toBeNull();
  });

  // ── D288 §2: the second crowd ──
  //
  // "Live there" is the stop's own cell, "from elsewhere" is the globe
  // minus it — both from reads the lens already makes. The single-crowd
  // card above is not a separate mode: it is what this card looks like
  // the moment nobody outside has scored anything.

  it("draws the elsewhere crowd the moment it exists, with both bases stated", () => {
    // city: two 3s and two 9s (mean 6) · elsewhere: two more 9s on top
    mount("scores", [{ ...RATED, all: [0, 0, 2, 0, 0, 0, 0, 0, 4, 0] }]);
    expect(screen.getByText(/4 live there/)).toBeTruthy();
    expect(screen.getByText(/2 from elsewhere/)).toBeTruthy();
    // the header stops claiming the raters are the subject
    expect(screen.getByText(/How Oslo is rated/)).toBeTruthy();
    expect(screen.queryByText(/rates itself/)).toBeNull();
  });

  it("keeps the single-crowd card when all answers are the stop's own", () => {
    mount("scores", [RATED]); // all === counts — nobody from elsewhere
    expect(screen.queryByText(/live there/)).toBeNull();
    expect(screen.getByText(/How Oslo rates itself/)).toBeTruthy();
    expect(screen.getByText(/4 answers/)).toBeTruthy();
  });

  it("draws a ring-only row where only elsewhere has scored, absent dot and all", () => {
    mount("scores", [{ ...RATED, counts: [0,0,0,0,0,0,0,0,0,0], mine: -1 }]);
    expect(screen.getByText(/none live there/)).toBeTruthy();
    expect(screen.getByText(/4 from elsewhere/)).toBeTruthy();
    // the row's number describes the crowd that exists
    expect(screen.getByText("6")).toBeTruthy();
  });

  it("swaps the described crowd on the fore toggle, and the toggle claims nothing", () => {
    // city mean 6 (two 3s, two 9s) · elsewhere mean 9 (two 9s)
    mount("scores", [{ ...RATED, all: [0, 0, 2, 0, 0, 0, 0, 0, 4, 0], mine: -1 }]);
    expect(screen.getByText("6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /from elsewhere/ }));
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.queryByText("6")).toBeNull();
  });

  it("does not call your answer the only one HERE while describing elsewhere", () => {
    // `lead` follows the toggle; the singleton sentence did not. Four here
    // and one from elsewhere, with your own answer among the four: switch
    // the card to "from elsewhere" and it printed "the only answer here so
    // far" on the line that had just counted four of them. Your vote is
    // never in the away crowd at your own stop.
    mount("scores", [{ ...RATED, all: [0, 0, 2, 0, 0, 0, 0, 0, 3, 0], mine: 8 }]);
    fireEvent.click(screen.getByRole("button", { name: /from elsewhere/ }));
    expect(screen.queryByText(/the only answer here so far/)).toBeNull();
    // …and it still says something true about your answer against them.
    expect(screen.getByText(/above them|below them|exactly the average/)).toBeTruthy();
  });

  it("keeps it for the crowd that really is one answer — your own", () => {
    // The contrast: one answer here, and it is yours.
    mount("scores", [{ ...RATED, counts: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0], all: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0], mine: 8 }]);
    expect(screen.getByText(/the only answer here so far/)).toBeTruthy();
  });

  it("never splits the world — there, everyone IS the crowd", () => {
    const world: LensQuestion = { ...RATED, id: "w1", rates: "world", tag: "Kindness",
      all: [0, 0, 4, 0, 0, 0, 0, 0, 4, 0] };
    mount("scores", [world], "the world", "world");
    expect(screen.queryByText(/live there/)).toBeNull();
    expect(screen.getByText(/4 answers/)).toBeTruthy();
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

  // THE FLOOR `divergenceFor` ASKS ITS CALLER TO CHOOSE, AND THE BASIS.
  //
  // Its docstring says why in the words this lens broke: "a one-answer
  // bucket is 100/0 and would top every ranking forever while saying
  // nothing. It defaults to 0 so the caller has to choose." Explore did
  // not choose — so a question where the picked bucket held ONE answer
  // scored the largest possible gap and headed the list, above a
  // fifty-answer question at 10 pts, and the only number near the sentence
  // was the chip's, which is the bucket's total across ALL questions and
  // therefore a different denominator.
  //
  // The three cases above all use ten-answer cells, so none of them could
  // see it.
  const THIN: LensQuestion = {
    id: "thin", text: "Is coriander soap?", options: ["Yes", "No"],
    counts: [25, 25], all: [25, 25],
    by: { ageBand: { "25-34": { "0": 1 }, "35-44": { "0": 20, "1": 20 } } },
    mine: -1,
  };
  const SOLID: LensQuestion = {
    id: "solid", text: "Is pineapple pizza?", options: ["Yes", "No"],
    counts: [25, 25], all: [25, 25],
    by: { ageBand: { "25-34": { "0": 30, "1": 20 }, "35-44": { "0": 20, "1": 20 } } },
    mine: -1,
  };

  it("does not let a one-answer cell head the list", () => {
    mount("explore", [THIN, SOLID]);
    open(/^25-34/);
    const body = document.body.textContent || "";
    expect(body, "the solid question is missing — the case is measuring nothing")
      .toContain("Is pineapple pizza?");
    expect(body, "a cell of one answer was ranked, and at the largest possible gap")
      .not.toContain("Is coriander soap?");
  });

  it("says what each row rests on, which the chip's number is not", () => {
    mount("explore", [SOLID]);
    open(/^25-34/);
    // 30/20 in the cell against 25/25 overall: 10 points, from 50 answers.
    expect(screen.getByText(/10 pts/)).toBeTruthy();
    expect(document.body.textContent, "the row states no basis")
      .toMatch(/from 50 answers/);
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
// ── the asks (D307) ─────────────────────────────────────────────────
//
// The only other door to a `rates` question was the daily rotation — one
// such day in five — so a scorecard could sit empty with nothing anyone
// could do about it. The cases hold the seam: rows from the BANK (not
// the aggregates), votes through the one ordinary path, and a cap that
// keeps the card a card.
describe("Scores · the asks (D307)", () => {
  const SCORED: LensQuestion = {
    id: "r1", type: "rating", rates: "city", tag: "Safety",
    text: "How safe do you feel walking home at night?",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    counts: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
    all: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
    by: {}, mine: 8,
  };
  const ASK = { id: "daily-093", text: "Rate the food where you live.", optionCount: 10 };

  it("offers the unanswered place questions under the scored rows", () => {
    LIVE.placeAsks = () => [ASK];
    mount("scores", [SCORED]);
    expect(screen.getByText("Rate the food where you live.")).toBeTruthy();
    // Ten steps, one tap each — D305's scale row, not ten stacked rows.
    expect(screen.getByRole("button", { name: "10" })).toBeTruthy();
  });

  it("casts the tap through the ordinary vote path, as the option index", () => {
    LIVE.placeAsks = () => [ASK];
    mount("scores", [SCORED]);
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    expect(LIVE.vote).toHaveBeenCalledWith("daily-093", "6");
  });

  it("keeps the empty scorecard honest and answerable at once", () => {
    // "Nobody has scored it" stays a fact; the way to change it sits
    // right under the sentence instead of behind the rotation.
    LIVE.placeAsks = () => [ASK];
    mount("scores", []);
    expect(screen.getByText(/Nothing scored yet/)).toBeTruthy();
    expect(screen.getByText("Rate the food where you live.")).toBeTruthy();
  });

  it("caps the visible asks and counts the rest", () => {
    LIVE.placeAsks = () => Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`, text: `Place question ${i} long enough to read.`, optionCount: 10,
    }));
    LIVE.placeAskTotal = () => 5;
    mount("scores", []);
    expect(screen.getByText("Place question 0 long enough to read.")).toBeTruthy();
    expect(screen.getByText("Place question 2 long enough to read.")).toBeTruthy();
    expect(screen.queryByText("Place question 3 long enough to read.")).toBeNull();
    expect(screen.getByText("2 more after these.")).toBeTruthy();
  });

  it("counts the POOL, not the page it was handed (D383)", () => {
    // The regression this exists to stop. Since D383 the device fetches a
    // bounded page of ask documents and knows every ask ID, so the two
    // numbers part company on exactly the stops with the most to offer:
    // counting the array would say "1 more after these" on a scope
    // holding forty, which is the same class of quietly-wrong sentence
    // D1 is about. The line reads the pool.
    LIVE.placeAsks = () => Array.from({ length: 4 }, (_, i) => ({
      id: `d${i}`, text: `Place question ${i} long enough to read.`, optionCount: 10,
    }));
    LIVE.placeAskTotal = () => 40;
    mount("scores", []);
    expect(screen.getByText("37 more after these.")).toBeTruthy();
    expect(screen.queryByText("1 more after these.")).toBeNull();
  });

  it("says nothing about a tail when the pool is what is on screen", () => {
    LIVE.placeAsks = () => Array.from({ length: 3 }, (_, i) => ({
      id: `d${i}`, text: `Place question ${i} long enough to read.`, optionCount: 10,
    }));
    LIVE.placeAskTotal = () => 3;
    mount("scores", []);
    expect(screen.queryByText(/more after these/)).toBeNull();
  });

  it("offers nothing when every place question is answered", () => {
    mount("scores", [SCORED]);
    expect(screen.queryByRole("button", { name: "7" })).toBeNull();
  });
});

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
