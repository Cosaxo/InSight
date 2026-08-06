// @vitest-environment jsdom
//
// The Logic overlay's behaviour — the layer between logic-gen (heavily
// unit-tested) and the smoke suite (mounts only): until this file, no test
// executed pick() → score → save, and four of the five result lenses had
// never rendered anywhere.
//
// Rendered DIRECTLY (window.LogicOverlay after importing the module), not
// through the full App: there is no ErrorBoundary here, so a crash in any
// lens fails the case instead of tripping a boundary this file would then
// have to assert around.
//
// Determinism: the overlay seeds each attempt from crypto.getRandomValues,
// so the test pins the seed by stubbing exactly that — the real generator
// then produces a known form and the test can click the RIGHT answer every
// round. Timers are fake; the reveal delay (240ms) and the dwell before
// each pick are advanced explicitly, which is what makes the saved
// per-puzzle times assertable to the millisecond.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { generateForm, version as genVersion } from "../data/logic-gen";
import { LKEY, logicPctile } from "../data/logic-score";
// The verified transport is mocked wholesale: these tests own the overlay's
// state machine, not the wire — the callables' real behaviour is pinned in
// functions/src/logic.test.ts and the rules suite.
vi.mock("../data/logic-verify", () => ({
  startVerified: vi.fn(),
  submitVerified: vi.fn(),
  verifyErrorMessage: (e) => (e && e.message) || "err",
}));
import { startVerified, submitVerified } from "../data/logic-verify";
import "../spec/logic-test.jsx";

const SEED = 424242;
const PICK_DELAY = 240; // logic-test.jsx's reveal delay, pinned by the timing case

let LogicOverlay;
beforeAll(() => {
  LogicOverlay = window.LogicOverlay;
  expect(typeof LogicOverlay).toBe("function");
});

afterEach(() => {
  cleanup();
  localStorage.removeItem(LKEY);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const seedCrypto = () =>
  vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((arr) => {
    arr[0] = SEED;
    return arr;
  });

describe("a full attempt", () => {
  it("clicking every correct answer lands a perfect v2 result, timed", () => {
    vi.useFakeTimers();
    seedCrypto();
    const expected = generateForm(SEED);
    render(<LogicOverlay onClose={() => {}} />);

    for (let i = 0; i < 12; i++) {
      // dwell 3s so the per-puzzle clock has something honest to measure
      act(() => { vi.advanceTimersByTime(3000); });
      fireEvent.click(screen.getByLabelText(`Answer ${expected.items[i].a + 1} of 6`));
      act(() => { vi.advanceTimersByTime(PICK_DELAY); });
    }

    // the result screen, immediately after the last reveal delay
    screen.getByText(/12 of 12/);
    screen.getByText(new RegExp(`Sharper than ${logicPctile(1)}% of players`));
    // …and the disclosure that every field here is a model, without
    // touching a single lens tab
    screen.getByText(/modelled yardstick/i);

    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved).toMatchObject({ v: 2, seed: SEED, gv: genVersion, pctile: logicPctile(1) });
    expect(saved.marks).toHaveLength(12);
    expect(saved.marks.every(Boolean)).toBe(true);
    expect(saved.diffs).toEqual(expected.items.map((it) => it.diff));
    // the reveal delay is the animation's time, not the solver's — each
    // recorded time is the 3s dwell exactly, 240ms subtracted
    expect(saved.times).toEqual(Array.from({ length: 12 }, () => 3000));
  });

  it("wrong picks score as wrong — the marks follow the clicks", () => {
    vi.useFakeTimers();
    seedCrypto();
    const expected = generateForm(SEED);
    render(<LogicOverlay onClose={() => {}} />);
    // first answer deliberately wrong, the rest right
    for (let i = 0; i < 12; i++) {
      const right = expected.items[i].a;
      const pickIdx = i === 0 ? (right + 1) % 6 : right;
      fireEvent.click(screen.getByLabelText(`Answer ${pickIdx + 1} of 6`));
      act(() => { vi.advanceTimersByTime(PICK_DELAY); });
    }
    screen.getByText(/11 of 12/);
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved.marks[0]).toBe(false);
    expect(saved.pctile).toBe(logicPctile(11 / 12));
  });

  it("an unanswered puzzle expires at the cap: scored wrong, timed at 90s (D54)", () => {
    vi.useFakeTimers();
    seedCrypto();
    const expected = generateForm(SEED);
    render(<LogicOverlay onClose={() => {}} />);

    // the countdown stays hidden until the final 20s…
    act(() => { vi.advanceTimersByTime(69500); });
    expect(screen.queryByRole("timer")).toBeNull();
    // …then surfaces and counts down…
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole("timer").textContent).toBe("20s");
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("timer").textContent).toBe("10s");
    // …and at 90s the item settles as unanswered, advancing to puzzle 2
    act(() => { vi.advanceTimersByTime(10000); });
    act(() => { vi.advanceTimersByTime(PICK_DELAY); });
    expect(screen.queryByRole("timer")).toBeNull();

    for (let i = 1; i < 12; i++) {
      fireEvent.click(screen.getByLabelText(`Answer ${expected.items[i].a + 1} of 6`));
      act(() => { vi.advanceTimersByTime(PICK_DELAY); });
    }
    screen.getByText(/11 of 12/);
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved.marks[0]).toBe(false);
    expect(saved.marks.slice(1).every(Boolean)).toBe(true);
    // the expired item records the full budget — never a phantom fast solve
    expect(saved.times[0]).toBe(90000);
    expect(saved.times[1]).toBe(0); // instant pick, reveal delay subtracted
  });
});

