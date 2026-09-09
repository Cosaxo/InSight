// The duel cue's contract (2026-08-26) — the mapCue shape, so the same
// three rules hold: take-once (a cue is a navigation, not a setting),
// mode-scoped (the duo viewer must never consume a group cue left for
// the other tab), and subscriber-notified for a viewer already mounted.
import { describe, expect, it, vi } from "vitest";
import { cueDuel, onDuelCue, takeDuelCue } from "./duelCue";

describe("the duel cue", () => {
  it("is take-once — the first consumer wins, the next mount starts neutral", () => {
    cueDuel({ mode: "duo", id: "p1" });
    expect(takeDuelCue("duo")).toBe("p1");
    expect(takeDuelCue("duo")).toBeNull();
  });

  it("is mode-scoped — the wrong viewer neither takes nor clears it", () => {
    cueDuel({ mode: "group", id: "g1" });
    expect(takeDuelCue("duo")).toBeNull();
    expect(takeDuelCue("group")).toBe("g1");
  });

  it("notifies a mounted viewer, and a broken listener stops nobody", () => {
    const bad = vi.fn(() => { throw new Error("boom"); });
    const good = vi.fn();
    const offBad = onDuelCue(bad);
    const offGood = onDuelCue(good);
    cueDuel({ mode: "duo", id: "p2" });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    offBad();
    offGood();
    takeDuelCue("duo"); // leave nothing behind for the next suite
  });
});
