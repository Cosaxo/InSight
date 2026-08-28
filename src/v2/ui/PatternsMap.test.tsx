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
  drawnAxes: vi.fn((): Array<{ key: string; label: string; x: number; y: number; n: number; fit: number }> => []),
}));
vi.mock("../data/patterns", () => ({ default: PATTERNS, PATTERNS, drawnAxes: PATTERNS.drawnAxes }));

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
  PATTERNS.drawnAxes.mockReturnValue([]);
  LIVE.vote = vi.fn();
});
afterEach(cleanup);

describe("the trait axes (AXES-RUNBOOK 1.4)", () => {
  it("draws a published axis as a labelled diameter under the field", () => {
    PATTERNS.drawnAxes.mockReturnValue([
      { key: "big5.O", label: "Openness", x: 1, y: 0, n: 12, fit: 0.8 },
      { key: "big5.C", label: "Conscientiousness", x: 0, y: 1, n: 12, fit: 0.5 },
    ]);
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    expect(container.querySelectorAll(".qm-axes line").length).toBe(2);
    expect(screen.getByText("Openness")).toBeTruthy();
    expect(screen.getByText("Conscientiousness")).toBeTruthy();
  });

  it("draws NOTHING when no block has published — no teaser, no empty group (D1)", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    expect(container.querySelector(".qm-axes")).toBeNull();
  });
});

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
});
