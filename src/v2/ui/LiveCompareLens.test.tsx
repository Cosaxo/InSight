// @vitest-environment jsdom
//
// LiveCompareLens (D193) — the Mirror's Compare tab: you and a population
// laid over each other, one card per instrument.
//
// The arithmetic underneath is data/compare.ts and it is pinned there.
// What only a render can execute is the ATTRIBUTION: this screen carries
// two people's numbers at once inside one picture, so every way it can lie
// is a number landing on the wrong side of that picture, or a side that is
// not there being drawn anyway. Six properties, each one a way a correct
// fold reaches the screen as a wrong reading:
//
//   1. Each score keeps its own side, axis for axis. The solid petal is
//      yours and the washed dot is theirs — the rose's aria-label promises
//      exactly that — and the legend is the only key a reader has to it.
//      Swap either and every card reads as its own mirror image with every
//      number on it still correct.
//   2. An instrument only ONE of you has draws no card, and an axis their
//      side lost to its floor leaves the rose rather than sitting at a
//      neutral 50 — a mark at fifty is a claim about people who have said
//      nothing, which is the invented middle `axisScores` refuses to
//      manufacture.
//   3. The three emptinesses stay apart. "You have answered nothing",
//      "they have answered nothing" and "nothing you have both answered"
//      are different facts about different people; collapsing them tells
//      someone who has taken every test that they have taken none.
//   4. Your side fills in from your own feed answers, through
//      `voteIndices` — the store's option ids are STRINGS, and a raw
//      `myVotes()` folds to nothing at all while looking entirely
//      reasonable in the diff (D132, which shipped).
//   5. Every figure states what it was measured over, and the two bases
//      state different things: the answers behind the axes DRAWN for a
//      place, people out of the whole roster for a set. The header per
//      cent is the pooled one, not the mean of the cards'.
//   6. A set's profiles are asked for once per roster. The Near host maps
//      a fresh uid array out of its people list on every store notify, and
//      this panel re-renders on every store notify, so an effect keyed on
//      the array would re-ask for scores it already holds, for ever.
//
// `../data/live` is mocked, not booted (it imports Firebase). Nothing else
// is: `data/compare` and `data/similarity` are the real folds and
// `spec/test-definitions.js` the real instruments, which is what makes the
// fixtures below populations rather than stand-ins — a cohort here is
// per-option counts on the bank's own prompts, read back through the join
// the panel actually runs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ParsedResults, TestBankItem } from "../data/similarity";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  testAggsState: () => "ready" as "loading" | "ready" | "failed",
  subscribe: () => () => {},
  loadNames: vi.fn(() => Promise.resolve()),
  testFeedItems: (): TestBankItem[] => [],
  myTestResults: (): Record<string, unknown> => ({}),
  myVotes: (): Record<string, string> => ({}),
  scoresFor: (() => null) as (uid: string) => ParsedResults | null,
}));

vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: LiveCompareLens } = await import("./LiveCompareLens");

// ── fixtures ─────────────────────────────────────────────────────────

const LIKERT5 = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

/**
 * Two of each axis's items, verbatim from IS_TESTS and all forward-keyed.
 *
 * VERBATIM because `testItemMeta` joins the bank to the instruments on the
 * PROMPT TEXT — a paraphrase here would drop out of the join and every
 * cohort would come back empty with the fixture still looking right. Two
 * because `NORM_MIN_ITEMS` is two, which is what a place's axis has to
 * clear. Forward-keyed because the reverse items inverting a "4" into a 0
 * is similarity.ts's property, not this panel's, and pinning it twice buys
 * nothing but a fixture nobody can read.
 */
const PROMPTS: Record<string, Record<string, readonly [string, string]>> = {
  big5: {
    O: ["I find new ideas more interesting than familiar ones.", "I enjoy thinking about abstract concepts."],
    C: ["I keep appointments and rarely run late.", "I finish what I start, even when it gets dull."],
    E: ["I feel energised by spending time with strangers.", "I prefer a loud party to a quiet evening."],
    A: ["I try to keep the peace, even at some cost.", "I trust people until they give me reason not to."],
    N: ["I worry about things I can't control.", "Small setbacks throw off my whole day."],
  },
  political: {
    econ: ["Markets, left to themselves, distribute fairly.", "Lower taxes matter more than more public services."],
    auth: ["Some speech is harmful enough to restrict.", "More surveillance is a fair price for more safety."],
    foreign: ["My country should help others before its own poor.", "Borders should be more open than they are now."],
  },
};

