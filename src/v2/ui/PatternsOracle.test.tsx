// @vitest-environment jsdom
//
// The Oracle instrument's contract (D215, redrawn 2026-09-02), mounted —
// the states no store test can execute:
//
//   1. NO SEAL, NO TAP. A half takes a tap only while a sealed record
//      exists behind it (patterns.test.ts pins the store half; this pins
//      the gate at the surface). A tap without a seal must not vote.
//   2. The reveal prints NO percentage — confidence is the fill's height,
//      the disc's size and one WORD. The one number on the lens is a
//      stated basis.
//   3. The sealed disc leaks nothing: it is drawn identically whichever
//      side the guess called.
//   4. The done state offers no "Start over": a live answer cannot be
//      unanswered.
//
// `../data/live` and `../data/patterns` are mocked (the LiveCallCard
// idiom) — what this lens consumes is five members between them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OracleRecord, PoolItem } from "../data/patterns";

const PATTERNS = vi.hoisted(() => ({
  nextAsk: vi.fn((): unknown => null),
  seal: vi.fn((): unknown => null),
  grade: vi.fn((): unknown => null),
  tell: vi.fn(async (): Promise<unknown> => null),
  working: vi.fn(async (): Promise<unknown> => null),
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
  it("states the seal and votes through the ordinary path on a tap", () => {
    // the *sealed* chip retired with the captions (2026-09-06) — the
    // field's accessible name is where the state is still SAID, and the
    // pulsing disc is where it is shown
    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    expect(screen.getByLabelText(/sealed — pick a side/)).toBeTruthy();
    expect(PATTERNS.seal).toHaveBeenCalledWith("qa");
    fireEvent.click(screen.getByText("qa-no"));
    expect(LIVE.vote).toHaveBeenCalledWith("qa", "qa:1");
    // the reveal: a Next control, the called half filling, the verdict in
    // words — and no percent sign anywhere
    expect(screen.getByText(/Next/)).toBeTruthy();
    expect(document.querySelectorAll(".or2-fill").length).toBe(1);
    expect(screen.getByText(/It called/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d%/);
  });

  it("speaks its options in their real words — no caps, no caption under them", () => {
    // the halves carry the bank's own labels in the serif (2026-09-06);
    // *tap to pick*, *SEALED GUESS* and the confidence word are gone, and
    // the kicker counts the pool instead of numbering the session
    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    expect(screen.getByText("qa-yes")).toBeTruthy();
    expect(screen.queryByText("tap to pick")).toBeNull();
    expect(screen.queryByText(/SEALED GUESS/)).toBeNull();
    expect(screen.getByText("1 of 2")).toBeTruthy();
  });

  it("fills to the confidence of the side it actually called", () => {
    // `conf = rec.pred === 0 ? rec.p0 : 1 - rec.p0` — p0 is P(option 0), so
    // predicting option 1 at p0 = 0.82 is 18% confident, not 82%. One
    // character, and it type-checks either way.
    //
    // The fill is a half-disc clipped at a water line, so the confidence is
    // that line's height: y0 = 280 − conf × 280. Measuring the PATH is the
    // point — the 2026-08-20 suite counted fills and never measured them,
    // and a flip draws the instrument almost full for a guess it was
    // barely confident of.
    const waterLine = () => {
      const d = document.querySelector(".or2-fill")!.getAttribute("d")!;
      return Number(/^M \d+(?:\.\d+)? (\d+(?:\.\d+)?)/.exec(d)![1]);
    };
    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    fireEvent.click(screen.getByText("qa-no"));
    // GRADED calls option 0 at p0 = 0.82 — 82% up the field, not 18%
    expect(waterLine(), "the Oracle filled to the confidence it did not have")
      .toBeCloseTo(280 - 0.82 * 280, 1);
    // and the fill is the CALLED half: its arc sweeps left of the seam
    expect(document.querySelector(".or2-fill")!.getAttribute("d")).toMatch(/A 140 140 0 0 0/);
  });

  it("seals without leaking the side — the disc is identical either way", () => {
    const disc = () => document.querySelector(".or2-disc")!.outerHTML;
    render(<PatternsOracle items={[QA]} version={1} />);
    const calledZero = disc();
    cleanup();
    PATTERNS.seal.mockReturnValue({ qid: "qa", p0: 0.18, pred: 1, at: 1 });
    render(<PatternsOracle items={[QA]} version={1} />);
    // p0 flips with the call, so confidence — and every drawn property of
    // the disc — is the same; only the side differs, and the side is sealed
    expect(disc()).toBe(calledZero);
  });

  it("refuses the tap when no seal exists — no guess, no vote", () => {
    PATTERNS.seal.mockReturnValue(null);
    render(<PatternsOracle items={[QA]} version={1} />);
    fireEvent.click(screen.getByText("qa-yes"));
    expect(LIVE.vote).not.toHaveBeenCalled();
  });
});

describe("the working (2026-08-26)", () => {
  // WAITS FOR THE WORKING, NOT FOR THE PANEL. This returned as soon as the
  // "its working" heading appeared — which is the panel OPENING, and the
  // rows arrive later, when PATTERNS.working's promise resolves. Every
  // case below then read its content synchronously, so the whole block
  // was one scheduling delay away from red: it cost a full-suite failure
  // on 2026-09-05 ("Unable to find an element with the text: qb-no") that
  // did not reproduce alone or on a re-run, which is the worst shape a
  // test failure comes in.
  //
  // The panel states which of the two it is in — "Reading the crowd…" —
  // so that is what to wait on, and it is a fact about the component
  // rather than a sleep.
  const openWhy = async () => {
    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    fireEvent.click(screen.getByText("qa-no"));
    fireEvent.click(screen.getByLabelText(/Why it called/));
    const head = await screen.findByText("its working");
    await waitFor(() => expect(screen.queryByText("Reading the crowd…")).toBeNull());
    return head;
  };

  it("rebuilds the call as rows — the answer, the split, the stated basis", async () => {
    PATTERNS.working.mockResolvedValue({
      rows: [{ evId: "qb", side: 1, share: 0.81, n: 26, w: 0.4 }],
      hadEv: true,
    });
    await openWhy();
    expect(PATTERNS.working).toHaveBeenCalledWith("qa");
    // the row: your answer on the evidence question, the crowd word for
    // its split, and the D146 basis — a count, never a percent
    expect(screen.getByText("qb-no")).toBeTruthy();
    expect(screen.getByText(/nearly always\s+pick/)).toBeTruthy();
    expect(screen.getByText(/26 in both samples/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d%/);
    // the standing basis line under every working
    expect(screen.getByText(/sealed before your tap/)).toBeTruthy();
  });

  it("a call carried by nothing says so, in the crowd's-own-lean words", async () => {
    PATTERNS.working.mockResolvedValue({ rows: [], hadEv: false });
    await openWhy();
    expect(screen.getByText(/the call is the crowd’s own lean/)).toBeTruthy();
  });

  it("thin evidence is named as thinness, never dressed as absence", async () => {
    PATTERNS.working.mockResolvedValue({ rows: [], hadEv: true, thin: true, weak: false, failed: false });
    await openWhy();
    expect(screen.getByText(/under 12 in both samples/)).toBeTruthy();
    expect(screen.queryByText(/crowd’s own lean/)).toBeNull();
  });

  // …AND THE TWO IT USED TO CALL THINNESS.
  //
  // An answer drops out of the working for three reasons and only one is
  // a sample size: the crossing is under the 12-voter floor, the crossing
  // is well sampled but does not lean past 0.54, or the voter-picks read
  // rejected. The panel printed "under 12 in both samples" for all three,
  // so a crossing of forty people split down the middle was reported as
  // too small to count, and so was a read that never happened.
  it("a well-sampled crossing that simply did not lean is not called thin", async () => {
    PATTERNS.working.mockResolvedValue({ rows: [], hadEv: true, thin: false, weak: true, failed: false });
    await openWhy();
    expect(screen.getByText(/leaned far enough/)).toBeTruthy();
    expect(screen.queryByText(/under 12 in both samples/)).toBeNull();
  });

  it("a read that refused says so, rather than blaming the sample", async () => {
    PATTERNS.working.mockResolvedValue({ rows: [], hadEv: true, thin: false, weak: false, failed: true });
    await openWhy();
    expect(screen.getByText(/Couldn’t read the crowd/)).toBeTruthy();
    expect(screen.queryByText(/under 12 in both samples/)).toBeNull();
  });

  it("…and the whole call rejecting is the same sentence", async () => {
    PATTERNS.working.mockRejectedValue(new Error("permission-denied"));
    await openWhy();
    expect(screen.getByText(/Couldn’t read the crowd/)).toBeTruthy();
  });

  it("does not read the rows while the panel is still reading the crowd", async () => {
    // The race the helper above exists for, made deterministic: a read
    // that resolves a tick late instead of immediately. Waiting on the
    // heading alone hands control back with "Reading the crowd…" still on
    // screen and no rows, which is exactly the intermittent failure this
    // block produced under load. Asserted as the pending state being GONE
    // rather than as the row being present, so it fails for the timing and
    // not for the content.
    let release = () => {};
    PATTERNS.working.mockReturnValue(new Promise((res) => {
      release = () => res({ rows: [{ evId: "qb", side: 1, share: 0.81, n: 26, w: 0.4 }], hadEv: true });
    }));
    const opening = openWhy();
    await screen.findByText("Reading the crowd…");
    release();
    await opening;
    expect(screen.queryByText("Reading the crowd…")).toBeNull();
    expect(screen.getByText("qb-no")).toBeTruthy();
  });

  it("the record counts always; its key waits behind the guide ⓘ", () => {
    PATTERNS.meter.mockReturnValue({
      records: [{ qid: "qb", p0: 0.7, pred: 0, at: 1, mine: 1, bits: 1.2 }],
      called: 0,
      avgBits: 1.2,
    });
    // the kicker's key (2026-09-02's standing sentence) moved behind the
    // tab's ⓘ with the other explainers (2026-09-06) — the counts, which
    // are claims about the record, stay standing
    const { rerender } = render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    expect(screen.getByText(/1 answer\b/)).toBeTruthy();
    expect(screen.queryByText(/up = you broke it/)).toBeNull();
    rerender(<PatternsOracle items={[QA, item("qb", 1)]} version={1} guide={true} />);
    expect(screen.getByText(/up = you broke it, tick = it had you/)).toBeTruthy();
  });

  it("teaches the game only when asked — the 1·2·3 strip rides the guide", () => {
    const { rerender } = render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    expect(screen.queryByText(/it guesses, sealed/)).toBeNull();
    rerender(<PatternsOracle items={[QA, item("qb", 1)]} version={1} guide={true} />);
    expect(screen.getByText(/it guesses, sealed/)).toBeTruthy();
    expect(screen.getByText(/did it have you\?/)).toBeTruthy();
    // …and after the tap the strip yields to the verdict, guide or not
    fireEvent.click(screen.getByText("qa-no"));
    expect(screen.queryByText(/it guesses, sealed/)).toBeNull();
    expect(screen.getByText(/It called/)).toBeTruthy();
  });

  it("keeps no device state of its own — the retired hints wrote a key", () => {
    // `insight.oracle.hints.v1` went with the redesign, and check:purge's
    // subject set is derived from the files that write such a key: this
    // asserts the lens stopped being one of them.
    render(<PatternsOracle items={[QA, item("qb", 1)]} version={1} />);
    fireEvent.click(screen.getByText("qa-no"));
    expect(Object.keys(localStorage)).toHaveLength(0);
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
