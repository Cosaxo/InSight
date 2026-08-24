// @vitest-environment jsdom
//
// The Oracle instrument's contract (D215), mounted — the states no store
// test can execute:
//
//   1. NO SEAL, NO TAP. The tiles are buttons only while a sealed record
//      exists behind them (patterns.test.ts pins the store half; this
//      pins the gate at the surface). A tap without a seal must not vote.
//   2. The reveal prints NO percentage — confidence is a height and a
//      position. The one number on the lens is a stated basis.
//   3. The done state offers no "Start over": a live answer cannot be
//      unanswered.
//
// `../data/live` and `../data/patterns` are mocked (the LiveCallCard
// idiom) — what this lens consumes is five members between them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { OracleRecord, PoolItem } from "../data/patterns";

const PATTERNS = vi.hoisted(() => ({
  nextAsk: vi.fn((): unknown => null),
  seal: vi.fn((): unknown => null),
  grade: vi.fn((): unknown => null),
  tell: vi.fn(async (): Promise<unknown> => null),
  meter: vi.fn(() => ({ records: [] as OracleRecord[], called: 0, avgBits: 0 })),
}));
vi.mock("../data/patterns", () => ({ default: PATTERNS, PATTERNS }));

const LIVE = vi.hoisted(() => ({ enabled: true, vote: vi.fn() }));
vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: PatternsOracle } = await import("./PatternsOracle");

const item = (qid: string, mine: number | null = null): PoolItem =>
  ({
    q: { id: qid, text: `Q ${qid}`, cat: "sport", options: [{ id: `${qid}:0`, label: `${qid}-yes` }, { id: `${qid}:1`, label: `${qid}-no` }] },
    L: [0.9, 0.05],
    n: 60,
    marginal: 0,
    mine,
  }) as unknown as PoolItem;

const QA = item("qa");
const SEALED: OracleRecord = { qid: "qa", p0: 0.82, pred: 0, at: 1 };
const GRADED: OracleRecord = { ...SEALED, mine: 1, bits: 2.47, ev: ["qb"] };


beforeEach(() => {
  localStorage.clear();
  PATTERNS.nextAsk.mockReturnValue(QA);
  PATTERNS.seal.mockReturnValue(SEALED);
  PATTERNS.grade.mockReturnValue(GRADED);
  PATTERNS.meter.mockReturnValue({ records: [], called: 0, avgBits: 0 });
  LIVE.vote = vi.fn();
});
afterEach(cleanup);

describe("the sealed instrument", () => {
  it("shows the sealed badge and votes through the ordinary path on a tap", () => {
    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    expect(screen.getByText("sealed")).toBeTruthy();
    expect(PATTERNS.seal).toHaveBeenCalledWith("qa");
    fireEvent.click(screen.getByText("qa-no"));
    expect(LIVE.vote).toHaveBeenCalledWith("qa", "qa:1");
    // the reveal: a Next button, fills on both tiles, and no percent sign
    expect(screen.getByText("Next")).toBeTruthy();
    expect(document.querySelectorAll(".or-fill").length).toBe(2);
    expect(document.body.textContent).not.toMatch(/\d%/);
  });

  it("fills the tile it actually called, not the other one", () => {
    // `conf = rec.pred === 0 ? rec.p0 : 1 - rec.p0` — p0 is P(option 0), so
    // predicting option 1 at p0 = 0.82 is 18% confident, not 82%. One
    // character, and it type-checks either way.
    //
    // REHOUSED from PatternsTab.test.tsx, where this was written against
    // the printed percentage. The 2026-08-20 redesign took the number off
    // the screen — the case above pins that there is no percent sign — but
    // it KEPT the branch and moved it to the fill's width, where the suite
    // counted the fills and never measured them. A flip now draws the
    // instrument almost full for a guess it was barely confident of.
    const pct = () => [...document.querySelectorAll<HTMLElement>(".or-fill")]
      .map((el) => el.style.getPropertyValue("--p"));

    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    fireEvent.click(screen.getByText("qa-no"));
    // GRADED calls option 0 at p0 = 0.82: tile 0 is the call, and it is the
    // one that fills.
    expect(pct(), "the Oracle filled the tile it did not call").toEqual(["82%", "18%"]);
  });

  it("refuses the tap when no seal exists — no guess, no vote", () => {
    PATTERNS.seal.mockReturnValue(null);
    render(<PatternsOracle items={[QA]} version={1} />);
    fireEvent.click(screen.getByText("qa-yes"));
    expect(LIVE.vote).not.toHaveBeenCalled();
  });
});

describe("the done states", () => {
  it("says why nothing is askable when the record is empty too", () => {
    PATTERNS.nextAsk.mockReturnValue(null);
    render(<PatternsOracle items={[item("qa", 1)]} version={1} />);
    expect(screen.getByText("Nothing left to guess")).toBeTruthy();
  });

  it("re-lays the record as the reading, with no Start over", () => {
    PATTERNS.nextAsk.mockReturnValue(null);
    PATTERNS.meter.mockReturnValue({
      records: [
        { qid: "qa", p0: 0.8, pred: 0, at: 1, mine: 1, bits: 2.3 },
        { qid: "qb", p0: 0.7, pred: 0, at: 2, mine: 0, bits: 0.5 },
      ],
      called: 1,
      avgBits: 1.4,
    });
    render(<PatternsOracle items={[item("qa", 1), item("qb", 1)]} version={1} />);
    expect(screen.getByText("biggest break")).toBeTruthy();
    expect(screen.getByText("Q qa")).toBeTruthy();
    expect(screen.queryByText("Start over")).toBeNull();
  });
});
