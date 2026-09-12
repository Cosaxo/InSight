// @vitest-environment jsdom
//
// The reading a catalogue card did not have.
//
// Until 2026-09-11 a live pick card answered "who picked what" with D17's
// segment chips: one flat row of every published bucket of every dimension
// — "man", "190 cm or taller", "no", "asker, no", "25-34" — each one
// silently reordering the board, none of them naming its dimension, the
// raw storage keys at the reader, and no names anywhere. Every other live
// question had had D125's reading for a year: pick a cohort, and
// everything below is that cohort's reading of this one question.
//
// So these cases are about the same four properties LiveBreakdownPanel's
// are, held against a board instead of a set of options:
//
//   - "Everyone" is the default and is the card's own board, so the first
//     frame agrees with the card that opened it;
//   - a dimension draws its WHOLE scale (D304) — every canonical band in
//     vocabulary order, the empty ones as zeros, since D98 an absent cell
//     IS zero — and each row names that cohort's own leader, so the column
//     reads as where taste divides before anything is tapped;
//   - opening a row redraws the board for that cohort and says where they
//     part company with everyone — and says nothing of the sort about a
//     cohort that agrees;
//   - Friends is the cut that answers with people, which is the cut a
//     catalogue question could not draw at all while voters.ts dropped
//     catalogue answers.
//
// `../data/live` is mocked rather than booted (it imports Firebase); the
// arithmetic under these sentences is pinned in data/pickCohort.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Voter } from "../data/voters";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  budgetPaused: false as boolean,
  aggFor: (qid: string) => {
    void qid;
    return null as { counts?: Record<string, number>; total?: number; by?: unknown } | null;
  },
  pickCanon: (qid: string) => {
    void qid;
    return { top: [] as Array<{ entity: number; count: number }>, rest: 0, total: 0, restEntities: 0, restBelowFloor: false };
  },
  anchors: () => ({}) as Record<string, string>,
  subscribe: () => () => {},
  loadVoters: vi.fn(async (qid: string) => { void qid; }),
  voters: (qid: string) => { void qid; return null as Voter[] | null; },
  votersLoading: (qid: string) => { void qid; return false as boolean; },
  loadFollows: vi.fn(async () => {}),
  follows: () => null as string[] | null,
  followsLoading: () => false as boolean,
  // LiveBreakdownPanel is imported for its chip and its note, and it reads
  // these on the way past.
  voterScores: (qid: string) => { void qid; return null; },
  myTestResults: () => ({}) as Record<string, unknown>,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

import LivePickBreakdown from "./LivePickBreakdown";

const NAMES: Record<number, string> = { 132: "Ditto", 386: "Deoxys", 25: "Pikachu" };
const nameOf = (e: number) => NAMES[e] || "";

// Ditto leads overall. 25-34 lead with Deoxys — everyone's #3. Women lead
// with Ditto, which is everyone's #1: the cohort that agrees.
const BY = {
  ageBand: {
    "25-34": { "386": 4, "132": 1 },
    "35-44": { "132": 3 },
  },
  gender: { Woman: { "132": 5 } },
};
const TOP = [
  { entity: 132, count: 9 },
  { entity: 25, count: 5 },
  { entity: 386, count: 5 },
];

function board() {
  LIVE.aggFor = () => ({ total: 19, by: BY });
  LIVE.pickCanon = () => ({ top: TOP, rest: 5, total: 24, restEntities: 0, restBelowFloor: false });
}

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.budgetPaused = false;
  LIVE.anchors = () => ({});
  LIVE.follows = () => null;
  LIVE.voters = () => null;
  LIVE.votersLoading = () => false;
  LIVE.followsLoading = () => false;
  board();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const chip = (name: RegExp | string) => screen.getByRole("button", { name });
const rowOf = (label: RegExp) => screen.getByRole("button", { name: label });

