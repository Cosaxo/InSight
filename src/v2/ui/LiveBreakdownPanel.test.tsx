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
//   - the names underneath must be the same population as the number
//     above them, or the sheet makes two claims about one cohort;
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
  // The roster rides inside this panel, so its store surface has to be here too.
  isFollowing: () => false,
  setFollowing: vi.fn(async () => {}),
  loadVoters: vi.fn(async (qid: string) => { void qid; }),
  votersByOption: (qid: string, n: number) => {
    void qid; void n;
    return null as Voter[][] | null;
  },
  votersLoading: (qid: string) => { void qid; return false as boolean; },
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
  LIVE.votersByOption = () => [[], [], []];
  LIVE.votersLoading = () => false;
  LIVE.loadVoters = vi.fn(async () => {});
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
    // The roster's sentence, and only it: nothing here can tell "nobody
    // answered" from "the fetch failed", and that panel can.
    expect(screen.getByText(/nobody has answered this yet/i)).toBeTruthy();
    // No cohort control and no split — not a row of 0% bars, which would
    // read as a measured unanimity.
    expect(screen.queryByRole("button", { name: "Everyone" })).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
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
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(1);
    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^55-64/));
    fireEvent.click(chip("Country"));
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(1);
  });
});

describe("LiveBreakdownPanel · the names match the number above them", () => {
  it("scopes the roster to the selected cohort", () => {
    LIVE.votersByOption = () => [
      [v({ uid: "a", name: "Ada", anchors: { ageBand: "25-34" } }),
        v({ uid: "c", name: "Cyd", anchors: { ageBand: "55-64" } })],
      [], [],
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    // Everyone: both names.
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("Cyd")).toBeTruthy();

    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^25-34/));
    expect(screen.getByText("Ada")).toBeTruthy();
    // Cyd is not 25-34 and must not appear under a heading that says so.
    expect(screen.queryByText("Cyd")).toBeNull();
    expect(screen.getByText(/who answered · 1 in 25-34/i)).toBeTruthy();
  });

  it("separates an empty cohort from an empty PAGE of the cohort", () => {
    // Two different sentences. The aggregate says 10 people aged 55-64
    // answered; the roster's bounded page happens to contain none of them.
    // Reporting that as "nobody" would contradict the count directly above.
    LIVE.votersByOption = () => [
      [v({ uid: "a", name: "Ada", anchors: { ageBand: "25-34" } })], [], [],
    ];
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Age"));
    fireEvent.click(chip(/^55-64/));
    expect(screen.getByText("10 answers")).toBeTruthy();
    expect(screen.getByText(/nobody in 55-64 is in the answers loaded here/i)).toBeTruthy();
  });

  it("marks the viewer's own cohort in the chip row", () => {
    LIVE.anchors = () => ({ ageBand: "55-64" });
    render(<LiveBreakdownPanel qid="q1" options={OPTS} />);
    fireEvent.click(chip("Age"));
    expect(chip(/^55-64 · 10 · you$/)).toBeTruthy();
    expect(chip(/^25-34 · 20$/)).toBeTruthy();
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
