// @vitest-environment jsdom
//
// The reversal D125 is for. The sheet's job is not "who is in this crowd"
// — it is "what does this question look like from where someone else is
// standing", and until D125 nothing on the screen answered that: the
// breakdown drew every cohort as a bar in a chart of the crowd, and under
// it the roster listed each voter's age, gender and city beside their
// name. Both halves described the PEOPLE. Neither redrew the ANSWER.
//
// So these cases are about the direction of the reading:
//
//   - picking a cohort must change the numbers under it, to that cohort's
//     numbers, on the question's own options in the question's own order;
//   - "Everyone" is the default and is the plain published split, so the
//     first frame agrees with the card that opened it;
//   - D148 moved that third case. There used to be a ROSTER under every
//     cohort — each voter's name with their age, gender, city and
//     education beside it — and the case here held it to the same
//     population as the count above it. The roster is gone from cohorts
//     entirely, D146's type cut included: a directory of strangers
//     annotated with their demographics is not what a result screen is
//     for. Names now live on ONE cut, Friends, where "who" is the
//     question; the cases below hold that line in both directions;
//   - an empty cohort must read as zero and say so — since D98 an absent
//     cell IS zero, and the old "withheld" reading is gone with the floor.
//
// `../data/live` is mocked rather than booted: it imports Firebase, and
// the arithmetic these draw is unit-tested in data/cohort.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Voter } from "../data/voters";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  aggFor: (qid: string) => {
    void qid;
    return null as { counts?: Record<string, number>; total?: number; by?: unknown } | null;
  },
  anchors: () => ({}) as Record<string, string>,
  subscribe: () => () => {},
  // The Friends cut rides inside this panel (D148), so its store surface
  // is here too: the follow SET (one query) plus the voter list it
  // intersects — the same list D146's type fold already loads.
  loadVoters: vi.fn(async (qid: string) => { void qid; }),
  voters: (qid: string) => { void qid; return null as Voter[] | null; },
  votersLoading: (qid: string) => { void qid; return false as boolean; },
  loadFollows: vi.fn(async () => {}),
  follows: () => null as string[] | null,
  followsLoading: () => false as boolean,
  // The type cut (data/typeSplit.ts) and `typeMix.myType`, which reads the
  // viewer's own result off the store the same way.
  voterScores: (qid: string) => {
    void qid;
    return null as { uid: string; optionIdx: number; results: unknown }[] | null;
  },
  myTestResults: () => ({}) as Record<string, unknown>,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveBreakdownPanel } = await import("./LiveBreakdownPanel");

const OPTS = ["Beach", "City break", "Stay home"];

// 30 answers: 18/9/3 overall, and two age bands that disagree sharply —
// 25-34 lean Beach, 55-64 lean Stay home.
const AGG = {
  counts: { "0": 18, "1": 9, "2": 3 },
  total: 30,
  by: {
    ageBand: {
      "25-34": { "0": 15, "1": 4, "2": 1 },
      "55-64": { "0": 3, "1": 5, "2": 2 },
    },
    country: { NO: { "0": 12, "1": 6, "2": 2 } },
    // A bucket with a published key and no answers cannot occur in a fold,
    // but a bucket whose people are all outside the loaded voter page can
    // — see the roster case below.
  },
};

const v = (over: Partial<Voter> = {}): Voter => ({
  uid: "u1", optionIdx: 0, anchors: {}, name: "", isMe: false, ...over,
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.aggFor = () => AGG;
  LIVE.anchors = () => ({});
  LIVE.voters = () => [];
  LIVE.votersLoading = () => false;
  LIVE.loadVoters = vi.fn(async () => {});
  LIVE.follows = () => [];
  LIVE.followsLoading = () => false;
  LIVE.loadFollows = vi.fn(async () => {});
  LIVE.voterScores = () => null;
  LIVE.myTestResults = () => ({});
});
afterEach(cleanup);

// Chips are buttons; several of their labels also appear in the header or
// the copy below, so they are addressed by role rather than by text.
const chip = (name: string | RegExp) => screen.getByRole("button", { name });

const pctRow = (label: string) => {
  const row = screen.getByText(label).closest("div")?.parentElement;
  return row?.textContent || "";
};