describe("the board, as one cohort orders it", () => {
  it("opens on the card's own board, not on a cohort", () => {
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    expect(screen.getByText(/24 picks/)).toBeTruthy();
    // Your own standing, off the same board the card drew.
    expect(screen.getByText(/yours is #3/)).toBeTruthy();
    expect(screen.getByText("Ditto")).toBeTruthy();
    expect(screen.getByText("Deoxys")).toBeTruthy();
  });

  it("draws a dimension's whole scale in vocabulary order, zeros included", () => {
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    fireEvent.click(chip("Age"));
    const labels = screen.getAllByRole("button")
      .map((b) => b.textContent || "")
      .filter((t) => /^(Under 18|18-24|25-34|35-44|45-54|55-64|65\+)/.test(t));
    expect(labels.map((t) => t.split("·")[0].trim().split(/\s{2,}/)[0]).slice(0, 3).join("|"))
      .toMatch(/^Under 18/);
    // A band nobody answered from is a zero, not an absence (D98/D304) —
    // it is on screen and it cannot be opened.
    expect(rowOf(/^45-54/).hasAttribute("disabled")).toBe(true);
    // …and a band that HAS answers names its own leader on the closed row.
    expect(rowOf(/^25-34/).textContent).toMatch(/Deoxys/);
    expect(rowOf(/^35-44/).textContent).toMatch(/Ditto/);
  });

  it("redraws the board for the cohort you open, and says where they part company", () => {
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    fireEvent.click(chip("Age"));
    fireEvent.click(rowOf(/^25-34/));
    expect(screen.getByText(/put/).textContent).toMatch(/25-34 put Deoxys first — #3 for everyone\./);
    // The cohort's own board, not everyone's: Pikachu is on everyone's and
    // not on theirs.
    const open = screen.getByText(/#3 for everyone/).closest("div")?.parentElement as HTMLElement;
    expect(within(open).queryByText("Pikachu")).toBeNull();
  });

  it("says nothing about a cut that agrees with the room", () => {
    render(<LivePickBreakdown qid="pk01" mine={132} nameOf={nameOf} />);
    fireEvent.click(chip("Gender"));
    fireEvent.click(rowOf(/^Woman/));
    expect(screen.getByText(/the same as everyone/), "a cut that repeats the room claimed a finding")
      .toBeTruthy();
    expect(screen.queryByText(/for everyone\./)).toBeNull();
  });

  it("marks the reader's own cohort so a long scale is findable", () => {
    LIVE.anchors = () => ({ ageBand: "35-44" });
    render(<LivePickBreakdown qid="pk01" mine={132} nameOf={nameOf} />);
    fireEvent.click(chip("Age"));
    expect(rowOf(/^35-44 · you/)).toBeTruthy();
  });

  it("lands on the cut the card's own finding opened it at", () => {
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf}
      openAt={{ dim: "ageBand", bucket: "25-34" }} />);
    // Straight into the reading, no taps: the door said "25-34 put Deoxys
    // first", and a sheet that then opened on Everyone would make the
    // reader find it again. (The sentence is split by the <strong> around
    // the name, so it is read off the line rather than matched whole.)
    expect(screen.getByText(/put/).textContent).toMatch(/25-34 put Deoxys first — #3 for everyone\./);
  });
});

describe("Friends — the cut that answers with people (D98)", () => {
  const voters: Voter[] = [
    { uid: "u_me", optionIdx: -1, entity: 386, anchors: {}, name: "You", isMe: true },
    { uid: "u_a", optionIdx: -1, entity: 386, anchors: {}, name: "Alex", isMe: false },
    { uid: "u_b", optionIdx: -1, entity: 132, anchors: {}, name: "Bo", isMe: false },
  ];

  it("names who picked what, yours first", () => {
    LIVE.follows = () => ["u_a", "u_b"];
    LIVE.voters = () => voters;
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/1 of 2 friends picked yours/)).toBeTruthy();
    const rows = screen.getAllByText(/Alex|Bo/).map((n) => n.textContent);
    expect(rows, "the friend who agrees with you was not first").toEqual(["Alex", "Bo"]);
    expect(screen.getByText("Deoxys")).toBeTruthy();
    expect(screen.getByText("Ditto")).toBeTruthy();
  });

  it("tells the three empty states apart", () => {
    LIVE.follows = () => null;
    LIVE.votersLoading = () => true;
    const { rerender } = render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/Loading what your friends picked/)).toBeTruthy();

    LIVE.votersLoading = () => false;
    LIVE.budgetPaused = true;
    rerender(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    // Paused before failed (D332) — the fetch was refused, not attempted.
    expect(screen.queryByText(/Could not load/)).toBeNull();

    LIVE.budgetPaused = false;
    LIVE.follows = () => [];
    LIVE.voters = () => voters;
    rerender(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    expect(screen.getByText(/Follow someone from the Mirror/)).toBeTruthy();
  });

  it("keeps the sample's caveat: what this session read, not what exists", () => {
    LIVE.follows = () => ["u_z"];
    LIVE.voters = () => voters;
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    fireEvent.click(chip("Friends"));
    expect(screen.getByText(/None of the people you follow is in the 3 answers this session has read/))
      .toBeTruthy();
  });
});

describe("an unanswered question", () => {
  it("offers the two cuts that can still say something, and claims nothing", () => {
    LIVE.aggFor = () => null;
    LIVE.pickCanon = () => ({ top: [], rest: 0, total: 0, restEntities: 0, restBelowFloor: false });
    render(<LivePickBreakdown qid="pk01" nameOf={nameOf} />);
    expect(screen.getByText("Nobody has picked yet.")).toBeTruthy();
    expect(chip("Friends")).toBeTruthy();
  });

  it("does not say nobody picked over the reader's own pick", () => {
    // The seconds between your answer and the trigger folding it: the
    // aggregate is still empty and you are on the board above.
    LIVE.aggFor = () => null;
    LIVE.pickCanon = () => ({ top: [], rest: 0, total: 0, restEntities: 0, restBelowFloor: false });
    render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    expect(screen.getByText("Just you so far.")).toBeTruthy();
  });

  it("draws nothing at all in a demo build", () => {
    LIVE.enabled = false;
    const { container } = render(<LivePickBreakdown qid="pk01" mine={386} nameOf={nameOf} />);
    expect(container.innerHTML).toBe("");
  });
});
