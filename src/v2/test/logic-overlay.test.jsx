// @vitest-environment jsdom
//
// The Logic overlay's behaviour on the OMIB bank (D451, D453) — the layer
// between omib-shapes (unit-tested) and the smoke suite (mounts only):
// building a cell, committing it, the clock, both round trips, and the
// result screen's five lenses.
//
// Rendered DIRECTLY (window.LogicOverlay after importing the module), not
// through the full App: there is no ErrorBoundary here, so a crash in any
// lens fails the case instead of tripping a boundary this file would then
// have to assert around.
//
// The wire is mocked wholesale: these tests own the overlay's state machine,
// not the callables — those are pinned in functions/src/logic.test.ts,
// logic-submit.test.ts and the emulator leg. What the mocks return is what
// the server returns: codes with the ninth cell empty on start; marks, θ,
// SE, percentile, band, source and the form's difficulties on submit.
// Timers are fake; the commit delay (520ms) is advanced explicitly, which is
// what makes the saved per-puzzle times assertable to the millisecond.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LKEY } from "../data/logic-score";
import { cellOf, ELEMENTS } from "../data/omib-shapes";
vi.mock("../data/logic-verify", () => ({
  startPractice: vi.fn(),
  submitPractice: vi.fn(),
  startVerified: vi.fn(),
  submitVerified: vi.fn(),
  verifyErrorMessage: (e) => (e && e.message) || "err",
}));
import { startPractice, submitPractice, startVerified, submitVerified } from "../data/logic-verify";
import "../spec/logic-test.jsx";

const COMMIT_DELAY = 520; // logic-test.jsx's reveal delay, pinned by the timing case
const ITEM_CAP = 90000;
const N = 25;
const EMPTY = cellOf([]);

let LogicOverlay;
beforeAll(() => {
  LogicOverlay = window.LogicOverlay;
  expect(typeof LogicOverlay).toBe("function");
});

afterEach(() => {
  cleanup();
  localStorage.removeItem(LKEY);
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// A served form: 25 codes, eight visible cells each and the ninth empty —
// what logicStartV2 / logicPracticeV2 hand out. The visible cells cycle the
// twenty shapes so every one is drawn somewhere.
const codes = () =>
  Array.from({ length: N }, (_, i) => ({
    code: [...Array.from({ length: 8 }, (_, c) => cellOf([(i + c) % ELEMENTS])), EMPTY].join(","),
  }));
const diffs = () => Array.from({ length: N }, (_, i) => -2 + (i * 4) / (N - 1));
const score = (over = {}) => ({
  marks: Array.from({ length: N }, () => true), score: N, theta: 1.8, se: 0.36,
  pctile: 96, band: [93, 98], source: "model", seed: 7, gv: 1, bank: "omib", diffs: diffs(), ...over,
});
const savedOmib = (over = {}) => ({
  v: 3, bank: "omib", seed: 7, gv: 1,
  marks: Array.from({ length: N }, (_, i) => i % 3 !== 0),
  times: Array.from({ length: N }, () => 1500), diffs: diffs(),
  theta: 0.4, se: 0.35, pctile: 66, band: [52, 77], source: "model", when: 1, ...over,
});

const tile = (name) => screen.getByRole("button", { name });
const done = () => {
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  act(() => { vi.advanceTimersByTime(COMMIT_DELAY); });
};

describe("the worked example (visual request 8)", () => {
  it("opens on a first visit: a solved grid, the resting palette, Start, and no clock", () => {
    render(<LogicOverlay onClose={() => {}} />);
    screen.getByText(/worked example · not timed/i);
    screen.getByLabelText(/solved 3 by 3 puzzle grid/i);
    screen.getByText(/tap a shape to place it; tap it again to remove it/i);
    const shapes = screen.getAllByRole("button", { name: /^(corner|line|box|arrow) |square$|circle$/ });
    expect(shapes).toHaveLength(ELEMENTS);
    expect(shapes.every((b) => b.disabled)).toBe(true);
    screen.getByRole("button", { name: "Start" });
    expect(screen.queryByRole("timer")).toBeNull();
    // what practice sends is stated where Start is, before it is pressed
    screen.getByText(/practice sends your cells to the server to be scored and keeps nothing/i);
    expect(vi.mocked(startPractice)).not.toHaveBeenCalled();
  });

  it("is reachable again from the result screen, and leads back", () => {
    localStorage.setItem(LKEY, JSON.stringify(savedOmib()));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /see how a puzzle works/i }));
    screen.getByText(/worked example/i);
    fireEvent.click(screen.getByRole("button", { name: /back to your result/i }));
    screen.getByText(/sharper than 66%/i);
  });
});