describe("LiveBreakdownPanel · the split is drawn FOR a cohort", () => {
  it("opens on Everyone, showing the question's own published split", () => {
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(chip("Everyone").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("30 answers")).toBeTruthy();
    // 18/9/3 of 30 → 60/30/10.
    expect(pctRow("Beach")).toMatch(/60%/);
    expect(pctRow("City break")).toMatch(/30%/);
    expect(pctRow("Stay home")).toMatch(/10%/);
  });

  it("picking a cohort redraws the SAME options with THAT cohort's numbers", () => {
    // The whole point. Before D125 this tap changed which rows of a
    // crowd-chart were highlighted; the answer itself never moved.
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^25-34 · 20/));
    // 15/4/1 of 20 → 75/20/5.
    expect(pctRow("Beach")).toMatch(/75%/);
    expect(pctRow("City break")).toMatch(/20%/);
    expect(pctRow("Stay home")).toMatch(/5%/);

    fireEvent.click(chip(/^55-64 · 10/));
    // 3/5/2 of 10 → 30/50/20. A different crowd, a different answer.
    expect(pctRow("Beach")).toMatch(/30%/);
    expect(pctRow("City break")).toMatch(/50%/);
    expect(pctRow("Stay home")).toMatch(/20%/);
  });

  it("keeps every option, in the question's order, at every cohort", () => {
    // A cohort that picked nothing on an option must still show the option
    // at 0% — dropping it would make the sheet's answer a different
    // question from the card's.
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Age"));
    const labels = screen.getAllByText(/Beach|City break|Stay home/)
      .map((el) => el.textContent);
    expect(labels.slice(0, 3)).toEqual(OPTS);
  });

  it("names where the cohort parts company with everyone", () => {
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^55-64 · 10/));
    // Beach: 30% here against 60% overall — a 30-point gap, downward.
    expect(screen.getByText(/55-64 are/)).toBeTruthy();
    expect(screen.getByText(/30 points/)).toBeTruthy();
    expect(screen.getByText(/less likely to say Beach/)).toBeTruthy();
  });

  it("marks the viewer's own pick without changing the arithmetic", () => {
    render(<LiveBreakdownPanel qid="q1" options={OPTS} mine={1} />);
    expect(pctRow("City break")).toMatch(/· you/);
    expect(pctRow("City break")).toMatch(/30%/);
  });
});

describe("LiveBreakdownPanel · what it will not claim", () => {
  it("offers only the dimensions the server actually published", () => {
    // A chip for a dim with no cells opens onto an empty screen and reads
    // as a broken app rather than as "nobody who answered filled that in".
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(chip("Age")).toBeTruthy();
    expect(chip("Country")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Education" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Relationship" })).toBeNull();
  });

  it("resolves a bucket KEY to a name — a country chip is not an ISO code", () => {
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Country"));
    expect(chip(/^Norway · 20/)).toBeTruthy();
  });

  it("says nobody has answered rather than drawing a split of nothing", () => {
    LIVE.aggFor = () => ({ counts: {}, total: 0 });
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(screen.getByText(/nobody has answered this yet/i)).toBeTruthy();
    // No split — not a row of 0% bars, which would read as a measured
    // unanimity — and no demographic chips, because there is nothing to
    // slice. Friends survives: a friend can answer a second after you do,
    // and the chip is how you go and look (D148).
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByRole("button", { name: "Age" })).toBeNull();
    expect(chip("Friends")).toBeTruthy();
  });

  it("renders nothing at all in demo mode", () => {
    // There is no real crowd to slice, and slicing the sample people would
    // be the D1 fabrication wearing a live badge.
    LIVE.enabled = false;
    const { container } = render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(container.textContent).toBe("");
  });

  it("costs no reads to change cohort", () => {
    // Every cohort comes out of the aggregate already fetched for the
    // card. The roster's one fetch-on-open is the sheet's entire cost, and
    // switching cohorts must not add to it.
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(0);
    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^55-64/));
    fireEvent.click(chip("Country"));
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(0);
  });
});