/** An axis of a population: the score it should read, and how thin it is. */
type Axis = number | readonly [score: number, answers: number];

/** The floors LiveMirrorLenses hands the lens for a place (testNorms'). */
const MIN_ANSWERS = 30;
const MIN_ITEMS = 2;

/**
 * A population with these axis scores, built the way the real one arrives:
 * bank items the join can find, and per-option counts the fold reads back.
 *
 * All of an item's answers sit on one option, so `axisScores` returns
 * exactly `score` (scores are therefore multiples of 25 — the five points
 * of the scale the instruments are written on). The answers split across
 * the axis's two items so both floors clear together.
 */
function cohort(spec: Record<string, Record<string, Axis>>) {
  const bank: TestBankItem[] = [];
  const counts = new Map<string, number[]>();
  for (const [kind, dims] of Object.entries(spec)) {
    for (const [dim, axis] of Object.entries(dims)) {
      const score = typeof axis === "number" ? axis : axis[0];
      const answers = typeof axis === "number" ? 40 : axis[1];
      // Loudly, because the quiet version of this mistake is a cohort with
      // no axes at all and three tests that look like they are asserting
      // something: an off-scale score matches no option, so every cell is
      // zeroes and the fold skips the axis.
      if (score % 25) throw new Error(`${score} is not one of the scale's five points`);
      PROMPTS[kind][dim].forEach((prompt, i) => {
        const id = `${kind}.${dim}.${i}`;
        bank.push({ id, prompt, test: kind, options: LIKERT5 });
        counts.set(id, Array.from({ length: 5 }, (_, o) => (o === score / 25 ? answers / 2 : 0)));
      });
    }
  }
  return { bank, cellOf: (qid: string) => counts.get(qid) || null };
}

/** A place, as the City/Country/World stops call it. */
const place = (cellOf: (qid: string) => number[] | null) =>
  ({ basis: "cells", cellOf, minAnswers: MIN_ANSWERS, minItems: MIN_ITEMS }) as const;

/**
 * Your own completed instruments, in the RAW shape the profile stores.
 *
 * Through `parseTestResults`' door rather than around it: the field is
 * client-written and unvalidated, so the panel's own side of every
 * comparison has to survive that read to be on screen at all.
 */
const stored = (spec: Record<string, Record<string, number>>) =>
  Object.fromEntries(Object.entries(spec).map(([kind, dims]) => [
    kind, { dims: Object.entries(dims).map(([id, value]) => ({ id, value })) },
  ]));

/**
 * Their scores, ALREADY parsed — which is the asymmetry above, not a
 * shortcut: `live.ts` parses a cached profile on read, so only your own
 * side arrives raw and only your own side goes through `parseTestResults`.
 */
const scored = (spec: Record<string, Record<string, number>>): ParsedResults => spec;

/**
 * Both sides of one instrument's rose, read back off the SVG as 0..100.
 *
 * The geometry, not a re-run of the drawing: `CBRoseGap` puts your score
 * in a solid petal's outer radius and theirs in a washed dot's distance
 * from the centre, and those two marks are the entire claim the card
 * makes. The gap wash between them is the third kind of shape in there and
 * carries a `fill-opacity`, which is how a petal is told from it.
 */
function rose(card: HTMLElement) {
  const svg = card.querySelector("svg[role='img']");
  if (!svg) throw new Error("no rose on this card");
  const value = (r: number) => Math.round(((r - 6) / 72) * 100);
  const arc = (d: string) => Number(/A ([\d.]+)/.exec(d)?.[1]);
  return {
    you: [...svg.querySelectorAll("path")]
      .filter((p) => !p.getAttribute("fill-opacity"))
      .map((p) => value(arc(p.getAttribute("d") || ""))),
    them: [...svg.querySelectorAll("circle[r='4.4']")]
      .map((c) => value(Math.hypot(Number(c.getAttribute("cx")) - 88, Number(c.getAttribute("cy")) - 88))),
  };
}