describe("a practice attempt (D452)", () => {
  it("Start → build every cell → Done ×25 → the server's result, saved as v3 and counted nowhere", async () => {
    vi.useFakeTimers();
    vi.mocked(startPractice).mockResolvedValue({ seed: 7, items: codes(), capMs: ITEM_CAP });
    vi.mocked(submitPractice).mockResolvedValue(score({ practice: true }));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {}); // resolve startPractice

    // item 1: the board, the live palette, Done dormant until a shape lands
    screen.getByLabelText(/3 by 3 puzzle grid, bottom-right cell to build/i);
    expect(tile("corner top-left").getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    // place two, remove one: the tile lights, Clear appears, and toggling off works
    fireEvent.click(tile("corner top-left"));
    fireEvent.click(tile("filled circle"));
    expect(tile("corner top-left").getAttribute("aria-pressed")).toBe("true");
    screen.getByRole("button", { name: "Clear" });
    fireEvent.click(tile("filled circle"));
    expect(tile("filled circle").getAttribute("aria-pressed")).toBe("false");
    // Clear empties the cell and disappears
    fireEvent.click(tile("arrow up"));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(tile("corner top-left").getAttribute("aria-pressed")).toBe("false");

    // now answer every item with shape i, dwelling 3s so the clock measures something
    const want = [];
    for (let i = 0; i < N; i++) {
      act(() => { vi.advanceTimersByTime(3000); });
      const id = i % ELEMENTS;
      fireEvent.click(screen.getAllByRole("button", { name: /^(corner|line|box|arrow) |square$|circle$/ })[
        // PALETTE_ORDER is column = family, row = member: the tile for id sits at row id%4, column id/4
        (id % 4) * 5 + Math.floor(id / 4)
      ]);
      want.push(cellOf([id]));
      done();
    }
    await act(async () => {}); // resolve submitPractice

    // the payload is the constructed cells, exactly as built, with the seed the start handed out
    expect(vi.mocked(submitPractice)).toHaveBeenCalledWith(7, want);
    // the result screen: the count, the claim against the calibration sample, the range, the note
    screen.getByText(/25 of 25/);
    screen.getByText(/Sharper than 96% of the 2572 people this test was calibrated on \(likely 93–98\)\./);
    screen.getByText(/practice: scored on the server against a calibrated bank, counted nowhere/i);
    expect(screen.queryByText("verified")).toBeNull();
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved).toMatchObject({ v: 3, bank: "omib", seed: 7, gv: 1, theta: 1.8, se: 0.36, pctile: 96, band: [93, 98], source: "model" });
    expect(saved.verified).toBeUndefined();
    expect(saved.marks).toHaveLength(N);
    expect(saved.diffs).toEqual(diffs());
    // each recorded time is the 3s dwell exactly — the reveal delay is the animation's, not the solver's
    expect(saved.times).toEqual(Array.from({ length: N }, () => 3000));
  });

  it("the clock: the numeral surfaces in the final 20s, and at 90s the cell commits AS IT STANDS", async () => {
    vi.useFakeTimers();
    vi.mocked(startPractice).mockResolvedValue({ seed: 7, items: codes(), capMs: ITEM_CAP });
    vi.mocked(submitPractice).mockResolvedValue(score({ marks: Array.from({ length: N }, () => false), score: 0, theta: -2.1, pctile: 2, band: [1, 4] }));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {});
    // the sitting's remainder is in the header: 25 × 90s
    screen.getByText("37:30");

    fireEvent.click(tile("box top")); // a partial build, never committed by hand
    act(() => { vi.advanceTimersByTime(69500); });
    expect(screen.queryByRole("timer")).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole("timer").textContent).toBe("20s");
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("timer").textContent).toBe("10s");
    // …and at 90s the item commits what was placed and moves on
    act(() => { vi.advanceTimersByTime(10000); });
    act(() => { vi.advanceTimersByTime(COMMIT_DELAY); });
    expect(screen.queryByRole("timer")).toBeNull();
    expect(tile("box top").getAttribute("aria-pressed")).toBe("false"); // item 2, fresh

    for (let i = 1; i < N; i++) done(); // skip the rest with the empty cell
    await act(async () => {});
    const sent = vi.mocked(submitPractice).mock.calls[0][1];
    expect(sent[0]).toBe(cellOf([8])); // the partial build WAS the answer
    expect(sent.slice(1).every((c) => c === EMPTY)).toBe(true); // Done on an empty cell is a skip
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved.times[0]).toBe(ITEM_CAP); // the expired item records the full budget
    expect(saved.times[1]).toBe(0); // instant Done
  });

  it("a refused start says why and stays on the example", async () => {
    vi.mocked(startPractice).mockRejectedValue(new Error("couldn't reach the server — nothing was counted"));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {});
    screen.getByText(/couldn't reach the server/);
    screen.getByRole("button", { name: "Start" });
  });

  it("a failed submit keeps the cells: Retry resubmits the same twenty-five", async () => {
    vi.useFakeTimers();
    vi.mocked(startPractice).mockResolvedValue({ seed: 7, items: codes(), capMs: ITEM_CAP });
    vi.mocked(submitPractice)
      .mockRejectedValueOnce(new Error("couldn't reach the server"))
      .mockResolvedValueOnce(score({ practice: true }));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {});
    for (let i = 0; i < N; i++) { fireEvent.click(tile("line upper-left")); done(); }
    await act(async () => {});
    screen.getByText(/couldn't reach the server/);
    fireEvent.click(screen.getByText("Retry"));
    await act(async () => {});
    expect(vi.mocked(submitPractice)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitPractice).mock.calls[1]).toEqual(vi.mocked(submitPractice).mock.calls[0]);
    screen.getByText(/25 of 25/);
  });
});