describe("LiveBreakdownPanel · a cohort answers in percentages (D148)", () => {
  it("names nobody under Everyone, or under any demographic cut", () => {
    // The D148 line, in the direction that matters. Everyone and every
    // demographic cut are readings of a crowd; a list of that crowd's
    // members, annotated with their age and city, is a different screen
    // and was never the one anyone opened a result to see.
    LIVE.voters = () => [
      v({ uid: "a", name: "Ada", anchors: { ageBand: "25-34" } }),
      v({ uid: "c", name: "Cyd", anchors: { ageBand: "55-64" } }),
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(screen.queryByText("Ada")).toBeNull();
    expect(screen.queryByText("Cyd")).toBeNull();

    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^25-34/));
    expect(screen.queryByText("Ada")).toBeNull();
    expect(screen.queryByText("Cyd")).toBeNull();
    // What it says instead is the cohort's own split.
    expect(pctRow("Beach")).toMatch(/75%/);
  });

  it("marks the viewer's own cohort in the chip row", () => {
    LIVE.anchors = () => ({ ageBand: "55-64" });
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Age"));
    expect(chip(/^55-64 · 10 · you$/)).toBeTruthy();
    expect(chip(/^25-34 · 20$/)).toBeTruthy();
  });
});

// ── the one cut that answers with people (D148) ──────────────────────
describe("LiveBreakdownPanel · the Friends cut", () => {
  const FRIENDS = ["f1", "f2", "f3"];

  it("leads the chip row", () => {
    // First, where the prototype has always put it: of every cut here it
    // is the only one whose answer is people, and it is the one a reader
    // reaches for before "how did 25-34 vote".
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    const chips = screen.getAllByRole("button").map((b) => b.textContent);
    expect(chips[0]).toBe("Friends");
    expect(chips[1]).toBe("Everyone");
  });

  it("names the friends who answered, with the side each picked", () => {
    LIVE.follows = () => FRIENDS;
    LIVE.voters = () => [
      v({ uid: "f1", name: "Ada", optionIdx: 0 }),
      v({ uid: "f2", name: "Bo", optionIdx: 1 }),
      v({ uid: "zz", name: "Stranger", optionIdx: 0 }),
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} mine={0} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("Bo")).toBeTruthy();
    // Only people you follow. A stranger on the same question belongs to
    // the percentages, not to this list.
    expect(screen.queryByText("Stranger")).toBeNull();
    // Ada picked what you picked; Bo did not.
    expect(screen.getByText(/1 of 2 friends are on your side/)).toBeTruthy();
  });

  it("counts only the friends who have actually answered", () => {
    // "4 of 6" has to mean four of the six who answered. Counting silent
    // friends into the denominator would report a majority against you
    // that nobody voted for.
    LIVE.follows = () => FRIENDS;
    LIVE.voters = () => [v({ uid: "f1", name: "Ada", optionIdx: 0 })];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} mine={0} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/1 of 1 friend is on your side/)).toBeTruthy();
    expect(screen.queryByText(/of 3/)).toBeNull();
  });

  it("does not claim a side before you have one", () => {
    LIVE.follows = () => FRIENDS;
    LIVE.voters = () => [v({ uid: "f1", name: "Ada", optionIdx: 0 })];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/how your friend answered/i)).toBeTruthy();
    expect(screen.queryByText(/on your side/)).toBeNull();
  });

  it("separates 'you follow nobody' from 'they have not answered'", () => {
    LIVE.follows = () => [];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/have not followed anyone yet/i)).toBeTruthy();

    cleanup();
    LIVE.follows = () => FRIENDS;
    LIVE.voters = () => [v({ uid: "zz", name: "Stranger", optionIdx: 0 })];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/none of the people you follow has answered/i)).toBeTruthy();
  });

  it("keeps 'could not ask' apart from 'nobody', like every other read here", () => {
    // The store leaves the key absent on a failed fetch rather than
    // caching an empty list, and this cut has to render that difference —
    // freezing a failure into "you follow nobody" is the same class of lie
    // the old floor's silent gaps were.
    LIVE.follows = () => null;
    LIVE.followsLoading = () => true;
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/loading how your friends answered/i)).toBeTruthy();

    cleanup();
    LIVE.followsLoading = () => false;
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/could not load how your friends answered/i)).toBeTruthy();
  });

  it("pays for the graph only when the cut is opened", () => {
    // The follow SET is one query and the voter list is one more; neither
    // is worth paying for on a sheet opened to read a percentage.
    LIVE.follows = () => FRIENDS;
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(LIVE.loadFollows).toHaveBeenCalledTimes(0);
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(0);
    fireEvent.click(chip("Friends"));
    expect(LIVE.loadFollows).toHaveBeenCalledTimes(1);
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(1);
  });
});