describe("a verified attempt (D55)", () => {
  // What the server actually sends: cells, opts and diff — no answer
  // index, no family names, no seed.
  const serverItems = (form) => form.items.map(({ cells, opts, diff }) => ({ cells, opts, diff }));
  const priorResult = () => ({
    v: 2, seed: 1, gv: genVersion,
    marks: Array.from({ length: 12 }, () => true),
    times: Array.from({ length: 12 }, () => 1500),
    diffs: generateForm(1).items.map((it) => it.diff),
    pctile: logicPctile(1), when: 1,
  });

  it("start → answer-blind run → picks submitted → the server's result saved, badged", async () => {
    vi.useFakeTimers();
    const expected = generateForm(SEED);
    vi.mocked(startVerified).mockResolvedValue({ items: serverItems(expected), capMs: 90000, deadlineMs: 13 * 90000 });
    vi.mocked(submitVerified).mockResolvedValue({
      marks: expected.items.map(() => true), score: 12, pctile: logicPctile(1),
      durationMs: 60000, seed: SEED, gv: genVersion,
    });
    localStorage.setItem(LKEY, JSON.stringify(priorResult()));
    render(<LogicOverlay onClose={() => {}} />);

    // the consent sentence sits with the button, before any press
    screen.getByText(/sends your picks to be scored on the server/i);
    fireEvent.click(screen.getByText("Verified attempt"));
    await act(async () => {}); // resolve startVerified
    for (let i = 0; i < 12; i++) {
      fireEvent.click(screen.getByLabelText(`Answer ${expected.items[i].a + 1} of 6`));
      act(() => { vi.advanceTimersByTime(PICK_DELAY); });
    }
    await act(async () => {}); // resolve submitVerified

    // the payload is the raw picks, exactly as clicked
    expect(vi.mocked(submitVerified)).toHaveBeenCalledWith(expected.items.map((it) => it.a));
    screen.getByText("verified"); // the badge
    screen.getByText(/counted once toward an anonymous field count/i);
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved).toMatchObject({ verified: true, seed: SEED, gv: genVersion, pctile: logicPctile(1), source: "model" });
    expect(saved.marks.every(Boolean)).toBe(true);
    expect(saved.times).toHaveLength(12); // local timings ride along for Pace
  });

  it("a refused start reports the server's reason and leaves the result screen intact", async () => {
    vi.mocked(startVerified).mockRejectedValue(new Error("too many starts today"));
    localStorage.setItem(LKEY, JSON.stringify(priorResult()));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByText("Verified attempt"));
    await act(async () => {});
    screen.getByText(/too many starts today/);
    screen.getByText("Retake"); // still on the result screen
  });

  it("a failed submit keeps the picks: Retry resubmits the same twelve", async () => {
    vi.useFakeTimers();
    const expected = generateForm(SEED);
    vi.mocked(startVerified).mockResolvedValue({ items: serverItems(expected), capMs: 90000, deadlineMs: 13 * 90000 });
    vi.mocked(submitVerified)
      .mockRejectedValueOnce(new Error("couldn't reach the server"))
      .mockResolvedValueOnce({
        marks: expected.items.map((_, i) => i !== 0), score: 11, pctile: logicPctile(11 / 12),
        durationMs: 60000, seed: SEED, gv: genVersion,
      });
    localStorage.setItem(LKEY, JSON.stringify(priorResult()));
    render(<LogicOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByText("Verified attempt"));
    await act(async () => {});
    for (let i = 0; i < 12; i++) {
      const right = expected.items[i].a;
      fireEvent.click(screen.getByLabelText(`Answer ${(i === 0 ? (right + 1) % 6 : right) + 1} of 6`));
      act(() => { vi.advanceTimersByTime(PICK_DELAY); });
    }
    await act(async () => {});
    screen.getByText(/couldn't reach the server/);
    fireEvent.click(screen.getByText("Retry"));
    await act(async () => {});
    expect(vi.mocked(submitVerified)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitVerified).mock.calls[1][0]).toEqual(vi.mocked(submitVerified).mock.calls[0][0]);
    const saved = JSON.parse(localStorage.getItem(LKEY));
    expect(saved).toMatchObject({ verified: true, pctile: logicPctile(11 / 12) });
    expect(saved.marks[0]).toBe(false);
  });
});