/**
 * The alignment figure of a card or of the header, as the eye reads it.
 *
 * Queried on the digits and read back with the symbol: the per cent sign
 * is its own, smaller element, so "72%" is two text nodes and only the
 * number is a node a text query can hold.
 */
const aligned = (scope: HTMLElement) => within(scope).getByText(/^\d+$/).textContent;

/** One instrument's card, found the way a reader finds it — by its title. */
function cardOf(title: string): HTMLElement {
  const el = screen.getByText(title).closest(".card");
  if (!el) throw new Error(`no card titled ${title}`);
  return el as HTMLElement;
}

const OSLO_EMPTY = "Nobody in Oslo has answered a test card yet.";
const lens = (pop: React.ComponentProps<typeof LiveCompareLens>["pop"]) => (
  <LiveCompareLens pop={pop} whom="Oslo" emptyThem={<>{OSLO_EMPTY}</>} />
);

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.testFeedItems = () => [];
  LIVE.myTestResults = () => ({});
  LIVE.myVotes = () => ({});
  LIVE.scoresFor = () => null;
  LIVE.loadNames.mockClear();
});
afterEach(cleanup);

// ── 1 · each score keeps its own side ────────────────────────────────

describe("reading is not empty", () => {
  // The scores this basis folds come out of the shared profile cache, and
  // the fetch that fills it runs after first paint. `scoresFor` answers
  // null for "fetched, has none" and "never fetched" alike, so the first
  // frame used to state an absence about people whose profiles had not
  // arrived — on Groups, "Nobody here has finished a test yet" for the
  // length of one round trip, before flipping to a full profile.
  it("says it is reading while the profiles are in flight", async () => {
    let release!: () => void;
    LIVE.loadNames = vi.fn(() => new Promise<void>((r) => { release = r; }));
    LIVE.scoresFor = () => null;
    // The viewer HAS results, or the first arm outranks this one.
    LIVE.myTestResults = () => stored({ big5: { O: 90, C: 70, E: 50 } });
    render(lens({ basis: "people", uids: ["a", "b"] }));
    expect(screen.getByText("Reading…")).toBeTruthy();
    expect(screen.queryByText(OSLO_EMPTY)).toBeNull();
    // …and once the read lands with nothing in it, the absence is true
    // and gets said.
    await act(async () => { release(); await Promise.resolve(); });
    expect(screen.getByText(OSLO_EMPTY)).toBeTruthy();
    expect(screen.queryByText("Reading…")).toBeNull();
  });

  it("does not say it is reading when the viewer has answered nothing", () => {
    // The first arm outranks it: someone with no test answers of their own
    // is told what to do, not made to wait for other people's profiles.
    LIVE.loadNames = vi.fn(() => new Promise<void>(() => {}));
    LIVE.scoresFor = () => null;
    LIVE.myTestResults = () => ({});
    LIVE.myVotes = () => ({});
    render(lens({ basis: "people", uids: ["a"] }));
    expect(screen.getByText(/Fills in as you answer/)).toBeTruthy();
    expect(screen.queryByText("Reading…")).toBeNull();
  });
});

describe("your number and theirs never change places", () => {
  it("draws your score as the solid petal and theirs as the washed dot, axis for axis", () => {
    // Three axes, and the two profiles share no arrangement: a whole-card
    // swap and a per-axis mis-pairing are different bugs, and a fixture
    // with one value per side can only see the first. E is the axis they
    // sit ABOVE you on, so the gap wash is in the picture too and the
    // petal reader has to tell a wash from a petal.
    const them = cohort({ big5: { O: 25, C: 50, E: 75 } });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({ big5: { O: 90, C: 70, E: 50 } });
    render(lens(place(them.cellOf)));

    const marks = rose(cardOf("Big Five"));
    expect(marks.you).toEqual([90, 70, 50]);
    expect(marks.them).toEqual([25, 50, 75]);
  });

  it("keys the legend the way the roses are drawn — you solid, them washed", () => {
    // The rose says "solid petals are your scores" to a screen reader and
    // nothing at all to everyone else; this row is where the encoding is
    // stated to the eye. Reverse it and every card above reads as its
    // mirror image with no pixel moving.
    const them = cohort({ big5: { O: 25, C: 25, E: 25 } });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({ big5: { O: 90, C: 90, E: 90 } });
    render(lens(place(them.cellOf)));

    const swatch = (label: string) =>
      (screen.getByText(label).previousElementSibling as HTMLElement).style.background;
    expect(swatch("you")).toBe("var(--accent)");
    expect(swatch("Oslo")).toMatch(/transparent 52%/);
  });
});