describe("LiveBreakdownPanel · continuum forms bring their own body", () => {
  it("hands the body this cohort's counts and everyone's, and drops the generic line", () => {
    // A dial's result is a POSITION on a range, and "55-64 are 30 points
    // more likely to say 57-61 yrs" is a true sentence about a histogram
    // bucket and a useless one about a range. So a custom body owns its
    // own comparison and the panel's stays out of its way.
    const seen: Array<{ counts: number[]; label: string; overall: number[] }> = [];
    render(
      <LiveBreakdownPanel
        qid="q1"
        options={OPTS}
        renderBody={(counts, pick, overall) => {
          seen.push({ counts, label: pick.label, overall });
          return <div>body for {pick.label}</div>;
        }}
      />,
    );
    expect(screen.getByText(/body for Everyone/)).toBeTruthy();
    expect(seen[0]).toEqual({ counts: [18, 9, 3], label: "Everyone", overall: [18, 9, 3] });

    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^55-64/));
    expect(screen.getByText(/body for 55-64/)).toBeTruthy();
    expect(seen[seen.length - 1]).toEqual({
      counts: [3, 5, 2], label: "55-64", overall: [18, 9, 3],
    });
    expect(screen.queryByText(/points/)).toBeNull();
  });
});

// ── the type cut ────────────────────────────────────────────────────
//
// The one cut on this sheet that is NOT a published cell. It folds the
// session's cached voter list against those voters' current profile
// scores (data/typeSplit.ts), which buys the reading the anchors snapshot
// could never give — a type applies to answers given before the person
// was typed — at the cost of being a bounded sample sitting beside exact
// numbers. These cases are about that seam: the cut works, and it never
// passes itself off as the census next to it.

/** A voter row carrying a real Big Five, as `LIVE.voterScores` returns them. */
const scored = (uid: string, optionIdx: number, dims: Record<string, number> | null) => ({
  uid,
  optionIdx,
  results: dims ? { big5: dims } : null,
});

const QUIET = { O: 72, C: 55, E: 15, A: 58, N: 50 };
const LOUD = { O: 60, C: 32, E: 90, A: 58, N: 45 };

/** n typed voters of one profile, all on one option. */
const scoredMany = (tag: string, optionIdx: number, dims: Record<string, number>, n: number) =>
  Array.from({ length: n }, (_, i) => scored(`${tag}${i}`, optionIdx, dims));