describe("a verified attempt (D57)", () => {
  it("start → answer-blind run → cells submitted → the server's result saved, badged", async () => {
    vi.useFakeTimers();
    vi.mocked(startVerified).mockResolvedValue({ items: codes(), capMs: ITEM_CAP, deadlineMs: 26 * ITEM_CAP });
    vi.mocked(submitVerified).mockResolvedValue(score({ durationMs: 60000 }));
    localStorage.setItem(LKEY, JSON.stringify(savedOmib()));
    render(<LogicOverlay onClose={() => {}} />);

    // the consent sentence sits with the button, before any press, and it
    // names WHERE THE SCORE GOES (the half a previous wording got backwards)
    const consent = screen.getByText(/scored on the server and join an anonymous count/i);
    expect(consent.textContent).toMatch(/anyone signed in/i);
    expect(consent.textContent).not.toMatch(/leaves this device/i);
    fireEvent.click(screen.getByText("Verified attempt"));
    await act(async () => {});
    const want = [];
    for (let i = 0; i < N; i++) {
      fireEvent.click(tile("outlined square"));
      want.push(cellOf([13]));
      done();
    }
    await act(async () => {});

    expect(vi.mocked(submitVerified)).toHaveBeenCalledWith(want);
    screen.getByText("verified"); // the badge
    screen.getByText(/verified: scored on the server, counted once/i);
    screen.getByText(/of the 2572 people this test was calibrated on/i);
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved).toMatchObject({ v: 3, bank: "omib", verified: true, seed: 7, gv: 1, pctile: 96, source: "model", durationMs: 60000 });
    expect(saved.times).toHaveLength(N); // local timings ride along for Pace
  });

  it("a measured response flips the claim: rank among n verified players (D60)", async () => {
    vi.useFakeTimers();
    vi.mocked(startVerified).mockResolvedValue({ items: codes(), capMs: ITEM_CAP, deadlineMs: 26 * ITEM_CAP });
    vi.mocked(submitVerified).mockResolvedValue(score({ pctile: 91, source: "measured", n: 250, band: [84, 96], durationMs: 60000 }));
    localStorage.setItem(LKEY, JSON.stringify(savedOmib()));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByText("Verified attempt"));
    await act(async () => {});
    for (let i = 0; i < N; i++) done();
    await act(async () => {});
    screen.getByText(/Sharper than 91% of 250 verified players \(likely 84–96\)\./);
    screen.getByText(/still modelled sketches/i);
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved).toMatchObject({ verified: true, source: "measured", n: 250, pctile: 91, band: [84, 96] });
  });

  it("a refused start reports the server's reason and leaves the result screen intact", async () => {
    vi.mocked(startVerified).mockRejectedValue(new Error("too many starts today"));
    localStorage.setItem(LKEY, JSON.stringify(savedOmib()));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByText("Verified attempt"));
    await act(async () => {});
    screen.getByText(/too many starts today/);
    screen.getByText("Retake"); // still on the result screen
  });
});

describe("the result screen's five lenses", () => {
  it("every lens renders on a saved OMIB result, each with the note", () => {
    localStorage.setItem(LKEY, JSON.stringify(savedOmib()));
    render(<LogicOverlay onClose={() => {}} />);
    const lenses = [
      ["Answers", /solved by: lower/i],
      ["Ceiling", /expected difficulty curve/i],
      ["Pace", /Deliberate|Quick/],
      ["Field", /everyone who played, as one field/i],
      ["Compare", /large populations only/i],
    ];
    for (const [label, probe] of lenses) {
      fireEvent.click(screen.getByRole("tab", { name: label }));
      expect(screen.getByText(probe), label).toBeTruthy();
      // the one honesty line, on every lens — five charts must not imply
      // five measurements, and the number names its population
      expect(screen.getByText(/counted nowhere/i), `${label} lost the note`).toBeTruthy();
    }
  });

  it("a generator-era result (v2, or the v1 payload) keeps its own wording", () => {
    // v1: marks and a timestamp, nothing else — loadResult back-fills the
    // percentile through the generator's curve, and the claim's population
    // is the generator era's "players", never the calibration sample
    localStorage.setItem(LKEY, JSON.stringify({ marks: [true, true, false, true, false, true, false, false], when: 1 }));
    render(<LogicOverlay onClose={() => {}} />);
    screen.getByText(/4 of 8/);
    screen.getByText(/Sharper than \d+% of players/);
    screen.getByText(/this practice result sent nothing anywhere/i);
    screen.getByText("8"); // the 8th row's numeral
    expect(screen.queryByText("9")).toBeNull(); // and no phantom 9th
  });
});