// ── 2 · an absent side is absent, never a neutral 50 ─────────────────

describe("a comparison needs two sides", () => {
  it("draws no card for an instrument only they have", () => {
    // Oslo has answered Politics; you have not. There is no comparison to
    // make, and the alternative — your own profile borrowed for their side,
    // or theirs for yours — would draw a Politics card at 100% agreement
    // with a population you have never met on the subject.
    const them = cohort({
      big5: { O: 50, C: 50, E: 50, A: 50, N: 50 },
      political: { econ: 50, auth: 50, foreign: 50 },
    });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({ big5: { O: 50, C: 50, E: 50, A: 50, N: 50 } });
    render(lens(place(them.cellOf)));

    expect(screen.getByText("Big Five")).toBeTruthy();
    expect(screen.queryByText("Politics")).toBeNull();
    // …and the basis counts the axes DRAWN, so Politics' three do not
    // quietly widen the sentence under the header either.
    expect(screen.getByText(/mean gap across 5 axes/)).toBeTruthy();
  });

  it("drops an axis below their floor off the rose instead of pinning them at fifty", () => {
    // Sensitivity has ten answers in Oslo, under the thirty a place's axis
    // needs, so `cohortAxisMap` never scores it. You have all five. The
    // failure this pins is the tidy one: five petals and a fifth dot at the
    // middle of the track, which is a mark on the screen saying something
    // about people who have not answered.
    const them = cohort({ big5: { O: 25, C: 25, E: 25, A: 25, N: [25, 10] } });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({ big5: { O: 75, C: 75, E: 75, A: 75, N: 75 } });
    render(lens(place(them.cellOf)));

    const card = cardOf("Big Five");
    const marks = rose(card);
    expect(marks.you).toEqual([75, 75, 75, 75]);
    // Every petal has a dot: the rose's whole claim is two profiles laid
    // over each other, and a slice with only one mark on it is not that.
    expect(marks.them).toEqual([25, 25, 25, 25]);
    expect(screen.getByText(/mean gap across 4 axes/)).toBeTruthy();
    // Sensitivity's pole row is gone with it. The four kept axes still name
    // their poles, so this is the axis missing rather than the rows failing.
    expect(within(card).queryByText("sensitive")).toBeNull();
    expect(within(card).getByText("curious")).toBeTruthy();
  });
});

// ── 3 · three emptinesses, kept apart ────────────────────────────────

describe("an empty comparison says which side is empty", () => {
  /** No card anywhere — the state each of these three is instead of. */
  const nothingDrawn = () => {
    expect(screen.queryByText(/aligned/)).toBeNull();
    expect(document.querySelectorAll(".card")).toHaveLength(0);
  };

  it("asks YOU first when you have answered nothing", () => {
    const them = cohort({ big5: { O: 50, C: 50, E: 50 } });
    LIVE.testFeedItems = () => them.bank;
    render(lens(place(them.cellOf)));

    expect(screen.getByText(/Fills in as you answer/)).toBeTruthy();
    expect(screen.queryByText(OSLO_EMPTY)).toBeNull();
    nothingDrawn();
  });

  it("hands the sentence to the host when THEY have answered nothing", () => {
    // Only the host knows why a population is empty — "nobody in Oslo",
    // "nobody here", "nobody in your circle" — so the lens must not answer
    // for it out of its own vocabulary.
    LIVE.testFeedItems = () => cohort({ big5: { O: 50, C: 50, E: 50 } }).bank;
    LIVE.myTestResults = () => stored({ big5: { O: 50, C: 50, E: 50 } });
    render(lens(place(() => null)));

    expect(screen.getByText(OSLO_EMPTY)).toBeTruthy();
    expect(screen.queryByText(/Fills in as you answer/)).toBeNull();
    nothingDrawn();
  });

  it("says so when you have both answered, but never the same instrument", () => {
    // You have Personality, Oslo has Politics. Both sides are full and
    // there is still nothing to draw — the one of the three that reads as a
    // bug if it borrows either of the other two sentences.
    const them = cohort({ political: { econ: 50, auth: 50, foreign: 50 } });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({ big5: { O: 50, C: 50, E: 50 } });
    render(lens(place(them.cellOf)));

    expect(screen.getByText(/No instrument you have both answered enough of yet/)).toBeTruthy();
    expect(screen.queryByText(/Fills in as you answer/)).toBeNull();
    expect(screen.queryByText(OSLO_EMPTY)).toBeNull();
    nothingDrawn();
  });
});