describe("LiveBreakdownPanel · the type cut", () => {
  it("offers a Type chip after the published dims", () => {
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    expect(chip("Type")).toBeTruthy();
    // Everyone stays the default; adding a cut must not move the landing.
    expect(chip("Everyone").getAttribute("aria-pressed")).toBe("true");
  });

  it("asks for the voter list when opened, so it cannot wait on a hidden roster", () => {
    // Both empty states render INSTEAD of the roster, and the roster is
    // what fetches — so without this the cut would sit on "Reading who
    // answered…" forever.
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(LIVE.loadVoters).toHaveBeenCalledWith("q1");
  });

  it("says it is still reading rather than claiming nobody is typed", () => {
    LIVE.voterScores = () => null;
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(screen.getByText(/Reading who answered/)).toBeTruthy();
  });

  it("distinguishes 'nobody has a result' from 'still loading'", () => {
    LIVE.voterScores = () => [scored("a", 0, null), scored("b", 1, null)];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(screen.queryByText(/Reading who answered/)).toBeNull();
    expect(screen.getByText(/Nobody among the 2 answers here has a readable Big Five/)).toBeTruthy();
  });

  it("redraws the question's own options with that type's numbers", () => {
    // 60 typed voters, so shares are allowed. Counts are deliberately
    // UNEQUAL (40 against 20): on a tie the chips fall back to
    // alphabetical order, which would make "the first chip" depend on
    // archetype names rather than on the fixture.
    LIVE.voterScores = () => [
      ...scoredMany("q", 0, QUIET, 40),
      ...scoredMany("l", 1, LOUD, 10),
      ...scoredMany("m", 2, LOUD, 10),
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    // The most numerous type opens by default.
    expect(chip(/· 40$/).getAttribute("aria-pressed")).toBe("true");
    expect(pctRow("Beach")).toMatch(/100%/);
    expect(pctRow("City break")).toMatch(/0%/);
  });

  it("switching type switches the numbers, on the same options", () => {
    LIVE.voterScores = () => [
      ...scoredMany("q", 0, QUIET, 40),
      ...scoredMany("l", 1, LOUD, 20),
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(pctRow("Beach")).toMatch(/100%/);
    // Addressed by its count rather than its name: the archetype the
    // fixture matches is the matcher's business, not this test's.
    fireEvent.click(chip(/· 20$/));
    expect(pctRow("City break")).toMatch(/100%/);
    expect(pctRow("Beach")).toMatch(/0%/);
  });

  it("states its basis every time, and names both denominators", () => {
    LIVE.voterScores = () => [
      ...scoredMany("q", 0, QUIET, 60),
      ...Array.from({ length: 5 }, (_, i) => scored(`x${i}`, 1, null)),
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    // 65 read, 60 of them typed — the gap is the honesty of the card and
    // the two numbers are never blurred into one.
    expect(screen.getByText(/Of the 65 answers this session has read, 60 carry a Big Five/)).toBeTruthy();
  });

  it("says out loud that it counts answers given before the person was typed", () => {
    // The property that made this cut worth building instead of the
    // forward-only breakdown dim. If the UI stops saying it, a reader has
    // no way to tell this cut from one that started accruing at ship date.
    LIVE.voterScores = () => scoredMany("q", 0, QUIET, 60);
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(screen.getByText(/counts answers given before they were typed/)).toBeTruthy();
  });

  it("shows counts, not shares, when the typed sample is too thin", () => {
    // 10 typed people cannot carry a percentage: one of them changing
    // their mind moves it ten points.
    LIVE.voterScores = () => scoredMany("q", 0, QUIET, 10);
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(screen.getByText(/Too few for shares, so these are counts/)).toBeTruthy();
    expect(pctRow("Beach")).toMatch(/10/);
    expect(pctRow("Beach")).not.toMatch(/%/);
  });

  it("compares a type against the TYPED sample, not against the published census", () => {
    // The arithmetic trap. Overall here is 60/30/10 published; the typed
    // sample is 30 Beach / 30 City break = 50/50. QUIET is 100% Beach, so
    // the honest gap is 50 points against the typed sample — not 40
    // against the census, which would fold the sample's own bias into a
    // number presented as the type's.
    LIVE.voterScores = () => [
      ...scoredMany("q", 0, QUIET, 30),
      ...scoredMany("l", 1, LOUD, 30),
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    expect(screen.getByText(/50 points/)).toBeTruthy();
    expect(screen.getByText(/than the typed people here/)).toBeTruthy();
  });

  it("does not hand a bounded sample to a continuum body", () => {
    // A dial's track reads as the population's position. renderBody is
    // fed published cells only; the type cut draws the plain rows.
    LIVE.voterScores = () => scoredMany("q", 0, QUIET, 60);
    render(
      <LiveBreakdownPanel
        qid="q1"
        options={OPTS}
        renderBody={(counts, pick) => <div>body for {pick.label} {counts.join("/")}</div>}
      />,
    );
    fireEvent.click(chip("Type"));
    expect(screen.queryByText(/^body for/)).toBeNull();
  });

  it("leaves the published cuts exactly as they were", () => {
    // The regression that matters most: a new chip must not disturb the
    // census readings beside it.
    LIVE.voterScores = () => scoredMany("q", 0, QUIET, 60);
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Type"));
    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^25-34 · 20/));
    expect(pctRow("Beach")).toMatch(/75%/);
    expect(screen.queryByText(/carry a Big Five/)).toBeNull();
  });
});