describe("the result screen's five lenses", () => {
  const savedResult = (marks) => ({
    v: 2, seed: 1, gv: genVersion, marks,
    times: marks.map(() => 1500),
    diffs: generateForm(1).items.slice(0, marks.length).map((it) => it.diff),
    pctile: logicPctile(marks.filter(Boolean).length / marks.length),
    when: 1,
  });

  it("every lens renders on a saved result, each with the model disclosed", () => {
    const marks = [true, true, true, false, true, false, true, false, false, true, false, false];
    localStorage.setItem(LKEY, JSON.stringify(savedResult(marks)));
    render(<LogicOverlay onClose={() => {}} />);
    // tab label → copy only that lens draws
    const lenses = [
      ["Answers", /solved by: lower/i],
      ["Ceiling", /expected difficulty curve/i],
      ["Pace", /Deliberate|Quick/],
      ["Field", /no one else is ever singled out/i],
      ["Compare", /no circle, no named compares/i],
    ];
    for (const [label, probe] of lenses) {
      fireEvent.click(screen.getByRole("tab", { name: label }));
      expect(screen.getByText(probe), label).toBeTruthy();
      // the one honesty line, on every lens — five charts must not imply
      // five measurements
      expect(screen.getByText(/modelled yardstick/i), `${label} lost the note`).toBeTruthy();
    }
  });

  it("a result of another length renders against its own marks (the /11 regression)", () => {
    // The Answers lens once hardcoded /11 and mapped rows over the puzzle
    // bank instead of the saved marks — fixed before the generator landed,
    // pinned here for the first time: 8 marks must draw 8 rows.
    localStorage.setItem(LKEY, JSON.stringify({ marks: [true, true, false, true, false, true, false, false], when: 1 }));
    render(<LogicOverlay onClose={() => {}} />);
    screen.getByText(/4 of 8/);
    screen.getByText("8"); // the 8th row's numeral
    expect(screen.queryByText("9")).toBeNull(); // and no phantom 9th
  });
});