// ── 4 · your side fills in from ordinary answering ───────────────────

describe("your side does not wait for a sit-down test", () => {
  it("folds your own feed answers, string option ids and all", () => {
    // No completed instrument — just six taps on test cards in the feed.
    // The ids are STRINGS because that is what the store holds
    // (`myVotes()` writes `String(optionIdx)`), and every scorer under this
    // panel asks `Number.isInteger`, so a raw map folds to nothing at all
    // and this screen tells someone who has answered that they have not.
    const them = cohort({ big5: { O: 75, C: 75, E: 75 } });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myVotes = () => Object.fromEntries(them.bank.map((q) => [q.id, "4"]));
    render(lens(place(them.cellOf)));

    const marks = rose(cardOf("Big Five"));
    expect(marks.you).toEqual([100, 100, 100]);
    expect(marks.them).toEqual([75, 75, 75]);
  });
});

// ── 5 · every figure says what it was measured over ──────────────────

describe("the basis under the header counts what was drawn", () => {
  it("counts the answers behind the drawn axes, not everything it folded", () => {
    // Oslo's Politics axes are measured and thick — 600 answers — and no
    // card rests on them, because you have not answered Politics. Resting
    // three drawn axes on a count of 720 would overstate them by six times.
    const them = cohort({
      big5: { O: 50, C: 50, E: 50 },
      political: { econ: [50, 200], auth: [50, 200], foreign: [50, 200] },
    });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({ big5: { O: 50, C: 50, E: 50 } });
    render(lens(place(them.cellOf)));

    expect(screen.getByText("mean gap across 3 axes · 120 test answers")).toBeTruthy();
  });

  it("pools the header per cent across axes rather than averaging the cards", () => {
    // Five axes agreeing perfectly and three disagreeing by 75. Averaging
    // the two CARD figures gives 63 and weights three axes as heavily as
    // five; the pooled mean is 72. The header number has to be the same
    // KIND of number as the "92% aligned" on a place card two tabs over,
    // which is `scoreMatch` over every shared axis at once.
    const them = cohort({
      big5: { O: 50, C: 50, E: 50, A: 50, N: 50 },
      political: { econ: 25, auth: 25, foreign: 25 },
    });
    LIVE.testFeedItems = () => them.bank;
    LIVE.myTestResults = () => stored({
      big5: { O: 50, C: 50, E: 50, A: 50, N: 50 },
      political: { econ: 100, auth: 100, foreign: 100 },
    });
    render(lens(place(them.cellOf)));

    expect(aligned(cardOf("Big Five"))).toBe("100%");
    expect(aligned(cardOf("Politics"))).toBe("25%");
    const header = screen.getByText("You ↔ Oslo").parentElement as HTMLElement;
    expect(aligned(header)).toBe("72%");
    expect(within(header).getByText(/mean gap across 8 axes/)).toBeTruthy();
  });

  it("counts a set in people over its whole roster, and means their profiles", () => {
    // Three in the room, two with a finished Big Five. Their side is the
    // MEAN of those two (40 and 80 → 60), and the line says two of three —
    // the denominator is the population the tab names, so the third is
    // stated as missing rather than dropped out of both numbers.
    LIVE.myTestResults = () => stored({ big5: { O: 90, C: 90, E: 90 } });
    LIVE.scoresFor = (uid) => ({
      a: scored({ big5: { O: 40, C: 40, E: 40 } }),
      b: scored({ big5: { O: 80, C: 80, E: 80 } }),
    })[uid] || null;
    render(lens({ basis: "people", uids: ["a", "b", "c"] }));

    expect(rose(cardOf("Big Five")).them).toEqual([60, 60, 60]);
    expect(screen.getByText("mean gap across 3 axes · 2 of 3 have taken one")).toBeTruthy();
    // A set is counted in people; answers are the other basis's unit and
    // saying them here would be a measurement this side never made.
    expect(screen.queryByText(/test answers/)).toBeNull();
  });

  it("counts only the people the DRAWN cards rest on (D244)", () => {
    // WAS A PINNED OVERSTATEMENT, now the fix. `peopleAxisMap`'s `people`
    // counts everyone who contributed an axis to ANY instrument, and the
    // lens printed it under cards that can rest on far fewer. The `cells`
    // basis refuses exactly this eight lines up in the panel, so the two
    // bases did not hold the same line.
    LIVE.myTestResults = () => stored({ big5: { O: 50, C: 50, E: 50 } });
    LIVE.scoresFor = (uid) => ({
      a: scored({ big5: { O: 50, C: 50, E: 50 } }),
      b: scored({ political: { econ: 50, auth: 50, foreign: 50 } }),
      c: scored({ political: { econ: 50, auth: 50, foreign: 50 } }),
    })[uid] || null;
    render(lens({ basis: "people", uids: ["a", "b", "c"] }));

    // One card, and its rose is one person: b and c have no Big Five, and
    // you have no Politics for theirs to be compared against.
    expect(cardOf("Big Five")).toBeTruthy();
    expect(screen.queryByText("Politics")).toBeNull();
    expect(screen.getByText(/1 of 3 have taken one/)).toBeTruthy();
    // The denominator is still the roster, so the two who are missing are
    // stated rather than dropped out of both numbers.
    expect(screen.queryByText(/1 of 1/)).toBeNull();
  });

  it("counts a person once when the cards span two instruments", () => {
    // The union, and the reason a sum of per-instrument counts is wrong:
    // `a` finished both, so two cards drawn off one person must not report
    // two people out of a roster of two.
    LIVE.myTestResults = () => stored({
      big5: { O: 50, C: 50, E: 50 },
      political: { econ: 50, auth: 50, foreign: 50 },
    });
    LIVE.scoresFor = (uid) => ({
      a: scored({
        big5: { O: 50, C: 50, E: 50 },
        political: { econ: 50, auth: 50, foreign: 50 },
      }),
    })[uid] || null;
    render(lens({ basis: "people", uids: ["a", "b"] }));

    expect(cardOf("Big Five")).toBeTruthy();
    expect(screen.getByText(/1 of 2 have taken one/)).toBeTruthy();
  });
});

