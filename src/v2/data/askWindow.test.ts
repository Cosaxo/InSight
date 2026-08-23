// The ask window's arithmetic (D231).
//
// Pinned rather than eyeballed because every value here is a claim the
// card makes on screen: the ring's fill is a fraction of a real deadline,
// and the number beside it is the reader's remaining chance to answer. The
// old ring it replaces read the wall clock and nothing about the question
// (world-feed's `renderClock`), which is exactly why it could not be wrong.
import { describe, expect, it } from "vitest";
import { askWindow } from "./askWindow";

const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
const W = { from: "2026-08-23", until: "2026-08-29" };

describe("askWindow", () => {
  it("counts both ends in", () => {
    expect(askWindow(W, at("2026-08-23"))).toMatchObject({ days: 7, daysLeft: 7, frac: 1, label: "7d" });
    expect(askWindow(W, at("2026-08-29"))).toMatchObject({ days: 7, daysLeft: 1, label: "1d" });
  });

  it("drains a day at a time", () => {
    const left = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"]
      .map((d) => askWindow(W, at(d))?.daysLeft);
    expect(left).toEqual([6, 5, 4, 3, 2]);
  });

  it("is null once the window has closed", () => {
    // The bank filter should already have dropped the card; this is the
    // second answer for the device whose clock crossed midnight mid-session.
    expect(askWindow(W, at("2026-08-30"))).toBe(null);
    expect(askWindow(W, at("2027-01-01"))).toBe(null);
  });

  it("never draws fuller than full before it opens", () => {
    // `fresh()` will not serve a card before its window opens, so this is
    // the clock-skewed device: a full ring and the window's own length,
    // never the distance from today to a close weeks away.
    const early = askWindow(W, at("2026-08-01"));
    expect(early?.frac).toBe(1);
    expect(early?.daysLeft).toBe(7);
  });

  it("is null for a question with no window, which is nearly all of them", () => {
    expect(askWindow({})).toBe(null);
    expect(askWindow({ from: "2026-08-23" })).toBe(null);
    expect(askWindow({ until: "2026-08-29" })).toBe(null);
    expect(askWindow({ from: "23-08-2026", until: "2026-08-29" })).toBe(null);
    // Closes before it opens — check:content refuses it, so this is the
    // client refusing to render what could only arrive from a bank that
    // predates the gate.
    expect(askWindow({ from: "2026-08-29", until: "2026-08-23" })).toBe(null);
  });

  it("holds across a month boundary and against a local offset", () => {
    const w = { from: "2026-08-29", until: "2026-09-02" };
    expect(askWindow(w, at("2026-08-29"))?.days).toBe(5);
    expect(askWindow(w, at("2026-09-02"))?.daysLeft).toBe(1);
    // 23:00 and 01:00 UTC on the same UTC day are the same day, whatever
    // the device thinks its own date is.
    expect(askWindow(w, at("2026-08-31", 1))?.daysLeft).toBe(3);
    expect(askWindow(w, at("2026-08-31", 23))?.daysLeft).toBe(3);
  });

  it("serves a one-day window for one day", () => {
    const w = { from: "2026-08-23", until: "2026-08-23" };
    expect(askWindow(w, at("2026-08-23"))).toMatchObject({ days: 1, daysLeft: 1, frac: 1 });
    expect(askWindow(w, at("2026-08-24"))).toBe(null);
  });
});
