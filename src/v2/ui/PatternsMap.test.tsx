// @vitest-environment jsdom
//
// The Map lens (D215), mounted over real geometry (the pure engine runs;
// only the stores are mocked): the field draws, the idle card leads with
// the strongest tie, a selection reads its own links — and every counted
// sentence states its basis (D146; the prototype counted an invented
// population and had no basis to state, so this is the port's own rule
// to hold).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PairSay, PoolItem } from "../data/patterns";

const PATTERNS = vi.hoisted(() => ({
  say: vi.fn(async (): Promise<PairSay | null> => null),
}));
vi.mock("../data/patterns", () => ({ default: PATTERNS, PATTERNS }));

const LIVE = vi.hoisted(() => ({ enabled: true, vote: vi.fn() }));
vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: PatternsMap } = await import("./PatternsMap");

const vec = (...head: number[]): number[] =>
  Array.from({ length: 8 }, (_, i) => head[i] ?? 0);

const item = (qid: string, L: number[], mine: number | null): PoolItem =>
  ({
    q: { id: qid, text: `Q ${qid}`, cat: "sport", options: [{ id: `${qid}:0`, label: `${qid}-yes` }, { id: `${qid}:1`, label: `${qid}-no` }] },
    L,
    n: 60,
    marginal: 0,
    mine,
  }) as unknown as PoolItem;

/** qa answered "yes", qb answered "no", qc open — one tight factor. */
const ITEMS = [
  item("qa", vec(1, 0), 1),
  item("qb", vec(0.9, 0.1), -1),
  item("qc", vec(0.8, -0.1), null),
];

const SAY: PairSay = {
  pick: "qa-yes", then: "qb-yes", pickIdx: 0, thenIdx: 0, pct: 78, base: 50, both: 40,
};


beforeEach(() => {
  PATTERNS.say.mockResolvedValue(SAY);
  LIVE.vote = vi.fn();
});
afterEach(cleanup);

describe("the field at rest", () => {
  it("draws every question and leads with the strongest tie, basis stated", async () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    expect(container.querySelectorAll("svg g g").length).toBe(ITEMS.length);
    expect(await screen.findByText("strongest tie")).toBeTruthy();
    expect(screen.getByText(/of the 40 in both samples/)).toBeTruthy();
    // the open question wears the next-up beacon
    expect(screen.getByText("answer next")).toBeTruthy();
  });
});

describe("the beacon (2026-08-26)", () => {
  it("is a tap target of its own — the map's one instruction opens the pick", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    const g = screen.getByText("answer next").closest("g")!;
    fireEvent.click(g.querySelector("circle")!); // the invisible hit circle
    expect(screen.getByText("Q qc")).toBeTruthy(); // the open question's card
    expect(screen.getByText("qc-yes")).toBeTruthy(); // with its options offered
    expect(container.querySelector(".qm-pulse")).toBeNull(); // and the beacon rests while selected
  });
});

describe("a selection", () => {
  it("reads the question's own links out loud and says when you broke one", async () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    // tap the first dot (qa) — its links load as exact sentences
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(screen.getByText("Q qa")).toBeTruthy();
    expect(screen.getByText(/you said qa-yes/)).toBeTruthy();
    const sentences = await screen.findAllByText(/pick/, { exact: false });
    expect(sentences.length).toBeGreaterThan(0);
    // the viewer picked qa-yes (the pattern's pick) but qb-no on the
    // linked question — the card owes them the break, by name
    expect((await screen.findAllByText(/you went qb-no/)).length).toBeGreaterThan(0);
    // and every counted sentence carries its basis
    expect((await screen.findAllByText(/of the 40 in both samples/)).length).toBeGreaterThan(0);
  });

  it("offers the options on an open question and votes through LIVE", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[2]!); // qc, open
    fireEvent.click(screen.getByText("qc-yes"));
    expect(LIVE.vote).toHaveBeenCalledWith("qc", "qc:0");
  });

  // WHAT THE EMPTY NOTE MAY CLAIM. `say` answers null for two facts about
  // the crowd — under the twelve-voter floor, and two questions that
  // simply do not predict each other, which is the ordinary one — and the
  // panel's own catch used to fold a REFUSED read into the same null. The
  // note named a sample size for all three, so it stated "not enough
  // people in both samples" over a hundred voters and over a read that
  // never happened. This line had no test at all.
  it("says nothing predicts strongly enough, rather than blaming the sample", async () => {
    PATTERNS.say.mockResolvedValue(null);
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(await screen.findByText(/predicts its neighbours strongly enough/)).toBeTruthy();
    expect(screen.queryByText(/enough people in both samples/)).toBeNull();
  });

  it("…and says the read refused when it did", async () => {
    PATTERNS.say.mockRejectedValue(new Error("permission-denied"));
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(await screen.findByText(/Couldn’t read the crowd/)).toBeTruthy();
    expect(screen.queryByText(/predicts its neighbours/)).toBeNull();
  });
});