// ── 6 · what a set costs to open ─────────────────────────────────────

describe("a set's profiles are asked for once", () => {
  const ROSTER = ["a", "b", "c"];

  it("does not re-ask when the host rebuilds the same roster", () => {
    // `LiveRoomTabs` maps this array out of `room.people` on every render
    // and re-renders on every store notify, which this panel does too.
    // Keyed on the array instead of on the uids, opening Compare in a busy
    // room would re-fetch every profile in it, over and over.
    const { rerender } = render(lens({ basis: "people", uids: ROSTER }));
    expect(LIVE.loadNames).toHaveBeenCalledTimes(1);
    expect(LIVE.loadNames).toHaveBeenCalledWith(ROSTER);

    rerender(lens({ basis: "people", uids: [...ROSTER] }));
    expect(LIVE.loadNames).toHaveBeenCalledTimes(1);

    // A different roster is a different question, and is asked.
    rerender(lens({ basis: "people", uids: ["a", "b", "d"] }));
    expect(LIVE.loadNames).toHaveBeenCalledTimes(2);
  });

  it("asks for nothing on an empty roster or a place", () => {
    // `"".split(",")` is `[""]` — an empty group would otherwise send the
    // store off after a profile with no uid. A place has no profiles at
    // all: its side is counts the stop already holds.
    render(lens({ basis: "people", uids: [] }));
    render(lens(place(() => null)));
    expect(LIVE.loadNames).not.toHaveBeenCalled();
  });
});

// ── the demo build ───────────────────────────────────────────────────

it("renders nothing at all where the store is off", () => {
  // Every reading on this panel is measured; with no store there is
  // nothing to measure, and the empty notes would tell a demo user that
  // their (populated) demo profile is blank.
  LIVE.enabled = false;
  LIVE.myTestResults = () => stored({ big5: { O: 50, C: 50, E: 50 } });
  const { container } = render(lens(place(() => null)));
  expect(container.firstChild).toBeNull();
});
